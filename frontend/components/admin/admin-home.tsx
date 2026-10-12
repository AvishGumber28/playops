'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, EquipmentBooking, EquipmentItem, VenueBooking } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import type { MeResponse } from '@/lib/api';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-white/10 bg-playops-dark-surface">
      <CardContent className="py-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">{label}</p>
        <p className="mt-1 text-xl font-bold text-white">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-white/40">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function AdminHome({ me }: { me: MeResponse }) {
  const { token } = useAuth();
  const [items, setItems] = useState<EquipmentItem[] | null>(null);
  const [equipmentBookings, setEquipmentBookings] = useState<EquipmentBooking[] | null>(null);
  const [venueBookings, setVenueBookings] = useState<VenueBooking[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [i, eb, vb] = await Promise.all([
        api.listEquipment(token),
        api.allEquipmentBookings(token),
        api.allVenueBookings(token),
      ]);
      setItems(i);
      setEquipmentBookings(eb);
      setVenueBookings(vb);
    } catch {
      setItems([]);
      setEquipmentBookings([]);
      setVenueBookings([]);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const loading = items === null || equipmentBookings === null || venueBookings === null;
  const pendingCount = equipmentBookings?.filter((b) => b.status === 'pending').length ?? 0;
  const checkedOutCount = equipmentBookings?.filter((b) => b.status === 'checked_out').length ?? 0;
  const venuePendingCount = venueBookings?.filter((b) => b.status === 'pending').length ?? 0;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-playops-amber">
        <span className="h-1.5 w-1.5 rounded-full bg-playops-amber" />
        Sports Department Desk
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Welcome, {me.name}</h1>
      <p className="mt-1 text-sm text-white/50">
        Equipment and venue booking approvals, college-wide.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Equipment Items" value={loading ? '…' : String(items.length)} />
        <StatCard
          label="Equipment Pending"
          value={loading ? '…' : String(pendingCount)}
          hint="From Students & Secretaries"
        />
        <StatCard
          label="Currently Checked Out"
          value={loading ? '…' : String(checkedOutCount)}
        />
        <StatCard
          label="Venue Requests Pending"
          value={loading ? '…' : String(venuePendingCount)}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Inventory</h2>
            <Link
              href="/dashboard/admin-inventory"
              className="text-xs font-medium text-playops-amber hover:underline"
            >
              Manage →
            </Link>
          </div>
          <p className="mt-2 text-sm text-white/50">
            Stock new equipment, edit or remove items, and see what&apos;s available.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Equipment Booking
            </h2>
            <Link
              href="/dashboard/admin-bookings"
              className="text-xs font-medium text-playops-amber hover:underline"
            >
              Manage →
            </Link>
          </div>
          <p className="mt-2 text-sm text-white/50">
            Approve or reject requests, and mark checked-out equipment returned.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Venue Booking
            </h2>
            <Link
              href="/dashboard/admin-venue"
              className="text-xs font-medium text-playops-amber hover:underline"
            >
              Manage →
            </Link>
          </div>
          <p className="mt-2 text-sm text-white/50">
            Approve or reject ground-slot requests across Cricket, Football, and Basketball.
          </p>
        </div>
      </div>
    </div>
  );
}
