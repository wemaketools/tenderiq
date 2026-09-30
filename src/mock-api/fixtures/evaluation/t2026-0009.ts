/**
 * T-2026-0009 Acoustic leak detection services (KWU, rfp / restricted, multi-stage, single-stage opening,
 * `under_assessment`). The stage-one evaluation was signed off on 4 Sep 2026: Serowe ICT ranked first, Limpopo
 * Environmental second, Gaborone Metering below the 49.00 non-price threshold (shortlist of 2 of 3, AC-22). Serowe
 * ICT then failed preferred-bidder due diligence; the chair re-validated the results and a supplementary report (v2)
 * naming the declared fallback is in committee sign-off (selection domain: AC-24).
 *
 * Shows: a recusal with reassignment (Amantle Segwai, prior employment with Gaborone Metering), an abnormally-low
 * flag reviewed without automatic rejection, an offer below the non-price threshold that stays out of the reference
 * set and is not ranked despite the lowest price (PRD §9.1), affordability separate from rank (the fallback exceeds
 * the budget), a superseded report version and a report in sign-off. Single-stage opening: no price gate applies.
 */
import { GABORONE_TZ, KWU, KWU_UNDERTAKING, SCALE_ANCHORS_0_5, SUPPLIERS, USERS, scoreRows, supplierName } from './common.js';
import type { EvaluationFixtureSet, FixtureAssignment, FixtureBid, FixtureEvaluation } from './types.js';

const TENDER_ID = 9;
const TECH = 901;
const TEAM = 902;
const DATA = 903;
const PRICE = 904;
const SEROWE = 9001;
const GABORONE = 9002;
const LIMPOPO = 9003;

const requirement = {
  tech: { requirementId: 9011, refCode: 'REQ-LD-01', text: 'Describe the acoustic survey method, equipment and leak confirmation process for 1,200 km of mains.' },
  team: { requirementId: 9012, refCode: 'REQ-LD-04', text: 'Name the survey team, their certifications and comparable leak detection contracts.' },
  data: { requirementId: 9013, refCode: 'REQ-LD-07', text: 'Explain how findings are reported and integrated with the KWU GIS and work-order system.' },
} as const;

function response(bidPrefix: number, tech: string, team: string, data: string): FixtureBid['responses'] {
  return [
    {
      criterionId: TECH,
      requirements: [
        {
          requirementId: requirement.tech.requirementId,
          refCode: requirement.tech.refCode,
          requirementText: requirement.tech.text,
          answerText: tech,
          isDeviation: false,
          documents: [{ documentId: bidPrefix * 100 + 1, title: 'Technical approach', fileName: `bid-${bidPrefix}-technical.pdf` }],
        },
      ],
    },
    {
      criterionId: TEAM,
      requirements: [
        {
          requirementId: requirement.team.requirementId,
          refCode: requirement.team.refCode,
          requirementText: requirement.team.text,
          answerText: team,
          isDeviation: false,
          documents: [{ documentId: bidPrefix * 100 + 2, title: 'Team and references', fileName: `bid-${bidPrefix}-team.pdf` }],
        },
      ],
    },
    {
      criterionId: DATA,
      requirements: [
        {
          requirementId: requirement.data.requirementId,
          refCode: requirement.data.refCode,
          requirementText: requirement.data.text,
          answerText: data,
          isDeviation: false,
          documents: [],
        },
      ],
    },
  ];
}

const bids: FixtureBid[] = [
  {
    bidId: SEROWE,
    supplierTenantId: SUPPLIERS.seroweIct,
    supplierName: supplierName(SUPPLIERS.seroweIct),
    label: 'Supplier A',
    receiptNo: 'RCPT-2026-000901',
    receivedAt: '2026-08-10T12:15:37Z',
    revisionId: 90011,
    complianceStatus: 'compliant',
    evaluationStatus: 'evaluated',
    eligible: true,
    sealedReason: null,
    responses: response(
      7901,
      'Correlating loggers deployed in 40 km cells for three nights, confirmed by ground microphone and step testing.',
      'Six certified leak technicians; four comparable municipal contracts in Botswana and Zambia.',
      'Daily GIS layer exports and automatic work-order creation through the KWU asset system API.',
    ),
  },
  {
    bidId: GABORONE,
    supplierTenantId: SUPPLIERS.gaboroneMeter,
    supplierName: supplierName(SUPPLIERS.gaboroneMeter),
    label: 'Supplier B',
    receiptNo: 'RCPT-2026-000902',
    receivedAt: '2026-08-11T06:42:03Z',
    revisionId: 90021,
    complianceStatus: 'compliant',
    evaluationStatus: 'evaluated',
    eligible: true,
    sealedReason: null,
    responses: response(
      7902,
      'Re-use of the KWU acoustic loggers already installed on 300 km of mains; the remaining network is surveyed by a subcontractor.',
      'Two in-house technicians and a survey subcontractor; subcontractor team not named.',
      'Dashboard in the supplier’s metering portal with CSV export; no work-order integration offered.',
    ),
  },
  {
    bidId: LIMPOPO,
    supplierTenantId: SUPPLIERS.limpopoEnv,
    supplierName: supplierName(SUPPLIERS.limpopoEnv),
    label: 'Supplier C',
    receiptNo: 'RCPT-2026-000903',
    receivedAt: '2026-08-11T09:12:26Z',
    revisionId: 90031,
    complianceStatus: 'compliant',
    evaluationStatus: 'evaluated',
    eligible: true,
    sealedReason: null,
    responses: response(
      7903,
      'Noise loggers on every valve for two nights, then correlation and ground microphone confirmation.',
      'Five technicians; three comparable contracts; the RFI (T-2026-0004) findings informed the method.',
      'Weekly reports with GIS shapefiles; work orders raised by KWU from the report.',
    ),
  },
];

const evaluation: FixtureEvaluation = {
  key: 'T-2026-0009',
  tenantId: KWU,
  chairUserId: USERS.boitumelo,
  tenderOwnerUserId: USERS.tebogo,
  tender: {
    tenderId: TENDER_ID,
    reference: 'T-2026-0009',
    title: 'Acoustic leak detection services',
    status: 'under_assessment',
    officialTimeZone: GABORONE_TZ,
    openingMode: 'single_stage',
    awardModel: 'single',
    maxLotsPerSupplier: null,
    independentEvaluation: true,
    anonymizedEvaluation: false,
    anonymizationLimitations: null,
  },
  lot: null,
  plan: {
    planId: 90,
    version: 1,
    status: 'approved',
    scaleMax: 5,
    aggregationMethod: 'consensus',
    priceMethod: 'lowest_ratio',
    priceWeight: '30',
    priceFormulaNote: "Price points = lowest evaluated cost among eligible offers ÷ this offer's evaluated cost × 30.",
    zeroPriceTreatment: 'A zero total is non-comparable and referred to the committee.',
    missingPriceTreatment: 'A missing survey rate makes the offer non-comparable.',
    thresholdScope: 'non_price_total',
    nonPriceThreshold: '49',
    decimalPlacesCalc: 4,
    decimalPlacesDisplay: 2,
    comparisonCurrency: 'BWP',
    fxSource: 'Bank of Botswana mid-rate',
    fxDate: '2026-08-11',
    approvedAt: '2026-06-02T10:00:00Z',
    criteria: [
      {
        criterionId: TECH,
        parentId: null,
        code: 'C1',
        name: 'Technical approach',
        description: 'Survey method, equipment and confirmation process.',
        maxPoints: '30',
        isPrice: false,
        minScore: null,
        scoringGuidance: 'A 3 needs full network coverage with a stated confirmation method.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 1,
      },
      {
        criterionId: TEAM,
        parentId: null,
        code: 'C2',
        name: 'Team and experience',
        description: 'Named team, certifications and comparable contracts.',
        maxPoints: '25',
        isPrice: false,
        minScore: null,
        scoringGuidance: 'A 3 needs a named certified team and two comparable contracts.',
        envelope: 'technical',
        naPermitted: false,
        sortOrder: 2,
      },
      {
        criterionId: DATA,
        parentId: null,
        code: 'C3',
        name: 'Data reporting and integration',
        description: 'Reporting and integration with GIS and work orders.',
        maxPoints: '15',
        isPrice: false,
        minScore: null,
        scoringGuidance: 'A 3 needs GIS-ready findings; integration with work orders raises the rating.',
        envelope: 'technical',
        naPermitted: true,
        sortOrder: 3,
      },
      {
        criterionId: PRICE,
        parentId: null,
        code: 'C4',
        name: 'Price',
        description: 'Evaluated cost of the full survey programme.',
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
      { sequence: 2, rule: 'earliest_receipt', criterionId: null },
    ],
  },
  bids,
  budget: { amount: '5500000.00', currency: 'BWP' },
  priceGate: { applies: false, releasedAt: null, releasedByUserId: null, nonPriceCompleteConfirmed: null, note: null },
  divergenceThreshold: '1',
  moderation: {
    sessionId: 9501,
    method: 'consensus',
    status: 'finalized',
    notes:
      'Meeting 31 Aug – 1 Sep 2026 (B. Kgari, T. Mokgosi, K. Ntsima). A. Segwai recused on 13 Aug 2026 and took no ' +
      'part. Prices were opened with the other envelopes (single stage) but were not discussed before the non-price ' +
      'results were agreed.',
    createdAt: '2026-08-31T07:00:00Z',
    finalizedAt: '2026-09-01T10:00:00Z',
    scores: [
      {
        moderatedScoreId: 95001,
        bidId: SEROWE,
        criterionId: TECH,
        finalScore: '4.2',
        method: 'consensus',
        reasons:
          'Agreed 4.2: the cell-based correlation method exceeds the requirement and was proven on the RFI pilot; set ' +
          'between the submitted 4 and 4.5 after discussion of the confirmation step.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-08-31T08:10:00Z',
        supersededById: null,
      },
      { moderatedScoreId: 95002, bidId: SEROWE, criterionId: TEAM, finalScore: '4', method: 'consensus', reasons: 'Both scores 4: certified team with regional references.', moderatedByUserId: USERS.boitumelo, recordedAt: '2026-08-31T08:20:00Z', supersededById: null },
      { moderatedScoreId: 95003, bidId: SEROWE, criterionId: DATA, finalScore: '4', method: 'consensus', reasons: 'Both scores 4: API integration is offered but untested with the KWU system.', moderatedByUserId: USERS.boitumelo, recordedAt: '2026-08-31T08:35:00Z', supersededById: null },
      { moderatedScoreId: 95004, bidId: GABORONE, criterionId: TECH, finalScore: '2', method: 'consensus', reasons: 'Both scores 2: most of the network depends on an unnamed subcontractor.', moderatedByUserId: USERS.boitumelo, recordedAt: '2026-08-31T08:45:00Z', supersededById: null },
      { moderatedScoreId: 95005, bidId: GABORONE, criterionId: TEAM, finalScore: '3.5', method: 'consensus', reasons: 'Both scores 3.5: small in-house team supported by a subcontractor.', moderatedByUserId: USERS.boitumelo, recordedAt: '2026-08-31T09:00:00Z', supersededById: null },
      { moderatedScoreId: 95006, bidId: GABORONE, criterionId: DATA, finalScore: '3', method: 'consensus', reasons: 'Both scores 3: CSV export only; no GIS layer or work-order integration.', moderatedByUserId: USERS.boitumelo, recordedAt: '2026-08-31T09:10:00Z', supersededById: null },
      { moderatedScoreId: 95007, bidId: LIMPOPO, criterionId: TECH, finalScore: '4', method: 'consensus', reasons: 'Both scores 4: full coverage with correlation and confirmation.', moderatedByUserId: USERS.boitumelo, recordedAt: '2026-09-01T07:20:00Z', supersededById: null },
      {
        moderatedScoreId: 95008,
        bidId: LIMPOPO,
        criterionId: TEAM,
        finalScore: '3.6',
        method: 'consensus',
        reasons:
          'Agreed 3.6: one certificate is in annex B rather than the main response; T. Mokgosi’s 3.5 and K. Ntsima’s 4 ' +
          'were reconciled on that basis.',
        moderatedByUserId: USERS.boitumelo,
        recordedAt: '2026-09-01T07:35:00Z',
        supersededById: null,
      },
      { moderatedScoreId: 95009, bidId: LIMPOPO, criterionId: DATA, finalScore: '4.2', method: 'consensus', reasons: 'Agreed 4.2: GIS-ready shapefiles weekly with a clear data dictionary; work orders stay manual.', moderatedByUserId: USERS.boitumelo, recordedAt: '2026-09-01T07:50:00Z', supersededById: null },
    ],
  },
  commercial: {
    status: 'approved',
    reviewerUserId: USERS.refilwe,
    taxTreatment: 'All amounts exclusive of 14% VAT.',
    basisNote: 'Evaluated cost = survey of 1,200 km at the offered rate per km plus reporting and integration, in BWP.',
    approvedAt: '2026-09-03T14:00:00Z',
    approvedByUserId: USERS.refilwe,
    rows: [
      {
        commercialEvaluationId: 9601,
        bidId: SEROWE,
        revisionId: 90011,
        submittedTotal: { amount: '4850000.00', currency: 'BWP' },
        arithmeticCorrection: null,
        correctionRule: null,
        correctionStatus: 'none',
        correctionProposedByUserId: null,
        correctionProposedAt: null,
        correctionApprovedByUserId: null,
        supplierAckAt: null,
        fx: null,
        evaluatedCost: { amount: '4850000.00', currency: 'BWP' },
        costComponents: [
          { label: 'Survey 1,200 km × BWP 3,500.00', amount: { amount: '4200000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
          { label: 'Reporting and GIS integration', amount: { amount: '650000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
        ],
        excludedItemsNote: null,
        assumptions: null,
        abnormallyLowFlag: false,
        abnormallyLowOutcome: null,
        abnormallyLowReview: null,
        inReferenceSet: true,
        referenceExclusionReason: null,
        affordability: 'within_budget',
        status: 'approved',
      },
      {
        commercialEvaluationId: 9602,
        bidId: GABORONE,
        revisionId: 90021,
        submittedTotal: { amount: '3150000.00', currency: 'BWP' },
        arithmeticCorrection: null,
        correctionRule: null,
        correctionStatus: 'none',
        correctionProposedByUserId: null,
        correctionProposedAt: null,
        correctionApprovedByUserId: null,
        supplierAckAt: null,
        fx: null,
        evaluatedCost: { amount: '3150000.00', currency: 'BWP' },
        costComponents: [
          { label: 'Survey 900 km × BWP 3,000.00 (subcontracted)', amount: { amount: '2700000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
          { label: 'Logger data retrieval, 300 km (KWU loggers)', amount: { amount: '150000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
          { label: 'Portal subscription', amount: { amount: '300000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
        ],
        excludedItemsNote: null,
        assumptions: 'Assumes free use of the KWU loggers already installed on 300 km of mains.',
        abnormallyLowFlag: true,
        abnormallyLowOutcome: 'explanation_accepted',
        abnormallyLowReview:
          'Offer is 41% below the mean of the other offers. Written explanation received 2 Sep 2026: the price relies ' +
          'on KWU’s installed loggers for 300 km. Explanation accepted; the offer is not rejected on price grounds.',
        inReferenceSet: false,
        referenceExclusionReason:
          'Below the non-price threshold (38.50 < 49.00): not an eligible offer for the relative price formula (PRD §9.3).',
        affordability: 'within_budget',
        status: 'approved',
      },
      {
        commercialEvaluationId: 9603,
        bidId: LIMPOPO,
        revisionId: 90031,
        submittedTotal: { amount: '5910000.00', currency: 'BWP' },
        arithmeticCorrection: null,
        correctionRule: null,
        correctionStatus: 'none',
        correctionProposedByUserId: null,
        correctionProposedAt: null,
        correctionApprovedByUserId: null,
        supplierAckAt: null,
        fx: null,
        evaluatedCost: { amount: '5910000.00', currency: 'BWP' },
        costComponents: [
          { label: 'Survey 1,200 km × BWP 4,400.00', amount: { amount: '5280000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
          { label: 'Weekly reporting', amount: { amount: '630000.00', currency: 'BWP' }, includedInEvaluation: true, note: null },
        ],
        excludedItemsNote: null,
        assumptions: null,
        abnormallyLowFlag: false,
        abnormallyLowOutcome: null,
        abnormallyLowReview: null,
        inReferenceSet: true,
        referenceExclusionReason: null,
        affordability: 'exceeds_budget',
        status: 'approved',
      },
    ],
  },
  results: {
    status: 'draft',
    computedAt: '2026-09-26T09:00:00Z',
    facts: [
      {
        resultId: 9701,
        bidId: SEROWE,
        gateFailures: ['DUE_DILIGENCE_FAILED'],
        explanation:
          'Ranked first in the signed-off report of 4 Sep 2026 (87.20). Preferred-bidder due diligence failed on ' +
          'financial position, so the offer is no longer eligible for award; its scores stay on record.',
        tieBreakApplied: null,
      },
      {
        resultId: 9702,
        bidId: GABORONE,
        gateFailures: ['NON_PRICE_THRESHOLD'],
        explanation:
          'Non-price points 38.50 are below the 49.00 threshold, so the offer is not ranked; the lowest price cannot compensate (PRD §9.1).',
        tieBreakApplied: null,
      },
      {
        resultId: 9703,
        bidId: LIMPOPO,
        gateFailures: [],
        explanation:
          'Agreed ratings 4 / 3.6 / 4.2 give 54.60 non-price points; 4,850,000 ÷ 5,910,000 × 30 = 24.62 price points. ' +
          'Next-ranked eligible offer under the declared fallback; above the budget, which is decided separately from rank.',
        tieBreakApplied: null,
      },
    ],
  },
  lotConstraintNote: 'Single award for the whole service; no lot limits apply.',
  reports: [
    {
      reportId: 9802,
      version: 2,
      status: 'in_signoff',
      summary:
        'Supplementary evaluation report. Serowe ICT Solutions failed preferred-bidder due diligence (financial ' +
        'position). Under the declared fallback the next-ranked eligible offer, Limpopo Environmental Services ' +
        '(79.22 points), is recommended; its evaluated cost exceeds the budget and needs a budget decision. Scores ' +
        'and the reference set are unchanged from version 1.',
      documentId: null,
      createdAt: '2026-09-26T09:10:00Z',
      createdByUserId: USERS.boitumelo,
      submittedForSignoffAt: '2026-09-28T07:00:00Z',
      signedOffAt: null,
      handedOffAt: null,
      recommendedBidId: LIMPOPO,
      signoffs: [
        { signoffId: 98021, userId: USERS.boitumelo, decision: 'signed', note: null, decidedAt: '2026-09-28T07:05:00Z' },
        { signoffId: 98022, userId: USERS.thato, decision: 'signed', note: null, decidedAt: '2026-09-29T06:40:00Z' },
        { signoffId: null, userId: USERS.kabo, decision: null, note: null, decidedAt: null },
        { signoffId: null, userId: USERS.refilwe, decision: null, note: null, decidedAt: null },
      ],
    },
    {
      reportId: 9801,
      version: 1,
      status: 'superseded',
      summary:
        'Evaluation of three offers. Serowe ICT Solutions ranked first (87.20) and Limpopo Environmental Services ' +
        'second (79.22); Gaborone Metering Co. is below the non-price threshold. Shortlist of two recommended.',
      documentId: 98010,
      createdAt: '2026-09-03T15:00:00Z',
      createdByUserId: USERS.boitumelo,
      submittedForSignoffAt: '2026-09-03T15:30:00Z',
      signedOffAt: '2026-09-04T11:30:00Z',
      handedOffAt: '2026-09-07T07:30:00Z',
      recommendedBidId: SEROWE,
      signoffs: [
        { signoffId: 98011, userId: USERS.boitumelo, decision: 'signed', note: null, decidedAt: '2026-09-03T15:35:00Z' },
        { signoffId: 98012, userId: USERS.thato, decision: 'signed', note: null, decidedAt: '2026-09-04T07:20:00Z' },
        { signoffId: 98013, userId: USERS.kabo, decision: 'signed', note: null, decidedAt: '2026-09-04T09:45:00Z' },
        { signoffId: 98014, userId: USERS.refilwe, decision: 'signed', note: null, decidedAt: '2026-09-04T11:30:00Z' },
      ],
    },
  ],
  timeline: [
    { at: '2026-08-11T10:00:00Z', title: 'Submission deadline passed', actorUserId: null, detail: '3 submissions from the prequalified applicants.' },
    { at: '2026-08-12T07:04:09Z', title: 'All envelopes opened (single stage)', actorUserId: null, detail: null },
    { at: '2026-08-13T09:00:00Z', title: 'Evaluator recused and replaced', actorUserId: USERS.boitumelo, detail: 'A. Segwai (prior employment) replaced by K. Ntsima.', sensitivity: 'conflict_detail', subjectUserId: USERS.amantle },
    { at: '2026-09-01T10:00:00Z', title: 'Moderation finalized (consensus)', actorUserId: USERS.boitumelo, detail: null },
    { at: '2026-09-03T14:00:00Z', title: 'Commercial comparison approved', actorUserId: USERS.refilwe, detail: 'Abnormally-low review recorded for Supplier B.', sensitivity: 'committee_results' },
    { at: '2026-09-04T11:30:00Z', title: 'Evaluation report v1 signed off', actorUserId: null, detail: null },
    { at: '2026-09-26T09:00:00Z', title: 'Results re-validated after due diligence failure', actorUserId: USERS.boitumelo, detail: null },
    { at: '2026-09-28T07:00:00Z', title: 'Supplementary report v2 submitted for sign-off', actorUserId: USERS.boitumelo, detail: null },
  ],
};

function declaration(declarationId: number, declaredAt: string): FixtureAssignment['conflictDeclaration'] {
  return {
    declarationId,
    hasConflict: false,
    nature: null,
    supplierTenantId: null,
    details: null,
    declaredAt,
    disposition: 'cleared',
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null,
  };
}

const DUE = '2026-08-26T10:00:00Z';

const assignments: FixtureAssignment[] = [
  {
    assignmentId: 9001,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.thato,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'finalized',
    createdAt: '2026-08-12T09:00:00Z',
    acceptedAt: '2026-08-12T10:30:00Z',
    submittedAt: '2026-08-25T15:00:00Z',
    undertaking: { undertakingId: 90011, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-08-12T10:30:00Z' },
    conflictDeclaration: declaration(90012, '2026-08-12T10:30:00Z'),
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-08-12T09:00:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-08-12T10:30:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.thato, note: null },
      { at: '2026-08-25T15:00:00Z', event: 'Assessment submitted', actorUserId: USERS.thato, note: null },
      { at: '2026-09-01T10:00:00Z', event: 'Finalized with moderation', actorUserId: USERS.boitumelo, note: null },
    ],
  },
  {
    assignmentId: 9002,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.amantle,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'recused',
    createdAt: '2026-08-12T09:00:00Z',
    acceptedAt: '2026-08-12T11:00:00Z',
    submittedAt: null,
    undertaking: { undertakingId: 90021, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-08-12T11:00:00Z' },
    conflictDeclaration: {
      declarationId: 90022,
      hasConflict: true,
      nature: 'prior_employment',
      supplierTenantId: SUPPLIERS.gaboroneMeter,
      details: 'I was employed by Gaborone Metering Co. as a field engineer until March 2025.',
      declaredAt: '2026-08-12T11:00:00Z',
      disposition: 'recused',
      reviewedByUserId: USERS.boitumelo,
      reviewedAt: '2026-08-13T09:00:00Z',
      reviewNote: 'Recent employment with a bidder: recused from this evaluation; work reassigned to K. Ntsima.',
    },
    reassignedToAssignmentId: 9003,
    reassignmentReason: 'Recused for prior employment with Gaborone Metering Co.',
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-08-12T09:00:00Z', event: 'Assigned', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-08-12T11:00:00Z', event: 'Accepted with undertaking; conflict declared', actorUserId: USERS.amantle, note: null },
      { at: '2026-08-13T09:00:00Z', event: 'Recused and reassigned', actorUserId: USERS.boitumelo, note: 'Replaced by Kabo Ntsima.' },
    ],
  },
  {
    assignmentId: 9003,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.kabo,
    bidId: null,
    criterionIds: [],
    isCommercial: false,
    dueAt: DUE,
    status: 'finalized',
    createdAt: '2026-08-13T09:00:00Z',
    acceptedAt: '2026-08-13T12:00:00Z',
    submittedAt: '2026-08-26T08:10:00Z',
    undertaking: { undertakingId: 90031, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-08-13T12:00:00Z' },
    conflictDeclaration: declaration(90032, '2026-08-13T12:00:00Z'),
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-08-13T09:00:00Z', event: 'Assigned (replacement for A. Segwai)', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-08-13T12:00:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.kabo, note: null },
      { at: '2026-08-26T08:10:00Z', event: 'Assessment submitted', actorUserId: USERS.kabo, note: null },
      { at: '2026-09-01T10:00:00Z', event: 'Finalized with moderation', actorUserId: USERS.boitumelo, note: null },
    ],
  },
  {
    assignmentId: 9004,
    tenantId: KWU,
    evaluationKey: evaluation.key,
    evaluatorUserId: USERS.refilwe,
    bidId: null,
    criterionIds: [PRICE],
    isCommercial: true,
    dueAt: '2026-09-04T10:00:00Z',
    status: 'finalized',
    createdAt: '2026-09-01T10:10:00Z',
    acceptedAt: '2026-09-01T11:00:00Z',
    submittedAt: '2026-09-03T14:00:00Z',
    undertaking: { undertakingId: 90041, textVersion: KWU_UNDERTAKING.textVersion, acceptedAt: '2026-09-01T11:00:00Z' },
    conflictDeclaration: declaration(90042, '2026-09-01T11:00:00Z'),
    reassignedToAssignmentId: null,
    reassignmentReason: null,
    reassignmentRequestedAt: null,
    returnReason: null,
    history: [
      { at: '2026-09-01T10:10:00Z', event: 'Assigned (commercial comparison)', actorUserId: USERS.boitumelo, note: null },
      { at: '2026-09-01T11:00:00Z', event: 'Accepted with undertaking; no conflict declared', actorUserId: USERS.refilwe, note: null },
      { at: '2026-09-03T14:00:00Z', event: 'Commercial comparison approved', actorUserId: USERS.refilwe, note: null },
    ],
  },
];

const scores = [
  ...scoreRows(9001, 'submitted', '2026-08-25T15:00:00Z', [
    { bidId: SEROWE, criterionId: TECH, score: '4', rationale: 'Cell-based correlation with confirmation; strong equipment list.', evidenceRefs: ['Technical approach §2'] },
    { bidId: SEROWE, criterionId: TEAM, score: '4', rationale: 'Six certified technicians and regional references.', evidenceRefs: ['Team and references'] },
    { bidId: SEROWE, criterionId: DATA, score: '4', rationale: 'Daily GIS exports and API work orders.', evidenceRefs: [] },
    { bidId: GABORONE, criterionId: TECH, score: '2', rationale: 'Most of the network relies on an unnamed subcontractor.', evidenceRefs: ['Technical approach'] },
    { bidId: GABORONE, criterionId: TEAM, score: '3.5', rationale: 'Two in-house technicians with a subcontractor.', evidenceRefs: [] },
    { bidId: GABORONE, criterionId: DATA, score: '3', rationale: 'CSV export only.', evidenceRefs: [] },
    { bidId: LIMPOPO, criterionId: TECH, score: '4', rationale: 'Full coverage with a logger-then-correlation sequence.', evidenceRefs: ['Technical approach'] },
    { bidId: LIMPOPO, criterionId: TEAM, score: '3.5', rationale: 'Five technicians; one certificate not in the main response.', evidenceRefs: [] },
    { bidId: LIMPOPO, criterionId: DATA, score: '4', rationale: 'GIS shapefiles weekly; manual work orders.', evidenceRefs: [] },
  ]),
  ...scoreRows(9003, 'submitted', '2026-08-26T08:10:00Z', [
    { bidId: SEROWE, criterionId: TECH, score: '4.5', rationale: 'Robust method confirmed by two techniques.', evidenceRefs: ['Technical approach'] },
    { bidId: SEROWE, criterionId: TEAM, score: '4', rationale: 'Certified team; comparable contracts.', evidenceRefs: [] },
    { bidId: SEROWE, criterionId: DATA, score: '4', rationale: 'API integration offered with work-order automation.', evidenceRefs: [] },
    { bidId: GABORONE, criterionId: TECH, score: '2', rationale: 'Dependence on KWU loggers and an unnamed subcontractor.', evidenceRefs: [] },
    { bidId: GABORONE, criterionId: TEAM, score: '3.5', rationale: 'Small team.', evidenceRefs: [] },
    { bidId: GABORONE, criterionId: DATA, score: '3', rationale: 'No integration.', evidenceRefs: [] },
    { bidId: LIMPOPO, criterionId: TECH, score: '4', rationale: 'Sound method informed by the RFI findings.', evidenceRefs: [] },
    { bidId: LIMPOPO, criterionId: TEAM, score: '4', rationale: 'Certificates complete in annex B.', evidenceRefs: ['Annex B'] },
    { bidId: LIMPOPO, criterionId: DATA, score: '4.5', rationale: 'GIS-ready outputs with a clear data dictionary.', evidenceRefs: [] },
  ]),
];

export const T_2026_0009: EvaluationFixtureSet = { evaluation, assignments, scores };
