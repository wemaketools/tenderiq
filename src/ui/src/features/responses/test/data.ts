/**
 * Contract-typed test data for the response and monitoring page tests (the storyline's T-2026-0006 and
 * T-2026-0002 scenarios in miniature), plus a router for the mocked API client.
 */
import { vi } from 'vitest';

import type {
  AnswerPage,
  BidAnswerDetail,
  BidDeclarations,
  BidDetail,
  BidPage,
  BidPricing,
  BidReadiness,
  BidRevision,
  InternalReview,
  MonitoringDetail,
  MonitoringPage,
  MonitoringReceiptPage,
  Receipt,
  ReceiptSummary,
  SubmissionAttempt,
  SubmissionPreview,
  SupplierReceiptPage,
  Withdrawal,
} from '@contracts/bids';
import type { AnyEndpoint } from '@contracts/endpoint';
import type { PermissionCode } from '@contracts/permissions';

import { ApiError, call } from '../../../api/client';
import { makeTenant, makeUser, signedInSession } from '../../../test/fixtures';

export const HASH = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);
const TZ = 'Africa/Gaborone';
const DEADLINE = { at: '2026-10-14T10:00:00Z', timeZone: TZ };
const TENDER = {
  tenderId: 6,
  reference: 'T-2026-0006',
  title: 'Chlorine dosing equipment',
  eventType: 'tender' as const,
  status: 'open' as const,
  buyer: { tenantId: 2, name: 'Kalahari Water Utilities (Pilot)', slug: 'kwu' },
};
const LOT = { lotId: 601, lotNo: 1, title: 'Dosing pumps' };
const PERSON = { userId: 25, fullName: 'Boago Moremi' };
const SIGNATORY = { userId: 27, fullName: 'Motsamai Tsodilo' };

// ---------------------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------------------

export function supplierState(permissions: readonly PermissionCode[], userId = 25) {
  return {
    session: signedInSession({
      user: makeUser({ id: userId }),
      activeTenant: makeTenant(
        {
          tenantId: 4,
          kind: 'supplier',
          name: 'Tsodilo Engineering',
          slug: 'tsodilo',
          capacity: 'Bid Manager',
        },
        permissions,
      ),
    }),
  };
}

export const BID_MANAGER: readonly PermissionCode[] = [
  'supplier.response.edit',
  'supplier.pricing.edit',
  'supplier.pursuit.manage',
  'supplier.outcomes.view',
];
export const CONTRIBUTOR: readonly PermissionCode[] = ['supplier.response.edit'];
export const SIGNATORY_PERMISSIONS: readonly PermissionCode[] = [
  'supplier.response.approve',
  'supplier.response.submit',
  'supplier.outcomes.view',
];

export function buyerState(permissions: readonly PermissionCode[]) {
  return {
    session: signedInSession({
      activeTenant: makeTenant({ capacity: 'Procurement Officer' }, permissions),
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Supplier builders
// ---------------------------------------------------------------------------------------------------------

export function receiptSummary(overrides: Partial<ReceiptSummary> = {}): ReceiptSummary {
  return {
    id: 21,
    receiptNo: 'RCPT-2026-000021',
    bidId: 14,
    revisionId: 1401,
    revisionNo: 1,
    receivedAt: '2026-09-20T08:00:00Z',
    status: 'received',
    statusChangedAt: '2026-09-20T08:00:00Z',
    documentCount: 4,
    isEffective: true,
    ...overrides,
  };
}

export function attempt(overrides: Partial<SubmissionAttempt> = {}): SubmissionAttempt {
  return {
    id: 7,
    bidId: 14,
    revisionId: 1402,
    revisionNo: 2,
    attemptedBy: SIGNATORY,
    startedAt: '2026-09-24T09:00:00Z',
    completedAt: '2026-09-24T09:00:05Z',
    outcome: 'failed_error',
    failureReason: 'Service incident during transfer',
    deadlineAtAttempt: DEADLINE,
    lateBySeconds: null,
    receiptId: null,
    receiptNo: null,
    ...overrides,
  };
}

export function withdrawal(overrides: Partial<Withdrawal> = {}): Withdrawal {
  return {
    id: 2,
    bidId: 14,
    revisionId: 1401,
    revisionNo: 1,
    receiptId: 21,
    receiptNo: 'RCPT-2026-000021',
    confirmationNo: 'WDR-2026-000002',
    withdrawnAt: '2026-09-30T08:00:00Z',
    withdrawnBy: { ...SIGNATORY, capacity: 'Managing Director' },
    reason: 'Capacity committed elsewhere',
    ...overrides,
  };
}

export function bidDetail(overrides: Partial<BidDetail> = {}): BidDetail {
  return {
    id: 14,
    tender: TENDER,
    roundType: 'initial',
    isAlternative: false,
    isConsortium: false,
    submissionState: 'not_submitted',
    deadline: DEADLINE,
    lots: [LOT],
    workingRevision: { id: 1401, revisionNo: 1, status: 'draft' },
    effectiveReceipt: null,
    progress: { total: 4, notStarted: 1, inProgress: 1, readyForReview: 1, complete: 1 },
    bidManager: PERSON,
    updatedAt: '2026-09-28T08:00:00Z',
    legalParty: { tenantId: 4, legalName: 'Tsodilo Engineering (Pty) Ltd' },
    officialTimeZone: TZ,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    participation: 'invitation_only',
    bidValidityDays: 90,
    partialBidsAllowed: true,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentTenderVersionNo: 1,
    submissionWindowOpen: true,
    replacementPermitted: false,
    leadMemberName: null,
    lotOptions: [
      {
        ...LOT,
        description: 'Supply and install',
        stage: 'open',
        deadline: DEADLINE,
        selected: true,
        eligible: true,
        ineligibleReason: null,
      },
    ],
    sections: [
      {
        section: 'Technical approach',
        envelope: 'technical',
        progress: { total: 4, notStarted: 1, inProgress: 1, readyForReview: 1, complete: 1 },
        mandatoryOpen: 2,
      },
    ],
    team: [
      {
        ...PERSON,
        capacity: 'Bid Manager',
        responsibility: 'bid_manager',
        canViewPricing: true,
        canApprove: false,
        canSubmit: false,
      },
      {
        ...SIGNATORY,
        capacity: 'Managing Director',
        responsibility: 'signatory',
        canViewPricing: true,
        canApprove: true,
        canSubmit: true,
      },
    ],
    addenda: [],
    effectiveOffer: {
      explanation: 'none_submitted',
      receipt: null,
      lastUnsuccessfulAttempt: null,
      withdrawal: null,
    },
    viewer: {
      canEditResponse: true,
      canViewPricing: true,
      canEditPricing: true,
      canAssign: true,
      canComment: true,
      canApprove: false,
      canSubmit: false,
    },
    ...overrides,
  };
}

export function bidPage(items: BidPage['items']): BidPage {
  return { items, total: items.length, page: 1, pageSize: 25 };
}

export function readiness(overrides: Partial<BidReadiness> = {}): BidReadiness {
  return {
    bidId: 14,
    revisionId: 1401,
    revisionNo: 1,
    revisionStatus: 'draft',
    checkedAt: '2026-09-30T08:00:00Z',
    ready: false,
    blockingCount: 1,
    warningCount: 1,
    items: [
      {
        id: 'evidence-1',
        category: 'evidence',
        severity: 'blocking',
        code: 'EVIDENCE_EXPIRED',
        count: null,
        subject: 'Tax clearance certificate',
        requirementIds: [],
        link: '/supplier/responses/14/declarations',
      },
      {
        id: 'answers-1',
        category: 'answers',
        severity: 'warning',
        code: 'REUSED_CONTENT_NOT_REVIEWED',
        count: 1,
        subject: null,
        requirementIds: [6001],
        link: '/supplier/responses/14/answers',
      },
      {
        id: 'lots-passed',
        category: 'lots',
        severity: 'passed',
        code: 'CHECK_PASSED',
        count: null,
        subject: null,
        requirementIds: [],
        link: null,
      },
    ],
    ...overrides,
  };
}

export function answerDetail(overrides: Partial<BidAnswerDetail> = {}): BidAnswerDetail {
  return {
    requirementId: 6001,
    refCode: 'TQ-01',
    section: 'Technical approach',
    lot: LOT,
    text: 'Describe the dosing control approach.',
    responseType: 'text',
    choices: [],
    responseInstructions: 'At most two pages.',
    evidenceRequired: null,
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'warning',
    addendumNumber: null,
    answerText: 'Closed-loop control with residual analysers.',
    answerNumber: null,
    answerChoice: null,
    answerBool: null,
    isDeviation: false,
    deviationNote: null,
    assignedUser: PERSON,
    dueAt: null,
    progress: 'in_progress',
    reuse: null,
    documentCount: 0,
    commentCount: 1,
    updatedBy: PERSON,
    updatedAt: '2026-09-28T08:00:00Z',
    revisionId: 1401,
    revisionNo: 1,
    editable: true,
    attachments: [],
    comments: [
      {
        id: 1,
        requirementId: 6001,
        revisionId: 1401,
        author: SIGNATORY,
        body: 'Add the analyser model.',
        createdAt: '2026-09-28T09:00:00Z',
      },
    ],
    ...overrides,
  };
}

export function answerPage(overrides: Partial<AnswerPage> = {}): AnswerPage {
  const { revisionId, revisionNo, editable, attachments, comments, ...row } = answerDetail();
  void revisionId;
  void revisionNo;
  void editable;
  void attachments;
  void comments;
  return {
    items: [row],
    total: 1,
    page: 1,
    pageSize: 25,
    revisionId: 1401,
    revisionNo: 1,
    revisionStatus: 'draft',
    editable: true,
    sections: bidDetail().sections,
    ...overrides,
  };
}

export function pricing(overrides: Partial<BidPricing> = {}): BidPricing {
  const zero = { amount: '0.00', currency: 'BWP' };
  return {
    bidId: 14,
    revisionId: 1401,
    revisionNo: 1,
    revisionStatus: 'draft',
    editable: true,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 90,
    schedules: [
      {
        scheduleId: 61,
        title: 'Price schedule',
        lot: LOT,
        lines: [
          {
            pricingItemId: 611,
            itemCode: 'P-01',
            description: 'Dosing pump',
            unit: 'each',
            requestedQuantity: '4',
            chargeType: 'one_time',
            recurrence: null,
            isOptional: false,
            isProvisional: false,
            includeInEvaluation: true,
            priceStatus: 'priced',
            unitPrice: '12500.00',
            quantity: '4',
            currency: 'BWP',
            taxRate: '14',
            discountAmount: null,
            lineTotal: { amount: '50000.00', currency: 'BWP' },
            notes: null,
          },
          {
            pricingItemId: 612,
            itemCode: 'P-02',
            description: 'Commissioning',
            unit: 'lot',
            requestedQuantity: '1',
            chargeType: 'one_time',
            recurrence: null,
            isOptional: false,
            isProvisional: false,
            includeInEvaluation: true,
            priceStatus: null,
            unitPrice: null,
            quantity: null,
            currency: null,
            taxRate: null,
            discountAmount: null,
            lineTotal: null,
            notes: null,
          },
        ],
      },
    ],
    commercialTerms: {
      validityDays: 90,
      paymentTerms: '30 days',
      conditionalDiscounts: null,
      assumptions: null,
      totalOneTime: { amount: '57000.00', currency: 'BWP' },
      totalRecurringPerPeriod: null,
      currency: 'BWP',
    },
    totals: {
      oneTime: {
        net: { amount: '50000.00', currency: 'BWP' },
        tax: { amount: '7000.00', currency: 'BWP' },
        gross: { amount: '57000.00', currency: 'BWP' },
      },
      recurring: [],
      optionalOneTime: { net: zero, tax: zero, gross: zero },
      byLot: [],
      pricedCount: 1,
      includedCount: 0,
      notOfferedCount: 0,
      missingCount: 1,
    },
    issues: [{ code: 'PRICE_MISSING', severity: 'blocking', pricingItemId: 612, itemCode: 'P-02' }],
    ...overrides,
  };
}

export function declarations(overrides: Partial<BidDeclarations> = {}): BidDeclarations {
  return {
    bidId: 14,
    revisionId: 1401,
    revisionNo: 1,
    revisionStatus: 'draft',
    editable: true,
    legalParty: { tenantId: 4, legalName: 'Tsodilo Engineering (Pty) Ltd' },
    bidValidityDays: 90,
    declarations: [
      {
        declarationType: 'no_conflict',
        required: true,
        accepted: null,
        explanation: null,
        declaredBy: null,
        declaredAt: null,
      },
    ],
    subcontractors: [],
    keyPersonnel: [],
    isConsortium: false,
    leadMemberName: null,
    consortiumMembers: [],
    exceptions: [],
    evidence: [
      {
        evidenceItemId: 41,
        evidenceSubmissionId: 901,
        documentVersionId: 7001,
        title: 'Tax clearance certificate',
        evidenceType: 'certificate',
        issuer: 'BURS',
        fileName: 'tax-clearance.pdf',
        versionNo: 1,
        validFrom: '2025-09-01T00:00:00Z',
        expiresAt: '2026-09-01T00:00:00Z',
        status: 'expired',
        verificationStatus: 'supplier_provided',
        attachedAt: '2026-09-20T08:00:00Z',
        attachedBy: PERSON,
        expiresDuringValidity: false,
      },
    ],
    evidenceOptions: [],
    addenda: [],
    ...overrides,
  };
}

export function revision(overrides: Partial<BidRevision> = {}): BidRevision {
  return {
    id: 1401,
    bidId: 14,
    revisionNo: 1,
    status: 'draft',
    basedOnRevisionId: null,
    basedOnRevisionNo: null,
    contentHash: HASH,
    acknowledgedTenderVersion: 1,
    internallyApprovedAt: null,
    submittedAt: null,
    receiptId: null,
    receiptNo: null,
    createdBy: PERSON,
    createdAt: '2026-09-18T08:00:00Z',
    updatedAt: '2026-09-28T08:00:00Z',
    isEffective: false,
    isWorking: true,
    ...overrides,
  };
}

export function internalReview(overrides: Partial<InternalReview> = {}): InternalReview {
  return {
    bidId: 14,
    revision: revision(),
    readiness: readiness(),
    commercialExposure: {
      visible: true,
      totalOneTime: { amount: '57000.00', currency: 'BWP' },
      recurring: [],
      validityDays: 90,
      exceptionCount: 0,
      deviationCount: 1,
      subcontractedSharePercent: '0',
    },
    requiredApprovals: [{ approvalType: 'executive', state: 'invalidated', approvalId: 3 }],
    approvals: [
      {
        id: 4,
        bidId: 14,
        revisionId: 1401,
        revisionNo: 1,
        approvalType: 'commercial',
        approver: SIGNATORY,
        status: 'pending',
        requestedBy: PERSON,
        requestedAt: '2026-09-29T08:00:00Z',
        contentHashAtDecision: null,
        decidedAt: null,
        note: null,
        invalidatedAt: null,
      },
    ],
    history: [
      {
        id: 3,
        bidId: 14,
        revisionId: 1401,
        revisionNo: 1,
        approvalType: 'executive',
        approver: SIGNATORY,
        status: 'invalidated',
        requestedBy: PERSON,
        requestedAt: '2026-09-25T08:00:00Z',
        contentHashAtDecision: HASH_B,
        decidedAt: '2026-09-26T08:00:00Z',
        note: null,
        invalidatedAt: '2026-09-27T08:00:00Z',
      },
    ],
    materialChangeSinceApproval: true,
    eligibleApprovers: [SIGNATORY],
    viewer: bidDetail().viewer,
    ...overrides,
  };
}

export function submissionPreview(overrides: Partial<SubmissionPreview> = {}): SubmissionPreview {
  return {
    bidId: 14,
    tender: TENDER,
    revision: revision({
      status: 'approved_internally',
      internallyApprovedAt: '2026-09-29T08:00:00Z',
    }),
    legalParty: { tenantId: 4, legalName: 'Tsodilo Engineering (Pty) Ltd' },
    representative: { ...SIGNATORY, capacity: 'Managing Director' },
    lots: [LOT],
    deadline: DEADLINE,
    submissionWindowOpen: true,
    isReplacement: false,
    effectiveOffer: bidDetail().effectiveOffer,
    readiness: readiness({ ready: true, blockingCount: 0, items: [] }),
    finalDeclaration: {
      bidValidityDays: 90,
      tenderVersionNo: 1,
      termsReference: 'KWU general conditions 2026',
      outstandingExceptionCount: 0,
      deviationCount: 1,
    },
    authority: { canSubmit: true, blockReasons: [], authorizedSubmitters: [SIGNATORY] },
    ...overrides,
  };
}

export function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    ...receiptSummary({ id: 44, receiptNo: 'RCPT-2026-000044', revisionId: 1401 }),
    tender: TENDER,
    legalParty: { tenantId: 4, legalName: 'Tsodilo Engineering (Pty) Ltd' },
    submittedBy: { ...SIGNATORY, capacity: 'Managing Director' },
    submitterAuthorityNote: 'Authorized signatory',
    lotsSummary: 'Lot 1: Dosing pumps',
    lots: [LOT],
    tenderVersionNo: 1,
    deadline: DEADLINE,
    inventory: [
      {
        id: 1,
        documentVersionId: 7002,
        fileName: 'technical-proposal.pdf',
        sha256: HASH,
        sizeBytes: 204800,
        envelope: 'technical',
      },
    ],
    roundType: 'initial',
    lateRejection: null,
    ...overrides,
  };
}

export function supplierReceipts(): SupplierReceiptPage {
  return {
    items: [
      {
        ...receiptSummary(),
        tender: TENDER,
        roundType: 'initial',
        lotsSummary: 'Lot 1: Dosing pumps',
      },
      {
        ...receiptSummary({
          id: 22,
          receiptNo: 'RCPT-2026-000022',
          status: 'late_rejected',
          isEffective: false,
        }),
        tender: TENDER,
        roundType: 'initial',
        lotsSummary: 'Lot 1: Dosing pumps',
      },
    ],
    total: 2,
    page: 1,
    pageSize: 25,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Buyer builders
// ---------------------------------------------------------------------------------------------------------

export function monitoringPage(): MonitoringPage {
  return {
    items: [
      {
        tenderId: 2,
        reference: 'T-2026-0002',
        title: 'Smart water meters',
        eventType: 'rfq',
        participation: 'open',
        status: 'open',
        owner: { userId: 5, fullName: 'Tebogo Molefe' },
        deadline: { at: '2026-10-21T10:00:00Z', timeZone: TZ },
        closingStatus: 'open',
        closedAt: null,
        lotCount: 1,
        effectiveSupplierCount: 2,
        receiptCount: 3,
        lastReceiptAt: '2026-09-24T09:00:00Z',
        incidentCount: 1,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 25,
  };
}

export function monitoringDetail(overrides: Partial<MonitoringDetail> = {}): MonitoringDetail {
  const row = monitoringPage().items[0];
  if (row === undefined) throw new Error('fixture');
  return {
    ...row,
    officialTimeZone: TZ,
    lots: [
      {
        lotId: 201,
        lotNo: 1,
        title: 'Meters',
        stage: 'open',
        deadline: row.deadline,
        effectiveSupplierCount: 2,
      },
    ],
    closedBy: null,
    counts: {
      effectiveSuppliers: 2,
      received: 2,
      superseded: 1,
      withdrawn: 0,
      lateRejected: 0,
      selectedForEvaluation: 0,
    },
    receiptsByDay: [{ date: '2026-09-20', count: 2 }],
    incidents: [
      {
        incidentId: 1,
        title: 'Upload service degradation',
        severity: 'high',
        status: 'resolved',
        startedAt: '2026-09-24T08:30:00Z',
        resolvedAt: '2026-09-24T10:00:00Z',
        impactNote: 'Uploads failed for 90 minutes',
        buyerDecisionNote: null,
      },
    ],
    lateAttempts: [],
    canClose: false,
    closeBlockers: ['DEADLINE_NOT_REACHED'],
    ...overrides,
  };
}

export function monitoringReceipts(): MonitoringReceiptPage {
  return {
    items: [
      {
        receiptId: 21,
        receiptNo: 'RCPT-2026-000021',
        bidId: 4,
        supplierTenantId: 9,
        supplierLegalName: 'Gaborone Metering Co. (Pty) Ltd',
        receivedAt: '2026-09-20T08:00:00Z',
        status: 'received',
        documentCount: 5,
        isEffective: true,
        roundType: 'initial',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 25,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Mocked client
// ---------------------------------------------------------------------------------------------------------

export type RouteResult = unknown;
export type Route = (request: Record<string, unknown>) => RouteResult;

export interface RecordedCall {
  readonly id: string;
  readonly request: Record<string, unknown>;
}

/** Routes the mocked `call` by endpoint id; an `ApiError` result is thrown. Unrouted calls answer 404. */
export function routeCalls(routes: Readonly<Record<string, Route>>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.mocked(call).mockImplementation(((endpoint: AnyEndpoint, request: Record<string, unknown>) => {
    calls.push({ id: endpoint.id, request });
    const handler = routes[endpoint.id];
    if (handler === undefined) {
      return Promise.reject(
        new ApiError({
          kind: 'not_found',
          status: 404,
          title: 'Not Found',
          endpointId: endpoint.id,
        }),
      );
    }
    const result = handler(request);
    return result instanceof ApiError ? Promise.reject(result) : Promise.resolve(result);
  }) as unknown as typeof call);
  return calls;
}

export function apiError(
  status: number,
  code: string | null,
  kind: ApiError['kind'] = 'conflict',
  endpointId = 'test',
): ApiError {
  return new ApiError({
    kind,
    status,
    title: 'Request failed',
    code,
    endpointId,
    correlationId: 'corr-1',
  });
}
