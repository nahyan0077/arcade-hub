import type { Player } from '../types';
import type { C4Board, C4Difficulty } from './types';
import { C4_COLS, C4_PERSONALITIES } from './types';
import { c4CheckWin, c4DropRow, c4GetOpenColumns } from './core';

export type C4Rng = () => number;

export interface C4ChooseMoveOptions {
  difficulty: C4Difficulty;
  aiMark: Player;
  rng?: C4Rng;
}

const HARD_DEPTH_LIMIT = 4;
// Terminal wins must dominate evaluateWindows' range (~±4500), unlike the TT
// engine whose search has no static eval to compete with 10-depth.
const WIN_SCORE = 10_000;
const EVAL_WEIGHTS = [0, 1, 8, 64, 1000];

function opponentOf(mark: Player): Player {
  return mark === 'X' ? 'O' : 'X';
}

function dropOnBoard(board: C4Board, col: number, mark: Player): { board: C4Board; cell: number } | null {
  const row = c4DropRow(board, col);
  if (row === null) return null;
  const cell = row * C4_COLS + col;
  const next = [...board];
  next[cell] = mark;
  return { board: next, cell };
}

function wouldWin(board: C4Board, col: number, mark: Player): boolean {
  const dropped = dropOnBoard(board, col, mark);
  if (dropped === null) return false;
  return c4CheckWin(dropped.board, dropped.cell).type === 'win';
}

function evaluateWindows(board: C4Board, aiMark: Player): number {
  const opponent = opponentOf(aiMark);
  let score = 0;

  const windows: number[][] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      windows.push([0, 1, 2, 3].map((step) => row * C4_COLS + col + step));
    }
  }
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 3; row++) {
      windows.push([0, 1, 2, 3].map((step) => (row + step) * C4_COLS + col));
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      windows.push([0, 1, 2, 3].map((step) => (row + step) * C4_COLS + col + step));
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 3; col < 7; col++) {
      windows.push([0, 1, 2, 3].map((step) => (row + step) * C4_COLS + col - step));
    }
  }

  for (const window of windows) {
    let own = 0;
    let theirs = 0;
    for (const cell of window) {
      if (board[cell] === aiMark) own++;
      else if (board[cell] === opponent) theirs++;
    }
    if (theirs === 0) score += EVAL_WEIGHTS[own];
    if (own === 0) score -= EVAL_WEIGHTS[theirs];
  }

  return score;
}

function minimax(
  board: C4Board,
  lastCell: number,
  depth: number,
  isMaximizing: boolean,
  aiMark: Player,
  alpha: number,
  beta: number,
  depthLimit: number,
): number {
  const terminal = c4CheckWin(board, lastCell);
  if (terminal.type === 'win') {
    return terminal.player === aiMark ? WIN_SCORE - depth : depth - WIN_SCORE;
  }
  if (terminal.type === 'draw') return 0;
  if (depth >= depthLimit) return evaluateWindows(board, aiMark);

  const mark: Player = isMaximizing ? aiMark : opponentOf(aiMark);
  const open = c4GetOpenColumns(board);

  if (isMaximizing) {
    let best = Number.NEGATIVE_INFINITY;
    for (const col of open) {
      const dropped = dropOnBoard(board, col, mark);
      if (dropped === null) continue;
      best = Math.max(
        best,
        minimax(dropped.board, dropped.cell, depth + 1, false, aiMark, alpha, beta, depthLimit),
      );
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Number.POSITIVE_INFINITY;
  for (const col of open) {
    const dropped = dropOnBoard(board, col, mark);
    if (dropped === null) continue;
    best = Math.min(
      best,
      minimax(dropped.board, dropped.cell, depth + 1, true, aiMark, alpha, beta, depthLimit),
    );
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function tacticalMove(board: C4Board, aiMark: Player): number {
  const open = c4GetOpenColumns(board);

  const winning = open.find((col) => wouldWin(board, col, aiMark));
  if (winning !== undefined) return winning;

  const blocking = open.find((col) => wouldWin(board, col, opponentOf(aiMark)));
  if (blocking !== undefined) return blocking;

  const personality = C4_PERSONALITIES.medium;
  return open.reduce((best, col) =>
    personality.preferredColumns.indexOf(col) < personality.preferredColumns.indexOf(best)
      ? col
      : best,
  );
}

function scoredMove(board: C4Board, aiMark: Player, rng: C4Rng): number {
  const open = c4GetOpenColumns(board);
  const scores = open.map((col) => {
    const dropped = dropOnBoard(board, col, aiMark);
    if (dropped === null) return Number.NEGATIVE_INFINITY;
    return minimax(
      dropped.board,
      dropped.cell,
      0,
      false,
      aiMark,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      HARD_DEPTH_LIMIT,
    );
  });

  let bestScore = Number.NEGATIVE_INFINITY;
  for (const score of scores) {
    if (score > bestScore) bestScore = score;
  }
  const tied = open.filter((_, index) => scores[index] === bestScore);

  const personality = C4_PERSONALITIES.hard;
  const bestRank = Math.min(...tied.map((col) => personality.preferredColumns.indexOf(col)));
  const ranked = tied.filter(
    (col) => personality.preferredColumns.indexOf(col) === bestRank,
  );
  return ranked[Math.floor(rng() * ranked.length)];
}

export function c4ChooseMove(board: C4Board, options: C4ChooseMoveOptions): number {
  const rng = options.rng ?? Math.random;
  const open = c4GetOpenColumns(board);
  if (open.length === 0) {
    throw new Error('c4ChooseMove called on a full board');
  }

  switch (options.difficulty) {
    case 'easy':
      return open[Math.floor(rng() * open.length)];
    case 'medium':
      return tacticalMove(board, options.aiMark);
    case 'hard':
      return scoredMove(board, options.aiMark, rng);
  }
}
