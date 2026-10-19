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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-900 px-4">
      <Toaster />
      <h1 className="select-none text-3xl font-extrabold sm:text-4xl">
        <span className="text-blue-500">TIC</span>{" "}
        <span className="text-gray-100">TAC</span>{" "}
        <span className="text-red-500">TOE</span>
      </h1>

      {snapshot.role === "host" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Room code — share with a friend
          </p>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy room code"
            className="rounded-2xl border-2 border-blue-500 bg-zinc-800 px-8 py-4 text-4xl font-extrabold tracking-[0.3em] text-blue-400 transition-colors hover:bg-zinc-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
          >
            {snapshot.roomCode}
          </button>
          <p className="h-5 text-sm text-zinc-500" role="status" aria-live="polite">
            {copied ? "Copied!" : ""}
          </p>
        </div>
      )}

      <p
        data-testid="lobby-status"
        role="status"
        aria-live="polite"
        className="text-lg font-bold text-gray-200"
      >
        {snapshot.status === "waiting" && "Waiting for opponent to join..."}
        {snapshot.status === "connecting" && "Joining room..."}
        {snapshot.status === "connected" && `Opponent joined: ${snapshot.opponentName}`}
      </p>

      <button
        type="button"
        onClick={handleLeave}
        className="rounded-xl bg-zinc-700 px-6 py-3 text-sm font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500"
      >
        Leave
      </button>
    </div>
  );
};