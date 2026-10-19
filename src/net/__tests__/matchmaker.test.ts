import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MatchmakerClient, type MatchmakerSocket } from '../matchmaker';

class FakeSocket implements MatchmakerSocket {
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  receive(message: object): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function makeClient(options: { timeoutMs?: number } = {}) {
  const sockets: FakeSocket[] = [];
  const client = new MatchmakerClient({
    url: 'ws://relay.local/matchmake',
    playerId: 'p1',
    timeoutMs: options.timeoutMs ?? 1000,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  return { client, sockets };
}

describe('MatchmakerClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queues, announces itself on open, and lands in matched on a match', () => {
    const { client, sockets } = makeClient();
    client.queue();
    expect(client.getSnapshot().status).toBe('queued');

    sockets[0].open();
    expect(sockets[0].sent).toEqual([
      JSON.stringify({ type: 'queue', playerId: 'p1', game: 'tictactoe' }),
    ]);

    sockets[0].receive({ type: 'matched', playerId: 'p1', roomCode: 'ABC234', role: 'host' });
    expect(client.getSnapshot()).toEqual({
      status: 'matched',
      roomCode: 'ABC234',
      role: 'host',
    });
    expect(sockets[0].closed).toBe(true);
  });

  it('ignores events addressed to another player', () => {
    const { client, sockets } = makeClient();
    client.queue();
    sockets[0].open();
    sockets[0].receive({ type: 'matched', playerId: 'p2', roomCode: 'ABC234', role: 'guest' });
    expect(client.getSnapshot().status).toBe('queued');
    expect(sockets[0].closed).toBe(false);
  });

  it('ignores malformed events', () => {
    const { client, sockets } = makeClient();
    client.queue();
    sockets[0].open();
    sockets[0].onmessage?.({ data: 'not json' });
    sockets[0].receive({ type: 'matched', playerId: 'p1', roomCode: 'bad!', role: 'host' });
    sockets[0].receive({ type: 'matched', playerId: 'p1', roomCode: 'ABC234', role: 'both' });
    expect(client.getSnapshot().status).toBe('queued');
  });

  it('times out locally when no match arrives', () => {
    const { client, sockets } = makeClient({ timeoutMs: 500 });
    client.queue();
    sockets[0].open();

    vi.advanceTimersByTime(499);
    expect(client.getSnapshot().status).toBe('queued');

    vi.advanceTimersByTime(2);
    expect(client.getSnapshot().status).toBe('timeout');
    expect(sockets[0].sent).toContainEqual(
      JSON.stringify({ type: 'cancel', playerId: 'p1', game: 'tictactoe' }),
    );
    expect(sockets[0].closed).toBe(true);
  });

  it('handles a server-sent queue-timeout', () => {
    const { client, sockets } = makeClient();
    client.queue();
    sockets[0].open();
    sockets[0].receive({ type: 'queue-timeout', playerId: 'p1' });
    expect(client.getSnapshot().status).toBe('timeout');
    expect(sockets[0].closed).toBe(true);
  });

  it('treats an unexpected socket close as a timeout', () => {
    const { client, sockets } = makeClient();
    client.queue();
    sockets[0].open();
    sockets[0].close();
    expect(client.getSnapshot().status).toBe('timeout');
  });

  it('cancels back to idle and ignores a late match', () => {
    const { client, sockets } = makeClient();
    client.queue();
    sockets[0].open();
    client.cancel();

    expect(client.getSnapshot().status).toBe('idle');
    expect(sockets[0].sent).toContainEqual(
      JSON.stringify({ type: 'cancel', playerId: 'p1', game: 'tictactoe' }),
    );
    expect(sockets[0].closed).toBe(true);

    sockets[0].receive({ type: 'matched', playerId: 'p1', roomCode: 'ABC234', role: 'host' });
    expect(client.getSnapshot().status).toBe('idle');
  });

  it('refuses to queue while already waiting', () => {
    const { client, sockets } = makeClient();
    expect(client.queue()).toBe(true);
    expect(client.queue()).toBe(false);
    expect(sockets).toHaveLength(1);
  });

  it('can queue again after a timeout', () => {
    const { client, sockets } = makeClient({ timeoutMs: 100 });
    client.queue();
    vi.advanceTimersByTime(150);
    expect(client.getSnapshot().status).toBe('timeout');

    expect(client.queue()).toBe(true);
    expect(client.getSnapshot().status).toBe('queued');
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    sockets[1].receive({ type: 'matched', playerId: 'p1', roomCode: 'DEF567', role: 'guest' });
    expect(client.getSnapshot()).toEqual({
      status: 'matched',
      roomCode: 'DEF567',
      role: 'guest',
    });
  });

  it('destroy closes the socket without a status change', () => {
    const { client, sockets } = makeClient();
    client.queue();
    sockets[0].open();
    client.destroy();
    expect(sockets[0].closed).toBe(true);
    expect(client.getSnapshot().status).toBe('queued');
  });

  it('appends the matchmaker path when only the base URL is given', () => {
    const urls: string[] = [];
    const client = new MatchmakerClient({
      url: 'ws://relay.local:8787/',
      playerId: 'p1',
      socketFactory: (url) => {
        urls.push(url);
        return new FakeSocket();
      },
    });
    client.queue();
    expect(urls).toEqual(['ws://relay.local:8787/matchmake']);
  });
});
