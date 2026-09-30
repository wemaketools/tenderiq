/**
 * Contract-valid test data of the selection SPA tests (test data only; the application's data comes from the API).
 * Each builder returns a complete record that callers override per test.
 */
import type { Page } from '@contracts/common';
import type {
  AssessmentSessionDetail,
  AssessmentSessionRow,
  DueDiligenceCaseDetail,
  DueDiligenceCaseRow,
  FinalOfferRoundDetail,
  FinalOfferRoundRow,
  NegotiationDetail,
  NegotiationRow,
  PreferredBidderDetail,
  PreferredBidderRow,
  ProcessDecision,
  ReferenceCheck,
  SelectionBidRef,
  SelectionCandidate,
  SelectionTenderRef,
  SelectionTenderRow,
  ShortlistDetail,
  ShortlistRow,
  SupplierAssessmentInvite,
  SupplierFinalOfferRound,
  SupplierNegotiationDetail,
  SupplierNegotiationRow,
  TenderSelectionSummary,
} from '@contracts/selection';

export const HASH = 'a'.repeat(64);
export const ZONE = 'Africa/Gaborone';
const AT = '2026-09-20T08:00:00Z';

export function page<T>(items: readonly T[]): Page<T> {
  return { items: [...items], total: items.length, page: 1, pageSize: 25 };
}

export const tenderRef: SelectionTenderRef = {
  tenderId: 9,
  reference: 'T-2026-0009',
  title: 'Acoustic leak detection services',
  officialTimeZone: ZONE,
};

export const bidA: SelectionBidRef = {
  bidId: 907,
  supplierTenantId: 7,
  supplierName: 'Serowe ICT Solutions (Pty) Ltd',
  isAlternative: false,
};

export const bidB: SelectionBidRef = {
  bidId: 908,
  supplierTenantId: 8,
  supplierName: 'Limpopo Environmental Services (Pty) Ltd',
  isAlternative: false,
};

const tebogo = { userId: 5, fullName: 'Tebogo Molefe' };
const mpho = { userId: 4, fullName: 'Mpho Dikgang' };

export function tenderRow(overrides: Partial<SelectionTenderRow> = {}): SelectionTenderRow {
  return {
    tenderId: 9,
    reference: 'T-2026-0009',
    title: 'Acoustic leak detection services',
    eventType: 'rfp',
    procedure: 'restricted',
    status: 'under_assessment',
    stageNo: 2,
    owner: tebogo,
    officialTimeZone: ZONE,
    conditions: {
      demonstrationsPermitted: true,
      referencesPermitted: true,
      negotiationPermitted: true,
      bafoPermitted: false,
      alternativesAllowed: true,
      conditionsNote: 'Stage-two conditions §7.2: no best and final offer round is provided for.',
    },
    sessionCount: 2,
    shortlistStatus: 'approved',
    preferredBidderStatus: 'approved',
    dueDiligenceStatus: 'open',
    negotiationStatus: 'active',
    blockerCount: 2,
    updatedAt: AT,
    ...overrides,
  };
}

export function candidate(
  bid: SelectionBidRef,
  overrides: Partial<SelectionCandidate> = {},
): SelectionCandidate {
  return {
    bid,
    lot: null,
    nonPriceScore: '57.20',
    totalScore: '87.20',
    rank: 1,
    passesGates: true,
    evaluatedValue: { amount: '2780000.00', currency: 'BWP' },
    shortlisted: true,
    ...overrides,
  };
}

export function tenderSummary(
  overrides: Partial<TenderSelectionSummary> = {},
): TenderSelectionSummary {
  return {
    tender: tenderRow(),
    lots: [{ lotId: 901, lotNo: 1, title: 'Leak detection' }],
    candidates: [
      candidate(bidA),
      candidate(bidB, { nonPriceScore: '54.60', totalScore: '82.97', rank: 2 }),
    ],
    team: [tebogo, mpho],
    eligible: { decisionOwners: [mpho, tebogo], findingOwners: [tebogo], negotiators: [tebogo] },
    criteria: [{ criterionId: 9505, name: 'Correlator and listening equipment', weight: '10' }],
    gates: {
      negotiation: { allowed: true, blockers: [] },
      finalOffer: {
        allowed: false,
        blockers: [
          {
            code: 'BAFO_NOT_PERMITTED',
            message: 'The issued conditions do not provide for a final offer.',
          },
        ],
      },
      award: {
        allowed: false,
        blockers: [{ code: 'DILIGENCE_NOT_PASSED', message: 'Due diligence is still open.' }],
      },
    },
    ...overrides,
  };
}

export function sessionRow(overrides: Partial<AssessmentSessionRow> = {}): AssessmentSessionRow {
  return {
    sessionId: 1,
    tender: tenderRef,
    lot: null,
    sessionType: 'demonstration',
    purpose: 'Field demonstration of the offered correlator.',
    assessmentBasis: 'scored_criterion',
    criterion: { criterionId: 9505, name: 'Correlator and listening equipment', weight: '10' },
    status: 'scheduled',
    preparationDays: 5,
    firstScheduledAt: '2026-10-07T07:00:00Z',
    inviteCount: 1,
    confirmedCount: 1,
    findingCount: 0,
    equalTreatmentConfirmed: true,
    createdBy: tebogo,
    updatedAt: AT,
    ...overrides,
  };
}

export function referenceCheck(overrides: Partial<ReferenceCheck> = {}): ReferenceCheck {
  return {
    referenceCheckId: 1,
    tender: tenderRef,
    bid: bidA,
    refereeName: 'Kefentse Moeti',
    refereeOrganization: 'Francistown City Council',
    consentConfirmed: true,
    contactedAt: null,
    feedback: null,
    feedbackRestricted: false,
    confidential: false,
    assessor: null,
    outcome: null,
    updatedAt: AT,
    ...overrides,
  };
}

export function sessionDetail(
  overrides: Partial<AssessmentSessionDetail> = {},
): AssessmentSessionDetail {
  return {
    ...sessionRow(),
    agenda: '08:00 set-up · 08:30 survey · 12:00 close.',
    instructions:
      'Bring the offered correlator; the same test section is used for every candidate.',
    equalTreatment: {
      confirmedBy: mpho,
      confirmedAt: AT,
      checks: [
        { check: 'basis_declared', satisfied: true, detail: 'Feeds the announced criterion.' },
        { check: 'preparation_time', satisfied: true, detail: 'Every invitee had 5 days.' },
      ],
    },
    treatment: {
      allowedEffects: ['score_input'],
      description: 'Findings feed the announced criterion only.',
    },
    invites: [
      {
        inviteId: 1,
        bid: bidA,
        scheduledAt: '2026-10-07T07:00:00Z',
        status: 'confirmed',
        invitedAt: AT,
        supplierConfirmedAt: AT,
        supplierConfirmedBy: { userId: 33, fullName: 'Otsile Serowe' },
      },
    ],
    findings: [],
    referenceChecks: [],
    invitableBids: [bidB],
    completionSummary: null,
    cancellationReason: null,
    ...overrides,
  };
}

export function shortlistRow(overrides: Partial<ShortlistRow> = {}): ShortlistRow {
  return {
    shortlistId: 9,
    tender: tenderRef,
    lot: null,
    stageNo: 1,
    selectionRule: 'Advance the two highest-ranked applicants at or above the threshold.',
    threshold: '49.00',
    status: 'approved',
    includedCount: 2,
    excludedCount: 1,
    approval: { approvalRequestId: 41, status: 'approved', requestedAt: AT, decidedAt: AT },
    approvedAt: AT,
    notifiedAt: null,
    updatedAt: AT,
    ...overrides,
  };
}

export function shortlistDetail(overrides: Partial<ShortlistDetail> = {}): ShortlistDetail {
  return {
    ...shortlistRow(),
    rationale: 'Two applicants meet the threshold.',
    changeReason: null,
    entries: [
      {
        entryId: 1,
        bid: bidA,
        included: true,
        rank: 1,
        reason: 'Meets the threshold; ranked first.',
        conditions: null,
        nonPriceScore: '57.20',
        totalScore: '87.20',
        notifiedAt: null,
        notice: null,
      },
      {
        entryId: 2,
        bid: bidB,
        included: false,
        rank: null,
        reason: 'Below the threshold.',
        conditions: null,
        nonPriceScore: '38.50',
        totalScore: null,
        notifiedAt: null,
        notice: null,
      },
    ],
    approvalSubject: {
      subjectType: 'shortlist',
      subjectId: 9,
      subjectVersion: 1,
      contentHash: HASH,
    },
    nextStage: { tender: null, createLink: '/buyer/tenders/new' },
    notifyGate: { allowed: true, blockers: [] },
    ...overrides,
  };
}

export function processDecision(overrides: Partial<ProcessDecision> = {}): ProcessDecision {
  return {
    processDecisionId: 2,
    tender: tenderRef,
    lot: null,
    decisionType: 'reopen_round',
    reason: 'Seek authority for a final-offer round.',
    status: 'proposed',
    proposedBy: tebogo,
    decidedBy: null,
    approval: null,
    approvalSubject: {
      subjectType: 'process_decision',
      subjectId: 2,
      subjectVersion: 1,
      contentHash: HASH,
    },
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function preferredRow(overrides: Partial<PreferredBidderRow> = {}): PreferredBidderRow {
  return {
    preferredBidderId: 1,
    tender: tenderRef,
    lot: null,
    bid: bidA,
    scope: 'Leak detection surveys for 36 months.',
    proposedValue: { amount: '2780000.00', currency: 'BWP' },
    status: 'failed_diligence',
    statusReason: 'Due diligence failed on financial position.',
    decisionOwner: mpho,
    approval: null,
    dueDiligence: { caseId: 1, status: 'failed', awardBlockingCount: 1 },
    fallbackBid: bidB,
    updatedAt: AT,
    ...overrides,
  };
}

export function preferredDetail(
  overrides: Partial<PreferredBidderDetail> = {},
): PreferredBidderDetail {
  return {
    ...preferredRow(),
    rationale: 'Highest total with the lowest evaluated cost.',
    remainingChecks: 'Financial position and insurance.',
    negotiationTopics: ['Mobilisation schedule'],
    contingencyPlan: 'Approach the second-ranked candidate.',
    comparison: [candidate(bidA), candidate(bidB, { rank: 2 })],
    processDecisions: [],
    approvalSubject: {
      subjectType: 'preferred_bidder',
      subjectId: 1,
      subjectVersion: 1,
      contentHash: HASH,
    },
    fallbackGate: { allowed: true, blockers: [] },
    awardGate: {
      allowed: false,
      blockers: [{ code: 'DILIGENCE_FAILED', message: 'Due diligence failed for this bidder.' }],
    },
    ...overrides,
  };
}

export function diligenceRow(overrides: Partial<DueDiligenceCaseRow> = {}): DueDiligenceCaseRow {
  return {
    caseId: 2,
    tender: tenderRef,
    preferredBidder: { preferredBidderId: 2, status: 'approved' },
    bid: bidB,
    owner: tebogo,
    status: 'open',
    dispositionCounts: { satisfied: 3, condition: 0, unresolved: 1, failed: 0 },
    awardBlockingCount: 1,
    nextDueAt: '2026-10-14T10:00:00Z',
    decidedAt: null,
    updatedAt: AT,
    ...overrides,
  };
}

export function diligenceDetail(
  overrides: Partial<DueDiligenceCaseDetail> = {},
): DueDiligenceCaseDetail {
  return {
    ...diligenceRow(),
    decidedBy: null,
    decisionNote: null,
    findings: [
      {
        findingId: 21,
        area: 'insurance',
        finding: 'Professional indemnity cover expires before contract start.',
        disposition: 'unresolved',
        owner: tebogo,
        dueAt: '2026-10-14T10:00:00Z',
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: true,
        updatedAt: AT,
      },
    ],
    areas: [
      { area: 'financial', findingCount: 1, worstDisposition: 'satisfied' },
      { area: 'insurance', findingCount: 1, worstDisposition: 'unresolved' },
    ],
    evidenceRequests: [],
    passGate: {
      allowed: false,
      blockers: [{ code: 'DILIGENCE_FINDINGS_UNRESOLVED', message: 'One finding is unresolved.' }],
    },
    awardGate: {
      allowed: false,
      blockers: [{ code: 'DILIGENCE_NOT_PASSED', message: 'Due diligence is still open.' }],
    },
    fallbackDecision: null,
    ...overrides,
  };
}

export function negotiationRow(overrides: Partial<NegotiationRow> = {}): NegotiationRow {
  return {
    negotiationId: 2,
    tender: tenderRef,
    lot: null,
    bid: bidB,
    status: 'active',
    allowedTopics: ['Service credits', 'Data ownership'],
    authorizedNegotiators: [tebogo],
    commercialAuthority: { amount: '2940000.00', currency: 'BWP' },
    approval: { approvalRequestId: 44, status: 'approved', requestedAt: AT, decidedAt: AT },
    roundCount: 1,
    lastMeetingAt: AT,
    affectsCompetitionBasis: false,
    updatedAt: AT,
    ...overrides,
  };
}

export function negotiationDetail(overrides: Partial<NegotiationDetail> = {}): NegotiationDetail {
  return {
    ...negotiationRow(),
    outcomeSummary: null,
    rounds: [
      {
        roundId: 1,
        roundNo: 1,
        meetingAt: AT,
        participants: 'Tebogo Molefe; Mothusi Limpopo',
        topics: ['Service credits', 'Data ownership'],
        minutes: 'Discussed service credits within the mandate.',
        buyerProposal: 'Credits capped at 10%.',
        supplierProposal: 'Credits capped at 5%.',
        concessions: null,
        unresolvedIssues: 'Service-credit cap.',
        supplierResponseAt: AT,
        supplierVisible: true,
      },
    ],
    processDecision: null,
    preferredBidderId: 2,
    approvalSubject: {
      subjectType: 'negotiation_mandate',
      subjectId: 2,
      subjectVersion: 1,
      contentHash: HASH,
    },
    roundGate: { allowed: true, blockers: [] },
    ...overrides,
  };
}

export function finalOfferRow(overrides: Partial<FinalOfferRoundRow> = {}): FinalOfferRoundRow {
  return {
    roundId: 1,
    tender: tenderRef,
    lot: null,
    status: 'draft',
    deadline: { at: '2026-10-20T08:00:00Z', timeZone: ZONE },
    inviteeCount: 1,
    proceduralAuthorityRef: 'Pending: process decision 2',
    approval: null,
    updatedAt: AT,
    ...overrides,
  };
}

export function finalOfferDetail(
  overrides: Partial<FinalOfferRoundDetail> = {},
): FinalOfferRoundDetail {
  return {
    ...finalOfferRow(),
    instructions: 'Submit a best and final offer for the variant.',
    permittedChanges: 'Unit rates only.',
    openingRules: 'Opened after the deadline with a witness.',
    evaluationTreatment: 'Replaces the commercial score of the variant only.',
    invitees: [
      {
        bid: { ...bidB, isAlternative: true },
        notifiedAt: null,
        finalOfferReceivedAt: null,
        earlierOffer: { amount: '2610000.00', currency: 'BWP' },
        finalOffer: null,
      },
    ],
    approvalSubject: {
      subjectType: 'final_offer_round',
      subjectId: 1,
      subjectVersion: 1,
      contentHash: HASH,
    },
    issueGate: {
      allowed: false,
      blockers: [
        {
          code: 'BAFO_NOT_PERMITTED',
          message: 'The issued conditions do not provide for a final offer.',
        },
        { code: 'PROCESS_DECISION_REQUIRED', message: 'Process decision 2 is awaiting approval.' },
      ],
    },
    ...overrides,
  };
}

const buyer = { tenantId: 2, name: 'Kalahari Water Utilities (Pilot)' };

export function supplierInvite(
  overrides: Partial<SupplierAssessmentInvite> = {},
): SupplierAssessmentInvite {
  return {
    inviteId: 6,
    buyer,
    tender: tenderRef,
    sessionType: 'interview',
    sessionStatus: 'scheduled',
    purpose: 'Verify the availability of the proposed lead engineer.',
    agenda: '09:00 introductions · 09:15 interview.',
    instructions: 'The lead engineer attends in person.',
    preparationDays: 5,
    assessmentBasis: 'claim_verification',
    scheduledAt: '2026-10-07T07:00:00Z',
    status: 'invited',
    invitedAt: AT,
    supplierConfirmedAt: null,
    supplierConfirmedBy: null,
    respondGate: { allowed: true, blockers: [] },
    ...overrides,
  };
}

export function supplierFinalOffer(
  overrides: Partial<SupplierFinalOfferRound> = {},
): SupplierFinalOfferRound {
  return {
    roundId: 3,
    buyer,
    tender: tenderRef,
    status: 'issued',
    deadline: { at: '2026-10-20T08:00:00Z', timeZone: ZONE },
    instructions: 'Submit your final offer.',
    permittedChanges: 'Unit rates only.',
    openingRules: 'Opened after the deadline.',
    evaluationTreatment: 'Replaces the commercial score.',
    notifiedAt: AT,
    finalOfferReceivedAt: null,
    responseWorkspaceLink: '/supplier/responses/908',
    ...overrides,
  };
}

export function supplierNegotiationRow(
  overrides: Partial<SupplierNegotiationRow> = {},
): SupplierNegotiationRow {
  return {
    negotiationId: 2,
    buyer,
    tender: tenderRef,
    status: 'active',
    allowedTopics: ['Service credits'],
    roundCount: 2,
    awaitingResponse: true,
    lastMeetingAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function supplierNegotiationDetail(
  overrides: Partial<SupplierNegotiationDetail> = {},
): SupplierNegotiationDetail {
  return {
    ...supplierNegotiationRow(),
    isAlternative: false,
    outcomeSummary: null,
    rounds: [
      {
        roundId: 12,
        roundNo: 2,
        meetingAt: AT,
        participants: 'Tebogo Molefe; Mothusi Limpopo',
        topics: ['Service credits', 'Data ownership'],
        minutes: null,
        buyerProposal: 'Service credits capped at 7.5%.',
        supplierProposal: null,
        concessions: null,
        unresolvedIssues: 'Service-credit cap.',
        supplierResponseAt: null,
        awaitingResponse: true,
      },
    ],
    finalOfferRounds: [supplierFinalOffer()],
    ...overrides,
  };
}
