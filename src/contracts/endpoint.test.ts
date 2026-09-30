import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { IdParam } from './common.js';
import {
  audienceOfPath,
  buildPath,
  buildQuery,
  buildUrl,
  defineEndpoint,
  endpointPermissions,
  isPermitted,
  matchPath,
  pathParamNames,
  tenantHeaderMode,
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
