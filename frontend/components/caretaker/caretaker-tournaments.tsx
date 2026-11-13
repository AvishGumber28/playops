'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { StandingsModal } from '@/components/tournament/standings-modal';
import { sportColor } from '@/lib/sport-colors';

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

function SportPill({ sportName }: { sportName: string }) {
  const color = sportColor(sportName);
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${color.badge}`}
    >
      {sportName}
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

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return start === end || formatDate(start) === formatDate(end)
    ? formatDate(start)
    : `${formatDate(start)} – ${formatDate(end)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// The compact card shows the fields that matter at a glance; clicking it
// (anywhere but View Standings) opens this for the full picture. This is
// the designated landing spot for any future tournament field - add new
// ones here rather than growing the compact card further.
function TournamentDetailsModal({
  tournament,
  onClose,
}: {
  tournament: Tournament;
  onClose: () => void;
}) {
  const color = sportColor(tournament.sport.name);
  const dateRange = formatDateRange(tournament.dateRangeStart, tournament.dateRangeEnd);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} />
            <h2 className="text-lg font-bold text-white">{tournament.name}</h2>
            <StatusPill status={tournament.status} />
            <SportPill sportName={tournament.sport.name} />
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

        {tournament.description && (
          <p className="mt-3 text-sm text-white/70">{tournament.description}</p>
        )}

        {tournament.status === 'cancelled' && tournament.cancellationReason && (
          <p className="mt-2 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
            Cancelled: {tournament.cancellationReason}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">Format</dt>
            <dd className="mt-0.5 text-white">{tournament.format}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">Teams</dt>
            <dd className="mt-0.5 text-white">
              {tournament.teamCount} {tournament.teamCount === 1 ? 'team' : 'teams'}
              {tournament.playerCount > 0 && ` (${tournament.playerCount} players)`}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">
              Registration deadline
            </dt>
            <dd className="mt-0.5 text-white">{formatDate(tournament.registrationDeadline)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">
              Match schedule
            </dt>
            <dd className="mt-0.5 text-white">{dateRange ?? 'Not generated yet'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">Venue</dt>
            <dd className="mt-0.5 text-white">{tournament.venueSummary ?? 'Not booked yet'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">Created</dt>
            <dd className="mt-0.5 text-white">{formatDateTime(tournament.createdAt)}</dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/30">
          Managed by this hostel&apos;s Sports Secretary - team approvals, fixtures, and
          cancellation happen from their dashboard.
        </p>
      </div>
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const color = sportColor(tournament.sport.name);
  const dateRange = formatDateRange(tournament.dateRangeStart, tournament.dateRangeEnd);

  return (
    <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => setShowDetails(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setShowDetails(true);
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} />
            <h3 className="font-semibold text-white hover:underline">{tournament.name}</h3>
            <StatusPill status={tournament.status} />
            <SportPill sportName={tournament.sport.name} />
          </div>

          {tournament.description && (
            <p className="mt-1.5 max-w-prose text-sm text-white/60">{tournament.description}</p>
          )}

          {tournament.status === 'cancelled' && tournament.cancellationReason && (
            <p className="mt-1.5 text-xs text-red-400">Cancelled: {tournament.cancellationReason}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
            <span className="uppercase">{tournament.format}</span>
            <span>
              {tournament.teamCount} {tournament.teamCount === 1 ? 'Team' : 'Teams'}
              {tournament.playerCount > 0 && ` (${tournament.playerCount} Players)`}
            </span>
            <span>
              {dateRange ?? `Registration by ${formatDate(tournament.registrationDeadline)}`}
            </span>
            {tournament.venueSummary && <span>{tournament.venueSummary}</span>}
          </div>
        </div>

        {/* FR-011: knockout has no standings table - only bracket progression. */}
        {tournament.format === 'league' && (
          <button
            type="button"
            onClick={() => setShowStandings(true)}
            className="shrink-0 rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/20"
          >
            View Standings
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-white/30">
        Managed by this hostel&apos;s Sports Secretary - team approvals, fixtures, and
        cancellation happen from their dashboard.
      </p>

      {showDetails && (
        <TournamentDetailsModal tournament={tournament} onClose={() => setShowDetails(false)} />
      )}

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Tournaments</h1>
      <p className="mt-1 text-sm text-white/50">
        Read-only view of this hostel&apos;s tournaments, run by its Sports Secretary.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-3">
        {tournaments === null ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : tournaments.length === 0 ? (
          <p className="text-sm text-white/40">No tournaments yet.</p>
        ) : (
          tournaments.map((t) => <TournamentCard key={t.id} tournament={t} />)
        )}
      </div>
    </div>
  );
}
