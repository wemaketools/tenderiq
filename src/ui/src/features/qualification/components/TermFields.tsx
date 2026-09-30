/**
 * Form fields shared by the recommendation (BUY-34), the decision and the superseding decision (BUY-35): the
 * approved scope (category, value limit, geography) and the conditions of a conditional or suspended outcome, which
 * must state the conditions, the activities that stay allowed and the future gate that stays blocked (PRD §7.3).
 */
import type { CategoryRef } from '@contracts/qualification';
import { QUALIFICATION_DECISIONS_BLOCKED_GATE } from '@contracts/enums';
import type { QualificationDecisionsBlockedGate } from '@contracts/enums';

import { MoneyInput, Select, TextArea, TextField } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import type { ErrorLookup } from '../lib/validation';
import { categoryLabel } from '../lib/text';

export interface ScopeValue {
  readonly categoryId: string;
  readonly maxValue: { readonly amount: string; readonly currency: string };
  readonly geography: string;
}

export function ScopeFields({
  value,
  onChange,
  categories,
  currencies,
  errors,
}: {
  readonly value: ScopeValue;
  readonly onChange: (next: ScopeValue) => void;
  readonly categories: readonly CategoryRef[];
  readonly currencies: readonly string[];
  readonly errors: ErrorLookup;
}) {
  return (
    <>
      <Select
        label={t('qualification.terms.category')}
        required
        placeholder={t('qualification.common.select')}
        value={value.categoryId}
        onChange={(categoryId) => onChange({ ...value, categoryId })}
        error={errors.forField('scopeCategoryId')}
        options={categories.map((category) => ({
          value: String(category.categoryId),
          label: categoryLabel(category),
        }))}
      />
      <MoneyInput
        label={t('qualification.terms.maxValue')}
        hint={t('qualification.terms.maxValueHint')}
        value={value.maxValue}
        currencies={currencies}
        onChange={(maxValue) => onChange({ ...value, maxValue })}
        error={errors.forField('scopeMaxValue')}
      />
      <TextField
        label={t('qualification.terms.geography')}
        value={value.geography}
        onChange={(geography) => onChange({ ...value, geography })}
        error={errors.forField('scopeGeography')}
        fieldClassName="tiq-form-full"
      />
    </>
  );
}

export interface ConditionValue {
  readonly conditions: string;
  readonly allowedActivities: string;
  readonly blockedGate: QualificationDecisionsBlockedGate;
}

export function ConditionFields({
  value,
  onChange,
  required,
  errors,
}: {
  readonly value: ConditionValue;
  readonly onChange: (next: ConditionValue) => void;
  /** True for a conditional or suspended outcome. */
  readonly required: boolean;
  readonly errors: ErrorLookup;
}) {
  return (
    <>
      <TextArea
        label={t('qualification.terms.conditions')}
        hint={t('qualification.terms.conditionsHint')}
        required={required}
        rows={3}
        value={value.conditions}
        onChange={(conditions) => onChange({ ...value, conditions })}
        error={errors.forField('conditions')}
        fieldClassName="tiq-form-full"
      />
      <TextArea
        label={t('qualification.terms.allowedActivities')}
        hint={t('qualification.terms.allowedActivitiesHint')}
        required={required}
        rows={2}
        value={value.allowedActivities}
        onChange={(allowedActivities) => onChange({ ...value, allowedActivities })}
        error={errors.forField('allowedActivities')}
        fieldClassName="tiq-form-full"
      />
      <Select
        label={t('qualification.terms.blockedGate')}
        hint={t('qualification.terms.blockedGateHint')}
        required={required}
        value={value.blockedGate}
        onChange={(blockedGate) =>
          onChange({ ...value, blockedGate: blockedGate as QualificationDecisionsBlockedGate })
        }
        error={errors.forField('blockedGate')}
        options={QUALIFICATION_DECISIONS_BLOCKED_GATE.map((gate) => ({
          value: gate,
          label: tEnum('qualification_decisions.blocked_gate', gate),
        }))}
      />
    </>
  );
}
