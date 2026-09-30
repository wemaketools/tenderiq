/**
 * Qualification contract (domain 04): programs, applications, assessment, decisions and monitoring
 * (FR-06, BR-03, BR-23, BR-24, BR-25, BR-48; PRD §7.3, §8.3; screens ADM-09, SUP-20, SUP-24, BUY-33, BUY-34, BUY-35;
 * acceptance AC-07, AC-08, AC-09).
 *
 * Audiences:
 * - `buyer`: the program register (ADM-09, `qualification.program.manage`), the review queue (BUY-33), the
 *   assessment workspace (BUY-34) and decisions and monitoring (BUY-35). Buyers never see draft applications.
 *   The financial review panel is restricted to `qualification.financial_review` and `qualification.decide`
 *   (AC-08); a qualification assessor without either gets 403.
 * - `supplier`: programs of buyers the supplier works with, its own applications (SUP-20) and its own decisions
 *   per buyer (SUP-24). Never findings, financial reviews, screenings, triggers or internal reasons.
 *
 * Every schema lives in `./qualification/schemas.ts` and is re-exported here, so the SPA imports
 * `@contracts/qualification` only.
 */
import { pageOf } from './common.js';
import { defineEndpoint } from './endpoint.js';
import type { EndpointPermission } from './endpoint.js';
import {
  ApplicationParams,
  ApproveVersionBody,
  AssessTriggerBody,
  AssignApplicationBody,
  BuyerApplicationDetail,
  BuyerApplicationListQuery,
  BuyerApplicationRow,
  CloseInfoRequestBody,
  CreateApplicationBody,
  CreateProgramBody,
  CreateProgramVersionBody,
  CreateTriggerBody,
  DecideApplicationBody,
  Decision,
  DecisionDetail,
  DecisionListQuery,
  DecisionParams,
  Eligibility,
  EligibilityQuery,
  EvidenceCandidates,
  EvidenceUpdate,
  FinancialReview,
  FinancialReviewPanel,
  Finding,
  FindingParams,
  InfoRequestParams,
  InfoRequestResult,
  ProgramDetail,
  ProgramDetailQuery,
  ProgramListQuery,
  ProgramParams,
  ProgramRow,
  ProgramVersionParams,
  QualificationOptions,
  QualificationSummary,
  ReconsiderationBody,
  ReconsiderationRequest,
  RecommendBody,
  RecommendationResult,
  RecordFinancialReviewBody,
  RecordFindingBody,
  RenewalRequestBody,
  RenewalRequestResult,
  RequestInfoBody,
  RespondInfoRequestBody,
  RetireProgramBody,
  ReviewScreeningBody,
  SaveAnswersBody,
  SaveCriteriaBody,
  Screening,
  ScreeningListQuery,
  ScreeningParams,
  StatusListQuery,
  StatusRow,
  SubmitApplicationBody,
  SupersedeDecisionBody,
  SupplierApplicationDetail,
  SupplierApplicationListQuery,
  SupplierApplicationRow,
  SupplierDecision,
  SupplierDecisionDetail,
  SupplierDecisionListQuery,
  SupplierOverview,
  SupplierProgramDetail,
  SupplierProgramListQuery,
  SupplierProgramRow,
  SupplyEvidenceBody,
  Trigger,
  TriggerListQuery,
  TriggerParams,
  UpdateProgramBody,
  WithdrawApplicationBody,
} from './qualification/schemas.js';

export * from './qualification/schemas.js';

// ---------------------------------------------------------------------------------------------------------
// Permission sets
// ---------------------------------------------------------------------------------------------------------

/** Anyone working qualification in a buyer tenant (queue, assessment, statuses). */
export const QUALIFICATION_WORK_PERMISSIONS = [
  'qualification.review',
  'qualification.financial_review',
  'qualification.decide',
] as const satisfies EndpointPermission;

/** Program register readers (ADM-09): managers plus the people who apply the criteria. */
export const QUALIFICATION_PROGRAM_VIEW_PERMISSIONS = [
  'qualification.program.manage',
  'qualification.review',
  'qualification.financial_review',
  'qualification.decide',
] as const satisfies EndpointPermission;

/** The restricted financial review panel: financial reviewers and deciders only (AC-08). */
export const FINANCIAL_REVIEW_VIEW_PERMISSIONS = [
  'qualification.financial_review',
  'qualification.decide',
] as const satisfies EndpointPermission;

/** Findings and information requests: assessors, and financial reviewers for the financial area. */
export const QUALIFICATION_ASSESS_PERMISSIONS = [
  'qualification.review',
  'qualification.financial_review',
] as const satisfies EndpointPermission;

/** The eligibility gate is read by tender teams too (participation gate, BUY-15, AC-07). */
export const QUALIFICATION_ELIGIBILITY_PERMISSIONS = [
  'qualification.review',
  'qualification.financial_review',
  'qualification.decide',
  'tender.participants.manage',
  'supplier.directory.view',
] as const satisfies EndpointPermission;

/** Supplier decision readers (SUP-24). */
export const SUPPLIER_DECISION_VIEW_PERMISSIONS = [
  'supplier.qualification.apply',
  'supplier.outcomes.view',
] as const satisfies EndpointPermission;

const BUYER = '/api/v1/buyer/qualification';
const SUPPLIER = '/api/v1/supplier/qualification';

// ---------------------------------------------------------------------------------------------------------
// Buyer: summary and options
// ---------------------------------------------------------------------------------------------------------

export const getQualificationSummary = defineEndpoint({
  id: 'buyer.qualification.summary',
  method: 'GET',
  path: `${BUYER}/summary`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  response: QualificationSummary,
  errors: [],
  screens: ['BUY-33', 'BUY-35'],
  summary: 'Queue and monitoring counts of the active buyer tenant (drafts never counted).',
});

export const getQualificationOptions = defineEndpoint({
  id: 'buyer.qualification.options',
  method: 'GET',
  path: `${BUYER}/options`,
  audience: 'buyer',
  permission: QUALIFICATION_PROGRAM_VIEW_PERMISSIONS,
  response: QualificationOptions,
  errors: [],
  screens: ['ADM-09', 'BUY-33', 'BUY-34', 'BUY-35'],
  summary: 'Categories, eligible assessors, financial reviewers, deciders and decision roles for the forms.',
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: programs (ADM-09)
// ---------------------------------------------------------------------------------------------------------

export const listPrograms = defineEndpoint({
  id: 'buyer.qualification.programs.list',
  method: 'GET',
  path: `${BUYER}/programs`,
  audience: 'buyer',
  permission: QUALIFICATION_PROGRAM_VIEW_PERMISSIONS,
  query: ProgramListQuery,
  response: pageOf(ProgramRow),
  errors: [],
  screens: ['ADM-09'],
});

export const getProgram = defineEndpoint({
  id: 'buyer.qualification.programs.get',
  method: 'GET',
  path: `${BUYER}/programs/:programId`,
  audience: 'buyer',
  permission: QUALIFICATION_PROGRAM_VIEW_PERMISSIONS,
  params: ProgramParams,
  query: ProgramDetailQuery,
  response: ProgramDetail,
  errors: ['PROGRAM_VERSION_NOT_FOUND'],
  screens: ['ADM-09'],
});

export const createProgram = defineEndpoint({
  id: 'buyer.qualification.programs.create',
  method: 'POST',
  path: `${BUYER}/programs`,
  audience: 'buyer',
  permission: 'qualification.program.manage',
  body: CreateProgramBody,
  response: ProgramDetail,
  errors: ['PROGRAM_NAME_DUPLICATE', 'CATEGORY_NOT_FOUND', 'OWNER_NOT_ELIGIBLE', 'DECISION_ROLE_UNKNOWN'],
  screens: ['ADM-09'],
  idempotent: true,
  summary: 'Creates a draft program with an empty draft version 1.',
});

export const updateProgram = defineEndpoint({
  id: 'buyer.qualification.programs.update',
  method: 'PATCH',
  path: `${BUYER}/programs/:programId`,
  audience: 'buyer',
  permission: 'qualification.program.manage',
  params: ProgramParams,
  body: UpdateProgramBody,
  response: ProgramDetail,
  errors: [
    'PROGRAM_RETIRED',
    'PROGRAM_NAME_DUPLICATE',
    'CATEGORY_NOT_FOUND',
    'OWNER_NOT_ELIGIBLE',
    'DECISION_ROLE_UNKNOWN',
  ],
  screens: ['ADM-09'],
  summary: 'Changes the program header. Criteria change only through a new version.',
});

export const createProgramVersion = defineEndpoint({
  id: 'buyer.qualification.programs.createVersion',
  method: 'POST',
  path: `${BUYER}/programs/:programId/versions`,
  audience: 'buyer',
  permission: 'qualification.program.manage',
  params: ProgramParams,
  body: CreateProgramVersionBody,
  response: ProgramDetail,
  errors: ['PROGRAM_RETIRED', 'DRAFT_VERSION_EXISTS', 'PROGRAM_VERSION_NOT_FOUND'],
  screens: ['ADM-09'],
  idempotent: true,
  summary: 'Opens a draft revision copied from a version. Approved versions are never edited.',
});

export const saveProgramCriteria = defineEndpoint({
  id: 'buyer.qualification.programs.saveCriteria',
  method: 'PUT',
  path: `${BUYER}/programs/:programId/versions/:versionId/criteria`,
  audience: 'buyer',
  permission: 'qualification.program.manage',
  params: ProgramVersionParams,
  body: SaveCriteriaBody,
  response: ProgramDetail,
  errors: ['PROGRAM_VERSION_NOT_FOUND', 'VERSION_NOT_DRAFT'],
  screens: ['ADM-09'],
});

export const approveProgramVersion = defineEndpoint({
  id: 'buyer.qualification.programs.approveVersion',
  method: 'POST',
  path: `${BUYER}/programs/:programId/versions/:versionId/approve`,
  audience: 'buyer',
  permission: 'qualification.program.manage',
  params: ProgramVersionParams,
  body: ApproveVersionBody,
  response: ProgramDetail,
  errors: ['PROGRAM_VERSION_NOT_FOUND', 'VERSION_NOT_DRAFT', 'MANDATORY_AREA_MISSING'],
  screens: ['ADM-09'],
  summary:
    'Approves a draft version: it becomes current and the program active; applications keep the version they cite.',
});

export const retireProgram = defineEndpoint({
  id: 'buyer.qualification.programs.retire',
  method: 'POST',
  path: `${BUYER}/programs/:programId/retire`,
  audience: 'buyer',
  permission: 'qualification.program.manage',
  params: ProgramParams,
  body: RetireProgramBody,
  response: ProgramDetail,
  errors: ['PROGRAM_RETIRED', 'PROGRAM_HAS_OPEN_APPLICATIONS'],
  screens: ['ADM-09'],
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: review queue and assessment (BUY-33, BUY-34)
// ---------------------------------------------------------------------------------------------------------

export const listApplications = defineEndpoint({
  id: 'buyer.qualification.applications.list',
  method: 'GET',
  path: `${BUYER}/applications`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  query: BuyerApplicationListQuery,
  response: pageOf(BuyerApplicationRow),
  errors: [],
  screens: ['BUY-33'],
  summary: 'The review queue. Draft applications are never listed or counted.',
});

export const getApplication = defineEndpoint({
  id: 'buyer.qualification.applications.get',
  method: 'GET',
  path: `${BUYER}/applications/:applicationId`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  params: ApplicationParams,
  response: BuyerApplicationDetail,
  errors: [],
  screens: ['BUY-34'],
  summary: 'Criteria, answers, evidence snapshots, findings, information requests and screenings (a draft is 404).',
});

export const assignApplication = defineEndpoint({
  id: 'buyer.qualification.applications.assign',
  method: 'POST',
  path: `${BUYER}/applications/:applicationId/assignment`,
  audience: 'buyer',
  permission: 'qualification.review',
  params: ApplicationParams,
  body: AssignApplicationBody,
  response: BuyerApplicationRow,
  errors: [
    'APPLICATION_NOT_ASSIGNABLE',
    'ASSESSOR_NOT_ELIGIBLE',
    'FINANCIAL_REVIEWER_NOT_ELIGIBLE',
    'FINANCIAL_REVIEWER_REQUIRED',
    'ASSIGNEE_CONFLICT_DECLARED',
    'DUE_DATE_IN_PAST',
  ],
  screens: ['BUY-33'],
  summary: 'Assigns the assessor and (specialist) financial reviewer, due date, priority and risk.',
});

export const getFinancialReview = defineEndpoint({
  id: 'buyer.qualification.applications.financialReview',
  method: 'GET',
  path: `${BUYER}/applications/:applicationId/financial-review`,
  audience: 'buyer',
  permission: FINANCIAL_REVIEW_VIEW_PERMISSIONS,
  params: ApplicationParams,
  response: FinancialReviewPanel,
  errors: [],
  screens: ['BUY-34', 'BUY-35'],
  summary: 'The restricted financial review panel (financial reviewers and deciders only, AC-08).',
});

export const recordFinancialReview = defineEndpoint({
  id: 'buyer.qualification.applications.recordFinancialReview',
  method: 'POST',
  path: `${BUYER}/applications/:applicationId/financial-reviews`,
  audience: 'buyer',
  permission: 'qualification.financial_review',
  params: ApplicationParams,
  body: RecordFinancialReviewBody,
  response: FinancialReview,
  errors: [
    'APPLICATION_NOT_UNDER_REVIEW',
    'NOT_ASSIGNED_FINANCIAL_REVIEWER',
    'PARENT_SUPPORT_REQUIRED',
    'FINANCIAL_PERIOD_IN_FUTURE',
  ],
  screens: ['BUY-34'],
  idempotent: true,
  summary: 'Records period, currency, consolidation, source, measures, qualifications and conclusion.',
});

export const recordFinding = defineEndpoint({
  id: 'buyer.qualification.applications.recordFinding',
  method: 'PUT',
  path: `${BUYER}/applications/:applicationId/findings/:criterionId`,
  audience: 'buyer',
  permission: QUALIFICATION_ASSESS_PERMISSIONS,
  params: FindingParams,
  body: RecordFindingBody,
  response: Finding,
  errors: [
    'APPLICATION_NOT_UNDER_REVIEW',
    'CRITERION_NOT_IN_VERSION',
    'NOT_ASSIGNED_ASSESSOR',
    'FINDING_OUTSIDE_ASSIGNMENT',
    'MISSING_EVIDENCE_NOT_A_PASS',
    'NA_NOT_DECLARED',
  ],
  screens: ['BUY-34'],
  summary: 'A finding per criterion with a rationale. A criterion missing mandatory evidence cannot be met.',
});

export const requestInformation = defineEndpoint({
  id: 'buyer.qualification.applications.requestInfo',
  method: 'POST',
  path: `${BUYER}/applications/:applicationId/info-requests`,
  audience: 'buyer',
  permission: QUALIFICATION_ASSESS_PERMISSIONS,
  params: ApplicationParams,
  body: RequestInfoBody,
  response: InfoRequestResult,
  errors: ['APPLICATION_NOT_UNDER_REVIEW', 'CRITERION_NOT_IN_VERSION', 'DUE_DATE_IN_PAST', 'NOT_ASSIGNED_ASSESSOR'],
  screens: ['BUY-33', 'BUY-34'],
  idempotent: true,
  summary: 'Asks the supplier for information or evidence; the application moves to more_info_required.',
});

export const closeInfoRequest = defineEndpoint({
  id: 'buyer.qualification.applications.closeInfoRequest',
  method: 'POST',
  path: `${BUYER}/applications/:applicationId/info-requests/:infoRequestId/close`,
  audience: 'buyer',
  permission: QUALIFICATION_ASSESS_PERMISSIONS,
  params: InfoRequestParams,
  body: CloseInfoRequestBody,
  response: InfoRequestResult,
  errors: ['INFO_REQUEST_NOT_FOUND', 'INFO_REQUEST_CLOSED'],
  screens: ['BUY-34'],
});

export const recommendOutcome = defineEndpoint({
  id: 'buyer.qualification.applications.recommend',
  method: 'POST',
  path: `${BUYER}/applications/:applicationId/recommendation`,
  audience: 'buyer',
  permission: 'qualification.review',
  params: ApplicationParams,
  body: RecommendBody,
  response: RecommendationResult,
  errors: [
    'APPLICATION_NOT_UNDER_REVIEW',
    'FINDINGS_INCOMPLETE',
    'OPEN_INFO_REQUESTS',
    'FINANCIAL_REVIEW_REQUIRED',
    'SCREENING_UNREVIEWED',
    'SCOPE_EXCEEDS_PROGRAM',
    'NOT_ASSIGNED_ASSESSOR',
  ],
  screens: ['BUY-34'],
  summary: 'Proposes the outcome (under_review → decision_pending) and requests independent approval where required.',
});

export const decideApplication = defineEndpoint({
  id: 'buyer.qualification.applications.decide',
  method: 'POST',
  path: `${BUYER}/applications/:applicationId/decision`,
  audience: 'buyer',
  permission: 'qualification.decide',
  params: ApplicationParams,
  body: DecideApplicationBody,
  response: DecisionDetail,
  errors: ['APPLICATION_NOT_DECISION_PENDING', 'SELF_APPROVAL_BLOCKED', 'SCOPE_EXCEEDS_PROGRAM', 'CATEGORY_NOT_FOUND'],
  screens: ['BUY-35'],
  idempotent: true,
  summary: 'Records the decision (outcome, scope, dates, conditions, reasons, explanation, appeal route).',
});

export const listScreenings = defineEndpoint({
  id: 'buyer.qualification.screenings.list',
  method: 'GET',
  path: `${BUYER}/screenings`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  query: ScreeningListQuery,
  response: pageOf(Screening),
  errors: [],
  screens: ['BUY-34', 'BUY-35'],
});

export const reviewScreening = defineEndpoint({
  id: 'buyer.qualification.screenings.review',
  method: 'POST',
  path: `${BUYER}/screenings/:screeningId/review`,
  audience: 'buyer',
  permission: 'qualification.review',
  params: ScreeningParams,
  body: ReviewScreeningBody,
  response: Screening,
  errors: ['SCREENING_ALREADY_REVIEWED'],
  screens: ['BUY-34', 'BUY-35'],
  summary: 'Records the human review of a screening match; the match itself never decides (BR-48).',
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: decisions and monitoring (BUY-35)
// ---------------------------------------------------------------------------------------------------------

export const listStatuses = defineEndpoint({
  id: 'buyer.qualification.statuses.list',
  method: 'GET',
  path: `${BUYER}/statuses`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  query: StatusListQuery,
  response: pageOf(StatusRow),
  errors: [],
  screens: ['BUY-35'],
  summary: 'v_qualification_status: supplier × program, including not_assessed and derived expired.',
});

export const checkEligibility = defineEndpoint({
  id: 'buyer.qualification.eligibility',
  method: 'GET',
  path: `${BUYER}/eligibility`,
  audience: 'buyer',
  permission: QUALIFICATION_ELIGIBILITY_PERMISSIONS,
  query: EligibilityQuery,
  response: Eligibility,
  errors: ['SUPPLIER_NOT_FOUND', 'CATEGORY_NOT_FOUND'],
  screens: ['BUY-35', 'BUY-15'],
  summary: 'The qualification gate for a supplier, category and value at a date (BR-23, AC-07).',
});

export const listDecisions = defineEndpoint({
  id: 'buyer.qualification.decisions.list',
  method: 'GET',
  path: `${BUYER}/decisions`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  query: DecisionListQuery,
  response: pageOf(Decision),
  errors: [],
  screens: ['BUY-35'],
});

export const getDecision = defineEndpoint({
  id: 'buyer.qualification.decisions.get',
  method: 'GET',
  path: `${BUYER}/decisions/:decisionId`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  params: DecisionParams,
  response: DecisionDetail,
  errors: [],
  screens: ['BUY-35'],
});

export const supersedeDecision = defineEndpoint({
  id: 'buyer.qualification.decisions.supersede',
  method: 'POST',
  path: `${BUYER}/decisions/:decisionId/supersede`,
  audience: 'buyer',
  permission: 'qualification.decide',
  params: DecisionParams,
  body: SupersedeDecisionBody,
  response: DecisionDetail,
  errors: ['DECISION_ALREADY_SUPERSEDED', 'TRIGGER_NOT_FOUND', 'SCOPE_EXCEEDS_PROGRAM', 'CATEGORY_NOT_FOUND'],
  screens: ['BUY-35'],
  idempotent: true,
  summary: 'Suspends, reinstates, withdraws, confirms conditions or reassesses with a NEW decision row.',
});

export const requestRenewal = defineEndpoint({
  id: 'buyer.qualification.decisions.requestRenewal',
  method: 'POST',
  path: `${BUYER}/decisions/:decisionId/renewal-request`,
  audience: 'buyer',
  permission: 'qualification.decide',
  params: DecisionParams,
  body: RenewalRequestBody,
  response: RenewalRequestResult,
  errors: ['DECISION_NOT_RENEWABLE', 'RENEWAL_ALREADY_REQUESTED', 'DUE_DATE_IN_PAST'],
  screens: ['BUY-35'],
  summary: 'Asks the supplier to renew. Nothing renews automatically because a date arrived (BR-37).',
});

export const listTriggers = defineEndpoint({
  id: 'buyer.qualification.triggers.list',
  method: 'GET',
  path: `${BUYER}/triggers`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  query: TriggerListQuery,
  response: pageOf(Trigger),
  errors: [],
  screens: ['BUY-35'],
});

export const getTrigger = defineEndpoint({
  id: 'buyer.qualification.triggers.get',
  method: 'GET',
  path: `${BUYER}/triggers/:triggerId`,
  audience: 'buyer',
  permission: QUALIFICATION_WORK_PERMISSIONS,
  params: TriggerParams,
  response: Trigger,
  errors: [],
  screens: ['BUY-35'],
});

export const createTrigger = defineEndpoint({
  id: 'buyer.qualification.triggers.create',
  method: 'POST',
  path: `${BUYER}/triggers`,
  audience: 'buyer',
  permission: ['qualification.review', 'qualification.decide'],
  body: CreateTriggerBody,
  response: Trigger,
  errors: ['DECISION_NOT_FOUND', 'DECISION_NOT_CURRENT', 'TRIGGER_ALREADY_OPEN'],
  screens: ['BUY-35'],
  idempotent: true,
  summary: 'Initiates a reassessment of a current decision (manual or reported event).',
});

export const assessTrigger = defineEndpoint({
  id: 'buyer.qualification.triggers.assess',
  method: 'POST',
  path: `${BUYER}/triggers/:triggerId/assess`,
  audience: 'buyer',
  permission: 'qualification.decide',
  params: TriggerParams,
  body: AssessTriggerBody,
  response: Trigger,
  errors: ['TRIGGER_ALREADY_CLOSED', 'IMPACT_REVIEW_REQUIRED', 'RESULTING_DECISION_REQUIRED', 'DECISION_NOT_FOUND'],
  screens: ['BUY-35'],
  summary: 'Records the explicit disposition, with the review of impacted active bids and contracts (AC-09).',
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: programs and applications (SUP-20)
// ---------------------------------------------------------------------------------------------------------

export const getSupplierOverview = defineEndpoint({
  id: 'supplier.qualification.overview',
  method: 'GET',
  path: `${SUPPLIER}/overview`,
  audience: 'supplier',
  permission: SUPPLIER_DECISION_VIEW_PERMISSIONS,
  response: SupplierOverview,
  errors: [],
  screens: ['SUP-20', 'SUP-24'],
  summary: 'Registration versus qualification per buyer and program (AC-07), open requests and expiring evidence.',
});

export const listSupplierPrograms = defineEndpoint({
  id: 'supplier.qualification.programs.list',
  method: 'GET',
  path: `${SUPPLIER}/programs`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  query: SupplierProgramListQuery,
  response: pageOf(SupplierProgramRow),
  errors: [],
  screens: ['SUP-20'],
});

export const getSupplierProgram = defineEndpoint({
  id: 'supplier.qualification.programs.get',
  method: 'GET',
  path: `${SUPPLIER}/programs/:programId`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: ProgramParams,
  response: SupplierProgramDetail,
  errors: [],
  screens: ['SUP-20'],
});

export const listSupplierApplications = defineEndpoint({
  id: 'supplier.qualification.applications.list',
  method: 'GET',
  path: `${SUPPLIER}/applications`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  query: SupplierApplicationListQuery,
  response: pageOf(SupplierApplicationRow),
  errors: [],
  screens: ['SUP-20'],
});

export const getSupplierApplication = defineEndpoint({
  id: 'supplier.qualification.applications.get',
  method: 'GET',
  path: `${SUPPLIER}/applications/:applicationId`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: ApplicationParams,
  response: SupplierApplicationDetail,
  errors: [],
  screens: ['SUP-20'],
});

export const createSupplierApplication = defineEndpoint({
  id: 'supplier.qualification.applications.create',
  method: 'POST',
  path: `${SUPPLIER}/applications`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  body: CreateApplicationBody,
  response: SupplierApplicationDetail,
  errors: [
    'PROGRAM_NOT_OPEN',
    'APPLICATION_ALREADY_OPEN',
    'SCOPE_OUTSIDE_PROGRAM',
    'SCOPE_EXCEEDS_PROGRAM',
    'DECISION_NOT_RENEWABLE',
  ],
  screens: ['SUP-20', 'SUP-24'],
  idempotent: true,
  summary: 'Starts a draft application (or a renewal of an earlier decision) on the current program version.',
});

export const saveSupplierAnswers = defineEndpoint({
  id: 'supplier.qualification.applications.saveAnswers',
  method: 'PUT',
  path: `${SUPPLIER}/applications/:applicationId/answers`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: ApplicationParams,
  body: SaveAnswersBody,
  response: SupplierApplicationDetail,
  errors: ['APPLICATION_NOT_EDITABLE', 'CRITERION_NOT_IN_VERSION', 'EVIDENCE_NOT_FOUND', 'EVIDENCE_TYPE_MISMATCH'],
  screens: ['SUP-20'],
});

export const listEvidenceCandidates = defineEndpoint({
  id: 'supplier.qualification.applications.evidenceCandidates',
  method: 'GET',
  path: `${SUPPLIER}/applications/:applicationId/evidence-candidates`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: ApplicationParams,
  response: EvidenceCandidates,
  errors: [],
  screens: ['SUP-20'],
  summary: 'Current items of the supplier’s evidence library that fit the application’s criteria.',
});

export const submitSupplierApplication = defineEndpoint({
  id: 'supplier.qualification.applications.submit',
  method: 'POST',
  path: `${SUPPLIER}/applications/:applicationId/submit`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: ApplicationParams,
  body: SubmitApplicationBody,
  response: SupplierApplicationDetail,
  errors: [
    'APPLICATION_NOT_DRAFT',
    'MANDATORY_ANSWERS_MISSING',
    'MANDATORY_EVIDENCE_MISSING',
    'NA_REASON_MISSING',
    'EVIDENCE_EXPIRED',
  ],
  screens: ['SUP-20'],
  summary: 'Submits the draft: evidence is snapshotted and the reference QA-YYYY-NNNN assigned.',
});

export const withdrawSupplierApplication = defineEndpoint({
  id: 'supplier.qualification.applications.withdraw',
  method: 'POST',
  path: `${SUPPLIER}/applications/:applicationId/withdraw`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: ApplicationParams,
  body: WithdrawApplicationBody,
  response: SupplierApplicationDetail,
  errors: ['APPLICATION_NOT_WITHDRAWABLE'],
  screens: ['SUP-20'],
});

export const respondToInfoRequest = defineEndpoint({
  id: 'supplier.qualification.applications.respondInfoRequest',
  method: 'POST',
  path: `${SUPPLIER}/applications/:applicationId/info-requests/:infoRequestId/respond`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: InfoRequestParams,
  body: RespondInfoRequestBody,
  response: InfoRequestResult,
  errors: ['INFO_REQUEST_NOT_FOUND', 'INFO_REQUEST_NOT_OPEN', 'EVIDENCE_NOT_FOUND'],
  screens: ['SUP-20'],
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: decisions and renewals (SUP-24)
// ---------------------------------------------------------------------------------------------------------

export const listSupplierDecisions = defineEndpoint({
  id: 'supplier.qualification.decisions.list',
  method: 'GET',
  path: `${SUPPLIER}/decisions`,
  audience: 'supplier',
  permission: SUPPLIER_DECISION_VIEW_PERMISSIONS,
  query: SupplierDecisionListQuery,
  response: pageOf(SupplierDecision),
  errors: [],
  screens: ['SUP-24'],
  summary: 'The supplier’s own decisions, each labelled with the deciding buyer (buyer-specific, BR-45).',
});

export const getSupplierDecision = defineEndpoint({
  id: 'supplier.qualification.decisions.get',
  method: 'GET',
  path: `${SUPPLIER}/decisions/:decisionId`,
  audience: 'supplier',
  permission: SUPPLIER_DECISION_VIEW_PERMISSIONS,
  params: DecisionParams,
  response: SupplierDecisionDetail,
  errors: [],
  screens: ['SUP-24'],
});

export const requestReconsideration = defineEndpoint({
  id: 'supplier.qualification.decisions.requestReconsideration',
  method: 'POST',
  path: `${SUPPLIER}/decisions/:decisionId/reconsideration`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: DecisionParams,
  body: ReconsiderationBody,
  response: ReconsiderationRequest,
  errors: ['DECISION_NOT_RECONSIDERABLE', 'RECONSIDERATION_WINDOW_CLOSED', 'RECONSIDERATION_ALREADY_REQUESTED', 'EVIDENCE_NOT_FOUND'],
  screens: ['SUP-24'],
  idempotent: true,
});

export const supplyDecisionEvidence = defineEndpoint({
  id: 'supplier.qualification.decisions.supplyEvidence',
  method: 'POST',
  path: `${SUPPLIER}/decisions/:decisionId/evidence-updates`,
  audience: 'supplier',
  permission: 'supplier.qualification.apply',
  params: DecisionParams,
  body: SupplyEvidenceBody,
  response: EvidenceUpdate,
  errors: ['DECISION_SUPERSEDED', 'EVIDENCE_NOT_FOUND', 'EVIDENCE_NOT_CURRENT'],
  screens: ['SUP-24'],
  idempotent: true,
  summary: 'Supplies updated evidence for a decision (for example renewed insurance, AC-09). Nothing is relabelled.',
});

/** The qualification endpoint map. */
export const qualificationEndpoints = {
  getQualificationSummary,
  getQualificationOptions,
  listPrograms,
  getProgram,
  createProgram,
  updateProgram,
  createProgramVersion,
  saveProgramCriteria,
  approveProgramVersion,
  retireProgram,
  listApplications,
  getApplication,
  assignApplication,
  getFinancialReview,
  recordFinancialReview,
  recordFinding,
  requestInformation,
  closeInfoRequest,
  recommendOutcome,
  decideApplication,
  listScreenings,
  reviewScreening,
  listStatuses,
  checkEligibility,
  listDecisions,
  getDecision,
  supersedeDecision,
  requestRenewal,
  listTriggers,
  getTrigger,
  createTrigger,
  assessTrigger,
  getSupplierOverview,
  listSupplierPrograms,
  getSupplierProgram,
  listSupplierApplications,
  getSupplierApplication,
  createSupplierApplication,
  saveSupplierAnswers,
  listEvidenceCandidates,
  submitSupplierApplication,
  withdrawSupplierApplication,
  respondToInfoRequest,
  listSupplierDecisions,
  getSupplierDecision,
  requestReconsideration,
  supplyDecisionEvidence,
} as const;
