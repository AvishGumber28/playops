'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, ChangeRequestRef, HostelRef } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// FR-003's change flow, dark-themed for the new Student Home page - same
// logic as components/hostel-change-request.tsx, just restyled to match
// the rest of the Student shell instead of the shared shadcn-default
// light component (Caretaker's own Home does the same thing rather than
// reusing the light HostelHeader - see caretaker-home.tsx).
export function StudentChangeHostel({ currentHostelId }: { currentHostelId: string }) {
  const { token } = useAuth();
  const [pending, setPending] = useState<ChangeRequestRef | null | undefined>(undefined);
  const [hostels, setHostels] = useState<HostelRef[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPending = useCallback(async () => {
    if (!token) return;
    try {
      const { pending: current } = await api.getMyChangeRequest(token);
      setPending(current);
    } catch {
      setPending(null);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPending();
  }, [loadPending]);

  async function openForm() {
    setShowForm(true);
    setError(null);
    if (!hostels) {
      try {
        setHostels(await api.listHostels());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load hostels.');
      }
    }
  }

  async function submit() {
    if (!selectedId || !token) return;
    setError(null);
    setBusy(true);
    try {
      await api.requestHostelChange(token, selectedId);
      setShowForm(false);
      setSelectedId(null);
      await loadPending();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (pending === undefined) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-white">Change Hostel</h2>

      {pending ? (
        <p className="mt-2 text-sm text-white/50">
          Pending request to switch to{' '}
          <span className="font-medium text-white">{pending.requestedHostel.name}</span> —
          awaiting approval from your current hostel&apos;s Caretaker.
        </p>
      ) : showForm ? (
        <div className="mt-3">
          {!hostels && <p className="text-sm text-white/40">Loading hostels…</p>}
          {hostels && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {hostels
                .filter((h) => h.id !== currentHostelId)
                .map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedId(h.id)}
                    className={
                      'rounded-md border p-3 text-left text-sm transition-colors ' +
                      (selectedId === h.id
                        ? 'border-playops-amber bg-playops-amber/10'
                        : 'border-white/15 text-white/70 hover:bg-white/5')
                    }
                  >
                    <div className="font-bold text-white">{h.code}</div>
                    <div className="text-white/50">{h.name}</div>
                  </button>
                ))}
            </div>
          )}
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!selectedId || busy}
              onClick={submit}
              className="rounded-md bg-playops-amber px-3 py-1.5 text-xs font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openForm}
          className="mt-3 rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        >
          Request hostel change
        </button>
      )}
    </div>
  );
}
