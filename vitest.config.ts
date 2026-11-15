/**
 * Root Vitest configuration (architecture brief §11, technical docs 11-testing-strategy §3).
 *
 * Two projects:
 * - `unit`: pure tests in a node environment: src/server/tests/unit, contract tests, mock API tests and
 *   script tests. They need no Docker: the Stage A prototype has no Supabase (DD-50), so the one test that
 *   verifies tokens against the local Supabase stack (`LOCAL_STACK_TESTS`) is left out until Stage B.
 * - `integration`: Stage B tests against the real local Supabase stack, serial, with 180 s timeouts.
 *
 * Environment: tests see the values of the git-ignored `.env.local` in process.env, mirroring the
 * `tsx --env-file-if-exists=.env.local` convention of the npm scripts. Code under test still reads them
 * only through src/server/lib/config (brief §5.4).
 *
 * Stage transition without editing this file:
 * - `passWithNoTests` is a root-only Vitest option. It is on only while src/server/tests/integration does
 *   not exist (Stage A), so `vitest run --project integration` succeeds before Stage B writes the suite.
 * - The integration `globalSetup` (cleans leftovers such as orphaned test tenants, brief §11) is loaded
 *   from src/server/tests/helpers/global-setup.ts as soon as Stage B creates that file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { configDefaults, defineConfig } from 'vitest/config';

const fromRoot = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

const envFile = fromRoot('./.env.local');
const localEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};

const integrationSuite = fromRoot('./src/server/tests/integration');

/** Tests that need the local Supabase stack in Docker; Stage B brings them back (DD-50). */
const LOCAL_STACK_TESTS = ['src/server/tests/unit/platform-auth/verify.local-stack.test.ts'];
const integrationGlobalSetup = fromRoot('./src/server/tests/helpers/global-setup.ts');

export default defineConfig({
  test: {
    env: localEnv,
    passWithNoTests: !existsSync(integrationSuite),
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/server/tests/unit/**/*.test.ts',
            'src/contracts/**/*.test.ts',
            'src/mock-api/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
          exclude: [...configDefaults.exclude, ...LOCAL_STACK_TESTS],
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/server/tests/integration/**/*.test.ts'],
          testTimeout: 180_000,
          hookTimeout: 180_000,
          fileParallelism: false,
          globalSetup: existsSync(integrationGlobalSetup) ? [integrationGlobalSetup] : [],
        },
      },
    ],
  },
});
