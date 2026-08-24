# Technologies Under Consideration

**Nothing here is decided.** This is the option space Phase 6 will choose from, once
requirements, data model, and architecture (Phases 1–5) make the right choice obvious rather
than assumed upfront.

## Frontend
- React
- Plain HTML/CSS/JS (fewer moving parts, viable if the team prefers less tooling)

## Backend
- Node.js + Express
- Node.js + NestJS (more structure out of the box, more to learn)

## Database
- PostgreSQL — strong candidate given the relational integrity needs already visible in the
  project brief (e.g. preventing double-booked venues), but not locked in

## Database access layer
- Plain SQL driver + hand-written versioned migrations
- An ORM (e.g. Prisma, Knex)
- Note: an earlier prototype hit friction with Prisma's tooling needing to fetch engine
  binaries from an external source in one specific sandboxed environment. That's a data point
  about *that* environment, not a finding about Prisma itself — worth re-testing in the team's
  actual dev environment before it affects this decision either way.

## Hosting / deployment
- Self-managed VPS
- Managed platform (evaluate against any constraints the course sets, separately from this
  document, once Phase 15 is reached)

## Testing tools
- Depends entirely on the backend/frontend choice above — not evaluated yet
