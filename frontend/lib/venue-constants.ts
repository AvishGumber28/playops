import type { VenueBooking } from './api';

// Mirrors backend/src/modules/venue/venue.constants.ts's SLOT_HOURS -
// same duplication-across-the-boundary the rest of this project already
// accepts for enum-shaped values (no shared package between
// frontend/backend).
export const SLOT_HOURS = [
  '06:00-07:00',
  '07:00-08:00',
  '08:00-09:00',
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
  '19:00-20:00',
] as const;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// The grid/card only ever needs to know whether a slot is Booked - a
// pending request, from anyone, never changes what it shows (D-style
// product decision: multiple people can hold a pending request on the
// same slot; approving one auto-rejects the rest).
export function approvedBookingForSlot(
  bookings: VenueBooking[],
  venueId: string,
  date: string,
  hour: string,
): VenueBooking | undefined {
  return bookings.find(
    (b) => b.venueId === venueId && b.date === date && b.hour === hour && b.status === 'approved',
  );
}
