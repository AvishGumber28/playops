'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { api, ApiError, Fixtures, RegisteredTeam, SportRef, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { FixturesModal } from './fixtures-modal';
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// D-026: the main list only ever shows name + status - click a row to
// open its detail popup (TournamentDetailModal) for everything else.
function TournamentRow({
  tournament,
  onOpen,
}: {
  tournament: Tournament;
  onOpen: () => void;
}) {
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

// Everything that used to live inline on the dashboard row - sport/
// format/deadline, the registered-teams roster with approve/reject, and
// Fixtures/Cancel/Delete - now lives in this popup instead (D-026).
function TournamentDetailModal({
  tournament,
  onClose,
  onChanged,
}: {
  tournament: Tournament;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [teams, setTeams] = useState<RegisteredTeam[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTeam, setBusyTeam] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [fixturesBusy, setFixturesBusy] = useState(false);
  const [showStandings, setShowStandings] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      setTeams(await api.listTournamentTeams(token, tournament.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load teams.');
    }
  }, [token, tournament.id]);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && teams === null) void loadTeams();
  }

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

  // FR-007 / D-018: generate on first click (while registration is
  // still open), otherwise just reopen the already-generated schedule.
  // D-026: generating is irreversible (closes registration + builds the
  // bracket) - confirm first so an accidental click can't trigger it;
  // reopening an already-generated schedule needs no confirmation.
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
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this tournament.');
      setDeleting(false);
    }
  }

  // D-021: for once fixtures already exist - deleting would corrupt that
  // history, so this is the "cancel it instead" the delete guard points
  // at. Cancels every remaining match too and frees their venue bookings.
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">{tournament.name}</h2>
            <p className="mt-0.5 text-sm text-white/50">
              {tournament.sport.name} · <span className="uppercase">{tournament.format}</span> ·
              registration by {formatDate(tournament.registrationDeadline)}
            </p>
            {tournament.status === 'cancelled' && tournament.cancellationReason && (
              <p className="mt-1 text-xs text-red-400">Cancelled: {tournament.cancellationReason}</p>
            )}
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
          <button
            type="button"
            onClick={toggle}
            className="text-xs font-medium text-playops-amber hover:underline"
          >
            {expanded ? 'Hide teams' : `View teams (${tournament.teamCount})`}
          </button>
          {(tournament.status === 'registration_open' ||
            tournament.status === 'in_progress' ||
            tournament.status === 'completed') && (
            <button
              type="button"
              onClick={openFixtures}
              disabled={fixturesBusy}
              className="text-xs font-medium text-playops-amber hover:underline disabled:opacity-50"
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
              className="text-xs font-medium text-playops-amber hover:underline"
            >
              View Standings
            </button>
          )}
          {tournament.status === 'in_progress' && (
            <button
              type="button"
              onClick={cancel}
              disabled={cancelling}
              className="text-xs text-red-400 hover:underline disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel tournament'}
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
              onClick={del}
              disabled={deleting}
              className="text-xs text-red-400 hover:underline disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {expanded && (
          <div className="mt-4 border-t border-white/10 pt-4">
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
        )}
      </div>

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
  const [sportId, setSportId] = useState('');
  const [format, setFormat] = useState<'knockout' | 'league'>('knockout');
  const [deadline, setDeadline] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = tournaments?.find((t) => t.id === selectedId) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tournaments</h1>
          <p className="mt-1 text-sm text-white/50">
            Intra-hostel tournaments you&apos;ve created for this hostel. Click one to review
            teams, manage fixtures, or cancel it.
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
          tournaments.map((t) => (
            <TournamentRow key={t.id} tournament={t} onOpen={() => setSelectedId(t.id)} />
          ))
        )}
      </div>

      {selected && (
        <TournamentDetailModal
          tournament={selected}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
