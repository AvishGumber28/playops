import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Phase 11: a thin end-to-end layer on top of the component tests
// (vitest.config.ts) and the backend's own real-database e2e suite
// (backend/test/*.e2e-spec.ts). This is the one layer that drives the
// actual Next.js frontend in a real browser against the actual NestJS
// backend - catching wiring bugs (a form field never wired to state, a
// button that never re-enables, a route that doesn't redirect) that
// neither of those other two layers can see.
const BACKEND_DIR = path.resolve(__dirname, '../backend');

export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  fullyParallel: false,
  workers: 1, // every spec shares one real test database
  retries: 0,
  reporter: 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run start:dev',
      cwd: BACKEND_DIR,
      env: { NODE_ENV: 'test' },
      url: 'http://localhost:4000/api/hostels',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
