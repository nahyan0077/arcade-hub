import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  VoiceSession,
  type VoiceSessionOptions,
  type VoiceSnapshot,
} from '../net/voiceSession';

export interface VoiceControlsProps {
  baseUrl: string;
  roomCode: string;
  name: string;
  sessionFactory?: (options: VoiceSessionOptions) => VoiceSession;
}

export function VoiceControls({ baseUrl, roomCode, name, sessionFactory }: VoiceControlsProps) {
  const [session] = useState(() =>
    sessionFactory
      ? sessionFactory({ baseUrl, roomCode, name })
      : new VoiceSession({ baseUrl, roomCode, name }),
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

  const buttonClass =
    'rounded-xl bg-zinc-700 px-4 py-2 text-xs font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-5 sm:py-2.5 sm:text-sm';

  return (
    <>
      <Toaster />
      {(snapshot.status === 'off' || snapshot.status === 'error') && (
        <button type="button" className={buttonClass} onClick={handleJoin}>
          Join voice
        </button>
      )}
      {snapshot.status === 'connecting' && (
        <button type="button" className={buttonClass} disabled>
          Connecting…
        </button>
      )}
      {snapshot.status === 'live' && (
        <>
          <span
            className="text-xs font-bold text-emerald-400 sm:text-sm"
            data-testid="voice-status"
            role="status"
          >
            Voice live · {snapshot.remoteCount + 1}
          </span>
          <button
            type="button"
            className={buttonClass}
            aria-pressed={!snapshot.muted}
            onClick={handleToggleMute}
          >
            {snapshot.muted ? 'Unmute' : 'Mute'}
          </button>
          <button type="button" className={buttonClass} onClick={() => void session.leave()}>
            Leave voice
          </button>
        </>
      )}
    </>
  );
}
