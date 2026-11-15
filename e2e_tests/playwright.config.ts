/**
 * Playwright configuration (architecture brief §11, architecture-plan §8, technical docs 11-testing-strategy §8).
 *
 * Project "prototype" (Stage A): the static SPA on the Vite dev server, with the static-data mock API running in
 * the page and sign-in through the persona picker (DD-50). Playwright starts Vite itself on the prototype port
 * (PROTOTYPE_WEB_PORT, default 5280), so a run never collides with the owner's `npm run dev:prototype` on 5173 or
 * with an agent's own port. Nothing else is needed: no Docker, no environment file.
 *
 * Run from the repository root: `npm run test:e2e:prototype`
 * (= `playwright test -c e2e_tests/playwright.config.ts --project prototype`).
 *
 * The "smoke" and "full" projects (login/logout/shell and full journeys against the REAL API, started with
 * `npm run dev`) belong to Stage B: its scaffold step adds them together with their web servers
 * (architecture-plan §5, Stage B, B1 scaffold-b).
 *
 * The server is never reused: a stale server on the prototype port fails the run loudly instead of silently
 * serving old code. Set a different port through the variable when it is busy.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

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

const webPort = portFromEnv('PROTOTYPE_WEB_PORT', 5280);

const webOrigin = `http://127.0.0.1:${webPort}`;
const isCI = Boolean(process.env.CI);

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
      name: 'vite',
      command: `npx vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      cwd: uiDir,
      url: webOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
