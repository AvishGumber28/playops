'use client';

import type { VenueBooking, VenueRef } from '@/lib/api';
import { SLOT_HOURS, approvedBookingForSlot } from '@/lib/venue-constants';
import { VenueStatusBadge } from './venue-status-badge';

// The card that "pops out" when a ground is picked (ground-picker.tsx) -
// every slot for that venue + date, Booked or Available only (pending
// requests from anyone never change what this shows). Pass
// `onSlotClick` to make Available slots request-able (Student/
// Secretary); omit it for a read-only view (Admin - approving/
// rejecting happens in the requests list, not here).
export function VenueSlotModal({
  venue,
  date,
  bookings,
  onSlotClick,
  busyHour,
  onClose,
}: {
  venue: VenueRef;
  date: string;
  bookings: VenueBooking[];
  onSlotClick?: (hour: string) => void;
  busyHour?: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">{venue.name}</h2>
            <p className="mt-0.5 text-xs text-white/50">{date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 divide-y divide-white/5 rounded-md border border-white/10">
          {SLOT_HOURS.map((hour) => {
            const approved = approvedBookingForSlot(bookings, venue.id, date, hour);
            return (
              <div key={hour} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-white/70">{hour}</span>
                {approved ? (
                  <VenueStatusBadge status="approved" />
                ) : onSlotClick ? (
                  <button
                    type="button"
                    onClick={() => onSlotClick(hour)}
                    disabled={busyHour === hour}
                    className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyHour === hour ? 'Requesting…' : 'Available'}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-400">Available</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
