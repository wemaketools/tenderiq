/**
 * T-2026-0003 SCADA telemetry upgrade (KWU, rfp / open, staged opening, `under_assessment`): the PRD §9.2 worked
 * example (docs/plan/demo-storyline.md; docs/technical/03-data-model/09-opening-evaluation.md §9, §14).
 *
 * - Supplier A = Serowe ICT Solutions: agreed ratings 4 / 4 / 4 → 28.00 + 16.00 + 12.00 = 56.00 non-price points;
 *   evaluated cost BWP 100,000.00 (submitted 99,550.00 + approved arithmetic correction 450.00) → price 30.00;
 *   total 86.00 (AC-19).
 * - Supplier B = Tsodilo Engineering: agreed ratings 4.5 / 4.5 / 4.5 → 31.50 + 18.00 + 13.50 = 63.00; evaluated
 *   cost BWP 120,000.00 (submitted ZAR 160,000.00 at 0.75, original amount visible) → price 25.00; total 88.00;
 *   ranked first although above the BWP 115,000.00 budget (affordability shown separately).
 * - Supplier C = Makgadikgadi Civil Works failed mandatory requirement REQ-Q-03 (ISO 9001); its exclusion awaits
 *   approval, it is not ranked and its commercial envelope stays sealed (AC-17).
 * - Amantle Segwai has not scored "Relevant experience" for Supplier A: her assessment is incomplete, shown as not
 *   scored, and it blocks report sign-off (AC-18).
 * - Moderation changed one score: Kabo Ntsima's 3 for Supplier A "Solution quality" became an agreed 4 with
 *   reasons; his original score stays on record and a provisional moderated value was superseded (AC-20).
 * - Sam Keitumetse (also a Tsodilo contributor) declared a conflict that awaits the chair's review (AC-02).
 */
import { GABORONE_TZ, KWU, KWU_UNDERTAKING, SCALE_ANCHORS_0_5, SUPPLIERS, USERS, scoreRows, supplierName } from './common.js';
import type { EvaluationFixtureSet, FixtureAssignment, FixtureBid, FixtureEvaluation } from './types.js';

const TENDER_ID = 3;
const SQ = 301;
const DA = 302;
const RE = 303;
const PRICE = 304;
const SEROWE = 3001;
const TSODILO = 3002;
const MAKGADIKGADI = 3003;

const bids: FixtureBid[] = [
  {
    bidId: SEROWE,
    supplierTenantId: SUPPLIERS.seroweIct,
    supplierName: supplierName(SUPPLIERS.seroweIct),
    label: 'Supplier A',
    receiptNo: 'RCPT-2026-000019',
    receivedAt: '2026-08-27T15:10:00Z',
    revisionId: 30011,
    complianceStatus: 'clarification_pending',
    evaluationStatus: 'in_evaluation',
    eligible: true,
    sealedReason: null,
    responses: [
      {
        criterionId: SQ,
        requirements: [
          {
            requirementId: 3011,
            refCode: 'REQ-T-01',
            requirementText:
              'Describe the proposed telemetry architecture for the 42 reservoir and borehole sites, including radio ' +
              'paths, master station redundancy and the migration from the existing Modbus RTUs.',
            answerText:
              'Dual-path licensed UHF radio with LTE fallback at every site; a hot-standby master station pair in ' +
              'Gaborone and Serowe (drawing SCADA-D-07 rev C). Existing Modbus RTUs are replaced in four waves with ' +
              'protocol gateways kept live until each wave is commissioned.',
            isDeviation: false,
            documents: [
              { documentId: 73101, title: 'Technical proposal', fileName: 'serowe-ict-technical-proposal.pdf' },
              { documentId: 73102, title: 'Network architecture drawings', fileName: 'SCADA-D-07-revC.pdf' },
            ],
          },
          {
            requirementId: 3012,
            refCode: 'REQ-T-02',
            requirementText: 'Explain how the solution meets the IEC 62443 security level SL2 target.',
            answerText:
              'Zone and conduit model with a DMZ historian, role-based access on the HMI and signed firmware. SL2 ' +
              'is met for the control zone; the corporate conduit relies on KWU firewalls (stated assumption).',
            isDeviation: false,
            documents: [{ documentId: 73103, title: 'Cybersecurity statement', fileName: 'serowe-iec62443-statement.pdf' }],
          },
        ],
      },
      {
        criterionId: DA,
        requirements: [
          {
            requirementId: 3013,
            refCode: 'REQ-T-05',
            requirementText: 'Provide the delivery programme, resourcing and cut-over approach within 26 weeks.',
            answerText:
              '24-week programme in four regional waves; two field teams of three technicians; night cut-overs with ' +
              'a manual fallback procedure agreed with the control room for each wave.',
            isDeviation: false,
            documents: [{ documentId: 73104, title: 'Delivery programme', fileName: 'serowe-programme-gantt.pdf' }],
          },
        ],
      },
      {
        criterionId: RE,
        requirements: [
          {
            requirementId: 3014,
            refCode: 'REQ-T-08',
            requirementText: 'Provide three comparable telemetry projects completed in the last five years with referees.',
            answerText:
              'Water Utilities Corporation north-east telemetry (2023, 31 sites); Francistown City Council pump ' +
              'station SCADA (2024); Debswana Orapa process network upgrade (2022). Referees and contact details ' +
              'attached.',
            isDeviation: false,
            documents: [{ documentId: 73105, title: 'Project references', fileName: 'serowe-references.pdf' }],
          },
        ],
      },
    ],
  },
  {
    bidId: TSODILO,
    supplierTenantId: SUPPLIERS.tsodilo,
    supplierName: supplierName(SUPPLIERS.tsodilo),
    label: 'Supplier B',
    receiptNo: 'RCPT-2026-000020',
    receivedAt: '2026-08-28T07:55:00Z',
    revisionId: 30021,
    complianceStatus: 'compliant',
    evaluationStatus: 'in_evaluation',
    eligible: true,
    sealedReason: null,
    responses: [
      {
        criterionId: SQ,
        requirements: [
          {
            requirementId: 3011,
            refCode: 'REQ-T-01',
            requirementText:
              'Describe the proposed telemetry architecture for the 42 reservoir and borehole sites, including radio ' +
              'paths, master station redundancy and the migration from the existing Modbus RTUs.',
            answerText:
              'Meshed licensed radio with automatic path selection plus satellite backup at the 9 remote boreholes; ' +
              'geo-redundant virtualised masters with automatic failover tested monthly. Existing RTUs are kept as ' +
              'I/O concentrators where hardware is less than five years old, reducing site disruption.',
            isDeviation: false,
            documents: [
              { documentId: 73201, title: 'Technical proposal', fileName: 'tsodilo-technical-proposal.pdf' },
              { documentId: 73202, title: 'Radio path survey', fileName: 'tsodilo-radio-survey.pdf' },
            ],
          },
          {
            requirementId: 3012,
            refCode: 'REQ-T-02',
            requirementText: 'Explain how the solution meets the IEC 62443 security level SL2 target.',
            answerText:
              'SL2 for every zone including the corporate conduit, with an independent penetration test before ' +
              'go-live and quarterly vulnerability reports during support.',
            isDeviation: false,
            documents: [{ documentId: 73203, title: 'Security design', fileName: 'tsodilo-security-design.pdf' }],
          },
        ],
      },
      {
        criterionId: DA,
        requirements: [
          {
            requirementId: 3013,
            refCode: 'REQ-T-05',
            requirementText: 'Provide the delivery programme, resourcing and cut-over approach within 26 weeks.',
            answerText:
              '22-week programme; three field teams; factory acceptance test of every RTU panel in Maun before ' +
              'dispatch; site cut-overs under 2 hours with parallel running of old and new masters for two weeks.',
            isDeviation: false,
            documents: [{ documentId: 73204, title: 'Delivery programme', fileName: 'tsodilo-programme.pdf' }],
          },
        ],
      },
      {
        criterionId: RE,
        requirements: [
          {
            requirementId: 3014,
            refCode: 'REQ-T-08',
            requirementText: 'Provide three comparable telemetry projects completed in the last five years with referees.',
            answerText:
              'Namibia Water Corporation eastern bulk supply SCADA (2024, 58 sites); Maun water supply telemetry ' +
              '(2023); Botswana Power Corporation substation RTU replacement (2022). Referees attached.',
            isDeviation: false,
            documents: [{ documentId: 73205, title: 'Project references', fileName: 'tsodilo-references.pdf' }],
          },
        ],
      },
    ],
  },
  {
    bidId: MAKGADIKGADI,
    supplierTenantId: SUPPLIERS.makgadikgadi,
    supplierName: supplierName(SUPPLIERS.makgadikgadi),
    label: 'Supplier C',
    receiptNo: 'RCPT-2026-000018',
    receivedAt: '2026-08-26T12:00:00Z',
    revisionId: 30031,
    complianceStatus: 'non_compliant',
    evaluationStatus: 'not_started',
    eligible: false,
    sealedReason:
      'Mandatory requirement REQ-Q-03 (ISO 9001 certificate) failed at compliance review; the exclusion awaits ' +
      'approval. The commercial envelope stays sealed and the bid is not ranked.',
    responses: [],
  },
];

const evaluation: FixtureEvaluation = {
  key: 'T-2026-0003',
  tenantId: KWU,
  chairUserId: USERS.boitumelo,
  tenderOwnerUserId: USERS.tebogo,
  tender: {
    tenderId: TENDER_ID,
    reference: 'T-2026-0003',
    title: 'SCADA telemetry upgrade',
    status: 'under_assessment',
    officialTimeZone: GABORONE_TZ,
    openingMode: 'staged',
    awardModel: 'single',
    maxLotsPerSupplier: null,
    independentEvaluation: true,
    anonymizedEvaluation: false,
    anonymizationLimitations: null,
  },
  lot: null,
  plan: {
    planId: 30,
    version: 1,
    status: 'approved',
    scaleMax: 5,
    aggregationMethod: 'consensus',
    priceMethod: 'lowest_ratio',
    priceWeight: '30',
    priceFormulaNote:
      "Price points = lowest evaluated cost in the reference set ÷ this offer's evaluated cost × 30 (ITT §5.4).",
    zeroPriceTreatment: 'A zero or negative total is non-comparable and is referred to the committee; it is never scored 30.',
    missingPriceTreatment: 'A missing mandatory price line makes the offer non-comparable; optional lines are not evaluated.',
    thresholdScope: 'non_price_total',
    nonPriceThreshold: '42',
    decimalPlacesCalc: 4,
    decimalPlacesDisplay: 2,
    comparisonCurrency: 'BWP',
    fxSource: 'Bank of Botswana mid-rate',
    fxDate: '2026-09-07',
    approvedAt: '2026-07-28T08:30:00Z',
    criteria: [
      {
        criterionId: SQ,
        parentId: null,
        code: 'C1',
        name: 'Solution quality',
        description: 'Architecture, redundancy, security and fit with the existing network.',
        maxPoints: '35',
        isPrice: false,
        minScore: null,
        scoringGuidance:
          'Rate the design against TS-4.1 to TS-4.6. A 3 needs every site covered with a stated redundant path; a 4 or 5 ' +
          'needs automatic failover evidence and a credible migration plan.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 1,
      },
      {
        criterionId: DA,
        parentId: null,
        code: 'C2',
        name: 'Delivery approach',
        description: 'Programme, resources, cut-over and risk management.',
        maxPoints: '20',
        isPrice: false,
        minScore: null,
        scoringGuidance: 'A 3 needs a programme within 26 weeks with named resources; higher ratings need a tested cut-over method.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 2,
      },
      {
        criterionId: RE,
        parentId: null,
        code: 'C3',
        name: 'Relevant experience',
        description: 'Comparable telemetry projects in the last five years.',
        maxPoints: '15',
        isPrice: false,
        minScore: null,
        scoringGuidance: 'A 3 needs three comparable projects with referees; scale and utility context raise the rating.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 3,
      },
      {
        criterionId: PRICE,
        parentId: null,
        code: 'C4',
        name: 'Price',
        description: 'Evaluated cost over the two-year evaluation period, scored by the published formula.',
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
      { sequence: 3, rule: 'committee_decision', criterionId: null },
    ],
  },
  bids,
  budget: { amount: '115000.00', currency: 'BWP' },
  priceGate: {
    applies: true,
    releasedAt: '2026-09-24T12:00:00Z',
    releasedByUserId: USERS.boitumelo,
    nonPriceCompleteConfirmed: true,
    note:
      'Released on the non-price moderation finalized on 23 September 2026 (one technical score changed by consensus). ' +
      'Confirmed complete except A. Segwai’s C3 Relevant experience score for Supplier A, which awaits a clarification: ' +
      'recorded as not scored, never as zero, and tracked for completion before sign-off.',
  },
  divergenceThreshold: '1',
  moderation: {
    sessionId: 3501,
    method: 'consensus',
    status: 'finalized',
    notes:
      'Meeting 22–23 Sep 2026 (B. Kgari, T. Mokgosi, K. Ntsima; A. Segwai joined by phone). Discussed the divergence on ' +
      'Supplier A solution quality: K. Ntsima had reviewed the superseded drawing set (rev B). After reviewing ' +
      'SCADA-D-07 rev C the committee agreed 4. S. Keitumetse did not attend: conflict declaration pending review.',
    createdAt: '2026-09-22T07:00:00Z',
    finalizedAt: '2026-09-23T15:00:00Z',
    scores: [
      {
        moderatedScoreId: 35001,
        bidId: SEROWE,
        criterionId: SQ,
        finalScore: '3.5',
        method: 'consensus',
        reasons: 'Provisional value recorded before discussion: midpoint of the submitted scores 3 and 4, pending review of the drawing revision.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-23T08:10:00Z',
        supersededById: 35007,
      },
      {
        moderatedScoreId: 35002,
        bidId: SEROWE,
        criterionId: DA,
        finalScore: '4',
        method: 'consensus',
        reasons: 'Both submitted scores are 4; the four-wave programme with manual fallback meets every element with low cut-over risk.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-23T08:40:00Z',
        supersededById: null,
      },
      {
        moderatedScoreId: 35003,
        bidId: SEROWE,
        criterionId: RE,
        finalScore: '4',
        method: 'consensus',
        reasons:
          'Consensus 4 (Good) on the two submitted scores: three comparable utility projects, one at similar scale. ' +
          'A. Segwai’s individual score is outstanding and recorded as not scored; it is not counted as zero.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-23T08:55:00Z',
        supersededById: null,
      },
      {
        moderatedScoreId: 35004,
        bidId: TSODILO,
        criterionId: SQ,
        finalScore: '4.5',
        method: 'consensus',
        reasons: 'All scores 4.5: geo-redundant masters with tested failover and retention of recent RTUs exceed TS-4.1.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-23T09:05:00Z',
        supersededById: null,
      },
      {
        moderatedScoreId: 35005,
        bidId: TSODILO,
        criterionId: DA,
        finalScore: '4.5',
        method: 'consensus',
        reasons: 'Scores aligned at 4.5 after T. Mokgosi’s recorded correction; factory testing and parallel running reduce cut-over risk.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-23T09:15:00Z',
        supersededById: null,
      },
      {
        moderatedScoreId: 35006,
        bidId: TSODILO,
        criterionId: RE,
        finalScore: '4.5',
        method: 'consensus',
        reasons: 'All scores 4.5: three comparable projects including a larger bulk-supply network.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-23T09:25:00Z',
        supersededById: null,
      },
      {
        moderatedScoreId: 35007,
        bidId: SEROWE,
        criterionId: SQ,
        finalScore: '4',
        method: 'consensus',
        reasons:
          'Committee agreed 4 (Good): the dual-path radio and hot-standby masters in drawing SCADA-D-07 rev C meet ' +
          'and exceed TS-4.1. K. Ntsima’s original 3 was based on the superseded rev B drawing; he concurred after ' +
          'review. His submitted score stays on record.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-23T10:20:00Z',
        supersededById: null,
      },
    ],
  },
  commercial: {
    status: 'draft',
    reviewerUserId: USERS.refilwe,
    taxTreatment: 'All amounts exclusive of 14% VAT; VAT is excluded from comparison.',
    basisNote:
      'Evaluated cost = one-time items + recurring support × 2 evaluation years, in BWP at the Bank of Botswana ' +
      'mid-rate of the closing date (7 Sep 2026). Optional items are shown but not evaluated.',
    approvedAt: null,
    approvedByUserId: null,
    rows: [
      {
        commercialEvaluationId: 3601,
        bidId: SEROWE,
        revisionId: 30011,
        submittedTotal: { amount: '99550.00', currency: 'BWP' },
        arithmeticCorrection: { amount: '450.00', currency: 'BWP' },
        correctionRule:
          'Unit rate prevails over the extended line total (ITT §28.2): line 4.3 was extended as 18 × 2,475.00 = ' +
          '44,100.00 instead of 44,550.00.',
        correctionStatus: 'approved',
        correctionProposedByUserId: USERS.lesego,
        correctionProposedAt: '2026-09-25T10:30:00Z',
        correctionApprovedByUserId: USERS.refilwe,
        supplierAckAt: '2026-09-27T09:12:00Z',
        fx: null,
        evaluatedCost: { amount: '100000.00', currency: 'BWP' },
        costComponents: [
          { label: 'RTU hardware and radios (one-time)', amount: { amount: '58450.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
          {
            label: 'Integration and commissioning (one-time)',
            amount: { amount: '26550.00', currency: 'BWP' },
            includedInEvaluation: true,
            note: 'Includes the 450.00 arithmetic correction of line 4.3.',
          },
          { label: 'Training (one-time)', amount: { amount: '3000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
          {
            label: 'Annual support × 2 evaluation years',
            amount: { amount: '12000.00', currency: 'BWP' },
            includedInEvaluation: true,
            note: 'BWP 6,000.00 per year.',
          },
          {
            label: 'Optional spare RTU kit',
            amount: { amount: '7800.00', currency: 'BWP' },
            includedInEvaluation: false,
            note: 'Optional item: shown, not evaluated.',
          },
        ],
        excludedItemsNote: 'Optional spare RTU kit (BWP 7,800.00) excluded as an optional item.',
        assumptions: 'Corporate firewall configuration by KWU, as stated in the security response.',
        abnormallyLowFlag: false,
        abnormallyLowOutcome: null,
        abnormallyLowReview: null,
        inReferenceSet: true,
        referenceExclusionReason: null,
        affordability: 'within_budget',
        status: 'draft',
      },
      {
        commercialEvaluationId: 3602,
        bidId: TSODILO,
        revisionId: 30021,
        submittedTotal: { amount: '160000.00', currency: 'ZAR' },
        arithmeticCorrection: null,
        correctionRule: null,
        correctionStatus: 'none',
        correctionProposedByUserId: null,
        correctionProposedAt: null,
        correctionApprovedByUserId: null,
        supplierAckAt: null,
        fx: { fromCurrency: 'ZAR', toCurrency: 'BWP', rate: '0.75', source: 'Bank of Botswana mid-rate', rateDate: '2026-09-07' },
        evaluatedCost: { amount: '120000.00', currency: 'BWP' },
        costComponents: [
          { label: 'RTU hardware and radios (one-time)', amount: { amount: '78000.00', currency: 'BWP' }, includedInEvaluation: true, note: 'ZAR 104,000.00 at 0.75.' },
          { label: 'Integration and commissioning (one-time)', amount: { amount: '27000.00', currency: 'BWP' }, includedInEvaluation: true, note: 'ZAR 36,000.00 at 0.75.' },
          { label: 'Training (one-time)', amount: { amount: '4500.00', currency: 'BWP' }, includedInEvaluation: true, note: 'ZAR 6,000.00 at 0.75.' },
          {
            label: 'Annual support × 2 evaluation years',
            amount: { amount: '10500.00', currency: 'BWP' },
            includedInEvaluation: true,
            note: 'ZAR 7,000.00 per year at 0.75.',
          },
          {
            label: 'Optional cybersecurity hardening service',
            amount: { amount: '9000.00', currency: 'BWP' },
            includedInEvaluation: false,
            note: 'Optional item: ZAR 12,000.00, shown, not evaluated.',
          },
        ],
        excludedItemsNote: 'Optional cybersecurity hardening service (ZAR 12,000.00) excluded as an optional item.',
        assumptions: 'Prices fixed in ZAR for the bid validity period; later exchange movement does not change the comparison.',
        abnormallyLowFlag: false,
        abnormallyLowOutcome: null,
        abnormallyLowReview: null,
        inReferenceSet: true,
        referenceExclusionReason: null,
        affordability: 'exceeds_budget',
        status: 'draft',
      },
    ],
  },
  results: {
    status: 'draft',
    computedAt: '2026-09-29T08:00:00Z',
    facts: [
      {
        resultId: 3701,
        bidId: SEROWE,
        gateFailures: [],
        explanation:
          'Agreed ratings 4 / 4 / 4 give 56.00 non-price points; the lowest evaluated cost (BWP 100,000.00) earns the full 30.00 price points.',
        tieBreakApplied: null,
      },
      {
        resultId: 3702,
        bidId: TSODILO,
        gateFailures: [],
        explanation:
          'Agreed ratings 4.5 / 4.5 / 4.5 give 63.00 non-price points; 100,000 ÷ 120,000 × 30 = 25.00 price points. Ranked first on total points despite the higher evaluated cost.',
        tieBreakApplied: null,
      },
      {
        resultId: 3703,
        bidId: MAKGADIKGADI,
        gateFailures: ['MANDATORY_REQUIREMENT_FAILED'],
        explanation: 'Failed mandatory requirement REQ-Q-03 (ISO 9001 certificate); exclusion awaiting approval. Not scored and not ranked.',
        tieBreakApplied: null,
      },
    ],
  },
  lotConstraintNote: 'Single award for the whole tender; no lot limits apply.',
  reports: [
    {
      reportId: 3801,
      version: 1,
      status: 'draft',
      summary: null,
      documentId: null,
      createdAt: '2026-09-29T08:05:00Z',
      createdByUserId: USERS.boitumelo,
      submittedForSignoffAt: null,
      signedOffAt: null,
      handedOffAt: null,
      recommendedBidId: TSODILO,
      signoffs: [
        { signoffId: null, userId: USERS.boitumelo, decision: null, note: null, decidedAt: null },
        { signoffId: null, userId: USERS.thato, decision: null, note: null, decidedAt: null },
        { signoffId: null, userId: USERS.kabo, decision: null, note: null, decidedAt: null },
        { signoffId: null, userId: USERS.amantle, decision: null, note: null, decidedAt: null },
        { signoffId: null, userId: USERS.refilwe, decision: null, note: null, decidedAt: null },
      ],
    },
  ],
  timeline: [
    { at: '2026-08-28T08:00:00Z', title: 'Submission deadline passed', actorUserId: null, detail: '3 effective submissions received.' },
    { at: '2026-09-10T07:02:18Z', title: 'Technical envelopes opened', actorUserId: null, detail: 'Opening session with quorum.' },
    { at: '2026-09-10T09:30:00Z', title: 'Evaluators assigned', actorUserId: USERS.boitumelo, detail: 'Four technical evaluators; one commercial reviewer after the price gate.' },
    { at: '2026-09-11T11:20:00Z', title: 'Conflict declared', actorUserId: USERS.sam, detail: 'Bid preparation for Tsodilo Engineering; awaiting the chair’s review.', sensitivity: 'conflict_detail', subjectUserId: USERS.sam },
    { at: '2026-09-18T09:05:00Z', title: 'Two technical assessments submitted', actorUserId: null, detail: null },
    { at: '2026-09-23T15:00:00Z', title: 'Moderation finalized (consensus)', actorUserId: USERS.boitumelo, detail: 'One score changed with recorded reasons.', sensitivity: 'committee_results' },
    { at: '2026-09-24T12:00:00Z', title: 'Price gate released', actorUserId: USERS.boitumelo, detail: 'Commercial envelopes of eligible bids may be opened.' },
    { at: '2026-09-25T07:07:02Z', title: 'Commercial envelopes opened', actorUserId: null, detail: 'Supplier C’s envelope stays sealed.' },
    { at: '2026-09-29T08:00:00Z', title: 'Results computed (draft)', actorUserId: USERS.boitumelo, detail: 'Supplier B 88.00, Supplier A 86.00.', sensitivity: 'committee_results' },
  ],
};

const noConflict = (declarationId: number, declaredAt: string) => ({
  declarationId,
  hasConflict: false,
  nature: null,
  supplierTenantId: null,
  details: null,
  declaredAt,
  disposition: 'cleared' as const,
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNote: null,
});

const DUE = '2026-09-21T10:00:00Z';

const assignments: FixtureAssignment[] = [
  {
    assignmentId: 3001,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.thato,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'submitted',
    createdAt: '2026-09-10T09:30:00Z',
    acceptedAt: '2026-09-10T12:04:00Z',
    submittedAt: '2026-09-17T14:20:00Z',
    undertaking: { undertakingId: 30011, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-09-10T12:04:00Z' },
    conflictDeclaration: noConflict(30012, '2026-09-10T12:04:00Z'),
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-09-10T09:30:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-09-10T12:04:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.thato, note: null },
      { at: '2026-09-17T14:20:00Z', event: 'Assessment submitted', actorUserId: USERS.thato, note: null },
      { at: '2026-09-19T07:45:00Z', event: 'Score corrected after submission', actorUserId: USERS.thato, note: 'Supplier B, Delivery approach: 4 → 4.5.' },
    ],
  },
  {
    assignmentId: 3002,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.kabo,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'submitted',
    createdAt: '2026-09-10T09:30:00Z',
    acceptedAt: '2026-09-10T13:10:00Z',
    submittedAt: '2026-09-18T09:05:00Z',
    undertaking: { undertakingId: 30021, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-09-10T13:10:00Z' },
    conflictDeclaration: noConflict(30022, '2026-09-10T13:10:00Z'),
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-09-10T09:30:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-09-10T13:10:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.kabo, note: null },
      { at: '2026-09-18T09:05:00Z', event: 'Assessment submitted', actorUserId: USERS.kabo, note: null },
    ],
  },
  {
    assignmentId: 3003,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.amantle,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'in_progress',
    createdAt: '2026-09-10T09:30:00Z',
    acceptedAt: '2026-09-11T07:55:00Z',
    submittedAt: null,
    undertaking: { undertakingId: 30031, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-09-11T07:55:00Z' },
    conflictDeclaration: noConflict(30032, '2026-09-11T07:55:00Z'),
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-09-10T09:30:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-09-11T07:55:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.amantle, note: null },
      { at: '2026-09-16T15:30:00Z', event: 'Draft saved (5 of 6 cells scored)', actorUserId: USERS.amantle, note: null },
    ],
  },
  {
    assignmentId: 3004,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.sam,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'not_started',
    createdAt: '2026-09-10T09:30:00Z',
    acceptedAt: '2026-09-11T11:20:00Z',
    submittedAt: null,
    undertaking: { undertakingId: 30041, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-09-11T11:20:00Z' },
    conflictDeclaration: {
      declarationId: 30042,
      hasConflict: true,
      nature: 'bid_preparation',
      supplierTenantId: SUPPLIERS.tsodilo,
      details:
        'I am a technical contributor at Tsodilo Engineering and at Chobe Pipe & Valve Supplies. I contributed ' +
        'network drawings to Tsodilo’s response on this tender before I was assigned here.',
      declaredAt: '2026-09-11T11:20:00Z',
      disposition: 'pending_review',
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
    },
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-09-10T09:30:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
      {
        at: '2026-09-11T11:20:00Z',
        event: 'Accepted with undertaking; conflict declared',
        actorUserId: USERS.sam,
        note: 'Access suspended until the chair reviews the declaration.',
      },
    ],
  },
  {
    assignmentId: 3005,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.refilwe,
    bidId: null,
    criterionIds: [PRICE],
    isCommercial: true,
    dueAt: '2026-10-05T10:00:00Z',
    status: 'in_progress',
    createdAt: '2026-09-24T12:05:00Z',
    acceptedAt: '2026-09-24T13:40:00Z',
    submittedAt: null,
    undertaking: { undertakingId: 30051, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-09-24T13:40:00Z' },
    conflictDeclaration: noConflict(30052, '2026-09-24T13:40:00Z'),
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-09-24T12:05:00Z', event: 'Assigned (commercial comparison)', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-09-24T13:40:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.refilwe, note: null },
      { at: '2026-09-27T09:20:00Z', event: 'Arithmetic correction approved (Supplier A)', actorUserId: USERS.refilwe, note: 'Supplier acknowledged on 27 Sep 2026.' },
    ],
  },
];

const scores = [
  ...scoreRows(3001, 'submitted', '2026-09-17T14:20:00Z', [
    {
      bidId: SEROWE,
      criterionId: SQ,
      score: '4',
      rationale: 'Dual-path radio and hot-standby masters meet TS-4.1 with clear drawings; migration waves are credible.',
      evidenceRefs: ['Technical proposal §3.2', 'Drawing SCADA-D-07 rev C'],
    },
    {
      bidId: SEROWE,
      criterionId: DA,
      score: '4',
      rationale: '24-week programme with named teams and a manual fallback for each wave.',
      evidenceRefs: ['Delivery programme'],
    },
    {
      bidId: SEROWE,
      criterionId: RE,
      score: '4',
      rationale: 'Three comparable projects with referees; the WUC north-east project is of similar scale.',
      evidenceRefs: ['Project references p. 2'],
    },
    {
      bidId: TSODILO,
      criterionId: SQ,
      score: '4.5',
      rationale: 'Geo-redundant masters with monthly failover tests and satellite backup at remote boreholes exceed TS-4.1.',
      evidenceRefs: ['Technical proposal §2', 'Radio path survey'],
    },
    {
      bidId: TSODILO,
      criterionId: DA,
      score: '4.5',
      rationale: 'Factory acceptance testing and two weeks of parallel running minimise cut-over risk; 22-week programme.',
      evidenceRefs: ['Delivery programme §4'],
      corrections: [
        {
          correctionId: 30041,
          previousScore: '4',
          newScore: '4.5',
          previousRationale: 'Strong programme; parallel running reduces risk.',
          reason: 'My rationale describes performance above anchor 4 (factory testing of every panel); 4 was a slip when transcribing my notes.',
          correctedByUserId: USERS.thato,
          correctedAt: '2026-09-19T07:45:00Z',
          returnedByChair: false,
        },
      ],
    },
    {
      bidId: TSODILO,
      criterionId: RE,
      score: '4.5',
      rationale: 'Three comparable projects including a 58-site bulk supply network.',
      evidenceRefs: ['Project references'],
    },
  ]),
  ...scoreRows(3002, 'submitted', '2026-09-18T09:05:00Z', [
    {
      bidId: SEROWE,
      criterionId: SQ,
      score: '3',
      rationale: 'Single master station shown in the network drawing; redundancy only partly evidenced.',
      evidenceRefs: ['Network architecture drawings (rev B)'],
    },
    { bidId: SEROWE, criterionId: DA, score: '4', rationale: 'Realistic programme and resources; cut-over fallback agreed per wave.', evidenceRefs: ['Delivery programme'] },
    { bidId: SEROWE, criterionId: RE, score: '4', rationale: 'Comparable utility references; referees confirmed by phone.', evidenceRefs: ['Project references'] },
    { bidId: TSODILO, criterionId: SQ, score: '4.5', rationale: 'Strong architecture with automatic path selection and tested failover.', evidenceRefs: ['Technical proposal §2'] },
    { bidId: TSODILO, criterionId: DA, score: '4.5', rationale: 'Parallel running and factory tests; shortest programme.', evidenceRefs: ['Delivery programme'] },
    { bidId: TSODILO, criterionId: RE, score: '4.5', rationale: 'Larger comparable networks in the region.', evidenceRefs: ['Project references'] },
  ]),
  ...scoreRows(3003, 'draft', null, [
    {
      bidId: SEROWE,
      criterionId: SQ,
      score: '4',
      rationale: 'Adequate treatment of reservoir level instrumentation; redundancy is clear in rev C.',
      evidenceRefs: ['Technical proposal §3.4'],
    },
    { bidId: SEROWE, criterionId: DA, score: '4', rationale: 'Cut-over plan protects chlorination alarms during each wave.', evidenceRefs: ['Delivery programme'] },
    {
      bidId: SEROWE,
      criterionId: RE,
      score: null,
      rationale: null,
      clarificationQuestion: 'Please confirm whether the Francistown project included water-quality analyser integration.',
    },
    { bidId: TSODILO, criterionId: SQ, score: '4.5', rationale: 'Analyser integration via I/O concentrators is well described.', evidenceRefs: ['Technical proposal §2.6'] },
    { bidId: TSODILO, criterionId: DA, score: '4.5', rationale: 'Parallel running keeps water-quality alarms live during migration.', evidenceRefs: ['Delivery programme §4'] },
    { bidId: TSODILO, criterionId: RE, score: '4.5', rationale: 'Maun project includes analyser telemetry at treatment works.', evidenceRefs: ['Project references'] },
  ]),
];

export const T_2026_0003: EvaluationFixtureSet = { evaluation, assignments, scores };
