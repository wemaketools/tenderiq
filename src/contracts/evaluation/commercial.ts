/**
 * Evaluation contract, commercial comparison (EVA-04) and the price gate (PRD §9.2, §9.3; BR-29; AC-16, AC-19).
 *
 * - Submitted totals, authorized arithmetic corrections, FX conversion and the evaluated cost are separate values;
 *   the supplier's original currency and amount stay visible (BR-29).
 * - Only offers in the reference set enter a relative price formula; an exclusion from it states a reason.
 * - An abnormally-low flag asks for a documented review; it never rejects automatically.
 * - Affordability is shown next to, never inside, the price score or rank (PRD §9.3).
 * - Private sensitivity scenarios are computed on request and never alter official scores (EVA-04).
 *
 * Field names mirror `commercial_evaluations` and `price_gate_releases`. Money is `{ amount, currency }` (DD-32).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CurrencyCode,
  Id,
  IdParam,
  Instant,
  Money,
  NonNegativeDecimalString,
  NonNegativeMoney,
  PersonRef,
  ReasonText,
  Score,
  issue,
} from '../common.js';
import { CommercialEvaluationsAffordability, CommercialEvaluationsStatus } from '../enums.js';
import {
  EvaluationBidRef,
  EvaluationLotRef,
  EvaluationPlan,
  EvaluationTenderRef,
  FxBasis,
  PriceGate,
  ReadinessItem,
} from './shared.js';

/** State of an arithmetic correction: none, proposed and awaiting approval, or approved. */
export const CORRECTION_STATUSES = ['none', 'pending_approval', 'approved'] as const;
export const CorrectionStatus = z.enum(CORRECTION_STATUSES);
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

/** Outcome of the documented review of an abnormally-low offer. */
export const ABNORMALLY_LOW_OUTCOMES = ['pending', 'explanation_accepted', 'referred_for_decision'] as const;
export const AbnormallyLowOutcome = z.enum(ABNORMALLY_LOW_OUTCOMES);
export type AbnormallyLowOutcome = (typeof ABNORMALLY_LOW_OUTCOMES)[number];

/** One component of the evaluated cost on the issued basis (one-time, recurring × periods, options, taxes). */
export const CostComponent = z.object({
  label: z.string().min(1),
  amount: Money,
  includedInEvaluation: z.boolean(),
  note: z.string().nullable(),
});
export type CostComponent = z.infer<typeof CostComponent>;

/** One offer in the comparison (`commercial_evaluations`). */
export const CommercialRow = z.object({
  commercialEvaluationId: Id,
  bid: EvaluationBidRef,
  revisionId: Id,
  /** As submitted, in the supplier's original currency (`submitted_total`, `submitted_currency`). */
  submittedTotal: NonNegativeMoney,
  /** Authorized arithmetic correction as a signed delta in the submitted currency; `null` = none. */
  arithmeticCorrection: Money.nullable(),
  /** Submitted total plus the correction, still in the submitted currency. */
  correctedTotal: NonNegativeMoney,
  correctionRule: z.string().nullable(),
  correctionStatus: CorrectionStatus,
  /** Who proposed the correction and when (`correction_proposed_by`, `correction_proposed_at`); never its approver. */
  correctionProposedBy: PersonRef.nullable(),
  correctionProposedAt: Instant.nullable(),
  correctionApprovedBy: PersonRef.nullable(),
  supplierAckAt: Instant.nullable(),
  /** `null` when the offer is already in the comparison currency. */
  fx: FxBasis.nullable(),
  evaluatedCost: NonNegativeMoney,
  costComponents: z.array(CostComponent),
  excludedItemsNote: z.string().nullable(),
  assumptions: z.string().nullable(),
  abnormallyLowFlag: z.boolean(),
  abnormallyLowOutcome: AbnormallyLowOutcome.nullable(),
  abnormallyLowReview: z.string().nullable(),
  inReferenceSet: z.boolean(),
  referenceExclusionReason: z.string().nullable(),
  /** Price points from the plan's price method at calculation precision. */
  priceScore: Score.nullable(),
  priceScoreDisplay: z.string().nullable(),
  affordability: CommercialEvaluationsAffordability,
  status: CommercialEvaluationsStatus,
});
export type CommercialRow = z.infer<typeof CommercialRow>;

/** A bid whose commercial envelope stays sealed (for example an excluded bid, AC-17), with the reason. */
export const SealedCommercialBid = z.object({
  bid: EvaluationBidRef,
  reason: z.string().min(1),
});
export type SealedCommercialBid = z.infer<typeof SealedCommercialBid>;

export const COMMERCIAL_STATES = ['not_started', 'draft', 'approved'] as const;
export const CommercialState = z.enum(COMMERCIAL_STATES);
export type CommercialState = (typeof COMMERCIAL_STATES)[number];

/**
 * The commercial comparison of one tender or lot. Before the price gate, `rows` is empty and `priceGate.released`
 * is false: prices stay unavailable (AC-16).
 */
export const CommercialComparison = z.object({
  tender: EvaluationTenderRef,
  lot: EvaluationLotRef.nullable(),
  plan: EvaluationPlan,
  priceGate: PriceGate,
  status: CommercialState,
  reviewer: PersonRef.nullable(),
  taxTreatment: z.string().nullable(),
  basisNote: z.string().nullable(),
  /** Internal budget for the affordability finding; shown separately from rank. */
  budget: NonNegativeMoney.nullable(),
  lowestEvaluatedCost: NonNegativeMoney.nullable(),
  rows: z.array(CommercialRow),
  sealedBids: z.array(SealedCommercialBid),
  readiness: z.array(ReadinessItem),
  approvedAt: Instant.nullable(),
  approvedBy: PersonRef.nullable(),
});
export type CommercialComparison = z.infer<typeof CommercialComparison>;

export const CommercialEvaluationParams = z.object({ commercialEvaluationId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------

/** Proposes an arithmetic correction: the corrected total in the submitted currency and the rule applied. */
export const ProposeCorrectionBody = z.object({
  correctedTotal: NonNegativeMoney,
  correctionRule: z.string().trim().min(1, issue('CORRECTION_RULE_REQUIRED', 'State the correction rule.')).max(2000),
  requiresSupplierAck: z.boolean(),
});
export type ProposeCorrectionBody = z.input<typeof ProposeCorrectionBody>;

/** Approves a proposed correction (a different reviewer from the proposer). */
export const ApproveCorrectionBody = z.object({
  note: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
});
export type ApproveCorrectionBody = z.input<typeof ApproveCorrectionBody>;

/** Records the documented review of an abnormally-low flag. */
export const AbnormallyLowReviewBody = z.object({
  outcome: z.enum(['explanation_accepted', 'referred_for_decision']),
  review: ReasonText,
});
export type AbnormallyLowReviewBody = z.input<typeof AbnormallyLowReviewBody>;

/** Places an offer in or out of the reference set; leaving it out requires a reason (PRD §9.3). */
export const ReferenceSetBody = z
  .object({
    inReferenceSet: z.boolean(),
    reason: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
  })
  .superRefine((value, context) => {
    if (!value.inReferenceSet && (value.reason === undefined || value.reason.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: issue('REFERENCE_EXCLUSION_REASON_REQUIRED', 'Explain why the offer is outside the reference set.'),
      });
    }
  });
export type ReferenceSetBody = z.input<typeof ReferenceSetBody>;

/** Approves the comparison on the issued basis. */
export const ApproveComparisonBody = z.object({
  lotId: Id.optional(),
  assumptionsConfirmed: z.literal(true, {
    error: issue('CONFIRMATION_REQUIRED', 'Confirm the comparison basis and assumptions.'),
  }),
});
export type ApproveComparisonBody = z.input<typeof ApproveComparisonBody>;

/** A private sensitivity scenario: alternative FX rates, excluded offers or cost adjustments. */
export const ScenarioBody = z.object({
  lotId: Id.optional(),
  label: z.string().trim().min(1, issue('SCENARIO_LABEL_REQUIRED', 'Name the scenario.')).max(200),
  fxRateOverrides: z
    .array(z.object({ fromCurrency: CurrencyCode, rate: NonNegativeDecimalString }))
    .max(10)
    .default([]),
  excludeBidIds: z.array(Id).max(50).default([]),
  adjustments: z
    .array(z.object({ bidId: Id, amount: Money, note: z.string().trim().min(1).max(500) }))
    .max(50)
    .default([]),
});
export type ScenarioBody = z.input<typeof ScenarioBody>;

export const ScenarioRow = z.object({
  bidId: Id,
  label: z.string().min(1),
  evaluatedCost: NonNegativeMoney,
  priceScore: Score,
  nonPriceScore: Score.nullable(),
  totalScore: Score.nullable(),
  rank: z.number().int().min(1).nullable(),
  officialRank: z.number().int().min(1).nullable(),
});
export type ScenarioRow = z.infer<typeof ScenarioRow>;

/** The scenario result: always `official: false`; official scores are unchanged. */
export const ScenarioResult = z.object({
  label: z.string().min(1),
  official: z.literal(false),
  generatedAt: Instant,
  basisNote: z.string().min(1),
  rows: z.array(ScenarioRow),
  excludedBidIds: z.array(Id),
});
export type ScenarioResult = z.infer<typeof ScenarioResult>;

/** The chair releases the price gate once the non-price review is complete (DD-16, DD-23, AC-16). */
export const ReleasePriceGateBody = z.object({
  lotId: Id.optional(),
  nonPriceCompleteConfirmed: z.literal(true, {
    error: issue('CONFIRMATION_REQUIRED', 'Confirm that the non-price assessment is complete.'),
  }),
  note: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
});
export type ReleasePriceGateBody = z.input<typeof ReleasePriceGateBody>;
