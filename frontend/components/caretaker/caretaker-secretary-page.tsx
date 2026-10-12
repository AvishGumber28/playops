'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, HostelDetail, HostelRef } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { HostelMemberCard, type HostelMemberInfo } from './hostel-member-card';

// Illustrative placeholders for the three non-functional cards (Proctor,
// Mess Secretary, Gym Secretary) - explicitly requested as dummy for now.
// Not read from or written to the backend anywhere; only Sports
// Secretary below is real (D-011/D-012).
const DUMMY_PROCTOR: HostelMemberInfo = {
  name: 'Dr. Anil Kapoor',
  email: 'proctor.warden@thapar.edu',
  rollNumber: 'FAC-W-014',
};
const DUMMY_MESS_SECRETARY: HostelMemberInfo = {
  name: 'Priya Nair',
  email: 'priya.mess@thapar.edu',
  rollNumber: '2023EEB1077',
};
const DUMMY_GYM_SECRETARY: HostelMemberInfo = {
  name: 'Karan Malhotra',
  email: 'karan.gym@thapar.edu',
  rollNumber: '2022MEB1103',
};

// The hostel committee grid - four member cards. Sports Secretary is the
// only real, appointable one (D-011); moved here from the old input-in-
// a-Card layout into this card-gallery shape per request. rollNumber/
// photoUrl on the real card are that person's own self-reported values
// (D-012), read via GET /api/hostels/:hostelId - never invented here.
export function CaretakerSecretaryPage({ hostel }: { hostel: HostelRef }) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<HostelDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!token) return;
    try {
      setDetail(await api.getHostelDetail(token, hostel.id));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load hostel details.');
    }
  }, [token, hostel.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetail();
  }, [loadDetail]);

  async function handleAppointSecretary(email: string) {
    if (!token) return;
    await api.appointSecretary(token, hostel.id, email);
    await loadDetail();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Hostel Committee</h1>
      <p className="mt-1 text-sm text-white/50">
        Key contacts for this hostel. Only <span className="text-white/80">Sports Secretary</span>{' '}
        is real and appointable here — Proctor, Mess Secretary, and Gym Secretary are shown for
        illustration only for now.
      </p>

      {loadError && <p className="mt-4 text-sm text-red-400">{loadError}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HostelMemberCard
          roleLabel="Proctor"
          roleBadgeClassName="bg-indigo-500/20 text-indigo-300"
          member={DUMMY_PROCTOR}
        />
        <HostelMemberCard
          roleLabel="Sports Secretary"
          roleBadgeClassName="bg-playops-amber/20 text-playops-amber"
          member={detail?.sportsSecretary ?? null}
          highlighted
          managedByYou
          onAppoint={handleAppointSecretary}
        />
        <HostelMemberCard
          roleLabel="Mess Secretary"
          roleBadgeClassName="bg-emerald-500/20 text-emerald-300"
          member={DUMMY_MESS_SECRETARY}
        />
        <HostelMemberCard
          roleLabel="Gym Secretary"
          roleBadgeClassName="bg-violet-500/20 text-violet-300"
          member={DUMMY_GYM_SECRETARY}
        />
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-playops-dark-surface px-4 py-3 text-xs text-white/50">
        Appointing (or replacing) the Sports Secretary immediately switches that account&apos;s
        dashboard from Student to Secretary — nothing else changes for the other three cards.
      </div>
    </div>
  );
}
