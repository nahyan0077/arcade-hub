import { describe, expect, it } from 'vitest';
import { chooseRaceAnswer } from '../ai';
import { isCorrectAnswer } from '../core';
import type { ArrowStimulus, RaceDifficulty } from '../types';
import { RACE_AI_PERSONALITIES, RACE_DIFFICULTIES } from '../types';

const stimulus: ArrowStimulus = { pointing: 'up', moving: 'left' };

describe('arrow-race ai', () => {
  it('exposes a personality name for every difficulty', () => {
    for (const d of RACE_DIFFICULTIES) {
      expect(RACE_AI_PERSONALITIES[d].name.length).toBeGreaterThan(0);
    }
  });

  it('always returns a valid direction', () => {
    let seed = 7;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (const difficulty of RACE_DIFFICULTIES) {
      for (let i = 0; i < 100; i++) {
        const answer = chooseRaceAnswer(stimulus, difficulty, rng);
        expect(['up', 'down', 'left', 'right']).toContain(answer);
      }
    }
  });

  it('hard answers correctly more often than easy over many draws', () => {
    const trials = 2000;
    const rate = (difficulty: RaceDifficulty) => {
      let seed = 99;
      const rng = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };
      let hits = 0;
      for (let i = 0; i < trials; i++) {
        if (isCorrectAnswer(stimulus, chooseRaceAnswer(stimulus, difficulty, rng))) {
          hits++;
        }
      }
      return hits / trials;
    };
    const easy = rate('easy');
    const hard = rate('hard');
    expect(easy).toBeGreaterThan(0.25);
    expect(easy).toBeLessThan(0.55);
    expect(hard).toBeGreaterThan(0.75);
    expect(hard).toBeLessThan(0.95);
    expect(hard).toBeGreaterThan(easy + 0.15);
  });

  it('misses prefer the pointing distractor', () => {
    // easy accuracy = 0.4 → first draw 0.99 forces a miss;
    // second draw 0.1 < 0.7 selects the pointing distractor.
    const seq = [0.99, 0.1];
    let i = 0;
    const answer = chooseRaceAnswer(stimulus, 'easy', () => seq[i++ % seq.length]);
    expect(answer).toBe('up');
    expect(isCorrectAnswer(stimulus, answer)).toBe(false);
  });

  it('uniform wrong direction when distractor preference is declined', () => {
    // miss (0.99), decline pointing (0.99 >= 0.7) → uniform among wrongs
    const seq = [0.99, 0.99, 0];
    let i = 0;
    const answer = chooseRaceAnswer(stimulus, 'easy', () => seq[i++ % seq.length]);
    expect(answer).not.toBe('left');
    expect(['up', 'down', 'right']).toContain(answer);
  });
});
