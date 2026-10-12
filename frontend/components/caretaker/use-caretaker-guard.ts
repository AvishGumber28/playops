'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { MeResponse } from '@/lib/api';

/**
 * Shared guard for the three Caretaker-only routes (/dashboard,
 * /dashboard/tournaments, /dashboard/secretary). Role resolution is
 * always computed fresh from /api/me's caretakerOfHostels array (FR-002/
 * D-006 - never a stored "role" field, never a client-side email-format
 * check) - this hook just redirects away when that check fails, the same
 * way app/dashboard/page.tsx already redirects unauthenticated visitors.
 *
 * Returns `me` once it's safe to render Caretaker-only content, or `null`
 * while still loading or mid-redirect (render a loading state in that
 * case, same pattern as app/dashboard/page.tsx).
 */
export function useCaretakerGuard(): MeResponse | null {
  const { token, me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    // Not a Caretaker anywhere - send them to the dashboard router, which
    // will resolve their actual role and show the right thing instead.
    if (me && me.caretakerOfHostels.length === 0) {
      router.replace('/dashboard');
    }
  }, [loading, token, me, router]);

  if (loading || !token || !me || me.caretakerOfHostels.length === 0) {
    return null;
  }
  return me;
}
