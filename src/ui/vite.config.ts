/**
 * Vite + Vitest configuration for the TenderIQ SPA.
 *
 * Why it looks like this (architecture brief §7.4 and §10, architecture-plan §3.11 and §4, DD-30, DD-35, DD-43):
 * - `envDir` is the REPOSITORY ROOT, so the SPA reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from the
 *   root `.env.local`. Those two are the only browser-safe variables (brief §8.1).
 * - `/api` is proxied to the API runner. The owner runs it on 127.0.0.1:3001 (the mock API in Stage A, the real
 *   API in Stage B). Agents and Playwright point `VITE_API_PROXY_TARGET` at their own mock API port, so the browser
 *   always sees one origin and the SPA calls relative `/api/v1/...` URLs without CORS.
 * - `@contracts/*` resolves to `src/contracts/*`: the shared, pure zod contracts compiled into the SPA
 *   (architecture-plan §3.10). The SPA never imports src/server or src/mock-api (lint rule + scan-bundle).
 * - The Content-Security-Policy meta tag in index.html (DD-30) is filled in here, because it names the Supabase
 *   URL for auth and differs between the dev server and production builds (see `contentSecurityPolicy`).
 * - The dev server only serves files from the SPA, the contracts and node_modules (`server.fs.allow`).
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const uiDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const contractsDir = fileURLToPath(new URL('../contracts', import.meta.url));
const rootNodeModules = fileURLToPath(new URL('../../node_modules', import.meta.url));

/** The owner's API runner (plan §3.11). Agents override it with VITE_API_PROXY_TARGET. */
const DEFAULT_API_TARGET = 'http://127.0.0.1:3001';

/** Build-time token in index.html that this config replaces with the policy. */
const CSP_TOKEN = '__TENDERIQ_CONTENT_SECURITY_POLICY__';

function originOf(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Start the local Supabase stack (npm run supabase:start) and write the root .env.local ` +
        '(see docs/local-development.md), or set it in the environment for deployed builds.',
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL, got "${value}".`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute http(s) URL, got "${value}".`);
  }
  return url.origin;
}

/**
 * DD-30: the SPA document gets its CSP from a <meta http-equiv> tag (vercel.json has no header rules).
 * - Production builds: scripts only from the app's own origin; network only to the app and Supabase Auth;
 *   fonts self-hosted (DD-35), so no font origin is allowed.
 * - Dev server: Vite's React Fast Refresh preamble is an inline module script and HMR uses a websocket,
 *   so the dev policy adds 'unsafe-inline' for scripts and ws:/wss: for connections. Nothing else differs,
 *   so an external font, script or API request is still blocked while developing.
 * Inline style attributes stay allowed ('unsafe-inline' in style-src): React and Recharts set styles at runtime.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  let isDevServer = false;
  return {
    name: 'tenderiq:content-security-policy',
    configResolved(config) {
      isDevServer = config.command === 'serve';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(CSP_TOKEN)) {
          throw new Error(
            `index.html must keep the Content-Security-Policy meta tag with content="${CSP_TOKEN}" (DD-30).`,
          );
        }
        const supabaseOrigin = originOf('VITE_SUPABASE_URL', supabaseUrl);
        const policy = [
          "default-src 'self'",
          isDevServer ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          `connect-src 'self' ${supabaseOrigin}${isDevServer ? ' ws: wss:' : ''}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return html.replace(CSP_TOKEN, policy);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, 'VITE_');
  const apiTarget = originOf(
    'VITE_API_PROXY_TARGET',
    env.VITE_API_PROXY_TARGET ?? DEFAULT_API_TARGET,
  );
  const apiProxy = {
    '/api': { target: apiTarget, changeOrigin: false, xfwd: true },
  };

  return {
    root: uiDir,
    envDir: repoRoot,
    plugins: [react(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: { '@contracts': contractsDir },
    },
    // Crawl every source module at startup so dependencies reached only through lazy routes are
    // pre-bundled up front. Otherwise the dev server re-optimizes and reloads the page mid-session,
    // which breaks Playwright runs and screenshots.
    optimizeDeps: {
      entries: ['index.html', 'src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/test/**'],
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: apiProxy,
      fs: { strict: true, allow: [uiDir, contractsDir, rootNodeModules] },
      warmup: { clientFiles: ['./src/main.tsx'] },
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy: apiProxy,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /[\\/]node_modules[\\/](react|react-dom|react-is|scheduler|react-router)[\\/]/,
                priority: 40,
              },
              {
                name: 'vendor-state',
                test: /[\\/]node_modules[\\/](@reduxjs|react-redux|redux|immer|reselect|redux-thunk)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-charts',
                test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|eventemitter3|es-toolkit)[\\/]/,
                priority: 20,
              },
              {
                name: 'vendor-supabase',
                test: /[\\/]node_modules[\\/]@supabase[\\/]/,
                priority: 20,
              },
              { name: 'vendor-zod', test: /[\\/]node_modules[\\/]zod[\\/]/, priority: 20 },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      testTimeout: 15_000,
    },
  };
});
