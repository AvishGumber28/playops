'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { MeResponse } from '@/lib/api';

/**
 * Shared guard for the Student-only routes (/dashboard/student-
 * tournaments, /dashboard/student-equipment). Mirrors
 * components/secretary/use-secretary-guard.ts and
 * components/caretaker/use-caretaker-guard.ts - "student" is whoever
 * doesn't resolve to Secretary/Caretaker/Admin (FR-002/D-006's own
 * priority order, matching app/dashboard/page.tsx's role dispatch), not
 * a stored role field.
 */
export function useStudentGuard(): MeResponse | null {
  const { token, me, loading } = useAuth();
  const router = useRouter();

  const isOtherRole = (m: MeResponse) =>
    m.secretaryOfHostels.length > 0 || m.caretakerOfHostels.length > 0 || m.isSportsAdmin;

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (me && isOtherRole(me)) {
      router.replace('/dashboard');
    }
  }, [loading, token, me, router]);

  if (loading || !token || !me || isOtherRole(me)) {
    return null;
  }
  return me;
}
