# Decision Log

Every entry: what was decided, why, what else was considered, and current status.
Nothing architecturally significant happens without an entry here first.

---

### D-001 — Adopt a strict phase-by-phase development process

**Date:** 2026-08-24
**Decision:** Development follows the 20-phase process in `PROCESS.md`, with a stop-and-review
gate at the end of each phase, instead of building incrementally without formal checkpoints.
**Reasoning:** For a semester-long project, reviewing requirements, roles, workflows, data
model, and architecture *before* writing code prevents rework that would otherwise surface
mid-implementation.
**Status:** Adopted.

---

### D-002 — Phase 0 starts from a clean slate

**Decision:** An earlier prototype (Postgres schema, signup/login/role-resolution backend,
React login/dashboard shell) built before this process existed is set aside as reference
material only, not carried into the repository.
**Reasoning:** That prototype was never reviewed against Requirements (Phase 1), Roles (Phase
2), Workflows (Phase 3), or Data Model (Phase 4) as this process now requires. Carrying it
forward as-is would silently skip those phases, even though the code itself worked.
**Alternatives considered:**
- Reuse the docs (architecture/work-distribution) as a starting draft for Phases 1–5 — rejected
  for now, in favor of deriving them fresh and comparing afterward.
- Reuse everything, including code — rejected as the clearest violation of "don't skip phases."
**Status:** Adopted. The old scaffold still exists outside this repository and may be revisited
once the corresponding phase is reached, purely as a reference point, not as pre-approved work.

---

### D-003 — Technology stack is explicitly undecided

**Decision:** No frontend/backend/database/hosting technology is chosen at Phase 0.
**Reasoning:** Phase 6 exists specifically to make this decision, informed by the requirements,
data model, and architecture produced in Phases 1–5 — deciding earlier would put the stack
ahead of the problem it needs to solve.
**Status:** Deferred to Phase 6 (see `technologies-under-consideration.md` for the option
space, not a decision).

---

### D-004 — Phase 1 MoSCoW classification and evaluation of the five candidate features

**Decision:** Ten features classified as Must Have for v1 (see `requirements.md`), two as
Should Have, one as Could Have, and the rest — including two of the five originally-candidate
"innovative" features (Venue Utilization Intelligence, Hostel Sports Performance Index) — as
Future Scope.
**Reasoning:** Both deferred candidate features share the same limitation: they need
accumulated historical data to produce anything meaningful, and the project starts with none.
The other three candidate features (Conflict Detector, Smart Rescheduling, Eligibility) work
from day one and were folded into Must Have — the first two merged into a single engine
rather than built as separate features, since they're detection and resolution halves of the
same problem.
**Status:** Adopted, pending review per Phase 1's own stop-and-review gate.

---

### D-005 — Resolved Q-004, Q-005, Q-006

**Decisions:**
- **Q-004:** A hostel change request is approved by the student's *current* hostel's
  Caretaker — the one releasing them — not the requested hostel's.
- **Q-005:** No tie-break rule in v1. Teams with equal points in a league are shown
  co-ranked. Head-to-head is the natural first upgrade if this becomes a real problem, since
  it needs nothing beyond match results already stored — unlike a sport-specific stat (e.g.
  goal difference), which would need more granular scoring data than some scorecard
  templates currently capture.
- **Q-006:** No appointment history is kept when a Caretaker replaces a Sports Secretary —
  matches the existing single-field schema design and the project's own "don't
  over-engineer" principle.

**Reasoning:** Q-004 and Q-006 were explicit team decisions. Q-005 had no strong preference
either way — resolved here with stated reasoning rather than left open indefinitely, per the
process's own rule against silently deferring decisions.

**Status:** Adopted.

---

### D-006 — Authorization model is scoped capabilities, not a role hierarchy

**Decision:** No role "inherits" another's powers. Every sensitive action checks the specific
relationship that authorizes it (e.g. "is this user *this* team's captain?"), never a general
"role rank" comparison.
**Reasoning:** A hierarchy model risks silently granting powers nobody explicitly decided on
— e.g. a Caretaker gaining tournament-edit rights just by being "above" a Secretary in some
rank ordering. Scoped checks make every permission traceable to an explicit rule in
`roles-permissions.md`.
**Status:** Adopted.

---

### D-007 — Resolved Q-008, Q-009, Q-010

**Decisions:**
- **Q-008:** A player cannot remove themselves from a team — only the Captain can. Keeps
  roster changes under one accountable person.
- **Q-009:** A team withdrawing after fixtures/matches exist forfeits its remaining matches;
  the opposing team is awarded the win in each. The bracket is not regenerated.
**Status:** Adopted.

---

### D-008 — Phase 8: token storage, and pulling /api/me forward from Phase 9

**Decisions:**
- **Token storage:** the JWT is kept in browser `localStorage`, not an httpOnly cookie.
  Known trade-off: a successful XSS attack could read it. The cookie-based alternative is
  more secure but needs backend changes and cross-origin cookie configuration this project
  doesn't need yet — `localStorage` is standard for a project at this stage, with the
  trade-off stated rather than hidden.
- **`GET /api/me` moved from Phase 9 into Phase 8.** It was originally planned alongside the
  Hostel module, but role resolution (FR-002) was already grouped with signup/login (FR-001)
  in the same Auth & Identity module back in Phase 5 — it's the second half of
  Authentication, not Hostel feature work. Login routing someone to the correct dashboard
  can't work without it, so building it now (rather than shipping a fake/hardcoded version)
  keeps everything demonstrated honestly working end-to-end.
- **Frontend fonts:** system font stack instead of next/font/google (Geist). Not just a
  sandbox workaround — avoiding a build-time dependency on an external font CDN is a
  reasonable reliability choice on its own.

**Status:** Adopted.

---

### D-009 — Prisma 7's driver adapter requirement and generated-client location

**Decision:** `PrismaService` now constructs an explicit `@prisma/adapter-pg` driver adapter
and passes it to `PrismaClient`, instead of relying on Prisma to connect internally from
`DATABASE_URL`. The generated client also now outputs to `src/generated/prisma/client`
(gitignored, excluded from linting) instead of the default `node_modules/@prisma/client`.

**Reasoning:** Prisma 7 removed its internal connection engine entirely — `new PrismaClient()`
with no adapter now fails at startup with `PrismaClientInitializationError`. This is on top
of the datasource-URL relocation from D-008/earlier — Prisma 7 turned out to have more
breaking changes than the one already discovered, confirmed by real-world reports of teams
hitting this exact error migrating NestJS apps. The generated-client output location was
changed proactively (not from an error we hit) after finding credible reports that leaving
it in `node_modules` can cause real compilation problems specifically for NestJS — better to
fix it now than as a third surprise later.

**Status:** Adopted. `docs/technology-decisions.md`'s Prisma caveat should be treated as
understating the actual number of breaking changes — Phase 9 should budget real time for
Prisma-version friction, not assume this is now fully behind us.

---

### D-010 — Reverted D-009's custom Prisma output path back to the default

**Decision:** The generated Prisma client goes back to the default location
(`node_modules/@prisma/client`), not the custom `src/generated/prisma/client` path D-009
introduced.

**Reasoning:** D-009's custom path was based on a blog post's general advice, applied without
fully thinking through how it interacts with this project's `tsc`-based build. In practice,
`nest build` only compiles `.ts` files into `dist/` — it doesn't copy Prisma's generated
(plain `.js`) client alongside them. That broke the relative import at runtime: code compiled
into `dist/src/prisma/prisma.service.js` looked for the client relative to *its own* location
in `dist/`, but the client only ever existed in `src/`. The default `node_modules` location
doesn't have this problem, because Node resolves package-style imports (`@prisma/client`) by
searching upward through parent folders — a mechanism that works identically whether the
requiring file lives in `src/` or `dist/src/`, unlike a relative path.

**Status:** Adopted. This is exactly the kind of thing the "test before committing" discipline
this project has followed is for — the mistake was caught before it was pushed, not after.
