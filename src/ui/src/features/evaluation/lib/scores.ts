/**
 * Score helpers of the evaluation screens (PRD §9.2, §9.3). Arithmetic uses the decimal helpers, never floats:
 * weighted points = rating ÷ scaleMax × criterion maxPoints at the plan's calculation precision. A missing rating is
 * `null` and stays "Not scored" (AC-18); it is never turned into zero.
 */
import { div, isDecimal, mul, round } from '@contracts/decimal';
import type { ChipTone } from '@contracts/enums';
import type {
  CommercialState,
  EvaluationCriterion,
  EvaluationPlan,
  EvaluationStage,
  PriceGate,
  ResultState,
  ScaleAnchor,
} from '@contracts/evaluation';

/** The key of one bid × criterion cell. */
export function cellKey(bidId: number, criterionId: number): string {
  return `${bidId}:${criterionId}`;
}

/** Weighted points of a rating, or `null` when the cell is not scored or the rating is malformed. */
export function weightedPoints(
  rating: string | null,
  criterion: Pick<EvaluationCriterion, 'maxPoints'>,
  plan: Pick<EvaluationPlan, 'scaleMax' | 'decimalPlacesCalc'>,
): string | null {
  if (rating === null || rating === '' || !isDecimal(rating)) return null;
  const ratio = div(rating, String(plan.scaleMax), plan.decimalPlacesCalc + 4);
  return round(mul(ratio, criterion.maxPoints), plan.decimalPlacesCalc);
}

/** Criteria of a plan by id. */
export function criteriaById(plan: EvaluationPlan): ReadonlyMap<number, EvaluationCriterion> {
  return new Map(plan.criteria.map((criterion) => [criterion.criterionId, criterion]));
}

/** The plan criteria in plan order, limited to the given ids. */
export function orderedCriteria(
  plan: EvaluationPlan,
  ids: readonly number[],
): readonly EvaluationCriterion[] {
  const wanted = new Set(ids);
  return [...plan.criteria]
    .filter((criterion) => wanted.has(criterion.criterionId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Decimal places for individual ratings, agreed ratings, their spread and the divergence threshold. The scale allows
 * half points (for example 4.5), so every rating in a grid shows one decimal place and reads consistently side by side
 * ("1.0", "0.0", "4.5"), whatever scale the stored decimal strings carry (DD-32).
 */
export const RATING_PLACES = 1;

/** Rating options from the scale anchors; a saved rating between anchors (for example 3.5) is kept as an option. */
export function ratingOptions(
  anchors: readonly ScaleAnchor[],
  current: string | null,
): { readonly value: string; readonly label: string }[] {
  const options = [...anchors]
    .sort((a, b) => a.value - b.value)
    .map((anchor) => ({ value: String(anchor.value), label: `${anchor.value} — ${anchor.label}` }));
  if (current !== null && current !== '' && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: current });
  }
  return options;
}

export const STAGE_TONES: Readonly<Record<EvaluationStage, ChipTone>> = {
  individual_assessment: 'info',
  moderation: 'accent',
  commercial_comparison: 'warning',
  ranking: 'warning',
  signoff: 'accent',
  complete: 'success',
};

export const COMMERCIAL_STATE_TONES: Readonly<Record<CommercialState, ChipTone>> = {
  not_started: 'neutral',
  draft: 'warning',
  approved: 'success',
};

export const RESULT_STATE_TONES: Readonly<Record<ResultState, ChipTone>> = {
  not_computed: 'neutral',
  draft: 'warning',
  signed_off: 'success',
  superseded: 'neutral',
};

export type PriceGateState = 'not_applicable' | 'closed' | 'released';

export function priceGateState(gate: PriceGate): PriceGateState {
  if (!gate.applies) return 'not_applicable';
  return gate.released ? 'released' : 'closed';
}

export const PRICE_GATE_TONES: Readonly<Record<PriceGateState, ChipTone>> = {
  not_applicable: 'neutral',
  closed: 'danger',
  released: 'success',
};

/** Splits free text into evidence references: one per line, blanks dropped. */
export function parseEvidenceRefs(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
