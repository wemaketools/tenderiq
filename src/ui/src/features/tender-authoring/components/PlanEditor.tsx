/**
 * The evaluation-plan editor (BUY-11): settings, criteria with weights (top-level points must total 100), price
 * method and weight, zero and missing price treatment, threshold scope, decimals, comparison currency, scale anchors
 * and ordered tie rules. The contract schema validates the plan live; the API's 422 field errors bind to the same
 * inputs. Editing an approved plan records an explicit amendment with a note.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import { eq } from '@contracts/decimal';
import {
  EVALUATION_CRITERIA_ENVELOPE,
  EVALUATION_PLANS_AGGREGATION_METHOD,
  EVALUATION_PLANS_PRICE_METHOD,
  EVALUATION_PLANS_THRESHOLD_SCOPE,
  TIE_BREAK_RULES_RULE,
} from '@contracts/enums';
import { updateEvaluationPlan } from '@contracts/tenders';
import type { EvaluationPlan, EvaluationPlanMutationResult } from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DateInput,
  FormErrorSummary,
  IconButton,
  NumberInput,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { tenderErrorMessage } from '../lib/errors';
import {
  draftOfPlan,
  emptyCriterion,
  planBody,
  rowKey,
  validatePlan,
  weightsTotal,
} from '../lib/planForm';
import type { CriterionDraft, PlanDraft } from '../lib/planForm';

export interface PlanEditorProps {
  readonly tenderId: number;
  readonly plan: EvaluationPlan;
  readonly currency: string;
  readonly onCancel: () => void;
  readonly onSaved: (result: EvaluationPlanMutationResult) => void;
}

export function PlanEditor({ tenderId, plan, currency, onCancel, onSaved }: PlanEditorProps) {
  const mutation = useApiMutation(updateEvaluationPlan);
  const [draft, setDraft] = useState<PlanDraft>(() => draftOfPlan(plan));
  const [submitted, setSubmitted] = useState(false);
  const initial = JSON.stringify(draftOfPlan(plan));
  const dirty = JSON.stringify(draft) !== initial;
  const amending = plan.status !== 'draft';

  const body = planBody(draft, plan.version);
  const localErrors = validatePlan(body);
  const noteMissing = amending && draft.amendmentNote.trim() === '';
  const serverErrors: readonly FieldError[] = mutation.error?.fieldErrors ?? [];
  const errors = serverErrors.length > 0 ? serverErrors : submitted ? localErrors : [];
  const errorAt = (path: string): string | undefined =>
    errors.find((error) => error.field === path)?.message;
  const total = weightsTotal(draft);
  const totalOk = total !== null && eq(total, '100');
  const weightsMessage =
    errors.find((error) => error.code === 'WEIGHTS_TOTAL_NOT_100')?.message ??
    (total !== null && !totalOk ? t('tender-authoring.plan.weightsNot100', { total }) : undefined);
  const known = new Set<string>();

  const set = (patch: Partial<PlanDraft>): void =>
    setDraft((current) => ({ ...current, ...patch }));
  const setCriterion = (index: number, patch: Partial<CriterionDraft>): void =>
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));

  const save = async (): Promise<void> => {
    setSubmitted(true);
    if (localErrors.length > 0 || noteMissing) return;
    try {
      const result = await mutation.mutate({ params: { tenderId, planId: plan.id }, body });
      onSaved(result);
    } catch {
      // Field errors and the business error show below.
    }
  };

  const field = (path: string): string | undefined => {
    known.add(path);
    return errorAt(path);
  };
  const codes = draft.criteria.map((row) => row.code.trim()).filter((code) => code !== '');

  const criteriaRows = draft.criteria.map((row, index) => (
    <fieldset key={row.key} className="tiq-fieldset">
      <legend>
        {t('tender-authoring.plan.criterionN', { n: index + 1 })}
        {row.code === '' ? '' : ` · ${row.code}`}
      </legend>
      <div className="tiq-form-grid">
        <TextField
          label={t('tender-authoring.plan.code')}
          required
          value={row.code}
          onChange={(code) => setCriterion(index, { code: code.toUpperCase() })}
          error={field(`criteria.${index}.code`)}
          maxLength={20}
        />
        <TextField
          label={t('tender-authoring.plan.name')}
          required
          value={row.name}
          onChange={(name) => setCriterion(index, { name })}
          error={field(`criteria.${index}.name`)}
        />
        <Select
          label={t('tender-authoring.plan.parent')}
          placeholder={t('tender-authoring.plan.topLevel')}
          value={row.parentCode}
          options={codes
            .filter((code) => code !== row.code.trim())
            .map((code) => ({ value: code, label: code }))}
          onChange={(parentCode) => setCriterion(index, { parentCode })}
          error={field(`criteria.${index}.parentCode`)}
        />
        <NumberInput
          label={t('tender-authoring.plan.maxPoints')}
          required
          value={row.maxPoints}
          places={2}
          onChange={(maxPoints) => setCriterion(index, { maxPoints })}
          error={field(`criteria.${index}.maxPoints`)}
        />
        <NumberInput
          label={t('tender-authoring.plan.minScore')}
          value={row.minScore}
          places={2}
          onChange={(minScore) => setCriterion(index, { minScore })}
          error={field(`criteria.${index}.minScore`)}
        />
        <Select
          label={t('tender-authoring.plan.envelope')}
          value={row.envelope}
          options={EVALUATION_CRITERIA_ENVELOPE.map((value) => ({
            value,
            label: tEnum('evaluation_criteria.envelope', value),
          }))}
          onChange={(envelope) => setCriterion(index, { envelope })}
          error={field(`criteria.${index}.envelope`)}
        />
      </div>
      <TextArea
        label={t('tender-authoring.plan.guidance')}
        value={row.scoringGuidance}
        onChange={(scoringGuidance) => setCriterion(index, { scoringGuidance })}
        rows={2}
        error={field(`criteria.${index}.scoringGuidance`)}
      />
      <span className="tiq-inline">
        <Checkbox
          label={t('tender-authoring.plan.isPrice')}
          checked={row.isPrice}
          onChange={(isPrice) => setCriterion(index, { isPrice })}
        />
        <Checkbox
          label={t('tender-authoring.plan.naPermitted')}
          checked={row.naPermitted}
          onChange={(naPermitted) => setCriterion(index, { naPermitted })}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="trash"
          onClick={() => set({ criteria: draft.criteria.filter((_, i) => i !== index) })}
        >
          {t('tender-authoring.plan.removeCriterion', { n: index + 1 })}
        </Button>
      </span>
    </fieldset>
  ));

  const settings = (
    <div className="tiq-form-grid">
      <NumberInput
        label={t('tender-authoring.plan.scaleMax')}
        required
        value={draft.scaleMax}
        places={0}
        onChange={(scaleMax) => set({ scaleMax })}
        error={field('scaleMax')}
      />
      <Select
        label={t('tender-authoring.plan.aggregation')}
        value={draft.aggregationMethod}
        options={EVALUATION_PLANS_AGGREGATION_METHOD.map((value) => ({
          value,
          label: tEnum('evaluation_plans.aggregation_method', value),
        }))}
        onChange={(aggregationMethod) => set({ aggregationMethod })}
        hint={t('tender-authoring.plan.aggregationHint')}
        error={field('aggregationMethod')}
      />
      <Select
        label={t('tender-authoring.plan.priceMethod')}
        value={draft.priceMethod}
        options={EVALUATION_PLANS_PRICE_METHOD.map((value) => ({
          value,
          label: tEnum('evaluation_plans.price_method', value),
        }))}
        onChange={(priceMethod) => set({ priceMethod })}
        error={field('priceMethod')}
      />
      <NumberInput
        label={t('tender-authoring.plan.priceWeight')}
        value={draft.priceWeight}
        places={2}
        onChange={(priceWeight) => set({ priceWeight })}
        error={field('priceWeight')}
      />
      <Select
        label={t('tender-authoring.plan.thresholdScope')}
        value={draft.thresholdScope}
        options={EVALUATION_PLANS_THRESHOLD_SCOPE.map((value) => ({
          value,
          label: tEnum('evaluation_plans.threshold_scope', value),
        }))}
        onChange={(thresholdScope) => set({ thresholdScope })}
        error={field('thresholdScope')}
      />
      <NumberInput
        label={t('tender-authoring.plan.threshold')}
        value={draft.nonPriceThreshold}
        places={2}
        onChange={(nonPriceThreshold) => set({ nonPriceThreshold })}
        error={field('nonPriceThreshold')}
      />
      <NumberInput
        label={t('tender-authoring.plan.decimalsCalc')}
        value={draft.decimalPlacesCalc}
        places={0}
        onChange={(decimalPlacesCalc) => set({ decimalPlacesCalc })}
        error={field('decimalPlacesCalc')}
      />
      <NumberInput
        label={t('tender-authoring.plan.decimalsDisplay')}
        value={draft.decimalPlacesDisplay}
        places={0}
        onChange={(decimalPlacesDisplay) => set({ decimalPlacesDisplay })}
        error={field('decimalPlacesDisplay')}
      />
      <TextField
        label={t('tender-authoring.plan.comparisonCurrency')}
        value={draft.comparisonCurrency}
        placeholder={currency}
        maxLength={3}
        onChange={(comparisonCurrency) =>
          set({ comparisonCurrency: comparisonCurrency.toUpperCase() })
        }
        error={field('comparisonCurrency')}
      />
      <TextField
        label={t('tender-authoring.plan.fxSource')}
        value={draft.fxSource}
        onChange={(fxSource) => set({ fxSource })}
        error={field('fxSource')}
      />
      <DateInput
        label={t('tender-authoring.plan.fxDate')}
        value={draft.fxDate}
        onChange={(fxDate) => set({ fxDate })}
        error={field('fxDate')}
      />
      <TextArea
        label={t('tender-authoring.plan.formula')}
        value={draft.priceFormulaNote}
        onChange={(priceFormulaNote) => set({ priceFormulaNote })}
        rows={2}
        error={field('priceFormulaNote')}
        fieldClassName="tiq-form-full"
      />
      <TextArea
        label={t('tender-authoring.plan.zeroPrice')}
        value={draft.zeroPriceTreatment}
        onChange={(zeroPriceTreatment) => set({ zeroPriceTreatment })}
        rows={2}
        error={field('zeroPriceTreatment')}
        fieldClassName="tiq-form-full"
      />
      <TextArea
        label={t('tender-authoring.plan.missingPrice')}
        value={draft.missingPriceTreatment}
        onChange={(missingPriceTreatment) => set({ missingPriceTreatment })}
        rows={2}
        error={field('missingPriceTreatment')}
        fieldClassName="tiq-form-full"
      />
    </div>
  );

  const anchors = draft.anchors.map((anchor, index) => (
    <div key={anchor.key} className="tiq-form-grid">
      <NumberInput
        label={t('tender-authoring.plan.anchorValue')}
        value={anchor.value}
        places={0}
        onChange={(value) =>
          set({ anchors: draft.anchors.map((row, i) => (i === index ? { ...row, value } : row)) })
        }
        error={field(`anchors.${index}.value`)}
      />
      <TextField
        label={t('tender-authoring.plan.anchorLabel')}
        value={anchor.label}
        onChange={(label) =>
          set({ anchors: draft.anchors.map((row, i) => (i === index ? { ...row, label } : row)) })
        }
        error={field(`anchors.${index}.label`)}
      />
      <TextField
        label={t('tender-authoring.plan.anchorDescription')}
        value={anchor.description}
        onChange={(description) =>
          set({
            anchors: draft.anchors.map((row, i) => (i === index ? { ...row, description } : row)),
          })
        }
        error={field(`anchors.${index}.description`)}
      />
      <IconButton
        icon="trash"
        label={t('tender-authoring.plan.removeAnchor', { value: anchor.value })}
        onClick={() => set({ anchors: draft.anchors.filter((_, i) => i !== index) })}
      />
    </div>
  ));

  const tieRules = draft.tieBreakRules.map((rule, index) => (
    <div key={rule.key} className="tiq-form-grid">
      <Select
        label={t('tender-authoring.plan.tieRuleN', { n: index + 1 })}
        value={rule.rule}
        options={TIE_BREAK_RULES_RULE.map((value) => ({
          value,
          label: tEnum('tie_break_rules.rule', value),
        }))}
        onChange={(value) =>
          set({
            tieBreakRules: draft.tieBreakRules.map((row, i) =>
              i === index ? { ...row, rule: value } : row,
            ),
          })
        }
        error={field(`tieBreakRules.${index}.rule`) ?? field(`tieBreakRules.${index}.sequence`)}
      />
      <Select
        label={t('tender-authoring.plan.tieCriterion')}
        placeholder={t('tender-authoring.common.none')}
        value={rule.criterionCode}
        options={codes.map((code) => ({ value: code, label: code }))}
        onChange={(criterionCode) =>
          set({
            tieBreakRules: draft.tieBreakRules.map((row, i) =>
              i === index ? { ...row, criterionCode } : row,
            ),
          })
        }
        error={field(`tieBreakRules.${index}.criterionCode`)}
      />
      <span className="tiq-inline">
        <IconButton
          icon="arrowUp"
          label={t('tender-authoring.plan.moveUp', { n: index + 1 })}
          disabled={index === 0}
          onClick={() => {
            const rows = [...draft.tieBreakRules];
            const [moved] = rows.splice(index, 1);
            if (moved !== undefined) rows.splice(index - 1, 0, moved);
            set({ tieBreakRules: rows });
          }}
        />
        <IconButton
          icon="trash"
          label={t('tender-authoring.plan.removeTieRule', { n: index + 1 })}
          onClick={() => set({ tieBreakRules: draft.tieBreakRules.filter((_, i) => i !== index) })}
        />
      </span>
    </div>
  ));

  // Registered after the inputs so the summary lists only errors without an input.
  field('criteria');
  known.add('amendmentNote');
  const unmatched = errors.filter(
    (error) => !known.has(error.field) && error.code !== 'WEIGHTS_TOTAL_NOT_100',
  );

  return (
    <div className="tiq-stack" data-testid="plan-editor">
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      {amending && (
        <Banner tone="warning" title={t('tender-authoring.plan.amendingTitle')}>
          <p>{t('tender-authoring.plan.amending')}</p>
        </Banner>
      )}
      <Card title={t('tender-authoring.plan.settings')}>{settings}</Card>
      <Card
        title={t('tender-authoring.plan.criteria')}
        subtitle={
          <span className="tiq-inline" aria-live="polite">
            <Chip
              tone={totalOk ? 'success' : 'danger'}
              size="sm"
              icon={totalOk ? 'checkCircle' : 'xCircle'}
            >
              {t('tender-authoring.plan.total', { total: total ?? '—' })}
            </Chip>
            {weightsMessage !== undefined && (
              <span className="tiq-text-danger">{weightsMessage}</span>
            )}
          </span>
        }
        actions={
          <Button
            size="sm"
            icon="plus"
            onClick={() => set({ criteria: [...draft.criteria, emptyCriterion()] })}
          >
            {t('tender-authoring.plan.addCriterion')}
          </Button>
        }
      >
        <div className="tiq-stack">{criteriaRows}</div>
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card
          title={t('tender-authoring.plan.anchors')}
          actions={
            <Button
              size="sm"
              icon="plus"
              onClick={() =>
                set({
                  anchors: [
                    ...draft.anchors,
                    {
                      key: rowKey('a'),
                      value: String(draft.anchors.length),
                      label: '',
                      description: '',
                    },
                  ],
                })
              }
            >
              {t('tender-authoring.plan.addAnchor')}
            </Button>
          }
        >
          <div className="tiq-stack">{anchors}</div>
        </Card>
        <Card
          title={t('tender-authoring.plan.tieRules')}
          actions={
            <Button
              size="sm"
              icon="plus"
              onClick={() =>
                set({
                  tieBreakRules: [
                    ...draft.tieBreakRules,
                    { key: rowKey('t'), rule: 'highest_non_price', criterionCode: '' },
                  ],
                })
              }
            >
              {t('tender-authoring.plan.addTieRule')}
            </Button>
          }
        >
          <div className="tiq-stack">{tieRules}</div>
        </Card>
      </div>
      {amending && (
        <TextArea
          label={t('tender-authoring.plan.amendmentNote')}
          required
          value={draft.amendmentNote}
          onChange={(amendmentNote) => set({ amendmentNote })}
          rows={2}
          error={
            errorAt('amendmentNote') ??
            (submitted && noteMissing ? t('tender-authoring.plan.amendmentRequired') : undefined)
          }
        />
      )}
      {unmatched.length > 0 && (
        <FormErrorSummary title={t('tender-authoring.plan.fixErrors')} errors={unmatched} />
      )}
      {mutation.error !== null && mutation.error.fieldErrors.length === 0 && (
        <Banner tone="error" title={mutation.error.title}>
          <p>{tenderErrorMessage(mutation.error)}</p>
        </Banner>
      )}
      <div className="tiq-inline">
        <Button
          variant="primary"
          icon="check"
          loading={mutation.pending}
          onClick={() => void save()}
        >
          {amending
            ? t('tender-authoring.plan.saveAmendment')
            : t('tender-authoring.common.saveDraft')}
        </Button>
        <Button onClick={onCancel} disabled={mutation.pending}>
          {t('ui.action.cancel')}
        </Button>
      </div>
    </div>
  );
}
