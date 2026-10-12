'use client';

import { useCallback, useEffect, useState, type DragEvent } from 'react';
import {
  api,
  ApiError,
  ConflictEntry,
  Fixtures,
  FixtureMatch,
  FixtureSlot,
  Scorecard,
  VenueBooking,
  VenueRef,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { todayIso } from '@/lib/venue-constants';
import { SCORECARD_TEMPLATES } from '@/lib/scorecard-templates';
import { showToast, ToastStack } from '@/components/ui/toast';
import { GroundPicker } from '@/components/venue/ground-picker';
import { VenueSlotModal } from '@/components/venue/venue-slot-modal';

type DragPayload = { matchId: string; slot: FixtureSlot };

// One team-slot inside a match card. Draggable when it holds a real
// team and the match hasn't been decided (D-018) - dropping one slot
// onto another calls the swap endpoint.
function MatchSlot({
  matchId,
  slot,
  team,
  locked,
  isWinner,
  onDrop,
}: {
  matchId: string;
  slot: FixtureSlot;
  team: { id: string; name: string } | null;
  locked: boolean;
  isWinner: boolean;
  onDrop: (source: DragPayload, dest: DragPayload) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const draggable = !locked && Boolean(team);

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    if (!draggable) return;
    e.dataTransfer.setData('application/json', JSON.stringify({ matchId, slot }));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (locked) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (locked) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const source = JSON.parse(raw) as DragPayload;
    onDrop(source, { matchId, slot });
  }

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={
        'flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ' +
        (isWinner
          ? 'bg-emerald-500/15 font-medium text-emerald-300 '
          : team
            ? 'bg-white/5 text-white/80 '
            : 'bg-white/[0.02] text-white/30 ') +
        (draggable ? 'cursor-grab active:cursor-grabbing ' : 'cursor-default ') +
        (dragOver ? 'ring-2 ring-playops-amber' : '')
      }
    >
      <span className="truncate">{team ? team.name : 'TBD'}</span>
    </div>
  );
}

function MatchCard({
  match,
  onDrop,
  onSchedule,
  onCancel,
  onEnterResult,
  onViewResult,
}: {
  match: FixtureMatch;
  onDrop: (source: DragPayload, dest: DragPayload) => void;
  onSchedule: (match: FixtureMatch) => void;
  onCancel: (match: FixtureMatch) => void;
  onEnterResult: (match: FixtureMatch) => void;
  onViewResult: (match: FixtureMatch) => void;
}) {
  const locked = match.status !== 'scheduled';
  const isBye = locked && Boolean(match.teamA) !== Boolean(match.teamB);
  // A real, playable match (both teams known, not a bye) can be given a
  // venue/time - and cancelled - regardless of whether its slots are
  // still drag-swappable.
  const schedulable =
    Boolean(match.teamA) && Boolean(match.teamB) && match.status !== 'completed';
  // FR-010: a two-team match only ever reaches `completed` by having a
  // result submitted - byes (the only other way a match completes)
  // never have both teams, so this is a safe proxy for "has a scorecard".
  const bothTeamsSet = Boolean(match.teamA) && Boolean(match.teamB);
  const hasResult = bothTeamsSet && match.status === 'completed';
  const canEnterResult = bothTeamsSet && match.status === 'scheduled';

  return (
    <div className="rounded-md border border-white/10 bg-playops-dark-surface p-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/30">
        Match {match.matchNumber}
        {isBye && ' · Bye'}
        {match.status === 'cancelled' && ' · Cancelled'}
      </p>
      <div className="space-y-1">
        <MatchSlot
          matchId={match.id}
          slot="teamA"
          team={match.teamA}
          locked={locked}
          isWinner={Boolean(match.winnerTeamId) && match.winnerTeamId === match.teamA?.id}
          onDrop={onDrop}
        />
        <MatchSlot
          matchId={match.id}
          slot="teamB"
          team={match.teamB}
          locked={locked}
          isWinner={Boolean(match.winnerTeamId) && match.winnerTeamId === match.teamB?.id}
          onDrop={onDrop}
        />
      </div>

      {bothTeamsSet && (
        <div className="mt-1.5 space-y-0.5 border-t border-white/5 pt-1.5">
          {match.status === 'cancelled' && (
            <p className="text-[10px] text-red-400">Cancelled: {match.cancellationReason}</p>
          )}
          {schedulable && match.scheduledDate && match.scheduledTime && (
            <p className="text-[10px] text-white/50">
              {match.scheduledDate} · {match.scheduledTime}
            </p>
          )}
          {schedulable && match.pendingBooking && (
            <p className="text-[10px] text-amber-400">
              {match.status === 'cancelled' ? 'Suggested replacement' : 'Requested'}:{' '}
              {match.pendingBooking.venueName}, {match.pendingBooking.hour} on{' '}
              {match.pendingBooking.date} — awaiting approval
            </p>
          )}
          {schedulable &&
            !match.scheduledDate &&
            !match.pendingBooking &&
            match.status !== 'cancelled' && (
              <p className="text-[10px] text-white/30">Not scheduled</p>
            )}
          <div className="mt-1 flex flex-wrap gap-2">
            {/* A cancelled match can always be directly rescheduled - no
                need to wait on an auto-suggested replacement (if any) to
                be approved first. */}
            {schedulable && (
              <button
                type="button"
                onClick={() => onSchedule(match)}
                className="text-[10px] font-medium text-playops-amber hover:underline"
              >
                {match.scheduledDate ? 'Reschedule' : 'Schedule'}
              </button>
            )}
            {schedulable && match.status === 'scheduled' && match.scheduledDate && (
              <button
                type="button"
                onClick={() => onCancel(match)}
                className="text-[10px] font-medium text-red-400 hover:underline"
              >
                Cancel match
              </button>
            )}
            {canEnterResult && (
              <button
                type="button"
                onClick={() => onEnterResult(match)}
                className="text-[10px] font-medium text-emerald-400 hover:underline"
              >
                Enter result
              </button>
            )}
          </div>
          {hasResult && (
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[10px] font-medium text-emerald-400">
                {match.winnerTeamId
                  ? `Winner: ${
                      match.winnerTeamId === match.teamA?.id ? match.teamA?.name : match.teamB?.name
                    }`
                  : 'Draw'}
              </p>
              <button
                type="button"
                onClick={() => onViewResult(match)}
                className="text-[10px] font-medium text-playops-amber hover:underline"
              >
                View result
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// D-018: the fixture card. Opens with the bracket/round-robin schedule
// already generated; dragging a team onto another match's slot swaps
// them (blocked once either match is a bye or already played).
export function FixturesModal({
  tournamentId,
  tournamentName,
  scorecardTemplate,
  initialFixtures,
  onClose,
}: {
  tournamentId: string;
  tournamentName: string;
  scorecardTemplate: string;
  initialFixtures: Fixtures;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // FR-009: scheduling a venue+time onto a match reuses the same
  // GroundPicker / VenueSlotModal pair FR-008's venue request page uses.
  const [venues, setVenues] = useState<VenueRef[] | null>(null);
  const [venueBookings, setVenueBookings] = useState<VenueBooking[] | null>(null);
  const [schedulingMatch, setSchedulingMatch] = useState<FixtureMatch | null>(null);
  const [scheduleDate, setScheduleDate] = useState(todayIso());
  const [scheduleVenue, setScheduleVenue] = useState<VenueRef | null>(null);
  const [busyHour, setBusyHour] = useState<string | null>(null);

  const [conflicts, setConflicts] = useState<ConflictEntry[] | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // FR-010: entering a result (resultMatch) or reading one back
  // (viewingResult) for a specific match.
  const template = SCORECARD_TEMPLATES[scorecardTemplate];
  const [resultMatch, setResultMatch] = useState<FixtureMatch | null>(null);
  const [resultWinner, setResultWinner] = useState<'teamA' | 'teamB' | 'draw' | null>(null);
  const [resultValues, setResultValues] = useState<Record<string, string>>({});
  const [resultBusy, setResultBusy] = useState(false);
  const [viewingResult, setViewingResult] = useState<Scorecard | null>(null);
  const [viewingResultBusy, setViewingResultBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const [v, b] = await Promise.all([api.listVenues(token), api.allVenueBookings(token)]);
        setVenues(v);
        setVenueBookings(b);
      } catch {
        // Scheduling is still usable without this - the slot grid just
        // won't show Booked/Available until the next retry.
      }
    })();
  }, [token]);

  const refreshFixtures = useCallback(async () => {
    if (!token) return;
    setFixtures(await api.getFixtures(token, tournamentId));
  }, [token, tournamentId]);

  async function handleScheduleSlot(hour: string) {
    if (!token || !schedulingMatch || !scheduleVenue) return;
    setError(null);
    setBusyHour(hour);
    try {
      await api.scheduleMatch(token, schedulingMatch.id, scheduleVenue.id, scheduleDate, hour);
      showToast(
        `Requested ${scheduleVenue.name}, ${hour} on ${scheduleDate} for Match ${schedulingMatch.matchNumber} — waiting on Sports Department approval.`,
        'success',
      );
      setSchedulingMatch(null);
      setScheduleVenue(null);
      await refreshFixtures();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not schedule that match.');
    } finally {
      setBusyHour(null);
    }
  }

  async function handleCancelMatch(match: FixtureMatch) {
    if (!token) return;
    const reason = window.prompt(`Why is Match ${match.matchNumber} being cancelled?`);
    if (!reason) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.cancelMatch(token, match.id, reason);
      showToast(result.message, 'success');
      await refreshFixtures();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel that match.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckConflicts() {
    if (!token) return;
    setError(null);
    setCheckingConflicts(true);
    try {
      const result = await api.checkConflicts(token, tournamentId);
      setConflicts(result.conflicts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check for conflicts.');
    } finally {
      setCheckingConflicts(false);
    }
  }

  function openResultForm(match: FixtureMatch) {
    setResultMatch(match);
    setResultWinner(null);
    setResultValues({});
    setError(null);
  }

  async function handleSubmitResult() {
    if (!token || !resultMatch || !template) return;
    if (!resultWinner) {
      setError('Pick a winner (or a draw) before submitting.');
      return;
    }
    const fields = [...template.teamAFields, ...template.teamBFields];
    const data: Record<string, number> = {};
    for (const field of fields) {
      const raw = resultValues[field.key];
      const value = Number(raw);
      if (raw === undefined || raw === '' || !Number.isFinite(value) || value < 0) {
        setError(`"${field.label}" must be a non-negative number.`);
        return;
      }
      data[field.key] = value;
    }
    const winnerTeamId =
      resultWinner === 'draw'
        ? null
        : resultWinner === 'teamA'
          ? (resultMatch.teamA?.id ?? null)
          : (resultMatch.teamB?.id ?? null);

    setError(null);
    setResultBusy(true);
    try {
      await api.submitScorecard(token, resultMatch.id, winnerTeamId, data);
      showToast(`Result recorded for Match ${resultMatch.matchNumber}.`, 'success');
      setResultMatch(null);
      await refreshFixtures();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record that result.');
    } finally {
      setResultBusy(false);
    }
  }

  async function handleViewResult(match: FixtureMatch) {
    if (!token) return;
    setError(null);
    setViewingResult(null);
    setViewingResultBusy(true);
    try {
      setViewingResult(await api.getScorecard(token, match.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load that result.');
    } finally {
      setViewingResultBusy(false);
    }
  }

  const handleDrop = useCallback(
    async (source: DragPayload, dest: DragPayload) => {
      if (!token) return;
      if (source.matchId === dest.matchId && source.slot === dest.slot) return;
      setError(null);
      setBusy(true);
      try {
        setFixtures(
          await api.swapFixtureTeams(
            token,
            tournamentId,
            source.matchId,
            source.slot,
            dest.matchId,
            dest.slot,
          ),
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not rearrange that match.');
      } finally {
        setBusy(false);
      }
    },
    [token, tournamentId],
  );

  const viewingMatch = viewingResult
    ? fixtures.rounds.flatMap((r) => r.matches).find((m) => m.id === viewingResult.matchId)
    : null;
  const viewingWinnerName =
    viewingMatch?.teamA?.id === viewingResult?.winnerTeamId
      ? viewingMatch?.teamA?.name
      : viewingMatch?.teamB?.name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Fixtures — {tournamentName}</h2>
            <p className="mt-0.5 text-xs text-white/50">
              Drag a team onto another match to swap them — locked once a match is a bye or has
              been played. Schedule a venue + time per match, then Check Conflicts before
              publishing.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={handleCheckConflicts}
              disabled={checkingConflicts}
              className="rounded-md border border-playops-amber/40 bg-playops-amber/10 px-3 py-1.5 text-xs font-medium text-playops-amber hover:bg-playops-amber/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkingConflicts ? 'Checking…' : 'Check Conflicts'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-white/50 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {busy && <p className="mt-3 text-xs text-white/40">Saving…</p>}

        {conflicts && (
          <div className="mt-3 rounded-md border border-white/10 bg-playops-dark-surface p-3">
            {conflicts.length === 0 ? (
              <p className="text-sm text-emerald-400">
                No conflicts found — this schedule is clean.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-400">
                  {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'} found
                </p>
                <ul className="space-y-1.5">
                  {conflicts.map((c, i) => (
                    <li key={i} className="text-sm text-white/80">
                      <span
                        className={
                          'mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ' +
                          (c.type === 'team'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-amber-500/20 text-amber-300')
                        }
                      >
                        {c.type}
                      </span>
                      {c.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {fixtures.rounds.map((round) => (
            <div key={round.round} className="w-44 flex-none space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-playops-amber">
                Round {round.round}
              </p>
              {round.matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onDrop={handleDrop}
                  onSchedule={(m) => {
                    setSchedulingMatch(m);
                    setScheduleVenue(null);
                    setScheduleDate(m.scheduledDate ?? todayIso());
                  }}
                  onCancel={handleCancelMatch}
                  onEnterResult={openResultForm}
                  onViewResult={handleViewResult}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {schedulingMatch && !scheduleVenue && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setSchedulingMatch(null);
            setScheduleVenue(null);
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-sm font-bold text-white">
                Schedule Match {schedulingMatch.matchNumber}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSchedulingMatch(null);
                  setScheduleVenue(null);
                }}
                aria-label="Close"
                className="shrink-0 text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <label htmlFor="schedule-date" className="mt-3 block text-xs font-medium text-white/70">
              Date
            </label>
            <input
              id="schedule-date"
              type="date"
              value={scheduleDate}
              min={todayIso()}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber [color-scheme:dark]"
            />

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-white/50">
              Pick a ground
            </p>
            <div className="mt-2">
              {venues === null ? (
                <p className="text-sm text-white/40">Loading…</p>
              ) : (
                <GroundPicker venues={venues} onSelect={setScheduleVenue} />
              )}
            </div>
          </div>
        </div>
      )}

      {schedulingMatch && scheduleVenue && venueBookings && (
        <VenueSlotModal
          venue={scheduleVenue}
          date={scheduleDate}
          bookings={venueBookings}
          onSlotClick={handleScheduleSlot}
          busyHour={busyHour}
          onClose={() => setScheduleVenue(null)}
        />
      )}

      {resultMatch && template && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setResultMatch(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-sm font-bold text-white">
                Enter Result — Match {resultMatch.matchNumber}
              </h3>
              <button
                type="button"
                onClick={() => setResultMatch(null)}
                aria-label="Close"
                className="shrink-0 text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-white/50">Winner</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setResultWinner('teamA')}
                className={
                  'rounded-md border px-3 py-1.5 text-xs font-medium ' +
                  (resultWinner === 'teamA'
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/15 text-white/70 hover:bg-white/5')
                }
              >
                {resultMatch.teamA?.name}
              </button>
              <button
                type="button"
                onClick={() => setResultWinner('teamB')}
                className={
                  'rounded-md border px-3 py-1.5 text-xs font-medium ' +
                  (resultWinner === 'teamB'
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/15 text-white/70 hover:bg-white/5')
                }
              >
                {resultMatch.teamB?.name}
              </button>
              {template.allowDraw && (
                <button
                  type="button"
                  onClick={() => setResultWinner('draw')}
                  className={
                    'rounded-md border px-3 py-1.5 text-xs font-medium ' +
                    (resultWinner === 'draw'
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/15 text-white/70 hover:bg-white/5')
                  }
                >
                  Draw
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/50">
                  {resultMatch.teamA?.name}
                </p>
                <div className="mt-2 space-y-2">
                  {template.teamAFields.map((field) => (
                    <div key={field.key}>
                      <label htmlFor={field.key} className="text-xs text-white/60">
                        {field.label}
                      </label>
                      <input
                        id={field.key}
                        type="number"
                        min={0}
                        value={resultValues[field.key] ?? ''}
                        onChange={(e) =>
                          setResultValues((v) => ({ ...v, [field.key]: e.target.value }))
                        }
                        className="mt-1 block w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/50">
                  {resultMatch.teamB?.name}
                </p>
                <div className="mt-2 space-y-2">
                  {template.teamBFields.map((field) => (
                    <div key={field.key}>
                      <label htmlFor={field.key} className="text-xs text-white/60">
                        {field.label}
                      </label>
                      <input
                        id={field.key}
                        type="number"
                        min={0}
                        value={resultValues[field.key] ?? ''}
                        onChange={(e) =>
                          setResultValues((v) => ({ ...v, [field.key]: e.target.value }))
                        }
                        className="mt-1 block w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitResult}
              disabled={resultBusy}
              className="mt-5 w-full rounded-md bg-playops-amber px-3 py-2 text-sm font-semibold text-black hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resultBusy ? 'Submitting…' : 'Submit Result'}
            </button>
          </div>
        </div>
      )}

      {(viewingResultBusy || viewingResult) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setViewingResult(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-sm font-bold text-white">Match Result</h3>
              <button
                type="button"
                onClick={() => setViewingResult(null)}
                aria-label="Close"
                className="shrink-0 text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            {viewingResultBusy || !viewingResult ? (
              <p className="mt-3 text-sm text-white/40">Loading…</p>
            ) : (
              <>
                <p className="mt-3 text-sm font-medium text-emerald-400">
                  {viewingResult.winnerTeamId === null ? 'Draw' : `Winner: ${viewingWinnerName}`}
                </p>
                <div className="mt-3 divide-y divide-white/5 rounded-md border border-white/10">
                  {Object.entries(viewingResult.data).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="text-white/60">{key}</span>
                      <span className="text-white">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-white/40">
                  Entered by {viewingResult.enteredBy.name} ·{' '}
                  {new Date(viewingResult.enteredAt).toLocaleString()}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <ToastStack />
    </div>
  );
}
