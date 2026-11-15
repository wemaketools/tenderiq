// @ts-check
/**
 * SPA ESLint flat config (architecture brief §4.2 and §10): typescript-eslint, react-hooks (the upstream
 * flat `recommended` preset, including the React Compiler correctness rules), react-refresh and Prettier
 * compatibility. `npm run lint` also runs `prettier --check`, and warnings fail the lint (`--max-warnings 0`).
 *
 * Boundaries enforced here:
 * - The SPA never imports backend code (src/server). It talks to the API only through src/api/client.ts and the
 *   shared contracts (`@contracts/*`).
 * - Only src/api/prototypeTransport.ts imports the mock API (src/mock-api): in the Stage A static prototype the
 *   API runs in the browser (DD-50).
 * - `@supabase/supabase-js` is not imported at all in Stage A (DD-50); Stage B brings the auth-only client back
 *   under src/auth/**.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const SERVER_BOUNDARY = {
  group: ['**/server', '**/server/**'],
  message:
    'The SPA never imports backend code. Call the API through src/api/client.ts and import shared types from @contracts/*.',
};
const MOCK_API_BOUNDARY = {
  group: ['**/mock-api', '**/mock-api/**'],
  message:
    'Only src/api/prototypeTransport.ts reaches the mock API (DD-50). Call the API through src/api/client.ts.',
};
const NO_SUPABASE = {
  name: '@supabase/supabase-js',
  message:
    'The Stage A prototype has no Supabase (DD-50). Sign-in is the persona picker in src/auth; data goes through src/api/client.ts.',
};

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', 'public/']),
  {
    name: 'tenderiq-ui/base',
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
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
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [NO_SUPABASE], patterns: [SERVER_BOUNDARY, MOCK_API_BOUNDARY] },
      ],
    },
  },
  {
    name: 'tenderiq-ui/prototype-transport',
    files: ['src/api/prototypeTransport.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [NO_SUPABASE], patterns: [SERVER_BOUNDARY] },
      ],
    },
  },
  {
    name: 'tenderiq-ui/non-component-modules',
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'src/main.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    name: 'tenderiq-ui/tooling',
    files: ['vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
]);
