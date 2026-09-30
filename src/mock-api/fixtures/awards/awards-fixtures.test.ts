/**
 * Awards fixtures: every record parses against its contract schema, and the storyline invariants hold (per-lot
 * outcomes and reconciliation, AC-26; the T-2026-0007 hold, AC-25; own-result debriefs, AC-27; the T-2026-0001
 * closeout block on an unaccepted handover, AC-29; the RFI closed with findings and a linked next step, AC-39).
 */
import { describe, expect, it } from 'vitest';

import {
  BuyerPublicAwardNotice,
  CloseoutState,
  ComplaintDetail,
  DebriefDetail,
  Hold,
  LotOutcome,
  OutcomeNoticeDetail,
  PublicAwardDetail,
  RecommendationDetail,
  StandstillPeriod,
  SupplierOutcomeDetail,
} from '../../../contracts/awards.js';
import { awardValueBasisOf } from '../../../contracts/awards.js';
import { add, eq, lte, sum } from '../../../contracts/decimal.js';
import { APPROVALS } from '../approvals.js';
import { BIDS } from '../bids/index.js';
import { CALENDARS } from '../calendars.js';
import { CONTRACTS, CONTRACT_HANDOVERS } from '../contracts/index.js';
import { DOCUMENTS } from '../documents.js';
import { ACCESS_RESTRICTIONS } from '../org-admin/access.js';
import { TENANT_IDS } from '../platform.js';
import { PREFERRED_BIDDERS } from '../selection/index.js';
import {
  AWARD_FILES,
  AWARD_HOLDS,
  AWARD_TENDERS,
  CHALLENGED_CONDUCT,
  CLOSEOUTS,
  COMPLAINTS,
  DEBRIEFS,
  LOT_OUTCOMES,
  OUTCOME_NOTICES,
  PUBLIC_NOTICES,
  RECOMMENDATIONS,
  RECONCILIATION_T1,
  STANDSTILL_PERIODS,
  SUPPLIER_OUTCOMES,
  isHoldActive,
} from './index.js';

describe('awards fixtures parse against their contract schemas', () => {
  it('parses every recommendation, lot outcome, notice, standstill and hold', () => {
    for (const row of RECOMMENDATIONS) expect(() => RecommendationDetail.parse(row.detail)).not.toThrow();
    for (const { tenantId: _t, tenderId: _d, ...row } of LOT_OUTCOMES) expect(() => LotOutcome.parse(row)).not.toThrow();
    for (const row of OUTCOME_NOTICES) expect(() => OutcomeNoticeDetail.parse(row.detail)).not.toThrow();
    for (const row of STANDSTILL_PERIODS) expect(() => StandstillPeriod.parse(row.period)).not.toThrow();
    for (const row of AWARD_HOLDS) expect(() => Hold.parse(row.hold)).not.toThrow();
  });

  it('parses every debrief, complaint, public notice and closeout', () => {
    for (const row of DEBRIEFS) expect(() => DebriefDetail.parse(row.detail)).not.toThrow();
    for (const row of COMPLAINTS) expect(() => ComplaintDetail.parse(row.detail)).not.toThrow();
    for (const row of PUBLIC_NOTICES) {
      expect(() => BuyerPublicAwardNotice.parse(row.notice)).not.toThrow();
      if (row.publicDetail !== null) expect(() => PublicAwardDetail.parse(row.publicDetail)).not.toThrow();
    }
    for (const row of CLOSEOUTS) expect(() => CloseoutState.parse(row.state)).not.toThrow();
  });

  it('parses the supplier outcome cores with an empty join', () => {
    for (const row of SUPPLIER_OUTCOMES) {
      const detail = {
        ...row.core,
        latestNoticeAt: '2026-09-22T08:00:00Z',
        awaitingAcknowledgment: 0,
        debriefStatus: null,
        openComplaintCount: 0,
        notices: [],
        debrief: null,
        complaints: [],
      };
      expect(() => SupplierOutcomeDetail.parse(detail)).not.toThrow();
    }
  });
});

describe('awards fixtures are internally consistent', () => {
  it('uses unique ids for every record kind', () => {
    const unique = (values: number[]) => new Set(values).size === values.length;
    expect(unique(RECOMMENDATIONS.map((row) => row.detail.recommendationId))).toBe(true);
    expect(unique(LOT_OUTCOMES.map((row) => row.lotOutcomeId))).toBe(true);
    expect(unique(OUTCOME_NOTICES.map((row) => row.detail.noticeId))).toBe(true);
    expect(unique(DEBRIEFS.map((row) => row.detail.debriefId))).toBe(true);
    expect(unique(COMPLAINTS.map((row) => row.detail.complaintId))).toBe(true);
  });

  it('keeps complaint references unique per buyer, as references are unique per tenant', () => {
    for (const tenantId of [TENANT_IDS.kwu, TENANT_IDS.odc]) {
      const references = COMPLAINTS.filter((row) => row.tenantId === tenantId).map((row) => row.detail.reference);
      expect(new Set(references).size).toBe(references.length);
    }
  });

  it('shows T-2026-0001 lot 1 awarded, lot 2 cancelled and lot 3 without an outcome while the tender is partially awarded (AC-26)', () => {
    const tender = AWARD_TENDERS.find((row) => row.ref.reference === 'T-2026-0001');
    expect(tender?.ref.status).toBe('partially_awarded');
    const outcomes = LOT_OUTCOMES.filter((row) => row.tenderId === 1);
    expect(outcomes.find((row) => row.lot.lotNo === 1)).toMatchObject({ outcome: 'award', status: 'final_awarded' });
    expect(outcomes.find((row) => row.lot.lotNo === 2)).toMatchObject({ outcome: 'cancelled', supplier: null, awardedValue: null });
    expect(outcomes.some((row) => row.lot.lotNo === 3)).toBe(false);
  });

  it('reconciles lot values with the recommendation total and never over-allocates to contracts (BR-33)', () => {
    for (const { detail } of RECOMMENDATIONS) {
      const values = detail.lotOutcomes.flatMap((row) => (row.awardedValue === null ? [] : [row.awardedValue.amount]));
      const total = values.length === 0 ? '0' : sum(values);
      const { value } = detail.reconciliation;
      expect(eq(total, value.total.amount)).toBe(true);
      const allocated = detail.reconciliation.contractAllocations.map((row) => row.allocatedValue.amount);
      const allocatedTotal = allocated.length === 0 ? '0' : sum(allocated);
      expect(eq(allocatedTotal, detail.reconciliation.allocatedTotal.amount)).toBe(true);
      expect(lte(allocatedTotal, value.total.amount)).toBe(true);
      expect(eq(add(allocatedTotal, detail.reconciliation.unallocated.amount), value.total.amount)).toBe(true);
    }
  });

  it('labels every recommendation value by the status of its lot outcomes, never as awarded before the final award (BR-31)', () => {
    for (const { detail } of RECOMMENDATIONS) {
      const valued = detail.lotOutcomes.filter((row) => row.awardedValue !== null);
      const { value } = detail.reconciliation;
      expect(value.basis).toBe(awardValueBasisOf(valued.map((row) => row.status)));
      const final = valued.filter((row) => row.status === 'final_awarded').map((row) => row.awardedValue?.amount ?? '0');
      expect(eq(final.length === 0 ? '0' : sum(final), value.finalAwardedTotal.amount)).toBe(true);
      for (const lot of detail.reconciliation.lotTotals) {
        const outcome = detail.lotOutcomes.find((row) => row.lot.lotId === lot.lotId);
        expect(lot.status).toBe(outcome?.status ?? null);
      }
    }
    const byTender = (tenderId: number) => RECOMMENDATIONS.filter((row) => row.detail.tender.tenderId === tenderId).at(-1)?.detail;
    expect(byTender(3)?.reconciliation.value.basis).toBe('recommended');
    expect(byTender(9)?.reconciliation.value.basis).toBe('recommended');
    expect(byTender(7)?.reconciliation.value.basis).toBe('intended');
    expect(byTender(1)?.reconciliation.value.basis).toBe('final_awarded');
  });

  it('lists every current lot outcome inside its recommendation', () => {
    for (const outcome of LOT_OUTCOMES) {
      const recommendation = RECOMMENDATIONS.find((row) => row.detail.recommendationId === outcome.recommendationId);
      expect(recommendation?.detail.lotOutcomes.some((row) => row.lotOutcomeId === outcome.lotOutcomeId)).toBe(true);
    }
  });

  it('keeps the T-2026-0007 complaint hold active on final award and contract signature (AC-25)', () => {
    const hold = AWARD_HOLDS.find((row) => row.tenderId === 7)?.hold;
    expect(hold !== undefined && isHoldActive(hold)).toBe(true);
    expect(hold?.blockedActions).toEqual(expect.arrayContaining(['award_final', 'contract_sign']));
    expect(COMPLAINTS.find((row) => row.detail.complaintId === hold?.complaintId)?.detail.isBlocking).toBe(true);
    expect(STANDSTILL_PERIODS.find((row) => row.period.tenderId === 7)?.period.status).toBe('running');
  });

  it('gives each debrief only the requesting supplier’s own result (AC-27)', () => {
    for (const row of DEBRIEFS) {
      const names = AWARD_TENDERS.find((tender) => tender.ref.tenderId === row.detail.tender.tenderId)?.bidders ?? [];
      const others = names.filter((bidder) => TENANT_IDS[bidder.supplierSlug] !== row.supplierTenantId);
      const text = JSON.stringify(row.detail.ownResult);
      expect(row.detail.supplier.supplierTenantId).toBe(row.supplierTenantId);
      for (const other of others) expect(text).not.toContain(other.supplierSlug);
    }
  });

  it('blocks the T-2026-0001 closeout on the unaccepted handover and closes the RFI with a linked next step (AC-29, AC-39)', () => {
    const t1 = CLOSEOUTS.find((row) => row.state.tender.tenderId === 1)?.state;
    expect(t1?.status).toBe('blocked');
    expect(t1?.gate.find((check) => check.code === 'handover_accepted')?.status).toBe('blocking');
    const rfi = CLOSEOUTS.find((row) => row.state.tender.tenderId === 4)?.state;
    expect(rfi).toMatchObject({ status: 'closed', isInformationOnly: true, linkedNextTender: { reference: 'T-2026-0009' } });
    expect(rfi?.marketFindings).not.toBeNull();
    expect(rfi?.nextStepDecision).not.toBeNull();
  });

  it('references only issued notices that list the supplier as a recipient in supplier outcomes', () => {
    for (const outcome of SUPPLIER_OUTCOMES) {
      for (const noticeId of outcome.noticeIds) {
        const notice = OUTCOME_NOTICES.find((row) => row.detail.noticeId === noticeId)?.detail;
        expect(notice?.status).toBe('issued');
        expect(notice?.recipients.some((row) => row.supplier.supplierTenantId === outcome.supplierTenantId)).toBe(true);
      }
    }
  });

  it('counts notice recipients consistently', () => {
    for (const { detail } of OUTCOME_NOTICES) {
      expect(detail.recipientCount).toBe(detail.recipients.length);
      expect(detail.failedCount).toBe(detail.recipients.filter((row) => row.deliveryStatus === 'failed').length);
      expect(detail.acknowledgedCount).toBe(detail.recipients.filter((row) => row.acknowledgedAt !== null).length);
    }
  });

  it('publishes a public projection exactly for published public notices', () => {
    for (const row of PUBLIC_NOTICES) {
      expect(row.publicDetail !== null).toBe(row.notice.status === 'published');
    }
  });

  it('registers award files only for KWU tenders (ODC has none yet)', () => {
    expect(AWARD_FILES.every((row) => row.tenantId === TENANT_IDS.kwu)).toBe(true);
    expect(AWARD_FILES.map((row) => row.tenderId).sort((a, b) => a - b)).toEqual([1, 3, 4, 7, 9, 10]);
  });
});

describe('awards fixtures agree with the other domains of the demo world', () => {
  const botswana2026 = CALENDARS.find((row) => row.name === 'Botswana Public Holidays 2026');
  const holidays = new Set((botswana2026?.holidays ?? []).map((row) => row.date));
  const workingDays = new Set(botswana2026?.workingDays ?? []);

  /** The date `count` working days after the day of `instant` (the day of transmission does not count). */
  function addWorkingDays(instant: string, count: number): string {
    const day = new Date(`${instant.slice(0, 10)}T00:00:00Z`);
    let left = count;
    while (left > 0) {
      day.setUTCDate(day.getUTCDate() + 1);
      const iso = day.toISOString().slice(0, 10);
      if (workingDays.has(day.getUTCDay()) && !holidays.has(iso)) left -= 1;
    }
    return day.toISOString().slice(0, 10);
  }

  it('ends the T-2026-0007 standstill and complaint window after 10 working days on the calendar (8 Oct 2026, 17:00)', () => {
    expect(holidays.has('2026-09-30')).toBe(true);
    const intent = OUTCOME_NOTICES.find((row) => row.detail.noticeId === 57)?.detail;
    const end = `${addWorkingDays(intent?.issuedAt ?? '', 10)}T15:00:00Z`;
    expect(end).toBe('2026-10-08T15:00:00Z');
    const period = STANDSTILL_PERIODS.find((row) => row.period.tenderId === 7)?.period;
    expect(period?.endsAt.at).toBe(end);
    expect(period?.effectiveEndsAt.at).toBe(end);
    for (const outcome of SUPPLIER_OUTCOMES.filter((row) => row.core.tenderId === 7)) {
      expect(outcome.core.standstill?.effectiveEndsAt.at).toBe(end);
      if (outcome.core.complaintDeadline !== null) expect(outcome.core.complaintDeadline.at).toBe(end);
    }
    expect(intent?.body).toContain('8 Oct 2026, 17:00');
  });

  it('closes the T-2026-0007 debrief window 5 working days after the outcome notice, so Chobe can no longer request one', () => {
    const unsuccessful = OUTCOME_NOTICES.find((row) => row.detail.noticeId === 58)?.detail;
    const end = `${addWorkingDays(unsuccessful?.issuedAt ?? '', 5)}T15:00:00Z`;
    expect(end).toBe('2026-09-29T15:00:00Z');
    for (const outcome of SUPPLIER_OUTCOMES.filter((row) => row.core.tenderId === 7 && row.core.debriefDeadline !== null)) {
      expect(outcome.core.debriefDeadline?.at).toBe(end);
      expect(outcome.core.canRequestDebrief).toBe(false);
    }
    expect(unsuccessful?.body).toContain('29 Sep 2026, 17:00');
  });

  it('lists every T-2026-0001 contract with the status and handover status of the contracts fixtures (AC-29)', () => {
    const t1 = CLOSEOUTS.find((row) => row.state.tender.tenderId === 1)?.state;
    const expected = CONTRACTS.filter((row) => row.tender?.tenderId === 1).map((row) => ({
      contractId: row.id,
      reference: row.reference,
      status: row.status,
      handoverStatus: CONTRACT_HANDOVERS.find((handover) => handover.contractId === row.id)?.status ?? null,
    }));
    expect(expected).toHaveLength(3);
    expect(
      t1?.contracts.map(({ contractId, reference, status, handoverStatus }) => ({ contractId, reference, status, handoverStatus })),
    ).toEqual(expect.arrayContaining(expected));
    expect(t1?.contracts).toHaveLength(expected.length);
    const allocated = RECONCILIATION_T1.contractAllocations.map((row) => row.contractId).sort((a, b) => a - b);
    expect(t1?.contracts.map((row) => row.contractId).sort((a, b) => a - b)).toEqual(allocated);
  });

  it('links award approvals only to approval requests of the approvals fixtures, for the same tender', () => {
    const links = [
      ...RECOMMENDATIONS.map((row) => ({ id: row.detail.approval.approvalRequestId, tenderId: row.detail.tender.tenderId })),
      ...OUTCOME_NOTICES.filter((row) => row.detail.noticeType !== 'preferred_bidder').map((row) => ({
        id: row.detail.approvalRequestId,
        tenderId: row.detail.tenderId,
      })),
    ];
    for (const link of links.filter((row) => row.id !== null)) {
      const approval = APPROVALS.find((row) => row.id === link.id);
      expect(approval?.subjectType).toBe('award');
      expect(approval?.subjectReference).toContain(`T-2026-${String(link.tenderId).padStart(4, '0')}`);
    }
    for (const { lotOutcomeId, finalAwardApprovalId } of LOT_OUTCOMES) {
      if (finalAwardApprovalId !== null) {
        expect(APPROVALS.find((row) => row.id === finalAwardApprovalId && row.subjectId === lotOutcomeId)?.subjectType).toBe('final_award');
      }
    }
  });

  it('relates complaint evidence documents only to existing complaints, so neither side has a dead link', () => {
    const complaintIds = new Set(COMPLAINTS.map((row) => row.detail.complaintId));
    for (const document of DOCUMENTS.filter((row) => row.relatedType === 'complaint')) {
      expect(complaintIds.has(document.relatedId)).toBe(true);
    }
    for (const row of COMPLAINTS) expect(Object.keys(row.detail)).not.toContain('evidence');
  });

  it('keeps the T-2026-0009 preferred-bidder records aligned with the selection fixtures and never calls them an award (BR-31)', () => {
    const serowe = SUPPLIER_OUTCOMES.find((row) => row.supplierTenantId === TENANT_IDS['serowe-ict'] && row.core.tenderId === 9);
    const limpopo = SUPPLIER_OUTCOMES.find((row) => row.supplierTenantId === TENANT_IDS['limpopo-env'] && row.core.tenderId === 9);
    expect(serowe?.core.result).toBe('preferred_withdrawn');
    expect(limpopo?.core.result).toBe('preferred_bidder');
    expect(PREFERRED_BIDDERS.find((row) => row.bidId === 907)?.status).toBe('failed_diligence');
    expect(PREFERRED_BIDDERS.find((row) => row.bidId === 908)?.status).toBe('approved');
    const bidders = AWARD_TENDERS.find((row) => row.ref.tenderId === 9)?.bidders ?? [];
    expect(bidders.map((row) => row.bidId).sort()).toEqual([907, 908]);
    const notices = OUTCOME_NOTICES.filter((row) => row.detail.noticeType === 'preferred_bidder');
    expect(notices.map((row) => row.detail.noticeId).sort()).toEqual([68, 69, 70]);
    for (const { detail } of notices) {
      expect(detail.tenderId).toBe(9);
      expect(detail.body).toMatch(/not an award|No award was made/);
    }
  });

  it('names as case owners only people independent of the challenged decision (FR-17)', () => {
    for (const row of CHALLENGED_CONDUCT) {
      const complaint = COMPLAINTS.find((item) => item.detail.complaintId === row.complaintId);
      expect(complaint).toBeDefined();
      expect(complaint?.detail.caseOwner?.userId).not.toBe(row.userId);
    }
  });
});

describe('awards fixtures use plain wording', () => {
  it('never shows an internal specification id in user-facing text', () => {
    const text = JSON.stringify([
      RECOMMENDATIONS,
      OUTCOME_NOTICES,
      STANDSTILL_PERIODS,
      AWARD_HOLDS,
      DEBRIEFS,
      COMPLAINTS,
      PUBLIC_NOTICES,
      CLOSEOUTS,
      SUPPLIER_OUTCOMES,
      AWARD_FILES,
    ]);
    expect(text).not.toMatch(/\b(?:SUP|BUY|PUB|OPS|COM)-\d{2}\b|\b(?:BR|AC|DD|FR)-\d{2}\b/);
  });

  it('adds up every debrief breakdown: weights to 100.00 and own scores to the total score', () => {
    for (const { detail } of DEBRIEFS) {
      const { criteria, totalScore, maxScore } = detail.ownResult;
      expect(eq(sum(criteria.map((row) => row.weight)), maxScore)).toBe(true);
      const scores = criteria.flatMap((row) => (row.ownScore === null ? [] : [row.ownScore]));
      if (totalScore !== null) expect(eq(sum(scores), totalScore)).toBe(true);
    }
  });

  it('states the same REQ-T-02 reason for the T-2026-0001 lot 2 cancellation everywhere', () => {
    const chobe = SUPPLIER_OUTCOMES.find((row) => row.supplierTenantId === TENANT_IDS['chobe-pipe'] && row.core.tenderId === 1);
    const lot2 = chobe?.core.lots.find((row) => row.lot.lotNo === 2);
    expect(lot2?.reason).toContain('REQ-T-02');
    expect(LOT_OUTCOMES.find((row) => row.lotOutcomeId === 14012)?.reason).toContain('REQ-T-02');
  });
});

describe('awards fixtures agree with the bids and access fixtures (AC-34 cross-fixture consistency)', () => {
  /** Supplier tenant ids with an effective (submitted) bid on the tender, from the bids domain. */
  function effectiveBidders(tenderId: number, lotId?: number): number[] {
    return [
      ...new Set(
        BIDS.filter(
          (bid) =>
            bid.tenderId === tenderId &&
            bid.submissionState === 'submitted' &&
            (lotId === undefined || bid.lotIds.includes(lotId)),
        ).map((bid) => bid.supplierTenantId),
      ),
    ].sort((a, b) => a - b);
  }
  const sorted = (ids: readonly number[]): number[] => [...new Set(ids)].sort((a, b) => a - b);

  it('names only T-2026-0007 bidders with an effective offer in its bidders, offers, notices and supplier outcomes', () => {
    const bidders = effectiveBidders(7);
    expect(bidders).toHaveLength(3);
    const tender = AWARD_TENDERS.find((row) => row.ref.tenderId === 7);
    expect(sorted(tender?.bidders.map((row) => TENANT_IDS[row.supplierSlug]) ?? [])).toEqual(bidders);
    const recommendation = RECOMMENDATIONS.find((row) => row.detail.recommendationId === 14)?.detail;
    expect(sorted(recommendation?.offers.map((row) => row.supplier.supplierTenantId) ?? [])).toEqual(bidders);
    expect(recommendation?.compliantOffersSummary).toMatch(/^Three compliant offers/);
    for (const notice of OUTCOME_NOTICES.filter((row) => row.detail.tenderId === 7)) {
      for (const recipient of notice.detail.recipients) {
        expect(bidders).toContain(recipient.supplier.supplierTenantId);
      }
    }
    const intent = OUTCOME_NOTICES.find((row) => row.detail.noticeId === 57)?.detail;
    expect(sorted(intent?.recipients.map((row) => row.supplier.supplierTenantId) ?? [])).toEqual(bidders);
    expect(intent?.recipients.filter((row) => row.deliveryStatus === 'failed')).toHaveLength(1);
    expect(sorted(SUPPLIER_OUTCOMES.filter((row) => row.core.tenderId === 7).map((row) => row.supplierTenantId))).toEqual(
      bidders,
    );
  });

  it('states the conflict position of each award tender consistently with the active conflict restrictions', () => {
    for (const { detail } of RECOMMENDATIONS) {
      const recused = ACCESS_RESTRICTIONS.filter(
        (row) =>
          row.restrictionType === 'conflict' &&
          row.scope.scopeType === 'tender' &&
          row.scope.scopeId === detail.tender.tenderId,
      );
      if (recused.length > 0) {
        expect(detail.conflictsSummary).not.toMatch(/no conflicts? declared/i);
        expect(detail.conflictsSummary).toMatch(/recus/i);
      }
    }
    const t7 = RECOMMENDATIONS.find((row) => row.detail.recommendationId === 14)?.detail;
    expect(t7?.conflictsSummary).toContain('recused');
    expect(t7?.unresolvedConflictCount).toBe(0);
  });

  it('never calls a cancelled lot offer the only one when several organizations bid on the lot', () => {
    const lot2Bidders = effectiveBidders(1, 102);
    expect(lot2Bidders.length).toBeGreaterThan(1);
    const texts = [
      LOT_OUTCOMES.find((row) => row.lotOutcomeId === 14012)?.reason ?? '',
      ...SUPPLIER_OUTCOMES.filter((row) => row.core.tenderId === 1).flatMap((row) =>
        row.core.lots.filter((lot) => lot.lot.lotNo === 2).map((lot) => lot.reason ?? ''),
      ),
      ...OUTCOME_NOTICES.filter((row) => row.detail.tenderId === 1).map((row) => row.detail.body),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\bthe only (lot 2 )?offer\b/i);
    }
  });
});
