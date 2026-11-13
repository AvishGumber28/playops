'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { api, ApiError, Fixtures, RegisteredTeam, SportRef, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { FixturesModal } from './fixtures-modal';
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Roster view for one tournament's registered teams - approve/reject.
// Split out of the card so the card itself stays a plain, data-dense
// summary and this stays a focused popup, the same split every other
// "View X" action on the card uses (fixtures/standings are their own
// modals too).
function TeamsModal({
  tournament,
  onClose,
}: {
  tournament: Tournament;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [teams, setTeams] = useState<RegisteredTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyTeam, setBusyTeam] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      setTeams(await api.listTournamentTeams(token, tournament.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load teams.');
    }
  }, [token, tournament.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTeams();
  }, [loadTeams]);

  async function setStatus(teamId: string, action: 'approve' | 'reject') {
    if (!token) return;
    setError(null);
    setBusyTeam(teamId);
    try {
      if (action === 'approve') await api.approveTeam(token, teamId);
      else await api.rejectTeam(token, teamId);
      await loadTeams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusyTeam(null);
    }
  }

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
          <h2 className="text-lg font-bold text-white">
            {tournament.name} — Teams ({tournament.teamCount})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4">
          {teams === null ? (
            <p className="text-sm text-white/40">Loading teams…</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-white/40">No teams have registered yet.</p>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div key={team.id} className="rounded-md border border-white/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-white">
                      {team.name}
                      <span
                        className={
                          'ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ' +
                          (team.registrationStatus === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300')
                        }
                      >
                        {team.registrationStatus}
                      </span>
                    </p>
                    {team.registrationStatus === 'approved' ? (
                      <button
                        type="button"
                        onClick={() => setStatus(team.id, 'reject')}
                        disabled={busyTeam === team.id}
                        className="rounded border border-white/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStatus(team.id, 'approve')}
                        disabled={busyTeam === team.id}
                        className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/50">
                    {team.players
                      .map((p) => p.name + (p.isCaptain ? ' (captain)' : ''))
                      .join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
// (anywhere but the action buttons) opens this for the full picture.
// This is the designated landing spot for any future tournament field -
// add new ones here rather than growing the compact card further.
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
      </div>
    </div>
  );
}

// D-026 revisited: the card now carries every detail (description, team/
// player counts, schedule span, venue) directly, with each action as its
// own working button, instead of collapsing to name+status behind a
// click-to-open popup. Fixtures/Standings/Teams still open their own
// focused modal - only the "click the whole row first" step is gone.
// Clicking the card's info block (not its action buttons) now also opens
// TournamentDetailsModal above, for the full picture in one place.
function TournamentCard({
  tournament,
  onChanged,
}: {
  tournament: Tournament;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [fixturesBusy, setFixturesBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const color = sportColor(tournament.sport.name);
  const dateRange = formatDateRange(tournament.dateRangeStart, tournament.dateRangeEnd);

  // FR-007 / D-018: generate on first click (while registration is still
  // open), otherwise just reopen the already-generated schedule. D-026:
  // generating is irreversible (closes registration + builds the
  // bracket) - confirm first so an accidental click can't trigger it.
  async function openFixtures() {
    if (!token) return;
    if (tournament.status === 'registration_open') {
      const confirmed = window.confirm(
        `Generate fixtures for "${tournament.name}"? This closes registration and builds the match schedule — it can't be undone.`,
      );
      if (!confirmed) return;
    }
    setError(null);
    setFixturesBusy(true);
    try {
      const result =
        tournament.status === 'registration_open'
          ? await api.generateFixtures(token, tournament.id)
          : await api.getFixtures(token, tournament.id);
      setFixtures(result);
      if (tournament.status === 'registration_open') onChanged(); // status just flipped to in_progress
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load fixtures.');
    } finally {
      setFixturesBusy(false);
    }
  }

  async function del() {
    if (!token) return;
    const hasFixtures = tournament.status === 'cancelled' || tournament.status === 'completed';
    const msg = hasFixtures
      ? `Permanently delete "${tournament.name}"? This removes its teams, fixtures, and booking history for good. This can't be undone.`
      : tournament.teamCount > 0
        ? `Delete "${tournament.name}"? This permanently removes it and its ${tournament.teamCount} registered team(s). This can't be undone.`
        : `Delete "${tournament.name}"? This can't be undone.`;
    if (!window.confirm(msg)) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteTournament(token, tournament.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this tournament.');
      setDeleting(false);
    }
  }

  // D-021: for once fixtures already exist - cancels every remaining
  // match too and frees their venue bookings.
  async function cancel() {
    if (!token) return;
    const reason = window.prompt(
      `Why is "${tournament.name}" being cancelled? This also cancels every remaining match and frees their venue bookings.`,
    );
    if (!reason) return;
    setError(null);
    setCancelling(true);
    try {
      await api.cancelTournament(token, tournament.id, reason);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel this tournament.');
      setCancelling(false);
    }
  }

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

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowTeams(true)}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            View Teams
          </button>
          {(tournament.status === 'registration_open' ||
            tournament.status === 'in_progress' ||
            tournament.status === 'completed') && (
            <button
              type="button"
              onClick={() => void openFixtures()}
              disabled={fixturesBusy}
              className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${color.badge} border`}
            >
              {fixturesBusy
                ? 'Loading…'
                : tournament.status === 'registration_open'
                  ? 'Generate Fixtures'
                  : 'View Fixtures'}
            </button>
          )}
          {/* FR-011: knockout has no standings table - only bracket progression. */}
          {tournament.format === 'league' && (
            <button
              type="button"
              onClick={() => setShowStandings(true)}
              className="rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/20"
            >
              View Standings
            </button>
          )}
          {tournament.status === 'in_progress' && (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
          {/* D-022: Delete is only ever offered pre-fixtures (nothing to
              lose yet) or once the tournament has reached a terminal
              state (cancelled/completed) - never while it's genuinely
              still in progress, matching the backend's own guard. */}
          {(tournament.status === 'draft' ||
            tournament.status === 'registration_open' ||
            tournament.status === 'cancelled' ||
            tournament.status === 'completed') && (
            <button
              type="button"
              onClick={() => void del()}
              disabled={deleting}
              className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/20 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {showDetails && (
        <TournamentDetailsModal tournament={tournament} onClose={() => setShowDetails(false)} />
      )}

      {showTeams && <TeamsModal tournament={tournament} onClose={() => setShowTeams(false)} />}

      {fixtures && (
        <FixturesModal
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          scorecardTemplate={tournament.sport.scorecardTemplate}
          initialFixtures={fixtures}
          onClose={() => setFixtures(null)}
        />
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

export function SecretaryTournamentsPage() {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [sports, setSports] = useState<SportRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sportId, setSportId] = useState('');
  const [format, setFormat] = useState<'knockout' | 'league'>('knockout');
  const [deadline, setDeadline] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [t, s] = await Promise.all([api.listMyTournaments(token), api.listSports(token)]);
      setTournaments(t);
      setSports(s);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load tournaments.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function resetForm() {
    setName('');
    setDescription('');
    setSportId('');
    setFormat('knockout');
    setDeadline('');
    setSubmitError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitError(null);
    setBusy(true);
    try {
      await api.createTournament(token, {
        name,
        description: description.trim() || undefined,
        sportId,
        format,
        registrationDeadline: deadline,
      });
      resetForm();
      setFormOpen(false);
      await load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tournaments</h1>
          <p className="mt-1 text-sm text-white/50">
            Intra-hostel tournaments you&apos;ve created for this hostel. Manage teams, fixtures,
            or cancel one, right from its card.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormOpen((v) => !v);
            setSubmitError(null);
          }}
          className="rounded-md bg-playops-amber px-4 py-2 text-sm font-semibold text-playops-charcoal hover:bg-playops-amber/90"
        >
          {formOpen ? 'Cancel' : '+ Create Tournament'}
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-lg border border-white/10 bg-playops-dark-surface p-5"
        >
          <div>
            <label htmlFor="t-name" className="text-xs font-medium text-white/70">
              Tournament name
            </label>
            <input
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Agira Cricket Cup 2026"
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
            />
          </div>

          <div>
            <label htmlFor="t-description" className="text-xs font-medium text-white/70">
              Description <span className="text-white/40">(optional)</span>
            </label>
            <textarea
              id="t-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="A short line about this tournament - stages, prizes, anything teams should know."
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="t-sport" className="text-xs font-medium text-white/70">
                Sport
              </label>
              <select
                id="t-sport"
                value={sportId}
                onChange={(e) => setSportId(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber"
              >
                <option value="" disabled>
                  Select a sport…
                </option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id} className="bg-playops-dark-bg">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="t-deadline" className="text-xs font-medium text-white/70">
                Registration deadline
              </label>
              <input
                id="t-deadline"
                type="date"
                value={deadline}
                min={todayIso()}
                onChange={(e) => setDeadline(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-white/70">Format</span>
            <div className="mt-1 flex gap-2">
              {(['knockout', 'league'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={
                    'rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ' +
                    (format === f
                      ? 'border-playops-amber bg-playops-amber/20 text-playops-amber'
                      : 'border-white/15 text-white/60 hover:bg-white/5')
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {submitError && <p className="text-sm text-red-400">{submitError}</p>}

          <button
            type="submit"
            disabled={busy || !name || !sportId || !deadline}
            className="rounded-md bg-playops-amber px-4 py-2 text-sm font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create tournament'}
          </button>
        </form>
      )}

      {loadError && <p className="mt-4 text-sm text-red-400">{loadError}</p>}

      <div className="mt-6 space-y-3">
        {tournaments === null ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : tournaments.length === 0 ? (
          <p className="text-sm text-white/40">No tournaments yet — create your first one above.</p>
        ) : (
          tournaments.map((t) => <TournamentCard key={t.id} tournament={t} onChanged={load} />)
        )}
      </div>
    </div>
  );
}
