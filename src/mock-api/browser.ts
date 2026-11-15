/**
 * The browser entry of the mock API (DD-50, architecture-plan §3.11).
 *
 * In Stage A the prototype is a static site: the SPA's prototype transport (`src/ui/src/api/prototypeTransport.ts`)
 * loads this module lazily and answers every `/api/v1` request with the same Hono app the Node tests exercise. The
 * request log stays quiet (warnings and errors only, on the browser console).
 */
import type { AppEnv } from '../contracts/session.js';
import { createMockApp } from './app.js';
import type { MockApi } from './app.js';

export interface BrowserMockApiOptions {
  /** Reported in `/me/context` `environment.appEnv`: `local` on the dev server, `preview` for a deployed build. */
  readonly appEnv: AppEnv;
}

/** Builds the in-browser mock API with every handler module. */
export function createBrowserMockApi(options: BrowserMockApiOptions): MockApi {
  return createMockApp({ appEnv: options.appEnv, logLevel: 'warn' });
}
