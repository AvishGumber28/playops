// The fixed 1-hour slot grid, 06:00 through 19:00-20:00 (D-019) -
// mirrored from frontend/lib/venue-mock.ts's SLOT_HOURS constant. No
// shared package between frontend/backend in this project, so this is
// duplicated the same way other enum-shaped values already are (e.g.
// CreateTournamentDto's knockout/league IsIn list).
export const SLOT_HOURS = [
  '06:00-07:00',
  '07:00-08:00',
  '08:00-09:00',
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
  '19:00-20:00',
] as const;

export function splitHour(hour: string): [string, string] {
  const [start, end] = hour.split('-');
  return [start, end];
}
