/**
 * Evaluation contract, ranking and evaluation report (EVA-06): eligibility, scores, gates, ties, lot constraints,
 * explanations and committee sign-off (FR-14, PRD §9.1, §9.3, AC-19).
 *
 * - Totals are kept at the plan's calculation precision (`totalScore`) and displayed rounded (`totalScoreDisplay`);
 *   a display-rounded tie never hides different decision values.
 * - A failed gate (mandatory requirement, threshold, exclusion) prevents ordinary ranking: `rank` is `null` and
 *   `gateFailures` names the reason. A strong price cannot compensate a failed gate (PRD §9.1).
 * - Rank is decision support; affordability is shown separately and may require budget approval or no award.
 *
 * Field names mirror `evaluation_results`, `evaluation_reports` and `evaluation_report_signoffs`.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { Id, IdParam, Instant, NonNegativeMoney, PersonRef, Score, issue } from '../common.js';
import {
  CommercialEvaluationsAffordability,
  EvaluationReportSignoffsDecision,
  EvaluationReportsStatus,
  EvaluationResultsStatus,
  ExportsFormat,
  ExportsStatus,
} from '../enums.js';
import {
  CommitteeMemberRef,
  EvaluationBidRef,
  EvaluationLotRef,
  EvaluationPlan,
  EvaluationTenderRef,
  ReadinessItem,
} from './shared.js';

/** Points per criterion of a result: moderated ratings converted to points, or the price formula. */
export const CriterionPoints = z.object({
  criterionId: Id,
  /** Agreed rating on the plan scale (`null` for price and for a cell without a moderated score). */
  rating: Score.nullable(),
  points: Score.nullable(),
  pointsDisplay: z.string().nullable(),
  source: z.enum(['moderated', 'price_formula', 'not_available']),
});
export type CriterionPoints = z.infer<typeof CriterionPoints>;

/** One bid's result (`evaluation_results`). */
export const ResultRow = z.object({
  resultId: Id,
  bid: EvaluationBidRef,
  criterionPoints: z.array(CriterionPoints),
  nonPriceScore: Score.nullable(),
  priceScore: Score.nullable(),
  totalScore: Score.nullable(),
  totalScoreDisplay: z.string().nullable(),
  passesGates: z.boolean(),
  gateFailures: z.array(z.string()),
  rank: z.number().int().min(1).nullable(),
  tieBreakApplied: z.string().nullable(),
  evaluatedCost: NonNegativeMoney.nullable(),
  affordability: CommercialEvaluationsAffordability,
  explanation: z.string().min(1),
  status: EvaluationResultsStatus,
});
export type ResultRow = z.infer<typeof ResultRow>;

/** One committee member's sign-off line; `decision: null` = awaiting the member. */
export const SignoffLine = z.object({
  signoffId: Id.nullable(),
  signer: CommitteeMemberRef,
  decision: EvaluationReportSignoffsDecision.nullable(),
  note: z.string().nullable(),
  decidedAt: Instant.nullable(),
});
export type SignoffLine = z.infer<typeof SignoffLine>;

/** An evaluation report version (`evaluation_reports`). */
export const EvaluationReport = z.object({
  reportId: Id,
  version: z.number().int().min(1),
  status: EvaluationReportsStatus,
  summary: z.string().nullable(),
  documentId: Id.nullable(),
  createdAt: Instant,
  createdBy: PersonRef,
  submittedForSignoffAt: Instant.nullable(),
  signedOffAt: Instant.nullable(),
  handedOffAt: Instant.nullable(),
  signoffs: z.array(SignoffLine),
});
export type EvaluationReport = z.infer<typeof EvaluationReport>;

/**
 * How much of the ranking the caller sees (PRD §4.3, BR-26): the committee sees `full` detail; a tender-team
 * observer sees totals and ranks only (`totals_only`) until the current report is signed off; an award approver
 * outside the tender team sees only the signed-off report versions (`reports_only`, no results).
 */
export const RESULT_DETAIL_LEVELS = ['full', 'totals_only', 'reports_only'] as const;
export const ResultDetailLevel = z.enum(RESULT_DETAIL_LEVELS);
export type ResultDetailLevel = (typeof RESULT_DETAIL_LEVELS)[number];

/**
 * Codes of `ResultRow.gateFailures`. `CRITERION_MINIMUM` is followed by the criterion code
 * (for example `CRITERION_MINIMUM:L3-C1`).
 */
export const GATE_FAILURE_CODES = [
  'MANDATORY_REQUIREMENT_FAILED',
  'NON_PRICE_THRESHOLD',
  'DUE_DILIGENCE_FAILED',
  'CRITERION_MINIMUM',
] as const;
export type GateFailureCode = (typeof GATE_FAILURE_CODES)[number];

export const RESULT_STATES = ['not_computed', 'draft', 'signed_off', 'superseded'] as const;
export const ResultState = z.enum(RESULT_STATES);
export type ResultState = (typeof RESULT_STATES)[number];

/** The ranking and evaluation report of one tender or lot. */
export const RankingView = z.object({
  tender: EvaluationTenderRef,
  lot: EvaluationLotRef.nullable(),
  plan: EvaluationPlan,
  status: ResultState,
  /** `totals_only`: `criterionPoints` and `readiness` are empty; `reports_only`: `results` are empty as well. */
  detail: ResultDetailLevel,
  computedAt: Instant.nullable(),
  results: z.array(ResultRow),
  lotConstraints: z.object({
    note: z.string().min(1),
  }),
  budget: NonNegativeMoney.nullable(),
  readiness: z.array(ReadinessItem),
  report: EvaluationReport.nullable(),
  /** Earlier report versions, newest first (superseded versions are kept). */
  reportHistory: z.array(EvaluationReport),
});
export type RankingView = z.infer<typeof RankingView>;

export const ReportParams = z.object({ reportId: IdParam });

export const ValidateResultsBody = z.object({
  lotId: Id.optional(),
});
export type ValidateResultsBody = z.input<typeof ValidateResultsBody>;

/** Submits the report for committee sign-off with its summary (produces the evaluation record). */
export const SubmitReportBody = z.object({
  summary: z.string().trim().min(1, issue('SUMMARY_REQUIRED', 'Write the report summary.')).max(8000),
});
export type SubmitReportBody = z.input<typeof SubmitReportBody>;

/** A committee member's sign-off decision; declining needs a note. */
export const SignoffBody = z
  .object({
    decision: EvaluationReportSignoffsDecision,
    note: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === 'declined' && (value.note === undefined || value.note.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['note'],
        message: issue('DECLINE_NOTE_REQUIRED', 'Explain why you decline to sign.'),
      });
    }
  });
export type SignoffBody = z.input<typeof SignoffBody>;

/** Requests an export of the evaluation report (export type `evaluation_report`). */
export const ExportReportBody = z.object({
  format: ExportsFormat,
});
export type ExportReportBody = z.input<typeof ExportReportBody>;

export const ReportExport = z.object({
  exportId: Id,
  reportId: Id,
  exportType: z.literal('evaluation_report'),
  format: ExportsFormat,
  status: ExportsStatus,
  requestedAt: Instant,
  requestedBy: PersonRef,
  scopeDescription: z.string().min(1),
});
export type ReportExport = z.infer<typeof ReportExport>;

/** Passes the signed-off report to the award recommendation (awards domain). */
export const HandoffBody = z.object({
  note: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
});
export type HandoffBody = z.input<typeof HandoffBody>;

export const HandoffResult = z.object({
  reportId: Id,
  tenderId: Id,
  lotId: Id.nullable(),
  handedOffAt: Instant,
  handedOffBy: PersonRef,
  recommendedBidId: Id.nullable(),
  basis: z.string().min(1),
});
export type HandoffResult = z.infer<typeof HandoffResult>;
