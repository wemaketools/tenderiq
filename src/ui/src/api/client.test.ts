import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { decideApproval } from '@contracts/approvals';
import { defineEndpoint } from '@contracts/endpoint';
import { getSessionContext, updateTheme } from '@contracts/session';
import { getMyTaskSummary } from '@contracts/tasks';
import { requestApproval } from '@contracts/approvals';

import { installFetch, problem } from '../test/fetchMock';
import { makeContext } from '../test/fixtures';
import { ApiError, call, configureApiClient, fieldErrorsFor } from './client';

const restores: Array<() => void> = [];
function adapters(
  options: { tenant?: number | null; onUnauthorized?: () => void; token?: string | null } = {},
) {
  restores.push(
    configureApiClient({
      getAccessToken: () => Promise.resolve(options.token === undefined ? 'jwt-1' : options.token),
      getActiveTenantId: () => (options.tenant === undefined ? 2 : options.tenant),
      onUnauthorized: options.onUnauthorized ?? (() => undefined),
    }),
  );
}
afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
});

const publicHealth = defineEndpoint({
  id: 'public.test.health',
  method: 'GET',
  path: '/api/v1/public/test-health',
  audience: 'public',
  response: z.object({ ok: z.boolean() }),
  errors: [],
  screens: ['PUB-01'],
});

const buyerTenders = defineEndpoint({
  id: 'buyer.test.tenders',
  method: 'GET',
  path: '/api/v1/buyer/test-tenders/:tenderId',
  audience: 'buyer',
  permission: 'tender.view',
  params: z.object({ tenderId: z.union([z.number(), z.string()]) }),
  query: z.object({ status: z.array(z.string()).optional(), q: z.string().optional() }),
  response: z.object({ id: z.number() }),
  errors: [],
  screens: ['BUY-07'],
});

describe('call: requests', () => {
  it('builds the URL from the contract and sends the bearer token but no tenant on me reads', async () => {
    adapters();
    const { requests } = installFetch({
      'GET /api/v1/me/context': () => ({ body: makeContext() }),
    });
    const context = await call(getSessionContext, { query: {} });
    expect(context.user.fullName).toBe('Tebogo Molefe');
    expect(requests[0]?.path).toBe('/api/v1/me/context');
    expect(requests[0]?.headers.authorization).toBe('Bearer jwt-1');
    expect(requests[0]?.headers['x-tenant-id']).toBeUndefined();
  });

  it('sends the active tenant on area endpoints and fills path and query', async () => {
    adapters({ tenant: 9 });
    const { requests } = installFetch({
      'GET /api/v1/buyer/test-tenders/3': () => ({ body: { id: 3 } }),
    });
    await call(buyerTenders, {
      params: { tenderId: 3 },
      query: { status: ['open', 'closed'], q: 'pump' },
    });
    expect(requests[0]?.search).toBe('?status=open&status=closed&q=pump');
    expect(requests[0]?.headers['x-tenant-id']).toBe('9');
  });

  it('sends the row tenant on me row actions and an idempotency key on idempotent commands', async () => {
    adapters();
    const { requests } = installFetch({
      'POST /api/v1/me/approvals/5/decide': () => problem(422, 'Validation failed'),
      'POST /api/v1/buyer/approvals': () =>
        problem(409, 'Conflict', { code: 'APPROVAL_ALREADY_PENDING' }),
    });
    await expect(
      call(
        decideApproval,
        {
          params: { approvalId: 5 },
          body: { decision: 'approve', subjectVersion: 1, contentHash: 'a'.repeat(64) },
        },
        { tenantId: 44 },
      ),
    ).rejects.toBeInstanceOf(ApiError);
    expect(requests[0]?.headers['x-tenant-id']).toBe('44');
    await expect(
      call(
        requestApproval,
        {
          body: {
            subjectType: 'tender_release',
            subjectId: 1,
            subjectVersion: 1,
            contentHash: 'a'.repeat(64),
            title: 'Release',
            justification: 'Ready',
          },
        },
        { idempotencyKey: 'key-1' },
      ),
    ).rejects.toMatchObject({ kind: 'conflict', code: 'APPROVAL_ALREADY_PENDING' });
    expect(requests[1]?.headers['idempotency-key']).toBe('key-1');
  });

  it('omits the token on public endpoints', async () => {
    adapters();
    const { requests } = installFetch({
      'GET /api/v1/public/test-health': () => ({ body: { ok: true } }),
    });
    await call(publicHealth, {});
    expect(requests[0]?.headers.authorization).toBeUndefined();
  });

  it('refuses an area call without an active tenant and a row action without the row tenant', async () => {
    adapters({ tenant: null });
    installFetch({});
    await expect(call(buyerTenders, { params: { tenderId: 1 }, query: {} })).rejects.toMatchObject({
      kind: 'tenant_required',
    });
    await expect(
      call(decideApproval, {
        params: { approvalId: 5 },
        body: { decision: 'approve', subjectVersion: 1, contentHash: 'a'.repeat(64) },
      }),
    ).rejects.toMatchObject({ kind: 'tenant_required' });
  });
});

describe('call: responses', () => {
  it('normalizes problem+json into status, title, field errors and correlation id', async () => {
    adapters();
    installFetch({
      'PUT /api/v1/me/theme': () =>
        problem(422, 'Validation failed', {
          code: 'VALIDATION_FAILED',
          errors: [{ field: 'theme', code: 'INVALID', message: 'Choose light or dark.' }],
        }),
    });
    const error = await call(updateTheme, { body: { theme: 'dark' } }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.kind).toBe('validation');
    expect(apiError.correlationId).toBe('corr-test-1');
    expect(fieldErrorsFor(apiError, 'theme')).toHaveLength(1);
  });

  it('signs out on 401', async () => {
    const onUnauthorized = vi.fn();
    adapters({ onUnauthorized });
    installFetch({ 'GET /api/v1/me/task-summary': () => problem(401, 'Unauthenticated') });
    await expect(call(getMyTaskSummary, {})).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('rejects a response that drifts from the contract in development builds', async () => {
    adapters();
    installFetch({ 'GET /api/v1/me/task-summary': () => ({ body: { open: 'three' } }) });
    await expect(call(getMyTaskSummary, {})).rejects.toMatchObject({ kind: 'contract' });
  });

  it('reports a network failure as a network error', async () => {
    adapters();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(call(getMyTaskSummary, {})).rejects.toMatchObject({ kind: 'network', status: 0 });
  });

  it('keeps a non-problem error status with the correlation header', async () => {
    adapters();
    installFetch({
      'GET /api/v1/me/task-summary': () => ({
        status: 500,
        body: 'oops',
        headers: { 'x-correlation-id': 'corr-9' },
      }),
    });
    await expect(call(getMyTaskSummary, {})).rejects.toMatchObject({
      kind: 'server',
      correlationId: 'corr-9',
    });
  });
});
