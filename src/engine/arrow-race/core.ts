import {
  ARROW_DIRECTIONS,
  ARROW_RACE_DEFAULT_CONFIG,
  RACE_TARGET_SCORE,
} from './types';
import type {
  ArrowDirection,
  ArrowRaceGameConfig,
  ArrowRaceState,
  ArrowStimulus,
  RaceRoundResult,
} from './types';
import type { Player } from '../types';

export type RaceRng = () => number;

export function createArrowRaceInitialState(
  config: Partial<ArrowRaceGameConfig> = {},
): ArrowRaceState {
  const merged = { ...ARROW_RACE_DEFAULT_CONFIG, ...config };
  return {
    phase: 'waiting',
    scores: { X: 0, O: 0 },
    draws: 0,
    mode: merged.mode,
    aiDifficulty: merged.aiDifficulty,
    playerNames: merged.playerNames,
    roundId: 0,
    stimulus: null,
    lastResult: null,
    result: null,
    targetScore: merged.targetScore,
    history: [],
  };
}

export function arrowRaceStart(state: ArrowRaceState): ArrowRaceState {
  if (state.phase !== 'waiting') return state;
  return {
    ...state,
    phase: 'playing',
    result: null,
    scores: { X: 0, O: 0 },
    draws: 0,
    roundId: 0,
    stimulus: null,
    lastResult: null,
    history: [],
  };
}

/**
 * Independent pointing/moving draws → ~25% congruent (moving === pointing).
 * When not congruent, moving is uniform among the other three directions.
 */
export function generateStimulus(rng: RaceRng = Math.random): ArrowStimulus {
  const pointing = ARROW_DIRECTIONS[Math.floor(rng() * ARROW_DIRECTIONS.length)];
  if (rng() < 0.25) {
    return { pointing, moving: pointing };
  }
  const others = ARROW_DIRECTIONS.filter((d) => d !== pointing);
  const moving = others[Math.floor(rng() * others.length)];
  return { pointing, moving };
}

export function isCorrectAnswer(
  stimulus: ArrowStimulus,
  direction: ArrowDirection,
): boolean {
  return direction === stimulus.moving;
}

/** True when a new round may start (match still open). */
export function canStartRound(state: ArrowRaceState): boolean {
  return state.phase === 'playing';
}

/**
 * Begin the next round. Host (or local game) generates the shared stimulus.
 */
export function startRound(
  state: ArrowRaceState,
  stimulus: ArrowStimulus,
): ArrowRaceState {
  if (!canStartRound(state)) return state;
  const roundId = state.roundId + 1;
  return {
    ...state,
    roundId,
    stimulus,
    lastResult: null,
  };
}

/**
 * Apply a decided round. Void rounds pass scorer=null (no score change).
 * Match ends when any score reaches targetScore.
 */
export function applyRoundResult(
  state: ArrowRaceState,
  result: RaceRoundResult,
): ArrowRaceState {
  if (state.phase !== 'playing') return state;
  if (result.roundId !== state.roundId) return state;
  // Already resolved this round (duplicate / late message).
  if (state.lastResult !== null && state.lastResult.roundId === result.roundId) {
    return state;
  }

  const scores = { ...state.scores };
  let draws = state.draws;
  if (result.scorer === null) {
    draws += 1;
  } else {
    scores[result.scorer] += 1;
  }

  const history = [...state.history, result];
  const winner =
    scores.X >= state.targetScore
      ? ('X' as Player)
      : scores.O >= state.targetScore
        ? ('O' as Player)
        : null;

  if (winner !== null) {
    return {
      ...state,
      scores,
      draws,
      lastResult: result,
      history,
      phase: 'finished',
      result: { type: 'win', player: winner },
      stimulus: null,
    };
  }

  return {
    ...state,
    scores,
    draws,
    lastResult: result,
    history,
    stimulus: null,
  };
}

/** Clear the live stimulus without scoring (used when tearing down a round). */
export function clearStimulus(state: ArrowRaceState): ArrowRaceState {
  if (state.stimulus === null) return state;
  return { ...state, stimulus: null };
}

export function arrowRaceRestart(state: ArrowRaceState): ArrowRaceState {
  return {
    ...createArrowRaceInitialState({
      mode: state.mode,
      aiDifficulty: state.aiDifficulty,
      playerNames: state.playerNames,
      targetScore: state.targetScore,
    }),
    phase: 'playing',
  };
}

export function arrowRaceNewGame(state: ArrowRaceState): ArrowRaceState {
  return createArrowRaceInitialState({
    mode: state.mode,
    aiDifficulty: state.aiDifficulty,
    playerNames: state.playerNames,
    targetScore: state.targetScore ?? RACE_TARGET_SCORE,
  });
}
