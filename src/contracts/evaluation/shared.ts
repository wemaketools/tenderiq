/**
 * Evaluation contract, shared schemas: the tender/lot/bid references, the evaluation plan (criteria, scale anchors,
 * tie rules), conflict declarations and confidentiality undertakings, and the projection enums of the evaluation
 * screens (EVA-01, EVA-02, EVA-04, EVA-05, EVA-06; FR-14; PRD §9; BR-26..BR-29).
 *
 * Field names mirror the blueprint columns of `evaluation_plans`, `evaluation_criteria`, `scale_anchors`,
 * `tie_break_rules`, `conflict_declarations` and `confidentiality_undertakings` (camelCase). Scores, weights and rates
 * are decimal strings (DD-32). A score that was never given is `null`, never `"0"` (AC-18).
 *
 * The projection enums below are NOT database CHECK lists (those live in `enums.ts`); they describe derived states
 * that the API computes for the screens (for example the stage of an evaluation or the next action of an evaluator).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  CurrencyCode,
  Id,
  IdParam,
  Instant,
  NonNegativeDecimalString,
  PersonRef,
  Reference,
  Score,
  TimeZone,
} from '../common.js';
import {
  BidsComplianceStatus,
  BidsEvaluationStatus,
  ConflictDeclarationsDisposition,
  ConflictDeclarationsNature,
  ConflictDeclarationsSubjectType,
  EvaluationCriteriaEnvelope,
  EvaluationPlansAggregationMethod,
  EvaluationPlansPriceMethod,
  EvaluationPlansStatus,
  EvaluationPlansThresholdScope,
  TendersAwardModel,
  TendersOpeningMode,
  TendersStatus,
  TieBreakRulesRule,
} from '../enums.js';

// ---------------------------------------------------------------------------------------------------------
// Projection enums (derived states, not database columns)
// ---------------------------------------------------------------------------------------------------------

/** Where an evaluation (tender or lot) stands, derived from assignments, moderation, gate, comparison and report. */
export const EVALUATION_STAGES = [
  'individual_assessment',
  'moderation',
  'commercial_comparison',
  'ranking',
  'signoff',
  'complete',
] as const;
export const EvaluationStage = z.enum(EVALUATION_STAGES);
export type EvaluationStage = (typeof EVALUATION_STAGES)[number];

/** The caller's part in an evaluation. */
export const EVALUATION_ROLES = ['chair', 'evaluator', 'commercial_reviewer', 'observer'] as const;
export const EvaluationRole = z.enum(EVALUATION_ROLES);
export type EvaluationRole = (typeof EVALUATION_ROLES)[number];

/** What the assigned evaluator must do next on an assignment (EVA-01). */
export const ASSIGNMENT_NEXT_ACTIONS = [
  'accept',
  'await_conflict_review',
  'score',
  'submit',
  'correct',
  'commercial_comparison',
  'none',
] as const;
export const AssignmentNextAction = z.enum(ASSIGNMENT_NEXT_ACTIONS);
export type AssignmentNextAction = (typeof ASSIGNMENT_NEXT_ACTIONS)[number];

/**
 * The caller's own next step on an evaluation (the workspace header), derived from their role and the record state:
 * the chair's committee step, an evaluator's own assessment step, the commercial reviewer's comparison step, or
 * `none` (for example an award-team observer).
 */
export const EVALUATION_NEXT_ACTIONS = [
  'accept_assignment',
  'await_conflict_review',
  'score_assessment',
  'submit_assessment',
  'correct_assessment',
  'await_price_gate',
  'prepare_comparison',
  'follow_up_assessments',
  'moderate',
  'release_price_gate',
  'await_comparison',
  'validate_ranking',
  'sign_report',
  'collect_signoffs',
  'hand_off_report',
  'none',
] as const;
export const EvaluationNextAction = z.enum(EVALUATION_NEXT_ACTIONS);
export type EvaluationNextAction = (typeof EVALUATION_NEXT_ACTIONS)[number];

/**
 * Why restricted assessment content is withheld from an assignment (BR-08, DD-25): the evaluator has not accepted,
 * the undertaking is missing, a declared conflict awaits review, or the evaluator was recused or reassigned.
 */
export const CONTENT_BLOCK_REASONS = [
  'not_accepted',
  'undertaking_missing',
  'conflict_pending_review',
  'recused',
  'reassigned',
] as const;
export const ContentBlockReason = z.enum(CONTENT_BLOCK_REASONS);
export type ContentBlockReason = (typeof CONTENT_BLOCK_REASONS)[number];

/** Readiness item states (the shared ReadinessChecklist): blocking errors, warnings and passed checks are distinct. */
export const READINESS_STATUSES = ['blocking', 'warning', 'passed'] as const;
export const ReadinessStatus = z.enum(READINESS_STATUSES);
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

/** One readiness item of a gate (price gate, moderation finalization, report sign-off). */
export const ReadinessItem = z.object({
  id: z.string().min(1),
  status: ReadinessStatus,
  label: z.string().min(1),
  detail: z.string().nullable(),
});
export type ReadinessItem = z.infer<typeof ReadinessItem>;

// ---------------------------------------------------------------------------------------------------------
// Tender, lot and bid references
// ---------------------------------------------------------------------------------------------------------

/** The tender an evaluation belongs to (`tenders`), with the settings that govern evaluation. */
export const EvaluationTenderRef = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
  officialTimeZone: TimeZone,
  openingMode: TendersOpeningMode,
  awardModel: TendersAwardModel,
  maxLotsPerSupplier: z.number().int().min(1).nullable(),
  /** `tenders.independent_evaluation`: evaluators cannot see others' scores before submitting their own. */
  independentEvaluation: z.boolean(),
  /** `tenders.anonymized_evaluation` and its stated limitations (FR-14). */
  anonymizedEvaluation: z.boolean(),
  anonymizationLimitations: z.string().nullable(),
});
export type EvaluationTenderRef = z.infer<typeof EvaluationTenderRef>;

/** The lot evaluated (`lots`), or `null` when the whole tender is evaluated together. */
export const EvaluationLotRef = z.object({
  lotId: Id,
  lotNumber: z.number().int().min(1),
  title: z.string().min(1),
});
export type EvaluationLotRef = z.infer<typeof EvaluationLotRef>;

/**
 * A bid in evaluation (`bids` + the effective `submission_receipts` row). `label` is the neutral label used on the
 * evaluation screens (for example "Supplier A"); `supplierName` is `null` only while the evaluation is anonymized.
 */
export const EvaluationBidRef = z.object({
  bidId: Id,
  supplierTenantId: Id,
  supplierName: z.string().min(1).nullable(),
  label: z.string().min(1),
  receiptNo: Reference,
  receivedAt: Instant,
  revisionId: Id,
  complianceStatus: BidsComplianceStatus,
  evaluationStatus: BidsEvaluationStatus,
});
export type EvaluationBidRef = z.infer<typeof EvaluationBidRef>;

// ---------------------------------------------------------------------------------------------------------
// Evaluation plan (evaluation_plans, evaluation_criteria, scale_anchors, tie_break_rules)
// ---------------------------------------------------------------------------------------------------------

/** One criterion of the approved plan (`evaluation_criteria`). `maxPoints` are the weight in points. */
export const EvaluationCriterion = z.object({
  criterionId: Id,
  parentId: Id.nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  maxPoints: Score,
  isPrice: z.boolean(),
  minScore: Score.nullable(),
  scoringGuidance: z.string().nullable(),
  envelope: EvaluationCriteriaEnvelope,
  naPermitted: z.boolean(),
  sortOrder: z.number().int().min(0),
});
export type EvaluationCriterion = z.infer<typeof EvaluationCriterion>;

/** A scale anchor (`scale_anchors`): what a rating value means (PRD §9.3). */
export const ScaleAnchor = z.object({
  value: z.number().int().min(0),
  label: z.string().min(1),
  description: z.string().min(1),
});
export type ScaleAnchor = z.infer<typeof ScaleAnchor>;

/** One step of the published tie sequence (`tie_break_rules`). */
export const TieBreakRule = z.object({
  sequence: z.number().int().min(1),
  rule: TieBreakRulesRule,
  criterionId: Id.nullable(),
});
export type TieBreakRule = z.infer<typeof TieBreakRule>;

/**
 * The approved evaluation plan (`evaluation_plans`) applied to the tender or lot (BR-28). Ratings use the scale
 * 0..`scaleMax`; weighted points = rating ÷ scaleMax × criterion maxPoints (PRD §9.2).
 */
export const EvaluationPlan = z.object({
  planId: Id,
  version: z.number().int().min(1),
  status: EvaluationPlansStatus,
  scaleMax: z.number().int().min(1),
  aggregationMethod: EvaluationPlansAggregationMethod,
  priceMethod: EvaluationPlansPriceMethod,
  priceWeight: Score,
  priceFormulaNote: z.string().nullable(),
  zeroPriceTreatment: z.string().nullable(),
  missingPriceTreatment: z.string().nullable(),
  thresholdScope: EvaluationPlansThresholdScope,
  nonPriceThreshold: Score.nullable(),
  decimalPlacesCalc: z.number().int().min(0).max(10),
  decimalPlacesDisplay: z.number().int().min(0).max(10),
  comparisonCurrency: CurrencyCode,
  fxSource: z.string().nullable(),
  fxDate: CalendarDate.nullable(),
  approvedAt: Instant.nullable(),
  criteria: z.array(EvaluationCriterion),
  scaleAnchors: z.array(ScaleAnchor),
  tieBreakRules: z.array(TieBreakRule),
});
export type EvaluationPlan = z.infer<typeof EvaluationPlan>;

// ---------------------------------------------------------------------------------------------------------
// Declarations (conflict_declarations, confidentiality_undertakings) — BR-08, DD-25
// ---------------------------------------------------------------------------------------------------------

/** A conflict declaration made for an assignment (`conflict_declarations`). */
export const ConflictDeclaration = z.object({
  declarationId: Id,
  subjectType: ConflictDeclarationsSubjectType,
  subjectId: Id,
  hasConflict: z.boolean(),
  nature: ConflictDeclarationsNature.nullable(),
  supplierTenantId: Id.nullable(),
  supplierName: z.string().nullable(),
  details: z.string().nullable(),
  declaredAt: Instant,
  disposition: ConflictDeclarationsDisposition,
  reviewedBy: PersonRef.nullable(),
  reviewedAt: Instant.nullable(),
  reviewNote: z.string().nullable(),
});
export type ConflictDeclaration = z.infer<typeof ConflictDeclaration>;

/** A signed confidentiality undertaking (`confidentiality_undertakings`). */
export const ConfidentialityUndertaking = z.object({
  undertakingId: Id,
  textVersion: z.string().min(1),
  acceptedAt: Instant,
});
export type ConfidentialityUndertaking = z.infer<typeof ConfidentialityUndertaking>;

/** The undertaking text an evaluator must accept before seeing any content. */
export const UndertakingText = z.object({
  textVersion: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
});
export type UndertakingText = z.infer<typeof UndertakingText>;

/** The price gate (`price_gate_releases`): commercial prices stay unavailable until it is released (AC-16). */
export const PriceGate = z.object({
  /** `false` for a single-stage tender: prices open with the other envelopes and no gate applies. */
  applies: z.boolean(),
  released: z.boolean(),
  releasedAt: Instant.nullable(),
  releasedBy: PersonRef.nullable(),
  nonPriceCompleteConfirmed: z.boolean().nullable(),
  note: z.string().nullable(),
});
export type PriceGate = z.infer<typeof PriceGate>;

/** An FX conversion applied to an offer: the original currency and amount stay visible (PRD §9.3, BR-29). */
export const FxBasis = z.object({
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rate: NonNegativeDecimalString,
  source: z.string().min(1),
  rateDate: CalendarDate,
});
export type FxBasis = z.infer<typeof FxBasis>;

/** A person with the capacity they act in on the committee. */
export const CommitteeMemberRef = PersonRef.extend({
  capacity: z.string().nullable(),
});
export type CommitteeMemberRef = z.infer<typeof CommitteeMemberRef>;

/** Query filter for the lot of a multi-lot tender (omit it for a tender evaluated as a whole). */
export const LotQuery = z.object({
  lotId: IdParam.optional(),
});
export type LotQuery = z.output<typeof LotQuery>;

/** Path params keyed by tender. */
export const TenderParams = z.object({ tenderId: IdParam });
