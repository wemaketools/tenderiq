/**
 * The Stage A mock API (architecture-plan §3.11; docs/technical/07-api.md §11; DD-43).
 *
 * `createMockApp()` builds a Hono app with the same `/api/v1` surface and the same middleware semantics as the real
 * API (see `middleware/chain.ts` for the order), mounts the routes of every handler module (auto-discovered by
 * `registry.ts`, or passed explicitly by tests), and serves `GET /api/v1/health`.
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

import { verifyAccessToken } from '../server/lib/auth/verify.js';
import { tryGetConfig } from '../server/lib/config/index.js';
import type { AppEnvValue, LogLevel } from '../server/lib/config/index.js';
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
import { storylineNow } from './fixtures/demo-clock.js';
import type { MockEnv, TokenVerifier } from './middleware/chain.js';
import { createLogger } from './middleware/logger.js';
import type { LogSink } from './middleware/logger.js';
import { MockRouteCollector } from './middleware/routes.js';
import { loadHandlerModules, registerModules } from './registry.js';
import type { HandlerModule, RegistryFailure } from './registry.js';

export { mockRoute } from './middleware/routes.js';
export type { FixtureHelpers, MockApp, MockHandler, MockHandlerContext, MockHandlerResult } from './middleware/routes.js';
export { MockHttpError, problemType } from './middleware/problem.js';
export type { MockEnv, TokenVerifier } from './middleware/chain.js';
export { HEALTH_BODY } from './middleware/chain.js';
export type { HandlerModule, RegistryFailure } from './registry.js';

export interface CreateMockAppOptions {
  /** Token verification; defaults to the real `verifyAccessToken` (lib/auth/verify.ts, process config). */
  readonly verifyToken?: TokenVerifier;
  /** Explicit handler modules (tests). When omitted, `handlers/` is auto-discovered. */
  readonly modules?: readonly HandlerModule[];
  /** Directory to discover when `modules` is omitted (defaults to `src/mock-api/handlers`). */
  readonly handlersDir?: string;
  /** Log destination (defaults to stdout). */
  readonly logSink?: LogSink;
  readonly logLevel?: LogLevel;
  /** Reported in `/me/context` `environment.appEnv`; defaults to the configured `APP_ENV`. */
  readonly appEnv?: AppEnvValue;
  /**
   * Clock (tests); defaults to the storyline clock: the system clock, never earlier than the demo "as of"
   * (`fixtures/demo-clock.ts`), so handlers, `/me/context.serverTime` and the fixtures agree on "now".
   */
  readonly now?: () => Date;
}

export interface MockApi {
  readonly app: Hono<MockEnv>;
  /** Fetch-style entry point (the node:http bridge and tests call it). */
  readonly fetch: (request: Request) => Promise<Response>;
  /** Loaded handler modules and the ones skipped with their reason. */
  readonly loaded: readonly string[];
  readonly failed: readonly RegistryFailure[];
  /** Ids of every mounted contract endpoint. */
  readonly endpointIds: readonly string[];
}

/** Builds the mock API. */
export async function createMockApp(options: CreateMockAppOptions = {}): Promise<MockApi> {
  const configured = tryGetConfig();
  const appEnv: AppEnvValue = options.appEnv ?? (configured.ok ? configured.config.appEnv : 'local');
  const logLevel: LogLevel = options.logLevel ?? (configured.ok ? configured.config.logLevel : 'info');
  const now = options.now ?? (() => storylineNow(new Date()));
  const verifyToken: TokenVerifier = options.verifyToken ?? verifyAccessToken;

  const bootLogger = createLogger({ sink: options.logSink, level: logLevel, env: appEnv });
  const collector = new MockRouteCollector('mock-app');
  let loaded: string[];
  let failed: RegistryFailure[];
  if (options.modules !== undefined) {
    const result = registerModules(collector, options.modules);
    loaded = result.loaded;
    failed = result.failed;
    for (const failure of failed) {
      bootLogger.error('handler module skipped', { ...failure });
    }
  } else {
    const result = await loadHandlerModules(collector, {
      logger: bootLogger,
      ...(options.handlersDir === undefined ? {} : { dir: options.handlersDir }),
    });
    loaded = result.loaded;
    failed = result.failed;
  }
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
