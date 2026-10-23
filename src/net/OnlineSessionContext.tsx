import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RoomSession, type AnyRoomSession, type SessionSnapshot } from './RoomSession';
import { createRoomTransport } from './createRoomTransport';
import { generatePlayerId, type RoomRole, type GameId, DEFAULT_GAME } from './protocol';

export interface OpenRoomOptions {
  role: RoomRole;
  roomCode: string;
  name: string;
  game?: GameId;
}

interface OnlineSessionValue {
  session: AnyRoomSession | null;
  openRoom: (options: OpenRoomOptions) => AnyRoomSession;
  closeRoom: () => void;
}

const OnlineSessionContext = createContext<OnlineSessionValue | null>(null);

export function OnlineSessionProvider({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: AnyRoomSession | null;
}) {
  const sessionRef = useRef<AnyRoomSession | null>(initialSession);
  const [session, setSession] = useState<AnyRoomSession | null>(initialSession);

  const openRoom = useCallback((options: OpenRoomOptions) => {
    sessionRef.current?.destroy();
    const game = options.game ?? DEFAULT_GAME;
    const room = new RoomSession({
      role: options.role,
      roomCode: options.roomCode,
      myId: generatePlayerId(),
      myName: options.name.trim().toUpperCase(),
      game,
      transport: createRoomTransport(options.roomCode, game),
    });
    room.start();
    sessionRef.current = room;
    setSession(room);
    return room;
  }, []);

  const closeRoom = useCallback(() => {
    sessionRef.current?.leave();
    sessionRef.current = null;
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, openRoom, closeRoom }),
    [session, openRoom, closeRoom],
  );

  return (
    <OnlineSessionContext.Provider value={value}>
      {children}
    </OnlineSessionContext.Provider>
  );
}

export function useOnlineSession(): OnlineSessionValue {
  const value = useContext(OnlineSessionContext);
  if (value === null) {
    throw new Error('useOnlineSession must be used within OnlineSessionProvider');
  }
  return value;
}

export function useOnlineSessionSnapshot(): {
  session: AnyRoomSession | null;
  snapshot: SessionSnapshot<GameId> | null;
  closeRoom: () => void;
} {
  // Lenient on purpose: Home is shared between local (/game) and online
  // (/room) routes and may render outside the provider in tests.
  const value = useContext(OnlineSessionContext);
  const session = value?.session ?? null;
  const closeRoom = value?.closeRoom ?? (() => {});
  const [, force] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!session) return;
    return session.subscribe(() => force());
  }, [session]);

  const snapshot = session ? session.getSnapshot() : null;
  return { session, snapshot, closeRoom };
}