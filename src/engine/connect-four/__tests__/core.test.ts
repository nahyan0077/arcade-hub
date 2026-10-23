import { describe, expect, it } from 'vitest';
import {
  c4CheckWin,
  c4GetOpenColumns,
  c4DropRow,
  c4IsValidMove,
  c4MakeMove,
  c4NewGame,
  c4RestartGame,
  c4StartGame,
  createC4InitialState,
} from '../core';
import type { C4GameState } from '../types';
import { C4_COLS } from '../types';

function play(start: C4GameState, cols: number[]): C4GameState {
  return cols.reduce((state, col) => c4MakeMove(state, col), c4StartGame(start));
}

describe('connect-four core', () => {
  it('starts with an empty board and X to move', () => {
    const state = createC4InitialState();
    expect(state.board.every((cell) => cell === 0)).toBe(true);
    expect(state.currentPlayer).toBe('X');
    expect(state.phase).toBe('waiting');
    expect(c4StartGame(state).phase).toBe('playing');
  });

  it('stacks discs in a column from the bottom up', () => {
    const state = play(createC4InitialState(), [0, 0]);
    expect(state.board[0 * C4_COLS + 0]).toBe('X');
    expect(state.board[1 * C4_COLS + 0]).toBe('O');
    expect(state.board[2 * C4_COLS + 0]).toBe(0);
    expect(state.moveHistory.map((move) => move.index)).toEqual([0, 0]);
  });

  it('rejects out-of-range, full-column, and inactive moves', () => {
    const playing = c4StartGame(createC4InitialState());
    expect(c4IsValidMove(playing, -1)).toBe(false);
    expect(c4IsValidMove(playing, 7)).toBe(false);
    expect(c4IsValidMove(playing, 1.5)).toBe(false);
    expect(c4MakeMove(playing, -1)).toBe(playing);

    const full = play(createC4InitialState(), [0, 0, 0, 0, 0, 0]);
    expect(c4DropRow(full.board, 0)).toBeNull();
    expect(c4GetOpenColumns(full.board)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(c4IsValidMove(full, 0)).toBe(false);

    const waiting = createC4InitialState();
    expect(c4IsValidMove(waiting, 0)).toBe(false);
  });

  it('detects a vertical win and freezes the game', () => {
    const state = play(createC4InitialState(), [0, 1, 0, 1, 0, 1, 0]);
    expect(state.result).toEqual({
      type: 'win',
      player: 'X',
      line: { cells: [0, 7, 14, 21] },
    });
    expect(state.phase).toBe('finished');
    expect(state.scores.X).toBe(1);
    const frozen = c4MakeMove(state, 2);
    expect(frozen).toBe(state);
  });

  it('detects a horizontal win along the bottom row', () => {
    const state = play(createC4InitialState(), [0, 6, 1, 6, 2, 6, 3]);
    expect(state.result).toEqual({
      type: 'win',
      player: 'X',
      line: { cells: [0, 1, 2, 3] },
    });
  });

  it('detects a rising main-diagonal win', () => {
    const state = play(createC4InitialState(), [
      0, 6, 1, 6, 1, 2, 6, 2, 2, 3, 4, 3, 6, 4, 3, 4, 3,
    ]);
    expect(state.result).toEqual({
      type: 'win',
      player: 'X',
      line: { cells: [0, 8, 16, 24] },
    });
  });

  it('detects a falling anti-diagonal win', () => {
    const state = play(createC4InitialState(), [
      3, 0, 2, 1, 2, 1, 6, 6, 1, 6, 6, 4, 0, 4, 0, 4, 0,
    ]);
    expect(state.result).toEqual({
      type: 'win',
      player: 'X',
      line: { cells: [3, 9, 15, 21] },
    });
  });

  it('flags a full board without a four-run as a draw', () => {
    expect(c4CheckWin(Array(42).fill(0), 0)).toEqual({ type: 'ongoing' });

    // Tiling draw: X iff (row + 2*col) mod 4 < 2 — every horizontal, vertical,
    // and diagonal 4-window contains exactly two discs of each player.
    const board = Array.from({ length: 42 }, (_, index) => {
      const row = Math.floor(index / C4_COLS);
      const col = index % C4_COLS;
      return (row + 2 * col) % 4 < 2 ? 'X' : 'O';
    });
    for (let cell = 0; cell < 42; cell++) {
      expect(c4CheckWin(board, cell)).toEqual({ type: 'draw' });
    }
  });

  it('random legal playouts always terminate with consistent state', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };

    for (let game = 0; game < 100; game++) {
      let state = c4StartGame(createC4InitialState());
      while (state.phase === 'playing') {
        const open = c4GetOpenColumns(state.board);
        state = c4MakeMove(state, open[Math.floor(rng() * open.length)]);
      }
      const marks = state.board.filter((cell) => cell !== 0).length;
      expect(marks).toBe(state.moveHistory.length);
      expect(['win', 'draw']).toContain(state.result?.type);
      if (state.result?.type === 'draw') {
        expect(marks).toBe(42);
        // Draws always end after 42 (even) moves, so the parity branch serves X.
        expect(c4RestartGame(state).currentPlayer).toBe('X');
      }
    }
  });

  it('restarts with the loser serving and preserves scores', () => {
    const afterWin = play(createC4InitialState(), [0, 1, 0, 1, 0, 1, 0]);
    const restarted = c4RestartGame(afterWin);
    expect(restarted.currentPlayer).toBe('O');
    expect(restarted.board.every((cell) => cell === 0)).toBe(true);
    expect(restarted.phase).toBe('playing');
    expect(restarted.scores).toEqual({ X: 1, O: 0 });
  });

  it('newGame wipes scores and resets to defaults', () => {
    const state = play(createC4InitialState(), [0, 1, 0, 1, 0, 1, 0]);
    const fresh = c4NewGame(state);
    expect(fresh.scores).toEqual({ X: 0, O: 0 });
    expect(fresh.draws).toBe(0);
    expect(fresh.phase).toBe('waiting');
    expect(fresh.board.every((cell) => cell === 0)).toBe(true);
  });
});
