# Roles & Permissions

## Design principle: scoped capabilities, not a hierarchy

PlayOps deliberately has no "higher role inherits lower role's powers" structure. A Caretaker
doesn't gain a Secretary's tournament-management powers by being "above" them — they have a
completely separate, narrow capability (appoint/replace the Secretary, approve hostel
changes). Sports Department doesn't sit above Caretakers either — they operate on an entirely
different resource (venues), not on tournaments or hostels at all.

**Why this matters:** a hierarchy model tempts you into checks like "is this user's role ≥
Secretary?" which silently grants powers nobody explicitly decided to grant. The actual model
is: for every sensitive action, check the *specific* relationship that authorizes it (are you
*this* team's captain? *this* hostel's caretaker?) — nothing is inherited from being a
"higher" role.

---

## Permission matrix, by resource

`Y` = allowed · `—` = not allowed · scope notes where relevant.

### Tournament
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View | Y | Y | Y | Y | Y |
| Create | — | — | Y (own hostel) | — | — |
| Edit | — | — | Y (own tournament) | — | — |
| Delete/Cancel | — | — | Y (own tournament) | — | — |
| Publish (open registration) | — | — | Y (own tournament) | — | — |

### Team & Registration
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View | Y | Y | Y (own hostel) | Y (own hostel, monitoring) | — |
| Create team | Y (becomes Captain) | — | — | — | — |
| Edit (add/remove players) | — | Y (own team) | — | — | — |
| Withdraw team | — | Y (own team) | — | — | — |
| Reject registration beyond auto-check | — | — | **Y — see Q-007** | — | — |

### Fixtures
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View | Y | Y | Y | Y | Y |
| Generate (automatic) | — | — | Y (own tournament) | — | — |
| Manually rearrange | — | — | Y (own tournament) | — | — |

### Venue & Equipment Booking
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View availability | Y | Y | Y | Y | Y |
| Request booking | — | — | Y | — | — |
| Approve / Reject | — | — | — | — | Y |
| Manually book (offline arrangement) | — | — | — | — | Y |

### Match Scheduling & Rescheduling
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View schedule | Y | Y | Y | Y | Y |
| Trigger disruption / request reschedule | — | — | Y | — | — |
| Approve the new slot | — | — | — | — | Y |

### Match Results
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View | Y | Y | Y | Y | Y |
| Enter result | — | — | **Y — only role that can** | — | — |

### Hostel Membership
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| Select hostel (first time) | Y (self) | — | — | — | — |
| Request a change | Y (self) | — | — | — | — |
| Approve a change request | — | — | — | Y (**current** hostel only, per D-005) | — |

### Sports Secretary Appointment
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View current Secretary | Y | Y | Y | Y | Y |
| Appoint / replace | — | — | — | Y (own hostel only) | — |

### Announcements
| Action | Student | Captain | Secretary | Caretaker | Sports Dept |
|---|---|---|---|---|---|
| View | Y (scoped to their hostel/tournaments) | Y | Y | Y | Y |
| Create / publish | — | — | Y (own hostel/tournament) | — | — |

---

## Ownership rules

- A **Team** is owned by its Captain — only they can edit its roster or withdraw it.
- A **Tournament** is owned by the Secretary who created it, scoped to their hostel — no
  other Secretary, even in another hostel, can touch it.
- A **VenueBooking** request is owned by the requesting Secretary, but the *decision* belongs
  entirely to Sports Department — ownership of the request doesn't grant approval power over
  it.
- A **Hostel's** Secretary/Caretaker assignment is controlled by that hostel's Caretaker only
  — one Caretaker cannot appoint a Secretary for a different hostel.

## What requires approval

| Action | Approved by |
|---|---|
| Hostel change | Student's *current* hostel's Caretaker |
| Venue/equipment booking | Sports Department |
| Tournament creation | **Nobody** — the Secretary's appointment is already the vetting step (business rule 7) |
| Team registration | Automatic (eligibility check) + optional Secretary rejection — see Q-007 |

## Enforcement

Every row above is a backend check, not a frontend one — a Student who can't see a "Create
Tournament" button must also get rejected if they call that endpoint directly. This was
already stated as a non-functional requirement; this matrix is what that requirement is
actually checked against, action by action.
