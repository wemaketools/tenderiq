/**
 * Contract-valid award test data for the SPA tests (test data only; the application's data comes from the API).
 * Every builder parses its result with the contract schema, so a drift fails at the builder.
 */
import {
  AwardOverview,
  AwardRegisterPage,
  AwardRegisterRow,
  CloseoutState,
  ComplaintDetail,
  ComplaintOwnerCandidates,
  ComplaintPage,
  ComplaintTenderOptions,
  DebriefDetail,
  DebriefPage,
  OutcomeNoticeDetail,
  OutcomeNoticePage,
  PublicAwardDetail,
  PublicAwardPage,
  PublicNoticeState,
  RecommendationDetail,
  StandstillOverview,
  SupplierComplaintDetail,
  SupplierComplaintPage,
  SupplierOutcomeDetail,
  SupplierOutcomePage,
} from '@contracts/awards';
import type {
  AwardTenderRef,
  FinalAwardApprovalState,
  GateCheck,
  Hold,
  LotOutcome,
  OutcomeNoticeSummary,
} from '@contracts/awards';
import { DocumentSummary } from '@contracts/documents';

const ZONE = 'Africa/Gaborone';
const deadline = (at: string) => ({ at, timeZone: ZONE });
const bwp = (amount: string) => ({ amount, currency: 'BWP' });
export const person = (userId: number, fullName: string) => ({ userId, fullName });

export const TEBOGO = person(5, 'Tebogo Molefe');
export const DINEO = person(17, 'Dineo Masire');
const MAKGADIKGADI = { supplierTenantId: 6, name: 'Makgadikgadi Civil Works' };
const LIMPOPO = { supplierTenantId: 8, name: 'Limpopo Environmental Services' };
const KWU = { tenantId: 2, name: 'Kalahari Water Utilities (Pilot)', slug: 'kwu' };
export const LOT_701 = { lotId: 701, lotNo: 1, title: 'Reservoir rehabilitation works' };

export const T7: AwardTenderRef = {
  tenderId: 7,
  reference: 'T-2026-0007',
  title: 'Reservoir rehabilitation works',
  eventType: 'tender',
  procedure: 'open',
  status: 'award_pending',
  officialTimeZone: ZONE,
  currency: 'BWP',
};

export function gate(overrides: Partial<GateCheck> = {}): GateCheck {
  return {
    code: 'blocking_complaint',
    status: 'blocking',
    detail: 'CMP-2026-0002 holds the final award.',
    ...overrides,
  };
}

export function hold(overrides: Partial<Hold> = {}): Hold {
  return {
    holdId: 41,
    subjectType: 'tender',
    subjectLabel: 'T-2026-0007 — Reservoir rehabilitation works',
    holdType: 'complaint_hold',
    reason: 'Complaint CMP-2026-0002 challenges the technical evaluation.',
    owner: DINEO,
    authorityNote: null,
    blockedActions: ['award_final', 'contract_sign'],
    scopeDescription: 'Final award and contract signature.',
    startedAt: '2026-09-25T10:00:00Z',
    reviewDate: '2026-10-09',
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    complaintId: 92,
    complaintReference: 'CMP-2026-0002',
    ...overrides,
  };
}

export function lotOutcome(overrides: Partial<LotOutcome> = {}): LotOutcome {
  return {
    lotOutcomeId: 71,
    recommendationId: 14,
    lot: LOT_701,
    outcome: 'award',
    supplier: MAKGADIKGADI,
    bidId: 706,
    awardedValue: bwp('7850000.00'),
    conditions: null,
    reason: 'Highest-ranked compliant offer.',
    status: 'intent_notified',
    finalAwardedAt: null,
    finalAwardApprovalId: null,
    finalAwardApprovedBy: null,
    ...overrides,
  };
}

const reconciliation = {
  currency: 'BWP',
  value: {
    basis: 'intended' as const,
    total: bwp('7850000.00'),
    finalAwardedTotal: bwp('0.00'),
  },
  lotTotals: [
    {
      lotId: 701,
      lotNo: 1,
      outcome: 'award' as const,
      status: 'intent_notified' as const,
      awardedValue: bwp('7850000.00'),
    },
  ],
  contractAllocations: [],
  allocatedTotal: bwp('0.00'),
  unallocated: bwp('7850000.00'),
  reconciles: true,
  note: null,
};

export function finalApproval(
  overrides: Partial<FinalAwardApprovalState> = {},
): FinalAwardApprovalState {
  return {
    lotOutcomeId: 71,
    subjectVersion: 1,
    contentHash: 'a'.repeat(64),
    approvalRequestId: null,
    requestable: false,
    unavailableReason:
      'Cannot be requested while the hold on CMP-2026-0002 blocks the final award.',
    ...overrides,
  };
}

export function overview(overrides: Partial<AwardOverview> = {}): AwardOverview {
  return AwardOverview.parse({
    tender: T7,
    owner: TEBOGO,
    awardModel: 'single',
    lots: [
      {
        lot: LOT_701,
        stage: 'award_pending',
        outcome: lotOutcome(),
        standstillStatus: 'running',
        standstillEndsAt: deadline('2026-10-08T15:00:00Z'),
        finalAwardGate: [gate(), gate({ code: 'intent_notice', status: 'passed', detail: null })],
        finalAwardApproval: finalApproval(),
      },
    ],
    recommendations: [
      {
        recommendationId: 14,
        version: 1,
        status: 'approved',
        lotNos: [1],
        createdAt: '2026-09-11T08:30:00Z',
        decidedAt: '2026-09-18T11:00:00Z',
      },
    ],
    reconciliation,
    holds: [hold()],
    openComplaintCount: 1,
    openDebriefCount: 1,
    publicNoticeStatus: 'draft',
    closeoutStatus: 'in_progress',
    nextStep: 'resolve_complaint',
    ...overrides,
  });
}

export function registerRow(overrides: Partial<AwardRegisterRow> = {}): AwardRegisterRow {
  return AwardRegisterRow.parse({
    tender: T7,
    owner: TEBOGO,
    lotCount: 1,
    lotsWithOutcome: 1,
    lotsWithProposedOutcome: 0,
    lotsFinalAwarded: 0,
    latestRecommendation: { recommendationId: 14, version: 1, status: 'approved' },
    value: { basis: 'intended', total: bwp('7850000.00'), finalAwardedTotal: bwp('0.00') },
    standstillStatus: 'running',
    standstillEndsAt: deadline('2026-10-08T15:00:00Z'),
    activeHoldCount: 1,
    openComplaintCount: 1,
    closeoutStatus: 'in_progress',
    nextStep: 'resolve_complaint',
    updatedAt: '2026-09-29T08:00:00Z',
    ...overrides,
  });
}

export function registerPage(
  items: readonly AwardRegisterRow[] = [registerRow()],
): AwardRegisterPage {
  return AwardRegisterPage.parse({
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
  });
}

/** A complaint evidence document of the documents domain (related to complaint 92). */
export function evidenceDocument(): DocumentSummary {
  return DocumentSummary.parse({
    id: 4402,
    title: 'Complaint letter.pdf',
    purpose: 'Complaint letter and annexes',
    classification: 'supplier_private',
    language: 'en',
    status: 'published',
    relatedType: 'complaint',
    relatedId: 92,
    precedence: null,
    isRedactedCopy: false,
    currentVersion: {
      id: 44021,
      documentId: 4402,
      versionNo: 1,
      fileName: 'complaint-letter.pdf',
      contentType: 'application/pdf',
      sizeBytes: 4096,
      sha256: 'b'.repeat(64),
      uploadStatus: 'confirmed',
      changeNote: null,
      supersedesVersionId: null,
      createdAt: '2026-09-25T07:40:00Z',
      createdBy: person(41, 'Mothusi Limpopo'),
      confirmedAt: '2026-09-25T07:40:00Z',
    },
    updatedAt: '2026-09-25T07:40:00Z',
  });
}

export function recommendation(
  overrides: Partial<RecommendationDetail> = {},
): RecommendationDetail {
  return RecommendationDetail.parse({
    recommendationId: 14,
    tender: T7,
    version: 1,
    status: 'draft',
    summary: 'Award to Makgadikgadi Civil Works.',
    compliantOffersSummary: 'Three compliant offers.',
    affordabilitySummary: 'Within budget.',
    conflictsSummary: 'None declared.',
    exceptionsSummary: 'None.',
    negotiationSummary: 'No negotiation.',
    unresolvedConditions: 'None.',
    offers: [
      {
        bidId: 706,
        supplier: MAKGADIKGADI,
        lotNos: [1],
        complianceStatus: 'compliant',
        technicalScore: '60.00',
        commercialScore: '23.60',
        totalScore: '83.60',
        rank: 1,
        evaluatedPrice: bwp('7850000.00'),
        note: null,
      },
    ],
    affordability: { budgetAmount: bwp('8000000.00'), fundingConfirmed: true, withinBudget: true },
    qualification: [],
    diligence: [],
    unresolvedConflictCount: 0,
    lotOutcomes: [lotOutcome({ status: 'recommended' })],
    reconciliation,
    proposedContracts: [],
    submissionChecks: [{ code: 'evaluation_signed_off', status: 'passed', detail: null }],
    approval: {
      approvalRequestId: null,
      status: null,
      approver: null,
      decidedAt: null,
      conditions: null,
      rationale: null,
    },
    history: [
      { at: '2026-09-11T08:30:00Z', action: 'created', actor: TEBOGO, version: 1, note: null },
    ],
    snapshotId: null,
    createdBy: TEBOGO,
    createdAt: '2026-09-11T08:30:00Z',
    updatedAt: '2026-09-11T08:30:00Z',
    ...overrides,
  });
}

export function noticeSummary(overrides: Partial<OutcomeNoticeSummary> = {}): OutcomeNoticeSummary {
  return {
    noticeId: 55,
    tenderId: 7,
    noticeType: 'intent_to_award',
    version: 1,
    title: 'Intention to award — T-2026-0007',
    status: 'issued',
    lotNos: [1],
    requiresAcknowledgment: true,
    periodStartBasis: 'transmission',
    recipientCount: 2,
    deliveredCount: 1,
    failedCount: 1,
    acknowledgedCount: 1,
    issuedAt: '2026-09-22T08:00:00Z',
    issuedBy: TEBOGO,
    ...overrides,
  };
}

export function noticePage(): OutcomeNoticePage {
  return OutcomeNoticePage.parse({ items: [noticeSummary()], total: 1, page: 1, pageSize: 25 });
}

export function noticeDetail(overrides: Partial<OutcomeNoticeDetail> = {}): OutcomeNoticeDetail {
  return OutcomeNoticeDetail.parse({
    ...noticeSummary(),
    body: 'Kalahari Water Utilities intends to award the works to Makgadikgadi Civil Works.',
    audienceDescription: 'Every supplier with an effective bid.',
    approvalRequestId: null,
    disclosureReview: {
      status: 'completed',
      reviewedBy: DINEO,
      reviewedAt: '2026-09-21T08:00:00Z',
      note: null,
    },
    recipients: [
      {
        recipientId: 551,
        supplier: MAKGADIKGADI,
        recipientUser: null,
        deliveryStatus: 'delivered',
        deliveredAt: '2026-09-22T08:01:00Z',
        openedAt: null,
        acknowledgedAt: '2026-09-22T09:00:00Z',
        acknowledgedBy: person(40, 'Sethunya Makgadi'),
        termsAcceptedAt: null,
        failureReason: null,
      },
      {
        recipientId: 552,
        supplier: LIMPOPO,
        recipientUser: null,
        deliveryStatus: 'failed',
        deliveredAt: null,
        openedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        termsAcceptedAt: null,
        failureReason: 'Mailbox full',
      },
    ],
    ...overrides,
  });
}

export function standstill(): StandstillOverview {
  return StandstillOverview.parse({
    tender: T7,
    policy: {
      standstillRequired: true,
      standstillLength: 10,
      standstillDayType: 'working',
      calendarName: 'Botswana Public Holidays 2026',
      complaintWindowDays: 10,
      policyLabel: 'KWU Procurement Policy 2026, version 3',
    },
    periods: [
      {
        standstillId: 32,
        tenderId: 7,
        lot: LOT_701,
        intentNoticeId: 55,
        startsAt: deadline('2026-09-22T08:00:00Z'),
        endsAt: deadline('2026-10-08T15:00:00Z'),
        dayType: 'working',
        extendedTo: null,
        extensionReason: null,
        effectiveEndsAt: deadline('2026-10-08T15:00:00Z'),
        status: 'running',
        notApplicableReason: null,
      },
    ],
    holds: [hold()],
    blockedActions: ['award_final', 'contract_sign'],
    lotReadiness: [{ lot: LOT_701, lotOutcomeId: 71, checks: [gate()] }],
  });
}

export function publicNoticeState(): PublicNoticeState {
  return PublicNoticeState.parse({
    tender: T7,
    notice: {
      publicNoticeId: 62,
      tenderId: 7,
      status: 'draft',
      content: 'Award notice draft for T-2026-0007.',
      disclosedValues: true,
      reviewConfidentialityBy: null,
      reviewPersonalInfoBy: null,
      publishedAt: null,
      updatedAt: '2026-09-28T08:00:00Z',
    },
    finalAwardedLotCount: 0,
  });
}

export function closeout(overrides: Partial<CloseoutState> = {}): CloseoutState {
  return CloseoutState.parse({
    tender: {
      ...T7,
      tenderId: 1,
      reference: 'T-2026-0001',
      title: 'Borehole pumps',
      status: 'partially_awarded',
    },
    closeoutId: 3,
    status: 'blocked',
    isInformationOnly: false,
    lots: [
      {
        lot: { lotId: 101, lotNo: 1, title: 'Pumps' },
        stage: 'awarded',
        outcome: 'award',
        outcomeStatus: 'final_awarded',
      },
    ],
    contracts: [
      {
        contractId: 2,
        reference: 'C-2026-0002',
        status: 'awaiting_signature',
        supplier: { supplierTenantId: 4, name: 'Tsodilo Engineering' },
        lotNos: [1],
        handoverStatus: 'submitted',
      },
    ],
    outstandingComplaints: [],
    openDebriefCount: 0,
    securitiesNote: null,
    lessonsLearned: null,
    retentionClass: 'tender',
    marketFindings: null,
    nextStepDecision: null,
    linkedNextTender: null,
    gate: [
      {
        code: 'handover_accepted',
        status: 'blocking',
        detail: 'The handover of C-2026-0002 is not accepted.',
      },
    ],
    blockingReasons: ['The handover of C-2026-0002 is not accepted.'],
    closedBy: null,
    closedAt: null,
    archivedAt: null,
    evidencePacks: [],
    ...overrides,
  });
}

const debriefRow = {
  debriefId: 82,
  tender: { tenderId: 7, reference: 'T-2026-0007', title: 'Reservoir rehabilitation works' },
  supplier: LIMPOPO,
  bidId: 708,
  requestedBy: person(41, 'Mothusi Limpopo'),
  requestedAt: '2026-09-22T14:00:00Z',
  dueAt: deadline('2026-10-29T15:00:00Z'),
  meetingAt: null,
  status: 'requested' as const,
  providedBy: null,
};

export function debriefPage(): DebriefPage {
  return DebriefPage.parse({ items: [debriefRow], total: 1, page: 1, pageSize: 25 });
}

export function debrief(overrides: Partial<DebriefDetail> = {}): DebriefDetail {
  return DebriefDetail.parse({
    ...debriefRow,
    requestNote: 'Please explain the methodology score.',
    writtenResponse: null,
    effectOnDeadlines: 'None.',
    declineReason: null,
    ownResult: {
      totalScore: '72.40',
      maxScore: '100.00',
      rank: 3,
      criteria: [
        {
          criterion: 'T-2 Methodology',
          weight: '25.00',
          ownScore: '15.40',
          maxScore: '25.00',
          feedback: 'Programme gaps.',
        },
      ],
      successfulTenderAdvantages: 'Stronger methodology.',
    },
    challengeInstructions: 'Lodge a complaint within 10 working days.',
    ...overrides,
  });
}

const complaintRow = {
  complaintId: 92,
  reference: 'CMP-2026-0002',
  tender: { tenderId: 7, reference: 'T-2026-0007', title: 'Reservoir rehabilitation works' },
  lot: LOT_701,
  complainant: LIMPOPO,
  subject: 'evaluation' as const,
  status: 'received' as const,
  receivedAt: '2026-09-25T07:40:00Z',
  withinWindow: true,
  standingConfirmed: false,
  acknowledgedAt: null,
  caseOwner: null,
  independenceConfirmed: false,
  isBlocking: true,
  holdActive: true,
  outcome: null,
  responseDueAt: deadline('2026-10-09T15:00:00Z'),
};

export function complaintPage(): ComplaintPage {
  return ComplaintPage.parse({ items: [complaintRow], total: 1, page: 1, pageSize: 25 });
}

export function complaint(overrides: Partial<ComplaintDetail> = {}): ComplaintDetail {
  return ComplaintDetail.parse({
    ...complaintRow,
    grounds: 'The methodology criterion was scored against an unpublished sub-criterion.',
    complainantUser: person(41, 'Mothusi Limpopo'),
    hold: hold(),
    responseText: null,
    remedy: null,
    appealGrounds: null,
    appealOutcome: null,
    closedAt: null,
    publicSummary: null,
    procurementEffect: {
      blockedActions: ['award_final'],
      affectedLotOutcomeIds: [71],
      standstillEffect: null,
    },
    events: [
      {
        eventId: 1,
        eventType: 'received',
        fromStatus: null,
        toStatus: 'received',
        note: 'Complaint received within the window.',
        actor: person(41, 'Mothusi Limpopo'),
        occurredAt: '2026-09-25T07:40:00Z',
        supplierVisible: true,
      },
    ],
    ...overrides,
  });
}

export function ownerCandidates(): ComplaintOwnerCandidates {
  return ComplaintOwnerCandidates.parse({
    candidates: [
      { person: DINEO, capacity: 'Legal Counsel', independent: true, note: null },
      {
        person: person(4, 'Mpho Dikgang'),
        capacity: 'Procurement Manager',
        independent: false,
        note: 'Approved the release of the challenged tender terms.',
      },
    ],
  });
}

const outcomeRow = {
  tenderId: 7,
  buyer: KWU,
  reference: 'T-2026-0007',
  title: 'Reservoir rehabilitation works',
  result: 'intent_to_award' as const,
  lots: [
    {
      lot: LOT_701,
      result: 'intent_to_award' as const,
      awardedValue: bwp('7850000.00'),
      conditions: null,
      reason: 'Highest-ranked offer.',
    },
  ],
  latestNoticeAt: '2026-09-22T08:00:00Z',
  standstillEndsAt: deadline('2026-10-08T15:00:00Z'),
  awaitingAcknowledgment: 1,
  debriefStatus: null,
  openComplaintCount: 0,
};

export function supplierOutcomePage(): SupplierOutcomePage {
  return SupplierOutcomePage.parse({ items: [outcomeRow], total: 1, page: 1, pageSize: 25 });
}

export function supplierOutcome(
  overrides: Partial<SupplierOutcomeDetail> = {},
): SupplierOutcomeDetail {
  return SupplierOutcomeDetail.parse({
    ...outcomeRow,
    officialTimeZone: ZONE,
    notices: [
      {
        noticeId: 55,
        noticeType: 'intent_to_award',
        title: 'Intention to award — T-2026-0007',
        body: 'You are the intended supplier. This is not a final award.',
        lotNos: [1],
        issuedAt: '2026-09-22T08:00:00Z',
        requiresAcknowledgment: true,
        hasTerms: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
        termsAcceptedAt: null,
      },
    ],
    standstill: {
      status: 'running',
      endsAt: deadline('2026-10-08T15:00:00Z'),
      extendedTo: null,
      effectiveEndsAt: deadline('2026-10-08T15:00:00Z'),
      dayType: 'working',
      extensionReason: null,
    },
    procurementHoldActive: true,
    debrief: null,
    canRequestDebrief: false,
    debriefDeadline: null,
    debriefInstructions: 'Debriefings are offered to unsuccessful suppliers.',
    challengeInstructions: 'Lodge a complaint within 10 working days.',
    complaintDeadline: null,
    complaints: [],
    ...overrides,
  });
}

const supplierComplaintRow = {
  complaintId: 92,
  reference: 'CMP-2026-0002',
  buyer: KWU,
  tender: { tenderId: 7, reference: 'T-2026-0007', title: 'Reservoir rehabilitation works' },
  lot: LOT_701,
  subject: 'evaluation' as const,
  status: 'response_issued' as const,
  receivedAt: '2026-09-25T07:40:00Z',
  acknowledgedAt: '2026-09-25T12:00:00Z',
  outcome: 'dismissed' as const,
  procurementHoldActive: true,
  responseDueAt: null,
};

export function supplierComplaintPage(): SupplierComplaintPage {
  return SupplierComplaintPage.parse({
    items: [supplierComplaintRow],
    total: 1,
    page: 1,
    pageSize: 25,
  });
}

export function supplierComplaint(
  overrides: Partial<SupplierComplaintDetail> = {},
): SupplierComplaintDetail {
  return SupplierComplaintDetail.parse({
    ...supplierComplaintRow,
    grounds: 'The methodology criterion was scored against an unpublished sub-criterion.',
    complainantUser: person(41, 'Mothusi Limpopo'),
    withinWindow: true,
    responseText: 'The sub-criterion was published in section 4.3.',
    remedy: null,
    appealGrounds: null,
    appealOutcome: null,
    appealAvailable: true,
    appealDeadline: deadline('2026-10-20T15:00:00Z'),
    closedAt: null,
    events: [],
    ...overrides,
  });
}

export function complaintTenders(): ComplaintTenderOptions {
  return ComplaintTenderOptions.parse({
    tenders: [
      {
        tenderId: 7,
        buyer: KWU,
        reference: 'T-2026-0007',
        title: 'Reservoir rehabilitation works',
        status: 'award_pending',
        lots: [LOT_701],
        complaintDeadline: deadline('2026-10-08T15:00:00Z'),
      },
    ],
  });
}

const publicRow = {
  buyer: { name: KWU.name, slug: 'kwu' },
  reference: 'T-2026-0001',
  title: 'Borehole pump replacement programme',
  eventType: 'tender' as const,
  tenderStatus: 'partially_awarded' as const,
  publishedAt: '2026-09-07T08:00:00Z',
  lots: [
    {
      lotNo: 1,
      title: 'Submersible pumps',
      outcome: 'award' as const,
      supplierName: 'Tsodilo Engineering',
      awardedValue: bwp('5340000.00'),
      finalAwardedAt: '2026-09-04T09:00:00Z',
    },
    {
      lotNo: 2,
      title: 'Solar pumping',
      outcome: 'cancelled' as const,
      supplierName: null,
      awardedValue: null,
      finalAwardedAt: null,
    },
  ],
  disclosedValues: true,
  totalAwardedValue: bwp('5340000.00'),
};

export function publicAwardPage(): PublicAwardPage {
  return PublicAwardPage.parse({ items: [publicRow], total: 1, page: 1, pageSize: 25 });
}

export function publicAward(): PublicAwardDetail {
  return PublicAwardDetail.parse({
    ...publicRow,
    officialTimeZone: ZONE,
    content: 'Lot 1 was awarded to Tsodilo Engineering; lot 2 was cancelled.',
    noticeFileName: 'kwu-T-2026-0001-award-notice.txt',
  });
}
