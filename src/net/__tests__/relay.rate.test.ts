// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startRelay, type RelayServer } from '../../../server/relay';

const VOICE = {
  url: 'ws://livekit.local:7880',
  apiKey: 'devkey',
  apiSecret: 'devsecret',
};

let plain: RelayServer;
let socketCapped: RelayServer;
let roomCapped: RelayServer;
let configured: RelayServer;

beforeAll(async () => {
  plain = await startRelay(0);
  socketCapped = await startRelay(0);
  roomCapped = await startRelay(0, { limits: { maxRooms: 2 } });
  configured = await startRelay(0, { voice: VOICE });
});

afterAll(async () => {
  await plain.close();
  await socketCapped.close();
  await roomCapped.close();
  await configured.close();
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.onerror = () => reject(new Error('socket failed'));
    socket.onopen = () => resolve(socket);
  });
}

function nextClose(socket: WebSocket): Promise<CloseEvent> {
  return new Promise((resolve) => {
    socket.onclose = (event) => resolve(event);
  });
}

describe('relay rate limits', () => {
  it('closes a room socket that floods messages past the per-socket limit', async () => {
    const socket = await connect(`ws://127.0.0.1:${plain.port}/room/ABCDEF`);
    const closed = nextClose(socket);
    for (let index = 0; index < 70; index += 1) {
      socket.send('flood');
    }
    const event = await closed;
    expect(event.code).toBe(1008);
    expect(event.reason).toBe('rate limited');
  });

  it('closes the 11th concurrent socket from one IP', async () => {
    const sockets: WebSocket[] = [];
    for (let index = 0; index < 10; index += 1) {
      sockets.push(await connect(`ws://127.0.0.1:${socketCapped.port}/matchmake`));
    }

    const overflow = await connect(`ws://127.0.0.1:${socketCapped.port}/matchmake`);
    const event = await nextClose(overflow);
    expect(event.code).toBe(1013);

    for (const socket of sockets) socket.close();
    await wait(50);
  });

  it('refuses rooms past the maxRooms cap with a 1013 close', async () => {
    const first = await connect(`ws://127.0.0.1:${roomCapped.port}/room/ABCDEF`);
    const second = await connect(`ws://127.0.0.1:${roomCapped.port}/room/GHJKMN`);

    const overflow = await connect(`ws://127.0.0.1:${roomCapped.port}/room/MNPRST`);
    const event = await nextClose(overflow);
    expect(event.code).toBe(1013);

    first.close();
    second.close();
  });

  it('rate limits voice token requests per IP with a 429', async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 31; index += 1) {
      const response = await fetch(`http://127.0.0.1:${configured.port}/voice/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomCode: 'ABCDEF', name: 'Alice' }),
      });
      statuses.push(response.status);
      if (index === 30) {
        expect(response.status).toBe(429);
        expect(await response.json()).toEqual({ error: 'rate-limited' });
      }
    }
    expect(statuses.slice(0, 30).every((status) => status !== 429)).toBe(true);
  });
});
