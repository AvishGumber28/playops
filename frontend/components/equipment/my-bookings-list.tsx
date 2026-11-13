'use client';

import type { EquipmentBooking } from '@/lib/api';
import { StatusBadge } from './status-badge';
import { equipmentIcon } from '@/lib/equipment-icons';

// The signed-in user's own equipment requests - used by both the
// Student and Secretary "My Requests" Equipment pages. The parent page
// owns the actual fetch (GET /api/equipment/bookings/mine); this is
// just the list.
export function MyBookingsList({
  bookings,
  emptyText,
}: {
  bookings: EquipmentBooking[];
  emptyText: string;
}) {
  if (bookings.length === 0) {
    return <p className="text-sm text-white/40">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-white/5">
      {bookings.map((b) => {
        const { icon, badge } = equipmentIcon(b.item.name);
        return (
          <li key={b.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${badge}`}
              >
                {icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-white">
                  {b.quantity}× {b.item.name}
                </p>
                {b.reason && <p className="mt-0.5 truncate text-xs text-white/40">{b.reason}</p>}
              </div>
            </div>
            <StatusBadge status={b.status} />
          </li>
        );
      })}
    </ul>
  );
}
