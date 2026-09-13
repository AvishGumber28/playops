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
| 8 | Frontend foundation | Not started |
| 9 | Core system — vertical slices | Not started |
| 10 | Technical/innovative features | Not started |
| 11 | Testing | Not started |
| 12 | Security | Not started |
| 13 | Performance & data integrity | Not started |
| 14 | Realistic data & demo environment | Not started |
| 15 | Deployment | Not started |
| 16 | Documentation | Ongoing throughout |
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

## Immediate Next Milestones

With the backend foundation verified and Phase 8 (Frontend foundation) next, the near-term
path is:

1. **Phase 8 — Frontend foundation:** Next.js project scaffolding, base layout, protected-
   route/auth-context pattern.
2. **Phase 9 — Core system, vertical slices:** built incrementally, in dependency order —
   identity & hostel placement, Secretary appointment & tournament creation, team
   registration, fixtures, venue booking, and results/standings, each slice adding a
   working path through the system rather than one module built end-to-end in isolation.
3. **Phase 10 — Technical/innovative features:** the conflict detection and rescheduling
   engine, the project's core technical contribution, built once the tournament and venue
   modules it depends on are in place.
