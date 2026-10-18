import {
  createInitialState,
  isValidMove,
  makeMove,
  restartGame,
  startGame,
} from '../engine';
import type { GameState, Player } from '../engine';
import type { RoomMessage, RoomRole } from './protocol';
import { markForRole } from './protocol';
import type { RoomTransport } from './transport';

export type SessionStatus =
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'rejected'
  | 'disconnected';

export interface SessionSnapshot {
  status: SessionStatus;
  role: RoomRole;
  roomCode: string;
  myId: string;
  myName: string;
  myMark: Player;
  opponentName: string | null;
  state: GameState;
  rematchRequested: boolean;
}

export interface RoomSessionOptions {
  role: RoomRole;
  roomCode: string;
  myId: string;
  myName: string;
  transport: RoomTransport;
  heartbeatMs?: number;
  timeoutMs?: number;
  joinTimeoutMs?: number;
}

const DEFAULTS = {
  heartbeatMs: 2000,
  timeoutMs: 6000,
  joinTimeoutMs: 3000,
};

export class RoomSession {
  private readonly options: Required<Omit<RoomSessionOptions, 'transport'>> & {
    transport: RoomTransport;
  };
  private readonly listeners = new Set<(snapshot: SessionSnapshot) => void>();
  private unsubscribeTransport: (() => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private helloTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private destroyed = false;
  private lastSeen = 0;
  private guestId: string | null = null;
  private rematchRequested = false;
  private opponentRematchRequested = false;
  private snapshot: SessionSnapshot;

  constructor(options: RoomSessionOptions) {
    this.options = {
      heartbeatMs: options.heartbeatMs ?? DEFAULTS.heartbeatMs,
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
      joinTimeoutMs: options.joinTimeoutMs ?? DEFAULTS.joinTimeoutMs,
      role: options.role,
      roomCode: options.roomCode,
      myId: options.myId,
      myName: options.myName,
      transport: options.transport,
    };

    this.snapshot = {
      status: options.role === 'host' ? 'waiting' : 'connecting',
      role: options.role,
      roomCode: options.roomCode,
      myId: options.myId,
      myName: options.myName,
      myMark: markForRole(options.role),
      opponentName: null,
      state: createInitialState({ mode: 'online' }),
      rematchRequested: false,
    };
  }

  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SessionSnapshot {
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
    if (this.helloTimer) clearTimeout(this.helloTimer);
    this.heartbeatTimer = null;
    this.checkTimer = null;
    this.helloTimer = null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    this.options.transport.close();
  }

  leave(): void {
    if (!this.destroyed) {
      this.post({ type: 'leave', roomCode: this.options.roomCode, playerId: this.options.myId });
    }
    this.destroy();
  }

  playMove(index: number): boolean {
    const { state } = this.snapshot;
    if (this.snapshot.status !== 'connected') return false;
    if (state.currentPlayer !== this.snapshot.myMark) return false;
    if (!isValidMove(state, index)) return false;

    this.applyMove(index);
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

  private post(message: RoomMessage): void {
    this.options.transport.post(message);
  }

  private sendHello(): void {
    this.post({
      type: 'hello',
      roomCode: this.options.roomCode,
      playerId: this.options.myId,
      name: this.options.myName,
    });
    this.helloTimer = setTimeout(() => {
      this.helloTimer = null;
      if (this.snapshot.status === 'connecting') {
        this.update({ status: 'rejected' });
      }
    }, this.options.joinTimeoutMs);
  }

  private handleMessage(message: RoomMessage): void {
    if (this.destroyed) return;
    if (message.roomCode !== this.options.roomCode) return;
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
        this.update({ status: 'disconnected' });
        break;
      case 'ping':
        this.post({ type: 'pong', roomCode: this.options.roomCode, playerId: this.options.myId });
        break;
      case 'pong':
        break;
    }
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
      this.update({
        status: 'connected',
        opponentName: message.name,
        state: this.createOnlineState(message.name),
      });
    }
  }

  private onWelcome(message: Extract<RoomMessage, { type: 'welcome' }>): void {
    if (this.options.role !== 'guest') return;
    if (this.snapshot.status !== 'connecting') return;
    if (this.helloTimer) {
      clearTimeout(this.helloTimer);
      this.helloTimer = null;
    }

    this.update({
      status: 'connected',
      opponentName: message.hostName,
      state: this.createOnlineState(message.hostName),
    });
  }

  private createOnlineState(opponentName: string): GameState {
    const playerNames: Record<Player, string> =
      this.options.role === 'host'
        ? { X: this.options.myName, O: opponentName }
        : { X: opponentName, O: this.options.myName };
    return startGame(createInitialState({ mode: 'online', playerNames }));
  }

  private onRemoteMove(message: Extract<RoomMessage, { type: 'move' }>): void {
    if (this.snapshot.status !== 'connected') return;
    const peerMark: Player = this.snapshot.myMark === 'X' ? 'O' : 'X';
    if (this.snapshot.state.currentPlayer !== peerMark) return;
    if (!isValidMove(this.snapshot.state, message.index)) return;
    this.applyMove(message.index);
  }

  private applyMove(index: number): void {
    this.update({ state: makeMove(this.snapshot.state, index) });
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
    this.update({ state: restartGame(this.snapshot.state), rematchRequested: false });
  }

  private checkTimeout(): void {
    if (this.snapshot.status !== 'connected') return;
    if (this.lastSeen === 0) return;
    if (Date.now() - this.lastSeen > this.options.timeoutMs) {
      this.update({ status: 'disconnected' });
    }
  }

  private update(partial: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }
}