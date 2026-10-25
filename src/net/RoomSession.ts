import {
  createInitialState,
  isValidMove,
  makeMove,
  restartGame,
  startGame,
} from '../engine';
import type { GameState, Player } from '../engine';
import {
  createC4InitialState,
  c4IsValidMove,
  c4MakeMove,
  c4RestartGame,
  c4StartGame,
} from '../engine/connect-four';
import type { C4GameState } from '../engine/connect-four';
import type { RoomMessage, RoomRole, GameId } from './protocol';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  DEFAULT_GAME,
  isChatEmoji,
  markForRole,
  MAX_TIMEOUTS,
  TURN_TIMER_MS,
} from './protocol';
import type { RoomTransport } from './transport';

export type SessionStatus =
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'rejected'
  | 'disconnected';

export interface ChatEvent {
  kind: 'chat' | 'emoji';
  fromId: string;
  from: string;
  text?: string;
  emoji?: string;
}

export type GameStateFor<G extends GameId> = G extends 'connect-four'
  ? C4GameState
  : GameState;

interface GameEngine<State> {
  createInitialState: (config?: {
    mode?: 'online';
    playerNames?: Record<Player, string>;
  }) => State;
  isValidMove: (state: State, index: number) => boolean;
  makeMove: (state: State, index: number) => State;
  restartGame: (state: State) => State;
  startGame: (state: State) => State;
}

const TICTACTOE_ENGINE: GameEngine<GameState> = {
  createInitialState,
  isValidMove,
  makeMove,
  restartGame,
  startGame,
};

const CONNECT_FOUR_ENGINE: GameEngine<C4GameState> = {
  createInitialState: createC4InitialState,
  isValidMove: c4IsValidMove,
  makeMove: c4MakeMove,
  restartGame: c4RestartGame,
  startGame: c4StartGame,
};

function engineFor(game: GameId): GameEngine<GameStateFor<GameId>> {
  switch (game) {
    case 'tictactoe':
      return TICTACTOE_ENGINE as GameEngine<GameStateFor<GameId>>;
    case 'connect-four':
      return CONNECT_FOUR_ENGINE as GameEngine<GameStateFor<GameId>>;
    default:
      throw new Error(`Unsupported game: ${String(game)}`);
  }
}

export interface SessionSnapshot<G extends GameId = GameId> {
  status: SessionStatus;
  role: RoomRole;
  roomCode: string;
  game: GameId;
  myId: string;
  myName: string;
  myMark: Player;
  opponentName: string | null;
  state: GameStateFor<G>;
  rematchRequested: boolean;
  timeoutCounts: Record<string, number>;
  turnTimerMs: number;
  turnStartTime: number;
}

export interface RoomSessionOptions {
  role: RoomRole;
  roomCode: string;
  myId: string;
  myName: string;
  transport: RoomTransport;
  game?: GameId;
  heartbeatMs?: number;
  timeoutMs?: number;
  joinTimeoutMs?: number;
  helloRetryMs?: number;
  turnTimerMs?: number;
  onTimeout?: (playerName: string) => void;
  onTimeoutLoss?: (loserName: string, winnerName: string) => void;
}

const DEFAULT_ON_TIMEOUT = (): void => {};
const DEFAULT_ON_TIMEOUT_LOSS = (): void => {};

const DEFAULTS = {
  heartbeatMs: 2000,
  timeoutMs: 6000,
  joinTimeoutMs: 3000,
  helloRetryMs: 500,
  turnTimerMs: TURN_TIMER_MS,
};

export class RoomSession<G extends GameId = GameId> {
  private readonly options: Required<Omit<RoomSessionOptions, 'transport'>> & {
    transport: RoomTransport;
  };
  private readonly engine: GameEngine<GameStateFor<G>>;
  private readonly listeners = new Set<(snapshot: SessionSnapshot<G>) => void>();
  private readonly chatListeners = new Set<(event: ChatEvent) => void>();
  private readonly timeoutListeners = new Set<(playerName: string) => void>();
  private readonly timeoutLossListeners = new Set<(loserName: string, winnerName: string) => void>();
  private unsubscribeTransport: (() => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private helloRetryTimer: ReturnType<typeof setInterval> | null = null;
  private helloDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private destroyed = false;
  private lastSeen = 0;
  private lastMoveAt = 0;
  private guestId: string | null = null;
  private hostId: string | null = null;
  private rematchRequested = false;
  private opponentRematchRequested = false;
  private timeoutCounts: Record<string, number> = {};
  private snapshot: SessionSnapshot<G>;

  constructor(options: RoomSessionOptions) {
    const game = options.game ?? DEFAULT_GAME;
    this.options = {
      heartbeatMs: options.heartbeatMs ?? DEFAULTS.heartbeatMs,
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
      joinTimeoutMs: options.joinTimeoutMs ?? DEFAULTS.joinTimeoutMs,
      helloRetryMs: options.helloRetryMs ?? DEFAULTS.helloRetryMs,
      turnTimerMs: options.turnTimerMs ?? DEFAULTS.turnTimerMs[game],
      onTimeout: options.onTimeout ?? DEFAULT_ON_TIMEOUT,
      onTimeoutLoss: options.onTimeoutLoss ?? DEFAULT_ON_TIMEOUT_LOSS,
      role: options.role,
      roomCode: options.roomCode,
      myId: options.myId,
      myName: options.myName,
      game,
      transport: options.transport,
    };
    this.engine = engineFor(game) as GameEngine<GameStateFor<G>>;

    this.snapshot = {
      status: options.role === 'host' ? 'waiting' : 'connecting',
      role: options.role,
      roomCode: options.roomCode,
      game: this.options.game,
      myId: options.myId,
      myName: options.myName,
      myMark: markForRole(options.role),
      opponentName: null,
      state: this.engine.createInitialState({ mode: 'online' }),
      rematchRequested: false,
      timeoutCounts: {},
      turnTimerMs: this.options.turnTimerMs,
      turnStartTime: 0,
    };
  }

  subscribe(listener: (snapshot: SessionSnapshot<G>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onChat(listener: (event: ChatEvent) => void): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  onTimeout(listener: (playerName: string) => void): () => void {
    this.timeoutListeners.add(listener);
    return () => this.timeoutListeners.delete(listener);
  }

  onTimeoutLoss(listener: (loserName: string, winnerName: string) => void): () => void {
    this.timeoutLossListeners.add(listener);
    return () => this.timeoutLossListeners.delete(listener);
  }

  getSnapshot(): SessionSnapshot<G> {
    return this.snapshot;
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;

    this.unsubscribeTransport = this.options.transport.subscribe((message) =>
      this.handleMessage(message),
    );

    this.heartbeatTimer = setInterval(() => {
      this.post({ type: 'ping', roomCode: this.options.roomCode, playerId: this.options.myId });
    }, this.options.heartbeatMs);

    this.checkTimer = setInterval(() => this.checkTimeout(), Math.min(1000, this.options.heartbeatMs));

    this.turnTimer = setInterval(() => this.checkTurnTimer(), 100);

    if (this.options.role === 'guest') {
      this.sendHello();
    }
  }

  stop(): void {
    this.started = false;
    this.unsubscribeTransport?.();
    this.unsubscribeTransport = null;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.checkTimer) clearInterval(this.checkTimer);
    if (this.turnTimer) clearInterval(this.turnTimer);
    if (this.helloRetryTimer) clearInterval(this.helloRetryTimer);
    if (this.helloDeadlineTimer) clearTimeout(this.helloDeadlineTimer);
    this.heartbeatTimer = null;
    this.checkTimer = null;
    this.turnTimer = null;
    this.helloRetryTimer = null;
    this.helloDeadlineTimer = null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    this.chatListeners.clear();
    this.timeoutListeners.clear();
    this.timeoutLossListeners.clear();
    this.options.transport.close();
  }

  leave(): void {
    if (!this.destroyed && this.snapshot.status === 'connected') {
      this.post({ type: 'leave', roomCode: this.options.roomCode, playerId: this.options.myId });
    }
    this.destroy();
  }

  playMove(index: number): boolean {
    const { state } = this.snapshot;
    if (this.snapshot.status !== 'connected') return false;
    if (state.currentPlayer !== this.snapshot.myMark) return false;
    if (!this.engine.isValidMove(state, index)) return false;

    this.applyMove(index);
    const now = Date.now();
    this.lastMoveAt = now;
    this.update({ turnStartTime: now });
    this.post({ type: 'move', roomCode: this.options.roomCode, playerId: this.options.myId, index });
    return true;
  }

  requestRematch(): boolean {
    if (this.snapshot.status !== 'connected') return false;
    if (this.snapshot.state.phase !== 'finished') return false;
    if (this.rematchRequested) return false;

    this.rematchRequested = true;
    this.update({ rematchRequested: true });
    this.post({ type: 'rematch', roomCode: this.options.roomCode, playerId: this.options.myId });

    if (this.options.role === 'host' && this.opponentRematchRequested) {
      this.startRematch();
    }
    return true;
  }

  sendChat(text: string): boolean {
    if (this.snapshot.status !== 'connected') return false;
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;
    this.post({
      type: 'chat',
      roomCode: this.options.roomCode,
      playerId: this.options.myId,
      name: this.options.myName,
      text: trimmed.slice(0, CHAT_MESSAGE_MAX_LENGTH),
    });
    return true;
  }

  sendEmoji(emoji: string): boolean {
    if (this.snapshot.status !== 'connected') return false;
    if (!isChatEmoji(emoji)) return false;
    this.post({
      type: 'emoji',
      roomCode: this.options.roomCode,
      playerId: this.options.myId,
      name: this.options.myName,
      emoji,
    });
    return true;
  }

  private post(message: RoomMessage): void {
    this.options.transport.post({ ...message, game: this.options.game });
  }

  private sendHello(): void {
    const postHello = () =>
      this.post({
        type: 'hello',
        roomCode: this.options.roomCode,
        playerId: this.options.myId,
        name: this.options.myName,
      });

    postHello();
    // Matchmade hosts may not be connected yet; keep announcing until the
    // welcome arrives or the join window closes.
    this.helloRetryTimer = setInterval(postHello, this.options.helloRetryMs);
    this.helloDeadlineTimer = setTimeout(() => {
      this.helloDeadlineTimer = null;
      if (this.helloRetryTimer) {
        clearInterval(this.helloRetryTimer);
        this.helloRetryTimer = null;
      }
      if (this.snapshot.status === 'connecting') {
        this.update({ status: 'rejected' });
      }
    }, this.options.joinTimeoutMs);
  }

  private handleMessage(message: RoomMessage): void {
    if (this.destroyed) return;
    if (message.roomCode !== this.options.roomCode) return;
    if ((message.game ?? DEFAULT_GAME) !== this.options.game) return;
    if (message.type !== 'hello' && 'playerId' in message && message.playerId === this.options.myId) {
      return;
    }

    this.lastSeen = Date.now();

    switch (message.type) {
      case 'hello':
        this.onHello(message);
        break;
      case 'welcome':
        this.onWelcome(message);
        break;
      case 'rejected':
        if (this.options.role === 'guest' && this.snapshot.status === 'connecting') {
          this.update({ status: 'rejected' });
        }
        break;
      case 'move':
        this.onRemoteMove(message);
        break;
      case 'rematch':
        this.onRemoteRematch();
        break;
      case 'rematch-start':
        if (this.options.role === 'guest') this.applyRematch();
        break;
      case 'leave':
        this.onLeave(message);
        break;
      case 'ping':
        this.post({ type: 'pong', roomCode: this.options.roomCode, playerId: this.options.myId });
        break;
      case 'pong':
        break;
      case 'chat':
        this.onChatMessage(message);
        break;
      case 'emoji':
        this.onEmojiMessage(message);
        break;
      case 'turn-timeout':
        this.onTurnTimeout(message);
        break;
      case 'timeout-count':
        this.onTimeoutCount(message);
        break;
      case 'game-over':
        this.onGameOver(message);
        break;
    }
  }

  private onChatMessage(message: Extract<RoomMessage, { type: 'chat' }>): void {
    if (this.snapshot.status !== 'connected') return;
    const text = message.text.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH);
    if (text.length === 0) return;
    this.emitChat({
      kind: 'chat',
      fromId: message.playerId,
      from: message.name,
      text,
    });
  }

  private onEmojiMessage(message: Extract<RoomMessage, { type: 'emoji' }>): void {
    if (this.snapshot.status !== 'connected') return;
    if (!isChatEmoji(message.emoji)) return;
    this.emitChat({
      kind: 'emoji',
      fromId: message.playerId,
      from: message.name,
      emoji: message.emoji,
    });
  }

  private onTurnTimeout(message: Extract<RoomMessage, { type: 'turn-timeout' }>): void {
    if (this.snapshot.status !== 'connected') return;
    if (this.snapshot.state.phase !== 'playing') return;

    const newCount = (this.timeoutCounts[message.skippedPlayerId] ?? 0) + 1;
    this.timeoutCounts[message.skippedPlayerId] = newCount;
    this.update({ timeoutCounts: { ...this.timeoutCounts } });

    const skippedPlayerName =
      message.skippedPlayerId === this.options.myId
        ? this.options.myName
        : (this.snapshot.opponentName ?? 'Opponent');
    this.emitTimeout(skippedPlayerName);

    const skippedMark: Player =
      message.skippedPlayerId === this.options.myId
        ? this.snapshot.myMark
        : (this.snapshot.myMark === 'X' ? 'O' : 'X');

    // Only advance turn if it is still the skipped player's turn (avoids double-advance)
    if (this.snapshot.state.currentPlayer === skippedMark) {
      this.applyMove(-1);
    }
  }

  private onTimeoutCount(message: Extract<RoomMessage, { type: 'timeout-count' }>): void {
    if (this.snapshot.status !== 'connected') return;
    this.timeoutCounts = { ...message.counts };
    this.update({ timeoutCounts: { ...this.timeoutCounts } });
  }

  private onGameOver(message: Extract<RoomMessage, { type: 'game-over' }>): void {
    if (this.snapshot.status !== 'connected') return;
    if (message.reason === 'timeout') {
      const loserMark: Player =
        message.winnerId === this.options.myId
          ? (this.snapshot.myMark === 'X' ? 'O' : 'X')
          : this.snapshot.myMark;
      const loserName =
        loserMark === this.snapshot.myMark
          ? this.options.myName
          : (this.snapshot.opponentName ?? 'Opponent');
      const winnerName =
        loserMark === this.snapshot.myMark
          ? (this.snapshot.opponentName ?? 'Opponent')
          : this.options.myName;
      this.emitTimeoutLoss(loserName, winnerName);
    }
    this.applyGameOver(message.winnerId);
  }

  private emitTimeout(playerName: string): void {
    this.options.onTimeout?.(playerName);
    for (const listener of [...this.timeoutListeners]) listener(playerName);
  }

  private emitTimeoutLoss(loserName: string, winnerName: string): void {
    this.options.onTimeoutLoss?.(loserName, winnerName);
    for (const listener of [...this.timeoutLossListeners]) listener(loserName, winnerName);
  }

  private emitChat(event: ChatEvent): void {
    for (const listener of [...this.chatListeners]) listener(event);
  }

  private onHello(message: Extract<RoomMessage, { type: 'hello' }>): void {
    if (this.options.role !== 'host') return;
    if (this.snapshot.status === 'disconnected') return;

    if (this.guestId !== null && message.playerId !== this.guestId) {
      this.post({
        type: 'rejected',
        roomCode: this.options.roomCode,
        reason: 'room-full',
      });
      return;
    }

    const firstJoin = this.guestId === null;
    this.guestId = message.playerId;

    this.post({
      type: 'welcome',
      roomCode: this.options.roomCode,
      hostId: this.options.myId,
      hostName: this.options.myName,
    });

    if (firstJoin) {
      this.lastMoveAt = Date.now();
      this.update({
        status: 'connected',
        opponentName: message.name,
        state: this.createOnlineState(message.name),
        turnStartTime: this.lastMoveAt,
      });
    }
  }

  private onWelcome(message: Extract<RoomMessage, { type: 'welcome' }>): void {
    if (this.options.role !== 'guest') return;
    if (this.snapshot.status !== 'connecting') return;
    if (this.helloRetryTimer) {
      clearInterval(this.helloRetryTimer);
      this.helloRetryTimer = null;
    }
    if (this.helloDeadlineTimer) {
      clearTimeout(this.helloDeadlineTimer);
      this.helloDeadlineTimer = null;
    }

    this.hostId = message.hostId;
    this.lastMoveAt = Date.now();
    this.update({
      status: 'connected',
      opponentName: message.hostName,
      state: this.createOnlineState(message.hostName),
      turnStartTime: this.lastMoveAt,
    });
  }

  private onLeave(message: Extract<RoomMessage, { type: 'leave' }>): void {
    const expectedPeerId =
      this.options.role === 'host' ? this.guestId : this.hostId;
    if (expectedPeerId === null || message.playerId !== expectedPeerId) return;
    this.update({ status: 'disconnected' });
  }

  private createOnlineState(opponentName: string): GameStateFor<G> {
    const playerNames: Record<Player, string> =
      this.options.role === 'host'
        ? { X: this.options.myName, O: opponentName }
        : { X: opponentName, O: this.options.myName };
    const state = this.engine.startGame(
      this.engine.createInitialState({ mode: 'online', playerNames }),
    );
    this.lastMoveAt = Date.now();
    return state;
  }

  private onRemoteMove(message: Extract<RoomMessage, { type: 'move' }>): void {
    if (this.snapshot.status !== 'connected') return;
    const peerMark: Player = this.snapshot.myMark === 'X' ? 'O' : 'X';
    if (this.snapshot.state.currentPlayer !== peerMark) return;
    if (!this.engine.isValidMove(this.snapshot.state, message.index)) return;
    this.applyMove(message.index);
  }

  private applyMove(index: number): void {
    const now = Date.now();
    this.lastMoveAt = now;
    if (index === -1) {
      // Pass turn (turn timeout skip) - just switch currentPlayer
      const newState = { ...this.snapshot.state };
      newState.currentPlayer = newState.currentPlayer === 'X' ? 'O' : 'X';
      this.update({ state: newState, turnStartTime: now });
      return;
    }
    this.update({
      state: this.engine.makeMove(this.snapshot.state, index),
      turnStartTime: now,
    });
  }

  private onRemoteRematch(): void {
    this.opponentRematchRequested = true;
    if (this.options.role === 'host' && this.rematchRequested) {
      this.startRematch();
    }
  }

  private startRematch(): void {
    this.post({ type: 'rematch-start', roomCode: this.options.roomCode });
    this.applyRematch();
  }

  private applyRematch(): void {
    this.rematchRequested = false;
    this.opponentRematchRequested = false;
    this.timeoutCounts = {};
    const newState = this.engine.restartGame(this.snapshot.state);
    this.lastMoveAt = Date.now();
    this.update({
      state: newState,
      rematchRequested: false,
      timeoutCounts: {},
      turnStartTime: this.lastMoveAt,
    });
  }

  private checkTimeout(): void {
    if (this.snapshot.status !== 'connected') return;
    if (this.lastSeen === 0) return;
    if (Date.now() - this.lastSeen > this.options.timeoutMs) {
      this.update({ status: 'disconnected' });
    }
  }

  private checkTurnTimer(): void {
    if (this.snapshot.status !== 'connected') return;
    if (this.snapshot.state.phase !== 'playing') return;
    if (this.snapshot.turnStartTime === 0) return;

    const elapsed = Date.now() - this.snapshot.turnStartTime;
    if (elapsed >= this.options.turnTimerMs) {
      this.handleTurnTimeout();
    }
  }

  private handleTurnTimeout(): void {
    if (this.snapshot.status !== 'connected') return;
    if (this.snapshot.state.phase !== 'playing') return;

    const currentPlayerId = this.snapshot.state.currentPlayer === this.snapshot.myMark
      ? this.options.myId
      : (this.options.role === 'host' ? this.guestId : this.hostId);
    const nextPlayerId = this.snapshot.state.currentPlayer === this.snapshot.myMark
      ? (this.options.role === 'host' ? this.guestId : this.hostId)
      : this.options.myId;

    if (!currentPlayerId || !nextPlayerId) return;

    // Get the player name who timed out
    const timedOutPlayerName = currentPlayerId === this.options.myId
      ? this.options.myName
      : this.snapshot.opponentName ?? 'Opponent';

    // Increment timeout count for the player who timed out
    const newCount = (this.timeoutCounts[currentPlayerId] ?? 0) + 1;
    this.timeoutCounts[currentPlayerId] = newCount;
    this.update({ timeoutCounts: { ...this.timeoutCounts } });

    // Notify UI of timeout
    this.emitTimeout(timedOutPlayerName);

    // Check for 3-strikes loss
    if (newCount >= MAX_TIMEOUTS) {
      const winnerName = nextPlayerId === this.options.myId
        ? this.options.myName
        : this.snapshot.opponentName ?? 'Opponent';
      this.emitTimeoutLoss(timedOutPlayerName, winnerName);
      this.endGameByTimeout(nextPlayerId);
      return;
    }

    // Auto-skip turn: apply a pass (no-op move) and switch to next player
    // We simulate this by posting a turn-timeout message and updating state
    this.post({
      type: 'turn-timeout',
      roomCode: this.options.roomCode,
      skippedPlayerId: currentPlayerId,
      nextPlayerId,
    });

    // Switch turn locally
    this.applyMove(-1);
  }

  private endGameByTimeout(winnerId: string): void {
    if (this.snapshot.status !== 'connected') return;

    this.post({
      type: 'game-over',
      roomCode: this.options.roomCode,
      winnerId,
      reason: 'timeout',
    });
    this.applyGameOver(winnerId);
  }

  private applyGameOver(winnerId: string): void {
    const winnerMark: Player =
      winnerId === this.options.myId
        ? this.snapshot.myMark
        : this.snapshot.myMark === 'X'
          ? 'O'
          : 'X';

    const currentScores = this.snapshot.state.scores;
    const newScores = {
      ...currentScores,
      [winnerMark]: (currentScores[winnerMark] ?? 0) + 1,
    };

    const newState: GameStateFor<G> = {
      ...this.snapshot.state,
      phase: 'finished',
      result: {
        type: 'win',
        player: winnerMark,
        line: this.snapshot.game === 'connect-four' ? ({ cells: [] } as never) : undefined,
      },
      scores: newScores,
    };

    this.update({
      state: newState,
      turnStartTime: 0,
    });
  }

  private update(partial: Partial<SessionSnapshot<G>>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }
}

export type AnyRoomSession = RoomSession<GameId>;

export function isTttSession(
  session: AnyRoomSession | null,
): session is RoomSession<'tictactoe'> {
  return session !== null && session.getSnapshot().game === 'tictactoe';
}

export function isConnectFourSession(
  session: AnyRoomSession | null,
): session is RoomSession<'connect-four'> {
  return session !== null && session.getSnapshot().game === 'connect-four';
}