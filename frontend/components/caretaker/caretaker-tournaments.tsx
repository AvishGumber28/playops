'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { StandingsModal } from '@/components/tournament/standings-modal';

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  registration_open: { label: 'Registration Open', className: 'bg-playops-amber/20 text-playops-amber' },
  in_progress: { label: 'In Progress', className: 'bg-emerald-500/20 text-emerald-300' },
  completed: { label: 'Completed', className: 'bg-white/10 text-white/60' },
  draft: { label: 'Draft', className: 'bg-white/10 text-white/60' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-300' },
};

function StatusPill({ status }: { status: string }) {
  const pill = STATUS_PILL[status] ?? { label: status, className: 'bg-white/10 text-white/60' };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pill.className}`}
    >
      {pill.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// D-025 / D-026: the main list only ever shows name + status - click a
// row to open its detail popup. The Caretaker is read-only here - no
// Fixtures/Cancel/Delete, those stay Secretary-only (that's a separate
// access decision this view doesn't change).
function TournamentRow({ tournament, onOpen }: { tournament: Tournament; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-playops-dark-surface p-4 text-left transition-colors hover:border-playops-amber/40"
    >
      <p className="font-semibold text-white">{tournament.name}</p>
      <StatusPill status={tournament.status} />
    </button>
  );
}

function TournamentDetailModal({
  tournament,
  onClose,
}: {
  tournament: Tournament;
  onClose: () => void;
}) {
  const [showStandings, setShowStandings] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">{tournament.name}</h2>
            <p className="mt-0.5 text-sm text-white/50">
              {tournament.sport.name} · <span className="uppercase">{tournament.format}</span> ·
              registration by {formatDate(tournament.registrationDeadline)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusPill status={tournament.status} />
          <span className="text-xs text-white/50">
            {tournament.teamCount} team{tournament.teamCount === 1 ? '' : 's'} registered
          </span>
          {/* FR-011: knockout has no standings table - only bracket progression. */}
          {tournament.format === 'league' && (
            <button
              type="button"
              onClick={() => setShowStandings(true)}
              className="text-xs font-medium text-playops-amber hover:underline"
            >
              View Standings
            </button>
          )}
        </div>

        {tournament.status === 'cancelled' && tournament.cancellationReason && (
          <p className="mt-3 text-xs text-red-400">Cancelled: {tournament.cancellationReason}</p>
        )}

        <p className="mt-4 text-xs text-white/40">
          Managed by this hostel&apos;s Sports Secretary - team approvals, fixtures, and
          cancellation happen from their dashboard.
        </p>
      </div>

      {showStandings && (
        <StandingsModal
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          onClose={() => setShowStandings(false)}
        />
      )}
    </div>
  );
}

export function CaretakerTournaments() {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setTournaments(await api.listTournamentsForCaretaker(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tournaments.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const selected = tournaments?.find((t) => t.id === selectedId) ?? null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Tournaments</h1>
      <p className="mt-1 text-sm text-white/50">
        Read-only view of this hostel&apos;s tournaments, run by its Sports Secretary. Click one
        for details.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-3">
        {tournaments === null ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : tournaments.length === 0 ? (
          <p className="text-sm text-white/40">No tournaments yet.</p>
        ) : (
          tournaments.map((t) => (
            <TournamentRow key={t.id} tournament={t} onOpen={() => setSelectedId(t.id)} />
          ))
        )}
      </div>

      {selected && <TournamentDetailModal tournament={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
