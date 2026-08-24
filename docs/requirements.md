# Requirements (Phase 1)

- `functional-requirements.md` — every Must Have feature, fully specified (who, what, data,
  errors, edge cases, permissions, business rules, storage)
- `non-functional-requirements.md` — performance, security, reliability, usability,
  maintainability
- `business-rules.md` — the hard invariants that must never be violated, extracted separately
  since they cut across multiple features

## MoSCoW classification

| Tier | Scope |
|---|---|
| **Must Have** | User/role management (FR-001, FR-002) · Hostel & eligibility (FR-003) · Sports Secretary appointment (FR-004) · Tournament creation (FR-005) · Team/player registration (FR-006) · Automatic fixture generation (FR-007) · Venue & equipment booking (FR-008) · Conflict detection + rescheduling (FR-009) · Post-match scorecards (FR-010) · Standings (FR-011) · Scoped announcements/notifications (FR-012) |
| **Should Have** | Manual drag-and-drop fixture builder (part of FR-007) · Additional conflict constraint types beyond venue clashes — rest time, academic clashes (extends FR-009) |
| **Could Have** | Result dispute/correction path — no evidence it's needed; never happened historically |
| **Future Scope** | Inter-hostel and college-level tournaments · remaining sports (Volleyball, Badminton, Table Tennis, Chess, Athletics) · full live ball-by-ball scoring · multi-college support · Venue Utilization Intelligence · Hostel Sports Performance Index |

## The five candidate innovative features, evaluated explicitly

1. **Tournament Conflict Detector** — **Must Have.** No cold-start problem; works from a
   single tournament's own data from day one, and targets the real, confirmed pain point
   (venue double-booking), not a hypothetical one.
2. **Smart Rescheduling** — **Must Have**, merged into the same engine as #1 rather than
   built separately — detection and resolution are two halves of one problem.
3. **Player Eligibility & Duplicate Detection** — **Must Have**, but scoped down from an
   "engine" to a single business rule (one hostel per player, checked at registration) — that
   turned out to be the entire requirement.
4. **Venue Utilization Intelligence** — **Future Scope.** Needs accumulated booking history
   to produce anything meaningful; there is none yet.
5. **Hostel Sports Performance Index** — **Future Scope.** Same cold-start problem — a
   cross-tournament ranking needs multiple completed tournaments behind it first.

## New open questions surfaced while writing this phase

Writing out every feature in full detail surfaced three genuine gaps that weren't resolved in
earlier discussion. Added to `open-questions.md` rather than silently assumed:

- **Q-004** — which Caretaker approves a hostel change request: the student's current hostel,
  the requested one, or both?
- **Q-005** — what are the tie-breaking rules for league standings when points are equal?
- **Q-006** — does replacing a Sports Secretary need any process beyond the Caretaker simply
  picking someone new, or should the previous appointment be recorded rather than overwritten?
