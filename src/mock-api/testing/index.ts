/**
 * Test helpers for mock API handler tests (Vitest `unit` project; architecture-plan §8).
 *
 *   import { createTestMockApp, tenantIdOf } from '../testing/index.js';
 *   const api = await createTestMockApp();                    // every handler module, prototype auth
 *   const res = await api.requestAs('tebogo.officer@tenderiq.local', 'GET', '/api/v1/buyer/tenders', {
 *     tenant: 'kwu',
 *     query: { status: 'open' },
 *   });
 *   expect(res.status).toBe(200);
 *
 * Authentication is the prototype's own (DD-50): `requestAs(email)` sends the persona token the SPA's persona picker
 * sends (`personaToken(email)`), and the app maps it to the fixture persona exactly as in the browser. No auth
 * provider or Docker is involved. `handlersDir` discovers the modules of another directory (registry tests).
 */
import { buildUrl } from '../../contracts/endpoint.js';
import type { AnyEndpoint, PathParamValue, QueryValue } from '../../contracts/endpoint.js';
import { createMockApp } from '../app.js';
import type { CreateMockAppOptions, MockApi } from '../app.js';
import { findTenantBySlug } from '../persona.js';
import { personaToken } from '../prototype-auth.js';
import { discoverHandlerModules } from '../registry-discovery.js';

/** The fixture tenant id of a slug (throws for an unknown slug). */
export function tenantIdOf(slug: string): number {
  const tenant = findTenantBySlug(slug);
  if (tenant === undefined) {
    throw new Error(`No fixture tenant ${slug}.`);
  }
  return tenant.id;
}

export interface TestRequestOptions {
  /** Bearer token; omit for an anonymous request. */
  readonly token?: string;
  /** `X-Tenant-Id` as an id, or a tenant slug resolved with `tenantIdOf`. */
  readonly tenant?: number | string;
  readonly query?: Readonly<Record<string, QueryValue>>;
  /** JSON body. */
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface TestResponse {
  readonly status: number;
  readonly headers: Headers;
  /** The parsed JSON body (`null` for an empty body). */
  readonly body: unknown;
  readonly text: string;
}

export interface TestMockApp extends MockApi {
  /** Every log line the app wrote (JSON strings), for assertions on logging and drift reports. */
  readonly logs: string[];
  /** Sends a request with explicit options. */
  request(method: string, path: string, options?: TestRequestOptions): Promise<TestResponse>;
  /** Sends a request as a persona (with its prototype persona token). */
  requestAs(email: string, method: string, path: string, options?: Omit<TestRequestOptions, 'token'>): Promise<TestResponse>;
  /** Calls a contract endpoint as a persona: the URL is built from the contract. */
  callAs(
    email: string,
    endpoint: AnyEndpoint,
    options?: Omit<TestRequestOptions, 'token'> & { readonly params?: Readonly<Record<string, PathParamValue>> },
  ): Promise<TestResponse>;
}

export interface CreateTestMockAppOptions extends Omit<CreateMockAppOptions, 'logSink' | 'moduleFailures'> {
  /** Discovers the handler modules of this directory instead of mounting `HANDLER_MODULES` (registry tests). */
  readonly handlersDir?: string;
}

/** Builds a mock API for tests, with captured logs and request helpers. */
export async function createTestMockApp(options: CreateTestMockAppOptions = {}): Promise<TestMockApp> {
  const logs: string[] = [];
  const { handlersDir, ...rest } = options;
  const discovered = handlersDir === undefined ? undefined : await discoverHandlerModules(handlersDir);
  const api = createMockApp({
    appEnv: 'local',
    logLevel: 'debug',
    ...rest,
    ...(discovered === undefined ? {} : { modules: discovered.modules, moduleFailures: discovered.failed }),
    logSink: (line) => logs.push(line),
  });

  async function request(method: string, path: string, requestOptions: TestRequestOptions = {}): Promise<TestResponse> {
    const url = new URL(`http://mock.test${path}`);
    for (const [key, value] of Object.entries(requestOptions.query ?? {})) {
      if (value === undefined || value === null) {
        continue;
      }
      for (const item of Array.isArray(value) ? value : [value]) {
        url.searchParams.append(key, String(item));
      }
    }
    const headers = new Headers(requestOptions.headers);
    if (requestOptions.token !== undefined) {
      headers.set('authorization', `Bearer ${requestOptions.token}`);
    }
    if (requestOptions.tenant !== undefined) {
      headers.set(
        'x-tenant-id',
        String(typeof requestOptions.tenant === 'number' ? requestOptions.tenant : tenantIdOf(requestOptions.tenant)),
      );
    }
    let body: string | undefined;
    if (requestOptions.body !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(requestOptions.body);
    }
    const response = await api.fetch(new Request(url, { method, headers, ...(body === undefined ? {} : { body }) }));
    const text = await response.text();
    let parsed: unknown = null;
    if (text !== '') {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }
    return { status: response.status, headers: response.headers, body: parsed, text };
  }

  return {
    ...api,
    logs,
    request,
    requestAs: (email, method, path, requestOptions = {}) =>
      request(method, path, { ...requestOptions, token: personaToken(email) }),
    callAs: (email, endpoint, requestOptions = {}) => {
      const { params, ...restOptions } = requestOptions;
      const path = buildUrl(endpoint, params ?? {});
      return request(endpoint.method, path, { ...restOptions, token: personaToken(email) });
    },
  };
}
