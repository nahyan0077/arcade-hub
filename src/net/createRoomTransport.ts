import { createBroadcastTransport, type RoomTransport } from './transport';
import { createWebSocketTransport } from './wsTransport';
import { normalizeRoomCode } from './protocol';

export function createRoomTransport(roomCode: string): RoomTransport {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) {
    const base = wsUrl.replace(/\/$/, '');
    return createWebSocketTransport(`${base}/room/${normalizeRoomCode(roomCode)}`);
  }
  return createBroadcastTransport(`tic-tac-toe:room:${normalizeRoomCode(roomCode)}`);
}
