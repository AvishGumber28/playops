# User Journeys & Workflow Design

## Role journeys

### Student
Sign up (college email) → select hostel → browse tournaments → join a team (or create one,
becoming Captain) → view fixtures/schedule → receive notifications → view results/standings.

### Team Captain
Everything a Student can do, plus: create a team under a tournament → add/remove players
(own team, before the registration deadline) → track registration status → withdraw the team
if needed (see Exception Workflows).

### Sports Secretary
Appointed once by the Caretaker → create a tournament (no separate approval — the
appointment already is the vetting step) → manage registrations → generate fixtures
(automatic, or manual when seeding matters) → request venue/equipment bookings → handle
disruptions (trigger rescheduling) → enter match results → publish announcements.

### Caretaker
Appoint/replace the hostel's Sports Secretary → review and approve/reject hostel change
requests for students currently in their hostel → monitor hostel tournament activity
(view-only — no edit power over tournaments themselves, per the Phase 2 permission matrix).

### Sports Department
Review venue/equipment booking requests against live availability → approve, reject, or
manually book a slot for an offline arrangement → maintain the venue/equipment catalog.

---

## The tournament lifecycle

```
Caretaker appoints Sports Secretary          (one-time per hostel, not per tournament)
        ↓
Secretary creates tournament                 (no approval step — see business rule 7)
        ↓
Registration opens
        ↓
Captain creates team, adds players           (hostel-eligibility checked at every add)
        ↓
Registration deadline passes
        ↓
Fixtures generated                           (automatic default, manual for seeding)
        ↓
Schedule validated for conflicts             (team/venue/player clashes caught here)
        ↓
Secretary requests venue/equipment           (live availability shown)
        ↓
Sports Department approves booking
        ↓
Match played
        ↓
Secretary enters result (scorecard)
        ↓
Standings update                             (league format only, computed on demand)
        ↓
Next round / tournament continues
        ↓
Tournament completed
```

This deliberately differs from a generic tournament flow at one point: there is no
"Tournament Proposal → Approval" stage. That's not an omission — it was an explicit decision
(business rule 7): the Caretaker already vetted this person by appointing them Secretary, so
requiring approval again for every tournament they create would be redundant.

---

## Exception workflows

### Registration rejected
Automatic: a player fails the hostel-eligibility check (FR-006) and is rejected immediately,
before the team is affected. Manual: per Q-007 (still open), the Secretary may also reject a
registration that passed the automatic check, for reasons like an incomplete roster.

### Match cancellation / disruption
Secretary marks the match cancelled with a reason (e.g. "Rain") → the conflict engine
searches for available alternative slots → the top option is submitted as a new venue
booking request → Sports Department approves it through the normal flow. Never auto-booked.

### Venue conflict (double-booking attempt)
Prevented structurally: the booking table enforces at most one *approved* booking per
venue/date/time slot (business rule 3), regardless of whether the conflicting request came
from a Secretary or a Sports Department manual entry. A second request for an already-
approved slot is shown as unavailable before it can even be submitted.

### Two pending requests for the same slot
Both stay visible until one is approved (which locks the slot); the other is then resolved by
the Sports Department — rejected outright, or routed into the same alternative-slot
suggestions used for disruptions.

### Player withdrawal
A player cannot remove themselves from a team — only the team's Captain can remove a
player, same as adding one (per D-007). Keeps roster changes under one accountable person
instead of scattered self-service edits. Allowed only before the registration deadline, same
as any other roster edit.

### Team withdrawal
Before fixtures are generated: a clean removal, no trace left in the bracket. After
fixtures/matches already exist: the team's remaining matches are marked forfeited, and the
opposing team in each of those matches is awarded the win — a walkover — rather than the
bracket being regenerated (per D-007).

### Hostel change mid-tournament
Blocked while the student is on an active (non-withdrawn) team in an in-progress tournament
— approving it immediately would risk putting them on a team that no longer matches their
hostel, breaking business rule 1. The request can proceed once the tournament ends, or once
the student withdraws or is removed from the team (per D-007).

---

## Open questions surfaced by this phase

Designing the exception workflows in detail surfaced three real gaps, all now resolved — see
`decision-log.md` D-007.
