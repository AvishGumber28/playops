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

  // Real submit state - set by handleSubmit below on an actual login
  // attempt.
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dev-only preview overrides for the same two visual states - see the
  // "Test states" row below, only rendered outside production. Kept
  // independent of the real state above so they can still preview each
  // look without needing a real failed/slow login to trigger it.
  const [devErrorOn, setDevErrorOn] = useState(false);
  const [devLoadingOn, setDevLoadingOn] = useState(false);

  const displayError = devErrorOn ? 'Incorrect email or password. Please try again.' : error;
  const loading = submitting || devLoadingOn;

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
    <Card className="w-full max-w-md border-none bg-playops-cream p-8 shadow-xl">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Select role
          </p>
          <span className="rounded-full bg-playops-green/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-playops-green">
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
        <p className="mt-3 text-xs text-muted-foreground">{activeRole.subtext}</p>

        <>
            <div className="mt-6">
              <h2 className="text-xl font-bold text-playops-charcoal">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your college credentials to access your sports portal
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="login-email"
                className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                College email
              </label>
              <span className="text-[10px] text-muted-foreground">.edu required</span>
            </div>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                placeholder="student@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-input bg-white pl-9 focus-visible:ring-2 focus-visible:ring-playops-green"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
            >
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-input bg-white pl-9 pr-9 focus-visible:ring-2 focus-visible:ring-playops-green"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-playops-charcoal"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {displayError && <p className="mt-1.5 text-xs text-destructive">{displayError}</p>}
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="flex items-center justify-between rounded-md border border-dashed border-muted-foreground/30 px-3 py-2 text-xs text-muted-foreground">
              <span>Test states:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDevErrorOn((v) => !v)}
                  className="rounded border border-input bg-white px-2 py-1 hover:bg-accent"
                >
                  Toggle Error
                </button>
                <button
                  type="button"
                  onClick={() => setDevLoadingOn((v) => !v)}
                  className="rounded border border-input bg-white px-2 py-1 hover:bg-accent"
                >
                  Test Spinner
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-playops-green text-white hover:bg-playops-green/90"
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
              <div className="h-px flex-1 bg-border" />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              New here?{' '}
              <Link
                href="/signup"
                className="font-medium text-playops-green underline underline-offset-4 hover:text-playops-green/80"
              >
                Create an account
              </Link>
            </p>
          </>
        )}

        <div className="mt-6 flex items-center justify-between border-t pt-4 text-[10px] text-muted-foreground">
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
