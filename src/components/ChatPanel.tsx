import React, { useEffect, useRef, useState } from "react";
import type { ChatEvent, RoomSession } from "../net/RoomSession";
import { CHAT_EMOJIS, CHAT_MESSAGE_MAX_LENGTH } from "../net/protocol";

interface ChatEntry {
  id: number;
  kind: "chat" | "emoji";
  from: string;
  mine: boolean;
  text?: string;
  emoji?: string;
}

let nextEntryId = 1;

export const ChatPanel: React.FC<{ session: RoomSession }> = ({ session }) => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [input, setInput] = useState("");
  const [bursts, setBursts] = useState<Array<{ id: number; emoji: string }>>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const myId = session.getSnapshot().myId;
    return session.onChat((event: ChatEvent) => {
      const entry: ChatEntry = {
        id: nextEntryId++,
        kind: event.kind,
        from: event.from,
        mine: event.fromId === myId,
        text: event.text,
        emoji: event.emoji,
      };
      setEntries((prev) => [...prev.slice(-49), entry]);
      if (event.kind === "emoji" && event.emoji) {
        const burstId = nextEntryId++;
        setBursts((prev) => [...prev, { id: burstId, emoji: event.emoji as string }]);
        setTimeout(() => {
          setBursts((prev) => prev.filter((burst) => burst.id !== burstId));
        }, 1600);
      }
      if (!openRef.current) setUnread((n) => n + 1);
    });
  }, [session]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, open]);

  const toggle = () => {
    setOpen((o) => !o);
    setUnread(0);
  };

  const appendMine = (kind: "chat" | "emoji", payload: { text?: string; emoji?: string }) => {
    setEntries((prev) => [
      ...prev.slice(-49),
      {
        id: nextEntryId++,
        kind,
        from: session.getSnapshot().myName,
        mine: true,
        ...payload,
      },
    ]);
  };

  const showBurst = (emoji: string) => {
    const burstId = nextEntryId++;
    setBursts((prev) => [...prev, { id: burstId, emoji }]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((burst) => burst.id !== burstId));
    }, 1600);
  };

  const sendText = () => {
    if (!session.sendChat(input)) return;
    appendMine("chat", { text: input.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH) });
    setInput("");
  };

  const sendEmoji = (emoji: string) => {
    if (!session.sendEmoji(emoji)) return;
    appendMine("emoji", { emoji });
    showBurst(emoji);
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-28 sm:right-8"
      >
        {bursts.map((burst) => (
          <span
            key={burst.id}
            data-testid="emoji-burst"
            className="animate-emoji-float text-4xl drop-shadow-lg"
          >
            {burst.emoji}
          </span>
        ))}
      </div>

      {open && (
        <div
          data-testid="chat-panel"
          className="animate-slide-up fixed bottom-20 right-4 z-30 flex w-72 max-h-80 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800/95 shadow-2xl backdrop-blur sm:right-8"
        >
          <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Chat
            </span>
            <button
              type="button"
              onClick={toggle}
              aria-label="Close chat panel"
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              ✕
            </button>
          </div>

          <div
            ref={listRef}
            data-testid="chat-messages"
            className="flex-1 space-y-2 overflow-y-auto px-3 py-2"
          >
            {entries.length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-500">
                Say hi to your opponent
              </p>
            )}
            {entries.map((entry) =>
              entry.kind === "emoji" ? (
                <div
                  key={entry.id}
                  className={`flex items-baseline gap-2 ${entry.mine ? "justify-end" : ""}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {entry.from}
                  </span>
                  <span className="text-2xl">{entry.emoji}</span>
                </div>
              ) : (
                <div
                  key={entry.id}
                  data-testid="chat-message"
                  className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                    entry.mine
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-zinc-700 text-gray-100"
                  }`}
                >
                  {!entry.mine && (
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
                      {entry.from}
                    </div>
                  )}
                  {entry.text}
                </div>
              ),
            )}
          </div>

          <div className="flex gap-1 border-t border-zinc-700 px-2 py-1.5">
            {CHAT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`send emoji ${emoji}`}
                onClick={() => sendEmoji(emoji)}
                className="rounded p-1 text-lg transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {emoji}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-zinc-700 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendText();
            }}
          >
            <input
              data-testid="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              placeholder="Message…"
              aria-label="Chat message"
              className="min-w-0 flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-gray-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              data-testid="chat-send"
              disabled={input.trim().length === 0}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Close chat" : "Open chat"}
        data-testid="chat-toggle"
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-xl shadow-lg transition-all hover:scale-110 hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 sm:right-8"
      >
        💬
        {!open && unread > 0 && (
          <span
            data-testid="chat-unread"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
};
