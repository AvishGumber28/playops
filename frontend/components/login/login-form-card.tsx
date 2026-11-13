'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { RoleSelector, LOGIN_ROLE_TABS, type LoginRoleId } from './role-selector';

export interface LoginSubmitValues {
  role: LoginRoleId;
  email: string;
  password: string;
}

interface LoginFormCardProps {
  // Real login handler - wired to useAuth().login() + the role-tab
  // enforcement + a redirect, all in app/login/page.tsx (see
  // role-selector.tsx's comment for what changed). Should throw on
  // failure (with a human-readable .message) - that's what surfaces as
  // the inline error below the password field, whether the failure was
  // wrong credentials or a credentials-correct-but-wrong-role rejection.
  // Falls back to a console.log stub if no handler is passed, so this
  // component still renders standalone.
  onSubmit?: (values: LoginSubmitValues) => Promise<void>;
}

export function LoginFormCard({ onSubmit }: LoginFormCardProps) {
  const [role, setRole] = useState<LoginRoleId>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const loading = submitting;

  const activeRole = LOGIN_ROLE_TABS.find((r) => r.id === role) ?? LOGIN_ROLE_TABS[0];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onSubmit) {
      console.log('[login stub] submit', { role, email, password });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ role, email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md border border-white/10 bg-white/[0.04] p-8 shadow-xl backdrop-blur-xl">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
            Select role
          </p>
          <span className="rounded-full bg-playops-amber/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-playops-amber">
            {activeRole.label}
          </span>
        </div>

        <div className="mt-3">
          <RoleSelector
            value={role}
            onChange={(next) => {
              setRole(next);
              setError(null);
            }}
          />
        </div>
        <p className="mt-3 text-xs text-white/50">{activeRole.subtext}</p>

        <>
            <div className="mt-6">
              <h2 className="text-xl font-bold text-white">Welcome back</h2>
              <p className="mt-1 text-sm text-white/50">
                Enter your college credentials to access your sports portal
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="login-email"
                className="text-[10px] font-bold uppercase tracking-wide text-white/50"
              >
                College email
              </label>
              <span className="text-[10px] text-white/40">.edu required</span>
            </div>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                id="login-email"
                type="email"
                placeholder="student@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-playops-amber"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="text-[10px] font-bold uppercase tracking-wide text-white/50"
            >
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-white/15 bg-white/5 pl-9 pr-9 text-white focus-visible:ring-2 focus-visible:ring-playops-amber"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-playops-amber text-playops-charcoal hover:bg-playops-amber/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Logging in…
              </>
            ) : (
              <>
                Log in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
            </form>
          </>

        {/* Signup only ever creates a Student account - showing this
            link on a role that signup can't produce would be misleading. */}
        {role === 'student' && (
          <>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <p className="mt-4 text-center text-sm text-white/50">
              New here?{' '}
              <Link
                href="/signup"
                className="font-medium text-playops-amber underline underline-offset-4 hover:text-playops-amber/80"
              >
                Create an account
              </Link>
            </p>
          </>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-white/40">
          <span>Campus ID SSO encrypted</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            256-bit SSL
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
