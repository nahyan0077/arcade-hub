import type { Player } from '../engine';
import type { ArrowDirection } from '../engine/arrow-race';

export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const GAMES = ['tictactoe', 'connect-four', 'arrow-race'] as const;
export type GameId = (typeof GAMES)[number];
export const DEFAULT_GAME: GameId = 'tictactoe';

export function isGameId(input: unknown): input is GameId {
  return typeof input === 'string' && (GAMES as readonly string[]).includes(input);
}

export function scopedRoomId(game: GameId, roomCode: string): string {
  return `${game}:${normalizeRoomCode(roomCode)}`;
}

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

export const CHAT_MESSAGE_MAX_LENGTH = 200;
export const CHAT_EMOJIS = ['🎉', '🔥', '😂', '👏', '💯', '😅', '🤔', '👀'] as const;
export type ChatEmoji = (typeof CHAT_EMOJIS)[number];

export const TURN_TIMER_MS = {
  tictactoe: 20000,
  'connect-four': 30000,
  'arrow-race': 0,
} as const;
export type TurnTimerMs = number;
export const MAX_TIMEOUTS = 3;
/** Extra wait after the turn timer so an in-flight move can arrive before we skip. */
export const TURN_TIMEOUT_GRACE_MS = 500;
/** Pause after a decided round before the host starts the next one. */
export const RACE_ROUND_GAP_MS = 1500;
/** No answer within this window voids the round (host-authoritative). */
export const RACE_ROUND_MS = 8000;

export function isChatEmoji(input: unknown): input is ChatEmoji {
  return typeof input === 'string' && (CHAT_EMOJIS as readonly string[]).includes(input);
}

export type RoomMessage =
  | { type: 'hello'; roomCode: string; playerId: string; name: string; game?: GameId }
  | { type: 'welcome'; roomCode: string; hostId: string; hostName: string; game?: GameId }
  | { type: 'rejected'; roomCode: string; reason: 'not-found' | 'room-full'; game?: GameId }
  | { type: 'move'; roomCode: string; playerId: string; index: number; game?: GameId }
  | { type: 'rematch'; roomCode: string; playerId: string; game?: GameId }
  | { type: 'rematch-start'; roomCode: string; game?: GameId }
  | { type: 'leave'; roomCode: string; playerId: string; game?: GameId }
  | { type: 'ping'; roomCode: string; playerId: string; game?: GameId }
  | { type: 'pong'; roomCode: string; playerId: string; game?: GameId }
  | { type: 'chat'; roomCode: string; playerId: string; name: string; text: string; game?: GameId }
  | { type: 'emoji'; roomCode: string; playerId: string; name: string; emoji: string; game?: GameId }
  | { type: 'turn-timeout'; roomCode: string; skippedPlayerId: string; nextPlayerId: string; counts: Record<string, number>; game?: GameId }
  | { type: 'timeout-count'; roomCode: string; counts: Record<string, number>; game?: GameId }
  | { type: 'game-over'; roomCode: string; winnerId: string; reason: 'win' | 'draw' | 'timeout'; game?: GameId }
  | { type: 'round-start'; roomCode: string; roundId: number; pointing: ArrowDirection; moving: ArrowDirection; game?: GameId }
  | { type: 'answer'; roomCode: string; playerId: string; roundId: number; direction: ArrowDirection; game?: GameId }
  | { type: 'round-result'; roomCode: string; roundId: number; scorerId: string | null; answer: ArrowDirection | null; correct: boolean; scores: Record<Player, number>; draws: number; game?: GameId };

export function roomChannelName(roomCode: string, game: GameId = DEFAULT_GAME): string {
  return `room:${scopedRoomId(game, roomCode)}`;
}

export type RoomRole = 'host' | 'guest';

export function markForRole(role: RoomRole): Player {
  return role === 'host' ? 'X' : 'O';
}

/** Board games run a turn timer; arrow-race uses per-round timers instead. */
export function usesTurnTimer(game: GameId): boolean {
  return game !== 'arrow-race';
}

export const MATCHMAKER_PATH = '/matchmake';

export type MatchmakerMessage =
  | { type: 'queue'; playerId: string; game?: GameId }
  | { type: 'matched'; playerId: string; roomCode: string; role: RoomRole; game?: GameId }
  | { type: 'queue-timeout'; playerId: string }
  | { type: 'cancel'; playerId: string; game?: GameId };

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
  const message = parsed as { type?: unknown; playerId?: unknown; game?: unknown };
  if (typeof message.playerId !== 'string' || message.playerId.length === 0) return null;
  if (message.game !== undefined && !isGameId(message.game)) return null;
  if (message.type === 'queue' || message.type === 'cancel') {
    return {
      type: message.type,
      playerId: message.playerId,
      ...(message.game !== undefined ? { game: message.game } : {}),
    };
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
  const message = parsed as {
    type?: unknown;
    playerId?: unknown;
    roomCode?: unknown;
    role?: unknown;
    game?: unknown;
  };
  if (typeof message.playerId !== 'string' || message.playerId.length === 0) return null;
  if (message.game !== undefined && !isGameId(message.game)) return null;
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
      ...(message.game !== undefined ? { game: message.game as GameId } : {}),
    };
  }
  return null;
}