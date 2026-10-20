import {
  generatePlayerId,
  generateRoomCode,
  isValidRoomCode,
  isGameId,
  parseMatchmakerMessage,
  scopedRoomId,
  DEFAULT_GAME,
  type GameId,
  type MatchmakerMessage,
} from '../src/net/protocol';
import { signVoiceToken } from '../src/net/voiceToken';

export interface Env {
  ROOMS: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;
  ASSETS: Fetcher;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
}

const ROOM_PATH = /^\/room\/([A-Z0-9]{6})$/;
const MAX_ROOM_SIZE = 8;
const MAX_PAYLOAD_BYTES = 4096;
const MAX_HTTP_BODY_BYTES = 2048;
const MAX_WAITING = 500;
const RATE_WINDOW_MS = 5000;
const RATE_MAX_MESSAGES = 60;
const MATCHMAKER_PATH = '/matchmake';
const VOICE_TOKEN_PATH = '/voice/token';
const VOICE_CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

interface SocketAttachment {
  roomId?: string;
  queued?: boolean;
  playerId?: string;
  game?: GameId;
}

type RateWindow = { windowStart: number; count: number };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    if (!isWebSocket) {
      if (url.pathname === VOICE_TOKEN_PATH) {
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: VOICE_CORS_HEADERS });
        }
        if (request.method === 'POST') {
          const response = await handleVoiceToken(request, env);
          const withCors = new Response(response.body, response);
          for (const [header, value] of Object.entries(VOICE_CORS_HEADERS)) {
            withCors.headers.set(header, value);
          }
          return withCors;
        }
      }
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === MATCHMAKER_PATH) {
      const queueId = env.MATCHMAKER.idFromName('global-queue');
      return env.MATCHMAKER.get(queueId).fetch(request);
    }

    const match = ROOM_PATH.exec(url.pathname);
    const gameParam = url.searchParams.get('game');
    const game = gameParam === null ? DEFAULT_GAME : gameParam;
    if (match === null || !isValidRoomCode(match[1]) || !isGameId(game)) {
      return new Response('invalid room', { status: 400 });
    }

    const roomId = env.ROOMS.idFromName(scopedRoomId(game, match[1]));
    return env.ROOMS.get(roomId).fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleVoiceToken(request: Request, env: Env): Promise<Response> {
  const raw = await request.text();
  if (raw.length === 0 || raw.length > MAX_HTTP_BODY_BYTES) {
    return json(400, { error: 'bad-request' });
  }
  let body: { roomCode?: unknown; name?: unknown; game?: unknown };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return json(400, { error: 'bad-request' });
    body = parsed as { roomCode?: unknown; name?: unknown; game?: unknown };
  } catch {
    return json(400, { error: 'bad-request' });
  }

  const { roomCode, name, game } = body;
  if (
    typeof roomCode !== 'string' ||
    !isValidRoomCode(roomCode) ||
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    name.length > 32 ||
    (game !== undefined && !isGameId(game))
  ) {
    return json(400, { error: 'bad-request' });
  }

  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    return json(503, { error: 'voice-unconfigured' });
  }

  const roomId = scopedRoomId(game === undefined ? DEFAULT_GAME : game, roomCode);
  const membership = await env.ROOMS.get(env.ROOMS.idFromName(roomId)).fetch(
    new Request('https://room-relay.internal/__membership'),
  );
  if (membership.status !== 200) {
    return json(404, { error: 'room-not-found' });
  }
  const { members } = (await membership.json()) as { members?: unknown };
  if (typeof members !== 'number' || members === 0) {
    return json(404, { error: 'room-not-found' });
  }

  const token = await signVoiceToken({
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    identity: generatePlayerId(),
    name: name.trim(),
    room: roomId,
  });
  return json(200, { url: env.LIVEKIT_URL, token });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function allowRateMessage(rate: Map<WebSocket, RateWindow>, ws: WebSocket): boolean {
  const now = Date.now();
  const window = rate.get(ws);
  if (window === undefined || now - window.windowStart >= RATE_WINDOW_MS) {
    rate.set(ws, { windowStart: now, count: 1 });
    return true;
  }
  window.count += 1;
  if (window.count > RATE_MAX_MESSAGES) {
    rate.delete(ws);
    ws.close(1008, 'rate limited');
    return false;
  }
  return true;
}

function attachmentOf(ws: WebSocket): SocketAttachment | null {
  return ws.deserializeAttachment() as SocketAttachment | null;
}

export class RoomRelay implements DurableObject {
  private readonly rate = new Map<WebSocket, RateWindow>();

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/__membership') {
      const members = this.state
        .getWebSockets()
        .filter((socket) => socket.readyState === WebSocket.OPEN).length;
      return json(200, { members });
    }

    const match = ROOM_PATH.exec(url.pathname);
    const gameParam = url.searchParams.get('game');
    const game = gameParam === null ? DEFAULT_GAME : gameParam;
    if (match === null || !isValidRoomCode(match[1]) || !isGameId(game)) {
      return new Response('invalid room', { status: 400 });
    }
    const roomId = scopedRoomId(game, match[1]);

    if (this.state.getWebSockets().length >= MAX_ROOM_SIZE) {
      // Refuse before the 101 handshake instead of accepting and closing:
      // workerd does not deliver a post-accept close() to the peer here.
      // The client treats this like an unreachable room (join timeout).
      return new Response('room full', { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ roomId } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    if (!allowRateMessage(this.rate, ws)) return;
    const roomId = attachmentOf(ws)?.roomId;
    if (roomId === undefined) return;
    if (message.length > MAX_PAYLOAD_BYTES) return;
    if (!isRoomMessageFor(message, roomId)) return;

    for (const peer of this.state.getWebSockets()) {
      if (peer === ws || peer.readyState !== WebSocket.OPEN) continue;
      if (attachmentOf(peer)?.roomId !== roomId) continue;
      peer.send(message);
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.rate.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.rate.delete(ws);
  }
}

function isRoomMessageFor(payload: string, roomId: string): boolean {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null) return false;
    const message = parsed as { roomCode?: unknown; game?: unknown };
    if (typeof message.roomCode !== 'string' || !isValidRoomCode(message.roomCode)) return false;
    const game = message.game === undefined ? DEFAULT_GAME : message.game;
    if (!isGameId(game)) return false;
    return scopedRoomId(game, message.roomCode) === roomId;
  } catch {
    return false;
  }
}

export class Matchmaker implements DurableObject {
  private readonly rate = new Map<WebSocket, RateWindow>();

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== MATCHMAKER_PATH) {
      return new Response('not found', { status: 404 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ queued: false } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    if (!allowRateMessage(this.rate, ws)) return;
    const parsed = parseMatchmakerMessage(message);
    if (parsed === null) return;

    switch (parsed.type) {
      case 'queue': {
        const game = parsed.game ?? DEFAULT_GAME;
        if (attachmentOf(ws)?.queued) return;
        for (const waiterSocket of this.state.getWebSockets()) {
          if (waiterSocket === ws || waiterSocket.readyState !== WebSocket.OPEN) continue;
          const waiter = attachmentOf(waiterSocket);
          if (!waiter?.queued || waiter.game !== game) continue;
          waiterSocket.serializeAttachment({ queued: false } satisfies SocketAttachment);
          const roomCode = generateRoomCode();
          this.sendMatched(waiterSocket, waiter.playerId ?? '', roomCode, 'host', game);
          this.sendMatched(ws, parsed.playerId, roomCode, 'guest', game);
          return;
        }
        const waitingCount = this.state
          .getWebSockets()
          .filter((socket) => attachmentOf(socket)?.queued === true).length;
        if (waitingCount >= MAX_WAITING) return;
        ws.serializeAttachment({
          queued: true,
          playerId: parsed.playerId,
          game,
        } satisfies SocketAttachment);
        return;
      }
      case 'cancel': {
        ws.serializeAttachment({ queued: false } satisfies SocketAttachment);
        return;
      }
      default:
        return;
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.rate.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.rate.delete(ws);
  }

  private sendMatched(
    socket: WebSocket,
    playerId: string,
    roomCode: string,
    role: 'host' | 'guest',
    game: GameId,
  ): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    const message: MatchmakerMessage = { type: 'matched', playerId, roomCode, role, game };
    socket.send(JSON.stringify(message));
  }
}
