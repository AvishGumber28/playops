# PlayOps

Smart Campus Sports & Tournament Management System — a college-specific sports operations
platform, not a generic tournament manager. Built for intra-hostel competition: tournament
creation, team registration, fixture generation, venue/equipment booking, a conflict
detection & rescheduling engine, results & standings, and announcements/notifications — all
scoped per hostel, with role-based access for Students, Sports Secretaries, Hostel
Caretakers, and the Sports Department.

**Live:** https://playops-sports.vercel.app

Developed over a full semester using a strict phase-by-phase process — no phase is skipped,
and the whole application was never built at once. See `docs/decision-log.md` for why, and
`docs/PROCESS.md` for the phase list itself.

## Current status

All 15 build phases are complete: requirements through architecture (1–6), the full set of
12 functional requirements plus the conflict/rescheduling engine (7–10), a real-database
testing layer (11), a security pass (12), performance & data-integrity fixes (13), a
realistic demo dataset (14), and deployment (15). What's left (16–19) is documentation,
technical-contribution write-up, final polish, and demo prep — see `MILESTONE_PLAN.md` for
the phase-by-phase detail and `docs/decision-log.md` for every decision made along the way,
with reasoning.

## Structure

```
docs/       All project documentation - decisions, requirements, architecture, etc.
frontend/   Next.js + React + TypeScript (Vercel)
backend/    NestJS + TypeScript + Prisma (Render)
tests/      Empty - see tests/README.md for where tests actually live (co-located per app)
docker-compose.yml   Local Postgres for dev - `docker compose up -d`
```

## Running it locally

```bash
# 1. Start local Postgres
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env   # fill in real values
npx prisma migrate deploy
npx prisma db seed     # hostels, sports, venues, Caretaker logins
npm run start:dev      # http://localhost:4000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev             # http://localhost:3000
```

Want a fully populated demo environment (sample students, tournaments at every lifecycle
stage, bookings, announcements) instead of an empty one? Run `npm run seed:demo` from
`backend/` after the base seed - see `docs/demo-script.md` for logins and a suggested
walkthrough.

## Testing

```bash
cd backend && npm test        # unit tests
cd backend && npm run test:e2e  # real-database e2e suite (needs a playops_test DB - see .env.test)
cd frontend && npm test       # component tests (Vitest)
cd frontend && npm run test:e2e  # browser e2e (Playwright)
```

## Deployment

**Live at https://playops-sports.vercel.app.**

| Component | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://playops-sports.vercel.app |
| Backend | Render | https://playops.onrender.com |
| Database | Neon (PostgreSQL, `ap-southeast-1`) | — |

### Backend (Render)

- Root directory: `backend`
- Build command: `npm install --include=dev && npx prisma generate && npm run build`
- Start command: `npm run start:prod`
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `COLLEGE_EMAIL_DOMAIN`,
  `NODE_ENV=production`, `ALLOWED_ORIGIN` (must exactly match the live frontend URL above -
  `main.ts` refuses to boot if this is unset, by design)

The `--include=dev` in the build command isn't optional: Render applies `NODE_ENV=production`
during the build step too, which makes `npm install` silently skip `devDependencies` (where
the Nest CLI lives) unless overridden - the first of two real, previously-latent build bugs
only found once the real deployment was attempted. See `docs/decision-log.md` D-034 for the
full story, including the second one (a `tsconfig.build.json` bug that put the compiled entry
file at the wrong path).

### Frontend (Vercel)

- Root directory: `frontend`
- Framework: Next.js (auto-detected)
- Environment variable: `NEXT_PUBLIC_API_BASE=https://playops.onrender.com`

### Database (Neon)

Free tier, no expiry (Render's own free Postgres expires after 30 days, which is why the
database isn't also on Render). Migrated via `npx prisma migrate deploy`, seeded via
`npx prisma db seed` (plus `npm run seed:demo` for the realistic demo dataset - see
`docs/demo-script.md`).

### Redeploying

Both Vercel and Render auto-deploy on every push to `main`, as long as their environment
variables are already set in each platform's own dashboard (not in this repo - `.env` files
are gitignored on purpose). Trigger a manual redeploy from either platform's dashboard if a
push doesn't trigger one automatically (e.g. after only changing an environment variable).

### Why these three platforms

Chosen after checking each provider's actual current free-tier terms directly, rather than
assuming them - a platform that initially looked viable (Railway) turned out to be a 30-day
trial rather than genuinely free once checked, and Render's own free Postgres expires after
30 days. See `docs/decision-log.md` D-034 for the full comparison and reasoning, and D-035 for
the (unrelated) testing-tooling decision referenced above.

## Start here

- `docs/PROCESS.md` — the phase list and how we work through each one
- `docs/decision-log.md` — every significant decision, with reasoning (the single most
  useful file for understanding *why* the project looks the way it does)
- `docs/system-architecture.md` / `docs/database-design.md` — how it's actually built
- `docs/api-contract.md` — every endpoint, request/response shape, and auth rule
- `docs/demo-script.md` — logins and a suggested walkthrough of the live deployment
- `docs/open-questions.md` — anything ever left unresolved, tracked rather than silently
  assumed, each one closed out with a pointer to the decision that settled it
- `docs/assumptions.md` — what the project takes as given, and why
- `docs/conventions.md` — branch naming, commit format, and PR process
