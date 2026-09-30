/**
 * Publication mock handlers: public portal isolation (AC-01), buyer tenant scoping, supplier isolation, the
 * buyer never seeing pursuits (DD-41), permission denials and the declared business errors of the commands.
 *
 * Runs offline with the test-only fixture verifier and a fixed clock inside the storyline (30 Sep 2026).
 */
import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import { DownloadLink } from '../../../contracts/documents.js';
import { buildUrl } from '../../../contracts/endpoint.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import {
  BuyerPortal,
  InvitationDetail,
  OpportunityFilters,
  OpportunityWorkspace,
  ParticipantDetail,
  PublicNotice,
  PublicationOverview,
  publicationEndpoints as ep,
} from '../../../contracts/publication.js';
import { ADDENDA, CLARIFICATION_TENDERS } from '../../fixtures/clarifications/index.js';
import { TENANT_IDS } from '../../fixtures/platform.js';
import { findFixtureTask } from '../../fixtures/tasks.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { register } from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const TEBOGO = 'tebogo.officer@tenderiq.local';
const ODC_OFFICER = 'officer.odc@tenderiq.local';
const TSODILO_BM = 'tsodilo.bidmanager@tenderiq.local';
const CHOBE_BM = 'chobe-pipe.bidmanager@tenderiq.local';
const SEROWE_BM = 'serowe-ict.bidmanager@tenderiq.local';
const MAKGADIKGADI = 'makgadikgadi.admin@tenderiq.local';
const LIMPOPO = 'limpopo-env.admin@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'publication', register }], now: () => NOW });
});

type QueryValue = string | number | boolean | ReadonlyArray<string | number | boolean>;

async function anon(
  endpoint: AnyEndpoint,
  params: Record<string, string | number> = {},
  query: Record<string, QueryValue> = {},
  body?: unknown,
): Promise<TestResponse> {
  return api.request(endpoint.method, buildUrl(endpoint, params), { query, ...(body === undefined ? {} : { body }) });
}

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

function withoutCorrelation(response: TestResponse): Record<string, unknown> {
  const { correlationId: _ignored, ...rest } = Problem.parse(response.body);
  return rest;
}

function items<T>(response: TestResponse, pick: (row: unknown) => T): T[] {
  expect(response.status).toBe(200);
  const body = response.body as { items: unknown[] };
  return body.items.map(pick);
}

const refOf = (row: unknown): string =>
  (row as { reference?: string }).reference ?? (row as { tender: { reference: string } }).tender.reference;

describe('publication module', () => {
  it('registers every contract endpoint of the domain without failures', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('publication');
    expect(api.endpointIds).toEqual(expect.arrayContaining(Object.values(ep).map((endpoint) => endpoint.id)));
    expect(Object.keys(ep)).toHaveLength(62);
  });
});

describe('public portal (AC-01)', () => {
  it('lists only public notices when an anonymous visitor searches', async () => {
    // Act
    const response = await anon(ep.searchPublic, {}, { pageSize: 100 });

    // Assert
    const refs = items(response, refOf);
    expect(refs).toEqual(expect.arrayContaining(['T-2026-0001', 'T-2026-0002', 'T-2026-0008', 'T-2026-0011']));
    for (const hidden of ['T-2026-0005', 'T-2026-0006', 'T-2026-0009', 'T-2026-0012', 'T-2026-0013']) {
      expect(refs).not.toContain(hidden);
    }
    expect((response.body as { total: number }).total).toBe(8);
  });

  it('counts only public notices in the filter options', async () => {
    const response = await anon(ep.publicFilters);
    expect(response.status).toBe(200);
    const body = response.body as { total: number; procedures: Array<{ value: string }>; categories: Array<{ value: string }> };
    expect(body.total).toBe(8);
    expect(body.procedures.map((option) => option.value)).not.toContain('invitation_only');
    expect(body.procedures.map((option) => option.value)).not.toContain('restricted');
    expect(body.categories.map((option) => option.value)).not.toContain('WTR-DOSE');
  });

  it('answers an invitation-only notice exactly like an unknown one', async () => {
    // Act
    const hidden = await anon(ep.publicNotice, { buyerSlug: 'kwu', reference: 'T-2026-0006' });
    const unknown = await anon(ep.publicNotice, { buyerSlug: 'kwu', reference: 'T-2026-0999' });

    // Assert
    expect(hidden.status).toBe(404);
    expect(withoutCorrelation(hidden)).toEqual(withoutCorrelation(unknown));
    expect(problemCode(hidden)).toBe('NOTICE_NOT_FOUND');
    expect(hidden.text).not.toContain('Chlorine');
  });

  it('returns the notice with its amendment history, official deadline and only public documents', async () => {
    const response = await anon(ep.publicNotice, { buyerSlug: 'kwu', reference: 'T-2026-0002' });
    expect(response.status).toBe(200);
    const notice = PublicNotice.parse(response.body);
    expect(notice.addenda).toEqual([expect.objectContaining({ number: 1, materiality: 'material', newSubmissionDeadline: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' } })]);
    expect(notice.versions.map((version) => version.versionNo)).toEqual([1, 2]);
    expect(notice.documents.every((document) => document.classification === 'public')).toBe(true);
    expect(notice.restrictedDocumentCount).toBe(2);
    expect(notice.closingAt).toEqual({ at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' });
    expect(notice.participationRoutes).toEqual({ registerInterest: true, requestAccess: false, startParticipation: true });
  });

  it('labels a closed notice as not accepting responses', async () => {
    const response = await anon(ep.searchPublic, {}, { status: 'closed' });
    const rows = items(response, (row) => row as { reference: string; status: string; isAcceptingResponses: boolean });
    expect(rows).toEqual([expect.objectContaining({ reference: 'T-2026-0008', status: 'closed', isAcceptingResponses: false })]);
  });

  it('filters by a parent category including its descendants', async () => {
    const response = await anon(ep.searchPublic, {}, { category: 'WTR-INFRA', pageSize: 100 });
    expect(new Set(items(response, refOf))).toEqual(new Set(['T-2026-0001', 'T-2026-0008']));
  });

  it('rejects an inverted date range with INVALID_DATE_RANGE', async () => {
    const response = await anon(ep.searchPublic, {}, { closingFrom: '2026-11-01', closingTo: '2026-10-01' });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('INVALID_DATE_RANGE');
  });

  it('downloads a public document whose digest matches the published sha256', async () => {
    const notice = PublicNotice.parse((await anon(ep.publicNotice, { buyerSlug: 'kwu', reference: 'T-2026-0002' })).body);
    const document = notice.documents[0];
    expect(document).toBeDefined();
    const response = await anon(ep.publicDocumentDownload, { buyerSlug: 'kwu', reference: 'T-2026-0002', documentId: document?.documentId ?? 0 });
    expect(response.status).toBe(200);
    const link = DownloadLink.parse(response.body);
    const bytes = Buffer.from(link.url.split(',')[1] ?? '', 'base64');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(document?.sha256);
    expect(bytes.length).toBe(document?.sizeBytes);
  });

  it('refuses a restricted document and requires registration where the buyer’s policy says so', async () => {
    const restricted = await anon(ep.publicDocumentDownload, { buyerSlug: 'kwu', reference: 'T-2026-0002', documentId: 7023 });
    const odc = await anon(ep.publicDocumentDownload, { buyerSlug: 'odc', reference: 'T-2026-0011', documentId: 7111 });
    expect(problemCode(restricted)).toBe('DOCUMENT_NOT_FOUND');
    expect(odc.status).toBe(403);
    expect(problemCode(odc)).toBe('DOCUMENT_REQUIRES_REGISTRATION');
  });

  it('refuses interest in a closed notice and accepts it for an open one', async () => {
    const body = { contactName: 'Neo Kgosi', email: 'neo@example.org', organizationName: 'Kgosi Plumbing (Pty) Ltd', consentToContact: true };
    const closed = await anon(ep.publicRegisterInterest, { buyerSlug: 'kwu', reference: 'T-2026-0008' }, {}, body);
    const open = await anon(ep.publicRegisterInterest, { buyerSlug: 'kwu', reference: 'T-2026-0002' }, {}, body);
    const known = await anon(ep.publicRegisterInterest, { buyerSlug: 'kwu', reference: 'T-2026-0002' }, {}, { ...body, email: 'limpopo-env.admin@tenderiq.local' });
    expect(closed.status).toBe(409);
    expect(problemCode(closed)).toBe('NOTICE_NOT_OPEN');
    expect(open.status).toBe(201);
    expect(open.body).toMatchObject({ nextStep: 'register', nextStepPath: '/register' });
    expect(known.body).toMatchObject({ nextStep: 'sign_in', nextStepPath: '/signin' });
  });

  it('rejects interest without consent with a field error', async () => {
    const response = await anon(
      ep.publicRegisterInterest,
      { buyerSlug: 'kwu', reference: 'T-2026-0002' },
      {},
      { contactName: 'Neo', email: 'neo@example.org', organizationName: 'Kgosi', consentToContact: false },
    );
    expect(response.status).toBe(422);
    expect(Problem.parse(response.body).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'consentToContact', code: 'CONSENT_REQUIRED' })]),
    );
  });

  it('shows a buyer portal and hides a supplier slug', async () => {
    const kwu = await anon(ep.buyerPortal, { buyerSlug: 'kwu' });
    const supplier = await anon(ep.buyerPortal, { buyerSlug: 'tsodilo' });
    expect(kwu.status).toBe(200);
    const portal = BuyerPortal.parse(kwu.body);
    expect(portal.openOpportunities.map((row) => row.reference)).toEqual(['T-2026-0002']);
    expect(portal.advanceNotices.map((notice) => notice.advanceNoticeId)).toEqual([401, 402]);
    expect(supplier.status).toBe(404);
    expect(problemCode(supplier)).toBe('PORTAL_NOT_AVAILABLE');
  });

  it('publishes only public or all-audience guidance', async () => {
    const list = await anon(ep.publicGuidance, {}, { pageSize: 100 });
    const slugs = items(list, (row) => (row as { slug: string }).slug);
    expect(slugs).toContain('registering-your-organization');
    expect(slugs).not.toContain('buyer-publication-checklist');
    expect(slugs).not.toContain('using-tenderiq-in-setswana');
    expect(slugs).not.toContain('after-award-contracts');
    const hidden = await anon(ep.publicGuidanceArticle, { articleSlug: 'buyer-publication-checklist' });
    expect(problemCode(hidden)).toBe('ARTICLE_NOT_FOUND');
  });

  it('shows open opportunities and every portal buyer on the home page', async () => {
    const response = await anon(ep.portalHome);
    expect(response.status).toBe(200);
    const home = response.body as { buyers: Array<{ slug: string }>; openOpportunityCount: number; recentOutcomes: Array<{ reference: string }> };
    expect(home.buyers.map((buyer) => buyer.slug)).toEqual(['kwu', 'odc']);
    expect(home.openOpportunityCount).toBe(2);
    expect(home.recentOutcomes.map((outcome) => outcome.reference)).toEqual(expect.arrayContaining(['T-2026-0001', 'T-2026-0010']));
  });
});

describe('buyer publication (BUY-14, AC-33)', () => {
  it('lists only the active buyer’s publications', async () => {
    const kwu = await api.callAs(TEBOGO, ep.listPublications, { tenant: 'kwu', query: { pageSize: 100 } });
    const odc = await api.callAs(ODC_OFFICER, ep.listPublications, { tenant: 'odc', query: { pageSize: 100 } });
    expect(items(kwu, refOf).every((reference) => !['T-2026-0011', 'T-2026-0013'].includes(reference))).toBe(true);
    expect(new Set(items(odc, refOf))).toEqual(new Set(['T-2026-0011', 'T-2026-0013']));
  });

  it('keeps T-2026-0002 visibly unconfirmed while its external notice failed', async () => {
    const response = await api.callAs(TEBOGO, ep.publicationOverview, { tenant: 'kwu', params: { tenderId: 2 } });
    expect(response.status).toBe(200);
    const overview = PublicationOverview.parse(response.body);
    expect(overview.isAdvertised).toBe(false);
    expect(overview.checks.find((check) => check.id === 'external_confirmation')?.status).toBe('blocking');
    const failed = overview.publications.find((row) => row.id === 222);
    // The exception links only a task the tasks fixtures hold for KWU (the reconciliation task 190), never a dead id.
    const reconciliationTask = findFixtureTask(190);
    expect(failed).toMatchObject({
      status: 'failed',
      reconciled: false,
      isCurrentVersion: true,
      exception: expect.objectContaining({ status: 'open', taskId: reconciliationTask?.tenantId === TENANT_IDS.kwu ? 190 : null }),
    });
    expect(overview.capabilities).toMatchObject({ canRetryExternal: true, canReconcile: true, canPublish: false, canDistributeInvitations: true });
    expect(overview.audience).toMatchObject({ publicNoticePath: '/opportunities/kwu/T-2026-0002', pendingInvitationCount: 1 });
  });

  it('offers no public notice link for a tender that is not released yet (no dead link)', async () => {
    const response = await api.callAs(TEBOGO, ep.publicationOverview, { tenant: 'kwu', params: { tenderId: 5 } });
    expect(response.status).toBe(200);
    const overview = PublicationOverview.parse(response.body);
    expect(overview.tender.releasedAt).toBeNull();
    expect(overview.audience.publicNoticePath).toBeNull();
    const notice = await anon(ep.publicNotice, { buyerSlug: 'kwu', reference: 'T-2026-0005' });
    expect(notice.status).toBe(404);
  });

  it('shows the release approval decided on the date the tenders fixtures record (one approval record)', async () => {
    const overview = PublicationOverview.parse((await api.callAs(TEBOGO, ep.publicationOverview, { tenant: 'kwu', params: { tenderId: 2 } })).body);
    expect(overview.releaseApproval).toMatchObject({ approvalRequestId: 202, status: 'approved', subjectVersion: 2, approvedAt: '2026-09-12T08:30:00Z' });
  });

  it('shows an invitation-only event without a public notice path', async () => {
    const overview = PublicationOverview.parse((await api.callAs(TEBOGO, ep.publicationOverview, { tenant: 'kwu', params: { tenderId: 6 } })).body);
    expect(overview.audience).toMatchObject({ participation: 'invitation_only', publicNoticePath: null, invitedCount: 2 });
    expect(overview.isAdvertised).toBe(true);
  });

  it('flags failed or unconfirmed external notices with needsAttention', async () => {
    const response = await api.callAs(TEBOGO, ep.listPublications, { tenant: 'kwu', query: { needsAttention: true } });
    expect(items(response, (row) => (row as { id: number }).id)).toEqual([222]);
  });

  it('hides another buyer’s tender as not found', async () => {
    const response = await api.callAs(TEBOGO, ep.publicationOverview, { tenant: 'kwu', params: { tenderId: 11 } });
    expect(response.status).toBe(404);
    expect(problemCode(response)).toBe('TENDER_NOT_FOUND');
  });

  it('blocks publication without a current release approval (AC-06)', async () => {
    const invalidated = await api.callAs(TEBOGO, ep.publish, { tenant: 'kwu', params: { tenderId: 5 }, body: { mode: 'now', channels: ['portal'], draftRevision: 3 } });
    const draft = await api.callAs(TEBOGO, ep.publish, { tenant: 'kwu', params: { tenderId: 12 }, body: { mode: 'now', channels: ['portal'], draftRevision: 2 } });
    expect(invalidated.status).toBe(409);
    expect(problemCode(invalidated)).toBe('RELEASE_APPROVAL_INVALIDATED');
    expect(problemCode(draft)).toBe('RELEASE_APPROVAL_MISSING');
  });

  it('publishes a ready tender now and reports the external notice as awaiting confirmation', async () => {
    const response = await api.callAs(ODC_OFFICER, ep.publish, {
      tenant: 'odc',
      params: { tenderId: 13 },
      body: { mode: 'now', channels: ['portal', 'external_notice'], draftRevision: 2 },
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ tenderId: 13, tenderStatus: 'open', releasedAt: '2026-09-30T08:00:00Z' });
    const statuses = (response.body as { publications: Array<{ channel: string; status: string }> }).publications.map((row) => `${row.channel}:${row.status}`);
    expect(statuses).toEqual(['portal:published', 'external_notice:awaiting_confirmation']);
  });

  it('publishes a scheduled tender now on its existing publication rows, one per version and channel (DD-07)', async () => {
    const response = await api.callAs(ODC_OFFICER, ep.publish, {
      tenant: 'odc',
      params: { tenderId: 13 },
      body: { mode: 'now', channels: ['portal', 'external_notice'], draftRevision: 2 },
    });
    const rows = (response.body as { publications: Array<{ id: number; versionNo: number; channel: string }> }).publications;
    expect(rows.map((row) => `${row.id}:${row.versionNo}:${row.channel}`)).toEqual(['1311:1:portal', '1312:1:external_notice']);
  });

  it('states release dates in official time, never as raw instants (DD-33)', async () => {
    const overview = PublicationOverview.parse((await api.callAs(TEBOGO, ep.publicationOverview, { tenant: 'kwu', params: { tenderId: 2 } })).body);
    const released = await api.callAs(TEBOGO, ep.publish, { tenant: 'kwu', params: { tenderId: 2 }, body: { mode: 'now', channels: ['portal'], draftRevision: 3 } });
    const scheduled = await api.callAs(ODC_OFFICER, ep.publish, {
      tenant: 'odc',
      params: { tenderId: 13 },
      body: { mode: 'scheduled', scheduledAt: '2026-10-22T06:00:00Z', channels: ['portal'], draftRevision: 2 },
    });
    expect(overview.checks.find((check) => check.id === 'tender_state')?.detail).toBe('Released on 14 Sep 2026, 09:00 (UTC+02:00) Africa/Gaborone.');
    expect(Problem.parse(released.body).detail).toBe('T-2026-0002 was released on 14 Sep 2026, 09:00 (UTC+02:00) Africa/Gaborone.');
    expect((scheduled.body as { message: string }).message).toBe('T-2026-0013 is scheduled for release on 22 Oct 2026, 08:00 (UTC+02:00) Africa/Gaborone.');
  });

  it('schedules a ready tender', async () => {
    const response = await api.callAs(ODC_OFFICER, ep.publish, {
      tenant: 'odc',
      params: { tenderId: 13 },
      body: { mode: 'scheduled', scheduledAt: '2026-10-22T06:00:00Z', channels: ['portal'], draftRevision: 2 },
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ tenderStatus: 'ready', scheduledReleaseAt: '2026-10-22T06:00:00Z', publications: [expect.objectContaining({ status: 'scheduled' })] });
  });

  it.each([
    [{ mode: 'scheduled', scheduledAt: '2026-09-01T06:00:00Z', channels: ['portal'], draftRevision: 2 }, 'SCHEDULE_IN_PAST', 422],
    [{ mode: 'scheduled', scheduledAt: '2026-12-01T06:00:00Z', channels: ['portal'], draftRevision: 2 }, 'SCHEDULE_AFTER_DEADLINE', 422],
    [{ mode: 'now', channels: ['portal'], draftRevision: 1 }, 'DRAFT_REVISION_CHANGED', 409],
  ])('refuses an invalid schedule or stale revision (%#)', async (body, code, status) => {
    const response = await api.callAs(ODC_OFFICER, ep.publish, { tenant: 'odc', params: { tenderId: 13 }, body });
    expect(response.status).toBe(status);
    expect(problemCode(response)).toBe(code);
  });

  it('refuses to publish an already released tender', async () => {
    const response = await api.callAs(TEBOGO, ep.publish, { tenant: 'kwu', params: { tenderId: 2 }, body: { mode: 'now', channels: ['portal'], draftRevision: 3 } });
    expect(problemCode(response)).toBe('ALREADY_PUBLISHED');
  });

  it('requires a scheduled time for a scheduled release', async () => {
    const response = await api.callAs(ODC_OFFICER, ep.publish, { tenant: 'odc', params: { tenderId: 13 }, body: { mode: 'scheduled', channels: ['portal'], draftRevision: 2 } });
    expect(response.status).toBe(422);
    expect(Problem.parse(response.body).errors).toEqual([expect.objectContaining({ field: 'scheduledAt', code: 'SCHEDULE_REQUIRED' })]);
  });

  it('cancels the scheduled release of T-2026-0013 and refuses it where nothing is scheduled', async () => {
    const ok = await api.callAs(ODC_OFFICER, ep.cancelSchedule, { tenant: 'odc', params: { tenderId: 13 }, body: { reason: 'Council meeting moved.' } });
    const none = await api.callAs(ODC_OFFICER, ep.cancelSchedule, { tenant: 'odc', params: { tenderId: 11 }, body: { reason: 'Nothing scheduled.' } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ scheduledReleaseAt: null, tenderStatus: 'ready' });
    expect((ok.body as { publications: Array<{ status: string }> }).publications.every((row) => row.status === 'withdrawn')).toBe(true);
    expect(problemCode(none)).toBe('NOT_SCHEDULED');
  });

  it('denies publishing to a read-only auditor, a supplier organization and an operator', async () => {
    const auditor = await api.callAs('pule.auditor@tenderiq.local', ep.publish, { tenant: 'kwu', params: { tenderId: 5 }, body: { mode: 'now', channels: ['portal'], draftRevision: 3 } });
    const supplier = await api.callAs(TSODILO_BM, ep.publicationOverview, { tenant: 'tsodilo', params: { tenderId: 2 } });
    const operator = await api.callAs('ops.admin@tenderiq.local', ep.listParticipants, { tenant: 'kwu', params: { tenderId: 2 } });
    expect(auditor.status).toBe(403);
    expect(problemCode(auditor)).toBe('FORBIDDEN');
    expect(supplier.status).toBe(403);
    expect(operator.status).toBe(403);
    expect(problemCode(operator)).toBe('TENANT_ACCESS_DENIED');
  });

  it('retries and reconciles the failed external notice', async () => {
    const retried = await api.callAs(TEBOGO, ep.retryExternal, { tenant: 'kwu', params: { publicationId: 222 } });
    const notFailed = await api.callAs(TEBOGO, ep.retryExternal, { tenant: 'kwu', params: { publicationId: 212 } });
    const portal = await api.callAs(TEBOGO, ep.retryExternal, { tenant: 'kwu', params: { publicationId: 221 } });
    const reconcileBody = {
      outcome: 'confirmed',
      externalReference: 'BGG-2026-09-1044',
      confirmationReceivedAt: '2026-09-29T10:00:00Z',
      resolution: 'Addendum split into two attachments and republished.',
    };
    const mismatch = await api.callAs(TEBOGO, ep.reconcileExternal, { tenant: 'kwu', params: { publicationId: 222 }, body: { ...reconcileBody, confirmedVersionNo: 1 } });
    const reconciled = await api.callAs(TEBOGO, ep.reconcileExternal, { tenant: 'kwu', params: { publicationId: 222 }, body: { ...reconcileBody, confirmedVersionNo: 2 } });
    const again = await api.callAs(TEBOGO, ep.reconcileExternal, { tenant: 'kwu', params: { publicationId: 212 }, body: { ...reconcileBody, confirmedVersionNo: 1 } });
    const early = await api.callAs(ODC_OFFICER, ep.reconcileExternal, {
      tenant: 'odc',
      params: { publicationId: 1122 },
      body: { ...reconcileBody, confirmedVersionNo: 2, confirmationReceivedAt: '2026-09-19T10:00:00Z' },
    });
    const otherBuyer = await api.callAs(TEBOGO, ep.retryExternal, { tenant: 'kwu', params: { publicationId: 1122 } });
    expect(retried.body).toMatchObject({ status: 'awaiting_confirmation', exception: { status: 'investigating' } });
    expect(problemCode(notFailed)).toBe('PUBLICATION_NOT_FAILED');
    expect(problemCode(portal)).toBe('NOT_EXTERNAL_CHANNEL');
    expect(problemCode(mismatch)).toBe('VERSION_MISMATCH');
    expect(reconciled.body).toMatchObject({ status: 'confirmed', reconciled: true, exception: { status: 'reconciled' } });
    expect(problemCode(again)).toBe('ALREADY_RECONCILED');
    expect(problemCode(early)).toBe('CONFIRMATION_BEFORE_PUBLICATION');
    expect(problemCode(otherBuyer)).toBe('PUBLICATION_NOT_FOUND');
  });

  it('distributes the pending invitation and refuses when every invitation is answered', async () => {
    const response = await api.callAs(TEBOGO, ep.distributeInvitations, { tenant: 'kwu', params: { tenderId: 2 }, body: {} });
    const none = await api.callAs(TEBOGO, ep.distributeInvitations, { tenant: 'kwu', params: { tenderId: 6 }, body: {} });
    const unreleased = await api.callAs(TEBOGO, ep.distributeInvitations, { tenant: 'kwu', params: { tenderId: 5 }, body: {} });
    const unknown = await api.callAs(TEBOGO, ep.distributeInvitations, { tenant: 'kwu', params: { tenderId: 2 }, body: { participantIds: [999] } });
    expect(response.body).toMatchObject({ sentCount: 1, participants: [expect.objectContaining({ id: 206, deliveryStatus: 'pending' })] });
    expect(problemCode(none)).toBe('NO_PENDING_INVITATIONS');
    expect(problemCode(unreleased)).toBe('TENDER_NOT_RELEASED');
    expect(problemCode(unknown)).toBe('PARTICIPANT_NOT_FOUND');
  });
});

describe('buyer participants (BUY-15)', () => {
  it('lists participants with acknowledgment state but no pursuit data (DD-41)', async () => {
    const response = await api.callAs(TEBOGO, ep.listParticipants, { tenant: 'kwu', params: { tenderId: 2 } });
    expect((response.body as { total: number }).total).toBe(5);
    expect(response.text).not.toMatch(/attractiveness|internalRationale|pursuit/i);
    const outstanding = await api.callAs(TEBOGO, ep.listParticipants, { tenant: 'kwu', params: { tenderId: 2 }, query: { outstandingAcknowledgments: true } });
    expect(new Set(items(outstanding, (row) => (row as { supplier: { name: string } }).supplier.name))).toEqual(new Set(['Chobe Pipe & Valve Supplies']));
    // Makgadikgadi was invited after Addendum 1 and received version 2: it has nothing to acknowledge.
    const all = (response.body as { items: Array<{ id: number; acknowledgments: { required: number; acknowledged: number } }> }).items;
    expect(all.find((row) => row.id === 206)?.acknowledgments).toEqual({ required: 0, acknowledged: 0 });
    expect(all.find((row) => row.id === 204)?.acknowledgments).toEqual({ required: 1, acknowledged: 1 });
    const invited = await api.callAs(TEBOGO, ep.listParticipants, { tenant: 'kwu', params: { tenderId: 2 }, query: { invitationStatus: 'invited' } });
    expect(items(invited, (row) => (row as { id: number }).id)).toEqual([206]);
  });

  it('shows the shared no-bid reason but nothing of the private pursuit', async () => {
    const response = await api.callAs(TEBOGO, ep.getParticipant, { tenant: 'kwu', params: { tenderId: 8, participantId: 809 } });
    const detail = ParticipantDetail.parse(response.body);
    expect(detail).toMatchObject({ bidIntent: 'no_bid', sharedNoBidReason: expect.stringContaining('DN300') });
    expect(response.text).not.toContain('partnering is not worth it');
  });

  it('keeps the invited legal supplier when the contact was replaced', async () => {
    const response = await api.callAs(TEBOGO, ep.getParticipant, { tenant: 'kwu', params: { tenderId: 6, participantId: 605 } });
    const detail = ParticipantDetail.parse(response.body);
    expect(detail.supplier.legalName).toBe('Chobe Pipe & Valve Supplies (Pty) Ltd');
    expect(detail.invitedContactName).toBe('Bakang Chobe');
    expect(detail.history.map((event) => event.event)).toContain('contact_replaced');
    expect(detail.deliveries.map((delivery) => delivery.deliveryStatus)).toEqual(['failed', 'delivered']);
    const replaced = await api.callAs(TEBOGO, ep.replaceContact, {
      tenant: 'kwu',
      params: { tenderId: 6, participantId: 605 },
      body: { contactName: 'Gorata Mphoeng', contactEmail: 'chobe-pipe.signatory@tenderiq.local', reason: 'Bid manager on leave.' },
    });
    expect(replaced.body).toMatchObject({ supplier: { supplierTenantId: 5 }, invitedContactName: 'Gorata Mphoeng' });
    const unchanged = await api.callAs(TEBOGO, ep.replaceContact, {
      tenant: 'kwu',
      params: { tenderId: 6, participantId: 605 },
      body: { contactName: 'Bakang Chobe', contactEmail: 'chobe-pipe.bidmanager@tenderiq.local', reason: 'Same.' },
    });
    const notInvited = await api.callAs(TEBOGO, ep.replaceContact, {
      tenant: 'kwu',
      params: { tenderId: 2, participantId: 209 },
      body: { contactName: 'Kagiso Metsi', contactEmail: 'gaborone-meter.bidmanager@tenderiq.local', reason: 'n/a' },
    });
    expect(problemCode(unchanged)).toBe('CONTACT_UNCHANGED');
    expect(problemCode(notInvited)).toBe('NOT_INVITED');
  });

  it('blocks inviting a supplier without the required qualification (AC-07)', async () => {
    const candidates = await api.callAs(TEBOGO, ep.invitationCandidates, { tenant: 'kwu', params: { tenderId: 6 }, query: { includeParticipants: true } });
    const rows = items(candidates, (row) => row as { supplier: { name: string }; blockedByQualification: boolean; alreadyParticipant: boolean });
    expect(rows.find((row) => row.supplier.name === 'Makgadikgadi Civil Works')).toMatchObject({ blockedByQualification: true, alreadyParticipant: true });
    expect(rows.find((row) => row.supplier.name === 'Tsodilo Engineering')).toMatchObject({ blockedByQualification: false });
    const invite = await api.callAs(TEBOGO, ep.inviteSupplier, {
      tenant: 'kwu',
      params: { tenderId: 6 },
      body: { supplierTenantId: 9, contactName: 'Kagiso Metsi', contactEmail: 'gaborone-meter.bidmanager@tenderiq.local' },
    });
    expect(problemCode(invite)).toBe('SUPPLIER_NOT_QUALIFIED');
  });

  it('invites an eligible supplier and refuses a duplicate participant or a closed event', async () => {
    const ok = await api.callAs(TEBOGO, ep.inviteSupplier, {
      tenant: 'kwu',
      params: { tenderId: 2 },
      body: { supplierTenantId: 8, contactName: 'Mothusi Limpopo', contactEmail: 'limpopo-env.admin@tenderiq.local' },
    });
    const duplicate = await api.callAs(TEBOGO, ep.inviteSupplier, {
      tenant: 'kwu',
      params: { tenderId: 2 },
      body: { supplierTenantId: 7, contactName: 'Otsile Serowe', contactEmail: 'serowe-ict.bidmanager@tenderiq.local' },
    });
    const closed = await api.callAs(TEBOGO, ep.inviteSupplier, {
      tenant: 'kwu',
      params: { tenderId: 8 },
      body: { supplierTenantId: 8, contactName: 'Mothusi Limpopo', contactEmail: 'limpopo-env.admin@tenderiq.local' },
    });
    const buyerTenant = await api.callAs(TEBOGO, ep.inviteSupplier, {
      tenant: 'kwu',
      params: { tenderId: 2 },
      body: { supplierTenantId: 3, contactName: 'Wame Olebile', contactEmail: 'admin.odc@tenderiq.local' },
    });
    const lateExpiry = await api.callAs(TEBOGO, ep.inviteSupplier, {
      tenant: 'kwu',
      params: { tenderId: 2 },
      body: { supplierTenantId: 8, contactName: 'Mothusi Limpopo', contactEmail: 'limpopo-env.admin@tenderiq.local', invitationExpiresAt: '2026-11-30T15:00:00Z' },
    });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ source: 'invited', invitationStatus: 'invited', supplier: { supplierTenantId: 8 } });
    expect(problemCode(duplicate)).toBe('SUPPLIER_ALREADY_PARTICIPANT');
    expect(problemCode(closed)).toBe('TENDER_CLOSED');
    expect(problemCode(buyerTenant)).toBe('SUPPLIER_NOT_FOUND');
    expect(problemCode(lateExpiry)).toBe('INVITATION_EXPIRY_INVALID');
  });

  it('decides the pending access request within the qualification gate', async () => {
    const grant = await api.callAs(TEBOGO, ep.decideAccess, { tenant: 'kwu', params: { tenderId: 6, participantId: 606 }, body: { decision: 'granted', reason: 'Installer.' } });
    const deny = await api.callAs(TEBOGO, ep.decideAccess, {
      tenant: 'kwu',
      params: { tenderId: 6, participantId: 606 },
      body: { decision: 'denied', reason: 'A forwarded invitation does not authorize another organization.' },
    });
    const notRequested = await api.callAs(TEBOGO, ep.decideAccess, { tenant: 'kwu', params: { tenderId: 2, participantId: 209 }, body: { decision: 'denied', reason: 'n/a' } });
    expect(problemCode(grant)).toBe('QUALIFICATION_GATE_NOT_MET');
    expect(deny.body).toMatchObject({ id: 606, accessStatus: 'denied', accessDecidedAt: '2026-09-30T08:00:00Z' });
    expect(problemCode(notRequested)).toBe('ACCESS_NOT_REQUESTED');
  });

  it('summarizes participation with outstanding acknowledgments', async () => {
    const response = await api.callAs(TEBOGO, ep.participantSummary, { tenant: 'kwu', params: { tenderId: 2 } });
    expect(response.body).toMatchObject({
      total: 5,
      invitationsPending: 1,
      accessRequestsPending: 0,
      acknowledgmentsOutstanding: 1,
      intendsToBid: 4,
      // The four recipients of Addendum 1 (BUY-17), of which three acknowledged.
      acknowledgmentSubjects: [expect.objectContaining({ subjectId: 21, acknowledgedCount: 3, requiredCount: 4 })],
      capabilities: { canInvite: true, canManage: true },
    });
  });

  it('sends a reminder only when something is outstanding', async () => {
    const chobe = await api.callAs(TEBOGO, ep.remindParticipant, { tenant: 'kwu', params: { tenderId: 2, participantId: 205 }, body: { topic: 'acknowledgments' } });
    const gaborone = await api.callAs(TEBOGO, ep.remindParticipant, { tenant: 'kwu', params: { tenderId: 2, participantId: 209 }, body: { topic: 'acknowledgments' } });
    const closed = await api.callAs(TEBOGO, ep.remindParticipant, { tenant: 'kwu', params: { tenderId: 8, participantId: 805 }, body: { topic: 'acknowledgments' } });
    expect(chobe.status).toBe(200);
    expect(problemCode(gaborone)).toBe('NOTHING_OUTSTANDING');
    expect(problemCode(closed)).toBe('TENDER_CLOSED');
  });

  it('resends only an unanswered invitation', async () => {
    const pending = await api.callAs(TEBOGO, ep.resendInvitation, { tenant: 'kwu', params: { tenderId: 2, participantId: 206 } });
    const answered = await api.callAs(TEBOGO, ep.resendInvitation, { tenant: 'kwu', params: { tenderId: 6, participantId: 604 } });
    expect(pending.body).toMatchObject({ id: 206, deliveryStatus: 'pending' });
    expect(problemCode(answered)).toBe('INVITATION_NOT_PENDING');
  });

  it('does not reveal ODC participants to a KWU officer', async () => {
    const response = await api.callAs(TEBOGO, ep.listParticipants, { tenant: 'kwu', params: { tenderId: 11 } });
    const participant = await api.callAs(TEBOGO, ep.getParticipant, { tenant: 'kwu', params: { tenderId: 2, participantId: 1108 } });
    expect(problemCode(response)).toBe('TENDER_NOT_FOUND');
    expect(problemCode(participant)).toBe('PARTICIPANT_NOT_FOUND');
  });
});

describe('supplier discovery and workspace (SUP-06, SUP-08)', () => {
  it('shows invitation-only and restricted events only to their participants', async () => {
    const refsFor = async (email: string, tenant: string) =>
      items(await api.callAs(email, ep.listOpportunities, { tenant, query: { pageSize: 100, includeDismissed: true } }), refOf);
    const tsodilo = await refsFor(TSODILO_BM, 'tsodilo');
    const serowe = await refsFor(SEROWE_BM, 'serowe-ict');
    const limpopo = await refsFor(LIMPOPO, 'limpopo-env');
    expect(tsodilo).toContain('T-2026-0006');
    expect(tsodilo).not.toContain('T-2026-0009');
    expect(serowe).toContain('T-2026-0009');
    expect(serowe).not.toContain('T-2026-0006');
    expect(limpopo).not.toContain('T-2026-0006');
    expect(limpopo).toContain('T-2026-0009');
    expect(tsodilo).not.toContain('T-2026-0013');
    const hidden = await api.callAs(SEROWE_BM, ep.opportunityWorkspace, { tenant: 'serowe-ict', params: { tenderId: 6 } });
    expect(problemCode(hidden)).toBe('OPPORTUNITY_NOT_FOUND');
  });

  it('marks matches as suggestions from the profile, saved searches and invitations', async () => {
    const response = await api.callAs(TSODILO_BM, ep.listOpportunities, { tenant: 'tsodilo', query: { matchedOnly: true, pageSize: 100 } });
    const rows = items(response, (row) => row as { tender: { reference: string }; match: { reasons: Array<{ kind: string }> } });
    const dosing = rows.find((row) => row.tender.reference === 'T-2026-0006');
    expect(dosing?.match.reasons.map((reason) => reason.kind)).toEqual(expect.arrayContaining(['category', 'invitation']));
    expect(rows.map((row) => row.tender.reference)).not.toContain('T-2026-0010');
  });

  it('hides dismissed suggestions unless asked and filters by a saved search', async () => {
    const hidden = items(await api.callAs(TSODILO_BM, ep.listOpportunities, { tenant: 'tsodilo', query: { pageSize: 100 } }), refOf);
    const bySearch = items(await api.callAs(TSODILO_BM, ep.listOpportunities, { tenant: 'tsodilo', query: { savedSearchId: 2, pageSize: 100 } }), refOf);
    const otherUsersSearch = await api.callAs(TSODILO_BM, ep.listOpportunities, { tenant: 'tsodilo', query: { savedSearchId: 3 } });
    expect(hidden).not.toContain('T-2026-0011');
    expect(bySearch).toEqual(['T-2026-0006']);
    expect(problemCode(otherUsersSearch)).toBe('SAVED_SEARCH_NOT_FOUND');
  });

  it('shows the blocking readiness of an invited supplier who has not answered', async () => {
    const response = await api.callAs(MAKGADIKGADI, ep.opportunityWorkspace, { tenant: 'makgadikgadi', params: { tenderId: 2 } });
    expect(response.status).toBe(200);
    const workspace = OpportunityWorkspace.parse(response.body);
    const blocking = workspace.readiness.filter((check) => check.status === 'blocking').map((check) => check.id);
    expect(blocking).toEqual(['invitation']);
    expect(workspace.readiness.find((check) => check.id === 'acknowledgments')?.status).toBe('passed');
    expect(workspace.documents.find((document) => document.documentId === 7023)).toMatchObject({ available: false });
    expect(workspace.capabilities.canStartResponse).toBe(false);
    const adminOnly = await api.callAs(MAKGADIKGADI, ep.startResponse, { tenant: 'makgadikgadi', params: { tenderId: 2 } });
    expect(problemCode(adminOnly)).toBe('FORBIDDEN');
    const start = await api.callAs(CHOBE_BM, ep.startResponse, { tenant: 'chobe-pipe', params: { tenderId: 2 } });
    expect(problemCode(start)).toBe('READINESS_BLOCKED');
    const download = await api.callAs(MAKGADIKGADI, ep.opportunityDocumentDownload, { tenant: 'makgadikgadi', params: { tenderId: 2, documentId: 7023 } });
    expect(problemCode(download)).toBe('DOCUMENT_ACCESS_NOT_GRANTED');
  });

  it('hides an invitation-only event from an organization whose forwarded-invitation access request is pending (PRD §7.5, BR-15)', async () => {
    const workspace = await api.callAs(MAKGADIKGADI, ep.opportunityWorkspace, { tenant: 'makgadikgadi', params: { tenderId: 6 } });
    expect(workspace.status).toBe(404);
    expect(problemCode(workspace)).toBe('OPPORTUNITY_NOT_FOUND');
    expect(workspace.text).not.toMatch(/chlorine|dosing|sha256/i);
    const list = items(await api.callAs(MAKGADIKGADI, ep.listOpportunities, { tenant: 'makgadikgadi', query: { pageSize: 100, includeDismissed: true } }), refOf);
    expect(list).not.toContain('T-2026-0006');
    const filters = OpportunityFilters.parse((await api.callAs(MAKGADIKGADI, ep.opportunityFilters, { tenant: 'makgadikgadi' })).body);
    expect(filters.categories.map((option) => option.value)).not.toContain('WTR-DOSE');
    for (const documentId of [7061, 7062, 7063]) {
      const download = await api.callAs(MAKGADIKGADI, ep.opportunityDocumentDownload, { tenant: 'makgadikgadi', params: { tenderId: 6, documentId } });
      expect(download.status).toBe(404);
      expect(problemCode(download)).toBe('OPPORTUNITY_NOT_FOUND');
    }
    // The requester follows its own request under /supplier/invitations, without a link to the hidden event.
    const request = InvitationDetail.parse((await api.callAs(MAKGADIKGADI, ep.getInvitation, { tenant: 'makgadikgadi', params: { participantId: 606 } })).body);
    expect(request).toMatchObject({ kind: 'access_request', accessStatus: 'requested', opportunityPath: null });
    // Invited organizations still see it.
    const invited = await api.callAs(CHOBE_BM, ep.opportunityWorkspace, { tenant: 'chobe-pipe', params: { tenderId: 6 } });
    expect(invited.status).toBe(200);
  });

  it('hides a restricted event from a denied applicant but lets it ask again through its request', async () => {
    const workspace = await api.callAs(MAKGADIKGADI, ep.opportunityWorkspace, { tenant: 'makgadikgadi', params: { tenderId: 9 } });
    expect(problemCode(workspace)).toBe('OPPORTUNITY_NOT_FOUND');
    const admitted = await api.callAs(SEROWE_BM, ep.opportunityWorkspace, { tenant: 'serowe-ict', params: { tenderId: 9 } });
    expect(admitted.status).toBe(200);
    const again = await api.callAs(MAKGADIKGADI, ep.requestAccess, {
      tenant: 'makgadikgadi',
      params: { tenderId: 9 },
      body: { reason: 'We now partner with an acoustic specialist.', contactName: 'Sethunya Makgadi', contactEmail: 'makgadikgadi.admin@tenderiq.local' },
    });
    // Reached (not 404): the event's response window has closed.
    expect(problemCode(again)).toBe('NOTICE_NOT_OPEN');
  });

  it('offers restricted access, the confidentiality undertaking and lot selection on T-2026-0011', async () => {
    const notice = PublicNotice.parse((await anon(ep.publicNotice, { buyerSlug: 'odc', reference: 'T-2026-0011' })).body);
    expect(notice).toMatchObject({ currentVersionNo: 2, amendmentCount: 1, restrictedDocumentCount: 1, closingAt: { at: '2026-10-23T10:00:00Z', timeZone: 'Africa/Gaborone' } });
    expect(notice.participationRoutes).toEqual({ registerInterest: true, requestAccess: true, startParticipation: true });
    expect(notice.lots.map((entry) => entry.lotId)).toEqual([1101, 1102]);

    const outsider = OpportunityWorkspace.parse((await api.callAs(SEROWE_BM, ep.opportunityWorkspace, { tenant: 'serowe-ict', params: { tenderId: 11 } })).body);
    expect(outsider.capabilities.canRequestAccess).toBe(true);
    const requested = await api.callAs(SEROWE_BM, ep.requestAccess, {
      tenant: 'serowe-ict',
      params: { tenderId: 11 },
      body: { reason: 'We clean the Maun data centre.', contactName: 'Otsile Serowe', contactEmail: 'serowe-ict.bidmanager@tenderiq.local' },
    });
    expect(requested.status).toBe(201);
    expect(requested.body).toMatchObject({ source: 'access_request', accessStatus: 'requested' });

    const chobe = OpportunityWorkspace.parse((await api.callAs(CHOBE_BM, ep.opportunityWorkspace, { tenant: 'chobe-pipe', params: { tenderId: 11 } })).body);
    expect(chobe.capabilities).toMatchObject({ canAcceptConfidentiality: true, canSelectLots: true, canAcknowledge: false, canRequestAccess: false });
    expect(chobe.lots.map((entry) => [entry.lotId, entry.eligible, entry.selected])).toEqual([
      [1101, true, false],
      [1102, true, false],
    ]);
    expect(chobe.documents.find((document) => document.documentId === 7114)).toMatchObject({
      available: false,
      lockedReason: 'Accept the confidentiality undertaking to open this document.',
    });
    const beforeAcceptance = await api.callAs(CHOBE_BM, ep.opportunityDocumentDownload, { tenant: 'chobe-pipe', params: { tenderId: 11, documentId: 7114 } });
    expect(problemCode(beforeAcceptance)).toBe('CONFIDENTIALITY_NOT_ACCEPTED');
    const accepted = await api.callAs(CHOBE_BM, ep.acceptConfidentiality, { tenant: 'chobe-pipe', params: { tenderId: 11 }, body: { accept: true } });
    expect(accepted.body).toMatchObject({ confidentialityAcceptedAt: '2026-09-30T08:00:00Z' });
    const selected = await api.callAs(CHOBE_BM, ep.selectLots, { tenant: 'chobe-pipe', params: { tenderId: 11 }, body: { lotIds: [1102] } });
    expect(selected.body).toMatchObject({ selectedLotIds: [1102] });

    const admitted = await api.callAs(MAKGADIKGADI, ep.opportunityDocumentDownload, { tenant: 'makgadikgadi', params: { tenderId: 11, documentId: 7114 } });
    expect(admitted.status).toBe(200);
  });

  it('restores a dismissed suggestion and refuses one that is not dismissed', async () => {
    const restored = await api.callAs(TSODILO_BM, ep.restoreOpportunity, { tenant: 'tsodilo', params: { tenderId: 11 } });
    const notDismissed = await api.callAs(TSODILO_BM, ep.restoreOpportunity, { tenant: 'tsodilo', params: { tenderId: 2 } });
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({ tenderId: 11, dismissed: false, restoredAt: '2026-09-30T08:00:00Z' });
    expect(problemCode(notDismissed)).toBe('NOT_DISMISSED');
  });

  it('lets a ready participant move to response preparation', async () => {
    const workspace = OpportunityWorkspace.parse((await api.callAs(TSODILO_BM, ep.opportunityWorkspace, { tenant: 'tsodilo', params: { tenderId: 6 } })).body);
    expect(workspace.readiness.filter((check) => check.status === 'blocking')).toEqual([]);
    expect(workspace.sessions.map((session) => session.registrationStatus)).toEqual(['registered', null]);
    const start = await api.callAs(TSODILO_BM, ep.startResponse, { tenant: 'tsodilo', params: { tenderId: 6 } });
    expect(start.body).toMatchObject({ tenderId: 6, participantId: 604, nextPath: '/supplier/responses?tenderId=6' });
    const download = await api.callAs(TSODILO_BM, ep.opportunityDocumentDownload, { tenant: 'tsodilo', params: { tenderId: 6, documentId: 7063 } });
    expect(download.status).toBe(200);
    const closed = await api.callAs(TSODILO_BM, ep.startResponse, { tenant: 'tsodilo', params: { tenderId: 8 } });
    expect(problemCode(closed)).toBe('NOTICE_NOT_OPEN');
  });

  it('records acknowledgments once per organization by an authorized representative', async () => {
    const chobe = await api.callAs(CHOBE_BM, ep.acknowledge, { tenant: 'chobe-pipe', params: { tenderId: 2 }, body: { subjectType: 'addendum', subjectId: 21 } });
    const gaborone = await api.callAs('gaborone-meter.bidmanager@tenderiq.local', ep.acknowledge, {
      tenant: 'gaborone-meter',
      params: { tenderId: 2 },
      body: { subjectType: 'addendum', subjectId: 21 },
    });
    const unknown = await api.callAs(CHOBE_BM, ep.acknowledge, { tenant: 'chobe-pipe', params: { tenderId: 2 }, body: { subjectType: 'addendum', subjectId: 99 } });
    const outsider = await api.callAs(LIMPOPO, ep.acknowledge, { tenant: 'limpopo-env', params: { tenderId: 2 }, body: { subjectType: 'addendum', subjectId: 21 } });
    const contributor = await api.callAs('chobe-pipe.contributor@tenderiq.local', ep.acknowledge, {
      tenant: 'chobe-pipe',
      params: { tenderId: 2 },
      body: { subjectType: 'addendum', subjectId: 21 },
    });
    expect(chobe.status).toBe(201);
    expect(chobe.body).toMatchObject({ participantId: 205, acknowledgedBy: { fullName: 'Bakang Chobe' } });
    expect(problemCode(gaborone)).toBe('ALREADY_ACKNOWLEDGED');
    expect(problemCode(unknown)).toBe('SUBJECT_NOT_FOUND');
    expect(problemCode(outsider)).toBe('NOT_A_PARTICIPANT');
    expect(contributor.status).toBe(403);
  });

  it('refuses lot selection on a closed event and watchlist entries for hidden events', async () => {
    const lots = await api.callAs(TSODILO_BM, ep.selectLots, { tenant: 'tsodilo', params: { tenderId: 1 }, body: { lotIds: [101] } });
    const noLot = await api.callAs(TSODILO_BM, ep.selectLots, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { lotIds: [299] } });
    const hidden = await api.callAs(SEROWE_BM, ep.addToWatchlist, { tenant: 'serowe-ict', body: { tenderId: 6 } });
    const duplicate = await api.callAs(TSODILO_BM, ep.addToWatchlist, { tenant: 'tsodilo', body: { tenderId: 2 } });
    const added = await api.callAs(TSODILO_BM, ep.addToWatchlist, { tenant: 'tsodilo', body: { tenderId: 11 } });
    expect(problemCode(lots)).toBe('LOT_NOT_OPEN');
    expect(problemCode(noLot)).toBe('LOT_NOT_FOUND');
    expect(problemCode(hidden)).toBe('OPPORTUNITY_NOT_FOUND');
    expect(problemCode(duplicate)).toBe('ALREADY_WATCHED');
    expect(added.status).toBe(201);
  });

  it('returns only the caller’s own saved searches, watchlist and subscriptions', async () => {
    const searches = items(await api.callAs(TSODILO_BM, ep.listSavedSearches, { tenant: 'tsodilo' }), (row) => (row as { id: number }).id);
    const admin = items(await api.callAs('tsodilo.admin@tenderiq.local', ep.listSavedSearches, { tenant: 'tsodilo' }), (row) => (row as { id: number }).id);
    const watch = items(await api.callAs(CHOBE_BM, ep.listWatchlist, { tenant: 'chobe-pipe' }), (row) => (row as { id: number }).id);
    const subs = items(await api.callAs(TSODILO_BM, ep.listSubscriptions, { tenant: 'tsodilo', query: { active: true } }), (row) => (row as { id: number }).id);
    expect(new Set(searches)).toEqual(new Set([1, 2]));
    expect(admin).toEqual([3]);
    expect(new Set(watch)).toEqual(new Set([16, 17]));
    expect(new Set(subs)).toEqual(new Set([1, 2]));
    const otherUser = await api.callAs(TSODILO_BM, ep.deleteSavedSearch, { tenant: 'tsodilo', params: { savedSearchId: 3 } });
    const removeOther = await api.callAs(TSODILO_BM, ep.removeFromWatchlist, { tenant: 'tsodilo', params: { watchlistItemId: 16 } });
    const removeOwn = await api.callAs(TSODILO_BM, ep.removeFromWatchlist, { tenant: 'tsodilo', params: { watchlistItemId: 11 } });
    expect(problemCode(otherUser)).toBe('SAVED_SEARCH_NOT_FOUND');
    expect(problemCode(removeOther)).toBe('WATCHLIST_ITEM_NOT_FOUND');
    expect(removeOwn.status).toBe(204);
  });

  it('validates saved searches and subscriptions', async () => {
    const empty = await api.callAs(TSODILO_BM, ep.createSavedSearch, {
      tenant: 'tsodilo',
      body: { name: 'Nothing', keywords: null, catalogCodes: [], buyerTenantIds: [], regions: [], procedures: [], notify: false },
    });
    const duplicate = await api.callAs(TSODILO_BM, ep.createSavedSearch, {
      tenant: 'tsodilo',
      body: { name: 'KWU dosing and treatment', keywords: 'dosing', catalogCodes: [], buyerTenantIds: [], regions: [], procedures: [], notify: false },
    });
    const unknownCategory = await api.callAs(TSODILO_BM, ep.createSavedSearch, {
      tenant: 'tsodilo',
      body: { name: 'Drilling', keywords: null, catalogCodes: ['CIV-DRILL'], buyerTenantIds: [], regions: [], procedures: [], notify: true },
    });
    const unknownBuyer = await api.callAs(TSODILO_BM, ep.createSavedSearch, {
      tenant: 'tsodilo',
      body: { name: 'Suppliers', keywords: null, catalogCodes: [], buyerTenantIds: [5], regions: [], procedures: [], notify: true },
    });
    const created = await api.callAs(TSODILO_BM, ep.createSavedSearch, {
      tenant: 'tsodilo',
      body: { name: 'ODC water', keywords: null, catalogCodes: ['WTR-INFRA'], buyerTenantIds: [3], regions: [], procedures: ['open'], notify: true },
    });
    const subscription = await api.callAs(TSODILO_BM, ep.createSubscription, { tenant: 'tsodilo', body: { buyerTenantId: 2, catalogCode: 'WTR-PUMP' } });
    const paused = await api.callAs(TSODILO_BM, ep.updateSubscription, { tenant: 'tsodilo', params: { subscriptionId: 1 }, body: { active: false } });
    expect(Problem.parse(empty.body).errors).toEqual([expect.objectContaining({ code: 'SAVED_SEARCH_EMPTY' })]);
    expect(problemCode(duplicate)).toBe('DUPLICATE_SAVED_SEARCH_NAME');
    expect(problemCode(unknownCategory)).toBe('UNKNOWN_CATEGORY');
    expect(problemCode(unknownBuyer)).toBe('UNKNOWN_BUYER');
    expect(created.status).toBe(201);
    expect(problemCode(subscription)).toBe('SUBSCRIPTION_EXISTS');
    expect(paused.body).toMatchObject({ id: 1, active: false });
  });
});

describe('supplier invitations (SUP-07)', () => {
  it('lets the authorized representative accept the pending invitation for the named legal supplier', async () => {
    const unconfirmed = await api.callAs(MAKGADIKGADI, ep.acceptInvitation, {
      tenant: 'makgadikgadi',
      params: { participantId: 206 },
      body: { confirmLegalSupplier: false, acceptConfidentiality: false },
    });
    const accepted = await api.callAs(MAKGADIKGADI, ep.acceptInvitation, {
      tenant: 'makgadikgadi',
      params: { participantId: 206 },
      body: { confirmLegalSupplier: true, acceptConfidentiality: false },
    });
    const contributor = await api.callAs('chobe-pipe.contributor@tenderiq.local', ep.acceptInvitation, {
      tenant: 'chobe-pipe',
      params: { participantId: 605 },
      body: { confirmLegalSupplier: true, acceptConfidentiality: true },
    });
    expect(Problem.parse(unconfirmed.body).errors).toEqual([expect.objectContaining({ code: 'LEGAL_SUPPLIER_CONFIRMATION_REQUIRED' })]);
    const detail = InvitationDetail.parse(accepted.body);
    expect(detail).toMatchObject({ invitationStatus: 'accepted', intendedSupplier: { legalName: 'Makgadikgadi Civil Works (Pty) Ltd' } });
    expect(detail.history.at(-1)?.event).toBe('invitation_accepted');
    expect(contributor.status).toBe(403);
  });

  it('never shows another supplier’s invitation', async () => {
    const response = await api.callAs(TSODILO_BM, ep.getInvitation, { tenant: 'tsodilo', params: { participantId: 206 } });
    expect(problemCode(response)).toBe('INVITATION_NOT_FOUND');
    const list = items(await api.callAs(TSODILO_BM, ep.listInvitations, { tenant: 'tsodilo', query: { pageSize: 100 } }), (row) => (row as { participantId: number }).participantId);
    expect(new Set(list)).toEqual(new Set([604]));
    const makgadikgadi = await api.callAs(MAKGADIKGADI, ep.listInvitations, { tenant: 'makgadikgadi', query: { awaitingResponse: true } });
    expect(items(makgadikgadi, (row) => (row as { participantId: number }).participantId)).toEqual([206]);
  });

  it('refuses an answered invitation and requires the shared reason when sharing', async () => {
    const answered = await api.callAs(TSODILO_BM, ep.declineInvitation, { tenant: 'tsodilo', params: { participantId: 604 }, body: { shareReasonWithBuyer: false } });
    const noReason = await api.callAs(MAKGADIKGADI, ep.declineInvitation, { tenant: 'makgadikgadi', params: { participantId: 206 }, body: { shareReasonWithBuyer: true } });
    const declined = await api.callAs(MAKGADIKGADI, ep.declineInvitation, {
      tenant: 'makgadikgadi',
      params: { participantId: 206 },
      body: { shareReasonWithBuyer: true, sharedReason: 'We do not stock meters and found no supply partner in time.' },
    });
    const access = await api.callAs(MAKGADIKGADI, ep.acceptInvitation, {
      tenant: 'makgadikgadi',
      params: { participantId: 606 },
      body: { confirmLegalSupplier: true, acceptConfidentiality: true },
    });
    expect(problemCode(answered)).toBe('INVITATION_NOT_PENDING');
    expect(Problem.parse(noReason.body).errors).toEqual([expect.objectContaining({ field: 'sharedReason', code: 'SHARED_REASON_REQUIRED' })]);
    expect(declined.body).toMatchObject({ invitationStatus: 'declined', sharedNoBidReason: 'We do not stock meters and found no supply partner in time.' });
    expect(problemCode(access)).toBe('NOT_AN_INVITATION');
  });

  it('requests access only where a decision is needed and while the event is open', async () => {
    const body = { reason: 'Please admit us.', contactName: 'Boago Moremi', contactEmail: 'tsodilo.bidmanager@tenderiq.local' };
    const notRequired = await api.callAs(TSODILO_BM, ep.requestAccess, { tenant: 'tsodilo', params: { tenderId: 2 }, body });
    const pending = await api.callAs(MAKGADIKGADI, ep.requestAccess, { tenant: 'makgadikgadi', params: { tenderId: 6 }, body });
    const closed = await api.callAs(SEROWE_BM, ep.requestAccess, { tenant: 'serowe-ict', params: { tenderId: 9 }, body });
    expect(problemCode(notRequired)).toBe('ACCESS_NOT_REQUIRED');
    expect(problemCode(pending)).toBe('ACCESS_ALREADY_REQUESTED');
    expect(problemCode(closed)).toBe('NOTICE_NOT_OPEN');
  });

  it('registers interest in an open public event once', async () => {
    const body = { contactName: 'Otsile Serowe', contactEmail: 'serowe-ict.bidmanager@tenderiq.local' };
    const fresh = await api.callAs(SEROWE_BM, ep.registerInterest, { tenant: 'serowe-ict', params: { tenderId: 11 }, body });
    const again = await api.callAs(TSODILO_BM, ep.registerInterest, { tenant: 'tsodilo', params: { tenderId: 2 }, body });
    const closed = await api.callAs(SEROWE_BM, ep.registerInterest, { tenant: 'serowe-ict', params: { tenderId: 8 }, body });
    expect(fresh.status).toBe(201);
    expect(fresh.body).toMatchObject({ source: 'registered_interest', bidIntent: 'undecided' });
    expect(problemCode(again)).toBe('ALREADY_PARTICIPATING');
    expect(problemCode(closed)).toBe('NOTICE_NOT_OPEN');
  });

  it('accepts a confidentiality undertaking only when one is outstanding', async () => {
    const already = await api.callAs(TSODILO_BM, ep.acceptConfidentiality, { tenant: 'tsodilo', params: { tenderId: 6 }, body: { accept: true } });
    const notRequired = await api.callAs(TSODILO_BM, ep.acceptConfidentiality, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { accept: true } });
    const notGranted = await api.callAs(MAKGADIKGADI, ep.acceptConfidentiality, { tenant: 'makgadikgadi', params: { tenderId: 6 }, body: { accept: true } });
    expect(problemCode(already)).toBe('CONFIDENTIALITY_ALREADY_ACCEPTED');
    expect(problemCode(notRequired)).toBe('CONFIDENTIALITY_NOT_REQUIRED');
    // A pending requester does not see the invitation-only event at all (PRD §7.5).
    expect(problemCode(notGranted)).toBe('OPPORTUNITY_NOT_FOUND');
  });
});

describe('supplier pursuit (SUP-09, DD-41)', () => {
  it('returns the organization’s own private pursuit and the buyer-visible intent separately', async () => {
    const tsodilo = await api.callAs(TSODILO_BM, ep.getPursuit, { tenant: 'tsodilo', params: { tenderId: 6 } });
    const chobe = await api.callAs(CHOBE_BM, ep.getPursuit, { tenant: 'chobe-pipe', params: { tenderId: 6 } });
    expect(tsodilo.body).toMatchObject({ pursuit: { decision: 'bid' }, buyerVisible: { participantId: 604, bidIntent: 'intends_to_bid' } });
    expect((tsodilo.body as { pursuit: { notes: unknown[]; team: unknown[] } }).pursuit.notes).toHaveLength(2);
    expect((tsodilo.body as { pursuit: { team: unknown[] } }).pursuit.team).toHaveLength(4);
    expect(chobe.body).toMatchObject({ pursuit: { decision: 'bid', notes: [] }, buyerVisible: { participantId: 605 } });
    expect(chobe.text).not.toContain('Mahalapye');
  });

  it('shows no pursuit before one is started', async () => {
    const response = await api.callAs(TSODILO_BM, ep.getPursuit, { tenant: 'tsodilo', params: { tenderId: 11 } });
    expect(response.body).toMatchObject({ pursuit: null, buyerVisible: { participantId: null, bidIntent: 'undecided' }, capabilities: { canNotifyBuyer: false } });
  });

  it('lists only the organization’s pursuits', async () => {
    const response = await api.callAs(TSODILO_BM, ep.listPursuits, { tenant: 'tsodilo', query: { pageSize: 100 } });
    const ids = items(response, (row) => (row as { id: number }).id);
    expect(ids.every((id) => Math.floor(id / 1000) === 4)).toBe(true);
    expect(ids).toHaveLength(8);
    const undecided = await api.callAs(MAKGADIKGADI, ep.listPursuits, { tenant: 'makgadikgadi', query: { decision: 'undecided' } });
    expect(items(undecided, (row) => (row as { id: number }).id)).toEqual([6002]);
  });

  it('saves the assessment and refuses an owner outside the organization', async () => {
    const saved = await api.callAs(TSODILO_BM, ep.savePursuit, {
      tenant: 'tsodilo',
      params: { tenderId: 11 },
      body: { attractiveness: 2, capacityNote: null, estimatedEffortHours: 20, risks: null, pursuitOwnerUserId: 25 },
    });
    const outsider = await api.callAs(TSODILO_BM, ep.savePursuit, {
      tenant: 'tsodilo',
      params: { tenderId: 11 },
      body: { attractiveness: 2, capacityNote: null, estimatedEffortHours: 20, risks: null, pursuitOwnerUserId: 29 },
    });
    expect(saved.body).toMatchObject({ tenderId: 11, attractiveness: 2, decision: 'undecided', pursuitOwner: { userId: 25 } });
    expect(problemCode(outsider)).toBe('PURSUIT_OWNER_NOT_MEMBER');
  });

  it('changes the buyer-visible intent only through notify-buyer', async () => {
    const decided = await api.callAs(TSODILO_BM, ep.decidePursuit, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { decision: 'no_bid', internalRationale: 'Outside our range.' } });
    expect(decided.body).toMatchObject({ decision: 'no_bid' });
    const unchanged = await api.callAs(TSODILO_BM, ep.decidePursuit, {
      tenant: 'tsodilo',
      params: { tenderId: 2 },
      body: { decision: 'bid', internalRationale: 'A good entry into metering; the partner carries the product risk.' },
    });
    const notified = await api.callAs(TSODILO_BM, ep.notifyBuyer, {
      tenant: 'tsodilo',
      params: { tenderId: 2 },
      body: { bidIntent: 'no_bid', sharedNoBidReason: 'OIML R49 certificates could not be obtained in time.' },
    });
    const sameIntent = await api.callAs(TSODILO_BM, ep.notifyBuyer, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { bidIntent: 'intends_to_bid' } });
    const closed = await api.callAs(TSODILO_BM, ep.notifyBuyer, { tenant: 'tsodilo', params: { tenderId: 8 }, body: { bidIntent: 'no_bid' } });
    const outsider = await api.callAs(TSODILO_BM, ep.notifyBuyer, { tenant: 'tsodilo', params: { tenderId: 11 }, body: { bidIntent: 'intends_to_bid' } });
    const reasonWithBid = await api.callAs(TSODILO_BM, ep.notifyBuyer, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { bidIntent: 'intends_to_bid', sharedNoBidReason: 'x' } });
    const contributor = await api.callAs('tsodilo.contributor@tenderiq.local', ep.notifyBuyer, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { bidIntent: 'no_bid' } });
    const closedDecision = await api.callAs(TSODILO_BM, ep.decidePursuit, { tenant: 'tsodilo', params: { tenderId: 8 }, body: { decision: 'no_bid', internalRationale: 'Late.' } });
    expect(problemCode(unchanged)).toBe('DECISION_UNCHANGED');
    expect(notified.body).toMatchObject({ participantId: 204, bidIntent: 'no_bid', sharedNoBidReason: 'OIML R49 certificates could not be obtained in time.' });
    expect(problemCode(sameIntent)).toBe('INTENT_UNCHANGED');
    expect(problemCode(closed)).toBe('OPPORTUNITY_CLOSED');
    expect(problemCode(outsider)).toBe('NOT_A_PARTICIPANT');
    expect(Problem.parse(reasonWithBid.body).errors).toEqual([expect.objectContaining({ code: 'SHARED_REASON_ONLY_FOR_NO_BID' })]);
    expect(contributor.status).toBe(403);
    expect(problemCode(closedDecision)).toBe('OPPORTUNITY_CLOSED');
  });

  it('enforces bid-team rules', async () => {
    const member = { sectionScope: [], lotIds: [], dueAt: null };
    const pricing = await api.callAs(TSODILO_BM, ep.addTeamMember, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { ...member, userId: 26, responsibility: 'contributor', canViewPricing: true } });
    const outsider = await api.callAs(TSODILO_BM, ep.addTeamMember, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { ...member, userId: 29, responsibility: 'contributor', canViewPricing: false } });
    const already = await api.callAs(TSODILO_BM, ep.addTeamMember, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { ...member, userId: 25, responsibility: 'reviewer', canViewPricing: true } });
    const badLot = await api.callAs(TSODILO_BM, ep.addTeamMember, { tenant: 'tsodilo', params: { tenderId: 2 }, body: { ...member, userId: 42, responsibility: 'contributor', canViewPricing: false, lotIds: [299] } });
    const added = await api.callAs(TSODILO_BM, ep.addTeamMember, {
      tenant: 'tsodilo',
      params: { tenderId: 2 },
      body: { userId: 42, responsibility: 'contributor', sectionScope: ['Installation method'], lotIds: [], dueAt: '2026-10-10T15:00:00Z', canViewPricing: false },
    });
    const updated = await api.callAs(TSODILO_BM, ep.updateTeamMember, {
      tenant: 'tsodilo',
      params: { tenderId: 1, memberId: 40012 },
      body: { responsibility: 'reviewer', sectionScope: ['Pump selection'], lotIds: [103], dueAt: null, canViewPricing: false },
    });
    const missing = await api.callAs(TSODILO_BM, ep.updateTeamMember, {
      tenant: 'tsodilo',
      params: { tenderId: 1, memberId: 99 },
      body: { responsibility: 'reviewer', sectionScope: [], lotIds: [], dueAt: null, canViewPricing: false },
    });
    const lastManager = await api.callAs(TSODILO_BM, ep.removeTeamMember, { tenant: 'tsodilo', params: { tenderId: 2, memberId: 40021 } });
    const removed = await api.callAs(TSODILO_BM, ep.removeTeamMember, { tenant: 'tsodilo', params: { tenderId: 6, memberId: 40064 } });
    const notStarted = await api.callAs(TSODILO_BM, ep.addNote, { tenant: 'tsodilo', params: { tenderId: 11 }, body: { body: 'Hello' } });
    const note = await api.callAs(TSODILO_BM, ep.addNote, { tenant: 'tsodilo', params: { tenderId: 6 }, body: { body: 'Site visit confirmed for 8 October.' } });
    expect(problemCode(pricing)).toBe('PRICING_ACCESS_NOT_PERMITTED');
    expect(problemCode(outsider)).toBe('USER_NOT_MEMBER');
    expect(problemCode(already)).toBe('ALREADY_ON_TEAM');
    expect(problemCode(badLot)).toBe('LOT_NOT_FOUND');
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ user: { fullName: 'Sam Keitumetse' }, capacity: 'Technical Contributor' });
    expect(updated.body).toMatchObject({ id: 40012, responsibility: 'reviewer', lotIds: [103] });
    expect(problemCode(missing)).toBe('MEMBER_NOT_FOUND');
    expect(problemCode(lastManager)).toBe('LAST_BID_MANAGER');
    expect(removed.status).toBe(204);
    expect(problemCode(notStarted)).toBe('PURSUIT_NOT_STARTED');
    expect(note.status).toBe(201);
  });

  it('lists team candidates from the organization with their pricing eligibility', async () => {
    const response = await api.callAs(TSODILO_BM, ep.pursuitTeamCandidates, { tenant: 'tsodilo' });
    const candidates = (response.body as { items: Array<{ user: { userId: number }; canViewPricing: boolean }> }).items;
    expect(candidates.map((candidate) => candidate.user.userId).sort((a, b) => a - b)).toEqual([24, 25, 26, 27, 42]);
    expect(candidates.find((candidate) => candidate.user.userId === 25)?.canViewPricing).toBe(true);
    expect(candidates.find((candidate) => candidate.user.userId === 26)?.canViewPricing).toBe(false);
  });
});

describe('cross-domain coherence of the notice and the workspace (QA findings)', () => {
  it('publishes the single bid-domain lot of T-2026-0002 as Lot 1, cited by its addendum and selected by its participants', async () => {
    const notice = PublicNotice.parse((await anon(ep.publicNotice, { buyerSlug: 'kwu', reference: 'T-2026-0002' })).body);
    expect(notice.lots.map((entry) => [entry.lotId, entry.lotNo, entry.title])).toEqual([[201, 1, 'Smart meters with AMR modules']]);
    expect(notice.lotCount).toBe(1);
    expect(notice.addenda.find((addendum) => addendum.number === 1)?.affectedLotNos).toEqual([1]);
    expect(notice.summary).toContain('12,000 domestic');
    const workspace = OpportunityWorkspace.parse((await api.callAs(TSODILO_BM, ep.opportunityWorkspace, { tenant: 'tsodilo', params: { tenderId: 2 } })).body);
    expect(workspace.lots.map((entry) => [entry.lotId, entry.selected])).toEqual([[201, true]]);
    expect(workspace.readiness.find((check) => check.id === 'lots')?.status).toBe('passed');
  });

  it('counts as acknowledgment recipients exactly the organizations each issued addendum was delivered to (BUY-15 = BUY-17)', async () => {
    const cases: Array<{ persona: string; tenant: string; tenderId: number }> = [
      { persona: TEBOGO, tenant: 'kwu', tenderId: 1 },
      { persona: TEBOGO, tenant: 'kwu', tenderId: 2 },
      { persona: TEBOGO, tenant: 'kwu', tenderId: 3 },
      { persona: ODC_OFFICER, tenant: 'odc', tenderId: 11 },
    ];
    for (const { persona, tenant, tenderId } of cases) {
      const summary = (await api.callAs(persona, ep.participantSummary, { tenant, params: { tenderId } })).body as {
        acknowledgmentSubjects: Array<{ subjectId: number; acknowledgedCount: number; requiredCount: number }>;
      };
      for (const subject of summary.acknowledgmentSubjects) {
        const addendum = ADDENDA.find((entry) => entry.id === subject.subjectId);
        expect(subject.requiredCount, `addendum ${subject.subjectId}`).toBe(addendum?.recipients.length);
        expect(subject.acknowledgedCount, `addendum ${subject.subjectId}`).toBe(addendum?.recipients.filter((entry) => entry.acknowledgedAt !== null).length);
      }
    }
  });

  it('applies the declared qualification gate: informational before award on T-2026-0001, blocking on T-2026-0006 (AC-07)', async () => {
    const informational = OpportunityWorkspace.parse((await api.callAs(MAKGADIKGADI, ep.opportunityWorkspace, { tenant: 'makgadikgadi', params: { tenderId: 1 } })).body);
    const gate = informational.readiness.find((check) => check.id === 'qualification');
    expect(gate?.status).toBe('warning');
    expect(gate?.detail).toMatch(/before award/);
    expect(informational.lots.every((entry) => entry.ineligibleReason !== 'The qualification gate of this event is not met.')).toBe(true);
    expect(informational.conditions.find((condition) => condition.conditionType === 'qualification_required')).toMatchObject({ blocking: false });
  });

  it('sends session registration deadlines with the official time zone (DD-33)', async () => {
    const workspace = OpportunityWorkspace.parse((await api.callAs(TSODILO_BM, ep.opportunityWorkspace, { tenant: 'tsodilo', params: { tenderId: 6 } })).body);
    const deadlines = workspace.sessions.map((session) => session.registrationDeadline).filter((deadline) => deadline !== null);
    expect(deadlines.length).toBeGreaterThan(0);
    for (const deadline of deadlines) {
      expect(deadline.timeZone).toBe('Africa/Gaborone');
    }
  });

  it('offers the clarification channel only to organizations the clarifications domain serves (no dead links)', async () => {
    const cases: Array<{ persona: string; tenant: string; tenderId: number }> = [
      { persona: TSODILO_BM, tenant: 'tsodilo', tenderId: 2 },
      { persona: TSODILO_BM, tenant: 'tsodilo', tenderId: 10 },
      { persona: TSODILO_BM, tenant: 'tsodilo', tenderId: 4 },
      { persona: LIMPOPO, tenant: 'limpopo-env', tenderId: 2 },
      { persona: MAKGADIKGADI, tenant: 'makgadikgadi', tenderId: 2 },
    ];
    for (const { persona, tenant, tenderId } of cases) {
      const workspace = OpportunityWorkspace.parse((await api.callAs(persona, ep.opportunityWorkspace, { tenant, params: { tenderId } })).body);
      const served =
        CLARIFICATION_TENDERS.find((entry) => entry.id === tenderId)?.participants.some((entry) => entry.supplierTenantId === TENANT_IDS[tenant as keyof typeof TENANT_IDS]) ??
        false;
      expect(workspace.capabilities.canViewClarifications, `${tenant} on ${tenderId}`).toBe(served);
    }
    const outsider = OpportunityWorkspace.parse((await api.callAs(LIMPOPO, ep.opportunityWorkspace, { tenant: 'limpopo-env', params: { tenderId: 2 } })).body);
    expect(outsider.capabilities.canViewClarifications).toBe(false);
  });
});
