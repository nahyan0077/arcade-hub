import { describe, it, expect } from 'vitest';
import {
  chooseMove,
  getBestMove,
  getMoveScores,
  PERSONALITIES,
  type Rng,
} from '../ai';
import { getAvailableMoves, makeMove, startGame, createInitialState } from '../core';
import type { AIDifficulty, Board } from '../types';

function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIFFICULTIES: AIDifficulty[] = ['easy', 'medium', 'hard', 'impossible'];

describe('AI personalities', () => {
  it('defines a personality with a unique permutation of squares for every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const personality = PERSONALITIES[difficulty];
      expect(personality.name).toBeTruthy();
      expect([...personality.preferredSquares].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it('gives each difficulty a distinct display name', () => {
    const names = DIFFICULTIES.map((d) => PERSONALITIES[d].name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('chooseMove', () => {
  it('throws on a full board', () => {
    const full: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(() =>
      chooseMove(full, { difficulty: 'easy', aiMark: 'X', rng: mulberry32(1) }),
    ).toThrow(/no free cells/);
  });

  it('always returns a legal move for every difficulty', () => {
    const board: Board = ['X', 0, 'O', 0, 'X', 0, 0, 0, 'O'];
    for (const difficulty of DIFFICULTIES) {
      const move = chooseMove(board, { difficulty, aiMark: 'O', rng: mulberry32(7) });
      expect(board[move]).toBe(0);
    }
  });
});

describe('easy difficulty', () => {
  it('is deterministic for a given seed', () => {
    const board: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const first = chooseMove(board, { difficulty: 'easy', aiMark: 'X', rng: mulberry32(42) });
    const second = chooseMove(board, { difficulty: 'easy', aiMark: 'X', rng: mulberry32(42) });
    expect(first).toBe(second);
  });

  it('can choose non-optimal moves', () => {
    const board: Board = ['X', 'X', 0, 'O', 'O', 0, 0, 0, 0];
    const choices = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      choices.add(chooseMove(board, { difficulty: 'easy', aiMark: 'O', rng: mulberry32(seed) }));
    }
    expect(choices.has(2)).toBe(true);
    expect(choices.size).toBeGreaterThan(1);
  });
});

describe('medium difficulty', () => {
  it('takes an immediate win', () => {
    const board: Board = ['O', 'O', 0, 'X', 'X', 0, 0, 0, 0];
    const move = chooseMove(board, { difficulty: 'medium', aiMark: 'O', rng: mulberry32(1) });
    expect(move).toBe(2);
  });

  it('blocks an immediate loss', () => {
    const board: Board = ['X', 'X', 0, 'O', 0, 0, 0, 0, 'O'];
    const move = chooseMove(board, { difficulty: 'medium', aiMark: 'O', rng: mulberry32(1) });
    expect(move).toBe(2);
  });

  it('prefers the center on an empty board', () => {
    const board: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 10; seed++) {
      const move = chooseMove(board, { difficulty: 'medium', aiMark: 'X', rng: mulberry32(seed) });
      expect(move).toBe(4);
    }
  });
});

describe('hard difficulty', () => {
  it('finds a winning move', () => {
    const board: Board = ['X', 'X', 0, 'O', 'O', 0, 0, 0, 0];
    const move = chooseMove(board, { difficulty: 'hard', aiMark: 'X', rng: mulberry32(1) });
    expect(move).toBe(2);
  });

  it('blocks a losing threat', () => {
    const board: Board = ['X', 'X', 0, 'O', 0, 0, 0, 0, 'O'];
    const move = chooseMove(board, { difficulty: 'hard', aiMark: 'O', rng: mulberry32(1) });
    expect(move).toBe(2);
  });
});

describe('impossible difficulty', () => {
  it('never loses as second player against random play', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed);
      let state = startGame(createInitialState());
      while (state.phase === 'playing') {
        if (state.currentPlayer === 'X') {
          const moves = getAvailableMoves(state.board);
          state = makeMove(state, moves[Math.floor(rng() * moves.length)]);
        } else {
          state = makeMove(
            state,
            chooseMove(state.board, { difficulty: 'impossible', aiMark: 'O', rng }),
          );
        }
      }
      if (state.result?.type === 'win') {
        expect(state.result.player, `seed ${seed}`).toBe('O');
      }
    }
  }, 30_000);

  it('never loses as first player against random play', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed);
      let state = startGame(createInitialState());
      while (state.phase === 'playing') {
        if (state.currentPlayer === 'X') {
          state = makeMove(
            state,
            chooseMove(state.board, { difficulty: 'impossible', aiMark: 'X', rng }),
          );
        } else {
          const moves = getAvailableMoves(state.board);
          state = makeMove(state, moves[Math.floor(rng() * moves.length)]);
        }
      }
      if (state.result?.type === 'win') {
        expect(state.result.player, `seed ${seed}`).toBe('X');
      }
    }
  }, 30_000);

  it('always draws against another impossible player', () => {
    let state = startGame(createInitialState());
    let plies = 0;
    while (state.phase === 'playing' && plies < 9) {
      const rng = mulberry32(1000 + plies);
      state = makeMove(
        state,
        chooseMove(state.board, {
          difficulty: 'impossible',
          aiMark: state.currentPlayer,
          rng,
        }),
      );
      plies++;
    }
    expect(state.result?.type).toBe('draw');
  }, 30_000);
});

describe('coach scoring', () => {
  it('returns null for occupied cells', () => {
    const board: Board = ['X', 0, 0, 0, 0, 0, 0, 0, 0];
    const scores = getMoveScores(board, 'O');
    expect(scores[0]).toBeNull();
    expect(scores.slice(1).every((s) => typeof s === 'number')).toBe(true);
  });

  it('scores an immediate win higher than any other move', () => {
    const board: Board = ['X', 'X', 0, 'O', 'O', 0, 0, 0, 0];
    const scores = getMoveScores(board, 'X');
    expect(scores[2]).toBe(10);
    scores.forEach((score, index) => {
      if (index !== 2 && score !== null) {
        expect(score).toBeLessThan(10);
      }
    });
  });

  it('getBestMove returns the winning cell', () => {
    const board: Board = ['X', 'X', 0, 'O', 'O', 0, 0, 0, 0];
    expect(getBestMove(board, 'X')).toBe(2);
  });

  it('getBestMove returns null on a full board', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(getBestMove(board, 'X')).toBeNull();
  });

  it('getBestMove returns the maximum-scoring move', () => {
    const boards: Board[] = [
      ['X', 0, 0, 0, 'O', 0, 0, 0, 0],
      [0, 'X', 0, 0, 'O', 0, 0, 0, 'O'],
      ['O', 'X', 'X', 0, 0, 0, 0, 0, 'O'],
    ];
    for (const board of boards) {
      const scores = getMoveScores(board, 'X');
      const best = getBestMove(board, 'X');
      expect(best).not.toBeNull();
      const numeric = scores.filter((s): s is number => s !== null);
      expect(scores[best as number]).toBe(Math.max(...numeric));
    }
  });

  it('scores a fresh opening as a draw with perfect play', () => {
    const empty: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const scores = getMoveScores(empty, 'X');
    const best = getBestMove(empty, 'X');
    expect(scores[best as number]).toBe(0);
  });
});