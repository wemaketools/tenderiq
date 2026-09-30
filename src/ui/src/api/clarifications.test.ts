import { afterEach, describe, expect, it } from 'vitest';

import { installFetch } from '../test/fetchMock';
import { publicEdition, questionsList, supplierAddendaAcknowledge } from './clarifications';
import { configureApiClient } from './client';

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

describe('clarifications client', () => {
  it('lists buyer questions with the active tenant and the filters in the query string', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({
      'GET /api/v1/buyer/clarifications/questions': () => ({
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      }),
    });

    // Act
    const result = await questionsList({
      query: { tenderId: 2, status: ['received', 'assigned'] },
    });

    // Assert
    expect(result.total).toBe(0);
    expect(requests[0]?.search).toBe('?tenderId=2&status=received&status=assigned');
    expect(requests[0]?.headers['x-tenant-id']).toBe('2');
  });

  it('acknowledges an addendum with an idempotency key', async () => {
    adapters(5);
    const { requests } = installFetch({
      'POST /api/v1/supplier/clarifications/addenda/21/acknowledge': () => ({
        status: 201,
        body: {
          addendumId: 21,
          acknowledgedAt: '2026-09-30T12:00:00Z',
          acknowledgedBy: { userId: 29, fullName: 'Bakang Chobe' },
          requiredAction: 'acknowledge',
          requiredActionCompleted: true,
          priorSubmission: null,
        },
      }),
    });

    const result = await supplierAddendaAcknowledge({
      params: { addendumId: 21 },
      body: { confirmed: true },
    });

    expect(result.requiredActionCompleted).toBe(true);
    expect(requests[0]?.headers['idempotency-key']).toBeDefined();
    expect(requests[0]?.headers['x-tenant-id']).toBe('5');
  });

  it('reads the public edition without a tenant header', async () => {
    adapters(null);
    const { requests } = installFetch({
      'GET /api/v1/public/clarifications/kwu/T-2026-0002': () => ({
        body: {
          tender: {
            reference: 'T-2026-0002',
            title: 'Smart water meter supply',
            buyer: { slug: 'kwu', name: 'Kalahari Water Utilities (Pilot)' },
            status: 'open',
            officialTimeZone: 'Africa/Gaborone',
            currentVersionNo: 2,
            submissionDeadline: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
            lots: [],
          },
          questions: [],
          addenda: [],
          editionAt: null,
        },
      }),
    });

    const edition = await publicEdition({
      params: { buyerSlug: 'kwu', ref: 'T-2026-0002' },
      query: {},
    });

    expect(edition.tender.reference).toBe('T-2026-0002');
    expect(requests[0]?.headers['x-tenant-id']).toBeUndefined();
  });
});
