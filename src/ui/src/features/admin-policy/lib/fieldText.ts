/**
 * Display texts of custom field requirement rules (ADM-07): condition sources and values in business words.
 */
import { VALUE_BANDS } from '@contracts/policy';
import type { CustomFieldDefinition } from '@contracts/policy';

import { hasTranslation, t, tEnum } from '../../../lib/i18n';

/** Human label of a condition source: a core field of the form or another custom field. */
export function conditionSourceLabel(
  source: string,
  fields: readonly Pick<CustomFieldDefinition, 'key' | 'label'>[],
): string {
  const coreKey = `admin-policy.core.${source}`;
  const field = fields.find((candidate) => candidate.key === source);
  if (field !== undefined) return field.label;
  return hasTranslation(coreKey) ? t(coreKey) : source;
}

/** Human label of a condition value (value bands and booleans are translated). */
export function conditionValueLabel(source: string, value: string | null): string {
  if (value === null) return '';
  if (source === 'value_band' && (VALUE_BANDS as readonly string[]).includes(value)) {
    return t(`admin-policy.valueBand.${value}`);
  }
  if (value === 'true') return t('admin-policy.common.yes');
  if (value === 'false') return t('admin-policy.common.no');
  return value;
}

/** "Required when Category is ICT-SCADA." for a conditional field, otherwise null. */
export function requirementText(
  field: Pick<
    CustomFieldDefinition,
    'requiredMode' | 'requiredConditionField' | 'requiredConditionValue'
  >,
  fields: readonly Pick<CustomFieldDefinition, 'key' | 'label'>[],
): string {
  if (field.requiredMode !== 'conditional' || field.requiredConditionField === null) {
    return tEnum('custom_fields.required_mode', field.requiredMode);
  }
  return t('admin-policy.fields.conditionText', {
    source: conditionSourceLabel(field.requiredConditionField, fields),
    value: conditionValueLabel(field.requiredConditionField, field.requiredConditionValue),
  });
}
