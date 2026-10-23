import { describe, expect, it } from 'vitest';
import { c4ChooseMove } from '../ai';
import { c4GetOpenColumns, c4MakeMove, c4StartGame, createC4InitialState } from '../core';
import type { C4GameState } from '../types';

function play(cols: number[]): C4GameState {
  return cols.reduce((state, col) => c4MakeMove(state, col), c4StartGame(createC4InitialState()));
}

function emptyBoard(): C4GameState['board'] {
  return createC4InitialState().board;
}

describe('connect-four AI', () => {
  it('easy picks an open column via the rng', () => {
    expect(c4ChooseMove(emptyBoard(), { difficulty: 'easy', aiMark: 'X', rng: () => 0 })).toBe(0);
    expect(c4ChooseMove(emptyBoard(), { difficulty: 'easy', aiMark: 'X', rng: () => 0.999 })).toBe(6);
  });

  it('medium opens at the center', () => {
    expect(c4ChooseMove(emptyBoard(), { difficulty: 'medium', aiMark: 'O' })).toBe(3);
  });

  it('medium takes an immediate win', () => {
    // X stacks col 2 while O plays away; it is X's turn with a live win.
    const state = play([2, 6, 2, 5, 2, 6]);
    expect(state.currentPlayer).toBe('X');
    expect(c4ChooseMove(state.board, { difficulty: 'medium', aiMark: 'X' })).toBe(2);
  });

  it('medium blocks an immediate threat', () => {
    const state = play([2, 6, 2, 5, 2]);
    expect(state.currentPlayer).toBe('O');
    expect(c4ChooseMove(state.board, { difficulty: 'medium', aiMark: 'O' })).toBe(2);
  });

  it('hard takes wins and blocks threats', () => {
    const winSetup = play([2, 6, 2, 5, 2, 6]);
    expect(c4ChooseMove(winSetup.board, { difficulty: 'hard', aiMark: 'X' })).toBe(2);

    const blockSetup = play([2, 6, 2, 5, 2]);
    expect(c4ChooseMove(blockSetup.board, { difficulty: 'hard', aiMark: 'O' })).toBe(2);
  });

  it('hard never picks a full column and never loses to random play', () => {
    let seed = 7;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };

    for (let game = 0; game < 20; game++) {
      let state = c4StartGame(createC4InitialState());
      while (state.phase === 'playing') {
        const open = c4GetOpenColumns(state.board);
        if (state.currentPlayer === 'X') {
          state = c4MakeMove(state, open[Math.floor(rng() * open.length)]);
        } else {
          const col = c4ChooseMove(state.board, {
            difficulty: 'hard',
            aiMark: 'O',
            rng,
          });
          expect(open).toContain(col);
          state = c4MakeMove(state, col);
        }
      }
      expect(state.result?.type === 'win' && state.result.player === 'X').toBe(false);
    }
  });
});
