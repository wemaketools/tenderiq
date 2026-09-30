/**
 * Selection fixtures against the rest of the demo world: every assignment names a person holding the permission it
 * needs (PRD §4.1, NEGOTIATOR_NOT_ELIGIBLE, FINDING_OWNER_NOT_ELIGIBLE), every approval reference agrees with the
 * approvals fixtures, negotiation rounds stay within the mandate, and user-facing texts carry no internal numbers.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ASSESSMENT_VIEW_PERMISSIONS } from '../../../contracts/selection.js';
import { ASSIGNMENT_PERMISSIONS, holdsPermission, isEligibleFor } from '../../handlers/selection/build.js';
import { APPROVALS } from '../approvals.js';
import {
  ASSESSMENT_SESSIONS,
  DUE_DILIGENCE_CASES,
  FINAL_OFFER_ROUNDS,
  NEGOTIATIONS,
  PREFERRED_BIDDERS,
  PROCESS_DECISIONS,
  SELECTION_TENDERS,
  SHORTLISTS,
} from './index.js';
import type { FixtureApproval, FixtureSelectionTender } from './index.js';

type SubjectType = 'shortlist' | 'preferred_bidder' | 'negotiation_mandate' | 'final_offer_round' | 'process_decision';

interface ApprovalReference {
  readonly subjectType: SubjectType;
  readonly subjectId: number;
  readonly subjectVersion: number;
  readonly contentHash: string;
  readonly approval: FixtureApproval;
}

/**
 * Approval requests the selection fixtures refer to that the approvals fixtures do not hold yet (follow-up for the
 * approvals owner, see the selection progress report). Once added there, they are checked like every other one.
 */

function tenderOfRecord(tenderId: number): FixtureSelectionTender {
  const tender = SELECTION_TENDERS.find((row) => row.tenderId === tenderId);
  if (tender === undefined) {
    throw new Error(`No selection tender ${tenderId}.`);
  }
  return tender;
}

function approvalReferences(): ApprovalReference[] {
  const refs: ApprovalReference[] = [];
  const push = (
    subjectType: SubjectType,
    subjectId: number,
    record: { readonly version: number; readonly contentHash: string; readonly approval: FixtureApproval | null },
  ): void => {
    if (record.approval !== null) {
      refs.push({ subjectType, subjectId, subjectVersion: record.version, contentHash: record.contentHash, approval: record.approval });
    }
  };
  SHORTLISTS.forEach((row) => push('shortlist', row.shortlistId, row));
  PREFERRED_BIDDERS.forEach((row) => push('preferred_bidder', row.preferredBidderId, row));
  NEGOTIATIONS.forEach((row) => push('negotiation_mandate', row.negotiationId, row));
  FINAL_OFFER_ROUNDS.forEach((row) => push('final_offer_round', row.roundId, row));
  PROCESS_DECISIONS.forEach((row) => push('process_decision', row.processDecisionId, row));
  return refs;
}

describe('selection assignments name eligible people', () => {
  it('names finding owners who hold diligence.manage on the tender team', () => {
    // Arrange
    const owners = DUE_DILIGENCE_CASES.flatMap((diligence) => {
      const preferred = PREFERRED_BIDDERS.find((row) => row.preferredBidderId === diligence.preferredBidderId);
      const tender = tenderOfRecord(preferred?.tenderId ?? 0);
      return [diligence.ownerUserId, ...diligence.findings.map((row) => row.ownerUserId)]
        .filter((userId): userId is number => userId !== null)
        .map((userId) => ({ tender, userId }));
    });

    // Assert
    expect(owners.length).toBeGreaterThan(0);
    for (const { tender, userId } of owners) {
      expect(isEligibleFor(tender, userId, 'findingOwner'), `finding owner ${userId}`).toBe(true);
    }
  });

  it('names negotiators who hold negotiation.conduct on the tender team', () => {
    for (const negotiation of NEGOTIATIONS) {
      const tender = tenderOfRecord(negotiation.tenderId);
      for (const userId of negotiation.authorizedNegotiatorIds) {
        expect(isEligibleFor(tender, userId, 'negotiator'), `negotiator ${userId}`).toBe(true);
      }
    }
  });

  it('names decision owners and equal-treatment confirmations by people who manage selection', () => {
    for (const preferred of PREFERRED_BIDDERS) {
      expect(isEligibleFor(tenderOfRecord(preferred.tenderId), preferred.decisionOwnerUserId, 'decisionOwner')).toBe(true);
    }
    for (const session of ASSESSMENT_SESSIONS) {
      if (session.equalTreatmentConfirmedBy !== null) {
        expect(
          holdsPermission(session.tenantId, session.equalTreatmentConfirmedBy, ASSIGNMENT_PERMISSIONS.equalTreatment),
        ).toBe(true);
      }
    }
  });

  it('lists only team members who can read the tender’s selection or assessment records', () => {
    for (const tender of SELECTION_TENDERS) {
      for (const userId of tender.teamUserIds) {
        const canRead = ASSESSMENT_VIEW_PERMISSIONS.some((code) => holdsPermission(tender.tenantId, userId, code));
        expect(canRead, `team member ${userId}`).toBe(true);
      }
    }
  });
});

describe('selection approval references agree with the approvals fixtures', () => {
  it('resolves every approval reference to an approval request with the same subject, status and content', () => {
    // Arrange
    const refs = approvalReferences();

    // Assert
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const approval = APPROVALS.find((row) => row.id === ref.approval.approvalRequestId);
      expect(approval, `approval ${ref.approval.approvalRequestId}`).toBeDefined();
      expect(approval).toMatchObject({
        subjectType: ref.subjectType,
        subjectId: ref.subjectId,
        subjectVersion: ref.subjectVersion,
        contentHash: ref.contentHash,
        status: ref.approval.status,
        requestedAt: ref.approval.requestedAt,
        decidedAt: ref.approval.decidedAt,
      });
    }
  });

  it('resolves the shortlist approval of T-2026-0009 (approval 41)', () => {
    const shortlist = SHORTLISTS.find((row) => row.shortlistId === 9);
    expect(APPROVALS.find((row) => row.id === shortlist?.approval?.approvalRequestId)).toMatchObject({
      subjectType: 'shortlist',
      subjectId: 9,
      status: 'approved',
    });
  });

  it('uses the approvals content-hash convention for every approval subject', () => {
    for (const ref of approvalReferences()) {
      const expected = createHash('sha256').update(`approval:${ref.approval.approvalRequestId}:v${ref.subjectVersion}`).digest('hex');
      expect(ref.contentHash, `${ref.subjectType} ${ref.subjectId}`).toBe(expected);
    }
  });
});

describe('negotiation rounds and user-facing texts', () => {
  it('records round topics within the approved mandate', () => {
    for (const negotiation of NEGOTIATIONS) {
      for (const round of negotiation.rounds) {
        expect(round.topics.length).toBeGreaterThan(0);
        for (const topic of round.topics) {
          expect(negotiation.allowedTopics).toContain(topic);
        }
      }
    }
  });

  it('never exposes internal record or criterion numbers in texts shown to users', () => {
    const internal = /\b(case|negotiation|process decision|preferred bidder|fallback decision|criterion|session) \d+/i;
    const texts = [
      ...ASSESSMENT_SESSIONS.flatMap((row) => [row.purpose, row.instructions, row.completionSummary, row.cancellationReason]),
      ...PROCESS_DECISIONS.map((row) => row.reason),
      ...PREFERRED_BIDDERS.flatMap((row) => [row.rationale, row.remainingChecks, row.contingencyPlan, row.statusReason]),
      ...DUE_DILIGENCE_CASES.flatMap((row) => [row.decisionNote, ...row.findings.map((finding) => finding.finding)]),
      ...NEGOTIATIONS.flatMap((row) => [row.outcomeSummary, ...row.rounds.map((round) => round.minutes)]),
      ...FINAL_OFFER_ROUNDS.map((row) => row.proceduralAuthorityRef),
    ].filter((text): text is string => text !== null);
    for (const text of texts) {
      expect(text).not.toMatch(internal);
    }
  });
});
