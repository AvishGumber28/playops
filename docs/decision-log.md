# Decision Log

Every entry: what was decided, why, what else was considered, and current status.
Nothing architecturally significant happens without an entry here first.

---

### D-001 — Adopt a strict phase-by-phase development process

**Date:** 2026-08-24
**Decision:** Development follows the 20-phase process in `PROCESS.md`, with a stop-and-review
gate at the end of each phase, instead of building incrementally without formal checkpoints.
**Reasoning:** For a semester-long project, reviewing requirements, roles, workflows, data
model, and architecture *before* writing code prevents rework that would otherwise surface
mid-implementation.
**Status:** Adopted.

---

### D-002 — Phase 0 starts from a clean slate

**Decision:** An earlier prototype (Postgres schema, signup/login/role-resolution backend,
React login/dashboard shell) built before this process existed is set aside as reference
material only, not carried into the repository.
**Reasoning:** That prototype was never reviewed against Requirements (Phase 1), Roles (Phase
2), Workflows (Phase 3), or Data Model (Phase 4) as this process now requires. Carrying it
forward as-is would silently skip those phases, even though the code itself worked.
**Alternatives considered:**
- Reuse the docs (architecture/work-distribution) as a starting draft for Phases 1–5 — rejected
  for now, in favor of deriving them fresh and comparing afterward.
- Reuse everything, including code — rejected as the clearest violation of "don't skip phases."
**Status:** Adopted. The old scaffold still exists outside this repository and may be revisited
once the corresponding phase is reached, purely as a reference point, not as pre-approved work.

---

### D-003 — Technology stack is explicitly undecided

**Decision:** No frontend/backend/database/hosting technology is chosen at Phase 0.
**Reasoning:** Phase 6 exists specifically to make this decision, informed by the requirements,
data model, and architecture produced in Phases 1–5 — deciding earlier would put the stack
ahead of the problem it needs to solve.
**Status:** Deferred to Phase 6 (see `technologies-under-consideration.md` for the option
space, not a decision).

---

### D-004 — Phase 1 MoSCoW classification and evaluation of the five candidate features

**Decision:** Ten features classified as Must Have for v1 (see `requirements.md`), two as
Should Have, one as Could Have, and the rest — including two of the five originally-candidate
"innovative" features (Venue Utilization Intelligence, Hostel Sports Performance Index) — as
Future Scope.
**Reasoning:** Both deferred candidate features share the same limitation: they need
accumulated historical data to produce anything meaningful, and the project starts with none.
The other three candidate features (Conflict Detector, Smart Rescheduling, Eligibility) work
from day one and were folded into Must Have — the first two merged into a single engine
rather than built as separate features, since they're detection and resolution halves of the
same problem.
**Status:** Adopted, pending review per Phase 1's own stop-and-review gate.

---

### D-005 — Resolved Q-004, Q-005, Q-006

**Decisions:**
- **Q-004:** A hostel change request is approved by the student's *current* hostel's
  Caretaker — the one releasing them — not the requested hostel's.
- **Q-005:** No tie-break rule in v1. Teams with equal points in a league are shown
  co-ranked. Head-to-head is the natural first upgrade if this becomes a real problem, since
  it needs nothing beyond match results already stored — unlike a sport-specific stat (e.g.
  goal difference), which would need more granular scoring data than some scorecard
  templates currently capture.
- **Q-006:** No appointment history is kept when a Caretaker replaces a Sports Secretary —
  matches the existing single-field schema design and the project's own "don't
  over-engineer" principle.

**Reasoning:** Q-004 and Q-006 were explicit team decisions. Q-005 had no strong preference
either way — resolved here with stated reasoning rather than left open indefinitely, per the
process's own rule against silently deferring decisions.

**Status:** Adopted.

---

### D-006 — Authorization model is scoped capabilities, not a role hierarchy

**Decision:** No role "inherits" another's powers. Every sensitive action checks the specific
relationship that authorizes it (e.g. "is this user *this* team's captain?"), never a general
"role rank" comparison.
**Reasoning:** A hierarchy model risks silently granting powers nobody explicitly decided on
— e.g. a Caretaker gaining tournament-edit rights just by being "above" a Secretary in some
rank ordering. Scoped checks make every permission traceable to an explicit rule in
`roles-permissions.md`.
**Status:** Adopted.

---

### D-007 — Resolved Q-008, Q-009, Q-010

**Decisions:**
- **Q-008:** A player cannot remove themselves from a team — only the Captain can. Keeps
  roster changes under one accountable person.
- **Q-009:** A team withdrawing after fixtures/matches exist forfeits its remaining matches;
  the opposing team is awarded the win in each. The bracket is not regenerated.
**Status:** Adopted.

---

### D-008 — Phase 8: token storage, and pulling /api/me forward from Phase 9

**Decisions:**
- **Token storage:** the JWT is kept in browser `localStorage`, not an httpOnly cookie.
  Known trade-off: a successful XSS attack could read it. The cookie-based alternative is
  more secure but needs backend changes and cross-origin cookie configuration this project
  doesn't need yet — `localStorage` is standard for a project at this stage, with the
  trade-off stated rather than hidden.
- **`GET /api/me` moved from Phase 9 into Phase 8.** It was originally planned alongside the
  Hostel module, but role resolution (FR-002) was already grouped with signup/login (FR-001)
  in the same Auth & Identity module back in Phase 5 — it's the second half of
  Authentication, not Hostel feature work. Login routing someone to the correct dashboard
  can't work without it, so building it now (rather than shipping a fake/hardcoded version)
  keeps everything demonstrated honestly working end-to-end.
- **Frontend fonts:** system font stack instead of next/font/google (Geist). Not just a
  sandbox workaround — avoiding a build-time dependency on an external font CDN is a
  reasonable reliability choice on its own.

**Status:** Adopted.

---

### D-009 — Prisma 7's driver adapter requirement and generated-client location

**Decision:** `PrismaService` now constructs an explicit `@prisma/adapter-pg` driver adapter
and passes it to `PrismaClient`, instead of relying on Prisma to connect internally from
`DATABASE_URL`. The generated client also now outputs to `src/generated/prisma/client`
(gitignored, excluded from linting) instead of the default `node_modules/@prisma/client`.

**Reasoning:** Prisma 7 removed its internal connection engine entirely — `new PrismaClient()`
with no adapter now fails at startup with `PrismaClientInitializationError`. This is on top
of the datasource-URL relocation from D-008/earlier — Prisma 7 turned out to have more
breaking changes than the one already discovered, confirmed by real-world reports of teams
hitting this exact error migrating NestJS apps. The generated-client output location was
changed proactively (not from an error we hit) after finding credible reports that leaving
it in `node_modules` can cause real compilation problems specifically for NestJS — better to
fix it now than as a third surprise later.

**Status:** Adopted. `docs/technology-decisions.md`'s Prisma caveat should be treated as
understating the actual number of breaking changes — Phase 9 should budget real time for
Prisma-version friction, not assume this is now fully behind us.

---

### D-010 — Reverted D-009's custom Prisma output path back to the default

**Decision:** The generated Prisma client goes back to the default location
(`node_modules/@prisma/client`), not the custom `src/generated/prisma/client` path D-009
introduced.

**Reasoning:** D-009's custom path was based on a blog post's general advice, applied without
fully thinking through how it interacts with this project's `tsc`-based build. In practice,
`nest build` only compiles `.ts` files into `dist/` — it doesn't copy Prisma's generated
(plain `.js`) client alongside them. That broke the relative import at runtime: code compiled
into `dist/src/prisma/prisma.service.js` looked for the client relative to *its own* location
in `dist/`, but the client only ever existed in `src/`. The default `node_modules` location
doesn't have this problem, because Node resolves package-style imports (`@prisma/client`) by
searching upward through parent folders — a mechanism that works identically whether the
requiring file lives in `src/` or `dist/src/`, unlike a relative path.

**Status:** Adopted. This is exactly the kind of thing the "test before committing" discipline
this project has followed is for — the mistake was caught before it was pushed, not after.

---

### D-011 — Three more hostel administrative roles added: Proctor, Gym Secretary, Mess Secretary

**Decision:** `Hostel` gains three more optional, unique appointee columns —
`proctorUserId`, `gymSecretaryUserId`, `messSecretaryUserId` — alongside the existing
`caretakerUserId`/`sportsSecretaryUserId`, appointed the same way (Caretaker of that hostel,
by the appointee's college email, target must already belong to the hostel, no history kept
on replacement — same rules as FR-004's Secretary appointment). Explicitly **not** part of
role resolution (FR-002) or `/api/me` — holding one of these three titles does not change a
user's dashboard. They stay a plain Student, because PlayOps's actual scope is sports
management; these three are administrative record-keeping only; Sports Secretary remains the
only one of the four that is a real system capability.

**Reasoning:** Explicit product decision for the Caretaker's dashboard (v1): all four
appointment types are shown and are genuinely functional (not placeholders), so the Caretaker
has one real place to record who holds each hostel position — but only Sports Secretary
carries any authorization weight in this system, keeping D-006's scoped-capability model
intact rather than inventing Proctor/Gym/Mess permissions nobody asked for.

**Alternatives considered:**
- Visual-only placeholders for the three non-sports roles, no persistence — rejected; the
  user wants them functional and recorded, just without dashboard consequences.
- A generic `HostelRole` join table instead of dedicated columns — rejected as more structure
  than four fixed, known-in-advance roles need; the existing Caretaker/Secretary columns
  already set this exact per-role-column precedent, and a join table would be justified only
  if the set of roles were expected to grow or vary per hostel, which isn't the case here.

**Status:** Adopted.

---

### D-012 — User gains rollNumber and photoUrl, self-reported at signup

**Decision:** `User` gains two more optional fields — `rollNumber` (text) and `photoUrl`
(text, a link to an image - no file-upload storage exists in this project, so this is a URL
a student pastes in, not an uploaded file). Both nullable, both collected at signup alongside
name/email/password, both self-reported by the student themselves - never invented or typed
in by a Caretaker on someone else's behalf. Existing accounts (including every seeded
Caretaker) simply have both as `null` until whoever owns that account fills them in.

**Reasoning:** The Caretaker's Secretary-appointment card needs to show the appointee's real
photo and roll number, not fabricated placeholder data (the project's standing rule - see the
"honest empty states" note on the Caretaker dashboard, D-011's "no fabrication" precedent).
Roll number and photo are properties of the person, the same way name and email already are -
so they belong on `User`, captured the same way (self-reported at signup), not captured by
whoever happens to appoint that person to something later. A Caretaker appointing a Secretary
still only ever supplies an email (unchanged) - the Secretary's own card then reflects
whatever that account already has on file.

**Alternatives considered:**
- Let the Caretaker type in a roll number/photo URL at appointment time - rejected: that's
  the Caretaker asserting facts about someone else's identity from outside, which is a worse
  source of truth than the person's own signup, and doesn't generalize (every future
  appointee would need the Caretaker to already know these details).
- Real file upload for the photo (object storage, etc.) - rejected as more infrastructure than
  a `photoUrl` text field needs for v1; nothing stops swapping this for a real upload flow
  later without a schema change (the column stays a URL either way).

**Status:** Adopted.

---

### D-013 — One-time "you've been appointed" welcome for a new Sports Secretary

**Decision:** `User` gains `secretaryWelcomeShown` (boolean, default `false`). `GET /api/me`
computes `showSecretaryWelcome = secretaryOfHostels.length > 0 && !secretaryWelcomeShown` -
true exactly once, the first time a newly-appointed Secretary's own dashboard loads. The
Secretary dashboard shows a congratulatory banner when that's true, and calls a new
`POST /api/me/acknowledge-secretary-welcome` (fire-and-forget, on mount) to flip the flag so
it never shows again for that account.

**Reasoning:** Explicit UX request - a newly appointed Secretary should be told outright, not
just silently discover a different dashboard next login.

**Known limitation, accepted deliberately:** this is a simple ever-boolean, not tied to *this
specific* appointment. If someone is later un-appointed and re-appointed (same hostel or a
different one), they won't see the congratulations a second time - D-005 already establishes
that no appointment history is kept anywhere in this system, and building real per-appointment
tracking just for a one-time welcome banner would be far more infrastructure than the feature
is worth. Re-appointment is also expected to be rare in practice.

**Alternatives considered:**
- Track full appointment timestamps to distinguish a "new" appointment from an old one -
  rejected as disproportionate to what a one-time welcome banner needs, and conflicts with
  D-005's explicit "no history kept" simplicity.
- Client-side only (localStorage flag, no backend change) - rejected: it wouldn't survive a
  cleared browser or a login from a different device, so the same account could see "you've
  been appointed" repeatedly, which is worse than the ever-boolean's one accepted limitation
  above.

**Status:** Adopted.

---

### D-014 — A new tournament opens for registration immediately, no draft step

**Decision:** `POST /api/tournaments` creates the tournament directly with
`status = "registration_open"`. There is no "draft, then open later" flow in v1 - the
Secretary fills in name/sport/format/deadline, submits, and teams can register from that
moment.

**Reasoning:** `functional-requirements.md` FR-005 says the tournament enters
"draft/registration_open" without pinning it down; `database-design.md`'s column default is
`draft`. This resolves the ambiguity for v1 in favour of the simpler path - the whole point of
creating a tournament is to let teams register, and a private draft state the Secretary has to
remember to flip open later is a state-management step nobody asked for yet. The `draft` value
stays in the schema's allowed set, so a later "save as draft" option needs no migration.

**Alternatives considered:**
- Create as `draft`, add a separate "Open registration" action - rejected for v1 as an extra
  step and an extra state transition to build and test, with no requirement driving it.

**Status:** Adopted.

---

### D-015 — The Captain is a roster member; the Captain can't be removed from their own team

**Decision:** Creating a team (FR-006) also inserts a `TeamPlayer` row for the Captain
themselves, in the same transaction - the Captain is player #1 on the roster, not a separate
concept. `DELETE /api/teams/:id/players/:userId` refuses to remove the `captainUserId` (400).

**Reasoning:**
- The `@@unique([tournamentId, userId])` constraint (business rule 2, "one team per player per
  tournament") only protects a Captain from double-registering if the Captain actually has a
  `TeamPlayer` row - otherwise a Captain of one team could still join another team as a plain
  player. Auto-adding them closes that hole with the constraint already in the schema.
- Removing the Captain would leave a team with no Captain and no defined way to get one back
  (there's no "transfer captaincy" flow in v1, and D-007 already says players can't manage
  their own membership). Blocking the removal is simpler than inventing captaincy transfer for
  a case nobody asked about. A Captain who wants out withdraws the team (business rule 12),
  which is a later slice.

**Alternatives considered:**
- Track the Captain separately from the roster - rejected; it makes the duplicate-registration
  check and the "how many players does this team have" question both need special-casing.

**Status:** Adopted.

---

### D-016 — Q-007 resolved: the Secretary can reject (and re-approve) a registered team

**Decision:** A team registers as `registrationStatus = "approved"` (unchanged - the student
gets immediate confirmation, and it matches the schema's column default). The tournament's
Sports Secretary can then flip any team to `rejected` from their team list, and back to
`approved`. A `rejected` team stays in the data (roster intact) but is excluded from fixtures
when FR-007 lands, and the student sees "not accepted for this tournament" on their dashboard.
There is **no `pending` state** - a student always knows where they stand the moment they
register.

**Reasoning:** Q-007 asked whether the Secretary can reject a registration beyond the
automatic eligibility checks (hostel match, one-team-per-tournament, deadline). Answer: yes -
a Secretary needs a way to keep out a duplicate, a joke team, or a team that's ineligible for
a reason the system can't check. Doing it as a reversible flag on an otherwise-approved team,
rather than a gate every team waits behind, keeps the common case (legitimate registration)
frictionless while still giving the Secretary full control.

**Alternatives considered:**
- Register as `pending`, Secretary must approve each team before it's "in" - rejected: adds
  friction to every registration and leaves students in limbo, to solve a problem (bad teams)
  that's the exception, not the rule. The reversible-reject model handles the exception
  without taxing the common case.

**Status:** Adopted.

---

### D-017 — The Secretary can delete a tournament (hard delete, cascading, blocked once fixtures exist)

**Decision:** `DELETE /api/tournaments/:id`, Secretary of that tournament's hostel only. It
hard-deletes the tournament plus its teams and `TeamPlayer` rows, in one transaction. It is
refused (409) if any `Match` rows exist for the tournament - once fixtures/results exist,
deleting would corrupt tournament history, and the Secretary should `cancel` it instead
(the `cancelled` status stays in the schema for exactly this).

**Reasoning:** FR-005 only specified "create"; a Secretary who mis-created a tournament (wrong
sport, typo, wrong deadline) needs a way to undo it. Before fixtures exist a tournament and
its registrations are disposable - nothing downstream depends on them - so a clean hard delete
is fine and is what "delete" means to a user. The match-count guard future-proofs it for when
FR-007 lands without needing a migration or a rewrite.

**Alternatives considered:**
- Only ever soft-delete (status → `cancelled`) - rejected as the default: it leaves clutter in
  every list for what's usually a genuine mistake the Secretary wants gone. `cancelled` still
  exists for the case that actually needs it (a real tournament called off mid-way).
- Block deletion whenever any team has registered - rejected as too restrictive; a Secretary
  fixing a fresh mistake shouldn't be stuck because one test team signed up. The UI confirms
  the team count before deleting.

**Status:** Adopted.

---

### D-018 — Fixture generation: standard bracket seeding for knockout, circle-method round-robin for league, with manual swap pulled forward from Should-Have

**Decision:** `POST /api/tournaments/:id/fixtures` (Secretary of that hostel only) generates
the full `Match` set from the tournament's **approved** teams (D-016 - rejected teams are
never scheduled), ordered by registration (`createdAt`) - there's no ranking data to seed by
strength instead.

- **Knockout:** standard single-elimination bracket seeding (`1 vs N, 2 vs N-1, ...`
  recursively), padded to the next power of two. Byes go to the top seeds by construction and
  auto-resolve immediately (`status: completed`, `winnerTeamId` set, no opponent), with the
  bye winner propagated straight into its Round 2 slot at generation time. Every later round
  is created upfront with `teamAId`/`teamBId` left null until earlier rounds are actually
  played (matches FR-007's own wording).
- **League:** classic circle-method round-robin - every team plays every other team exactly
  once, one match per team per round (a bye slot sits out a round if the team count is odd).
- **Guard:** refused (409) if `Match` rows already exist for the tournament (no silent
  regeneration - that would orphan anything already scheduled/played) - fewer than 2 approved
  teams (400).
- **Manual adjustment:** `POST /api/tournaments/:id/fixtures/swap` swaps the teams in two
  match slots (any two `{matchId, slot}` pairs in the tournament) - the frontend's drag-and-
  drop. Only allowed while both matches are still `status: scheduled` (a bye or a played match
  is locked) and refused if it would put a team against itself.

**Reasoning:** FR-007 asks for automatic generation as the default with manual arrangement as
a Should-Have "for when seeding matters." The user asked for the manual piece immediately - as
an edit layer on top of the auto-generated bracket rather than a from-scratch manual builder -
so it's built now instead of deferred: generate gives a sane starting bracket, swap lets the
Secretary fix exactly the case FR-007 calls out (keeping two strong teams apart in round one).
Standard tournament seeding (rather than naive sequential pairing) was chosen because it's the
well-known correct algorithm for bye placement and is no harder to implement.

**Alternatives considered:**
- Sequential pairing with byes just tacked onto the end - rejected; standard recursive seeding
  is the same amount of code and doesn't cluster byes unfairly.
- A from-scratch manual bracket builder (place every team by hand) instead of generate-then-
  swap - rejected for v1; auto-generate-then-adjust covers the stated need with far less UI.
- Recomputing/cascading byes across every round - unnecessary: proof by construction shows a
  bye can only ever originate in Round 1, so propagation is a single hop into Round 2.

**Status:** Adopted.

---

### D-020 — FR-009 backend: Conflict Engine scoped to one-tournament team/venue clashes; manual "Check Conflicts" trigger; reschedule-after-rejection is a manual re-schedule, not an automatic hook

**Decision:** FR-009's full spec (`docs/requirements.md`) covers team, venue, and player
clashes plus rest-time constraints, and calls for automatic validation before a schedule is
published. The actually-built v1 narrows this on three axes:

1. **Only team clashes *within one tournament's own schedule* are checked** (the same team
   scheduled into two matches at the same date+time). Player clashes *across different*
   tournaments (one student on two teams whose matches overlap) and rest-time constraints
   (the same team playing twice too close together) are out of v1 scope - both are
   Should-Have, not Must-Have, in `docs/requirements.md`.
2. **Venue double-booking is checked defensively, not as the primary feature.** The partial
   unique index from D-019 (`venue_booking_no_double_book`, approved bookings only) already
   makes two matches sharing an approved slot structurally impossible - the scan's venue check
   exists for completeness/defense-in-depth, not because it's expected to ever actually fire.
   The team-clash check is the only genuinely new protection this slice adds, since nothing
   else in the system stops the same team being double-booked across two different venues.
3. **Conflict checking is a manual "Check Conflicts" button** (`POST
   /api/tournaments/:id/conflicts/check`), not an automatic gate run on every booking approval
   or schedule change. Re-running it replaces whatever `unresolved` `ConflictLog` rows the
   previous run left for that tournament, so repeated checks don't pile up stale duplicates.
4. **The "Secretary loses a pending request to someone else's approval" edge case (flagged in
   FR-008's design) is handled by letting the Secretary manually re-invoke the same `POST
   /api/matches/:matchId/schedule` endpoint** for the rejected match-linked booking - not by
   building a separate automatic "retry" hook. `VenueBooking.matchId` being `@unique` makes
   this safe: scheduling a match is always an upsert keyed by `matchId`, so re-submitting a new
   venue/time for an already-rejected match-linked booking is the exact same operation as
   scheduling it the first time.

The one piece of automation that *is* built: cancelling a scheduled match (`POST
/api/matches/:matchId/cancel`) automatically searches the same venue for the next open slot in
the following 30 days (one bulk query over approved bookings + an in-memory scan of the fixed
slot grid, not a query per candidate) and submits it as a new pending request through the
normal approval flow - never auto-approved.

**Reasoning:** The full spec's player-clash-across-tournaments and rest-time checks require
either a global (not per-tournament) query shape or a second configurable constraint (minimum
rest hours) that isn't specified anywhere yet - building them now would be guessing at
requirements rather than implementing them. A manual trigger matches what the user described
wanting to test ("confirm timing and check conflict with this button if any") and avoids wiring
every booking-approval code path to re-run a tournament-wide scan. The manual-reschedule choice
for a rejected request avoids a cross-module trigger from `VenueModule` back into
`SchedulingModule`, which would create the exact circular-dependency this slice's module
boundaries (`SchedulingModule` imports `TournamentModule`, not `VenueModule`) were designed to
avoid - the Match-schedule-sync side effect already lives directly inside
`VenueService.approve()` for the same reason.

**Alternatives considered:**
- Auto-run the conflict scan on every match schedule/cancel - rejected: couples
  `MatchSchedulingService` to `ConflictService` for a check the user explicitly wants to
  trigger manually, and risks surprising the Secretary with conflict state mid-edit.
- Build the cross-tournament player-clash check now, scoped to "soon" - rejected: no
  decision exists yet on what counts as a clash across unrelated tournaments (same sport only?
  any sport? what counts as "overlapping"?) - this needs its own design pass, not a guess
  bundled into this slice.
- Auto-resubmit a rejected match-linked booking's next-best slot automatically (same as the
  cancel-match reschedule search) - rejected: a rejection is a human decision by the Sports
  Department, not a failure to route around; the Secretary should see the rejection and choose
  the next venue/time themselves, same as they would for an ad-hoc FR-008 request.

**Status:** Adopted.

---

### D-019 — FR-008 backend: Equipment deviates from the Phase-4 schema's date/time-slot shape; students can request, not just Secretary

**Decision:** The `Venue`/`Equipment`/`VenueBooking`/`EquipmentBooking` tables already existed
from Phase 4's schema (never actually used until now). Building the real backend for FR-008
against them surfaced three deliberate deviations from that original design, all matching a
frontend mock the user had already reviewed and approved before this backend existed:

1. **Equipment bookings don't carry a date/time slot.** Phase 4 modeled `EquipmentBooking` the
   same way as `VenueBooking` - `date`/`startTime`/`endTime`, with availability meant to be
   computed as `SUM(quantityRequested)` over overlapping *approved* bookings (business rule
   10). The actually-reviewed UI has no date/time picker for equipment at all - it's "request
   N units → Secretary/Student waits → Sports Department approves → someone later marks it
   returned," with no time window to overlap against. `date`/`startTime`/`endTime` are now
   nullable on `EquipmentBooking` (kept, not dropped - `Venue`'s identical shape is still
   exactly right, and re-adding them later would be more disruptive than not using them now).
2. **`Equipment.availableQuantity` is a maintained column**, decremented on approve and
   incremented on return (and recomputed whenever the total is edited), rather than computed
   from bookings - a direct consequence of #1: with no time window per booking, "SUM over
   overlapping approved bookings" has nothing to overlap on.
3. **Students can request equipment and venues, not just the Secretary.** FR-008's spec says
   "Sports Secretary requests"; the reviewed mock (built and refined across two earlier
   sessions) lets any student self-serve too. `source` keeps its existing `secretary_request`/
   `admin_manual` values and gains `student_request` - still a plain TEXT column, no type
   change needed.

Also fixed while implementing: the partial unique index business rule 3 called for
(`venue_booking_no_double_book` - "at most one approved booking per slot") was described in
`schema.prisma`'s comments since Phase 4 but had never actually been applied to the database;
it's applied now. `EquipmentBooking.requestedById`/`approvedById` had no foreign keys at all
(unlike `VenueBooking`'s equivalent columns) - added those too, for the same integrity
guarantee. The `Venue` table is seeded with exactly the three grounds in use (Cricket Ground,
Football Ground, Basketball Court), `name` now unique so the seed can upsert by name - the
table itself stays open to more venues later without a further migration.

**Reasoning:** The mock's exact behavior was already built, tested, and refined with the user
(including a dedicated "add an Edit button, handle damaged items" follow-up) before any of
this backend existed - the real slice's job is to back that reviewed UX with a real database,
not to reopen a design the user already signed off on. Where the Phase-4 schema and the
reviewed UX genuinely disagreed (equipment's time-slot shape), the reviewed UX wins; where they
already agreed (venue's date/time-slot shape, the partial-unique-index guarantee), the Phase-4
design is used as-is.

**Alternatives considered:**
- Keep `EquipmentBooking.date`/`startTime`/`endTime` required and populate them with
  placeholder values (e.g. today's date, an all-day window) to avoid a migration - rejected:
  fake data in real columns is worse than nullable columns that are honestly unused for this
  booking type.
- Rebuild the Equipment frontend to fit the original computed-availability, time-slotted model
  instead of migrating the schema - rejected: that UI was already reviewed and approved; the
  schema was never actually used until this slice, so it's the one with room to adjust.
- Restrict requesting to Secretary only, matching FR-008's literal spec text - rejected: the
  user explicitly built and approved student self-service for both Equipment and Venue booking
  before this backend slice; the spec doc is the older source here.

**Status:** Adopted.

---

### D-021 — `POST /api/tournaments/:id/cancel`: closes the dangling "cancel it instead of deleting it" promise from D-017

**Decision:** D-017 blocked deleting a tournament once any `Match` exists, with the stated
reasoning that a Secretary should "cancel" it instead - and noted `cancelled` stays in the
schema for exactly that. No such endpoint was ever built; the error message pointed at a
feature that didn't exist. `POST /api/tournaments/:id/cancel` (Secretary of that tournament's
hostel only, requires a `reason`) is that endpoint. It:

1. Sets `Tournament.status` to `cancelled` and stores the reason in a new
   `Tournament.cancellationReason` column (nullable, mirroring `Match`'s own column from
   FR-009 - a new migration, since this field never existed).
2. Cancels every `Match` in the tournament that isn't already `completed`/`cancelled`, with the
   same reason.
3. Frees every `pending` or `approved` `VenueBooking` tied to one of those matches (rejects it)
   so the grounds become available again - but, unlike a single-match cancellation (FR-009),
   does **not** run the auto-reschedule-search for any of them: the tournament is over, not
   merely disrupted, so there's nothing to find a replacement slot for.

Refused (409) if the tournament is already `completed` or `cancelled`. Works even if no
fixtures exist yet (an empty match set is a safe no-op for steps 2-3) - a Secretary might
reasonably want to formally call off a tournament during registration too, as an alternative to
`deleteTournament`'s clean wipe, if they'd rather keep the record (e.g. teams had already
registered and should see it was cancelled, not vanish).

**Reasoning:** This was a real, user-discovered dead end, not a hypothetical gap - testing
FR-009 surfaced that the exact scenario D-017 called out (fixtures exist, Secretary wants out)
had no way forward at all. Given FR-009 had already built the "cancel + free the venue booking"
mechanics for a single match, extending the same shape to a whole tournament was a small,
well-defined addition rather than a new design.

**Alternatives considered:**
- Auto-trigger each match's existing single-match `cancelMatch` (with its auto-reschedule
  search) in a loop - rejected: searching for 6+ replacement slots nobody will ever look at,
  for a tournament that's being shut down, is wasted work and wasted pending-approval clutter
  for the Sports Department.
- Store the tournament's cancellation reason only on the `ConflictLog`/`Match` rows instead of
  adding a `Tournament` column - rejected: the tournament itself is what got cancelled and why;
  burying that reason inside per-match rows (plural, possibly zero) is the wrong place to look
  it up from, and the Secretary's own tournament list is where it needs to display.

**Status:** Adopted.

---

### D-022 — A tournament auto-completes once every match is terminal (and at least one actually completed); Delete is allowed once a tournament is cancelled or completed

**Decision:** Two closely-related additions, both surfaced by the user hitting a dead end:
once a tournament reached a point where it could never move forward or be cleaned up again.

1. **Auto-completion.** A private helper (currently living in `MatchSchedulingService`, called
   after every single-match cancellation) checks: is every match in this tournament now either
   `completed` or `cancelled`, **and** is at least one of them actually `completed`? If so, the
   tournament's own status flips to `completed` (guarded so it never overwrites a tournament
   already `cancelled`/`completed`). Today, the *only* way any match ever reaches `completed` is
   a bye auto-resolving at fixture generation (FR-010 - recording a real match result - doesn't
   exist yet), so in practice this fires when a Secretary cancels the last still-open match in a
   bracket that had at least one bye. It's intentionally written generically (not "if all
   matches are byes") so it needs no changes once FR-010 lands and real matches can complete too.
2. **Delete once terminal.** `deleteTournament` (D-017) refused deletion whenever any `Match`
   existed, full stop - with no way out once a tournament had fixtures *and* was already over.
   The guard now only applies while the tournament is still genuinely open (not yet
   `cancelled`/`completed`); once it reaches either terminal state, delete is always allowed,
   and the cascade now also clears `Match`, `VenueBooking`, `ConflictLog`, and `Scorecard` rows
   for it (never needed before, since nothing previously reached "has matches" and "terminal
   status" at the same time).

**Reasoning:** The user found this by hand: cancel a tournament (D-021) and it just sits in the
list forever with no way to remove it - the exact same kind of dead end D-021 itself closed a
turn earlier. "Completed" was a third, separate dead end: the status exists and is shown in the
UI, but nothing ever sets it, so a tournament that's actually finished has no way to say so and
no way to be cleaned up either. Both fixes follow the same shape as D-021: find the terminal
state that was reachable (or nearly) and give it a real exit.

**Alternatives considered:**
- Only auto-complete via a brand new "mark tournament complete" manual button - rejected: a
  generic, automatic check is strictly more useful (fires the moment it becomes true, no action
  needed) and the same logic is exactly what FR-010 will need to call anyway once results exist.
- Keep `deleteTournament` delete-only-if-zero-matches forever, and make `cancelTournament`
  itself also delete everything - rejected: cancelling and deleting are different intents (keep
  the record vs. remove it); collapsing them removes the "I want this off my list but keep no
  trace" option the Secretary is explicitly asking for here.

**Status:** Adopted.

---

### D-023 — FR-010 backend: winner is explicitly chosen by the Secretary, not derived from the score; `maybeCompleteTournament` promoted to a public `TournamentService` method

**Decision:** `POST /api/matches/:matchId/scorecard` (Secretary of that match's tournament
only) creates the match's one-and-only `Scorecard` row and, in the same transaction, sets
`Match.status` to `completed` and `Match.winnerTeamId`. Three choices:

1. **The Secretary explicitly picks the winner** (a team, or `null` for a draw) - the numeric
   `data` fields (runs/wickets/overs, goals, points - see
   `backend/src/modules/results/scorecard-templates.ts`) are the stat record, never a formula
   the backend trusts to decide who won. This avoids inventing tie-break/derivation rules
   FR-010's spec never defined (same philosophy as D-005's standings tie-break stance).
2. **Which sports allow a draw is a template property**, decided here since FR-010's spec
   explicitly left it open: football allows one (`winnerTeamId: null`); cricket and basketball
   require a definite winner - this project has no sport where a null winner needs runtime
   configuration beyond that per-template flag.
3. **`maybeCompleteTournament` (D-022) is now a public `TournamentService` method**, not a
   private helper duplicated per caller. D-022 already flagged this as the forward-compatible
   path ("the same logic is exactly what FR-010 will need to call anyway") - `MatchSchedulingService.cancelMatch`
   and the new `ResultsService.submitScorecard` both call the one implementation now.

Both submitting and reading back a scorecard are gated exactly like Fixtures already are -
Secretary of that tournament only. There's still no student-facing fixtures (or now,
scorecard) view in this codebase - an existing gap predating this slice, not something it
changes.

**Reasoning:** Score-derived winner logic would need per-sport draw/tie rules invented from
nothing (what counts as a tie in basketball - overtime? no overtime model exists). Letting the
Secretary state the outcome directly, with the score as supporting data, matches how this kind
of result is actually recorded in practice (a human watched the match and knows who won) and
keeps the backend from needing sport-specific business logic it has no real authority to get
right.

**Alternatives considered:**
- Derive the winner from the score fields when unambiguous, falling back to an explicit pick
  only on a tie - rejected: two different winner-determination code paths (one implicit, one
  explicit) for no real benefit over always being explicit, and an automatic derivation is
  exactly the kind of "looks right for the common case, wrong in an edge case nobody specified"
  logic this project has avoided elsewhere (D-005, the conflict engine's D-020 scoping).
- Allow editing a submitted scorecard - rejected: FR-010's own spec says a submitted result is
  final, with no dispute path "since disputes have never historically occurred."

**Status:** Adopted.

---

### D-024 — FR-010: a recorded result propagates a knockout winner into the next round, the same way a bye already does

**Decision:** `FixtureService.advanceWinner(tournamentId, round, matchNumber, winnerTeamId)` is
now public, called by `ResultsService.submitScorecard` right after a result is recorded. It
writes `winnerTeamId` into the Round+1 match at `matchNumber: Math.ceil(matchNumber / 2)`, slot
`teamAId`/`teamBId` by odd/even `matchNumber` - the exact formula `buildKnockout`'s own
bye-resolution loop already uses for Round 1 byes, just not previously reachable for a real,
played match (nothing advanced a winner before this - every match that wasn't a bye just sat in
its slot forever). A no-op for league (no bracket progression exists there - every round's
pairings are fixed at generation time) and for a draw (`winnerTeamId: null` - nobody to
advance). `TournamentModule` now exports `FixtureService` alongside `TournamentService` so
`ResultsModule` can call it without duplicating the bracket math.

**Reasoning:** User-reported gap while verifying FR-010: a knockout's Round 2 showed `TBD`
forever after both Round 1 matches got real results, because nothing ever propagated the
winner - fixtures only ever "played themselves forward" via byes. This is the direct fix: the
same mechanism, triggered by the same event (a match concluding) that was already partially
wired for byes.

**Alternatives considered:**
- Only handle the draw case by leaving the slot `TBD` and relying on the Secretary's existing
  drag-swap (D-018) to place the advancing team there once decided out-of-band (e.g. a penalty
  shootout recorded by some other means) - adopted as-is, not an alternative: there is no
  replay/shootout model in this system, so a draw genuinely has no winner to auto-advance, and
  forcing one would be inventing data.
- Duplicate the round+1/ceil/odd-even formula inside `ResultsService` instead of exporting
  `FixtureService` - rejected: identical logic already exists once in `buildKnockout`'s bye
  loop; a second independent copy is exactly the kind of drift D-022's `maybeCompleteTournament`
  promotion was meant to avoid.

**Status:** Adopted.

---

### D-025 — Caretaker gets a read-only tournament list for their own hostel

**Decision:** `GET /api/tournaments/caretaker` (new) returns the same shape as the Secretary's
own `GET /api/tournaments/mine`, scoped to the hostel the caller is Caretaker of (mirrors the
`hostel.caretakerUserId === callerId` check `hostel.service.ts` already uses for change-request
approvals). Strictly read-only - approving/rejecting teams, generating fixtures, and
cancelling/deleting a tournament all stay Secretary-only; the Caretaker's page shows status,
sport/format/deadline, team count, and the cancellation reason if cancelled, nothing more.

This closes a real, pre-existing gap: `components/caretaker/caretaker-tournaments.tsx` had been
a hardcoded "FR-005 hasn't been built yet" placeholder since before FR-005 existed, never
revisited once tournaments became real - the Caretaker's own Tournaments nav link led to fake
data with zero backend wiring.

**Reasoning:** A Caretaker already has hostel-wide oversight of everything else (appointments,
committee, change requests) - having literally no visibility into their own hostel's
tournaments, while the nav link implies they should, was an oversight rather than a deliberate
scope decision. Read-only is the natural default: FR-005 through FR-010 all name the Secretary
as sole actor for every tournament mutation; nothing in the spec gives the Caretaker any of
those.

**Alternatives considered:**
- Give the Caretaker the Secretary's full team-roster/fixtures detail too - rejected (for now):
  no requirement calls for it, and `listTournamentTeams`/fixtures endpoints are Secretary-scoped
  by design (D-016 onward) - broadening that is a bigger access-model change than "can the
  Caretaker see that a tournament exists and its status."

**Status:** Adopted.

---

### D-026 — Tournament dashboards (Secretary, Student, Caretaker): list rows show only name + status; a confirmation gate before Generate Fixtures

**Decision:** Two related frontend changes, both from direct user feedback after testing:

1. **Every tournament list (Secretary, Student, Caretaker) now shows just the tournament name
   and a status pill.** Clicking a row opens a detail popup with everything that used to be
   crammed into the row itself - sport/format/deadline, the registered-teams roster (Secretary),
   registration/roster management (Student), or a read-only summary (Caretaker), plus
   Fixtures/Cancel/Delete where those apply.
2. **"Generate Fixtures" now asks for confirmation first** (`window.confirm`, matching this
   project's existing confirm-before-destructive-action pattern - delete/cancel tournament
   already worked this way). Generating closes registration and builds the match schedule
   irreversibly; reopening an already-generated schedule ("View Fixtures") still needs no
   confirmation, since that's non-destructive.

**Reasoning:** The user reported accidentally triggering fixture generation with one click and
having no way back, and found the Secretary's tournament row cluttered with five+ buttons/pills
competing for attention. Both are the same underlying fix: don't let a single accidental click
commit to something irreversible, and don't show every possible action at once when only the
name and status matter at a glance.

**Alternatives considered:**
- A dedicated "Are you sure?" modal instead of `window.confirm` for Generate Fixtures -
  rejected: this codebase already uses `window.confirm`/`window.prompt` for every other
  destructive action (delete/cancel tournament, cancel match) - a bespoke modal here alone would
  be inconsistent for no real benefit.
- Keep the roster list toggle ("View teams (N)") removed entirely now that it's inside a popup
  the Secretary explicitly opened - rejected: kept it collapsible inside the popup too, since a
  tournament's popup opening with a long roster already expanded is noisier than opening compact
  with teams one click away.

**Status:** Adopted.

---

### D-027 — FR-011 (Standings): 3/1/0 points convention, co-ranked ties, open to any authenticated user, computed fresh every request

**Decision:** `GET /api/tournaments/:tournamentId/standings` (new `StandingsService`, same
"Results & Standings" module as FR-010 per `system-architecture.md`) computes a league
tournament's points table from its `completed` matches, on every request - nothing is stored.
Four choices the FR-011 spec left open:

1. **Points: win = 3, draw = 1, loss = 0** - the standard league-table convention, not specified
   in the FR doc. Applies uniformly even though only football ever produces a draw in this
   system (D-023) - cricket/basketball tables just never show one in practice.
2. **Every approved team gets a row, even at 0 matches played** - a team that hasn't played yet
   still belongs in the table, not hidden until its first result.
3. **Equal points are co-ranked** (same `rank` value, next rank skips accordingly - e.g. two
   teams tied at rank 1 means the next team is rank 3, not 2) - this is D-005's "no tie-break in
   v1" decision, now actually implemented rather than just promised.
4. **Open to any authenticated user, no Secretary/hostel ownership check** - a deliberate
   departure from every other tournament endpoint (D-016 onward), because the FR-011 spec
   explicitly says "viewed by all authenticated users," not Secretary-only or hostel-scoped.
   `StandingsService` doesn't inject `TournamentService` at all - it has no ownership check to
   delegate to.

A knockout tournament's standings request is refused (400) - it has no points table, only
bracket progression (already visible via Fixtures).

**Reasoning:** Storing a standings table risks exactly the drift problem `database-design.md`
already calls out for FR-011 ("never stored - always computed fresh… to avoid a standings table
drifting out of sync with the results it's supposed to summarize"); computing it on every
request from the same completed-`Match`/`winnerTeamId` data FR-010 already produces is both
simpler and can't drift. The "any authenticated user" scope is taken directly from the spec
rather than defaulting to this project's usual Secretary-gated pattern, since broadening access
here is explicit, not an oversight.

**Alternatives considered:**
- Scope standings to the viewer's own hostel, matching every other tournament endpoint -
  rejected: the FR-011 spec is explicit that this is for "all authenticated users," and
  standings for another hostel's league is exactly the kind of transparency this project's
  broader goal (replacing opaque per-hostel WhatsApp groups) is meant to support.
- A configurable or sport-specific points scheme (e.g. goal difference as a tie-break) -
  rejected: no requirement calls for it, and goal difference specifically needs more granular
  scoring data than some scorecard templates capture (cricket's doesn't record a margin in a
  directly comparable unit) - D-005 already flagged this exact tension and deferred it.

**Status:** Adopted.

---

### D-028 — FR-012 (Announcements & Notifications): scoped fan-out at post time, no college-wide broadcast, in-app only

**Decision:** `POST /api/announcements` (Secretary of a hostel, optionally one of their own
tournaments) creates the `Announcement` and fans a `Notification` row out to every relevant
user in one transaction - computed once, at post time, not a live query re-evaluated later:

1. **Hostel-wide** (no `tournamentId`): every `User` whose `hostelId` currently matches the
   Secretary's hostel. **Tournament-scoped** (`tournamentId` given, must belong to the caller's
   own hostel - same ownership check `tournamentForSecretaryOrThrow` makes elsewhere, done here
   directly via Prisma rather than importing `TournamentModule` for one comparison): every
   distinct user with a `TeamPlayer` row on an **approved** (D-016) team in that tournament.
2. **No college-wide broadcast capability exists.** FR-012's own text grants the Secretary
   power over only "their own hostel/tournament" - nothing names a wider audience, so nothing
   here can target one. The edge case the spec does mention ("a user with no hostel yet
   receives only college-wide notifications, if any exist") reads as the schema leaving room
   for that later (`Announcement.hostelId`/`tournamentId` both nullable), not as a v1 feature.
3. **In-app, fetch-on-demand only** - no websockets/push, per `system-architecture.md`'s own
   prior "Notification architecture" decision. `NotificationBell` (one shared component on
   every role's navbar) polls on open, not continuously.
4. **A Caretaker does not automatically receive their own hostel's announcements** unless their
   personal `User.hostelId` happens to match it - seeded Caretaker accounts have no personal
   hostel residency at all (that's a separate concept from `Hostel.caretakerUserId`), so in
   practice they don't, today. Not treated as a gap: FR-012's business rule is delivery scoped
   to *residents*/*registrants*, not to every role with oversight of the hostel.

**Reasoning:** Snapshotting recipients at post time (rather than a dynamic "everyone currently
in this hostel" query run whenever notifications are listed) matches how a real announcement
works - it was sent to whoever was around when it was sent, and someone who joins the hostel
afterward shouldn't retroactively see something posted before they arrived. Verified live: a
student who joined the hostel *after* one announcement but *before* a second one only ever saw
the second.

**Alternatives considered:**
- Recompute hostel-wide recipients dynamically on every notification list fetch, rather than
  snapshotting at post time - rejected: this would mean a brand-new hostel resident seeing
  announcements posted before they ever joined, which doesn't match what "you were notified of
  this" should mean.
- Let the Caretaker post announcements too, since they have hostel-wide oversight elsewhere
  (D-025) - rejected: FR-012's own Permissions line names only the Secretary; broadening who can
  post is a bigger access-model change than this slice's scope, and nothing asked for it.

**Status:** Adopted.

---

### D-029 — Secretary can delete their own announcement; it's a full retraction, and Notifications now appear on every role's Home tab

**Decision:** Two additions, both direct user feedback right after FR-012 shipped:

1. **`DELETE /api/announcements/:id`** (Secretary, own hostel's announcements only) deletes the
   `Notification` rows it fanned out **and** the `Announcement` itself, in one transaction - not
   relying on the schema's own `ON DELETE SET NULL` for `Notification.announcementId`, which
   would otherwise leave every recipient with an orphaned, title-only notification pointing at
   nothing. "Posted by mistake, take it back" should mean gone from recipients' inboxes too, not
   half-visible. Verified live: 54 `Notification` rows existed for a test announcement: both
   that count and the `Announcement` row itself were zero immediately after calling delete, and
   the Secretary's own list no longer included it.
2. **`NotificationsCard`** (new, shared) now sits on the Student and Secretary Home tabs,
   showing the 5 most recent notifications inline - the same `GET /api/notifications` data the
   navbar's `NotificationBell` already used, just surfaced a second way, on the page both of
   those stub "Notifications" cards had been sitting on since before FR-012 existed. Caretaker
   and Admin Home tabs don't get one - neither of those pages ever had a notifications stub to
   begin with, and nobody asked for one there.

**Reasoning:** The bell was genuinely working (delivery, read state, badge count all correct),
but the user caught two real gaps on top of it: no way to undo a mistaken post, and a home-page
"Notifications" card that still read "FR-012 hasn't been built yet" even after FR-012 shipped -
a leftover nobody had gone back to update once the feature behind it became real.

**Alternatives considered:**
- Null out `Notification.announcementId` via the existing FK behavior instead of explicitly
  deleting the rows (i.e. do nothing beyond `announcement.delete`) - rejected: this is exactly
  the half-retraction outcome the user's "delete if sent by mistake" request is trying to avoid;
  `message` (a stored snapshot of the title) would still render in every recipient's inbox with
  no indication it was pulled.
- A soft-delete / "recall" flag instead of a hard delete, so the Secretary could see a history
  of retracted posts - rejected: no requirement calls for an audit trail here, and FR-012 itself
  treats announcements as disposable in a way results/scorecards (D-023) explicitly are not.

**Status:** Adopted.

---

### D-030 — Students get a read-only Fixtures view (All/My Tournaments split) and a day-before match reminder

**Decision:** Two additions closing the "no student-facing fixtures view" gap flagged several
times earlier in this project:

1. **`GET /api/tournaments/:id/fixtures`'s access check is broadened** from Secretary-only to
   Secretary-of-that-hostel **or** any user with a `TeamPlayer` row in that tournament (any
   team, any registration status - a captain whose team got rejected can still see how the
   bracket played out, they just won't be in it). A genuinely missing tournament still 404s
   either way; only the Forbidden path gained a fallback check. `generateFixtures` and
   `swapTeams` are untouched - still Secretary-only, since those mutate the bracket.
2. **The Student dashboard splits into "All Tournaments" (everything the Secretary has listed
   for the hostel) and "My Tournaments"** (only tournaments with `myTeam !== null`) - participation
   is the explicit filter, per the user's own framing. A **View Schedule** button on "My
   Tournaments" cards opens a new read-only `ReadOnlyFixturesModal` (no drag-swap, no Schedule/
   Cancel/Enter-result, no Check Conflicts - purely "when and where is my match").
3. **A day-before match reminder** (`MatchReminderService`, new `@nestjs/schedule` dependency -
   pinned to `6.1.3`, since the current `12.x` major ships ESM-only and breaks this project's
   CommonJS Jest config) notifies **every player on both teams**, not just captains, the day
   before their match. This is the one real use for `Notification.matchId` - scaffolded since
   Phase 4, never populated until now. Idempotent per match (a second run, or a missed day's
   catch-up, never double-notifies - checked via "does any Notification already reference this
   matchId"). Runs automatically via cron **every hour**, not once daily - a match first
   approved for "tomorrow" at any point during the day is caught within the hour regardless of
   when that approval happens; a single fixed daily time (the original design) left a real gap,
   caught live during testing: a match approved after that day's run had already passed would
   never be swept up by any later run either, since by the next day its date is no longer
   "tomorrow" relative to that run. Also separately triggerable (`POST /api/notifications/
   send-match-reminders`, any authenticated user) - partly as an instant fallback, and partly
   because a scheduled cron is otherwise awkward to verify without waiting for the next tick.

**Reasoning:** Both gaps were explicitly named by the user. The fixtures access broadening is
the minimal change that unlocks student visibility - reusing the one `listFixtures` code path
(same formatting, same data) rather than standing up a parallel student-only endpoint that
would need to be kept in sync with it. The reminder's "every player, not just the captain" and
day-before timing both came directly from the request; the manual-trigger addition is pragmatic,
not scope creep: a daily cron that cannot be demonstrated or tested within a normal session is a
feature nobody can verify works, including Future Claude.

**Alternatives considered:**
- A parallel, student-only fixtures endpoint instead of broadening the existing one - rejected:
  identical response shape and formatting logic either way; two endpoints returning the same
  data from the same table is drift waiting to happen; one endpoint with a widened access check
  is simpler and exactly as safe (write operations stayed untouched).
- Only the captain gets the reminder, who then tells their team - rejected: the user explicitly
  asked for every team member, and the whole point of in-app notifications (vs. the WhatsApp-
  group status quo FR-012 is replacing) is that delivery doesn't depend on one person relaying it.
- Send the reminder further out than one day (e.g. 3 days + 1 day) - rejected: not requested;
  one well-defined trigger is simpler than a notification schedule nobody asked for.

**Status:** Adopted.
