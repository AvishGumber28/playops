'use client';

import { useState } from 'react';
import type { EquipmentItem } from '@/lib/api';
import { QuantitySelector } from './quantity-selector';
import { equipmentIcon } from '@/lib/equipment-icons';

// Shared browsing/requesting grid - the Student and Secretary Equipment
// pages both render this. Both roles go through the same request ->
// Admin-approval path; the caller (the parent page) owns the actual
// data fetch/mutation and just hands this the current item list plus a
// submit handler.
export function EquipmentBookingList({
  items,
  onRequest,
}: {
  items: EquipmentItem[];
  onRequest: (
    itemId: string,
    quantity: number,
    reason?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const quantityOf = (itemId: string) => quantities[itemId] ?? 1;

  function setQuantity(itemId: string, value: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: value }));
    setErrors((prev) => ({ ...prev, [itemId]: '' }));
  }

  async function handleRequest(itemId: string) {
    const quantity = quantityOf(itemId);
    const reason = reasons[itemId]?.trim();
    setErrors((prev) => ({ ...prev, [itemId]: '' }));
    setBusyId(itemId);
    const result = await onRequest(itemId, quantity, reason || undefined);
    setBusyId(null);

    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [itemId]: result.error }));
      return;
    }
    setQuantities((prev) => ({ ...prev, [itemId]: 1 }));
    setReasons((prev) => ({ ...prev, [itemId]: '' }));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/40">
        No equipment has been added yet — check back once the Sports Department stocks the
        inventory.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const quantity = quantityOf(item.id);
        const exceeds = quantity > item.availableQuantity;
        const outOfStock = item.availableQuantity === 0;
        const error = errors[item.id];
        const busy = busyId === item.id;
        const { icon, badge } = equipmentIcon(item.name);

        return (
          <div
            key={item.id}
            className="flex flex-col justify-between rounded-lg border border-white/10 bg-playops-dark-surface p-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white">{item.name}</p>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${badge}`}
                >
                  {icon}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${outOfStock ? 'bg-red-400' : 'bg-emerald-400'}`}
                />
                <span className={outOfStock ? 'text-red-400' : 'text-emerald-400'}>
                  {item.availableQuantity}
                </span>
                of {item.totalQuantity} available
              </p>
            </div>

            <div className="mt-3">
              <input
                value={reasons[item.id] ?? ''}
                onChange={(e) =>
                  setReasons((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
                disabled={outOfStock || busy}
                maxLength={200}
                placeholder="Reason (optional)"
                aria-label={`Reason for requesting ${item.name}`}
                className="h-8 w-full rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber disabled:opacity-50"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <QuantitySelector
                value={quantity}
                max={item.availableQuantity}
                onChange={(n) => setQuantity(item.id, n)}
                disabled={outOfStock || busy}
              />
              <button
                type="button"
                onClick={() => handleRequest(item.id)}
                disabled={outOfStock || exceeds || busy}
                className="rounded-md bg-playops-amber px-3 py-1.5 text-xs font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Requesting…' : outOfStock ? 'Out of stock' : 'Request'}
              </button>
            </div>

            {exceeds && !error && (
              <p className="mt-2 text-[11px] text-red-400">
                Only {item.availableQuantity} available.
              </p>
            )}
            {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
