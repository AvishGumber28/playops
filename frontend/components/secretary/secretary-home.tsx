'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, HostelRef, MeResponse, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { NotificationsCard } from '@/components/notifications/notifications-card';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-white/10 bg-playops-dark-surface">
      <CardContent className="py-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">{label}</p>
        <p className="mt-1 text-xl font-bold text-white">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-white/40">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function SecretaryHome({ me, hostel }: { me: MeResponse; hostel: HostelRef }) {
  const { token } = useAuth();
  // D-013: seeded from the prop on first render only, then controlled
  // locally (dismiss button) - moved here from components/dashboards.tsx
  // now that the Secretary dashboard has its own Home page.
  const [showWelcome, setShowWelcome] = useState(me.showSecretaryWelcome);
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);

  useEffect(() => {
    if (!me.showSecretaryWelcome || !token) return;
    void api.acknowledgeSecretaryWelcome(token);
  }, [me.showSecretaryWelcome, token]);

  const loadTournaments = useCallback(async () => {
    if (!token) return;
    try {
      setTournaments(await api.listMyTournaments(token));
    } catch {
      setTournaments([]);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTournaments();
  }, [loadTournaments]);

  const activeCount = tournaments?.filter((t) => t.status === 'in_progress').length ?? 0;
  const listedCount = tournaments?.length ?? 0;
  const teamsRegistered = tournaments?.reduce((sum, t) => sum + t.teamCount, 0) ?? 0;
  const recent = tournaments?.slice(0, 3) ?? [];

  return (
    <div>
      {showWelcome && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <p>
            🎉 <span className="font-semibold">Congratulations!</span> You&apos;ve been
            appointed as {hostel.name}&apos;s Sports Secretary.
          </p>
          <button
            type="button"
            onClick={() => setShowWelcome(false)}
            aria-label="Dismiss"
            className="shrink-0 text-emerald-300 hover:text-emerald-100"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-playops-amber">
            <span className="h-1.5 w-1.5 rounded-full bg-playops-amber" />
            Sports Secretary Desk
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            {hostel.name} <span className="text-white/40">(Hostel {hostel.code})</span>
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Sports operations &amp; intramural tournament dashboard
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="In Progress"
            value={tournaments === null ? '…' : String(activeCount)}
          />
          <StatCard
            label="Tournaments Listed"
            value={tournaments === null ? '…' : String(listedCount)}
          />
          <StatCard
            label="Teams Registered"
            value={tournaments === null ? '…' : String(teamsRegistered)}
            hint="Across all your tournaments"
          />
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-white/10 bg-playops-dark-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Tournaments</h2>
          <Link
            href="/dashboard/secretary-tournaments"
            className="text-xs font-medium text-playops-amber hover:underline"
          >
            View all →
          </Link>
        </div>
        {tournaments === null ? (
          <p className="mt-2 text-sm text-white/40">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="mt-2 text-sm text-white/50">
            No tournaments yet — create one from the Tournaments page.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-white">{t.name}</span>
                <span className="text-white/50">
                  {t.sport.name} · <span className="uppercase">{t.format}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-playops-dark-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Announcements</h2>
          <Link
            href="/dashboard/secretary-announcements"
            className="text-xs font-medium text-playops-amber hover:underline"
          >
            View all →
          </Link>
        </div>
        <p className="mt-2 text-sm text-white/50">
          Post one from the Announcements tab — hostel-wide, or narrowed to one of your
          tournaments.
        </p>
      </div>

      <div className="mt-4">
        <NotificationsCard />
      </div>
    </div>
  );
}
