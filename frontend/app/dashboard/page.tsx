'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { StudentDashboard } from '@/components/student/student-dashboard';
import { CaretakerDashboard } from '@/components/caretaker/caretaker-dashboard';
import { SecretaryDashboard } from '@/components/secretary/secretary-dashboard';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

export default function DashboardPage() {
  const { token, me, loading } = useAuth();
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
  // first that applies, same priority order as before
  // (Secretary > Caretaker > SportsAdmin > Student).
  //
  // Every role now owns its own full-page shell (a dark navbar with its
  // own nav destinations - see components/secretary/, /caretaker/,
  // /admin/, /student/) - there's no generic fallback shell left.
  if (me.secretaryOfHostels.length > 0) {
    return <SecretaryDashboard me={me} />;
  }
  if (me.caretakerOfHostels.length > 0) {
    return <CaretakerDashboard me={me} />;
  }
  if (me.isSportsAdmin) {
    return <AdminDashboard me={me} />;
  }
  return <StudentDashboard me={me} />;
}
