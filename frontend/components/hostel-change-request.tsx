'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, ChangeRequestRef, HostelRef } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

// FR-003's change flow, shown on a student's own dashboard once they
// already have a hostel. Distinct from HostelSelector, which only ever
// runs for a student with NO hostel yet.
export function HostelChangeRequest({ currentHostelId }: { currentHostelId: string }) {
  const { token } = useAuth();
  // undefined = still loading (avoids a flash of the "request" button
  // before we know whether one is already pending).
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
    // Same reusable-loader shape as CaretakerDashboard's loadDetail -
    // called again after submitting a request, not just on mount.
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

  if (pending === undefined) {
    return null;
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="mb-2 text-lg font-semibold">Change hostel</h2>

      {pending ? (
        <p className="text-sm text-muted-foreground">
          Pending request to switch to{' '}
          <span className="font-medium">{pending.requestedHostel.name}</span> — awaiting
          approval from your current hostel&apos;s Caretaker.
        </p>
      ) : showForm ? (
        <div>
          {!hostels && <p className="text-sm text-muted-foreground">Loading hostels…</p>}
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
                      'rounded-lg border p-3 text-left text-sm transition-colors ' +
                      (selectedId === h.id
                        ? 'border-primary bg-primary/10'
                        : 'border-input hover:bg-accent')
                    }
                  >
                    <div className="font-bold">{h.code}</div>
                    <div className="text-muted-foreground">{h.name}</div>
                  </button>
                ))}
            </div>
          )}
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={!selectedId || busy} onClick={submit}>
              {busy ? 'Submitting…' : 'Submit request'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={openForm}>
          Request hostel change
        </Button>
      )}
    </div>
  );
}
