'use client';

import { useCaretakerGuard } from '@/components/caretaker/use-caretaker-guard';
import { CaretakerNavbar } from '@/components/caretaker/caretaker-navbar';
import { CaretakerSecretaryPage } from '@/components/caretaker/caretaker-secretary-page';

export default function CaretakerSecretaryRoute() {
  const me = useCaretakerGuard();

  if (!me) {
    return <p className="min-h-screen bg-playops-dark-bg p-6 text-white/60">Loading…</p>;
  }

  const hostel = me.caretakerOfHostels[0];

  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <CaretakerNavbar me={me} hostel={hostel} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <CaretakerSecretaryPage hostel={hostel} />
      </main>
    </div>
  );
}
