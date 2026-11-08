export type RushDirection = 'up' | 'down' | 'left' | 'right';

export const RUSH_DIRECTIONS: readonly RushDirection[] = [
  'up',
  'down',
  'left',
  'right',
] as const;

export type RushDifficulty =
  | 'beginner'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert';

export const RUSH_DIFFICULTIES: readonly RushDifficulty[] = [
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
] as const;

export interface RushStimulus {
  pointing: RushDirection;
  moving: RushDirection;
}

export interface RushRoundResult {
  stimulus: RushStimulus;
  /** The direction the player answered. */
  answer: RushDirection | null;
  /** True when the answer matched the active instruction. */
  correct: boolean;
  /** True when the active instruction was pointing and the answer matched it. */
  pointingCorrect: boolean;
  /** Instruction that was active when the answer was given. */
  instruction: 'pointing' | 'moving';
  answerTimestamp?: number;
}

export interface RushGameResult {
  type: 'finished';
  finalScore: number;
  accuracy: number;
  correctAnswers: number;
  incorrectAnswers: number;
  missedAnswers: number;
  averageReactionTime: number;
  bestReactionTime: number;
  bestStreak: number;
  totalStimuli: number;
  switches: number;
  pointingAccuracy: number;
  movingAccuracy: number;
  mode: RushDifficulty;
}

export interface RushConfig {
  mode: RushDifficulty;
  /** Response window in ms for the current difficulty. */
  responseWindowMs: number;
  /** Switch instruction after this many stimuli. */
  switchInterval: number;
}

/** Scoring constants — pure, no UI coupling. */
export const SCORING = {
  correct: 100,
  incorrect: -50,
  timeout: -25,
  streak5: 100,
  streak10: 250,
};

export const DEFAULT_CONFIG: RushConfig = {
  mode: 'beginner',
  responseWindowMs: 1500,
  switchInterval: 5,
};