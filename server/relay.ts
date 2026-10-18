import { WebSocket, WebSocketServer, type WebSocket as WsSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const MAX_ROOM_SIZE = 8;
const MAX_PAYLOAD_BYTES = 4096;

export interface RelayServer {
  port: number;
  close(): Promise<void>;
}

export function startRelay(port: number): Promise<RelayServer> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port, maxPayload: MAX_PAYLOAD_BYTES });
    const rooms = new Map<string, Set<WsSocket>>();

    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      const boundPort = typeof address === 'object' && address ? address.port : port;

      wss.on('connection', (socket, request) => {
        const roomCode = roomCodeFromRequest(request);
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

      resolve({
        port: boundPort,
        close: () =>
          new Promise<void>((done) => {
            for (const members of rooms.values()) {
              for (const socket of members) socket.terminate();
            }
            rooms.clear();
            wss.close(() => done());
          }),
      });
    });
  });
}

function roomCodeFromRequest(request: IncomingMessage): string | null {
  const pathname = new URL(request.url ?? '/', 'http://relay.local').pathname;
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
