import type { AIDifficulty, GameMode, Player } from '../types';

export const C4_COLS = 7;
export const C4_ROWS = 6;
export const C4_CELL_COUNT = C4_COLS * C4_ROWS;

/** Row-major: index = row * C4_COLS + col, row 0 is the bottom (gravity falls to low rows). */
export type C4Board = (Player | 0)[];

export type C4Phase = 'waiting' | 'playing' | 'finished';

/** Contiguous winning run of at least four cells (indices into the board). */
export interface C4WinLine {
  cells: number[];
}

export type C4GameResult =
  | { type: 'win'; player: Player; line: C4WinLine }
  | { type: 'draw' }
  | { type: 'ongoing' };

export interface C4Move {
  index: number;
  player: Player;
  timestamp: number;
  boardBefore: C4Board;
}

export interface C4GameState {
  board: C4Board;
  currentPlayer: Player;
  phase: C4Phase;
  result: C4GameResult | null;
  scores: Record<Player, number>;
  draws: number;
  mode: GameMode;
  aiDifficulty: C4Difficulty;
  playerNames: Record<Player, string>;
  moveHistory: C4Move[];
}

export interface C4GameConfig {
  mode: GameMode;
  aiDifficulty: C4Difficulty;
  playerNames: Record<Player, string>;
  startingPlayer: Player;
}

/** Connect Four has no full-minimax "impossible" tier — depth-limited hard is the cap. */
export type C4Difficulty = Exclude<AIDifficulty, 'impossible'>;

export const C4_DIFFICULTIES: readonly C4Difficulty[] = [
  'easy',
  'medium',
  'hard',
] as const;

export interface C4AIPersonality {
  name: string;
  preferredColumns: number[];
}

export const C4_PERSONALITIES: Record<C4Difficulty, C4AIPersonality> = {
  easy: { name: 'GLITCH', preferredColumns: [3, 2, 4, 1, 5, 0, 6] },
  medium: { name: 'SCOUT', preferredColumns: [3, 2, 4, 1, 5, 0, 6] },
  hard: { name: 'VANGUARD', preferredColumns: [3, 2, 4, 1, 5, 0, 6] },
};

export const C4_INITIAL_BOARD: C4Board = Array(C4_CELL_COUNT).fill(0);

export const C4_DEFAULT_CONFIG: C4GameConfig = {
  mode: 'pvp',
  aiDifficulty: 'medium',
  playerNames: { X: 'Player X', O: 'Player O' },
  startingPlayer: 'X',
};
