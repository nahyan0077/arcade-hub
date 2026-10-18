export type Player = 'X' | 'O';
export type CellValue = Player | 0;
export type Board = CellValue[];

export type GamePhase = 'waiting' | 'playing' | 'finished';

export type GameResult = 
  | { type: 'win'; player: Player; line: WinLine }
  | { type: 'draw' }
  | { type: 'ongoing' };

export type WinLine = 
  | { type: 'row'; index: 0 | 1 | 2 }
  | { type: 'col'; index: 0 | 1 | 2 }
  | { type: 'diag'; direction: 'main' | 'anti' };

export type GameMode = 'pvp' | 'pve';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

export const AIDIFFICULTIES: readonly AIDifficulty[] = [
  'easy',
  'medium',
  'hard',
  'impossible',
] as const;

export interface GameState {
  board: Board;
  currentPlayer: Player;
  phase: GamePhase;
  result: GameResult | null;
  scores: Record<Player, number>;
  draws: number;
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  playerNames: Record<Player, string>;
  moveHistory: Move[];
}

export interface Move {
  index: number;
  player: Player;
  timestamp: number;
  boardBefore: Board;
}

export interface GameConfig {
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  playerNames: Record<Player, string>;
  startingPlayer: Player;
}

export const WINNING_COMBINATIONS: readonly number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

export const INITIAL_BOARD: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export const DEFAULT_CONFIG: GameConfig = {
  mode: 'pvp',
  aiDifficulty: 'medium',
  playerNames: { X: 'Player X', O: 'Player O' },
  startingPlayer: 'X',
};