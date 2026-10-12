'use client';

import { useEffect, useState } from 'react';

// A minimal, dependency-free toast - no toast library is installed in
// this project, and pulling one in for a small success/error notice
// isn't worth it.

type Tone = 'success' | 'error';
type ToastMsg = { id: string; text: string; tone: Tone };
type Listener = (toasts: ToastMsg[]) => void;

let toasts: ToastMsg[] = [];
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((fn) => fn(toasts));
}

export function showToast(text: string, tone: Tone = 'success') {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `toast-${Date.now()}`;
  toasts = [...toasts, { id, text, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 2800);
}

// Mount once per page that can trigger a toast - each instance renders
// the same global queue, so it's safe even if more than one is mounted.
export function ToastStack() {
  const [list, setList] = useState<ToastMsg[]>(toasts);

  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={
            'pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-lg shadow-black/40 ' +
            (t.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300'
              : 'border-red-500/30 bg-red-950/90 text-red-300')
          }
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
