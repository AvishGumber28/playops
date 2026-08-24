# Business Rules

The rules that must never be violated, regardless of which feature or code path is involved.
Every one of these should be enforced by the backend/database, not assumed from frontend
behavior.

1. **A player can only ever represent one hostel.** Not one hostel per tournament — one
   hostel, period, since that's simply where they live.
2. **A player cannot join two teams in the same tournament.**
3. **A venue slot can have at most one approved booking**, regardless of whether that booking
   came from a Secretary's request or a Sports Department manual entry — both write to the
   same table under the same constraint.
4. **Only the Sports Secretary can submit an official match result.**
5. **Only the Sports Department can approve a venue or equipment booking.**
6. **Only a Caretaker can appoint a Sports Secretary or approve a hostel change**, and only
   for their own hostel.
7. **A Sports Secretary's tournament creation requires no separate approval** — their
   appointment by the Caretaker already is the vetting step.
8. **Standings are always computed from match results, never stored redundantly.**
9. **A hostel selection is locked for a semester/year**; changing it requires approval from
   the student's **current** hostel's Caretaker (the one releasing them), not the requested
   hostel's.
10. **Equipment availability is quantity-based, not binary** — checked against the sum of
    overlapping approved bookings, not a simple taken/free flag like venues.
11. **League standings have no tie-break rule in v1** — teams with equal points are shown as
    co-ranked, not artificially ordered.
