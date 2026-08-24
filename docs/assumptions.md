# Assumptions

Things being taken as given for now. If any of these turn out wrong, the decisions built on
top of them need revisiting — that's the point of listing them explicitly instead of letting
them stay implicit.

- **Single-college deployment for v1.** PlayOps targets one college with multiple hostels, not
  a multi-college platform, per the original project brief.
- **GitHub is the version control host.** Not yet created as a remote — local repo only until
  Q-002 is resolved.
- **Primarily one active developer, with occasional contributions from one teammate**, reviewed
  through pull requests rather than direct pushes to `main`.
- **Semester-length timeline.** Phases are sequential and none are skipped, which means later
  phases (deployment, polish, final demo) are expected to compress in time relative to earlier
  ones, not the other way around.
- **No access yet to the college's real hostel-allotment or student-roster data.** Whatever
  V1 relies on for hostel membership and initial Caretaker accounts will need to be
  self-declared or manually seeded, not pulled from an authoritative college system.
