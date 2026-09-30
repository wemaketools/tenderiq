/**
 * The mock API middleware chain, in brief §5.1 order (docs/technical/07-api.md §7.1, §11):
 *
 *   1. security headers (set after `next()`, so they survive error responses)
 *   2. request context: correlation id from `x-correlation-id` / `x-request-id` or generated, echoed on the response,
 *      request-scoped logger
 *   3. request log line (in a `finally`): method, route pattern, status, durationMs, userId, tenantId
 *   4. error boundary: `app.onError` turns every throw into problem+json (see `errorBoundary`)
 *   5. route resolution: an unknown route is a 404 BEFORE authentication (unknown routes never answer 401)
 *   6. authentication: REAL Supabase JWT verification (`src/server/lib/auth/verify.ts`), then the verified e-mail is
 *      mapped to its fixture persona; no persona or an inactive one → 401 (DD-43)
 *   7. tenant context: `X-Tenant-Id` against an active membership (or support grant), the tenant's active state and
 *      the kind the prefix requires; ONE identical 403 for every failure. `/me` reads and `/public` are exempt; a
 *      `/me` row action (`rowTenant`) must name the row's tenant.
 *   8. permission: the endpoint's declared permission against the effective set in that tenant → 403
 *   9. dispatch: parse params/query/body with the contract (422), call the handler, validate the response (500 on
 *      fixture drift)
 */
import type { Context, MiddlewareHandler } from 'hono';

import { AUDIENCE_TENANT_KIND, DEFAULT_PAGE_SIZE, paginate } from '../../contracts/common.js';
import type { AnyEndpoint } from '../../contracts/endpoint.js';
import { API_BASE, HEALTH_PATH, declaredErrorStatus, isPermitted, supportGrantAllows, tenantHeaderMode } from '../../contracts/endpoint.js';
import { extractBearerToken } from '../../server/lib/auth/verify.js';
import type { VerifyResult } from '../../server/lib/auth/verify.js';
import type { AppEnvValue } from '../../server/lib/config/index.js';
import {
  activeMemberships,
  findPersonaByEmail,
  findPersonaById,
  findTenantById,
  findTenantBySlug,
  isPersonaActive,
  organizationLabel,
  personRef,
  resolveTenantAccess,
} from '../persona.js';
import type { Persona, TenantAccess } from '../persona.js';
import type { LogSink, MockLogger } from './logger.js';
import { createLogger } from './logger.js';
import {
  INTERNAL_ERROR_PROBLEM,
  MockHttpError,
  fieldErrorsFromZod,
  forbiddenError,
  notFoundError,
  problemResponse,
  tenantAccessDeniedError,
  unauthenticatedError,
  validationError,
} from './problem.js';
import type { FixtureHelpers, MockHandlerContext, MockRouteRecord } from './routes.js';
import { findRoute } from './routes.js';
import { PLATFORM_ERRORS } from '../../contracts/common.js';

/** Hono variables of the mock app. */
export interface MockVariables {
  correlationId: string;
  logger: MockLogger;
  requestTime: Date;
  /** The resolved contract route (`null` for the built-in health check). */
  route: MockRouteRecord | null;
  rawParams: Record<string, string>;
  persona: Persona | null;
  tenant: TenantAccess | null;
}
export type MockEnv = { Variables: MockVariables };

export type TokenVerifier = (token: string | null) => Promise<VerifyResult>;

/** The body of `GET /api/v1/health`. */
export const HEALTH_BODY = { status: 'ok', version: 'v1' } as const;

/** 1. API security headers (HSTS only outside `APP_ENV=local`, brief §3.1, §14). */
export function securityHeaders(appEnv: AppEnvValue): MiddlewareHandler<MockEnv> {
  return async (c, next) => {
    await next();
    const headers = c.res.headers;
    headers.set('x-content-type-options', 'nosniff');
    headers.set('x-frame-options', 'DENY');
    headers.set('referrer-policy', 'no-referrer');
    headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    headers.set('cross-origin-resource-policy', 'same-origin');
    headers.set('cache-control', 'no-store');
    if (appEnv !== 'local') {
      headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains');
    }
  };
}

const CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** 2. Correlation id + request-scoped logger; the id is echoed on every response. */
export function requestContext(options: {
  sink: LogSink | undefined;
  level: 'debug' | 'info' | 'warn' | 'error';
  appEnv: AppEnvValue;
  now: () => Date;
}): MiddlewareHandler<MockEnv> {
  const root = createLogger({ sink: options.sink, level: options.level, env: options.appEnv });
  return async (c, next) => {
    const supplied = c.req.header('x-correlation-id') ?? c.req.header('x-request-id');
    const correlationId = supplied !== undefined && CORRELATION_ID.test(supplied) ? supplied : crypto.randomUUID();
    c.set('correlationId', correlationId);
    c.set('logger', root.child({ correlationId }));
    c.set('requestTime', options.now());
    c.set('route', null);
    c.set('rawParams', {});
    c.set('persona', null);
    c.set('tenant', null);
    await next();
    c.res.headers.set('x-correlation-id', correlationId);
    // The API clock (the storyline clock in prototype mode): the SPA runs its countdowns from it, so public pages
    // that never load /me/context agree with the fixtures too.
    c.res.headers.set('x-server-time', c.get('requestTime').toISOString().replace(/\.\d{3}Z$/, 'Z'));
  };
}

/** 3. One log line per request (never bodies, tokens or e-mails). */
export function requestLog(): MiddlewareHandler<MockEnv> {
  return async (c, next) => {
    const started = performance.now();
    try {
      await next();
    } finally {
      const route = c.get('route');
      c.get('logger').info('request', {
        method: c.req.method,
        route: route?.endpoint.path ?? (c.req.path === HEALTH_PATH ? HEALTH_PATH : 'unmatched'),
        endpointId: route?.endpoint.id ?? null,
        status: c.res.status,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        userId: c.get('persona')?.userId ?? null,
        tenantId: c.get('tenant')?.tenant.id ?? null,
      });
    }
  };
}

/** 4. The error boundary (`app.onError`): problem+json for every throw; 5xx details stay in the log. */
export function errorBoundary(error: Error, c: Context<MockEnv>): Response {
  const correlationId = c.get('correlationId') ?? crypto.randomUUID();
  if (error instanceof MockHttpError) {
    return problemResponse(error.toProblem(), correlationId, error.headers);
  }
  const logger = c.get('logger') ?? createLogger();
  logger.error('unhandled error', { name: error.name, error: error.message, stack: error.stack ?? null });
  return problemResponse(INTERNAL_ERROR_PROBLEM, correlationId);
}

/** 404 for anything that is not a route (`app.notFound`). */
export function notFoundBoundary(c: Context<MockEnv>): Response {
  const correlationId = c.get('correlationId') ?? crypto.randomUUID();
  return problemResponse(notFoundError('NOT_FOUND', 'No route matches this request.').toProblem(), correlationId);
}

/** 5. Resolves the contract route of the request; unknown → 404 before authentication. */
export function resolveRoute(records: () => readonly MockRouteRecord[]): MiddlewareHandler<MockEnv> {
  return async (c, next) => {
    const path = c.req.path;
    if (path === HEALTH_PATH && (c.req.method === 'GET' || c.req.method === 'HEAD')) {
      await next();
      return;
    }
    const found = findRoute(records(), c.req.method, path);
    if (found === null) {
      throw notFoundError('NOT_FOUND', 'No route matches this request.');
    }
    c.set('route', found.record);
    c.set('rawParams', found.rawParams);
    await next();
  };
}

/** 6. Authentication (real JWT verification + persona mapping). Public endpoints and health pass through. */
export function authenticate(verifyToken: () => TokenVerifier): MiddlewareHandler<MockEnv> {
  return async (c, next) => {
    const route = c.get('route');
    if (route === null || route.endpoint.audience === 'public') {
      await next();
      return;
    }
    const logger = c.get('logger');
    const token = extractBearerToken(c.req.header('authorization'));
    const result = await verifyToken()(token);
    if (!result.ok) {
      const level = result.reason === 'jwks_unavailable' ? 'error' : 'info';
      logger[level]('authentication rejected', { reason: result.reason, detail: result.detail });
      throw unauthenticatedError();
    }
    const persona = findPersonaByEmail(result.token.email);
    if (persona === undefined) {
      logger.info('authentication rejected', { reason: 'unknown_account', authUserId: result.token.authUserId });
      throw unauthenticatedError();
    }
    if (!isPersonaActive(persona)) {
      logger.info('authentication rejected', { reason: 'inactive_user', userId: persona.userId });
      throw unauthenticatedError();
    }
    c.set('persona', persona);
    await next();
  };
}

/** Parses `X-Tenant-Id`: digits only, or `null`. */
function tenantIdHeader(value: string | undefined): number | null {
  if (value === undefined || !/^[1-9]\d{0,15}$/.test(value.trim())) {
    return null;
  }
  const id = Number(value.trim());
  return Number.isSafeInteger(id) ? id : null;
}

/** 7. Tenant context with ONE identical 403 for every failure. */
export function tenantContext(): MiddlewareHandler<MockEnv> {
  return async (c, next) => {
    const route = c.get('route');
    const persona = c.get('persona');
    if (route === null || persona === null) {
      await next();
      return;
    }
    const mode = tenantHeaderMode(route.endpoint);
    if (mode === 'none') {
      await next();
      return;
    }
    const tenantId = tenantIdHeader(c.req.header('x-tenant-id'));
    const requiredKind = AUDIENCE_TENANT_KIND[route.endpoint.audience];
    const access =
      tenantId === null ? null : resolveTenantAccess(persona, tenantId, c.get('requestTime'), mode === 'row' ? null : requiredKind);
    if (access === null) {
      c.get('logger').info('tenant access denied', {
        userId: persona.userId,
        requestedTenantId: tenantId,
        audience: route.endpoint.audience,
      });
      throw tenantAccessDeniedError();
    }
    if (access.access === 'support_grant') {
      // Operator support access is audited BEFORE the handler runs, in the customer tenant (DD-11, ADR 0013).
      c.get('logger').info('support access', {
        userId: persona.userId,
        tenantId: access.tenant.id,
        grantId: access.supportGrant?.grantId ?? null,
        endpointId: route.endpoint.id,
      });
    }
    c.set('tenant', access);
    await next();
  };
}

/** 8. The endpoint's declared permission against the effective set in the tenant. */
export function requirePermission(): MiddlewareHandler<MockEnv> {
  return async (c, next) => {
    const route = c.get('route');
    const tenant = c.get('tenant');
    if (route === null || route.endpoint.permission === undefined) {
      await next();
      return;
    }
    // Under a support grant the endpoint must also open its support surface to the grant scope (DD-11, ADR 0013).
    const grantDenied =
      tenant !== null &&
      tenant.access === 'support_grant' &&
      (tenant.supportGrant === null || !supportGrantAllows(route.endpoint, tenant.supportGrant.scope));
    if (tenant === null || grantDenied || !isPermitted(route.endpoint, tenant.permissions)) {
      c.get('logger').info('permission denied', {
        userId: c.get('persona')?.userId ?? null,
        tenantId: tenant?.tenant.id ?? null,
        endpointId: route.endpoint.id,
      });
      throw forbiddenError();
    }
    await next();
  };
}

function queryObject(c: Context<MockEnv>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, values] of Object.entries(c.req.queries())) {
    out[key] = values.length === 1 ? (values[0] ?? '') : values;
  }
  return out;
}

async function readJsonBody(c: Context<MockEnv>): Promise<unknown> {
  const text = await c.req.text();
  if (text.trim() === '') {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw validationError([{ field: 'body', code: 'INVALID_JSON', message: 'The request body is not valid JSON.' }]);
  }
}

function fixtureHelpers(query: unknown, persona: Persona | null): FixtureHelpers {
  const pageOf = (): { page: number; pageSize: number } => {
    if (query !== null && typeof query === 'object') {
      const { page, pageSize } = query as { page?: unknown; pageSize?: unknown };
      return {
        page: typeof page === 'number' ? page : 1,
        pageSize: typeof pageSize === 'number' ? pageSize : DEFAULT_PAGE_SIZE,
      };
    }
    return { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  };
  return {
    page: (rows) => {
      const { page, pageSize } = pageOf();
      return paginate(rows, page, pageSize);
    },
    persona: findPersonaById,
    personRef,
    organizationLabel,
    tenant: findTenantById,
    tenantBySlug: findTenantBySlug,
    activeMemberships: () => (persona === null ? [] : activeMemberships(persona)),
  };
}

const PLATFORM_CODES = new Set<string>(Object.keys(PLATFORM_ERRORS));

/** 9. Parses the request with the contract, runs the handler and validates the response. */
export function dispatch(appEnv: AppEnvValue): (c: Context<MockEnv>) => Promise<Response> {
  return async (c) => {
    const route = c.get('route');
    if (route === null) {
      if (c.req.path === HEALTH_PATH) {
        return c.json(HEALTH_BODY, 200);
      }
      throw notFoundError();
    }
    const endpoint: AnyEndpoint = route.endpoint;
    const logger = c.get('logger');

    const fieldErrors = [];
    let params: unknown = undefined;
    let query: unknown = undefined;
    let body: unknown = undefined;
    if (endpoint.params !== undefined) {
      const parsed = endpoint.params.safeParse(c.get('rawParams'));
      if (parsed.success) {
        params = parsed.data;
      } else {
        fieldErrors.push(...fieldErrorsFromZod(parsed.error.issues));
      }
    }
    if (endpoint.query !== undefined) {
      const parsed = endpoint.query.safeParse(queryObject(c));
      if (parsed.success) {
        query = parsed.data;
      } else {
        fieldErrors.push(...fieldErrorsFromZod(parsed.error.issues));
      }
    }
    if (endpoint.body !== undefined) {
      const parsed = endpoint.body.safeParse(await readJsonBody(c));
      if (parsed.success) {
        body = parsed.data;
      } else {
        fieldErrors.push(...fieldErrorsFromZod(parsed.error.issues));
      }
    }
    if (fieldErrors.length > 0) {
      throw validationError(fieldErrors);
    }

    const persona = c.get('persona');
    const tenant = c.get('tenant');
    const context: MockHandlerContext<AnyEndpoint> = {
      endpoint,
      persona,
      tenant,
      params: params as never,
      query: query as never,
      body: body as never,
      now: c.get('requestTime'),
      correlationId: c.get('correlationId'),
      idempotencyKey: endpoint.idempotent === true ? (c.req.header('idempotency-key') ?? null) : null,
      appEnv,
      logger,
      fixtures: fixtureHelpers(query, persona),
      requirePersona: () => {
        if (persona === null) {
          throw new Error(`Endpoint ${endpoint.id} has no authenticated persona.`);
        }
        return persona;
      },
      requireTenant: () => {
        if (tenant === null) {
          throw new Error(`Endpoint ${endpoint.id} has no tenant context.`);
        }
        return tenant;
      },
      fail: (status, code, detail) => {
        throw new MockHttpError({
          status,
          code,
          title: code
            .toLowerCase()
            .split('_')
            .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
            .join(' '),
          ...(detail === undefined ? {} : { detail }),
        });
      },
      notFound: (detail) => {
        throw notFoundError('NOT_FOUND', detail);
      },
    };

    let result: unknown;
    try {
      result = await route.handler(context);
    } catch (error) {
      if (error instanceof MockHttpError && !PLATFORM_CODES.has(error.code) && !endpoint.errors.includes(error.code)) {
        logger.error('handler used an undeclared error code', { endpointId: endpoint.id, code: error.code });
        throw new Error(`Undeclared error code ${error.code} for ${endpoint.id}.`, { cause: error });
      }
      if (error instanceof MockHttpError && declaredErrorStatus(endpoint, error.code) !== error.status) {
        // One code, one status (DOMAIN_ERROR_STATUS): a second status for the same code is a handler defect.
        logger.error('handler sent an error code with the wrong status', {
          endpointId: endpoint.id,
          code: error.code,
          status: error.status,
          expected: declaredErrorStatus(endpoint, error.code),
        });
        throw new Error(`Error code ${error.code} of ${endpoint.id} must travel with status ${String(declaredErrorStatus(endpoint, error.code))}, not ${error.status}.`, { cause: error });
      }
      throw error;
    }

    const checked = endpoint.response.safeParse(result);
    if (!checked.success) {
      logger.error('response does not match the contract (fixture drift)', {
        endpointId: endpoint.id,
        module: route.module,
        issues: checked.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
      });
      throw new Error(`Response of ${endpoint.id} violates its contract.`);
    }
    if (endpoint.status === 204) {
      return c.body(null, 204);
    }
    return c.json(checked.data as never, endpoint.status);
  };
}

/** True for paths under `/api/v1`. */
export function isApiPath(path: string): boolean {
  return path === API_BASE || path.startsWith(`${API_BASE}/`);
}
