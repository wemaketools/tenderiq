/**
 * Playwright configuration (architecture brief §11, architecture-plan §8, technical docs 11-testing-strategy §8).
 *
 * Project "prototype" (Stage A): the SPA on the Vite dev server against the static-data mock API, signing in
 * with REAL Supabase Auth (DD-43). Playwright starts both servers itself, on the prototype ports
 * (PROTOTYPE_API_PORT, default 4180; PROTOTYPE_WEB_PORT, default 5280), so a run never collides with the
 * owner's `npm run dev:prototype` on 3001/5173 or with an agent's own port pair.
 *
 * Prerequisites: Docker running, the local Supabase stack started (`npm run supabase:start`), the root
 * `.env.local` written, and the demo accounts created (`npm run auth:personas`).
 *
 * Run from the repository root: `npm run test:e2e:prototype`
 * (= `playwright test -c e2e_tests/playwright.config.ts --project prototype`).
 *
 * The "smoke" and "full" projects (login/logout/shell and full journeys against the REAL API, started with
 * `npm run dev`) belong to Stage B: its scaffold step adds them together with their web servers
 * (architecture-plan §5, Stage B, B1 scaffold-b).
 *
 * Servers are never reused: a stale server on a prototype port fails the run loudly instead of silently
 * serving old code. Set a different port pair through the two variables when one is busy.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const uiDir = fileURLToPath(new URL('../src/ui', import.meta.url));

function portFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be a TCP port between 1024 and 65535, got "${raw}".`);
  }
  return value;
}

const apiPort = portFromEnv('PROTOTYPE_API_PORT', 4180);
const webPort = portFromEnv('PROTOTYPE_WEB_PORT', 5280);
if (apiPort === webPort) {
  throw new Error('PROTOTYPE_API_PORT and PROTOTYPE_WEB_PORT must differ.');
}

const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const isCI = Boolean(process.env.CI);

/** The storyline "as of" of the fixtures: the mock API clock (and so the SPA's) starts here, whatever the real date. */
const PROTOTYPE_NOW = '2026-10-06T08:00:00Z';

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  ...(isCI ? { workers: 2 } : {}),
  reporter: isCI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'prototype',
      testDir: './specs/prototype',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: webOrigin,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      name: 'mock-api',
      command: `npx tsx --env-file-if-exists=.env.local scripts/dev/serve-mock-api.ts --port ${apiPort} --now ${PROTOTYPE_NOW}`,
      cwd: repoRoot,
      url: `${apiOrigin}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'vite',
      command: `npx vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      cwd: uiDir,
      url: webOrigin,
      env: { VITE_API_PROXY_TARGET: apiOrigin },
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
