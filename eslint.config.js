// @ts-check
/**
 * Backend ESLint flat config (architecture brief §4.2).
 *
 * `npm run lint` lints api/, src/server/, src/contracts/, src/mock-api/ and scripts/.
 * The SPA has its own config (src/ui/eslint.config.js). The Playwright workspace is type-checked
 * with `npm run typecheck -w @tenderiq/e2e`.
 *
 * Guards encoded here, and why:
 * - `process.env` is read ONLY by src/server/lib/config/index.ts (brief §5.4). Everything else
 *   receives typed config from getConfig()/loadConfig(). Member access, destructuring
 *   (`no-restricted-properties` covers both) and `import { env } from 'node:process'` are blocked.
 * - src/contracts is pure TypeScript + zod shared by the SPA, the mock API and the backend
 *   (architecture-plan §3.10): no Node or browser APIs, no imports other than zod and sibling
 *   contract files. Contract tests (*.test.ts) may use Node APIs.
 * - The mock API is dev/test only and never reachable from src/server or api/ (plan §11 item 1).
 */
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CONFIG_ONLY =
  'Only src/server/lib/config/index.ts may read process.env. Use getConfig()/loadConfig() from src/server/lib/config (brief §5.4).';

/** Blocks every way of reaching process.env outside the config module. */
const processEnvImportPaths = [
  { name: 'node:process', importNames: ['env'], message: CONFIG_ONLY },
  { name: 'process', importNames: ['env'], message: CONFIG_ONLY },
];

const MOCK_API_BOUNDARY = {
  group: ['**/mock-api', '**/mock-api/**'],
  message:
    'The mock API is a dev/test tool. The real backend and api/ never import it (architecture-plan §11 item 1).',
};
const SPA_BOUNDARY = {
  group: ['**/ui/src', '**/ui/src/**'],
  message: 'Backend code never imports the SPA.',
};
const CONTRACTS_PURITY = {
  regex: '^(?!zod(?:/|$)|\\.{1,2}/)',
  message:
    'src/contracts is pure: import only zod and sibling contract files (architecture-plan §3.10). No Node, browser or server modules.',
};

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    'src/ui/',
    'e2e_tests/',
    'docs/',
    'supabase/',
    '.build/',
    '.qa-scratch/',
    '.test-results/',
  ]),
  {
    name: 'tenderiq/backend',
    files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: CONFIG_ONLY }],
      'no-restricted-imports': ['error', { paths: processEnvImportPaths }],
    },
  },
  {
    name: 'tenderiq/backend-boundaries',
    files: ['src/server/**/*.ts', 'api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: processEnvImportPaths, patterns: [MOCK_API_BOUNDARY, SPA_BOUNDARY] },
      ],
    },
  },
  {
    name: 'tenderiq/contracts-purity',
    files: ['src/contracts/**/*.ts'],
    ignores: ['src/contracts/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: processEnvImportPaths, patterns: [CONTRACTS_PURITY] }],
      'no-restricted-globals': [
        'error',
        ...[
          'process',
          'Buffer',
          'require',
          '__dirname',
          '__filename',
          'window',
          'document',
          'localStorage',
          'sessionStorage',
          'navigator',
          'fetch',
          'XMLHttpRequest',
        ].map((name) => ({
          name,
          message: 'src/contracts is pure (architecture-plan §3.10): no Node or browser APIs.',
        })),
      ],
    },
  },
  {
    name: 'tenderiq/config-module',
    files: ['src/server/lib/config/index.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-imports': ['error', { patterns: [MOCK_API_BOUNDARY, SPA_BOUNDARY] }],
    },
  },
]);
