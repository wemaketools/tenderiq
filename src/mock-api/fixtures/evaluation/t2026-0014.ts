/**
 * T-2026-0014 Water treatment works instrumentation (KWU, tender / open, staged opening, per-lot award,
 * `under_assessment`). Five lots are evaluated separately with per-lot price gates (DD-02), and each lot stands at a
 * different step of the evaluation, so every command of the committee has a record in the state it needs
 * (plan §3.11):
 *
 * - Lot 1 Flow meters: report v1 signed off by the whole committee, not yet passed to the award recommendation
 *   (EVA-06 hand-off; the award approver sees signed-off results).
 * - Lot 2 Online water-quality analysers: results computed, report v1 in draft and ready for sign-off; the displayed
 *   totals tie at 84.00 and the published tie sequence (highest non-price points) orders them.
 * - Lot 3 Level sensors: commercial comparison in draft; an arithmetic correction proposed by the financial reviewer
 *   awaits approval, and an abnormally-low flag awaits its documented review (EVA-04).
 * - Lot 4 Pressure transmitters: non-price moderation finalized, price gate ready to release (AC-16).
 * - Lot 5 Chlorine dosing controllers: both assessments submitted and every cell agreed; moderation ready to be
 *   finalized (EVA-05).
 *
 * Committee: B. Kgari (chair), T. Mokgosi and K. Ntsima (technical), R. Motsumi (commercial, after each gate).
 */
import { div, mul, round, sub, sum } from '../../../contracts/decimal.js';
import type { EvaluationLotRef, EvaluationPlan, EvaluationTenderRef } from '../../../contracts/evaluation.js';
import { GABORONE_TZ, KWU, KWU_UNDERTAKING, SCALE_ANCHORS_0_5, SUPPLIERS, USERS, scoreRows, supplierName } from './common.js';
import type {
  EvaluationFixtureSet,
  FixtureAssignment,
  FixtureBid,
  FixtureCommercial,
  FixtureCommercialRow,
  FixtureEvaluation,
  FixtureModeratedScore,
  FixtureModerationSession,
  FixturePriceGate,
  FixtureReport,
  FixtureResults,
  FixtureScore,
  FixtureTimelineEvent,
} from './types.js';

const TENDER_ID = 14;

const TENDER: EvaluationTenderRef = {
  tenderId: TENDER_ID,
  reference: 'T-2026-0014',
  title: 'Water treatment works instrumentation',
  status: 'under_assessment',
  officialTimeZone: GABORONE_TZ,
  openingMode: 'staged',
  awardModel: 'per_lot',
  maxLotsPerSupplier: null,
  independentEvaluation: true,
  anonymizedEvaluation: false,
  anonymizationLimitations: null,
};

const LOT_CONSTRAINT_NOTE =
  'Per-lot award across five lots; no limit on the number of lots per supplier. Each lot has its own price gate, ' +
  'comparison and report.';

type Stage = 'signed_off' | 'report_draft' | 'commercial_draft' | 'gate_ready' | 'moderation_open';

type Triple = readonly [string, string, string];

interface BidSpec {
  readonly supplierTenantId: number;
  readonly answers: Triple;
  /** Agreed (moderated) ratings for C1..C3. */
  readonly agreed: Triple;
  readonly thato: Triple;
  readonly kabo: Triple;
  /** Evaluated cost in BWP (after any correction). */
  readonly cost: string;
}

interface LotSpec {
  readonly lotNumber: number;
  readonly title: string;
  readonly stage: Stage;
  readonly subject: string;
  readonly budget: string;
  readonly bids: readonly [BidSpec, BidSpec];
}

const CRITERIA = [
  { suffix: 1, code: 'C1', name: 'Measurement performance', maxPoints: '40', guidance: 'A 3 needs the stated accuracy across the full range with test evidence.' },
  { suffix: 2, code: 'C2', name: 'Delivery, calibration and support', maxPoints: '20', guidance: 'A 3 needs delivery within 12 weeks, site calibration and a 24-month support commitment.' },
  { suffix: 3, code: 'C3', name: 'Standards and certification', maxPoints: '10', guidance: 'A 3 needs type approval and IP67 or better; third-party certificates raise the rating.' },
] as const;

const LOTS: readonly LotSpec[] = [
  {
    lotNumber: 1,
    title: 'Flow meters',
    stage: 'signed_off',
    subject: 'electromagnetic flow meters DN50–DN600 for the inlet, filter and treated-water lines',
    budget: '260000.00',
    bids: [
      {
        supplierTenantId: SUPPLIERS.gaboroneMeter,
        answers: [
          '±0.2% accuracy across 0.3–10 m/s, verified on an accredited flow rig; empty-pipe detection.',
          'Delivery in 8 weeks; wet calibration certificates; 24-month on-site support from Gaborone.',
          'MID type approval, IP68 sensors, third-party calibration certificates.',
        ],
        agreed: ['4', '4', '4'],
        thato: ['4', '4', '4'],
        kabo: ['4', '4', '4'],
        cost: '200000.00',
      },
      {
        supplierTenantId: SUPPLIERS.tsodilo,
        answers: [
          '±0.5% accuracy; rig verification for DN300 and above only.',
          'Delivery in 10 weeks; calibration by the manufacturer; 24-month support from Maun.',
          'Type approval pending for DN600; IP67.',
        ],
        agreed: ['3.5', '4', '3'],
        thato: ['3.5', '4', '3'],
        kabo: ['3.5', '4', '3'],
        cost: '240000.00',
      },
    ],
  },
  {
    lotNumber: 2,
    title: 'Online water-quality analysers',
    stage: 'report_draft',
    subject: 'online turbidity, pH and free-chlorine analysers with SCADA outputs',
    budget: '500000.00',
    bids: [
      {
        supplierTenantId: SUPPLIERS.seroweIct,
        answers: [
          'Laser nephelometric turbidity (0–100 NTU), amperometric chlorine; Modbus TCP outputs.',
          'Delivery in 12 weeks; commissioning and one calibration visit; 24-month support.',
          'ISO 7027 compliant turbidity; IP66 enclosures.',
        ],
        agreed: ['4', '3.5', '4'],
        thato: ['4', '3.5', '4'],
        kabo: ['4', '3.5', '4'],
        cost: '360000.00',
      },
      {
        supplierTenantId: SUPPLIERS.gaboroneMeter,
        answers: [
          'Laser turbidity with automatic cleaning; membrane chlorine sensors; Modbus TCP and 4–20 mA outputs.',
          'Delivery in 9 weeks; quarterly calibration visits for 24 months.',
          'ISO 7027 and USEPA 180.1 compliant; IP66; third-party test reports.',
        ],
        agreed: ['4.5', '4', '4'],
        thato: ['4.5', '4', '4'],
        kabo: ['4.5', '4', '4'],
        cost: '450000.00',
      },
    ],
  },
  {
    lotNumber: 3,
    title: 'Level sensors',
    stage: 'commercial_draft',
    subject: 'radar level sensors for reservoirs, clarifiers and chemical tanks',
    budget: '450000.00',
    bids: [
      {
        supplierTenantId: SUPPLIERS.tsodilo,
        answers: [
          '80 GHz radar, ±2 mm accuracy, foam and condensation compensation.',
          'Delivery in 10 weeks; mounting brackets and commissioning included; 24-month support.',
          'ATEX-rated for the chemical store; IP68.',
        ],
        agreed: ['4', '4', '3.5'],
        thato: ['4', '4', '3.5'],
        kabo: ['4', '4', '3.5'],
        cost: '412000.00',
      },
      {
        supplierTenantId: SUPPLIERS.seroweIct,
        answers: [
          '26 GHz radar, ±5 mm accuracy; no foam compensation stated.',
          'Delivery in 14 weeks; commissioning by KWU staff after training.',
          'IP67; no ATEX rating stated for the chemical store.',
        ],
        agreed: ['3', '3', '3'],
        thato: ['3', '3', '3'],
        kabo: ['3', '3', '3'],
        cost: '238000.00',
      },
    ],
  },
  {
    lotNumber: 4,
    title: 'Pressure transmitters',
    stage: 'gate_ready',
    subject: 'pressure and differential-pressure transmitters for pumps and filters',
    budget: '300000.00',
    bids: [
      {
        supplierTenantId: SUPPLIERS.gaboroneMeter,
        answers: [
          '±0.075% accuracy, 100:1 turndown, HART diagnostics.',
          'Delivery in 8 weeks; 5-point calibration certificates; 24-month support.',
          'SIL 2 certified; IP66/IP68.',
        ],
        agreed: ['4', '3.5', '4'],
        thato: ['4', '3.5', '4'],
        kabo: ['4', '3', '4'],
        cost: '0.00',
      },
      {
        supplierTenantId: SUPPLIERS.tsodilo,
        answers: [
          '±0.1% accuracy, 50:1 turndown, HART.',
          'Delivery in 6 weeks from Maun stock; site calibration; 36-month support.',
          'SIL 2 certified; IP67.',
        ],
        agreed: ['3.5', '4', '4'],
        thato: ['3.5', '4', '4'],
        kabo: ['3.5', '4', '4'],
        cost: '0.00',
      },
    ],
  },
  {
    lotNumber: 5,
    title: 'Chlorine dosing controllers',
    stage: 'moderation_open',
    subject: 'flow-paced chlorine dosing controllers with residual feedback',
    budget: '400000.00',
    bids: [
      {
        supplierTenantId: SUPPLIERS.seroweIct,
        answers: [
          'Compound-loop control (flow and residual) with PID auto-tuning; alarm on low residual.',
          'Delivery in 10 weeks; commissioning with KWU operators; 24-month support.',
          'IEC 61010 safety; IP65 panels.',
        ],
        agreed: ['4', '4', '4'],
        thato: ['4', '4', '4'],
        kabo: ['4.5', '4', '4'],
        cost: '0.00',
      },
      {
        supplierTenantId: SUPPLIERS.tsodilo,
        answers: [
          'Flow-paced control with residual trim; manual tuning.',
          'Delivery in 12 weeks; commissioning included; 24-month support.',
          'IEC 61010 safety; IP66 panels.',
        ],
        agreed: ['3.5', '3.5', '4'],
        thato: ['3.5', '3.5', '4'],
        kabo: ['3', '3.5', '4'],
        cost: '0.00',
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------
// Id helpers (natural keys per lot; see common.ts for the conventions of the other evaluations)
// ---------------------------------------------------------------------------------------------------------

const lotId = (n: number): number => 1400 + n;
const criterionId = (n: number, suffix: number): number => 1400 + n * 10 + suffix;
const priceCriterionId = (n: number): number => 1400 + n * 10 + 4;
const bidId = (n: number, k: number): number => 14000 + n * 10 + k;
const assignmentId = (n: number, k: number): number => 1400 + n * 10 + k;
const LABELS = ['Supplier A', 'Supplier B'] as const;

function plan(n: number): EvaluationPlan {
  return {
    planId: 140 + n,
    version: 1,
    status: 'approved',
    scaleMax: 5,
    aggregationMethod: 'consensus',
    priceMethod: 'lowest_ratio',
    priceWeight: '30',
    priceFormulaNote: "Price points = lowest evaluated cost ÷ this offer's evaluated cost × 30.",
    zeroPriceTreatment: 'A zero total is non-comparable and referred to the committee.',
    missingPriceTreatment: 'A missing priced line makes the offer non-comparable.',
    thresholdScope: 'criterion',
    nonPriceThreshold: null,
    decimalPlacesCalc: 4,
    decimalPlacesDisplay: 2,
    comparisonCurrency: 'BWP',
    fxSource: 'Bank of Botswana mid-rate',
    fxDate: '2026-08-20',
    approvedAt: '2026-07-20T09:00:00Z',
    criteria: [
      ...CRITERIA.map((row) => ({
        criterionId: criterionId(n, row.suffix),
        parentId: null,
        code: `L${n}-${row.code}`,
        name: row.name,
        description: null,
        maxPoints: row.maxPoints,
        isPrice: false,
        minScore: null,
        scoringGuidance: row.guidance,
        envelope: 'technical' as const,
        naPermitted: false,
        sortOrder: row.suffix,
      })),
      {
        criterionId: priceCriterionId(n),
        parentId: null,
        code: `L${n}-C4`,
        name: 'Price',
        description: `Evaluated cost of Lot ${n}, scored by the published formula.`,
        maxPoints: '30',
        isPrice: true,
        minScore: null,
        scoringGuidance: null,
        envelope: 'commercial',
        naPermitted: false,
        sortOrder: 4,
      },
    ],
    scaleAnchors: [...SCALE_ANCHORS_0_5],
    tieBreakRules: [
      { sequence: 1, rule: 'highest_non_price', criterionId: null },
      { sequence: 2, rule: 'lowest_evaluated_cost', criterionId: null },
    ],
  };
}

const RECEIVED = ['2026-08-19T14:05:12Z', '2026-08-20T07:48:31Z'] as const;

function bids(lot: LotSpec): FixtureBid[] {
  const evaluated = lot.stage === 'signed_off' || lot.stage === 'report_draft';
  return lot.bids.map((spec, index) => {
    const id = bidId(lot.lotNumber, index + 1);
    return {
      bidId: id,
      supplierTenantId: spec.supplierTenantId,
      supplierName: supplierName(spec.supplierTenantId),
      label: LABELS[index] ?? `Supplier ${index + 1}`,
      receiptNo: `RCPT-2026-00${id}`,
      receivedAt: RECEIVED[index] ?? RECEIVED[0],
      revisionId: id * 10 + 1,
      complianceStatus: 'compliant',
      evaluationStatus: evaluated ? 'evaluated' : 'in_evaluation',
      eligible: true,
      sealedReason: null,
      responses: CRITERIA.map((row, position) => ({
        criterionId: criterionId(lot.lotNumber, row.suffix),
        requirements: [
          {
            requirementId: 140000 + lot.lotNumber * 100 + row.suffix,
            refCode: `L${lot.lotNumber}-REQ-0${row.suffix}`,
            requirementText: `${row.name}: describe how the offered ${lot.subject} meet the specification.`,
            answerText: spec.answers[position] ?? null,
            isDeviation: false,
            documents: [
              {
                documentId: id * 10 + row.suffix,
                title: `${row.name} evidence`,
                fileName: `bid-${id}-${row.code.toLowerCase()}.pdf`,
              },
            ],
          },
        ],
      })),
    };
  });
}

/** Weighted points of an agreed rating (rating ÷ 5 × max points) at calculation precision. */
function points(rating: string, maxPoints: string): string {
  return div(mul(rating, maxPoints), '5', 4);
}

function nonPriceTotal(spec: BidSpec): string {
  return round(sum(CRITERIA.map((row, index) => points(spec.agreed[index] ?? '0', row.maxPoints))), 2);
}

// ---------------------------------------------------------------------------------------------------------
// Stage timelines (all instants UTC; the official zone is Africa/Gaborone)
// ---------------------------------------------------------------------------------------------------------

interface StageDates {
  readonly moderationOpened: string;
  readonly moderationFinalized: string | null;
  readonly gateReleased: string | null;
  readonly commercialApproved: string | null;
  readonly resultsComputed: string | null;
  readonly reportCreated: string | null;
  readonly reportSubmitted: string | null;
  readonly reportSignedOff: string | null;
}

const DATES: Record<Stage, StageDates> = {
  signed_off: {
    moderationOpened: '2026-09-07T07:00:00Z',
    moderationFinalized: '2026-09-08T14:00:00Z',
    gateReleased: '2026-09-09T08:00:00Z',
    commercialApproved: '2026-09-15T13:00:00Z',
    resultsComputed: '2026-09-16T08:00:00Z',
    reportCreated: '2026-09-16T08:10:00Z',
    reportSubmitted: '2026-09-17T07:00:00Z',
    reportSignedOff: '2026-09-24T12:30:00Z',
  },
  report_draft: {
    moderationOpened: '2026-09-09T07:00:00Z',
    moderationFinalized: '2026-09-10T15:00:00Z',
    gateReleased: '2026-09-11T08:00:00Z',
    commercialApproved: '2026-09-22T14:00:00Z',
    resultsComputed: '2026-09-28T08:00:00Z',
    reportCreated: '2026-09-28T08:15:00Z',
    reportSubmitted: null,
    reportSignedOff: null,
  },
  commercial_draft: {
    moderationOpened: '2026-09-11T07:00:00Z',
    moderationFinalized: '2026-09-14T13:00:00Z',
    gateReleased: '2026-09-16T08:00:00Z',
    commercialApproved: null,
    resultsComputed: null,
    reportCreated: null,
    reportSubmitted: null,
    reportSignedOff: null,
  },
  gate_ready: {
    moderationOpened: '2026-09-25T07:00:00Z',
    moderationFinalized: '2026-09-28T14:30:00Z',
    gateReleased: null,
    commercialApproved: null,
    resultsComputed: null,
    reportCreated: null,
    reportSubmitted: null,
    reportSignedOff: null,
  },
  moderation_open: {
    moderationOpened: '2026-09-29T07:00:00Z',
    moderationFinalized: null,
    gateReleased: null,
    commercialApproved: null,
    resultsComputed: null,
    reportCreated: null,
    reportSubmitted: null,
    reportSignedOff: null,
  },
};

/** An instant `minutes` after `at`, as an ISO string without milliseconds. */
function minutesAfter(at: string, minutes: number): string {
  return new Date(Date.parse(at) + minutes * 60_000).toISOString().replace('.000Z', 'Z');
}

const ASSIGNED_AT = '2026-08-24T08:00:00Z';
const TECH_DUE = '2026-09-04T10:00:00Z';
const SUBMITTED = { thato: '2026-09-02T15:20:00Z', kabo: '2026-09-03T11:05:00Z' } as const;

function moderation(lot: LotSpec): FixtureModerationSession {
  const dates = DATES[lot.stage];
  const n = lot.lotNumber;
  const scores: FixtureModeratedScore[] = [];
  lot.bids.forEach((spec, bidIndex) => {
    CRITERIA.forEach((row, criterionIndex) => {
      const agreed = spec.agreed[criterionIndex] ?? '0';
      const thato = spec.thato[criterionIndex] ?? agreed;
      const kabo = spec.kabo[criterionIndex] ?? agreed;
      const unanimous = thato === agreed && kabo === agreed;
      scores.push({
        moderatedScoreId: 150000 + n * 100 + bidIndex * 10 + row.suffix,
        bidId: bidId(n, bidIndex + 1),
        criterionId: criterionId(n, row.suffix),
        finalScore: agreed,
        method: 'consensus',
        reasons: unanimous
          ? `Both assessors scored ${agreed}; agreed without change.`
          : `Agreed ${agreed} after discussing the evidence: T. Mokgosi scored ${thato} and K. Ntsima ${kabo}. Both submitted scores stay on record.`,
        moderatedByUserId: USERS.boitumelo,
        recordedAt: minutesAfter(dates.moderationOpened, (bidIndex * 3 + criterionIndex + 1) * 10),
        supersededById: null,
      });
    });
  });
  return {
    sessionId: 14500 + n,
    method: 'consensus',
    status: dates.moderationFinalized === null ? 'open' : 'finalized',
    notes:
      dates.moderationFinalized === null
        ? `Meeting ${dates.moderationOpened.slice(0, 10)} (B. Kgari, T. Mokgosi, K. Ntsima). Every cell has an agreed score with reasons; the session is ready to be finalized.`
        : 'Meeting with B. Kgari, T. Mokgosi and K. Ntsima. Prices were not available to the committee during moderation.',
    createdAt: dates.moderationOpened,
    finalizedAt: dates.moderationFinalized,
    scores,
  };
}

function priceGate(lot: LotSpec): FixturePriceGate {
  const dates = DATES[lot.stage];
  return {
    applies: true,
    releasedAt: dates.gateReleased,
    releasedByUserId: dates.gateReleased === null ? null : USERS.boitumelo,
    nonPriceCompleteConfirmed: dates.gateReleased === null ? null : true,
    note: dates.gateReleased === null ? null : `Lot ${lot.lotNumber} non-price moderation finalized; commercial envelopes of Lot ${lot.lotNumber} may be opened.`,
  };
}

function commercialRow(lot: LotSpec, index: number, approved: boolean): FixtureCommercialRow {
  const spec = lot.bids[index];
  if (spec === undefined) {
    throw new Error(`Lot ${lot.lotNumber} has no bid ${index + 1}.`);
  }
  const n = lot.lotNumber;
  const id = bidId(n, index + 1);
  const pendingCorrection = lot.stage === 'commercial_draft' && index === 0;
  const flagged = lot.stage === 'commercial_draft' && index === 1;
  const submitted = pendingCorrection ? '405500.00' : spec.cost;
  const oneTime = round(mul(spec.cost, '0.88'), 2);
  const support = round(sub(spec.cost, oneTime), 2);
  return {
    commercialEvaluationId: 14600 + n * 10 + index + 1,
    bidId: id,
    revisionId: id * 10 + 1,
    submittedTotal: { amount: submitted, currency: 'BWP' },
    arithmeticCorrection: pendingCorrection ? { amount: '6500.00', currency: 'BWP' } : null,
    correctionRule: pendingCorrection
      ? 'Unit rate prevails over the extended line total (ITT §28.2): line 2.1 was extended as 26 × 7,500.00 = 188,500.00 instead of 195,000.00.'
      : null,
    correctionStatus: pendingCorrection ? 'pending_approval' : 'none',
    correctionProposedByUserId: pendingCorrection ? USERS.lesego : null,
    correctionProposedAt: pendingCorrection ? '2026-09-25T09:40:00Z' : null,
    correctionApprovedByUserId: null,
    supplierAckAt: null,
    fx: null,
    evaluatedCost: { amount: spec.cost, currency: 'BWP' },
    costComponents: [
      {
        label: 'Equipment, installation and commissioning (one-time)',
        amount: { amount: oneTime, currency: 'BWP' },
        includedInEvaluation: true,
        note: pendingCorrection ? 'Includes the proposed 6,500.00 arithmetic correction of line 2.1.' : null,
      },
      { label: 'Calibration and support × 2 evaluation years', amount: { amount: support, currency: 'BWP' }, includedInEvaluation: true, note: null },
    ],
    excludedItemsNote: null,
    assumptions: null,
    abnormallyLowFlag: flagged,
    abnormallyLowOutcome: flagged ? 'pending' : null,
    abnormallyLowReview: flagged
      ? 'Flagged on 25 Sep 2026: the offer is 42% below the other offer in this lot. A written explanation was requested; the offer is not rejected on price grounds without the documented review.'
      : null,
    inReferenceSet: true,
    referenceExclusionReason: null,
    affordability: 'within_budget',
    status: approved ? 'approved' : 'draft',
  };
}

function commercial(lot: LotSpec): FixtureCommercial {
  const dates = DATES[lot.stage];
  if (dates.gateReleased === null) {
    return {
      status: 'not_started',
      reviewerUserId: null,
      taxTreatment: 'All amounts exclusive of 14% VAT; VAT is excluded from comparison.',
      basisNote: `Evaluated cost = Lot ${lot.lotNumber} equipment, installation and 24 months of calibration and support, in BWP.`,
      approvedAt: null,
      approvedByUserId: null,
      rows: [],
    };
  }
  const approved = dates.commercialApproved !== null;
  return {
    status: approved ? 'approved' : 'draft',
    reviewerUserId: USERS.refilwe,
    taxTreatment: 'All amounts exclusive of 14% VAT; VAT is excluded from comparison.',
    basisNote: `Evaluated cost = Lot ${lot.lotNumber} equipment, installation and 24 months of calibration and support, in BWP.`,
    approvedAt: dates.commercialApproved,
    approvedByUserId: approved ? USERS.refilwe : null,
    rows: [commercialRow(lot, 0, approved), commercialRow(lot, 1, approved)],
  };
}

function results(lot: LotSpec): FixtureResults {
  const dates = DATES[lot.stage];
  if (dates.resultsComputed === null) {
    return { status: 'not_computed', computedAt: null, facts: [] };
  }
  const costs = lot.bids.map((spec) => spec.cost);
  const lowest = costs.reduce((low, cost) => (Number(cost) < Number(low) ? cost : low));
  return {
    status: lot.stage === 'signed_off' ? 'signed_off' : 'draft',
    computedAt: dates.resultsComputed,
    facts: lot.bids.map((spec, index) => {
      const price = round(div(mul(lowest, '30'), spec.cost, 4), 2);
      return {
        resultId: 14700 + lot.lotNumber * 10 + index + 1,
        bidId: bidId(lot.lotNumber, index + 1),
        gateFailures: [],
        explanation: `Agreed ratings ${spec.agreed.join(' / ')} give ${nonPriceTotal(spec)} non-price points; evaluated cost BWP ${Number(spec.cost).toLocaleString('en-US', { minimumFractionDigits: 2 })} gives ${price} price points.`,
        tieBreakApplied: null,
      };
    }),
  };
}

const COMMITTEE = [USERS.boitumelo, USERS.thato, USERS.kabo, USERS.refilwe] as const;

function reports(lot: LotSpec): FixtureReport[] {
  const dates = DATES[lot.stage];
  if (dates.reportCreated === null) {
    return [];
  }
  const signedOff = dates.reportSignedOff !== null;
  const signedAt = ['2026-09-17T07:05:00Z', '2026-09-18T09:30:00Z', '2026-09-22T06:50:00Z', dates.reportSignedOff ?? '2026-09-24T12:30:00Z'];
  const first = lot.bids[0];
  const second = lot.bids[1];
  const recommended = lot.stage === 'report_draft' ? bidId(lot.lotNumber, 2) : bidId(lot.lotNumber, 1);
  return [
    {
      reportId: 14800 + lot.lotNumber,
      version: 1,
      status: signedOff ? 'signed_off' : 'draft',
      summary: signedOff
        ? `Evaluation of two offers for Lot ${lot.lotNumber} (${lot.title}). ${supplierName(first.supplierTenantId)} ranks first with 86.00 points; ${supplierName(second.supplierTenantId)} second with 75.00. Both offers are within the budget.`
        : null,
      documentId: signedOff ? 148010 + lot.lotNumber : null,
      createdAt: dates.reportCreated,
      createdByUserId: USERS.boitumelo,
      submittedForSignoffAt: dates.reportSubmitted,
      signedOffAt: dates.reportSignedOff,
      handedOffAt: null,
      recommendedBidId: recommended,
      signoffs: COMMITTEE.map((userId, index) => ({
        signoffId: signedOff ? 148100 + lot.lotNumber * 10 + index + 1 : null,
        userId,
        decision: signedOff ? ('signed' as const) : null,
        note: null,
        decidedAt: signedOff ? (signedAt[index] ?? null) : null,
      })),
    },
  ];
}

function timeline(lot: LotSpec): FixtureTimelineEvent[] {
  const dates = DATES[lot.stage];
  const n = lot.lotNumber;
  const events: FixtureTimelineEvent[] = [
    { at: '2026-08-20T10:00:00Z', title: 'Submission deadline passed', actorUserId: null, detail: 'Two submissions for this lot.' },
    { at: '2026-08-21T07:02:44Z', title: 'Technical envelopes opened', actorUserId: null, detail: null },
    { at: ASSIGNED_AT, title: 'Evaluators assigned', actorUserId: USERS.boitumelo, detail: 'Two technical evaluators.' },
    { at: SUBMITTED.kabo, title: 'Both technical assessments submitted', actorUserId: null, detail: null },
    { at: dates.moderationOpened, title: 'Moderation session opened (consensus)', actorUserId: USERS.boitumelo, detail: null },
  ];
  if (dates.moderationFinalized !== null) {
    events.push({ at: dates.moderationFinalized, title: 'Moderation finalized (consensus)', actorUserId: USERS.boitumelo, detail: null });
  }
  if (dates.gateReleased !== null) {
    events.push({ at: dates.gateReleased, title: `Lot ${n} price gate released`, actorUserId: USERS.boitumelo, detail: null });
  }
  if (lot.stage === 'commercial_draft') {
    events.push({
      at: '2026-09-25T09:40:00Z',
      title: 'Arithmetic correction proposed (Supplier A)',
      actorUserId: USERS.lesego,
      detail: 'Awaiting approval by the commercial reviewer; Supplier B flagged as abnormally low.',
    });
  }
  if (dates.commercialApproved !== null) {
    events.push({ at: dates.commercialApproved, title: 'Commercial comparison approved', actorUserId: USERS.refilwe, detail: null });
  }
  if (dates.resultsComputed !== null) {
    events.push({ at: dates.resultsComputed, title: 'Results computed', actorUserId: USERS.boitumelo, detail: null });
  }
  if (dates.reportSubmitted !== null) {
    events.push({ at: dates.reportSubmitted, title: 'Report v1 submitted for sign-off', actorUserId: USERS.boitumelo, detail: null });
  }
  if (dates.reportSignedOff !== null) {
    events.push({ at: dates.reportSignedOff, title: 'Report v1 signed off by the committee', actorUserId: null, detail: 'Ready to pass to the award recommendation.' });
  }
  return events;
}

function assignments(lot: LotSpec, key: string): FixtureAssignment[] {
  const n = lot.lotNumber;
  const dates = DATES[lot.stage];
  const finalized = dates.moderationFinalized !== null;
  const technical = (k: number, userId: number, submittedAt: string): FixtureAssignment => {
    const id = assignmentId(n, k);
    return {
      assignmentId: id,
      tenantId: KWU,
      evaluationKey: key,
      evaluatorUserId: userId,
      bidId: null,
      criterionIds: [],
      isCommercial: false,
      dueAt: TECH_DUE,
      status: lot.stage === 'signed_off' || lot.stage === 'report_draft' ? 'finalized' : 'submitted',
      createdAt: ASSIGNED_AT,
      acceptedAt: '2026-08-24T10:00:00Z',
      submittedAt,
      undertaking: { undertakingId: id * 10 + 1, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-08-24T10:00:00Z' },
      conflictDeclaration: {
        declarationId: id * 10 + 2,
        hasConflict: false,
        nature: null,
        supplierTenantId: null,
        details: null,
        declaredAt: '2026-08-24T10:00:00Z',
        disposition: 'cleared',
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
      reassignedToAssignmentId: null,
      reassignmentReason: null,
      reassignmentRequestedAt: null,
      returnReason: null,
      history: [
        { at: ASSIGNED_AT, event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
        { at: '2026-08-24T10:00:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: userId, note: null },
        { at: submittedAt, event: 'Assessment submitted', actorUserId: userId, note: null },
        ...(finalized && dates.moderationFinalized !== null
          ? [{ at: dates.moderationFinalized, event: 'Moderation finalized', actorUserId: USERS.boitumelo, note: null }]
          : []),
      ],
    };
  };
  const rows = [technical(1, USERS.thato, SUBMITTED.thato), technical(2, USERS.kabo, SUBMITTED.kabo)];
  if (dates.gateReleased !== null) {
    const id = assignmentId(n, 3);
    const approved = dates.commercialApproved !== null;
    rows.push({
      assignmentId: id,
      tenantId: KWU,
      evaluationKey: key,
      evaluatorUserId: USERS.refilwe,
      bidId: null,
      criterionIds: [priceCriterionId(n)],
      isCommercial: true,
      dueAt: approved ? '2026-09-25T10:00:00Z' : '2026-10-06T10:00:00Z',
      status: approved ? 'submitted' : 'in_progress',
      createdAt: dates.gateReleased,
      acceptedAt: dates.gateReleased,
      submittedAt: dates.commercialApproved,
      undertaking: { undertakingId: id * 10 + 1, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: dates.gateReleased },
      conflictDeclaration: {
        declarationId: id * 10 + 2,
        hasConflict: false,
        nature: null,
        supplierTenantId: null,
        details: null,
        declaredAt: dates.gateReleased,
        disposition: 'cleared',
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
      reassignedToAssignmentId: null,
      reassignmentReason: null,
      reassignmentRequestedAt: null,
      returnReason: null,
      history: [
        { at: dates.gateReleased, event: 'Assigned (commercial comparison); accepted with undertaking', actorUserId: USERS.refilwe, note: null },
        ...(approved && dates.commercialApproved !== null
          ? [{ at: dates.commercialApproved, event: 'Commercial comparison approved', actorUserId: USERS.refilwe, note: null }]
          : []),
      ],
    });
  }
  return rows;
}

function scores(lot: LotSpec): FixtureScore[] {
  const n = lot.lotNumber;
  const cells = (who: 'thato' | 'kabo') =>
    lot.bids.flatMap((spec, bidIndex) =>
      CRITERIA.map((row, criterionIndex) => ({
        bidId: bidId(n, bidIndex + 1),
        criterionId: criterionId(n, row.suffix),
        score: spec[who][criterionIndex] ?? null,
        rationale: `${spec.answers[criterionIndex] ?? row.name} Rated against the anchors of the approved plan.`,
        evidenceRefs: [`${row.name} evidence`],
      })),
    );
  return [
    ...scoreRows(assignmentId(n, 1), 'submitted', SUBMITTED.thato, cells('thato')),
    ...scoreRows(assignmentId(n, 2), 'submitted', SUBMITTED.kabo, cells('kabo')),
  ];
}

function lotSet(lot: LotSpec): EvaluationFixtureSet {
  const key = `T-2026-0014/${lot.lotNumber}`;
  const lotRef: EvaluationLotRef = { lotId: lotId(lot.lotNumber), lotNumber: lot.lotNumber, title: lot.title };
  const evaluation: FixtureEvaluation = {
    key,
    tenantId: KWU,
    chairUserId: USERS.boitumelo,
    tenderOwnerUserId: USERS.tebogo,
    tender: TENDER,
    lot: lotRef,
    plan: plan(lot.lotNumber),
    bids: bids(lot),
    budget: { amount: lot.budget, currency: 'BWP' },
    priceGate: priceGate(lot),
    divergenceThreshold: '1',
    moderation: moderation(lot),
    commercial: commercial(lot),
    results: results(lot),
    lotConstraintNote: LOT_CONSTRAINT_NOTE,
    reports: reports(lot),
    timeline: timeline(lot),
  };
  return { evaluation, assignments: assignments(lot, key), scores: scores(lot) };
}

/** One fixture set per lot, in lot order. */
export const T_2026_0014_LOTS: readonly EvaluationFixtureSet[] = LOTS.map(lotSet);
