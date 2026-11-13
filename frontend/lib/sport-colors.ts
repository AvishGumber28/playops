// Distinct per-sport accent so a list of mixed tournaments reads as
// mixed at a glance, instead of every card using the same brand amber.
// Named sports get a fixed color; anything else falls back to a
// deterministic pick from the same palette (stable hostel-wide, not
// per-session).
const PALETTE = [
  { badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300', dot: 'bg-amber-400' },
  { badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', dot: 'bg-emerald-400' },
  { badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300', dot: 'bg-sky-400' },
  { badge: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300', dot: 'bg-fuchsia-400' },
  { badge: 'border-orange-400/30 bg-orange-400/10 text-orange-300', dot: 'bg-orange-400' },
];

const FIXED: Record<string, number> = {
  cricket: 0,
  football: 1,
  basketball: 2,
};

function hashIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % PALETTE.length;
}

export function sportColor(sportName: string) {
  const key = sportName.trim().toLowerCase();
  const index = key in FIXED ? FIXED[key] : hashIndex(key);
  return PALETTE[index];
}
