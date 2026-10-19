import { createBroadcastTransport, type RoomTransport } from './transport';
import { createWebSocketTransport } from './wsTransport';
import { normalizeRoomCode, roomChannelName, type GameId, DEFAULT_GAME } from './protocol';

export function createRoomTransport(roomCode: string, game: GameId = DEFAULT_GAME): RoomTransport {
  const wsUrl = import.meta.env.VITE_WS_URL;
  const code = normalizeRoomCode(roomCode);
  if (wsUrl) {
    const base = wsUrl.replace(/\/$/, '');
    return createWebSocketTransport(`${base}/room/${code}?game=${game}`);
  }
  return createBroadcastTransport(roomChannelName(code, game));
}
