# tests

Intentionally empty, and stays that way — this placeholder predates the actual implementation
choice. Tests ended up living alongside each app instead, matching each one's own tooling:

- `backend/src/**/*.spec.ts` — per-module unit tests (Jest)
- `backend/test/*.e2e-spec.ts` — real-database integration tests (Jest + Supertest)
- `frontend/**/*.test.ts(x)` — component/unit tests (Vitest + React Testing Library)
- `frontend/e2e/*.spec.ts` — browser end-to-end tests (Playwright)

See `docs/decision-log.md` D-035 for why.
