import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  rushStart,
  rushAnswer,
  rushTimeout,
  rushApplyResult,
  rushNextStimulus,
} from '../core';
import { DEFAULT_CONFIG } from '../types';

describe('Direction Rush Engine Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default config and zero scores', () => {
    const state = rushStart('beginner', DEFAULT_CONFIG);
    expect(state.mode).toBe('beginner');
    expect(state.streak).toBe(0);
    expect(state.history.length).toBe(0);
    expect(state.stimuliServed).toBe(0);
    expect(state.phase).toBe('idle');
  });

  it('serves next stimulus with independent pointing and moving', () => {
    const state = rushStart('beginner', DEFAULT_CONFIG);
    state.phase = 'playing';
    const stimulusGroup = rushNextStimulus(state);
    expect(stimulusGroup).not.toBeNull();
    expect(state.stimulus).toBeDefined();
    expect(state.activeStimulus).toBe(stimulusGroup);
    expect(state.activeStimulus?.deadline).toBeGreaterThan(Date.now());
  });

  it('correctly evaluates moving instruction', () => {
    const state = rushStart('beginner', DEFAULT_CONFIG);
    state.phase = 'playing';
    state.instruction = 'moving';
    state.stimulus = { pointing: 'up', moving: 'down' };
    state.activeStimulus = {
      id: 1,
      stimulus: state.stimulus,
      deadline: Date.now() + 1500,
    };

    const answer = rushAnswer(state, 'down');
    expect(answer.correct).toBe(true);

    const wrongAnswer = rushAnswer(state, 'up');
    expect(wrongAnswer.correct).toBe(false);
  });

  it('correctly evaluates pointing instruction and sets pointingCorrect accurately', () => {
    const state = rushStart('beginner', DEFAULT_CONFIG);
    state.phase = 'playing';
    state.instruction = 'pointing';
    state.stimulus = { pointing: 'left', moving: 'right' };
    state.activeStimulus = {
      id: 1,
      stimulus: state.stimulus,
      deadline: Date.now() + 1500,
    };

    const rightAnswer = rushAnswer(state, 'left');
    expect(rightAnswer.correct).toBe(true);
    expect(rightAnswer.pointingCorrect).toBe(true);

    const wrongAnswer = rushAnswer(state, 'right');
    expect(wrongAnswer.correct).toBe(false);
    expect(wrongAnswer.pointingCorrect).toBe(false);
  });

  it('handles timeout correctly and resets streak', () => {
    const state = rushStart('beginner', DEFAULT_CONFIG);
    state.phase = 'playing';
    state.streak = 5;
    state.stimulus = { pointing: 'up', moving: 'down' };

    const timeoutRes = rushTimeout(state);
    expect(timeoutRes.answer).toBeNull();
    expect(timeoutRes.correct).toBe(false);
    expect(state.streak).toBe(0);
    expect(state.lastFeedback).toBe('timeout');
  });

  it('applies result and records reaction time without inverting math', () => {
    const state = rushStart('beginner', { ...DEFAULT_CONFIG, responseWindowMs: 1000 });
    state.phase = 'playing';
    state.stimulus = { pointing: 'up', moving: 'right' };
    const now = Date.now();
    state.activeStimulus = {
      id: 1,
      stimulus: state.stimulus,
      deadline: now + 800, // 200ms elapsed
    };

    const answer = rushAnswer(state, 'right');
    rushApplyResult(state, answer.result);

    expect(state.history.length).toBe(1);
    expect(state.streak).toBe(1);
    expect(state.bestStreak).toBe(1);
    expect(state.reactionTimes.length).toBe(1);
    expect(state.reactionTimes[0]).toBeGreaterThanOrEqual(0);
    expect(state.bestReactionTime).toBeGreaterThanOrEqual(0);
  });
});
