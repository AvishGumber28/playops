'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LoginHeroPanel } from '@/components/login/login-hero-panel';
import { LoginFormCard, type LoginSubmitValues } from '@/components/login/login-form-card';

// Redesigned login screen (see docs/api-contract.md for the real
// POST /api/auth/login this calls via useAuth().login()).
//
// The role tab IS now enforced (previously cosmetic-only - see
// role-selector.tsx's comment, now stale) - but not by checking the
// email string against any hardcoded list. Real role resolution is
// still always computed server-side from Hostel relationships / the
// isSportsAdmin flag (FR-002/D-006): a login only goes through if
// /api/me's caretakerOfHostels/secretaryOfHostels/isSportsAdmin actually
// matches the tab picked. Each tab requires an EXACT match, including
// Student - a Caretaker, Secretary, or Admin account can't log in via
// Student either, they have to use their own tab. Credentials being
// correct isn't enough on its own if the tab claims a relationship that
// account doesn't hold.
export default function LoginPage() {
  const { login, logout } = useAuth();
  const router = useRouter();

  async function handleSubmit({ role, email, password }: LoginSubmitValues) {
    const me = await login(email, password); // throws ApiError on wrong credentials

    if (!me) {
      throw new Error('Could not load your account. Please try again.');
    }

    const isCaretaker = me.caretakerOfHostels.length > 0;
    const isSecretary = me.secretaryOfHostels.length > 0;
    const isAdmin = me.isSportsAdmin;

    if (role === 'student' && (isCaretaker || isSecretary || isAdmin)) {
      logout();
      const actualTab = isCaretaker ? 'Caretaker' : isSecretary ? 'Secretary' : 'Admin';
      throw new Error(`This account is registered as a ${actualTab}. Select ${actualTab} above and try again.`);
    }

    if (role === 'caretaker' && !isCaretaker) {
      logout();
      throw new Error(
        "This account isn't registered as a Caretaker. Select Student and try again.",
      );
    }

    if (role === 'secretary' && !isSecretary) {
      logout();
      throw new Error(
        "This account hasn't been appointed as a Secretary by a Caretaker yet. Select Student and try again.",
      );
    }

    if (role === 'admin' && !isAdmin) {
      logout();
      throw new Error(
        "This account isn't registered with the Sports Department. Select Student and try again.",
      );
    }

    router.push('/dashboard');
  }

  return (
    <main className="flex min-h-screen w-full flex-1 flex-col bg-playops-green md:flex-row">
      <LoginHeroPanel />
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <LoginFormCard onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
