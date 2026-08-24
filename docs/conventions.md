# Development Conventions

## Branching
- `main` is always in a working state.
- Work happens on branches: `phase-N/short-description` during setup/design phases (e.g.
  `phase-1/requirements`), `feature/short-description` once implementation starts, `fix/...`
  for bug fixes.
- Once a collaborator has push access, `main` requires a pull request — no direct pushes.

## Commit messages
Format: `type(scope): message`

```
feat(auth): add authentication
feat(tournament): add tournament creation
feat(venue): add booking workflow
feat(schedule): add conflict detection
fix(booking): prevent overlapping reservations
docs(phase-1): add functional requirements
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Documentation
- Every phase's deliverables live under `docs/`.
- `decision-log.md` is updated *before* implementing anything it covers, not after.
- `open-questions.md` entries get closed with a resolution and a link to the decision that
  settled them — never just deleted.

## Environment variables
- Real `.env` files are never committed — only `.env.example` templates, once a stack exists
  to need them (Phase 6+).
- Each environment (local dev, test, production) gets its own values; nothing is shared
  across environments.
- This gets a fuller treatment once Phase 6/7 make it concrete — this note exists so the
  principle isn't forgotten before then.

## Code style
Not defined yet — depends on the Phase 6 stack decision (e.g. ESLint/Prettier if JavaScript).
