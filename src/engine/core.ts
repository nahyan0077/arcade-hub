import {
  Board,
  Player,
  GameResult,
  WinLine,
  GameState,
  GameConfig,
  Move,
  WINNING_COMBINATIONS,
  INITIAL_BOARD,
  DEFAULT_CONFIG,
} from './types';

export function createInitialState(config: Partial<GameConfig> = {}): GameState {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  return {
    board: [...INITIAL_BOARD],
    currentPlayer: mergedConfig.startingPlayer,
    phase: 'waiting',
    result: null,
    scores: { X: 0, O: 0 },
    mode: mergedConfig.mode,
    aiDifficulty: mergedConfig.aiDifficulty,
    playerNames: mergedConfig.playerNames,
    moveHistory: [],
  };
}

export function checkWin(board: Board): GameResult {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    const value = board[a];
    if (value !== 0 && value === board[b] && value === board[c]) {
      const player = value as Player;
      let line: WinLine;
      
      if (a === 0 && b === 1 && c === 2) line = { type: 'row', index: 0 };
      else if (a === 3 && b === 4 && c === 5) line = { type: 'row', index: 1 };
      else if (a === 6 && b === 7 && c === 8) line = { type: 'row', index: 2 };
      else if (a === 0 && b === 3 && c === 6) line = { type: 'col', index: 0 };
      else if (a === 1 && b === 4 && c === 7) line = { type: 'col', index: 1 };
      else if (a === 2 && b === 5 && c === 8) line = { type: 'col', index: 2 };
      else if (a === 0 && b === 4 && c === 8) line = { type: 'diag', direction: 'main' };
      else line = { type: 'diag', direction: 'anti' };

      return { type: 'win', player, line };
    }
  }

  if (board.every(cell => cell !== 0)) {
    return { type: 'draw' };
  }

  return { type: 'ongoing' };
}

export function getWinningLineIndices(line: WinLine): number[] {
  switch (line.type) {
    case 'row':
      return [line.index * 3, line.index * 3 + 1, line.index * 3 + 2];
    case 'col':
      return [line.index, line.index + 3, line.index + 6];
    case 'diag':
      return line.direction === 'main' ? [0, 4, 8] : [2, 4, 6];
  }
}

export function makeMove(state: GameState, index: number): GameState {
  if (state.phase !== 'playing') return state;
  if (state.board[index] !== 0) return state;

  const newBoard = [...state.board];
  newBoard[index] = state.currentPlayer;

  const move: Move = {
    index,
    player: state.currentPlayer,
    timestamp: Date.now(),
    boardBefore: state.board,
  };

  const result = checkWin(newBoard);
  const isFinished = result.type !== 'ongoing';
  const nextPlayer = state.currentPlayer === 'X' ? 'O' : 'X';

  const newScores = { ...state.scores };
  if (result.type === 'win') {
    newScores[result.player]++;
  }

  return {
    ...state,
    board: newBoard,
    currentPlayer: isFinished ? state.currentPlayer : nextPlayer,
    phase: isFinished ? 'finished' : 'playing',
    result,
    scores: newScores,
    moveHistory: [...state.moveHistory, move],
  };
}

export function startGame(state: GameState): GameState {
  if (state.phase === 'playing') return state;
  return { ...state, phase: 'playing' };
}

export function restartGame(state: GameState): GameState {
  const newStartingPlayer = state.result?.type === 'win' 
    ? (state.result.player === 'X' ? 'O' : 'X')
    : state.moveHistory.length % 2 === 0 ? 'X' : 'O';

  return {
    ...state,
    board: [...INITIAL_BOARD],
    currentPlayer: newStartingPlayer,
    phase: 'playing',
    result: null,
    moveHistory: [],
  };
}

export function newGame(state: GameState): GameState {
  return createInitialState({
    mode: state.mode,
    aiDifficulty: state.aiDifficulty,
    playerNames: state.playerNames,
    startingPlayer: 'X',
  });
}

export function getAvailableMoves(board: Board): number[] {
  return board
    .map((cell, index) => (cell === 0 ? index : -1))
    .filter(index => index !== -1);
}

export function isValidMove(state: GameState, index: number): boolean {
  return state.phase === 'playing' && state.board[index] === 0;
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState {
  return JSON.parse(json);
}