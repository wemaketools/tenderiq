/**
 * Evaluation contract, overview and assignments (EVA-01): the evaluations of the active buyer, the evaluator
 * assignments with their declarations and completion, and the commands to accept, disclose a conflict, request or
 * perform a reassignment and review a declared conflict (BR-08, BR-26, DD-25, PRD §8.3, §20).
 *
 * Field names mirror `evaluation_assignments`, `conflict_declarations` and `confidentiality_undertakings`.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  Id,
  IdParam,
  Instant,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import {
  ConflictDeclarationsDisposition,
  ConflictDeclarationsNature,
  EvaluationAssignmentsStatus,
  EvaluationReportsStatus,
  ModerationSessionsStatus,
  CommercialEvaluationsStatus,
} from '../enums.js';
import {
  AssignmentNextAction,
  CommitteeMemberRef,
  ConfidentialityUndertaking,
  ConflictDeclaration,
  ContentBlockReason,
  EvaluationBidRef,
  EvaluationCriterion,
  EvaluationLotRef,
  EvaluationNextAction,
  EvaluationPlan,
  EvaluationRole,
  EvaluationStage,
  EvaluationTenderRef,
  PriceGate,
  UndertakingText,
} from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Evaluations of the active buyer (overview)
// ---------------------------------------------------------------------------------------------------------

/** Assignment progress counters of one evaluation. Missing work is counted, never scored as zero (AC-18). */
export const AssignmentProgress = z.object({
  total: z.number().int().min(0),
  accepted: z.number().int().min(0),
  submitted: z.number().int().min(0),
  incomplete: z.number().int().min(0),
  overdue: z.number().int().min(0),
  conflictsPendingReview: z.number().int().min(0),
});
export type AssignmentProgress = z.infer<typeof AssignmentProgress>;

/** One evaluation (a tender, or one lot of it) in the overview list. */
export const EvaluationSummaryRow = z.object({
  tender: EvaluationTenderRef,
  lot: EvaluationLotRef.nullable(),
  stage: EvaluationStage,
  chair: PersonRef,
  myRole: EvaluationRole,
  /** The caller's own next step (not the chair's step unless the caller is the chair). */
  myNextAction: EvaluationNextAction,
  bidCount: z.number().int().min(0),
  progress: AssignmentProgress,
  /** Earliest open assignment due date, in the tender's official zone. */
  nextDueAt: OfficialDeadline.nullable(),
  priceGate: PriceGate,
  moderationStatus: ModerationSessionsStatus.nullable(),
  commercialStatus: CommercialEvaluationsStatus.nullable(),
  reportStatus: EvaluationReportsStatus.nullable(),
});
export type EvaluationSummaryRow = z.infer<typeof EvaluationSummaryRow>;

export const EVALUATION_SORT_FIELDS = ['reference', 'nextDueAt', 'stage'] as const;

export const EvaluationListQuery = listQueryWithSort(EVALUATION_SORT_FIELDS).extend({
  stage: queryList(EvaluationStage).optional(),
  /** Only evaluations with at least one overdue assignment. */
  overdue: QueryBoolean.optional(),
  /** Only evaluations where the caller has this role. */
  myRole: queryList(EvaluationRole).optional(),
});
export type EvaluationListQuery = z.output<typeof EvaluationListQuery>;

export const EvaluationSummaryPage = pageOf(EvaluationSummaryRow);

/** One committee line of the evaluation overview. */
export const CommitteeLine = z.object({
  assignmentId: Id,
  evaluator: CommitteeMemberRef,
  isCommercial: z.boolean(),
  status: EvaluationAssignmentsStatus,
  dueAt: OfficialDeadline,
  scored: z.number().int().min(0),
  total: z.number().int().min(0),
  conflictDisposition: ConflictDeclarationsDisposition.nullable(),
});
export type CommitteeLine = z.infer<typeof CommitteeLine>;

/** A dated event of the evaluation timeline. */
export const EvaluationEvent = z.object({
  at: Instant,
  title: z.string().min(1),
  actor: PersonRef.nullable(),
  detail: z.string().nullable(),
});
export type EvaluationEvent = z.infer<typeof EvaluationEvent>;

/** The evaluation overview of one tender or lot. */
export const EvaluationOverview = EvaluationSummaryRow.extend({
  plan: EvaluationPlan,
  bids: z.array(EvaluationBidRef),
  committee: z.array(CommitteeLine),
  timeline: z.array(EvaluationEvent),
});
export type EvaluationOverview = z.infer<typeof EvaluationOverview>;

// ---------------------------------------------------------------------------------------------------------
// Assignments (evaluation_assignments)
// ---------------------------------------------------------------------------------------------------------

/** Declaration state of an assignment: both must precede any restricted content (BR-08). */
export const AssignmentDeclarations = z.object({
  undertakingAccepted: z.boolean(),
  conflictDeclared: z.boolean(),
  hasConflict: z.boolean().nullable(),
  conflictDisposition: ConflictDeclarationsDisposition.nullable(),
});
export type AssignmentDeclarations = z.infer<typeof AssignmentDeclarations>;

/** Scoring completion: cells scored (or marked not applicable) out of the assigned cells. */
export const AssignmentCompletion = z.object({
  scored: z.number().int().min(0),
  total: z.number().int().min(0),
  notScored: z.number().int().min(0),
  complete: z.boolean(),
});
export type AssignmentCompletion = z.infer<typeof AssignmentCompletion>;

export const AssignmentRow = z.object({
  assignmentId: Id,
  tender: EvaluationTenderRef,
  lot: EvaluationLotRef.nullable(),
  evaluator: CommitteeMemberRef,
  /** `bid_id`: `null` = all eligible bids. */
  bidId: Id.nullable(),
  bidCount: z.number().int().min(0),
  /** `criterion_ids`: empty = all non-price criteria. */
  criterionIds: z.array(Id),
  criterionCount: z.number().int().min(0),
  isCommercial: z.boolean(),
  dueAt: OfficialDeadline,
  isOverdue: z.boolean(),
  status: EvaluationAssignmentsStatus,
  acceptedAt: Instant.nullable(),
  submittedAt: Instant.nullable(),
  declarations: AssignmentDeclarations,
  completion: AssignmentCompletion,
  nextAction: AssignmentNextAction,
});
export type AssignmentRow = z.infer<typeof AssignmentRow>;

export const AssignmentSummary = z.object({
  total: z.number().int().min(0),
  notStarted: z.number().int().min(0),
  inProgress: z.number().int().min(0),
  submitted: z.number().int().min(0),
  returned: z.number().int().min(0),
  overdue: z.number().int().min(0),
  declarationsPending: z.number().int().min(0),
});
export type AssignmentSummary = z.infer<typeof AssignmentSummary>;

export const ASSIGNMENT_SORT_FIELDS = ['dueAt', 'reference', 'status', 'evaluator'] as const;

/** `scope=mine` (default for evaluators) or `all` (chair only: every assignment of the organization). */
export const ASSIGNMENT_SCOPES = ['mine', 'all'] as const;

export const AssignmentListQuery = listQueryWithSort(ASSIGNMENT_SORT_FIELDS).extend({
  scope: z.enum(ASSIGNMENT_SCOPES).optional(),
  status: queryList(EvaluationAssignmentsStatus).optional(),
  tenderId: IdParam.optional(),
  evaluatorUserId: IdParam.optional(),
  isCommercial: QueryBoolean.optional(),
  overdue: QueryBoolean.optional(),
  dueFrom: z.iso.date(issue('INVALID_DATE', 'Use a date such as 2026-10-14.')).optional(),
  dueTo: z.iso.date(issue('INVALID_DATE', 'Use a date such as 2026-10-14.')).optional(),
});
export type AssignmentListQuery = z.output<typeof AssignmentListQuery>;

export const AssignmentPage = pageOf(AssignmentRow).extend({ summary: AssignmentSummary });
export type AssignmentPage = z.infer<typeof AssignmentPage>;

/** One entry of the assignment history (acceptance, declaration, submission, return, reassignment). */
export const AssignmentHistoryEntry = z.object({
  at: Instant,
  event: z.string().min(1),
  actor: PersonRef.nullable(),
  note: z.string().nullable(),
});
export type AssignmentHistoryEntry = z.infer<typeof AssignmentHistoryEntry>;

/**
 * The assignment detail (EVA-01). `bids` are listed only when content access is allowed: before acceptance, the
 * undertaking and a cleared conflict declaration, the evaluator sees scope and dates only (BR-08).
 */
export const AssignmentDetail = AssignmentRow.extend({
  undertakingText: UndertakingText,
  confidentialityUndertaking: ConfidentialityUndertaking.nullable(),
  conflictDeclaration: ConflictDeclaration.nullable(),
  contentAccess: z.object({
    allowed: z.boolean(),
    blockedReason: ContentBlockReason.nullable(),
  }),
  bids: z.array(EvaluationBidRef),
  criteria: z.array(EvaluationCriterion),
  chair: PersonRef,
  reassignedTo: PersonRef.nullable(),
  reassignmentReason: z.string().nullable(),
  returnReason: z.string().nullable(),
  reassignmentRequestedAt: Instant.nullable(),
  history: z.array(AssignmentHistoryEntry),
  /** Whether the caller is the assigned evaluator (the chair reads other assignments for oversight only). */
  isOwn: z.boolean(),
});
export type AssignmentDetail = z.infer<typeof AssignmentDetail>;

export const AssignmentParams = z.object({ assignmentId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------

/** The conflict declaration made with acceptance or later. A conflict needs its nature and details. */
export const ConflictDeclarationInput = z
  .object({
    hasConflict: z.boolean({ error: issue('CONFLICT_ANSWER_REQUIRED', 'State whether you have a conflict.') }),
    nature: ConflictDeclarationsNature.optional(),
    supplierTenantId: Id.optional(),
    details: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
  })
  .superRefine((value, context) => {
    if (value.hasConflict && value.nature === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['nature'],
        message: issue('CONFLICT_NATURE_REQUIRED', 'Choose the nature of the conflict.'),
      });
    }
    if (value.hasConflict && (value.details === undefined || value.details.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['details'],
        message: issue('CONFLICT_DETAILS_REQUIRED', 'Describe the conflict.'),
      });
    }
  });
export type ConflictDeclarationInput = z.input<typeof ConflictDeclarationInput>;

/** Accepting an assignment signs the confidentiality undertaking and declares conflicts in one step (BR-08). */
export const AcceptAssignmentBody = z.object({
  confidentialityAccepted: z.literal(true, {
    error: issue('UNDERTAKING_REQUIRED', 'Accept the confidentiality undertaking to continue.'),
  }),
  undertakingTextVersion: z.string().trim().min(1, issue('UNDERTAKING_REQUIRED', 'The undertaking version is required.')),
  conflictDeclaration: ConflictDeclarationInput,
});
export type AcceptAssignmentBody = z.input<typeof AcceptAssignmentBody>;

/** Disclosing a conflict after acceptance (new information). */
export const DeclareConflictBody = z.object({
  nature: ConflictDeclarationsNature,
  supplierTenantId: Id.optional(),
  details: ReasonText,
});
export type DeclareConflictBody = z.input<typeof DeclareConflictBody>;

/** The evaluator asks the chair to reassign the work. */
export const RequestReassignmentBody = z.object({
  reason: ReasonText,
});
export type RequestReassignmentBody = z.input<typeof RequestReassignmentBody>;

export const ReassignmentRequestResult = z.object({
  assignmentId: Id,
  status: EvaluationAssignmentsStatus,
  requestedAt: Instant,
  routedTo: PersonRef,
  taskId: Id,
});
export type ReassignmentRequestResult = z.infer<typeof ReassignmentRequestResult>;

/** The chair reassigns the work to another evaluator; prior work is preserved (PRD §20). */
export const ReassignBody = z.object({
  newEvaluatorUserId: Id,
  reason: ReasonText,
  /** `recused` when the evaluator withdraws for a conflict, `reassigned` for any other reason. */
  outcome: z.enum(['recused', 'reassigned']),
});
export type ReassignBody = z.input<typeof ReassignBody>;

export const ReassignResult = z.object({
  original: AssignmentRow,
  replacement: AssignmentRow,
});
export type ReassignResult = z.infer<typeof ReassignResult>;

/** A person the chair may assign instead, with the reason they are or are not eligible. */
export const ReassignmentCandidate = CommitteeMemberRef.extend({
  eligible: z.boolean(),
  ineligibleReason: z.string().nullable(),
  openAssignments: z.number().int().min(0),
});
export type ReassignmentCandidate = z.infer<typeof ReassignmentCandidate>;

export const ReassignmentCandidates = z.object({
  assignmentId: Id,
  items: z.array(ReassignmentCandidate),
});
export type ReassignmentCandidates = z.infer<typeof ReassignmentCandidates>;

export const DeclarationParams = z.object({ declarationId: IdParam });

/** The chair's review of a declared conflict (DD-25). */
export const ReviewConflictBody = z.object({
  disposition: z.enum(['cleared', 'mitigated', 'recused', 'reassigned']),
  reviewNote: ReasonText,
});
export type ReviewConflictBody = z.input<typeof ReviewConflictBody>;
