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

// FR-012: in-app only, fetched on demand (system-architecture.md's own
// "Notification architecture" decision - no push/websockets in v1).
// Shared across every role's navbar - delivery is scoped server-side
// (hostel/tournament), so each viewer only ever sees their own.
export function NotificationBell() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.listMyNotifications(token);
      setItems(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load notifications.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function openPanel() {
    setOpen((v) => !v);
    if (!open) await load(); // refresh on every open, fetch-on-demand
  }

  async function markRead(notification: NotificationItem) {
    if (!token || notification.readAt) return;
    try {
      await api.markNotificationRead(token, notification.id);
      setItems((list) =>
        list.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch {
      // Not critical - the item just stays unread until the next refresh.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void openPanel()}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-white/10 bg-playops-dark-bg p-3 shadow-xl">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-white/50">
              Notifications
            </p>
            {error && <p className="mt-2 px-1 text-sm text-red-400">{error}</p>}
            {!error && items.length === 0 && (
              <p className="mt-3 px-1 text-sm text-white/40">Nothing yet.</p>
            )}
            <div className="mt-2 space-y-1">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void markRead(n)}
                  className={
                    'block w-full rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-white/5 ' +
                    (n.readAt ? 'text-white/50' : 'text-white')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{n.announcement?.title ?? n.message}</span>
                    {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-playops-amber" />}
                  </div>
                  {n.announcement?.body && (
                    <p className="mt-0.5 text-xs text-white/50">{n.announcement.body}</p>
                  )}
                  <p className="mt-1 text-[10px] text-white/30">{timeAgo(n.createdAt)}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
