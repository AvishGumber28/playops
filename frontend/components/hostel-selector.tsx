'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, HostelRef } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function HostelSelector() {
  const { token, refreshMe } = useAuth();
  const [hostels, setHostels] = useState<HostelRef[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listHostels()
      .then(setHostels)
      .catch((err: unknown) =>
        setLoadError(err instanceof ApiError ? err.message : 'Could not load hostels.'),
      );
  }, []);

  async function confirmSelection() {
    if (!selectedId || !token) return;
    setError(null);
    setBusy(true);
    try {
      await api.selectHostel(token, selectedId);
      await refreshMe();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">Select your hostel</h2>
      <p className="mb-6 mt-2 text-muted-foreground">
        Pick the hostel you live in. This locks for a semester once confirmed - after that,
        changing hostels needs your current hostel&apos;s Caretaker to approve it.
      </p>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {!hostels && !loadError && <p className="text-sm text-muted-foreground">Loading hostels…</p>}

      {hostels && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {hostels.map((hostel) => (
            <button
              key={hostel.id}
              type="button"
              onClick={() => setSelectedId(hostel.id)}
              className={
                'rounded-lg border p-4 text-left transition-colors ' +
                (selectedId === hostel.id
                  ? 'border-primary bg-primary/10'
                  : 'border-input hover:bg-accent')
              }
            >
              <div className="text-lg font-bold">{hostel.code}</div>
              <div className="text-sm text-muted-foreground">{hostel.name}</div>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <Button className="mt-6" disabled={!selectedId || busy} onClick={confirmSelection}>
        {busy ? 'Confirming…' : 'Confirm hostel'}
      </Button>
    </div>
  );
}
