# API Contract (as actually built through Phase 7)

This documents what's real right now — not the planned shape from `system-architecture.md`,
the exact request/response contract of the endpoints that exist and are tested. Update this
file every time an endpoint is added or changed; Phase 8/9 frontend work builds against this.

## Global behavior (applies to every endpoint)

- Base path: every route is prefixed with `/api`
- **Validation**: unknown fields in a request body are rejected (400), not silently ignored
- **Error shape**, consistent across all failures:
  ```json
  {
    "statusCode": 400,
    "path": "/api/auth/signup",
    "timestamp": "2026-08-30T12:00:00.000Z",
    "message": "Only @yourcollege.edu email addresses can register."
  }
  ```
- CORS is restricted to whatever `ALLOWED_ORIGIN` is set to in `.env`

## GET /api/health

No auth required.

- 200 → `{ "status": "ok", "service": "playops-backend" }`

## POST /api/auth/signup

Request:
```json
{ "name": "Riya", "email": "riya@yourcollege.edu", "password": "at-least-8-chars" }
```

- 201 → `{ "user": { "id": "...", "email": "...", "name": "..." } }`
- 400 → email domain doesn't match `COLLEGE_EMAIL_DOMAIN`, or a field fails validation
  (missing name, invalid email format, password under 8 characters)
- 409 → email already registered

## POST /api/auth/login

Request:
```json
{ "email": "riya@yourcollege.edu", "password": "..." }
```

- 200 → `{ "token": "<jwt>" }`
- 401 → wrong email or password (deliberately the same error either way, so a failed login
  doesn't reveal whether an email is registered)

**Not built yet:** `GET /api/me` (role resolution) doesn't exist yet in this NestJS backend —
it existed in the earlier pre-phase-process scaffold, but hasn't been rebuilt here. This is
worth prioritizing early in Phase 9, since the frontend's dashboard-routing logic depends on
it exactly the same way it did before.
