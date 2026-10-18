import React from "react";
import type { Board as BoardData, WinLine } from "../engine";
import { getWinningLineIndices } from "../engine";

const CELL_PX = 144;
const GAP_PX = 16;
const BOARD_PX = CELL_PX * 3 + GAP_PX * 2;

interface BoardProps {
  board: BoardData;
  onCellClick: (index: number) => void;
  winningLine: WinLine | null;
  interactionEnabled: boolean;
}

function cellCenter(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: col * (CELL_PX + GAP_PX) + CELL_PX / 2,
    y: row * (CELL_PX + GAP_PX) + CELL_PX / 2,
  };
}

const WinLineOverlay: React.FC<{ line: WinLine }> = ({ line }) => {
  const indices = getWinningLineIndices(line);
  const start = cellCenter(indices[0]);
  const end = cellCenter(indices[2]);
  const shorten = 28;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / length;
  const uy = dy / length;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
      aria-hidden="true"
    >
      <line
        x1={start.x + ux * shorten}
        y1={start.y + uy * shorten}
        x2={end.x - ux * shorten}
        y2={end.y - uy * shorten}
        stroke="#facc15"
        strokeWidth={8}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        className="animate-draw-line"
      />
    </svg>
  );
};

export const Board: React.FC<BoardProps> = ({
  board,
  onCellClick,
  winningLine,
  interactionEnabled,
}) => {
  const winningIndices = winningLine ? getWinningLineIndices(winningLine) : [];

  return (
    <div className="relative inline-block">
      <div className="grid grid-cols-3 gap-4">
        {board.map((value, index) => {
          const isWinning = winningIndices.includes(index);
          const isEmpty = value === 0;
          return (
            <button
              key={index}
              type="button"
              aria-label={`cell ${index + 1}${isEmpty ? "" : `, ${value}`}`}
              disabled={!interactionEnabled || !isEmpty}
              onClick={() => onCellClick(index)}
              className={`flex h-36 w-36 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 ${
                isWinning
                  ? "bg-gray-500 animate-win-pulse"
                  : "bg-gray-600 hover:bg-gray-500 disabled:hover:bg-gray-600"
              }`}
            >
              {value !== 0 && (
                <span
                  className={`select-none text-8xl font-bold animate-pop ${
                    value === "X" ? "text-blue-500" : "text-red-500"
                  }`}
                >
                  {value}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {winningLine && <WinLineOverlay line={winningLine} />}
    </div>
  );
};