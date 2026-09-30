/**
 * Evaluation contract, moderation (EVA-05): the submitted individual assessments side by side, divergences, the
 * agreed result per cell with its method and reasons, and the commands to discuss, record, return and finalize
 * (FR-14, BR-27, AC-18, AC-20).
 *
 * - Individual scores are never overwritten: a moderated score is a separate record (`moderated_scores`), and a
 *   change supersedes the previous moderated row instead of editing it (AC-20).
 * - A missing individual score is shown as not scored; an average is only computed over a complete set, never by
 *   treating the gap as zero or silently changing the denominator (PRD §9.3).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { Id, IdParam, Instant, NonNegativeDecimalString, PersonRef, ReasonText, Score, issue } from '../common.js';
import {
  EvaluationAssignmentsStatus,
  EvaluationScoresStatus,
  ModerationSessionsMethod,
  ModerationSessionsStatus,
} from '../enums.js';
import {
  EvaluationBidRef,
  EvaluationLotRef,
  EvaluationPlan,
  EvaluationTenderRef,
  PriceGate,
  ReadinessItem,
} from './shared.js';

/**
 * One evaluator's individual score in a cell. Only submitted assessments are shown in moderation (PRD §4.3): for an
 * assessment that is not submitted, `submitted` is false and the score, rationale and evidence are withheld (`null`
 * and empty). `notScored` is true when a submitted cell has no score and is not marked N/A.
 */
export const IndividualScore = z.object({
  assignmentId: Id,
  evaluator: PersonRef,
  submitted: z.boolean(),
  score: Score.nullable(),
  isNotApplicable: z.boolean(),
  notScored: z.boolean(),
  status: EvaluationScoresStatus,
  rationale: z.string().nullable(),
  evidenceRefs: z.array(z.string()),
  clarificationNeeded: z.boolean(),
  correctedAfterSubmission: z.boolean(),
});
export type IndividualScore = z.infer<typeof IndividualScore>;

/** A moderated (agreed) score (`moderated_scores`). */
export const ModeratedScore = z.object({
  moderatedScoreId: Id,
  finalScore: Score,
  weightedPoints: Score,
  method: ModerationSessionsMethod,
  reasons: z.string().min(1),
  moderatedBy: PersonRef,
  recordedAt: Instant,
  supersededById: Id.nullable(),
  /** True when the agreed score differs from at least one individual submitted score. */
  differsFromIndividual: z.boolean(),
});
export type ModeratedScore = z.infer<typeof ModeratedScore>;

/** One bid × criterion cell of the moderation grid. */
export const ModerationCell = z.object({
  bidId: Id,
  criterionId: Id,
  individual: z.array(IndividualScore),
  /** Highest minus lowest submitted score; `null` with fewer than two scores. */
  spread: Score.nullable(),
  divergent: z.boolean(),
  /** Mean of the individual scores; `null` while any assessor has not scored the cell (never zero-filled). */
  average: Score.nullable(),
  outstanding: z.number().int().min(0),
  current: ModeratedScore.nullable(),
  /** Superseded moderated rows, newest first; originals preserved (AC-20). */
  history: z.array(ModeratedScore),
});
export type ModerationCell = z.infer<typeof ModerationCell>;

export const ModerationAssessor = z.object({
  assignmentId: Id,
  evaluator: PersonRef,
  status: EvaluationAssignmentsStatus,
  submittedAt: Instant.nullable(),
  scored: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type ModerationAssessor = z.infer<typeof ModerationAssessor>;

/** The moderation workspace of one tender or lot. */
export const ModerationView = z.object({
  tender: EvaluationTenderRef,
  lot: EvaluationLotRef.nullable(),
  plan: EvaluationPlan,
  session: z.object({
    sessionId: Id,
    method: ModerationSessionsMethod,
    status: ModerationSessionsStatus,
    chair: PersonRef,
    notes: z.string().nullable(),
    createdAt: Instant,
    finalizedAt: Instant.nullable(),
  }),
  /** Spread at or above which a cell is flagged as divergent (plan scale). */
  divergenceThreshold: Score,
  bids: z.array(EvaluationBidRef),
  criterionIds: z.array(Id),
  assessors: z.array(ModerationAssessor),
  cells: z.array(ModerationCell),
  priceGate: PriceGate,
  /** What finalization requires; blocking items explain why it is refused. */
  readiness: z.array(ReadinessItem),
});
export type ModerationView = z.infer<typeof ModerationView>;

export const SessionParams = z.object({ sessionId: IdParam });

/** Records the agreed score of one cell with the declared method and reasons. */
export const RecordModeratedScoreBody = z.object({
  bidId: Id,
  criterionId: Id,
  finalScore: NonNegativeDecimalString,
  method: ModerationSessionsMethod,
  reasons: ReasonText,
});
export type RecordModeratedScoreBody = z.input<typeof RecordModeratedScoreBody>;

export const ModeratedScoreResult = z.object({
  sessionId: Id,
  bidId: Id,
  criterionId: Id,
  current: ModeratedScore,
  superseded: ModeratedScore.nullable(),
});
export type ModeratedScoreResult = z.infer<typeof ModeratedScoreResult>;

/** Discussion notes of the session. */
export const ModerationNotesBody = z.object({
  notes: z.string().trim().min(1, issue('NOTES_REQUIRED', 'Write the discussion notes.')).max(8000),
});
export type ModerationNotesBody = z.input<typeof ModerationNotesBody>;

export const ModerationNotesResult = z.object({
  sessionId: Id,
  notes: z.string(),
  updatedAt: Instant,
  updatedBy: PersonRef,
});
export type ModerationNotesResult = z.infer<typeof ModerationNotesResult>;

/** Returns a submitted assessment to its evaluator for correction (the original stays on record). */
export const ReturnAssessmentBody = z.object({
  reason: ReasonText,
  criterionIds: z.array(Id).max(50).default([]),
  bidIds: z.array(Id).max(50).default([]),
});
export type ReturnAssessmentBody = z.input<typeof ReturnAssessmentBody>;

export const ReturnAssessmentResult = z.object({
  assignmentId: Id,
  status: EvaluationAssignmentsStatus,
  returnedAt: Instant,
  returnedBy: PersonRef,
  reason: z.string().min(1),
});
export type ReturnAssessmentResult = z.infer<typeof ReturnAssessmentResult>;

export const FinalizeModerationBody = z.object({
  confirm: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the moderated results.') }),
});
export type FinalizeModerationBody = z.input<typeof FinalizeModerationBody>;

export const FinalizeModerationResult = z.object({
  sessionId: Id,
  status: ModerationSessionsStatus,
  finalizedAt: Instant,
  finalizedBy: PersonRef,
  cellsModerated: z.number().int().min(0),
});
export type FinalizeModerationResult = z.infer<typeof FinalizeModerationResult>;
