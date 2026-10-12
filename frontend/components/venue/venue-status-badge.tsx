'use client';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  // Slate/gray on purpose - Available is green, and this needed to read
  // clearly distinct from it at a glance. Matches the same neutral
  // "settled/no longer actionable" look already used for Equipment's
  // "Returned" and a completed tournament's status pill.
  approved: { label: 'Booked', className: 'bg-white/10 text-white/60' },
  pending: { label: 'Pending', className: 'bg-playops-amber/20 text-playops-amber' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-300' },
};

export function VenueStatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, className: 'bg-white/10 text-white/60' };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}
