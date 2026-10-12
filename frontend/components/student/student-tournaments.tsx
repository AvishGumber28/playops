'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { api, ApiError, Fixtures, StudentTournament, TeamRoster } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { StandingsModal } from '@/components/tournament/standings-modal';
import { ReadOnlyFixturesModal } from '@/components/tournament/read-only-fixtures-modal';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isOpen(t: StudentTournament): boolean {
  return t.status === 'registration_open' && new Date(t.registrationDeadline) > new Date();
}

// Roster view for a team you captain: add/remove players by email.
function TeamManager({ teamId, onLeave }: { teamId: string; onLeave?: () => void }) {
  const { token } = useAuth();
  const [roster, setRoster] = useState<TeamRoster | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRoster(await api.getTeam(token, teamId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your team.');
    }
  }, [token, teamId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function addPlayer(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      setRoster(await api.addTeamPlayer(token, teamId, email));
      setEmail('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removePlayer(userId: string) {
    if (!token) return;
    setError(null);
    try {
      setRoster(await api.removeTeamPlayer(token, teamId, userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that player.');
    }
  }

  if (!roster) {
    return <p className="mt-3 text-sm text-white/40">Loading team…</p>;
  }

  return (
    <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-white/50">
        {roster.name} — roster
      </p>
      <ul className="mt-2 space-y-1">
        {roster.players.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span className="text-white">
              {p.name}
              {p.isCaptain && <span className="ml-1.5 text-xs text-white/40">(captain)</span>}
              {p.rollNumber && <span className="ml-1.5 text-xs text-white/40">{p.rollNumber}</span>}
            </span>
            {!p.isCaptain && (
              <button
                type="button"
                onClick={() => removePlayer(p.id)}
                className="text-xs text-red-400 hover:underline"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addPlayer} className="mt-3 flex gap-2">
        <input
          type="email"
          placeholder="teammate@thapar.edu"
          aria-label="Player email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-8 flex-1 rounded-md border border-white/15 bg-white/5 px-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
        />
        <button
          type="submit"
          disabled={busy || !email}
          className="rounded-md bg-playops-amber px-3 py-1.5 text-xs font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add player'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {onLeave && (
        <button
          type="button"
          onClick={onLeave}
          className="mt-3 text-xs text-white/50 hover:underline"
        >
          Done
        </button>
      )}
    </div>
  );
}

// The main list only ever shows name + status - click a row to open its
// detail popup for registration/roster management (matches the same
// card->popup pattern used on the Secretary and Caretaker dashboards).
function TournamentRow({
  tournament,
  onOpen,
}: {
  tournament: StudentTournament;
  onOpen: () => void;
}) {
  const open = isOpen(tournament);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-playops-dark-surface p-4 text-left transition-colors hover:border-playops-amber/40"
    >
      <p className="font-semibold text-white">{tournament.name}</p>
      <span
        className={
          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
          (open ? 'bg-playops-amber/20 text-playops-amber' : 'bg-white/10 text-white/50')
        }
      >
        {open ? 'Registration Open' : tournament.status.replace('_', ' ')}
      </span>
    </button>
  );
}

function TournamentDetailModal({
  tournament,
  onClose,
  onRegistered,
}: {
  tournament: StudentTournament;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const { token } = useAuth();
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [fixturesBusy, setFixturesBusy] = useState(false);

  const open = isOpen(tournament);

  // D-030: any registered participant can view the schedule - even a
  // captain whose team was rejected still has roster rows, so this stays
  // available regardless of registrationStatus.
  async function viewSchedule() {
    if (!token) return;
    setError(null);
    setFixturesBusy(true);
    try {
      setFixtures(await api.getFixtures(token, tournament.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the schedule.');
    } finally {
      setFixturesBusy(false);
    }
  }

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await api.createTeam(token, tournament.id, teamName);
      setTeamName('');
      setCreating(false);
      onRegistered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={
              'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
              (open ? 'bg-playops-amber/20 text-playops-amber' : 'bg-white/10 text-white/50')
            }
          >
            {open ? 'Registration Open' : tournament.status.replace('_', ' ')}
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
          {tournament.myTeam && (
            <button
              type="button"
              onClick={() => void viewSchedule()}
              disabled={fixturesBusy}
              className="text-xs font-medium text-playops-amber hover:underline disabled:opacity-50"
            >
              {fixturesBusy ? 'Loading…' : 'View Schedule'}
            </button>
          )}
        </div>

      {/* --- registration state --- */}
      {tournament.myTeam ? (
        <div className="mt-3">
          <p className="text-sm text-white/80">
            {tournament.myTeam.isCaptain ? 'You captain' : "You're on"}{' '}
            <span className="font-medium text-white">{tournament.myTeam.name}</span>
          </p>
          {tournament.myTeam.registrationStatus === 'rejected' ? (
            <p className="mt-1 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
              The Sports Secretary didn&apos;t accept this team for the tournament. Your roster
              is kept, but the team won&apos;t appear in the fixtures.
            </p>
          ) : tournament.myTeam.isCaptain && open ? (
            managing ? (
              <TeamManager teamId={tournament.myTeam.id} onLeave={() => setManaging(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setManaging(true)}
                className="mt-2 rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
              >
                Manage roster
              </button>
            )
          ) : (
            tournament.myTeam.isCaptain && (
              <p className="mt-1 text-xs text-white/40">
                Registration is closed — the roster is locked.
              </p>
            )
          )}
        </div>
      ) : !open ? (
        <p className="mt-3 text-sm text-white/40">Registration is closed.</p>
      ) : creating ? (
        <form onSubmit={createTeam} className="mt-3 flex flex-wrap gap-2">
          <input
            placeholder="Your team name"
            aria-label="Team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            className="h-8 max-w-xs flex-1 rounded-md border border-white/15 bg-white/5 px-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
          />
          <button
            type="submit"
            disabled={busy || !teamName}
            className="rounded-md bg-playops-amber px-3 py-1.5 text-xs font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create team'}
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="rounded-md px-3 py-1.5 text-xs text-white/50 hover:bg-white/10"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-3 rounded-md bg-playops-amber px-3 py-1.5 text-xs font-semibold text-playops-charcoal hover:bg-playops-amber/90"
        >
          Register a team
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {showStandings && (
        <StandingsModal
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          onClose={() => setShowStandings(false)}
        />
      )}

      {fixtures && (
        <ReadOnlyFixturesModal
          tournamentName={tournament.name}
          fixtures={fixtures}
          onClose={() => setFixtures(null)}
        />
      )}
    </div>
  );
}

export function StudentTournaments() {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState<StudentTournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'mine'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setTournaments(await api.listTournaments(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tournaments.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const selected = tournaments?.find((t) => t.id === selectedId) ?? null;
  // D-030: "All Tournaments" (every tournament the Secretary has listed
  // for this hostel) vs. "My Tournaments" (only ones with a registered
  // team - captain or roster member, any registration status) - split
  // at the user's request so participation is the explicit filter.
  const visible =
    tournaments === null
      ? null
      : tab === 'mine'
        ? tournaments.filter((t) => t.myTeam !== null)
        : tournaments;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Tournaments</h1>
      <p className="mt-1 text-sm text-white/50">
        Your hostel&apos;s Sports Secretary lists these. Click one to register a team while
        registration is open.
      </p>

      <div className="mt-4 flex gap-2">
        {(
          [
            ['all', 'All Tournaments'],
            ['mine', 'My Tournaments'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors ' +
              (tab === key
                ? 'bg-playops-amber text-playops-charcoal'
                : 'bg-white/5 text-white/60 hover:bg-white/10')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-3">
        {visible === null ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-white/40">
            {tab === 'mine'
              ? "You're not registered in any tournament yet — register from All Tournaments."
              : 'No tournaments in your hostel yet.'}
          </p>
        ) : (
          visible.map((t) => (
            <TournamentRow key={t.id} tournament={t} onOpen={() => setSelectedId(t.id)} />
          ))
        )}
      </div>

      {selected && (
        <TournamentDetailModal
          tournament={selected}
          onClose={() => setSelectedId(null)}
          onRegistered={load}
        />
      )}
    </div>
  );
}
