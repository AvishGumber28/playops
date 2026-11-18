# PlayOps — Milestone Plan

PlayOps is built phase by phase, not generated all at once. Each phase follows the same
loop: state what needs to be done → propose a design → explain any decision that touches
database, architecture, auth, authorization, scheduling, or deployment → wait for approval
if the decision is significant → implement → test/build/lint → report what changed, what
was tested, problems found, and the recommended next step. Development stops before the
next phase begins.

## Phase Table

| # | Phase | Status |
|---|---|---|
| 0 | Project setup & decision document | Complete |
| 1 | Freeze & finalize requirements | Complete |
| 2 | User roles & permissions | Complete, pending review |
| 3 | User journeys & workflow design | Complete |
| 4 | Data model & database design | Complete |
| 5 | System architecture | Complete |
| 6 | Technology & dev environment | Complete |
| 7 | Backend foundation | Complete — verified end-to-end (4/4 test suites, 20/20 tests passing against a real generated Prisma Client and real PostgreSQL) |
| 8 | Frontend foundation | Complete — Next.js + TypeScript + Tailwind/shadcn scaffolded, real login/signup wired to the backend, role-based dashboard routing verified |
| 9 | Core system — vertical slices | Complete — all 12 functional requirements (FR-001–FR-012) built, tested, and live |
| 10 | Technical/innovative features | Complete — the conflict detection & rescheduling engine (FR-009), built as slice 9 within the same continuous vertical-slices sequence rather than a separately-staged effort |
| 11 | Testing | Complete — real-database e2e suite added on top of the per-slice tests: backend 224/224 (207 unit + 17 e2e against a real Postgres test DB), frontend 28/28 component tests (Vitest) + 3/3 browser e2e (Playwright, driving the real UI against the real backend) |
| 12 | Security | Complete — see decision-log.md D-031 |
| 13 | Performance & data integrity | Complete — see decision-log.md D-032 |
| 14 | Realistic data & demo environment | Complete — see decision-log.md D-033 |
| 15 | Deployment | Complete — live at https://playops-sports.vercel.app (frontend) + https://playops.onrender.com (backend) + Neon (database); see decision-log.md D-034 |
| 16 | Documentation | Complete — audited all of docs/ against the actual finished implementation: closed 3 stale open questions (Q-001, Q-003 [added decision-log.md D-035], Q-007), fixed cross-references that still said "Q-007 still open" after D-016 had already resolved it, corrected technology-decisions.md's stale Prisma caveat and deployment-target section, fixed schema.prisma's outdated header comment, and rewrote the root README (was still describing Phase 0 - "no application code exists yet" - despite the project being fully built and deployed) |
| 17 | Evaluation of technical contribution | Not started |
| 18 | Final polish | Not started |
| 19 | Final demo preparation | Not started |

## Governing Rules

- No jumping ahead — e.g. no Phase 8 work begins before Phases 1–6 are approved.
- No decision affecting database, architecture, auth, or deployment is made silently — it
  is recorded in the decision log with reasoning, before implementation.
- No forced ML, no forced microservices — complexity is only introduced with a genuine,
  stated reason.
- Every completed module receives appropriate tests before being considered done.
- Documentation is updated as the project proceeds, not written retroactively at the end.

## Completed: Phases 8–10

Phases 8 through 10 are done. Frontend foundation (8) and the full set of vertical slices (9)
were built incrementally, in dependency order — identity & hostel placement, Secretary
appointment & tournament creation, team registration, fixtures, venue & equipment booking,
conflict detection & rescheduling, results/scorecards, standings, and announcements/
notifications — each slice adding a working path through the system rather than one module
built end-to-end in isolation. The conflict detection and rescheduling engine (Phase 10, the
project's core technical contribution) landed as slice 9 of that same sequence, once the
tournament and venue modules it depends on were in place, rather than as a separately-staged
effort — the phase table's split between 9 and 10 reflects the original plan's categorization,
not two different build efforts.

## Completed: Phase 11

A dedicated cross-cutting test phase, beyond the per-slice unit/integration tests already in
place. On the backend: five real-database e2e spec files (golden path, role/tenant
boundaries, venue/equipment booking, conflict detection & rescheduling, results &
standings), run with Jest against a dedicated `playops_test` Postgres database — never the
dev database — serialized with `--runInBand` since every spec shares that one database.
207 pre-existing unit tests plus these 17 e2e tests: 224/224 passing. On the frontend,
which had no test tooling at all before this phase: Vitest + React Testing Library for
component/logic-level tests (28/28 passing — icon matching, scorecard template invariants,
status labels, the role selector, and the notification bell's fetch/open/mark-read flow),
plus a thin Playwright layer (3/3 passing) that drives the actual Next.js UI against the
actual NestJS backend for the two flows that matter most: signup → login → hostel
selection, and a Caretaker appointing a Secretary who then creates a tournament through the
real form — catching wiring bugs neither the unit tests nor the backend's own e2e suite can
see.

## Completed: Phase 12

A targeted security pass (see decision-log.md D-031 for full reasoning), not a generic
line-by-line re-audit — Phase 11's e2e suite already exercises role/tenant boundaries broadly,
so this phase closed the specific gaps a grounded review of the actual auth/guard/CORS/
dependency surface found: `POST /api/notifications/send-match-reminders` was missing a role
check (any Student could trigger a system-wide notification run - now Sports-Admin-only);
`/api/auth/login` and `/api/auth/signup` had no rate limiting (added via `@nestjs/throttler`,
5/min on those two routes, 100/min globally, disabled under `NODE_ENV=test`); the CORS setup
silently fell back to `origin: '*'` if `ALLOWED_ORIGIN` was ever unset (now hard-fails at boot
instead); and both backend and frontend production dependencies had real CVEs (now zero per
`npm audit --omit=dev` on both, including a same-major `next` bump to 16.4.6 for several
Next.js RCE/SSRF/cache-poisoning advisories). JWT revocation/logout was deliberately *not*
built — recorded as an explicit, reasoned deferral rather than a silent gap. Two new e2e tests
cover the notifications fix (Student-rejected, Sports-Admin-succeeds); full regression
(backend 207 unit + 19 e2e, frontend 28 Vitest + 3 Playwright, plus a clean production
`next build`) passes.

## Completed: Phase 13

A grounded pass over actual query/write patterns (see decision-log.md D-032), not a generic
index-everything sweep. Two write sequences that used to commit as several separate
statements are now each one atomic transaction: `ResultsService.submitScorecard` (scorecard
write, match completion, winner advancement into the next round, and tournament-completion
check all commit together - a crash partway through used to be able to leave a match
completed with a winner that never actually advanced) and `MatchSchedulingService.cancelMatch`
(up to six sequential writes - cancel, log the conflict, check tournament completion, free the
old venue slot, search for and apply a replacement, mark the conflict auto-suggested - all
now one unit). Nine indexes were added on columns confirmed, by reading the actual service
code, to be real unindexed `WHERE`-clause filters (`VenueBooking.venueId`/`requestedById`,
`EquipmentBooking.equipmentId`/`requestedById`, `ConflictLog.tournamentId`/`matchId`,
`Notification.matchId`, `User.hostelId`, `HostelChangeRequest.status`). One real N+1 pattern
(`MatchReminderService`'s per-match loop) was found and deliberately left alone, recorded
with reasoning rather than silently skipped - it costs nothing at this project's actual
scale. Full regression (207 unit + 19 e2e, migration applied to both the dev and
`playops_test` databases) passes.

## Completed: Phase 14

A separate, on-demand seed script (`backend/prisma/seed-demo.ts`, `npm run seed:demo`) - the
existing `prisma/seed.ts` stays exactly as lean as it was (hostels, sports, venues, dummy
Caretaker logins only, run on every normal dev setup). The demo script populates ~16 student
accounts, a Secretary, a Sports Admin, and four tournaments at four different real lifecycle
stages across two hostels: a fully-completed knockout Football Cup (real bracket, real
scheduled venues/dates, real recorded scores), a fully-completed round-robin Cricket League
(a real standings table), a still-open Basketball tournament with one team explicitly
rejected (so the Secretary's approval queue has something real to show), and a second
hostel's tournament existing specifically to demonstrate tenant isolation during a demo. Plus
a 5-item equipment catalog and venue bookings spanning every real status, and two
announcements generating real notifications.

The whole thing is built by calling the real NestJS services directly (`AuthService.signup`,
`TournamentService.createTournament`, `ResultsService.submitScorecard`, etc.) rather than
writing Prisma rows by hand - every business rule (deadlines, approval gates, bracket
seeding, winner advancement, stock decrements, standings math) is enforced by the same code
the real app runs, so the data can't be in a state the app itself wouldn't allow. Verified by
running it against the dev database and querying the result back out, not just trusting that
the script didn't throw. `docs/demo-script.md` has login credentials and a suggested
presentation walkthrough. See decision-log.md D-033 for full reasoning.

## Completed: Phase 15

Deployed to three free-tier platforms, chosen after checking their actual current terms
(not assumed): **Vercel** for the frontend, **Render** for the backend, **Neon** for Postgres
- avoiding Railway (a 30-day trial, not indefinitely free) and Render's own free Postgres
(expires after 30 days). Live at:

- Frontend: https://playops-seven.vercel.app
- Backend: https://playops.onrender.com
- Database: Neon, `ap-southeast-1`, migrated (all 10 migrations) and seeded with both the
  base seed and the Phase 14 demo content, verified by querying the row counts back out.

Two genuine, previously-latent bugs surfaced and were fixed during this deploy - both existed
before Phase 15 started, just never exercised until this was the first time anyone actually
ran a real production build and start against this project: `npm install` was silently
skipping `devDependencies` (where `@nestjs/cli` lives) because `NODE_ENV=production` was set
as a platform variable; and `backend/tsconfig.build.json` didn't exclude the `prisma/` seed
scripts, so the compiled build mirrored the whole `backend/` folder instead of flattening
`src/` into `dist/`, meaning `dist/main.js` never actually existed where `npm run start:prod`
looked for it. Both are real code fixes (already pushed), not Render-specific workarounds -
see decision-log.md D-034 for the full story, including why each one was previously invisible.

Verified end-to-end against the live, real deployed stack: signup, login, and role-based
dashboards all work - not just a local smoke test.

## Immediate Next Milestones

With all 12 functional requirements complete and Phases 11-15 closed out, and the project
fully deployed and demo-ready, the remaining phases are housekeeping rather than build work:

1. **Phase 16 — Documentation** (ongoing throughout, per the phase table).
2. **Phase 17 — Evaluation of technical contribution**, **Phase 18 — Final polish**, and
   **Phase 19 — Final demo preparation** follow, in that order.
