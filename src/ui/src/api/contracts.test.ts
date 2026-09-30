import { afterEach, describe, expect, it } from 'vitest';

import { installFetch, problem } from '../test/fetchMock';
import { configureApiClient, isApiError } from './client';
import { decideChange, list, supplierList } from './contracts';

const restores: Array<() => void> = [];
function adapters(tenant: number | null) {
  restores.push(
    configureApiClient({
      getAccessToken: () => Promise.resolve('jwt-1'),
      getActiveTenantId: () => tenant,
      onUnauthorized: () => undefined,
    }),
  );
}
afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
});

const summary = {
  byStatus: [],
  upcomingDecisions: 0,
  renewalsWithin90Days: 0,
  overdueObligations: 0,
  currentValueByCurrency: [],
};

describe('contracts client', () => {
  it('lists the buyer register with the active tenant and the filters in the query string', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({
      'GET /api/v1/buyer/contracts': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25, summary },
      }),
    });

    // Act
    const result = await list({
      query: { status: ['active', 'suspended'], renewalWithinDays: 90 },
    });

    // Assert
    expect(result.total).toBe(0);
    expect(requests[0]?.search).toBe('?status=active&status=suspended&renewalWithinDays=90');
    expect(requests[0]?.headers['x-tenant-id']).toBe('2');
  });

  it('lists the supplier’s own contracts under the supplier audience', async () => {
    // Arrange
    adapters(4);
    const { requests } = installFetch({
      'GET /api/v1/supplier/contracts': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      }),
    });

    // Act
    await supplierList({ query: {} });

    // Assert
    expect(requests[0]?.headers['x-tenant-id']).toBe('4');
  });

  it('surfaces the cumulative authority refusal of a change decision as an ApiError with its code', async () => {
    // Arrange
    adapters(2);
    installFetch({
      'POST /api/v1/buyer/contracts/1/change-requests/14803/decision': () =>
        problem(403, 'Forbidden', { code: 'CUMULATIVE_AUTHORITY_EXCEEDED' }),
    });

    // Act
    const outcome = await decideChange({
      params: { contractId: 1, changeId: 14803 },
      body: { decision: 'approve', reason: 'Approve.' },
    }).catch((error: unknown) => error);

    // Assert
    expect(isApiError(outcome) && outcome.code).toBe('CUMULATIVE_AUTHORITY_EXCEEDED');
  });
});
