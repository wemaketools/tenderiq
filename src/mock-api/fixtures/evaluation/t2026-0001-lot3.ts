/**
 * T-2026-0001 Borehole pump replacement programme, Lot 3 "Pump control panels and telemetry" (KWU, tender / open,
 * staged opening). Lot 1 is awarded and Lot 2 cancelled (awards domain); Lot 3 is still under evaluation
 * (docs/plan/demo-storyline.md, AC-26). The Lot 3 technical evaluation restarted in September after the panel
 * specification clarification, so its price gate is released per lot and is still closed (DD-02, AC-16):
 * - Thato Mokgosi submitted; the chair is reviewing one rationale that cites the Lot 1 programme (return or
 *   correction are both still possible because moderation is open);
 * - Kabo Ntsima has not accepted the assignment yet (declarations first, BR-08);
 * - moderation (declared method: average) is open and cannot be finalized: assessments are incomplete;
 * - prices stay unavailable until the Lot 3 price gate is released.
 */
import { GABORONE_TZ, KWU, KWU_UNDERTAKING, SCALE_ANCHORS_0_5, SUPPLIERS, USERS, scoreRows, supplierName } from './common.js';
import type { EvaluationFixtureSet, FixtureAssignment, FixtureBid, FixtureEvaluation } from './types.js';

const TENDER_ID = 1;
const LOT_ID = 103;
const DESIGN = 131;
const SUPPORT = 132;
const STANDARDS = 133;
const PRICE = 134;
const TSODILO = 1001;
const CHOBE = 1002;

const requirementText = {
  design:
    'Describe the pump control panel design for 36 boreholes: starters, protection (dry-run, phase failure, ' +
    'over-current), local HMI and the telemetry interface to the SCADA network.',
  support: 'Provide the manufacturing and delivery programme, spares holding and the after-sales support arrangement.',
  standards: 'Confirm compliance with IEC 61439-2, the ingress protection rating and the safety features of the panels.',
} as const;

const bids: FixtureBid[] = [
  {
    bidId: TSODILO,
    supplierTenantId: SUPPLIERS.tsodilo,
    supplierName: supplierName(SUPPLIERS.tsodilo),
    label: 'Supplier A',
    receiptNo: 'RCPT-2026-000014',
    receivedAt: '2026-07-23T14:05:00Z',
    revisionId: 10011,
    complianceStatus: 'compliant',
    evaluationStatus: 'in_evaluation',
    eligible: true,
    sealedReason: null,
    responses: [
      {
        criterionId: DESIGN,
        requirements: [
          {
            requirementId: 1031,
            refCode: 'L3-REQ-01',
            requirementText: requirementText.design,
            answerText:
              'Soft starters with dry-run, phase-failure and over-current protection; 7-inch local HMI with alarm ' +
              'history; Modbus TCP and RTU ports pre-configured for the SCADA upgrade; remote reset from the control room.',
            isDeviation: false,
            documents: [{ documentId: 71101, title: 'Panel general arrangement', fileName: 'tsodilo-lot3-panel-ga.pdf' }],
          },
        ],
      },
      {
        criterionId: SUPPORT,
        requirements: [
          {
            requirementId: 1032,
            refCode: 'L3-REQ-02',
            requirementText: requirementText.support,
            answerText:
              'Panels built in Maun in three batches over 14 weeks; 10% spares held in Maun; 4-hour telephone ' +
              'response and 48-hour site response for 24 months.',
            isDeviation: false,
            documents: [{ documentId: 71102, title: 'Programme and support plan', fileName: 'tsodilo-lot3-programme.pdf' }],
          },
        ],
      },
      {
        criterionId: STANDARDS,
        requirements: [
          {
            requirementId: 1033,
            refCode: 'L3-REQ-03',
            requirementText: requirementText.standards,
            answerText: 'Type-tested to IEC 61439-2; IP55 stainless enclosures; lockable isolators and surge protection.',
            isDeviation: false,
            documents: [{ documentId: 71103, title: 'Type-test certificate', fileName: 'tsodilo-iec61439-certificate.pdf' }],
          },
        ],
      },
    ],
  },
  {
    bidId: CHOBE,
    supplierTenantId: SUPPLIERS.chobePipe,
    supplierName: supplierName(SUPPLIERS.chobePipe),
    label: 'Supplier B',
    receiptNo: 'RCPT-2026-000013',
    receivedAt: '2026-07-22T11:30:00Z',
    revisionId: 10021,
    complianceStatus: 'pending',
    evaluationStatus: 'in_evaluation',
    eligible: true,
    sealedReason: null,
    responses: [
      {
        criterionId: DESIGN,
        requirements: [
          {
            requirementId: 1031,
            refCode: 'L3-REQ-01',
            requirementText: requirementText.design,
            answerText:
              'Direct-on-line starters (soft starters optional); dry-run and phase-failure relays; indicator lamps ' +
              'instead of an HMI; a Modbus RTU gateway can be added at site.',
            isDeviation: true,
            documents: [{ documentId: 71201, title: 'Panel schematic', fileName: 'chobe-lot3-schematic.pdf' }],
          },
        ],
      },
      {
        criterionId: SUPPORT,
        requirements: [
          {
            requirementId: 1032,
            refCode: 'L3-REQ-02',
            requirementText: requirementText.support,
            answerText: 'Panels imported from a Johannesburg builder in one batch (18 weeks); spares on request; 12-month support.',
            isDeviation: false,
            documents: [{ documentId: 71202, title: 'Programme', fileName: 'chobe-lot3-programme.pdf' }],
          },
        ],
      },
      {
        criterionId: STANDARDS,
        requirements: [
          {
            requirementId: 1033,
            refCode: 'L3-REQ-03',
            requirementText: requirementText.standards,
            answerText: 'Builder states IEC 61439 design verification; IP54 painted steel enclosures (deviation from IP55).',
            isDeviation: true,
            documents: [{ documentId: 71203, title: 'Builder declaration', fileName: 'chobe-builder-declaration.pdf' }],
          },
        ],
      },
    ],
  },
];

const evaluation: FixtureEvaluation = {
  key: 'T-2026-0001/3',
  tenantId: KWU,
  chairUserId: USERS.boitumelo,
  tenderOwnerUserId: USERS.tebogo,
  tender: {
    tenderId: TENDER_ID,
    reference: 'T-2026-0001',
    title: 'Borehole pump replacement programme',
    status: 'partially_awarded',
    officialTimeZone: GABORONE_TZ,
    openingMode: 'staged',
    awardModel: 'per_lot',
    maxLotsPerSupplier: 2,
    independentEvaluation: true,
    anonymizedEvaluation: false,
    anonymizationLimitations: null,
  },
  lot: { lotId: LOT_ID, lotNumber: 3, title: 'Pump control panels and telemetry' },
  plan: {
    planId: 13,
    version: 1,
    status: 'approved',
    scaleMax: 5,
    aggregationMethod: 'average',
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
    fxDate: '2026-07-15',
    approvedAt: '2026-05-28T09:00:00Z',
    criteria: [
      {
        criterionId: DESIGN,
        parentId: null,
        code: 'L3-C1',
        name: 'Panel design and functionality',
        description: 'Starters, protection, local HMI and telemetry interface.',
        maxPoints: '40',
        isPrice: false,
        minScore: '2',
        scoringGuidance:
          'Minimum rating 2 (criterion threshold). A 3 needs every listed protection and a Modbus interface; soft ' +
          'starters and a local HMI raise the rating.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 1,
      },
      {
        criterionId: SUPPORT,
        parentId: null,
        code: 'L3-C2',
        name: 'Delivery and after-sales support',
        description: 'Manufacturing programme, spares and support response.',
        maxPoints: '20',
        isPrice: false,
        minScore: null,
        scoringGuidance: 'A 3 needs delivery within 16 weeks, local spares and a 24-month support commitment.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 2,
      },
      {
        criterionId: STANDARDS,
        parentId: null,
        code: 'L3-C3',
        name: 'Standards compliance and safety',
        description: 'IEC 61439-2 verification, ingress protection and safety features.',
        maxPoints: '10',
        isPrice: false,
        minScore: null,
        scoringGuidance: 'A 3 needs IEC 61439-2 verification and IP55; type-test certificates raise the rating.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 3,
      },
      {
        criterionId: PRICE,
        parentId: null,
        code: 'L3-C4',
        name: 'Price',
        description: 'Evaluated cost of Lot 3, scored by the published formula.',
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
      { sequence: 1, rule: 'highest_criterion', criterionId: DESIGN },
      { sequence: 2, rule: 'lowest_evaluated_cost', criterionId: null },
    ],
  },
  bids,
  budget: { amount: '1450000.00', currency: 'BWP' },
  priceGate: { applies: true, releasedAt: null, releasedByUserId: null, nonPriceCompleteConfirmed: null, note: null },
  divergenceThreshold: '1',
  moderation: {
    sessionId: 1501,
    method: 'average',
    status: 'open',
    notes:
      'Pre-read: T. Mokgosi’s rationale for Supplier B delivery and support cites the Lot 1 supply programme; check ' +
      'against L3-REQ-02 before moderation.',
    createdAt: '2026-09-28T07:30:00Z',
    finalizedAt: null,
    scores: [],
  },
  commercial: {
    status: 'not_started',
    reviewerUserId: null,
    taxTreatment: 'All amounts exclusive of 14% VAT; VAT is excluded from comparison.',
    basisNote: 'Evaluated cost = Lot 3 panels, telemetry interfaces and 24 months of support; Lots 1 and 2 are evaluated separately.',
    approvedAt: null,
    approvedByUserId: null,
    rows: [],
  },
  results: { status: 'not_computed', computedAt: null, facts: [] },
  lotConstraintNote:
    'Per-lot award; a supplier may be awarded at most 2 of the 3 lots. Lot 1 is awarded to Tsodilo Engineering and ' +
    'Lot 2 was cancelled, so an award of Lot 3 to Tsodilo remains within the limit.',
  reports: [],
  timeline: [
    { at: '2026-07-24T08:00:00Z', title: 'Submission deadline passed', actorUserId: null, detail: null },
    { at: '2026-07-28T07:03:40Z', title: 'Technical envelopes opened', actorUserId: null, detail: null },
    {
      at: '2026-09-18T08:00:00Z',
      title: 'Lot 3 panel specification clarified',
      actorUserId: USERS.boitumelo,
      detail: 'Lot 3 technical evaluation restarted on the clarified specification; Lots 1 and 2 were not affected.',
    },
    { at: '2026-09-21T10:00:00Z', title: 'Evaluators assigned', actorUserId: USERS.boitumelo, detail: 'Two technical evaluators.' },
    { at: '2026-09-26T13:00:00Z', title: 'Assessment submitted', actorUserId: USERS.thato, detail: null },
    {
      at: '2026-09-28T07:30:00Z',
      title: 'Moderation session opened (average)',
      actorUserId: USERS.boitumelo,
      detail: 'Waiting for the second assessment before moderation.',
    },
  ],
};

const DUE = '2026-10-09T10:00:00Z';

const assignments: FixtureAssignment[] = [
  {
    assignmentId: 1001,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.thato,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'submitted',
    createdAt: '2026-09-21T10:00:00Z',
    acceptedAt: '2026-09-21T11:15:00Z',
    submittedAt: '2026-09-26T13:00:00Z',
    undertaking: { undertakingId: 10011, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-09-21T11:15:00Z' },
    conflictDeclaration: {
      declarationId: 10012,
      hasConflict: false,
      nature: null,
      supplierTenantId: null,
      details: null,
      declaredAt: '2026-09-21T11:15:00Z',
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
      { at: '2026-09-21T10:00:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-09-21T11:15:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.thato, note: null },
      { at: '2026-09-26T13:00:00Z', event: 'Assessment submitted', actorUserId: USERS.thato, note: null },
    ],
  },
  {
    assignmentId: 1002,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.kabo,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'not_started',
    createdAt: '2026-09-21T10:00:00Z',
    acceptedAt: null,
    submittedAt: null,
    undertaking: null,
    conflictDeclaration: null,
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [{ at: '2026-09-21T10:00:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null }],
  },
];

const scores = scoreRows(1001, 'submitted', '2026-09-26T13:00:00Z', [
  {
    bidId: TSODILO,
    criterionId: DESIGN,
    score: '4',
    rationale: 'Soft starters, full protection set and a pre-configured Modbus interface exceed the requirement.',
    evidenceRefs: ['Panel general arrangement'],
  },
  {
    bidId: TSODILO,
    criterionId: SUPPORT,
    score: '3.5',
    rationale: 'Local manufacture in three batches; spares in Maun; 24-month support.',
    evidenceRefs: ['Programme and support plan'],
  },
  { bidId: TSODILO, criterionId: STANDARDS, score: '4', rationale: 'Type-tested panels with IP55 stainless enclosures.', evidenceRefs: ['Type-test certificate'] },
  {
    bidId: CHOBE,
    criterionId: DESIGN,
    score: '3',
    rationale: 'Protection relays present but DOL starters and no HMI; Modbus gateway only as a site addition (declared deviation).',
    evidenceRefs: ['Panel schematic'],
    clarificationQuestion: 'Is the Modbus RTU gateway included in the offered price or an optional extra?',
  },
  { bidId: CHOBE, criterionId: SUPPORT, score: '3', rationale: 'Programme follows the Lot 1 delivery schedule.', evidenceRefs: ['Programme'] },
  { bidId: CHOBE, criterionId: STANDARDS, score: '2.5', rationale: 'IP54 deviation and a builder declaration instead of a type test.', evidenceRefs: ['Builder declaration'] },
]);

export const T_2026_0001_LOT_3: EvaluationFixtureSet = { evaluation, assignments, scores };
