import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomSession } from '../RoomSession';
import type { SessionSnapshot } from '../RoomSession';
import { createFakeTransportBus, createFakeTransportPair } from '../transport';
import type { RoomTransport } from '../transport';

const CODE = 'ABC234';

const TIMING = {
  heartbeatMs: 100,
  timeoutMs: 300,
  joinTimeoutMs: 200,
};

function makeHost(transport: RoomTransport, name = 'ALICE') {
  return new RoomSession({
    role: 'host',
    roomCode: CODE,
    myId: 'host-1',
    myName: name,
    transport,
    ...TIMING,
  });
}

function makeGuest(transport: RoomTransport, name = 'BOB', id = 'guest-1') {
  return new RoomSession({
    role: 'guest',
    roomCode: CODE,
    myId: id,
    myName: name,
    transport,
    ...TIMING,
  });
}

function connectPair() {
  const [hostTransport, guestTransport] = createFakeTransportPair();
  const host = makeHost(hostTransport);
  const guest = makeGuest(guestTransport);
  host.start();
  guest.start();
  return { host, guest, hostTransport, guestTransport };
}

function settled(session: RoomSession): SessionSnapshot {
  return session.getSnapshot();
}

describe('RoomSession handshake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects host and guest with exchanged names and marks', () => {
    const { host, guest } = connectPair();

    const hostSnap = settled(host);
    const guestSnap = settled(guest);

    expect(hostSnap.status).toBe('connected');
    expect(guestSnap.status).toBe('connected');
    expect(hostSnap.opponentName).toBe('BOB');
    expect(guestSnap.opponentName).toBe('ALICE');
    expect(hostSnap.myMark).toBe('X');
    expect(guestSnap.myMark).toBe('O');
    expect(hostSnap.state.phase).toBe('playing');
    expect(guestSnap.state.phase).toBe('playing');
    expect(hostSnap.state.playerNames).toEqual({ X: 'ALICE', O: 'BOB' });
  });

  it('rejects a guest when no host is present', () => {
    const [, guestTransport] = createFakeTransportPair();
    const guest = makeGuest(guestTransport);
    guest.start();

    expect(settled(guest).status).toBe('connecting');
    vi.advanceTimersByTime(TIMING.joinTimeoutMs + 10);
    expect(settled(guest).status).toBe('rejected');
  });

  it('rejects a second guest when the room is full', () => {
    const bus = createFakeTransportBus();
    const host = makeHost(bus.createEndpoint());
    host.start();
    const guest = makeGuest(bus.createEndpoint());
    guest.start();
    expect(settled(host).status).toBe('connected');

    const third = makeGuest(bus.createEndpoint(), 'EVE', 'guest-2');
    third.start();

    expect(settled(third).status).toBe('rejected');
    expect(settled(host).status).toBe('connected');
    expect(settled(host).opponentName).toBe('BOB');
  });

  it('notifies subscribers on every snapshot change', () => {
    const [hostTransport, guestTransport] = createFakeTransportPair();
    const host = makeHost(hostTransport);
    const seen: SessionSnapshot[] = [];
    host.subscribe((snap) => seen.push(snap));
    host.start();
    makeGuest(guestTransport).start();

    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[seen.length - 1].status).toBe('connected');
  });

  it('does nothing on start when already started', () => {
    const [hostTransport, guestTransport] = createFakeTransportPair();
    const host = makeHost(hostTransport);
    host.start();
    host.start();
    makeGuest(guestTransport).start();

    expect(settled(host).status).toBe('connected');
  });
});

describe('RoomSession moves', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses playMove before the session is connected', () => {
    const [hostTransport] = createFakeTransportPair();
    const host = makeHost(hostTransport);
    host.start();

    expect(host.playMove(0)).toBe(false);
  });

  it('syncs moves between host and guest with alternating turns', () => {
    const { host, guest } = connectPair();

    expect(host.playMove(4)).toBe(true);
    expect(settled(guest).state.board[4]).toBe('X');
    expect(settled(guest).state.currentPlayer).toBe('O');
    expect(settled(host).state.currentPlayer).toBe('O');

    expect(host.playMove(0)).toBe(false); // not host's turn
    expect(guest.playMove(0)).toBe(true);
    expect(settled(host).state.board[0]).toBe('O');
    expect(settled(host).state.currentPlayer).toBe('X');
  });

  it('ignores an out-of-turn or illegal remote move', () => {
    const { host, guest } = connectPair();

    expect(guest.playMove(4)).toBe(false); // not guest's turn yet
    expect(host.playMove(4)).toBe(true);
    expect(settled(guest).state.board[4]).toBe('X');

    expect(host.playMove(4)).toBe(false); // occupied
    expect(settled(guest).state.board.filter(Boolean)).toHaveLength(1);
  });

  it('reaches a win on both sides with identical results', () => {
    const { host, guest } = connectPair();

    // X: 0,1,2 — O: 3,4
    host.playMove(0);
    guest.playMove(3);
    host.playMove(1);
    guest.playMove(4);
    host.playMove(2);

    for (const session of [host, guest]) {
      const { state } = settled(session);
      expect(state.phase).toBe('finished');
      expect(state.result?.type).toBe('win');
      expect(state.scores.X).toBe(1);
      expect(state.scores.O).toBe(0);
    }
  });
});

describe('RoomSession rematch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function playToWin({ host, guest }: { host: RoomSession; guest: RoomSession }) {
    host.playMove(0);
    guest.playMove(3);
    host.playMove(1);
    guest.playMove(4);
    host.playMove(2);
  }

  it('restarts only when both sides request a rematch', () => {
    const { host, guest } = connectPair();
    playToWin({ host, guest });

    host.requestRematch();
    expect(settled(host).state.phase).toBe('finished');
    expect(settled(guest).state.phase).toBe('finished');
    expect(settled(host).rematchRequested).toBe(true);
    expect(settled(guest).rematchRequested).toBe(false);

    guest.requestRematch();

    for (const session of [host, guest]) {
      const snap = settled(session);
      expect(snap.state.phase).toBe('playing');
      expect(snap.state.board.every((cell) => cell === 0)).toBe(true);
      expect(snap.rematchRequested).toBe(false);
      expect(snap.state.scores.X).toBe(1);
    }
  });

  it('lets the guest-first request also trigger the handshake', () => {
    const { host, guest } = connectPair();
    playToWin({ host, guest });

    guest.requestRematch();
    expect(settled(guest).rematchRequested).toBe(true);
    expect(settled(host).state.phase).toBe('finished');

    host.requestRematch();

    expect(settled(host).state.phase).toBe('playing');
    expect(settled(guest).state.phase).toBe('playing');
  });

  it('ignores rematch requests before the game is finished', () => {
    const { host, guest } = connectPair();
    expect(host.requestRematch()).toBe(false);
    expect(guest.requestRematch()).toBe(false);
    expect(settled(host).state.phase).toBe('playing');
  });

  it('does not restart from a single repeated request', () => {
    const { host, guest } = connectPair();
    playToWin({ host, guest });

    host.requestRematch();
    expect(host.requestRematch()).toBe(false);
    expect(settled(host).state.phase).toBe('finished');
  });
});

describe('RoomSession presence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the host disconnected when the guest leaves', () => {
    const { host, guest } = connectPair();

    guest.leave();

    expect(settled(host).status).toBe('disconnected');
    expect(settled(guest).status).toBe('connected');
  });

  it('stays connected while heartbeats flow', () => {
    const { host, guest } = connectPair();

    vi.advanceTimersByTime(TIMING.timeoutMs * 2);

    expect(settled(host).status).toBe('connected');
    expect(settled(guest).status).toBe('connected');
  });

  it('detects a dead peer through heartbeat timeout', () => {
    const { host, guest } = connectPair();

    guest.stop(); // simulate a crashed tab: no more pings or pongs

    vi.advanceTimersByTime(TIMING.timeoutMs + TIMING.heartbeatMs * 2);

    expect(settled(host).status).toBe('disconnected');
  });

  it('guest detects a dead host through heartbeat timeout', () => {
    const { host, guest } = connectPair();

    host.stop();

    vi.advanceTimersByTime(TIMING.timeoutMs + TIMING.heartbeatMs * 2);

    expect(settled(guest).status).toBe('disconnected');
  });
});