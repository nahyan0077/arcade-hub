import React, { ReactNode, useEffect } from "react";
import { useSettings } from "../settings/SettingsContext";
import { playEffect } from "../sound/audio";

export type GameId = "ttt" | "c4" | "arrow" | "rush";

export interface GameShellProps {
  game: GameId;
  title: ReactNode;
  subtitle?: ReactNode;
  onBack: () => void;
  backLabel?: string;
  backAriaLabel?: string;
  soundOn: boolean;
  onToggleSound: () => void;
  soundAriaLabel?: { mute: string; unmute: string };
  headerRightExtra?: ReactNode;
  headerMaxWidth?: string;
  confetti?: ReactNode;
  children: ReactNode;
  overlayPanels?: ReactNode;
  className?: string;
}

export const GameShell: React.FC<GameShellProps> = ({
  game,
  title,
  subtitle,
  onBack,
  backLabel = "← Hub",
  backAriaLabel = "Back to hub",
  soundOn,
  onToggleSound,
  soundAriaLabel = { mute: "Mute sound", unmute: "Unmute sound" },
  headerRightExtra,
  headerMaxWidth = "max-w-sm sm:max-w-md",
  confetti,
  children,
  overlayPanels,
  className = "flex min-h-[100dvh] flex-col items-center justify-center gap-2 sm:gap-3 overflow-hidden bg-zinc-900 px-4 py-2 sm:py-4",
}) => {
  const { openSettings } = useSettings();

  useEffect(() => {
    document.body.dataset.game = game;
    return () => {
      delete document.body.dataset.game;
    };
  }, [game]);

  return (
    <main className={className} data-game={game}>
      {confetti}

      {/* Top Header Bar */}
      <header className={`flex w-full ${headerMaxWidth} items-center justify-between px-1`}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label={backAriaLabel}
        >
          <span>{backLabel}</span>
        </button>

        <div className="flex flex-col items-center text-center">
          {title}
          {subtitle}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              playEffect("click");
              openSettings();
            }}
            aria-label="Open settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300 transition-all hover:border-cyan-400 hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={!soundOn}
            aria-label={soundOn ? soundAriaLabel.mute : soundAriaLabel.unmute}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          {headerRightExtra}
        </div>
      </header>

      {children}

      {overlayPanels}
    </main>
  );
};
