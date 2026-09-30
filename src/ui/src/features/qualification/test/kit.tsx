/**
 * Test kit of the qualification screens: contract-valid records (parsed with the contract schemas), sessions with
 * chosen permissions for a buyer or supplier organization, and a router for the mocked `call` of the API client.
 *
 * Each test file mocks the client module itself (hoisted):
 * `vi.mock('../../../../api/client', async (original) => ({ ...(await original<object>()), call: vi.fn() }));`
 */
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { AnyEndpoint } from '@contracts/endpoint';
import type { PermissionCode } from '@contracts/permissions';
import {
  BuyerApplicationDetail,
  BuyerApplicationRow,
  Criterion,
  Decision,
  DecisionDetail,
  EvidenceSnapshot,
  FinancialReviewPanel,
  InfoRequest,
  ProgramDetail,
  ProgramRow,
  QualificationOptions,
  QualificationSummary,
  Screening,
  StatusRow,
  SupplierApplicationDetail,
  SupplierApplicationRow,
  SupplierDecision,
  SupplierDecisionDetail,
  SupplierOverview,
  SupplierProgramDetail,
  SupplierProgramRow,
  Trigger,
} from '@contracts/qualification';

import { ApiError, call } from '../../../api/client';
import { makeTenant, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';

export const ASSESSOR: PermissionCode[] = [
  'dashboard.view',
  'supplier.directory.view',
  'qualification.review',
];
export const FINANCE: PermissionCode[] = [
  'dashboard.view',
  'supplier.directory.view',
  'qualification.financial_review',
];
export const MANAGER: PermissionCode[] = [
  'dashboard.view',
  'supplier.directory.view',
  'qualification.program.manage',
  'qualification.decide',
];
export const SUPPLIER_APPLY: PermissionCode[] = [
  'supplier.qualification.apply',
  'supplier.outcomes.view',
];
export const SUPPLIER_VIEW: PermissionCode[] = ['supplier.outcomes.view'];

export interface RenderPageOptions {
  readonly path: string;
  readonly route: string;
  readonly permissions: readonly PermissionCode[];
  readonly supplier?: boolean;
  readonly state?: unknown;
}

export function renderPage(element: ReactElement, options: RenderPageOptions) {
  const tenant = options.supplier
    ? makeTenant(
        {
          tenantId: 6,
          kind: 'supplier',
          name: 'Makgadikgadi Civil Works',
          slug: 'makgadikgadi',
          capacity: 'Organization Administrator',
        },
        options.permissions,
      )
    : makeTenant({ capacity: 'Qualification Assessor' }, options.permissions);
  const result = renderWithProviders(element, {
    path: options.path,
    route: options.route,
    state: { session: signedInSession({ activeTenant: tenant }) },
    routes: [{ path: '*', element: <p data-testid="elsewhere">elsewhere</p> }],
  });
  if (options.state !== undefined) {
    void result.router.navigate(options.route, { state: options.state, replace: true });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// The mocked client
// ---------------------------------------------------------------------------------------------------------

export interface RecordedCall {
  readonly id: string;
  readonly request: Record<string, unknown>;
}

type Handler = (request: Record<string, unknown>) => unknown;

/** Routes `call(endpoint, request)` by endpoint id; unrouted calls fail with 404. Returns the recorded calls. */
export function routeCalls(handlers: Record<string, Handler>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.mocked(call).mockImplementation(((endpoint: AnyEndpoint, request: Record<string, unknown>) => {
    calls.push({ id: endpoint.id, request });
    const handler = handlers[endpoint.id];
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
    try {
      return Promise.resolve(handler(request));
    } catch (error) {
      return Promise.reject(error);
    }
  }) as typeof call);
  return calls;
}

export function businessError(
  endpointId: string,
  code: string,
  status = 409,
  fieldErrors: { field: string; code: string; message: string }[] = [],
): ApiError {
  return new ApiError({
    kind: status === 422 ? 'validation' : status === 403 ? 'forbidden' : 'conflict',
    status,
    title: 'Request refused',
    code,
    detail: 'Server detail.',
    fieldErrors,
    correlationId: 'corr-1',
    endpointId,
  });
}

export function page<T>(items: readonly T[]) {
  return { items: [...items], total: items.length, page: 1, pageSize: 25 };
}

// ---------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------

export const PUMP = {
  categoryId: 32,
  code: 'WTR-PUMP',
  name: 'Pumps and mechanical equipment',
  parentId: 30,
};
export const PIPE = {
  categoryId: 33,
  code: 'WTR-PIPE',
  name: 'Pipes, valves and fittings',
  parentId: 30,
};
/** A buyer category outside the water infrastructure program (BR-24). */
export const SCADA = {
  categoryId: 12,
  code: 'ICT-SCADA',
  name: 'SCADA and telemetry',
  parentId: null,
};
export const INFRA = {
  categoryId: 30,
  code: 'WTR-INFRA',
  name: 'Water infrastructure',
  parentId: null,
};
export const NEO = { userId: 8, fullName: 'Neo Mothibi' };
export const LESEGO = { userId: 9, fullName: 'Lesego Seretse' };
export const MPHO = { userId: 4, fullName: 'Mpho Dikgang' };
export const MAKGADIKGADI = {
  supplierTenantId: 6,
  name: 'Makgadikgadi Civil Works',
  legalName: 'Makgadikgadi Civil Works (Pty) Ltd',
  slug: 'makgadikgadi',
};
export const CHOBE = {
  supplierTenantId: 5,
  name: 'Chobe Pipe & Valve Supplies',
  legalName: 'Chobe Pipe & Valve Supplies (Pty) Ltd',
  slug: 'chobe-pipe',
};
export const KWU = { buyerTenantId: 2, name: 'Kalahari Water Utilities (Pilot)', slug: 'kwu' };
export const ODC = { buyerTenantId: 3, name: 'Okavango District Council', slug: 'odc' };
const PROGRAM_REF = {
  programId: 11,
  programName: 'Water Infrastructure Suppliers — Category A',
  programVersionId: 112,
  versionNo: 2,
};
const DUE = { at: '2026-10-09T15:00:00Z', timeZone: 'Africa/Gaborone' };
const COMPLETE = {
  criteriaTotal: 13,
  answered: 12,
  mandatoryUnanswered: 0,
  mandatoryEvidenceMissing: 1,
  naWithoutReason: 0,
  expiredEvidence: 0,
};

export function criterion(overrides: Partial<Criterion> = {}): Criterion {
  return Criterion.parse({
    id: 11201,
    programVersionId: 112,
    area: 'quality',
    question: 'ISO 9001 quality management certificate',
    guidance: null,
    responseType: 'document',
    mandatory: true,
    evidenceTypes: ['certificate'],
    requiresNaReason: true,
    thresholdDescription: 'A current certificate',
    sortOrder: 0,
    ...overrides,
  });
}

export function evidence(overrides: Partial<EvidenceSnapshot> = {}): EvidenceSnapshot {
  return EvidenceSnapshot.parse({
    evidenceSubmissionId: 7001,
    evidenceItemId: 601,
    evidenceType: 'financial_statement',
    title: 'Group consolidated management accounts FY2025',
    issuer: 'Makgadikgadi Holdings finance office',
    referenceNumber: null,
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    reportingCurrency: 'BWP',
    isConsolidated: true,
    coverageAmount: null,
    validFrom: null,
    expiresAt: null,
    verificationStatus: 'supplier_provided',
    documentId: 90,
    documentVersionId: 91,
    fileName: 'accounts-2025.pdf',
    submittedAt: '2026-09-02T13:25:00Z',
    expiredSinceSubmission: false,
    replacedSinceSubmission: false,
    ...overrides,
  });
}

export function infoRequest(overrides: Partial<InfoRequest> = {}): InfoRequest {
  return InfoRequest.parse({
    id: 1401,
    applicationId: 503,
    criterionId: 11203,
    criterionQuestion: 'Audited financial statements',
    area: 'financial',
    question: 'Provide audited statements of the applying entity.',
    requestedBy: LESEGO,
    requestedAt: '2026-09-24T09:30:00Z',
    dueAt: { at: '2026-10-07T15:00:00Z', timeZone: 'Africa/Gaborone' },
    status: 'open',
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    responseEvidence: [],
    ...overrides,
  });
}

export function screening(overrides: Partial<Screening> = {}): Screening {
  return Screening.parse({
    id: 951,
    supplier: MAKGADIKGADI,
    checkType: 'sanctions',
    source: 'UN Security Council consolidated list',
    checkedAt: '2026-09-10T08:00:00Z',
    result: 'possible_match',
    matchDetail: 'Similar director name',
    reviewedBy: null,
    reviewedAt: null,
    disposition: null,
    effect: null,
    ...overrides,
  });
}

export function summary(overrides: Partial<QualificationSummary> = {}): QualificationSummary {
  return QualificationSummary.parse({
    byStatus: [
      { status: 'submitted', count: 1 },
      { status: 'under_review', count: 2 },
      { status: 'more_info_required', count: 1 },
      { status: 'decision_pending', count: 1 },
      { status: 'decided', count: 6 },
      { status: 'withdrawn', count: 1 },
    ],
    unassigned: 1,
    overdue: 1,
    highRisk: 1,
    openInfoRequests: 1,
    renewalsInQueue: 1,
    decisionsExpiringIn90Days: 0,
    expiredDecisions: 1,
    openTriggers: 2,
    unreviewedScreeningFlags: 1,
    openReconsiderations: 0,
    asOf: '2026-09-30T06:00:00Z',
    ...overrides,
  });
}

export function options(): QualificationOptions {
  return QualificationOptions.parse({
    categories: [SCADA, INFRA, PUMP, PIPE],
    assessors: [{ ...NEO, capacity: 'Qualification Assessor', openAssignments: 4 }],
    financialReviewers: [{ ...LESEGO, capacity: 'Financial Reviewer', openAssignments: 3 }],
    deciders: [{ ...MPHO, capacity: 'Procurement Manager', openAssignments: 1 }],
    programOwners: [MPHO],
    decisionRoles: [{ code: 'procurement_manager', name: 'Procurement manager' }],
    currencies: ['BWP'],
    officialTimeZone: 'Africa/Gaborone',
  });
}

// ---------------------------------------------------------------------------------------------------------
// Buyer records
// ---------------------------------------------------------------------------------------------------------

export function applicationRow(overrides: Partial<BuyerApplicationRow> = {}): BuyerApplicationRow {
  return BuyerApplicationRow.parse({
    id: 503,
    reference: 'QA-2026-0006',
    supplier: MAKGADIKGADI,
    program: PROGRAM_REF,
    scopeCategory: PUMP,
    scopeMaxValue: { amount: '4000000.00', currency: 'BWP' },
    status: 'more_info_required',
    riskLevel: 'high',
    priority: 'high',
    assessor: NEO,
    financialReviewer: LESEGO,
    submittedAt: '2026-09-02T13:25:00Z',
    dueAt: DUE,
    overdue: false,
    completeness: COMPLETE,
    renewalOfDecisionId: null,
    currentDecisionExpiresInDays: null,
    openInfoRequestCount: 1,
    screeningFlagCount: 0,
    link: '/buyer/qualification/applications/503',
    ...overrides,
  });
}

export function applicationDetail(
  overrides: Partial<BuyerApplicationDetail> = {},
): BuyerApplicationDetail {
  return BuyerApplicationDetail.parse({
    ...applicationRow(),
    submittedBy: { userId: 40, fullName: 'Sethunya Makgadi' },
    scopeGeography: 'Central District',
    requiresIndependentApproval: true,
    programCoveredCategories: [INFRA, PUMP, PIPE],
    items: [
      {
        criterion: criterion(),
        answer: {
          id: 1,
          applicability: 'applicable',
          naReason: null,
          answerText: 'Certification audit booked for November.',
          answerNumber: null,
          answerDate: null,
          answerBool: null,
          updatedBy: null,
          updatedAt: '2026-09-02T13:00:00Z',
        },
        evidence: [],
        evidenceMissing: true,
        finding: null,
        openInfoRequestIds: [],
      },
      {
        criterion: criterion({
          id: 11203,
          area: 'financial',
          question: 'Audited financial statements',
          evidenceTypes: ['financial_statement'],
          thresholdDescription: 'Turnover of at least BWP 5,000,000',
        }),
        answer: null,
        evidence: [evidence()],
        evidenceMissing: false,
        finding: {
          id: 1402,
          criterionId: 11203,
          finding: 'clarification_needed',
          rationale: 'Statements are unaudited group accounts.',
          evidenceRefs: null,
          flagOnly: false,
          assessor: LESEGO,
          recordedAt: '2026-09-24T09:00:00Z',
        },
        openInfoRequestIds: [1401],
      },
    ],
    infoRequests: [infoRequest()],
    generalFindings: [],
    screenings: [screening({ result: 'no_match', matchDetail: null })],
    recommendation: null,
    decisionId: null,
    currentStatus: 'not_assessed',
    financialReviewRecorded: true,
    actions: {
      canAssign: true,
      canRecordFindings: true,
      canRequestInfo: true,
      canViewFinancialReview: false,
      canRecordFinancialReview: false,
      canRecommend: true,
      canDecide: false,
    },
    ...overrides,
  });
}

export function financialPanel(
  overrides: Partial<FinancialReviewPanel> = {},
): FinancialReviewPanel {
  return FinancialReviewPanel.parse({
    applicationId: 503,
    reference: 'QA-2026-0006',
    supplier: MAKGADIKGADI,
    financialReviewer: LESEGO,
    financialCriteria: [
      criterion({ id: 11203, area: 'financial', question: 'Audited financial statements' }),
    ],
    financialEvidence: [evidence()],
    reviews: [
      {
        id: 1303,
        applicationId: 503,
        reviewer: LESEGO,
        financialPeriodEnd: '2025-12-31',
        reportingCurrency: 'BWP',
        isConsolidated: true,
        source: 'Unaudited group-consolidated management accounts FY2025',
        turnover: '18750000.00',
        currentRatio: null,
        debtToEquity: null,
        parentSupportEvidence: null,
        materialQualifications: 'Figures are group-consolidated and unaudited.',
        conclusion: 'unclear',
        rationale: 'Capacity cannot be concluded.',
        reviewedAt: '2026-09-24T09:20:00Z',
      },
    ],
    infoRequests: [infoRequest()],
    canRecord: true,
    ...overrides,
  });
}

const DECISION_BASE = {
  id: 702,
  applicationId: 502,
  applicationReference: 'QA-2026-0003',
  supplier: CHOBE,
  program: PROGRAM_REF,
  outcome: 'qualified_with_conditions',
  effectiveStatus: 'qualified_with_conditions',
  scopeCategory: PIPE,
  scopeMaxValue: { amount: '5000000.00', currency: 'BWP' },
  scopeGeography: 'Botswana',
  effectiveFrom: '2026-05-04',
  effectiveTo: '2028-05-03',
  reassessmentDate: '2026-10-08',
  conditions: 'Supply a renewed public liability insurance certificate before 8 Oct 2026.',
  allowedActivities: 'Receive invitations and submit bids.',
  blockedGate: 'award',
  reasons: 'Insurance expiry handled as a condition.',
  supplierExplanation: 'No award can be made after 8 Oct 2026 until renewed insurance is received.',
  appealRoute: 'Request reconsideration within 14 days.',
  reviewer: NEO,
  approver: MPHO,
  approvalRequestId: null,
  decidedAt: '2026-05-04T08:30:00Z',
  supersededById: null,
  supersedeReason: null,
  supplierNotifiedAt: '2026-05-04T08:35:00Z',
  openReconsideration: false,
  evidenceUpdateCount: 0,
} as const;

export function decision(overrides: Partial<Decision> = {}): Decision {
  return Decision.parse({ ...DECISION_BASE, ...overrides });
}

export function trigger(overrides: Partial<Trigger> = {}): Trigger {
  return Trigger.parse({
    id: 901,
    triggerType: 'evidence_expiry',
    supplier: CHOBE,
    program: PROGRAM_REF,
    decisionId: 702,
    decisionEffectiveStatus: 'qualified_with_conditions',
    sourceType: 'evidence_item',
    sourceId: 501,
    sourceLabel: 'Public liability insurance certificate BIC-PL-25-10931',
    summary: 'Public liability insurance expires on 8 Oct 2026.',
    detectedAt: '2026-09-28T00:10:00Z',
    lapsesOn: '2026-10-08',
    status: 'open',
    assessedBy: null,
    assessedAt: null,
    disposition: null,
    activeBidsReviewed: false,
    activeContractsReviewed: false,
    resultingDecisionId: null,
    taskId: null,
    impactedBids: [
      {
        tenderId: 6,
        reference: 'T-2026-0006',
        title: 'Chlorine dosing equipment',
        tenderStatus: 'open',
        submissionState: 'not_submitted',
        qualificationGate: 'met',
        nextGate: 'Submission deadline',
        link: '/buyer/tenders/6',
      },
      {
        tenderId: 8,
        reference: 'T-2026-0008',
        title: 'Pipeline valves bulk supply',
        tenderStatus: 'closed',
        submissionState: 'submitted',
        qualificationGate: 'met',
        nextGate: 'Opening, evaluation and award',
        link: '/buyer/tenders/8',
      },
    ],
    impactedContracts: [],
    ...overrides,
  });
}

export function decisionDetail(overrides: Partial<DecisionDetail> = {}): DecisionDetail {
  const base = decision();
  return DecisionDetail.parse({
    ...base,
    history: [
      {
        id: base.id,
        outcome: base.outcome,
        effectiveStatus: base.effectiveStatus,
        effectiveFrom: base.effectiveFrom,
        effectiveTo: base.effectiveTo,
        decidedAt: base.decidedAt,
        supersededById: null,
        supersedeReason: null,
        program: base.program,
      },
    ],
    triggers: [trigger()],
    impactedBids: trigger().impactedBids,
    impactedContracts: [],
    expiringEvidence: [
      evidence({
        evidenceType: 'insurance',
        title: 'Public liability insurance certificate',
        periodStart: null,
        periodEnd: null,
        reportingCurrency: null,
        isConsolidated: null,
        expiresAt: '2026-10-08',
      }),
    ],
    programCoveredCategories: [INFRA, PUMP, PIPE],
    reconsideration: null,
    evidenceUpdates: [],
    renewalApplicationId: null,
    renewalRequestedAt: null,
    canSupersede: true,
    ...overrides,
  });
}

export function statusRow(overrides: Partial<StatusRow> = {}): StatusRow {
  return StatusRow.parse({
    supplier: MAKGADIKGADI,
    program: { programId: 11, programName: PROGRAM_REF.programName },
    programCategory: INFRA,
    effectiveStatus: 'not_assessed',
    decisionId: null,
    outcome: null,
    scopeCategory: null,
    scopeMaxValue: null,
    effectiveFrom: null,
    effectiveTo: null,
    reassessmentDate: null,
    conditions: null,
    blockedGate: null,
    expiresInDays: null,
    openTriggerCount: 0,
    applicationInProgress: {
      applicationId: 503,
      reference: 'QA-2026-0006',
      status: 'more_info_required',
    },
    ...overrides,
  });
}

export function programRow(overrides: Partial<ProgramRow> = {}): ProgramRow {
  return ProgramRow.parse({
    id: 11,
    name: PROGRAM_REF.programName,
    status: 'active',
    category: INFRA,
    coveredCategories: [INFRA, PUMP, PIPE],
    geography: 'Botswana',
    maxContractValue: { amount: '10000000.00', currency: 'BWP' },
    validityMonths: 24,
    renewalNoticeDays: 60,
    requiresIndependentApproval: true,
    owner: MPHO,
    currentVersion: {
      id: 112,
      versionNo: 2,
      status: 'approved',
      approvedAt: '2026-03-02T08:00:00Z',
    },
    draftVersionNo: 3,
    criteriaCount: 13,
    openApplicationCount: 4,
    qualifiedSupplierCount: 2,
    updatedAt: '2026-09-20T08:00:00Z',
    ...overrides,
  });
}

export function programDetail(overrides: Partial<ProgramDetail> = {}): ProgramDetail {
  return ProgramDetail.parse({
    ...programRow(),
    description: 'Pumps, pipes and valves.',
    decisionRoleCode: 'procurement_manager',
    decisionRoleName: 'Procurement manager',
    assessors: [NEO],
    financialReviewers: [LESEGO],
    deciders: [MPHO],
    monitoredTriggerTypes: ['evidence_expiry', 'insurance_expired'],
    versions: [
      {
        id: 113,
        programId: 11,
        versionNo: 3,
        status: 'draft',
        changeNote: 'Proposed: ISO 45001.',
        approvedBy: null,
        approvedAt: null,
        createdAt: '2026-09-10T08:00:00Z',
        criteriaCount: 1,
        mandatoryCount: 1,
        applicationCount: 0,
      },
      {
        id: 112,
        programId: 11,
        versionNo: 2,
        status: 'approved',
        changeNote: 'Raised the insurance cover.',
        approvedBy: MPHO,
        approvedAt: '2026-03-02T08:00:00Z',
        createdAt: '2026-02-20T08:00:00Z',
        criteriaCount: 13,
        mandatoryCount: 11,
        applicationCount: 4,
      },
    ],
    shownVersionId: 113,
    criteria: [criterion({ programVersionId: 113 })],
    areaCounts: [{ area: 'quality', criteria: 1, mandatory: 1 }],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Supplier records
// ---------------------------------------------------------------------------------------------------------

export function supplierOverview(overrides: Partial<SupplierOverview> = {}): SupplierOverview {
  return SupplierOverview.parse({
    supplier: MAKGADIKGADI,
    registrationStatus: 'active',
    verificationStatus: 'contact_verified',
    statuses: [
      {
        buyer: KWU,
        program: { programId: 11, programName: PROGRAM_REF.programName },
        programCategory: INFRA,
        coveredCategories: [INFRA, PUMP, PIPE],
        effectiveStatus: 'not_assessed',
        decisionId: null,
        scopeCategory: null,
        scopeMaxValue: null,
        effectiveTo: null,
        blockedGate: null,
        applicationInProgress: {
          applicationId: 503,
          reference: 'QA-2026-0006',
          status: 'more_info_required',
        },
      },
    ],
    openInfoRequests: 1,
    expiringEvidence: [],
    ...overrides,
  });
}

export function supplierApplicationRow(
  overrides: Partial<SupplierApplicationRow> = {},
): SupplierApplicationRow {
  return SupplierApplicationRow.parse({
    id: 503,
    reference: 'QA-2026-0006',
    buyer: KWU,
    program: PROGRAM_REF,
    scopeCategory: PUMP,
    scopeMaxValue: { amount: '4000000.00', currency: 'BWP' },
    status: 'more_info_required',
    submittedAt: '2026-09-02T13:25:00Z',
    updatedAt: '2026-09-26T11:45:00Z',
    completeness: COMPLETE,
    openInfoRequestCount: 1,
    nextDueAt: { at: '2026-10-07T15:00:00Z', timeZone: 'Africa/Gaborone' },
    renewalOfDecisionId: null,
    decisionId: null,
    link: '/supplier/qualification/applications/503',
    ...overrides,
  });
}

export function supplierApplication(
  overrides: Partial<SupplierApplicationDetail> = {},
): SupplierApplicationDetail {
  return SupplierApplicationDetail.parse({
    ...supplierApplicationRow({
      id: 511,
      reference: null,
      status: 'draft',
      submittedAt: null,
      openInfoRequestCount: 0,
      nextDueAt: null,
      link: '/supplier/qualification/applications/511',
    }),
    scopeGeography: 'Botswana',
    submittedBy: null,
    items: [
      {
        criterion: criterion(),
        answer: null,
        evidence: [],
        evidenceMissing: true,
        openInfoRequestIds: [],
      },
      {
        criterion: criterion({
          id: 11210,
          area: 'insurance',
          question: 'Professional indemnity insurance',
          mandatory: false,
          evidenceTypes: ['insurance'],
        }),
        answer: null,
        evidence: [],
        evidenceMissing: false,
        openInfoRequestIds: [],
      },
    ],
    infoRequests: [],
    withdrawnReason: null,
    canEdit: true,
    canSubmit: true,
    canWithdraw: true,
    ...overrides,
  });
}

export function supplierProgramRow(
  overrides: Partial<SupplierProgramRow> = {},
): SupplierProgramRow {
  return SupplierProgramRow.parse({
    id: 11,
    buyer: KWU,
    name: PROGRAM_REF.programName,
    description: 'Pumps, pipes and valves.',
    category: INFRA,
    coveredCategories: [INFRA, PUMP, PIPE],
    geography: 'Botswana',
    maxContractValue: { amount: '10000000.00', currency: 'BWP' },
    validityMonths: 24,
    currentVersion: { programVersionId: 112, versionNo: 2, approvedAt: '2026-03-02T08:00:00Z' },
    criteriaCount: 13,
    areaCounts: [{ area: 'quality', criteria: 2, mandatory: 2 }],
    myStatus: 'not_assessed',
    myApplicationInProgress: null,
    ...overrides,
  });
}

export function supplierProgram(
  overrides: Partial<SupplierProgramDetail> = {},
): SupplierProgramDetail {
  return SupplierProgramDetail.parse({
    ...supplierProgramRow(),
    criteria: [criterion()],
    renewalNoticeDays: 60,
    requiresIndependentApproval: true,
    ...overrides,
  });
}

export function supplierDecision(overrides: Partial<SupplierDecision> = {}): SupplierDecision {
  return SupplierDecision.parse({
    id: 702,
    buyer: KWU,
    applicationId: 502,
    applicationReference: 'QA-2026-0003',
    program: PROGRAM_REF,
    outcome: 'qualified_with_conditions',
    effectiveStatus: 'qualified_with_conditions',
    scopeCategory: PIPE,
    scopeMaxValue: { amount: '5000000.00', currency: 'BWP' },
    scopeGeography: 'Botswana',
    effectiveFrom: '2026-05-04',
    effectiveTo: '2028-05-03',
    reassessmentDate: '2026-10-08',
    renewalDueFrom: '2028-03-04',
    conditions: 'Supply a renewed public liability insurance certificate.',
    allowedActivities: 'Receive invitations and submit bids.',
    blockedGate: 'award',
    supplierExplanation: 'No award after 8 Oct 2026 until renewed insurance is received.',
    appealRoute: 'Request reconsideration within 14 days.',
    decidedAt: '2026-05-04T08:30:00Z',
    reconsiderationDeadline: { at: '2026-05-18T08:30:00Z', timeZone: 'Africa/Gaborone' },
    supersededById: null,
    current: true,
    ...overrides,
  });
}

export function supplierDecisionDetail(
  overrides: Partial<SupplierDecisionDetail> = {},
): SupplierDecisionDetail {
  const base = supplierDecision();
  return SupplierDecisionDetail.parse({
    ...base,
    history: [
      {
        id: base.id,
        outcome: base.outcome,
        effectiveStatus: base.effectiveStatus,
        effectiveFrom: base.effectiveFrom,
        effectiveTo: base.effectiveTo,
        decidedAt: base.decidedAt,
        supersededById: null,
      },
    ],
    expiringEvidence: [
      evidence({
        evidenceType: 'insurance',
        title: 'Public liability insurance certificate',
        periodStart: null,
        periodEnd: null,
        reportingCurrency: null,
        isConsolidated: null,
        expiresAt: '2026-10-08',
      }),
    ],
    evidenceUpdates: [],
    reconsideration: null,
    renewalApplicationId: null,
    renewalRequestedAt: null,
    canRequestReconsideration: true,
    canSupplyEvidence: true,
    canRenew: false,
    ...overrides,
  });
}

export const CANDIDATES = {
  items: [
    {
      evidenceItemId: 777,
      evidenceType: 'certificate',
      title: 'ISO 9001 certificate',
      issuer: 'SGS',
      periodEnd: null,
      expiresAt: '2029-11-30',
      status: 'current',
      verificationStatus: 'supplier_provided',
      criterionIds: [11201],
      expiringSoon: false,
    },
    {
      evidenceItemId: 778,
      evidenceType: 'insurance',
      title: 'Renewed public liability insurance 2026/27',
      issuer: 'Botswana Insurance Company',
      periodEnd: null,
      expiresAt: '2027-10-08',
      status: 'current',
      verificationStatus: 'supplier_provided',
      criterionIds: [11210],
      expiringSoon: false,
    },
  ],
};
