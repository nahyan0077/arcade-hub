import { describe, it, expect } from 'vitest';
import { resultSoundEffect } from '../useGame';

describe('resultSoundEffect', () => {
  it('plays the win fanfare without a perspective (local table)', () => {
    expect(resultSoundEffect('X', null)).toBe('win');
  });

  it('plays the win fanfare for the winner', () => {
    expect(resultSoundEffect('X', 'X')).toBe('win');
    expect(resultSoundEffect('O', 'O')).toBe('win');
  });

  it('plays the lose cue for the loser', () => {
    expect(resultSoundEffect('X', 'O')).toBe('lose');
    expect(resultSoundEffect('O', 'X')).toBe('lose');
  });
});
