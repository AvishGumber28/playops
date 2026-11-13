// Distinct per-item icon + accent so the equipment grid doesn't read as
// one flat list of identical cards. Keyword-matched against the item
// name (seeded items are per-sport, so "Cricket Bat" / "Basketball" /
// "Football" match directly); anything unrecognized falls back to a
// neutral crate icon rather than guessing.
const ICONS: { match: RegExp; icon: string; badge: string }[] = [
  { match: /basketball/i, icon: '🏀', badge: 'border-orange-400/30 bg-orange-400/10 text-orange-300' },
  { match: /cricket|bat|stump|wicket/i, icon: '🏏', badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  { match: /football/i, icon: '⚽', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  { match: /badminton|shuttle|racquet|racket/i, icon: '🏸', badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  { match: /volleyball/i, icon: '🏐', badge: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300' },
  { match: /cone|marker/i, icon: '🔶', badge: 'border-orange-400/30 bg-orange-400/10 text-orange-300' },
  { match: /whistle/i, icon: '🦻', badge: 'border-white/15 bg-white/10 text-white/60' },
];

export function equipmentIcon(itemName: string) {
  const hit = ICONS.find((entry) => entry.match.test(itemName));
  return hit ?? { icon: '📦', badge: 'border-white/15 bg-white/10 text-white/60' };
}
