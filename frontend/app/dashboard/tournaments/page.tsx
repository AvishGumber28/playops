'use client';

import { useCaretakerGuard } from '@/components/caretaker/use-caretaker-guard';
import { CaretakerNavbar } from '@/components/caretaker/caretaker-navbar';
import { CaretakerTournaments } from '@/components/caretaker/caretaker-tournaments';

export default function CaretakerTournamentsPage() {
  const me = useCaretakerGuard();

  if (!me) {
    return <p className="min-h-screen bg-playops-dark-bg p-6 text-white/60">Loading…</p>;
  }

  // useCaretakerGuard() only returns non-null once caretakerOfHostels has
  // at least one entry, so this is safe.
  const hostel = me.caretakerOfHostels[0];

  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <CaretakerNavbar me={me} hostel={hostel} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <CaretakerTournaments />
      </main>
    </div>
  );
}
