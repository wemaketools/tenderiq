/**
 * Evaluation contract (domain 11): evaluator assignments (EVA-01), individual assessment (EVA-02), commercial
 * comparison and the price gate (EVA-04), moderation (EVA-05), and ranking with the evaluation report (EVA-06).
 * FR-14, PRD §9, BR-26..BR-29; acceptance AC-18, AC-19, AC-20 (and AC-16 for the price gate).
 *
 * Access is assignment-based (BR-26): every endpoint is buyer-audience and needs an evaluation permission, and the
 * service further limits rows to the caller's assignments (the chair sees the whole committee). Organization
 * administration, auditors and operator support grants never reach evaluation content (AC-15, PRD §4.3). Evaluation
 * records are buyer-internal ([R] tables, DD-03): there is no supplier or public endpoint in this contract.
 *
 * Business error codes (Stage B must return the same codes):
 * - Assignments: ASSIGNMENT_NOT_FOUND, NOT_ASSIGNED_EVALUATOR, ASSIGNMENT_ALREADY_ACCEPTED, ASSIGNMENT_CLOSED,
 *   ASSIGNMENT_NOT_ACCEPTED, UNDERTAKING_VERSION_OUTDATED, CONFLICT_REVIEW_PENDING, CONFLICT_ALREADY_DECLARED,
 *   REASSIGNMENT_ALREADY_REQUESTED, EVALUATOR_NOT_ELIGIBLE, EVALUATOR_CONFLICTED, DECLARATION_NOT_FOUND,
 *   DECLARATION_ALREADY_REVIEWED, DECLARATION_HAS_NO_CONFLICT.
 * - Assessment: ASSESSMENT_CONTENT_BLOCKED, COMMERCIAL_ASSIGNMENT, ASSESSMENT_SUBMITTED, ASSESSMENT_INCOMPLETE,
 *   RATIONALE_REQUIRED, SCORE_OUT_OF_SCALE, NOT_APPLICABLE_NOT_PERMITTED, CELL_NOT_IN_SCOPE, SCORE_NOT_FOUND,
 *   SCORE_NOT_SUBMITTED, SCORE_UNCHANGED, MODERATION_FINALIZED.
 * - Commercial: PRICE_GATE_NOT_RELEASED, PRICE_GATE_ALREADY_RELEASED, PRICE_GATE_NOT_APPLICABLE,
 *   NON_PRICE_MODERATION_OPEN, COMMERCIAL_EVALUATION_NOT_FOUND, COMMERCIAL_ALREADY_APPROVED, CURRENCY_MISMATCH,
 *   CORRECTION_ALREADY_PENDING, NO_PENDING_CORRECTION, CORRECTION_SELF_APPROVAL, CORRECTION_PENDING,
 *   NOT_FLAGGED_ABNORMALLY_LOW, ABNORMALLY_LOW_REVIEW_PENDING, UNKNOWN_BID, UNKNOWN_CURRENCY.
 * - Moderation: MODERATION_NOT_FOUND, MODERATION_FINALIZED, METHOD_NOT_PERMITTED, CELL_NOT_IN_SCOPE,
 *   SCORE_OUT_OF_SCALE, ASSESSMENTS_INCOMPLETE, MODERATED_SCORE_MISSING, ASSESSMENT_NOT_SUBMITTED.
 * - Results and report: LOT_REQUIRED, OWN_ASSESSMENT_NOT_SUBMITTED, RESULTS_SIGNED_OFF, REPORT_NOT_FOUND,
 *   REPORT_NOT_DRAFT, REPORT_NOT_READY, REPORT_NOT_IN_SIGNOFF, SIGNOFF_ALREADY_DECIDED, NOT_COMMITTEE_MEMBER,
 *   REPORT_NOT_SIGNED_OFF, REPORT_ALREADY_HANDED_OFF.
 *
 * Pure module: zod and sibling contract files only.
 */
import { defineEndpoint } from './endpoint.js';
import type { PermissionCode } from './permissions.js';
import {
  AcceptAssignmentBody,
  AssignmentDetail,
  AssignmentListQuery,
  AssignmentPage,
  AssignmentParams,
  DeclarationParams,
  DeclareConflictBody,
  EvaluationListQuery,
  EvaluationOverview,
  EvaluationSummaryPage,
  ReassignBody,
  ReassignResult,
  ReassignmentCandidates,
  ReassignmentRequestResult,
  RequestReassignmentBody,
  ReviewConflictBody,
} from './evaluation/assignments.js';
import { Assessment, CorrectScoreBody, SaveScoresBody, ScoreCell, ScoreParams, SubmitAssessmentBody } from './evaluation/assessment.js';
import {
  AbnormallyLowReviewBody,
  ApproveComparisonBody,
  ApproveCorrectionBody,
  CommercialComparison,
  CommercialEvaluationParams,
  CommercialRow,
  ProposeCorrectionBody,
  ReferenceSetBody,
  ReleasePriceGateBody,
  ScenarioBody,
  ScenarioResult,
} from './evaluation/commercial.js';
import {
  FinalizeModerationBody,
  FinalizeModerationResult,
  ModeratedScoreResult,
  ModerationNotesBody,
  ModerationNotesResult,
  ModerationView,
  RecordModeratedScoreBody,
  ReturnAssessmentBody,
  ReturnAssessmentResult,
  SessionParams,
} from './evaluation/moderation.js';
import {
  EvaluationReport,
  ExportReportBody,
  HandoffBody,
  HandoffResult,
  RankingView,
  ReportExport,
  ReportParams,
  SignoffBody,
  SubmitReportBody,
  ValidateResultsBody,
} from './evaluation/results.js';
import { ConflictDeclaration, LotQuery, PriceGate, TenderParams } from './evaluation/shared.js';

export * from './evaluation/shared.js';
export * from './evaluation/assignments.js';
export * from './evaluation/assessment.js';
export * from './evaluation/commercial.js';
export * from './evaluation/moderation.js';
export * from './evaluation/results.js';

// ---------------------------------------------------------------------------------------------------------
// Permission sets (BR-26: the service additionally limits rows to the caller's assignments)
// ---------------------------------------------------------------------------------------------------------

/** Who may see the evaluation overview (progress only, never scores). */
export const EVALUATION_OVERVIEW_PERMISSIONS = [
  'evaluation.chair',
  'evaluation.score',
  'evaluation.commercial',
  'evaluation.moderate',
  'evaluation.signoff',
  'award.recommend',
  'award.approve',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Who may list and open assignments (evaluators their own, the chair the whole committee). */
export const ASSIGNMENT_VIEW_PERMISSIONS = [
  'evaluation.score',
  'evaluation.commercial',
  'evaluation.chair',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Who may act on their own assignment (accept, declare, request reassignment). */
export const ASSIGNMENT_ACT_PERMISSIONS = [
  'evaluation.score',
  'evaluation.commercial',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Who may read the ranking and report: the committee, the chair and the award team. */
export const RESULTS_VIEW_PERMISSIONS = [
  'evaluation.chair',
  'evaluation.signoff',
  'award.recommend',
  'award.approve',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

const EVA = {
  assignments: ['EVA-01'],
  assessment: ['EVA-02'],
  commercial: ['EVA-04'],
  moderation: ['EVA-05'],
  results: ['EVA-06'],
} as const;

// ---------------------------------------------------------------------------------------------------------
// Overview (EVA-01 entry point, EVA-05/06 navigation)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/buyer/evaluation/tenders: the evaluations the caller takes part in (the chair: all of them). */
export const listEvaluations = defineEndpoint({
  id: 'buyer.evaluation.list',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/tenders',
  audience: 'buyer',
  permission: EVALUATION_OVERVIEW_PERMISSIONS,
  query: EvaluationListQuery,
  response: EvaluationSummaryPage,
  errors: [],
  screens: ['EVA-01', 'EVA-05', 'EVA-06'],
  summary: 'Evaluations (tender or lot) with stage, assignment progress, price gate, moderation and report status.',
});

/** GET /api/v1/buyer/evaluation/tenders/:tenderId: plan, committee, progress and timeline of one evaluation. */
export const getEvaluation = defineEndpoint({
  id: 'buyer.evaluation.get',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId',
  audience: 'buyer',
  permission: EVALUATION_OVERVIEW_PERMISSIONS,
  params: TenderParams,
  query: LotQuery,
  response: EvaluationOverview,
  errors: ['LOT_REQUIRED'],
  screens: ['EVA-01', 'EVA-05', 'EVA-06'],
});

// ---------------------------------------------------------------------------------------------------------
// Assignments (EVA-01)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/buyer/evaluation/assignments: own assignments (scope=all for the chair) with KPI counters. */
export const listAssignments = defineEndpoint({
  id: 'buyer.evaluation.assignments.list',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/assignments',
  audience: 'buyer',
  permission: ASSIGNMENT_VIEW_PERMISSIONS,
  query: AssignmentListQuery,
  response: AssignmentPage,
  errors: [],
  screens: EVA.assignments,
});

/** GET /api/v1/buyer/evaluation/assignments/:assignmentId: scope, dates, declarations and history. */
export const getAssignment = defineEndpoint({
  id: 'buyer.evaluation.assignments.get',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId',
  audience: 'buyer',
  permission: ASSIGNMENT_VIEW_PERMISSIONS,
  params: AssignmentParams,
  response: AssignmentDetail,
  errors: ['ASSIGNMENT_NOT_FOUND'],
  screens: EVA.assignments,
});

/** POST …/accept: accept, sign the undertaking and declare conflicts before any content (BR-08). */
export const acceptAssignment = defineEndpoint({
  id: 'buyer.evaluation.assignments.accept',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/accept',
  audience: 'buyer',
  permission: ASSIGNMENT_ACT_PERMISSIONS,
  params: AssignmentParams,
  body: AcceptAssignmentBody,
  response: AssignmentDetail,
  errors: [
    'ASSIGNMENT_NOT_FOUND',
    'NOT_ASSIGNED_EVALUATOR',
    'ASSIGNMENT_ALREADY_ACCEPTED',
    'ASSIGNMENT_CLOSED',
    'UNDERTAKING_VERSION_OUTDATED',
  ],
  screens: EVA.assignments,
});

/** POST …/conflict-declarations: disclose a conflict after acceptance; access pauses pending review (DD-25). */
export const declareConflict = defineEndpoint({
  id: 'buyer.evaluation.assignments.declareConflict',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/conflict-declarations',
  audience: 'buyer',
  permission: ASSIGNMENT_ACT_PERMISSIONS,
  params: AssignmentParams,
  body: DeclareConflictBody,
  response: AssignmentDetail,
  errors: [
    'ASSIGNMENT_NOT_FOUND',
    'NOT_ASSIGNED_EVALUATOR',
    'ASSIGNMENT_NOT_ACCEPTED',
    'ASSIGNMENT_CLOSED',
    'CONFLICT_ALREADY_DECLARED',
  ],
  screens: EVA.assignments,
  idempotent: true,
});

/** POST …/reassignment-request: ask the chair to reassign the work (creates a task for the chair). */
export const requestReassignment = defineEndpoint({
  id: 'buyer.evaluation.assignments.requestReassignment',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/reassignment-request',
  audience: 'buyer',
  permission: ASSIGNMENT_ACT_PERMISSIONS,
  params: AssignmentParams,
  body: RequestReassignmentBody,
  response: ReassignmentRequestResult,
  errors: ['ASSIGNMENT_NOT_FOUND', 'NOT_ASSIGNED_EVALUATOR', 'ASSIGNMENT_CLOSED', 'REASSIGNMENT_ALREADY_REQUESTED'],
  screens: EVA.assignments,
  idempotent: true,
});

/** GET …/reassignment-candidates: who the chair may assign instead, with eligibility and conflicts. */
export const getReassignmentCandidates = defineEndpoint({
  id: 'buyer.evaluation.assignments.reassignmentCandidates',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/reassignment-candidates',
  audience: 'buyer',
  permission: 'evaluation.chair',
  params: AssignmentParams,
  response: ReassignmentCandidates,
  errors: ['ASSIGNMENT_NOT_FOUND'],
  screens: EVA.assignments,
});

/** POST …/reassign: the chair records a recusal or reassignment; prior work is preserved. */
export const reassignAssignment = defineEndpoint({
  id: 'buyer.evaluation.assignments.reassign',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/reassign',
  audience: 'buyer',
  permission: 'evaluation.chair',
  params: AssignmentParams,
  body: ReassignBody,
  response: ReassignResult,
  errors: ['ASSIGNMENT_NOT_FOUND', 'ASSIGNMENT_CLOSED', 'EVALUATOR_NOT_ELIGIBLE', 'EVALUATOR_CONFLICTED'],
  screens: EVA.assignments,
  idempotent: true,
});

/** POST /api/v1/buyer/evaluation/conflict-declarations/:declarationId/review: the chair's disposition (DD-25). */
export const reviewConflict = defineEndpoint({
  id: 'buyer.evaluation.conflicts.review',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/conflict-declarations/:declarationId/review',
  audience: 'buyer',
  permission: 'evaluation.chair',
  params: DeclarationParams,
  body: ReviewConflictBody,
  response: ConflictDeclaration,
  errors: ['DECLARATION_NOT_FOUND', 'DECLARATION_ALREADY_REVIEWED', 'DECLARATION_HAS_NO_CONFLICT'],
  screens: EVA.assignments,
});

// ---------------------------------------------------------------------------------------------------------
// Individual assessment (EVA-02)
// ---------------------------------------------------------------------------------------------------------

/** GET …/assessment: requirement, response, evidence, scoring guide and own scores (content gated, BR-08). */
export const getAssessment = defineEndpoint({
  id: 'buyer.evaluation.assessment.get',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/assessment',
  audience: 'buyer',
  permission: ['evaluation.score', 'evaluation.chair'],
  params: AssignmentParams,
  response: Assessment,
  errors: ['ASSIGNMENT_NOT_FOUND', 'ASSESSMENT_CONTENT_BLOCKED', 'COMMERCIAL_ASSIGNMENT'],
  screens: EVA.assessment,
});

/** PUT …/scores: save draft scores, rationale, evidence references and clarification needs. */
export const saveScores = defineEndpoint({
  id: 'buyer.evaluation.assessment.saveScores',
  method: 'PUT',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/scores',
  audience: 'buyer',
  permission: 'evaluation.score',
  params: AssignmentParams,
  body: SaveScoresBody,
  response: Assessment,
  errors: [
    'ASSIGNMENT_NOT_FOUND',
    'NOT_ASSIGNED_EVALUATOR',
    'ASSESSMENT_CONTENT_BLOCKED',
    'ASSESSMENT_SUBMITTED',
    'CELL_NOT_IN_SCOPE',
    'SCORE_OUT_OF_SCALE',
    'NOT_APPLICABLE_NOT_PERMITTED',
  ],
  screens: EVA.assessment,
});

/** POST …/submit: the assessment becomes a formal record; refused while any cell is not scored (AC-18). */
export const submitAssessment = defineEndpoint({
  id: 'buyer.evaluation.assessment.submit',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/submit',
  audience: 'buyer',
  permission: 'evaluation.score',
  params: AssignmentParams,
  body: SubmitAssessmentBody,
  response: Assessment,
  errors: [
    'ASSIGNMENT_NOT_FOUND',
    'NOT_ASSIGNED_EVALUATOR',
    'ASSESSMENT_CONTENT_BLOCKED',
    'ASSESSMENT_SUBMITTED',
    'ASSESSMENT_INCOMPLETE',
    'RATIONALE_REQUIRED',
  ],
  screens: EVA.assessment,
});

/** POST …/scores/:scoreId/corrections: correct a submitted score with a reason; history is kept (BR-27). */
export const correctScore = defineEndpoint({
  id: 'buyer.evaluation.assessment.correctScore',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/scores/:scoreId/corrections',
  audience: 'buyer',
  permission: 'evaluation.score',
  params: ScoreParams,
  body: CorrectScoreBody,
  response: ScoreCell,
  errors: [
    'ASSIGNMENT_NOT_FOUND',
    'NOT_ASSIGNED_EVALUATOR',
    'SCORE_NOT_FOUND',
    'SCORE_NOT_SUBMITTED',
    'SCORE_UNCHANGED',
    'SCORE_OUT_OF_SCALE',
    'MODERATION_FINALIZED',
  ],
  screens: EVA.assessment,
  idempotent: true,
});

// ---------------------------------------------------------------------------------------------------------
// Commercial comparison and price gate (EVA-04)
// ---------------------------------------------------------------------------------------------------------

/** GET …/tenders/:tenderId/commercial: the comparison on the issued basis (empty before the price gate). */
export const getCommercialComparison = defineEndpoint({
  id: 'buyer.evaluation.commercial.get',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId/commercial',
  audience: 'buyer',
  permission: ['evaluation.commercial', 'evaluation.chair'],
  params: TenderParams,
  query: LotQuery,
  response: CommercialComparison,
  errors: ['LOT_REQUIRED'],
  screens: EVA.commercial,
});

/** POST /api/v1/buyer/evaluation/commercial-evaluations/:id/corrections: propose an arithmetic correction. */
export const proposeCorrection = defineEndpoint({
  id: 'buyer.evaluation.commercial.proposeCorrection',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/corrections',
  audience: 'buyer',
  permission: 'evaluation.commercial',
  params: CommercialEvaluationParams,
  body: ProposeCorrectionBody,
  response: CommercialRow,
  errors: [
    'COMMERCIAL_EVALUATION_NOT_FOUND',
    'PRICE_GATE_NOT_RELEASED',
    'COMMERCIAL_ALREADY_APPROVED',
    'CURRENCY_MISMATCH',
    'CORRECTION_ALREADY_PENDING',
  ],
  screens: EVA.commercial,
  idempotent: true,
});

/** POST …/corrections/approve: approve a pending arithmetic correction (not by its proposer). */
export const approveCorrection = defineEndpoint({
  id: 'buyer.evaluation.commercial.approveCorrection',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/corrections/approve',
  audience: 'buyer',
  permission: 'evaluation.commercial',
  params: CommercialEvaluationParams,
  body: ApproveCorrectionBody,
  response: CommercialRow,
  errors: ['COMMERCIAL_EVALUATION_NOT_FOUND', 'NO_PENDING_CORRECTION', 'CORRECTION_SELF_APPROVAL'],
  screens: EVA.commercial,
});

/** POST …/abnormally-low-review: documented review of an abnormally-low flag (never automatic rejection). */
export const reviewAbnormallyLow = defineEndpoint({
  id: 'buyer.evaluation.commercial.reviewAbnormallyLow',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/abnormally-low-review',
  audience: 'buyer',
  permission: 'evaluation.commercial',
  params: CommercialEvaluationParams,
  body: AbnormallyLowReviewBody,
  response: CommercialRow,
  errors: ['COMMERCIAL_EVALUATION_NOT_FOUND', 'NOT_FLAGGED_ABNORMALLY_LOW', 'COMMERCIAL_ALREADY_APPROVED'],
  screens: EVA.commercial,
});

/** POST …/reference-set: include or exclude an offer from the relative price formula, with a reason. */
export const setReferenceSet = defineEndpoint({
  id: 'buyer.evaluation.commercial.setReferenceSet',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/reference-set',
  audience: 'buyer',
  permission: 'evaluation.commercial',
  params: CommercialEvaluationParams,
  body: ReferenceSetBody,
  response: CommercialRow,
  errors: ['COMMERCIAL_EVALUATION_NOT_FOUND', 'COMMERCIAL_ALREADY_APPROVED'],
  screens: EVA.commercial,
});

/** POST …/tenders/:tenderId/commercial/approve: approve the comparison on the issued basis. */
export const approveComparison = defineEndpoint({
  id: 'buyer.evaluation.commercial.approve',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId/commercial/approve',
  audience: 'buyer',
  permission: 'evaluation.commercial',
  params: TenderParams,
  body: ApproveComparisonBody,
  response: CommercialComparison,
  errors: [
    'LOT_REQUIRED',
    'PRICE_GATE_NOT_RELEASED',
    'COMMERCIAL_ALREADY_APPROVED',
    'CORRECTION_PENDING',
    'ABNORMALLY_LOW_REVIEW_PENDING',
  ],
  screens: EVA.commercial,
});

/** POST …/commercial/scenarios: a private sensitivity scenario; official scores never change. */
export const runScenario = defineEndpoint({
  id: 'buyer.evaluation.commercial.scenario',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId/commercial/scenarios',
  audience: 'buyer',
  permission: 'evaluation.commercial',
  params: TenderParams,
  body: ScenarioBody,
  response: ScenarioResult,
  errors: ['LOT_REQUIRED', 'PRICE_GATE_NOT_RELEASED', 'UNKNOWN_BID', 'UNKNOWN_CURRENCY'],
  screens: EVA.commercial,
  status: 200,
});

/** POST …/tenders/:tenderId/price-gate: the chair releases the price gate after non-price moderation (AC-16). */
export const releasePriceGate = defineEndpoint({
  id: 'buyer.evaluation.priceGate.release',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId/price-gate',
  audience: 'buyer',
  permission: 'evaluation.chair',
  params: TenderParams,
  body: ReleasePriceGateBody,
  response: PriceGate,
  errors: ['LOT_REQUIRED', 'PRICE_GATE_NOT_APPLICABLE', 'PRICE_GATE_ALREADY_RELEASED', 'NON_PRICE_MODERATION_OPEN'],
  screens: ['EVA-04', 'EVA-05'],
});

// ---------------------------------------------------------------------------------------------------------
// Moderation (EVA-05)
// ---------------------------------------------------------------------------------------------------------

/** GET …/tenders/:tenderId/moderation: submitted assessments side by side with divergences and agreed results. */
export const getModeration = defineEndpoint({
  id: 'buyer.evaluation.moderation.get',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId/moderation',
  audience: 'buyer',
  permission: ['evaluation.moderate', 'evaluation.chair'],
  params: TenderParams,
  query: LotQuery,
  response: ModerationView,
  errors: ['LOT_REQUIRED', 'MODERATION_NOT_FOUND'],
  screens: EVA.moderation,
});

/** POST /api/v1/buyer/evaluation/moderation-sessions/:sessionId/scores: record the agreed score with reasons. */
export const recordModeratedScore = defineEndpoint({
  id: 'buyer.evaluation.moderation.recordScore',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/moderation-sessions/:sessionId/scores',
  audience: 'buyer',
  permission: 'evaluation.moderate',
  params: SessionParams,
  body: RecordModeratedScoreBody,
  response: ModeratedScoreResult,
  errors: ['MODERATION_NOT_FOUND', 'MODERATION_FINALIZED', 'METHOD_NOT_PERMITTED', 'CELL_NOT_IN_SCOPE', 'SCORE_OUT_OF_SCALE'],
  screens: EVA.moderation,
  idempotent: true,
});

/** PUT …/moderation-sessions/:sessionId/notes: the discussion notes of the session. */
export const updateModerationNotes = defineEndpoint({
  id: 'buyer.evaluation.moderation.updateNotes',
  method: 'PUT',
  path: '/api/v1/buyer/evaluation/moderation-sessions/:sessionId/notes',
  audience: 'buyer',
  permission: 'evaluation.moderate',
  params: SessionParams,
  body: ModerationNotesBody,
  response: ModerationNotesResult,
  errors: ['MODERATION_NOT_FOUND', 'MODERATION_FINALIZED'],
  screens: EVA.moderation,
});

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/return: return a submitted assessment for correction. */
export const returnAssessment = defineEndpoint({
  id: 'buyer.evaluation.moderation.returnAssessment',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/assignments/:assignmentId/return',
  audience: 'buyer',
  permission: 'evaluation.moderate',
  params: AssignmentParams,
  body: ReturnAssessmentBody,
  response: ReturnAssessmentResult,
  errors: ['ASSIGNMENT_NOT_FOUND', 'ASSESSMENT_NOT_SUBMITTED', 'MODERATION_FINALIZED'],
  screens: EVA.moderation,
});

/** POST …/moderation-sessions/:sessionId/finalize: finalize with preserved history. */
export const finalizeModeration = defineEndpoint({
  id: 'buyer.evaluation.moderation.finalize',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/moderation-sessions/:sessionId/finalize',
  audience: 'buyer',
  permission: 'evaluation.moderate',
  params: SessionParams,
  body: FinalizeModerationBody,
  response: FinalizeModerationResult,
  errors: ['MODERATION_NOT_FOUND', 'MODERATION_FINALIZED', 'ASSESSMENTS_INCOMPLETE', 'MODERATED_SCORE_MISSING'],
  screens: EVA.moderation,
});

// ---------------------------------------------------------------------------------------------------------
// Ranking and evaluation report (EVA-06)
// ---------------------------------------------------------------------------------------------------------

/** GET …/tenders/:tenderId/results: eligibility, scores, gates, ties, readiness and the report with sign-offs. */
export const getResults = defineEndpoint({
  id: 'buyer.evaluation.results.get',
  method: 'GET',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId/results',
  audience: 'buyer',
  permission: RESULTS_VIEW_PERMISSIONS,
  params: TenderParams,
  query: LotQuery,
  response: RankingView,
  errors: ['LOT_REQUIRED', 'OWN_ASSESSMENT_NOT_SUBMITTED'],
  screens: EVA.results,
});

/** POST …/results/validate: recompute and validate the outcomes under the approved method. */
export const validateResults = defineEndpoint({
  id: 'buyer.evaluation.results.validate',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/tenders/:tenderId/results/validate',
  audience: 'buyer',
  permission: 'evaluation.chair',
  params: TenderParams,
  body: ValidateResultsBody,
  response: RankingView,
  errors: ['LOT_REQUIRED', 'RESULTS_SIGNED_OFF'],
  screens: EVA.results,
});

/** POST /api/v1/buyer/evaluation/reports/:reportId/submit: produce the evaluation record and start sign-off. */
export const submitReport = defineEndpoint({
  id: 'buyer.evaluation.reports.submit',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/reports/:reportId/submit',
  audience: 'buyer',
  permission: 'evaluation.chair',
  params: ReportParams,
  body: SubmitReportBody,
  response: EvaluationReport,
  errors: ['REPORT_NOT_FOUND', 'REPORT_NOT_DRAFT', 'REPORT_NOT_READY'],
  screens: EVA.results,
});

/** POST …/reports/:reportId/signoffs: a committee member signs or declines (with a note). */
export const signoffReport = defineEndpoint({
  id: 'buyer.evaluation.reports.signoff',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/reports/:reportId/signoffs',
  audience: 'buyer',
  permission: 'evaluation.signoff',
  params: ReportParams,
  body: SignoffBody,
  response: EvaluationReport,
  errors: ['REPORT_NOT_FOUND', 'REPORT_NOT_IN_SIGNOFF', 'SIGNOFF_ALREADY_DECIDED', 'NOT_COMMITTEE_MEMBER'],
  screens: EVA.results,
  idempotent: true,
});

/** POST …/reports/:reportId/exports: queue an export of the evaluation record. */
export const exportReport = defineEndpoint({
  id: 'buyer.evaluation.reports.export',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/reports/:reportId/exports',
  audience: 'buyer',
  permission: ['evaluation.chair', 'evaluation.signoff', 'award.recommend'],
  params: ReportParams,
  body: ExportReportBody,
  response: ReportExport,
  errors: ['REPORT_NOT_FOUND'],
  screens: EVA.results,
  idempotent: true,
  status: 202,
});

/** POST …/reports/:reportId/handoff: pass the signed-off result to the award recommendation. */
export const handoffReport = defineEndpoint({
  id: 'buyer.evaluation.reports.handoff',
  method: 'POST',
  path: '/api/v1/buyer/evaluation/reports/:reportId/handoff',
  audience: 'buyer',
  permission: 'evaluation.chair',
  params: ReportParams,
  body: HandoffBody,
  response: HandoffResult,
  errors: ['REPORT_NOT_FOUND', 'REPORT_NOT_SIGNED_OFF', 'REPORT_ALREADY_HANDED_OFF'],
  screens: EVA.results,
});

/** Every endpoint of the evaluation contract. */
export const evaluationEndpoints = {
  listEvaluations,
  getEvaluation,
  listAssignments,
  getAssignment,
  acceptAssignment,
  declareConflict,
  requestReassignment,
  getReassignmentCandidates,
  reassignAssignment,
  reviewConflict,
  getAssessment,
  saveScores,
  submitAssessment,
  correctScore,
  getCommercialComparison,
  proposeCorrection,
  approveCorrection,
  reviewAbnormallyLow,
  setReferenceSet,
  approveComparison,
  runScenario,
  releasePriceGate,
  getModeration,
  recordModeratedScore,
  updateModerationNotes,
  returnAssessment,
  finalizeModeration,
  getResults,
  validateResults,
  submitReport,
  signoffReport,
  exportReport,
  handoffReport,
} as const;
