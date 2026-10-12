'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import type { HostelRef, MeResponse } from '@/lib/api';

// Mirrors SecretaryNavbar/CaretakerNavbar/AdminNavbar's shape - Student
// now owns its own full-page shell too, split into Home / Tournaments /
// Equipment / Venue Booking the same way Secretary is split.
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/student-tournaments', label: 'Tournaments' },
  { href: '/dashboard/student-equipment', label: 'Equipment' },
  { href: '/dashboard/student-venue', label: 'Venue Booking' },
] as const;

export function StudentNavbar({ me, hostel }: { me: MeResponse; hostel: HostelRef }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const initials =
    me.name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-playops-dark-bg px-6 py-3 text-white">
      <div className="flex items-center gap-3">
        <span className="text-sm font-extrabold tracking-tight">PLAYOPS</span>
        <span className="text-white/30">/</span>
        <span className="rounded bg-white/10 px-2 py-1 text-xs font-medium">
          Hostel {hostel.code} ({hostel.name})
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'font-semibold text-playops-amber' : 'text-white/70 hover:text-white'}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="text-right text-xs leading-tight">
          <p className="font-medium">{me.name}</p>
          <p className="text-white/50">Student</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-playops-amber text-xs font-bold text-playops-charcoal">
          {initials}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={logout}
        >
          Sign out
        </Button>
      </div>
    </nav>
  );
}
