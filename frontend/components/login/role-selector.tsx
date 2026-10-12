import { GraduationCap, ClipboardList, Building2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LOGIN_ROLE_TABS = [
  {
    id: 'student',
    label: 'Student',
    icon: GraduationCap,
    subtext: 'Join teams, track your matches',
  },
  {
    id: 'secretary',
    label: 'Secretary',
    icon: ClipboardList,
    subtext: 'Manage tournaments for your hostel',
  },
  {
    id: 'caretaker',
    label: 'Caretaker',
    icon: Building2,
    subtext: "Oversee your hostel's roster",
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    subtext: 'Administer venues and bookings',
  },
] as const;

export type LoginRoleId = (typeof LOGIN_ROLE_TABS)[number]['id'];

interface RoleSelectorProps {
  value: LoginRoleId;
  onChange: (id: LoginRoleId) => void;
}

/**
 * This component itself stays dumb - a tab strip plus the one-line
 * subtext the parent looks up from LOGIN_ROLE_TABS. It never changes
 * which form fields render (always just email + password) and holds no
 * logic of its own.
 *
 * IT WAS ORIGINALLY COSMETIC ONLY, BUT NO LONGER IS: app/login/page.tsx
 * now enforces the selected tab against the account's real,
 * server-computed capabilities (caretakerOfHostels/secretaryOfHostels
 * from /api/me) after a successful login, and rejects the login if they
 * don't match - picking "Caretaker" with a Student account's correct
 * password no longer gets you in. Still never a client-side role
 * *choice* though - it's a claim this account then has to actually back
 * up server-side (FR-002/D-006's scoped-capability model, unchanged).
 */
export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {LOGIN_ROLE_TABS.map((role) => {
        const Icon = role.icon;
        const active = role.id === value;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onChange(role.id)}
            aria-pressed={active}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition-colors',
              active
                ? 'border-playops-green bg-playops-green text-white'
                : 'border-input text-muted-foreground hover:bg-accent',
            )}
          >
            <Icon className="h-4 w-4" />
            {role.label}
          </button>
        );
      })}
    </div>
  );
}
