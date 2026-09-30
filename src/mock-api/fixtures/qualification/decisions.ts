/**
 * Qualification fixtures, part 4: decisions and monitoring (BUY-35, SUP-24; blueprint `qualification_decisions`,
 * `reassessment_triggers`, `integrity_screenings`).
 *
 * Storyline anchors:
 * - Tsodilo is qualified for WTR-PUMP (701), which superseded its conditional decision under version 1 (700).
 * - Chobe is qualified with conditions for WTR-PIPE (702); its insurance expires on 2026-10-08, and trigger 901 is
 *   open with two impacted tenders (T-2026-0006 open, T-2026-0008 closed with its sealed bid) (AC-09).
 * - Gaborone Metering's decision 704 ended on 2026-08-31, so the view derives `expired` (no decision row is
 *   written, DD-20); trigger 905 records the effect on its live bid on T-2026-0002.
 * - Limpopo's KWU decision 705 was superseded by the suspension 706 after its licence lapsed (trigger 902,
 *   action taken); at ODC, Limpopo is qualified (801): SUP-24 shows the buyer-specific decisions side by side.
 *   Limpopo supplied updated evidence (971, trigger 906) and asked for reconsideration (981, trigger 907); both
 *   await the KWU decider on BUY-35.
 * - Screenings only flag review (BR-48): Serowe's possible sanctions match is unreviewed; Chobe's adverse-media
 *   match was reviewed as a false positive.
 */
import type { NonNegativeMoney } from '../../../contracts/common.js';
import type {
  IntegrityScreeningsCheckType,
  IntegrityScreeningsResult,
  QualificationDecisionsBlockedGate,
  QualificationDecisionsOutcome,
  ReassessmentTriggersStatus,
  ReassessmentTriggersTriggerType,
} from '../../../contracts/enums.js';
import { BWP, CHOBE, GABORONE_METER, KWU, LIMPOPO, MAKGADIKGADI, ODC, SEROWE, TSODILO, USERS } from './world.js';

export interface FxDecision {
  readonly id: number;
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly applicationId: number;
  readonly programVersionId: number;
  readonly outcome: QualificationDecisionsOutcome;
  readonly scopeCategoryId: number;
  readonly scopeMaxValue: NonNegativeMoney | null;
  readonly scopeGeography: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly reassessmentDate: string | null;
  readonly conditions: string | null;
  readonly allowedActivities: string | null;
  readonly blockedGate: QualificationDecisionsBlockedGate;
  readonly reasons: string;
  readonly supplierExplanation: string | null;
  readonly appealRoute: string | null;
  readonly reviewerUserId: number | null;
  readonly approverUserId: number | null;
  readonly approvalRequestId: number | null;
  readonly decidedAt: string;
  readonly supersededById: number | null;
  readonly supersedeReason: string | null;
  readonly supplierNotifiedAt: string | null;
  /** Buyer request for the supplier to renew (a notice; nothing renews automatically, BR-37). */
  readonly renewalRequestedAt: string | null;
}

export interface FxTrigger {
  readonly id: number;
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly decisionId: number | null;
  readonly triggerType: ReassessmentTriggersTriggerType;
  readonly sourceType: string;
  readonly sourceId: number | null;
  readonly sourceLabel: string;
  readonly summary: string;
  readonly detectedAt: string;
  readonly lapsesOn: string | null;
  readonly status: ReassessmentTriggersStatus;
  readonly assessedByUserId: number | null;
  readonly assessedAt: string | null;
  readonly disposition: string | null;
  readonly activeBidsReviewed: boolean;
  readonly activeContractsReviewed: boolean;
  readonly resultingDecisionId: number | null;
  readonly taskId: number | null;
  /** Tender ids (of the supplier's activity) this trigger affects. */
  readonly impactedTenderIds: readonly number[];
  readonly impactedContractIds: readonly number[];
}

export interface FxScreening {
  readonly id: number;
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly checkType: IntegrityScreeningsCheckType;
  readonly source: string;
  readonly checkedAt: string;
  readonly result: IntegrityScreeningsResult;
  readonly matchDetail: string | null;
  readonly reviewedByUserId: number | null;
  readonly reviewedAt: string | null;
  readonly disposition: string | null;
  readonly effect: string | null;
}

export interface FxReconsideration {
  readonly id: number;
  readonly decisionId: number;
  readonly grounds: string;
  readonly requestedAt: string;
  readonly requestedByUserId: number;
  readonly evidenceItemIds: readonly number[];
}

export interface FxEvidenceUpdate {
  readonly id: number;
  readonly decisionId: number;
  readonly evidenceItemId: number;
  readonly note: string | null;
  readonly submittedAt: string;
  readonly submittedByUserId: number;
}

const KWU_APPEAL =
  'You may request reconsideration within 14 days through this screen. An unresolved request can be escalated to the KWU Procurement Review Committee (procurement.review@kwu.example).';

export const QUALIFICATION_DECISIONS: readonly FxDecision[] = Object.freeze([
  {
    id: 700, tenantId: KWU, supplierTenantId: TSODILO, applicationId: 500, programVersionId: 111,
    outcome: 'qualified_with_conditions', scopeCategoryId: 202, scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana',
    effectiveFrom: '2025-11-20', effectiveTo: '2027-11-19', reassessmentDate: '2026-11-20',
    conditions: 'Provide a current ISO 9001 certificate within 90 days.',
    allowedActivities: 'Receive invitations and submit bids for WTR-PUMP work up to BWP 5,000,000.',
    blockedGate: 'award',
    reasons: 'All criteria met except the lapsed ISO 9001 certificate; recertification audit scheduled.',
    supplierExplanation: 'Qualified for pumps and mechanical equipment up to BWP 5,000,000, on condition that a current ISO 9001 certificate is provided within 90 days. Award is blocked until then.',
    appealRoute: KWU_APPEAL, reviewerUserId: USERS.neo, approverUserId: USERS.mpho, approvalRequestId: null,
    decidedAt: '2025-11-19T12:00:00Z', supersededById: 701,
    supersedeReason: 'Condition satisfied (ISO 9001 certificate BV-QMS-88213) and scope extended under criteria version 2 (QA-2026-0002).',
    supplierNotifiedAt: '2025-11-19T12:05:00Z', renewalRequestedAt: null,
  },
  {
    id: 701, tenantId: KWU, supplierTenantId: TSODILO, applicationId: 501, programVersionId: 112,
    outcome: 'qualified', scopeCategoryId: 202, scopeMaxValue: BWP('8000000.00'), scopeGeography: 'Botswana',
    effectiveFrom: '2026-04-15', effectiveTo: '2028-04-14', reassessmentDate: '2027-04-15',
    conditions: null, allowedActivities: null, blockedGate: 'none',
    reasons: 'All thirteen criteria met with independently verified evidence. Financial review adequate (turnover BWP 42.3 million, current ratio 1.85).',
    supplierExplanation: 'Qualified for pumps and mechanical equipment (WTR-PUMP) up to BWP 8,000,000 per contract until 14 Apr 2028.',
    appealRoute: KWU_APPEAL, reviewerUserId: USERS.neo, approverUserId: USERS.mpho, approvalRequestId: null,
    decidedAt: '2026-04-14T13:20:00Z', supersededById: null, supersedeReason: null,
    supplierNotifiedAt: '2026-04-14T13:25:00Z', renewalRequestedAt: null,
  },
  {
    id: 702, tenantId: KWU, supplierTenantId: CHOBE, applicationId: 502, programVersionId: 112,
    outcome: 'qualified_with_conditions', scopeCategoryId: 203, scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana',
    effectiveFrom: '2026-05-04', effectiveTo: '2028-05-03', reassessmentDate: '2026-10-08',
    conditions: 'Supply a renewed public liability insurance certificate (cover of at least BWP 5,000,000) before the current policy expires on 8 Oct 2026.',
    allowedActivities: 'Receive invitations and submit bids for WTR-PIPE work up to BWP 5,000,000.',
    blockedGate: 'award',
    reasons: 'All mandatory criteria met. Financial capacity adequate with limitations (working capital). Insurance expiry within the qualification period handled as a condition.',
    supplierExplanation: 'Qualified with conditions for pipes, valves and fittings (WTR-PIPE) up to BWP 5,000,000. You may bid, but no award can be made to you after 8 Oct 2026 until the renewed insurance certificate is received.',
    appealRoute: KWU_APPEAL, reviewerUserId: USERS.neo, approverUserId: USERS.mpho, approvalRequestId: null,
    decidedAt: '2026-05-04T08:30:00Z', supersededById: null, supersedeReason: null,
    supplierNotifiedAt: '2026-05-04T08:35:00Z', renewalRequestedAt: null,
  },
  {
    id: 703, tenantId: KWU, supplierTenantId: SEROWE, applicationId: 504, programVersionId: 121,
    outcome: 'qualified', scopeCategoryId: 204, scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana',
    effectiveFrom: '2026-02-01', effectiveTo: '2029-01-31', reassessmentDate: '2027-02-01',
    conditions: null, allowedActivities: null, blockedGate: 'none',
    reasons: 'All criteria met; ISO/IEC 27001 and utility SCADA references verified.',
    supplierExplanation: 'Qualified for SCADA, telemetry and ICT services up to BWP 5,000,000 until 31 Jan 2029.',
    appealRoute: KWU_APPEAL, reviewerUserId: USERS.neo, approverUserId: USERS.mpho, approvalRequestId: null,
    decidedAt: '2026-01-30T09:00:00Z', supersededById: null, supersedeReason: null,
    supplierNotifiedAt: '2026-01-30T09:05:00Z', renewalRequestedAt: null,
  },
  {
    id: 704, tenantId: KWU, supplierTenantId: GABORONE_METER, applicationId: 505, programVersionId: 131,
    outcome: 'qualified', scopeCategoryId: 205, scopeMaxValue: BWP('3000000.00'), scopeGeography: 'Botswana',
    effectiveFrom: '2024-09-01', effectiveTo: '2026-08-31', reassessmentDate: '2025-09-01',
    conditions: null, allowedActivities: null, blockedGate: 'none',
    reasons: 'All criteria met; BOBS type approval and ISO 9001 verified.',
    supplierExplanation: 'Qualified for water meters and metering services up to BWP 3,000,000 until 31 Aug 2026.',
    appealRoute: KWU_APPEAL, reviewerUserId: USERS.neo, approverUserId: USERS.mpho, approvalRequestId: null,
    decidedAt: '2024-08-30T10:00:00Z', supersededById: null, supersedeReason: null,
    supplierNotifiedAt: '2024-08-30T10:05:00Z', renewalRequestedAt: '2026-07-02T08:00:00Z',
  },
  {
    id: 705, tenantId: KWU, supplierTenantId: LIMPOPO, applicationId: 507, programVersionId: 141,
    outcome: 'qualified', scopeCategoryId: 206, scopeMaxValue: BWP('2000000.00'), scopeGeography: 'Botswana',
    effectiveFrom: '2026-01-20', effectiveTo: '2028-01-19', reassessmentDate: '2027-01-20',
    conditions: null, allowedActivities: null, blockedGate: 'none',
    reasons: 'All criteria met; licence renewal plan recorded (information request 1404).',
    supplierExplanation: 'Qualified for environmental and laboratory services up to BWP 2,000,000 until 19 Jan 2028.',
    appealRoute: KWU_APPEAL, reviewerUserId: USERS.neo, approverUserId: USERS.mpho, approvalRequestId: null,
    decidedAt: '2026-01-19T15:00:00Z', supersededById: 706,
    supersedeReason: 'Waste management licence lapsed on 5 Sep 2026 (reassessment trigger 902).',
    supplierNotifiedAt: '2026-01-19T15:05:00Z', renewalRequestedAt: null,
  },
  {
    id: 706, tenantId: KWU, supplierTenantId: LIMPOPO, applicationId: 507, programVersionId: 141,
    outcome: 'suspended', scopeCategoryId: 206, scopeMaxValue: BWP('2000000.00'), scopeGeography: 'Botswana',
    effectiveFrom: '2026-09-10', effectiveTo: '2028-01-19', reassessmentDate: '2026-10-31',
    conditions: 'Suspended until a valid waste management licence from the Department of Waste Management and Pollution Control is provided.',
    allowedActivities: 'Complete work under existing purchase orders. Bids already submitted remain assessed under the rules at their submission deadline.',
    blockedGate: 'invitation',
    reasons: 'Mandatory regulatory criterion no longer met: the waste management licence lapsed on 5 Sep 2026 and no renewed licence was provided.',
    supplierExplanation: 'Your qualification is suspended because your waste management licence lapsed on 5 Sep 2026. You will not receive new invitations until a valid licence is provided. Existing submissions are not affected.',
    appealRoute: KWU_APPEAL, reviewerUserId: USERS.neo, approverUserId: USERS.mpho, approvalRequestId: null,
    decidedAt: '2026-09-10T11:00:00Z', supersededById: null, supersedeReason: null,
    supplierNotifiedAt: '2026-09-10T11:05:00Z', renewalRequestedAt: null,
  },
  {
    id: 801, tenantId: ODC, supplierTenantId: LIMPOPO, applicationId: 601, programVersionId: 211,
    outcome: 'qualified', scopeCategoryId: 301, scopeMaxValue: BWP('1500000.00'), scopeGeography: 'Okavango District',
    effectiveFrom: '2026-05-15', effectiveTo: '2028-05-14', reassessmentDate: '2027-05-15',
    conditions: null, allowedActivities: null, blockedGate: 'none',
    reasons: 'All criteria met; staffing plan and client references verified.',
    supplierExplanation: 'Qualified for cleaning and facilities services in the Okavango District up to BWP 1,500,000 until 14 May 2028.',
    appealRoute: 'Write to the ODC Tender Committee secretary within 14 days of this notice.',
    reviewerUserId: USERS.officerOdc, approverUserId: USERS.adminOdc, approvalRequestId: null,
    decidedAt: '2026-05-14T10:00:00Z', supersededById: null, supersedeReason: null,
    supplierNotifiedAt: '2026-05-14T10:10:00Z', renewalRequestedAt: null,
  },
]);

export const REASSESSMENT_TRIGGERS: readonly FxTrigger[] = Object.freeze([
  {
    id: 901, tenantId: KWU, supplierTenantId: CHOBE, decisionId: 702, triggerType: 'evidence_expiry',
    sourceType: 'evidence_item', sourceId: 504, sourceLabel: 'Public liability insurance certificate BIC-PL-25-10931',
    summary: 'Public liability insurance expires on 8 Oct 2026. Chobe has a sealed submission on T-2026-0008 and an open invitation on T-2026-0006.',
    detectedAt: '2026-09-28T00:10:00Z', lapsesOn: '2026-10-08', status: 'open',
    assessedByUserId: null, assessedAt: null, disposition: null, activeBidsReviewed: false, activeContractsReviewed: false,
    resultingDecisionId: null, taskId: 143, impactedTenderIds: [6, 8], impactedContractIds: [],
  },
  {
    id: 902, tenantId: KWU, supplierTenantId: LIMPOPO, decisionId: 705, triggerType: 'evidence_expiry',
    sourceType: 'evidence_item', sourceId: 803, sourceLabel: 'Waste management licence DWMPC-WML-2023-0419',
    summary: 'Waste management licence lapsed on 5 Sep 2026 without a renewed licence.',
    detectedAt: '2026-08-06T00:10:00Z', lapsesOn: '2026-09-05', status: 'action_taken',
    assessedByUserId: USERS.mpho, assessedAt: '2026-09-10T11:00:00Z',
    disposition: 'Qualification suspended (decision 706). The bid on T-2026-0007 was submitted before the lapse and stays assessed under the rules at its deadline; no new invitations until a valid licence is provided.',
    activeBidsReviewed: true, activeContractsReviewed: true, resultingDecisionId: 706, taskId: null,
    impactedTenderIds: [7], impactedContractIds: [],
  },
  {
    id: 903, tenantId: KWU, supplierTenantId: TSODILO, decisionId: 701, triggerType: 'ownership_change',
    sourceType: 'identity_change', sourceId: 77, sourceLabel: 'Shareholding change reported on 2 Jul 2026',
    summary: 'Tsodilo Family Trust increased its holding from 35% to 40%.',
    detectedAt: '2026-07-02T09:00:00Z', lapsesOn: null, status: 'dismissed',
    assessedByUserId: USERS.mpho, assessedAt: '2026-07-06T10:00:00Z',
    disposition: 'Change below the 10% materiality threshold and no change of control; no effect on eligibility.',
    activeBidsReviewed: true, activeContractsReviewed: true, resultingDecisionId: null, taskId: null,
    impactedTenderIds: [1, 3], impactedContractIds: [2],
  },
  {
    id: 904, tenantId: KWU, supplierTenantId: SEROWE, decisionId: 703, triggerType: 'financial_change',
    sourceType: 'evidence_item', sourceId: 710, sourceLabel: 'Interim management accounts H1 2026',
    summary: 'Interim accounts show revenue 18% below the prior half-year.',
    detectedAt: '2026-09-12T08:00:00Z', lapsesOn: null, status: 'assessed',
    assessedByUserId: USERS.mpho, assessedAt: '2026-09-16T14:00:00Z',
    disposition: 'Liquidity remains above threshold (current ratio 1.48). No change to scope; review again at the reassessment date. The T-2026-0003 evaluation is not affected.',
    activeBidsReviewed: true, activeContractsReviewed: true, resultingDecisionId: null, taskId: null,
    impactedTenderIds: [3, 2], impactedContractIds: [],
  },
  {
    id: 905, tenantId: KWU, supplierTenantId: GABORONE_METER, decisionId: 704, triggerType: 'manual',
    sourceType: 'qualification_decision', sourceId: 704, sourceLabel: 'Qualification ended on 31 Aug 2026',
    summary: 'The metering qualification expired on 31 Aug 2026 while Gaborone Metering has an effective submission on T-2026-0002. Renewal QA-2026-0008 was received on 22 Sep 2026.',
    detectedAt: '2026-09-23T07:30:00Z', lapsesOn: '2026-08-31', status: 'open',
    assessedByUserId: null, assessedAt: null, disposition: null, activeBidsReviewed: false, activeContractsReviewed: false,
    resultingDecisionId: null, taskId: 144, impactedTenderIds: [2], impactedContractIds: [4],
  },
  {
    id: 906, tenantId: KWU, supplierTenantId: LIMPOPO, decisionId: 706, triggerType: 'manual',
    sourceType: 'evidence_submission', sourceId: 971, sourceLabel: 'Updated evidence supplied on 18 Sep 2026',
    summary: 'Limpopo supplied the acknowledgement of its waste management licence renewal against the suspension (decision 706).',
    detectedAt: '2026-09-18T14:00:00Z', lapsesOn: null, status: 'open',
    assessedByUserId: null, assessedAt: null, disposition: null, activeBidsReviewed: false, activeContractsReviewed: false,
    resultingDecisionId: null, taskId: null, impactedTenderIds: [7], impactedContractIds: [],
  },
  {
    id: 907, tenantId: KWU, supplierTenantId: LIMPOPO, decisionId: 706, triggerType: 'manual',
    sourceType: 'reconsideration_request', sourceId: 981, sourceLabel: 'Reconsideration requested on 19 Sep 2026',
    summary: 'Limpopo asks that the suspension be lifted for laboratory-only services while its licence renewal is processed.',
    detectedAt: '2026-09-19T08:30:00Z', lapsesOn: null, status: 'open',
    assessedByUserId: null, assessedAt: null, disposition: null, activeBidsReviewed: false, activeContractsReviewed: false,
    resultingDecisionId: null, taskId: null, impactedTenderIds: [7], impactedContractIds: [],
  },
]);

export const INTEGRITY_SCREENINGS: readonly FxScreening[] = Object.freeze([
  {
    id: 951, tenantId: KWU, supplierTenantId: SEROWE, checkType: 'sanctions', source: 'UN Security Council consolidated list',
    checkedAt: '2026-09-01T06:00:00Z', result: 'possible_match',
    matchDetail: 'Name similarity with “Serowe ICT Holdings Ltd” (match score 0.82). Registration numbers not compared yet.',
    reviewedByUserId: null, reviewedAt: null, disposition: null, effect: null,
  },
  {
    id: 952, tenantId: KWU, supplierTenantId: MAKGADIKGADI, checkType: 'registry', source: 'CIPA online registry',
    checkedAt: '2026-09-03T06:00:00Z', result: 'no_match', matchDetail: null,
    reviewedByUserId: USERS.neo, reviewedAt: '2026-09-04T08:00:00Z', disposition: 'Registration active; directors match the ownership disclosure.', effect: 'None',
  },
  {
    id: 953, tenantId: KWU, supplierTenantId: MAKGADIKGADI, checkType: 'debarment', source: 'PPADB debarment register',
    checkedAt: '2026-09-03T06:00:00Z', result: 'no_match', matchDetail: null,
    reviewedByUserId: null, reviewedAt: null, disposition: null, effect: null,
  },
  {
    id: 954, tenantId: KWU, supplierTenantId: TSODILO, checkType: 'sanctions', source: 'UN Security Council consolidated list',
    checkedAt: '2026-03-22T06:00:00Z', result: 'no_match', matchDetail: null,
    reviewedByUserId: null, reviewedAt: null, disposition: null, effect: null,
  },
  {
    id: 955, tenantId: KWU, supplierTenantId: CHOBE, checkType: 'adverse_media', source: 'Mmegi and Sunday Standard archives',
    checkedAt: '2026-09-08T06:00:00Z', result: 'possible_match',
    matchDetail: 'Article of 12 Jun 2026 on late deliveries by “Chobe Pipe Traders”.',
    reviewedByUserId: USERS.neo, reviewedAt: '2026-09-09T09:30:00Z',
    disposition: 'False positive: the article concerns Chobe Pipe Traders (registration BW00001302871), a different company.',
    effect: 'No effect on eligibility.',
  },
  {
    id: 956, tenantId: KWU, supplierTenantId: GABORONE_METER, checkType: 'debarment', source: 'PPADB debarment register',
    checkedAt: '2026-09-23T06:00:00Z', result: 'no_match', matchDetail: null,
    reviewedByUserId: null, reviewedAt: null, disposition: null, effect: null,
  },
  {
    id: 957, tenantId: KWU, supplierTenantId: LIMPOPO, checkType: 'adverse_media', source: 'Mmegi and Sunday Standard archives',
    checkedAt: '2026-08-20T06:00:00Z', result: 'possible_match',
    matchDetail: 'Report of 18 Aug 2026 on waste contractors operating with lapsing licences names Limpopo Environmental Services.',
    reviewedByUserId: USERS.neo, reviewedAt: '2026-08-21T10:00:00Z',
    disposition: 'Consistent with the licence expiry already tracked by trigger 902; no separate restriction.',
    effect: 'Handled through reassessment trigger 902.',
  },
  {
    id: 961, tenantId: ODC, supplierTenantId: TSODILO, checkType: 'debarment', source: 'PPADB debarment register',
    checkedAt: '2026-09-16T06:00:00Z', result: 'no_match', matchDetail: null,
    reviewedByUserId: null, reviewedAt: null, disposition: null, effect: null,
  },
]);

export const RECONSIDERATIONS: readonly FxReconsideration[] = Object.freeze([
  {
    id: 981,
    decisionId: 706,
    grounds: 'The licence renewal was lodged on 18 Sep 2026 and the Department confirmed that we may continue operating while it is processed. We ask that the suspension be lifted for laboratory-only services.',
    requestedAt: '2026-09-19T08:30:00Z',
    requestedByUserId: USERS.limpopoAdmin,
    evidenceItemIds: [809],
  },
]);

export const EVIDENCE_UPDATES: readonly FxEvidenceUpdate[] = Object.freeze([
  {
    id: 971,
    decisionId: 706,
    evidenceItemId: 809,
    note: 'Acknowledgement of our licence renewal application; the new licence will follow.',
    submittedAt: '2026-09-18T14:00:00Z',
    submittedByUserId: USERS.limpopoAdmin,
  },
]);

export function findDecision(decisionId: number): FxDecision | undefined {
  return QUALIFICATION_DECISIONS.find((decision) => decision.id === decisionId);
}
