import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useOnlineSession } from "../../net/OnlineSessionContext";
import type { SessionSnapshot } from "../../net/RoomSession";

export const Lobby = () => {
  const navigate = useNavigate();
  const { session, closeRoom } = useOnlineSession();
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

  return (
    <div className="animate-fade-in relative flex min-h-[100dvh] flex-col items-center justify-center gap-4 sm:gap-6 bg-zinc-900 px-4 py-6 overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />

      <Toaster />

      {/* Top Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between z-10 px-1">
        <button
          type="button"
          onClick={handleLeave}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Back to hub"
        >
          <span>← Hub</span>
        </button>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
          Match Lobby
        </span>
      </div>

      <div className="w-full max-w-md rounded-3xl border border-zinc-800/90 bg-zinc-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md flex flex-col items-center gap-5 sm:gap-6 z-10">
        {snapshot.game === "connect-four" ? (
          <h1 className="animate-pop select-none text-2xl sm:text-3xl font-extrabold tracking-wider">
            <span className="text-yellow-500">CONNECT</span>{" "}
            <span className="text-gray-100">FOUR</span>
          </h1>
        ) : snapshot.game === "arrow-race" ? (
          <h1 className="animate-pop select-none text-2xl sm:text-3xl font-extrabold tracking-wider">
            <span className="text-violet-500">ARROW</span>{" "}
            <span className="text-gray-100">RACE</span>
          </h1>
        ) : (
          <h1 className="animate-pop select-none text-2xl sm:text-3xl font-extrabold tracking-wider">
            <span className="text-blue-500">TIC</span>{" "}
            <span className="text-gray-100">TAC</span>{" "}
            <span className="text-red-500">TOE</span>
          </h1>
        )}

        {snapshot.role === "host" && (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Room code — share with a friend
            </p>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy room code"
              className="animate-pop w-full rounded-2xl border-2 border-blue-500/70 bg-zinc-800/90 px-6 py-4 text-3xl sm:text-4xl font-extrabold tracking-[0.25em] text-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.3)] transition-all hover:scale-102 hover:border-blue-400 hover:bg-zinc-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            >
              {snapshot.roomCode}
            </button>
            <p className="h-5 text-xs font-bold text-emerald-400" role="status" aria-live="polite">
              {copied ? "✓ Copied to clipboard!" : ""}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-800/60 px-4 py-1.5 shadow-inner">
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

        <button
          type="button"
          onClick={handleLeave}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-2.5 text-sm font-bold text-gray-200 shadow-md transition-all hover:bg-zinc-700 hover:border-zinc-500 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 active:scale-95"
        >
          Leave
        </button>
      </div>
    </div>
  );
};