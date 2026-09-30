/**
 * Evaluation contract, individual assessment (EVA-02): the requirement, the opened response and its evidence, the
 * scoring guide, the evaluator's own scores and notes, and the commands to save, submit and correct (FR-14, AC-16,
 * AC-18, BR-27).
 *
 * - `score` is the rating on the plan scale (0..`scaleMax`) as a decimal string; `null` means NOT SCORED and is never
 *   read as zero (AC-18). An assessment with a cell that is neither scored nor marked not applicable is incomplete
 *   and cannot be submitted.
 * - Independent evaluation: `peerScores` stay hidden until the caller's own assessment is submitted.
 * - Prices are never part of an individual assessment; the price criterion is scored by the published formula
 *   after the price gate (AC-16).
 * - After submission a score changes only through a correction with a reason; history is kept (`score_corrections`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  Id,
  IdParam,
  Instant,
  NonNegativeDecimalString,
  OfficialDeadline,
  PersonRef,
  ReasonText,
  Score,
  issue,
} from '../common.js';
import { EvaluationAssignmentsStatus, EvaluationScoresStatus } from '../enums.js';
import {
  EvaluationBidRef,
  EvaluationLotRef,
  EvaluationPlan,
  EvaluationTenderRef,
  PriceGate,
} from './shared.js';

/** A document attached to a response answer (opened content, read through the sealing service in Stage B). */
export const ResponseDocument = z.object({
  documentId: Id,
  title: z.string().min(1),
  fileName: z.string().min(1),
});
export type ResponseDocument = z.infer<typeof ResponseDocument>;

/** The requirement and the supplier's opened answer relevant to one criterion. */
export const RequirementResponse = z.object({
  requirementId: Id,
  refCode: z.string().min(1),
  requirementText: z.string().min(1),
  answerText: z.string().nullable(),
  isDeviation: z.boolean(),
  documents: z.array(ResponseDocument),
});
export type RequirementResponse = z.infer<typeof RequirementResponse>;

export const CriterionResponse = z.object({
  criterionId: Id,
  requirements: z.array(RequirementResponse),
});
export type CriterionResponse = z.infer<typeof CriterionResponse>;

export const AssessedBid = EvaluationBidRef.extend({
  responses: z.array(CriterionResponse),
});
export type AssessedBid = z.infer<typeof AssessedBid>;

/** One appended correction of a submitted score (`score_corrections`). */
export const ScoreCorrection = z.object({
  correctionId: Id,
  previousScore: Score.nullable(),
  newScore: Score.nullable(),
  previousRationale: z.string().nullable(),
  reason: z.string().min(1),
  correctedBy: PersonRef,
  correctedAt: Instant,
  returnedByChair: z.boolean(),
});
export type ScoreCorrection = z.infer<typeof ScoreCorrection>;

/** One cell (bid × criterion) of the caller's assessment (`evaluation_scores`). */
export const ScoreCell = z.object({
  /** `null` until the cell was saved once. */
  scoreId: Id.nullable(),
  bidId: Id,
  criterionId: Id,
  /** Rating on the plan scale; `null` = not scored (never zero, AC-18). */
  score: Score.nullable(),
  /** rating ÷ scaleMax × maxPoints at the plan's calculation precision; `null` when not scored. */
  weightedPoints: Score.nullable(),
  isNotApplicable: z.boolean(),
  rationale: z.string().nullable(),
  evidenceRefs: z.array(z.string()),
  clarificationNeeded: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  status: EvaluationScoresStatus,
  submittedAt: Instant.nullable(),
  version: z.number().int().min(1),
  corrections: z.array(ScoreCorrection),
});
export type ScoreCell = z.infer<typeof ScoreCell>;

/** A cell the evaluator still has to score. */
export const MissingCell = z.object({
  bidId: Id,
  criterionId: Id,
});
export type MissingCell = z.infer<typeof MissingCell>;

/** Another committee member's score, visible only after the caller submitted (independent evaluation). */
export const PeerScore = z.object({
  evaluator: PersonRef,
  bidId: Id,
  criterionId: Id,
  score: Score.nullable(),
  isNotApplicable: z.boolean(),
  status: EvaluationScoresStatus,
});
export type PeerScore = z.infer<typeof PeerScore>;

/**
 * Whether the caller sees other committee members' scores: hidden until the caller's own submission (independent
 * evaluation), visible, `oversight` when the chair reads an evaluator's assessment (committee scores are reviewed in
 * moderation), or `not_applicable` when the event does not use independent evaluation.
 */
export const PEER_SCORE_VISIBILITIES = ['hidden_until_own_submission', 'visible', 'oversight', 'not_applicable'] as const;
export const PeerScoreVisibility = z.enum(PEER_SCORE_VISIBILITIES);
export type PeerScoreVisibility = (typeof PEER_SCORE_VISIBILITIES)[number];

/** The individual assessment workspace of one assignment. */
export const Assessment = z.object({
  assignmentId: Id,
  tender: EvaluationTenderRef,
  lot: EvaluationLotRef.nullable(),
  evaluator: PersonRef,
  status: EvaluationAssignmentsStatus,
  dueAt: OfficialDeadline,
  submittedAt: Instant.nullable(),
  returnReason: z.string().nullable(),
  /** `true` when the chair reads another evaluator's assessment for oversight; no command is offered. */
  readOnly: z.boolean(),
  plan: EvaluationPlan,
  /** Non-price criteria in the assignment's scope, in plan order. */
  criterionIds: z.array(Id),
  bids: z.array(AssessedBid),
  scores: z.array(ScoreCell),
  completion: z.object({
    scored: z.number().int().min(0),
    total: z.number().int().min(0),
    complete: z.boolean(),
    missing: z.array(MissingCell),
  }),
  /** Prices are withheld from individual assessment; the gate state is shown for context (AC-16). */
  priceGate: PriceGate,
  /**
   * Whether a submitted score can still be corrected with a reason (BR-27): `false` once moderation is finalized,
   * because the agreed scores are then part of the record.
   */
  correctionsOpen: z.boolean(),
  peerScores: z.object({
    visibility: PeerScoreVisibility,
    items: z.array(PeerScore),
  }),
});
export type Assessment = z.infer<typeof Assessment>;

// ---------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------

/** One cell to save as a draft. A rating must be within the plan scale; the rationale is required on submit. */
export const ScoreInput = z
  .object({
    bidId: Id,
    criterionId: Id,
    score: NonNegativeDecimalString.nullable(),
    isNotApplicable: z.boolean().default(false),
    rationale: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).nullable(),
    evidenceRefs: z
      .array(z.string().trim().min(1).max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.')))
      .max(20, issue('TOO_MANY_EVIDENCE_REFS', 'At most 20 evidence references.'))
      .default([]),
    clarificationNeeded: z.boolean().default(false),
    clarificationQuestion: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).nullable(),
  })
  .superRefine((value, context) => {
    if (value.isNotApplicable && value.score !== null) {
      context.addIssue({
        code: 'custom',
        path: ['score'],
        message: issue('SCORE_WITH_NOT_APPLICABLE', 'A criterion marked not applicable has no score.'),
      });
    }
    if (value.clarificationNeeded && (value.clarificationQuestion === null || value.clarificationQuestion.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['clarificationQuestion'],
        message: issue('CLARIFICATION_QUESTION_REQUIRED', 'Write the clarification you need.'),
      });
    }
  });
export type ScoreInput = z.input<typeof ScoreInput>;

export const SaveScoresBody = z.object({
  scores: z.array(ScoreInput).min(1, issue('SCORES_REQUIRED', 'Save at least one score.')).max(200),
});
export type SaveScoresBody = z.input<typeof SaveScoresBody>;

/**
 * Submitting makes the assessment a formal record (FR-14). `scores` carries any cells changed since the last save
 * (save-and-submit); completeness is checked on the saved cells merged with them.
 */
export const SubmitAssessmentBody = z.object({
  confirmIndependent: z.literal(true, {
    error: issue('CONFIRMATION_REQUIRED', 'Confirm that the assessment is your own independent work.'),
  }),
  scores: z.array(ScoreInput).max(200).default([]),
});
export type SubmitAssessmentBody = z.input<typeof SubmitAssessmentBody>;

export const ScoreParams = z.object({ assignmentId: IdParam, scoreId: IdParam });

/** A correction of a submitted score: new value, new rationale and a required reason (BR-27). */
export const CorrectScoreBody = z.object({
  newScore: NonNegativeDecimalString.nullable(),
  newRationale: z.string().trim().min(1, issue('RATIONALE_REQUIRED', 'Explain the corrected score.')).max(4000),
  reason: ReasonText,
});
export type CorrectScoreBody = z.input<typeof CorrectScoreBody>;
