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
