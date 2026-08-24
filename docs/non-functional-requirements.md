# Non-Functional Requirements

## Performance
- Venue/equipment availability checks must return quickly enough to support a live
  "request a slot" flow — a Secretary shouldn't submit a request without seeing current
  availability first.
- Conflict detection must validate a full proposed fixture set (every team, venue, and rest
  constraint in one tournament) within a practical time for interactive use, not a background
  batch job.
- Booking writes are consistency-checked at the database level, not just in application code,
  so two approved bookings can never overlap regardless of request timing.

## Security
- Role-based permissions are enforced on the backend for every request. The frontend hiding a
  button is a UX nicety, not a security control.
- Only the Sports Secretary can submit an official match result.
- Only the Sports Department can approve venue/equipment bookings.
- Only a Caretaker can appoint a Sports Secretary or approve a hostel change, and only for
  their own hostel.
- Authentication is gated by the college's email domain — no outside registrations possible.
- Passwords are hashed, never stored or logged in plain text. Session tokens are signed and
  short-lived.

## Reliability
- A booked venue slot cannot be double-booked — enforced structurally, not just checked.
- A submitted match result is treated as final; there's no accidental-overwrite path.
- Disruption-driven rescheduling always goes through Sports Department approval — never
  changes a schedule silently.

## Usability
- A Sports Secretary needs no per-tournament approval — their appointment is the vetting step
  — keeping the most common workflow short.
- Communication is scoped to the relevant hostel/tournament rather than funneled through one
  catch-all group, directly addressing the fragmentation problem PlayOps exists to solve.

## Maintainability
- Tournament, venue, conflict/scheduling, and notification logic are kept as separate
  modules, so a new sport or tournament level (inter-hostel, in Future Scope) doesn't require
  reworking unrelated parts of the system.
- Scorecards use a flexible, sport-templated structure rather than a hardcoded table per
  sport, so adding a sport is a data change, not a schema migration.
