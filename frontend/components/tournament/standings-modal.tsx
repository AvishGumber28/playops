'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, Standings } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// FR-011: a league tournament's points table. Shared across every role's
// tournament popup (Secretary/Student/Caretaker) since it's read-only and
// open to any authenticated user (D-027) - there's no role-specific
// variation to justify three separate copies.
export function StandingsModal({
  tournamentId,
  tournamentName,
  onClose,
}: {
  tournamentId: string;
  tournamentName: string;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [standings, setStandings] = useState<Standings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        setStandings(await api.getStandings(token, tournamentId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load standings.');
      }
    })();
  }, [token, tournamentId]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-bold text-white">Standings — {tournamentName}</h3>
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

        {!error && !standings && <p className="mt-3 text-sm text-white/40">Loading…</p>}

        {standings && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Team</th>
                  <th className="py-1 pr-2 text-center">P</th>
                  <th className="py-1 pr-2 text-center">W</th>
                  <th className="py-1 pr-2 text-center">D</th>
                  <th className="py-1 pr-2 text-center">L</th>
                  <th className="py-1 text-center">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.standings.map((row) => (
                  <tr key={row.teamId}>
                    <td className="py-1.5 pr-2 text-white/50">{row.rank}</td>
                    <td className="py-1.5 pr-2 font-medium text-white">{row.name}</td>
                    <td className="py-1.5 pr-2 text-center text-white/70">{row.played}</td>
                    <td className="py-1.5 pr-2 text-center text-white/70">{row.won}</td>
                    <td className="py-1.5 pr-2 text-center text-white/70">{row.drawn}</td>
                    <td className="py-1.5 pr-2 text-center text-white/70">{row.lost}</td>
                    <td className="py-1.5 text-center font-semibold text-playops-amber">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {standings.standings.length === 0 && (
              <p className="mt-2 text-sm text-white/40">No approved teams yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
