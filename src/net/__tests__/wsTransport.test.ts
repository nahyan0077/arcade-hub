// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startRelay, type RelayServer } from '../../../server/relay';
import { createWebSocketTransport } from '../wsTransport';
import type { RoomMessage } from '../protocol';

let relay: RelayServer;

beforeAll(async () => {
  relay = await startRelay(0);
});

afterAll(async () => {
  await relay.close();
});

function wsUrl(roomCode: string): string {
  return `ws://127.0.0.1:${relay.port}/room/${roomCode}`;
}

describe('createWebSocketTransport against the relay', () => {
  it('delivers a message posted before the socket opens', async () => {
    const sender = createWebSocketTransport(wsUrl('ABC234'));
    const receiver = createWebSocketTransport(wsUrl('ABC234'));
    const received: RoomMessage[] = [];
    receiver.subscribe((message) => received.push(message));

    sender.post({ type: 'ping', roomCode: 'ABC234', playerId: 'a' });

    await expect.poll(() => received.length).toBeGreaterThan(0);
    expect(received[0]).toEqual({ type: 'ping', roomCode: 'ABC234', playerId: 'a' });

    sender.close();
    receiver.close();
  });

  it('does not deliver across rooms', async () => {
    const inRoom = createWebSocketTransport(wsUrl('ABC234'));
    const roomPoster = createWebSocketTransport(wsUrl('DEF567'));
    const roomReceiver = createWebSocketTransport(wsUrl('DEF567'));
    const outsider = createWebSocketTransport(wsUrl('GHI892'));
    const roomReceived: RoomMessage[] = [];
    const outsiderReceived: RoomMessage[] = [];
    roomReceiver.subscribe((message) => roomReceived.push(message));
    outsider.subscribe((message) => outsiderReceived.push(message));

    inRoom.post({ type: 'ping', roomCode: 'ABC234', playerId: 'a' });
    roomPoster.post({ type: 'ping', roomCode: 'DEF567', playerId: 'b' });

    await expect.poll(() => roomReceived.length).toBeGreaterThan(0);
    expect(roomReceived).toEqual([{ type: 'ping', roomCode: 'DEF567', playerId: 'b' }]);
    expect(outsiderReceived).toEqual([]);

    inRoom.close();
    roomPoster.close();
    roomReceiver.close();
    outsider.close();
  });

  it('drops payloads whose roomCode does not match the connection room', async () => {
    const sender = createWebSocketTransport(wsUrl('ABC234'));
    const receiver = createWebSocketTransport(wsUrl('ABC234'));
    const received: RoomMessage[] = [];
    receiver.subscribe((message) => received.push(message));

    sender.post({ type: 'ping', roomCode: 'ZZZ999', playerId: 'a' });
    sender.post({ type: 'pong', roomCode: 'ABC234', playerId: 'a' });

    await expect.poll(() => received.length).toBeGreaterThan(0);
    expect(received).toEqual([{ type: 'pong', roomCode: 'ABC234', playerId: 'a' }]);

    sender.close();
    receiver.close();
  });

  it('rejects connections to an invalid room path', async () => {
    const closed = await new Promise<number>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${relay.port}/nope`);
      socket.onclose = (event) => resolve(event.code);
      socket.onerror = () => resolve(-1);
    });
    expect(closed).toBe(1008);
  });

  it('closes without throwing after close', () => {
    const transport = createWebSocketTransport(wsUrl('ABC234'));
    transport.close();
    expect(() =>
      transport.post({ type: 'ping', roomCode: 'ABC234', playerId: 'a' }),
    ).not.toThrow();
  });
});
