import { useEffect, useRef, useState } from 'react';
import { CHAT_EMOJIS } from '../net/protocol';

const fabClass =
  'flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-xl shadow-lg transition-all hover:scale-110 hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400';

export function QuickEmoji({ onEmoji }: { onEmoji: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 sm:right-8">
      {open && (
        <div
          data-testid="quick-emoji-panel"
          className="animate-slide-up grid grid-cols-4 gap-1 rounded-2xl border border-zinc-700 bg-zinc-800/95 p-2 shadow-2xl backdrop-blur"
        >
          {CHAT_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`react with ${emoji}`}
              onClick={() => {
                onEmoji(emoji);
                setOpen(false);
              }}
              className="rounded-lg p-1.5 text-2xl transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        data-testid="quick-emoji-toggle"
        aria-label={open ? 'Close reactions' : 'Open reactions'}
        aria-expanded={open}
        className={fabClass}
        onClick={() => setOpen((o) => !o)}
      >
        😀
      </button>
    </div>
  );
}
