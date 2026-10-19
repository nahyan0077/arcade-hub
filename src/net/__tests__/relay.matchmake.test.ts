// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startRelay, type RelayServer } from '../../../server/relay';
import { isValidRoomCode, type MatchmakerMessage } from '../protocol';

let relay: RelayServer;

beforeAll(async () => {
  relay = await startRelay(0);
});

afterAll(async () => {
  await relay.close();
});

interface MatchmakerPeer {
  socket: WebSocket;
  messages: MatchmakerMessage[];
  next: (type: MatchmakerMessage['type']) => Promise<MatchmakerMessage>;
  send: (message: object | string) => void;
  close: () => void;
}

function connectMatchmaker(): Promise<MatchmakerPeer> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${relay.port}/matchmake`);
    const messages: MatchmakerMessage[] = [];
    const waiters = new Map<string, Array<(message: MatchmakerMessage) => void>>();

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as MatchmakerMessage;
      messages.push(message);
      const list = waiters.get(message.type);
      if (list && list.length > 0) list.shift()?.(message);
    };
    socket.onerror = () => reject(new Error('matchmaker socket failed'));

    const peer: MatchmakerPeer = {
      socket,
      messages,
      next: (type) =>
        new Promise((messageResolve, messageReject) => {
          const existing = messages.find((message) => message.type === type);
          if (existing !== undefined) {
            messageResolve(existing);
            return;
          }
          const list = waiters.get(type) ?? [];
          list.push(messageResolve);
          waiters.set(type, list);
          setTimeout(() => messageReject(new Error(`timed out waiting for ${type}`)), 2000);
        }),
      send: (message) => socket.send(JSON.stringify(message)),
      close: () => socket.close(),
    };

    socket.onopen = () => resolve(peer);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('relay matchmaker', () => {
  it('pairs the second player into a shared room, first waiter as host', async () => {
    const first = await connectMatchmaker();
    const second = await connectMatchmaker();

    first.send({ type: 'queue', playerId: 'p1' });
    await wait(50);
    second.send({ type: 'queue', playerId: 'p2' });

    const firstMatch = (await first.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;
    const secondMatch = (await second.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;

    expect(firstMatch.playerId).toBe('p1');
    expect(firstMatch.role).toBe('host');
    expect(secondMatch.playerId).toBe('p2');
    expect(secondMatch.role).toBe('guest');
    expect(firstMatch.roomCode).toBe(secondMatch.roomCode);
    expect(isValidRoomCode(firstMatch.roomCode)).toBe(true);

    first.close();
    second.close();
  });

  it('removes a cancelled player from the queue', async () => {
    const first = await connectMatchmaker();
    const second = await connectMatchmaker();
    const third = await connectMatchmaker();

    first.send({ type: 'queue', playerId: 'p1' });
    first.send({ type: 'cancel', playerId: 'p1' });
    second.send({ type: 'queue', playerId: 'p2' });
    await wait(100);
    expect(second.messages).toEqual([]);

    third.send({ type: 'queue', playerId: 'p3' });
    const secondMatch = (await second.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;
    const thirdMatch = (await third.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;
    expect(secondMatch.role).toBe('host');
    expect(thirdMatch.role).toBe('guest');

    first.close();
    second.close();
    third.close();
  });

  it('removes a disconnected player from the queue', async () => {
    const first = await connectMatchmaker();
    const second = await connectMatchmaker();
    const third = await connectMatchmaker();

    first.send({ type: 'queue', playerId: 'p1' });
    first.close();
    await wait(50);
    second.send({ type: 'queue', playerId: 'p2' });
    await wait(100);
    expect(second.messages).toEqual([]);

    third.send({ type: 'queue', playerId: 'p3' });
    const secondMatch = (await second.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;
    expect(secondMatch.role).toBe('host');

    second.close();
    third.close();
  });

  it('ignores malformed matchmaker payloads', async () => {
    const peer = await connectMatchmaker();
    peer.socket.send('not json');
    peer.socket.send(JSON.stringify({ type: 'queue' }));
    peer.socket.send(JSON.stringify({ type: 'queue', playerId: '' }));
    await wait(100);
    expect(peer.messages).toEqual([]);
    peer.send({ type: 'queue', playerId: 'p1' });
    peer.send('still not a queue message');
    await wait(50);
    expect(peer.messages).toEqual([]);
    peer.close();
  });

  it('hands the matched room over to a working room connection', async () => {
    const first = await connectMatchmaker();
    const second = await connectMatchmaker();

    first.send({ type: 'queue', playerId: 'p1' });
    await wait(50);
    second.send({ type: 'queue', playerId: 'p2' });
    const match = (await first.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;
    first.close();
    second.close();

    const roomMessages: Array<Record<string, unknown>> = [];
    const host = new WebSocket(`ws://127.0.0.1:${relay.port}/room/${match.roomCode}`);
    const guest = new WebSocket(`ws://127.0.0.1:${relay.port}/room/${match.roomCode}`);
    host.onmessage = (event) => roomMessages.push(JSON.parse(String(event.data)));
    await new Promise<void>((resolve, reject) => {
      let open = 0;
      const onOpen = () => {
        open += 1;
        if (open === 2) resolve();
      };
      host.onopen = onOpen;
      guest.onopen = onOpen;
      host.onerror = reject;
      guest.onerror = reject;
    });

    guest.send(
      JSON.stringify({ type: 'hello', roomCode: match.roomCode, playerId: 'p2', name: 'BOB' }),
    );
    await expect
      .poll(() => roomMessages.some((message) => message.type === 'hello'))
      .toBe(true);

    host.close();
    guest.close();
  });

  it('echoes the game in matched events and drops unknown-game queues', async () => {
    const first = await connectMatchmaker();
    const second = await connectMatchmaker();
    const stray = await connectMatchmaker();

    first.send({ type: 'queue', playerId: 'p1', game: 'tictactoe' });
    await wait(50);
    stray.send({ type: 'queue', playerId: 'px', game: 'bogus' });
    await wait(50);
    second.send({ type: 'queue', playerId: 'p2', game: 'tictactoe' });

    const match = (await first.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;
    expect(match.game).toBe('tictactoe');
    const guestMatch = (await second.next('matched')) as Extract<
      MatchmakerMessage,
      { type: 'matched' }
    >;
    expect(guestMatch.game).toBe('tictactoe');
    expect(guestMatch.roomCode).toBe(match.roomCode);

    await wait(100);
    expect(stray.messages).toEqual([]);

    first.close();
    second.close();
    stray.close();
  });

  it('does not forward room messages tagged with a different game', async () => {
    const roomMessages: Array<Record<string, unknown>> = [];
    const host = new WebSocket(`ws://127.0.0.1:${relay.port}/room/ABCDEF?game=tictactoe`);
    const guest = new WebSocket(`ws://127.0.0.1:${relay.port}/room/ABCDEF?game=tictactoe`);
    host.onmessage = (event) => roomMessages.push(JSON.parse(String(event.data)));
    await new Promise<void>((resolve, reject) => {
      let open = 0;
      const onOpen = () => {
        open += 1;
        if (open === 2) resolve();
      };
      host.onopen = onOpen;
      guest.onopen = onOpen;
      host.onerror = reject;
      guest.onerror = reject;
    });

    guest.send(
      JSON.stringify({
        type: 'hello',
        roomCode: 'ABCDEF',
        playerId: 'g1',
        name: 'BOB',
        game: 'bogus',
      }),
    );
    await wait(100);
    expect(roomMessages).toEqual([]);

    guest.send(
      JSON.stringify({
        type: 'hello',
        roomCode: 'ABCDEF',
        playerId: 'g1',
        name: 'BOB',
        game: 'tictactoe',
      }),
    );
    await expect
      .poll(() => roomMessages.some((message) => message.type === 'hello'))
      .toBe(true);

    host.close();
    guest.close();
  });
});
