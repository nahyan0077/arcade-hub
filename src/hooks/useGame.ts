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
import type { RoomSession } from '../net/RoomSession';

const DEFAULT_AI_DELAY_MS = 600;

export interface AITurnOptions {
  humanMark?: Player;
  aiDelayMs?: number;
  session?: RoomSession | null;
}

export function useGame(
  config: Partial<GameConfig> = {},
  options: AITurnOptions = {},
) {
  const session = options.session ?? null;

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
    if (session) return;
    saveScores({ X: scoreX, O: scoreO, draws });
  }, [scoreX, scoreO, draws, session]);

  useEffect(() => {
    if (!session) return;

    let previousMoves = session.getSnapshot().state.moveHistory.length;
    setState(session.getSnapshot().state);

    return session.subscribe((snapshot) => {
      const history = snapshot.state.moveHistory;
      if (history.length > previousMoves) {
        if (snapshot.state.result?.type === 'win') {
          playEffect('win');
        } else if (snapshot.state.result?.type === 'draw') {
          playEffect('draw');
        } else {
          playEffect(history[history.length - 1].player === 'X' ? 'place-x' : 'place-o');
        }
      }
      previousMoves = history.length;
      setState(snapshot.state);
    });
  }, [session]);

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
      if (session) {
        const accepted = session.playMove(index);
        if (!accepted) {
          playEffect('invalid');
        }
        return accepted;
      }

      const current = stateRef.current;
      if (!isValidMove(current, index)) {
        playEffect('invalid');
        return false;
      }
      applyMove(index);
      return true;
    },
    [applyMove, session],
  );

  const humanMark = options.humanMark ?? 'X';
  const aiDelayMs = options.aiDelayMs ?? DEFAULT_AI_DELAY_MS;
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
    if (session) {
      session.requestRematch();
      return;
    }
    const next = restartGame(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, [session]);

  const resetMatch = useCallback(() => {
    if (session) {
      session.leave();
      return;
    }
    const next = startGame(newGame(stateRef.current));
    stateRef.current = next;
    setState(next);
  }, [session]);

  return { state, playMove, rematch, resetMatch };
}