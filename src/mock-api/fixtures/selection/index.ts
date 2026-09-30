/**
 * Selection fixtures (docs/plan/demo-storyline.md; PRD §7.12, §7.13; AC-21..AC-24).
 *
 * The world (shared with the evaluation and awards fixtures):
 * - KWU T-2026-0009 "Acoustic leak detection services" (rfp, restricted, multi-stage, under assessment, stage 2).
 *   Stage one: Serowe ICT (non-price 57.20, total 87.20), Limpopo Environmental Services (54.60, 82.97) and
 *   Gaborone Metering (38.50, below the 49.00 non-price threshold). The shortlist (2 of 3) is approved (approval 41)
 *   and notified (AC-22). A field demonstration (scored criterion) and a reference-check session (claim
 *   verification, one referee without consent) are complete (AC-21); a key-personnel interview with Limpopo is
 *   scheduled and awaits Limpopo's confirmation (SUP-18). Serowe ICT was the conditional preferred bidder, failed
 *   financial due diligence, and the declared fallback to Limpopo is recorded and approved (AC-24). Limpopo is now
 *   the approved preferred bidder with an open due-diligence case (one award-blocking finding: professional
 *   indemnity insurance). The negotiation with Limpopo is active (mandate approved, round 1 held, round 2 awaits
 *   Limpopo's response, SUP-19). A final-offer round on Limpopo's variant is a draft that cannot be issued: the
 *   issued conditions permit neither a BAFO nor negotiation of the variant, and the process decision that would
 *   authorize it is still proposed; an earlier attempt to use a clarification instead was rejected (AC-23).
 * - KWU T-2026-0001 Lot 3 (pump controls and telemetry panels, still in evaluation): a sample-panel SCADA test
 *   (eligibility gate) is scheduled with Tsodilo (confirmed) and Chobe Pipe (awaiting confirmation), and a workshop
 *   inspection is planned.
 * - ODC and every other tenant have no selection records (cross-buyer segregation, supplier isolation).
 *
 * Rows carry `tenantId` (the buyer) and supplier rows `supplierTenantId`; handlers filter and strip them. Ids of
 * records created by commands start at 9001. Bid, lot, criterion, approval, notice, clarification and document ids
 * referenced here are listed for the owning domains in the selection progress report.
 */
import type { Money } from '../../../contracts/common.js';
import type {
  ApprovalRequestsStatus,
  AssessmentFindingsEffect,
  AssessmentInvitesStatus,
  AssessmentSessionsAssessmentBasis,
  AssessmentSessionsSessionType,
  AssessmentSessionsStatus,
  BidClarificationsStatus,
  DueDiligenceCasesStatus,
  DueDiligenceFindingsArea,
  DueDiligenceFindingsDisposition,
  FinalOfferRoundsStatus,
  NegotiationsStatus,
  NoticesNoticeType,
  NoticesStatus,
  PreferredBiddersStatus,
  ProcessDecisionsDecisionType,
  ProcessDecisionsStatus,
  ShortlistsStatus,
  TendersEventType,
  TendersProcedure,
  TendersStatus,
} from '../../../contracts/enums.js';
import type { SelectionConditions } from '../../../contracts/selection.js';
import { TENANT_IDS } from '../platform.js';

// ---------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------

export interface FixtureApproval {
  readonly approvalRequestId: number;
  readonly status: ApprovalRequestsStatus;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
}

export interface FixtureSelectionTender {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly reference: string;
  readonly title: string;
  readonly eventType: TendersEventType;
  readonly procedure: TendersProcedure;
  readonly status: TendersStatus;
  readonly stageNo: number;
  readonly ownerUserId: number;
  readonly officialTimeZone: string;
  readonly conditions: SelectionConditions;
  readonly lots: readonly { readonly lotId: number; readonly lotNo: number; readonly title: string }[];
  readonly criteria: readonly {
    readonly criterionId: number;
    readonly lotId: number | null;
    readonly name: string;
    readonly weight: string;
  }[];
  /**
   * The buyer team: members who can read the tender's selection or assessment records. Every assignment (decision
   * owner, finding owner, negotiator, equal-treatment confirmation) names a member holding the permission it needs.
   */
  readonly teamUserIds: readonly number[];
  readonly updatedAt: string;
}

export interface FixtureSelectionBid {
  readonly tenantId: number;
  readonly bidId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly supplierTenantId: number;
  readonly supplierName: string;
  readonly isAlternative: boolean;
  readonly nonPriceScore: string | null;
  readonly totalScore: string | null;
  readonly rank: number | null;
  readonly passesGates: boolean;
  readonly evaluatedValue: Money | null;
}

export interface FixtureAssessmentSession {
  readonly tenantId: number;
  readonly sessionId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly sessionType: AssessmentSessionsSessionType;
  readonly purpose: string;
  readonly agenda: string;
  readonly assessmentBasis: AssessmentSessionsAssessmentBasis;
  readonly criterionId: number | null;
  readonly instructions: string;
  readonly preparationDays: number;
  readonly equalTreatmentConfirmedBy: number | null;
  readonly equalTreatmentConfirmedAt: string | null;
  readonly status: AssessmentSessionsStatus;
  readonly createdBy: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completionSummary: string | null;
  readonly cancellationReason: string | null;
}

export interface FixtureAssessmentInvite {
  readonly tenantId: number;
  readonly inviteId: number;
  readonly sessionId: number;
  readonly bidId: number;
  readonly supplierTenantId: number;
  readonly scheduledAt: string | null;
  readonly status: AssessmentInvitesStatus;
  readonly invitedAt: string;
  readonly supplierConfirmedAt: string | null;
  readonly supplierConfirmedBy: number | null;
}

export interface FixtureAssessmentFinding {
  readonly tenantId: number;
  readonly findingId: number;
  readonly sessionId: number;
  readonly bidId: number;
  readonly assessorUserId: number;
  readonly finding: string;
  readonly effect: AssessmentFindingsEffect;
  readonly evidenceDocumentId: number | null;
  readonly evidenceTitle: string | null;
  readonly recordedAt: string;
}

export interface FixtureReferenceCheck {
  readonly tenantId: number;
  readonly referenceCheckId: number;
  readonly bidId: number;
  readonly refereeName: string;
  readonly refereeOrganization: string;
  readonly consentConfirmed: boolean;
  readonly contactedAt: string | null;
  readonly feedback: string | null;
  readonly confidential: boolean;
  readonly assessorUserId: number | null;
  readonly outcome: string | null;
  readonly updatedAt: string;
}

export interface FixtureNotice {
  readonly noticeId: number;
  readonly noticeType: NoticesNoticeType;
  readonly status: NoticesStatus;
  readonly title: string;
  readonly issuedAt: string | null;
}

export interface FixtureShortlistEntry {
  readonly entryId: number;
  readonly bidId: number;
  readonly included: boolean;
  readonly rank: number | null;
  readonly reason: string;
  readonly conditions: string | null;
  readonly notifiedAt: string | null;
  readonly notice: FixtureNotice | null;
}

export interface FixtureShortlist {
  readonly tenantId: number;
  readonly shortlistId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly stageNo: number;
  readonly selectionRule: string;
  readonly threshold: string | null;
  readonly rationale: string;
  readonly status: ShortlistsStatus;
  readonly approval: FixtureApproval | null;
  readonly approvedAt: string | null;
  readonly changeReason: string | null;
  readonly version: number;
  readonly contentHash: string;
  /** The next-stage event: a later stage of the same multi-stage event, or a separate linked event. */
  readonly nextStageTender: { readonly tenderId: number; readonly reference: string; readonly stageNo: number } | null;
  readonly entries: readonly FixtureShortlistEntry[];
  readonly updatedAt: string;
}

export interface FixtureProcessDecision {
  readonly tenantId: number;
  readonly processDecisionId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly decisionType: ProcessDecisionsDecisionType;
  readonly reason: string;
  readonly status: ProcessDecisionsStatus;
  readonly proposedBy: number;
  readonly decidedBy: number | null;
  readonly approval: FixtureApproval | null;
  readonly version: number;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FixturePreferredBidder {
  readonly tenantId: number;
  readonly preferredBidderId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly bidId: number;
  readonly scope: string;
  readonly proposedValue: Money;
  readonly rationale: string;
  readonly remainingChecks: string;
  readonly negotiationTopics: readonly string[];
  readonly decisionOwnerUserId: number;
  readonly contingencyPlan: string;
  readonly fallbackBidId: number | null;
  readonly status: PreferredBiddersStatus;
  readonly statusReason: string | null;
  readonly approval: FixtureApproval | null;
  /** The recorded fallback decision after a failure or withdrawal (AC-24). */
  readonly fallbackProcessDecisionId: number | null;
  readonly version: number;
  readonly contentHash: string;
  readonly updatedAt: string;
}

export interface FixtureDiligenceFinding {
  readonly findingId: number;
  readonly area: DueDiligenceFindingsArea;
  readonly finding: string;
  readonly disposition: DueDiligenceFindingsDisposition;
  readonly ownerUserId: number | null;
  readonly dueAt: string | null;
  readonly evidenceDocumentId: number | null;
  readonly evidenceTitle: string | null;
  readonly isAwardBlocking: boolean;
  readonly updatedAt: string;
}

export interface FixtureEvidenceRequest {
  readonly clarificationId: number;
  readonly question: string;
  readonly permittedScope: string;
  readonly dueAt: string;
  readonly status: BidClarificationsStatus;
  readonly respondedAt: string | null;
}

export interface FixtureDiligenceCase {
  readonly tenantId: number;
  readonly caseId: number;
  readonly preferredBidderId: number;
  readonly ownerUserId: number;
  readonly status: DueDiligenceCasesStatus;
  readonly decidedBy: number | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly findings: readonly FixtureDiligenceFinding[];
  readonly evidenceRequests: readonly FixtureEvidenceRequest[];
  readonly updatedAt: string;
}

export interface FixtureNegotiationRound {
  readonly roundId: number;
  readonly roundNo: number;
  readonly meetingAt: string | null;
  readonly participants: string;
  /** The authorized topics the round covered (a subset of the mandate's `allowedTopics`). */
  readonly topics: readonly string[];
  readonly minutes: string | null;
  readonly buyerProposal: string | null;
  readonly supplierProposal: string | null;
  readonly concessions: string | null;
  readonly unresolvedIssues: string | null;
  readonly supplierResponseAt: string | null;
  readonly supplierVisible: boolean;
}

export interface FixtureNegotiation {
  readonly tenantId: number;
  readonly negotiationId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly bidId: number;
  readonly supplierTenantId: number;
  readonly allowedTopics: readonly string[];
  readonly authorizedNegotiatorIds: readonly number[];
  readonly commercialAuthority: Money | null;
  readonly status: NegotiationsStatus;
  readonly approval: FixtureApproval | null;
  readonly outcomeSummary: string | null;
  readonly affectsCompetitionBasis: boolean;
  readonly processDecisionId: number | null;
  readonly version: number;
  readonly contentHash: string;
  readonly rounds: readonly FixtureNegotiationRound[];
  readonly updatedAt: string;
}

export interface FixtureFinalOfferInvitee {
  readonly bidId: number;
  readonly supplierTenantId: number;
  /**
   * The supplier's response in the response workspace (bids domain id) where the final offer is prepared and
   * submitted; SUP-19 links to it. Null when the supplier has no response there.
   */
  readonly responseBidId: number | null;
  readonly notifiedAt: string | null;
  readonly finalOfferReceivedAt: string | null;
  readonly finalOffer: Money | null;
}

export interface FixtureFinalOfferRound {
  readonly tenantId: number;
  readonly roundId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly instructions: string;
  readonly permittedChanges: string;
  readonly deadline: string | null;
  readonly openingRules: string;
  readonly evaluationTreatment: string;
  readonly proceduralAuthorityRef: string;
  readonly status: FinalOfferRoundsStatus;
  readonly approval: FixtureApproval | null;
  readonly version: number;
  readonly contentHash: string;
  readonly invitees: readonly FixtureFinalOfferInvitee[];
  readonly updatedAt: string;
}


// ---------------------------------------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------------------------------------

const KWU = TENANT_IDS.kwu;
const GABORONE = 'Africa/Gaborone';

/** Tender ids follow the reference number (T-2026-000N → N). */
export const SELECTION_TENDER_IDS = { borehole: 1, leakDetection: 9 } as const;

/**
 * Bid ids shared with the awards fixtures: T-2026-0009 → Serowe ICT 907, Limpopo 908, Gaborone Metering 909 and
 * Limpopo's variant 910; T-2026-0001 Lot 3 → Tsodilo 104, Chobe Pipe 105.
 */
export const SELECTION_BID_IDS = {
  serowe: 907,
  limpopo: 908,
  gaboroneMeter: 909,
  limpopoVariant: 910,
  lot3Tsodilo: 104,
  lot3Chobe: 105,
} as const;

/** Users (fixtures/platform.ts). */
const U = {
  formerOfficer: 21,
  mpho: 4,
  tebogo: 5,
  boitumelo: 10,
  thato: 11,
  kabo: 12,
  amantle: 13,
  dineo: 17,
  tsodiloBidManager: 25,
  seroweBidManager: 33,
  limpopoAdmin: 41,
} as const;

const bwp = (amount: string): Money => ({ amount, currency: 'BWP' });

// ---------------------------------------------------------------------------------------------------------
// Tenders and candidates
// ---------------------------------------------------------------------------------------------------------

export const SELECTION_TENDERS: readonly FixtureSelectionTender[] = [
  {
    tenantId: KWU,
    tenderId: SELECTION_TENDER_IDS.leakDetection,
    reference: 'T-2026-0009',
    title: 'Acoustic leak detection services',
    eventType: 'rfp',
    procedure: 'restricted',
    status: 'under_assessment',
    stageNo: 2,
    ownerUserId: U.tebogo,
    officialTimeZone: GABORONE,
    conditions: {
      demonstrationsPermitted: true,
      referencesPermitted: true,
      negotiationPermitted: true,
      bafoPermitted: false,
      alternativesAllowed: true,
      conditionsNote:
        'Stage-two conditions §7.2: negotiation is permitted only with the approved preferred bidder on its conforming offer, within the approved mandate. No best and final offer round is provided for, and variant offers are evaluated as submitted.',
    },
    lots: [{ lotId: 901, lotNo: 1, title: 'Acoustic leak detection services' }],
    criteria: [
      { criterionId: 9501, lotId: null, name: 'Survey approach and productivity', weight: '30' },
      { criterionId: 9505, lotId: null, name: 'Correlator and listening equipment', weight: '10' },
      { criterionId: 9506, lotId: null, name: 'Data platform and reporting', weight: '15' },
      { criterionId: 9503, lotId: null, name: 'Team experience', weight: '15' },
    ],
    teamUserIds: [U.mpho, U.tebogo, U.boitumelo, U.thato, U.kabo, U.amantle, U.dineo],
    updatedAt: '2026-09-30T08:00:00Z',
  },
  {
    tenantId: KWU,
    tenderId: SELECTION_TENDER_IDS.borehole,
    reference: 'T-2026-0001',
    title: 'Borehole pump replacement programme (3 lots)',
    eventType: 'tender',
    procedure: 'open',
    status: 'partially_awarded',
    stageNo: 1,
    ownerUserId: U.tebogo,
    officialTimeZone: GABORONE,
    conditions: {
      demonstrationsPermitted: true,
      referencesPermitted: false,
      negotiationPermitted: false,
      bafoPermitted: false,
      alternativesAllowed: false,
      conditionsNote:
        'Tender conditions §5.8: for Lot 3 a sample telemetry panel is tested with the KWU SCADA as a pass/fail eligibility gate before any award. Negotiation and final-offer rounds are not provided for.',
    },
    lots: [{ lotId: 103, lotNo: 3, title: 'Pump controls and telemetry panels' }],
    criteria: [
      { criterionId: 1501, lotId: null, name: 'Technical compliance and pump efficiency', weight: '40' },
      { criterionId: 1502, lotId: null, name: 'Delivery and installation programme', weight: '15' },
      { criterionId: 1503, lotId: null, name: 'After-sales support', weight: '15' },
    ],
    teamUserIds: [U.mpho, U.tebogo, U.boitumelo, U.thato, U.kabo],
    updatedAt: '2026-09-28T09:30:00Z',
  },
];

export const SELECTION_BIDS: readonly FixtureSelectionBid[] = [
  {
    tenantId: KWU,
    bidId: SELECTION_BID_IDS.serowe,
    tenderId: 9,
    lotId: 901,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    supplierName: 'Serowe ICT Solutions (Pty) Ltd',
    isAlternative: false,
    nonPriceScore: '57.20',
    totalScore: '87.20',
    rank: 1,
    passesGates: true,
    evaluatedValue: bwp('2780000.00'),
  },
  {
    tenantId: KWU,
    bidId: SELECTION_BID_IDS.limpopo,
    tenderId: 9,
    lotId: 901,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    supplierName: 'Limpopo Environmental Services (Pty) Ltd',
    isAlternative: false,
    nonPriceScore: '54.60',
    totalScore: '82.97',
    rank: 2,
    passesGates: true,
    evaluatedValue: bwp('2940000.00'),
  },
  {
    tenantId: KWU,
    bidId: SELECTION_BID_IDS.gaboroneMeter,
    tenderId: 9,
    lotId: 901,
    supplierTenantId: TENANT_IDS['gaborone-meter'],
    supplierName: 'Gaborone Metering Company (Pty) Ltd',
    isAlternative: false,
    nonPriceScore: '38.50',
    totalScore: null,
    rank: null,
    passesGates: false,
    evaluatedValue: bwp('2390000.00'),
  },
  {
    tenantId: KWU,
    bidId: SELECTION_BID_IDS.limpopoVariant,
    tenderId: 9,
    lotId: 901,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    supplierName: 'Limpopo Environmental Services (Pty) Ltd',
    isAlternative: true,
    nonPriceScore: '51.00',
    totalScore: '81.40',
    rank: null,
    passesGates: true,
    evaluatedValue: bwp('2610000.00'),
  },
  {
    tenantId: KWU,
    bidId: SELECTION_BID_IDS.lot3Tsodilo,
    tenderId: 1,
    lotId: 103,
    supplierTenantId: TENANT_IDS.tsodilo,
    supplierName: 'Tsodilo Engineering (Pty) Ltd',
    isAlternative: false,
    nonPriceScore: null,
    totalScore: null,
    rank: null,
    passesGates: true,
    evaluatedValue: null,
  },
  {
    tenantId: KWU,
    bidId: SELECTION_BID_IDS.lot3Chobe,
    tenderId: 1,
    lotId: 103,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    supplierName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
    isAlternative: false,
    nonPriceScore: null,
    totalScore: null,
    rank: null,
    passesGates: true,
    evaluatedValue: null,
  },
];

// ---------------------------------------------------------------------------------------------------------
// Assessment sessions, invitations, findings, reference checks (BUY-22, SUP-18, AC-21)
// ---------------------------------------------------------------------------------------------------------

export const ASSESSMENT_SESSIONS: readonly FixtureAssessmentSession[] = [
  {
    tenantId: KWU,
    sessionId: 1,
    tenderId: 9,
    lotId: null,
    sessionType: 'demonstration',
    purpose:
      'Field demonstration of the offered correlator and listening equipment on a live distribution main with seeded leaks, scored under the announced criterion.',
    agenda:
      '07:30 site induction and safety briefing (Broadhurst DMA 4) · 08:00 equipment set-up · 08:30 correlator survey of the 1.2 km test section · 10:30 ground-microphone confirmation · 11:30 data export walkthrough · 12:00 close.',
    assessmentBasis: 'scored_criterion',
    criterionId: 9505,
    instructions:
      'Bring the correlator, loggers and ground microphone offered in your response. The same 1.2 km test section with four seeded leaks is used for every candidate; locations are not disclosed. Each candidate has three hours on site. Findings feed criterion "Correlator and listening equipment" (10 points) only.',
    preparationDays: 6,
    equalTreatmentConfirmedBy: U.tebogo,
    equalTreatmentConfirmedAt: '2026-08-25T07:30:00Z',
    status: 'completed',
    createdBy: U.tebogo,
    createdAt: '2026-08-24T14:00:00Z',
    updatedAt: '2026-09-03T09:00:00Z',
    completionSummary:
      'Both shortlisted candidates demonstrated on the same test section under identical conditions. Findings feed the announced criterion “Correlator and listening equipment” only; no other score changed.',
    cancellationReason: null,
  },
  {
    tenantId: KWU,
    sessionId: 2,
    tenderId: 9,
    lotId: null,
    sessionType: 'reference_check',
    purpose:
      'Verify the contract experience claimed in the stage-two responses (non-revenue water results and survey scale). The outcome verifies claims only and does not change scores.',
    agenda:
      'Referee consent collected through the candidate · structured telephone interview (six standard questions) · written confirmation of contract value and dates.',
    assessmentBasis: 'claim_verification',
    criterionId: null,
    instructions:
      'Provide two referees for comparable municipal leak-detection contracts completed since 2022 and confirm each referee’s consent to be contacted. The same six questions are asked of every referee.',
    preparationDays: 5,
    equalTreatmentConfirmedBy: U.tebogo,
    equalTreatmentConfirmedAt: '2026-08-26T08:00:00Z',
    status: 'completed',
    createdBy: U.tebogo,
    createdAt: '2026-08-25T14:00:00Z',
    updatedAt: '2026-09-07T12:00:00Z',
    completionSummary:
      'Claims verified for Serowe ICT (two referees). Limpopo’s Mahalapye claim verified; its Orapa claim could not be verified because the referee did not consent.',
    cancellationReason: null,
  },
  {
    tenantId: KWU,
    sessionId: 3,
    tenderId: 9,
    lotId: null,
    sessionType: 'interview',
    purpose:
      'Verify the availability and experience of the proposed lead acoustic engineer (due-diligence finding on key personnel). Supplier-specific claim verification; no score changes.',
    agenda:
      '09:00 introductions · 09:15 project lead: mobilisation plan and availability · 10:00 lead acoustic engineer: comparable surveys · 10:45 data analyst: DMA reporting · 11:15 close.',
    assessmentBasis: 'claim_verification',
    criterionId: null,
    instructions:
      'Attend with the named project lead, lead acoustic engineer and data analyst. Bring CVs and evidence of current commitments. The interview verifies the key-personnel claims of the stage-two response only.',
    preparationDays: 5,
    equalTreatmentConfirmedBy: U.tebogo,
    equalTreatmentConfirmedAt: '2026-09-29T11:00:00Z',
    status: 'scheduled',
    createdBy: U.tebogo,
    createdAt: '2026-09-29T09:00:00Z',
    updatedAt: '2026-09-29T12:00:00Z',
    completionSummary: null,
    cancellationReason: null,
  },
  {
    tenantId: KWU,
    sessionId: 4,
    tenderId: 1,
    lotId: 103,
    sessionType: 'sample',
    purpose:
      'Interoperability test of one sample telemetry panel with the KWU SCADA (Modbus TCP or DNP3 as offered): pass/fail eligibility gate under tender conditions §5.8.',
    agenda: 'Delivery of one sample panel to the KWU Mahalapye test bench · 4-hour polling and alarm test · witness sign-off.',
    assessmentBasis: 'eligibility_gate',
    criterionId: null,
    instructions:
      'Deliver one production sample of the offered panel with its configuration file by 08:00 on the scheduled day. Missing more than 1% of polls or any alarm during the test fails the gate.',
    preparationDays: 14,
    equalTreatmentConfirmedBy: U.tebogo,
    equalTreatmentConfirmedAt: '2026-09-23T08:30:00Z',
    status: 'scheduled',
    createdBy: U.tebogo,
    createdAt: '2026-09-22T13:00:00Z',
    updatedAt: '2026-09-24T09:15:00Z',
    completionSummary: null,
    cancellationReason: null,
  },
  {
    tenantId: KWU,
    sessionId: 5,
    tenderId: 1,
    lotId: 103,
    sessionType: 'site_inspection',
    purpose: 'Inspection of the candidate’s panel workshop and spares holding for the eastern wellfields (eligibility gate).',
    agenda: 'Workshop walk-through · spares inventory sample check · response-time arrangements.',
    assessmentBasis: 'eligibility_gate',
    criterionId: null,
    instructions:
      'Make the workshop, spares store and service records available for a two-hour inspection. The same checklist is applied to every candidate.',
    preparationDays: 10,
    equalTreatmentConfirmedBy: null,
    equalTreatmentConfirmedAt: null,
    status: 'planned',
    createdBy: U.tebogo,
    createdAt: '2026-09-28T09:30:00Z',
    updatedAt: '2026-09-28T09:30:00Z',
    completionSummary: null,
    cancellationReason: null,
  },
  {
    tenantId: KWU,
    sessionId: 6,
    tenderId: 9,
    lotId: null,
    sessionType: 'presentation',
    purpose: 'Stage-one methodology presentation by each applicant.',
    agenda: '30-minute presentation · 15 minutes of standard questions.',
    assessmentBasis: 'scored_criterion',
    criterionId: 9501,
    instructions: 'Present your survey approach in 30 minutes; the same five questions follow for every applicant.',
    preparationDays: 7,
    equalTreatmentConfirmedBy: U.tebogo,
    equalTreatmentConfirmedAt: '2026-07-14T09:00:00Z',
    status: 'cancelled',
    createdBy: U.tebogo,
    createdAt: '2026-07-13T10:00:00Z',
    updatedAt: '2026-07-20T08:00:00Z',
    completionSummary: null,
    cancellationReason:
      'Cancelled for every applicant before any presentation: the issued conditions (§6.4) provide for presentations in stage two only. No applicant was assessed.',
  },
];

export const ASSESSMENT_INVITES: readonly FixtureAssessmentInvite[] = [
  {
    tenantId: KWU,
    inviteId: 1,
    sessionId: 1,
    bidId: 907,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    scheduledAt: '2026-09-01T05:30:00Z',
    status: 'attended',
    invitedAt: '2026-08-25T08:00:00Z',
    supplierConfirmedAt: '2026-08-25T12:10:00Z',
    supplierConfirmedBy: U.seroweBidManager,
  },
  {
    tenantId: KWU,
    inviteId: 2,
    sessionId: 1,
    bidId: 908,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    scheduledAt: '2026-09-02T05:30:00Z',
    status: 'attended',
    invitedAt: '2026-08-25T08:00:00Z',
    supplierConfirmedAt: '2026-08-25T13:40:00Z',
    supplierConfirmedBy: U.limpopoAdmin,
  },
  {
    tenantId: KWU,
    inviteId: 3,
    sessionId: 2,
    bidId: 907,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    scheduledAt: '2026-09-03T06:00:00Z',
    status: 'attended',
    invitedAt: '2026-08-26T09:00:00Z',
    supplierConfirmedAt: '2026-08-27T07:45:00Z',
    supplierConfirmedBy: U.seroweBidManager,
  },
  {
    tenantId: KWU,
    inviteId: 4,
    sessionId: 2,
    bidId: 908,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    scheduledAt: '2026-09-03T06:00:00Z',
    status: 'attended',
    invitedAt: '2026-08-26T09:00:00Z',
    supplierConfirmedAt: '2026-08-27T10:20:00Z',
    supplierConfirmedBy: U.limpopoAdmin,
  },
  {
    tenantId: KWU,
    inviteId: 5,
    sessionId: 3,
    bidId: 908,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    scheduledAt: '2026-10-07T07:00:00Z',
    status: 'invited',
    invitedAt: '2026-09-29T12:00:00Z',
    supplierConfirmedAt: null,
    supplierConfirmedBy: null,
  },
  {
    tenantId: KWU,
    inviteId: 6,
    sessionId: 4,
    bidId: 104,
    supplierTenantId: TENANT_IDS.tsodilo,
    scheduledAt: '2026-10-13T06:00:00Z',
    status: 'confirmed',
    invitedAt: '2026-09-23T10:00:00Z',
    supplierConfirmedAt: '2026-09-24T09:15:00Z',
    supplierConfirmedBy: U.tsodiloBidManager,
  },
  {
    tenantId: KWU,
    inviteId: 7,
    sessionId: 4,
    bidId: 105,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    scheduledAt: '2026-10-14T06:00:00Z',
    status: 'invited',
    invitedAt: '2026-09-23T10:00:00Z',
    supplierConfirmedAt: null,
    supplierConfirmedBy: null,
  },
  {
    tenantId: KWU,
    inviteId: 8,
    sessionId: 6,
    bidId: 907,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    scheduledAt: '2026-07-22T07:00:00Z',
    status: 'confirmed',
    invitedAt: '2026-07-14T10:00:00Z',
    supplierConfirmedAt: '2026-07-15T08:00:00Z',
    supplierConfirmedBy: U.seroweBidManager,
  },
  {
    tenantId: KWU,
    inviteId: 9,
    sessionId: 6,
    bidId: 908,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    scheduledAt: '2026-07-22T09:00:00Z',
    status: 'confirmed',
    invitedAt: '2026-07-14T10:00:00Z',
    supplierConfirmedAt: '2026-07-15T11:30:00Z',
    supplierConfirmedBy: U.limpopoAdmin,
  },
  {
    tenantId: KWU,
    inviteId: 10,
    sessionId: 6,
    bidId: 909,
    supplierTenantId: TENANT_IDS['gaborone-meter'],
    scheduledAt: '2026-07-22T11:00:00Z',
    status: 'invited',
    invitedAt: '2026-07-14T10:00:00Z',
    supplierConfirmedAt: null,
    supplierConfirmedBy: null,
  },
];

export const ASSESSMENT_FINDINGS: readonly FixtureAssessmentFinding[] = [
  {
    tenantId: KWU,
    findingId: 1,
    sessionId: 1,
    bidId: 907,
    assessorUserId: U.thato,
    finding:
      'Located all four seeded leaks within 1.2 m; correlator set-up in 18 minutes; clear explanation of noise filtering on the PVC section.',
    effect: 'score_input',
    evidenceDocumentId: 7201,
    evidenceTitle: 'Demonstration record: Serowe ICT (1 Sep 2026)',
    recordedAt: '2026-09-01T11:00:00Z',
  },
  {
    tenantId: KWU,
    findingId: 2,
    sessionId: 1,
    bidId: 907,
    assessorUserId: U.kabo,
    finding: 'Four of four leaks located; ground-microphone confirmation consistent; survey data exported in open CSV format.',
    effect: 'score_input',
    evidenceDocumentId: null,
    evidenceTitle: null,
    recordedAt: '2026-09-01T11:20:00Z',
  },
  {
    tenantId: KWU,
    findingId: 3,
    sessionId: 1,
    bidId: 908,
    assessorUserId: U.thato,
    finding: 'Located three of four seeded leaks (missed one at a 110 mm PVC joint); strong field-crew discipline and safety practice.',
    effect: 'score_input',
    evidenceDocumentId: 7202,
    evidenceTitle: 'Demonstration record: Limpopo Environmental Services (2 Sep 2026)',
    recordedAt: '2026-09-02T11:05:00Z',
  },
  {
    tenantId: KWU,
    findingId: 4,
    sessionId: 1,
    bidId: 908,
    assessorUserId: U.kabo,
    finding: 'Three of four leaks located; correlation accuracy within 1.5 m on steel sections; reporting template meets the DMA format.',
    effect: 'score_input',
    evidenceDocumentId: null,
    evidenceTitle: null,
    recordedAt: '2026-09-02T11:30:00Z',
  },
  {
    tenantId: KWU,
    findingId: 5,
    sessionId: 2,
    bidId: 907,
    assessorUserId: U.amantle,
    finding:
      'Both referee contracts confirmed (Francistown City Council 2024–2025; WUC Lobatse 2023). The claimed 38% non-revenue water reduction was confirmed as 31% by the referee.',
    effect: 'claim_verified',
    evidenceDocumentId: 7203,
    evidenceTitle: 'Reference interview notes: Serowe ICT',
    recordedAt: '2026-09-04T14:00:00Z',
  },
  {
    tenantId: KWU,
    findingId: 6,
    sessionId: 2,
    bidId: 908,
    assessorUserId: U.amantle,
    finding: 'Mahalapye Sub-District Council survey contract (2025, 420 km of mains) confirmed by the referee, including on-time delivery.',
    effect: 'claim_verified',
    evidenceDocumentId: 7204,
    evidenceTitle: 'Reference interview notes: Limpopo Environmental Services',
    recordedAt: '2026-09-05T13:00:00Z',
  },
  {
    tenantId: KWU,
    findingId: 7,
    sessionId: 2,
    bidId: 908,
    assessorUserId: U.amantle,
    finding: 'Claimed Orapa mine network survey (2025) could not be verified: the referee has not consented to be contacted.',
    effect: 'claim_not_verified',
    evidenceDocumentId: null,
    evidenceTitle: null,
    recordedAt: '2026-09-07T10:00:00Z',
  },
];

export const REFERENCE_CHECKS: readonly FixtureReferenceCheck[] = [
  {
    tenantId: KWU,
    referenceCheckId: 1,
    bidId: 907,
    refereeName: 'Thabo Kgosidintsi',
    refereeOrganization: 'Francistown City Council, Water Department',
    consentConfirmed: true,
    contactedAt: '2026-09-04T07:00:00Z',
    feedback:
      'Delivered the 2024–2025 district metered area survey on time. Non-revenue water fell from 34% to 23% in the surveyed zones. Reporting was clear; one crew change needed two weeks to settle.',
    confidential: true,
    assessorUserId: U.amantle,
    outcome: 'Claim verified: survey delivered on time; reduction confirmed at 31% (claimed 38%).',
    updatedAt: '2026-09-04T14:00:00Z',
  },
  {
    tenantId: KWU,
    referenceCheckId: 2,
    bidId: 907,
    refereeName: 'Naledi Moagi',
    refereeOrganization: 'Water Utilities Corporation, Lobatse',
    consentConfirmed: true,
    contactedAt: '2026-09-04T09:30:00Z',
    feedback: 'Correlator survey of 300 km in 2023 completed within the contract period; data handed over in open formats.',
    confidential: false,
    assessorUserId: U.amantle,
    outcome: 'Claim verified.',
    updatedAt: '2026-09-04T14:00:00Z',
  },
  {
    tenantId: KWU,
    referenceCheckId: 3,
    bidId: 908,
    refereeName: 'Keletso Ramaphane',
    refereeOrganization: 'Mahalapye Sub-District Council',
    consentConfirmed: true,
    contactedAt: '2026-09-05T08:00:00Z',
    feedback:
      '420 km surveyed in 2025, on time and within budget. Strong field crews; the monthly reports needed reformatting to match the council template at the start.',
    confidential: true,
    assessorUserId: U.amantle,
    outcome: 'Claim verified with a minor reservation on initial reporting format.',
    updatedAt: '2026-09-05T13:00:00Z',
  },
  {
    tenantId: KWU,
    referenceCheckId: 4,
    bidId: 908,
    refereeName: 'Ontiretse Molefhe',
    refereeOrganization: 'Debswana Orapa Mine Services',
    consentConfirmed: false,
    contactedAt: null,
    feedback: null,
    confidential: true,
    assessorUserId: null,
    outcome: null,
    updatedAt: '2026-09-07T10:00:00Z',
  },
];

// ---------------------------------------------------------------------------------------------------------
// Shortlist (BUY-23, AC-22). Id 9 is the approval subject of approval request 41 (approvals fixtures).
// ---------------------------------------------------------------------------------------------------------

export const SHORTLISTS: readonly FixtureShortlist[] = [
  {
    tenantId: KWU,
    shortlistId: 9,
    tenderId: 9,
    lotId: null,
    stageNo: 1,
    selectionRule:
      'Advance every compliant applicant whose stage-one non-price score meets the threshold of the approved evaluation plan, up to two, in rank order (stage-one conditions §4.2).',
    threshold: '49.00',
    rationale:
      'Stage-one scores were moderated and signed off. Serowe ICT (57.20 non-price) and Limpopo Environmental Services (54.60) meet the 49.00 threshold and are the two highest-ranked; Gaborone Metering (38.50) does not meet it.',
    status: 'approved',
    approval: { approvalRequestId: 41, status: 'approved', requestedAt: '2026-08-20T08:00:00Z', decidedAt: '2026-08-24T13:00:00Z' },
    approvedAt: '2026-08-24T13:00:00Z',
    changeReason: null,
    version: 1,
    contentHash: 'b9a6ccdcb05c16aaeeb87f4c4054a168648651e5aa6e4bf3dc8c950e456eb36f',
    // Stage two runs inside the same multi-stage event (T-2026-0009, stage 2), so no separate event is created.
    nextStageTender: { tenderId: 9, reference: 'T-2026-0009', stageNo: 2 },
    entries: [
      {
        entryId: 1,
        bidId: 907,
        included: true,
        rank: 1,
        reason: 'Non-price score 57.20 meets the 49.00 threshold; ranked first.',
        conditions: null,
        notifiedAt: '2026-08-25T07:00:00Z',
        notice: {
          noticeId: 1301,
          noticeType: 'shortlist_outcome',
          status: 'issued',
          title: 'Stage-one outcome and stage-two invitation: T-2026-0009',
          issuedAt: '2026-08-25T07:00:00Z',
        },
      },
      {
        entryId: 2,
        bidId: 908,
        included: true,
        rank: 2,
        reason: 'Non-price score 54.60 meets the 49.00 threshold; ranked second.',
        conditions: 'Confirm the availability of the named lead acoustic engineer before the stage-two submission.',
        notifiedAt: '2026-08-25T07:00:00Z',
        notice: {
          noticeId: 1302,
          noticeType: 'shortlist_outcome',
          status: 'issued',
          title: 'Stage-one outcome and stage-two invitation: T-2026-0009',
          issuedAt: '2026-08-25T07:00:00Z',
        },
      },
      {
        entryId: 3,
        bidId: 909,
        included: false,
        rank: null,
        reason: 'Non-price score 38.50 is below the 49.00 threshold.',
        conditions: null,
        notifiedAt: '2026-08-25T07:00:00Z',
        notice: {
          noticeId: 1303,
          noticeType: 'shortlist_outcome',
          status: 'issued',
          title: 'Stage-one outcome: T-2026-0009',
          issuedAt: '2026-08-25T07:00:00Z',
        },
      },
    ],
    updatedAt: '2026-08-25T07:00:00Z',
  },
];

// ---------------------------------------------------------------------------------------------------------
// Process decisions (AC-23, AC-24)
// ---------------------------------------------------------------------------------------------------------

export const PROCESS_DECISIONS: readonly FixtureProcessDecision[] = [
  {
    tenantId: KWU,
    processDecisionId: 1,
    tenderId: 9,
    lotId: null,
    decisionType: 'fallback_to_next_bidder',
    reason:
      'Serowe ICT failed financial due diligence (negative working capital and the required parent guarantee declined). Following the declared contingency, approach Limpopo Environmental Services, the second-ranked shortlisted candidate. The validity of Limpopo’s stage-two offer (valid to 15 Dec 2026) and its shortlist condition were reassessed before approaching it.',
    status: 'approved',
    proposedBy: U.tebogo,
    decidedBy: U.mpho,
    approval: { approvalRequestId: 1206, status: 'approved', requestedAt: '2026-09-17T15:00:00Z', decidedAt: '2026-09-18T07:30:00Z' },
    version: 1,
    contentHash: 'ccabbe6eee1cf341e74b0ad032f31fdd854dfcea4f2d71cbc84076a2bd93c2e8',
    createdAt: '2026-09-17T15:00:00Z',
    updatedAt: '2026-09-18T07:30:00Z',
  },
  {
    tenantId: KWU,
    processDecisionId: 2,
    tenderId: 9,
    lotId: null,
    decisionType: 'reopen_round',
    reason:
      'Seek authority for a final-offer round on Limpopo’s variant offer (continuous acoustic logging). The issued conditions permit neither a best and final offer nor negotiation of the variant, so a procedural decision is required before anything is requested from the bidder.',
    status: 'proposed',
    proposedBy: U.tebogo,
    decidedBy: null,
    approval: { approvalRequestId: 1207, status: 'pending', requestedAt: '2026-09-30T06:00:00Z', decidedAt: null },
    version: 1,
    contentHash: '07dc66572701793ae0791300ff64369e0ddaf3d605229e6bb8b70ee16ef582c3',
    createdAt: '2026-09-30T06:00:00Z',
    updatedAt: '2026-09-30T06:00:00Z',
  },
  {
    tenantId: KWU,
    processDecisionId: 3,
    tenderId: 9,
    lotId: null,
    decisionType: 'other',
    reason:
      'Proposal to obtain revised variant pricing from Limpopo through a bid clarification. Rejected: a clarification cannot be used as a hidden negotiation or final-offer round (BR-22, BR-30).',
    status: 'rejected',
    proposedBy: U.tebogo,
    decidedBy: U.mpho,
    approval: { approvalRequestId: 1208, status: 'rejected', requestedAt: '2026-09-29T08:00:00Z', decidedAt: '2026-09-29T14:00:00Z' },
    version: 1,
    contentHash: 'febbdd83132008678fe3e4e6564d7e4131fab6af98a35cbe780f9be6cba15292',
    createdAt: '2026-09-29T08:00:00Z',
    updatedAt: '2026-09-29T14:00:00Z',
  },
  {
    tenantId: KWU,
    processDecisionId: 4,
    tenderId: 1,
    lotId: 103,
    decisionType: 'reopen_round',
    reason:
      'Both Lot 3 prices read at opening exceed the approved Lot 3 budget. Instead of cancelling the lot, request one best and final offer round, limited to Lot 3 prices and the delivery programme, on identical instructions and deadline for both bidders. The telemetry panel gate and the technical results are unchanged.',
    status: 'approved',
    proposedBy: U.tebogo,
    decidedBy: U.mpho,
    approval: { approvalRequestId: 1209, status: 'approved', requestedAt: '2026-09-24T08:00:00Z', decidedAt: '2026-09-25T09:00:00Z' },
    version: 1,
    contentHash: '5db710c5683a3b002b1207ae9f8c4aa1089c3649adef889b64ade5b2c04f4046',
    createdAt: '2026-09-24T08:00:00Z',
    updatedAt: '2026-09-25T09:00:00Z',
  },
];

// ---------------------------------------------------------------------------------------------------------
// Preferred bidders (BUY-24, BR-31)
// ---------------------------------------------------------------------------------------------------------

export const PREFERRED_BIDDERS: readonly FixturePreferredBidder[] = [
  {
    tenantId: KWU,
    preferredBidderId: 1,
    tenderId: 9,
    lotId: null,
    bidId: 907,
    scope:
      'Acoustic leak detection surveys across 1,200 km of distribution mains in the Gaborone, Mogoditshane and Tlokweng zones for 36 months: correlator surveys, ground-microphone confirmation and monthly DMA reporting.',
    proposedValue: bwp('2780000.00'),
    rationale:
      'Highest stage-two total (87.20) with the lowest evaluated cost; the demonstration located all seeded leaks and both references were verified.',
    remainingChecks:
      'Financial position (audited statements 2024 and 2025 and the parent guarantee under clause 4.3), professional indemnity insurance, availability of key personnel.',
    negotiationTopics: ['Mobilisation schedule', 'Reporting format and data ownership', 'Service credits'],
    decisionOwnerUserId: U.mpho,
    contingencyPlan:
      'If Serowe ICT cannot proceed (withdrawal, failed due diligence or rejection of terms), record a fallback decision approved by the Procurement Manager and approach the second-ranked shortlisted candidate, Limpopo Environmental Services, on its own stage-two offer. No new terms are offered beyond the issued conditions.',
    fallbackBidId: 908,
    status: 'failed_diligence',
    statusReason: 'Failed due diligence on financial position. The fallback decision to approach Limpopo Environmental Services is recorded and approved.',
    approval: { approvalRequestId: 1202, status: 'approved', requestedAt: '2026-09-07T07:00:00Z', decidedAt: '2026-09-08T08:00:00Z' },
    fallbackProcessDecisionId: 1,
    version: 1,
    contentHash: '4fb138019c7f7650e68a453f720df662ff8517ea61d80aad288c7374438b1c36',
    updatedAt: '2026-09-18T07:30:00Z',
  },
  {
    tenantId: KWU,
    preferredBidderId: 2,
    tenderId: 9,
    lotId: null,
    bidId: 908,
    scope:
      'Acoustic leak detection surveys across 1,200 km of distribution mains in the Gaborone, Mogoditshane and Tlokweng zones for 36 months, on Limpopo’s conforming stage-two offer.',
    proposedValue: bwp('2940000.00'),
    rationale:
      'Selected under the declared contingency after Serowe ICT failed due diligence (approved fallback decision of 18 Sep 2026). Second-ranked shortlisted candidate (82.97); the Mahalapye reference was verified and the evaluated cost is within the approved budget of BWP 3,100,000.00.',
    remainingChecks:
      'Professional indemnity insurance verified with the insurer, availability of the lead acoustic engineer (interview on 7 Oct), consent of the second referee.',
    negotiationTopics: ['Mobilisation schedule', 'Key personnel substitution', 'Service credits', 'Data ownership'],
    decisionOwnerUserId: U.mpho,
    contingencyPlan:
      'No further shortlisted candidate remains. If Limpopo cannot proceed, the Procurement Manager records a process decision between a new competition and ending the event without an outcome; no other supplier is approached.',
    fallbackBidId: null,
    status: 'approved',
    statusReason: null,
    approval: { approvalRequestId: 1203, status: 'approved', requestedAt: '2026-09-18T09:00:00Z', decidedAt: '2026-09-21T10:00:00Z' },
    fallbackProcessDecisionId: null,
    version: 1,
    contentHash: 'adbbc0182f7e1755d8930b737ba3b1ab7cd75c099d3eba5f0ddbe374c1ce3905',
    updatedAt: '2026-09-21T10:00:00Z',
  },
];

// ---------------------------------------------------------------------------------------------------------
// Due diligence (BUY-25, AC-24)
// ---------------------------------------------------------------------------------------------------------

export const DUE_DILIGENCE_CASES: readonly FixtureDiligenceCase[] = [
  {
    tenantId: KWU,
    caseId: 1,
    preferredBidderId: 1,
    ownerUserId: U.tebogo,
    status: 'failed',
    decidedBy: U.mpho,
    decidedAt: '2026-09-17T12:00:00Z',
    decisionNote:
      'Failed on financial position: the audited 2025 statements show negative working capital and the parent guarantee required by clause 4.3 was declined. Award is blocked for this bidder; the declared fallback applies.',
    findings: [
      {
        findingId: 1,
        area: 'financial',
        finding:
          'Audited 2025 statements show negative working capital of BWP 1,900,000.00 and a going-concern emphasis of matter; the parent guarantee required by clause 4.3 was declined on 15 Sep 2026.',
        disposition: 'failed',
        ownerUserId: U.tebogo,
        dueAt: null,
        evidenceDocumentId: 7101,
        evidenceTitle: 'Serowe ICT audited financial statements 2025',
        isAwardBlocking: true,
        updatedAt: '2026-09-16T15:00:00Z',
      },
      {
        findingId: 2,
        area: 'insurance',
        finding: 'Professional indemnity cover of BWP 5,000,000.00 valid to 31 Mar 2027.',
        disposition: 'satisfied',
        ownerUserId: U.tebogo,
        dueAt: null,
        evidenceDocumentId: 7102,
        evidenceTitle: 'Professional indemnity certificate 2026–2027',
        isAwardBlocking: false,
        updatedAt: '2026-09-10T10:00:00Z',
      },
      {
        findingId: 3,
        area: 'key_personnel',
        finding: 'Project lead confirmed; data analyst to be named before mobilisation.',
        disposition: 'condition',
        ownerUserId: U.tebogo,
        dueAt: '2026-10-02T13:00:00Z',
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: false,
        updatedAt: '2026-09-11T09:00:00Z',
      },
      {
        findingId: 4,
        area: 'references',
        finding: 'Both references verified in the reference-check session.',
        disposition: 'satisfied',
        ownerUserId: U.tebogo,
        dueAt: null,
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: false,
        updatedAt: '2026-09-09T09:00:00Z',
      },
      {
        findingId: 5,
        area: 'restrictions',
        finding: 'No debarment, suspension or restriction recorded for the supplier or its directors.',
        disposition: 'satisfied',
        ownerUserId: U.tebogo,
        dueAt: null,
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: false,
        updatedAt: '2026-09-09T09:30:00Z',
      },
    ],
    evidenceRequests: [
      {
        clarificationId: 2101,
        question: 'Provide the parent company guarantee required by clause 4.3 of the stage-two conditions.',
        permittedScope: 'The guarantee document only; the offer and its prices cannot change.',
        dueAt: '2026-09-15T13:00:00Z',
        status: 'responded',
        respondedAt: '2026-09-15T09:00:00Z',
      },
    ],
    updatedAt: '2026-09-17T12:00:00Z',
  },
  {
    tenantId: KWU,
    caseId: 2,
    preferredBidderId: 2,
    ownerUserId: U.tebogo,
    status: 'open',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    findings: [
      {
        findingId: 11,
        area: 'financial',
        finding: 'Audited 2024 and 2025 statements reviewed: current ratio 1.6, no going-concern matters.',
        disposition: 'satisfied',
        ownerUserId: U.tebogo,
        dueAt: null,
        evidenceDocumentId: 7111,
        evidenceTitle: 'Limpopo Environmental Services audited financial statements 2025',
        isAwardBlocking: false,
        updatedAt: '2026-09-22T10:00:00Z',
      },
      {
        findingId: 12,
        area: 'insurance',
        finding:
          'Professional indemnity insurance certificate (BWP 5,000,000.00) submitted but not yet verified with the insurer; the insurer has not confirmed the policy is in force.',
        disposition: 'unresolved',
        ownerUserId: U.tebogo,
        dueAt: '2026-10-05T13:00:00Z',
        evidenceDocumentId: 7112,
        evidenceTitle: 'Limpopo professional indemnity certificate (unverified)',
        isAwardBlocking: true,
        updatedAt: '2026-09-29T11:00:00Z',
      },
      {
        findingId: 13,
        area: 'key_personnel',
        finding:
          'The proposed lead acoustic engineer is also committed to another client until November; availability to be confirmed at the key-personnel interview on 7 Oct.',
        disposition: 'condition',
        ownerUserId: U.tebogo,
        dueAt: '2026-10-09T13:00:00Z',
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: false,
        updatedAt: '2026-09-29T11:30:00Z',
      },
      {
        findingId: 14,
        area: 'references',
        finding: 'Mahalapye reference verified; the Orapa referee has not consented, so that claim is disregarded.',
        disposition: 'condition',
        ownerUserId: U.tebogo,
        dueAt: '2026-10-09T13:00:00Z',
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: false,
        updatedAt: '2026-09-23T12:00:00Z',
      },
      {
        findingId: 15,
        area: 'contract_exceptions',
        finding: 'Limpopo’s exception to the uncapped service-credit clause (schedule 6) is within the negotiation mandate; legal review of a cap is in progress.',
        disposition: 'condition',
        ownerUserId: U.tebogo,
        dueAt: '2026-10-12T13:00:00Z',
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: false,
        updatedAt: '2026-09-30T07:00:00Z',
      },
      {
        findingId: 16,
        area: 'subcontractors',
        finding: 'No subcontractors proposed for the survey work; excavation for leak confirmation is by KWU crews.',
        disposition: 'satisfied',
        ownerUserId: U.tebogo,
        dueAt: null,
        evidenceDocumentId: null,
        evidenceTitle: null,
        isAwardBlocking: false,
        updatedAt: '2026-09-22T12:30:00Z',
      },
    ],
    evidenceRequests: [
      {
        clarificationId: 2102,
        question: 'Provide the insurer’s written confirmation that the professional indemnity policy is in force.',
        permittedScope: 'Insurance confirmation only; no change to the offer.',
        dueAt: '2026-10-05T13:00:00Z',
        status: 'issued',
        respondedAt: null,
      },
      {
        clarificationId: 2103,
        question: 'Confirm the commitments of the proposed lead acoustic engineer for October 2026 to March 2027.',
        permittedScope: 'Personnel availability only; the named personnel cannot be substituted through this request.',
        dueAt: '2026-10-05T13:00:00Z',
        status: 'issued',
        respondedAt: null,
      },
    ],
    updatedAt: '2026-09-30T07:00:00Z',
  },
];

// ---------------------------------------------------------------------------------------------------------
// Negotiations (BUY-27, SUP-19, BR-30)
// ---------------------------------------------------------------------------------------------------------

export const NEGOTIATIONS: readonly FixtureNegotiation[] = [
  {
    tenantId: KWU,
    negotiationId: 1,
    tenderId: 9,
    lotId: null,
    bidId: 907,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    allowedTopics: ['Mobilisation schedule', 'Reporting format and data ownership', 'Service credits'],
    authorizedNegotiatorIds: [U.tebogo],
    commercialAuthority: bwp('2780000.00'),
    status: 'aborted',
    approval: { approvalRequestId: 1204, status: 'approved', requestedAt: '2026-09-08T13:00:00Z', decidedAt: '2026-09-09T07:00:00Z' },
    outcomeSummary: 'Closed before any round: Serowe ICT failed due diligence and the approved fallback decision moved to Limpopo Environmental Services.',
    affectsCompetitionBasis: false,
    processDecisionId: null,
    version: 1,
    contentHash: '98824f5ff34e4ff4d62735b2746008d01add1968ce71f3207764ee8d32e6d219',
    rounds: [],
    updatedAt: '2026-09-18T07:30:00Z',
  },
  {
    tenantId: KWU,
    negotiationId: 2,
    tenderId: 9,
    lotId: null,
    bidId: 908,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    allowedTopics: ['Mobilisation schedule', 'Key personnel substitution', 'Service credits', 'Data ownership'],
    authorizedNegotiatorIds: [U.tebogo],
    commercialAuthority: bwp('2940000.00'),
    status: 'active',
    approval: { approvalRequestId: 1205, status: 'approved', requestedAt: '2026-09-21T11:00:00Z', decidedAt: '2026-09-22T09:00:00Z' },
    outcomeSummary: null,
    affectsCompetitionBasis: false,
    processDecisionId: null,
    version: 1,
    contentHash: '9fe210a755d9e7891dd68c21fa511b0929ed1842e9345cee6714ecd2ce095503',
    rounds: [
      {
        roundId: 1,
        roundNo: 1,
        meetingAt: '2026-09-23T06:00:00Z',
        participants:
          'KWU: Tebogo Molefe (Procurement Officer, negotiator), Refilwe Motsumi (Commercial Reviewer, adviser). Limpopo Environmental Services: Mothusi Limpopo (Managing Director), project lead.',
        topics: ['Mobilisation schedule', 'Data ownership', 'Service credits'],
        minutes:
          'Discussed the mobilisation schedule, data ownership and service credits within the approved mandate. No competitor information was referred to. Price and scope were not reopened.',
        buyerProposal: 'Mobilisation within 21 days of contract start; service credits capped at 10% of the monthly fee; KWU owns all survey data.',
        supplierProposal: 'Mobilisation within 30 days, phased by zone; service credits capped at 5%; data ownership accepted.',
        concessions:
          'KWU accepts phased mobilisation by zone (Gaborone first). Limpopo accepts KWU ownership of all survey data and logger exports.',
        unresolvedIssues: 'Service-credit cap; notice period for key-personnel substitution.',
        supplierResponseAt: '2026-09-23T12:00:00Z',
        supplierVisible: true,
      },
      {
        roundId: 2,
        roundNo: 2,
        meetingAt: '2026-10-06T06:00:00Z',
        participants:
          'KWU: Tebogo Molefe (negotiator), Refilwe Motsumi (adviser). Limpopo Environmental Services: Mothusi Limpopo, project lead.',
        topics: ['Service credits', 'Key personnel substitution'],
        minutes: null,
        buyerProposal:
          'Service credits capped at 7.5% of the monthly fee; key personnel may be substituted only with 20 working days’ notice and an equivalent CV approved by KWU.',
        supplierProposal: null,
        concessions: null,
        unresolvedIssues: 'Service-credit cap; key-personnel substitution notice period.',
        supplierResponseAt: null,
        supplierVisible: true,
      },
    ],
    updatedAt: '2026-09-30T07:00:00Z',
  },
  {
    tenantId: KWU,
    negotiationId: 3,
    tenderId: 9,
    lotId: null,
    bidId: 910,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    allowedTopics: ['Variant pricing for continuous acoustic logging'],
    authorizedNegotiatorIds: [U.tebogo],
    commercialAuthority: null,
    status: 'planned',
    approval: null,
    outcomeSummary: null,
    affectsCompetitionBasis: true,
    processDecisionId: 2,
    version: 1,
    contentHash: '1f40b1bae413e9abb818d58bd967db0dd1f95e123d1a503aca83af5882cde7ec',
    rounds: [],
    updatedAt: '2026-09-30T06:00:00Z',
  },
];

// ---------------------------------------------------------------------------------------------------------
// Final-offer rounds (BUY-27, AC-23)
// ---------------------------------------------------------------------------------------------------------

export const FINAL_OFFER_ROUNDS: readonly FixtureFinalOfferRound[] = [
  {
    tenantId: KWU,
    roundId: 1,
    tenderId: 9,
    lotId: null,
    instructions:
      'Submit a best and final offer for the variant (continuous acoustic logging with permanent loggers on trunk mains) through the response workspace. Only the items listed as permitted changes may be revised.',
    permittedChanges: 'Unit rates for logger deployment and monthly analytics only. Scope, service levels and contract terms are unchanged.',
    deadline: '2026-10-20T08:00:00Z',
    openingRules:
      'Opened after the deadline by the Bid Opening Officer with a witness. Earlier offers remain available to authorized reviewers for comparison.',
    evaluationTreatment: 'Replaces the commercial score of the variant only; technical scores are unchanged.',
    proceduralAuthorityRef: 'Pending: the reopen-round decision proposed on 30 Sep 2026 is awaiting approval',
    status: 'draft',
    approval: null,
    version: 1,
    contentHash: 'c5d3577bdf8eab6febe542ed28dee9f3cc0dd20553402219cc597e942ee4d32b',
    invitees: [
      {
        bidId: 910,
        supplierTenantId: TENANT_IDS['limpopo-env'],
        responseBidId: 25,
        notifiedAt: null,
        finalOfferReceivedAt: null,
        finalOffer: null,
      },
    ],
    updatedAt: '2026-09-30T06:30:00Z',
  },
  // SUP-19 with content: an issued round on T-2026-0001 Lot 3, authorized by the approved reopen-round decision on
  // the over-budget Lot 3 offers and open on equal terms to both bidders; neither final offer is in yet.
  {
    tenantId: KWU,
    roundId: 2,
    tenderId: 1,
    lotId: 103,
    instructions:
      'Submit a best and final offer for Lot 3 (pump controls and telemetry panels) through your response workspace. Revise only the items listed as permitted changes; everything else in your offer stands as submitted.',
    permittedChanges:
      'Lot 3 unit prices and the delivery programme only. The specification, the telemetry panel test result and the contract terms are unchanged.',
    deadline: '2026-10-16T08:00:00Z',
    openingRules:
      'Both final offers are opened together after the deadline by the Bid Opening Officer with a witness. A final offer received after the deadline is rejected and the earlier offer stands.',
    evaluationTreatment:
      'Final prices replace the Lot 3 prices read at opening; technical results and the telemetry pass/fail gate are unchanged.',
    proceduralAuthorityRef:
      'Reopen-round decision on the over-budget Lot 3 offers, approved by the Procurement Manager on 25 Sep 2026',
    status: 'issued',
    approval: null,
    version: 1,
    contentHash: '154261e1c959fa316faa7e570a224a58461c59bab827089b7e5df41d759dd35d',
    invitees: [
      {
        bidId: SELECTION_BID_IDS.lot3Tsodilo,
        supplierTenantId: TENANT_IDS.tsodilo,
        responseBidId: 1,
        notifiedAt: '2026-09-26T07:00:00Z',
        finalOfferReceivedAt: null,
        finalOffer: null,
      },
      {
        bidId: SELECTION_BID_IDS.lot3Chobe,
        supplierTenantId: TENANT_IDS['chobe-pipe'],
        responseBidId: 2,
        notifiedAt: '2026-09-26T07:00:00Z',
        finalOfferReceivedAt: null,
        finalOffer: null,
      },
    ],
    updatedAt: '2026-09-26T07:00:00Z',
  },
];
