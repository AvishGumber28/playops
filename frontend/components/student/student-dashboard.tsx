'use client';

import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import type { MeResponse } from '@/lib/api';
import { HostelSelector } from '../hostel-selector';
import { StudentNavbar } from './student-navbar';
import { StudentHome } from './student-home';

// Self-contained page, mirroring components/secretary/secretary-
// dashboard.tsx and components/admin/admin-dashboard.tsx: Student now
// owns its own full-page shell (navbar with 3 nav destinations + Home)
// instead of the generic nav+main shell app/dashboard/page.tsx used to
// render for it.
export function StudentDashboard({ me }: { me: MeResponse }) {
  const { logout } = useAuth();

  // FR-003: a student without a hostel yet can't do much else in the
  // system - selecting one is the very first thing they need to do, and
  // none of the new tabs (Tournaments/Equipment) make sense before that,
  // so this keeps the original plain, unbranded onboarding shell rather
  // than the full dark navbar.
  if (!me.hostel) {
    return (
      <div>
        <nav className="flex items-center justify-between border-b px-8 py-4">
          <span className="text-lg font-bold">PlayOps</span>
          <Button variant="ghost" onClick={logout}>
            Sign out
          </Button>
        </nav>
        <main className="mx-auto max-w-2xl px-6 py-10">
          <HostelSelector />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <StudentNavbar me={me} hostel={me.hostel} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <StudentHome me={me} hostel={me.hostel} />
      </main>
    </div>
  );
}
