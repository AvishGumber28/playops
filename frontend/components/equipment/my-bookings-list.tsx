'use client';

import type { EquipmentBooking } from '@/lib/api';
import { StatusBadge } from './status-badge';

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
      {bookings.map((b) => (
        <li key={b.id} className="flex items-center justify-between py-2 text-sm">
          <span className="text-white">
            {b.quantity}× {b.item.name}
          </span>
          <StatusBadge status={b.status} />
        </li>
      ))}
    </ul>
  );
}
