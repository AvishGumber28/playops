'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { api, ApiError, Announcement, Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// FR-012: post an announcement for the whole hostel, or narrow it to one
// of this Secretary's own tournaments (only that tournament's approved,
// registered teams get notified instead of every hostel resident).
export function SecretaryAnnouncementsPage() {
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [a, t] = await Promise.all([
        api.listMyAnnouncements(token),
        api.listMyTournaments(token),
      ]);
      setAnnouncements(a);
      setTournaments(t);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load announcements.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function resetForm() {
    setTitle('');
    setBody('');
    setTournamentId('');
    setSubmitError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const result = await api.postAnnouncement(
        token,
        title,
        body,
        tournamentId || undefined,
      );
      setLastResult(
        `Sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? '' : 's'}.`,
      );
      resetForm();
      setFormOpen(false);
      await load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // D-029: a full retraction - recipients' notifications disappear too,
  // not just the post itself.
  async function handleDelete(a: Announcement) {
    if (!token) return;
    const confirmed = window.confirm(
      `Delete "${a.title}"? This removes it from every recipient's notifications too. This can't be undone.`,
    );
    if (!confirmed) return;
    setDeleteError(null);
    setDeletingId(a.id);
    try {
      await api.deleteAnnouncement(token, a.id);
      await load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete that announcement.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="mt-1 text-sm text-white/50">
            Post to your whole hostel, or narrow it to one tournament&apos;s registered teams.
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
          {formOpen ? 'Cancel' : '+ New Announcement'}
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-lg border border-white/10 bg-playops-dark-surface p-5"
        >
          <div>
            <label htmlFor="a-title" className="text-xs font-medium text-white/70">
              Title
            </label>
            <input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Ground booking moved to tomorrow"
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
            />
          </div>

          <div>
            <label htmlFor="a-body" className="text-xs font-medium text-white/70">
              Message
            </label>
            <textarea
              id="a-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={3}
              placeholder="Details…"
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
            />
          </div>

          <div>
            <label htmlFor="a-tournament" className="text-xs font-medium text-white/70">
              Audience
            </label>
            <select
              id="a-tournament"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber"
            >
              <option value="" className="bg-playops-dark-bg">
                Whole hostel
              </option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id} className="bg-playops-dark-bg">
                  Only &ldquo;{t.name}&rdquo;&apos;s registered teams
                </option>
              ))}
            </select>
          </div>

          {submitError && <p className="text-sm text-red-400">{submitError}</p>}

          <button
            type="submit"
            disabled={busy || !title || !body}
            className="rounded-md bg-playops-amber px-4 py-2 text-sm font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post announcement'}
          </button>
        </form>
      )}

      {lastResult && <p className="mt-4 text-sm text-emerald-400">{lastResult}</p>}
      {loadError && <p className="mt-4 text-sm text-red-400">{loadError}</p>}
      {deleteError && <p className="mt-4 text-sm text-red-400">{deleteError}</p>}

      <div className="mt-6 space-y-3">
        {announcements === null ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : announcements.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-10 text-center text-sm text-white/40">
            No announcements yet.
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="rounded-lg border border-white/10 bg-playops-dark-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-white">{a.title}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40">{formatDateTime(a.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(a)}
                    disabled={deletingId === a.id}
                    className="text-xs font-medium text-red-400 hover:underline disabled:opacity-50"
                  >
                    {deletingId === a.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-white/70">{a.body}</p>
              {a.tournamentId && (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-playops-amber">
                  Tournament-specific
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
