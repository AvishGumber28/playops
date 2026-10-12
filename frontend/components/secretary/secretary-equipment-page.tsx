'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, EquipmentBooking, EquipmentItem } from '@/lib/api';
import { showToast, ToastStack } from '@/components/ui/toast';
import { EquipmentBookingList } from '@/components/equipment/equipment-booking-list';
import { MyBookingsList } from '@/components/equipment/my-bookings-list';

// FR-008 (Equipment Booking) - Secretary side. Reuses the same browsing
// grid as the Student page (components/equipment/equipment-booking-
// list.tsx) - both roles submit a pending request that doesn't touch
// stock until the Sports Department approves it
// (components/admin/admin-bookings-page.tsx).
export function SecretaryEquipmentPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<EquipmentItem[] | null>(null);
  const [myBookings, setMyBookings] = useState<EquipmentBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [i, mine] = await Promise.all([
        api.listEquipment(token),
        api.myEquipmentBookings(token),
      ]);
      setItems(i);
      setMyBookings(mine);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load equipment.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleRequest(itemId: string, quantity: number) {
    if (!token) return { ok: false as const, error: 'Not signed in.' };
    try {
      const item = items?.find((i) => i.id === itemId);
      await api.requestEquipment(token, itemId, quantity);
      showToast(
        `Requested ${quantity}× ${item?.name ?? 'item'} — waiting on Sports Department approval.`,
        'success',
      );
      await load();
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof ApiError ? err.message : 'Something went wrong.',
      };
    }
  }

  const loading = items === null || myBookings === null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Equipment Booking</h1>
      <p className="mt-1 text-sm text-white/50">
        Request equipment for your hostel&apos;s tournaments — the Sports Department approves
        or rejects each request before stock is set aside.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-white/40">Loading equipment…</p>
      ) : (
        <div className="mt-6">
          <EquipmentBookingList items={items} onRequest={handleRequest} />
        </div>
      )}

      <div className="mt-8 rounded-lg border border-white/10 bg-playops-dark-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">My Requests</h2>
        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : (
            <MyBookingsList
              bookings={myBookings}
              emptyText="You haven't requested any equipment yet."
            />
          )}
        </div>
      </div>

      <ToastStack />
    </div>
  );
}
