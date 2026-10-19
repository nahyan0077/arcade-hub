import { describe, it, expect } from 'vitest';
import {
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  roomChannelName,
  markForRole,
  isGameId,
  scopedRoomId,
  parseMatchmakerMessage,
  parseMatchmakerEvent,
  DEFAULT_GAME,
} from '../protocol';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('room codes', () => {
  it('generates codes of the expected length and alphabet', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const code = generateRoomCode(mulberry32(seed));
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('is deterministic for a given rng', () => {
    expect(generateRoomCode(mulberry32(9))).toBe(generateRoomCode(mulberry32(9)));
  });

  it('normalizes case and stray characters', () => {
    expect(normalizeRoomCode(' abc-23 ')).toBe('ABC23');
    expect(normalizeRoomCode(' ab c!23 ')).toBe('ABC23');
    expect(normalizeRoomCode('ABC23X')).toBe('ABC23X');
  });

  it('rejects malformed codes', () => {
    expect(isValidRoomCode('')).toBe(false);
    expect(isValidRoomCode('ABC23')).toBe(false);
    expect(isValidRoomCode('ABC2345')).toBe(false);
    expect(isValidRoomCode('ABC230')).toBe(false); // 0 not in alphabet
    expect(isValidRoomCode('abc234')).toBe(true); // lowercased first
  });

  it('maps codes to a stable channel name', () => {
    expect(roomChannelName('abc234')).toBe('room:tictactoe:ABC234');
  });

  it('assigns X to the host and O to the guest', () => {
    expect(markForRole('host')).toBe('X');
    expect(markForRole('guest')).toBe('O');
  });
});
describe('game scoping', () => {
  it('recognizes known game ids only', () => {
    expect(isGameId('tictactoe')).toBe(true);
    expect(isGameId('connectfour')).toBe(false);
    expect(isGameId(42)).toBe(false);
    expect(isGameId(undefined)).toBe(false);
  });

  it('scopes room ids and channels by game', () => {
    expect(scopedRoomId('tictactoe', 'abc234')).toBe('tictactoe:ABC234');
    expect(roomChannelName('ABC234', 'tictactoe')).toBe('room:tictactoe:ABC234');
    expect(DEFAULT_GAME).toBe('tictactoe');
  });

  it('accepts matchmaker messages carrying a game and rejects unknown ones', () => {
    const queue = parseMatchmakerMessage(
      JSON.stringify({ type: 'queue', playerId: 'p1', game: 'tictactoe' }),
    );
    expect(queue).toEqual({ type: 'queue', playerId: 'p1', game: 'tictactoe' });

    const invalid = parseMatchmakerMessage(
      JSON.stringify({ type: 'queue', playerId: 'p1', game: 'bogus' }),
    );
    expect(invalid).toBeNull();
  });

  it('passes a valid game through matched events and rejects unknown ones', () => {
    const matched = parseMatchmakerEvent(
      JSON.stringify({
        type: 'matched',
        playerId: 'p1',
        roomCode: 'ABC234',
        role: 'host',
        game: 'tictactoe',
      }),
    );
    expect(matched).toMatchObject({ type: 'matched', game: 'tictactoe' });

    const invalid = parseMatchmakerEvent(
      JSON.stringify({
        type: 'matched',
        playerId: 'p1',
        roomCode: 'ABC234',
        role: 'host',
        game: 'bogus',
      }),
    );
    expect(invalid).toBeNull();
  });
});
