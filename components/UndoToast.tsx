'use client';

import { useEffect, useState } from 'react';

type UndoToastProps = {
  message: string;
  onUndo: () => void;
  onExpire: () => void;
  durationMs?: number;
};

export function UndoToast({ message, onUndo, onExpire, durationMs = 8000 }: UndoToastProps) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 100) { onExpire(); return 0; }
        return r - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [durationMs, onExpire]);

  const progress = remaining / durationMs;

  return (
    <div className="toast">
      <div className="toast-bar" style={{ width: `${progress * 100}%` }} />
      <span className="toast-msg">{message}</span>
      <button className="toast-undo" onClick={onUndo}>Undo</button>
    </div>
  );
}
