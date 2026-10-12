'use client';

import { MapPin } from 'lucide-react';
import type { VenueRef } from '@/lib/api';

// A compact "map" of the venue catalog (currently 3 grounds, fetched
// from GET /api/venues - not hardcoded) - three-ish equal tiles, click
// one to pop open its slot card (venue-slot-modal.tsx) for the selected
// date.
export function GroundPicker({
  venues,
  onSelect,
}: {
  venues: VenueRef[];
  onSelect: (v: VenueRef) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {venues.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onSelect(v)}
          className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-playops-dark-surface px-3 py-5 text-center transition-colors hover:border-playops-amber/60 hover:bg-white/5"
        >
          <MapPin className="h-5 w-5 text-playops-amber" />
          <span className="text-xs font-medium text-white">{v.name}</span>
        </button>
      ))}
    </div>
  );
}
