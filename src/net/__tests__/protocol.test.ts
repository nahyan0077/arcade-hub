import { describe, it, expect } from 'vitest';
import {
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  roomChannelName,
  markForRole,
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
    expect(roomChannelName('abc234')).toBe('tic-tac-toe:room:ABC234');
  });

  it('assigns X to the host and O to the guest', () => {
    expect(markForRole('host')).toBe('X');
    expect(markForRole('guest')).toBe('O');
  });
});