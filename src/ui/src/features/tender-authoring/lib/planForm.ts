/**
 * The evaluation-plan editor model (BUY-11): the plan as editable strings, the body sent to
 * `buyer.tenders.updateEvaluationPlan`, and the live checks. Validation runs the CONTRACT schema in the browser, so
 * the editor shows exactly the messages the API would return (weights must total 100, price weight equals the
 * price criteria, declared zero/missing price treatment, threshold, decimals, anchors, tie rules).
 */
import type { FieldError } from '@contracts/common';
import { splitIssueMessage } from '@contracts/common';
import { isDecimal, sum } from '@contracts/decimal';
import type {
  EvaluationCriteriaEnvelope,
  EvaluationPlansAggregationMethod,
  EvaluationPlansPriceMethod,
  EvaluationPlansThresholdScope,
  TieBreakRulesRule,
} from '@contracts/enums';
import { UpdateEvaluationPlanBody } from '@contracts/tenders';
import type { EvaluationPlan } from '@contracts/tenders';

export interface CriterionDraft {
  key: string;
  code: string;
  parentCode: string;
  name: string;
  description: string;
  maxPoints: string;
  isPrice: boolean;
  minScore: string;
  scoringGuidance: string;
  envelope: string;
  naPermitted: boolean;
}

export interface AnchorDraft {
  key: string;
  value: string;
  label: string;
  description: string;
}

export interface TieRuleDraft {
  key: string;
  rule: string;
  criterionCode: string;
}

export interface PlanDraft {
  scaleMax: string;
  aggregationMethod: string;
  priceMethod: string;
  priceWeight: string;
  priceFormulaNote: string;
  zeroPriceTreatment: string;
  missingPriceTreatment: string;
  thresholdScope: string;
  nonPriceThreshold: string;
  decimalPlacesCalc: string;
  decimalPlacesDisplay: string;
  comparisonCurrency: string;
  fxSource: string;
  fxDate: string;
  criteria: CriterionDraft[];
  anchors: AnchorDraft[];
  tieBreakRules: TieRuleDraft[];
  amendmentNote: string;
}

let sequence = 0;
/** A stable React key for a new editor row. */
export function rowKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function draftOfPlan(plan: EvaluationPlan): PlanDraft {
  const codeById = new Map(plan.criteria.map((criterion) => [criterion.id, criterion.code]));
  return {
    scaleMax: String(plan.scaleMax),
    aggregationMethod: plan.aggregationMethod,
    priceMethod: plan.priceMethod,
    priceWeight: plan.priceWeight ?? '',
    priceFormulaNote: plan.priceFormulaNote ?? '',
    zeroPriceTreatment: plan.zeroPriceTreatment ?? '',
    missingPriceTreatment: plan.missingPriceTreatment ?? '',
    thresholdScope: plan.thresholdScope,
    nonPriceThreshold: plan.nonPriceThreshold ?? '',
    decimalPlacesCalc: String(plan.decimalPlacesCalc),
    decimalPlacesDisplay: String(plan.decimalPlacesDisplay),
    comparisonCurrency: plan.comparisonCurrency ?? '',
    fxSource: plan.fxSource ?? '',
    fxDate: plan.fxDate ?? '',
    criteria: [...plan.criteria]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((criterion) => ({
        key: `c-${criterion.id}`,
        code: criterion.code,
        parentCode: criterion.parentId === null ? '' : (codeById.get(criterion.parentId) ?? ''),
        name: criterion.name,
        description: criterion.description ?? '',
        maxPoints: criterion.maxPoints,
        isPrice: criterion.isPrice,
        minScore: criterion.minScore ?? '',
        scoringGuidance: criterion.scoringGuidance ?? '',
        envelope: criterion.envelope,
        naPermitted: criterion.naPermitted,
      })),
    anchors: plan.anchors.map((anchor) => ({
      key: `a-${anchor.value}`,
      value: String(anchor.value),
      label: anchor.label,
      description: anchor.description ?? '',
    })),
    tieBreakRules: [...plan.tieBreakRules]
      .sort((a, b) => a.sequence - b.sequence)
      .map((rule) => ({
        key: `t-${rule.sequence}`,
        rule: rule.rule,
        criterionCode: rule.criterion?.code ?? '',
      })),
    amendmentNote: '',
  };
}

export function emptyCriterion(): CriterionDraft {
  return {
    key: rowKey('c'),
    code: '',
    parentCode: '',
    name: '',
    description: '',
    maxPoints: '',
    isPrice: false,
    minScore: '',
    scoringGuidance: '',
    envelope: 'technical',
    naPermitted: false,
  };
}

const text = (value: string): string | null => (value.trim() === '' ? null : value.trim());
const int = (value: string, fallback: number): number =>
  /^\d+$/.test(value) ? Number(value) : fallback;

/** The request body built from the draft (strings that are not numbers stay invalid, so validation reports them). */
export function planBody(draft: PlanDraft, expectedVersion: number): UpdateEvaluationPlanBody {
  return {
    expectedVersion,
    scaleMax: int(draft.scaleMax, 0),
    aggregationMethod: draft.aggregationMethod as EvaluationPlansAggregationMethod,
    priceMethod: draft.priceMethod as EvaluationPlansPriceMethod,
    priceWeight: text(draft.priceWeight),
    priceFormulaNote: text(draft.priceFormulaNote),
    zeroPriceTreatment: text(draft.zeroPriceTreatment),
    missingPriceTreatment: text(draft.missingPriceTreatment),
    thresholdScope: draft.thresholdScope as EvaluationPlansThresholdScope,
    nonPriceThreshold: text(draft.nonPriceThreshold),
    decimalPlacesCalc: int(draft.decimalPlacesCalc, -1),
    decimalPlacesDisplay: int(draft.decimalPlacesDisplay, -1),
    comparisonCurrency: text(draft.comparisonCurrency),
    fxSource: text(draft.fxSource),
    fxDate: text(draft.fxDate),
    criteria: draft.criteria.map((criterion) => ({
      code: criterion.code.trim(),
      parentCode: text(criterion.parentCode),
      name: criterion.name.trim(),
      description: text(criterion.description),
      maxPoints: criterion.maxPoints,
      isPrice: criterion.isPrice,
      minScore: text(criterion.minScore),
      scoringGuidance: text(criterion.scoringGuidance),
      envelope: criterion.envelope as EvaluationCriteriaEnvelope,
      naPermitted: criterion.naPermitted,
    })),
    anchors: draft.anchors.map((anchor) => ({
      value: int(anchor.value, -1),
      label: anchor.label.trim(),
      description: text(anchor.description),
    })),
    tieBreakRules: draft.tieBreakRules.map((rule, index) => ({
      sequence: index + 1,
      rule: rule.rule as TieBreakRulesRule,
      criterionCode: text(rule.criterionCode),
    })),
    amendmentNote: text(draft.amendmentNote),
  };
}

/** The contract's validation of the body, as problem+json-style field errors (`criteria.0.code`). */
export function validatePlan(body: UpdateEvaluationPlanBody): FieldError[] {
  const result = UpdateEvaluationPlanBody.safeParse(body);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const { code, message } = splitIssueMessage(issue.message);
    return { field: issue.path.map(String).join('.'), code, message };
  });
}

/** The live total of the top-level criteria points, or null while a value is not a decimal. */
export function weightsTotal(draft: PlanDraft): string | null {
  const values = draft.criteria
    .filter((criterion) => criterion.parentCode.trim() === '')
    .map((criterion) => criterion.maxPoints.trim());
  if (values.some((value) => !isDecimal(value))) return null;
  return sum(values.length === 0 ? ['0'] : values);
}
