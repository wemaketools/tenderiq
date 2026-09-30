/**
 * The decision form of BUY-35, shared by "record the decision" (qualified, qualified with conditions, not
 * qualified) and "supersede" (suspend, reinstate, withdraw, confirm conditions met, reassess). A decision states the
 * outcome, approved scope and limits, effective dates, reassessment date, conditions with allowed activities and the
 * blocked gate, internal reasons, the supplier explanation and the appeal route. `expired` is never written: it is
 * derived from the dates (DD-20).
 */
import type { CategoryRef } from '@contracts/qualification';
import type { QualificationDecisionsOutcome } from '@contracts/enums';

import {
  Checkbox,
  DateInput,
  RadioGroup,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import type { DecisionDraft } from '../lib/decisionDraft';
import type { ErrorLookup } from '../lib/validation';
import { ConditionFields, ScopeFields } from './TermFields';

export function DecisionFormFields({
  draft,
  onChange,
  outcomes,
  categories,
  currencies,
  errors,
  dirty,
}: {
  readonly draft: DecisionDraft;
  readonly onChange: (next: DecisionDraft) => void;
  readonly outcomes: readonly QualificationDecisionsOutcome[];
  readonly categories: readonly CategoryRef[];
  readonly currencies: readonly string[];
  readonly errors: ErrorLookup;
  readonly dirty: boolean;
}) {
  const conditional =
    draft.outcome === 'qualified_with_conditions' || draft.outcome === 'suspended';
  return (
    <div className="tiq-form-grid">
      <UnsavedChangesGuard when={dirty} />
      <div className="tiq-form-full">
        <RadioGroup
          label={t('qualification.terms.outcome')}
          required
          inline
          value={draft.outcome}
          onChange={(outcome) =>
            onChange({ ...draft, outcome: outcome as QualificationDecisionsOutcome })
          }
          error={errors.forField('outcome')}
          options={outcomes.map((value) => ({
            value,
            label: tEnum('qualification_decisions.outcome', value),
          }))}
        />
      </div>
      <ScopeFields
        value={draft.scope}
        onChange={(scope) => onChange({ ...draft, scope })}
        categories={categories}
        currencies={currencies}
        errors={errors}
      />
      <DateInput
        label={t('qualification.terms.effectiveFrom')}
        required
        value={draft.effectiveFrom}
        onChange={(effectiveFrom) => onChange({ ...draft, effectiveFrom })}
        error={errors.forField('effectiveFrom')}
      />
      <DateInput
        label={t('qualification.terms.effectiveTo')}
        hint={t('qualification.terms.effectiveToHint')}
        value={draft.effectiveTo}
        min={draft.effectiveFrom === '' ? undefined : draft.effectiveFrom}
        onChange={(effectiveTo) => onChange({ ...draft, effectiveTo })}
        error={errors.forField('effectiveTo')}
      />
      <DateInput
        label={t('qualification.terms.reassessmentDate')}
        value={draft.reassessmentDate}
        min={draft.effectiveFrom === '' ? undefined : draft.effectiveFrom}
        onChange={(reassessmentDate) => onChange({ ...draft, reassessmentDate })}
        error={errors.forField('reassessmentDate')}
      />
      <ConditionFields
        value={draft.terms}
        onChange={(terms) => onChange({ ...draft, terms })}
        required={conditional}
        errors={errors}
      />
      <TextArea
        label={t('qualification.terms.reasons')}
        hint={t('qualification.terms.reasonsHint')}
        required
        rows={3}
        value={draft.reasons}
        onChange={(reasons) => onChange({ ...draft, reasons })}
        error={errors.forField('reasons')}
        fieldClassName="tiq-form-full"
      />
      <TextArea
        label={t('qualification.terms.supplierExplanation')}
        hint={t('qualification.terms.supplierExplanationHint')}
        required
        rows={3}
        value={draft.supplierExplanation}
        onChange={(supplierExplanation) => onChange({ ...draft, supplierExplanation })}
        error={errors.forField('supplierExplanation')}
        fieldClassName="tiq-form-full"
      />
      <TextArea
        label={t('qualification.terms.appealRoute')}
        rows={2}
        value={draft.appealRoute}
        onChange={(appealRoute) => onChange({ ...draft, appealRoute })}
        error={errors.forField('appealRoute')}
        fieldClassName="tiq-form-full"
      />
      <div className="tiq-form-full">
        <Checkbox
          label={t('qualification.terms.notifySupplier')}
          hint={t('qualification.terms.notifySupplierHint')}
          checked={draft.notifySupplier}
          onChange={(notifySupplier) => onChange({ ...draft, notifySupplier })}
        />
      </div>
    </div>
  );
}
