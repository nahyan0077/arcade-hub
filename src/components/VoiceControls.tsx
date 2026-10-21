import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  VoiceSession,
  type VoiceSessionOptions,
  type VoiceSnapshot,
} from '../net/voiceSession';
import type { GameId } from '../net/protocol';

export interface VoiceControlsProps {
  baseUrl: string;
  roomCode: string;
  name: string;
  game?: GameId;
  sessionFactory?: (options: VoiceSessionOptions) => VoiceSession;
}

const fabClass =
  'flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-xl shadow-lg transition-all hover:scale-110 hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 disabled:opacity-60 disabled:hover:scale-100';

export function VoiceControls({ baseUrl, roomCode, name, game, sessionFactory }: VoiceControlsProps) {
  const [session] = useState(() =>
    sessionFactory
      ? sessionFactory({ baseUrl, roomCode, name, game })
      : new VoiceSession({ baseUrl, roomCode, name, game }),
  );
  const [snapshot, setSnapshot] = useState<VoiceSnapshot>(session.getSnapshot());

  useEffect(() => {
    const unsubscribe = session.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      session.leave().catch((error: unknown) => {
        console.error('voice cleanup failed', error);
      });
    };
  }, [session]);

  const handleJoin = async () => {
    const joined = await session.join();
    if (!joined) {
      toast.error('Voice unavailable', {
        icon: '❌ ',
        style: { borderRadius: '10px', background: '#030303', color: '#fff' },
      });
    }
  };

  const handleToggleMute = async () => {
    try {
      await session.toggleMute();
    } catch {
      toast.error('Microphone unavailable', {
        icon: '❌ ',
        style: { borderRadius: '10px', background: '#030303', color: '#fff' },
      });
    }
  };

  return (
    <>
      <Toaster />
      <div className="fixed bottom-36 right-4 z-30 sm:right-8">
        {snapshot.status === 'live' ? (
          <div className="relative">
            <button
              type="button"
              data-testid="voice-mute"
              aria-label={snapshot.muted ? 'Unmute' : 'Mute'}
              aria-pressed={!snapshot.muted}
              className={fabClass}
              onClick={handleToggleMute}
            >
              {snapshot.muted ? '🔇' : '🎤'}
            </button>
            <span
              data-testid="voice-status"
              role="status"
              className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white"
            >
              {snapshot.remoteCount + 1}
            </span>
            <button
              type="button"
              aria-label="Leave voice"
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              onClick={() => void session.leave()}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="voice-join"
            aria-label="Join voice"
            className={fabClass}
            disabled={snapshot.status === 'connecting'}
            onClick={() => void handleJoin()}
          >
            {snapshot.status === 'connecting' ? (
              <span
                aria-hidden="true"
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-transparent"
              />
            ) : (
              '🎧'
            )}
          </button>
        )}
      </div>
    </>
  );
}
