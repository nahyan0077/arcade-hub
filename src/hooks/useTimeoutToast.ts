import { useCallback, useState } from "react";

interface TimeoutToast {
  id: number;
  message: string;
  type: 'timeout' | 'timeout-loss';
  playerName: string;
}

let toastId = 0;

export function useTimeoutToast() {
  const [toasts, setToasts] = useState<TimeoutToast[]>([]);

  const showTimeoutToast = useCallback((playerName: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message: `${playerName} timed out! Turn skipped.`, type: 'timeout', playerName }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const showTimeoutLossToast = useCallback((playerName: string, winnerName: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message: `${playerName} timed out 3 times! ${winnerName} wins.`, type: 'timeout-loss', playerName }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showTimeoutToast, showTimeoutLossToast, dismissToast };
}