import type { AIDifficulty, GameMode, Player } from '../types';

export type ArrowDirection = 'up' | 'down' | 'left' | 'right';

export const ARROW_DIRECTIONS: readonly ArrowDirection[] = [
  'up',
  'down',
  'left',
  'right',
] as const;

export type RacePhase = 'waiting' | 'playing' | 'finished';

/**
 * One Stroop-style stimulus. `pointing` is the glyph (distractor);
 * `moving` is the slide direction and the only correct answer.
 */
export interface ArrowStimulus {
  pointing: ArrowDirection;
  moving: ArrowDirection;
}

export interface RaceRoundResult {
  roundId: number;
  stimulus: ArrowStimulus;
  /** Player who scored this round, or null when the round timed out (void). */
  scorer: Player | null;
  /** Answer that decided the round; null when void. */
  answer: ArrowDirection | null;
  /** True when the deciding answer matched `stimulus.moving`. */
  correct: boolean;
}

export type RaceGameResult =
  | { type: 'win'; player: Player }
  | { type: 'draw' }
  | { type: 'ongoing' };

export interface ArrowRaceState {
  phase: RacePhase;
  scores: Record<Player, number>;
  draws: number;
  mode: GameMode;
  aiDifficulty: RaceDifficulty;
  playerNames: Record<Player, string>;
  /** Id of the current (or most recent) round; 0 before the first round. */
  roundId: number;
  stimulus: ArrowStimulus | null;
  lastResult: RaceRoundResult | null;
  result: RaceGameResult | null;
  targetScore: number;
  history: RaceRoundResult[];
}

export interface ArrowRaceGameConfig {
  mode: GameMode;
  aiDifficulty: RaceDifficulty;
  playerNames: Record<Player, string>;
  targetScore: number;
}

export type RaceDifficulty = Extract<
  AIDifficulty,
  'easy' | 'medium' | 'hard'
>;

export const RACE_DIFFICULTIES: readonly RaceDifficulty[] = [
  'easy',
  'medium',
  'hard',
] as const;

export const RACE_AI_PERSONALITIES: Record<RaceDifficulty, { name: string }> = {
  easy: { name: 'DRIFT' },
  medium: { name: 'VECTOR' },
  hard: { name: 'BLITZ' },
};

/** First to this many points wins the match. */
export const RACE_TARGET_SCORE = 5;

/** No answer within this window voids the round. */
export const RACE_ROUND_MS = 8000;

export const ARROW_RACE_DEFAULT_CONFIG: ArrowRaceGameConfig = {
  mode: 'pvp',
  aiDifficulty: 'medium',
  playerNames: { X: 'Player X', O: 'Player O' },
  targetScore: RACE_TARGET_SCORE,
};
