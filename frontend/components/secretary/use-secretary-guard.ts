'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { MeResponse } from '@/lib/api';

/**
 * Shared guard for the Secretary-only routes (/dashboard/secretary-
 * tournaments, /dashboard/secretary-announcements). Mirrors
 * components/caretaker/use-caretaker-guard.ts exactly, checking
 * secretaryOfHostels instead of caretakerOfHostels - role resolution is
 * always computed fresh from /api/me (FR-002/D-006).
 */
export function useSecretaryGuard(): MeResponse | null {
  const { token, me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (me && me.secretaryOfHostels.length === 0) {
      router.replace('/dashboard');
    }
  }, [loading, token, me, router]);

  if (loading || !token || !me || me.secretaryOfHostels.length === 0) {
    return null;
  }
  return me;
}
