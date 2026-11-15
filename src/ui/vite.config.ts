/**
 * Vite + Vitest configuration for the TenderIQ SPA.
 *
 * Why it looks like this (architecture brief §7.4 and §10, architecture-plan §3.11 and §4, DD-30, DD-35, DD-50):
 * - The Stage A prototype is a static site: the mock API runs in the browser (`src/api/prototypeTransport.ts`
 *   loads `src/mock-api/browser.ts` as a lazy chunk), so there is no API server, no proxy and no environment
 *   variable to set (DD-50). The same build deploys to Vercel as static files.
 * - `@contracts/*` resolves to `src/contracts/*`: the shared, pure zod contracts compiled into the SPA
 *   (architecture-plan §3.10). The SPA never imports src/server (lint rule + scan-bundle); only the prototype
 *   transport imports src/mock-api.
 * - The Content-Security-Policy meta tag in index.html (DD-30) is filled in here, because it differs between the
 *   dev server and production builds (see `contentSecurityPolicy`).
 * - The dev server only serves files from the SPA, the contracts, the mock API and node_modules
 *   (`server.fs.allow`).
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const uiDir = fileURLToPath(new URL('.', import.meta.url));
const contractsDir = fileURLToPath(new URL('../contracts', import.meta.url));
const mockApiDir = fileURLToPath(new URL('../mock-api', import.meta.url));
const rootNodeModules = fileURLToPath(new URL('../../node_modules', import.meta.url));

/** Build-time token in index.html that this config replaces with the policy. */
const CSP_TOKEN = '__TENDERIQ_CONTENT_SECURITY_POLICY__';

/**
 * DD-30: the SPA document gets its CSP from a <meta http-equiv> tag (vercel.json has no header rules).
 * - Production builds: scripts only from the app's own origin; network only to the app itself (the prototype's
 *   API runs in the page, DD-50); fonts self-hosted (DD-35), so no font origin is allowed.
 * - Dev server: Vite's React Fast Refresh preamble is an inline module script and HMR uses a websocket,
 *   so the dev policy adds 'unsafe-inline' for scripts and ws:/wss: for connections. Nothing else differs,
 *   so an external font, script or API request is still blocked while developing.
 * Inline style attributes stay allowed ('unsafe-inline' in style-src): React and Recharts set styles at runtime.
 */
function contentSecurityPolicy(): Plugin {
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
        const policy = [
          "default-src 'self'",
          isDevServer ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          `connect-src 'self'${isDevServer ? ' ws: wss:' : ''}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return html.replace(CSP_TOKEN, policy);
      },
    },
  };
}

export default defineConfig(() => {
  return {
    root: uiDir,
    plugins: [react(), contentSecurityPolicy()],
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
      fs: { strict: true, allow: [uiDir, contractsDir, mockApiDir, rootNodeModules] },
      warmup: { clientFiles: ['./src/main.tsx'] },
    },
    preview: {
      port: 4173,
      strictPort: true,
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
