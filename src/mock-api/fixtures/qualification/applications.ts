/**
 * Qualification fixtures, part 3: applications and their assessment (SUP-20, BUY-33, BUY-34; blueprint
 * `qualification_applications`, `qualification_answers`, `qualification_answer_evidence`,
 * `qualification_info_requests`, `qualification_findings`, `financial_reviews`).
 *
 * Storyline anchors:
 * - QA-2026-0006 (Makgadikgadi, KWU program 11) is `more_info_required`: the financial statements are
 *   group-consolidated, unaudited management accounts of the parent; `lesego.finance` recorded an `unclear`
 *   financial review and an open information request, and no ISO 9001 certificate was provided (missing
 *   evidence is recorded as does_not_meet, never a pass) (AC-07, AC-08).
 * - QA-2026-0007 (Chobe, scope extension to WTR-PUMP) is `decision_pending` and overdue; its insurance evidence
 *   expires on 2026-10-08 (AC-09).
 * - QA-2026-0005 (Serowe, metering) is `under_review` with a sanctions screening possible match that only flags
 *   review (BR-48) and a missing BOBS type approval.
 * - QA-2026-0008 (Gaborone Metering) renews an expired decision and is still unassigned.
 * - Drafts exist only for suppliers (511 Gaborone Metering at KWU, 603 Makgadikgadi at ODC): buyers never see them.
 *
 * Answers are generated per criterion from the supplier's profile, and the evidence cited is the supplier's
 * library item for that criterion family that was valid on the submission date (an immutable snapshot, DD-17).
 */
import type { NonNegativeMoney } from '../../../contracts/common.js';
import type {
  FinancialReviewsConclusion,
  QualificationAnswersApplicability,
  QualificationApplicationsRiskLevel,
  QualificationApplicationsStatus,
  QualificationDecisionsBlockedGate,
  QualificationDecisionsOutcome,
  QualificationFindingsFinding,
  QualificationInfoRequestsStatus,
  TasksPriority,
} from '../../../contracts/enums.js';
import type { FxCriterion } from './programs.js';
import { criteriaOf } from './programs.js';
import type { CriterionKey, FxEvidenceItem } from './world.js';
import {
  BWP,
  CHOBE,
  EVIDENCE_ITEMS,
  GABORONE_METER,
  KWU,
  LIMPOPO,
  MAKGADIKGADI,
  ODC,
  SEROWE,
  TSODILO,
  USERS,
} from './world.js';

export interface FxApplication {
  readonly id: number;
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly programVersionId: number;
  readonly reference: string | null;
  readonly status: QualificationApplicationsStatus;
  readonly scopeCategoryId: number;
  readonly scopeMaxValue: NonNegativeMoney | null;
  readonly scopeGeography: string | null;
  readonly submittedAt: string | null;
  readonly submittedByUserId: number | null;
  readonly assessorUserId: number | null;
  readonly financialReviewerUserId: number | null;
  readonly dueAt: string | null;
  readonly priority: TasksPriority;
  readonly riskLevel: QualificationApplicationsRiskLevel | null;
  readonly renewalOfDecisionId: number | null;
  readonly withdrawnReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Additional business field values saved in this session's command (absent: the recorded values, ADM-07). */
  readonly customFields?: Readonly<Record<string, string | boolean | null>>;
}

export interface FxEvidenceCitation {
  readonly evidenceSubmissionId: number;
  readonly evidenceItemId: number;
  readonly submittedAt: string;
}

export interface FxAnswer {
  readonly id: number;
  readonly tenantId: number;
  readonly applicationId: number;
  readonly criterionId: number;
  readonly applicability: QualificationAnswersApplicability;
  readonly naReason: string | null;
  readonly answerText: string | null;
  readonly answerNumber: string | null;
  readonly answerDate: string | null;
  readonly answerBool: boolean | null;
  readonly updatedByUserId: number;
  readonly updatedAt: string;
  readonly evidence: readonly FxEvidenceCitation[];
}

export interface FxInfoRequest {
  readonly id: number;
  readonly tenantId: number;
  readonly applicationId: number;
  readonly criterionId: number | null;
  readonly question: string;
  readonly requestedByUserId: number;
  readonly requestedAt: string;
  readonly dueAt: string;
  readonly status: QualificationInfoRequestsStatus;
  readonly responseText: string | null;
  readonly respondedByUserId: number | null;
  readonly respondedAt: string | null;
  readonly responseEvidence: readonly FxEvidenceCitation[];
}

export interface FxFinding {
  readonly id: number;
  readonly tenantId: number;
  readonly applicationId: number;
  readonly criterionId: number | null;
  readonly assessorUserId: number;
  readonly finding: QualificationFindingsFinding;
  readonly rationale: string;
  readonly evidenceRefs: string | null;
  readonly flagOnly: boolean;
  readonly recordedAt: string;
}

export interface FxFinancialReview {
  readonly id: number;
  readonly tenantId: number;
  readonly applicationId: number;
  readonly reviewerUserId: number;
  readonly financialPeriodEnd: string;
  readonly reportingCurrency: string;
  readonly isConsolidated: boolean;
  readonly source: string;
  readonly turnover: string | null;
  readonly currentRatio: string | null;
  readonly debtToEquity: string | null;
  readonly parentSupportEvidence: string | null;
  readonly materialQualifications: string | null;
  readonly conclusion: FinancialReviewsConclusion;
  readonly rationale: string;
  readonly reviewedAt: string;
}

export interface FxRecommendation {
  readonly applicationId: number;
  readonly tenantId: number;
  readonly proposedOutcome: Extract<QualificationDecisionsOutcome, 'qualified' | 'qualified_with_conditions' | 'not_qualified'>;
  readonly scopeCategoryId: number;
  readonly scopeMaxValue: NonNegativeMoney | null;
  readonly scopeGeography: string | null;
  readonly conditions: string | null;
  readonly allowedActivities: string | null;
  readonly blockedGate: QualificationDecisionsBlockedGate;
  readonly rationale: string;
  readonly recommendedByUserId: number;
  readonly recommendedAt: string;
}

// ---------------------------------------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------------------------------------

export const QUALIFICATION_APPLICATIONS: readonly FxApplication[] = Object.freeze([
  {
    id: 500, tenantId: KWU, supplierTenantId: TSODILO, programVersionId: 111, reference: 'QA-2025-0014', status: 'decided',
    scopeCategoryId: 2, scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2025-10-06T09:12:00Z', submittedByUserId: USERS.tsodiloBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: USERS.lesego, dueAt: '2025-11-14T15:00:00Z', priority: 'normal', riskLevel: 'low',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2025-09-29T07:40:00Z', updatedAt: '2025-11-19T12:00:00Z',
  },
  {
    id: 501, tenantId: KWU, supplierTenantId: TSODILO, programVersionId: 112, reference: 'QA-2026-0002', status: 'decided',
    scopeCategoryId: 2, scopeMaxValue: BWP('8000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-03-20T10:05:00Z', submittedByUserId: USERS.tsodiloBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: USERS.lesego, dueAt: '2026-04-17T15:00:00Z', priority: 'normal', riskLevel: 'low',
    renewalOfDecisionId: 700, withdrawnReason: null, createdAt: '2026-03-09T08:00:00Z', updatedAt: '2026-04-14T13:20:00Z',
  },
  {
    id: 502, tenantId: KWU, supplierTenantId: CHOBE, programVersionId: 112, reference: 'QA-2026-0003', status: 'decided',
    scopeCategoryId: 3, scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-04-02T08:40:00Z', submittedByUserId: USERS.chobeBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: USERS.lesego, dueAt: '2026-04-30T15:00:00Z', priority: 'normal', riskLevel: 'medium',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-03-24T09:00:00Z', updatedAt: '2026-05-04T08:30:00Z',
  },
  {
    id: 503, tenantId: KWU, supplierTenantId: MAKGADIKGADI, programVersionId: 112, reference: 'QA-2026-0006', status: 'more_info_required',
    scopeCategoryId: 2, scopeMaxValue: BWP('4000000.00'), scopeGeography: 'Central District',
    submittedAt: '2026-09-02T13:25:00Z', submittedByUserId: USERS.makgadikgadiAdmin, assessorUserId: USERS.neo,
    financialReviewerUserId: USERS.lesego, dueAt: '2026-10-09T15:00:00Z', priority: 'high', riskLevel: 'high',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-08-26T10:00:00Z', updatedAt: '2026-09-26T11:45:00Z',
  },
  {
    id: 504, tenantId: KWU, supplierTenantId: SEROWE, programVersionId: 121, reference: 'QA-2026-0001', status: 'decided',
    scopeCategoryId: 5, scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-01-08T07:55:00Z', submittedByUserId: USERS.seroweBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: USERS.lesego, dueAt: '2026-01-29T15:00:00Z', priority: 'normal', riskLevel: 'low',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2025-12-12T08:00:00Z', updatedAt: '2026-01-30T09:00:00Z',
  },
  {
    id: 505, tenantId: KWU, supplierTenantId: GABORONE_METER, programVersionId: 131, reference: 'QA-2024-0006', status: 'decided',
    scopeCategoryId: 4, scopeMaxValue: BWP('3000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2024-07-15T09:00:00Z', submittedByUserId: USERS.gaboroneBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: null, dueAt: '2024-08-16T15:00:00Z', priority: 'normal', riskLevel: 'low',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2024-07-01T08:00:00Z', updatedAt: '2024-08-30T10:00:00Z',
  },
  {
    id: 506, tenantId: KWU, supplierTenantId: GABORONE_METER, programVersionId: 131, reference: 'QA-2026-0008', status: 'submitted',
    scopeCategoryId: 4, scopeMaxValue: BWP('3000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-09-22T11:30:00Z', submittedByUserId: USERS.gaboroneBidManager, assessorUserId: null,
    financialReviewerUserId: null, dueAt: null, priority: 'high', riskLevel: null,
    renewalOfDecisionId: 704, withdrawnReason: null, createdAt: '2026-09-16T08:30:00Z', updatedAt: '2026-09-22T11:30:00Z',
  },
  {
    id: 507, tenantId: KWU, supplierTenantId: LIMPOPO, programVersionId: 141, reference: 'QA-2025-0019', status: 'decided',
    scopeCategoryId: 11, scopeMaxValue: BWP('2000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2025-12-01T08:15:00Z', submittedByUserId: USERS.limpopoAdmin, assessorUserId: USERS.neo,
    financialReviewerUserId: USERS.lesego, dueAt: '2026-01-09T15:00:00Z', priority: 'normal', riskLevel: 'medium',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2025-11-24T08:00:00Z', updatedAt: '2026-01-20T08:00:00Z',
  },
  {
    id: 508, tenantId: KWU, supplierTenantId: SEROWE, programVersionId: 131, reference: 'QA-2026-0005', status: 'under_review',
    scopeCategoryId: 4, scopeMaxValue: BWP('3000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-08-24T12:00:00Z', submittedByUserId: USERS.seroweBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: null, dueAt: '2026-10-02T15:00:00Z', priority: 'normal', riskLevel: 'medium',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-08-17T08:00:00Z', updatedAt: '2026-09-18T15:20:00Z',
  },
  {
    id: 509, tenantId: KWU, supplierTenantId: CHOBE, programVersionId: 112, reference: 'QA-2026-0007', status: 'decision_pending',
    scopeCategoryId: 2, scopeMaxValue: BWP('3000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-09-07T09:45:00Z', submittedByUserId: USERS.chobeBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: USERS.lesego, dueAt: '2026-09-28T15:00:00Z', priority: 'high', riskLevel: 'medium',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-25T16:05:00Z',
  },
  {
    id: 510, tenantId: KWU, supplierTenantId: TSODILO, programVersionId: 141, reference: 'QA-2026-0004', status: 'withdrawn',
    scopeCategoryId: 11, scopeMaxValue: BWP('1000000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-05-11T10:00:00Z', submittedByUserId: USERS.tsodiloBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: null, dueAt: '2026-06-12T15:00:00Z', priority: 'low', riskLevel: 'low',
    renewalOfDecisionId: null,
    withdrawnReason: 'Our laboratory partnership did not proceed. We withdraw until we can meet the SADCAS accreditation criterion.',
    createdAt: '2026-05-04T08:00:00Z', updatedAt: '2026-06-02T09:30:00Z',
  },
  {
    id: 511, tenantId: KWU, supplierTenantId: GABORONE_METER, programVersionId: 112, reference: null, status: 'draft',
    scopeCategoryId: 3, scopeMaxValue: BWP('2000000.00'), scopeGeography: 'Botswana',
    submittedAt: null, submittedByUserId: null, assessorUserId: null,
    financialReviewerUserId: null, dueAt: null, priority: 'normal', riskLevel: null,
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-09-26T09:00:00Z', updatedAt: '2026-09-29T16:10:00Z',
  },
  {
    id: 512, tenantId: KWU, supplierTenantId: TSODILO, programVersionId: 121, reference: 'QA-2026-0009', status: 'under_review',
    scopeCategoryId: 5, scopeMaxValue: BWP('1500000.00'), scopeGeography: 'Botswana',
    submittedAt: '2026-09-14T08:20:00Z', submittedByUserId: USERS.tsodiloBidManager, assessorUserId: USERS.neo,
    financialReviewerUserId: null, dueAt: '2026-10-16T15:00:00Z', priority: 'normal', riskLevel: 'low',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-09-07T08:00:00Z', updatedAt: '2026-09-21T10:00:00Z',
  },
  {
    id: 601, tenantId: ODC, supplierTenantId: LIMPOPO, programVersionId: 211, reference: 'QA-2026-0001', status: 'decided',
    scopeCategoryId: 20, scopeMaxValue: BWP('1500000.00'), scopeGeography: 'Okavango District',
    submittedAt: '2026-04-20T08:00:00Z', submittedByUserId: USERS.limpopoAdmin, assessorUserId: USERS.officerOdc,
    financialReviewerUserId: null, dueAt: '2026-05-15T15:00:00Z', priority: 'normal', riskLevel: 'low',
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-04-14T08:00:00Z', updatedAt: '2026-05-14T10:00:00Z',
  },
  {
    id: 602, tenantId: ODC, supplierTenantId: TSODILO, programVersionId: 221, reference: 'QA-2026-0002', status: 'submitted',
    scopeCategoryId: 21, scopeMaxValue: BWP('4500000.00'), scopeGeography: 'Okavango District',
    submittedAt: '2026-09-15T14:10:00Z', submittedByUserId: USERS.tsodiloBidManager, assessorUserId: null,
    financialReviewerUserId: null, dueAt: null, priority: 'normal', riskLevel: null,
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-09-08T08:00:00Z', updatedAt: '2026-09-15T14:10:00Z',
  },
  {
    id: 603, tenantId: ODC, supplierTenantId: MAKGADIKGADI, programVersionId: 221, reference: null, status: 'draft',
    scopeCategoryId: 21, scopeMaxValue: BWP('2000000.00'), scopeGeography: 'Okavango District',
    submittedAt: null, submittedByUserId: null, assessorUserId: null,
    financialReviewerUserId: null, dueAt: null, priority: 'normal', riskLevel: null,
    renewalOfDecisionId: null, withdrawnReason: null, createdAt: '2026-09-20T08:00:00Z', updatedAt: '2026-09-24T12:30:00Z',
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------------------------------------

interface SupplierProfile {
  readonly ownership: string;
  readonly capacity: string;
  readonly currentRatio: string;
  readonly naPiReason: string | null;
  readonly naEnvReason: string | null;
}

const PROFILES: Record<number, SupplierProfile> = {
  [TSODILO]: {
    ownership: 'Motsamai Tsodilo 60%, Tsodilo Family Trust 40%. No parent company.',
    capacity:
      '68 staff including 22 qualified artisans; workshops in Gaborone and Maun; 14 service vehicles with lifting equipment; current workload about 55% of capacity.',
    currentRatio: '1.85',
    naPiReason: 'We install and maintain equipment to the buyer’s specifications and offer no design or engineering advice.',
    naEnvReason: null,
  },
  [CHOBE]: {
    ownership: 'Gorata Mphoeng 51%, Kasane Industrial Holdings (Pty) Ltd 49%.',
    capacity:
      '4,000 m² warehouse in Francistown with valve testing bench; 31 staff; three delivery trucks; stock holding of about BWP 6 million.',
    currentRatio: '1.31',
    naPiReason: 'Supply of pipes and valves only; no design services are offered.',
    naEnvReason: 'Supply and delivery only; we perform no site works.',
  },
  [MAKGADIKGADI]: {
    ownership:
      'Wholly owned subsidiary of Makgadikgadi Holdings (Pty) Ltd, owned by Sethunya Makgadi (70%) and Letlhakane Investments (30%).',
    capacity:
      '45 staff; plant yard in Letlhakane; pump installation through a subcontracted mechanical team; current workload about 80% of capacity.',
    currentRatio: '0.94',
    naPiReason: 'Construction and installation only; design is provided by the client’s engineer.',
    naEnvReason: null,
  },
  [SEROWE]: {
    ownership: 'Otsile Serowe 55%, Tshepiso Khama 45%.',
    capacity: '52 engineers and technicians; 24/7 network operations centre in Serowe; field teams in four districts.',
    currentRatio: '1.62',
    naPiReason: null,
    naEnvReason: null,
  },
  [LIMPOPO]: {
    ownership: 'Mothusi Limpopo 100%.',
    capacity: 'Accredited laboratory in Palapye; 18 field technicians; two sampling vehicles.',
    currentRatio: '1.44',
    naPiReason: null,
    naEnvReason: null,
  },
  [GABORONE_METER]: {
    ownership: 'Kagiso Metsi 50%, Lame Ntshole 50%.',
    capacity: 'Meter workshop and test bench in Gaborone; 27 installers; meter reading teams for 40,000 connections.',
    currentRatio: '1.58',
    naPiReason: 'Supply and installation of pipes and fittings only; no design services.',
    naEnvReason: null,
  },
};

/** Answer adjustments per application: `unanswered`, or fields that replace the generated answer. */
type AnswerOverride =
  | 'unanswered'
  | Partial<Pick<FxAnswer, 'applicability' | 'naReason' | 'answerText' | 'answerNumber' | 'answerBool' | 'answerDate'>> & {
      readonly evidenceItemIds?: readonly number[];
    };

interface AnswerPlan {
  readonly overrides?: Partial<Record<CriterionKey, AnswerOverride>>;
  /** Criteria answered in a draft; every other criterion stays unanswered. */
  readonly draftAnswered?: readonly CriterionKey[];
}

const PLANS: Record<number, AnswerPlan> = {
  503: {
    overrides: {
      ISO9001: {
        answerText: 'Certification audit is booked with SGS for November 2026; the certificate is not yet issued.',
        evidenceItemIds: [],
      },
      ENV_POLICY: 'unanswered',
    },
  },
  508: {
    overrides: {
      METER_APPROVAL: {
        answerText: 'Type approval application BOBS/TA/2026/118 was lodged on 15 Aug 2026; the certificate is expected in November 2026.',
        evidenceItemIds: [],
      },
    },
  },
  510: {
    overrides: {
      LAB_ACCRED: {
        answerText: 'Accreditation through a partner laboratory is being arranged.',
        evidenceItemIds: [],
      },
    },
  },
  511: { draftAnswered: ['REG', 'OWN', 'FIN_STMT', 'FIN_RATIO', 'PI_INS'] },
  603: {
    overrides: {
      PLANT: { answerText: 'Two graders and a roller are hired from Maun Plant Hire under a standing agreement.' },
    },
  },
};

/** The library item of this family valid on the date (latest first); drafts use current items. */
function evidenceFor(supplierTenantId: number, key: CriterionKey, onDate: string | null): FxEvidenceItem[] {
  const candidates = EVIDENCE_ITEMS.filter(
    (item) =>
      item.supplierTenantId === supplierTenantId &&
      item.fits.includes(key) &&
      (onDate === null ? item.status === 'current' : (item.validFrom ?? '0000') <= onDate.slice(0, 10)),
  ).sort((a, b) => (b.validFrom ?? '').localeCompare(a.validFrom ?? ''));
  const first = candidates[0];
  return first === undefined ? [] : [first];
}

function generatedAnswer(
  criterion: FxCriterion,
  profile: SupplierProfile,
): Pick<FxAnswer, 'applicability' | 'naReason' | 'answerText' | 'answerNumber' | 'answerBool' | 'answerDate'> {
  const base = { applicability: 'applicable' as const, naReason: null, answerText: null, answerNumber: null, answerBool: null, answerDate: null };
  if (criterion.key === 'PI_INS' && profile.naPiReason !== null) {
    return { ...base, applicability: 'not_applicable', naReason: profile.naPiReason };
  }
  if (criterion.key === 'ENV_POLICY' && profile.naEnvReason !== null && !criterion.mandatory) {
    return { ...base, applicability: 'not_applicable', naReason: profile.naEnvReason };
  }
  switch (criterion.responseType) {
    case 'yes_no':
      return { ...base, answerBool: true };
    case 'number':
      return { ...base, answerNumber: profile.currentRatio };
    case 'text':
      return { ...base, answerText: criterion.key === 'OWN' ? profile.ownership : profile.capacity };
    case 'date':
      return base;
    case 'document':
      return base;
  }
}

function buildAnswers(): FxAnswer[] {
  const answers: FxAnswer[] = [];
  for (const application of QUALIFICATION_APPLICATIONS) {
    const profile = PROFILES[application.supplierTenantId];
    if (profile === undefined) {
      throw new Error(`No supplier profile for tenant ${application.supplierTenantId}.`);
    }
    const plan = PLANS[application.id] ?? {};
    const updatedBy = application.submittedByUserId ?? supplierAdminOf(application.supplierTenantId);
    const answeredAt = application.submittedAt ?? application.updatedAt;
    criteriaOf(application.programVersionId).forEach((criterion, index) => {
      if (plan.draftAnswered !== undefined && !plan.draftAnswered.includes(criterion.key)) {
        return;
      }
      const override = plan.overrides?.[criterion.key];
      if (override === 'unanswered') {
        return;
      }
      const generated = generatedAnswer(criterion, profile);
      const { evidenceItemIds, ...fields } = override ?? {};
      const merged = { ...generated, ...fields };
      const items =
        merged.applicability === 'not_applicable' || criterion.evidenceTypes.length === 0
          ? []
          : evidenceIdsOrLookup(evidenceItemIds, application.supplierTenantId, criterion.key, application.submittedAt);
      const position = index + 1;
      answers.push({
        id: application.id * 100 + position,
        tenantId: application.tenantId,
        applicationId: application.id,
        criterionId: criterion.id,
        ...merged,
        updatedByUserId: updatedBy,
        updatedAt: answeredAt,
        evidence: items.map((item, itemIndex) => ({
          evidenceSubmissionId: application.id * 1000 + position * 10 + itemIndex,
          evidenceItemId: item.id,
          submittedAt: answeredAt,
        })),
      });
    });
  }
  return answers;
}

function evidenceIdsOrLookup(
  ids: readonly number[] | undefined,
  supplierTenantId: number,
  key: CriterionKey,
  onDate: string | null,
): FxEvidenceItem[] {
  if (ids === undefined) {
    return evidenceFor(supplierTenantId, key, onDate);
  }
  return ids.flatMap((id) => EVIDENCE_ITEMS.filter((item) => item.id === id));
}

function supplierAdminOf(supplierTenantId: number): number {
  switch (supplierTenantId) {
    case TSODILO:
      return USERS.tsodiloAdmin;
    case CHOBE:
      return USERS.chobeAdmin;
    case SEROWE:
      return USERS.seroweAdmin;
    case GABORONE_METER:
      return USERS.gaboroneAdmin;
    case MAKGADIKGADI:
      return USERS.makgadikgadiAdmin;
    default:
      return USERS.limpopoAdmin;
  }
}

export const QUALIFICATION_ANSWERS: readonly FxAnswer[] = Object.freeze(buildAnswers());

// ---------------------------------------------------------------------------------------------------------
// Information requests (AC-08)
// ---------------------------------------------------------------------------------------------------------

export const QUALIFICATION_INFO_REQUESTS: readonly FxInfoRequest[] = Object.freeze([
  {
    id: 1401, tenantId: KWU, applicationId: 503, criterionId: 11203,
    question:
      'The statements provided are unaudited, group-consolidated management accounts of Makgadikgadi Holdings. Provide audited statements of Makgadikgadi Civil Works (Pty) Ltd for FY2025, or a signed parent support letter from Makgadikgadi Holdings stating the guaranteed amount and period.',
    requestedByUserId: USERS.lesego, requestedAt: '2026-09-24T09:30:00Z', dueAt: '2026-10-07T15:00:00Z', status: 'open',
    responseText: null, respondedByUserId: null, respondedAt: null, responseEvidence: [],
  },
  {
    id: 1402, tenantId: KWU, applicationId: 503, criterionId: 11208,
    question: 'The public liability certificate names Makgadikgadi Holdings. Confirm that Makgadikgadi Civil Works is an insured party under the policy.',
    requestedByUserId: USERS.neo, requestedAt: '2026-09-15T08:10:00Z', dueAt: '2026-09-29T15:00:00Z', status: 'answered',
    responseText: 'Attached is the insurer’s letter confirming that Makgadikgadi Civil Works (Pty) Ltd is a named insured under the group policy HIB-PL-2026-1120.',
    respondedByUserId: USERS.makgadikgadiAdmin, respondedAt: '2026-09-26T11:45:00Z',
    responseEvidence: [{ evidenceSubmissionId: 1402001, evidenceItemId: 608, submittedAt: '2026-09-26T11:45:00Z' }],
  },
  {
    id: 1403, tenantId: KWU, applicationId: 502, criterionId: 11208,
    question: 'The insurance certificate expires on 8 Oct 2026. Confirm the renewal arrangements for the policy.',
    requestedByUserId: USERS.neo, requestedAt: '2026-04-10T08:00:00Z', dueAt: '2026-04-20T15:00:00Z', status: 'closed',
    responseText: 'The policy renews annually each October. We will upload the renewed certificate before expiry.',
    respondedByUserId: USERS.chobeAdmin, respondedAt: '2026-04-16T10:20:00Z', responseEvidence: [],
  },
  {
    id: 1404, tenantId: KWU, applicationId: 507, criterionId: 14103,
    question: 'The waste management licence expires on 5 Sep 2026, before the end of the qualification period. Describe your renewal plan.',
    requestedByUserId: USERS.neo, requestedAt: '2025-12-10T08:00:00Z', dueAt: '2025-12-19T15:00:00Z', status: 'closed',
    responseText: 'We will apply for renewal three months before expiry and share the new licence immediately.',
    respondedByUserId: USERS.limpopoAdmin, respondedAt: '2025-12-15T09:00:00Z', responseEvidence: [],
  },
  {
    id: 1405, tenantId: KWU, applicationId: 508, criterionId: 13103,
    question: 'Provide the BOBS type approval certificate for the smart meters offered, or the reference of the pending application.',
    requestedByUserId: USERS.neo, requestedAt: '2026-09-08T09:00:00Z', dueAt: '2026-09-18T15:00:00Z', status: 'answered',
    responseText: 'Application BOBS/TA/2026/118 was lodged on 15 Aug 2026. BOBS expects to issue the certificate in November 2026.',
    respondedByUserId: USERS.seroweBidManager, respondedAt: '2026-09-18T15:20:00Z', responseEvidence: [],
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------------------------------------

interface FindingOverride {
  readonly finding: QualificationFindingsFinding;
  readonly rationale: string;
  readonly flagOnly?: boolean;
  readonly byFinancialReviewer?: boolean;
}

/** Applications assessed criterion by criterion, and when; overrides replace the generated finding. */
const ASSESSED: Record<number, { readonly at: string; readonly overrides?: Partial<Record<CriterionKey, FindingOverride | 'none'>> }> = {
  500: { at: '2025-11-10T10:00:00Z', overrides: { ISO9001: { finding: 'clarification_needed', rationale: 'The ISO 9001 certificate expired in August 2025 and the recertification audit is pending. A condition is proposed.' } } },
  501: { at: '2026-04-09T10:00:00Z' },
  502: { at: '2026-04-24T10:00:00Z' },
  503: {
    at: '2026-09-24T09:00:00Z',
    overrides: {
      FIN_STMT: {
        finding: 'clarification_needed',
        rationale:
          'The statements are unaudited, group-consolidated management accounts of the parent. Entity-level figures and an audit opinion are missing; information request 1401 is open.',
        byFinancialReviewer: true,
      },
      FIN_RATIO: {
        finding: 'clarification_needed',
        rationale:
          'The declared ratio of 0.94 is below the 1.20 threshold and is taken from group figures. It flags review only and is not a rejection (BR-48).',
        flagOnly: true,
        byFinancialReviewer: true,
      },
      ISO9001: {
        finding: 'does_not_meet',
        rationale: 'No ISO 9001 certificate was provided. Missing mandatory evidence is not treated as a pass.',
      },
      PL_INS: {
        finding: 'clarification_needed',
        rationale: 'The certificate names the parent company. The insurer’s letter received on 26 Sep 2026 is being verified.',
      },
      ENV_POLICY: 'none',
      CLIENT_REFS: 'none',
    },
  },
  504: { at: '2026-01-26T10:00:00Z' },
  505: { at: '2024-08-12T10:00:00Z' },
  507: { at: '2026-01-06T10:00:00Z' },
  508: {
    at: '2026-09-10T10:00:00Z',
    overrides: {
      METER_APPROVAL: {
        finding: 'does_not_meet',
        rationale:
          'No BOBS type approval certificate yet; application BOBS/TA/2026/118 is pending. Missing mandatory evidence is not treated as a pass.',
      },
      NO_EXCL: {
        finding: 'clarification_needed',
        rationale:
          'Sanctions screening returned a possible name match (“Serowe ICT Holdings Ltd”). This only flags a review of the match; it is not an exclusion (BR-48).',
        flagOnly: true,
      },
    },
  },
  512: { at: '2026-09-21T10:00:00Z' },
  509: {
    at: '2026-09-23T10:00:00Z',
    overrides: {
      PL_INS: {
        finding: 'meets',
        rationale:
          'Cover of BWP 5,000,000 meets the threshold, but the policy expires on 8 Oct 2026. A condition blocks award until the renewed certificate is supplied.',
      },
      FIN_RATIO: {
        finding: 'meets',
        rationale: 'Current ratio 1.31 meets the 1.20 threshold with limited headroom; see financial review.',
        byFinancialReviewer: true,
      },
    },
  },
  601: { at: '2026-05-08T10:00:00Z' },
};

function buildFindings(): FxFinding[] {
  const findings: FxFinding[] = [];
  for (const application of QUALIFICATION_APPLICATIONS) {
    const plan = ASSESSED[application.id];
    if (plan === undefined || application.assessorUserId === null) {
      continue;
    }
    const assessor = application.assessorUserId;
    criteriaOf(application.programVersionId).forEach((criterion, index) => {
      const override = plan.overrides?.[criterion.key];
      if (override === 'none') {
        return;
      }
      const answer = QUALIFICATION_ANSWERS.find(
        (candidate) => candidate.applicationId === application.id && candidate.criterionId === criterion.id,
      );
      const financial = criterion.area === 'financial' && application.financialReviewerUserId !== null;
      const evidenceTitles = (answer?.evidence ?? [])
        .map((citation) => EVIDENCE_ITEMS.find((item) => item.id === citation.evidenceItemId)?.title)
        .filter((title): title is string => title !== undefined);
      const generated: FindingOverride =
        answer?.applicability === 'not_applicable'
          ? { finding: 'not_applicable', rationale: `Declared not applicable: ${answer.naReason ?? ''} Accepted.` }
          : {
              finding: 'meets',
              rationale:
                evidenceTitles.length > 0
                  ? `Reviewed ${evidenceTitles.join('; ')}. Meets the requirement.`
                  : 'Answer reviewed against the criterion. Meets the requirement.',
            };
      const chosen = override ?? generated;
      findings.push({
        id: 100000 + application.id * 100 + index + 1,
        tenantId: application.tenantId,
        applicationId: application.id,
        criterionId: criterion.id,
        assessorUserId:
          (chosen.byFinancialReviewer === true || financial) && application.financialReviewerUserId !== null
            ? application.financialReviewerUserId
            : assessor,
        finding: chosen.finding,
        rationale: chosen.rationale,
        evidenceRefs: evidenceTitles.length > 0 ? evidenceTitles.join('; ') : null,
        flagOnly: chosen.flagOnly ?? false,
        recordedAt: plan.at,
      });
    });
  }
  findings.push({
    id: 150399,
    tenantId: KWU,
    applicationId: 503,
    criterionId: null,
    assessorUserId: USERS.neo,
    finding: 'clarification_needed',
    rationale:
      'The applicant is a subsidiary of Makgadikgadi Holdings. The program does not let a parent’s strength qualify a subsidiary without a signed support commitment.',
    evidenceRefs: null,
    flagOnly: false,
    recordedAt: '2026-09-15T08:05:00Z',
  });
  return findings;
}

export const QUALIFICATION_FINDINGS: readonly FxFinding[] = Object.freeze(buildFindings());

// ---------------------------------------------------------------------------------------------------------
// Financial reviews (restricted, AC-08)
// ---------------------------------------------------------------------------------------------------------

export const FINANCIAL_REVIEWS: readonly FxFinancialReview[] = Object.freeze([
  {
    id: 1300, tenantId: KWU, applicationId: 500, reviewerUserId: USERS.lesego, financialPeriodEnd: '2025-06-30',
    reportingCurrency: 'BWP', isConsolidated: false, source: 'Audited financial statements FY2025 (KPMG Botswana), entity level',
    turnover: '39800000.00', currentRatio: '1.78', debtToEquity: '0.66', parentSupportEvidence: null, materialQualifications: null,
    conclusion: 'adequate', rationale: 'Turnover and liquidity comfortably support contracts up to BWP 5,000,000.', reviewedAt: '2025-11-07T14:00:00Z',
  },
  {
    id: 1301, tenantId: KWU, applicationId: 501, reviewerUserId: USERS.lesego, financialPeriodEnd: '2025-06-30',
    reportingCurrency: 'BWP', isConsolidated: false, source: 'Audited financial statements FY2025 (KPMG Botswana), entity level',
    turnover: '42300000.00', currentRatio: '1.85', debtToEquity: '0.62', parentSupportEvidence: null, materialQualifications: null,
    conclusion: 'adequate', rationale: 'Turnover of BWP 42.3 million and a current ratio of 1.85 support the requested scope of BWP 8,000,000.', reviewedAt: '2026-04-08T11:00:00Z',
  },
  {
    id: 1302, tenantId: KWU, applicationId: 502, reviewerUserId: USERS.lesego, financialPeriodEnd: '2025-03-31',
    reportingCurrency: 'BWP', isConsolidated: false, source: 'Audited financial statements FY2025 (Grant Thornton Botswana), entity level',
    turnover: '21600000.00', currentRatio: '1.31', debtToEquity: '1.12', parentSupportEvidence: null,
    materialQualifications: 'Working capital is tight in the fourth quarter; limit the scope to BWP 5,000,000 per contract.',
    conclusion: 'adequate_with_limitations', rationale: 'Adequate for pipe and valve supply up to BWP 5,000,000.', reviewedAt: '2026-04-22T15:30:00Z',
  },
  {
    id: 1303, tenantId: KWU, applicationId: 503, reviewerUserId: USERS.lesego, financialPeriodEnd: '2025-12-31',
    reportingCurrency: 'BWP', isConsolidated: true,
    source: 'Unaudited group-consolidated management accounts FY2025 of Makgadikgadi Holdings (Pty) Ltd, supplied by the applicant',
    turnover: '18750000.00', currentRatio: null, debtToEquity: null, parentSupportEvidence: null,
    materialQualifications:
      'Figures are group-consolidated and unaudited; the applicant entity’s own figures are not separated. No parent support letter was provided. Ratios cannot be verified.',
    conclusion: 'unclear',
    rationale: 'Financial capacity for BWP 4,000,000 of pump works cannot be concluded. Information request 1401 asks for entity-level audited statements or parent support.',
    reviewedAt: '2026-09-24T09:20:00Z',
  },
  {
    id: 1304, tenantId: KWU, applicationId: 509, reviewerUserId: USERS.lesego, financialPeriodEnd: '2025-03-31',
    reportingCurrency: 'BWP', isConsolidated: false, source: 'Audited financial statements FY2025 (Grant Thornton Botswana), entity level',
    turnover: '21600000.00', currentRatio: '1.31', debtToEquity: '1.12', parentSupportEvidence: null,
    materialQualifications: 'Combined exposure with the existing WTR-PIPE scope should stay under BWP 8,000,000.',
    conclusion: 'adequate_with_limitations', rationale: 'Adequate for an additional WTR-PUMP scope of BWP 3,000,000.', reviewedAt: '2026-09-21T13:00:00Z',
  },
  {
    id: 1305, tenantId: KWU, applicationId: 504, reviewerUserId: USERS.lesego, financialPeriodEnd: '2025-02-28',
    reportingCurrency: 'BWP', isConsolidated: false, source: 'Audited financial statements FY2025 (PwC Botswana), entity level',
    turnover: '27400000.00', currentRatio: '1.62', debtToEquity: '0.48', parentSupportEvidence: null, materialQualifications: null,
    conclusion: 'adequate', rationale: 'Adequate for ICT services up to BWP 5,000,000.', reviewedAt: '2026-01-22T10:00:00Z',
  },
  {
    id: 1306, tenantId: KWU, applicationId: 507, reviewerUserId: USERS.lesego, financialPeriodEnd: '2025-09-30',
    reportingCurrency: 'BWP', isConsolidated: false, source: 'Audited financial statements FY2025 (Deloitte Botswana), entity level',
    turnover: '9800000.00', currentRatio: '1.44', debtToEquity: '0.71', parentSupportEvidence: null, materialQualifications: null,
    conclusion: 'adequate', rationale: 'Adequate for laboratory and environmental services up to BWP 2,000,000.', reviewedAt: '2026-01-05T10:00:00Z',
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Recommendations (decision_pending)
// ---------------------------------------------------------------------------------------------------------

export const RECOMMENDATIONS: readonly FxRecommendation[] = Object.freeze([
  {
    applicationId: 509,
    tenantId: KWU,
    proposedOutcome: 'qualified_with_conditions',
    scopeCategoryId: 2,
    scopeMaxValue: BWP('3000000.00'),
    scopeGeography: 'Botswana',
    conditions: 'Supply a renewed public liability insurance certificate (cover of at least BWP 5,000,000) before the current policy expires on 8 Oct 2026.',
    allowedActivities: 'Receive invitations and submit bids for WTR-PUMP work up to BWP 3,000,000.',
    blockedGate: 'award',
    rationale:
      'All mandatory criteria are met. Financial capacity is adequate with limitations. The insurance expiry is handled as a condition that blocks award only.',
    recommendedByUserId: USERS.neo,
    recommendedAt: '2026-09-25T16:05:00Z',
  },
]);

export function findApplication(applicationId: number): FxApplication | undefined {
  return QUALIFICATION_APPLICATIONS.find((application) => application.id === applicationId);
}
