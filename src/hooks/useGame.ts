import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chooseMove,
  createInitialState,
  makeMove,
  newGame,
  restartGame,
  startGame,
  isValidMove,
} from '../engine';
import type { GameConfig, GameState, Player } from '../engine';
import { loadScores, saveScores } from '../storage/scores';
import { playEffect } from '../sound/audio';

const DEFAULT_AI_DELAY_MS = 600;

export interface AITurnOptions {
  humanMark?: Player;
  aiDelayMs?: number;
}

export function useGame(
  config: Partial<GameConfig> = {},
  aiOptions: AITurnOptions = {},
) {
  const [state, setState] = useState<GameState>(() => {
    const initial = createInitialState(config);
    const persisted = loadScores();
    const withScores: GameState = {
      ...initial,
      scores: { X: persisted.X, O: persisted.O },
      draws: persisted.draws,
    };
    return startGame(withScores);
  });

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const scoreX = state.scores.X;
  const scoreO = state.scores.O;
  const draws = state.draws;
  useEffect(() => {
    saveScores({ X: scoreX, O: scoreO, draws });
  }, [scoreX, scoreO, draws]);

  const applyMove = useCallback((index: number) => {
    const current = stateRef.current;
    const next = makeMove(current, index);
    if (next.result?.type === 'win') {
      playEffect('win');
    } else if (next.result?.type === 'draw') {
      playEffect('draw');
    } else {
      playEffect(current.currentPlayer === 'X' ? 'place-x' : 'place-o');
    }

    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const playMove = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (!isValidMove(current, index)) {
        playEffect('invalid');
        return false;
      }
      applyMove(index);
      return true;
    },
    [applyMove],
  );

  const humanMark = aiOptions.humanMark ?? 'X';
  const aiDelayMs = aiOptions.aiDelayMs ?? DEFAULT_AI_DELAY_MS;
  const aiMark: Player | null =
    state.mode === 'pve' ? (humanMark === 'X' ? 'O' : 'X') : null;

  useEffect(() => {
    if (aiMark === null) return;
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.currentPlayer !== aiMark) return;

    const timer = setTimeout(() => {
      const latest = stateRef.current;
      if (latest.phase !== 'playing' || latest.currentPlayer !== aiMark) return;
      const move = chooseMove(latest.board, {
        difficulty: latest.aiDifficulty,
        aiMark,
        rng: Math.random,
      });
      applyMove(move);
    }, aiDelayMs);

    return () => clearTimeout(timer);
  }, [state.phase, state.currentPlayer, state.mode, aiMark, aiDelayMs, applyMove]);

  const rematch = useCallback(() => {
    const next = restartGame(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const resetMatch = useCallback(() => {
    const next = startGame(newGame(stateRef.current));
    stateRef.current = next;
    setState(next);
  }, []);

  return { state, playMove, rematch, resetMatch };
}