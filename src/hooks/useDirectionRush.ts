import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  type RushState,
  type RushDifficulty,
  type RushConfig,
  type RushDirection,
  DEFAULT_CONFIG,
  rushStart,
  rushAnswer,
  rushApplyResult,
  rushNextStimulus,
  rushTimeout,
  rushRampDifficulty,
} from '../engine/direction-rush';

export interface UseDirectionRushReturn {
  state: RushState;
  startGame: (mode: RushDifficulty, config?: RushConfig) => void;
  submitAnswer: (dir: RushDirection) => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  getLeafStyles: (index: number) => React.CSSProperties;
  isPlaying: boolean;
}

export const useDirectionRush = (): UseDirectionRushReturn => {
  const [state, setState] = useState<RushState>(() => rushStart('beginner', DEFAULT_CONFIG));
  const stateRef = useRef<RushState>(state);
  stateRef.current = state;
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutTimerRef.current !== null) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const armTimeout = useCallback((s: RushState) => {
    clearTimer();
    if (s.phase !== 'playing' || !s.activeStimulus) return;
    const remaining = Math.max(50, s.activeStimulus.deadline - Date.now());
    timeoutTimerRef.current = setTimeout(() => {
      const current = stateRef.current;
      if (!current || current.phase !== 'playing') return;
      const timeoutRes = rushTimeout(current);
      rushApplyResult(current, timeoutRes);
      stateRef.current = { ...current };
      setState({ ...current });
      armTimeout(current);
    }, remaining);
  }, [clearTimer]);

  const startGame = useCallback((mode: RushDifficulty, config?: RushConfig) => {
    clearTimer();
    const s = rushStart(mode, config ?? DEFAULT_CONFIG);
    s.phase = 'playing';
    rushNextStimulus(s);
    stateRef.current = s;
    setState({ ...s });
    armTimeout(s);
  }, [clearTimer, armTimeout]);

  const submitAnswer = useCallback((dir: RushDirection) => {
    const s = stateRef.current;
    if (!s || s.pending || s.phase !== 'playing') return;

    clearTimer();
    const answerResult = rushAnswer(s, dir);
    rushApplyResult(s, answerResult.result);
    stateRef.current = { ...s };
    setState({ ...s });
    armTimeout(s);
  }, [clearTimer, armTimeout]);

  const pause = useCallback(() => {
    clearTimer();
    if (stateRef.current) {
      stateRef.current.phase = 'paused';
      setState({ ...stateRef.current });
    }
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (stateRef.current) {
      stateRef.current.phase = 'playing';
      if (!stateRef.current.stimulus) {
        rushNextStimulus(stateRef.current);
      }
      setState({ ...stateRef.current });
      armTimeout(stateRef.current);
    }
  }, [armTimeout]);

  const restart = useCallback(() => {
    if (stateRef.current) {
      startGame(stateRef.current.mode, stateRef.current.config);
    }
  }, [startGame]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const isPlaying = useMemo(() => state.phase === 'playing', [state.phase]);

  // Persist session score when game finishes
  useEffect(() => {
    if (state.phase !== 'finished' || state.history.length === 0) return;
    try {
      const key = `direction-rush.${state.mode}.scores.v1`;
      const stored = JSON.parse(localStorage.getItem(key) || '{"correct":0,"incorrect":0,"total":0,"bestStreak":0}');
      const correct = state.history.filter((r) => r.correct).length;
      const incorrect = state.history.length - correct;
      const updated = {
        correct: (stored.correct ?? 0) + correct,
        incorrect: (stored.incorrect ?? 0) + incorrect,
        total: (stored.total ?? 0) + state.history.length,
        bestStreak: Math.max(stored.bestStreak ?? 0, state.bestStreak ?? 0),
      };
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      /* silent */
    }
  }, [state.phase, state.history, state.mode, state.bestStreak]);

  // Difficulty ramp: call every 15s while playing
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (!stateRef.current || stateRef.current.phase !== 'playing') return;
      rushRampDifficulty(stateRef.current, 16);
      rafId = requestAnimationFrame(tick);
    };
    if (state.phase === 'playing') {
      rafId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafId);
  }, [state.phase]);

  const getLeafStyles = useCallback((index: number): React.CSSProperties => {
    const rotate = index % 4 === 0 ? 0 : index % 4 === 1 ? 90 : index % 4 === 2 ? 180 : 270;
    return { transform: `rotate(${rotate}deg) translateX(${index * 30}px) translateY(${index * 20}px)` };
  }, []);

  return {
    state,
    startGame,
    submitAnswer,
    pause,
    resume,
    restart,
    getLeafStyles,
    isPlaying,
  };
};
