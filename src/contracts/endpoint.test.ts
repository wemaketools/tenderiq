import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { ENDPOINT_CATALOG } from './catalog.js';
import { DOMAIN_ERROR_STATUS, IdParam, PLATFORM_ERRORS, errorStatus } from './common.js';
import {
  SUPPORT_VIEW_FORBIDDEN_SEGMENTS,
  declaredErrorStatus,
  audienceOfPath,
  buildPath,
  buildQuery,
  buildUrl,
  defineEndpoint,
  endpointPermissions,
  isPermitted,
  matchPath,
  pathParamNames,
  supportGrantAllows,
  tenantHeaderMode,
  unregisteredErrorCodes,
  validateEndpointDefinition,
} from './endpoint.js';
import type {
  EndpointBody,
  EndpointDefinition,
  EndpointParams,
  EndpointParsedParams,
  EndpointRequest,
  EndpointResponse,
  PathParamNames,
} from './endpoint.js';

const base: EndpointDefinition = {
  id: 'buyer.examples.get',
  method: 'GET',
  path: '/api/v1/buyer/examples/:exampleId',
  audience: 'buyer',
  permission: 'tender.view',
  params: z.object({ exampleId: IdParam }),
  response: z.object({ id: z.number() }),
  errors: ['EXAMPLE_NOT_FOUND'],
  screens: ['BUY-07'],
};

/** Overrides; a key overridden with undefined is removed from the base definition. */
type Overrides = { [K in keyof EndpointDefinition]?: EndpointDefinition[K] | undefined };

/** The base definition with overrides applied; keys overridden with undefined are removed. */
function definition(overrides: Overrides): EndpointDefinition {
  const merged: Record<string, unknown> = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete merged[key];
    }
  }
  return merged as unknown as EndpointDefinition;
}

function problemsOf(overrides: Overrides): string[] {
  return validateEndpointDefinition(definition(overrides));
}

describe('validateEndpointDefinition', () => {
  it('accepts a well-formed definition', () => {
    expect(problemsOf({})).toEqual([]);
  });

  it('requires the path to start with an audience prefix or be the health check', () => {
    expect(problemsOf({ path: '/api/v2/buyer/x', params: undefined }).join()).toMatch(/must start with/);
    expect(problemsOf({ path: '/buyer/x', params: undefined }).join()).toMatch(/clean path/);
    expect(
      problemsOf({
        id: 'health.get',
        path: '/api/v1/health',
        audience: 'public',
        permission: undefined,
        params: undefined,
        screens: ['COM-01'],
      }),
    ).toEqual([]);
  });

  it('requires the audience to match the path prefix', () => {
    expect(problemsOf({ audience: 'supplier' }).join()).toMatch(/does not match the path prefix/);
  });

  it('rejects trailing slashes, double slashes and odd characters in paths', () => {
    expect(problemsOf({ path: '/api/v1/buyer/examples/', params: undefined }).join()).toMatch(/clean path/);
    expect(problemsOf({ path: '/api/v1/buyer//examples', params: undefined }).join()).toMatch(/clean path/);
    expect(problemsOf({ path: '/api/v1/buyer/exa mples', params: undefined }).join()).toMatch(/clean path/);
  });

  it('requires permissions from the catalog, of the audience tenant kind', () => {
    expect(problemsOf({ permission: 'tender.fly' as never }).join()).toMatch(/not in the catalog/);
    expect(problemsOf({ permission: 'supplier.response.edit' }).join()).toMatch(/supplier permission/);
    expect(problemsOf({ permission: undefined }).join()).toMatch(/must declare a permission/);
  });

  it('forbids permissions on public endpoints and on me reads', () => {
    expect(
      problemsOf({ path: '/api/v1/public/examples/:exampleId', audience: 'public', permission: 'tender.view' }).join(),
    ).toMatch(/public endpoints cannot require/);
    expect(
      problemsOf({ path: '/api/v1/me/examples/:exampleId', audience: 'me', permission: 'approval.decide' }).join(),
    ).toMatch(/rowTenant/);
  });

  it('allows a me action on a row tenant to require a permission, but not as a GET', () => {
    expect(
      problemsOf({
        method: 'POST',
        path: '/api/v1/me/examples/:exampleId',
        audience: 'me',
        rowTenant: true,
        permission: 'approval.decide',
      }),
    ).toEqual([]);
    expect(
      problemsOf({ path: '/api/v1/me/examples/:exampleId', audience: 'me', rowTenant: true, permission: undefined }).join(),
    ).toMatch(/rowTenant marks actions/);
    expect(problemsOf({ rowTenant: true }).join()).toMatch(/only to me endpoints/);
  });

  it('requires params keys to equal the path parameters', () => {
    expect(problemsOf({ params: undefined }).join()).toMatch(/no params schema/);
    expect(problemsOf({ params: z.object({ id: IdParam }) }).join()).toMatch(/must equal the path parameters/);
    expect(problemsOf({ path: '/api/v1/buyer/examples' }).join()).toMatch(/no parameters but declares/);
  });

  it('rejects bodies on GET and DELETE and idempotency outside POST/PUT', () => {
    expect(problemsOf({ body: z.object({}) }).join()).toMatch(/cannot declare a body/);
    expect(problemsOf({ idempotent: true }).join()).toMatch(/only POST or PUT/);
  });

  it('requires valid ids, screen ids and UPPER_SNAKE error codes', () => {
    expect(problemsOf({ id: 'Examples' }).join()).toMatch(/dot-separated/);
    expect(problemsOf({ screens: ['BUY-7'] }).join()).toMatch(/not a PRD screen id/);
    expect(problemsOf({ screens: [] as unknown as ['BUY-07'] }).join()).toMatch(/at least one screen/);
    expect(problemsOf({ errors: ['notFound'] }).join()).toMatch(/UPPER_SNAKE/);
    expect(problemsOf({ errors: ['A', 'A'] }).join()).toMatch(/unique/);
  });
});

describe('defineEndpoint', () => {
  it('throws on a malformed definition with every problem listed', () => {
    expect(() => defineEndpoint(definition({ audience: 'ops', permission: undefined }))).toThrow(/Invalid endpoint contract/);
  });

  it('defaults the success status to 200, and 201 for an idempotent POST', () => {
    const get = defineEndpoint({ ...base });
    expect(get.status).toBe(200);
    const create = defineEndpoint({
      ...base,
      id: 'buyer.examples.create',
      method: 'POST',
      path: '/api/v1/buyer/examples',
      params: undefined,
      body: z.object({ name: z.string() }),
      idempotent: true,
    });
    expect(create.status).toBe(201);
    const explicit = defineEndpoint({ ...base, status: 202 });
    expect(explicit.status).toBe(202);
  });

  it('records the path parameter names', () => {
    expect(defineEndpoint({ ...base }).pathParams).toEqual(['exampleId']);
  });

  it('infers request and response types from the schemas', () => {
    const endpoint = defineEndpoint({
      id: 'buyer.examples.rename',
      method: 'POST',
      path: '/api/v1/buyer/examples/:exampleId/rename',
      audience: 'buyer',
      permission: 'tender.edit',
      params: z.object({ exampleId: IdParam }),
      body: z.object({ name: z.string() }),
      response: z.object({ id: z.number(), name: z.string() }),
      errors: [],
      screens: ['BUY-08'],
    });
    expect(endpoint.status).toBe(200);
    expectTypeOf<EndpointBody<typeof endpoint>>().toEqualTypeOf<{ name: string }>();
    expectTypeOf<EndpointResponse<typeof endpoint>>().toEqualTypeOf<{ id: number; name: string }>();
    expectTypeOf<EndpointParsedParams<typeof endpoint>>().toEqualTypeOf<{ exampleId: number }>();
    expectTypeOf<EndpointParams<typeof endpoint>>().toEqualTypeOf<{ exampleId: string | number }>();
    expectTypeOf<EndpointRequest<typeof endpoint>['body']>().toEqualTypeOf<{ name: string }>();
    expectTypeOf<PathParamNames<'/api/v1/me/documents/:documentId/versions/:versionId/download'>>().toEqualTypeOf<
      'documentId' | 'versionId'
    >();
  });
});

describe('permissions and tenant header', () => {
  it('normalizes one code or an any-of list', () => {
    expect(endpointPermissions({ permission: 'tender.view' })).toEqual(['tender.view']);
    expect(endpointPermissions({ permission: ['tender.view', 'contract.view'] })).toEqual(['tender.view', 'contract.view']);
    expect(endpointPermissions({})).toEqual([]);
  });

  it('permits a caller holding any of the listed permissions', () => {
    expect(isPermitted({ permission: ['tender.view', 'contract.view'] }, ['contract.view'])).toBe(true);
    expect(isPermitted({ permission: 'tender.view' }, new Set(['contract.view']))).toBe(false);
    expect(isPermitted({}, [])).toBe(true);
  });

  it('decides how X-Tenant-Id is sent (DD-21)', () => {
    expect(tenantHeaderMode({ audience: 'public' })).toBe('none');
    expect(tenantHeaderMode({ audience: 'me' })).toBe('none');
    expect(tenantHeaderMode({ audience: 'me', rowTenant: true })).toBe('row');
    expect(tenantHeaderMode({ audience: 'buyer' })).toBe('active');
    expect(tenantHeaderMode({ audience: 'ops' })).toBe('active');
  });

  it('finds the audience of a path', () => {
    expect(audienceOfPath('/api/v1/supplier/bids')).toBe('supplier');
    expect(audienceOfPath('/api/v1/health')).toBe('public');
    expect(audienceOfPath('/api/v1/mechanics')).toBeNull();
    expect(audienceOfPath('/api/v1/opsx/y')).toBeNull();
  });
});

describe('path and query builders', () => {
  it('lists path parameter names in order', () => {
    expect(pathParamNames('/api/v1/buyer/approvals/subjects/:subjectType/:subjectId')).toEqual([
      'subjectType',
      'subjectId',
    ]);
  });

  it('fills and encodes path parameters', () => {
    expect(buildPath('/api/v1/me/tasks/:taskId/complete', { taskId: 7 })).toBe('/api/v1/me/tasks/7/complete');
    expect(buildPath('/api/v1/public/x/:slug', { slug: 'a b/c' })).toBe('/api/v1/public/x/a%20b%2Fc');
  });

  it('throws on a missing path parameter', () => {
    expect(() => buildPath('/api/v1/me/tasks/:taskId', {})).toThrow(/Missing path parameter "taskId"/);
  });

  it('serializes queries, repeating array keys and skipping empty values', () => {
    expect(buildQuery({ q: 'pump & valve', status: ['open', 'closed'], page: 2, unread: true, x: undefined, y: null })).toBe(
      '?q=pump%20%26%20valve&status=open&status=closed&page=2&unread=true',
    );
    expect(buildQuery({})).toBe('');
    expect(buildQuery(undefined)).toBe('');
  });

  it('builds a full URL from an endpoint', () => {
    expect(buildUrl({ path: '/api/v1/me/tasks/:taskId' }, { taskId: 3 }, { tab: 'history' })).toBe(
      '/api/v1/me/tasks/3?tab=history',
    );
  });

  it('matches concrete paths against templates', () => {
    expect(matchPath('/api/v1/me/tasks/:taskId', '/api/v1/me/tasks/12')).toEqual({ taskId: '12' });
    expect(matchPath('/api/v1/me/tasks/:taskId', '/api/v1/me/tasks')).toBeNull();
    expect(matchPath('/api/v1/me/tasks/:taskId', '/api/v1/me/notes/12')).toBeNull();
    expect(matchPath('/api/v1/me/tasks/:taskId', '/api/v1/me/tasks/%E0%A4%A')).toBeNull();
  });
});

describe('operator support grant surface (OPS-04, ADR 0013)', () => {
  it('accepts support.view on a buyer GET that declares its support surface', () => {
    expect(problemsOf({ permission: ['tender.view', 'support.view'], support: 'records' })).toEqual([]);
  });

  it('requires a support surface exactly when support.view is accepted', () => {
    expect(problemsOf({ permission: ['tender.view', 'support.view'] }).join()).toMatch(/must declare support/);
    expect(problemsOf({ support: 'metadata' }).join()).toMatch(/only on endpoints that accept support.view/);
  });

  it('rejects support.view on commands, ops or me endpoints and on bid, opening or evaluation paths', () => {
    const grant = { permission: ['tender.view', 'support.view'] as const, support: 'records' as const };
    expect(problemsOf({ ...grant, method: 'POST' }).join()).toMatch(/read-only/);
    expect(
      problemsOf({ ...grant, path: '/api/v1/ops/examples/:exampleId', audience: 'ops', permission: ['support.view'] }).join(),
    ).toMatch(/buyer or supplier endpoints only/);
    expect(
      problemsOf({ ...grant, path: '/api/v1/buyer/tenders/:exampleId/bids', params: z.object({ exampleId: IdParam }) }).join(),
    ).toMatch(/never opens bid/);
    expect(
      problemsOf({ ...grant, path: '/api/v1/buyer/evaluation/:exampleId', params: z.object({ exampleId: IdParam }) }).join(),
    ).toMatch(/never opens bid/);
  });

  it('opens a records surface only to a specific_records grant, and a metadata surface to both scopes', () => {
    const records = definition({ permission: ['tender.view', 'support.view'], support: 'records' });
    const metadata = definition({ permission: ['tender.view', 'support.view'], support: 'metadata' });
    expect(supportGrantAllows(records, 'metadata_only')).toBe(false);
    expect(supportGrantAllows(records, 'specific_records')).toBe(true);
    expect(supportGrantAllows(metadata, 'metadata_only')).toBe(true);
    expect(supportGrantAllows(definition({}), 'specific_records')).toBe(false);
  });

  it('gives the grant a real read surface in the catalog, never on a command or a sealed path', () => {
    const open = ENDPOINT_CATALOG.filter((e) => endpointPermissions(e).includes('support.view'));
    expect(open.length).toBeGreaterThan(0);
    for (const endpoint of open) {
      expect(endpoint.method, endpoint.id).toBe('GET');
      expect(endpoint.support, endpoint.id).toBeDefined();
      const segments = endpoint.path.split('/');
      for (const forbidden of SUPPORT_VIEW_FORBIDDEN_SEGMENTS) {
        expect(segments, endpoint.id).not.toContain(forbidden);
      }
    }
  });
});

describe('error code statuses (brief §5.3, docs/technical/07-api.md §4.4)', () => {
  it('registers every error code declared in the catalog with exactly one status', () => {
    const missing = ENDPOINT_CATALOG.flatMap((e) => unregisteredErrorCodes(e).map((code) => `${e.id}: ${code}`));
    expect(missing).toEqual([]);
  });

  it('gives codes that the mock once sent with two statuses a single status', () => {
    expect(errorStatus('SELF_APPROVAL_NOT_PERMITTED')).toBe(403);
    expect(errorStatus('INVITATION_EXPIRED')).toBe(409);
    expect(errorStatus('NEW_DEADLINE_IN_PAST')).toBe(422);
    expect(errorStatus('DOCUMENT_NOT_FOUND')).toBe(404);
    expect(errorStatus('UPLOAD_EXPIRED')).toBe(410);
  });

  it('keeps platform statuses for platform codes and knows no status for an unregistered code', () => {
    expect(errorStatus('TENANT_ACCESS_DENIED')).toBe(PLATFORM_ERRORS.TENANT_ACCESS_DENIED);
    expect(errorStatus('NOT_A_REAL_CODE')).toBeUndefined();
    expect(DOMAIN_ERROR_STATUS.has('UNAUTHENTICATED')).toBe(false);
  });

  it('answers the declared status only for codes the endpoint declares, and platform codes everywhere', () => {
    const endpoint = definition({ errors: ['DOCUMENT_NOT_FOUND'] });
    expect(declaredErrorStatus(endpoint, 'DOCUMENT_NOT_FOUND')).toBe(404);
    expect(declaredErrorStatus(endpoint, 'SELF_APPROVAL_NOT_PERMITTED')).toBeUndefined();
    expect(declaredErrorStatus(endpoint, 'VALIDATION_FAILED')).toBe(422);
    expect(declaredErrorStatus(endpoint, 'EXAMPLE_NOT_FOUND')).toBeUndefined();
  });
});
