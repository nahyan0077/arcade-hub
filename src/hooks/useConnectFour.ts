import { useCallback, useEffect, useRef, useState } from 'react';
import { c4ChooseMove } from '../engine/connect-four/ai';
import {
  c4IsValidMove,
  c4MakeMove,
  c4NewGame,
  c4RestartGame,
  c4StartGame,
  createC4InitialState,
} from '../engine/connect-four/core';
import type { C4GameConfig, C4GameState } from '../engine/connect-four/types';
import { C4_SCORES_KEY, loadScores, saveScores } from '../storage/scores';
import { playEffect } from '../sound/audio';
import type { Player } from '../engine';
import { resultSoundEffect } from './useGame';

const DEFAULT_AI_DELAY_MS = 600;

export interface C4AITurnOptions {
  aiDelayMs?: number;
}

export function useConnectFour(
  config: Partial<C4GameConfig> = {},
  options: C4AITurnOptions = {},
) {
  const [state, setState] = useState<C4GameState>(() => {
    const initial = createC4InitialState(config);
    const persisted = loadScores(C4_SCORES_KEY);
    const withScores: C4GameState = {
      ...initial,
      scores: { X: persisted.X, O: persisted.O },
      draws: persisted.draws,
    };
    return c4StartGame(withScores);
  });

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const scoreX = state.scores.X;
  const scoreO = state.scores.O;
  const draws = state.draws;
  useEffect(() => {
    saveScores({ X: scoreX, O: scoreO, draws }, C4_SCORES_KEY);
  }, [scoreX, scoreO, draws]);

  const aiDelayMs = options.aiDelayMs ?? DEFAULT_AI_DELAY_MS;
  const humanMark: Player = 'X';
  const aiMark: Player | null = state.mode === 'pve' ? 'O' : null;

  const applyMove = useCallback(
    (col: number) => {
      const current = stateRef.current;
      const next = c4MakeMove(current, col);
      if (next.result?.type === 'win') {
        playEffect(resultSoundEffect(next.result.player, aiMark === null ? null : humanMark));
      } else if (next.result?.type === 'draw') {
        playEffect('draw');
      } else {
        playEffect(current.currentPlayer === 'X' ? 'place-x' : 'place-o');
      }

      stateRef.current = next;
      setState(next);
      return next;
    },
    [aiMark],
  );

  const playMove = useCallback(
    (col: number) => {
      const current = stateRef.current;
      if (!c4IsValidMove(current, col)) {
        playEffect('invalid');
        return false;
      }
      applyMove(col);
      return true;
    },
    [applyMove],
  );

  useEffect(() => {
    if (aiMark === null) return;
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.currentPlayer !== aiMark) return;

    const timer = setTimeout(() => {
      const latest = stateRef.current;
      if (latest.phase !== 'playing' || latest.currentPlayer !== aiMark) return;
      const move = c4ChooseMove(latest.board, {
        difficulty: latest.aiDifficulty,
        aiMark,
        rng: Math.random,
      });
      applyMove(move);
    }, aiDelayMs);

    return () => clearTimeout(timer);
  }, [state.phase, state.currentPlayer, state.mode, aiMark, aiDelayMs, applyMove]);

  const rematch = useCallback(() => {
    const next = c4RestartGame(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const resetMatch = useCallback(() => {
    const next = c4StartGame(c4NewGame(stateRef.current));
    stateRef.current = next;
    setState(next);
  }, []);

  return { state, playMove, rematch, resetMatch };
}
