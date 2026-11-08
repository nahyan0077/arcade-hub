import { describe, expect, it } from 'vitest';
import {
  applyRoundResult,
  arrowRaceRestart,
  arrowRaceStart,
  canStartRound,
  createArrowRaceInitialState,
  generateStimulus,
  isCorrectAnswer,
  startRound,
} from '../core';
import { ARROW_DIRECTIONS, RACE_TARGET_SCORE } from '../types';
import type { ArrowDirection, ArrowStimulus, RaceRoundResult } from '../types';

function playing(targetScore = RACE_TARGET_SCORE) {
  return arrowRaceStart(createArrowRaceInitialState({ targetScore }));
}

function round(
  roundId: number,
  stimulus: ArrowStimulus,
  scorer: 'X' | 'O' | null,
  answer: ArrowDirection | null,
): RaceRoundResult {
  return {
    roundId,
    stimulus,
    scorer,
    answer,
    correct: answer !== null && isCorrectAnswer(stimulus, answer),
  };
}

describe('arrow-race core', () => {
  it('starts in waiting with zero scores', () => {
    const state = createArrowRaceInitialState();
    expect(state.phase).toBe('waiting');
    expect(state.scores).toEqual({ X: 0, O: 0 });
    expect(state.roundId).toBe(0);
    expect(state.targetScore).toBe(RACE_TARGET_SCORE);
    expect(canStartRound(state)).toBe(false);
  });

  it('arrowRaceStart opens play and resets progress', () => {
    const state = arrowRaceStart(createArrowRaceInitialState());
    expect(state.phase).toBe('playing');
    expect(canStartRound(state)).toBe(true);
    expect(arrowRaceStart(state)).toBe(state);
  });

  it('generateStimulus keeps pointing and moving independent (~25% congruent)', () => {
    let congruent = 0;
    const n = 4000;
    // Deterministic LCG so the rate is stable in CI
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let i = 0; i < n; i++) {
      const s = generateStimulus(rng);
      expect(ARROW_DIRECTIONS).toContain(s.pointing);
      expect(ARROW_DIRECTIONS).toContain(s.moving);
      if (s.pointing === s.moving) congruent++;
    }
    expect(congruent / n).toBeGreaterThan(0.18);
    expect(congruent / n).toBeLessThan(0.32);
  });

  it('isCorrectAnswer only accepts the moving direction', () => {
    const stimulus: ArrowStimulus = { pointing: 'up', moving: 'left' };
    expect(isCorrectAnswer(stimulus, 'left')).toBe(true);
    expect(isCorrectAnswer(stimulus, 'up')).toBe(false);
    expect(isCorrectAnswer(stimulus, 'down')).toBe(false);
    expect(isCorrectAnswer(stimulus, 'right')).toBe(false);
  });

  it('startRound increments roundId and stores the stimulus', () => {
    const state = startRound(playing(), { pointing: 'up', moving: 'down' });
    expect(state.roundId).toBe(1);
    expect(state.stimulus).toEqual({ pointing: 'up', moving: 'down' });
    expect(state.lastResult).toBeNull();
  });

  it('applyRoundResult awards a point to the scorer', () => {
    const stimulus: ArrowStimulus = { pointing: 'right', moving: 'up' };
    let state = startRound(playing(), stimulus);
    state = applyRoundResult(state, round(1, stimulus, 'X', 'up'));
    expect(state.scores.X).toBe(1);
    expect(state.scores.O).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.stimulus).toBeNull();
    expect(state.history).toHaveLength(1);
  });

  it('void rounds increment draws and change no scores', () => {
    const stimulus: ArrowStimulus = { pointing: 'left', moving: 'right' };
    let state = startRound(playing(), stimulus);
    state = applyRoundResult(state, round(1, stimulus, null, null));
    expect(state.scores).toEqual({ X: 0, O: 0 });
    expect(state.draws).toBe(1);
    expect(state.phase).toBe('playing');
  });

  it('ignores stale round results', () => {
    const stimulus: ArrowStimulus = { pointing: 'up', moving: 'down' };
    const state = startRound(playing(), stimulus);
    const next = applyRoundResult(state, round(1, stimulus, 'X', 'down'));
    const stale = applyRoundResult(next, round(1, stimulus, 'O', 'down'));
    expect(stale).toBe(next);
  });

  it('ends the match when a score reaches targetScore', () => {
    const stimulus: ArrowStimulus = { pointing: 'up', moving: 'left' };
    let state = startRound(playing(2), stimulus);
    state = applyRoundResult(state, round(1, stimulus, 'X', 'left'));
    expect(state.phase).toBe('playing');
    state = startRound(state, stimulus);
    state = applyRoundResult(state, round(2, stimulus, 'X', 'left'));
    expect(state.phase).toBe('finished');
    expect(state.result).toEqual({ type: 'win', player: 'X' });
    expect(state.scores.X).toBe(2);
    expect(canStartRound(state)).toBe(false);
    // Further rounds are no-ops once finished
    const frozen = startRound(state, stimulus);
    expect(frozen).toBe(state);
  });

  it('opponent scores when the decider answers wrong (handled by caller via scorer)', () => {
    const stimulus: ArrowStimulus = { pointing: 'up', moving: 'down' };
    let state = startRound(playing(), stimulus);
    // Wrong answer by X → host awards O (scorer = O)
    state = applyRoundResult(state, round(1, stimulus, 'O', 'up'));
    expect(state.scores.O).toBe(1);
    expect(state.scores.X).toBe(0);
  });

  it('arrowRaceRestart clears scores back to a fresh playing match', () => {
    const stimulus: ArrowStimulus = { pointing: 'up', moving: 'down' };
    let state = startRound(playing(), stimulus);
    state = applyRoundResult(state, round(1, stimulus, 'X', 'down'));
    const restarted = arrowRaceRestart(state);
    expect(restarted.phase).toBe('playing');
    expect(restarted.scores).toEqual({ X: 0, O: 0 });
    expect(restarted.roundId).toBe(0);
    expect(restarted.playerNames).toEqual(state.playerNames);
    expect(restarted.targetScore).toBe(state.targetScore);
  });
});
