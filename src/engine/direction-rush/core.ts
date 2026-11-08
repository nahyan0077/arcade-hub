import {
  SCORING,
  type RushConfig,
  type RushDifficulty,
  type RushDirection,
  type RushRoundResult,
  type RushStimulus,
  RUSH_DIRECTIONS,
} from './types';

/** One stimulus group — all leaves share the same pointing + moving. */
export interface RushStimulusGroup {
  id: number;
  stimulus: RushStimulus;
  /** When the player must answer before this expires. */
  deadline: number;
}

/** Shared runtime state. Kept outside React for pure testing. */
export interface RushState {
  phase: 'idle' | 'playing' | 'paused' | 'finished';
  mode: RushDifficulty;
  config: RushConfig;
  /** Stimuli served in this session. */
  history: RushRoundResult[];
  /** Current (or most recent) stimulus. */
  stimulus: RushStimulus | null;
  /** Active instruction, one of 'pointing' or 'moving'. */
  instruction: 'pointing' | 'moving';
  stimuliServed: number;
  /** How many stimuli since last instruction switch. */
  stimuliSinceSwitch: number;
  /** Streak of consecutive correct answers. */
  streak: number;
  /** Best streak ever achieved in this session. */
  bestStreak: number;
  /** Accumulators for per-instruction accuracy. */
  pointingCorrect: number;
  pointingTotal: number;
  movingCorrect: number;
  movingTotal: number;
  /** Total reaction-time samples. */
  reactionTimes: number[];
  /** Best (shortest) reaction time. */
  bestReactionTime: number;
  /** Last feedback, set after each answer or timeout. */
  lastFeedback: 'correct' | 'incorrect' | 'timeout' | null;
  /** True when an answer is currently pending (prevents duplicates). */
  pending: boolean;
  /** Lives remaining (Survival mode). */
  lives: number;
  /** Elapsed ms since session start (for difficulty ramp). */
  elapsedMs: number;
  /** Direction the leaves are currently moving. */
  movingDirection: RushDirection;
  /** Direction the leaves' tips are currently pointing. */
  pointingDirection: RushDirection;
  /** The currently active stimulus group, if any. */
  activeStimulus: RushStimulusGroup | null;
}

/** Start a new session. */
export function rushStart(mode: RushDifficulty, config: RushConfig): RushState {
  const initialConfig: RushConfig = {
    mode,
    responseWindowMs: SCORING.correct > 0 ? 1500 : 1500, // will be overridden below
    switchInterval: 5,
  };

  // Map difficulty → config
  const difficultyConfig: Record<RushDifficulty, RushConfig> = {
    beginner: { mode: 'beginner', responseWindowMs: 1500, switchInterval: 5 },
    easy: { mode: 'easy', responseWindowMs: 1200, switchInterval: 4 },
    medium: { mode: 'medium', responseWindowMs: 900, switchInterval: 3 },
    hard: { mode: 'hard', responseWindowMs: 650, switchInterval: 2 },
    expert: { mode: 'expert', responseWindowMs: 400, switchInterval: 1 },
  };

  const baseConfig = difficultyConfig[mode];
  const finalConfig = { ...initialConfig, ...baseConfig, ...config };

  return {
    phase: 'idle',
    mode,
    config: finalConfig,
    history: [],
    stimulus: null,
    instruction: 'moving', // start with MOVING for familiar feel
    stimuliServed: 0,
    stimuliSinceSwitch: 0,
    streak: 0,
    bestStreak: 0,
    pointingCorrect: 0,
    pointingTotal: 0,
    movingCorrect: 0,
    movingTotal: 0,
    reactionTimes: [],
    bestReactionTime: Infinity,
    lastFeedback: null,
    pending: false,
    lives: 3, // default; Survival mode sets this explicitly
    elapsedMs: 0,
    movingDirection: 'down',
    pointingDirection: 'left',
    activeStimulus: null,
  };
}

/** Submit a player answer. Returns { correct, pointingCorrect, newStreak, streakChanged, gameOver }.
 * No side effects on state mutation — caller must apply. */
export function rushAnswer(
  state: RushState,
  answer: RushDirection,
): {
  correct: boolean;
  pointingCorrect: boolean;
  newStreak: number;
  streakChanged: boolean;
  gameOver: boolean;
  result: RushRoundResult;
} {
  if (state.pending || state.phase !== 'playing') {
    return {
      correct: false,
      pointingCorrect: false,
      newStreak: state.streak,
      streakChanged: false,
      gameOver: false,
      result: {
        stimulus: state.stimulus ?? { pointing: 'left', moving: 'down' },
        answer: answer,
        correct: false,
        pointingCorrect: false,
        instruction: state.instruction,
      },
    };
  }

  const stimulus = state.stimulus!;
  const isMovingCorrect = answer === stimulus.moving;
  const isPointingCorrect = answer === stimulus.pointing;

  // Determine which instruction is active
  const activeIsMoving = state.instruction === 'moving';

  let correct = false;
  let pointingCorrect = false;

  if (activeIsMoving) {
    correct = isMovingCorrect;
    pointingCorrect = false;
  } else {
    correct = isPointingCorrect;
    pointingCorrect = true;
  }

  // Streak logic
  const streakNew = correct ? state.streak + 1 : 0;
  const streakChanged = streakNew !== state.streak;

  // Reaction time
  const now = Date.now();
  state.reactionTimes.push(now - (state.activeStimulus?.deadline ?? now - 100)); // rough
  if (state.reactionTimes.length > 50) state.reactionTimes.shift();

  // New result
  const result: RushRoundResult = {
    stimulus,
    answer,
    correct,
    pointingCorrect,
    instruction: state.instruction,
  };

  // Simple game-over check: finished when stimuliServed reaches a cap or Survival lives = 0
  const stimuliServedNew = state.stimuliServed + 1;
  const maxStimuli = 100;

  return {
    correct,
    pointingCorrect,
    newStreak: streakNew,
    streakChanged,
    gameOver: stimuliServedNew >= maxStimuli,
    result,
  };
}

/** Advance to next stimulus. Updates state in-place. */
export function rushNextStimulus(state: RushState): RushStimulusGroup | null {
  if (state.phase !== 'playing') return null;

  // Generate a new stimulus with independent pointing + moving
  const pointing = RUSH_DIRECTIONS[Math.floor(Math.random() * RUSH_DIRECTIONS.length)];
  const moving = RUSH_DIRECTIONS[Math.floor(Math.random() * RUSH_DIRECTIONS.length)];

  const group: RushStimulusGroup = {
    id: state.history.length + 1,
    stimulus: { pointing, moving },
    deadline: Date.now() + state.config.responseWindowMs,
  };

  // Update state
  state.stimulus = { pointing, moving };
  state.activeStimulus = group;
  state.stimuliSinceSwitch += 1;

  // Possibly switch instruction
  if (state.stimuliSinceSwitch >= state.config.switchInterval && state.stimuliServed > 0) {
    state.instruction = state.instruction === 'pointing' ? 'moving' : 'pointing';
    state.stimuliSinceSwitch = 0;
  }

  return group;
}

/** Called when a stimulus window expires. */
export function rushTimeout(state: RushState): RushRoundResult {
  if (state.phase !== 'playing' || !state.stimulus) {
    return {
      stimulus: { pointing: 'left', moving: 'down' },
      answer: null,
      correct: false,
      pointingCorrect: false,
      instruction: state.instruction,
    };
  }

  const result: RushRoundResult = {
    stimulus: state.stimulus,
    answer: null,
    correct: false,
    pointingCorrect: false,
    instruction: state.instruction,
  };

  // Streak resets on timeout
  state.streak = 0;
  state.lastFeedback = 'timeout';

  return result;
}

/** Apply result after answer/timeout — caller updates state fields. */
export function rushApplyResult(state: RushState, result: RushRoundResult): void {
  state.history.push(result);
  state.stimuliServed += 1;

  if (result.correct) {
    state.streak += 1;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    state.pointingCorrect += result.pointingCorrect ? 1 : 0;
    state.pointingTotal += 1;
    if (!state.instruction || result.pointingCorrect) {
      state.movingCorrect += result.answer === result.stimulus.moving ? 1 : 0;
    }
    state.movingTotal += 1;
    state.lastFeedback = 'correct';
  } else {
    state.streak = 0;
    state.lastFeedback = 'incorrect';
  }

  // Reaction time
  if (result.answer !== null && state.activeStimulus) {
    const rt = result.answerTimestamp
      ? Date.now() - state.activeStimulus.deadline + result.answerTimestamp
      : 0;
    state.reactionTimes.push(rt);
    if (state.reactionTimes.length > 50) state.reactionTimes.shift();
    state.bestReactionTime = Math.min(...state.reactionTimes, Infinity);
  }

  // Switch instruction if interval reached (may already have happened; idempotent)
  if (state.stimuliSinceSwitch >= state.config.switchInterval && state.stimuliServed > 0) {
    state.instruction = state.instruction === 'pointing' ? 'moving' : 'pointing';
    state.stimuliSinceSwitch = 0;
  }

  // Prepare next stimulus immediately so leaves keep moving
  rushNextStimulus(state);
}

/** Difficulty ramp: increase speed / shorten window based on elapsed time + performance. */
export function rushRampDifficulty(state: RushState, dtMs: number): void {
  state.elapsedMs += dtMs;

  // Every 15s, possibly upgrade one tier (capped at expert)
  if (state.elapsedMs < 15000) return;
  const tiers = ['beginner', 'easy', 'medium', 'hard', 'expert'] as const;
  const currentIdx = tiers.indexOf(state.mode);
  if (currentIdx >= tiers.length - 1) return; // already expert

  // Upgrade if player has > 70% accuracy over last 10 stimuli
  const recent = state.history.slice(-10);
  const correctCount = recent.filter((r) => r.correct).length;
  const accuracy = recent.length > 0 ? correctCount / recent.length : 0.5;

  if (accuracy > 0.7 && currentIdx < tiers.length - 1) {
    state.mode = tiers[currentIdx + 1] as RushDifficulty;
    // Adjust config on the fly
    const newConfig: RushConfig = {
      mode: state.mode,
      responseWindowMs: {
        beginner: 1500,
        easy: 1200,
        medium: 900,
        hard: 650,
        expert: 400,
      }[state.mode],
      switchInterval: {
        beginner: 5,
        easy: 4,
        medium: 3,
        hard: 2,
        expert: 1,
      }[state.mode],
    };
    state.config = { ...state.config, ...newConfig };
  }

  state.elapsedMs = 0; // reset timer
}

export { SCORING };
