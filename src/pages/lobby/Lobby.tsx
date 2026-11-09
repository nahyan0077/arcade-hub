import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useOnlineSession } from "../../net/OnlineSessionContext";
import type { SessionSnapshot } from "../../net/RoomSession";
import { useSettings } from "../../settings/SettingsContext";

export const Lobby = () => {
  const navigate = useNavigate();
  const { session, closeRoom } = useOnlineSession();
  const { settings } = useSettings();
  const noServerMode = (import.meta.env.VITE_WS_URL ?? "") === "";
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(
    session?.getSnapshot() ?? null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate("/", { replace: true });
      return;
    }
    session.start();
    setSnapshot(session.getSnapshot());
    return session.subscribe(setSnapshot);
  }, [session, navigate]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.status === "connected") {
      navigate("/room", { replace: true });
    } else if (snapshot.status === "rejected" || snapshot.status === "disconnected") {
      toast.error(
        snapshot.status === "rejected"
          ? noServerMode
            ? "Couldn't reach the host with that code — no-server mode needs both windows on the same URL and browser profile (not incognito), with the host staying in the lobby"
            : "Room not found or full"
          : "Room closed",
        { icon: "❌ " },
      );
      closeRoom();
      navigate("/", { replace: true });
    }
  }, [snapshot, navigate, closeRoom, noServerMode]);

  const handleCopy = async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — write the code down", { icon: "❌ " });
    }
  };

  const handleLeave = () => {
    closeRoom();
    navigate("/", { replace: true });
  };

  if (!snapshot) return null;

  const isHost = snapshot.role === "host";

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-4 sm:gap-6 bg-zinc-950 px-4 py-6 overflow-hidden text-gray-100">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl"
        aria-hidden="true"
      />

      <Toaster />

      {/* Top Header Bar */}
      <div className="w-full max-w-lg flex items-center justify-between z-10 px-1">
        <button
          type="button"
          onClick={handleLeave}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label="Back to hub"
        >
          <span>← Hub</span>
        </button>
        <span className="text-[11px] font-black tracking-widest uppercase text-zinc-400">
          Match Lobby
        </span>
      </div>

      <div className="w-full max-w-lg rounded-3xl border border-zinc-800/80 bg-zinc-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-6 z-10">
        {/* Game Title */}
        {snapshot.game === "connect-four" ? (
          <h1 className="select-none text-2xl sm:text-3xl font-black tracking-wider">
            <span className="text-amber-400">CONNECT</span>{" "}
            <span className="text-white">FOUR</span>
          </h1>
        ) : (
          <h1 className="select-none text-2xl sm:text-3xl font-black tracking-wider">
            <span className="text-blue-400">TIC</span>{" "}
            <span className="text-white">TAC</span>{" "}
            <span className="text-red-500">TOE</span>
          </h1>
        )}

        {/* 2-Player Matchup Slots */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
          {/* Player 1 Slot (You if Host, Host if Guest) */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-blue-500/40 bg-blue-950/20 shadow-lg text-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
              {isHost ? "YOU (HOST)" : "HOST"}
            </span>
            <span className="text-3xl select-none">{isHost ? settings.avatar : "👤"}</span>
            <span className="text-sm font-black text-white truncate max-w-[120px]">
              {isHost ? snapshot.myName : "OPPONENT"}
            </span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Player 2 Slot */}
          <div
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center gap-2 transition-all ${
              snapshot.status === "connected"
                ? "border-emerald-500/50 bg-emerald-950/20 shadow-lg"
                : "border-dashed border-zinc-700 bg-zinc-800/30"
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              {isHost ? "CHALLENGER" : "YOU (GUEST)"}
            </span>
            <span className="text-3xl select-none">
              {snapshot.status === "connected"
                ? "👤"
                : !isHost
                  ? settings.avatar
                  : "❓"}
            </span>
            <span className="text-sm font-black text-zinc-300 truncate max-w-[120px]">
              {snapshot.status === "connected"
                ? snapshot.opponentName || "PLAYER 2"
                : !isHost
                  ? snapshot.myName
                  : "WAITING…"}
            </span>
            <span
              className={`flex h-2 w-2 rounded-full ${
                snapshot.status === "connected" || !isHost
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400 animate-ping"
              }`}
            />
          </div>
        </div>

        {/* Room Code Share Card for Host */}
        {snapshot.role === "host" && (
          <div className="flex flex-col items-center gap-2.5 w-full pt-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
              Room Code — Share with Opponent
            </p>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy room code"
              className="w-full rounded-2xl border-2 border-blue-500/60 bg-zinc-800/90 px-6 py-3.5 text-3xl sm:text-4xl font-black tracking-[0.25em] text-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.25)] transition-all hover:scale-[1.02] hover:border-blue-400 hover:bg-zinc-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            >
              {snapshot.roomCode}
            </button>
            <p className="h-4 text-xs font-bold text-emerald-400" role="status" aria-live="polite">
              {copied ? "✓ Copied to clipboard!" : "Tap code to copy"}
            </p>
          </div>
        )}

        {/* Status Pill */}
        <div className="flex items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2 shadow-inner">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              snapshot.status === "waiting"
                ? "bg-amber-400 animate-ping"
                : snapshot.status === "connected"
                  ? "bg-emerald-400"
                  : "bg-blue-400 animate-spin"
            }`}
            aria-hidden="true"
          />
          <p
            data-testid="lobby-status"
            role="status"
            aria-live="polite"
            className="text-xs sm:text-sm font-bold text-gray-200"
          >
            {snapshot.status === "waiting" && "Waiting for opponent to join..."}
            {snapshot.status === "connecting" && "Joining room..."}
            {snapshot.status === "connected" && `Opponent joined: ${snapshot.opponentName}`}
          </p>
        </div>

        {/* Leave Action */}
        <button
          type="button"
          onClick={handleLeave}
          className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-6 py-2 text-xs sm:text-sm font-bold text-zinc-300 shadow-md transition-all hover:bg-zinc-700 hover:border-zinc-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-95"
        >
          Leave
        </button>
      </div>
    </main>
  );
};
