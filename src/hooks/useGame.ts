import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  makeMove,
  newGame,
  restartGame,
  startGame,
  isValidMove,
} from '../engine';
import type { GameConfig, GameState } from '../engine';
import { loadScores, saveScores } from '../storage/scores';
import { playEffect } from '../sound/audio';

export function useGame(config: Partial<GameConfig> = {}) {
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

  const playMove = useCallback((index: number) => {
    const current = stateRef.current;
    if (!isValidMove(current, index)) {
      playEffect('invalid');
      return false;
    }

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
    return true;
  }, []);

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