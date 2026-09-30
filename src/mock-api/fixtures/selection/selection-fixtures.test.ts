/**
 * Selection fixtures: every projection parses against its contract schema, ids and references resolve, and the
 * storyline states of AC-21..AC-24 hold (docs/plan/demo-storyline.md, T-2026-0009).
 */
import { describe, expect, it } from 'vitest';

import {
  AssessmentSessionDetail,
  DueDiligenceCaseDetail,
  FinalOfferRoundDetail,
  NegotiationDetail,
  PreferredBidderDetail,
  ProcessDecision,
  ReferenceCheck,
  ShortlistDetail,
  SupplierAssessmentInvite,
  SupplierFinalOfferRound,
  SupplierNegotiationDetail,
  TenderSelectionSummary,
  isEffectAllowed,
} from '../../../contracts/selection.js';
import {
  awardBlockers,
  diligenceDetail,
  finalOfferBlockers,
  finalOfferDetail,
  isSupplierVisibleRound,
  negotiationDetail,
  preferredDetail,
  processDecisionView,
  referenceCheckView,
  sessionDetail,
  shortlistDetail,
  supplierFinalOfferView,
  supplierInviteView,
  supplierNegotiationDetail,
  tenderSummary,
} from '../../handlers/selection/build.js';
import { findPersonaById, findTenantById } from '../../persona.js';
import { TENANT_IDS } from '../platform.js';
import {
  ASSESSMENT_FINDINGS,
  ASSESSMENT_INVITES,
  ASSESSMENT_SESSIONS,
  DUE_DILIGENCE_CASES,
  FINAL_OFFER_ROUNDS,
  NEGOTIATIONS,
  PREFERRED_BIDDERS,
  PROCESS_DECISIONS,
  REFERENCE_CHECKS,
  SELECTION_BIDS,
  SELECTION_TENDERS,
  SHORTLISTS,
} from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');

function uniqueIds(values: readonly number[]): boolean {
  return new Set(values).size === values.length;
}

describe('selection fixtures parse against the contract', () => {
  it('builds a valid tender summary for every selection tender', () => {
    for (const tender of SELECTION_TENDERS) {
      expect(() => TenderSelectionSummary.parse(tenderSummary(tender))).not.toThrow();
    }
  });

  it('builds a valid session detail for every assessment session, with and without confidential access', () => {
    for (const session of ASSESSMENT_SESSIONS) {
      expect(() => AssessmentSessionDetail.parse(sessionDetail(session, true))).not.toThrow();
      expect(() => AssessmentSessionDetail.parse(sessionDetail(session, false))).not.toThrow();
    }
  });

  it('builds valid reference checks, shortlists, process decisions and preferred bidders', () => {
    for (const check of REFERENCE_CHECKS) {
      expect(() => ReferenceCheck.parse(referenceCheckView(check, true))).not.toThrow();
    }
    for (const shortlist of SHORTLISTS) {
      expect(() => ShortlistDetail.parse(shortlistDetail(shortlist))).not.toThrow();
    }
    for (const decision of PROCESS_DECISIONS) {
      expect(() => ProcessDecision.parse(processDecisionView(decision))).not.toThrow();
    }
    for (const preferred of PREFERRED_BIDDERS) {
      expect(() => PreferredBidderDetail.parse(preferredDetail(preferred))).not.toThrow();
    }
  });

  it('builds valid diligence cases, negotiations and final-offer rounds', () => {
    for (const diligence of DUE_DILIGENCE_CASES) {
      expect(() => DueDiligenceCaseDetail.parse(diligenceDetail(diligence))).not.toThrow();
    }
    for (const negotiation of NEGOTIATIONS) {
      expect(() => NegotiationDetail.parse(negotiationDetail(negotiation))).not.toThrow();
    }
    for (const round of FINAL_OFFER_ROUNDS) {
      expect(() => FinalOfferRoundDetail.parse(finalOfferDetail(round, NOW))).not.toThrow();
    }
  });

  it('builds valid supplier projections for every invitation and negotiation', () => {
    for (const invite of ASSESSMENT_INVITES) {
      expect(() => SupplierAssessmentInvite.parse(supplierInviteView(invite))).not.toThrow();
    }
    for (const negotiation of NEGOTIATIONS) {
      expect(() => SupplierNegotiationDetail.parse(supplierNegotiationDetail(negotiation))).not.toThrow();
    }
  });
});

describe('selection fixtures are internally consistent', () => {
  it('uses unique ids per record kind', () => {
    expect(uniqueIds(SELECTION_BIDS.map((row) => row.bidId))).toBe(true);
    expect(uniqueIds(ASSESSMENT_SESSIONS.map((row) => row.sessionId))).toBe(true);
    expect(uniqueIds(ASSESSMENT_INVITES.map((row) => row.inviteId))).toBe(true);
    expect(uniqueIds(ASSESSMENT_FINDINGS.map((row) => row.findingId))).toBe(true);
    expect(uniqueIds(REFERENCE_CHECKS.map((row) => row.referenceCheckId))).toBe(true);
    expect(uniqueIds(DUE_DILIGENCE_CASES.flatMap((row) => row.findings.map((finding) => finding.findingId)))).toBe(true);
    expect(uniqueIds(NEGOTIATIONS.flatMap((row) => row.rounds.map((round) => round.roundId)))).toBe(true);
  });

  it('keeps every record in a buyer tenant and every supplier column equal to the bid’s supplier', () => {
    for (const row of [...SELECTION_TENDERS, ...SELECTION_BIDS, ...ASSESSMENT_SESSIONS, ...SHORTLISTS, ...PREFERRED_BIDDERS]) {
      expect(findTenantById(row.tenantId)?.kind).toBe('buyer');
    }
    const bidSupplier = new Map(SELECTION_BIDS.map((bid) => [bid.bidId, bid.supplierTenantId]));
    for (const invite of ASSESSMENT_INVITES) {
      expect(bidSupplier.get(invite.bidId)).toBe(invite.supplierTenantId);
    }
    for (const negotiation of NEGOTIATIONS) {
      expect(bidSupplier.get(negotiation.bidId)).toBe(negotiation.supplierTenantId);
    }
    for (const round of FINAL_OFFER_ROUNDS) {
      for (const invitee of round.invitees) {
        expect(bidSupplier.get(invitee.bidId)).toBe(invitee.supplierTenantId);
      }
    }
    for (const bid of SELECTION_BIDS) {
      expect(findTenantById(bid.supplierTenantId)?.kind).toBe('supplier');
    }
  });

  it('names only real personas, and supplier confirmations come from members of that supplier', () => {
    for (const invite of ASSESSMENT_INVITES) {
      if (invite.supplierConfirmedBy !== null) {
        const persona = findPersonaById(invite.supplierConfirmedBy);
        expect(persona?.memberships.some((membership) => membership.tenantId === invite.supplierTenantId)).toBe(true);
      }
    }
    for (const finding of ASSESSMENT_FINDINGS) {
      expect(findPersonaById(finding.assessorUserId)?.memberships.some((row) => row.tenantId === finding.tenantId)).toBe(true);
    }
  });

  it('records findings whose effect follows the announced basis of their session (AC-21)', () => {
    for (const finding of ASSESSMENT_FINDINGS) {
      const session = ASSESSMENT_SESSIONS.find((row) => row.sessionId === finding.sessionId);
      expect(session).toBeDefined();
      if (session !== undefined) {
        expect(isEffectAllowed(session.assessmentBasis, finding.effect)).toBe(true);
      }
    }
  });

  it('records reference feedback only where the referee consented', () => {
    for (const check of REFERENCE_CHECKS) {
      if (!check.consentConfirmed) {
        expect(check.feedback).toBeNull();
        expect(check.contactedAt).toBeNull();
      }
    }
    expect(REFERENCE_CHECKS.some((check) => !check.consentConfirmed)).toBe(true);
  });
});

describe('final-offer rounds shown to suppliers (SUP-19, BR-30)', () => {
  it('has at least one issued round visible to an invited supplier, with instructions and an official deadline', () => {
    // Arrange
    const visible = FINAL_OFFER_ROUNDS.flatMap((round) =>
      round.invitees
        .filter((invitee) => isSupplierVisibleRound(round, invitee.supplierTenantId))
        .map((invitee) => SupplierFinalOfferRound.parse(supplierFinalOfferView(round, invitee.supplierTenantId))),
    );

    // Assert
    expect(visible.some((view) => view.status === 'issued' && view.deadline !== null)).toBe(true);
    for (const view of visible) {
      expect(view.instructions.length).toBeGreaterThan(0);
      expect(view.responseWorkspaceLink).toMatch(/^\/supplier\/responses\/\d+$/);
    }
  });

  it('issues a round only under explicit procedural authority', () => {
    for (const round of FINAL_OFFER_ROUNDS.filter((row) => row.status !== 'draft' && row.status !== 'awaiting_approval')) {
      const tender = SELECTION_TENDERS.find((row) => row.tenderId === round.tenderId);
      expect(tender).toBeDefined();
      if (tender !== undefined) {
        expect(finalOfferBlockers(tender), `round ${round.roundId}`).toEqual([]);
      }
    }
  });
});

describe('storyline states of T-2026-0009', () => {
  const tender = SELECTION_TENDERS.find((row) => row.reference === 'T-2026-0009');

  it('has an approved shortlist of two of three with a reason on every entry (AC-22)', () => {
    const shortlist = SHORTLISTS.find((row) => row.tenderId === tender?.tenderId);
    expect(shortlist?.status).toBe('approved');
    expect(shortlist?.entries.filter((entry) => entry.included)).toHaveLength(2);
    expect(shortlist?.entries.filter((entry) => !entry.included)).toHaveLength(1);
    expect(shortlist?.entries.every((entry) => entry.reason.length > 0 && entry.notice !== null)).toBe(true);
  });

  it('records the failed preferred bidder with an approved fallback decision, and blocks the award (AC-24)', () => {
    const failed = PREFERRED_BIDDERS.find((row) => row.status === 'failed_diligence');
    const decision = PROCESS_DECISIONS.find((row) => row.processDecisionId === failed?.fallbackProcessDecisionId);
    expect(decision).toMatchObject({ decisionType: 'fallback_to_next_bidder', status: 'approved' });
    expect(DUE_DILIGENCE_CASES.find((row) => row.preferredBidderId === failed?.preferredBidderId)?.status).toBe('failed');
    expect(tender === undefined ? [] : awardBlockers(tender).map((row) => row.code)).toContain('DILIGENCE_NOT_PASSED');
  });

  it('blocks the final-offer round with an explanation and a required process decision (AC-23)', () => {
    const round = FINAL_OFFER_ROUNDS[0];
    expect(round).toBeDefined();
    if (round !== undefined) {
      const detail = finalOfferDetail(round, NOW);
      expect(detail.issueGate.allowed).toBe(false);
      expect(detail.issueGate.blockers.map((row) => row.code)).toEqual(
        expect.arrayContaining(['BAFO_NOT_PERMITTED', 'PROCESS_DECISION_REQUIRED']),
      );
    }
  });

  it('keeps ODC and every supplier-only tenant free of buyer selection records', () => {
    const buyerTenants = new Set([...SELECTION_TENDERS, ...SHORTLISTS, ...PREFERRED_BIDDERS, ...NEGOTIATIONS].map((row) => row.tenantId));
    expect([...buyerTenants]).toEqual([TENANT_IDS.kwu]);
  });
});
