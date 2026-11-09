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

  return (
    <div className="relative flex flex-col mx-auto min-h-[100dvh] justify-center items-center bg-zinc-900 px-4 py-6 overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />

      <Toaster />

      {/* Top Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 z-10 px-1">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Back to hub"
        >
          <span>← Hub</span>
        </button>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
          Matchmaking
        </span>
      </div>

      <div className="w-full max-w-md rounded-3xl border border-zinc-800/90 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-md flex flex-col items-center gap-6 z-10">
        <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-gray-100">QUICK PLAY</h2>

        {snapshot.status === 'queued' && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span className="absolute h-full w-full rounded-full border-2 border-blue-500/30 animate-ping" />
              <span className="absolute h-16 w-16 rounded-full border-2 border-blue-500/60 animate-pulse" />
              <span className="h-6 w-6 rounded-full bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.8)]" />
            </div>

            <div className="flex items-center gap-3 text-sm font-bold text-zinc-300" role="status">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                aria-hidden="true"
              />
              Finding an opponent…
            </div>

            <button
              type="button"
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-2.5 text-sm font-bold text-zinc-300 shadow-md transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
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
                className="rounded-xl border-2 border-blue-500 bg-blue-500/15 px-5 py-2.5 text-sm font-bold text-blue-300 transition-all hover:bg-blue-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
                onClick={() => {
                  if (!client.queue()) showToast('Already searching for an opponent');
                }}
              >
                Try again
              </button>
              <button
                type="button"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-bold text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
                onClick={() => navigate('/', { replace: true })}
              >
                Back to menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
