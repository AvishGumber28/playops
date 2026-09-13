# PlayOps — Proposal & Feasibility Report

## 1. Problem Statement

College intramural sports across hostels currently run through fragmented, ad hoc
coordination — a separate WhatsApp group per hostel, manual venue arrangements with no
central record, no reliable way to check whether a venue slot is already taken, and no
single source of truth for match results or standings. This makes double-booked venues,
unclear player eligibility, and lost historical records a recurring, structural problem
rather than an occasional one.

## 2. Proposed Solution

**PlayOps** is a single web platform for managing intramural sports across the hostels of
one college. It replaces the current fragmented setup with:

- **Unified signup and role resolution** — one account type at signup; elevated
  capabilities (Caretaker, Sports Secretary, Sports Department) are resolved dynamically
  from relationships in the data, not assigned at registration.
- **Tournament creation and team registration**, scoped per hostel, with hostel-eligibility
  enforced at the database level.
- **Automatic fixture generation** for knockout and league formats.
- **Venue and equipment booking** with a structural (database-constraint-level) guarantee
  against double-booking — the core technical differentiator of the project.
- **A conflict detection and rescheduling engine** that validates a proposed schedule
  before publication and suggests alternative slots when a match is disrupted.
- **Post-match scorecards** and standings computed on demand from match results, never
  stored redundantly.
- **Scoped announcements and notifications**, replacing the single-channel WhatsApp
  approach with delivery limited to users actually connected to a given hostel or
  tournament.

## 3. Scope for v1 (MoSCoW)

**Must Have:** User & role management · hostel self-declaration & eligibility · Sports
Secretary appointment · tournament creation · team & player registration · automatic
fixture generation · venue & equipment booking · conflict detection & rescheduling ·
post-match scorecards · standings · scoped announcements & notifications.

**Should Have:** Manual drag-and-drop fixture builder · additional conflict constraint
types beyond venue clashes (rest time, academic clashes).

**Could Have:** A result dispute/correction path — no evidence this is needed, since no
dispute has occurred historically.

**Future Scope:** Inter-hostel and college-level tournaments · additional sports beyond
Cricket/Football/Basketball · full live ball-by-ball scoring · multi-college support ·
Venue Utilization Intelligence · Hostel Sports Performance Index.

## 4. Feasibility Analysis of Candidate Innovative Features

Five candidate technical-contribution features were evaluated explicitly before scoping:

1. **Tournament Conflict Detector — Must Have.** No cold-start problem; it works from a
   single tournament's own data from day one and targets a real, confirmed pain point
   (venue double-booking).
2. **Smart Rescheduling — Must Have**, merged into the same engine as #1, since detection
   and resolution are two halves of the same problem rather than separate systems.
3. **Player Eligibility & Duplicate Detection — Must Have**, but scoped down from a general
   "engine" to a single enforced business rule (one hostel per player, checked at team
   registration) — that turned out to be the entire requirement.
4. **Venue Utilization Intelligence — Future Scope.** Needs accumulated booking history to
   produce anything meaningful; none exists yet at project start.
5. **Hostel Sports Performance Index — Future Scope.** Same cold-start limitation — a
   cross-tournament ranking needs multiple completed tournaments behind it first.

Both deferred features are deferred for the same structural reason (no historical data at
launch), not because they are infeasible — they become viable once v1 has been in use for a
season.

## 5. Constraints & Assumptions

- **Single-college deployment for v1** — PlayOps targets one college with multiple hostels,
  not a multi-college platform.
- **No access to the college's authoritative hostel-allotment or student-roster data** for
  v1 — hostel membership and initial Caretaker accounts are self-declared or manually
  seeded rather than pulled from an official system.
- **Semester-length timeline**, developed primarily by one active developer with occasional
  teammate contributions, reviewed through pull requests.
- **Phases are sequential and not skipped** — later phases (deployment, polish, final demo)
  are expected to compress in time relative to earlier ones.

## 6. Technical Feasibility

- **Architecture:** modular monolith — one deployable backend, internally organized into
  clearly separated modules matching the feature boundaries above. Deliberately avoids
  microservices, which would solve problems (independent scaling, multiple teams) this
  project does not have.
- **Stack:** Next.js + React + TypeScript (frontend), NestJS + TypeScript (backend, chosen
  because its module/provider structure maps directly onto the architecture's module
  boundaries), PostgreSQL with Prisma (chosen specifically because Postgres supports the
  partial unique index that makes venue double-booking structurally impossible, not just
  application-checked).
- **Data integrity:** every cross-cutting invariant (one hostel per player, one approved
  booking per slot, exactly one Secretary per hostel) is enforced by a real database
  constraint or transaction, not left to application code to remember — consistent with the
  project's principle of never trusting unenforced backend logic any more than frontend
  logic.

## 7. Conclusion

Given the single-college scope, the semester timeline, and a phased process with an
explicit stop-and-review gate after each phase, PlayOps's v1 feature set is feasible to
build and demonstrate within the semester. The two features requiring historical data are
correctly deferred rather than attempted prematurely, and the core technical contribution
(the conflict detection and rescheduling engine) has no dependency on data that does not
exist from day one.
