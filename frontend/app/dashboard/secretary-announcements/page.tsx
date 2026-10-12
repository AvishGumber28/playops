'use client';

import { useSecretaryGuard } from '@/components/secretary/use-secretary-guard';
import { SecretaryNavbar } from '@/components/secretary/secretary-navbar';
import { SecretaryAnnouncementsPage } from '@/components/secretary/secretary-announcements-page';

export default function SecretaryAnnouncementsRoute() {
  const me = useSecretaryGuard();

  if (!me) {
    return <p className="min-h-screen bg-playops-dark-bg p-6 text-white/60">Loading…</p>;
  }

  const hostel = me.secretaryOfHostels[0];

  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <SecretaryNavbar me={me} hostel={hostel} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <SecretaryAnnouncementsPage />
      </main>
    </div>
  );
}
