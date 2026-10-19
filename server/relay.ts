import { WebSocket, WebSocketServer, type WebSocket as WsSocket } from 'ws';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  generatePlayerId,
  generateRoomCode,
  isValidRoomCode,
  parseMatchmakerMessage,
  type MatchmakerMessage,
} from '../src/net/protocol.ts';
import { signVoiceToken } from '../src/net/voiceToken.ts';

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
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

export interface RelayServer {
  port: number;
  close(): Promise<void>;
}

export interface RelayVoiceConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export interface RelayServerOptions {
  voice?: RelayVoiceConfig | null;
}

export function startRelay(port: number, options: RelayServerOptions = {}): Promise<RelayServer> {
  const voice = options.voice ?? voiceFromEnv(process.env);

  return new Promise((resolve, reject) => {
    const rooms = new Map<string, Set<WsSocket>>();
    const queue: Array<{ socket: WsSocket; playerId: string }> = [];

    const httpServer = createServer((request, response) => {
      void handleHttp(request, response);
    });
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

    const send = (socket: WsSocket, message: MatchmakerMessage): void => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const dequeueSocket = (socket: WsSocket): void => {
      const index = queue.findIndex((entry) => entry.socket === socket);
      if (index >= 0) queue.splice(index, 1);
    };

    const handleMatchmaker = (socket: WsSocket, message: MatchmakerMessage): void => {
      switch (message.type) {
        case 'queue': {
          if (queue.some((entry) => entry.socket === socket)) return;
          const waiter = queue.shift();
          if (waiter === undefined) {
            queue.push({ socket, playerId: message.playerId });
            return;
          }
          const roomCode = generateRoomCode();
          send(waiter.socket, {
            type: 'matched',
            playerId: waiter.playerId,
            roomCode,
            role: 'host',
          });
          send(socket, { type: 'matched', playerId: message.playerId, roomCode, role: 'guest' });
          return;
        }
        case 'cancel': {
          dequeueSocket(socket);
          return;
        }
        default:
          return;
      }
    };

    async function handleHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
      const pathname = new URL(request.url ?? '/', 'http://relay.local').pathname;

      if (request.method === 'GET' && pathname === '/') {
        sendText(response, 200, 'tic-tac-toe relay');
        return;
      }

      if (pathname === VOICE_TOKEN_PATH) {
        for (const [header, value] of Object.entries(VOICE_CORS_HEADERS)) {
          response.setHeader(header, value);
        }
        if (request.method === 'OPTIONS') {
          response.writeHead(204);
          response.end();
          return;
        }
        if (request.method === 'POST') {
          await handleVoiceToken(request, response);
          return;
        }
      }

      sendJson(response, 404, { error: 'not-found' });
    }

    async function handleVoiceToken(request: IncomingMessage, response: ServerResponse): Promise<void> {
      const body = await readJsonBody(request);
      if (body === null) {
        sendJson(response, 400, { error: 'bad-request' });
        return;
      }
      const { roomCode, name } = body as { roomCode?: unknown; name?: unknown };
      if (
        typeof roomCode !== 'string' ||
        !isValidRoomCode(roomCode) ||
        typeof name !== 'string' ||
        name.trim().length === 0 ||
        name.length > 32
      ) {
        sendJson(response, 400, { error: 'bad-request' });
        return;
      }
      if (voice === null) {
        sendJson(response, 503, { error: 'voice-unconfigured' });
        return;
      }

      const token = await signVoiceToken({
        apiKey: voice.apiKey,
        apiSecret: voice.apiSecret,
        identity: generatePlayerId(),
        name: name.trim(),
        roomCode,
      });
      sendJson(response, 200, { url: voice.url, token });
    }

    httpServer.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    wss.on('connection', (socket, request) => {
      const pathname = new URL(request.url ?? '/', 'http://relay.local').pathname;

      if (pathname === MATCHMAKER_PATH) {
        socket.on('message', (data) => {
          const message = parseMatchmakerMessage(data.toString());
          if (message === null) return;
          handleMatchmaker(socket, message);
        });
        socket.on('close', () => dequeueSocket(socket));
        return;
      }

      const roomCode = roomCodeFromPath(pathname);
      if (roomCode === null) {
        socket.close(1008, 'invalid room');
        return;
      }

      let members = rooms.get(roomCode);
      if (members === undefined) {
        members = new Set();
        rooms.set(roomCode, members);
      }
      if (members.size >= MAX_ROOM_SIZE) {
        socket.close(1013, 'room full');
        return;
      }
      members.add(socket);

      socket.on('message', (data) => {
        const payload = data.toString();
        if (!isRoomMessageFor(payload, roomCode)) return;
        for (const peer of members) {
          if (peer === socket || peer.readyState !== WebSocket.OPEN) continue;
          peer.send(payload);
        }
      });

      socket.on('close', () => {
        members.delete(socket);
        if (members.size === 0) rooms.delete(roomCode);
      });
    });

    const cleanup = (): Promise<void> =>
      new Promise<void>((done) => {
        queue.length = 0;
        for (const members of rooms.values()) {
          for (const socket of members) socket.terminate();
        }
        rooms.clear();
        wss.close();
        httpServer.close(() => done());
      });

    httpServer.once('error', reject);
    wss.once('error', reject);
    httpServer.listen(port, () => {
      const address = httpServer.address();
      const boundPort = typeof address === 'object' && address ? address.port : port;
      resolve({ port: boundPort, close: cleanup });
    });
  });
}

function voiceFromEnv(env: Record<string, string | undefined>): RelayVoiceConfig | null {
  const url = env.LIVEKIT_URL;
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

function roomCodeFromPath(pathname: string): string | null {
  const match = /^\/room\/([A-Z0-9]{6})$/.exec(pathname);
  if (match === null) return null;
  return ROOM_CODE_PATTERN.test(match[1]) ? match[1] : null;
}

function isRoomMessageFor(payload: string, roomCode: string): boolean {
  if (payload.length > MAX_PAYLOAD_BYTES) return false;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null) return false;
    const message = parsed as { roomCode?: unknown };
    return message.roomCode === roomCode;
  } catch {
    return false;
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_HTTP_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString());
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function sendText(response: ServerResponse, status: number, text: string): void {
  response.writeHead(status, { 'content-type': 'text/plain' });
  response.end(text);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

const isMain = process.argv[1] !== undefined && import.meta.filename === process.argv[1];
if (isMain) {
  const port = Number(process.env.RELAY_PORT ?? 8787);
  startRelay(port)
    .then(({ port: bound }) => {
      console.log(`relay listening on ws://127.0.0.1:${bound}/room/<CODE>`);
    })
    .catch((error: unknown) => {
      console.error('relay failed to start', error);
      process.exitCode = 1;
    });
}
