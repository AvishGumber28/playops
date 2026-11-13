import { execSync } from 'child_process';
import path from 'path';

// Playwright drives the real frontend against the real backend, which in
// turn needs the same playops_test Postgres database the backend's own
// Jest e2e suite uses (backend/.env.test) - never the dev database.
// Unlike that suite (which seeds exactly what each test needs via
// backend/test/helpers/db.ts), this runs outside the backend package, so
// there's no Prisma client to call directly. Reusing backend/prisma/
// seed.ts's idempotent upserts (hostels, sports, venues, dummy Caretaker
// accounts) gives the same starting data a human tester would have,
// without duplicating that seed data here.
const BACKEND_DIR = path.resolve(__dirname, '../../backend');
const TEST_DATABASE_URL = 'postgresql://postgres:devpassword@localhost:5432/playops_test';

export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };

  // A single literal command string (no interpolated arguments) - avoids
  // execFile's shell:true + argv-array combination Node now warns about
  // (DEP0190), which exists for commands built from untrusted input. Not
  // the case here, but there's no reason to carry the warning either.
  execSync('npx prisma migrate deploy', { cwd: BACKEND_DIR, env, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd: BACKEND_DIR, env, stdio: 'inherit' });
}
