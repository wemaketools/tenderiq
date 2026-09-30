/**
 * Evaluation plans of the demo tenders (BUY-11, PRD §9).
 *
 * Id scheme: plan `tenderId*10 + 1`, criterion `tenderId*1000 + 500 + n`.
 * - T-2026-0003 reproduces the PRD §9.2 model: quality 35, delivery 20, experience 15, price 30 (lowest evaluated
 *   cost ÷ this offer's evaluated cost × 30), ratings 0–5, consensus, four calculation and two display decimals.
 * - T-2026-0009 has sub-criteria and one recorded amendment before release.
 * - T-2026-0012 is a draft whose weights total 95, with incomplete anchors and no tie rules.
 * The RFI T-2026-0004 has no evaluation plan.
 */
import { TENANT_IDS } from '../platform.js';
import { USERS } from './reference.js';
import type { FxAnchor, FxCriterion, FxEvaluationPlan, FxTieRule } from './types.js';

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

export const STANDARD_ANCHORS: readonly FxAnchor[] = [
  { value: 0, label: 'No response', description: 'Nothing submitted, or the response does not address the criterion.' },
  { value: 1, label: 'Poor', description: 'Major gaps; significant doubt that the requirement can be met.' },
  { value: 2, label: 'Weak', description: 'Partly addresses the criterion with notable weaknesses.' },
  { value: 3, label: 'Meets requirements', description: 'Fully addresses the criterion with adequate evidence.' },
  { value: 4, label: 'Good', description: 'Meets requirements with clear added value and good evidence.' },
  { value: 5, label: 'Excellent', description: 'Exceeds requirements with strong, specific evidence.' },
];

const STANDARD_TIES = (priceCriterionId: number | null): FxTieRule[] => [
  { sequence: 1, rule: 'highest_non_price', criterionId: null },
  { sequence: 2, rule: 'lowest_evaluated_cost', criterionId: priceCriterionId },
  { sequence: 3, rule: 'committee_decision', criterionId: null },
];

type CriterionSpec = readonly [code: string, name: string, maxPoints: string, options?: Partial<FxCriterion>];

function criteria(tenderId: number, specs: readonly CriterionSpec[]): FxCriterion[] {
  return specs.map(([code, name, maxPoints, options = {}], index) => ({
    id: tenderId * 1000 + 500 + index + 1,
    parentId: null,
    code,
    name,
    description: null,
    maxPoints,
    isPrice: code === 'PRICE',
    minScore: null,
    scoringGuidance: code === 'PRICE' ? null : 'Rate 0–5 against the anchors; weighted points = rating ÷ 5 × maximum points.',
    envelope: code === 'PRICE' ? 'commercial' : 'technical',
    naPermitted: false,
    sortOrder: (index + 1) * 10,
    ...options,
  }));
}

const LOWEST_RATIO = 'Lowest eligible evaluated cost ÷ this offer’s evaluated cost × price points.';
const ZERO_PRICE =
  'A zero price is a price of zero: it is evaluated as zero, never read as “included” or “not offered”. A zero price for a required item is confirmed in clarification.';
const MISSING_PRICE = 'A missing price for a required item makes the offer non-comparable for that lot.';

function plan(
  tenderId: number,
  fields: Partial<FxEvaluationPlan> & Pick<FxEvaluationPlan, 'criteria' | 'priceWeight' | 'approvedAt' | 'approvedBy'>,
): FxEvaluationPlan {
  const price = fields.criteria.find((criterion) => criterion.isPrice);
  return {
    id: tenderId * 10 + 1,
    tenantId: KWU,
    tenderId,
    lotId: null,
    status: 'approved',
    version: 1,
    scaleMax: 5,
    aggregationMethod: 'consensus',
    priceMethod: 'lowest_ratio',
    priceFormulaNote: LOWEST_RATIO,
    zeroPriceTreatment: ZERO_PRICE,
    missingPriceTreatment: MISSING_PRICE,
    thresholdScope: 'non_price_total',
    nonPriceThreshold: null,
    decimalPlacesCalc: 4,
    decimalPlacesDisplay: 2,
    comparisonCurrency: 'BWP',
    fxSource: 'Bank of Botswana mid-rate',
    fxDate: null,
    approvalRequestId: null,
    anchors: STANDARD_ANCHORS,
    tieBreakRules: STANDARD_TIES(price?.id ?? null),
    amendments: [],
    ...fields,
  };
}

const t9Criteria = criteria(9, [
  ['APPROACH', 'Survey approach and productivity', '30'],
  ['TECH', 'Technology and equipment', '25'],
  ['TEAM', 'Team experience', '15'],
  ['PRICE', 'Price', '30'],
  ['TECH.1', 'Correlator and listening equipment', '10'],
  ['TECH.2', 'Data platform and reporting', '15'],
]).map((criterion) => (criterion.code.startsWith('TECH.') ? { ...criterion, parentId: 9502 } : criterion));

export const EVALUATION_PLANS: readonly FxEvaluationPlan[] = Object.freeze([
  plan(1, {
    criteria: criteria(1, [
      ['TECH', 'Technical compliance and pump efficiency', '40'],
      ['DELIV', 'Delivery and installation programme', '15'],
      ['AFTER', 'After-sales support', '15'],
      ['PRICE', 'Price', '30'],
    ]),
    priceWeight: '30',
    nonPriceThreshold: '42',
    approvedAt: '2026-06-10T12:00:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(2, {
    criteria: criteria(2, [
      ['TECH', 'Meter accuracy and technical compliance', '30'],
      ['DELIV', 'Delivery schedule', '10'],
      ['PRICE', 'Price', '60'],
    ]),
    priceWeight: '60',
    thresholdScope: 'criterion',
    nonPriceThreshold: '18',
    approvedAt: '2026-09-09T10:00:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(3, {
    criteria: criteria(3, [
      ['QUAL', 'Solution quality', '35'],
      ['DELIV', 'Delivery approach', '20'],
      ['EXP', 'Relevant experience', '15'],
      ['PRICE', 'Price', '30'],
    ]),
    priceWeight: '30',
    nonPriceThreshold: '45',
    approvedAt: '2026-07-15T09:30:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(5, {
    criteria: criteria(5, [
      ['CAP', 'Product quality and certification', '30'],
      ['SUPPLY', 'Supply capacity and logistics', '20'],
      ['SHEQ', 'Safety, health, environment and quality', '10'],
      ['PRICE', 'Price', '40'],
    ]),
    priceWeight: '40',
    nonPriceThreshold: '36',
    approvedAt: '2026-09-23T11:00:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(6, {
    criteria: criteria(6, [
      ['TECH', 'Technical compliance', '40'],
      ['DELIV', 'Installation programme', '20'],
      ['PRICE', 'Price', '40'],
    ]),
    priceWeight: '40',
    nonPriceThreshold: '36',
    approvedAt: '2026-09-16T10:00:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(7, {
    criteria: criteria(7, [
      ['T-1', 'Relevant reservoir rehabilitation experience', '20'],
      ['T-2', 'Methodology and programme', '25'],
      ['T-3', 'Key personnel', '15'],
      ['T-4', 'Health, safety and environment', '10'],
      ['C-1', 'Price (lowest-ratio method)', '30', { isPrice: true, scoringGuidance: null, envelope: 'commercial' }],
    ]),
    priceWeight: '30',
    nonPriceThreshold: '35',
    aggregationMethod: 'average',
    approvedAt: '2026-05-06T10:00:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(8, {
    criteria: criteria(8, [
      ['TECH', 'Technical compliance', '25'],
      ['DELIV', 'Delivery schedule', '15'],
      ['PRICE', 'Price', '60'],
    ]),
    priceWeight: '60',
    thresholdScope: 'none',
    approvedAt: '2026-08-19T10:00:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(9, {
    criteria: t9Criteria,
    priceWeight: '30',
    nonPriceThreshold: '49',
    status: 'amended',
    version: 2,
    amendments: [
      {
        version: 2,
        amendedAt: '2026-07-02T14:00:00Z',
        amendedBy: USERS.tebogo,
        note: 'Split “Technology and equipment” into equipment (10) and data platform (15) before release; weights unchanged.',
      },
    ],
    tieBreakRules: [
      { sequence: 1, rule: 'highest_non_price', criterionId: null },
      { sequence: 2, rule: 'highest_criterion', criterionId: 9501 },
      { sequence: 3, rule: 'committee_decision', criterionId: null },
    ],
    approvedAt: '2026-07-03T09:00:00Z',
    approvedBy: USERS.mpho,
  }),
  plan(10, {
    criteria: criteria(10, [
      ['SVC', 'Service capability', '30'],
      ['TURN', 'Turnaround times', '20'],
      ['PRICE', 'Price', '50'],
    ]),
    priceWeight: '50',
    thresholdScope: 'none',
    approvedAt: '2026-02-25T10:00:00Z',
    approvedBy: USERS.mpho,
  }),
  {
    ...plan(11, {
      criteria: criteria(11, [
        ['METH', 'Cleaning methodology', '30'],
        ['STAFF', 'Staffing and supervision', '20'],
        ['PRICE', 'Price', '50'],
      ]),
      priceWeight: '50',
      thresholdScope: 'none',
      approvedAt: '2026-09-11T10:00:00Z',
      approvedBy: USERS.officerOdc,
    }),
    tenantId: ODC,
  },
  plan(12, {
    status: 'draft',
    criteria: criteria(12, [
      ['TECH', 'Technical capability', '40'],
      ['METH', 'Maintenance methodology', '25'],
      ['PRICE', 'Price', '30'],
    ]),
    priceWeight: '30',
    missingPriceTreatment: null,
    nonPriceThreshold: null,
    anchors: STANDARD_ANCHORS.filter((anchor) => anchor.value !== 1 && anchor.value !== 2),
    tieBreakRules: [],
    approvedAt: null,
    approvedBy: null,
  }),
]);
