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

  const startGame = useCallback((mode: RushDifficulty, config?: RushConfig) => {
    const s = rushStart(mode, config ?? DEFAULT_CONFIG);
    s.phase = 'playing';
    rushNextStimulus(s);
    stateRef.current = s;
    setState({ ...s });
  }, []);

  const submitAnswer = useCallback((dir: RushDirection) => {
    const s = stateRef.current;
    if (!s || s.pending || s.phase !== 'playing') return;

    const answerResult = rushAnswer(s, dir);
    rushApplyResult(s, answerResult.result);
    stateRef.current = { ...s };
    setState({ ...s });
  }, []);

  const pause = useCallback(() => {
    if (stateRef.current) {
      stateRef.current.phase = 'paused';
      setState({ ...stateRef.current });
    }
  }, []);

  const resume = useCallback(() => {
    if (stateRef.current) {
      stateRef.current.phase = 'playing';
      if (!stateRef.current.stimulus) {
        rushNextStimulus(stateRef.current);
      }
      setState({ ...stateRef.current });
    }
  }, []);

  const restart = useCallback(() => {
    if (stateRef.current) {
      startGame(stateRef.current.mode, stateRef.current.config);
    }
  }, [startGame]);

  const isPlaying = useMemo(() => state.phase === 'playing', [state.phase]);

  // Persist scores to localStorage on every change
  useEffect(() => {
    const s = state;
    if (!s) return;
    try {
      const key = `${s.mode}.scores.v1`;
      const stored = JSON.parse(localStorage.getItem(key) || '{"correct":0,"incorrect":0,"total":0}');
      const merged = {
        correct: (stored.correct ?? 0) + (s.history?.filter((r) => r.correct).length ?? 0),
        incorrect: (stored.incorrect ?? 0) + (s.history?.filter((r) => !r.correct).length ?? 0),
        total: (stored.total ?? 0) + s.history.length,
      };
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {
      /* silent */
    }
  }, [state]);

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
