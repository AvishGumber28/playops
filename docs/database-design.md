# Database Design

Every entity below follows the same template: purpose, attributes, keys, relationships,
constraints, indexes, and lifecycle. This is the executable form of everything frozen in
Phases 1–3 — if this document and `functional-requirements.md` ever disagree, that's a bug
in one of them, not a judgment call.

See the ERD shared in chat for the core relationships at a glance; this document is the full,
precise version underneath it.

---

## User

**Purpose:** Anyone who can log into PlayOps. There's no separate table per role — Caretaker,
Secretary, and Sports Admin capabilities all come from relationships elsewhere, per the D-006
scoped-permissions design.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| email | text | no |
| passwordHash | text | no |
| name | text | no |
| hostelId | uuid | yes — until self-declared |
| hostelSelectedAt | timestamp | yes |
| hostelLockedUntil | timestamp | yes |
| isSportsAdmin | boolean | no, default false |
| createdAt | timestamp | no |

**Primary key:** id
**Foreign keys:** hostelId → Hostel
**Relationships:** belongs to one Hostel · can captain Teams · can be a TeamPlayer · can
request/approve VenueBookings · can enter Scorecards · referenced by Hostel as caretaker/secretary
**Unique constraints:** email
**Indexes:** email (login lookups)
**Lifecycle:** created at signup; no deletion path in v1 (deactivation is Future Scope)

---

## Hostel

**Purpose:** A hostel, and — via its own foreign keys, not User's — who currently holds its
Caretaker and Secretary capabilities.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| name | text | no |
| caretakerUserId | uuid | yes — until seeded |
| sportsSecretaryUserId | uuid | yes — until appointed |

**Primary key:** id
**Foreign keys:** caretakerUserId → User, sportsSecretaryUserId → User
**Relationships:** has many Users (members), Tournaments, Teams, HostelChangeRequests
**Unique constraints:** name · caretakerUserId · sportsSecretaryUserId (each person can hold
at most one hostel's Caretaker or Secretary capability — enforced by the column itself being
unique, not just checked in code)
**Indexes:** caretakerUserId, sportsSecretaryUserId (both looked up on every `/me` role
resolution, per FR-002)
**Lifecycle:** seeded at setup with dummy Caretakers (per the earlier bootstrap decision);
appointments change via Caretaker action, with no history kept (D-005)

---

## HostelChangeRequest

**Purpose:** Tracks a student's request to change hostels, pending approval.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| userId | uuid | no |
| requestedHostelId | uuid | no |
| status | text (pending/approved/rejected) | no, default 'pending' |
| reviewedById | uuid | yes |
| createdAt | timestamp | no |
| reviewedAt | timestamp | yes |

**Primary key:** id
**Foreign keys:** userId → User, requestedHostelId → Hostel, reviewedById → User
**Relationships:** belongs to one User, targets one Hostel
**Unique constraints:** none needed — a user can have multiple past requests
**Indexes:** userId, status (for a Caretaker's pending-requests queue)
**Lifecycle:** pending → approved/rejected. Two business rules gate approval, enforced in
application logic since they're not expressible as simple column constraints: (1) only the
student's *current* hostel's Caretaker may approve it (business rule 9), and (2) it must be
blocked entirely while the student is on an active team in an in-progress tournament
(business rule 13).

---

## Sport

**Purpose:** The catalog of supported sports and which scorecard template each uses.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| name | text | no |
| defaultTeamSize | int | yes |
| scorecardTemplate | text | no |

**Primary key:** id · **Unique constraints:** name
**Lifecycle:** seeded at setup (Cricket, Football, Basketball for v1); extending to a new
sport is a data change, not a schema change (this is exactly what "sport shouldn't be
hardcoded" meant in practice)

---

## Tournament

**Purpose:** One intra-hostel competition.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| name | text | no |
| sportId | uuid | no |
| hostelId | uuid | no |
| format | text (knockout/league) | no |
| registrationDeadline | timestamp | no |
| status | text (draft/registration_open/in_progress/completed/cancelled) | no |
| createdById | uuid | no |
| createdAt | timestamp | no |

**Primary key:** id
**Foreign keys:** sportId → Sport, hostelId → Hostel, createdById → User
**Relationships:** belongs to one Hostel and one Sport; has many Teams and Matches
**Indexes:** hostelId (Secretary's own-hostel filtering), status
**Lifecycle:** draft → registration_open → in_progress → completed (or cancelled at any
point). No approval gate on creation (business rule 7).

---

## Team

**Purpose:** One team registered in one tournament.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| tournamentId | uuid | no |
| name | text | no |
| captainUserId | uuid | no |
| hostelId | uuid | no |
| status | text (active/withdrawn) | no, default 'active' |
| registrationStatus | text (approved/rejected) | no, default 'approved' |
| createdAt | timestamp | no |

**Primary key:** id
**Foreign keys:** tournamentId → Tournament, captainUserId → User, hostelId → Hostel
**Relationships:** belongs to one Tournament; has many TeamPlayers; appears as teamA/teamB on
Matches
**Indexes:** tournamentId, hostelId
**Lifecycle:** active → withdrawn (business rule 12 — withdrawing after fixtures exist
forfeits remaining matches rather than deleting the team).

> **Design note on `registrationStatus`:** defaults to `approved` automatically once the
> hostel-eligibility check passes. This field exists specifically so Q-007 (still open —
> whether Secretary can manually reject a registration beyond the automatic check) doesn't
> block schema design: if resolved "yes," a Secretary flips this to `rejected`; if resolved
> "no," the field simply never changes from its default. Either answer works without a
> migration.

---

## TeamPlayer

**Purpose:** One player's membership on one team.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| teamId | uuid | no |
| tournamentId | uuid | no — denormalized from Team, see below |
| userId | uuid | no |
| addedAt | timestamp | no |

**Primary key:** id
**Foreign keys:** teamId → Team, userId → User
**Unique constraints:** (tournamentId, userId) — a player can't join two teams in the same
tournament (business rule 2)
**Indexes:** teamId, the unique index above
**Lifecycle:** created when the Captain adds a player; deleted only by the Captain removing
them (business rule / D-007 — players cannot remove themselves)

**Note on denormalization:** `tournamentId` is copied from `Team.tournamentId` purely so the
unique constraint above can exist as a plain two-column index. Without it, "one team per
tournament" would need a join at insert time under a race condition, which is worse than one
extra column kept in sync at write time. This is the one deliberate deviation from strict
normalization in this schema, and it's here for a specific, load-bearing reason — not
laziness.

---

## Venue

**Purpose:** A bookable ground/court.

**Attributes:** id, name, location (nullable), capacity (nullable), description (nullable)
**Primary key:** id
**Lifecycle:** seeded/managed by Sports Department

---

## Equipment

**Purpose:** A bookable item with finite quantity (e.g. "cricket bats: 8").

**Attributes:** id, name, totalQuantity (int)
**Primary key:** id
**Lifecycle:** managed by Sports Department

---

## VenueBooking

**Purpose:** A request (or direct entry) for a venue at a specific date/time.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| venueId | uuid | no |
| date | date | no |
| startTime | text | no |
| endTime | text | no |
| tournamentId | uuid | yes |
| matchId | uuid | yes |
| requestedById | uuid | yes — null for admin-manual entries |
| status | text (pending/approved/rejected) | no |
| source | text (secretary_request/admin_manual) | no |
| approvedById | uuid | yes |
| createdAt | timestamp | no |
| decidedAt | timestamp | yes |

**Primary key:** id
**Foreign keys:** venueId → Venue, matchId → Match, requestedById → User, approvedById → User
**Unique constraints:** **`(venueId, date, startTime, endTime) WHERE status = 'approved'`** —
this is the single most important constraint in the whole schema (business rule 3). It's a
*partial* unique index — only approved rows are checked — which is exactly what allows two
*pending* requests for the same slot to coexist (so the admin can see and reject the loser)
while making a second *approved* booking for that slot structurally impossible, regardless of
whether it came from a Secretary's request or an admin's manual entry.
**Indexes:** status (admin's pending-requests queue), the constraint above
**Lifecycle:** pending → approved/rejected. Approving one request for a contested slot leaves
any other pending request for that slot un-approvable — this is enforced by the index itself,
not application logic remembering to check.

---

## EquipmentBooking

**Purpose:** A request for a quantity of equipment at a specific date/time.

**Attributes:** id, equipmentId, quantityRequested (int), date, startTime, endTime,
tournamentId (nullable), matchId (nullable), requestedById (nullable), status, source,
approvedById (nullable), createdAt, decidedAt (nullable)
**Primary key:** id
**Foreign keys:** equipmentId → Equipment, requestedById → User, approvedById → User
**Constraint:** no simple unique index — equipment is quantity-based. Approval must check
`SUM(quantityRequested)` across overlapping *approved* bookings stays within
`Equipment.totalQuantity`. This has to be a transaction (see Transactions, below), since two
concurrent approvals could otherwise both pass the check before either commits.
**Lifecycle:** pending → approved/rejected

---

## Match

**Purpose:** One scheduled fixture between two teams.

**Attributes:**
| Field | Type | Nullable |
|---|---|---|
| id | uuid | no |
| tournamentId | uuid | no |
| round | int | no |
| matchNumber | int | no |
| teamAId | uuid | yes — until the bracket resolves |
| teamBId | uuid | yes |
| scheduledDate | date | yes |
| scheduledTime | text | yes |
| status | text (scheduled/completed/cancelled/postponed/forfeited) | no |
| cancellationReason | text | yes |
| winnerTeamId | uuid | yes |
| createdAt | timestamp | no |

**Primary key:** id
**Foreign keys:** tournamentId → Tournament, teamAId/teamBId/winnerTeamId → Team
**Relationships:** belongs to one Tournament; has one VenueBooking, one Scorecard, many
ConflictLog entries
**Indexes:** tournamentId, status
**Lifecycle:** scheduled → completed (result entered) / cancelled (disruption, feeds the
conflict engine) / postponed / **forfeited** (business rule 12 — added specifically to
support team withdrawal after fixtures exist; `winnerTeamId` is set to the opposing team
automatically in this case)

---

## Scorecard

**Purpose:** The post-match structured result for one match.

**Attributes:** id, matchId (unique), sportId, data (jsonb), enteredById, enteredAt
**Primary key:** id
**Foreign keys:** matchId → Match (unique — one scorecard per match), sportId → Sport,
enteredById → User
**Why `data` is JSON, not columns:** every sport's result shape differs (cricket:
runs/wickets/overs; football: goals/scorers/cards). JSON with a per-sport validation schema
in application code avoids a new table per sport while keeping the data structured, not free
text.
**Lifecycle:** created once, by the tournament's Secretary only (business rule 4); treated as
final — no update path in v1, since disputes have never historically occurred

---

## ConflictLog

**Purpose:** Records every conflict the scheduling engine detects, for both operational
visibility and the Phase 17 evaluation metrics (number of conflicts, resolution rate).

**Attributes:** id, type (venue/team/player/rest_time), tournamentId (nullable), matchId
(nullable), detectedAt, resolution (auto_suggested/manually_resolved/unresolved), resolvedAt
(nullable)
**Primary key:** id
**Foreign keys:** matchId → Match
**Lifecycle:** created when the engine detects a clash; updated when resolved. Never deleted
— this is the historical record the evaluation phase measures against.

---

## Announcement / Notification

**Announcement:** id, hostelId (nullable = college-wide), tournamentId (nullable), title,
body, createdById, createdAt
**Notification:** id, userId, announcementId (nullable), matchId (nullable), message, readAt
(nullable), createdAt

**Relationships:** an Announcement can generate many Notifications, one per relevant user —
this is what makes delivery scoped (business rule / NFR: "nobody sees a notification for a
hostel or tournament they have no connection to") rather than broadcast.
**Indexes:** Notification.userId + readAt (unread-count queries)

---

## Cross-cutting design concerns

**Normalization:** Third normal form throughout, with one deliberate exception —
`TeamPlayer.tournamentId` — documented above, not an oversight.

**Referential integrity:** every relationship is a real foreign key. Nothing that the
database can enforce is left to application code to remember, per the project's own
"never trust frontend, and don't trust unenforced backend logic either" principle.

**Transactions.** Three operations specifically need to be wrapped in a database transaction,
not just sequential queries:
- **Venue booking approval** — checking availability and writing the approval must be atomic,
  or two near-simultaneous approvals could both pass a check that's since gone stale.
- **Equipment booking approval** — same reasoning, for the quantity-sum check.
- **Match result entry** — writing the Scorecard and updating `Match.status`/`winnerTeamId`
  must succeed or fail together; a scorecard with no corresponding status update (or vice
  versa) would corrupt standings computation.

**Duplicate prevention:** the `TeamPlayer` and `VenueBooking` unique constraints handle the
two cases that matter (business rules 2 and 3) — both are database-level, not just
application checks.

**Historical data:** nothing is deleted. Completed matches, scorecards, and bookings persist
indefinitely — this is what eventually feeds Venue Utilization Intelligence and the Hostel
Performance Index once those move out of Future Scope, since they need exactly this history
to exist.

**Auditability:** deliberately partial, by earlier decision (D-005) — Secretary appointment
changes and hostel-committee history are *not* logged, to avoid over-engineering something
nobody asked for. Scheduling conflicts *are* fully logged (`ConflictLog`), since that's the
one area with an explicit evaluation requirement (Phase 17) that depends on the history
existing.
