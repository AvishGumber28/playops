# System Architecture

## Architecture style: modular monolith

**Decision:** One deployable backend application, internally organized into clearly separated
modules (folders/packages), not multiple independently-deployed services.

**Reasoning:** Microservices solve problems this project doesn't have — independent scaling
of individual modules, different teams owning different services, needing to deploy one part
without redeploying others. None of that applies to a semester project built primarily by one
developer. A modular monolith gets the thing microservices are actually trying to protect —
clear boundaries so modules don't become tangled — without the operational cost of running
and coordinating multiple services. This directly follows the process's own Rule 5.

The module boundaries below are *logical*, not deployment boundaries. All of them run in the
same process and talk to the same database.

---

## Module boundaries

| Module | Owns | Covers |
|---|---|---|
| **Auth & Identity** | User | Signup, login, JWT issuance, role resolution (FR-001, FR-002) |
| **Hostel & Eligibility** | Hostel, HostelChangeRequest | Self-declaration, change requests, Secretary appointment (FR-003, FR-004) |
| **Tournament & Registration** | Tournament, Team, TeamPlayer | Creation, team/player registration, fixture generation (FR-005, FR-006, FR-007) |
| **Venue & Booking** | Venue, Equipment, VenueBooking, EquipmentBooking | Requests, approval, manual admin entries (FR-008) |
| **Scheduling & Conflict Engine** | ConflictLog | Schedule validation, disruption handling, alternative-slot suggestions (FR-009) — this is the project's core technical contribution, kept as its own module specifically so it can be built, tested, and evaluated independently of the modules that feed it data |
| **Results & Standings** | Match, Scorecard | Result entry, on-demand standings computation (FR-010, FR-011) |
| **Notifications** | Announcement, Notification | Scoped delivery to relevant users only (FR-012) |

**One deliberate deviation from a typical template:** there is no separate "Eligibility
Engine." Phase 1 evaluated this explicitly and found the actual requirement was a single
enforced rule (`player.hostelId == team.hostelId`, checked at insert — business rule 1/2),
not a rules engine. It lives inside Tournament & Registration rather than as its own module,
because building a general-purpose rule engine for one hard-coded rule would be exactly the
over-engineering Rule 5 warns against.

**Why the Conflict Engine reads across two modules:** it needs data that Tournament &
Registration owns (fixtures, teams, rest constraints) and data that Venue & Booking owns
(venue availability). It's still one module in the monolith — this isn't a service boundary,
it's a *reason* to keep it clearly separated internally, so its logic doesn't get scattered
across the two modules it depends on.

---

## Data flow

Every request follows the same path:

```
Frontend
  → API Layer (parses request, verifies JWT)
  → Authorization check (per the Phase 2 permission matrix, action-specific — not role rank)
  → Relevant module's business logic
  → Database (via the module's own tables)
  → Response
```

For actions that cross module boundaries — e.g. approving a venue booking (Venue & Booking
module) that resolves a disruption (Scheduling & Conflict Engine) — the initiating module
calls into the other module's exposed functions directly (same process, no network hop), not
through the API layer a second time.

---

## Authentication flow

Already built and verified during earlier scaffolding (see the auth flow diagram from that
session):

1. Signup — college email domain checked, password hashed (never stored plain)
2. Login — credentials verified, JWT issued containing only the user's id
3. Every subsequent request — JWT verified by API-layer middleware
4. Role resolution — computed fresh on each `/me` call from Hostel/Team relationships (FR-002),
   never cached or stored as a static field

---

## Authorization architecture

Every endpoint's permission check maps directly to one row in `roles-permissions.md` — there
is no separate authorization scheme being invented here. The API layer's job is to look up
the specific relationship the action requires (team captain? hostel's caretaker? sports
admin flag?) and reject the request server-side if it doesn't hold, regardless of what the
frontend did or didn't show.

---

## API architecture

Resource-oriented, one base path per module:

```
/api/auth          signup, login
/api/me             role resolution
/api/hostels        hostel data, change requests
/api/tournaments    tournament CRUD, teams, registration
/api/venues         venue/equipment catalog, bookings
/api/matches        fixtures, scheduling, results
/api/scorecards     result entry
/api/announcements  announcements, notifications
```

Exact routes and payloads aren't specified here — that's Phase 7/9 implementation detail, not
architecture. What's fixed at this phase is the *shape*: one base path per module, matching
the module boundaries above, so the API surface doesn't drift from the internal organization
over time.

---

## Notification architecture

**Decision:** In-app notifications only, fetched on demand (page load / periodic check), not
real-time push (no websockets) in v1.
**Reasoning:** A push infrastructure is real operational complexity for a requirement that's
currently just "reduce reliance on one WhatsApp group" (NFR, usability). Fetch-on-demand
achieves that without it. Revisit only if v1 usage shows fetch-on-demand actually feels slow
in practice — not a hypothetical concern.

---

## Venue management architecture

Fully specified already in Phase 4 — the `VenueBooking` table is the single source of truth
for both Secretary requests and Sports Department manual entries, with the partial unique
index as the structural double-booking guarantee. Nothing architectural to add here beyond
pointing back to that design; repeating it here would risk the two documents drifting apart.
