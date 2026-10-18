import {
  AIDifficulty,
  Board,
  Player,
  WINNING_COMBINATIONS,
} from './types';
import { checkWin, getAvailableMoves } from './core';

export type Rng = () => number;

export interface AIPersonality {
  name: string;
  preferredSquares: number[];
}

export const PERSONALITIES: Record<AIDifficulty, AIPersonality> = {
  easy: { name: 'GLITCH', preferredSquares: [4, 0, 2, 6, 8, 1, 3, 5, 7] },
  medium: { name: 'SCOUT', preferredSquares: [4, 0, 2, 6, 8, 1, 3, 5, 7] },
  hard: { name: 'VANGUARD', preferredSquares: [0, 8, 2, 6, 4, 1, 3, 5, 7] },
  impossible: { name: 'NEMESIS', preferredSquares: [4, 0, 2, 6, 8, 1, 3, 5, 7] },
};

const UNLIMITED = Number.POSITIVE_INFINITY;

export interface ChooseMoveOptions {
  difficulty: AIDifficulty;
  aiMark: Player;
  rng?: Rng;
}

function opponentOf(mark: Player): Player {
  return mark === 'X' ? 'O' : 'X';
}

function terminalScore(board: Board, aiMark: Player, depth: number): number | null {
  const result = checkWin(board);
  if (result.type === 'win') {
    return result.player === aiMark ? 10 - depth : depth - 10;
  }
  if (result.type === 'draw') {
    return 0;
  }
  return null;
}

function evaluate(board: Board, aiMark: Player): number {
  const opponent = opponentOf(aiMark);
  const weights = [0, 1, 10, 100];
  let score = 0;

  for (const [a, b, c] of WINNING_COMBINATIONS) {
    const line = [board[a], board[b], board[c]];
    const own = line.filter((cell) => cell === aiMark).length;
    const theirs = line.filter((cell) => cell === opponent).length;
    if (theirs === 0) score += weights[own];
    if (own === 0) score -= weights[theirs];
  }

  return score;
}

function minimax(
  board: Board,
  depth: number,
  isMaximizing: boolean,
  aiMark: Player,
  alpha: number,
  beta: number,
  depthLimit: number,
): number {
  const terminal = terminalScore(board, aiMark, depth);
  if (terminal !== null) return terminal;
  if (depth >= depthLimit) return evaluate(board, aiMark);

  const mark: Player = isMaximizing ? aiMark : opponentOf(aiMark);
  const moves = getAvailableMoves(board);

  if (isMaximizing) {
    let best = Number.NEGATIVE_INFINITY;
    for (const move of moves) {
      board[move] = mark;
      best = Math.max(best, minimax(board, depth + 1, false, aiMark, alpha, beta, depthLimit));
      board[move] = 0;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Number.POSITIVE_INFINITY;
  for (const move of moves) {
    board[move] = mark;
    best = Math.min(best, minimax(board, depth + 1, true, aiMark, alpha, beta, depthLimit));
    board[move] = 0;
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function getMoveScoresFor(board: Board, mark: Player, depthLimit: number): (number | null)[] {
  const working = [...board];
  return working.map((cell, index) => {
    if (cell !== 0) return null;
    working[index] = mark;
    const score = minimax(working, 0, false, mark, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, depthLimit);
    working[index] = 0;
    return score;
  });
}

export function getMoveScores(board: Board, mark: Player): (number | null)[] {
  return getMoveScoresFor(board, mark, UNLIMITED);
}

export function getBestMove(board: Board, mark: Player): number | null {
  const scores = getMoveScores(board, mark);
  let best: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  scores.forEach((score, index) => {
    if (score !== null && score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function positionRank(square: number, personality: AIPersonality): number {
  const rank = personality.preferredSquares.indexOf(square);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function pickBest(ranked: number[], rng: Rng): number {
  const shuffled = [...ranked];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled[0];
}

function tacticalMove(board: Board, aiMark: Player, rng: Rng): number {
  const opponent = opponentOf(aiMark);
  const moves = getAvailableMoves(board);
  const winning = moves.find((move) => {
    board[move] = aiMark;
    const wins = checkWin(board).type === 'win';
    board[move] = 0;
    return wins;
  });
  if (winning !== undefined) return winning;

  const blocking = moves.find((move) => {
    board[move] = opponent;
    const wins = checkWin(board).type === 'win';
    board[move] = 0;
    return wins;
  });
  if (blocking !== undefined) return blocking;

  const personality = PERSONALITIES.medium;
  const bestRank = Math.min(...moves.map((move) => positionRank(move, personality)));
  return pickBest(
    moves.filter((move) => positionRank(move, personality) === bestRank),
    rng,
  );
}

function scoredMove(board: Board, options: ChooseMoveOptions, depthLimit: number, rng: Rng): number {
  const { aiMark, difficulty } = options;
  const personality = PERSONALITIES[difficulty];
  const scores = getMoveScoresFor(board, aiMark, depthLimit);

  let bestScore = Number.NEGATIVE_INFINITY;
  for (const score of scores) {
    if (score !== null && score > bestScore) bestScore = score;
  }

  const tied: number[] = [];
  scores.forEach((score, index) => {
    if (score === bestScore) tied.push(index);
  });

  const bestRank = Math.min(...tied.map((move) => positionRank(move, personality)));
  return pickBest(
    tied.filter((move) => positionRank(move, personality) === bestRank),
    rng,
  );
}

export function chooseMove(board: Board, options: ChooseMoveOptions): number {
  const rng = options.rng ?? Math.random;
  const moves = getAvailableMoves(board);
  if (moves.length === 0) {
    throw new Error('chooseMove called on a board with no free cells');
  }

  switch (options.difficulty) {
    case 'easy':
      return moves[Math.floor(rng() * moves.length)];
    case 'medium':
      return tacticalMove(board, options.aiMark, rng);
    case 'hard':
      return scoredMove(board, options, 4, rng);
    case 'impossible':
      return scoredMove(board, options, UNLIMITED, rng);
  }
}