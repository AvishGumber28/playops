'use client';

import type { Fixtures, FixtureMatch } from '@/lib/api';

// D-030: a registered participant's read-only view of the schedule the
// Secretary generated - no drag-swap, no Schedule/Cancel/Enter-result
// buttons, no Check Conflicts. Shared wherever a non-Secretary needs to
// see "when and where is my match" (currently just the Student
// dashboard's "My Tournaments" tab).
function MatchCard({ match }: { match: FixtureMatch }) {
  const isBye =
    match.status !== 'scheduled' && Boolean(match.teamA) !== Boolean(match.teamB);

  return (
    <div className="rounded-md border border-white/10 bg-playops-dark-surface p-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/30">
        Match {match.matchNumber}
        {isBye && ' · Bye'}
        {match.status === 'cancelled' && ' · Cancelled'}
      </p>
      <div className="space-y-1">
        {([match.teamA, match.teamB] as const).map((team, i) => {
          const isWinner = Boolean(match.winnerTeamId) && match.winnerTeamId === team?.id;
          return (
            <div
              key={i}
              className={
                'rounded px-2 py-1.5 text-xs ' +
                (isWinner
                  ? 'bg-emerald-500/15 font-medium text-emerald-300'
                  : team
                    ? 'bg-white/5 text-white/80'
                    : 'bg-white/[0.02] text-white/30')
              }
            >
              {team ? team.name : 'TBD'}
            </div>
          );
        })}
      </div>

      {match.status === 'cancelled' ? (
        <p className="mt-1.5 text-[10px] text-red-400">Cancelled: {match.cancellationReason}</p>
      ) : match.scheduledDate && match.scheduledTime ? (
        <p className="mt-1.5 text-[10px] text-white/50">
          {match.scheduledDate} · {match.scheduledTime}
        </p>
      ) : (
        <p className="mt-1.5 text-[10px] text-white/30">Not scheduled yet</p>
      )}
    </div>
  );
}

export function ReadOnlyFixturesModal({
  tournamentName,
  fixtures,
  onClose,
}: {
  tournamentName: string;
  fixtures: Fixtures;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Fixtures — {tournamentName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>

        {fixtures.rounds.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">
            No fixtures have been generated yet — check back once registration closes.
          </p>
        ) : (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {fixtures.rounds.map((round) => (
              <div key={round.round} className="w-44 flex-none space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-playops-amber">
                  Round {round.round}
                </p>
                {round.matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
