'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  StudentDashboard,
  CaretakerDashboard,
  SecretaryDashboard,
  SportsAdminDashboard,
} from '@/components/dashboards';

export default function DashboardPage() {
  const { token, me, loading, logout } = useAuth();
  const router = useRouter();

  // Route protection: an unauthenticated visitor gets sent to login, but
  // only once loading has actually resolved - redirecting while still
  // loading would bounce someone with a perfectly valid stored token.
  useEffect(() => {
    if (!loading && !token) {
      router.replace('/login');
    }
  }, [loading, token, router]);

  if (loading || !token) {
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }

  if (!me) {
    return <p className="p-6 text-muted-foreground">Loading your dashboard…</p>;
  }

  // This is the routing decision described in Phase 8: pick a dashboard
  // shell from what /api/me resolved, never from a stored "role" field.
  // A user could in principle match more than one - v1 just shows the
  // first that applies.
  let DashboardContent;
  if (me.secretaryOfHostels.length > 0) DashboardContent = <SecretaryDashboard me={me} />;
  else if (me.caretakerOfHostels.length > 0) DashboardContent = <CaretakerDashboard me={me} />;
  else if (me.isSportsAdmin) DashboardContent = <SportsAdminDashboard me={me} />;
  else DashboardContent = <StudentDashboard me={me} />;

  return (
    <div>
      <nav className="flex items-center justify-between border-b px-8 py-4">
        <span className="font-bold text-lg">PlayOps</span>
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </nav>
      <main className="mx-auto max-w-2xl px-6 py-10">{DashboardContent}</main>
    </div>
  );
}
