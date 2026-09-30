/**
 * Records mock handlers (ADM-14) with REAL authentication (DD-43): AC-35 (a legal hold blocks disposal of expired
 * records, and their history stays intact), hold and disposal state rules, restricted audit rows as metadata only
 * (DD-31), evidence pack authorization, permission denials and tenant isolation.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem, pageOf } from '../../../contracts/common.js';
import { DisposalRequest, HoldDetail, RecordAuditEvent, RecordSubject, RecordsSummary, RetentionClass, recordsEndpoints as D } from '../../../contracts/records.js';
import { ExportRecord } from '../../../contracts/reporting.js';
import { LEGACY_TENDER_ID } from '../../fixtures/reporting/index.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

const MPHO = 'mpho.manager@tenderiq.local';
const PULE = 'pule.auditor@tenderiq.local';
const DINEO = 'dineo.legal@tenderiq.local';
const MASEGO = 'masego.contracts@tenderiq.local';

function ok<T>(response: TestResponse, schema: { parse(value: unknown): T }, status = 200): T {
  expect(response.status, JSON.stringify(response.body)).toBe(status);
  return schema.parse(response.body);
}

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

const APPROVE = { reason: 'Retention period ended and no hold applies.', confirmEligibility: true };

function holdBody(overrides: Record<string, unknown> = {}) {
  return {
    subjectType: 'tender',
    subjectId: 3,
    holdType: 'legal_hold',
    reason: 'Anticipated challenge of the SCADA award',
    authorityNote: 'Instruction of the Legal Counsel',
    scopeDescription: 'All records of T-2026-0003',
    reviewDate: '2099-06-30',
    blockedActions: ['disposal'],
    ...overrides,
  };
}

describe('AC-35: a legal hold blocks disposal of expired records', () => {
  it('shows the blocking hold on the blocked disposal request', async () => {
    const request = ok(await api.callAs(MPHO, D.getDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 1 } }), DisposalRequest);
    expect(request.status).toBe('blocked');
    expect(request.blockingHolds.map((hold) => hold.holdId)).toEqual([1]);
    expect(request.entities.every((entity) => entity.retentionEndedOn < '2026-10-07')).toBe(true);
  });

  it('refuses to approve a disposal request under a hold', async () => {
    const response = await api.callAs(MPHO, D.approveDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 1 }, body: APPROVE });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('DISPOSAL_BLOCKED_BY_HOLD');
  });

  it('refuses to execute a disposal request under a hold', async () => {
    const response = await api.callAs(MPHO, D.executeDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 2 }, body: { dispositionRecord: 'Destroyed by the records service.' } });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('DISPOSAL_BLOCKED_BY_HOLD');
  });

  it('shows the hold to records staff with its expired records and blocked requests', async () => {
    const hold = ok(await api.callAs(DINEO, D.getHold, { tenant: 'kwu', params: { holdId: 1 } }), HoldDetail);
    expect(hold.state).toBe('active');
    expect(hold.affectedRecords.every((record) => record.pastRetention)).toBe(true);
    expect(hold.blockedDisposals.map((row) => row.id).sort()).toEqual([1, 2]);
  });

  it('keeps the audit history of the held records intact', async () => {
    const page = ok(await api.callAs(PULE, D.listAuditEvents, { tenant: 'kwu', query: { q: 'T-2025-0003', pageSize: 100 } }), pageOf(RecordAuditEvent));
    expect(page.items.some((event) => event.action === 'import.accepted' && event.entityId === LEGACY_TENDER_ID)).toBe(true);
    expect(page.items.every((event) => event.underHold)).toBe(true);
  });
});

describe('disposal decisions', () => {
  it('approves an eligible request', async () => {
    const request = ok(await api.callAs(MPHO, D.approveDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 3 }, body: APPROVE }), DisposalRequest);
    expect(request.status).toBe('approved');
    expect(request.approval).toMatchObject({ status: 'approved', decidedBy: { userId: 4 } });
  });

  it('answers DISPOSAL_NOT_ELIGIBLE when the re-check finds a live claim', async () => {
    const response = await api.callAs(MPHO, D.approveDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 7 }, body: APPROVE });
    expect(problemCode(response)).toBe('DISPOSAL_NOT_ELIGIBLE');
  });

  it('answers DISPOSAL_ALREADY_DECIDED for a decided request', async () => {
    const response = await api.callAs(MPHO, D.rejectDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 5 }, body: { reason: 'Keep' } });
    expect(problemCode(response)).toBe('DISPOSAL_ALREADY_DECIDED');
  });

  it('executes only an approved request and records the disposition', async () => {
    const notApproved = await api.callAs(MPHO, D.executeDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 3 }, body: { dispositionRecord: 'Destroyed by the records service.' } });
    expect(problemCode(notApproved)).toBe('DISPOSAL_NOT_APPROVED');
    const executed = ok(
      await api.callAs(MPHO, D.executeDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 4 }, body: { dispositionRecord: 'Personal profiles erased; certificate retained.' } }),
      DisposalRequest,
    );
    expect(executed).toMatchObject({ status: 'executed', dispositionRecord: 'Personal profiles erased; certificate retained.' });
  });

  it('denies disposal decisions to the legal counsel, who lacks records.disposal.approve', async () => {
    const response = await api.callAs(DINEO, D.approveDisposalRequest, { tenant: 'kwu', params: { disposalRequestId: 3 }, body: APPROVE });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });
});

describe('holds', () => {
  it('imposes a hold and blocks the disposal requests it covers', async () => {
    const hold = ok(
      await api.callAs(DINEO, D.createHold, { tenant: 'kwu', body: holdBody({ subjectType: 'record_class', subjectId: 4, scopeDescription: 'All correspondence records' }) }),
      HoldDetail,
      201,
    );
    expect(hold.state).toBe('active');
    expect(hold.blockedDisposals.map((row) => [row.id, row.status])).toEqual([[3, 'blocked']]);
  });

  it('refuses a second hold of the same type on a held record', async () => {
    const response = await api.callAs(DINEO, D.createHold, { tenant: 'kwu', body: holdBody({ subjectId: LEGACY_TENDER_ID }) });
    expect(problemCode(response)).toBe('HOLD_ALREADY_ACTIVE');
  });

  it('refuses a review date in the past and an unknown subject', async () => {
    expect(problemCode(await api.callAs(DINEO, D.createHold, { tenant: 'kwu', body: holdBody({ reviewDate: '2020-01-01' }) }))).toBe('REVIEW_DATE_IN_PAST');
    expect(problemCode(await api.callAs(DINEO, D.createHold, { tenant: 'kwu', body: holdBody({ subjectId: 999 }) }))).toBe('HOLD_SUBJECT_NOT_FOUND');
  });

  it('rejects a hold that does not block disposal with 422', async () => {
    const response = await api.callAs(DINEO, D.createHold, { tenant: 'kwu', body: holdBody({ blockedActions: ['publish'] }) });
    expect(response.status).toBe(422);
  });

  it('releases a hold without disposing of anything', async () => {
    const hold = ok(await api.callAs(DINEO, D.releaseHold, { tenant: 'kwu', params: { holdId: 1 }, body: { reason: 'Claim withdrawn' } }), HoldDetail);
    expect(hold.state).toBe('released');
    expect(hold.blockedDisposals.every((row) => row.status === 'proposed')).toBe(true);
    expect(hold.history.at(-1)?.action).toBe('Hold released');
  });

  it('refuses to release a released hold', async () => {
    const response = await api.callAs(DINEO, D.releaseHold, { tenant: 'kwu', params: { holdId: 3 }, body: { reason: 'Again' } });
    expect(problemCode(response)).toBe('HOLD_ALREADY_RELEASED');
  });

  it('denies imposing a hold to the procurement manager, who lacks records.hold.manage', async () => {
    const response = await api.callAs(MPHO, D.createHold, { tenant: 'kwu', body: holdBody() });
    expect(response.status).toBe(403);
  });
});

describe('audit viewer and summary', () => {
  it('shows restricted rows as metadata only (DD-31)', async () => {
    const page = ok(await api.callAs(PULE, D.listAuditEvents, { tenant: 'kwu', query: { sensitivity: ['restricted'] } }), pageOf(RecordAuditEvent));
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((event) => event.redacted && event.beforeState === null && event.afterState === null && event.reason === null)).toBe(true);
  });

  it('filters access events', async () => {
    const page = ok(await api.callAs(PULE, D.listAuditEvents, { tenant: 'kwu', query: { category: ['access_event'] } }), pageOf(RecordAuditEvent));
    expect(page.items.every((event) => event.category === 'access_event')).toBe(true);
    expect(page.items.some((event) => event.supportGrantId === 1)).toBe(true);
  });

  it('denies the audit viewer to an officer without audit.view', async () => {
    const response = await api.callAs('tebogo.officer@tenderiq.local', D.listAuditEvents, { tenant: 'kwu' });
    expect(response.status).toBe(403);
  });

  it('returns only the blocks a caller may read', async () => {
    const auditor = ok(await api.callAs(PULE, D.getRecordsSummary, { tenant: 'kwu' }), RecordsSummary);
    expect(auditor.audit).not.toBeNull();
    expect(auditor.disposals?.blocked).toBe(2);
    const contracts = ok(await api.callAs(MASEGO, D.getRecordsSummary, { tenant: 'kwu' }), RecordsSummary);
    expect(contracts.audit).toBeNull();
    expect(contracts.holds).toBeNull();
    expect(contracts.evidencePacks).not.toBeNull();
  });

  it('answers another buyer’s tenant with the identical tenant 403', async () => {
    const response = await api.callAs(PULE, D.getRecordsSummary, { tenant: 'odc' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('TENANT_ACCESS_DENIED');
  });
});

describe('retention classes', () => {
  it('lists the nine record classes', async () => {
    const page = ok(await api.callAs(MPHO, D.listRetentionClasses, { tenant: 'kwu' }), pageOf(RetentionClass));
    expect(page.total).toBe(9);
  });

  it('refuses an owner outside the organization and a too-short contract period', async () => {
    const base = { triggerEvent: 'contract_closed', durationMonths: 120, ownerUserId: 19, disposition: 'archive', purpose: 'Contracts and limitation periods', reason: 'Policy review' };
    expect(problemCode(await api.callAs(MPHO, D.updateRetentionClass, { tenant: 'kwu', params: { retentionClassId: 6 }, body: { ...base, ownerUserId: 23 } }))).toBe('OWNER_NOT_ELIGIBLE');
    expect(problemCode(await api.callAs(MPHO, D.updateRetentionClass, { tenant: 'kwu', params: { retentionClassId: 6 }, body: { ...base, durationMonths: 48 } }))).toBe(
      'RETENTION_SHORTER_THAN_LIVE_OBLIGATIONS',
    );
    const updated = ok(await api.callAs(MPHO, D.updateRetentionClass, { tenant: 'kwu', params: { retentionClassId: 6 }, body: base }), RetentionClass);
    expect(updated.durationMonths).toBe(120);
  });
});

describe('evidence packs', () => {
  it('omits sealed bid contents from a pack before opening', async () => {
    const pack = ok(
      await api.callAs(PULE, D.createEvidencePack, {
        tenant: 'kwu',
        body: { subjectType: 'tender', subjectId: 8, purpose: 'Closing review', includeAuditTrail: true, includeRestrictedMetadata: true, format: 'html' },
      }),
      ExportRecord,
      201,
    );
    expect(pack.exportType).toBe('evidence_pack');
    expect(pack.manifest?.omissions.map((item) => item.label)).toContain('Bid contents');
  });

  it('refuses restricted metadata to a caller without audit.view', async () => {
    const response = await api.callAs(MASEGO, D.createEvidencePack, {
      tenant: 'kwu',
      body: { subjectType: 'contract', subjectId: 1, purpose: 'Change review', includeAuditTrail: true, includeRestrictedMetadata: true, format: 'html' },
    });
    expect(problemCode(response)).toBe('RESTRICTED_METADATA_REQUIRES_AUDIT_VIEW');
  });

  it('refuses an unknown subject', async () => {
    const response = await api.callAs(PULE, D.createEvidencePack, {
      tenant: 'kwu',
      body: { subjectType: 'contract', subjectId: 999, purpose: 'Review', includeAuditTrail: false, includeRestrictedMetadata: false, format: 'csv' },
    });
    expect(problemCode(response)).toBe('EVIDENCE_SUBJECT_NOT_FOUND');
  });

  it('lists evidence packs and the record lookup with hold flags', async () => {
    const packs = ok(await api.callAs(PULE, D.listEvidencePacks, { tenant: 'kwu' }), pageOf(ExportRecord));
    expect(packs.items.every((item) => item.exportType === 'evidence_pack')).toBe(true);
    const subjects = ok(await api.callAs(DINEO, D.listRecordSubjects, { tenant: 'kwu', query: { q: 'T-2025-0003' } }), pageOf(RecordSubject));
    expect(subjects.items[0]).toMatchObject({ underHold: true, pastRetention: true });
  });
});
