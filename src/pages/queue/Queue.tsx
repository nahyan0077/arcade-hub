import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { MatchmakerClient, type MatchmakerSnapshot } from '../../net/matchmaker';
import { generatePlayerId, DEFAULT_GAME } from '../../net/protocol';
import { useOnlineSession } from '../../net/OnlineSessionContext';

interface QueueLocationState {
  name: string;
}

export const Queue = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openRoom } = useOnlineSession();
  const name = (location.state as QueueLocationState | null)?.name ?? '';

  const [client] = useState(
    () =>
      new MatchmakerClient({
        url: import.meta.env.VITE_WS_URL ?? '',
        playerId: generatePlayerId(),
        game: DEFAULT_GAME,
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
      openRoom({ role: snapshot.role, roomCode: snapshot.roomCode, name, game: DEFAULT_GAME });
      navigate('/room', { replace: true });
    }
  }, [snapshot, openRoom, navigate, name]);

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
    <div className="animate-fade-in-up flex flex-col mx-auto min-h-[100dvh] justify-center items-center bg-zinc-900 px-4">
      <Toaster />
      <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-100 mb-8">QUICK PLAY</h2>

      {snapshot.status === 'queued' && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 text-zinc-300" role="status">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
              aria-hidden="true"
            />
            Finding an opponent…
          </div>
          <button
            type="button"
            className="rounded-lg border-2 border-zinc-600 px-4 py-2 text-sm font-bold text-zinc-400 transition-colors hover:border-zinc-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={() => navigate('/', { replace: true })}
          >
            Cancel
          </button>
        </div>
      )}

      {snapshot.status === 'timeout' && (
        <div className="flex flex-col items-center gap-6">
          <p className="text-zinc-300" role="status">
            No opponent found
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-lg border-2 border-blue-500 bg-blue-500/15 px-4 py-2 text-sm font-bold text-blue-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              onClick={() => {
                if (!client.queue()) showToast('Already searching for an opponent');
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-lg border-2 border-zinc-600 px-4 py-2 text-sm font-bold text-zinc-400 transition-colors hover:border-zinc-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              onClick={() => navigate('/', { replace: true })}
            >
              Back to menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
