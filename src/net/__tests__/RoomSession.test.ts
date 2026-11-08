import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomSession } from '../RoomSession';
import type { ChatEvent, SessionSnapshot } from '../RoomSession';
import type { GameId } from '../protocol';
import { createFakeTransportBus, createFakeTransportPair } from '../transport';
import type { RoomTransport } from '../transport';

const CODE = 'ABC234';

const TIMING = {
  heartbeatMs: 100,
  timeoutMs: 300,
  joinTimeoutMs: 200,
  helloRetryMs: 40,
};

function makeHost(transport: RoomTransport, name = 'ALICE'): RoomSession<'tictactoe'> {
  return new RoomSession<'tictactoe'>({
    role: 'host',
    roomCode: CODE,
    myId: 'host-1',
    myName: name,
    transport,
    ...TIMING,
  });
}

function makeGuest(
  transport: RoomTransport,
  name = 'BOB',
  id = 'guest-1',
): RoomSession<'tictactoe'> {
  return new RoomSession<'tictactoe'>({
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

function settled<G extends GameId>(session: RoomSession<G>): SessionSnapshot<G> {
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

  it('repeats hello until the host shows up, then connects', () => {
    const bus = createFakeTransportBus();
    const probe = bus.createEndpoint();
    const hellos: unknown[] = [];
    probe.subscribe((message) => {
      if (message.type === 'hello') hellos.push(message);
    });

    const guest = makeGuest(bus.createEndpoint());
    guest.start();
    expect(settled(guest).status).toBe('connecting');

    vi.advanceTimersByTime(TIMING.helloRetryMs * 3);
    expect(hellos.length).toBeGreaterThanOrEqual(3);
    expect(settled(guest).status).toBe('connecting');

    const host = makeHost(bus.createEndpoint());
    host.start();
    vi.advanceTimersByTime(TIMING.helloRetryMs);

    expect(settled(guest).status).toBe('connected');
    expect(settled(host).status).toBe('connected');
    expect(settled(guest).opponentName).toBe('ALICE');

    vi.advanceTimersByTime(TIMING.joinTimeoutMs + 10);
    expect(settled(guest).status).toBe('connected');
  });

  it('stops repeating hello after a rejection deadline', () => {
    const bus = createFakeTransportBus();
    const probe = bus.createEndpoint();
    const hellos: unknown[] = [];
    probe.subscribe((message) => {
      if (message.type === 'hello') hellos.push(message);
    });

    const guest = makeGuest(bus.createEndpoint());
    guest.start();
    vi.advanceTimersByTime(TIMING.joinTimeoutMs + 10);
    expect(settled(guest).status).toBe('rejected');

    const countAfterDeadline = hellos.length;
    vi.advanceTimersByTime(TIMING.joinTimeoutMs);
    expect(hellos.length).toBe(countAfterDeadline);
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

  it('a rejected joiner leaving does not disconnect the live room', () => {
    const bus = createFakeTransportBus();
    const host = makeHost(bus.createEndpoint());
    host.start();
    const guest = makeGuest(bus.createEndpoint());
    guest.start();
    expect(settled(host).status).toBe('connected');

    const third = makeGuest(bus.createEndpoint(), 'EVE', 'guest-2');
    third.start();
    expect(settled(third).status).toBe('rejected');

    third.leave();

    expect(settled(host).status).toBe('connected');
    expect(settled(guest).status).toBe('connected');
    expect(settled(host).opponentName).toBe('BOB');
  });

  it('does not announce leave when the session never connected', () => {
    const bus = createFakeTransportBus();
    const host = makeHost(bus.createEndpoint());
    host.start();
    makeGuest(bus.createEndpoint()).start();

    const endpoint = bus.createEndpoint();
    const post = vi.spyOn(endpoint, 'post');
    const third = makeGuest(endpoint, 'EVE', 'guest-2');
    third.start();
    expect(settled(third).status).toBe('rejected');
    post.mockClear();

    third.leave();

    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'leave' }),
    );
  });

  it('host ignores a leave from a player that is not the current guest', () => {
    const { host, guestTransport } = connectPair();

    guestTransport.post({ type: 'leave', roomCode: CODE, playerId: 'stranger' });

    expect(settled(host).status).toBe('connected');
    expect(settled(host).opponentName).toBe('BOB');
  });

  it('guest ignores a leave that does not come from the host', () => {
    const { guest, hostTransport } = connectPair();

    hostTransport.post({ type: 'leave', roomCode: CODE, playerId: 'stranger' });

    expect(settled(guest).status).toBe('connected');
    expect(settled(guest).opponentName).toBe('ALICE');
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
describe('RoomSession game scoping', () => {
  it('tags outgoing messages with its game and ignores foreign-game messages', () => {
    const [hostTransport, guestTransport] = createFakeTransportPair();
    const host = makeHost(hostTransport);
    const guest = makeGuest(guestTransport);
    const hellos: Array<Record<string, unknown>> = [];
    hostTransport.subscribe((message) => {
      hellos.push(message as unknown as Record<string, unknown>);
    });

    host.start();
    guest.start();
    expect(hellos.some((message) => message.type === 'hello' && message.game === 'tictactoe')).toBe(
      true,
    );

    const foreignGuest = createFakeTransportPair()[1];
    const foreign = new RoomSession({
      role: 'guest',
      roomCode: CODE,
      myId: 'guest-x',
      myName: 'XEN',
      transport: foreignGuest,
      game: 'connect-four',
      ...TIMING,
    });
    foreign.start();
    expect(host.getSnapshot().status).toBe('connected');
    expect(host.getSnapshot().opponentName).toBe('BOB');

    host.destroy();
    guest.destroy();
    foreign.destroy();
  });

  it('rejects an unknown game at construction', () => {
    const [transport] = createFakeTransportPair();
    expect(
      () =>
        new RoomSession({
          role: 'host',
          roomCode: CODE,
          myId: 'host-9',
          myName: 'NOPE',
          transport,
          game: 'bogus' as never,
          ...TIMING,
        }),
    ).toThrow(/Unsupported game/);
  });
});

describe('RoomSession chat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('relays chat messages between host and guest without echoing to the sender', () => {
    const { host, guest } = connectPair();
    const hostEvents: ChatEvent[] = [];
    const guestEvents: ChatEvent[] = [];
    host.onChat((event) => hostEvents.push(event));
    guest.onChat((event) => guestEvents.push(event));

    expect(guest.sendChat('nice move!')).toBe(true);
    expect(guestEvents).toHaveLength(0);
    expect(hostEvents).toEqual([
      { kind: 'chat', fromId: 'guest-1', from: 'BOB', text: 'nice move!' },
    ]);

    expect(host.sendChat('  thanks  ')).toBe(true);
    expect(guestEvents).toEqual([
      { kind: 'chat', fromId: 'host-1', from: 'ALICE', text: 'thanks' },
    ]);
  });

  it('rejects empty chat and invalid emoji, and clips overlong text on receive', () => {
    const [aloneTransport] = createFakeTransportPair();
    const alone = makeHost(aloneTransport);
    expect(alone.sendChat('hi')).toBe(false);
    expect(alone.sendEmoji('🎉')).toBe(false);

    const { host, guest } = connectPair();
    expect(guest.sendChat('   ')).toBe(false);
    expect(guest.sendEmoji('💣')).toBe(false);

    const events: ChatEvent[] = [];
    host.onChat((event) => events.push(event));
    guest.sendChat('x'.repeat(500));
    expect(events).toHaveLength(1);
    expect(events[0].text).toHaveLength(200);
  });

  it('relays emoji events and drops unknown emoji from remote peers', () => {
    const { host, guest } = connectPair();
    const events: ChatEvent[] = [];
    host.onChat((event) => events.push(event));

    guest.sendEmoji('👀');
    expect(events).toEqual([
      { kind: 'emoji', fromId: 'guest-1', from: 'BOB', emoji: '👀' },
    ]);
  });
});

describe('RoomSession connect-four engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function connectC4Pair() {
    const [hostTransport, guestTransport] = createFakeTransportPair();
    const host = new RoomSession<'connect-four'>({
      role: 'host',
      roomCode: CODE,
      myId: 'host-1',
      myName: 'ALICE',
      transport: hostTransport,
      game: 'connect-four',
      ...TIMING,
    });
    const guest = new RoomSession<'connect-four'>({
      role: 'guest',
      roomCode: CODE,
      myId: 'guest-1',
      myName: 'BOB',
      transport: guestTransport,
      game: 'connect-four',
      ...TIMING,
    });
    host.start();
    guest.start();
    return { host, guest };
  }

  function playToC4Win(
    host: RoomSession<'connect-four'>,
    guest: RoomSession<'connect-four'>,
  ) {
    host.playMove(0);
    guest.playMove(1);
    host.playMove(0);
    guest.playMove(1);
    host.playMove(0);
    guest.playMove(1);
    host.playMove(0);
  }

  it('syncs column drops with gravity on both sides', () => {
    const { host, guest } = connectC4Pair();

    expect(host.playMove(0)).toBe(true);
    expect(settled(guest).state.board[0]).toBe('X');
    expect(settled(guest).state.currentPlayer).toBe('O');

    expect(host.playMove(0)).toBe(false); // not host's turn
    expect(guest.playMove(0)).toBe(true);
    expect(settled(host).state.board[7]).toBe('O'); // stacked above the X
    expect(settled(host).state.board.filter((cell) => cell !== 0)).toHaveLength(2);
  });

  it('reaches a connect-four win on both sides', () => {
    const { host, guest } = connectC4Pair();
    playToC4Win(host, guest);

    for (const session of [host, guest]) {
      const { state } = settled(session);
      expect(state.phase).toBe('finished');
      expect(state.result?.type).toBe('win');
      expect(state.result).toMatchObject({ type: 'win', player: 'X' });
      if (state.result?.type === 'win' && state.result.line && 'cells' in state.result.line) {
        expect(state.result.line.cells).toEqual([0, 7, 14, 21]);
      }
      expect(state.scores.X).toBe(1);
    }
  });

  it('rematch restarts the board with the loser serving', () => {
    const { host, guest } = connectC4Pair();
    playToC4Win(host, guest);

    expect(host.requestRematch()).toBe(true);
    expect(guest.requestRematch()).toBe(true);

    for (const session of [host, guest]) {
      const { state } = settled(session);
      expect(state.phase).toBe('playing');
      expect(state.currentPlayer).toBe('O');
      expect(state.board.every((cell) => cell === 0)).toBe(true);
      expect(state.scores.X).toBe(1);
    }
  });
});

describe('RoomSession turn timer and timeout system', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function connectTimedPair(turnTimerMs = 1000) {
    const [hostTransport, guestTransport] = createFakeTransportPair();
    const host = new RoomSession<'tictactoe'>({
      role: 'host',
      roomCode: CODE,
      myId: 'host-1',
      myName: 'ALICE',
      transport: hostTransport,
      turnTimerMs,
      ...TIMING,
    });
    const guest = new RoomSession<'tictactoe'>({
      role: 'guest',
      roomCode: CODE,
      myId: 'guest-1',
      myName: 'BOB',
      transport: guestTransport,
      turnTimerMs,
      ...TIMING,
    });
    host.start();
    guest.start();
    return { host, guest };
  }

  it('automatically skips turn on timeout without freezing the game', () => {
    const { host, guest } = connectTimedPair(1000);
    expect(host.getSnapshot().state.currentPlayer).toBe('X');
    expect(guest.getSnapshot().state.currentPlayer).toBe('X');

    const hostTimeouts: string[] = [];
    const guestTimeouts: string[] = [];
    host.onTimeout((name) => hostTimeouts.push(name));
    guest.onTimeout((name) => guestTimeouts.push(name));

    // Advance past turn timer (1000) + grace (500) for player X to time out
    vi.advanceTimersByTime(1600);

    // Turn should have switched to O on both host and guest
    expect(host.getSnapshot().state.currentPlayer).toBe('O');
    expect(guest.getSnapshot().state.currentPlayer).toBe('O');

    // Both peers received the timeout notification with ALICE's name
    expect(hostTimeouts).toEqual(['ALICE']);
    expect(guestTimeouts).toEqual(['ALICE']);

    // Counts must be exactly 1 (no double-count from independent timers)
    expect(host.getSnapshot().timeoutCounts['host-1']).toBe(1);
    expect(guest.getSnapshot().timeoutCounts['host-1']).toBe(1);

    // Guest (player O) should now be able to play move 4 successfully!
    expect(guest.playMove(4)).toBe(true);
    expect(host.getSnapshot().state.board[4]).toBe('O');
    expect(guest.getSnapshot().state.board[4]).toBe('O');
    expect(host.getSnapshot().state.currentPlayer).toBe('X');
    expect(guest.getSnapshot().state.currentPlayer).toBe('X');
  });

  it('does not double-count or desync when both peer timers would fire', () => {
    const { host, guest } = connectTimedPair(1000);

    // Past timer+grace: under the old dual-timer design both peers fired here
    vi.advanceTimersByTime(1600);

    expect(host.getSnapshot().state.currentPlayer).toBe('O');
    expect(guest.getSnapshot().state.currentPlayer).toBe('O');
    expect(host.getSnapshot().timeoutCounts['host-1']).toBe(1);
    expect(guest.getSnapshot().timeoutCounts['host-1']).toBe(1);
    expect(host.getSnapshot().state.board).toEqual(guest.getSnapshot().state.board);

    // O moves, then X times out again — one count each, boards stay in sync
    expect(guest.playMove(0)).toBe(true);
    vi.advanceTimersByTime(1600);

    expect(host.getSnapshot().state.currentPlayer).toBe('O');
    expect(guest.getSnapshot().state.currentPlayer).toBe('O');
    expect(host.getSnapshot().timeoutCounts['host-1']).toBe(2);
    expect(guest.getSnapshot().timeoutCounts['host-1']).toBe(2);
    expect(host.getSnapshot().state.board).toEqual(guest.getSnapshot().state.board);
    expect(host.getSnapshot().state.scores).toEqual(guest.getSnapshot().state.scores);
  });

  it('ends game with a win on 3 timeout strikes without disconnecting', () => {
    const { host, guest } = connectTimedPair(1000);

    let hostLossEvent: { loser: string; winner: string } | null = null;
    let guestLossEvent: { loser: string; winner: string } | null = null;
    host.onTimeoutLoss((loser, winner) => {
      hostLossEvent = { loser, winner };
    });
    guest.onTimeoutLoss((loser, winner) => {
      guestLossEvent = { loser, winner };
    });

    // Strike 1: X times out -> turn passes to O
    vi.advanceTimersByTime(1600);
    expect(host.getSnapshot().state.currentPlayer).toBe('O');
    // O plays cell 0 -> turn passes back to X
    expect(guest.playMove(0)).toBe(true);
    expect(host.getSnapshot().state.currentPlayer).toBe('X');

    // Strike 2: X times out -> turn passes to O
    vi.advanceTimersByTime(1600);
    expect(host.getSnapshot().state.currentPlayer).toBe('O');
    // O plays cell 1 -> turn passes back to X
    expect(guest.playMove(1)).toBe(true);
    expect(host.getSnapshot().state.currentPlayer).toBe('X');

    // Strike 3: X times out -> 3-strikes forfeit! Game ends, O wins!
    vi.advanceTimersByTime(1600);

    for (const session of [host, guest]) {
      const snap = session.getSnapshot();
      expect(snap.status).toBe('connected'); // Must stay connected, NOT disconnected!
      expect(snap.state.phase).toBe('finished');
      expect(snap.state.result).toMatchObject({ type: 'win', player: 'O' });
      expect(snap.state.scores.O).toBe(1);
      expect(snap.turnStartTime).toBe(0);
    }

    // Score must not double-apply from local + remote game-over
    expect(host.getSnapshot().state.scores.O).toBe(1);
    expect(guest.getSnapshot().state.scores.O).toBe(1);

    expect(hostLossEvent).toEqual({ loser: 'ALICE', winner: 'BOB' });
    expect(guestLossEvent).toEqual({ loser: 'ALICE', winner: 'BOB' });
  });

  it('keeps both peers on the same board after repeated timeouts', () => {
    const { host, guest } = connectTimedPair(500);

    for (let i = 0; i < 2; i++) {
      vi.advanceTimersByTime(1100); // 500 timer + 500 grace + tick margin
      expect(host.getSnapshot().state.currentPlayer).toBe(
        guest.getSnapshot().state.currentPlayer,
      );
      expect(host.getSnapshot().state.board).toEqual(guest.getSnapshot().state.board);
      expect(host.getSnapshot().timeoutCounts).toEqual(guest.getSnapshot().timeoutCounts);

      // Alternate a real move so the board changes under timeout pressure
      const mover = host.getSnapshot().state.currentPlayer === 'X' ? host : guest;
      const cell = i * 2;
      expect(mover.playMove(cell)).toBe(true);
      expect(host.getSnapshot().state.board).toEqual(guest.getSnapshot().state.board);
    }
  });
});

describe('RoomSession arrow-race rounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function connectRacePair() {
    const [hostTransport, guestTransport] = createFakeTransportPair();
    const host = new RoomSession<'arrow-race'>({
      role: 'host',
      roomCode: CODE,
      myId: 'host-1',
      myName: 'ALICE',
      transport: hostTransport,
      game: 'arrow-race',
      ...TIMING,
    });
    const guest = new RoomSession<'arrow-race'>({
      role: 'guest',
      roomCode: CODE,
      myId: 'guest-1',
      myName: 'BOB',
      transport: guestTransport,
      game: 'arrow-race',
      ...TIMING,
    });
    host.start();
    guest.start();
    return { host, guest, hostTransport, guestTransport };
  }

  it('starts the first round on both sides when the guest joins', () => {
    const { host, guest } = connectRacePair();

    const hostState = settled(host).state;
    const guestState = settled(guest).state;

    expect(hostState.phase).toBe('playing');
    expect(guestState.phase).toBe('playing');
    expect(hostState.roundId).toBe(1);
    expect(guestState.roundId).toBe(1);
    expect(hostState.stimulus).not.toBeNull();
    expect(guestState.stimulus).toEqual(hostState.stimulus);
  });

  it('scores a correct host answer and starts the next round after the gap', () => {
    const { host, guest } = connectRacePair();
    const stimulus = settled(host).state.stimulus;
    if (stimulus === null) throw new Error('expected live stimulus');

    expect(host.answerRaceRound(stimulus.moving)).toBe(true);

    const hostAfter = settled(host).state;
    const guestAfter = settled(guest).state;
    expect(hostAfter.scores.X).toBe(1);
    expect(guestAfter.scores.X).toBe(1);
    expect(hostAfter.stimulus).toBeNull();
    expect(guestAfter.stimulus).toBeNull();
    expect(hostAfter.roundId).toBe(1);

    vi.advanceTimersByTime(1500);
    expect(settled(host).state.roundId).toBe(2);
    expect(settled(guest).state.roundId).toBe(2);
    expect(settled(guest).state.stimulus).toEqual(settled(host).state.stimulus);
  });

  it('awards the opponent when the host answers wrong', () => {
    const { host, guest } = connectRacePair();
    const stimulus = settled(host).state.stimulus;
    if (stimulus === null) throw new Error('expected live stimulus');

    const wrong =
      stimulus.moving === 'up'
        ? ('down' as const)
        : ('up' as const);
    expect(host.answerRaceRound(wrong)).toBe(true);

    expect(settled(host).state.scores.O).toBe(1);
    expect(settled(guest).state.scores.O).toBe(1);
    expect(settled(host).state.scores.X).toBe(0);
  });

  it('uses the first answer only and ignores a second one for the same round', () => {
    const { host, guest } = connectRacePair();
    const stimulus = settled(host).state.stimulus;
    if (stimulus === null) throw new Error('expected live stimulus');

    expect(host.answerRaceRound(stimulus.moving)).toBe(true);
    const wrong =
      stimulus.moving === 'up'
        ? ('down' as const)
        : ('up' as const);
    expect(guest.answerRaceRound(wrong)).toBe(false);

    expect(settled(host).state.scores.X).toBe(1);
    expect(settled(host).state.scores.O).toBe(0);
  });

  it('drops a stale answer for an already-decided round', () => {
    const { host, guest, hostTransport } = connectRacePair();
    const stimulus = settled(host).state.stimulus;
    if (stimulus === null) throw new Error('expected live stimulus');

    expect(host.answerRaceRound(stimulus.moving)).toBe(true);
    expect(settled(host).state.scores.X).toBe(1);

    hostTransport.post({
      type: 'answer',
      roomCode: CODE,
      playerId: 'guest-1',
      roundId: 1,
      direction: 'up',
      game: 'arrow-race',
    });

    expect(settled(host).state.scores.X).toBe(1);
    expect(settled(host).state.scores.O).toBe(0);
    expect(guest).toBeDefined();
  });

  it('voids the round when nobody answers in time', () => {
    const { host, guest } = connectRacePair();

    vi.advanceTimersByTime(8000);

    expect(settled(host).state.draws).toBe(1);
    expect(settled(guest).state.draws).toBe(1);
    expect(settled(host).state.scores).toEqual({ X: 0, O: 0 });
    expect(settled(host).state.stimulus).toBeNull();

    vi.advanceTimersByTime(1500);
    expect(settled(host).state.roundId).toBe(2);
    expect(settled(guest).state.roundId).toBe(2);
  });

  it('ends the match when a score reaches the target and rematch restarts', () => {
    const { host, guest } = connectRacePair();

    for (let i = 0; i < 5; i++) {
      const stimulus = settled(host).state.stimulus;
      if (stimulus === null) throw new Error(`expected stimulus on round ${i + 1}`);
      expect(host.answerRaceRound(stimulus.moving)).toBe(true);
      if (i < 4) {
        vi.advanceTimersByTime(1500);
      }
    }

    const hostDone = settled(host);
    const guestDone = settled(guest);
    expect(hostDone.state.phase).toBe('finished');
    expect(guestDone.state.phase).toBe('finished');
    expect(hostDone.state.result).toEqual({ type: 'win', player: 'X' });
    expect(hostDone.state.scores.X).toBe(5);
    expect(guestDone.state.scores.X).toBe(5);

    expect(host.requestRematch()).toBe(true);
    expect(guest.requestRematch()).toBe(true);

    expect(settled(host).state.phase).toBe('playing');
    expect(settled(guest).state.phase).toBe('playing');
    expect(settled(host).state.scores).toEqual({ X: 0, O: 0 });
    expect(settled(host).state.roundId).toBe(0);
    expect(settled(host).state.stimulus).toBeNull();

    vi.advanceTimersByTime(1500);
    expect(settled(host).state.roundId).toBe(1);
    expect(settled(guest).state.roundId).toBe(1);
    expect(settled(guest).state.stimulus).toEqual(settled(host).state.stimulus);
  });

  it('ignores playMove for arrow-race sessions', () => {
    const { host } = connectRacePair();
    expect(host.playMove(0)).toBe(false);
    expect(host.playMove(4)).toBe(false);
  });
});
