'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, PendingChangeRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// FR-003's change flow (business rules 9 and 13). The backend scopes this
// list server-side to requests where the CALLER's hostel is the
// requester's CURRENT hostel - not the requested one - so there's no
// hostelId prop to pass here. This is real, working functionality, not a
// placeholder - it's shown as such on the Home page.
export function PendingChangeRequestsList() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<PendingChangeRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRequests(await api.getPendingChangeRequests(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load change requests.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    if (!token) return;
    setError(null);
    setBusyId(id);
    try {
      if (action === 'approve') {
        await api.approveChangeRequest(token, id);
      } else {
        await api.rejectChangeRequest(token, id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (!requests) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="mb-1 text-lg font-semibold text-white">Pending hostel change requests</h2>
      <p className="mb-4 text-sm text-white/50">
        You approve requests from students currently in your hostel — the one releasing them —
        not requests into it (business rule 9).
      </p>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      {requests.length === 0 ? (
        <p className="text-sm text-white/50">No pending requests.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id} className="border-white/10 bg-playops-dark-surface">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-white">
                    {r.user.name} <span className="font-normal text-white/50">({r.user.email})</span>
                  </p>
                  <p className="text-sm text-white/50">wants to move to {r.requestedHostel.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'approve')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'reject')}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
