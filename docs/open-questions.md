# Open Questions

Anything unresolved that could affect the project goes here, not silently assumed. Each entry
gets closed out with a resolution and a pointer to the decision log entry that settled it.

| # | Question | Raised at | Status |
|---|---|---|---|
| Q-001 | Should any part of the earlier prototype (schema design, auth approach) be reused once Phase 6/7 are reached, even if written fresh? Or should the new implementation be developed independently and only compared afterward? | Phase 0 | Open |
| Q-002 | Repository needs an actual GitHub remote created and pushed — who does this and when are collaborators added? | Phase 0 | Resolved — repo created and pushed by the team; see commit history |
| Q-003 | Testing framework/tooling for `tests/` isn't chosen yet — depends on the Phase 6 stack decision. | Phase 0 | Open — blocked on Phase 6 |
| Q-004 | Which Caretaker approves a hostel change request — the student's current hostel, the requested one, or both? | Phase 1 | Resolved — see D-005 |
| Q-005 | What are the tie-breaking rules for league standings when points are equal? | Phase 1 | Resolved — see D-005 |
| Q-006 | Does replacing a Sports Secretary need any process beyond the Caretaker picking someone new, or should the previous appointment be recorded rather than silently overwritten? | Phase 1 | Resolved — see D-005 |
| Q-007 | Does team registration need manual Secretary review/rejection on top of the automated hostel-eligibility check, or does passing that check mean the team is automatically registered? | Phase 2 | Open — defaulted to "yes, Secretary can still reject" in `roles-permissions.md`, pending confirmation |

Requirements-level open questions (eligibility edge cases, scoring rules, etc.) belong in
Phase 1's requirements documents once that phase starts, not here — this file is for
project-setup-level questions only, to avoid it becoming a dumping ground.
