/**
 * The Stage A mock API (architecture-plan §3.11; docs/technical/07-api.md §11; DD-50).
 *
 * `createMockApp()` builds a Hono app with the same `/api/v1` surface and the same middleware semantics as the real
 * API (see `middleware/chain.ts` for the order), mounts the routes of every handler module (the static list of
 * `handler-modules.ts`, or modules passed explicitly by tests), and serves `GET /api/v1/health`. The same app runs in
 * the browser prototype (`browser.ts`) and in Node tests, so it uses no Node or server modules.
 *
 * Handlers are pure functions over static fixtures. NOTHING is persisted between requests: a command validates its
 * input against the contract and returns a contract-valid static response.
 *
 * Usage in a handler module (`src/mock-api/handlers/<domain>.ts`):
 *
 *   import { mockRoute } from '../app.js';
 *   import type { MockApp } from '../app.js';
 *   export function register(app: MockApp): void {
 *     mockRoute(app, listThings, ({ requireTenant, fixtures }) => fixtures.page(thingsOf(requireTenant().tenant.id)));
 *   }
 */
import { Hono } from 'hono';

import type { AppEnv } from '../contracts/session.js';
import {
  authenticate,
  dispatch,
  errorBoundary,
  notFoundBoundary,
  requestContext,
  requestLog,
  requirePermission,
  resolveRoute,
  securityHeaders,
  tenantContext,
} from './middleware/chain.js';
import { frozenStorylineNow } from './fixtures/demo-clock.js';
import type { MockEnv } from './middleware/chain.js';
import { HANDLER_MODULES } from './handler-modules.js';
import { createLogger } from './middleware/logger.js';
import type { LogLevel, LogSink } from './middleware/logger.js';
import { MockRouteCollector } from './middleware/routes.js';
import { personaTokenVerifier } from './prototype-auth.js';
import type { TokenVerifier } from './prototype-auth.js';
import { registerModules } from './registry.js';
import type { HandlerModule, RegistryFailure } from './registry.js';

export { mockRoute } from './middleware/routes.js';
export type { FixtureHelpers, MockApp, MockHandler, MockHandlerContext, MockHandlerResult } from './middleware/routes.js';
export { MockHttpError, problemType } from './middleware/problem.js';
export type { MockEnv, TokenVerifier } from './middleware/chain.js';
export { HEALTH_BODY } from './middleware/chain.js';
export type { HandlerModule, RegistryFailure } from './registry.js';

export interface CreateMockAppOptions {
  /** Token verification; defaults to the prototype persona token (`prototype-auth.ts`, DD-50). */
  readonly verifyToken?: TokenVerifier;
  /** The handler modules to mount; defaults to every module of `handlers/` (`HANDLER_MODULES`). */
  readonly modules?: readonly HandlerModule[];
  /** Modules that could not be loaded before registration (discovery in tests); reported and logged. */
  readonly moduleFailures?: readonly RegistryFailure[];
  /** Log destination (defaults to the console). */
  readonly logSink?: LogSink;
  /** Defaults to `info`. */
  readonly logLevel?: LogLevel;
  /** Reported in `/me/context` `environment.appEnv`; defaults to `local`. */
  readonly appEnv?: AppEnv;
  /**
   * Clock (tests); defaults to the frozen storyline clock: always the demo "as of" instant
   * (`fixtures/demo-clock.ts`), so handlers, `/me/context.serverTime` and the fixtures agree on "now" on any real date.
   */
  readonly now?: () => Date;
}

export interface MockApi {
  readonly app: Hono<MockEnv>;
  /** Fetch-style entry point (the browser transport and tests call it). */
  readonly fetch: (request: Request) => Promise<Response>;
  /** Loaded handler modules and the ones skipped with their reason. */
  readonly loaded: readonly string[];
  readonly failed: readonly RegistryFailure[];
  /** Ids of every mounted contract endpoint. */
  readonly endpointIds: readonly string[];
}

/** Builds the mock API. */
export function createMockApp(options: CreateMockAppOptions = {}): MockApi {
  const appEnv: AppEnv = options.appEnv ?? 'local';
  const logLevel: LogLevel = options.logLevel ?? 'info';
  const now = options.now ?? frozenStorylineNow;
  const verifyToken: TokenVerifier = options.verifyToken ?? personaTokenVerifier;

  const bootLogger = createLogger({ sink: options.logSink, level: logLevel, env: appEnv });
  const collector = new MockRouteCollector('mock-app');
  const result = registerModules(collector, options.modules ?? HANDLER_MODULES);
  const loaded = result.loaded;
  const failed = [...(options.moduleFailures ?? []), ...result.failed];
  for (const failure of failed) {
    bootLogger.error('handler module skipped', { ...failure });
  }
  bootLogger.info('handler modules loaded', { loaded, failed: failed.length });
  const records = collector.records;

  const app = new Hono<MockEnv>();
  app.use('*', securityHeaders(appEnv));
  app.use('*', requestContext({ sink: options.logSink, level: logLevel, appEnv, now }));
  app.use('*', requestLog());
  app.onError(errorBoundary);
  app.notFound(notFoundBoundary);
  app.use('/api/v1/*', resolveRoute(() => records));
  app.use('/api/v1/*', authenticate(() => verifyToken));
  app.use('/api/v1/*', tenantContext());
  app.use('/api/v1/*', requirePermission());
  app.all('/api/v1/*', dispatch(appEnv));

  return {
    app,
    fetch: async (request) => app.fetch(request),
    loaded,
    failed,
    endpointIds: records.map((record) => record.endpoint.id),
  };
}
