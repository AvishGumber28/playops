# API Contract (as actually built through Phase 7)

This documents what's real right now — not the planned shape from `system-architecture.md`,
the exact request/response contract of the endpoints that exist and are tested. Update this
file every time an endpoint is added or changed; Phase 8/9 frontend work builds against this.

## Global behavior (applies to every endpoint)

- Base path: every route is prefixed with `/api`
- **Validation**: unknown fields in a request body are rejected (400), not silently ignored
- **Error shape**, consistent across all failures:
  ```json
  {
    "statusCode": 400,
    "path": "/api/auth/signup",
    "timestamp": "2026-08-30T12:00:00.000Z",
    "message": "Only @yourcollege.edu email addresses can register."
  }
  ```
- CORS is restricted to whatever `ALLOWED_ORIGIN` is set to in `.env`

## GET /api/health

No auth required.

- 200 → `{ "status": "ok", "service": "playops-backend" }`

## POST /api/auth/signup

Request:
```json
{ "name": "Riya", "email": "riya@yourcollege.edu", "password": "at-least-8-chars" }
```

- 201 → `{ "user": { "id": "...", "email": "...", "name": "..." } }`
- 400 → email domain doesn't match `COLLEGE_EMAIL_DOMAIN`, or a field fails validation
  (missing name, invalid email format, password under 8 characters)
- 409 → email already registered

## POST /api/auth/login

Request:
```json
{ "email": "riya@yourcollege.edu", "password": "..." }
```

- 200 → `{ "token": "<jwt>" }`
- 401 → wrong email or password (deliberately the same error either way, so a failed login
  doesn't reveal whether an email is registered)

## GET /api/me

Requires `Authorization: Bearer <token>`.

- 200 →
```json
{
  "id": "...",
  "email": "...",
  "name": "...",
  "hostelId": null,
  "hostel": null,
  "isSportsAdmin": false,
  "caretakerOfHostels": [{ "id": "...", "code": "D", "name": "Hostel D" }],
  "secretaryOfHostels": [],
  "showSecretaryWelcome": false
}
```
- 401 → missing or invalid token

This is the actual role-check the frontend uses to decide which dashboard to render —
`secretaryOfHostels.length > 0` means show the Secretary dashboard, and so on. There is no
separate "role" field anywhere; it's always derived from these arrays, computed fresh on
every call (per FR-002 and D-006).

`hostel` is the caller's own hostel (`null` until they've selected one via
`POST /api/hostels/select`) — distinct from `caretakerOfHostels`/`secretaryOfHostels`, which
are the hostel(s) they hold a capability over, not necessarily live in.

`showSecretaryWelcome` (D-013) is `true` exactly once — the first time a newly-appointed
Secretary's own `/api/me` is fetched after being appointed — computed from
`secretaryOfHostels.length > 0 && !secretaryWelcomeShown`, not a raw stored value (the raw
column is never included in this response). The Secretary dashboard shows a one-time
congratulations banner when this is true, then calls the endpoint below so it never shows
again for that account.

## POST /api/me/acknowledge-secretary-welcome

Requires auth. Fire-and-forget — call once the congratulations banner has actually been shown
to the user. Flips `secretaryWelcomeShown` to `true` for the caller.

- 200 → `{ "acknowledged": true }`

## GET /api/hostels

Public — no auth required (nothing sensitive in a hostel's id/code/name, and a
not-yet-authenticated flow needs this list too).

- 200 → array of `{ "id": "...", "code": "A", "name": "Agira Hall" }`, ordered by code

## POST /api/hostels/select

Requires `Authorization: Bearer <token>`. First-time hostel selection only (FR-003) — a
user who already has a hostel must go through a change request instead (`POST
/api/hostels/change-requests`, below).

Request:
```json
{ "hostelId": "..." }
```

- 200 → `{ "hostel": {...}, "hostelSelectedAt": "...", "hostelLockedUntil": "..." }`
- 404 → hostel not found, or the requesting user not found
- 409 → user already has a hostel

**Lock duration:** 6 months from selection (`HOSTEL_LOCK_MONTHS` constant in
`hostel.service.ts`) — the docs said "a semester/year" without pinning down a number; this is
the concrete value chosen. Change that one constant if a full year is preferred.

## GET /api/hostels/:hostelId

Requires `Authorization: Bearer <token>` (any authenticated user — matches "View current
Secretary: Y" for everyone in `roles-permissions.md`).

- 200 →
```json
{
  "id": "...", "code": "A", "name": "Agira Hall",
  "sportsSecretary": { "id": "...", "name": "...", "email": "..." },
  "proctor": null,
  "gymSecretary": null,
  "messSecretary": null
}
```
- 404 → hostel not found

## POST /api/hostels/:hostelId/secretary — and /proctor, /gym-secretary, /mess-secretary

FR-004 (Secretary) and D-011 (the other three — Proctor, Gym Secretary, Mess Secretary; same
mechanism, but appointing them never changes the appointee's dashboard). All four take the
same request/response shape:

Request:
```json
{ "email": "riya@thapar.edu" }
```

- 200 → `{ "hostel": {"id","code","name"}, "appointee": {"id","name","email"} }`
- 403 → caller isn't this hostel's Caretaker
- 404 → hostel not found, or no user has that email
- 400 → that user isn't a member of this hostel
- 409 → that user already holds this exact title at a different hostel

Appointing replaces any previous holder silently — no history kept (D-005/Q-006).

## POST /api/hostels/change-requests

FR-003's change flow. Requires `Authorization: Bearer <token>`. For a student who already has
a hostel and wants to switch — a student with no hostel yet uses `/select` instead.

Request:
```json
{ "requestedHostelId": "..." }
```

- 200 → `{ "id": "...", "status": "pending", "createdAt": "...", "requestedHostel": {"id","code","name"} }`
- 400 → caller has no hostel yet, or is requesting the hostel they're already in
- 404 → requested hostel not found
- 409 → caller already has a pending request, **or** is on an active team in an in-progress
  tournament (business rule 13 — written correctly against the schema, not deeply tested yet
  since the Team/Tournament slice doesn't exist)

## GET /api/hostels/change-requests/mine

Requires auth. Returns the caller's own pending request, wrapped as `{ "pending": {...} | null }`
— lets the dashboard show "pending: request to switch to X" instead of blindly re-showing the
form.

**Why wrapped, not a bare nullable body:** NestJS treats a controller returning `null` the same
as `undefined` and sends an empty body (`Content-Length: 0`), not the JSON literal `null` — a
client's `res.json()` throws on that, indistinguishable from a real failure. Wrapping in an
object that's always present, with only the inner value nullable, avoids it. Found by an actual
end-to-end browser run crashing on this exact response, not caught by any unit test mocking
Prisma directly — worth remembering for any other endpoint that can legitimately return "no
data yet" as its success case.

## GET /api/hostels/change-requests/pending

Requires auth; effectively Caretaker-only (403 otherwise). Scoped server-side to requests
where the caller's own hostel is the requester's **current** hostel — the one releasing them
— not the requested one (business rule 9 / D-005 / Q-004).

- 200 → array of `{ "id","status","createdAt", "user": {"id","name","email"}, "requestedHostel": {"id","code","name"} }`
- 403 → caller isn't a Caretaker anywhere

## POST /api/hostels/change-requests/:id/approve — and /reject

Requires auth. Only the request's student's **current** hostel's Caretaker may decide it,
re-checked against live data (not a value snapshotted when the request was filed).

- 200 → the updated request
- 403 → caller isn't that Caretaker
- 404 → request not found
- 409 → already decided, **or** (approve only) business rule 13 now blocks it — re-checked at
  decision time since team/tournament state may have changed since the request was filed

Approving moves the student (`hostelId`/`hostelSelectedAt`/`hostelLockedUntil`, a fresh
6-month lock) and marks the request `approved` in one transaction. Rejecting only changes the
request's status.

## GET /api/sports

Requires auth. The seeded sports catalog, for the tournament-creation form's dropdown.

- 200 → array of `{ "id": "...", "name": "Cricket", "defaultTeamSize": 11 }`, ordered by name

## POST /api/tournaments

FR-005. Requires auth; **Sports Secretary only** (403 otherwise). The tournament's hostel is
fixed to the hostel the caller is Secretary of — it is not in the request body. No approval
step (business rule 7).

Request:
```json
{ "name": "Falcon Cup", "sportId": "...", "format": "league", "registrationDeadline": "2026-11-30" }
```

- 201 → `{ "id","name","format","status","cancellationReason","registrationDeadline","createdAt", "sport": {"id","name","scorecardTemplate"}, "hostel": {"id","code","name"}, "teamCount": 0 }`
  (`cancellationReason` is D-021's - null until the tournament is `cancelled`. `sport.scorecardTemplate`
  is D-023's - which result-entry form FR-010 should render for this tournament.)
- 400 → name empty · `format` not `knockout`/`league` · `registrationDeadline` missing, malformed, or in the past
- 403 → caller isn't a Sports Secretary
- 404 → `sportId` doesn't match a seeded sport

`status` is always `registration_open` on creation — no draft step in v1 (D-014).

## GET /api/tournaments/mine

Requires auth; Sports Secretary only (403 otherwise). The tournaments of the hostel the caller
is Secretary of, newest first.

- 200 → array of the same shape as the POST response above
- 403 → caller isn't a Sports Secretary

## GET /api/tournaments/caretaker

D-025. Requires auth; **Caretaker only** (403 otherwise). Read-only — the tournaments of the
hostel the caller is Caretaker of, newest first. Same shape as `GET /api/tournaments/mine`
above; there is no Caretaker write path for tournaments (create/cancel/delete/approve all stay
Secretary-only).

- 200 → array of the same shape as the POST response above
- 403 → caller isn't a Caretaker

## GET /api/tournaments

FR-006. Requires auth. The tournaments of the caller's **own hostel** (the one they selected
via FR-003), newest first — a student only ever sees their own hostel's tournaments. Each
entry adds `myTeam` for the caller's registration state.

- 200 → array of `{ ...tournament, "teamCount": N, "myTeam": { "id","name","isCaptain","registrationStatus" } | null }`.
  Empty array if the caller hasn't selected a hostel yet. `registrationStatus` is `approved` or
  `rejected` (D-016).

## POST /api/tournaments/:tournamentId/teams

FR-006. Requires auth. Any student in the tournament's hostel creates a team and becomes its
Captain (also added as roster player #1 — D-015).

Request: `{ "name": "Agira Titans" }`

- 201 → the team roster: `{ "id","name","captainUserId","registrationStatus", "tournament": {"id","name"}, "players": [{ "id","name","email","rollNumber","isCaptain" }] }`
- 400 → name empty · the registration deadline has passed
- 403 → the caller's hostel isn't this tournament's hostel
- 404 → tournament not found
- 409 → registration isn't open · the caller is already on a team in this tournament

## GET /api/tournaments/:tournamentId/teams

FR-006 completion / D-016. Requires auth; **Sports Secretary of that tournament's hostel only**.
Every team registered for the tournament, oldest first, each with its roster and registration
status.

- 200 → array of `{ "id","name","captainUserId","registrationStatus", "players": [{ "id","name","email","rollNumber","isCaptain" }] }`
- 403 → caller isn't this tournament's Sports Secretary
- 404 → tournament not found

## DELETE /api/tournaments/:tournamentId

D-017 / D-022. Requires auth; **Sports Secretary of that tournament's hostel only**.
Hard-deletes the tournament plus its teams and roster rows, in one transaction. Blocked while
the tournament is still genuinely open and already has fixtures (`status` not yet `cancelled`/
`completed`) — use `cancel` below instead. Once it **is** `cancelled` or `completed` (D-021,
D-022), deletion is always allowed regardless of how many matches exist, and the cascade also
clears its `Match`, `VenueBooking`, `ConflictLog`, and `Scorecard` rows.

- 200 → `{ "deleted": true }`
- 403 → caller isn't this tournament's Sports Secretary
- 404 → tournament not found
- 409 → the tournament already has fixtures/matches and isn't yet `cancelled`/`completed` — use
  `POST /api/tournaments/:tournamentId/cancel` below instead

## POST /api/tournaments/:tournamentId/cancel

D-021. Requires auth; **Sports Secretary of that tournament's hostel only**. What `delete`
above points you at once fixtures exist. Sets the tournament to `cancelled` with the given
reason, cancels every one of its matches that isn't already `completed`/`cancelled` (same
reason), and frees any `pending`/`approved` venue booking tied to one of those matches —
without running the auto-reschedule-search a single match's own cancel (FR-009) does, since the
whole tournament is over, not just disrupted. Works even before any fixtures exist.

Request: `{ "reason": "Insufficient teams registered" }`

- 200 → `{ "cancelled": true }`
- 403 → caller isn't this tournament's Sports Secretary
- 404 → tournament not found
- 409 → the tournament is already `completed` or already `cancelled`

## GET /api/teams/:teamId

Requires auth (any user — read-only). Returns the same roster shape as above.

## POST /api/teams/:teamId/players

FR-006. Requires auth; **team Captain only**. Adds a player by email.

Request: `{ "email": "teammate@thapar.edu" }`

- 200 → the updated roster
- 400 → deadline passed · that student isn't a member of this hostel
- 403 → caller isn't the Captain
- 404 → team not found · no student has that email
- 409 → that student is already on a team in this tournament

## DELETE /api/teams/:teamId/players/:userId

FR-006. Requires auth; Captain only. Removes a player.

- 200 → the updated roster
- 400 → deadline passed · trying to remove the Captain (D-015 — not allowed)
- 403 → caller isn't the Captain
- 404 → team not found · that player isn't on this team

## POST /api/teams/:teamId/approve · POST /api/teams/:teamId/reject

D-016 (resolves Q-007). Requires auth; **Sports Secretary of that team's hostel only**. Flips
the team's `registrationStatus` to `approved` / `rejected`. Reversible — a rejected team keeps
its roster and can be re-approved. No request body.

- 200 → the updated team roster (same shape as `GET /api/teams/:teamId`)
- 403 → caller isn't the tournament's Sports Secretary
- 404 → team not found

## POST /api/tournaments/:tournamentId/fixtures

FR-007 / D-018. Requires auth; **Sports Secretary of that tournament's hostel only**.
Generates the full `Match` schedule from the tournament's **approved** teams (D-016), ordered
by registration. Knockout gets a standard single-elimination bracket (byes auto-resolve and
feed into Round 2); league gets a full circle-method round-robin. Flips the tournament's
`status` to `in_progress`. No request body.

- 200 → the same shape as `GET /api/tournaments/:tournamentId/fixtures` below
- 400 → fewer than 2 approved teams
- 403 → caller isn't this tournament's Sports Secretary
- 404 → tournament not found
- 409 → fixtures already exist for this tournament · registration isn't open

## GET /api/tournaments/:tournamentId/fixtures

FR-007 / D-030. Requires auth; **Sports Secretary of that tournament's hostel, OR any user
with a `TeamPlayer` row in this tournament** (any team, any registration status — a captain
whose team was rejected can still view the schedule). The generated schedule, grouped by
round.

- 200 → `{ "tournamentId","rounds": [ { "round": 1, "matches": [ { "id","round","matchNumber","status","winnerTeamId", "teamA": {"id","name"} | null, "teamB": {"id","name"} | null, "scheduledDate","scheduledTime","cancellationReason", "pendingBooking": { "venueName","date","hour" } | null } ] } ] }`
  (FR-009: `scheduledDate`/`scheduledTime` only reflect an *approved* booking — null until one
  exists. `pendingBooking` is the match's current still-`pending` request, if any — set
  regardless of whether the match itself is `cancelled`, so a still-awaiting-approval
  auto-suggested replacement is visible here too, not only in the one-time response from
  `cancel` below.)
- 403 → caller is neither this tournament's Sports Secretary nor a registered participant
- 404 → tournament not found

## POST /api/tournaments/:tournamentId/fixtures/swap

FR-007 / D-018. Requires auth; **Sports Secretary of that tournament's hostel only**. The
manual-adjustment half of fixture generation — the frontend's drag-and-drop. Swaps the teams
sitting in two match slots.

Request: `{ "matchAId": "...", "slotA": "teamA", "matchBId": "...", "slotB": "teamB" }`
(`slotA`/`slotB` are each `"teamA"` or `"teamB"`)

- 200 → the updated schedule (same shape as `GET /api/tournaments/:tournamentId/fixtures`)
- 403 → caller isn't this tournament's Sports Secretary
- 404 → tournament not found · a match isn't part of this tournament
- 409 → a swapped-into match is already a bye or already decided · the swap would put a team
  against itself

---

## FR-008 — Venue & Equipment Booking (D-019)

Both halves let a **Student or Secretary** request (not Secretary-only, per D-019); only the
**Sports Department** (`isSportsAdmin`) approves, rejects, edits inventory, or marks equipment
returned. `requestedByRole` on every booking is computed the same way role resolution always
is (FR-002/D-006) - never a value the client can set.

### GET /api/equipment

Requires auth (any authenticated user - read-only). The full item catalog.

- 200 → array of `{ "id","name","totalQuantity","availableQuantity" }`

### POST /api/equipment

Requires auth; **Sports Department only**. Adds a new item.

Request: `{ "name": "Volleyball", "totalQuantity": 10 }`

- 201 → the created item
- 400 → name empty · totalQuantity < 1
- 403 → caller isn't the Sports Department

### PATCH /api/equipment/:itemId

Requires auth; **Sports Department only**. Renames and/or corrects the count (damaged/lost/
found gear) - whatever's currently checked out stays untouched; only the un-booked portion
moves.

Request: `{ "name": "Volleyball", "totalQuantity": 8 }`

- 200 → the updated item
- 403 → caller isn't the Sports Department
- 404 → item not found
- 409 → the new total is below what's currently checked out

### DELETE /api/equipment/:itemId

Requires auth; **Sports Department only**.

- 200 → `{ "deleted": true }`
- 403 → caller isn't the Sports Department
- 404 → item not found
- 409 → a pending or checked-out booking still references this item

### POST /api/equipment/:itemId/bookings

Requires auth; caller must have a hostel selected. Creates a **pending** request - doesn't
touch `availableQuantity` until the Sports Department approves it.

Request: `{ "quantity": 2 }`

- 201 → the created booking: `{ "id","itemId","item": {"id","name"},"quantity","status","requestedBy": {"id","name"} | null,"requestedByRole","createdAt" }`
- 400 → no hostel selected · quantity < 1
- 404 → item not found
- 409 → quantity exceeds what's currently available

### GET /api/equipment/bookings/mine

Requires auth. The caller's own equipment bookings, newest first.

- 200 → array of the booking shape above

### GET /api/equipment/bookings

Requires auth; **Sports Department only**. Every equipment booking, newest first.

- 200 → array of the booking shape above
- 403 → caller isn't the Sports Department

### POST /api/equipment-bookings/:bookingId/approve

Requires auth; **Sports Department only**. Decrements `availableQuantity` by the requested
quantity and flips the booking to `checked_out`.

- 200 → `{ "approved": true }`
- 403 → caller isn't the Sports Department
- 404 → booking not found
- 409 → not enough currently available to approve this quantity

### POST /api/equipment-bookings/:bookingId/reject

Requires auth; **Sports Department only**. No stock change.

- 200 → `{ "rejected": true }`
- 403 → caller isn't the Sports Department
- 404 → booking not found

### POST /api/equipment-bookings/:bookingId/return

Requires auth; **Sports Department only**. Increments `availableQuantity` back by the
booking's quantity and flips it to `returned`.

- 200 → `{ "returned": true }`
- 403 → caller isn't the Sports Department
- 404 → booking not found

### GET /api/venues

Requires auth (any authenticated user - read-only). The fixed ground catalog (currently
Cricket Ground, Football Ground, Basketball Court - the table itself allows more later).

- 200 → array of `{ "id","name" }`

### POST /api/venues/:venueId/bookings

Requires auth; caller must have a hostel selected. Creates a **pending** request for one
1-hour slot. Multiple people can hold a pending request on the same slot at once - see the
approve endpoint below for what happens next.

Request: `{ "date": "2026-11-30", "hour": "09:00-10:00" }` (`hour` is one of the 14 fixed
1-hour slots, `06:00-07:00` through `19:00-20:00`)

- 201 → the created booking: `{ "id","venueId","venue": {"id","name"},"date","hour","status","requestedBy": {"id","name"} | null,"requestedByRole","createdAt" }`
- 400 → no hostel selected · invalid date/hour
- 404 → venue not found
- 409 → the slot is already booked (approved) · the caller already has a pending request for
  this exact slot

### GET /api/venues/bookings/mine

Requires auth. The caller's own venue bookings, newest first.

- 200 → array of the booking shape above

### GET /api/venues/bookings

Requires auth (any authenticated user, **not** Sports-Department-only, unlike Equipment's
equivalent - the Student/Secretary slot card needs to know which slots are Booked
college-wide, not just the caller's own). Every venue booking, newest first.

- 200 → array of the booking shape above

### POST /api/venue-bookings/:bookingId/approve

Requires auth; **Sports Department only**. Approves this request and, in the same
transaction, auto-rejects every other still-pending request for the exact same slot - no
separate "slot taken, please reject" step. Backed by a partial unique index
(`venue_booking_no_double_book`) as the real guarantee against a race between two concurrent
approvals (business rule 3).

- 200 → `{ "approved": true }`
- 403 → caller isn't the Sports Department
- 404 → booking not found
- 409 → that slot was already approved for someone else

### POST /api/venue-bookings/:bookingId/reject

Requires auth; **Sports Department only**.

- 200 → `{ "rejected": true }`
- 403 → caller isn't the Sports Department
- 404 → booking not found

---

## FR-009 — Scheduling & Conflict Engine (D-020)

Assigns a venue+date+time to a fixture `Match` (FR-007 only builds who-plays-who; nothing is
"scheduled" until this), cancels a scheduled match with an automatic reschedule search, and
scans a tournament's schedule for clashes on demand. Both match-scheduling endpoints are
**Sports Secretary of that match's tournament's hostel only** (same check `fixtures`/`swap`
use). A match's slot reuses `VenueBooking` exactly like an ad-hoc FR-008 request — same
Sports-Department approve/reject endpoints above actually move it from `pending` to
`approved`/`rejected`; approving a match-linked booking is also what sets
`Match.scheduledDate`/`scheduledTime` **and** sets `Match.status` back to `scheduled` (clearing
`cancellationReason`) — so approving a cancelled match's replacement booking is what actually
revives it, whether that replacement was the auto-suggested one or a slot the Secretary picked
themselves via `schedule` below.

### POST /api/matches/:matchId/schedule

FR-009. Requires auth; **Sports Secretary of the match's tournament**. Upserts a **pending**
`VenueBooking` for this match (`VenueBooking.matchId` is unique — one row per match, ever).
Calling this again for the same match — after a rejection, to pick a different slot, or to
directly reschedule a `cancelled` match instead of waiting on its auto-suggested replacement —
moves that same row to the new venue/date/time and resets it to `pending`; it is never a fresh
insert. A `cancelled` match can be scheduled just like any other (see above) — only a
`completed` one can't.

Request: `{ "venueId": "...", "date": "2026-11-30", "hour": "09:00-10:00" }`

- 200 → `{ "id","venueId","venue": {"id","name"},"date","hour","status" }`
- 403 → caller isn't this tournament's Sports Secretary
- 404 → match not found · venue not found
- 409 → the match is already `completed` · that slot is already approved for a different match

### POST /api/matches/:matchId/cancel

FR-009. Requires auth; **Sports Secretary of the match's tournament**. Sets the match to
`cancelled` with the given reason and logs an `unresolved` conflict entry. If the match had an
**approved** venue booking, frees that slot immediately, then searches the same venue for the
next open 1-hour slot in the following 30 days (one bulk query over approved bookings there,
not a query per candidate) and, if found, submits it as a new **pending** request through the
same upsert — never auto-approved; the Sports Department still approves it like any other
request. The conflict log entry is marked `auto_suggested` when an alternative is found.
D-022: also checks whether every match in the tournament is now `completed`/`cancelled` with at
least one actually `completed` — if so, the tournament itself flips to `completed`.

Request: `{ "reason": "Ground waterlogged after rain" }`

- 200 → `{ "cancelled": true, "rescheduled": null | { "id","venueId","venue","date","hour","status" }, "message": "..." }`
  (`message` says whether a replacement slot was found, and names it if so)
- 403 → caller isn't this tournament's Sports Secretary
- 404 → match not found
- 409 → the match is already `completed` or already `cancelled`

### POST /api/tournaments/:tournamentId/conflicts/check

FR-009 / D-020. Requires auth; **Sports Secretary of that tournament**. Re-scans every
non-cancelled, fully-scheduled match in the tournament (both teams assigned, venue+date+time
set) for two kinds of clash at the same date+time: the same **team** in two matches (the
genuinely new check — nothing else in the system prevents this), and two matches at the same
**venue** (defensive/for completeness — the D-019 partial unique index already makes this
structurally near-impossible once bookings are approved one at a time). Player clashes across
*different* tournaments and rest-time constraints are out of v1 scope (D-020). Replaces
whatever `unresolved` conflict-log rows the tournament had from the previous check — running
it again doesn't pile up stale duplicates.

- 200 → `{ "conflicts": [ { "type": "team" | "venue", "message": "...", "matches": [ { "id","round","matchNumber","date","hour" } ] } ] }`
  (empty array = schedule is clean)
- 403 → caller isn't this tournament's Sports Secretary
- 404 → tournament not found

### GET /api/tournaments/:tournamentId/conflicts

FR-009. Requires auth; **Sports Secretary of that tournament**. Reads back the stored conflict
log (whatever the last `check` call left), newest first — no re-scan.

- 200 → array of `{ "id","type","matchId","resolution": "unresolved" | "auto_suggested","detectedAt","resolvedAt" }`
- 403 → caller isn't this tournament's Sports Secretary
- 404 → tournament not found

---

## FR-010 — Match Results & Scorecards (D-023)

Entering and reading back a match's post-match result. Gated exactly like Fixtures already are
— **Sports Secretary of that match's tournament only** (there's no student-facing fixtures or
scorecard view yet — an existing gap, not something this slice changes). Which fields `data`
needs depends on the tournament's sport (`Sport.scorecardTemplate` — `cricket` | `football` |
`basketball`; see `GET /api/tournaments/mine`'s `sport.scorecardTemplate`), and only `football`
permits a draw (`winnerTeamId: null`).

| Template | `data` fields | Draw allowed |
|---|---|---|
| `cricket` | `teamARuns`,`teamAWickets`,`teamAOvers`,`teamBRuns`,`teamBWickets`,`teamBOvers` | no |
| `football` | `teamAGoals`,`teamBGoals` | yes |
| `basketball` | `teamAPoints`,`teamBPoints` | no |

### POST /api/matches/:matchId/scorecard

FR-010 / D-023. Requires auth; **Sports Secretary of the match's tournament**. Creates the
match's one-and-only `Scorecard` (`matchId` is unique — this is a one-time submission, no edit
path in v1) and, in the same transaction, sets `Match.status` to `completed` and
`Match.winnerTeamId` to exactly what's sent — the winner is **never derived from the score
fields**, the Secretary states it directly. For a knockout tournament, also propagates a
non-null `winnerTeamId` into the Round+1 match (D-024) — the same progression a bye already
gets at fixture-generation time; a no-op for league or a draw. Also runs D-022's
`maybeCompleteTournament` check afterward, same as cancelling a match does.

Request: `{ "winnerTeamId": "<teamId>" | null, "data": { "teamAGoals": 2, "teamBGoals": 1 } }`

- 200 → `{ "id","matchId","data","winnerTeamId","enteredBy": {"id","name"},"enteredAt","sport": {"id","name"} }`
- 400 → `winnerTeamId` isn't one of the match's two teams (and isn't `null`) · `winnerTeamId` is
  `null` on a sport that doesn't allow a draw · a required `data` field is missing or not a
  non-negative number · no scorecard template is configured for this sport
- 403 → caller isn't this tournament's Sports Secretary
- 404 → match not found
- 409 → either team slot is still empty (TBD) · the match already has a result · the match is
  `cancelled`

### GET /api/matches/:matchId/scorecard

FR-010. Requires auth; **Sports Secretary of the match's tournament**. Reads back the result,
if one has been entered.

- 200 → same shape as the `POST` response above
- 403 → caller isn't this tournament's Sports Secretary
- 404 → match not found · no result has been recorded for this match yet

---

## FR-011 — Standings (D-027)

### GET /api/tournaments/:tournamentId/standings

Requires auth — **any authenticated user**, unlike almost every other tournament endpoint;
there's no Secretary/hostel ownership check here (D-027). Computes a **league** tournament's
points table fresh from its `completed` matches on every request — nothing is stored. Win = 3
points, draw = 1, loss = 0. Every approved team gets a row, even at 0 matches played. Equal
points are co-ranked (D-005) — two teams tied at `rank: 1` means the next team is `rank: 3`, not
`2`. Refused for a knockout tournament (no points table there, only bracket progression).

- 200 → `{ "tournamentId", "standings": [ { "rank","teamId","name","played","won","drawn","lost","points" } ] }`
  (sorted by points descending)
- 400 → the tournament's format isn't `league`
- 404 → tournament not found

---

## FR-012 — Announcements & Notifications (D-028)

In-app only, fetched on demand — no push/websockets in v1. Recipients are snapshotted at post
time as `Notification` rows, not recomputed later — someone who joins a hostel after an
announcement was posted never sees it; someone there at the time does, even if they later
leave.

### POST /api/announcements

Requires auth; **Sports Secretary only**, for their own hostel (optionally narrowed to one of
their own tournaments). Creates the `Announcement` and fans a `Notification` out to every
recipient, in one transaction.

Request: `{ "title": "Ground booking moved", "body": "...", "tournamentId": "..." }`
(`tournamentId` optional — omit for hostel-wide; include to narrow to just that tournament's
**approved**, registered teams, D-016)

- 200 → `{ "id","hostelId","tournamentId","title","body","createdById","createdAt","recipientCount" }`
- 403 → caller isn't a Sports Secretary · the given tournament isn't the caller's own
- 404 → the given `tournamentId` doesn't exist

### GET /api/announcements/mine

Requires auth; **Sports Secretary only**. Every announcement posted for the caller's own
hostel (hostel-wide or tournament-scoped), newest first.

- 200 → array of `{ "id","hostelId","tournamentId","title","body","createdById","createdAt" }`
- 403 → caller isn't a Sports Secretary

### DELETE /api/announcements/:announcementId

D-029. Requires auth; **Sports Secretary of that announcement's hostel only**. A full
retraction — deletes every `Notification` row it fanned out, then the `Announcement` itself, in
one transaction. Recipients lose the notification entirely, not just its link back to the
(now-deleted) announcement.

- 200 → `{ "deleted": true }`
- 403 → caller isn't a Sports Secretary · this isn't your hostel's announcement
- 404 → announcement not found

### GET /api/notifications

Requires auth — any authenticated user; always scoped to the caller's own notifications.

- 200 → `{ "notifications": [ { "id","message","readAt","createdAt", "announcement": {"id","title","body","hostelId","tournamentId"} | null } ], "unreadCount" }`

### POST /api/notifications/:notificationId/read

Requires auth; caller must own the notification. Idempotent — marking an already-read
notification read again is a no-op, not an error.

- 200 → `{ "read": true }`
- 403 → this notification belongs to someone else
- 404 → notification not found

### POST /api/notifications/send-match-reminders

D-030. Requires auth — any authenticated user. Notifies every player on both teams (not just
captains) of every `scheduled` match whose `scheduledDate` is exactly tomorrow. Runs
automatically every hour (`MatchReminderService`'s own cron — not once daily, so a match
approved for tomorrow at any point in the day is caught within the hour); this endpoint is the
same logic, triggered manually — an instant fallback, and the only practical way to verify the
feature without waiting for the next tick. Idempotent — a match already notified (any
`Notification` row referencing its `matchId` exists) is skipped.

- 200 → `{ "matchesNotified", "notificationsSent" }`
