import {
  MATCHMAKER_PATH,
  parseMatchmakerEvent,
  type RoomRole,
} from './protocol';

export type MatchmakerStatus = 'idle' | 'queued' | 'matched' | 'timeout';

export interface MatchmakerSnapshot {
  status: MatchmakerStatus;
  roomCode: string | null;
  role: RoomRole | null;
}

export interface MatchmakerSocket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface MatchmakerOptions {
  url: string;
  playerId: string;
  timeoutMs?: number;
  socketFactory?: (url: string) => MatchmakerSocket;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class MatchmakerClient {
  private readonly url: string;
  private readonly playerId: string;
  private readonly timeoutMs: number;
  private readonly socketFactory: (url: string) => MatchmakerSocket;
  private readonly listeners = new Set<(snapshot: MatchmakerSnapshot) => void>();
  private socket: MatchmakerSocket | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private awaiting = false;
  private snapshot: MatchmakerSnapshot = { status: 'idle', roomCode: null, role: null };

  constructor(options: MatchmakerOptions) {
    this.url = options.url.endsWith(MATCHMAKER_PATH)
      ? options.url
      : `${options.url.replace(/\/$/, '')}${MATCHMAKER_PATH}`;
    this.playerId = options.playerId;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.socketFactory =
      options.socketFactory ?? ((url) => new WebSocket(url) as unknown as MatchmakerSocket);
  }

  subscribe(listener: (snapshot: MatchmakerSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): MatchmakerSnapshot {
    return this.snapshot;
  }

  queue(): boolean {
    if (this.awaiting) return false;
    this.awaiting = true;
    this.update({ status: 'queued', roomCode: null, role: null });

    const socket = this.socketFactory(this.url);
    this.socket = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'queue', playerId: this.playerId }));
    };
    socket.onmessage = (event) => this.onMessage(event.data);
    socket.onclose = () => this.onSocketClosed();
    socket.onerror = () => {};

    this.timeoutTimer = setTimeout(() => this.onLocalTimeout(), this.timeoutMs);
    return true;
  }

  cancel(): void {
    if (!this.awaiting) return;
    this.post({ type: 'cancel', playerId: this.playerId });
    this.closeSocket();
    this.awaiting = false;
    this.update({ status: 'idle', roomCode: null, role: null });
  }

  destroy(): void {
    this.awaiting = false;
    this.closeSocket();
  }

  private onMessage(data: unknown): void {
    if (!this.awaiting) return;
    const event = parseMatchmakerEvent(typeof data === 'string' ? data : String(data));
    if (event === null || event.playerId !== this.playerId) return;

    if (event.type === 'matched') {
      this.closeSocket();
      this.awaiting = false;
      this.update({ status: 'matched', roomCode: event.roomCode, role: event.role });
      return;
    }
    this.closeSocket();
    this.awaiting = false;
    this.update({ status: 'timeout', roomCode: null, role: null });
  }

  private onLocalTimeout(): void {
    if (!this.awaiting) return;
    this.post({ type: 'cancel', playerId: this.playerId });
    this.closeSocket();
    this.awaiting = false;
    this.update({ status: 'timeout', roomCode: null, role: null });
  }

  private onSocketClosed(): void {
    if (!this.awaiting) return;
    this.closeSocket();
    this.awaiting = false;
    this.update({ status: 'timeout', roomCode: null, role: null });
  }

  private post(message: object): void {
    if (this.socket !== null && this.snapshot.status === 'queued') {
      try {
        this.socket.send(JSON.stringify(message));
      } catch {
        // socket may already be closing; cancel also happens via disconnect
      }
    }
  }

  private closeSocket(): void {
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket !== null) {
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // already closed
      }
    }
  }

  private update(partial: MatchmakerSnapshot): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }
}
