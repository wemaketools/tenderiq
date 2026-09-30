/**
 * The bids mock API with REAL authentication (DD-43): supplier isolation, buyer tenancy and metadata-only
 * monitoring, permission denials, and the scenario outcomes AC-03, AC-11, AC-12, AC-13 and AC-14.
 *
 * The clock is fixed at 30 Sep 2026 10:00 (Africa/Gaborone): T-2026-0008 stopped submissions at its deadline
 * (25 Sep) and awaits its closing record, T-2026-0006 (14 Oct) and T-2026-0002 (21 Oct) are open. Two more apps run after 14 Oct and after 21 Oct for closing and late
 * submission, so the outcomes never depend on the day the suite runs.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  AnswerPage,
  BidDetail,
  BidPage,
  BidPricing,
  BidReadiness,
  ClosingRecord,
  InternalReview,
  MonitoringDetail,
  MonitoringPage,
  MonitoringReceiptPage,
  AttemptPage,
  Receipt,
  ReceiptDownload,
  SaveAnswerResult,
  SavePricingResult,
  SubmissionPreview,
  SubmissionResult,
  SupplierReceiptPage,
  WithdrawalPage,
  WithdrawalResult,
  bidEndpoints,
} from '../../../contracts/bids.js';
import { Problem } from '../../../contracts/common.js';
import { BIDS, BID_INTERNAL_APPROVALS, BID_REVISIONS, SUBMISSION_RECEIPTS } from '../../fixtures/bids/index.js';
import { TENANT_IDS } from '../../fixtures/platform.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { register } from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const at = (login: string): string => `${login}@tenderiq.local`;

const TSODILO_MANAGER = at('tsodilo.bidmanager');
const TSODILO_CONTRIBUTOR = at('tsodilo.contributor');
const TSODILO_SIGNATORY = at('tsodilo.signatory');
const CHOBE_SIGNATORY = at('chobe-pipe.signatory');
const CHOBE_MANAGER = at('chobe-pipe.bidmanager');

let api: TestMockApp;
/** After the T-2026-0006 deadline (14 Oct 2026 12:00). */
let afterChlorineDeadline: TestMockApp;
/** After the T-2026-0002 deadline (21 Oct 2026 12:00). */
let afterMeterDeadline: TestMockApp;

beforeAll(async () => {
  const modules = [{ name: 'bids', register }];
  api = await createTestMockApp({ modules, now: () => new Date(NOW) });
  afterChlorineDeadline = await createTestMockApp({ modules, now: () => new Date('2026-10-15T06:00:00Z') });
  afterMeterDeadline = await createTestMockApp({ modules, now: () => new Date('2026-10-21T10:00:05Z') });
});

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

function revisionHash(revisionId: number): string {
  const revision = BID_REVISIONS.find((row) => row.id === revisionId);
  if (revision === undefined) {
    throw new Error(`No revision ${revisionId}`);
  }
  return revision.contentHash;
}

describe('bids module registration', () => {
  it('registers every endpoint of the contract when auto-discovered', async () => {
    // Arrange
    const discovered = await createTestMockApp({ auth: 'fixture' });

    // Assert
    expect(discovered.loaded).toContain('bids/index');
    expect(discovered.failed.filter((failure) => failure.module === 'bids/index')).toEqual([]);
    expect(discovered.endpointIds).toEqual(expect.arrayContaining(Object.values(bidEndpoints).map((endpoint) => endpoint.id)));
  });
});

describe('supplier isolation (PRD §4.3)', () => {
  it('lists only the caller organization’s responses, drafts included for its own team', async () => {
    // Act
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.listBids, { tenant: 'tsodilo', query: { pageSize: 100 } });

    // Assert
    expect(response.status).toBe(200);
    const page = BidPage.parse(response.body);
    const expected = BIDS.filter((bid) => bid.supplierTenantId === TENANT_IDS.tsodilo).map((bid) => bid.id);
    expect(page.items.map((row) => row.id).sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    expect(page.total).toBe(expected.length);
    expect(page.items.some((row) => row.id === 14 && row.submissionState === 'not_submitted')).toBe(true);
  });

  it('answers 404 when a supplier asks for another supplier’s response', async () => {
    const response = await api.callAs(CHOBE_MANAGER, bidEndpoints.getBid, { tenant: 'chobe-pipe', params: { bidId: 14 } });
    expect(response.status).toBe(404);
    expect(problemCode(response)).toBe('BID_NOT_FOUND');
  });

  it('answers 404 when a supplier asks for another supplier’s receipt', async () => {
    const tsodiloReceipt = SUBMISSION_RECEIPTS.find((row) => row.supplierTenantId === TENANT_IDS.tsodilo);
    const response = await api.callAs(CHOBE_SIGNATORY, bidEndpoints.getReceipt, {
      tenant: 'chobe-pipe',
      params: { receiptId: tsodiloReceipt?.id ?? 0 },
    });
    expect(response.status).toBe(404);
    expect(problemCode(response)).toBe('RECEIPT_NOT_FOUND');
  });

  it('filters the list by submission state and round', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.listBids, {
      tenant: 'tsodilo',
      query: { submissionState: 'withdrawn' },
    });
    const page = BidPage.parse(response.body);
    expect(page.items.map((row) => row.id)).toEqual([20]);

    const byTender = BidPage.parse(
      (await api.callAs(at('serowe-ict.bidmanager'), bidEndpoints.listBids, { tenant: 'serowe-ict', query: { tenderId: 9 } })).body,
    );
    expect(byTender.items.map((row) => row.id).sort((a, b) => a - b)).toEqual([21, 24]);

    const nextStage = BidPage.parse(
      (await api.callAs(at('serowe-ict.bidmanager'), bidEndpoints.listBids, { tenant: 'serowe-ict', query: { roundType: 'next_stage' } })).body,
    );
    expect(nextStage.items.map((row) => row.id)).toEqual([24]);
  });
});

describe('permissions and tenant kind', () => {
  it('refuses a buyer membership on a supplier endpoint with the uniform tenant 403', async () => {
    const response = await api.callAs(at('tebogo.officer'), bidEndpoints.listBids, { tenant: 'kwu' });
    expect(response.status).toBe(403);
  });

  it('refuses the supplier administrator the draft workspace (no response permission)', async () => {
    const response = await api.callAs(at('tsodilo.admin'), bidEndpoints.listBids, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });

  it('lets the supplier administrator read official receipts (outcomes)', async () => {
    const response = await api.callAs(at('tsodilo.admin'), bidEndpoints.listSupplierReceipts, { tenant: 'tsodilo' });
    expect(response.status).toBe(200);
    const page = SupplierReceiptPage.parse(response.body);
    expect(page.items.every((row) => row.tender.tenderId !== 14)).toBe(true);
    expect(page.total).toBe(SUBMISSION_RECEIPTS.filter((row) => row.supplierTenantId === TENANT_IDS.tsodilo).length);
  });

  it('restricts pricing to pricing personas: a contributor gets 403', async () => {
    const response = await api.callAs(TSODILO_CONTRIBUTOR, bidEndpoints.getPricing, { tenant: 'tsodilo', params: { bidId: 14 } });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });

  it('refuses organization administrators, support agents and operators on submission monitoring (BR-17, AC-15)', async () => {
    const admin = await api.callAs(at('admin.kwu'), bidEndpoints.listMonitoring, { tenant: 'kwu' });
    const support = await api.callAs(at('support.agent'), bidEndpoints.listMonitoring, { tenant: 'kwu' });
    const operator = await api.callAs(at('ops.admin'), bidEndpoints.listMonitoring, { tenant: 'tenderiq-ops' });
    expect(admin.status).toBe(403);
    expect(support.status).toBe(403);
    expect(operator.status).toBe(403);
  });
});

describe('AC-03: a contributor completes assigned work but cannot submit', () => {
  it('saves an answer assigned to the contributor', async () => {
    const response = await api.callAs(TSODILO_CONTRIBUTOR, bidEndpoints.saveAnswer, {
      tenant: 'tsodilo',
      params: { bidId: 14, requirementId: 6003 },
      body: {
        revisionId: 141,
        answerText: 'Duty/standby vacuum chlorinators; on loss of feed the standby cylinder bank switches over automatically.',
        isDeviation: false,
        progress: 'ready_for_review',
      },
    });
    expect(response.status).toBe(200);
    const result = SaveAnswerResult.parse(response.body);
    expect(result.answer.progress).toBe('ready_for_review');
    expect(result.contentHash).not.toBe(revisionHash(141));
    expect(result.invalidatedApprovalIds).toEqual(
      BID_INTERNAL_APPROVALS.filter((row) => row.revisionId === 141 && row.status === 'pending').map((row) => row.id),
    );
  });

  it('refuses to save an answer assigned to someone else', async () => {
    const response = await api.callAs(TSODILO_CONTRIBUTOR, bidEndpoints.saveAnswer, {
      tenant: 'tsodilo',
      params: { bidId: 14, requirementId: 6008 },
      body: { revisionId: 141, answerNumber: '12', isDeviation: false, progress: 'complete' },
    });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('ANSWER_NOT_ASSIGNED');
  });

  it('explains why the contributor cannot submit and who can', async () => {
    const response = await api.callAs(TSODILO_CONTRIBUTOR, bidEndpoints.getSubmissionPreview, { tenant: 'tsodilo', params: { bidId: 14 } });
    expect(response.status).toBe(200);
    const preview = SubmissionPreview.parse(response.body);
    expect(preview.authority.canSubmit).toBe(false);
    expect(preview.authority.blockReasons).toContain('SUBMIT_PERMISSION_MISSING');
    expect(preview.authority.authorizedSubmitters.map((person) => person.fullName)).toContain('Motsamai Tsodilo');
  });

  it('never names the contributor as the authorized representative in the preview (FR-11)', async () => {
    // Arrange
    const request = { tenant: 'tsodilo', params: { bidId: 14 } };

    // Act
    const contributor = SubmissionPreview.parse((await api.callAs(TSODILO_CONTRIBUTOR, bidEndpoints.getSubmissionPreview, request)).body);
    const signatory = SubmissionPreview.parse((await api.callAs(TSODILO_SIGNATORY, bidEndpoints.getSubmissionPreview, request)).body);

    // Assert
    expect(contributor.representative).toBeNull();
    expect(contributor.authority.authorizedSubmitters.length).toBeGreaterThan(0);
    expect(signatory.representative?.fullName).toBe('Motsamai Tsodilo');
  });

  it('refuses the submit command itself with 403', async () => {
    const response = await api.callAs(TSODILO_CONTRIBUTOR, bidEndpoints.submitBid, {
      tenant: 'tsodilo',
      params: { bidId: 14 },
      body: {
        revisionId: 141,
        contentHash: revisionHash(141),
        confirmation: { tenantId: TENANT_IDS.tsodilo, capacity: 'Technical Contributor' },
        finalDeclarationAccepted: true,
      },
    });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });
});

describe('readiness separates blocking errors from warnings', () => {
  it('reports every blocking finding of the Tsodilo draft', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.getReadiness, { tenant: 'tsodilo', params: { bidId: 14 } });
    const readiness = BidReadiness.parse(response.body);
    const blocking = readiness.items.filter((item) => item.severity === 'blocking').map((item) => item.code);
    const warnings = readiness.items.filter((item) => item.severity === 'warning').map((item) => item.code);
    expect(readiness.ready).toBe(false);
    expect(blocking).toEqual(
      expect.arrayContaining([
        'EVIDENCE_EXPIRED',
        'PRICING_INCOMPLETE',
        'DECLARATION_NOT_CONFIRMED',
        'INTERNAL_APPROVAL_INVALIDATED',
        'INTERNAL_APPROVAL_PENDING',
      ]),
    );
    expect(warnings).toEqual(expect.arrayContaining(['REUSED_CONTENT_NOT_REVIEWED', 'ANSWER_NOT_COMPLETE', 'SUBMIT_AUTHORITY_MISSING']));
    expect(readiness.blockingCount).toBe(blocking.length);
  });

  it('refuses submission of a revision with blocking findings', async () => {
    const response = await api.callAs(TSODILO_SIGNATORY, bidEndpoints.submitBid, {
      tenant: 'tsodilo',
      params: { bidId: 14 },
      body: {
        revisionId: 141,
        contentHash: revisionHash(141),
        confirmation: { tenantId: TENANT_IDS.tsodilo, capacity: 'Managing Director' },
        finalDeclarationAccepted: true,
      },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('READINESS_BLOCKING');
  });
});

describe('AC-11: internally approved is not submitted', () => {
  it('shows Serowe ICT’s approved response as not submitted, with no receipt', async () => {
    const response = await api.callAs(at('serowe-ict.bidmanager'), bidEndpoints.getBid, { tenant: 'serowe-ict', params: { bidId: 7 } });
    const detail = BidDetail.parse(response.body);
    expect(detail.submissionState).toBe('not_submitted');
    expect(detail.workingRevision?.status).toBe('approved_internally');
    expect(detail.effectiveReceipt).toBeNull();
    expect(detail.effectiveOffer.explanation).toBe('none_submitted');
  });

  it('never shows the unsubmitted response to the buyer', async () => {
    const response = await api.callAs(at('tebogo.officer'), bidEndpoints.listMonitoringReceipts, {
      tenant: 'kwu',
      params: { tenderId: 2 },
      query: { effectiveOnly: false },
    });
    const page = MonitoringReceiptPage.parse(response.body);
    expect(page.items.some((row) => row.supplierTenantId === TENANT_IDS['serowe-ict'])).toBe(false);
  });

  it('becomes submitted only through the signatory’s submission, which returns a receipt', async () => {
    const response = await api.callAs(at('serowe-ict.signatory'), bidEndpoints.submitBid, {
      tenant: 'serowe-ict',
      params: { bidId: 7 },
      body: {
        revisionId: 71,
        contentHash: revisionHash(71),
        confirmation: { tenantId: TENANT_IDS['serowe-ict'], capacity: 'Managing Director' },
        finalDeclarationAccepted: true,
      },
    });
    expect(response.status).toBe(201);
    const result = SubmissionResult.parse(response.body);
    expect(result.receipt.tender.reference).toBe('T-2026-0002');
    expect(result.supersededReceiptId).toBeNull();
  });
});

describe('AC-12: a failed replacement keeps the earlier receipt effective', () => {
  it('explains the effective offer of Gaborone Metering', async () => {
    const response = await api.callAs(at('gaborone-meter.bidmanager'), bidEndpoints.getBid, {
      tenant: 'gaborone-meter',
      params: { bidId: 4 },
    });
    const detail = BidDetail.parse(response.body);
    expect(detail.submissionState).toBe('submitted');
    expect(detail.effectiveOffer.explanation).toBe('replacement_failed_earlier_effective');
    expect(detail.effectiveOffer.receipt?.revisionNo).toBe(1);
    expect(detail.effectiveOffer.lastUnsuccessfulAttempt?.outcome).toBe('failed_error');
    expect(detail.effectiveOffer.lastUnsuccessfulAttempt?.receiptId).toBeNull();
  });

  it('lets the signatory retry the failed supplement while the window is open', async () => {
    const response = await api.callAs(at('gaborone-meter.signatory'), bidEndpoints.submitBid, {
      tenant: 'gaborone-meter',
      params: { bidId: 4 },
      body: {
        revisionId: 42,
        contentHash: revisionHash(42),
        confirmation: { tenantId: TENANT_IDS['gaborone-meter'], capacity: 'Managing Director' },
        finalDeclarationAccepted: true,
        replacementAcknowledged: true,
      },
    });
    expect(response.status).toBe(201);
    const result = SubmissionResult.parse(response.body);
    expect(result.receipt.revisionNo).toBe(2);
    expect(result.supersededReceiptId).toBe(SUBMISSION_RECEIPTS.find((row) => row.bidId === 4)?.id);
  });
});

describe('AC-13: a late completion is rejected with the true time', () => {
  it('records Chobe’s late replacement 38 seconds after the T-2026-0008 deadline and keeps revision 1 effective', async () => {
    const attempts = AttemptPage.parse(
      (
        await api.callAs(CHOBE_SIGNATORY, bidEndpoints.listSubmissionAttempts, {
          tenant: 'chobe-pipe',
          params: { bidId: 19 },
          query: { outcome: 'failed_late' },
        })
      ).body,
    );
    const detail = BidDetail.parse((await api.callAs(CHOBE_SIGNATORY, bidEndpoints.getBid, { tenant: 'chobe-pipe', params: { bidId: 19 } })).body);
    expect(attempts.items).toHaveLength(1);
    expect(attempts.items[0]).toMatchObject({ completedAt: '2026-09-25T08:00:38Z', lateBySeconds: 38 });
    expect(detail.effectiveOffer.explanation).toBe('late_rejected_earlier_effective');
    expect(detail.effectiveOffer.receipt?.revisionNo).toBe(1);
  });

  it('states on the late-rejected receipt how late it was, why, and its true time to the second', async () => {
    // Arrange
    const late = SUBMISSION_RECEIPTS.find((row) => row.bidId === 19 && row.status === 'late_rejected');
    const request = { tenant: 'chobe-pipe', params: { receiptId: late?.id ?? 0 } };

    // Act
    const receipt = Receipt.parse((await api.callAs(CHOBE_SIGNATORY, bidEndpoints.getReceipt, request)).body);
    const file = ReceiptDownload.parse((await api.callAs(CHOBE_SIGNATORY, bidEndpoints.downloadReceipt, request)).body);

    // Assert
    expect(receipt.receivedAt).toBe('2026-09-25T08:00:38Z');
    expect(receipt.lateRejection).toMatchObject({ lateBySeconds: 38, deadlineAtAttempt: { at: '2026-09-25T08:00:00Z' } });
    expect(receipt.lateRejection?.reason).not.toBeNull();
    expect(file.content).toContain('25 Sep 2026, 10:00:38 (UTC+02:00) Africa/Gaborone');
    expect(file.content).toContain('25 Sep 2026, 10:00 (UTC+02:00) Africa/Gaborone');
    expect(file.content).toContain('38 s after the deadline');
    expect(file.content).not.toContain('2026-09-25T08:00');
  });

  it('carries no lateness on a receipt received on time', async () => {
    // Arrange
    const onTime = SUBMISSION_RECEIPTS.find((row) => row.bidId === 19 && row.status !== 'late_rejected');

    // Act
    const receipt = Receipt.parse((await api.callAs(CHOBE_SIGNATORY, bidEndpoints.getReceipt, { tenant: 'chobe-pipe', params: { receiptId: onTime?.id ?? 0 } })).body);

    // Assert
    expect(receipt.lateRejection).toBeNull();
  });

  it('rejects a submission completed after the deadline as late', async () => {
    const response = await afterMeterDeadline.callAs(at('serowe-ict.signatory'), bidEndpoints.submitBid, {
      tenant: 'serowe-ict',
      params: { bidId: 7 },
      body: {
        revisionId: 71,
        contentHash: revisionHash(71),
        confirmation: { tenantId: TENANT_IDS['serowe-ict'], capacity: 'Managing Director' },
        finalDeclarationAccepted: true,
      },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('SUBMISSION_LATE');
    expect(Problem.parse(response.body).detail).toContain('2026-10-21T10:00:05Z');
  });
});

describe('submission and withdrawal while the window is open', () => {
  const submitBody = {
    revisionId: 152,
    contentHash: '',
    confirmation: { tenantId: 0, capacity: 'Managing Director' },
    finalDeclarationAccepted: true,
  } as const;

  it('returns an official receipt that supersedes the effective one only on success', async () => {
    const response = await api.callAs(CHOBE_SIGNATORY, bidEndpoints.submitBid, {
      tenant: 'chobe-pipe',
      params: { bidId: 15 },
      body: {
        ...submitBody,
        contentHash: revisionHash(152),
        confirmation: { tenantId: TENANT_IDS['chobe-pipe'], capacity: 'Managing Director' },
        replacementAcknowledged: true,
      },
    });
    expect(response.status).toBe(201);
    const result = SubmissionResult.parse(response.body);
    expect(result.receipt.status).toBe('received');
    expect(result.receipt.receiptNo).toMatch(/^RCPT-2026-\d{6}$/);
    expect(result.attempt.outcome).toBe('succeeded');
    expect(result.supersededReceiptId).toBe(SUBMISSION_RECEIPTS.find((row) => row.bidId === 15)?.id);
  });

  it('requires the replacement to be acknowledged', async () => {
    const response = await api.callAs(CHOBE_SIGNATORY, bidEndpoints.submitBid, {
      tenant: 'chobe-pipe',
      params: { bidId: 15 },
      body: { ...submitBody, contentHash: revisionHash(152), confirmation: { tenantId: TENANT_IDS['chobe-pipe'], capacity: 'Managing Director' } },
    });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('REPLACEMENT_NOT_ACKNOWLEDGED');
  });

  it('refuses a confirmation that names another organization', async () => {
    const response = await api.callAs(CHOBE_SIGNATORY, bidEndpoints.submitBid, {
      tenant: 'chobe-pipe',
      params: { bidId: 15 },
      body: { ...submitBody, contentHash: revisionHash(152), confirmation: { tenantId: TENANT_IDS.tsodilo, capacity: 'Managing Director' }, replacementAcknowledged: true },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('CONTEXT_MISMATCH');
  });

  it('AC-14: withdraws the effective response with a confirmation number', async () => {
    const receipt = SUBMISSION_RECEIPTS.find((row) => row.bidId === 15);
    const response = await api.callAs(CHOBE_SIGNATORY, bidEndpoints.withdrawBid, {
      tenant: 'chobe-pipe',
      params: { bidId: 15 },
      body: {
        receiptId: receipt?.id ?? 0,
        reason: 'Capacity committed elsewhere.',
        confirmation: { tenantId: TENANT_IDS['chobe-pipe'], capacity: 'Managing Director' },
        effectUnderstood: true,
      },
    });
    expect(response.status).toBe(201);
    const result = WithdrawalResult.parse(response.body);
    expect(result.withdrawal.confirmationNo).toBe('WDR-2026-000002');
    expect(result.submissionState).toBe('withdrawn');
    expect(result.receipt.status).toBe('withdrawn');
  });

  it('AC-14: keeps the earlier withdrawal of T-2026-0008 in the history', async () => {
    const response = await api.callAs(TSODILO_SIGNATORY, bidEndpoints.listWithdrawals, { tenant: 'tsodilo', params: { bidId: 20 } });
    const page = WithdrawalPage.parse(response.body);
    expect(page.items.map((row) => row.confirmationNo)).toEqual(['WDR-2026-000001']);
  });

  it('refuses withdrawal after the deadline', async () => {
    const receipt = SUBMISSION_RECEIPTS.find((row) => row.bidId === 19);
    const response = await api.callAs(CHOBE_SIGNATORY, bidEndpoints.withdrawBid, {
      tenant: 'chobe-pipe',
      params: { bidId: 19 },
      body: {
        receiptId: receipt?.id ?? 0,
        reason: 'Late change of mind.',
        confirmation: { tenantId: TENANT_IDS['chobe-pipe'], capacity: 'Managing Director' },
        effectUnderstood: true,
      },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('SUBMISSION_WINDOW_CLOSED');
  });
});

describe('internal approval (SUP-15)', () => {
  const pending = BID_INTERNAL_APPROVALS.find((row) => row.bidId === 14 && row.status === 'pending');

  it('approves the pending commercial approval of the current content', async () => {
    const response = await api.callAs(TSODILO_SIGNATORY, bidEndpoints.decideInternalApproval, {
      tenant: 'tsodilo',
      params: { bidId: 14, approvalId: pending?.id ?? 0 },
      body: { decision: 'approve', contentHash: revisionHash(141) },
    });
    expect(response.status).toBe(200);
    const review = InternalReview.parse(response.body);
    expect(review.requiredApprovals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ approvalType: 'commercial', state: 'approved' }),
        expect.objectContaining({ approvalType: 'executive', state: 'invalidated' }),
      ]),
    );
  });

  it('refuses a decision on content that changed (material change)', async () => {
    const response = await api.callAs(TSODILO_SIGNATORY, bidEndpoints.decideInternalApproval, {
      tenant: 'tsodilo',
      params: { bidId: 14, approvalId: pending?.id ?? 0 },
      body: { decision: 'approve', contentHash: '0'.repeat(64) },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('CONTENT_HASH_MISMATCH');
  });

  it('refuses a decision on an invalidated approval', async () => {
    const invalidated = BID_INTERNAL_APPROVALS.find((row) => row.bidId === 14 && row.status === 'invalidated');
    const response = await api.callAs(TSODILO_SIGNATORY, bidEndpoints.decideInternalApproval, {
      tenant: 'tsodilo',
      params: { bidId: 14, approvalId: invalidated?.id ?? 0 },
      body: { decision: 'approve', contentHash: revisionHash(141) },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('APPROVAL_INVALIDATED');
  });

  it('refuses the bid manager, who holds no approval authority', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.decideInternalApproval, {
      tenant: 'tsodilo',
      params: { bidId: 14, approvalId: pending?.id ?? 0 },
      body: { decision: 'approve', contentHash: revisionHash(141) },
    });
    expect(response.status).toBe(403);
  });

  it('lets the bid manager request a new executive approval', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.requestInternalApproval, {
      tenant: 'tsodilo',
      params: { bidId: 14 },
      body: { revisionId: 141, contentHash: revisionHash(141), approvers: [{ approvalType: 'executive', approverUserId: 27 }] },
    });
    expect(response.status).toBe(201);
    const review = InternalReview.parse(response.body);
    expect(review.requiredApprovals).toEqual(expect.arrayContaining([expect.objectContaining({ approvalType: 'executive', state: 'pending' })]));
  });
});

describe('pricing (SUP-13)', () => {
  it('computes totals from decimal strings and flags missing lines', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.getPricing, { tenant: 'tsodilo', params: { bidId: 14 } });
    const pricing = BidPricing.parse(response.body);
    // 4 × 385000 + 8 × 42500 + 310000 = 2,190,000.00 net; VAT 14% = 306,600.00.
    expect(pricing.totals.oneTime.net).toEqual({ amount: '2190000.00', currency: 'BWP' });
    expect(pricing.totals.oneTime.gross).toEqual({ amount: '2496600.00', currency: 'BWP' });
    expect(pricing.totals.includedCount).toBe(1);
    expect(pricing.totals.notOfferedCount).toBe(1);
    expect(pricing.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PRICE_MISSING', itemCode: 'CD-05' })]));
  });

  it('rejects a price on an included line (included is not a zero price)', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.savePricing, {
      tenant: 'tsodilo',
      params: { bidId: 14 },
      body: {
        revisionId: 141,
        lines: [{ pricingItemId: 61014, priceStatus: 'included', unitPrice: '0.00' }],
        commercialTerms: { validityDays: 90, paymentTerms: null, conditionalDiscounts: null, assumptions: null },
      },
    });
    expect(response.status).toBe(422);
    expect(Problem.parse(response.body).errors?.map((error) => error.code)).toContain('PRICE_NOT_ALLOWED');
  });

  it('saves a price line and returns the recomputed totals', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.savePricing, {
      tenant: 'tsodilo',
      params: { bidId: 14 },
      body: {
        revisionId: 141,
        lines: [{ pricingItemId: 61015, priceStatus: 'priced', unitPrice: '88000.00', quantity: '1', currency: 'BWP', taxRate: '14' }],
        commercialTerms: { validityDays: 90, paymentTerms: '30 days', conditionalDiscounts: null, assumptions: null },
      },
    });
    expect(response.status).toBe(200);
    const result = SavePricingResult.parse(response.body);
    expect(result.pricing.totals.missingCount).toBe(0);
    expect(result.pricing.totals.recurring).toEqual([
      expect.objectContaining({ recurrence: 'annual', net: { amount: '88000.00', currency: 'BWP' } }),
    ]);
  });
});

describe('response workspace commands', () => {
  it('starts a response for an open tender', async () => {
    const response = await api.callAs(at('serowe-ict.bidmanager'), bidEndpoints.startBid, { tenant: 'serowe-ict', body: { tenderId: 11 } });
    expect(response.status).toBe(201);
    const detail = BidDetail.parse(response.body);
    expect(detail.tender.reference).toBe('T-2026-0011');
    expect(detail.submissionState).toBe('not_submitted');
  });

  it('hides an invitation-only tender from a supplier that was not invited', async () => {
    const response = await api.callAs(at('serowe-ict.bidmanager'), bidEndpoints.startBid, { tenant: 'serowe-ict', body: { tenderId: 6 } });
    expect(response.status).toBe(404);
    expect(problemCode(response)).toBe('TENDER_NOT_FOUND');
  });

  it('refuses a second workspace for the same tender', async () => {
    const response = await api.callAs(TSODILO_MANAGER, bidEndpoints.startBid, { tenant: 'tsodilo', body: { tenderId: 6 } });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('BID_ALREADY_EXISTS');
  });

  it('filters answers by assignee and reports sections', async () => {
    const response = await api.callAs(TSODILO_CONTRIBUTOR, bidEndpoints.listAnswers, {
      tenant: 'tsodilo',
      params: { bidId: 14 },
      query: { assignedToMe: true },
    });
    const page = AnswerPage.parse(response.body);
    expect(page.items.map((row) => row.refCode).sort()).toEqual(['D-01', 'T-01', 'T-03']);
    expect(page.editable).toBe(true);
    expect(page.sections.map((section) => section.section)).toEqual(['Company and eligibility', 'Technical proposal', 'Delivery and installation', 'Commercial']);
  });

  it('refuses to edit after the deadline', async () => {
    const response = await afterMeterDeadline.callAs(at('gaborone-meter.bidmanager'), bidEndpoints.saveAnswer, {
      tenant: 'gaborone-meter',
      params: { bidId: 4, requirementId: 2004 },
      body: { revisionId: 42, answerText: 'Updated.', isDeviation: false, progress: 'complete' },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('REVISION_NOT_EDITABLE');
  });

  it('downloads a printable receipt', async () => {
    const receipt = SUBMISSION_RECEIPTS.find((row) => row.bidId === 6);
    const response = await api.callAs(TSODILO_SIGNATORY, bidEndpoints.downloadReceipt, { tenant: 'tsodilo', params: { receiptId: receipt?.id ?? 0 } });
    const file = ReceiptDownload.parse(response.body);
    expect(file.fileName).toBe(`${receipt?.receiptNo ?? ''}.txt`);
    expect(file.content).toContain('This receipt confirms receipt only.');
  });
});

describe('BUY-19: submission monitoring is metadata only and tenant-scoped', () => {
  it('lists only the buyer’s released tenders', async () => {
    const kwu = MonitoringPage.parse((await api.callAs(at('tebogo.officer'), bidEndpoints.listMonitoring, { tenant: 'kwu', query: { pageSize: 50 } })).body);
    const odc = MonitoringPage.parse((await api.callAs(at('officer.odc'), bidEndpoints.listMonitoring, { tenant: 'odc' })).body);
    expect(kwu.items.map((row) => row.reference)).not.toContain('T-2026-0005');
    expect(kwu.items.map((row) => row.reference)).not.toContain('T-2026-0011');
    expect(kwu.total).toBe(9);
    expect(odc.items.map((row) => row.reference)).toEqual(['T-2026-0011']);
  });

  it('answers 404 for another buyer’s tender', async () => {
    const response = await api.callAs(at('officer.odc'), bidEndpoints.getMonitoring, { tenant: 'odc', params: { tenderId: 2 } });
    expect(response.status).toBe(404);
    expect(problemCode(response)).toBe('TENDER_NOT_FOUND');
  });

  it('counts unique suppliers, not revisions, and shows the incident of an open tender', async () => {
    const response = await api.callAs(at('tebogo.officer'), bidEndpoints.getMonitoring, { tenant: 'kwu', params: { tenderId: 2 } });
    const detail = MonitoringDetail.parse(response.body);
    expect(detail.effectiveSupplierCount).toBe(2);
    expect(detail.receiptCount).toBe(3);
    expect(detail.closingStatus).toBe('open');
    expect(detail.canClose).toBe(false);
    expect(detail.closeBlockers).toEqual(['DEADLINE_NOT_REACHED']);
    expect(detail.incidents).toHaveLength(1);
    expect(Object.keys(detail)).not.toContain('answers');
  });

  it('shows the late attempt and the withdrawal of T-2026-0008 as metadata, awaiting its closing record', async () => {
    const response = await api.callAs(at('oratile.opener'), bidEndpoints.getMonitoring, { tenant: 'kwu', params: { tenderId: 8 } });
    const detail = MonitoringDetail.parse(response.body);
    expect(detail.closingStatus).toBe('deadline_passed');
    expect(detail.closedAt).toBeNull();
    expect(detail.canClose).toBe(true);
    expect(detail.closeBlockers).toEqual([]);
    expect(detail.effectiveSupplierCount).toBe(1);
    expect(detail.counts).toMatchObject({ withdrawn: 1, lateRejected: 1, received: 1 });
    expect(detail.lateAttempts).toEqual([expect.objectContaining({ supplierTenantId: TENANT_IDS['chobe-pipe'], lateBySeconds: 38 })]);
  });

  it('returns one effective receipt per supplier by default', async () => {
    const response = await api.callAs(at('pule.auditor'), bidEndpoints.listMonitoringReceipts, { tenant: 'kwu', params: { tenderId: 2 } });
    const page = MonitoringReceiptPage.parse(response.body);
    expect(page.items).toHaveLength(2);
    expect(new Set(page.items.map((row) => row.supplierTenantId)).size).toBe(2);
    expect(page.items.every((row) => row.isEffective)).toBe(true);
  });

  it('closes a tender whose deadline has passed', async () => {
    const response = await afterChlorineDeadline.callAs(at('tebogo.officer'), bidEndpoints.closeTender, {
      tenant: 'kwu',
      params: { tenderId: 6 },
      body: { confirmation: { tenantId: TENANT_IDS.kwu, capacity: 'Procurement Officer' } },
    });
    expect(response.status).toBe(200);
    const record = ClosingRecord.parse(response.body);
    expect(record).toMatchObject({ status: 'closed', effectiveSupplierCount: 1, lateAttemptCount: 0 });
  });

  it('lists T-2026-0008 as awaiting closing in the live clock', async () => {
    // Act
    const page = MonitoringPage.parse(
      (await api.callAs(at('tebogo.officer'), bidEndpoints.listMonitoring, { tenant: 'kwu', query: { closingStatus: ['deadline_passed'] } })).body,
    );

    // Assert
    expect(page.items.map((row) => row.reference)).toEqual(['T-2026-0008']);
  });

  it('records the closing of T-2026-0008 with its late attempt count (BUY-19 principal action)', async () => {
    // Act
    const response = await api.callAs(at('tebogo.officer'), bidEndpoints.closeTender, {
      tenant: 'kwu',
      params: { tenderId: 8 },
      body: { confirmation: { tenantId: TENANT_IDS.kwu, capacity: 'Procurement Officer' }, note: 'Late attempt reviewed.' },
    });

    // Assert
    expect(response.status).toBe(200);
    const record = ClosingRecord.parse(response.body);
    expect(record).toMatchObject({
      reference: 'T-2026-0008',
      status: 'closed',
      closingStatus: 'closed',
      effectiveSupplierCount: 1,
      lateAttemptCount: 1,
      note: 'Late attempt reviewed.',
    });
  });

  it('refuses to close before the deadline or twice', async () => {
    const early = await api.callAs(at('tebogo.officer'), bidEndpoints.closeTender, {
      tenant: 'kwu',
      params: { tenderId: 2 },
      body: { confirmation: { tenantId: TENANT_IDS.kwu, capacity: 'Procurement Officer' } },
    });
    const twice = await api.callAs(at('tebogo.officer'), bidEndpoints.closeTender, {
      tenant: 'kwu',
      params: { tenderId: 1 },
      body: { confirmation: { tenantId: TENANT_IDS.kwu, capacity: 'Procurement Officer' } },
    });
    expect(problemCode(early)).toBe('DEADLINE_NOT_REACHED');
    expect(problemCode(twice)).toBe('TENDER_NOT_OPEN');
  });

  it('refuses closing to a persona without tender.close', async () => {
    const response = await api.callAs(at('pule.auditor'), bidEndpoints.closeTender, {
      tenant: 'kwu',
      params: { tenderId: 2 },
      body: { confirmation: { tenantId: TENANT_IDS.kwu, capacity: 'Internal Auditor' } },
    });
    expect(response.status).toBe(403);
  });
});

describe('every read endpoint answers contract-valid bodies for every fixture response', () => {
  const managers: Record<number, string> = {
    [TENANT_IDS.tsodilo]: TSODILO_SIGNATORY,
    [TENANT_IDS['chobe-pipe']]: CHOBE_SIGNATORY,
    [TENANT_IDS['serowe-ict']]: at('serowe-ict.signatory'),
    [TENANT_IDS['gaborone-meter']]: at('gaborone-meter.signatory'),
  };

  it('serves the workspace screens of each response to its signatory', async () => {
    const reads = [
      bidEndpoints.getBid,
      bidEndpoints.listAnswers,
      bidEndpoints.getPricing,
      bidEndpoints.getDeclarations,
      bidEndpoints.getReadiness,
      bidEndpoints.listRevisions,
      bidEndpoints.getInternalReview,
      bidEndpoints.getSubmissionPreview,
      bidEndpoints.listBidReceipts,
      bidEndpoints.listSubmissionAttempts,
      bidEndpoints.listWithdrawals,
    ];
    for (const bid of BIDS) {
      const login = managers[bid.supplierTenantId];
      if (login === undefined) {
        continue;
      }
      const tenant = bid.supplierTenantId;
      for (const endpoint of reads) {
        const response = await api.callAs(login, endpoint, { tenant, params: { bidId: bid.id } });
        expect({ bid: bid.id, endpoint: endpoint.id, status: response.status }).toEqual({ bid: bid.id, endpoint: endpoint.id, status: 200 });
      }
      for (const receipt of SUBMISSION_RECEIPTS.filter((row) => row.bidId === bid.id)) {
        const response = await api.callAs(login, bidEndpoints.getReceipt, { tenant, params: { receiptId: receipt.id } });
        expect(Receipt.parse(response.body).receiptNo).toBe(receipt.receiptNo);
      }
    }
  });

  it('serves the monitoring screens of every released tender to its buyer', async () => {
    for (const [login, slug] of [
      [at('tebogo.officer'), 'kwu'],
      [at('officer.odc'), 'odc'],
    ] as const) {
      const list = MonitoringPage.parse((await api.callAs(login, bidEndpoints.listMonitoring, { tenant: slug, query: { pageSize: 50 } })).body);
      for (const row of list.items) {
        const detail = await api.callAs(login, bidEndpoints.getMonitoring, { tenant: slug, params: { tenderId: row.tenderId } });
        const receipts = await api.callAs(login, bidEndpoints.listMonitoringReceipts, {
          tenant: slug,
          params: { tenderId: row.tenderId },
          query: { effectiveOnly: false },
        });
        expect(detail.status).toBe(200);
        expect(receipts.status).toBe(200);
      }
    }
  });
});
