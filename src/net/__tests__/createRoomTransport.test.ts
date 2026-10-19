import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoomTransport } from '../createRoomTransport';
import type { RoomMessage } from '../protocol';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(message: RoomMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  FakeWebSocket.instances = [];
});

describe('createRoomTransport', () => {
  it('falls back to BroadcastChannel when no WS URL is configured', async () => {
    const sender = createRoomTransport('abc234');
    const receiver = createRoomTransport('ABC234');
    const received: RoomMessage[] = [];
    receiver.subscribe((message) => received.push(message));

    sender.post({ type: 'ping', roomCode: 'ABC234', playerId: 'a' });

    await expect.poll(() => received).toEqual([
      { type: 'ping', roomCode: 'ABC234', playerId: 'a' },
    ]);
    sender.close();
    receiver.close();
  });

  it('uses a WebSocket connection when VITE_WS_URL is set', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubEnv('VITE_WS_URL', 'ws://relay.example:8787/');

    const transport = createRoomTransport('abc234');
    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe('ws://relay.example:8787/room/ABC234?game=tictactoe');

    const received: RoomMessage[] = [];
    transport.subscribe((message) => received.push(message));

    transport.post({ type: 'hello', roomCode: 'ABC234', playerId: 'a', name: 'ALICE' });
    expect(socket.sent).toEqual([]);

    socket.simulateOpen();
    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'hello', roomCode: 'ABC234', playerId: 'a', name: 'ALICE' }),
    ]);

    socket.simulateMessage({ type: 'welcome', roomCode: 'ABC234', hostId: 'h', hostName: 'HOST' });
    expect(received).toEqual([
      { type: 'welcome', roomCode: 'ABC234', hostId: 'h', hostName: 'HOST' },
    ]);

    transport.close();
    transport.post({ type: 'ping', roomCode: 'ABC234', playerId: 'a' });
    expect(socket.sent).toHaveLength(1);
  });
});
