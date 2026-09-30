/**
 * Qualification schemas (domain 04; FR-06, BR-03, BR-23, BR-24, BR-25, BR-48; PRD §7.3, §8.3).
 *
 * Field names mirror the blueprint tables of Migration 05 (`qualification_programs`,
 * `qualification_program_versions`, `qualification_criteria`, `qualification_applications`, `qualification_answers`,
 * `qualification_answer_evidence`, `qualification_info_requests`, `qualification_findings`, `financial_reviews`,
 * `qualification_decisions`, `reassessment_triggers`, `integrity_screenings`) and the view `v_qualification_status`
 * (DD-13), in camelCase.
 *
 * Business rules the shapes encode (Stage B enforces them with the declared error codes):
 * - Programs are versioned; applications and decisions cite the criteria version they used (FR-06, DD-07).
 * - Buyer views never show `draft` applications; supplier views never show findings, financial reviews,
 *   screenings, reassessment triggers or internal decision reasons (DD-03 `[R]`, PRD §4.3, §7.3).
 * - "Not applicable" carries a reason where the criterion requires one; missing evidence is never a pass.
 * - A screening match or financial ratio only flags review (`flagOnly`, BR-48); it never decides alone.
 * - Decisions are superseded, never overwritten; `expired` is derived from `effectiveTo` (DD-13, DD-20).
 * - Scope amounts carry their currency (DD-08); due dates travel with the official time zone (BR-11).
 * - Supplier reconsideration requests and evidence updates (SUP-24) reach the decider on BUY-35. The blueprint has
 *   no table for them: Stage B adds `qualification_reconsiderations` (decision_id, grounds, requested_by,
 *   requested_at, evidence_item_ids, resolved_by_decision_id) and `qualification_evidence_updates` (decision_id,
 *   evidence_item_id, note, submitted_by, submitted_at), and each insert raises a `manual` `reassessment_triggers`
 *   row (`source_type` `reconsideration_request` / `evidence_submission`) so the request is triaged like any trigger.
 *   The decider answers with a superseding decision (`resolved_by_decision_id`) or a trigger disposition.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { CustomFieldValues } from '../policy/shared.js';

import {
  CalendarDate,
  CurrencyCode,
  DecimalString,
  Id,
  IdParam,
  Instant,
  LinkPath,
  NonNegativeMoney,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  issue,
  listQueryWithSort,
  queryList,
} from '../common.js';
import {
  BidsSubmissionState,
  ContractsStatus,
  EvidenceItemsEvidenceType,
  EvidenceItemsStatus,
  EvidenceItemsVerificationStatus,
  FinancialReviewsConclusion,
  IntegrityScreeningsCheckType,
  IntegrityScreeningsResult,
  ParticipantsQualificationGate,
  QualificationAnswersApplicability,
  QualificationApplicationsRiskLevel,
  QualificationApplicationsStatus,
  QualificationCriteriaArea,
  QualificationCriteriaResponseType,
  QualificationDecisionsBlockedGate,
  QualificationDecisionsOutcome,
  QualificationFindingsFinding,
  QualificationInfoRequestsStatus,
  QualificationProgramVersionsStatus,
  QualificationProgramsStatus,
  ReassessmentTriggersStatus,
  ReassessmentTriggersTriggerType,
  TasksPriority,
  TenantsStatus,
  TenantsVerificationStatus,
  TendersStatus,
  VQualificationStatusEffectiveStatus,
  ApprovalRequestsStatus,
} from '../enums.js';

// ---------------------------------------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------------------------------------

/** Bounded free text (questions, guidance, conditions, explanations). */
const LongText = z
  .string()
  .trim()
  .min(1, issue('TEXT_REQUIRED', 'This text is required.'))
  .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.'));

/** Optional bounded free text (`null` clears it). */
const OptionalLongText = z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).nullable();

/** `qualification_applications.priority`: the task priority scale (contract-defined, see enums follow-up). */
export const QualificationPriority = TasksPriority;
export type QualificationPriority = z.infer<typeof QualificationPriority>;

/** A buyer category (`categories`), with its catalog code (`WTR-PUMP`). Programs cover descendants (DD-26). */
export const CategoryRef = z.object({
  categoryId: Id,
  code: z.string().min(1),
  name: z.string().min(1),
  parentId: Id.nullable(),
});
export type CategoryRef = z.infer<typeof CategoryRef>;

/** A supplier organization as buyer screens name it (the legal name is the party of record). */
export const SupplierRef = z.object({
  supplierTenantId: Id,
  name: z.string().min(1),
  legalName: z.string().min(1),
  slug: z.string().min(1),
});
export type SupplierRef = z.infer<typeof SupplierRef>;

/** A buyer organization as supplier screens name it (SUP-24 separates buyer-specific decisions). */
export const BuyerRef = z.object({
  buyerTenantId: Id,
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type BuyerRef = z.infer<typeof BuyerRef>;

/** A program and the exact criteria version an application or decision uses. */
export const ProgramVersionRef = z.object({
  programId: Id,
  programName: z.string().min(1),
  programVersionId: Id,
  versionNo: z.number().int().min(1),
});
export type ProgramVersionRef = z.infer<typeof ProgramVersionRef>;

// ---------------------------------------------------------------------------------------------------------
// Programs and criteria (ADM-09)
// ---------------------------------------------------------------------------------------------------------

/** `qualification_criteria` row. */
export const Criterion = z.object({
  id: Id,
  programVersionId: Id,
  area: QualificationCriteriaArea,
  question: z.string().min(1),
  guidance: z.string().nullable(),
  responseType: QualificationCriteriaResponseType,
  mandatory: z.boolean(),
  evidenceTypes: z.array(EvidenceItemsEvidenceType),
  requiresNaReason: z.boolean(),
  thresholdDescription: z.string().nullable(),
  sortOrder: z.number().int().min(0),
});
export type Criterion = z.infer<typeof Criterion>;

/** `qualification_program_versions` row with its criterion counts. */
export const ProgramVersion = z.object({
  id: Id,
  programId: Id,
  versionNo: z.number().int().min(1),
  status: QualificationProgramVersionsStatus,
  changeNote: z.string().nullable(),
  approvedBy: PersonRef.nullable(),
  approvedAt: Instant.nullable(),
  createdAt: Instant,
  criteriaCount: z.number().int().min(0),
  mandatoryCount: z.number().int().min(0),
  /** Applications (any status except draft) that cite this version: they keep it after a newer approval. */
  applicationCount: z.number().int().min(0),
});
export type ProgramVersion = z.infer<typeof ProgramVersion>;

/** Criteria per assessment area (PRD §7.3 table). */
export const AreaCount = z.object({
  area: QualificationCriteriaArea,
  criteria: z.number().int().min(0),
  mandatory: z.number().int().min(0),
});
export type AreaCount = z.infer<typeof AreaCount>;

/** One program in the ADM-09 register. */
export const ProgramRow = z.object({
  id: Id,
  name: z.string().min(1),
  status: QualificationProgramsStatus,
  category: CategoryRef,
  /** Categories the program covers: its category and every descendant (DD-26). */
  coveredCategories: z.array(CategoryRef),
  geography: z.string().nullable(),
  maxContractValue: NonNegativeMoney.nullable(),
  validityMonths: z.number().int().min(1),
  renewalNoticeDays: z.number().int().min(0),
  requiresIndependentApproval: z.boolean(),
  owner: PersonRef,
  currentVersion: ProgramVersion.pick({ id: true, versionNo: true, status: true, approvedAt: true }).nullable(),
  /** A draft revision being prepared, if any. */
  draftVersionNo: z.number().int().min(1).nullable(),
  criteriaCount: z.number().int().min(0),
  openApplicationCount: z.number().int().min(0),
  qualifiedSupplierCount: z.number().int().min(0),
  updatedAt: Instant,
});
export type ProgramRow = z.infer<typeof ProgramRow>;

export const PROGRAM_SORT_FIELDS = ['name', 'status', 'updatedAt', 'openApplicationCount'] as const;
export const ProgramListQuery = listQueryWithSort(PROGRAM_SORT_FIELDS).extend({
  status: queryList(QualificationProgramsStatus).optional(),
  categoryId: IdParam.optional(),
  ownerUserId: IdParam.optional(),
  updatedFrom: CalendarDate.optional(),
  updatedTo: CalendarDate.optional(),
});
export type ProgramListQuery = z.output<typeof ProgramListQuery>;

/** The decision authority and monitoring configuration of a program. */
export const ProgramDetail = ProgramRow.extend({
  description: z.string().nullable(),
  /** `qualification_programs.decision_role_code`: the role template whose holders decide (within authority). */
  decisionRoleCode: z.string().min(1),
  decisionRoleName: z.string().min(1),
  assessors: z.array(PersonRef),
  financialReviewers: z.array(PersonRef),
  deciders: z.array(PersonRef),
  /** Events that raise a reassessment trigger for suppliers qualified under this program (BR-25). */
  monitoredTriggerTypes: z.array(ReassessmentTriggersTriggerType),
  versions: z.array(ProgramVersion),
  /** The version whose criteria are shown (the `versionId` query, else the draft, else the current version). */
  shownVersionId: Id.nullable(),
  criteria: z.array(Criterion),
  areaCounts: z.array(AreaCount),
});
export type ProgramDetail = z.infer<typeof ProgramDetail>;

export const ProgramParams = z.object({ programId: IdParam });
export const ProgramVersionParams = z.object({ programId: IdParam, versionId: IdParam });
export const ProgramDetailQuery = z.object({ versionId: IdParam.optional() });

const ProgramFields = z.object({
  name: z
    .string()
    .trim()
    .min(3, issue('NAME_TOO_SHORT', 'At least 3 characters.'))
    .max(200, issue('NAME_TOO_LONG', 'At most 200 characters.')),
  description: OptionalLongText,
  categoryId: Id,
  geography: z.string().trim().max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.')).nullable(),
  maxContractValue: NonNegativeMoney.nullable(),
  validityMonths: z
    .number()
    .int(issue('INVALID_VALIDITY', 'Use whole months.'))
    .min(1, issue('INVALID_VALIDITY', 'At least 1 month.'))
    .max(120, issue('INVALID_VALIDITY', 'At most 120 months.')),
  renewalNoticeDays: z
    .number()
    .int(issue('INVALID_NOTICE_DAYS', 'Use whole days.'))
    .min(0, issue('INVALID_NOTICE_DAYS', 'Cannot be negative.'))
    .max(365, issue('INVALID_NOTICE_DAYS', 'At most 365 days.')),
  decisionRoleCode: z.string().trim().min(1, issue('DECISION_ROLE_REQUIRED', 'Choose the deciding role.')),
  requiresIndependentApproval: z.boolean(),
  ownerUserId: Id,
  monitoredTriggerTypes: z.array(ReassessmentTriggersTriggerType),
});

export const CreateProgramBody = ProgramFields;
export type CreateProgramBody = z.infer<typeof CreateProgramBody>;

export const UpdateProgramBody = ProgramFields.partial().refine(
  (value) => Object.keys(value).length > 0,
  issue('NOTHING_TO_UPDATE', 'Change at least one field.'),
);
export type UpdateProgramBody = z.infer<typeof UpdateProgramBody>;

export const CreateProgramVersionBody = z.object({
  changeNote: LongText,
  /** The version to copy criteria from (default: the current version). */
  copyFromVersionId: Id.nullable(),
});
export type CreateProgramVersionBody = z.infer<typeof CreateProgramVersionBody>;

export const CriterionInput = z
  .object({
    area: QualificationCriteriaArea,
    question: LongText,
    guidance: OptionalLongText,
    responseType: QualificationCriteriaResponseType,
    mandatory: z.boolean(),
    evidenceTypes: z.array(EvidenceItemsEvidenceType),
    requiresNaReason: z.boolean(),
    thresholdDescription: OptionalLongText,
    sortOrder: z.number().int().min(0),
  })
  .superRefine((value, context) => {
    if (value.responseType === 'document' && value.evidenceTypes.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceTypes'],
        message: issue('EVIDENCE_TYPES_REQUIRED', 'A document criterion names the evidence types it accepts.'),
      });
    }
  });
export type CriterionInput = z.infer<typeof CriterionInput>;

export const SaveCriteriaBody = z.object({
  criteria: z
    .array(CriterionInput)
    .min(1, issue('CRITERIA_REQUIRED', 'Add at least one criterion.'))
    .max(200, issue('TOO_MANY_CRITERIA', 'At most 200 criteria.')),
});
export type SaveCriteriaBody = z.infer<typeof SaveCriteriaBody>;

export const ApproveVersionBody = z.object({ note: OptionalLongText });
export const RetireProgramBody = z.object({ reason: ReasonText });

// ---------------------------------------------------------------------------------------------------------
// Evidence, answers, info requests (SUP-20, BUY-34)
// ---------------------------------------------------------------------------------------------------------

/**
 * One evidence edition cited by an answer: an immutable `evidence_submissions` snapshot of an `evidence_items` row
 * (DD-17). Later expiry never relabels the submission (BR-25): `expiredSinceSubmission` only flags it.
 */
export const EvidenceSnapshot = z.object({
  evidenceSubmissionId: Id,
  evidenceItemId: Id,
  evidenceType: EvidenceItemsEvidenceType,
  title: z.string().min(1),
  issuer: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  periodStart: CalendarDate.nullable(),
  periodEnd: CalendarDate.nullable(),
  reportingCurrency: CurrencyCode.nullable(),
  isConsolidated: z.boolean().nullable(),
  coverageAmount: NonNegativeMoney.nullable(),
  validFrom: CalendarDate.nullable(),
  expiresAt: CalendarDate.nullable(),
  verificationStatus: EvidenceItemsVerificationStatus,
  documentId: Id,
  documentVersionId: Id,
  fileName: z.string().min(1),
  submittedAt: Instant,
  expiredSinceSubmission: z.boolean(),
  /** The item was replaced by a newer edition in the supplier's library after this submission. */
  replacedSinceSubmission: z.boolean(),
});
export type EvidenceSnapshot = z.infer<typeof EvidenceSnapshot>;

/** `qualification_answers` row (null fields are unanswered). */
export const Answer = z.object({
  id: Id,
  applicability: QualificationAnswersApplicability,
  naReason: z.string().nullable(),
  answerText: z.string().nullable(),
  answerNumber: DecimalString.nullable(),
  answerDate: CalendarDate.nullable(),
  answerBool: z.boolean().nullable(),
  updatedBy: PersonRef.nullable(),
  updatedAt: Instant,
});
export type Answer = z.infer<typeof Answer>;

/** `qualification_info_requests` row. */
export const InfoRequest = z.object({
  id: Id,
  applicationId: Id,
  criterionId: Id.nullable(),
  criterionQuestion: z.string().nullable(),
  area: QualificationCriteriaArea.nullable(),
  question: z.string().min(1),
  requestedBy: PersonRef,
  requestedAt: Instant,
  dueAt: OfficialDeadline,
  status: QualificationInfoRequestsStatus,
  responseText: z.string().nullable(),
  respondedBy: PersonRef.nullable(),
  respondedAt: Instant.nullable(),
  responseEvidence: z.array(EvidenceSnapshot),
});
export type InfoRequest = z.infer<typeof InfoRequest>;

/** Completeness of an application against its criteria version (missing evidence is never a pass). */
export const Completeness = z.object({
  criteriaTotal: z.number().int().min(0),
  answered: z.number().int().min(0),
  mandatoryUnanswered: z.number().int().min(0),
  mandatoryEvidenceMissing: z.number().int().min(0),
  naWithoutReason: z.number().int().min(0),
  expiredEvidence: z.number().int().min(0),
});
export type Completeness = z.infer<typeof Completeness>;

// ---------------------------------------------------------------------------------------------------------
// Buyer review queue (BUY-33)
// ---------------------------------------------------------------------------------------------------------

/** Application statuses a buyer can see: never `draft` (blueprint Migration 05). */
export const BuyerApplicationStatus = QualificationApplicationsStatus.exclude(['draft']);
export type BuyerApplicationStatus = z.infer<typeof BuyerApplicationStatus>;

export const BuyerApplicationRow = z.object({
  id: Id,
  reference: Reference,
  supplier: SupplierRef,
  program: ProgramVersionRef,
  scopeCategory: CategoryRef,
  scopeMaxValue: NonNegativeMoney.nullable(),
  status: BuyerApplicationStatus,
  riskLevel: QualificationApplicationsRiskLevel.nullable(),
  priority: QualificationPriority,
  assessor: PersonRef.nullable(),
  financialReviewer: PersonRef.nullable(),
  submittedAt: Instant,
  dueAt: OfficialDeadline.nullable(),
  overdue: z.boolean(),
  completeness: Completeness,
  /** The earlier decision this application renews, if it is a renewal. */
  renewalOfDecisionId: Id.nullable(),
  /** Days until the current decision of this supplier and program expires (negative: already expired). */
  currentDecisionExpiresInDays: z.number().int().nullable(),
  openInfoRequestCount: z.number().int().min(0),
  screeningFlagCount: z.number().int().min(0),
  link: LinkPath,
});
export type BuyerApplicationRow = z.infer<typeof BuyerApplicationRow>;

export const BUYER_APPLICATION_SORT_FIELDS = [
  'reference',
  'supplierName',
  'submittedAt',
  'dueAt',
  'priority',
  'riskLevel',
  'status',
] as const;
export const BuyerApplicationListQuery = listQueryWithSort(BUYER_APPLICATION_SORT_FIELDS).extend({
  status: queryList(BuyerApplicationStatus).optional(),
  programId: IdParam.optional(),
  categoryId: IdParam.optional(),
  riskLevel: queryList(QualificationApplicationsRiskLevel).optional(),
  priority: queryList(QualificationPriority).optional(),
  assessorUserId: IdParam.optional(),
  financialReviewerUserId: IdParam.optional(),
  /** Only applications without an assessor. */
  unassigned: QueryBoolean.optional(),
  /** Only renewals of an earlier decision. */
  renewal: QueryBoolean.optional(),
  overdue: QueryBoolean.optional(),
  submittedFrom: CalendarDate.optional(),
  submittedTo: CalendarDate.optional(),
  dueFrom: CalendarDate.optional(),
  dueTo: CalendarDate.optional(),
});
export type BuyerApplicationListQuery = z.output<typeof BuyerApplicationListQuery>;

/** KPI counts of BUY-33/BUY-35. Counts only rows the caller may see (BR-43). */
export const QualificationSummary = z.object({
  byStatus: z.array(z.object({ status: BuyerApplicationStatus, count: z.number().int().min(0) })),
  unassigned: z.number().int().min(0),
  overdue: z.number().int().min(0),
  highRisk: z.number().int().min(0),
  openInfoRequests: z.number().int().min(0),
  renewalsInQueue: z.number().int().min(0),
  decisionsExpiringIn90Days: z.number().int().min(0),
  expiredDecisions: z.number().int().min(0),
  openTriggers: z.number().int().min(0),
  unreviewedScreeningFlags: z.number().int().min(0),
  /** Current decisions with a supplier reconsideration request awaiting the decider. */
  openReconsiderations: z.number().int().min(0),
  asOf: Instant,
});
export type QualificationSummary = z.infer<typeof QualificationSummary>;

/** A person who can take a qualification role, with their current open workload. */
export const AssigneeOption = PersonRef.extend({
  capacity: z.string().nullable(),
  openAssignments: z.number().int().min(0),
});
export type AssigneeOption = z.infer<typeof AssigneeOption>;

/** Choices for program, assignment and decision forms. */
export const QualificationOptions = z.object({
  categories: z.array(CategoryRef),
  assessors: z.array(AssigneeOption),
  financialReviewers: z.array(AssigneeOption),
  deciders: z.array(AssigneeOption),
  programOwners: z.array(PersonRef),
  decisionRoles: z.array(z.object({ code: z.string().min(1), name: z.string().min(1) })),
  currencies: z.array(CurrencyCode),
  officialTimeZone: z.string().min(1),
});
export type QualificationOptions = z.infer<typeof QualificationOptions>;

export const ApplicationParams = z.object({ applicationId: IdParam });

export const AssignApplicationBody = z.object({
  assessorUserId: Id,
  /** Required where the program has financial criteria and the risk calls for specialist review (AC-08). */
  financialReviewerUserId: Id.nullable(),
  dueAt: Instant,
  priority: QualificationPriority,
  riskLevel: QualificationApplicationsRiskLevel,
});
export type AssignApplicationBody = z.infer<typeof AssignApplicationBody>;

// ---------------------------------------------------------------------------------------------------------
// Assessment (BUY-34)
// ---------------------------------------------------------------------------------------------------------

/** `qualification_findings` row. */
export const Finding = z.object({
  id: Id,
  criterionId: Id.nullable(),
  finding: QualificationFindingsFinding,
  rationale: z.string().min(1),
  evidenceRefs: z.string().nullable(),
  /** A screening match or ratio that only flags review; it never decides alone (BR-48). */
  flagOnly: z.boolean(),
  assessor: PersonRef,
  recordedAt: Instant,
});
export type Finding = z.infer<typeof Finding>;

/** One criterion of the application with the supplier's answer, evidence and the buyer's finding. */
export const AssessmentItem = z.object({
  criterion: Criterion,
  answer: Answer.nullable(),
  evidence: z.array(EvidenceSnapshot),
  /** Mandatory evidence expected but not provided: never treated as a pass. */
  evidenceMissing: z.boolean(),
  finding: Finding.nullable(),
  openInfoRequestIds: z.array(Id),
});
export type AssessmentItem = z.infer<typeof AssessmentItem>;

/** `integrity_screenings` row (buyer-internal, `[R]`). A possible match is not a restriction (BR-48). */
export const Screening = z.object({
  id: Id,
  supplier: SupplierRef,
  checkType: IntegrityScreeningsCheckType,
  source: z.string().min(1),
  checkedAt: Instant,
  result: IntegrityScreeningsResult,
  matchDetail: z.string().nullable(),
  reviewedBy: PersonRef.nullable(),
  reviewedAt: Instant.nullable(),
  disposition: z.string().nullable(),
  effect: z.string().nullable(),
});
export type Screening = z.infer<typeof Screening>;

export const SCREENING_SORT_FIELDS = ['checkedAt', 'supplierName', 'result'] as const;
export const ScreeningListQuery = listQueryWithSort(SCREENING_SORT_FIELDS).extend({
  supplierTenantId: IdParam.optional(),
  result: queryList(IntegrityScreeningsResult).optional(),
  checkType: queryList(IntegrityScreeningsCheckType).optional(),
  unreviewed: QueryBoolean.optional(),
});
export type ScreeningListQuery = z.output<typeof ScreeningListQuery>;

/** The assessor's proposed outcome, sent for decision (under_review → decision_pending). */
export const Recommendation = z.object({
  proposedOutcome: QualificationDecisionsOutcome.extract(['qualified', 'qualified_with_conditions', 'not_qualified']),
  scopeCategory: CategoryRef,
  scopeMaxValue: NonNegativeMoney.nullable(),
  scopeGeography: z.string().nullable(),
  conditions: z.string().nullable(),
  allowedActivities: z.string().nullable(),
  blockedGate: QualificationDecisionsBlockedGate,
  rationale: z.string().min(1),
  recommendedBy: PersonRef,
  recommendedAt: Instant,
  approvalRequestId: Id.nullable(),
  approvalStatus: ApprovalRequestsStatus.nullable(),
});
export type Recommendation = z.infer<typeof Recommendation>;

/** What the caller may do on the application (derived from permissions, assignment and state). */
export const BuyerApplicationActions = z.object({
  canAssign: z.boolean(),
  canRecordFindings: z.boolean(),
  canRequestInfo: z.boolean(),
  canViewFinancialReview: z.boolean(),
  canRecordFinancialReview: z.boolean(),
  canRecommend: z.boolean(),
  canDecide: z.boolean(),
});
export type BuyerApplicationActions = z.infer<typeof BuyerApplicationActions>;

export const BuyerApplicationDetail = BuyerApplicationRow.extend({
  submittedBy: PersonRef,
  scopeGeography: z.string().nullable(),
  requiresIndependentApproval: z.boolean(),
  /** Categories the program covers; a recommended or decided scope must stay within them (BR-24, DD-26). */
  programCoveredCategories: z.array(CategoryRef),
  items: z.array(AssessmentItem),
  infoRequests: z.array(InfoRequest),
  /** Application-level findings without a criterion (for example a screening flag). */
  generalFindings: z.array(Finding),
  screenings: z.array(Screening),
  recommendation: Recommendation.nullable(),
  /** The decision recorded for this application, once decided. */
  decisionId: Id.nullable(),
  /** The supplier's current status for this program (another decision may still be in force during a renewal). */
  currentStatus: VQualificationStatusEffectiveStatus,
  /** Financial review exists; the content is served only to financial reviewers and deciders. */
  financialReviewRecorded: z.boolean(),
  /** The organization's additional fields of the application form, including buyer-internal ones (ADM-07). */
  customFields: CustomFieldValues.optional(),
  actions: BuyerApplicationActions,
});
export type BuyerApplicationDetail = z.infer<typeof BuyerApplicationDetail>;

/** `financial_reviews` row (restricted: financial reviewers and deciders only, AC-08). */
export const FinancialReview = z.object({
  id: Id,
  applicationId: Id,
  reviewer: PersonRef,
  financialPeriodEnd: CalendarDate,
  reportingCurrency: CurrencyCode,
  isConsolidated: z.boolean(),
  source: z.string().min(1),
  turnover: DecimalString.nullable(),
  currentRatio: DecimalString.nullable(),
  debtToEquity: DecimalString.nullable(),
  parentSupportEvidence: z.string().nullable(),
  materialQualifications: z.string().nullable(),
  conclusion: FinancialReviewsConclusion,
  rationale: z.string().min(1),
  reviewedAt: Instant,
});
export type FinancialReview = z.infer<typeof FinancialReview>;

/** The restricted financial review panel of BUY-34. */
export const FinancialReviewPanel = z.object({
  applicationId: Id,
  reference: Reference,
  supplier: SupplierRef,
  financialReviewer: PersonRef.nullable(),
  /** Program thresholds that apply to the financial area. */
  financialCriteria: z.array(Criterion),
  financialEvidence: z.array(EvidenceSnapshot),
  reviews: z.array(FinancialReview),
  infoRequests: z.array(InfoRequest),
  canRecord: z.boolean(),
});
export type FinancialReviewPanel = z.infer<typeof FinancialReviewPanel>;

export const RecordFinancialReviewBody = z
  .object({
    financialPeriodEnd: CalendarDate,
    reportingCurrency: CurrencyCode,
    isConsolidated: z.boolean(),
    source: LongText,
    turnover: DecimalString.nullable(),
    currentRatio: DecimalString.nullable(),
    debtToEquity: DecimalString.nullable(),
    parentSupportEvidence: OptionalLongText,
    materialQualifications: OptionalLongText,
    conclusion: FinancialReviewsConclusion,
    rationale: LongText,
  })
  .superRefine((value, context) => {
    if (value.conclusion !== 'adequate' && (value.materialQualifications ?? '').trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['materialQualifications'],
        message: issue('QUALIFICATIONS_REQUIRED', 'Record the material qualifications behind this conclusion.'),
      });
    }
  });
export type RecordFinancialReviewBody = z.infer<typeof RecordFinancialReviewBody>;

export const FindingParams = z.object({ applicationId: IdParam, criterionId: IdParam });

export const RecordFindingBody = z.object({
  finding: QualificationFindingsFinding,
  rationale: LongText,
  evidenceRefs: OptionalLongText,
});
export type RecordFindingBody = z.infer<typeof RecordFindingBody>;

export const RequestInfoBody = z.object({
  criterionId: Id.nullable(),
  question: LongText,
  dueAt: Instant,
});
export type RequestInfoBody = z.infer<typeof RequestInfoBody>;

export const InfoRequestResult = z.object({
  infoRequest: InfoRequest,
  applicationStatus: QualificationApplicationsStatus,
});
export type InfoRequestResult = z.infer<typeof InfoRequestResult>;

export const InfoRequestParams = z.object({ applicationId: IdParam, infoRequestId: IdParam });
export const CloseInfoRequestBody = z.object({ note: OptionalLongText });

export const RecommendBody = z
  .object({
    proposedOutcome: QualificationDecisionsOutcome.extract(['qualified', 'qualified_with_conditions', 'not_qualified']),
    scopeCategoryId: Id,
    scopeMaxValue: NonNegativeMoney.nullable(),
    scopeGeography: z.string().trim().max(200).nullable(),
    conditions: OptionalLongText,
    allowedActivities: OptionalLongText,
    blockedGate: QualificationDecisionsBlockedGate,
    rationale: LongText,
  })
  .superRefine((value, context) => conditionalRules(value, context));
export type RecommendBody = z.infer<typeof RecommendBody>;

/** A conditional outcome states exactly what stays allowed and which future gate is blocked (PRD §7.3). */
function conditionalRules(
  value: {
    proposedOutcome?: string;
    outcome?: string;
    conditions: string | null;
    allowedActivities: string | null;
    blockedGate: string;
  },
  context: z.RefinementCtx,
): void {
  const outcome = value.proposedOutcome ?? value.outcome;
  if (outcome === 'qualified_with_conditions' || outcome === 'suspended') {
    if ((value.conditions ?? '').trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: issue('CONDITIONS_REQUIRED', 'State the conditions of this outcome.'),
      });
    }
    if ((value.allowedActivities ?? '').trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['allowedActivities'],
        message: issue('ALLOWED_ACTIVITIES_REQUIRED', 'State which activities remain allowed.'),
      });
    }
    if (value.blockedGate === 'none') {
      context.addIssue({
        code: 'custom',
        path: ['blockedGate'],
        message: issue('BLOCKED_GATE_REQUIRED', 'Name the future gate that stays blocked until the condition is met.'),
      });
    }
  }
}

export const RecommendationResult = z.object({
  applicationId: Id,
  status: QualificationApplicationsStatus,
  recommendation: Recommendation,
});
export type RecommendationResult = z.infer<typeof RecommendationResult>;

export const ScreeningParams = z.object({ screeningId: IdParam });
export const ReviewScreeningBody = z.object({
  disposition: LongText,
  /** The recorded effect; a confirmed restriction is decided through a decision, never by the screening (BR-48). */
  effect: LongText,
  raiseTrigger: z.boolean(),
});
export type ReviewScreeningBody = z.infer<typeof ReviewScreeningBody>;

// ---------------------------------------------------------------------------------------------------------
// Decisions, statuses and monitoring (BUY-35, SUP-24)
// ---------------------------------------------------------------------------------------------------------

/** A tender where the supplier is an active participant or bidder, affected by a status change (AC-09). */
export const ImpactedBid = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  tenderStatus: TendersStatus,
  submissionState: BidsSubmissionState,
  qualificationGate: ParticipantsQualificationGate,
  nextGate: z.string().nullable(),
  link: LinkPath,
});
export type ImpactedBid = z.infer<typeof ImpactedBid>;

/** A contract of the supplier affected by a status change. */
export const ImpactedContract = z.object({
  contractId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: ContractsStatus,
  link: LinkPath,
});
export type ImpactedContract = z.infer<typeof ImpactedContract>;

/**
 * A supplier's request to reconsider a current restricting decision (SUP-24 principal action). Stage B stores it
 * in `qualification_reconsiderations` (follow-up for the blueprint) and raises a `manual` `reassessment_triggers`
 * row with `source_type` `reconsideration_request` so the decider sees it on BUY-35.
 */
export const ReconsiderationRequest = z.object({
  decisionId: Id,
  grounds: z.string().min(1),
  requestedAt: Instant,
  requestedBy: PersonRef,
  evidenceItemIds: z.array(Id),
  appealRoute: z.string().nullable(),
  /** The decision that answered the request by superseding this one; null while it awaits the decider. */
  resolvedByDecisionId: Id.nullable(),
});
export type ReconsiderationRequest = z.infer<typeof ReconsiderationRequest>;

/**
 * Updated evidence a supplier supplies against a current decision (SUP-24). Stage B stores it in
 * `qualification_evidence_updates` (follow-up for the blueprint) and raises a `manual` `reassessment_triggers` row
 * with `source_type` `evidence_submission` and `source_id` = the update row.
 */
export const EvidenceUpdate = z.object({
  id: Id,
  decisionId: Id,
  evidenceItemId: Id,
  title: z.string().min(1),
  expiresAt: CalendarDate.nullable(),
  note: z.string().nullable(),
  submittedAt: Instant,
  submittedBy: PersonRef,
});
export type EvidenceUpdate = z.infer<typeof EvidenceUpdate>;

/** `qualification_decisions` row as buyers see it. */
export const Decision = z.object({
  id: Id,
  applicationId: Id,
  applicationReference: Reference,
  supplier: SupplierRef,
  program: ProgramVersionRef,
  outcome: QualificationDecisionsOutcome,
  /** `v_qualification_status.effective_status` for this row: `expired` once `effectiveTo` has passed. */
  effectiveStatus: VQualificationStatusEffectiveStatus,
  scopeCategory: CategoryRef,
  scopeMaxValue: NonNegativeMoney.nullable(),
  scopeGeography: z.string().nullable(),
  effectiveFrom: CalendarDate,
  effectiveTo: CalendarDate.nullable(),
  reassessmentDate: CalendarDate.nullable(),
  conditions: z.string().nullable(),
  allowedActivities: z.string().nullable(),
  blockedGate: QualificationDecisionsBlockedGate,
  reasons: z.string().min(1),
  supplierExplanation: z.string().nullable(),
  appealRoute: z.string().nullable(),
  reviewer: PersonRef.nullable(),
  approver: PersonRef.nullable(),
  approvalRequestId: Id.nullable(),
  decidedAt: Instant,
  supersededById: Id.nullable(),
  supersedeReason: z.string().nullable(),
  supplierNotifiedAt: Instant.nullable(),
  /** The supplier asked to reconsider this decision and no newer decision has answered yet (SUP-24 → BUY-35). */
  openReconsideration: z.boolean(),
  /** Updated evidence items the supplier supplied against this decision. */
  evidenceUpdateCount: z.number().int().min(0),
});
export type Decision = z.infer<typeof Decision>;

export const DECISION_SORT_FIELDS = ['decidedAt', 'effectiveFrom', 'effectiveTo', 'supplierName'] as const;
export const DecisionListQuery = listQueryWithSort(DECISION_SORT_FIELDS).extend({
  supplierTenantId: IdParam.optional(),
  programId: IdParam.optional(),
  outcome: queryList(QualificationDecisionsOutcome).optional(),
  includeSuperseded: QueryBoolean.optional(),
  decidedFrom: CalendarDate.optional(),
  decidedTo: CalendarDate.optional(),
});
export type DecisionListQuery = z.output<typeof DecisionListQuery>;

export const DecisionParams = z.object({ decisionId: IdParam });

/** `reassessment_triggers` row (buyer-internal `[R]`) with the active-event impacts to review (AC-09). */
export const Trigger = z.object({
  id: Id,
  triggerType: ReassessmentTriggersTriggerType,
  supplier: SupplierRef,
  program: ProgramVersionRef.nullable(),
  decisionId: Id.nullable(),
  decisionEffectiveStatus: VQualificationStatusEffectiveStatus.nullable(),
  sourceType: z.string().min(1),
  sourceId: Id.nullable(),
  sourceLabel: z.string().min(1),
  summary: z.string().min(1),
  detectedAt: Instant,
  /** The date the underlying evidence or decision lapses, when the trigger is time-based. */
  lapsesOn: CalendarDate.nullable(),
  status: ReassessmentTriggersStatus,
  assessedBy: PersonRef.nullable(),
  assessedAt: Instant.nullable(),
  disposition: z.string().nullable(),
  activeBidsReviewed: z.boolean(),
  activeContractsReviewed: z.boolean(),
  resultingDecisionId: Id.nullable(),
  taskId: Id.nullable(),
  impactedBids: z.array(ImpactedBid),
  impactedContracts: z.array(ImpactedContract),
});
export type Trigger = z.infer<typeof Trigger>;

export const TRIGGER_SORT_FIELDS = ['detectedAt', 'lapsesOn', 'supplierName', 'status'] as const;
export const TriggerListQuery = listQueryWithSort(TRIGGER_SORT_FIELDS).extend({
  status: queryList(ReassessmentTriggersStatus).optional(),
  triggerType: queryList(ReassessmentTriggersTriggerType).optional(),
  supplierTenantId: IdParam.optional(),
  programId: IdParam.optional(),
  detectedFrom: CalendarDate.optional(),
  detectedTo: CalendarDate.optional(),
  /** Only triggers with an impacted active bid or contract. */
  withImpacts: QueryBoolean.optional(),
});
export type TriggerListQuery = z.output<typeof TriggerListQuery>;

export const TriggerParams = z.object({ triggerId: IdParam });

export const CreateTriggerBody = z.object({
  supplierTenantId: Id,
  decisionId: Id,
  triggerType: ReassessmentTriggersTriggerType,
  summary: LongText,
});
export type CreateTriggerBody = z.infer<typeof CreateTriggerBody>;

export const AssessTriggerBody = z.object({
  /** assessed: no change to eligibility; action_taken: a decision was recorded; dismissed: not relevant. */
  resultingStatus: ReassessmentTriggersStatus.exclude(['open']),
  disposition: LongText,
  activeBidsReviewed: z.boolean(),
  activeContractsReviewed: z.boolean(),
  /** The superseding decision recorded for `action_taken`. */
  resultingDecisionId: Id.nullable(),
});
export type AssessTriggerBody = z.infer<typeof AssessTriggerBody>;

export const DecisionDetail = Decision.extend({
  /** Every decision for the same supplier and program, newest first (superseded rows are kept, never edited). */
  history: z.array(Decision.pick({
    id: true,
    outcome: true,
    effectiveStatus: true,
    effectiveFrom: true,
    effectiveTo: true,
    decidedAt: true,
    supersededById: true,
    supersedeReason: true,
    program: true,
  })),
  triggers: z.array(Trigger),
  impactedBids: z.array(ImpactedBid),
  impactedContracts: z.array(ImpactedContract),
  /** Evidence cited by the decision's application that expires within the renewal notice window or already has. */
  expiringEvidence: z.array(EvidenceSnapshot),
  /** Categories the decision's program covers; a superseding scope must stay within them (BR-24, DD-26). */
  programCoveredCategories: z.array(CategoryRef),
  /** The supplier's reconsideration request, open or answered (SUP-24); the decider answers it with a new decision. */
  reconsideration: ReconsiderationRequest.nullable(),
  /** Updated evidence the supplier supplied against this decision, newest first. */
  evidenceUpdates: z.array(EvidenceUpdate),
  renewalApplicationId: Id.nullable(),
  renewalRequestedAt: Instant.nullable(),
  canSupersede: z.boolean(),
});
export type DecisionDetail = z.infer<typeof DecisionDetail>;

const DecisionFields = z.object({
  scopeCategoryId: Id,
  scopeMaxValue: NonNegativeMoney.nullable(),
  scopeGeography: z.string().trim().max(200).nullable(),
  effectiveFrom: CalendarDate,
  effectiveTo: CalendarDate.nullable(),
  reassessmentDate: CalendarDate.nullable(),
  conditions: OptionalLongText,
  allowedActivities: OptionalLongText,
  blockedGate: QualificationDecisionsBlockedGate,
  reasons: LongText,
  supplierExplanation: LongText,
  appealRoute: OptionalLongText,
  notifySupplier: z.boolean(),
});

function datesInOrder(
  value: { effectiveFrom: string; effectiveTo: string | null; reassessmentDate: string | null },
  context: z.RefinementCtx,
): void {
  if (value.effectiveTo !== null && value.effectiveTo < value.effectiveFrom) {
    context.addIssue({
      code: 'custom',
      path: ['effectiveTo'],
      message: issue('EFFECTIVE_DATES_INVALID', 'The end date cannot be before the start date.'),
    });
  }
  if (value.reassessmentDate !== null && value.reassessmentDate < value.effectiveFrom) {
    context.addIssue({
      code: 'custom',
      path: ['reassessmentDate'],
      message: issue('REASSESSMENT_DATE_INVALID', 'The reassessment date cannot be before the start date.'),
    });
  }
}

export const DecideApplicationBody = DecisionFields.extend({
  outcome: QualificationDecisionsOutcome.extract(['qualified', 'qualified_with_conditions', 'not_qualified']),
}).superRefine((value, context) => {
  conditionalRules(value, context);
  datesInOrder(value, context);
});
export type DecideApplicationBody = z.infer<typeof DecideApplicationBody>;

/** Suspend, reinstate, withdraw, confirm conditions met or reassess: always a NEW decision row. */
export const SupersedeDecisionBody = DecisionFields.extend({
  /** `expired` is derived from the dates and is never written as a decision (DD-20). */
  outcome: QualificationDecisionsOutcome.exclude(['expired']),
  supersedeReason: LongText,
  /** The reassessment trigger this decision answers, if any. */
  triggerId: Id.nullable(),
}).superRefine((value, context) => {
  conditionalRules(value, context);
  datesInOrder(value, context);
});
export type SupersedeDecisionBody = z.infer<typeof SupersedeDecisionBody>;

export const RenewalRequestBody = z.object({
  message: LongText,
  dueAt: Instant,
});
export type RenewalRequestBody = z.infer<typeof RenewalRequestBody>;

export const RenewalRequestResult = z.object({
  decisionId: Id,
  supplier: SupplierRef,
  requestedAt: Instant,
  dueAt: OfficialDeadline,
  message: z.string().min(1),
});
export type RenewalRequestResult = z.infer<typeof RenewalRequestResult>;

/** One `v_qualification_status` row (DD-13): supplier × program, including `not_assessed`. */
export const StatusRow = z.object({
  supplier: SupplierRef,
  program: z.object({ programId: Id, programName: z.string().min(1) }),
  programCategory: CategoryRef,
  effectiveStatus: VQualificationStatusEffectiveStatus,
  decisionId: Id.nullable(),
  outcome: QualificationDecisionsOutcome.nullable(),
  scopeCategory: CategoryRef.nullable(),
  scopeMaxValue: NonNegativeMoney.nullable(),
  effectiveFrom: CalendarDate.nullable(),
  effectiveTo: CalendarDate.nullable(),
  reassessmentDate: CalendarDate.nullable(),
  conditions: z.string().nullable(),
  blockedGate: QualificationDecisionsBlockedGate.nullable(),
  /** Days until `effectiveTo` (negative once expired). */
  expiresInDays: z.number().int().nullable(),
  openTriggerCount: z.number().int().min(0),
  applicationInProgress: z
    .object({ applicationId: Id, reference: Reference, status: BuyerApplicationStatus })
    .nullable(),
});
export type StatusRow = z.infer<typeof StatusRow>;

export const STATUS_SORT_FIELDS = ['supplierName', 'programName', 'effectiveStatus', 'effectiveTo'] as const;
export const StatusListQuery = listQueryWithSort(STATUS_SORT_FIELDS).extend({
  effectiveStatus: queryList(VQualificationStatusEffectiveStatus).optional(),
  programId: IdParam.optional(),
  categoryId: IdParam.optional(),
  supplierTenantId: IdParam.optional(),
  expiringBefore: CalendarDate.optional(),
  withOpenTriggers: QueryBoolean.optional(),
});
export type StatusListQuery = z.output<typeof StatusListQuery>;

/** Qualification gate check for a supplier, category and value (BR-23; tenders' participation gate, AC-07). */
export const EligibilityQuery = z.object({
  supplierTenantId: IdParam,
  categoryId: IdParam,
  amount: DecimalString.optional(),
  currency: CurrencyCode.optional(),
  /** The date the gate is evaluated at (for example a submission deadline); defaults to today. */
  at: CalendarDate.optional(),
});
export type EligibilityQuery = z.output<typeof EligibilityQuery>;

export const Eligibility = z.object({
  supplier: SupplierRef,
  category: CategoryRef,
  gate: ParticipantsQualificationGate,
  effectiveStatus: VQualificationStatusEffectiveStatus,
  decisionId: Id.nullable(),
  program: z.object({ programId: Id, programName: z.string().min(1) }).nullable(),
  blockedGate: QualificationDecisionsBlockedGate.nullable(),
  explanation: z.string().min(1),
  evaluatedAt: CalendarDate,
});
export type Eligibility = z.infer<typeof Eligibility>;

// ---------------------------------------------------------------------------------------------------------
// Supplier views (SUP-20, SUP-24)
// ---------------------------------------------------------------------------------------------------------

/** One buyer × program status as the supplier sees it (AC-07: registration is not qualification). */
export const SupplierStatusRow = z.object({
  buyer: BuyerRef,
  program: z.object({ programId: Id, programName: z.string().min(1) }),
  programCategory: CategoryRef,
  coveredCategories: z.array(CategoryRef),
  effectiveStatus: VQualificationStatusEffectiveStatus,
  decisionId: Id.nullable(),
  scopeCategory: CategoryRef.nullable(),
  scopeMaxValue: NonNegativeMoney.nullable(),
  effectiveTo: CalendarDate.nullable(),
  blockedGate: QualificationDecisionsBlockedGate.nullable(),
  applicationInProgress: z
    .object({ applicationId: Id, reference: Reference.nullable(), status: QualificationApplicationsStatus })
    .nullable(),
});
export type SupplierStatusRow = z.infer<typeof SupplierStatusRow>;

export const SupplierOverview = z.object({
  supplier: SupplierRef,
  /** Platform registration (tenant) status: registration is never qualification (BR-03). */
  registrationStatus: TenantsStatus,
  verificationStatus: TenantsVerificationStatus,
  statuses: z.array(SupplierStatusRow),
  openInfoRequests: z.number().int().min(0),
  expiringEvidence: z.array(
    z.object({
      evidenceItemId: Id,
      title: z.string().min(1),
      evidenceType: EvidenceItemsEvidenceType,
      expiresAt: CalendarDate,
      citedByDecisionIds: z.array(Id),
    }),
  ),
});
export type SupplierOverview = z.infer<typeof SupplierOverview>;

export const SupplierProgramRow = z.object({
  id: Id,
  buyer: BuyerRef,
  name: z.string().min(1),
  description: z.string().nullable(),
  category: CategoryRef,
  coveredCategories: z.array(CategoryRef),
  geography: z.string().nullable(),
  maxContractValue: NonNegativeMoney.nullable(),
  validityMonths: z.number().int().min(1),
  currentVersion: z.object({ programVersionId: Id, versionNo: z.number().int().min(1), approvedAt: Instant }),
  criteriaCount: z.number().int().min(0),
  areaCounts: z.array(AreaCount),
  myStatus: VQualificationStatusEffectiveStatus,
  myApplicationInProgress: z
    .object({ applicationId: Id, reference: Reference.nullable(), status: QualificationApplicationsStatus })
    .nullable(),
});
export type SupplierProgramRow = z.infer<typeof SupplierProgramRow>;

export const SUPPLIER_PROGRAM_SORT_FIELDS = ['name', 'buyerName'] as const;
export const SupplierProgramListQuery = listQueryWithSort(SUPPLIER_PROGRAM_SORT_FIELDS).extend({
  buyerTenantId: IdParam.optional(),
  categoryCode: z.string().trim().max(40).optional(),
  myStatus: queryList(VQualificationStatusEffectiveStatus).optional(),
});
export type SupplierProgramListQuery = z.output<typeof SupplierProgramListQuery>;

export const SupplierProgramDetail = SupplierProgramRow.extend({
  criteria: z.array(Criterion),
  renewalNoticeDays: z.number().int().min(0),
  requiresIndependentApproval: z.boolean(),
});
export type SupplierProgramDetail = z.infer<typeof SupplierProgramDetail>;

export const SupplierApplicationRow = z.object({
  id: Id,
  reference: Reference.nullable(),
  buyer: BuyerRef,
  program: ProgramVersionRef,
  scopeCategory: CategoryRef,
  scopeMaxValue: NonNegativeMoney.nullable(),
  status: QualificationApplicationsStatus,
  submittedAt: Instant.nullable(),
  updatedAt: Instant,
  completeness: Completeness,
  openInfoRequestCount: z.number().int().min(0),
  /** Earliest due date of an open information request. */
  nextDueAt: OfficialDeadline.nullable(),
  renewalOfDecisionId: Id.nullable(),
  decisionId: Id.nullable(),
  link: LinkPath,
});
export type SupplierApplicationRow = z.infer<typeof SupplierApplicationRow>;

export const SUPPLIER_APPLICATION_SORT_FIELDS = ['reference', 'updatedAt', 'submittedAt', 'status'] as const;
export const SupplierApplicationListQuery = listQueryWithSort(SUPPLIER_APPLICATION_SORT_FIELDS).extend({
  status: queryList(QualificationApplicationsStatus).optional(),
  buyerTenantId: IdParam.optional(),
  programId: IdParam.optional(),
  updatedFrom: CalendarDate.optional(),
  updatedTo: CalendarDate.optional(),
});
export type SupplierApplicationListQuery = z.output<typeof SupplierApplicationListQuery>;

/** The supplier's own view of one criterion: no findings, no buyer-internal material. */
export const SupplierApplicationItem = z.object({
  criterion: Criterion,
  answer: Answer.nullable(),
  evidence: z.array(EvidenceSnapshot),
  evidenceMissing: z.boolean(),
  openInfoRequestIds: z.array(Id),
});
export type SupplierApplicationItem = z.infer<typeof SupplierApplicationItem>;

export const SupplierApplicationDetail = SupplierApplicationRow.extend({
  scopeGeography: z.string().nullable(),
  submittedBy: PersonRef.nullable(),
  items: z.array(SupplierApplicationItem),
  infoRequests: z.array(InfoRequest),
  withdrawnReason: z.string().nullable(),
  canEdit: z.boolean(),
  canSubmit: z.boolean(),
  canWithdraw: z.boolean(),
  /** The buyer's supplier-visible and public additional fields of the application form (ADM-07). */
  customFields: CustomFieldValues.optional(),
});
export type SupplierApplicationDetail = z.infer<typeof SupplierApplicationDetail>;

export const CreateApplicationBody = z.object({
  programId: Id,
  scopeCategoryId: Id,
  scopeMaxValue: NonNegativeMoney.nullable(),
  scopeGeography: z.string().trim().max(200).nullable(),
  renewalOfDecisionId: Id.nullable(),
});
export type CreateApplicationBody = z.infer<typeof CreateApplicationBody>;

export const AnswerInput = z
  .object({
    criterionId: Id,
    applicability: QualificationAnswersApplicability,
    naReason: OptionalLongText,
    answerText: OptionalLongText,
    answerNumber: DecimalString.nullable(),
    answerDate: CalendarDate.nullable(),
    answerBool: z.boolean().nullable(),
    evidenceItemIds: z.array(Id).max(20, issue('TOO_MANY_EVIDENCE_ITEMS', 'At most 20 evidence items per answer.')),
  })
  .superRefine((value, context) => {
    if (value.applicability === 'not_applicable' && (value.naReason ?? '').trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['naReason'],
        message: issue('NA_REASON_REQUIRED', 'Explain why this criterion does not apply.'),
      });
    }
  });
export type AnswerInput = z.infer<typeof AnswerInput>;

export const SaveAnswersBody = z
  .object({
    answers: z.array(AnswerInput),
    /**
     * Values of the buyer's supplier-visible additional fields (ADM-07). A save rejects values of the wrong type
     * (`customFields.<key>`); required fields are checked on submission (`MANDATORY_ANSWERS_MISSING`).
     */
    customFields: CustomFieldValues.optional(),
  })
  .superRefine((body, context) => {
    if (body.answers.length === 0 && body.customFields === undefined) {
      context.addIssue({ code: 'custom', path: ['answers'], message: issue('ANSWERS_REQUIRED', 'Send at least one answer.') });
    }
  });
export type SaveAnswersBody = z.infer<typeof SaveAnswersBody>;

/** A current evidence item of the supplier's library that fits a criterion of the application. */
export const EvidenceCandidate = z.object({
  evidenceItemId: Id,
  evidenceType: EvidenceItemsEvidenceType,
  title: z.string().min(1),
  issuer: z.string().nullable(),
  periodEnd: CalendarDate.nullable(),
  expiresAt: CalendarDate.nullable(),
  status: EvidenceItemsStatus,
  verificationStatus: EvidenceItemsVerificationStatus,
  /** Criteria of this application whose evidence types accept the item. */
  criterionIds: z.array(Id),
  /** Expires within 30 days of today. */
  expiringSoon: z.boolean(),
});
export type EvidenceCandidate = z.infer<typeof EvidenceCandidate>;

export const EvidenceCandidates = z.object({ items: z.array(EvidenceCandidate) });

export const SubmitApplicationBody = z.object({
  /** The submitter confirms the answers are complete and accurate for this organization. */
  confirmAccuracy: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the declaration to submit.') }),
});
export type SubmitApplicationBody = z.infer<typeof SubmitApplicationBody>;

export const WithdrawApplicationBody = z.object({ reason: ReasonText });

export const RespondInfoRequestBody = z.object({
  responseText: LongText,
  evidenceItemIds: z.array(Id).max(20, issue('TOO_MANY_EVIDENCE_ITEMS', 'At most 20 evidence items.')),
});
export type RespondInfoRequestBody = z.infer<typeof RespondInfoRequestBody>;

/** A decision as the supplier sees it: explanation and appeal route, never internal reasons (PRD §7.3). */
export const SupplierDecision = z.object({
  id: Id,
  buyer: BuyerRef,
  applicationId: Id,
  applicationReference: Reference,
  program: ProgramVersionRef,
  outcome: QualificationDecisionsOutcome,
  effectiveStatus: VQualificationStatusEffectiveStatus,
  scopeCategory: CategoryRef,
  scopeMaxValue: NonNegativeMoney.nullable(),
  scopeGeography: z.string().nullable(),
  effectiveFrom: CalendarDate,
  effectiveTo: CalendarDate.nullable(),
  reassessmentDate: CalendarDate.nullable(),
  /** Renewal applications are due from this date (effective end minus the program's renewal notice). */
  renewalDueFrom: CalendarDate.nullable(),
  conditions: z.string().nullable(),
  allowedActivities: z.string().nullable(),
  blockedGate: QualificationDecisionsBlockedGate,
  supplierExplanation: z.string().nullable(),
  appealRoute: z.string().nullable(),
  decidedAt: Instant,
  supersededById: Id.nullable(),
  current: z.boolean(),
});
export type SupplierDecision = z.infer<typeof SupplierDecision>;

export const SUPPLIER_DECISION_SORT_FIELDS = ['decidedAt', 'effectiveTo', 'buyerName'] as const;
export const SupplierDecisionListQuery = listQueryWithSort(SUPPLIER_DECISION_SORT_FIELDS).extend({
  buyerTenantId: IdParam.optional(),
  effectiveStatus: queryList(VQualificationStatusEffectiveStatus).optional(),
  includeSuperseded: QueryBoolean.optional(),
  expiringBefore: CalendarDate.optional(),
});
export type SupplierDecisionListQuery = z.output<typeof SupplierDecisionListQuery>;

export const SupplierDecisionDetail = SupplierDecision.extend({
  history: z.array(
    SupplierDecision.pick({
      id: true,
      outcome: true,
      effectiveStatus: true,
      effectiveFrom: true,
      effectiveTo: true,
      decidedAt: true,
      supersededById: true,
    }),
  ),
  /** Evidence this decision relied on that expires soon or has expired (the submission itself is unchanged). */
  expiringEvidence: z.array(EvidenceSnapshot),
  evidenceUpdates: z.array(EvidenceUpdate),
  reconsideration: ReconsiderationRequest.nullable(),
  renewalApplicationId: Id.nullable(),
  renewalRequestedAt: Instant.nullable(),
  canRequestReconsideration: z.boolean(),
  canSupplyEvidence: z.boolean(),
  canRenew: z.boolean(),
});
export type SupplierDecisionDetail = z.infer<typeof SupplierDecisionDetail>;

export const ReconsiderationBody = z.object({
  grounds: LongText,
  evidenceItemIds: z.array(Id).max(20, issue('TOO_MANY_EVIDENCE_ITEMS', 'At most 20 evidence items.')),
});
export type ReconsiderationBody = z.infer<typeof ReconsiderationBody>;

export const SupplyEvidenceBody = z.object({
  evidenceItemId: Id,
  note: OptionalLongText,
});
export type SupplyEvidenceBody = z.infer<typeof SupplyEvidenceBody>;
