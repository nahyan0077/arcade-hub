import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { MatchmakerClient, type MatchmakerSnapshot } from '../../net/matchmaker';
import {
  generatePlayerId,
  isGameId,
  DEFAULT_GAME,
  type GameId,
} from '../../net/protocol';
import { useOnlineSession } from '../../net/OnlineSessionContext';

interface QueueLocationState {
  name: string;
  game?: GameId;
}

export const Queue = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openRoom } = useOnlineSession();
  const navState = location.state as QueueLocationState | null;
  const name = navState?.name ?? '';
  const game: GameId =
    navState?.game !== undefined && isGameId(navState.game) ? navState.game : DEFAULT_GAME;

  const [client] = useState(
    () =>
      new MatchmakerClient({
        url: import.meta.env.VITE_WS_URL ?? '',
        playerId: generatePlayerId(),
        game,
      }),
  );
  const [snapshot, setSnapshot] = useState<MatchmakerSnapshot>(client.getSnapshot());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!name) {
      navigate('/', { replace: true });
    }
  }, [name, navigate]);

  useEffect(() => {
    if (!name) return;
    const unsubscribe = client.subscribe(setSnapshot);
    client.queue();
    return () => {
      unsubscribe();
      client.destroy();
    };
  }, [client, name]);

  useEffect(() => {
    if (snapshot.status !== 'queued') return;
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [snapshot.status]);

  useEffect(() => {
    if (snapshot.status === 'matched' && snapshot.roomCode !== null && snapshot.role !== null) {
      openRoom({ role: snapshot.role, roomCode: snapshot.roomCode, name, game });
      navigate('/room', { replace: true });
    }
  }, [snapshot, openRoom, navigate, name, game]);

  const showToast = (message: string) => {
    toast.error(message, {
      icon: '❌ ',
      style: {
        borderRadius: '10px',
        background: '#030303',
        color: '#fff',
      },
    });
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <main className="relative flex flex-col mx-auto min-h-[100dvh] justify-center items-center bg-zinc-950 px-4 py-6 overflow-hidden text-gray-100">
      {/* Dynamic background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-cyan-600/15 blur-3xl"
        aria-hidden="true"
      />

      <Toaster />

      {/* Top Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 z-10 px-1">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label="Back to hub"
        >
          <span>← Hub</span>
        </button>
        <span className="text-[11px] font-black tracking-widest uppercase text-zinc-400">
          Matchmaking
        </span>
      </div>

      <div className="w-full max-w-md rounded-3xl border border-zinc-800/80 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-6 z-10">
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-gray-100">QUICK PLAY</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
            {game}
          </span>
        </div>

        {snapshot.status === 'queued' && (
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Radar Sweep Graphic */}
            <div className="relative flex h-32 w-32 items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
              {/* Mid ring */}
              <div className="absolute inset-2 rounded-full border border-cyan-500/40" />
              {/* Inner ring */}
              <div className="absolute inset-6 rounded-full border border-cyan-500/60" />

              {/* Sweeping radar crosshair / beam */}
              <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="1" />
                <path
                  d="M50 50 L50 2 A48 48 0 0 1 98 50 Z"
                  fill="url(#radarGradient)"
                  opacity="0.4"
                />
                <defs>
                  <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center blip */}
              <div className="h-4 w-4 rounded-full bg-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.9)] animate-pulse z-10" />
            </div>

            {/* Status and Elapsed time */}
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-2.5 text-sm font-bold text-zinc-200" role="status">
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"
                  aria-hidden="true"
                />
                Finding an opponent…
              </div>
              <span className="text-xs font-mono font-bold text-zinc-400">
                {formatElapsed(elapsed)} elapsed
              </span>
            </div>

            <button
              type="button"
              className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-6 py-2 text-xs sm:text-sm font-bold text-zinc-300 shadow-md transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95"
              onClick={() => navigate('/', { replace: true })}
            >
              Cancel
            </button>
          </div>
        )}

        {snapshot.status === 'timeout' && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-2xl">
              ⏱️
            </div>
            <p className="text-sm font-bold text-zinc-300" role="status">
              No opponent found
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-xl border-2 border-cyan-500 bg-cyan-500/15 px-5 py-2.5 text-sm font-bold text-cyan-300 transition-all hover:bg-cyan-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95"
                onClick={() => {
                  if (!client.queue()) showToast('Already searching for an opponent');
                }}
              >
                Try again
              </button>
              <button
                type="button"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-bold text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95"
                onClick={() => navigate('/', { replace: true })}
              >
                Back to menu
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
