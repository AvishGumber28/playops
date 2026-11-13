'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, HostelRef, MeResponse, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { NotificationsCard } from '@/components/notifications/notifications-card';

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <Card className="border-white/10 bg-playops-dark-surface">
      <CardContent className="py-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">{label}</p>
        <p className={`mt-1 text-xl font-bold ${accent}`}>{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-white/40">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const STATUS_STYLE: Record<
  string,
  { dot: string; badge: string; action: string; actionLabel: string }
> = {
  registration_open: {
    dot: 'bg-amber-400',
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    action: 'text-amber-300 hover:text-amber-200',
    actionLabel: 'Manage Registrations →',
  },
  in_progress: {
    dot: 'bg-emerald-400',
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    action: 'text-emerald-300 hover:text-emerald-200',
    actionLabel: 'View Fixtures →',
  },
  completed: {
    dot: 'bg-sky-400',
    badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    action: 'text-sky-300 hover:text-sky-200',
    actionLabel: 'View Results →',
  },
  draft: {
    dot: 'bg-white/30',
    badge: 'border-white/10 bg-white/5 text-white/50',
    action: 'text-white/50 hover:text-white/70',
    actionLabel: 'View Details →',
  },
  cancelled: {
    dot: 'bg-red-400/70',
    badge: 'border-red-400/20 bg-red-400/5 text-red-300/80',
    action: 'text-red-300/80 hover:text-red-200',
    actionLabel: 'View Details →',
  },
};

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
            accent="text-emerald-300"
          />
          <StatCard
            label="Tournaments Listed"
            value={tournaments === null ? '…' : String(listedCount)}
            accent="text-sky-300"
          />
          <StatCard
            label="Teams Registered"
            value={tournaments === null ? '…' : String(teamsRegistered)}
            hint="Across all your tournaments"
            accent="text-amber-300"
          />
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-white/10 bg-playops-dark-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Tournaments</h2>
            {tournaments !== null && activeCount > 0 && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {activeCount} active
              </span>
            )}
          </div>
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
            {recent.map((t) => {
              const style = STATUS_STYLE[t.status] ?? STATUS_STYLE.draft;
              return (
                <li key={t.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0">
                      <p className="truncate text-white">{t.name}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {t.sport.name} · <span className="uppercase">{t.format}</span> ·{' '}
                        {t.teamCount} {t.teamCount === 1 ? 'team' : 'teams'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>
                    <Link
                      href="/dashboard/secretary-tournaments"
                      className={`text-xs font-medium ${style.action}`}
                    >
                      {style.actionLabel}
                    </Link>
                  </div>
                </li>
              );
            })}
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
