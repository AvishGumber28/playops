'use client';

import type { HostelRef, MeResponse } from '@/lib/api';
import { StudentChangeHostel } from './student-change-hostel';
import { NotificationsCard } from '@/components/notifications/notifications-card';

// The Student "Home" tab - notifications plus Change Hostel at the
// bottom. Tournaments and Equipment Booking moved to their own tabs
// (student-tournaments.tsx / student-equipment-page.tsx) - same split as
// the Secretary shell.
export function StudentHome({ me, hostel }: { me: MeResponse; hostel: HostelRef }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-playops-amber">
        <span className="h-1.5 w-1.5 rounded-full bg-playops-amber" />
        Student Dashboard
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
        {hostel.name} <span className="text-white/40">(Hostel {hostel.code})</span>
      </h1>
      <p className="mt-1 text-sm text-white/50">Welcome back, {me.name}.</p>

      <div className="mt-8">
        <NotificationsCard />
      </div>

      <div className="mt-4">
        <StudentChangeHostel currentHostelId={hostel.id} />
      </div>
    </div>
  );
}
