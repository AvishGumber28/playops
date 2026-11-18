# Technology Decisions

Replaces `technologies-under-consideration.md`'s open option space with the actual, final
stack. Several of these were already effectively decided by earlier phases, not chosen fresh
here — noted explicitly below so it's clear which is which.

## Frontend

- **Next.js + React, TypeScript.**
- **Tailwind CSS + shadcn/ui** for styling and components — a strong fit specifically because
  Phase 2 defined five distinct role-based dashboards that all need consistent, accessible
  components (tables, dialogs, forms) without hand-building each one from scratch.
- **Deferred, not decided now:** Framer Motion (animation — nothing functional needs it;
  revisit at Phase 18, Final Polish, if there's time) and Recharts (charting — the only
  features that need charts, Venue Utilization Intelligence and the Hostel Performance Index,
  are both Future Scope per Phase 1, since they need historical data that doesn't exist yet).

## Backend

- **NestJS + TypeScript.** Chosen over Express specifically because NestJS's module/provider
  structure maps directly onto Phase 5's module boundaries — Auth, Hostel, Tournament, Venue,
  Conflict Engine, Results, Notifications each become a literal NestJS module, not just a
  folder-naming convention.
- **Trade-off accepted knowingly:** NestJS brings real new concepts on top of TypeScript
  itself — decorators, dependency injection, guards, pipes. Expect Phase 7 (Backend
  Foundation) to include genuine learning time, not just implementation time.

## Database

- **PostgreSQL** — already decided in Phase 4, not a fresh choice here. The venue
  double-booking constraint (the partial unique index) is a Postgres-specific feature that
  MySQL and SQLite don't support the same way.
- **Prisma** as the access layer — chosen over the plain-`pg` approach used in earlier
  scaffolding specifically because Prisma auto-generates TypeScript types directly from the
  schema, which pairs naturally with an all-TypeScript stack.

**Caveat, since resolved:** an earlier sandbox environment couldn't fetch Prisma's engine
binaries (a restricted network allow-list in that one environment, not a Prisma problem) -
flagged at the time as something to re-test on a normal dev machine before trusting it. It
has since been exercised continuously and successfully across the whole project: local dev,
the Phase 11 e2e suite's own `playops_test` database, and - the most demanding real test of
all - migrating and seeding an actual production Neon database during Phase 15 deployment.
The plain-`pg` fallback was never needed.

## Caching

- **Redis** — deferred, not part of v1. Nothing in the Must-Have feature list needs it;
  revisit only if a real performance need appears later.

## Local development database

- **Docker Compose**, running Postgres. Gives every team member an identical database with
  one command regardless of OS — particularly worth it on Windows, where a native Postgres
  install has more setup friction than on Linux/Mac.

## Package manager

- **npm** — ships with Node, no reason to add Yarn/pnpm at this scale.

## Linting & formatting

- **ESLint + Prettier**, TypeScript-aware. Actual config files are created alongside the
  NestJS project (Phase 7) and Next.js project (Phase 8) — not now, since there's no project
  yet for a config to attach to.

## API testing during development

- **VS Code REST Client / Thunder Client** for manual endpoint checks while building.
- **Jest + Supertest**, used for both the per-slice unit tests (NestJS ships with Jest
  configured by default) and the real-database e2e suite built in Phase 11 (224 tests total:
  207 unit + 17 e2e). The frontend's own equivalent - Vitest + React Testing Library for
  component tests, Playwright for browser e2e - was a separate Phase 11 decision; see D-035.

## Deployment target

**Changed from the original plan.** A self-managed VPS was the working assumption through
most of the project, but Phase 15 actually deployed to managed free-tier platforms instead -
**Vercel** (frontend), **Render** (backend), **Neon** (Postgres) - after checking each
provider's actual current terms rather than assuming. No server to patch or provision, and
genuinely free for a project at this scale (see decision-log.md D-034 for the full reasoning,
including why Railway and Render's own free Postgres were ruled out). Live at
https://playops-sports.vercel.app.

---

## What's set up now vs. deferred to Phase 7/8

Phase 6 sets up genuinely shared infrastructure only — not framework-specific scaffolding
that belongs to a later phase's own deliverables:

- `docker-compose.yml` (this commit) — Postgres for local dev
- Everything else — `nest new`, `npx prisma init`, `npx create-next-app` — is Phase 7's
  ("Server," "Database connection," "Database migrations") and Phase 8's own first work,
  not pre-empted here.
