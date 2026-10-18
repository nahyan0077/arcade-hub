import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  checkWin,
  getWinningLineIndices,
  makeMove,
  startGame,
  restartGame,
  newGame,
  getAvailableMoves,
  isValidMove,
  serializeState,
  deserializeState,
  WINNING_COMBINATIONS,
  INITIAL_BOARD,
  DEFAULT_CONFIG,
} from '../index';
import type { GameState, Board } from '../types';

describe('Engine Types & Constants', () => {
  it('WINNING_COMBINATIONS has 8 combinations', () => {
    expect(WINNING_COMBINATIONS).toHaveLength(8);
  });

  it('INITIAL_BOARD is all zeros', () => {
    expect(INITIAL_BOARD).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('DEFAULT_CONFIG has correct defaults', () => {
    expect(DEFAULT_CONFIG.mode).toBe('pvp');
    expect(DEFAULT_CONFIG.aiDifficulty).toBe('medium');
    expect(DEFAULT_CONFIG.startingPlayer).toBe('X');
  });
});

describe('createInitialState', () => {
  it('creates state with defaults', () => {
    const state = createInitialState();
    expect(state.board).toEqual(INITIAL_BOARD);
    expect(state.currentPlayer).toBe('X');
    expect(state.phase).toBe('waiting');
    expect(state.result).toBeNull();
    expect(state.scores).toEqual({ X: 0, O: 0 });
    expect(state.mode).toBe('pvp');
    expect(state.moveHistory).toEqual([]);
  });

  it('accepts custom config', () => {
    const state = createInitialState({ 
      mode: 'pve', 
      aiDifficulty: 'hard',
      playerNames: { X: 'Human', O: 'AI' },
      startingPlayer: 'O',
    });
    expect(state.mode).toBe('pve');
    expect(state.aiDifficulty).toBe('hard');
    expect(state.playerNames).toEqual({ X: 'Human', O: 'AI' });
    expect(state.currentPlayer).toBe('O');
  });
});

describe('checkWin', () => {
  it('detects row wins', () => {
    const board: Board = ['X', 'X', 'X', 0, 'O', 0, 0, 0, 'O'];
    const result = checkWin(board);
    expect(result).toEqual({ type: 'win', player: 'X', line: { type: 'row', index: 0 } });
  });

  it('detects column wins', () => {
    const board: Board = ['O', 'X', 0, 'O', 'X', 0, 'O', 0, 'X'];
    const result = checkWin(board);
    expect(result).toEqual({ type: 'win', player: 'O', line: { type: 'col', index: 0 } });
  });

  it('detects main diagonal win', () => {
    const board: Board = ['X', 'O', 0, 'O', 'X', 0, 0, 0, 'X'];
    const result = checkWin(board);
    expect(result).toEqual({ type: 'win', player: 'X', line: { type: 'diag', direction: 'main' } });
  });

  it('detects anti diagonal win', () => {
    const board: Board = [0, 'O', 'X', 0, 'X', 0, 'X', 0, 'O'];
    const result = checkWin(board);
    expect(result).toEqual({ type: 'win', player: 'X', line: { type: 'diag', direction: 'anti' } });
  });

  it('detects draw', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    const result = checkWin(board);
    expect(result).toEqual({ type: 'draw' });
  });

  it('returns ongoing for incomplete game', () => {
    const board: Board = ['X', 'O', 0, 0, 'X', 0, 0, 0, 'O'];
    const result = checkWin(board);
    expect(result).toEqual({ type: 'ongoing' });
  });

  it('returns ongoing for empty board', () => {
    const result = checkWin(INITIAL_BOARD);
    expect(result).toEqual({ type: 'ongoing' });
  });

  it('detects O wins correctly', () => {
    const board: Board = ['O', 'O', 'O', 'X', 'X', 0, 0, 0, 0];
    const result = checkWin(board);
    expect(result).toEqual({ type: 'win', player: 'O', line: { type: 'row', index: 0 } });
  });
});

describe('getWinningLineIndices', () => {
  it('returns correct indices for row', () => {
    expect(getWinningLineIndices({ type: 'row', index: 0 })).toEqual([0, 1, 2]);
    expect(getWinningLineIndices({ type: 'row', index: 1 })).toEqual([3, 4, 5]);
    expect(getWinningLineIndices({ type: 'row', index: 2 })).toEqual([6, 7, 8]);
  });

  it('returns correct indices for column', () => {
    expect(getWinningLineIndices({ type: 'col', index: 0 })).toEqual([0, 3, 6]);
    expect(getWinningLineIndices({ type: 'col', index: 1 })).toEqual([1, 4, 7]);
    expect(getWinningLineIndices({ type: 'col', index: 2 })).toEqual([2, 5, 8]);
  });

  it('returns correct indices for diagonals', () => {
    expect(getWinningLineIndices({ type: 'diag', direction: 'main' })).toEqual([0, 4, 8]);
    expect(getWinningLineIndices({ type: 'diag', direction: 'anti' })).toEqual([2, 4, 6]);
  });
});

describe('makeMove', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    state = startGame(state);
  });

  it('places mark on empty cell', () => {
    const newState = makeMove(state, 4);
    expect(newState.board[4]).toBe('X');
  });

  it('switches player after move', () => {
    const newState = makeMove(state, 0);
    expect(newState.currentPlayer).toBe('O');
  });

  it('adds move to history', () => {
    const newState = makeMove(state, 0);
    expect(newState.moveHistory).toHaveLength(1);
    expect(newState.moveHistory[0].index).toBe(0);
    expect(newState.moveHistory[0].player).toBe('X');
  });

  it('does not allow move on occupied cell', () => {
    let newState = makeMove(state, 0);
    newState = makeMove(newState, 0);
    expect(newState.board[0]).toBe('X');
    expect(newState.moveHistory).toHaveLength(1);
  });

  it('does not allow move when not playing', () => {
    const waitingState = createInitialState();
    const newState = makeMove(waitingState, 0);
    expect(newState.board[0]).toBe(0);
  });

  it('detects win and finishes game', () => {
    let newState = makeMove(state, 0); // X
    newState = makeMove(newState, 3); // O
    newState = makeMove(newState, 1); // X
    newState = makeMove(newState, 4); // O
    newState = makeMove(newState, 2); // X wins
    expect(newState.phase).toBe('finished');
    expect(newState.result).toMatchObject({ type: 'win', player: 'X' });
  });

  it('detects draw and finishes game', () => {
    const moves = [0, 1, 2, 3, 5, 4, 6, 8, 7]; // Draw sequence
    let newState = state;
    for (const move of moves) {
      newState = makeMove(newState, move);
    }
    expect(newState.phase).toBe('finished');
    expect(newState.result?.type).toBe('draw');
  });

  it('increments score on win', () => {
    let newState = makeMove(state, 0); // X
    newState = makeMove(newState, 3); // O
    newState = makeMove(newState, 1); // X
    newState = makeMove(newState, 4); // O
    newState = makeMove(newState, 2); // X wins
    expect(newState.scores.X).toBe(1);
    expect(newState.scores.O).toBe(0);
  });

  it('does not increment score on draw', () => {
    const moves = [0, 1, 2, 3, 5, 4, 6, 8, 7];
    let newState = state;
    for (const move of moves) {
      newState = makeMove(newState, move);
    }
    expect(newState.scores.X).toBe(0);
    expect(newState.scores.O).toBe(0);
  });

  it('stores boardBefore in move history', () => {
    const newState = makeMove(state, 4);
    expect(newState.moveHistory[0].boardBefore).toEqual(INITIAL_BOARD);
  });
});

describe('startGame', () => {
  it('changes phase from waiting to playing', () => {
    const state = createInitialState();
    const newState = startGame(state);
    expect(newState.phase).toBe('playing');
  });

  it('does nothing if already playing', () => {
    const state = startGame(createInitialState());
    const newState = startGame(state);
    expect(newState).toBe(state);
  });
});

describe('restartGame', () => {
  it('resets board and keeps scores', () => {
    let state = startGame(createInitialState());
    state = makeMove(state, 0);
    state = makeMove(state, 3);
    state = makeMove(state, 1);
    state = makeMove(state, 4);
    state = makeMove(state, 2); // X wins
    
    expect(state.scores.X).toBe(1);
    
    const newState = restartGame(state);
    expect(newState.board).toEqual(INITIAL_BOARD);
    expect(newState.phase).toBe('playing');
    expect(newState.result).toBeNull();
    expect(newState.moveHistory).toEqual([]);
    expect(newState.scores.X).toBe(1);
  });

  it('alternates starting player after win', () => {
    let state = startGame(createInitialState());
    state = makeMove(state, 0);
    state = makeMove(state, 3);
    state = makeMove(state, 1);
    state = makeMove(state, 4);
    state = makeMove(state, 2); // X wins
    
    const newState = restartGame(state);
    expect(newState.currentPlayer).toBe('O');
  });

  it('alternates starting player after draw', () => {
    const moves = [0, 1, 2, 3, 5, 4, 6, 8, 7];
    let state = startGame(createInitialState());
    for (const move of moves) {
      state = makeMove(state, move);
    }
    
    const newState = restartGame(state);
    expect(newState.currentPlayer).toBe('O');
  });
});

describe('newGame', () => {
  it('resets everything including scores', () => {
    let state = startGame(createInitialState());
    state = makeMove(state, 0);
    state = makeMove(state, 3);
    state = makeMove(state, 1);
    state = makeMove(state, 4);
    state = makeMove(state, 2); // X wins
    
    const newState = newGame(state);
    expect(newState.board).toEqual(INITIAL_BOARD);
    expect(newState.currentPlayer).toBe('X');
    expect(newState.phase).toBe('waiting');
    expect(newState.result).toBeNull();
    expect(newState.scores).toEqual({ X: 0, O: 0 });
    expect(newState.moveHistory).toEqual([]);
  });
});

describe('getAvailableMoves', () => {
  it('returns all indices for empty board', () => {
    expect(getAvailableMoves(INITIAL_BOARD)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('returns only empty cells', () => {
    const board: Board = ['X', 0, 'O', 0, 'X', 0, 'O', 0, 0];
    expect(getAvailableMoves(board)).toEqual([1, 3, 5, 7, 8]);
  });

  it('returns empty array for full board', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(getAvailableMoves(board)).toEqual([]);
  });
});

describe('isValidMove', () => {
  it('returns true for valid move', () => {
    const state = startGame(createInitialState());
    expect(isValidMove(state, 4)).toBe(true);
  });

  it('returns false for occupied cell', () => {
    let state = startGame(createInitialState());
    state = makeMove(state, 4);
    expect(isValidMove(state, 4)).toBe(false);
  });

  it('returns false when not playing', () => {
    const state = createInitialState();
    expect(isValidMove(state, 4)).toBe(false);
  });

  it('returns false when finished', () => {
    let state = startGame(createInitialState());
    state = makeMove(state, 0);
    state = makeMove(state, 3);
    state = makeMove(state, 1);
    state = makeMove(state, 4);
    state = makeMove(state, 2);
    expect(isValidMove(state, 5)).toBe(false);
  });
});

describe('serializeState / deserializeState', () => {
  it('round-trips state correctly', () => {
    let state = startGame(createInitialState({ mode: 'pve', aiDifficulty: 'hard' }));
    state = makeMove(state, 0);
    state = makeMove(state, 4);
    
    const json = serializeState(state);
    const restored = deserializeState(json);
    
    expect(restored).toEqual(state);
  });
});