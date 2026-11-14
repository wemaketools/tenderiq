/**
 * Test helpers for mock API handler tests (Vitest `unit` project; architecture-plan §8).
 *
 *   import { createTestMockApp, tenantIdOf } from '../testing/index.js';
 *   const api = await createTestMockApp();                    // discovers src/mock-api/handlers, real JWT checks
 *   const res = await api.requestAs('tebogo.officer@tenderiq.local', 'GET', '/api/v1/buyer/tenders', {
 *     tenant: 'kwu',
 *     query: { status: 'open' },
 *   });
 *   expect(res.status).toBe(200);
 *
 * Authentication is REAL by default (DD-43): `signInAs(email)` signs the persona in against the local Supabase Auth
 * stack with the password grant (password `test1234`, created by `npm run auth:personas`) and the app verifies the
 * token with `src/server/lib/auth/verify.ts`. Tokens are cached per e-mail for the test process.
 *
 * `auth: 'fixture'` is an explicit opt-in for pure handler-logic tests that must run without Docker: the app is
 * built with a verifier that accepts only `fixtureToken(email)` values. It exists only here, in test code; the served
 * mock API always verifies real tokens.
 */
import { buildUrl } from '../../contracts/endpoint.js';
import type { AnyEndpoint, PathParamValue, QueryValue } from '../../contracts/endpoint.js';
import type { VerifyResult } from '../../server/lib/auth/verify.js';
import { getConfig } from '../../server/lib/config/index.js';
import { createMockApp } from '../app.js';
import { DEMO_AS_OF } from '../fixtures/demo-clock.js';
import type { CreateMockAppOptions, MockApi } from '../app.js';
import type { TokenVerifier } from '../middleware/chain.js';
import { findTenantBySlug } from '../persona.js';

/** The local-only password of every demo persona (docs/plan/demo-storyline.md). */
export const DEMO_PERSONA_PASSWORD = 'test1234';

/**
 * The clock of every test app unless a test passes `now`. Fixed inside the seeded support grant window
 * (2026-09-28 to 2026-10-12): on the real clock those tests would fail once the grant expires.
 */
export const TEST_NOW = new Date(DEMO_AS_OF);

const FIXTURE_TOKEN_PREFIX = 'fixture-persona.';

/** A token accepted only by an app created with `auth: 'fixture'`. */
export function fixtureToken(email: string): string {
  return `${FIXTURE_TOKEN_PREFIX}${email}`;
}

/** The verifier used by `auth: 'fixture'` apps. */
export const fixtureTokenVerifier: TokenVerifier = async (token): Promise<VerifyResult> => {
  if (token === null || !token.startsWith(FIXTURE_TOKEN_PREFIX)) {
    return { ok: false, reason: 'malformed', detail: 'Not a fixture token.' };
  }
  const email = token.slice(FIXTURE_TOKEN_PREFIX.length).toLowerCase();
  return {
    ok: true,
    token: { authUserId: `fixture:${email}`, email, sessionId: null, expiresAt: Number.MAX_SAFE_INTEGER, algorithm: 'ES256', keyId: 'fixture' },
  };
};

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Signs a persona in against LOCAL Supabase Auth (password grant) and returns its access token (cached). */
export async function signInAs(email: string, password: string = DEMO_PERSONA_PASSWORD): Promise<string> {
  const key = `${email.toLowerCase()}\u0000${password}`;
  const cached = tokenCache.get(key);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cached !== undefined && cached.expiresAt - 60 > nowSeconds) {
    return cached.token;
  }
  const config = getConfig();
  const response = await fetch(`${config.supabase.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.supabase.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(
      `Sign-in as ${email} failed with HTTP ${response.status}. Is the local stack running (npm run supabase:start) ` +
        'and are the demo accounts created (npm run auth:personas)?',
    );
  }
  const body = (await response.json()) as { access_token?: unknown; expires_at?: unknown };
  if (typeof body.access_token !== 'string') {
    throw new Error(`Sign-in as ${email} returned no access token.`);
  }
  const expiresAt = typeof body.expires_at === 'number' ? body.expires_at : nowSeconds + 300;
  tokenCache.set(key, { token: body.access_token, expiresAt });
  return body.access_token;
}

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
  /** Sends a request as a persona (signed in for real unless the app uses `auth: 'fixture'`). */
  requestAs(email: string, method: string, path: string, options?: Omit<TestRequestOptions, 'token'>): Promise<TestResponse>;
  /** Calls a contract endpoint as a persona: the URL is built from the contract. */
  callAs(
    email: string,
    endpoint: AnyEndpoint,
    options?: Omit<TestRequestOptions, 'token'> & { readonly params?: Readonly<Record<string, PathParamValue>> },
  ): Promise<TestResponse>;
}

export interface CreateTestMockAppOptions extends Omit<CreateMockAppOptions, 'logSink' | 'verifyToken'> {
  /** `real` (default): local Supabase Auth + real verification. `fixture`: offline verifier (see module comment). */
  readonly auth?: 'real' | 'fixture';
  /** Overrides the verifier entirely (platform tests). */
  readonly verifyToken?: TokenVerifier;
}

/** Builds a mock API for tests, with captured logs and request helpers. */
export async function createTestMockApp(options: CreateTestMockAppOptions = {}): Promise<TestMockApp> {
  const logs: string[] = [];
  const { auth = 'real', verifyToken, ...rest } = options;
  const api = await createMockApp({
    appEnv: 'local',
    logLevel: 'debug',
    now: () => TEST_NOW,
    ...rest,
    logSink: (line) => logs.push(line),
    ...(verifyToken !== undefined ? { verifyToken } : auth === 'fixture' ? { verifyToken: fixtureTokenVerifier } : {}),
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

  async function tokenFor(email: string): Promise<string> {
    if (verifyToken === undefined && auth === 'fixture') {
      return fixtureToken(email);
    }
    return signInAs(email);
  }

  return {
    ...api,
    logs,
    request,
    requestAs: async (email, method, path, requestOptions = {}) =>
      request(method, path, { ...requestOptions, token: await tokenFor(email) }),
    callAs: async (email, endpoint, requestOptions = {}) => {
      const { params, ...restOptions } = requestOptions;
      const path = buildUrl(endpoint, params ?? {});
      return request(endpoint.method, path, { ...restOptions, token: await tokenFor(email) });
    },
  };
}
