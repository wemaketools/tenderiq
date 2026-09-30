import { afterEach, describe, expect, it } from 'vitest';

import { installFetch } from '../test/fetchMock';
import { configureApiClient } from './client';
import { acknowledge, publicNotice, publish, searchPublic } from './publication';

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

const noticeSummary = {
  reference: 'T-2026-0002',
  buyer: {
    tenantId: 2,
    slug: 'kwu',
    name: 'Kalahari Water Utilities (Pilot)',
    officialTimeZone: 'Africa/Gaborone',
  },
  title: 'Smart water meter supply',
  summary: null,
  eventType: 'rfq',
  procedure: 'open',
  category: { code: 'WTR-METER', name: 'Water meters and metering', parentCode: null },
  regions: ['South-East District'],
  status: 'open',
  isAcceptingResponses: true,
  publishedAt: '2026-09-01T07:00:00Z',
  closingAt: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
  lotCount: 0,
  currentVersionNo: 2,
  amendmentCount: 1,
  lastAmendedAt: '2026-09-24T08:00:00Z',
  linkPath: '/opportunities/kwu/T-2026-0002',
};

describe('publication client', () => {
  it('searches public notices without a tenant header and with repeated filters', async () => {
    // Arrange
    adapters(2);
    const { requests } = installFetch({
      'GET /api/v1/public/opportunities': () => ({
        body: { items: [noticeSummary], total: 1, page: 1, pageSize: 25 },
      }),
    });

    // Act
    const page = await searchPublic({ query: { status: ['open', 'closed'], buyer: ['kwu'] } });

    // Assert
    expect(page.items[0]?.reference).toBe('T-2026-0002');
    expect(requests[0]?.search).toBe('?status=open&status=closed&buyer=kwu');
    expect(requests[0]?.headers['x-tenant-id']).toBeUndefined();
  });

  it('reads a notice by buyer slug and reference (DD-22)', async () => {
    adapters(null);
    const { requests } = installFetch({
      'GET /api/v1/public/opportunities/kwu/T-2026-0002': () => ({
        body: {
          ...noticeSummary,
          officialTimeZone: 'Africa/Gaborone',
          eligibilitySummary: null,
          deliveryRequirements: null,
          submissionRules: null,
          communicationChannelNote: null,
          acceptedLanguages: ['en'],
          lots: [],
          milestones: [],
          documents: [],
          documentPolicy: 'public',
          restrictedDocumentCount: 2,
          conditions: [],
          addenda: [],
          versions: [],
          cancellation: null,
          outcome: null,
          participationRoutes: {
            registerInterest: true,
            requestAccess: false,
            startParticipation: true,
          },
          clarificationsLinkPath: '/clarifications/kwu/T-2026-0002',
        },
      }),
    });

    const notice = await publicNotice({ params: { buyerSlug: 'kwu', reference: 'T-2026-0002' } });

    expect(notice.restrictedDocumentCount).toBe(2);
    expect(requests[0]?.path).toBe('/api/v1/public/opportunities/kwu/T-2026-0002');
  });

  it('publishes with the active buyer tenant and an idempotency key', async () => {
    adapters(3);
    const { requests } = installFetch({
      'POST /api/v1/buyer/tenders/13/publication/publish': () => ({
        status: 201,
        body: {
          tenderId: 13,
          tenderStatus: 'open',
          scheduledReleaseAt: null,
          releasedAt: '2026-09-30T08:00:00Z',
          publications: [],
          message: 'Published.',
        },
      }),
    });

    const outcome = await publish({
      params: { tenderId: 13 },
      body: { mode: 'now', channels: ['portal'], draftRevision: 2 },
    });

    expect(outcome.tenderStatus).toBe('open');
    expect(requests[0]?.headers['x-tenant-id']).toBe('3');
    expect(requests[0]?.headers['idempotency-key']).toBeDefined();
    expect(requests[0]?.body).toEqual({ mode: 'now', channels: ['portal'], draftRevision: 2 });
  });

  it('acknowledges an addendum for the active supplier organization', async () => {
    adapters(5);
    const { requests } = installFetch({
      'POST /api/v1/supplier/opportunities/2/acknowledgments': () => ({
        status: 201,
        body: {
          participantId: 205,
          subjectType: 'addendum',
          subjectId: 21,
          acknowledgedAt: '2026-09-30T08:00:00Z',
          acknowledgedBy: { userId: 29, fullName: 'Bakang Chobe' },
        },
      }),
    });

    const receipt = await acknowledge({
      params: { tenderId: 2 },
      body: { subjectType: 'addendum', subjectId: 21 },
    });

    expect(receipt.acknowledgedBy.fullName).toBe('Bakang Chobe');
    expect(requests[0]?.headers['x-tenant-id']).toBe('5');
  });
});
