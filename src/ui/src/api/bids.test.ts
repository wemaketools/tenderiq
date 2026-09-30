import { afterEach, describe, expect, it } from 'vitest';

import { installFetch, problem } from '../test/fetchMock';
import { closeTender, downloadReceipt, listBids, submitBid } from './bids';
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

const RECEIPT_HASH = 'a'.repeat(64);

describe('bids client', () => {
  it('lists responses with the active supplier tenant and repeated filters in the query string', async () => {
    // Arrange
    adapters(4);
    const { requests } = installFetch({
      'GET /api/v1/supplier/bids': () => ({ body: { items: [], total: 0, page: 1, pageSize: 25 } }),
    });

    // Act
    const page = await listBids({
      query: { submissionState: ['not_submitted', 'submitted'], roundType: ['initial'] },
    });

    // Assert
    expect(page.total).toBe(0);
    expect(requests[0]?.search).toBe(
      '?submissionState=not_submitted&submissionState=submitted&roundType=initial',
    );
    expect(requests[0]?.headers['x-tenant-id']).toBe('4');
  });

  it('sends an idempotency key with the submission and surfaces a late rejection as an API error', async () => {
    // Arrange
    adapters(7);
    const { requests } = installFetch({
      'POST /api/v1/supplier/bids/7/submit': () =>
        problem(409, 'Conflict', {
          code: 'SUBMISSION_LATE',
          detail: 'Final receipt would complete after the official deadline.',
        }),
    });

    // Act
    const failure = await submitBid(
      {
        params: { bidId: 7 },
        body: {
          revisionId: 71,
          contentHash: RECEIPT_HASH,
          confirmation: { tenantId: 7, capacity: 'Managing Director' },
          finalDeclarationAccepted: true,
        },
      },
      { idempotencyKey: 'submit-71' },
    ).catch((error: unknown) => error);

    // Assert
    expect(isApiError(failure) && failure.code).toBe('SUBMISSION_LATE');
    expect(requests[0]?.headers['idempotency-key']).toBe('submit-71');
  });

  it('reads the printable receipt', async () => {
    // Arrange
    adapters(4);
    installFetch({
      'GET /api/v1/supplier/receipts/12/download': () => ({
        body: {
          fileName: 'RCPT-2026-000012.txt',
          contentType: 'text/plain',
          content: 'OFFICIAL SUBMISSION RECEIPT\n',
        },
      }),
    });

    // Act
    const file = await downloadReceipt({ params: { receiptId: 12 } });

    // Assert
    expect(file.fileName).toBe('RCPT-2026-000012.txt');
  });

  it('closes a tender in the active buyer tenant', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({
      'POST /api/v1/buyer/submission-monitoring/tenders/6/close': () => ({
        body: {
          tenderId: 6,
          reference: 'T-2026-0006',
          status: 'closed',
          closingStatus: 'closed',
          closedAt: '2026-10-15T06:00:00Z',
          closedBy: { userId: 5, fullName: 'Tebogo Molefe', capacity: 'Procurement Officer' },
          deadline: { at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' },
          effectiveSupplierCount: 1,
          lateAttemptCount: 0,
          note: null,
        },
      }),
    });

    // Act
    const record = await closeTender({
      params: { tenderId: 6 },
      body: { confirmation: { tenantId: 2, capacity: 'Procurement Officer' } },
    });

    // Assert
    expect(record.effectiveSupplierCount).toBe(1);
    expect(requests[0]?.headers['x-tenant-id']).toBe('2');
  });
});
