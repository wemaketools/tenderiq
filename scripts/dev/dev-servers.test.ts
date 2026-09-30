/**
 * Guard: the development servers restart the mock API when code changes.
 *
 * Vite hot-reloads the SPA, including its copy of the API contracts, as soon as a file changes. A mock API started
 * without watch mode keeps serving the responses of the code it was started with, so the SPA's development-time
 * response validation rejects them ("does not match its API contract") until someone restarts it by hand. Both
 * ways of starting the mock API for development must therefore use `tsx watch`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

function read(path: string): string {
  return readFileSync(`${root}${path}`, 'utf8');
}

describe('development mock API server', () => {
  it('runs in watch mode under npm run dev:mock-api, so contract and mock changes are served immediately', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

    expect(scripts['dev:mock-api']).toMatch(/^tsx watch\b/);
    expect(scripts['dev:mock-api']).toContain('scripts/dev/serve-mock-api.ts');
  });

  it('runs in watch mode under npm run dev:prototype, so it never serves responses from stale code', () => {
    const launcher = read('scripts/dev/dev-prototype.mjs');
    const mockApiStart = launcher.split('\n').find((line) => line.includes("start('mock-api'"));

    expect(mockApiStart).toBeDefined();
    expect(mockApiStart).toMatch(/tsxCli,\s*'watch'/);
    expect(mockApiStart).toContain('scripts/dev/serve-mock-api.ts');
  });
});
