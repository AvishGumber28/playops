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

**Caveat, stated plainly:** Prisma's tooling failed to fetch its engine binaries in my
testing sandbox — that environment's network access is deliberately restricted to a small
allow-list of domains, and Prisma's binary CDN wasn't on it. That's a constraint of *my*
sandbox, not a finding about Prisma itself, and shouldn't happen on a normal development
machine with regular internet access. **Recommended first step of Phase 7, before writing any
real logic:** run `npx prisma init` and `npx prisma migrate dev` once, standalone, to confirm
it works cleanly in your actual environment. If it somehow doesn't, the plain-`pg` +
hand-written-SQL-migrations approach from the earlier scaffold is a proven fallback, already
built and tested end-to-end — not a hypothetical one.

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
- **Jest + Supertest** reserved for the real automated suite in Phase 11 — NestJS ships with
  Jest configured by default, so this needs no extra setup when Phase 7 starts.

## Deployment target

Self-managed VPS, confirmed earlier in the project. Full specifics belong to Phase 15.

---

## What's set up now vs. deferred to Phase 7/8

Phase 6 sets up genuinely shared infrastructure only — not framework-specific scaffolding
that belongs to a later phase's own deliverables:

- `docker-compose.yml` (this commit) — Postgres for local dev
- Everything else — `nest new`, `npx prisma init`, `npx create-next-app` — is Phase 7's
  ("Server," "Database connection," "Database migrations") and Phase 8's own first work,
  not pre-empted here.
