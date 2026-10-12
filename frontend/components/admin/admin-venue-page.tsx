'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, VenueBooking, VenueRef } from '@/lib/api';
import { todayIso } from '@/lib/venue-constants';
import { showToast, ToastStack } from '@/components/ui/toast';
import { RoleTag } from '@/components/equipment/status-badge';
import { GroundPicker } from '@/components/venue/ground-picker';
import { VenueSlotModal } from '@/components/venue/venue-slot-modal';
import { VenueStatusBadge } from '@/components/venue/venue-status-badge';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

// FR-008 (Venue Booking) - Sports Admin side. Left: the same date +
// ground-picker + read-only slot card Student/Secretary get - no inline
// actions here. Right: "All Requests", filterable, and the ONLY place
// Approve/Reject happen. Approving one request auto-rejects every other
// still-pending request for that exact slot (backend).
export function AdminVenuePage() {
  const { token } = useAuth();
  const [venues, setVenues] = useState<VenueRef[] | null>(null);
  const [bookings, setBookings] = useState<VenueBooking[] | null>(null);
  const [date, setDate] = useState(todayIso());
  const [openVenue, setOpenVenue] = useState<VenueRef | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [v, all] = await Promise.all([api.listVenues(token), api.allVenueBookings(token)]);
      setVenues(v);
      setBookings(all);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load venues.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(booking: VenueBooking) {
    if (!token) return;
    setErrors((prev) => ({ ...prev, [booking.id]: '' }));
    setBusyId(booking.id);
    try {
      await api.approveVenueBooking(token, booking.id);
      showToast(`Approved ${booking.venue.name}, ${booking.hour} on ${booking.date}.`, 'success');
      await load();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [booking.id]: err instanceof ApiError ? err.message : 'Something went wrong.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(booking: VenueBooking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      await api.rejectVenueBooking(token, booking.id);
      showToast(
        `Rejected ${booking.requestedBy?.name ?? 'that'}'s request for ${booking.venue.name}, ${booking.hour}.`,
        'success',
      );
      await load();
    } catch {
      // surfaced via the row's own error state below, on retry
    } finally {
      setBusyId(null);
    }
  }

  const loading = venues === null || bookings === null;
  const allSorted = bookings ? [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const filtered = allSorted.filter((b) => (filter === 'all' ? true : b.status === filter));

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Venue Booking</h1>
      <p className="mt-1 text-sm text-white/50">
        Approve or reject ground-slot requests from Students and Secretaries, college-wide.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <label htmlFor="admin-venue-date" className="text-xs font-medium text-white/70">
            Date
          </label>
          <input
            id="admin-venue-date"
            type="date"
            value={date}
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
          {loadError && <p className="mt-3 text-sm text-red-400">{loadError}</p>}
        </div>

        <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">All Requests</h2>
            <div className="flex gap-1">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={
                    'rounded-md border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ' +
                    (filter === f
                      ? 'border-playops-amber bg-playops-amber/20 text-playops-amber'
                      : 'border-white/15 text-white/60 hover:bg-white/5')
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-white/40">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-white/40">No requests yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {filtered.map((b) => (
                  <li key={b.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <p className="text-white">
                          {b.venue.name} · {b.date} · {b.hour}
                        </p>
                        <p className="mt-0.5 text-xs text-white/50">
                          {b.requestedBy?.name ?? 'Unknown'} <RoleTag role={b.requestedByRole} />
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <VenueStatusBadge status={b.status} />
                        {b.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => approve(b)}
                              disabled={busyId === b.id}
                              className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {busyId === b.id ? '…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => reject(b)}
                              disabled={busyId === b.id}
                              className="rounded border border-white/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
                            >
                              {busyId === b.id ? '…' : 'Reject'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {errors[b.id] && <p className="mt-1 text-[11px] text-red-400">{errors[b.id]}</p>}
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
          onClose={() => setOpenVenue(null)}
        />
      )}

      <ToastStack />
    </div>
  );
}
