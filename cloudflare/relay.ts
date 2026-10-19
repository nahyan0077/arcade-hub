import {
  generatePlayerId,
  generateRoomCode,
  isValidRoomCode,
  parseMatchmakerMessage,
  type MatchmakerMessage,
} from '../src/net/protocol';
import { signVoiceToken } from '../src/net/voiceToken';

export interface Env {
  ROOMS: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
}

const ROOM_PATH = /^\/room\/([A-Z0-9]{6})$/;
const MAX_ROOM_SIZE = 8;
const MAX_PAYLOAD_BYTES = 4096;
const MAX_HTTP_BODY_BYTES = 2048;
const MATCHMAKER_PATH = '/matchmake';
const VOICE_TOKEN_PATH = '/voice/token';
const VOICE_CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    if (!isWebSocket) {
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response('tic-tac-toe relay', { status: 200 });
      }
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
      return new Response('not found', { status: 404 });
    }

    if (url.pathname === MATCHMAKER_PATH) {
      const queueId = env.MATCHMAKER.idFromName('global-queue');
      return env.MATCHMAKER.get(queueId).fetch(request);
    }

    const match = ROOM_PATH.exec(url.pathname);
    if (match === null || !isValidRoomCode(match[1])) {
      return new Response('invalid room', { status: 400 });
    }

    const roomId = env.ROOMS.idFromName(match[1]);
    return env.ROOMS.get(roomId).fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleVoiceToken(request: Request, env: Env): Promise<Response> {
  const raw = await request.text();
  if (raw.length === 0 || raw.length > MAX_HTTP_BODY_BYTES) {
    return json(400, { error: 'bad-request' });
  }
  let body: { roomCode?: unknown; name?: unknown };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return json(400, { error: 'bad-request' });
    body = parsed as { roomCode?: unknown; name?: unknown };
  } catch {
    return json(400, { error: 'bad-request' });
  }

  const { roomCode, name } = body;
  if (
    typeof roomCode !== 'string' ||
    !isValidRoomCode(roomCode) ||
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    name.length > 32
  ) {
    return json(400, { error: 'bad-request' });
  }

  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    return json(503, { error: 'voice-unconfigured' });
  }

  const token = await signVoiceToken({
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    identity: generatePlayerId(),
    name: name.trim(),
    roomCode,
  });
  return json(200, { url: env.LIVEKIT_URL, token });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export class RoomRelay implements DurableObject {
  private readonly members = new Map<WebSocket, string>();

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = ROOM_PATH.exec(url.pathname);
    if (match === null || !isValidRoomCode(match[1])) {
      return new Response('invalid room', { status: 400 });
    }
    const roomCode = match[1];

    if (this.members.size >= MAX_ROOM_SIZE) {
      // Refuse before the 101 handshake instead of accepting and closing:
      // workerd does not deliver a post-accept close() to the peer here.
      // The client treats this like an unreachable room (join timeout).
      return new Response('room full', { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server);
    this.members.set(server, roomCode);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    const roomCode = this.members.get(ws);
    if (roomCode === undefined) return;
    if (message.length > MAX_PAYLOAD_BYTES) return;
    if (!isRoomMessageFor(message, roomCode)) return;

    for (const [peer, peerRoom] of this.members) {
      if (peer === ws || peerRoom !== roomCode) continue;
      if (peer.readyState !== WebSocket.OPEN) continue;
      peer.send(message);
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.members.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.members.delete(ws);
  }
}

function isRoomMessageFor(payload: string, roomCode: string): boolean {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null) return false;
    return (parsed as { roomCode?: unknown }).roomCode === roomCode;
  } catch {
    return false;
  }
}

export class Matchmaker implements DurableObject {
  private readonly waiting = new Map<WebSocket, string>();

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== MATCHMAKER_PATH) {
      return new Response('not found', { status: 404 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    const parsed = parseMatchmakerMessage(message);
    if (parsed === null) return;

    switch (parsed.type) {
      case 'queue': {
        if (this.waiting.has(ws)) return;
        const waiter = this.waiting.entries().next();
        if (waiter.done === true) {
          this.waiting.set(ws, parsed.playerId);
          return;
        }
        const [waiterSocket, waiterId] = waiter.value;
        this.waiting.delete(waiterSocket);
        const roomCode = generateRoomCode();
        this.sendMatched(waiterSocket, waiterId, roomCode, 'host');
        this.sendMatched(ws, parsed.playerId, roomCode, 'guest');
        return;
      }
      case 'cancel': {
        this.waiting.delete(ws);
        return;
      }
      default:
        return;
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.waiting.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.waiting.delete(ws);
  }

  private sendMatched(
    socket: WebSocket,
    playerId: string,
    roomCode: string,
    role: 'host' | 'guest',
  ): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    const message: MatchmakerMessage = { type: 'matched', playerId, roomCode, role };
    socket.send(JSON.stringify(message));
  }
}
