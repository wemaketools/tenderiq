/**
 * Contract-valid evaluation responses for the SPA tests of this feature (test data only; the application's data comes
 * from the API). The values follow the PRD §9.2 worked example so the tests read like the acceptance scenarios.
 */
import type {
  Assessment,
  AssignmentDetail,
  AssignmentPage,
  AssignmentRow,
  CommercialComparison,
  CommercialRow,
  EvaluationBidRef,
  EvaluationOverview,
  EvaluationPlan,
  EvaluationSummaryRow,
  EvaluationTenderRef,
  ModerationCell,
  ModerationView,
  RankingView,
  ResultRow,
  ScoreCell,
} from '@contracts/evaluation';

const CHAIR = { userId: 10, fullName: 'Boitumelo Kgari' };
const THATO = { userId: 11, fullName: 'Thato Mokgosi' };
const KABO = { userId: 12, fullName: 'Kabo Ntsima' };
const AMANTLE = { userId: 13, fullName: 'Amantle Segwai' };

export function tenderRef(overrides: Partial<EvaluationTenderRef> = {}): EvaluationTenderRef {
  return {
    tenderId: 3,
    reference: 'T-2026-0003',
    title: 'SCADA telemetry upgrade',
    status: 'under_assessment',
    officialTimeZone: 'Africa/Gaborone',
    openingMode: 'staged',
    awardModel: 'single',
    maxLotsPerSupplier: null,
    independentEvaluation: true,
    anonymizedEvaluation: false,
    anonymizationLimitations: null,
    ...overrides,
  };
}

export function bidRef(which: 'A' | 'B'): EvaluationBidRef {
  return which === 'A'
    ? {
        bidId: 3001,
        supplierTenantId: 7,
        supplierName: 'Serowe ICT Solutions',
        label: 'Supplier A',
        receiptNo: 'RCPT-2026-000301',
        receivedAt: '2026-09-04T15:10:02Z',
        revisionId: 30011,
        complianceStatus: 'compliant',
        evaluationStatus: 'in_evaluation',
      }
    : {
        bidId: 3002,
        supplierTenantId: 4,
        supplierName: 'Tsodilo Engineering',
        label: 'Supplier B',
        receiptNo: 'RCPT-2026-000302',
        receivedAt: '2026-09-07T07:58:44Z',
        revisionId: 30021,
        complianceStatus: 'compliant',
        evaluationStatus: 'in_evaluation',
      };
}

export function plan(): EvaluationPlan {
  const criterion = (
    id: number,
    code: string,
    name: string,
    maxPoints: string,
    isPrice = false,
  ) => ({
    criterionId: id,
    parentId: null,
    code,
    name,
    description: null,
    maxPoints,
    isPrice,
    minScore: null,
    scoringGuidance: isPrice ? null : `Guide for ${name}.`,
    envelope: isPrice ? ('commercial' as const) : ('technical' as const),
    naPermitted: false,
    sortOrder: id - 300,
  });
  return {
    planId: 30,
    version: 1,
    status: 'approved',
    scaleMax: 5,
    aggregationMethod: 'consensus',
    priceMethod: 'lowest_ratio',
    priceWeight: '30',
    priceFormulaNote: 'Lowest evaluated cost ÷ this offer × 30.',
    zeroPriceTreatment: null,
    missingPriceTreatment: null,
    thresholdScope: 'non_price_total',
    nonPriceThreshold: '42',
    decimalPlacesCalc: 4,
    decimalPlacesDisplay: 2,
    comparisonCurrency: 'BWP',
    fxSource: 'Bank of Botswana mid-rate',
    fxDate: '2026-09-07',
    approvedAt: '2026-07-28T08:30:00Z',
    criteria: [
      criterion(301, 'C1', 'Solution quality', '35'),
      criterion(302, 'C2', 'Delivery approach', '20'),
      criterion(303, 'C3', 'Relevant experience', '15'),
      criterion(304, 'C4', 'Price', '30', true),
    ],
    scaleAnchors: [0, 1, 2, 3, 4, 5].map((value) => ({
      value,
      label: ['No response', 'Poor', 'Weak', 'Meets', 'Good', 'Excellent'][value] ?? 'Rating',
      description: `Anchor ${value}.`,
    })),
    tieBreakRules: [{ sequence: 1, rule: 'highest_non_price', criterionId: null }],
  };
}

const GATE_RELEASED = {
  applies: true,
  released: true,
  releasedAt: '2026-09-24T12:00:00Z',
  releasedBy: CHAIR,
  nonPriceCompleteConfirmed: true,
  note: null,
};

const GATE_CLOSED = {
  applies: true,
  released: false,
  releasedAt: null,
  releasedBy: null,
  nonPriceCompleteConfirmed: null,
  note: null,
};

export function summaryRow(overrides: Partial<EvaluationSummaryRow> = {}): EvaluationSummaryRow {
  return {
    tender: tenderRef(),
    lot: null,
    stage: 'ranking',
    chair: CHAIR,
    myRole: 'chair',
    myNextAction: 'validate_ranking',
    bidCount: 3,
    progress: {
      total: 5,
      accepted: 5,
      submitted: 2,
      incomplete: 3,
      overdue: 2,
      conflictsPendingReview: 1,
    },
    nextDueAt: { at: '2026-09-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
    priceGate: GATE_RELEASED,
    moderationStatus: 'finalized',
    commercialStatus: 'draft',
    reportStatus: 'draft',
    ...overrides,
  };
}

export function overview(): EvaluationOverview {
  return {
    ...summaryRow(),
    plan: plan(),
    bids: [bidRef('A'), bidRef('B')],
    committee: [
      {
        assignmentId: 3001,
        evaluator: { ...THATO, capacity: 'Evaluator, Technical Services' },
        isCommercial: false,
        status: 'submitted',
        dueAt: { at: '2026-09-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
        scored: 6,
        total: 6,
        conflictDisposition: null,
      },
      {
        assignmentId: 3003,
        evaluator: { ...AMANTLE, capacity: 'Evaluator, Water Quality' },
        isCommercial: false,
        status: 'in_progress',
        dueAt: { at: '2026-09-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
        scored: 5,
        total: 6,
        conflictDisposition: null,
      },
    ],
    timeline: [
      {
        at: '2026-09-07T10:00:00Z',
        title: 'Submission deadline passed',
        actor: null,
        detail: '3 submissions.',
      },
    ],
    detailLevel: 'full',
  };
}

export function assignmentRow(overrides: Partial<AssignmentRow> = {}): AssignmentRow {
  return {
    assignmentId: 3003,
    tender: tenderRef(),
    lot: null,
    evaluator: { ...AMANTLE, capacity: 'Evaluator, Water Quality' },
    bidId: null,
    bidCount: 2,
    criterionIds: [],
    criterionCount: 3,
    isCommercial: false,
    dueAt: { at: '2026-09-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
    isOverdue: true,
    status: 'in_progress',
    acceptedAt: '2026-09-11T08:00:00Z',
    submittedAt: null,
    declarations: {
      undertakingAccepted: true,
      conflictDeclared: true,
      hasConflict: false,
      conflictDisposition: null,
    },
    completion: { scored: 5, total: 6, notScored: 1, complete: false },
    nextAction: 'score',
    ...overrides,
  };
}

export function assignmentPage(rows: AssignmentRow[]): AssignmentPage {
  return {
    items: rows,
    total: rows.length,
    page: 1,
    pageSize: 25,
    summary: {
      total: rows.length,
      notStarted: rows.filter((row) => row.status === 'not_started').length,
      inProgress: rows.filter((row) => row.status === 'in_progress').length,
      submitted: rows.filter((row) => row.status === 'submitted').length,
      returned: 0,
      overdue: rows.filter((row) => row.isOverdue).length,
      declarationsPending: rows.filter((row) => !row.declarations.undertakingAccepted).length,
    },
  };
}

export function assignmentDetail(overrides: Partial<AssignmentDetail> = {}): AssignmentDetail {
  const technical = plan().criteria.filter((criterion) => !criterion.isPrice);
  return {
    ...assignmentRow(),
    undertakingText: {
      textVersion: 'KWU-EVAL-CU-2026.1',
      title: 'Evaluation confidentiality undertaking',
      text: 'I will keep every response and score confidential.',
    },
    confidentialityUndertaking: {
      undertakingId: 30031,
      textVersion: 'KWU-EVAL-CU-2026.1',
      acceptedAt: '2026-09-11T08:00:00Z',
    },
    conflictDeclaration: {
      declarationId: 30032,
      subjectType: 'tender',
      subjectId: 3,
      hasConflict: false,
      nature: null,
      supplierTenantId: null,
      supplierName: null,
      details: null,
      declaredAt: '2026-09-11T08:00:00Z',
      disposition: 'cleared',
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    },
    contentAccess: { allowed: true, blockedReason: null },
    bids: [bidRef('A'), bidRef('B')],
    criteria: technical,
    chair: CHAIR,
    reassignedTo: null,
    reassignmentReason: null,
    returnReason: null,
    reassignmentRequestedAt: null,
    history: [{ at: '2026-09-10T09:30:00Z', event: 'Assigned', actor: CHAIR, note: null }],
    isOwn: true,
    ...overrides,
  };
}

function cell(bidId: number, criterionId: number, score: string | null): ScoreCell {
  return {
    scoreId: score === null ? null : bidId * 100 + criterionId,
    bidId,
    criterionId,
    score,
    weightedPoints: null,
    isNotApplicable: false,
    rationale: score === null ? null : 'Evidence reviewed.',
    evidenceRefs: [],
    clarificationNeeded: false,
    clarificationQuestion: null,
    status: 'draft',
    submittedAt: null,
    version: 1,
    corrections: [],
  };
}

export function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    assignmentId: 3003,
    tender: tenderRef(),
    lot: null,
    evaluator: AMANTLE,
    status: 'in_progress',
    dueAt: { at: '2026-09-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
    submittedAt: null,
    returnReason: null,
    readOnly: false,
    plan: plan(),
    criterionIds: [301, 302, 303],
    bids: [
      {
        ...bidRef('A'),
        responses: [
          {
            criterionId: 301,
            requirements: [
              {
                requirementId: 3011,
                refCode: 'REQ-T-01',
                requirementText: 'Describe the telemetry architecture.',
                answerText: 'Dual-path licensed UHF radio.',
                isDeviation: false,
                documents: [
                  { documentId: 73101, title: 'Technical proposal', fileName: 'proposal.pdf' },
                ],
              },
            ],
          },
        ],
      },
      { ...bidRef('B'), responses: [] },
    ],
    scores: [
      cell(3001, 301, '4'),
      cell(3001, 302, '4'),
      cell(3001, 303, null),
      cell(3002, 301, '4'),
      cell(3002, 302, '4'),
      cell(3002, 303, '4'),
    ],
    completion: {
      scored: 5,
      total: 6,
      complete: false,
      missing: [{ bidId: 3001, criterionId: 303 }],
    },
    priceGate: GATE_RELEASED,
    correctionsOpen: true,
    peerScores: { visibility: 'hidden_until_own_submission', items: [] },
    ...overrides,
  };
}

function commercialRow(which: 'A' | 'B'): CommercialRow {
  const a = which === 'A';
  return {
    commercialEvaluationId: a ? 3601 : 3602,
    bid: bidRef(which),
    revisionId: a ? 30011 : 30021,
    submittedTotal: a
      ? { amount: '99550.00', currency: 'BWP' }
      : { amount: '160000.00', currency: 'ZAR' },
    arithmeticCorrection: a ? { amount: '450.00', currency: 'BWP' } : null,
    correctedTotal: a
      ? { amount: '100000.00', currency: 'BWP' }
      : { amount: '160000.00', currency: 'ZAR' },
    correctionRule: a ? 'Unit rate × quantity prevails.' : null,
    correctionStatus: a ? 'approved' : 'none',
    correctionProposedBy: a ? { userId: 9, fullName: 'Lesego Seretse' } : null,
    correctionProposedAt: a ? '2026-09-25T10:30:00Z' : null,
    correctionApprovedBy: a ? { userId: 14, fullName: 'Refilwe Motsumi' } : null,
    supplierAckAt: null,
    fx: a
      ? null
      : {
          fromCurrency: 'ZAR',
          toCurrency: 'BWP',
          rate: '0.75',
          source: 'Bank of Botswana mid-rate',
          rateDate: '2026-09-07',
        },
    evaluatedCost: a
      ? { amount: '100000.00', currency: 'BWP' }
      : { amount: '120000.00', currency: 'BWP' },
    costComponents: [
      {
        label: 'Hardware (one-time)',
        amount: { amount: a ? '100000.00' : '120000.00', currency: 'BWP' },
        includedInEvaluation: true,
        note: null,
      },
    ],
    excludedItemsNote: null,
    assumptions: a ? null : 'Prices fixed in ZAR for the validity period.',
    abnormallyLowFlag: false,
    abnormallyLowOutcome: null,
    abnormallyLowReview: null,
    inReferenceSet: true,
    referenceExclusionReason: null,
    priceScore: a ? '30.0000' : '25.0000',
    priceScoreDisplay: a ? '30.00' : '25.00',
    affordability: a ? 'within_budget' : 'exceeds_budget',
    status: 'draft',
  };
}

export function commercial(overrides: Partial<CommercialComparison> = {}): CommercialComparison {
  return {
    tender: tenderRef(),
    lot: null,
    plan: plan(),
    priceGate: GATE_RELEASED,
    status: 'draft',
    reviewer: { userId: 14, fullName: 'Refilwe Motsumi' },
    taxTreatment: 'VAT excluded.',
    basisNote: 'One-time items + support × 2 years.',
    budget: { amount: '115000.00', currency: 'BWP' },
    lowestEvaluatedCost: { amount: '100000.00', currency: 'BWP' },
    rows: [commercialRow('A'), commercialRow('B')],
    sealedBids: [],
    readiness: [
      {
        id: 'affordability-3002',
        status: 'warning',
        label: 'Supplier B exceeds the budget',
        detail: 'Affordability is decided separately from rank.',
      },
    ],
    approvedAt: null,
    approvedBy: null,
    ...overrides,
  };
}

export function closedCommercial(): CommercialComparison {
  return commercial({
    priceGate: GATE_CLOSED,
    status: 'not_started',
    rows: [],
    lowestEvaluatedCost: null,
  });
}

export function moderationCell(): ModerationCell {
  const individual = (
    assignmentId: number,
    evaluator: typeof THATO,
    score: string | null,
    submitted = true,
  ) => ({
    assignmentId,
    evaluator,
    submitted,
    score,
    isNotApplicable: false,
    notScored: submitted && score === null,
    status: submitted ? ('submitted' as const) : ('draft' as const),
    rationale: score === null ? null : `Rationale of ${evaluator.fullName}.`,
    evidenceRefs: [],
    clarificationNeeded: false,
    correctedAfterSubmission: false,
  });
  return {
    bidId: 3001,
    criterionId: 301,
    individual: [
      individual(3001, THATO, '4'),
      individual(3002, KABO, '3'),
      individual(3003, AMANTLE, null, false),
    ],
    spread: '1',
    divergent: true,
    average: null,
    outstanding: 1,
    current: {
      moderatedScoreId: 35007,
      finalScore: '4',
      weightedPoints: '28.0000',
      method: 'consensus',
      reasons: 'Committee agreed 4 after reviewing drawing rev C.',
      moderatedBy: CHAIR,
      recordedAt: '2026-09-23T10:20:00Z',
      supersededById: null,
      differsFromIndividual: true,
    },
    history: [
      {
        moderatedScoreId: 35001,
        finalScore: '3.5',
        weightedPoints: '24.5000',
        method: 'consensus',
        reasons: 'Provisional midpoint before discussion.',
        moderatedBy: CHAIR,
        recordedAt: '2026-09-23T08:10:00Z',
        supersededById: 35007,
        differsFromIndividual: true,
      },
    ],
  };
}

export function moderation(overrides: Partial<ModerationView> = {}): ModerationView {
  return {
    tender: tenderRef(),
    lot: null,
    plan: plan(),
    session: {
      sessionId: 3501,
      method: 'consensus',
      status: 'open',
      chair: CHAIR,
      notes: 'Meeting 22 September.',
      createdAt: '2026-09-22T07:00:00Z',
      finalizedAt: null,
    },
    divergenceThreshold: '1',
    bids: [bidRef('A')],
    criterionIds: [301],
    assessors: [
      {
        assignmentId: 3001,
        evaluator: THATO,
        status: 'submitted',
        submittedAt: '2026-09-17T14:20:00Z',
        scored: 1,
        total: 1,
      },
      {
        assignmentId: 3003,
        evaluator: AMANTLE,
        status: 'in_progress',
        submittedAt: null,
        scored: 0,
        total: 1,
      },
    ],
    cells: [moderationCell()],
    priceGate: GATE_CLOSED,
    readiness: [
      {
        id: 'assessor-3003',
        status: 'blocking',
        label: 'Amantle Segwai: 1 cell not scored',
        detail: 'Never counted as zero.',
      },
    ],
    ...overrides,
  };
}

function result(which: 'A' | 'B'): ResultRow {
  const a = which === 'A';
  const points = (criterionId: number, rating: string | null, value: string) => ({
    criterionId,
    rating,
    points: `${value}00`,
    pointsDisplay: value,
    source: rating === null ? ('price_formula' as const) : ('moderated' as const),
  });
  return {
    resultId: a ? 3701 : 3702,
    bid: bidRef(which),
    criterionPoints: a
      ? [
          points(301, '4', '28.00'),
          points(302, '4', '16.00'),
          points(303, '4', '12.00'),
          points(304, null, '30.00'),
        ]
      : [
          points(301, '4.5', '31.50'),
          points(302, '4.5', '18.00'),
          points(303, '4.5', '13.50'),
          points(304, null, '25.00'),
        ],
    nonPriceScore: a ? '56.0000' : '63.0000',
    priceScore: a ? '30.0000' : '25.0000',
    totalScore: a ? '86.0000' : '88.0000',
    totalScoreDisplay: a ? '86.00' : '88.00',
    passesGates: true,
    gateFailures: [],
    rank: a ? 2 : 1,
    tieBreakApplied: null,
    evaluatedCost: { amount: a ? '100000.00' : '120000.00', currency: 'BWP' },
    affordability: a ? 'within_budget' : 'exceeds_budget',
    explanation: a
      ? 'Lowest evaluated cost earns 30.00 price points.'
      : 'Higher quality outweighs the price.',
    status: 'draft',
  };
}

export function ranking(overrides: Partial<RankingView> = {}): RankingView {
  const signer = (person: typeof THATO, capacity: string) => ({
    signoffId: null,
    signer: { ...person, capacity },
    decision: null,
    note: null,
    decidedAt: null,
  });
  return {
    tender: tenderRef(),
    lot: null,
    plan: plan(),
    status: 'draft',
    detail: 'full',
    computedAt: '2026-09-29T08:00:00Z',
    results: [result('A'), result('B')],
    lotConstraints: { note: 'Single award for the whole tender.' },
    budget: { amount: '115000.00', currency: 'BWP' },
    readiness: [
      {
        id: 'assessment-3003',
        status: 'blocking',
        label: 'Individual assessment incomplete: Amantle Segwai',
        detail: 'Not scored: Relevant experience for Supplier A.',
      },
      {
        id: 'affordability',
        status: 'warning',
        label: 'The top-ranked offer exceeds the budget',
        detail: null,
      },
    ],
    report: {
      reportId: 3801,
      version: 1,
      status: 'draft',
      summary: null,
      documentId: null,
      createdAt: '2026-09-29T08:05:00Z',
      createdBy: CHAIR,
      submittedForSignoffAt: null,
      signedOffAt: null,
      handedOffAt: null,
      signoffs: [signer(CHAIR, 'Evaluation Chair'), signer(THATO, 'Evaluator, Technical Services')],
    },
    reportHistory: [],
    ...overrides,
  };
}
