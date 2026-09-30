/**
 * The bids fixtures: every projection parses against its contract schema, the rows are internally consistent, and
 * the storyline anchors (AC-03, AC-10..AC-14) are present.
 */
import { describe, expect, it } from 'vitest';

import {
  BidDeclarations,
  BidDetail,
  BidPricing,
  BidReadiness,
  InternalReview,
  Receipt,
  SubmissionAttempt,
  SubmissionPreview,
  Withdrawal,
} from '../../../contracts/bids.js';
import { permissionsForTemplates } from '../../../contracts/permissions.js';
import { pricingOf } from '../../handlers/bids/pricing.js';
import { declarationsPackOf, toAttempt, toBidDetail, toReceipt, toWithdrawal } from '../../handlers/bids/project.js';
import { internalReviewOf, readinessOf, submissionPreviewOf } from '../../handlers/bids/readiness.js';
import { defaultRevision, effectiveReceipt, requireTender, revisionsOf } from '../../handlers/bids/state.js';
import { PERSONAS, TENANTS, TENANT_IDS } from '../platform.js';
import {
  BIDS,
  BID_ANSWERS,
  BID_EVIDENCE_ITEMS,
  BID_INTERNAL_APPROVALS,
  BID_REQUIREMENTS,
  BID_REVISIONS,
  BID_TENDERS,
  BID_WITHDRAWALS,
  SUBMISSION_ATTEMPTS,
  SUBMISSION_RECEIPTS,
} from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const SIGNATORY = permissionsForTemplates(['authorized_signatory']);

describe('bids fixtures parse against the contract', () => {
  it('projects every response onto the workspace schemas', () => {
    for (const bid of BIDS) {
      const tender = requireTender(bid);
      const revision = defaultRevision(bid);
      expect(revision).not.toBeNull();
      if (revision === null) continue;
      expect(() => BidDetail.parse(toBidDetail(bid, SIGNATORY, NOW))).not.toThrow();
      expect(() => BidPricing.parse(pricingOf(bid, tender, revision, false))).not.toThrow();
      expect(() => BidDeclarations.parse(declarationsPackOf(bid, tender, revision, false))).not.toThrow();
      expect(() => BidReadiness.parse(readinessOf(bid, tender, revision, SIGNATORY, NOW))).not.toThrow();
      expect(() =>
        InternalReview.parse(internalReviewOf(bid, tender, revision, new Map(revisionsOf(bid.id).map((row) => [row.id, row])), SIGNATORY, NOW)),
      ).not.toThrow();
      expect(() => SubmissionPreview.parse(submissionPreviewOf(bid, tender, 27, 'Managing Director', SIGNATORY, NOW))).not.toThrow();
    }
  });

  it('projects every receipt, attempt and withdrawal', () => {
    for (const receipt of SUBMISSION_RECEIPTS) {
      const bid = BIDS.find((row) => row.id === receipt.bidId);
      expect(bid).toBeDefined();
      if (bid === undefined) continue;
      expect(() => Receipt.parse(toReceipt(receipt, bid, requireTender(bid)))).not.toThrow();
    }
    for (const attempt of SUBMISSION_ATTEMPTS) {
      const bid = BIDS.find((row) => row.id === attempt.bidId);
      if (bid === undefined) throw new Error(`attempt ${attempt.id} has no bid`);
      expect(() => SubmissionAttempt.parse(toAttempt(attempt, requireTender(bid)))).not.toThrow();
    }
    for (const withdrawal of BID_WITHDRAWALS) {
      const bid = BIDS.find((row) => row.id === withdrawal.bidId);
      if (bid === undefined) throw new Error(`withdrawal ${withdrawal.id} has no bid`);
      expect(() => Withdrawal.parse(toWithdrawal(withdrawal, bid))).not.toThrow();
    }
  });
});

describe('bids fixtures are consistent', () => {
  it('references known tenants, tenders, personas and evidence', () => {
    const tenantIds = new Set(TENANTS.map((tenant) => tenant.id));
    const userIds = new Set(PERSONAS.map((persona) => persona.userId));
    for (const bid of BIDS) {
      expect(tenantIds.has(bid.supplierTenantId)).toBe(true);
      expect(BID_TENDERS.find((tender) => tender.id === bid.tenderId)?.buyerTenantId).toBe(bid.buyerTenantId);
      expect(TENANTS.find((tenant) => tenant.id === bid.supplierTenantId)?.kind).toBe('supplier');
    }
    for (const tender of BID_TENDERS) {
      expect(TENANTS.find((tenant) => tenant.id === tender.buyerTenantId)?.kind).toBe('buyer');
      expect(userIds.has(tender.ownerUserId)).toBe(true);
    }
    for (const revision of BID_REVISIONS) {
      expect(userIds.has(revision.createdBy)).toBe(true);
    }
    for (const item of BID_EVIDENCE_ITEMS) {
      expect(TENANTS.find((tenant) => tenant.id === item.supplierTenantId)?.kind).toBe('supplier');
    }
  });

  it('answers only requirements of the bid’s tender', () => {
    for (const answer of BID_ANSWERS) {
      const revision = BID_REVISIONS.find((row) => row.id === answer.revisionId);
      const bid = BIDS.find((row) => row.id === revision?.bidId);
      const requirement = BID_REQUIREMENTS.find((row) => row.id === answer.requirementId);
      expect(requirement?.tenderId).toBe(bid?.tenderId);
    }
  });

  it('has at most one effective receipt per response, and receipt numbers unique per buyer', () => {
    for (const bid of BIDS) {
      const effective = SUBMISSION_RECEIPTS.filter(
        (row) => row.bidId === bid.id && (row.status === 'received' || row.status === 'selected_for_evaluation'),
      );
      expect(effective.length).toBeLessThanOrEqual(1);
      expect(effectiveReceipt(bid) === null).toBe(bid.submissionState !== 'submitted');
    }
    const keys = SUBMISSION_RECEIPTS.map((row) => `${row.buyerTenantId}:${row.receiptNo}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps each internal approval on a revision of its own response', () => {
    for (const approval of BID_INTERNAL_APPROVALS) {
      expect(BID_REVISIONS.find((row) => row.id === approval.revisionId)?.bidId).toBe(approval.bidId);
    }
  });
});

describe('storyline anchors', () => {
  it('AC-11: Serowe ICT’s T-2026-0002 response is approved internally without a receipt', () => {
    const bid = BIDS.find((row) => row.tenderId === 2 && row.supplierTenantId === TENANT_IDS['serowe-ict']);
    expect(bid?.submissionState).toBe('not_submitted');
    expect(SUBMISSION_RECEIPTS.some((row) => row.bidId === bid?.id)).toBe(false);
    expect(BID_REVISIONS.find((row) => row.bidId === bid?.id)?.status).toBe('approved_internally');
  });

  it('AC-12: Gaborone Metering’s failed replacement has no receipt and revision 1 stays effective', () => {
    const bid = BIDS.find((row) => row.tenderId === 2 && row.supplierTenantId === TENANT_IDS['gaborone-meter']);
    if (bid === undefined) throw new Error('missing bid');
    const failed = SUBMISSION_ATTEMPTS.find((row) => row.bidId === bid.id && row.outcome === 'failed_error');
    expect(failed?.receiptId).toBeNull();
    expect(BID_REVISIONS.find((row) => row.id === effectiveReceipt(bid)?.revisionId)?.revisionNo).toBe(1);
  });

  it('AC-13: Chobe’s late attempt completed after the deadline and its receipt is late-rejected', () => {
    const late = SUBMISSION_ATTEMPTS.find((row) => row.outcome === 'failed_late');
    expect(late?.supplierTenantId).toBe(TENANT_IDS['chobe-pipe']);
    expect(Date.parse(late?.completedAt ?? '') > Date.parse(late?.deadlineAtAttempt ?? '')).toBe(true);
    expect(SUBMISSION_RECEIPTS.find((row) => row.id === late?.receiptId)?.status).toBe('late_rejected');
  });

  it('AC-14: Tsodilo’s T-2026-0008 response is withdrawn with a confirmation number', () => {
    const withdrawal = BID_WITHDRAWALS[0];
    expect(withdrawal?.confirmationNo).toBe('WDR-2026-000001');
    expect(BIDS.find((row) => row.id === withdrawal?.bidId)?.submissionState).toBe('withdrawn');
    expect(SUBMISSION_RECEIPTS.find((row) => row.id === withdrawal?.receiptId)?.status).toBe('withdrawn');
  });

  it('AC-03: the Tsodilo contributor has answers assigned on the open T-2026-0006 draft', () => {
    expect(BID_ANSWERS.filter((row) => row.revisionId === 141 && row.assignedUserId === 26).length).toBeGreaterThan(0);
  });
});
