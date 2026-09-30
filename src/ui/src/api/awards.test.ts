import { afterEach, describe, expect, it } from 'vitest';

import { installFetch, problem } from '../test/fetchMock';
import { listAwards, listPublicAwards, requestDebrief, finalAwardLotOutcome } from './awards';
import { configureApiClient, isApiError } from './client';

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

describe('awards client', () => {
  it('lists the award register with the active tenant and repeated filters', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({ 'GET /api/v1/buyer/awards': () => ({ body: emptyPage }) });

    // Act
    const result = await listAwards({
      query: { status: ['award_pending', 'partially_awarded'], hasActiveHold: true },
    });

    // Assert
    expect(result.total).toBe(0);
    expect(requests[0]?.search).toBe(
      '?status=award_pending&status=partially_awarded&hasActiveHold=true',
    );
    expect(requests[0]?.headers['x-tenant-id']).toBe('2');
  });

  it('lists public awards without a tenant header', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({ 'GET /api/v1/public/awards': () => ({ body: emptyPage }) });

    // Act
    await listPublicAwards({ query: { buyerSlug: 'kwu' } });

    // Assert
    expect(requests[0]?.headers['x-tenant-id']).toBeUndefined();
  });

  it('sends an idempotency key with a debrief request', async () => {
    // Arrange
    adapters(5);
    const { requests } = installFetch({
      'POST /api/v1/supplier/outcomes/7/debrief-requests': () => ({
        status: 201,
        body: {
          debriefId: 900,
          status: 'requested',
          requestedBy: { userId: 29, fullName: 'Bakang Chobe' },
          requestedAt: '2026-09-30T08:00:00Z',
          dueAt: { at: '2026-10-06T15:00:00Z', timeZone: 'Africa/Gaborone' },
          meetingAt: null,
          writtenResponse: null,
          effectOnDeadlines: 'To be assessed.',
          declineReason: null,
          ownResult: null,
        },
      }),
    });

    // Act
    const result = await requestDebrief(
      { params: { tenderId: 7 }, body: {} },
      { idempotencyKey: 'key-1' },
    );

    // Assert
    expect(result.status).toBe('requested');
    expect(requests[0]?.headers['idempotency-key']).toBe('key-1');
  });

  it('surfaces the blocking hold as an API error with its code (AC-25)', async () => {
    // Arrange
    adapters(2);
    installFetch({
      'POST /api/v1/buyer/lot-outcomes/141/final-award': () =>
        problem(409, 'Conflict', {
          code: 'FINAL_AWARD_BLOCKED_BY_HOLD',
          detail: 'Complaint hold active.',
        }),
    });

    // Act
    const error = await finalAwardLotOutcome({
      params: { lotOutcomeId: 141 },
      body: { confirmation: true },
    }).catch((caught: unknown) => caught);

    // Assert
    expect(isApiError(error) && error.code).toBe('FINAL_AWARD_BLOCKED_BY_HOLD');
  });
});
