'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, EquipmentBooking } from '@/lib/api';
import { showToast, ToastStack } from '@/components/ui/toast';
import { RoleTag } from '@/components/equipment/status-badge';
import { Panel } from '@/components/equipment/panel';

// FR-008 (Equipment Booking) - Sports Admin side, Bookings only (Pending
// Requests / Active-Checked-Out / Returned History). Split out from the
// combined Equipment page so Inventory (admin-inventory-page.tsx) is its
// own nav destination. Approving/rejecting/returning here is
// immediately visible on the Student/Secretary pages too (same backend
// data, no client-side caching to go stale).
export function AdminBookingsPage() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<EquipmentBooking[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setBookings(await api.allEquipmentBookings(token));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load bookings.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loadError) {
    return <p className="text-sm text-red-400">{loadError}</p>;
  }
  if (bookings === null) {
    return <p className="text-sm text-white/40">Loading bookings…</p>;
  }

  const pending = bookings
    .filter((b) => b.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const active = bookings
    .filter((b) => b.status === 'checked_out')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const returned = bookings
    .filter((b) => b.status === 'returned')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Bookings</h1>
      <p className="mt-1 text-sm text-white/50">
        Every equipment request, from first submission through to being returned.
      </p>

      <div className="mt-6 space-y-6">
        <PendingRequestsPanel pending={pending} onChanged={load} />
        <ActiveBookingsPanel active={active} onChanged={load} />
        <ReturnedHistoryPanel returned={returned} />
      </div>

      <ToastStack />
    </div>
  );
}

function PendingRequestsPanel({
  pending,
  onChanged,
}: {
  pending: EquipmentBooking[];
  onChanged: () => Promise<void>;
}) {
  const { token } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function approve(booking: EquipmentBooking) {
    if (!token) return;
    setErrors((prev) => ({ ...prev, [booking.id]: '' }));
    setBusyId(booking.id);
    try {
      await api.approveEquipmentBooking(token, booking.id);
      showToast(`Approved ${booking.quantity}× ${booking.item.name} for ${booking.requestedBy?.name ?? 'them'}.`, 'success');
      await onChanged();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [booking.id]: err instanceof ApiError ? err.message : 'Something went wrong.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(booking: EquipmentBooking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      await api.rejectEquipmentBooking(token, booking.id);
      showToast(`Rejected ${booking.requestedBy?.name ?? 'their'}'s request for ${booking.item.name}.`, 'success');
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title={`Pending Requests (${pending.length})`}>
      {pending.length === 0 ? (
        <p className="text-sm text-white/40">No pending requests right now.</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((b) => (
            <li key={b.id} className="rounded-md border border-white/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white">
                  <span className="font-medium">
                    {b.quantity}× {b.item.name}
                  </span>
                  <span className="text-white/50"> — requested by {b.requestedBy?.name ?? 'Unknown'}</span>{' '}
                  <RoleTag role={b.requestedByRole} />
                </p>
                <div className="flex gap-2">
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
                </div>
              </div>
              {errors[b.id] && <p className="mt-1 text-[11px] text-red-400">{errors[b.id]}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ActiveBookingsPanel({
  active,
  onChanged,
}: {
  active: EquipmentBooking[];
  onChanged: () => Promise<void>;
}) {
  const { token } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markReturned(booking: EquipmentBooking) {
    if (!token) return;
    if (
      !window.confirm(
        `Mark ${booking.quantity}× ${booking.item.name} as returned by ${booking.requestedBy?.name ?? 'them'}?`,
      )
    ) {
      return;
    }
    setBusyId(booking.id);
    try {
      await api.returnEquipmentBooking(token, booking.id);
      showToast(`Marked ${booking.item.name} returned.`, 'success');
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title={`Active / Checked-Out (${active.length})`}>
      {active.length === 0 ? (
        <p className="text-sm text-white/40">Nothing checked out right now.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 p-3"
            >
              <p className="text-sm text-white">
                <span className="font-medium">
                  {b.quantity}× {b.item.name}
                </span>
                <span className="text-white/50"> — {b.requestedBy?.name ?? 'Unknown'}</span>{' '}
                <RoleTag role={b.requestedByRole} />
              </p>
              <button
                type="button"
                onClick={() => markReturned(b)}
                disabled={busyId === b.id}
                className="rounded border border-white/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                {busyId === b.id ? 'Saving…' : 'Mark Returned'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReturnedHistoryPanel({ returned }: { returned: EquipmentBooking[] }) {
  return (
    <details className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
      <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-white/70">
        Returned History ({returned.length})
      </summary>
      <div className="mt-3">
        {returned.length === 0 ? (
          <p className="text-sm text-white/40">Nothing returned yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {returned.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-white/70">
                  {b.quantity}× {b.item.name} — {b.requestedBy?.name ?? 'Unknown'}
                </span>
                <RoleTag role={b.requestedByRole} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
