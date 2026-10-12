import type { MeResponse } from '@/lib/api';
import { CaretakerNavbar } from './caretaker-navbar';
import { CaretakerHome } from './caretaker-home';

// Self-contained page: unlike the other three roles (which share the
// generic nav+main shell in app/dashboard/page.tsx), Caretaker now owns
// its own full-page shell (navbar with 3 nav destinations + this page's
// content) - see app/dashboard/page.tsx's role dispatch for why.
export function CaretakerDashboard({ me }: { me: MeResponse }) {
  // A Caretaker is unique to at most one hostel (Hostel.caretakerUserId is
  // a unique column - see database-design.md), so this array only ever
  // has zero or one entries in practice.
  const hostel = me.caretakerOfHostels[0];

  if (!hostel) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Caretaker dashboard</h2>
        <p className="mt-2 text-muted-foreground">No hostel assignment found.</p>
      </div>
    );
  }

  return (
    // Fixed dark theme (bg-playops-dark-bg etc.), not the auto light/dark
    // swap - same reasoning as the login hero panel: always looks the
    // same regardless of the visitor's system color-scheme setting.
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <CaretakerNavbar me={me} hostel={hostel} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <CaretakerHome hostel={hostel} />
      </main>
    </div>
  );
}
