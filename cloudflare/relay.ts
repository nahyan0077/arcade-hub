import { isValidRoomCode } from '../src/net/protocol';

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const ROOM_PATH = /^\/room\/([A-Z0-9]{6})$/;
const MAX_ROOM_SIZE = 8;
const MAX_PAYLOAD_BYTES = 4096;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('tic-tac-toe relay', { status: 200 });
    }

    const url = new URL(request.url);
    const match = ROOM_PATH.exec(url.pathname);
    if (match === null || !isValidRoomCode(match[1])) {
      return new Response('invalid room', { status: 400 });
    }

    const roomId = env.ROOMS.idFromName(match[1]);
    return env.ROOMS.get(roomId).fetch(request);
  },
} satisfies ExportedHandler<Env>;

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
