import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from './notification-bell';
import { api, ApiError, type NotificationItem } from '@/lib/api';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: {
      listMyNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
    },
  };
});

function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    message: 'A match was scheduled.',
    readAt: null,
    createdAt: new Date().toISOString(),
    announcement: null,
    ...overrides,
  };
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(api.listMyNotifications).mockReset();
    vi.mocked(api.markNotificationRead).mockReset();
  });

  it('shows the unread count badge once notifications load', async () => {
    vi.mocked(api.listMyNotifications).mockResolvedValue({
      notifications: [notification()],
      unreadCount: 3,
    });

    render(<NotificationBell />);

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('caps the badge at "9+" rather than showing an unbounded number', async () => {
    vi.mocked(api.listMyNotifications).mockResolvedValue({
      notifications: [],
      unreadCount: 42,
    });

    render(<NotificationBell />);

    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('opens the panel on click and lists each notification', async () => {
    vi.mocked(api.listMyNotifications).mockResolvedValue({
      notifications: [notification({ message: 'Your match starts in an hour.' })],
      unreadCount: 1,
    });

    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Your match starts in an hour.')).toBeInTheDocument();
  });

  it('shows "Nothing yet." when there are no notifications', async () => {
    vi.mocked(api.listMyNotifications).mockResolvedValue({ notifications: [], unreadCount: 0 });

    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Nothing yet.')).toBeInTheDocument();
  });

  it('marks an unread notification read on click and decrements the unread count', async () => {
    vi.mocked(api.listMyNotifications).mockResolvedValue({
      notifications: [notification({ id: 'n1', message: 'Unread one' })],
      unreadCount: 1,
    });
    vi.mocked(api.markNotificationRead).mockResolvedValue({ read: true });

    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await userEvent.click(await screen.findByText('Unread one'));

    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith('fake-token', 'n1'));
    // The red count badge disappears once nothing is unread.
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
  });

  it('shows a readable error message instead of crashing when the fetch fails', async () => {
    vi.mocked(api.listMyNotifications).mockRejectedValue(
      new ApiError({ statusCode: 500, path: '/api/notifications', timestamp: '', message: 'Server exploded' }),
    );

    render(<NotificationBell />);
    // The error banner lives inside the dropdown panel, same as the list.
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
  });
});
