# PlayOps

Smart Campus Sports & Tournament Management System — a college-specific sports operations
platform, not a generic tournament manager.

This project is developed over a full semester using a strict phase-by-phase process. We do
not skip phases, and we do not build the whole application at once. See
`docs/decision-log.md` for why, and `docs/PROCESS.md` for the phase list itself.

## Current status

**Phase 0 — Project Setup.** No application code exists yet, intentionally. Requirements
(Phase 1), roles/permissions (Phase 2), workflows (Phase 3), data model (Phase 4),
architecture (Phase 5), and tech stack (Phase 6) all come before any implementation.

## Structure

```
docs/       All project documentation - decisions, requirements, architecture, etc.
frontend/   Empty until Phase 8 (Next.js + React + TypeScript)
backend/    Empty until Phase 7 (NestJS + TypeScript + Prisma)
tests/      Empty until the first vertical slice reaches Phase 9/11
docker-compose.yml   Local Postgres - run `docker compose up -d` before Phase 7 starts
```

## Start here

- `docs/PROCESS.md` — the phase list and how we work through each one
- `docs/decision-log.md` — every significant decision, with reasoning
- `docs/open-questions.md` — unresolved items, kept visible rather than silently assumed
- `docs/assumptions.md` — what we're taking as given, and why
- `docs/technologies-under-consideration.md` — options only; nothing is decided until Phase 6
- `docs/conventions.md` — branch naming, commit format, and PR process
