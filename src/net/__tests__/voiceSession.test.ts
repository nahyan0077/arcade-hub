import { describe, it, expect, vi } from 'vitest';
import { VoiceSession, type VoiceRoom } from '../voiceSession';

class FakeRoom implements VoiceRoom {
  connectCalls: Array<{ url: string; token: string }> = [];
  disconnectCalls = 0;
  micCalls: boolean[] = [];
  private connectedListener: (() => void) | null = null;
  private disconnectedListener: (() => void) | null = null;
  private participantsListener: ((count: number) => void) | null = null;
  connectError: Error | null = null;

  async connect(url: string, token: string): Promise<void> {
    this.connectCalls.push({ url, token });
    if (this.connectError !== null) throw this.connectError;
    this.connectedListener?.();
  }

  disconnect(): void {
    this.disconnectCalls += 1;
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.micCalls.push(enabled);
  }

  onConnected(listener: () => void): void {
    this.connectedListener = listener;
  }

  onDisconnected(listener: () => void): void {
    this.disconnectedListener = listener;
  }

  onRemoteParticipantsChanged(listener: (count: number) => void): void {
    this.participantsListener = listener;
  }

  emitDisconnected(): void {
    this.disconnectedListener?.();
  }

  emitParticipants(count: number): void {
    this.participantsListener?.(count);
  }
}

function tokenResponse(): Response {
  return new Response(JSON.stringify({ url: 'ws://livekit.local:7880', token: 'tok' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSession(overrides: { fetchFn?: typeof fetch; room?: FakeRoom } = {}) {
  const room = overrides.room ?? new FakeRoom();
  const fetchFn =
    overrides.fetchFn ??
    (vi.fn(async () => tokenResponse()) as unknown as typeof fetch);
  const session = new VoiceSession({
    baseUrl: 'ws://relay.local:8787/',
    roomCode: 'ABC234',
    name: 'ALICE',
    fetchFn,
    roomFactory: async () => room,
  });
  return { session, room, fetchFn };
}

describe('VoiceSession', () => {
  it('joins: fetches a token, connects the room, and reports live', async () => {
    const { session, room, fetchFn } = makeSession();

    expect(await session.join()).toBe(true);
    expect(session.getSnapshot()).toEqual({ status: 'live', muted: true, remoteCount: 0 });

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://relay.local:8787/voice/token');
    expect(JSON.parse(String(init.body))).toEqual({
      roomCode: 'ABC234',
      name: 'ALICE',
      game: 'tictactoe',
    });
    expect(room.connectCalls).toEqual([{ url: 'ws://livekit.local:7880', token: 'tok' }]);
  });

  it('starts muted and unmutes through the room', async () => {
    const { session, room } = makeSession();
    await session.join();
    expect(session.getSnapshot().muted).toBe(true);

    expect(await session.toggleMute()).toBe(true);
    expect(room.micCalls).toEqual([true]);
    expect(session.getSnapshot().muted).toBe(false);

    await session.toggleMute();
    expect(room.micCalls).toEqual([true, false]);
    expect(session.getSnapshot().muted).toBe(true);
  });

  it('surfaces a 503 from the token endpoint as an error state', async () => {
    const factory = vi.fn(async () => new FakeRoom());
    const session = new VoiceSession({
      baseUrl: 'ws://relay.local:8787',
      roomCode: 'ABC234',
      name: 'ALICE',
      fetchFn: (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch,
      roomFactory: factory,
    });

    expect(await session.join()).toBe(false);
    expect(session.getSnapshot().status).toBe('error');
    expect(factory).not.toHaveBeenCalled();
  });

  it('reports an error when the room connection fails', async () => {
    const room = new FakeRoom();
    room.connectError = new Error('ice failed');
    const { session } = makeSession({ room });

    expect(await session.join()).toBe(false);
    expect(session.getSnapshot().status).toBe('error');
  });

  it('resets to off when the room disconnects remotely', async () => {
    const { session, room } = makeSession();
    await session.join();
    session.getSnapshot();
    room.emitParticipants(1);
    expect(session.getSnapshot().remoteCount).toBe(1);

    room.emitDisconnected();
    expect(session.getSnapshot()).toEqual({ status: 'off', muted: true, remoteCount: 0 });
  });

  it('leaves: disconnects the room and ignores a late remote disconnect', async () => {
    const { session, room } = makeSession();
    await session.join();

    await session.leave();
    expect(room.disconnectCalls).toBe(1);
    expect(session.getSnapshot().status).toBe('off');

    room.emitDisconnected();
    expect(session.getSnapshot().status).toBe('off');
  });

  it('refuses to join twice or mute while not live', async () => {
    const { session } = makeSession();
    expect(await session.toggleMute()).toBe(false);
    expect(await session.join()).toBe(true);
    expect(await session.join()).toBe(false);

    await session.leave();
    expect(await session.toggleMute()).toBe(false);
  });

  it('allows a retry after an error state', async () => {
    let attempts = 0;
    const session = new VoiceSession({
      baseUrl: 'ws://relay.local:8787',
      roomCode: 'ABC234',
      name: 'ALICE',
      fetchFn: (async () => {
        attempts += 1;
        return attempts === 1
          ? new Response('nope', { status: 503 })
          : tokenResponse();
      }) as unknown as typeof fetch,
      roomFactory: async () => new FakeRoom(),
    });

    expect(await session.join()).toBe(false);
    expect(session.getSnapshot().status).toBe('error');
    expect(await session.join()).toBe(true);
    expect(session.getSnapshot().status).toBe('live');
  });
});
