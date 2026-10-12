'use client';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  checked_out: { label: 'Checked Out', className: 'bg-emerald-500/20 text-emerald-300' },
  pending: { label: 'Pending', className: 'bg-playops-amber/20 text-playops-amber' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-300' },
  returned: { label: 'Returned', className: 'bg-white/10 text-white/60' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, className: 'bg-white/10 text-white/60' };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function RoleTag({ role }: { role: string }) {
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
        (role === 'secretary'
          ? 'bg-indigo-500/20 text-indigo-300'
          : 'bg-sky-500/20 text-sky-300')
      }
    >
      {role === 'secretary' ? 'Secretary' : 'Student'}
    </span>
  );
}
