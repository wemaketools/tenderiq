/**
 * The mock API middleware chain end to end, with REAL Supabase JWT verification against the local stack (DD-43):
 * 401 cases, the identical tenant 403, prefix/kind enforcement, permission 403, 422 shape, response validation,
 * declared/undeclared business errors, sanitized 500s, headers, correlation ids and the request log.
 *
 * Requires `npm run supabase:start` and `npm run auth:personas`.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem, SANITIZED_SERVER_ERROR_DETAIL } from '../../../contracts/common.js';
import { getConfig } from '../../../server/lib/config/index.js';
import {
  decodeJwt,
  generateEs256KeyPair,
  localStackSigningKey,
  sessionClaims,
  signEs256,
  signHs256,
  tamperPayload,
  unsignedToken,
} from '../../../server/tests/unit/platform-auth/jwt-helpers.js';
import { UNMAPPED_AUTH_ACCOUNT } from '../../fixtures/platform.js';
import { createTestMockApp, signInAs, tenantIdOf } from '../index.js';
import type { TestMockApp, TestResponse } from '../index.js';
import { sessionModule } from './session-module.js';
import { EXPLOSION_MESSAGE, platformTestModule } from './platform-endpoints.js';

const TEBOGO = 'tebogo.officer@tenderiq.local';
const SAM = 'sam.dual@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ modules: [sessionModule, platformTestModule] });
});

/** The problem body without the per-request correlation id. */
function stable(response: TestResponse): Record<string, unknown> {
  const { correlationId: _ignored, ...rest } = Problem.parse(response.body);
  return rest;
}

describe('health and routing', () => {
  it('answers GET /api/v1/health with ok, v1 and an echoed correlation id', async () => {
    // Act
    const response = await api.request('GET', '/api/v1/health', { headers: { 'x-correlation-id': 'health-check-1' } });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', version: 'v1' });
    expect(response.headers.get('x-correlation-id')).toBe('health-check-1');
  });

  it('answers an unknown route with 404 problem+json even without a token (never 401)', async () => {
    const response = await api.request('GET', '/api/v1/buyer/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(stable(response)).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('answers a path outside /api/v1 with 404 problem+json', async () => {
    const response = await api.request('GET', '/elsewhere');
    expect(response.status).toBe(404);
    expect(Problem.safeParse(response.body).success).toBe(true);
  });

  it('serves a public endpoint without authentication', async () => {
    const response = await api.request('GET', '/api/v1/public/test-platform/hello');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hello: 'world', signedIn: false });
  });

  it('sets the security headers on success and error responses alike', async () => {
    for (const response of [
      await api.request('GET', '/api/v1/health'),
      await api.request('GET', '/api/v1/me/context'),
      await api.request('GET', '/api/v1/nope'),
    ]) {
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-correlation-id')).toMatch(/.+/);
      expect(response.headers.get('strict-transport-security')).toBeNull();
    }
  });

  it('generates a correlation id when the supplied one is unusable and repeats it in the problem body', async () => {
    const response = await api.request('GET', '/api/v1/me/context', { headers: { 'x-request-id': 'bad id with spaces' } });
    const correlationId = response.headers.get('x-correlation-id');
    expect(correlationId).not.toBe('bad id with spaces');
    expect(Problem.parse(response.body).correlationId).toBe(correlationId);
  });
});

describe('authentication (real Supabase JWT verification)', () => {
  let realToken: string;
  let expectedBody: Record<string, unknown>;

  beforeAll(async () => {
    realToken = await signInAs(TEBOGO);
    expectedBody = stable(await api.request('GET', '/api/v1/me/context'));
  });

  it('accepts a token issued by local Supabase Auth for a persona', async () => {
    const response = await api.request('GET', '/api/v1/me/context', { token: realToken });
    expect(response.status).toBe(200);
  });

  it('answers a missing token with 401 problem+json and WWW-Authenticate: Bearer', async () => {
    const response = await api.request('GET', '/api/v1/me/context');
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(expectedBody).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it.each<[string, () => Promise<string>]>([
    ['a tampered (forged) payload', async () => tamperPayload(realToken, { email: 'admin.kwu@tenderiq.local' })],
    ['alg none', async () => unsignedToken(decodeJwt(realToken).payload, String(decodeJwt(realToken).header.kid))],
    [
      'an HS256 downgrade',
      async () => signHs256({ alg: 'HS256', typ: 'JWT', kid: decodeJwt(realToken).header.kid }, decodeJwt(realToken).payload, getConfig().supabase.anonKey),
    ],
    [
      'an unknown kid',
      async () => {
        const attacker = await generateEs256KeyPair('attacker-kid');
        return signEs256({ alg: 'ES256', typ: 'JWT', kid: attacker.kid }, decodeJwt(realToken).payload, attacker.privateJwk);
      },
    ],
    [
      'an expired token signed with the stack key',
      async () => {
        const key = localStackSigningKey();
        const now = Math.floor(Date.now() / 1000);
        return signEs256({ alg: 'ES256', typ: 'JWT', kid: key.kid }, sessionClaims(getConfig().supabase.authIssuer, { iat: now - 7200, exp: now - 1 }), key);
      },
    ],
    [
      'a valid token for an e-mail with no fixture persona',
      async () => {
        const key = localStackSigningKey();
        return signEs256(
          { alg: 'ES256', typ: 'JWT', kid: key.kid },
          sessionClaims(getConfig().supabase.authIssuer, { email: 'stranger@example.com' }),
          key,
        );
      },
    ],
    ['a real Auth account that maps to no persona', async () => signInAs(UNMAPPED_AUTH_ACCOUNT.email)],
    ['a deactivated persona (departed employee)', async () => signInAs('former.officer@tenderiq.local')],
    ['garbage', async () => 'not-a-jwt'],
  ])('rejects %s with the same 401 body', async (_label, makeToken) => {
    // Arrange
    const token = await makeToken();

    // Act
    const response = await api.request('GET', '/api/v1/me/context', { token });

    // Assert
    expect(response.status).toBe(401);
    expect(stable(response)).toEqual(expectedBody);
  });

  it('logs the rejection reason server-side only, without the token or e-mail', async () => {
    // Arrange
    const before = api.logs.length;

    // Act
    const response = await api.request('GET', '/api/v1/me/context', { token: tamperPayload(realToken, { email: 'x@y.z' }) });

    // Assert
    const lines = api.logs.slice(before).join('\n');
    expect(JSON.stringify(response.body)).not.toContain('invalid_signature');
    expect(lines).toContain('invalid_signature_or_expired');
    expect(lines).not.toContain(realToken.split('.')[2] ?? 'unreachable');
    expect(lines).not.toContain('tebogo.officer');
  });
});

describe('tenant context: one identical 403', () => {
  it('returns byte-identical 403 bodies (except the correlation id) for every tenant failure', async () => {
    // Arrange
    const cases: Array<[string, string, string, string | number | undefined]> = [
      ['no header', TEBOGO, '/api/v1/buyer/test-platform/ping', undefined],
      ['a malformed header', TEBOGO, '/api/v1/buyer/test-platform/ping', 'abc'],
      ['an unknown tenant', TEBOGO, '/api/v1/buyer/test-platform/ping', 9999],
      ['another buyer (not a member)', TEBOGO, '/api/v1/buyer/test-platform/ping', 'odc'],
      ['a supplier tenant on a buyer route', TEBOGO, '/api/v1/buyer/test-platform/ping', 'tsodilo'],
      ['a member tenant of the wrong kind (prefix/kind)', SAM, '/api/v1/buyer/test-platform/ping', 'tsodilo'],
      ['a pending membership', SAM, '/api/v1/supplier/test-platform/ping', 'serowe-ict'],
      ['a buyer tenant on the ops prefix', TEBOGO, '/api/v1/ops/test-platform/ping', 'kwu'],
    ];

    // Act
    const results = [];
    for (const [label, email, path, tenant] of cases) {
      const header = tenant === undefined ? undefined : typeof tenant === 'number' || tenant === 'abc' ? String(tenant) : String(tenantIdOf(tenant));
      const response = await api.requestAs(email, 'GET', path, header === undefined ? {} : { headers: { 'x-tenant-id': header } });
      results.push({ label, response });
    }

    // Assert
    const first = results[0];
    expect(first?.response.status).toBe(403);
    const reference = first === undefined ? {} : stable(first.response);
    expect(reference).toMatchObject({ status: 403, code: 'TENANT_ACCESS_DENIED' });
    for (const { label, response } of results) {
      expect({ label, status: response.status, body: stable(response) }).toEqual({ label, status: 403, body: reference });
      expect(response.headers.get('content-type')).toBe(first?.response.headers.get('content-type'));
    }
  });

  it('lets a member act in the tenant whose kind matches the prefix', async () => {
    const buyer = await api.requestAs(SAM, 'GET', '/api/v1/buyer/test-platform/ping', { tenant: 'kwu' });
    const supplier = await api.requestAs(SAM, 'GET', '/api/v1/supplier/test-platform/ping', { tenant: 'tsodilo' });
    const ops = await api.requestAs('ops.admin@tenderiq.local', 'GET', '/api/v1/ops/test-platform/ping', { tenant: 'tenderiq-ops' });
    expect(buyer).toMatchObject({ status: 200, body: { tenantId: tenantIdOf('kwu'), access: 'membership' } });
    expect(supplier).toMatchObject({ status: 200, body: { tenantId: tenantIdOf('tsodilo') } });
    expect(ops).toMatchObject({ status: 200, body: { tenantId: tenantIdOf('tenderiq-ops') } });
  });

  it('admits an operator into a customer tenant only under an active support grant, with support.view only', async () => {
    // Act
    const granted = await api.requestAs('support.agent@tenderiq.local', 'GET', '/api/v1/buyer/test-platform/ping', { tenant: 'kwu' });
    const noGrant = await api.requestAs('support.agent@tenderiq.local', 'GET', '/api/v1/buyer/test-platform/ping', { tenant: 'odc' });
    const otherOperator = await api.requestAs('ops.admin@tenderiq.local', 'GET', '/api/v1/buyer/test-platform/ping', { tenant: 'kwu' });

    // Assert: inside KWU the grant gives support.view only, so tender.view is a permission 403, not a tenant 403.
    expect(granted.status).toBe(403);
    expect(stable(granted)).toMatchObject({ code: 'FORBIDDEN' });
    expect(stable(noGrant)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    expect(stable(otherOperator)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('requires X-Tenant-Id equal to a member tenant on a /me row action, checking the permission there', async () => {
    const ok = await api.requestAs(SAM, 'POST', '/api/v1/me/test-platform/rows/r1/ack', { tenant: 'kwu' });
    const missing = await api.requestAs(SAM, 'POST', '/api/v1/me/test-platform/rows/r1/ack');
    const wrongPermission = await api.requestAs(SAM, 'POST', '/api/v1/me/test-platform/rows/r1/ack', { tenant: 'tsodilo' });
    expect(ok).toMatchObject({ status: 200, body: { rowId: 'r1', tenantId: tenantIdOf('kwu') } });
    expect(stable(missing)).toMatchObject({ status: 403, code: 'TENANT_ACCESS_DENIED' });
    expect(stable(wrongPermission)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('permission enforcement', () => {
  it('answers 403 FORBIDDEN when the persona lacks the endpoint permission in the tenant', async () => {
    // admin.kwu is org_admin only: no tender content (AC-15).
    const response = await api.requestAs('admin.kwu@tenderiq.local', 'GET', '/api/v1/buyer/test-platform/ping', { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(stable(response)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('lets the same persona call an endpoint its role grants', async () => {
    const response = await api.requestAs('admin.kwu@tenderiq.local', 'GET', '/api/v1/buyer/test-platform/admin', { tenant: 'kwu' });
    expect(response.status).toBe(200);
  });

  it('denies an officer the administrator endpoint', async () => {
    const response = await api.requestAs(TEBOGO, 'GET', '/api/v1/buyer/test-platform/admin', { tenant: 'kwu' });
    expect(stable(response)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('request validation (422)', () => {
  it('returns every field error of params, query and body with the CODE|message convention', async () => {
    // Act
    const response = await api.requestAs(TEBOGO, 'POST', '/api/v1/buyer/test-platform/items/abc', {
      tenant: 'kwu',
      query: { mode: 'published' },
      body: { title: '  ', budget: { amount: 1500.5, currency: 'bwp' } },
    });

    // Assert
    expect(response.status).toBe(422);
    const problem = Problem.parse(response.body);
    expect(problem).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
    expect(problem.errors).toEqual(
      expect.arrayContaining([
        { field: 'itemId', code: 'INVALID_ID', message: 'Must be a numeric id.' },
        { field: 'mode', code: 'INVALID_MODE', message: 'Use draft or final.' },
        { field: 'title', code: 'TITLE_REQUIRED', message: 'A title is required.' },
        { field: 'budget.amount', code: 'INVALID_DECIMAL', message: 'Must be a decimal string.' },
        { field: 'budget.currency', code: 'INVALID_CURRENCY', message: 'Use a three-letter currency code such as BWP.' },
      ]),
    );
  });

  it('rejects a body that is not JSON with INVALID_JSON', async () => {
    // Arrange
    const token = await signInAs(TEBOGO);
    const request = new Request('http://mock.test/api/v1/buyer/test-platform/items/7?mode=draft', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': String(tenantIdOf('kwu')), 'content-type': 'application/json' },
      body: '{"title": ',
    });

    // Act
    const response = await api.fetch(request);

    // Assert
    expect(response.status).toBe(422);
    expect(Problem.parse(await response.json()).errors).toEqual([
      { field: 'body', code: 'INVALID_JSON', message: 'The request body is not valid JSON.' },
    ]);
  });

  it('passes parsed values to the handler and returns its contract-valid response', async () => {
    const response = await api.requestAs(TEBOGO, 'POST', '/api/v1/buyer/test-platform/items/7', {
      tenant: 'kwu',
      query: { mode: 'final' },
      body: { title: ' Pumps ', budget: { amount: '1500000.00', currency: 'BWP' } },
    });
    expect(response).toMatchObject({
      status: 200,
      body: { itemId: '7', mode: 'final', title: 'Pumps', budget: { amount: '1500000.00', currency: 'BWP' } },
    });
  });

  it('answers a 204 endpoint with an empty body', async () => {
    const response = await api.requestAs(TEBOGO, 'DELETE', '/api/v1/buyer/test-platform/items/7', { tenant: 'kwu' });
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });
});

describe('response validation and errors', () => {
  it('turns a response that violates its contract into a sanitized 500 and logs the drift', async () => {
    // Arrange
    const before = api.logs.length;

    // Act
    const response = await api.requestAs(TEBOGO, 'GET', '/api/v1/buyer/test-platform/drift', { tenant: 'kwu' });

    // Assert
    expect(response.status).toBe(500);
    expect(stable(response)).toMatchObject({ code: 'INTERNAL_ERROR', detail: SANITIZED_SERVER_ERROR_DETAIL });
    const log = api.logs.slice(before).join('\n');
    expect(log).toContain('fixture drift');
    expect(log).toContain('testPlatform.buyer.drift');
    expect(log).toContain('amount.amount');
  });

  it('returns a declared business error with its status and code', async () => {
    const response = await api.requestAs(TEBOGO, 'POST', '/api/v1/buyer/test-platform/locked', { tenant: 'kwu' });
    expect(response.status).toBe(409);
    expect(stable(response)).toMatchObject({ status: 409, code: 'ITEM_LOCKED', detail: 'The item is locked by an active hold.' });
  });

  it('turns an undeclared business error code into a 500', async () => {
    const response = await api.requestAs(TEBOGO, 'POST', '/api/v1/buyer/test-platform/undeclared', { tenant: 'kwu' });
    expect(response.status).toBe(500);
  });

  it('never leaks the message of an unexpected error to the client', async () => {
    const response = await api.requestAs(TEBOGO, 'GET', '/api/v1/buyer/test-platform/explode', { tenant: 'kwu' });
    expect(response.status).toBe(500);
    expect(response.text).not.toContain('hunter2');
    expect(response.text).not.toContain(EXPLOSION_MESSAGE);
    expect(stable(response)).toMatchObject({ detail: SANITIZED_SERVER_ERROR_DETAIL });
  });
});

describe('request log', () => {
  it('writes one JSON line per request with route, status, user and tenant but no e-mail', async () => {
    // Arrange
    const before = api.logs.length;

    // Act
    await api.requestAs(TEBOGO, 'GET', '/api/v1/buyer/test-platform/ping', { tenant: 'kwu' });

    // Assert
    const lines = api.logs.slice(before).map((line) => JSON.parse(line) as { message: string; correlationId?: string; context: Record<string, unknown> });
    const requestLine = lines.find((line) => line.message === 'request');
    expect(requestLine?.context).toMatchObject({
      method: 'GET',
      route: '/api/v1/buyer/test-platform/ping',
      status: 200,
      tenantId: tenantIdOf('kwu'),
    });
    expect(typeof requestLine?.context.userId).toBe('number');
    expect(typeof requestLine?.correlationId).toBe('string');
    expect(api.logs.slice(before).join('\n')).not.toContain('@tenderiq.local');
  });
});
