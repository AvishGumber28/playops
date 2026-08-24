# Functional Requirements

Each requirement follows: who uses it, what they can do, data involved, what happens after,
errors, edge cases, permissions, business rules, and what gets stored. Scope is Must Have
unless marked otherwise — see `requirements.md` for the full MoSCoW breakdown.

---

## FR-001 — Signup & Login

**Who:** Any prospective user. There's no separate signup flow for Caretakers/Secretaries/
Sports Admin — everyone signs up the same way, and elevated capabilities come later from
relationships (see FR-002), not from a special account type at signup.

**What they can do:** Create an account with name, college email, and password. Log in with
email and password.

**Data required:** name, email, password.

**What happens after:** Account created as a plain user with no hostel and no special
capabilities. Login returns a session token.

**Errors:** Email doesn't match the college's domain (rejected — this is the entire
eligibility gate at signup) · email already registered · wrong password on login.

**Edge cases:** No password-reset flow in v1 — flagged as Should Have, not designed yet.

**Permissions:** Public — no auth required to sign up or log in.

**Business rules:** Only the college email domain gates who can register. Nothing else is
checked at signup time.

**Data stored:** User (id, email, password hash, name, timestamps).

---

## FR-002 — Role Resolution

**Who:** Any logged-in user.

**What happens:** The system determines what a user can do by checking relationships —
is their id a hostel's `caretakerUserId`? Its `sportsSecretaryUserId`? Do they have
`isSportsAdmin`? — rather than reading a stored "role" field. The frontend renders the
matching dashboard from this result.

**Errors:** Invalid or expired token → rejected.

**Edge cases:** A user can match more than one capability at once (e.g. Secretary of their
hostel *and* Captain of a team). v1 shows one primary dashboard; a role switcher is Future
Scope, not designed now.

**Permissions:** Any authenticated user, viewing only their own resolved context.

**Business rules:** Role is always computed at request time, never cached or stored as a
static value — so a Caretaker revoking someone's Secretary appointment takes effect
immediately, with nothing to "sync."

**Data stored:** Nothing new — derived entirely from existing Hostel/Team relationships.

---

## FR-003 — Hostel Self-Declaration & Change

**Who:** Any student without a hostel yet (selection), or wanting to change hostels later
(change request).

**What they can do:** Select a hostel on first login. Request a change afterward.

**What happens after:** Selection locks the hostel for a semester/year from the selection
date. A change request goes to a Caretaker for approval.

**Errors:** Attempting to change before the lock period without going through the request
flow is blocked.

**Edge cases:** A student who never selects a hostel can't register for or join a team (the
eligibility check in FR-006 has nothing to check against).

**Permissions:** Self-service for the initial selection. Change requests require Caretaker
approval.

> **Open question (see `open-questions.md` Q-004):** which Caretaker approves a change
> request — the student's *current* hostel, the *requested* hostel, or both? Not decided in
> the original discussion; needs an explicit answer before this is implemented.

**Business rules:** One hostel per student at any given time, enforced by requiring approval
for any change rather than allowing free self-service switching.

**Data stored:** User.hostelId, hostelSelectedAt, hostelLockedUntil · HostelChangeRequest.

---

## FR-004 — Caretaker Appoints Sports Secretary

**Who:** Caretaker, for their own hostel only.

**What they can do:** Select a student belonging to that hostel to become its Sports
Secretary.

**What happens after:** That user gains Secretary capabilities for that hostel (resolved via
FR-002, not a separate flag).

**Errors:** Selecting a student not belonging to that hostel is blocked.

**Edge cases:** Appointing a new Secretary replaces the previous one — there is no
appointment history kept in v1 (see `ARCHITECTURE.md` open questions for the optional
enhancement).

**Permissions:** Caretaker only, scoped to their own hostel.

**Business rules:** Exactly one active Secretary per hostel at a time. The appointment
itself is the vetting step — no further approval is required for anything the Secretary
subsequently does (see FR-005).

**Data stored:** Hostel.sportsSecretaryUserId.

---

## FR-005 — Tournament Creation

**Who:** Sports Secretary, for their own hostel only.

**What they can do:** Create an intra-hostel tournament: name, sport, format
(knockout/league), registration deadline.

**What happens after:** Tournament enters `draft`/`registration_open` status; teams can
begin registering.

**Errors:** Deadline in the past · sport not in the supported list.

**Edge cases:** Multiple simultaneous tournaments for the same sport in the same hostel are
allowed — nothing about the requirements rules this out.

**Permissions:** Secretary only, and only for their own hostel.

**Business rules:** No separate Caretaker/Sports Department approval — appointment as
Secretary already is the approval (see FR-004). Hostel is fixed to the Secretary's own
hostel; intra-hostel only in v1.

**Data stored:** Tournament.

---

## FR-006 — Team & Player Registration

**Who:** Any student can create a team (becoming its Captain); players join a team.

**What they can do:** Create a team under a tournament, add/remove players before the
registration deadline.

**Data required:** Team name, player list.

**What happens after:** Team is registered for the tournament.

**Errors:** Adding a player whose hostel doesn't match the team's hostel — rejected · adding
a player already on another team in the same tournament — rejected · adding a player after
the registration deadline — rejected.

**Edge cases:** A team with only the captain and no other players — allowed at the data
level; whether that's a *valid* team to compete is a business decision, not an eligibility
one, and isn't restricted here.

**Permissions:** Only the team's Captain can add/remove players on that team.

**Business rules:** `player.hostelId == team.hostelId`, checked at insert, not after the
fact. One team per player per tournament.

**Data stored:** Team, TeamPlayer.

---

## FR-007 — Fixture Generation

**Who:** Sports Secretary.

**What they can do:** Generate fixtures automatically once registration closes (default), or
arrange manually via drag-and-drop **(Should Have)** when seeding matters — e.g. keeping two
strong teams apart in round one, or handling an odd team count with a bye.

**What happens after:** Match records are created with round/match number and teams assigned
(later knockout rounds start with teams unresolved until earlier rounds complete).

**Errors:** Too few teams to form a valid bracket/league.

**Edge cases:** A manual arrangement that creates a clash (double-booked team, missing bye)
is expected to be caught by FR-009 before the schedule is published, not prevented at the
fixture-building step itself.

**Permissions:** Secretary only.

**Business rules:** Bracket vs. league generation logic is determined entirely by the
tournament's chosen format (FR-005).

**Data stored:** Match.

---

## FR-008 — Venue & Equipment Booking

**Who:** Sports Secretary (requests) · Sports Department (approves, rejects, or books a slot
directly for an offline arrangement).

**What they can do:** Request a venue or equipment for an exact date and time slot.
Sports Department approves/rejects, or manually marks a slot booked without a prior request.

**What happens after:** Approved → booking locked in. Rejected → Secretary picks another slot
(aided by FR-009's suggestions).

**Errors:** Requesting a slot already shown as unavailable · an admin attempting to approve a
second request for an already-approved slot — blocked by a database constraint, not just a
UI check.

**Edge cases:** Two pending requests exist for the same slot before either is decided — both
stay visible to the admin; whichever is approved first locks the slot; the other is resolved
by the admin (reject, or route into FR-009's alternative-slot suggestions).

**Permissions:** Secretary requests; Sports Department approves/rejects/manually books.

**Business rules:** One booking table is the single source of truth regardless of whether a
booking came from a formal request or a manual admin entry. Venue bookings are binary
(slot taken or free); equipment bookings are quantity-based (checked against
`SUM(quantity_requested)` for overlapping approved bookings, not a simple yes/no).

**Data stored:** VenueBooking, EquipmentBooking.

---

## FR-009 — Conflict Detection & Rescheduling

**Who:** Runs automatically; surfaced to the Sports Secretary.

**What it does:** Validates a proposed schedule for team/venue/player clashes before it's
published. On disruption — Secretary marks a match cancelled with a reason (e.g. "Rain") —
searches for available alternative slots and submits the top option as a new booking
request.

**What happens after:** Conflicts are shown before a schedule can be published. On
disruption, a suggested alternative is submitted through the normal Sports Department
approval flow (FR-008) — never auto-booked.

**Errors:** No valid alternative slot exists before the tournament's deadline — surfaced to
the Secretary rather than silently failing.

**Edge cases:** The "losing" request in a booking race (FR-008's double-pending-request case)
is routed into this same alternative-slot flow rather than dead-ending as a rejection.

**Permissions:** Triggered by the Secretary (disruption) or automatically at schedule-save
time (validation).

**Business rules:** This is the core technical contribution of the project — venue
double-booking is prevented structurally (database constraint), not just by this engine, but
this engine is what makes disruptions recoverable rather than a dead end.

**Data stored:** ConflictLog.

---

## FR-010 — Match Results & Scorecards

**Who:** Sports Secretary only.

**What they can do:** Enter the final result as a structured, sport-specific scorecard
(post-match, not live/ball-by-ball — that was evaluated and explicitly descoped, see
`decision-log.md` if carried forward from the architecture doc).

**Data required:** Sport-specific fields (e.g. cricket: runs/wickets/overs).

**What happens after:** Match marked completed; winner recorded; standings update for league
tournaments (FR-011).

**Errors:** Entering a result for a match that hasn't been played, or that already has one.

**Edge cases:** Draws are possible in some sports (e.g. football) and not really in others
(cricket, basketball) — the data model allows a null winner, but which sports actually permit
a draw is a scorecard-template detail, not decided here.

**Permissions:** Secretary only — confirmed as sole authority; no dispute path exists because
none has ever been needed historically.

**Business rules:** One scorecard per match. A submitted result is treated as final.

**Data stored:** Scorecard, Match.status/winnerTeamId.

---

## FR-011 — Standings

**Who:** Computed automatically; viewed by all authenticated users.

**What it does:** For league-format tournaments, computes a points table from completed
matches on request. Knockout tournaments have no standings table — only bracket progression.

**Errors:** None — this is a read/compute operation, not a write.

**Edge cases:** Tie-breaking (equal points) is not yet defined — flagged in
`open-questions.md` Q-005.

**Permissions:** Read-only, any authenticated user.

**Business rules:** Never stored — always computed fresh from Match results, to avoid a
standings table drifting out of sync with the results it's supposed to summarize.

**Data stored:** Nothing new.

---

## FR-012 — Announcements & Notifications

**Who:** Sports Secretary posts announcements scoped to their own hostel/tournament; all
relevant users receive resulting notifications.

**What happens after:** Notification appears in-app for relevant users only — hostel- or
tournament-scoped, not a single broadcast channel (the problem with the current one-WhatsApp-
group-per-hostel setup this is meant to replace).

**Errors:** None specific to this feature.

**Edge cases:** A user with no hostel yet receives only college-wide notifications, if any
exist.

**Permissions:** Secretary posts for their own hostel/tournament only.

**Business rules:** Delivery is always scoped — nobody sees a notification for a tournament
or hostel they have no connection to.

**Data stored:** Announcement, Notification.
