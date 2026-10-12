import type { MeResponse } from '@/lib/api';
import { SecretaryNavbar } from './secretary-navbar';
import { SecretaryHome } from './secretary-home';

// Self-contained page, mirroring components/caretaker/caretaker-
// dashboard.tsx: Secretary now owns its own full-page shell (navbar with
// 3 nav destinations + this page's content) instead of the generic
// nav+main shell app/dashboard/page.tsx still uses for Student/
// SportsAdmin.
export function SecretaryDashboard({ me }: { me: MeResponse }) {
  const hostel = me.secretaryOfHostels[0];

  if (!hostel) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Sports Secretary dashboard</h2>
        <p className="mt-2 text-muted-foreground">No hostel assignment found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <SecretaryNavbar me={me} hostel={hostel} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <SecretaryHome me={me} hostel={hostel} />
      </main>
    </div>
  );
}
