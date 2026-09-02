# Development Process

PlayOps is built phase by phase. We do not skip phases, and we do not generate the whole
application at once. Each phase follows the same loop:

1. State what needs to be done
2. Propose a design
3. Explain any decision that touches database, architecture, auth, authorization,
   scheduling, or deployment
4. Wait for approval if the decision is significant
5. Implement
6. Test / build / lint
7. Report: what changed, what was tested, problems found, recommended next step

Then stop before starting the next phase.

## Phases

| # | Phase | Status |
|---|---|---|
| 0 | Project setup & decision document | Complete |
| 1 | Freeze & finalize requirements | Complete |
| 2 | User roles & permissions | Complete, pending review |
| 3 | User journeys & workflow design | Complete |
| 4 | Data model & database design | Complete |
| 5 | System architecture | Complete |
| 6 | Technology & dev environment | Complete |
| 7 | Backend foundation | Complete — verified end-to-end: 4/4 test suites, 20/20 tests passing against a real generated Prisma Client and real Postgres |
| 8 | Frontend foundation | Complete — Next.js + TypeScript + Tailwind/shadcn scaffolded, real login/signup wired to the backend, GET /api/me built (pulled forward from Phase 9), role-based dashboard routing verified with a clean build and all 5 routes serving correctly |
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

## Rules

- Never jump ahead — e.g. no Phase 8 work before Phase 1–6 are approved.
- No decision affecting database, architecture, auth, or deployment gets made silently —
  it goes in `decision-log.md` with reasoning, before implementation.
- No forced ML, no forced microservices — only introduce complexity with a genuine reason.
- Every completed module gets appropriate tests before being considered done.
- Documentation is updated as we go, not written retroactively at the end.
