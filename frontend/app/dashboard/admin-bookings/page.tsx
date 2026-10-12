'use client';

import { useAdminGuard } from '@/components/admin/use-admin-guard';
import { AdminNavbar } from '@/components/admin/admin-navbar';
import { AdminBookingsPage } from '@/components/admin/admin-bookings-page';

export default function AdminBookingsRoute() {
  const me = useAdminGuard();

  if (!me) {
    return <p className="min-h-screen bg-playops-dark-bg p-6 text-white/60">Loading…</p>;
  }

  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <AdminNavbar me={me} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <AdminBookingsPage />
      </main>
    </div>
  );
}
