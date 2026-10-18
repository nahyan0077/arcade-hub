import { describe, it, expect, vi } from 'vitest';
import { createFakeTransportPair } from '../transport';
import type { RoomMessage } from '../protocol';

describe('fake transport pair', () => {
  it('delivers messages to the other endpoint only', () => {
    const [a, b] = createFakeTransportPair();
    const receivedA: RoomMessage[] = [];
    const receivedB: RoomMessage[] = [];
    a.subscribe((m) => receivedA.push(m));
    b.subscribe((m) => receivedB.push(m));

    a.post({ type: 'ping', roomCode: 'ABC234', playerId: 'p1' });

    expect(receivedA).toHaveLength(0);
    expect(receivedB).toEqual([{ type: 'ping', roomCode: 'ABC234', playerId: 'p1' }]);
  });

  it('supports multiple subscribers on one endpoint', () => {
    const [a, b] = createFakeTransportPair();
    const first = vi.fn();
    const second = vi.fn();
    b.subscribe(first);
    b.subscribe(second);

    a.post({ type: 'leave', roomCode: 'ABC234', playerId: 'p1' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops delivery after unsubscribe', () => {
    const [a, b] = createFakeTransportPair();
    const handler = vi.fn();
    const unsubscribe = b.subscribe(handler);
    unsubscribe();

    a.post({ type: 'ping', roomCode: 'ABC234', playerId: 'p1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not deliver to a closed endpoint', () => {
    const [a, b] = createFakeTransportPair();
    const handler = vi.fn();
    b.subscribe(handler);
    b.close();

    a.post({ type: 'ping', roomCode: 'ABC234', playerId: 'p1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores posts after close', () => {
    const [a, b] = createFakeTransportPair();
    const handler = vi.fn();
    b.subscribe(handler);
    a.close();

    a.post({ type: 'ping', roomCode: 'ABC234', playerId: 'p1' });

    expect(handler).not.toHaveBeenCalled();
  });
});