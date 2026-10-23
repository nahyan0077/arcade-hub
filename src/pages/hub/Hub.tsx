import { useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

interface GameCard {
  id: string;
  title: string;
  tagline: string;
  mark: string;
  markClass: string;
  playable: boolean;
}

const GAMES: GameCard[] = [
  {
    id: "tictactoe",
    title: "TIC TAC TOE",
    tagline: "3 in a row — local, vs AI, or online with voice",
    mark: "✕",
    markClass: "text-blue-500",
    playable: true,
  },
  {
    id: "connect-four",
    title: "CONNECT FOUR",
    tagline: "Drop discs, connect four — local, vs AI, or online",
    mark: "●",
    markClass: "text-yellow-500",
    playable: true,
  },
  {
    id: "dots-and-boxes",
    title: "DOTS & BOXES",
    tagline: "Claim squares, close the boxes",
    mark: "■",
    markClass: "text-emerald-500",
    playable: false,
  },
];

export const Hub = () => {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-zinc-900 px-4 py-8">
      <Toaster />
      <div className="text-center">
        <h1 className="animate-pop text-4xl font-extrabold sm:text-5xl">
          <span className="bg-gradient-to-r from-blue-500 via-gray-100 to-red-500 bg-clip-text text-transparent">
            ARCADE
          </span>
        </h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Pick a game
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {GAMES.map((game, index) => (
          <div
            key={game.id}
            data-testid={`hub-card-${game.id}`}
            style={{ animationDelay: `${index * 90}ms` }}
            className={`animate-fade-in group flex flex-col items-center gap-3 rounded-2xl border-2 bg-zinc-800/60 p-6 text-center transition-all ${
              game.playable
                ? "border-zinc-700 hover:-translate-y-1.5 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/10"
                : "border-zinc-800 opacity-60"
            }`}
          >
            <span
              aria-hidden="true"
              className={`select-none text-5xl font-extrabold leading-none transition-transform group-hover:scale-110 ${game.markClass}`}
            >
              {game.mark}
            </span>
            <h2 className="text-lg font-bold text-gray-100">{game.title}</h2>
            <p className="text-xs leading-relaxed text-zinc-400">{game.tagline}</p>
            {game.playable ? (
              <button
                type="button"
                onClick={() => navigate("/start", { state: { game: game.id } })}
                className="mt-2 rounded-lg border-2 border-blue-500 bg-blue-500/15 px-6 py-2 text-sm font-bold text-blue-300 transition-all hover:scale-105 hover:bg-blue-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Play
              </button>
            ) : (
              <span className="mt-2 rounded-lg border-2 border-zinc-700 px-6 py-2 text-sm font-bold text-zinc-500">
                Coming soon
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
