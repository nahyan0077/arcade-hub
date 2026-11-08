import React, { useState } from "react";
import type { C4Board, C4WinLine } from "../engine/connect-four/types";
import type { Player } from "../engine";
import { C4_COLS, C4_ROWS } from "../engine/connect-four/types";

const CELL_SIZE = "min(11vw, 11vh, 64px)";

interface ConnectFourBoardProps {
  board: C4Board;
  currentMark: Player;
  onColumnClick: (col: number) => void;
  winningLine: C4WinLine | null;
  interactionEnabled: boolean;
}

function openRow(board: C4Board, col: number): number | null {
  for (let row = 0; row < C4_ROWS; row++) {
    if (board[row * C4_COLS + col] === 0) return row;
  }
  return null;
}

export const ConnectFourBoard: React.FC<ConnectFourBoardProps> = ({
  board,
  currentMark,
  onColumnClick,
  winningLine,
  interactionEnabled,
}) => {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const winningCells = winningLine?.cells ?? [];
  const ghostRow =
    hoverCol !== null && interactionEnabled ? openRow(board, hoverCol) : null;

  const columns = Array.from({ length: C4_COLS }, (_, col) => col);
  const rowsTopDown = Array.from({ length: C4_ROWS }, (_, i) => C4_ROWS - 1 - i);

  return (
    <div
      className="grid grid-cols-7 gap-[calc(var(--c4cell)/8)] rounded-2xl border-2 border-blue-500/40 bg-zinc-800/90 p-[calc(var(--c4cell)/8)] shadow-[0_0_30px_rgba(37,99,235,0.2)] backdrop-blur-sm"
      style={{ "--c4cell": CELL_SIZE } as React.CSSProperties}
    >
      {columns.map((col) => {
        const colOpen = openRow(board, col) !== null;
        return (
          <button
            key={col}
            type="button"
            aria-label={`column ${col + 1}`}
            data-testid={`c4-col-${col}`}
            disabled={!interactionEnabled || !colOpen}
            onClick={() => onColumnClick(col)}
            onMouseEnter={() => setHoverCol(col)}
            onMouseLeave={() => setHoverCol((prev) => (prev === col ? null : prev))}
            className="group flex flex-col gap-[calc(var(--c4cell)/8)] rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 disabled:cursor-not-allowed transition-transform active:scale-98"
          >
            {rowsTopDown.map((row) => {
              const index = row * C4_COLS + col;
              const value = board[index];
              const isWinning = winningCells.includes(index);
              const isGhost = value === 0 && ghostRow === row;
              return (
                <span
                  key={index}
                  className={`flex h-[var(--c4cell)] w-[var(--c4cell)] items-center justify-center rounded-full bg-zinc-950/90 shadow-inner transition-colors ${
                    isWinning ? "animate-win-pulse ring-4 ring-yellow-400" : ""
                  }`}
                >
                  {value !== 0 && (
                    <span
                      data-testid={`c4-disc-${index}`}
                      aria-hidden="true"
                      className={`h-[76%] w-[76%] rounded-full animate-pop shadow-md ${
                        value === "X"
                          ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/50"
                          : "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/50"
                      }`}
                    />
                  )}
                  {isGhost && (
                    <span
                      aria-hidden="true"
                      className={`h-[76%] w-[76%] rounded-full opacity-40 animate-pulse ${
                        currentMark === "X" ? "bg-blue-500" : "bg-red-500"
                      }`}
                    />
                  )}
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
};
