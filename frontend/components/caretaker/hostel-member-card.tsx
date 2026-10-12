'use client';

import { useState, FormEvent } from 'react';
import { Mail, Pencil, CheckCircle2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface HostelMemberInfo {
  name: string;
  email: string;
  rollNumber?: string | null;
  photoUrl?: string | null;
}

interface HostelMemberCardProps {
  roleLabel: string;
  roleBadgeClassName: string;
  // null = vacant. Only present at all for the real (Sports Secretary)
  // card - the three dummy cards always pass a fixed placeholder object.
  member: HostelMemberInfo | null;
  highlighted?: boolean;
  managedByYou?: boolean;
  // Presence of this prop is what makes a card "real" - it's what's
  // called when the caretaker types an email and confirms. The three
  // dummy cards simply don't get this prop, so they render with no way
  // to edit them at all (per explicit instruction: only Sports Secretary
  // is functional here).
  onAppoint?: (email: string) => Promise<void>;
}

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

// One "member" card in the hostel committee grid. "Moving" = the hover
// lift/shadow transition below - not a carousel. Only the card given an
// onAppoint prop is interactive; the other three render the exact same
// shape with no edit affordance at all, so there's no way to mistake a
// dummy card for a working one.
export function HostelMemberCard({
  roleLabel,
  roleBadgeClassName,
  member,
  highlighted,
  managedByYou,
  onAppoint,
}: HostelMemberCardProps) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onAppoint) return;

    // Appointing a new Secretary silently replaces whoever holds the
    // role now (FR-004: exactly one at a time, no history kept) - so if
    // the seat isn't vacant, make the caretaker confirm exactly who
    // they're about to remove before it happens.
    if (member) {
      const confirmed = window.confirm(
        `${member.name} (${member.email}) is the current ${roleLabel}. Appointing ${email} ` +
          `will immediately replace them - ${member.name} loses Secretary access and ${email} ` +
          `gets it. Continue?`,
      );
      if (!confirmed) return;
    }

    setError(null);
    setBusy(true);
    try {
      await onAppoint(email);
      setEmail('');
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-playops-dark-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40',
        highlighted ? 'border-playops-amber/60' : 'border-white/10',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            roleBadgeClassName,
          )}
        >
          {roleLabel}
        </span>
        {managedByYou && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            Managed by you
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center text-center">
        {member?.photoUrl ? (
          // External URL the user pastes in (D-012), not a local/
          // optimizable asset - next/image can't help here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photoUrl}
            alt={member.name}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white">
            {member ? initialsOf(member.name) : '—'}
          </span>
        )}
        <p className="mt-3 text-base font-bold text-white">{member?.name ?? 'Vacant'}</p>
        {member?.rollNumber ? (
          <span className="mt-1 rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white/70">
            {member.rollNumber}
          </span>
        ) : member ? (
          <span className="mt-1 text-xs text-white/30">Roll number not set</span>
        ) : null}
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        {member && (
          <p className="flex items-center gap-1.5 text-xs text-white/50">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{member.email}</span>
          </p>
        )}

        {onAppoint &&
          (editing ? (
            <form onSubmit={handleSubmit} className="mt-3 space-y-2">
              <Input
                type="email"
                autoFocus
                placeholder="student@thapar.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 border-white/15 bg-white/5 text-xs text-white placeholder:text-white/30 focus-visible:ring-playops-amber"
                required
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !email}
                  className="h-7 flex-1 bg-playops-amber text-xs text-playops-charcoal hover:bg-playops-amber/90"
                >
                  {busy ? 'Saving…' : 'Confirm'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {error && <p className="text-[11px] text-red-400">{error}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 flex items-center gap-1 text-xs font-medium text-playops-amber hover:underline"
            >
              <Pencil className="h-3 w-3" />
              {member ? 'Change Secretary' : 'Appoint Secretary'}
            </button>
          ))}
      </div>
    </div>
  );
}
