/**
 * Awards fixtures, part 2: award recommendations and lot outcomes (BUY-26; FR-17, BR-31, BR-33; AC-24, AC-26).
 *
 * - T-2026-0001: v1 returned (funding confirmation missing) and then superseded, v2 approved for lots 1 and 2. Lot 1 is final-awarded
 *   to Tsodilo, lot 2 is cancelled, lot 3 is still under evaluation (no outcome) → tender `partially_awarded`.
 * - T-2026-0003: v1 draft; the evaluation is not signed off (one evaluator is missing a criterion, AC-18).
 * - T-2026-0007: v1 approved; the lot outcome is `intent_notified` and final award is blocked by the complaint hold.
 * - T-2026-0009: v1 awaiting approval; it proposes the fallback bidder after the preferred bidder failed due
 *   diligence, and approval stays blocked while an award-blocking diligence finding is open (AC-24).
 * - T-2026-0010: v1 approved, final-awarded; contract C-2026-0001 carries the whole value.
 *
 * Ids shared with the contracts fixtures: lot outcomes 14011, 14012 (T-2026-0001) and 14021 (T-2026-0010);
 * recommendations 14902 (T-2026-0001 v2) and 14901 (T-2026-0010).
 *
 * Approval request ids are linked only where the approvals fixtures hold the request: 35 (award of T-2026-0001)
 * and 38 (award of T-2026-0007). The other award and final-award approvals are reported to the approvals owner;
 * until they exist the approval block carries its status and approver without a request id.
 *
 * Every reconciliation labels its value by basis (recommended, approved, intended, final awarded): a proposed or
 * intended value is never presented as an award (BR-31).
 */
import type {
  AwardReconciliation,
  LotOutcome,
  RecommendationApproval,
  RecommendationDetail,
} from '../../../contracts/awards.js';
import { TENANT_IDS } from '../platform.js';
import { USERS, awardTender, bwp, lotRef, person, supplier } from './base.js';

export interface RecommendationFixture {
  readonly tenantId: number;
  readonly detail: RecommendationDetail;
}

const NO_APPROVAL: RecommendationApproval = {
  approvalRequestId: null,
  status: null,
  approver: null,
  decidedAt: null,
  conditions: null,
  rationale: null,
};

// ---------------------------------------------------------------------------------------------------------
// Lot outcomes
// ---------------------------------------------------------------------------------------------------------

/** Every lot outcome, by id. */
export const LOT_OUTCOMES: readonly (LotOutcome & { readonly tenantId: number; readonly tenderId: number })[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 1,
    lotOutcomeId: 14011,
    recommendationId: 14902,
    lot: lotRef(101),
    outcome: 'award',
    supplier: supplier('tsodilo'),
    bidId: 104,
    awardedValue: bwp('5340000.00'),
    conditions: 'Performance bond of 10% before the notice to proceed.',
    reason: 'Highest-ranked compliant offer (84.70 points) within the approved lot 1 budget.',
    status: 'final_awarded',
    finalAwardedAt: '2026-09-04T09:00:00Z',
    finalAwardApprovalId: null,
    finalAwardApprovedBy: person(USERS.keabetswe),
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 1,
    lotOutcomeId: 14012,
    recommendationId: 14902,
    lot: lotRef(102),
    outcome: 'cancelled',
    supplier: null,
    bidId: null,
    awardedValue: null,
    conditions: null,
    reason:
      'No compliant bid was received: both lot 2 offers failed mandatory requirement REQ-T-02 (solar array sizing for each site). A re-tender is planned for Q1 2027.',
    status: 'approved',
    finalAwardedAt: null,
    finalAwardApprovalId: null,
    finalAwardApprovedBy: null,
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 3,
    lotOutcomeId: 131,
    recommendationId: 13,
    lot: lotRef(301),
    outcome: 'award',
    supplier: supplier('tsodilo'),
    bidId: 304,
    awardedValue: bwp('120000.00'),
    conditions: null,
    reason: 'Highest weighted result (88.00 points) under the published 70/30 quality-price model.',
    status: 'recommended',
    finalAwardedAt: null,
    finalAwardApprovalId: null,
    finalAwardApprovedBy: null,
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 7,
    lotOutcomeId: 141,
    recommendationId: 14,
    lot: lotRef(701),
    outcome: 'award',
    supplier: supplier('makgadikgadi'),
    bidId: 706,
    awardedValue: bwp('7850000.00'),
    conditions: null,
    reason: 'Highest-ranked compliant offer (83.60 points); price within the approved budget.',
    status: 'intent_notified',
    finalAwardedAt: null,
    finalAwardApprovalId: null,
    finalAwardApprovedBy: null,
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 9,
    lotOutcomeId: 151,
    recommendationId: 15,
    lot: lotRef(901),
    outcome: 'conditional_award',
    supplier: supplier('limpopo-env'),
    bidId: 908,
    awardedValue: bwp('2940000.00'),
    conditions:
      'Satisfactory completion of due diligence on professional indemnity insurance and the proposed lead acoustic engineer before any award notice.',
    reason: 'Fallback to the second-ranked bidder under the approved process decision after the preferred bidder failed due diligence.',
    status: 'recommended',
    finalAwardedAt: null,
    finalAwardApprovalId: null,
    finalAwardApprovedBy: null,
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 10,
    lotOutcomeId: 14021,
    recommendationId: 14901,
    lot: lotRef(1001),
    outcome: 'award',
    supplier: supplier('tsodilo'),
    bidId: 1004,
    awardedValue: bwp('1850000.00'),
    conditions: null,
    reason: 'Highest-ranked compliant quotation (88.19 points) for the twelve-month maintenance term (with renewal and extension options).',
    status: 'final_awarded',
    finalAwardedAt: '2026-03-06T10:00:00Z',
    finalAwardApprovalId: null,
    finalAwardApprovedBy: person(USERS.keabetswe),
  },
]);

function outcomesOf(recommendationId: number): LotOutcome[] {
  return LOT_OUTCOMES.filter((row) => row.recommendationId === recommendationId).map(
    ({ tenantId: _tenantId, tenderId: _tenderId, ...row }) => row,
  );
}

/** A lot outcome of a superseded recommendation version: same proposal, status `withdrawn`. */
function supersededCopy(sourceId: number, lotOutcomeId: number, recommendationId: number): LotOutcome {
  const source = LOT_OUTCOMES.find((row) => row.lotOutcomeId === sourceId);
  if (source === undefined) {
    throw new Error(`No lot outcome fixture ${sourceId}.`);
  }
  const { tenantId: _tenantId, tenderId: _tenderId, ...row } = source;
  return {
    ...row,
    lotOutcomeId,
    recommendationId,
    status: 'withdrawn',
    finalAwardedAt: null,
    finalAwardApprovalId: null,
    finalAwardApprovedBy: null,
  };
}

function outcomesOfTender(tenderId: number): LotOutcome[] {
  return LOT_OUTCOMES.filter((row) => row.tenderId === tenderId).map(({ tenantId: _tenantId, tenderId: _tenderId, ...row }) => row);
}

// ---------------------------------------------------------------------------------------------------------
// Reconciliation (BR-33)
// ---------------------------------------------------------------------------------------------------------

/** Reconciliation of T-2026-0001 (lots 1 and 2 decided; lot 3 still open). */
export const RECONCILIATION_T1: AwardReconciliation = {
  currency: 'BWP',
  value: { basis: 'final_awarded', total: bwp('5340000.00'), finalAwardedTotal: bwp('5340000.00') },
  lotTotals: [
    { lotId: 101, lotNo: 1, outcome: 'award', status: 'final_awarded', awardedValue: bwp('5340000.00') },
    { lotId: 102, lotNo: 2, outcome: 'cancelled', status: 'approved', awardedValue: null },
    { lotId: 103, lotNo: 3, outcome: null, status: null, awardedValue: null },
  ],
  contractAllocations: [
    { contractId: 2, contractReference: 'C-2026-0002', contractStatus: 'awaiting_signature', lotOutcomeId: 14011, allocatedValue: bwp('4620000.00') },
    { contractId: 3, contractReference: 'C-2026-0003', contractStatus: 'under_review', lotOutcomeId: 14011, allocatedValue: bwp('540000.00') },
    { contractId: 8, contractReference: 'C-2026-0004', contractStatus: 'draft', lotOutcomeId: 14011, allocatedValue: bwp('120000.00') },
  ],
  allocatedTotal: bwp('5280000.00'),
  unallocated: bwp('60000.00'),
  reconciles: true,
  note: 'Lot 3 has no outcome yet and is excluded from the total. BWP 60,000.00 of the lot 1 award is not yet allocated to a contract; allocations never exceed the award.',
};

const RECONCILIATION_T3: AwardReconciliation = {
  currency: 'BWP',
  value: { basis: 'recommended', total: bwp('120000.00'), finalAwardedTotal: bwp('0.00') },
  lotTotals: [{ lotId: 301, lotNo: 1, outcome: 'award', status: 'recommended', awardedValue: bwp('120000.00') }],
  contractAllocations: [],
  allocatedTotal: bwp('0.00'),
  unallocated: bwp('120000.00'),
  reconciles: true,
  note: 'A draft recommendation is not an award. No contract is allocated until the award is final.',
};

/** Reconciliation of T-2026-0007 (intent notified; no contract before final award). */
export const RECONCILIATION_T7: AwardReconciliation = {
  currency: 'BWP',
  value: { basis: 'intended', total: bwp('7850000.00'), finalAwardedTotal: bwp('0.00') },
  lotTotals: [{ lotId: 701, lotNo: 1, outcome: 'award', status: 'intent_notified', awardedValue: bwp('7850000.00') }],
  contractAllocations: [],
  allocatedTotal: bwp('0.00'),
  unallocated: bwp('7850000.00'),
  reconciles: true,
  note: 'Contract preparation waits for the final award; the complaint hold blocks contract signature.',
};

const RECONCILIATION_T9: AwardReconciliation = {
  currency: 'BWP',
  value: { basis: 'recommended', total: bwp('2940000.00'), finalAwardedTotal: bwp('0.00') },
  lotTotals: [{ lotId: 901, lotNo: 1, outcome: 'conditional_award', status: 'recommended', awardedValue: bwp('2940000.00') }],
  contractAllocations: [],
  allocatedTotal: bwp('0.00'),
  unallocated: bwp('2940000.00'),
  reconciles: true,
  note: 'The recommendation awaits approval: the value is proposed, not awarded.',
};

/** Reconciliation of T-2026-0010 (fully allocated to C-2026-0001). */
export const RECONCILIATION_T10: AwardReconciliation = {
  currency: 'BWP',
  value: { basis: 'final_awarded', total: bwp('1850000.00'), finalAwardedTotal: bwp('1850000.00') },
  lotTotals: [{ lotId: 1001, lotNo: 1, outcome: 'award', status: 'final_awarded', awardedValue: bwp('1850000.00') }],
  contractAllocations: [
    {
      contractId: 1,
      contractReference: 'C-2026-0001',
      contractStatus: 'active',
      lotOutcomeId: 14021,
      allocatedValue: bwp('1850000.00'),
    },
  ],
  allocatedTotal: bwp('1850000.00'),
  unallocated: bwp('0.00'),
  reconciles: true,
  note: null,
};

// ---------------------------------------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------------------------------------

const T1_OFFERS: RecommendationDetail['offers'] = [
  {
    bidId: 104,
    supplier: supplier('tsodilo'),
    lotNos: [1],
    complianceStatus: 'compliant',
    technicalScore: '56.50',
    commercialScore: '28.20',
    totalScore: '84.70',
    rank: 1,
    evaluatedPrice: bwp('5340000.00'),
    note: 'Lot 1. Lot 3 is evaluated separately.',
  },
  {
    bidId: 105,
    supplier: supplier('chobe-pipe'),
    lotNos: [1],
    complianceStatus: 'compliant',
    technicalScore: '48.25',
    commercialScore: '30.00',
    totalScore: '78.25',
    rank: 2,
    evaluatedPrice: bwp('5020000.00'),
    note: 'Lot 1.',
  },
  {
    bidId: 105,
    supplier: supplier('chobe-pipe'),
    lotNos: [2],
    complianceStatus: 'non_compliant',
    technicalScore: null,
    commercialScore: null,
    totalScore: null,
    rank: null,
    evaluatedPrice: null,
    note: 'Lot 2: failed REQ-T-02 (solar array sizing for each site); not ranked.',
  },
];

const T1_COMMON = {
  tender: awardTender(1).ref,
  summary:
    'Award lot 1 to Tsodilo Engineering at BWP 5,340,000.00 and cancel lot 2. Lot 3 continues under evaluation and will be recommended separately.',
  compliantOffersSummary: 'Lot 1: two compliant offers (Tsodilo, Chobe). Lot 2: no compliant offer. Lot 3: three offers under evaluation.',
  conflictsSummary: 'All six committee members declared no conflict for lots 1 and 2. No declaration is pending.',
  exceptionsSummary: 'No exceptions to the published terms were accepted.',
  negotiationSummary: 'No negotiation took place; the tender does not permit negotiation.',
  offers: T1_OFFERS,
  qualification: [
    {
      supplier: supplier('tsodilo'),
      status: 'qualified' as const,
      scope: 'Water Infrastructure Suppliers — Category A (WTR-INFRA), up to BWP 10,000,000.00',
      validTo: '2027-12-31',
      conditions: null,
    },
    {
      supplier: supplier('chobe-pipe'),
      status: 'qualified_with_conditions' as const,
      scope: 'Water Infrastructure Suppliers — Category A (WTR-INFRA), up to BWP 5,000,000.00',
      validTo: '2027-06-30',
      conditions: 'Renewed public liability insurance certificate to be supplied before its current expiry.',
    },
  ],
  diligence: [
    {
      supplier: supplier('tsodilo'),
      caseStatus: 'passed' as const,
      blockingFindings: 0,
      summary: 'Financial standing, workshop capacity and pump OEM authorisation verified.',
    },
  ],
  unresolvedConflictCount: 0,
  proposedContracts: [
    { supplier: supplier('tsodilo'), lotNos: [1], value: bwp('4620000.00'), contractId: 2, contractReference: 'C-2026-0002', contractStatus: 'awaiting_signature' as const },
    { supplier: supplier('tsodilo'), lotNos: [1], value: bwp('540000.00'), contractId: 3, contractReference: 'C-2026-0003', contractStatus: 'under_review' as const },
    { supplier: supplier('tsodilo'), lotNos: [1], value: bwp('120000.00'), contractId: 8, contractReference: 'C-2026-0004', contractStatus: 'draft' as const },
  ],
  snapshotId: null,
  createdBy: person(USERS.tebogo),
};

/** Every recommendation, by id. */
export const RECOMMENDATIONS: readonly RecommendationFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    detail: {
      ...T1_COMMON,
      recommendationId: 11,
      version: 1,
      status: 'superseded',
      affordabilitySummary: 'Lot 1 price is within the indicative lot budget.',
      unresolvedConditions: 'Budget owner confirmation for FY2026/27 outstanding.',
      affordability: { budgetAmount: bwp('5500000.00'), fundingConfirmed: false, withinBudget: true },
      lotOutcomes: [
        supersededCopy(14011, 111, 11),
        supersededCopy(14012, 112, 11),
      ],
      reconciliation: {
        ...RECONCILIATION_T1,
        value: { basis: 'recommended', total: bwp('5340000.00'), finalAwardedTotal: bwp('0.00') },
        lotTotals: [
          { lotId: 101, lotNo: 1, outcome: 'award', status: 'withdrawn', awardedValue: bwp('5340000.00') },
          { lotId: 102, lotNo: 2, outcome: 'cancelled', status: 'withdrawn', awardedValue: null },
          { lotId: 103, lotNo: 3, outcome: null, status: null, awardedValue: null },
        ],
        contractAllocations: [],
        allocatedTotal: bwp('0.00'),
        unallocated: bwp('5340000.00'),
        note: 'Superseded by version 2: these values were never approved.',
      },
      proposedContracts: [
        { supplier: supplier('tsodilo'), lotNos: [1], value: bwp('5340000.00'), contractId: null, contractReference: null, contractStatus: null },
      ],
      submissionChecks: [
        { code: 'evaluation_signed_off', status: 'passed', detail: 'Lots 1 and 2 signed off by the evaluation chair on 16 Jul 2026.' },
        { code: 'every_lot_has_outcome', status: 'passed', detail: 'Lots 1 and 2 have explicit outcomes; lot 3 is outside this recommendation.' },
        { code: 'totals_reconcile', status: 'passed', detail: null },
        { code: 'diligence', status: 'passed', detail: null },
        { code: 'conflicts', status: 'passed', detail: null },
        { code: 'funding', status: 'warning', detail: 'Funding for FY2026/27 was indicative when the recommendation was submitted.' },
      ],
      approval: {
        approvalRequestId: null,
        status: 'returned',
        approver: person(USERS.keabetswe),
        decidedAt: '2026-07-24T09:30:00Z',
        conditions: null,
        rationale: 'The affordability summary does not show the budget owner’s funding confirmation for FY2026/27. Add it and resubmit.',
      },
      history: [
        { at: '2026-07-20T07:45:00Z', action: 'created', actor: person(USERS.tebogo), version: 1, note: null },
        { at: '2026-07-21T12:10:00Z', action: 'submitted', actor: person(USERS.tebogo), version: 1, note: 'For award approval.' },
        {
          at: '2026-07-24T09:30:00Z',
          action: 'returned',
          actor: person(USERS.keabetswe),
          version: 1,
          note: 'Funding confirmation for FY2026/27 is missing.',
        },
        { at: '2026-07-27T08:00:00Z', action: 'superseded', actor: person(USERS.tebogo), version: 1, note: 'Replaced by version 2.' },
      ],
      createdAt: '2026-07-20T07:45:00Z',
      updatedAt: '2026-07-27T08:00:00Z',
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    detail: {
      ...T1_COMMON,
      recommendationId: 14902,
      version: 2,
      status: 'approved',
      affordabilitySummary:
        'Lot 1 price BWP 5,340,000.00 is within the approved lot 1 budget of BWP 5,500,000.00. Funding for FY2026/27 confirmed by the budget owner (Operations) on 27 Jul 2026.',
      unresolvedConditions: 'None.',
      affordability: { budgetAmount: bwp('5500000.00'), fundingConfirmed: true, withinBudget: true },
      lotOutcomes: outcomesOf(14902),
      reconciliation: RECONCILIATION_T1,
      submissionChecks: [
        { code: 'evaluation_signed_off', status: 'passed', detail: 'Lots 1 and 2 signed off by the evaluation chair on 16 Jul 2026.' },
        { code: 'every_lot_has_outcome', status: 'passed', detail: 'Lots 1 and 2 have explicit outcomes; lot 3 is outside this recommendation.' },
        { code: 'totals_reconcile', status: 'passed', detail: null },
        { code: 'diligence', status: 'passed', detail: null },
        { code: 'conflicts', status: 'passed', detail: null },
        { code: 'funding', status: 'passed', detail: 'Confirmed by Onalenna Tau on 27 Jul 2026.' },
      ],
      approval: {
        approvalRequestId: 35,
        status: 'approved',
        approver: person(USERS.keabetswe),
        decidedAt: '2026-08-05T13:00:00Z',
        conditions: null,
        rationale: 'Evaluation, funding and diligence are complete; lot 2 cancellation reason is documented.',
      },
      history: [
        { at: '2026-07-27T08:00:00Z', action: 'created', actor: person(USERS.tebogo), version: 2, note: 'Version 2 with the funding confirmation.' },
        { at: '2026-07-27T10:20:00Z', action: 'submitted', actor: person(USERS.tebogo), version: 2, note: null },
        { at: '2026-08-05T13:00:00Z', action: 'approved', actor: person(USERS.keabetswe), version: 2, note: null },
      ],
      snapshotId: 3012,
      createdAt: '2026-07-27T08:00:00Z',
      updatedAt: '2026-08-05T13:00:00Z',
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    detail: {
      recommendationId: 13,
      tender: awardTender(3).ref,
      version: 1,
      status: 'draft',
      summary: 'Award the SCADA telemetry upgrade to Tsodilo Engineering at BWP 120,000.00 (88.00 points, ranked first).',
      compliantOffersSummary:
        'Two compliant offers were evaluated (Tsodilo 88.00, Serowe ICT 86.00). Makgadikgadi failed mandatory requirement REQ-Q-03; its exclusion awaits approval and its commercial envelope stays sealed.',
      affordabilitySummary: 'BWP 120,000.00 is within the approved budget of BWP 150,000.00.',
      conflictsSummary: 'Sam Keitumetse declared a relationship with Tsodilo; the declaration was reviewed and he was recused from this tender.',
      exceptionsSummary: 'None.',
      negotiationSummary: 'No negotiation.',
      unresolvedConditions: 'Evaluation sign-off is outstanding: one evaluator has not scored criterion C-2.3.',
      offers: [
        {
          bidId: 304,
          supplier: supplier('tsodilo'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '63.00',
          commercialScore: '25.00',
          totalScore: '88.00',
          rank: 1,
          evaluatedPrice: bwp('120000.00'),
          note: null,
        },
        {
          bidId: 307,
          supplier: supplier('serowe-ict'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '56.00',
          commercialScore: '30.00',
          totalScore: '86.00',
          rank: 2,
          evaluatedPrice: bwp('100000.00'),
          note: null,
        },
        {
          bidId: 306,
          supplier: supplier('makgadikgadi'),
          lotNos: [1],
          complianceStatus: 'non_compliant',
          technicalScore: null,
          commercialScore: null,
          totalScore: null,
          rank: null,
          evaluatedPrice: null,
          note: 'Failed REQ-Q-03 (ISO 9001 certificate); exclusion awaiting approval; commercial envelope sealed.',
        },
      ],
      affordability: { budgetAmount: bwp('150000.00'), fundingConfirmed: true, withinBudget: true },
      qualification: [
        {
          supplier: supplier('tsodilo'),
          status: 'qualified',
          scope: 'Water Infrastructure Suppliers — Category A (WTR-INFRA), up to BWP 10,000,000.00',
          validTo: '2027-12-31',
          conditions: null,
        },
      ],
      diligence: [],
      unresolvedConflictCount: 0,
      lotOutcomes: outcomesOf(13),
      reconciliation: RECONCILIATION_T3,
      proposedContracts: [
        { supplier: supplier('tsodilo'), lotNos: [1], value: bwp('120000.00'), contractId: null, contractReference: null, contractStatus: null },
      ],
      submissionChecks: [
        {
          code: 'evaluation_signed_off',
          status: 'blocking',
          detail: 'Kabo Ntsima has not scored criterion C-2.3 for Serowe ICT Solutions; the evaluation cannot be signed off.',
        },
        { code: 'every_lot_has_outcome', status: 'passed', detail: null },
        { code: 'totals_reconcile', status: 'passed', detail: null },
        { code: 'diligence', status: 'passed', detail: 'No due diligence is required by the tender.' },
        { code: 'conflicts', status: 'passed', detail: 'One conflict recorded and resolved by recusal.' },
        { code: 'funding', status: 'passed', detail: null },
      ],
      approval: NO_APPROVAL,
      history: [{ at: '2026-09-28T09:00:00Z', action: 'created', actor: person(USERS.tebogo), version: 1, note: 'Draft prepared from the moderated results.' }],
      snapshotId: null,
      createdBy: person(USERS.tebogo),
      createdAt: '2026-09-28T09:00:00Z',
      updatedAt: '2026-09-29T14:30:00Z',
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    detail: {
      recommendationId: 14,
      tender: awardTender(7).ref,
      version: 1,
      status: 'approved',
      summary: 'Award the reservoir rehabilitation works to Makgadikgadi Civil Works at BWP 7,850,000.00.',
      compliantOffersSummary: 'Three compliant offers, one from each bidder: Makgadikgadi 83.60, Tsodilo 80.33, Limpopo 72.40.',
      affordabilitySummary: 'BWP 7,850,000.00 is within the approved capital budget of BWP 8,200,000.00 (funding confirmed).',
      conflictsSummary:
        'One conflict declared: the evaluation chair recused (financial interest in Limpopo Environmental Services) and took no part in scoring or moderation; the deputy chair led the evaluation. No unresolved conflict.',
      exceptionsSummary: 'Makgadikgadi’s proposed 60-day mobilisation period was accepted as within the published range.',
      negotiationSummary: 'No negotiation.',
      unresolvedConditions: 'None.',
      offers: [
        {
          bidId: 706,
          supplier: supplier('makgadikgadi'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '54.40',
          commercialScore: '29.20',
          totalScore: '83.60',
          rank: 1,
          evaluatedPrice: bwp('7850000.00'),
          note: null,
        },
        {
          bidId: 704,
          supplier: supplier('tsodilo'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '52.10',
          commercialScore: '28.23',
          totalScore: '80.33',
          rank: 2,
          evaluatedPrice: bwp('8120000.00'),
          note: null,
        },
        {
          bidId: 708,
          supplier: supplier('limpopo-env'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '42.40',
          commercialScore: '30.00',
          totalScore: '72.40',
          rank: 3,
          evaluatedPrice: bwp('7640000.00'),
          note: null,
        },
      ],
      affordability: { budgetAmount: bwp('8200000.00'), fundingConfirmed: true, withinBudget: true },
      qualification: [
        {
          supplier: supplier('makgadikgadi'),
          status: 'not_assessed',
          scope: 'No programme applies to civil works; tender-specific eligibility evidence verified.',
          validTo: null,
          conditions: null,
        },
      ],
      diligence: [
        {
          supplier: supplier('makgadikgadi'),
          caseStatus: 'passed',
          blockingFindings: 0,
          summary: 'Financial standing, plant and equipment, and CIPA registration verified.',
        },
      ],
      unresolvedConflictCount: 0,
      lotOutcomes: outcomesOf(14),
      reconciliation: RECONCILIATION_T7,
      proposedContracts: [
        { supplier: supplier('makgadikgadi'), lotNos: [1], value: bwp('7850000.00'), contractId: null, contractReference: null, contractStatus: null },
      ],
      submissionChecks: [
        { code: 'evaluation_signed_off', status: 'passed', detail: 'Signed off by the deputy evaluation chair on 10 Sep 2026 (the chair recused).' },
        { code: 'every_lot_has_outcome', status: 'passed', detail: null },
        { code: 'totals_reconcile', status: 'passed', detail: null },
        { code: 'diligence', status: 'passed', detail: null },
        { code: 'conflicts', status: 'passed', detail: null },
        { code: 'funding', status: 'passed', detail: null },
      ],
      approval: {
        approvalRequestId: 38,
        status: 'approved_with_conditions',
        approver: person(USERS.keabetswe),
        decidedAt: '2026-09-18T11:00:00Z',
        conditions: 'No contract may be signed before the standstill ends and any complaint is decided.',
        rationale: 'The recommendation follows the published method; funding confirmed.',
      },
      history: [
        { at: '2026-09-11T08:30:00Z', action: 'created', actor: person(USERS.tebogo), version: 1, note: null },
        { at: '2026-09-14T09:00:00Z', action: 'submitted', actor: person(USERS.tebogo), version: 1, note: null },
        {
          at: '2026-09-18T11:00:00Z',
          action: 'approved_with_conditions',
          actor: person(USERS.keabetswe),
          version: 1,
          note: 'No contract may be signed before the standstill ends and any complaint is decided.',
        },
      ],
      snapshotId: 3014,
      createdBy: person(USERS.tebogo),
      createdAt: '2026-09-11T08:30:00Z',
      updatedAt: '2026-09-18T11:00:00Z',
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    detail: {
      recommendationId: 15,
      tender: awardTender(9).ref,
      version: 1,
      status: 'awaiting_approval',
      summary:
        'Conditionally award the acoustic leak detection services to Limpopo Environmental Services at BWP 2,940,000.00 under the approved fallback decision.',
      compliantOffersSummary: 'Two shortlisted offers after the demonstration stage: Serowe ICT 87.20 (preferred, failed due diligence) and Limpopo 82.97.',
      affordabilitySummary: 'BWP 2,940,000.00 is within the approved three-year budget of BWP 3,100,000.00.',
      conflictsSummary: 'No conflicts declared.',
      exceptionsSummary: 'None.',
      negotiationSummary:
        'No negotiation or final-offer round: the tender does not permit negotiation, and the requested final-offer round was blocked pending a procedural decision.',
      unresolvedConditions: 'Due diligence on Limpopo Environmental Services is open with one award-blocking finding (professional indemnity insurance).',
      offers: [
        {
          bidId: 907,
          supplier: supplier('serowe-ict'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '57.20',
          commercialScore: '30.00',
          totalScore: '87.20',
          rank: 1,
          evaluatedPrice: bwp('2780000.00'),
          note: 'Preferred bidder; failed due diligence (financial standing). Fallback decision approved.',
        },
        {
          bidId: 908,
          supplier: supplier('limpopo-env'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '54.60',
          commercialScore: '28.37',
          totalScore: '82.97',
          rank: 2,
          evaluatedPrice: bwp('2940000.00'),
          note: null,
        },
      ],
      affordability: { budgetAmount: bwp('3100000.00'), fundingConfirmed: true, withinBudget: true },
      qualification: [
        {
          supplier: supplier('limpopo-env'),
          status: 'not_assessed',
          scope: 'No programme applies; tender-specific evidence verified at the shortlist stage.',
          validTo: null,
          conditions: null,
        },
      ],
      diligence: [
        {
          supplier: supplier('serowe-ict'),
          caseStatus: 'failed',
          blockingFindings: 1,
          summary: 'Audited financial statements show negative working capital; the finding is award-blocking and unresolved.',
        },
        {
          supplier: supplier('limpopo-env'),
          caseStatus: 'open',
          blockingFindings: 1,
          summary: 'Professional indemnity insurance certificate not yet verified with the insurer.',
        },
      ],
      unresolvedConflictCount: 0,
      lotOutcomes: outcomesOf(15),
      reconciliation: RECONCILIATION_T9,
      proposedContracts: [
        { supplier: supplier('limpopo-env'), lotNos: [1], value: bwp('2940000.00'), contractId: null, contractReference: null, contractStatus: null },
      ],
      submissionChecks: [
        { code: 'evaluation_signed_off', status: 'passed', detail: null },
        { code: 'every_lot_has_outcome', status: 'passed', detail: null },
        { code: 'totals_reconcile', status: 'passed', detail: null },
        {
          code: 'diligence',
          status: 'blocking',
          detail: 'Limpopo Environmental Services: one award-blocking finding is open. Approval cannot be given until it is resolved.',
        },
        { code: 'conflicts', status: 'passed', detail: null },
        { code: 'funding', status: 'passed', detail: null },
      ],
      approval: {
        approvalRequestId: 39,
        status: 'pending',
        approver: person(USERS.keabetswe),
        decidedAt: null,
        conditions: null,
        rationale: null,
      },
      history: [
        { at: '2026-09-24T10:00:00Z', action: 'created', actor: person(USERS.tebogo), version: 1, note: 'After the fallback decision.' },
        {
          at: '2026-09-25T08:15:00Z',
          action: 'submitted',
          actor: person(USERS.tebogo),
          version: 1,
          note: 'Submitted as a conditional award so the approver can see the diligence position.',
        },
      ],
      snapshotId: 3015,
      createdBy: person(USERS.tebogo),
      createdAt: '2026-09-24T10:00:00Z',
      updatedAt: '2026-09-25T08:15:00Z',
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    detail: {
      recommendationId: 14901,
      tender: awardTender(10).ref,
      version: 1,
      status: 'approved',
      summary: 'Award fleet vehicle maintenance to Tsodilo Engineering at BWP 1,850,000.00 for twelve months (with renewal and extension options).',
      compliantOffersSummary: 'Two compliant quotations: Tsodilo 88.19, Makgadikgadi 74.80.',
      affordabilitySummary: 'BWP 1,850,000.00 over twelve months is within the operating budget of BWP 1,950,000.00.',
      conflictsSummary: 'No conflicts declared.',
      exceptionsSummary: 'None.',
      negotiationSummary: 'No negotiation.',
      unresolvedConditions: 'None.',
      offers: [
        {
          bidId: 1004,
          supplier: supplier('tsodilo'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '60.30',
          commercialScore: '27.89',
          totalScore: '88.19',
          rank: 1,
          evaluatedPrice: bwp('1850000.00'),
          note: null,
        },
        {
          bidId: 1006,
          supplier: supplier('makgadikgadi'),
          lotNos: [1],
          complianceStatus: 'compliant',
          technicalScore: '44.80',
          commercialScore: '30.00',
          totalScore: '74.80',
          rank: 2,
          evaluatedPrice: bwp('1720000.00'),
          note: null,
        },
      ],
      affordability: { budgetAmount: bwp('1950000.00'), fundingConfirmed: true, withinBudget: true },
      qualification: [
        {
          supplier: supplier('tsodilo'),
          status: 'qualified',
          scope: 'Water Infrastructure Suppliers — Category A (WTR-INFRA), up to BWP 10,000,000.00',
          validTo: '2027-12-31',
          conditions: null,
        },
      ],
      diligence: [],
      unresolvedConflictCount: 0,
      lotOutcomes: outcomesOf(14901),
      reconciliation: RECONCILIATION_T10,
      proposedContracts: [
        {
          supplier: supplier('tsodilo'),
          lotNos: [1],
          value: bwp('1850000.00'),
          contractId: 1,
          contractReference: 'C-2026-0001',
          contractStatus: 'active',
        },
      ],
      submissionChecks: [
        { code: 'evaluation_signed_off', status: 'passed', detail: null },
        { code: 'every_lot_has_outcome', status: 'passed', detail: null },
        { code: 'totals_reconcile', status: 'passed', detail: null },
        { code: 'diligence', status: 'passed', detail: 'Not required for this quotation.' },
        { code: 'conflicts', status: 'passed', detail: null },
        { code: 'funding', status: 'passed', detail: null },
      ],
      approval: {
        approvalRequestId: null,
        status: 'approved',
        approver: person(USERS.keabetswe),
        decidedAt: '2026-02-13T10:00:00Z',
        conditions: null,
        rationale: 'Approved as recommended.',
      },
      history: [
        { at: '2026-02-09T08:00:00Z', action: 'created', actor: person(USERS.tebogo), version: 1, note: null },
        { at: '2026-02-10T08:00:00Z', action: 'submitted', actor: person(USERS.tebogo), version: 1, note: null },
        { at: '2026-02-13T10:00:00Z', action: 'approved', actor: person(USERS.keabetswe), version: 1, note: null },
      ],
      snapshotId: 3016,
      createdBy: person(USERS.tebogo),
      createdAt: '2026-02-09T08:00:00Z',
      updatedAt: '2026-02-13T10:00:00Z',
    },
  },
]);

/** The lot outcomes of a tender (current recommendations only). */
export function lotOutcomesOfTender(tenderId: number): LotOutcome[] {
  return outcomesOfTender(tenderId);
}
