'use client';

import type { ReactNode } from 'react';

// Shared card wrapper for the Admin Equipment pages (Inventory,
// Bookings' three sub-sections).
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
