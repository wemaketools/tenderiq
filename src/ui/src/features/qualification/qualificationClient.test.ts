import { afterEach, describe, expect, it } from 'vitest';

import { configureApiClient, isApiError } from '../../api/client';
import {
  checkEligibility,
  fetchFinancialReview,
  listApplications,
  listSupplierDecisions,
  requestInformation,
} from '../../api/qualification';
import { installFetch, problem } from '../../test/fetchMock';

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

const emptyPage = { items: [], total: 0, page: 1, pageSize: 25 };

describe('qualification client', () => {
  it('lists the review queue with the active buyer tenant and repeated status filters', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({
      'GET /api/v1/buyer/qualification/applications': () => ({ body: emptyPage }),
    });

    // Act
    const result = await listApplications({
      status: ['under_review', 'more_info_required'],
      overdue: true,
    });

    // Assert
    expect(result.total).toBe(0);
    expect(requests[0]?.search).toBe('?status=under_review&status=more_info_required&overdue=true');
    expect(requests[0]?.headers['x-tenant-id']).toBe('2');
  });

  it('surfaces the restricted financial review panel as a forbidden ApiError (AC-08)', async () => {
    // Arrange
    adapters(2);
    installFetch({
      'GET /api/v1/buyer/qualification/applications/503/financial-review': () =>
        problem(403, 'Forbidden', { code: 'FORBIDDEN' }),
    });

    // Act
    const outcome = await fetchFinancialReview(503).catch((error: unknown) => error);

    // Assert
    expect(isApiError(outcome) && outcome.kind).toBe('forbidden');
  });

  it('sends an idempotency key with an information request', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({
      'POST /api/v1/buyer/qualification/applications/503/info-requests': () =>
        problem(409, 'Conflict', { code: 'APPLICATION_NOT_UNDER_REVIEW' }),
    });

    // Act
    const outcome = await requestInformation(
      503,
      {
        criterionId: 11203,
        question: 'Provide audited statements.',
        dueAt: '2026-10-20T13:00:00Z',
      },
      { idempotencyKey: 'key-1' },
    ).catch((error: unknown) => error);

    // Assert
    expect(requests[0]?.headers['idempotency-key']).toBe('key-1');
    expect(isApiError(outcome) && outcome.code).toBe('APPLICATION_NOT_UNDER_REVIEW');
  });

  it('checks eligibility with the supplier and category in the query', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({
      'GET /api/v1/buyer/qualification/eligibility': () =>
        problem(404, 'Not found', { code: 'SUPPLIER_NOT_FOUND' }),
    });

    // Act
    await checkEligibility({ supplierTenantId: 6, categoryId: 202 }).catch(() => undefined);

    // Assert
    expect(requests[0]?.search).toBe('?supplierTenantId=6&categoryId=202');
  });

  it('lists the supplier’s own decisions under the supplier audience', async () => {
    // Arrange
    adapters(8);
    const { requests } = installFetch({
      'GET /api/v1/supplier/qualification/decisions': () => ({ body: emptyPage }),
    });

    // Act
    await listSupplierDecisions({ includeSuperseded: true });

    // Assert
    expect(requests[0]?.headers['x-tenant-id']).toBe('8');
    expect(requests[0]?.search).toBe('?includeSuperseded=true');
  });
});
