'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, HostelDetail, HostelRef, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PendingChangeRequestsList } from './pending-change-requests-list';

// Not the shared HostelHeader (components/hostel-header.tsx) - that one
// uses theme tokens (bg-primary etc.) tuned for the Student dashboard's
// light page. This is a fixed-dark equivalent, kept local since it's
// only ever right for this dark section.
function CaretakerPageHeader({ hostel }: { hostel: HostelRef }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-playops-amber text-lg font-bold text-playops-charcoal">
        {hostel.code}
      </span>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{hostel.name}</h1>
        <p className="text-sm text-white/50">Caretaker Dashboard</p>
      </div>
    </div>
  );
}

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

export function CaretakerHome({ hostel }: { hostel: HostelRef }) {
  const { token } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<HostelDetail | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!token) return;
    try {
      const [d, t] = await Promise.all([
        api.getHostelDetail(token, hostel.id),
        api.listTournamentsForCaretaker(token),
      ]);
      setDetail(d);
      setTournaments(t);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load hostel details.');
    }
  }, [token, hostel.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetail();
  }, [loadDetail]);

  const activeTournaments = tournaments?.filter((t) => t.status === 'in_progress').length ?? null;

  return (
    <div>
      <CaretakerPageHeader hostel={hostel} />

      {loadError && <p className="mb-4 text-sm text-red-400">{loadError}</p>}

      {/* Tournament count is real data now (D-025's read-only Caretaker
          endpoint). Hostel Members still has no backing endpoint -
          nothing elsewhere in the app needs a resident-count yet. */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Current Secretary" value={detail?.sportsSecretary?.name ?? 'Vacant'} />
        <StatCard
          label="Active Tournaments"
          value={activeTournaments === null ? '…' : String(activeTournaments)}
        />
        <StatCard label="Hostel Members" value="—" hint="Coming soon" />
      </div>

      <Card className="mb-8 border-white/10 bg-playops-dark-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/50">
              Hostel Secretary
            </p>
            {detail?.sportsSecretary ? (
              <>
                <p className="mt-1 text-lg font-semibold text-white">
                  {detail.sportsSecretary.name}
                </p>
                <p className="text-sm text-white/50">{detail.sportsSecretary.email}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-white/50">Vacant — no Secretary appointed yet.</p>
            )}
          </div>
          <Button
            className="bg-playops-amber text-playops-charcoal hover:bg-playops-amber/90"
            onClick={() => router.push('/dashboard/secretary')}
          >
            Appoint / Replace Secretary
          </Button>
        </CardContent>
      </Card>

      <PendingChangeRequestsList />
    </div>
  );
}
