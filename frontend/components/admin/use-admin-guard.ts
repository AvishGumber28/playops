'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { MeResponse } from '@/lib/api';

/**
 * Shared guard for the Sports Admin-only routes. Mirrors
 * components/caretaker/use-caretaker-guard.ts and
 * components/secretary/use-secretary-guard.ts exactly, checking
 * `isSportsAdmin` instead - role resolution is always computed fresh
 * from /api/me (FR-002/D-006), never a client-side email/string check.
 */
export function useAdminGuard(): MeResponse | null {
  const { token, me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (me && !me.isSportsAdmin) {
      router.replace('/dashboard');
    }
  }, [loading, token, me, router]);

  if (loading || !token || !me || !me.isSportsAdmin) {
    return null;
  }
  return me;
}
