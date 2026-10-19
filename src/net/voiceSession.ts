import type { GameId } from './protocol';
import { DEFAULT_GAME } from './protocol';

export type VoiceStatus = 'off' | 'connecting' | 'live' | 'error';

export interface VoiceSnapshot {
  status: VoiceStatus;
  muted: boolean;
  remoteCount: number;
}

export interface VoiceRoom {
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void> | void;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  onConnected(listener: () => void): void;
  onDisconnected(listener: () => void): void;
  onRemoteParticipantsChanged(listener: (count: number) => void): void;
}

export interface VoiceSessionOptions {
  baseUrl: string;
  roomCode: string;
  name: string;
  game?: GameId;
  fetchFn?: typeof fetch;
  roomFactory?: () => Promise<VoiceRoom>;
}

function defaultRoomFactory(): Promise<VoiceRoom> {
  return import('./livekitVoiceRoom').then((module) => module.createLiveKitVoiceRoom());
}

export class VoiceSession {
  private readonly baseUrl: string;
  private readonly roomCode: string;
  private readonly name: string;
  private readonly game: GameId;
  private readonly fetchFn: typeof fetch;
  private readonly roomFactory: () => Promise<VoiceRoom>;
  private readonly listeners = new Set<(snapshot: VoiceSnapshot) => void>();
  private room: VoiceRoom | null = null;
  private snapshot: VoiceSnapshot = { status: 'off', muted: true, remoteCount: 0 };

  constructor(options: VoiceSessionOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.roomCode = options.roomCode;
    this.name = options.name;
    this.game = options.game ?? DEFAULT_GAME;
    this.fetchFn = options.fetchFn ?? ((...args) => fetch(...args));
    this.roomFactory = options.roomFactory ?? defaultRoomFactory;
  }

  subscribe(listener: (snapshot: VoiceSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): VoiceSnapshot {
    return this.snapshot;
  }

  async join(): Promise<boolean> {
    if (this.snapshot.status === 'connecting' || this.snapshot.status === 'live') return false;
    this.update({ status: 'connecting' });

    try {
      const httpBase = this.baseUrl
        .replace(/^ws:/, 'http:')
        .replace(/^wss:/, 'https:')
        .replace(/\/+$/, '');
      const response = await this.fetchFn(`${httpBase}/voice/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode, name: this.name, game: this.game }),
      });
      if (!response.ok) throw new Error(`voice token request failed: ${response.status}`);
      const payload = (await response.json()) as { url?: unknown; token?: unknown };
      if (typeof payload.url !== 'string' || typeof payload.token !== 'string') {
        throw new Error('voice token response is malformed');
      }

      const room = await this.roomFactory();
      this.room = room;
      room.onConnected(() => {
        if (this.room !== room) return;
        if (this.snapshot.status === 'connecting') this.update({ status: 'live' });
      });
      room.onDisconnected(() => this.handleDisconnect(room));
      room.onRemoteParticipantsChanged((count) => {
        if (this.room !== room) return;
        this.update({ remoteCount: count });
      });

      await room.connect(payload.url, payload.token);
      if (this.room === room && this.getSnapshot().status === 'connecting') {
        this.update({ status: 'live' });
      }
      return true;
    } catch (error) {
      console.error('voice join failed', error);
      this.room = null;
      this.update({ status: 'error' });
      return false;
    }
  }

  async leave(): Promise<void> {
    const room = this.room;
    this.room = null;
    this.update({ status: 'off', muted: true, remoteCount: 0 });
    if (room !== null) await room.disconnect();
  }

  async toggleMute(): Promise<boolean> {
    const room = this.room;
    if (room === null || this.snapshot.status !== 'live') return false;
    const nextMuted = !this.snapshot.muted;
    await room.setMicrophoneEnabled(!nextMuted);
    this.update({ muted: nextMuted });
    return true;
  }

  private handleDisconnect(room: VoiceRoom): void {
    if (this.room !== room) return;
    this.room = null;
    this.update({ status: 'off', muted: true, remoteCount: 0 });
  }

  private update(partial: Partial<VoiceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }
}
