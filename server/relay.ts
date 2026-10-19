import { WebSocket, WebSocketServer, type WebSocket as WsSocket } from 'ws';
import {
  generateRoomCode,
  parseMatchmakerMessage,
  type MatchmakerMessage,
} from '../src/net/protocol.ts';

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const MAX_ROOM_SIZE = 8;
const MAX_PAYLOAD_BYTES = 4096;
const MATCHMAKER_PATH = '/matchmake';

export interface RelayServer {
  port: number;
  close(): Promise<void>;
}

export function startRelay(port: number): Promise<RelayServer> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port, maxPayload: MAX_PAYLOAD_BYTES });
    const rooms = new Map<string, Set<WsSocket>>();
    const queue: Array<{ socket: WsSocket; playerId: string }> = [];

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

    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      const boundPort = typeof address === 'object' && address ? address.port : port;

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

      resolve({
        port: boundPort,
        close: () =>
          new Promise<void>((done) => {
            queue.length = 0;
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
