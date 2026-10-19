import type { Player } from '../engine';

export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidRoomCode(input: string): boolean {
  const code = normalizeRoomCode(input);
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code].every((char) => ROOM_CODE_ALPHABET.includes(char));
}

export function generatePlayerId(): string {
  return crypto.randomUUID();
}

export type RoomMessage =
  | { type: 'hello'; roomCode: string; playerId: string; name: string }
  | { type: 'welcome'; roomCode: string; hostId: string; hostName: string }
  | { type: 'rejected'; roomCode: string; reason: 'not-found' | 'room-full' }
  | { type: 'move'; roomCode: string; playerId: string; index: number }
  | { type: 'rematch'; roomCode: string; playerId: string }
  | { type: 'rematch-start'; roomCode: string }
  | { type: 'leave'; roomCode: string; playerId: string }
  | { type: 'ping'; roomCode: string; playerId: string }
  | { type: 'pong'; roomCode: string; playerId: string };

export function roomChannelName(roomCode: string): string {
  return `tic-tac-toe:room:${normalizeRoomCode(roomCode)}`;
}

export type RoomRole = 'host' | 'guest';

export function markForRole(role: RoomRole): Player {
  return role === 'host' ? 'X' : 'O';
}

export const MATCHMAKER_PATH = '/matchmake';

export type MatchmakerMessage =
  | { type: 'queue'; playerId: string }
  | { type: 'matched'; playerId: string; roomCode: string; role: RoomRole }
  | { type: 'queue-timeout'; playerId: string }
  | { type: 'cancel'; playerId: string };

export type MatchmakerEvent = Extract<MatchmakerMessage, { type: 'matched' | 'queue-timeout' }>;

export function parseMatchmakerMessage(payload: string): MatchmakerMessage | null {
  if (payload.length > 256) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const message = parsed as { type?: unknown; playerId?: unknown };
  if (typeof message.playerId !== 'string' || message.playerId.length === 0) return null;
  if (message.type === 'queue' || message.type === 'cancel') {
    return { type: message.type, playerId: message.playerId };
  }
  return null;
}

export function parseMatchmakerEvent(payload: string): MatchmakerEvent | null {
  if (payload.length > 256) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const message = parsed as { type?: unknown; playerId?: unknown; roomCode?: unknown; role?: unknown };
  if (typeof message.playerId !== 'string' || message.playerId.length === 0) return null;
  if (message.type === 'queue-timeout') {
    return { type: 'queue-timeout', playerId: message.playerId };
  }
  if (
    message.type === 'matched' &&
    typeof message.roomCode === 'string' &&
    isValidRoomCode(message.roomCode) &&
    (message.role === 'host' || message.role === 'guest')
  ) {
    return {
      type: 'matched',
      playerId: message.playerId,
      roomCode: normalizeRoomCode(message.roomCode),
      role: message.role,
    };
  }
  return null;
}