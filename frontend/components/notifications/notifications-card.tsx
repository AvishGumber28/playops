'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, NotificationItem } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// FR-012: the most recent notifications, inline on a dashboard's Home
// tab - the same data the navbar's NotificationBell shows, just the
// top few without needing to open the dropdown. Shared across every
// role's Home page.
export function NotificationsCard() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.listMyNotifications(token);
      setItems(result.notifications.slice(0, 5));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load notifications.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function markRead(n: NotificationItem) {
    if (!token || n.readAt) return;
    try {
      await api.markNotificationRead(token, n.id);
      setItems((list) =>
        list
          ? list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
          : list,
      );
    } catch {
      // Not critical - the item just stays unread until the next refresh.
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-playops-dark-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-white">Notifications</h2>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {!error && items === null && <p className="mt-2 text-sm text-white/40">Loading…</p>}
      {!error && items && items.length === 0 && (
        <p className="mt-2 text-sm text-white/50">Nothing yet.</p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-3 divide-y divide-white/5">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void markRead(n)}
                className="block w-full py-2 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={'text-sm font-medium ' + (n.readAt ? 'text-white/50' : 'text-white')}>
                    {n.announcement?.title ?? n.message}
                  </span>
                  {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-playops-amber" />}
                </div>
                {n.announcement?.body && (
                  <p className="mt-0.5 text-xs text-white/50">{n.announcement.body}</p>
                )}
                <p className="mt-1 text-[10px] text-white/30">{timeAgo(n.createdAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
