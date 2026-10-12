import type { MeResponse } from '@/lib/api';
import { AdminNavbar } from './admin-navbar';
import { AdminHome } from './admin-home';

// Self-contained page, mirroring components/secretary/secretary-
// dashboard.tsx and components/caretaker/caretaker-dashboard.tsx: Sports
// Admin now owns its own full-page shell (navbar + Home) instead of the
// generic nav+main shell app/dashboard/page.tsx used to render for it.
export function AdminDashboard({ me }: { me: MeResponse }) {
  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <AdminNavbar me={me} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <AdminHome me={me} />
      </main>
    </div>
  );
}
