'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, VenueBooking, VenueRef } from '@/lib/api';
import { todayIso } from '@/lib/venue-constants';
import { showToast, ToastStack } from '@/components/ui/toast';
import { GroundPicker } from './ground-picker';
import { VenueSlotModal } from './venue-slot-modal';
import { VenueStatusBadge } from './venue-status-badge';

// FR-008 (Venue Booking) - Student & Secretary side, one shared
// component - the backend derives which role a request is submitted as
// from the signed-in account (same as Equipment), so this needs no role
// prop at all. Two-column layout: pick a date + ground on the left (a
// slot card pops up), requests and their status live on the right.
// Requesting a slot creates a `pending` booking - the Sports Department
// approves or rejects it from components/admin/admin-venue-page.tsx.
export function VenueRequestPage() {
  const { token } = useAuth();
  const [venues, setVenues] = useState<VenueRef[] | null>(null);
  const [bookings, setBookings] = useState<VenueBooking[] | null>(null);
  const [myRequests, setMyRequests] = useState<VenueBooking[] | null>(null);
  const [date, setDate] = useState(todayIso());
  const [openVenue, setOpenVenue] = useState<VenueRef | null>(null);
  const [busyHour, setBusyHour] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [v, all, mine] = await Promise.all([
        api.listVenues(token),
        api.allVenueBookings(token),
        api.myVenueBookings(token),
      ]);
      setVenues(v);
      setBookings(all);
      setMyRequests(mine);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load venues.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleRequest(hour: string) {
    if (!token || !openVenue) return;
    const confirmed = window.confirm(`Request ${openVenue.name}, ${hour} on ${date}?`);
    if (!confirmed) return;
    setError(null);
    setBusyHour(hour);
    try {
      await api.requestVenue(token, openVenue.id, date, hour);
      showToast(
        `Requested ${openVenue.name}, ${hour} — waiting on Sports Department approval.`,
        'success',
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusyHour(null);
    }
  }

  const loading = venues === null || bookings === null || myRequests === null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Venue Booking</h1>
      <p className="mt-1 text-sm text-white/50">
        Request a 1-hour slot on a ground — the Sports Department approves or rejects each
        request.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <label htmlFor="venue-date" className="text-xs font-medium text-white/70">
            Date
          </label>
          <input
            id="venue-date"
            type="date"
            value={date}
            min={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber [color-scheme:dark]"
          />

          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-white/50">
            Pick a ground
          </p>
          <div className="mt-2">
            {venues === null ? (
              <p className="text-sm text-white/40">Loading…</p>
            ) : (
              <GroundPicker venues={venues} onSelect={setOpenVenue} />
            )}
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">My Requests</h2>
          <div className="mt-3">
            {loading ? (
              <p className="text-sm text-white/40">Loading…</p>
            ) : myRequests.length === 0 ? (
              <p className="text-sm text-white/40">You haven&apos;t requested a venue slot yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {myRequests.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-white">
                      {b.venue.name} · {b.date} · {b.hour}
                    </span>
                    <VenueStatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {openVenue && bookings && (
        <VenueSlotModal
          venue={openVenue}
          date={date}
          bookings={bookings}
          onSlotClick={handleRequest}
          busyHour={busyHour}
          onClose={() => setOpenVenue(null)}
        />
      )}

      <ToastStack />
    </div>
  );
}
