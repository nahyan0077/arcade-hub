import type { ArrowDirection, ArrowStimulus, RaceDifficulty } from './types';
import { ARROW_DIRECTIONS } from './types';
import { isCorrectAnswer, type RaceRng } from './core';

const ACCURACY: Record<RaceDifficulty, number> = {
  easy: 0.4,
  medium: 0.65,
  hard: 0.85,
};

/**
 * Stroop-biased AI: correct answers use `moving`; misses prefer the
 * pointing distractor, else a uniform wrong direction.
 */
export function chooseRaceAnswer(
  stimulus: ArrowStimulus,
  difficulty: RaceDifficulty,
  rng: RaceRng = Math.random,
): ArrowDirection {
  if (rng() < ACCURACY[difficulty]) {
    return stimulus.moving;
  }
  if (stimulus.pointing !== stimulus.moving && rng() < 0.7) {
    return stimulus.pointing;
  }
  const wrongs = ARROW_DIRECTIONS.filter(
    (d) => !isCorrectAnswer(stimulus, d),
  );
  return wrongs[Math.floor(rng() * wrongs.length)];
}
