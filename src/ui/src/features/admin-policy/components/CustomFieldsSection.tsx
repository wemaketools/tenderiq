/**
 * CustomFieldsSection (ADM-07, PRD §17.3): renders the organization's additional business fields of one form —
 * the procurement request, tender, qualification application or contract form — and evaluates their required and
 * conditionally required rules with the contract's pure helpers (`isCustomFieldRequired`,
 * `validateCustomFieldValues`), exactly as the mock API and Stage B do.
 *
 * Embedding (request, tender, qualification and contract forms):
 *
 * ```tsx
 * const [custom, setCustom] = useState<CustomFieldValues>({});
 * const [customIssues, setCustomIssues] = useState<readonly CustomFieldIssue[]>([]);
 * <CustomFieldsSection
 *   entityType="tender"
 *   values={custom}
 *   onChange={setCustom}
 *   context={{ category_code: form.categoryCode, procedure: form.procedure, value_band: valueBandOf(amount) }}
 *   showErrors={submitAttempted}
 *   serverErrors={saveError?.fieldErrors}
 *   onValidationChange={setCustomIssues}
 * />
 * // block submission while customIssues.length > 0
 * ```
 *
 * Suppliers pass `source={{ audience: 'supplier', buyerSlug }}`: only supplier-visible and public fields of that
 * buyer are returned. Without `onChange` (or with `readOnly`) the values are shown read-only.
 */
import { useEffect, useMemo } from 'react';

import type { FieldError } from '@contracts/common';
import type { CustomFieldsEntityType } from '@contracts/enums';
import {
  SUPPLIER_FORM_ENTITY_TYPES,
  getCustomFieldForm,
  getSupplierCustomFieldForm,
  isCustomFieldRequired,
  validateCustomFieldValues,
} from '@contracts/policy';
import type {
  CustomFieldContext,
  CustomFieldDefinition,
  CustomFieldForm,
  CustomFieldIssue,
  CustomFieldValue,
  CustomFieldValues,
} from '@contracts/policy';

import { useApiQuery } from '../../../api/hooks';
import {
  DateInput,
  DetailList,
  ErrorState,
  NumberInput,
  RadioGroup,
  Select,
  SkeletonBlock,
  TextField,
} from '../../../components/ui';
import { formatCalendarDate, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { requirementText } from '../lib/fieldText';

export type CustomFieldsSource =
  { readonly audience: 'buyer' } | { readonly audience: 'supplier'; readonly buyerSlug: string };

export interface CustomFieldsSectionProps {
  readonly entityType: CustomFieldsEntityType;
  readonly values: Readonly<CustomFieldValues>;
  /** Omit for a read-only display. */
  readonly onChange?: (values: CustomFieldValues) => void;
  /** Core values of the host form that conditions may read (category, procedure, value band…). */
  readonly context?: CustomFieldContext;
  readonly source?: CustomFieldsSource;
  /** Show the validation messages (usually after the first submit attempt). */
  readonly showErrors?: boolean;
  /** problem+json field errors of the host's save; `customFields.<key>` or `<key>` bind to a field. */
  readonly serverErrors?: readonly FieldError[];
  readonly readOnly?: boolean;
  readonly title?: string;
  /** Called whenever the validation result changes (the host blocks submission while issues remain). */
  readonly onValidationChange?: (issues: readonly CustomFieldIssue[]) => void;
  /** A definition the host already holds (for example the ADM-07 preview); skips the request. */
  readonly form?: CustomFieldForm;
}

const NO_ISSUES: readonly CustomFieldIssue[] = [];

function isSupplierEntity(
  entityType: CustomFieldsEntityType,
): entityType is (typeof SUPPLIER_FORM_ENTITY_TYPES)[number] {
  return (SUPPLIER_FORM_ENTITY_TYPES as readonly string[]).includes(entityType);
}

function displayValue(field: CustomFieldDefinition, value: CustomFieldValue | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'boolean')
    return value ? t('admin-policy.common.yes') : t('admin-policy.common.no');
  if (field.fieldType === 'number') return formatDecimalString(value);
  if (field.fieldType === 'date') return formatCalendarDate(value);
  return value;
}

function textOf(value: CustomFieldValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}

export function CustomFieldsSection({
  entityType,
  values,
  onChange,
  context,
  source = { audience: 'buyer' },
  showErrors = false,
  serverErrors,
  readOnly = false,
  title,
  onValidationChange,
  form: givenForm,
}: CustomFieldsSectionProps) {
  const supplierSlug = source.audience === 'supplier' ? source.buyerSlug : null;
  const supplierAllowed = isSupplierEntity(entityType);
  const buyerQuery = useApiQuery(
    getCustomFieldForm,
    givenForm === undefined && supplierSlug === null ? { params: { entityType } } : null,
  );
  const supplierQuery = useApiQuery(
    getSupplierCustomFieldForm,
    givenForm === undefined && supplierSlug !== null && isSupplierEntity(entityType)
      ? { params: { buyerSlug: supplierSlug, entityType } }
      : null,
  );
  const query = supplierSlug === null ? buyerQuery : supplierQuery;
  const form = givenForm ?? query.data;
  const fields = useMemo(
    () => [...(form?.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [form],
  );

  const issues = useMemo(
    () =>
      form === undefined ? NO_ISSUES : validateCustomFieldValues(fields, values, context ?? {}),
    [form, fields, values, context],
  );
  const issueSignature = issues.map((issue) => `${issue.key}:${issue.code}`).join('|');

  useEffect(() => {
    onValidationChange?.(issues);
    // Report only when the set of issues changes, not on every render of the host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueSignature]);

  if (supplierSlug !== null && !supplierAllowed) {
    return null;
  }
  if (form === undefined) {
    if (query.status === 'error' && query.error !== null) {
      return (
        <ErrorState
          error={query.error}
          onRetry={query.reload}
          title={t('admin-policy.section.loadError')}
        />
      );
    }
    return <SkeletonBlock lines={2} label={t('admin-policy.section.loading')} />;
  }
  if (fields.length === 0) {
    return null;
  }

  const legend = title ?? t('admin-policy.section.title');
  const editable = onChange !== undefined && !readOnly;

  if (!editable) {
    return (
      <fieldset className="tiq-fieldset">
        <legend>{legend}</legend>
        <DetailList
          items={fields.map((field) => ({
            key: field.key,
            label: field.label,
            value: displayValue(field, values[field.key]),
          }))}
        />
      </fieldset>
    );
  }

  const errorFor = (key: string): string | undefined => {
    const server = serverErrors?.find(
      (item) => item.field === key || item.field === `customFields.${key}`,
    );
    if (server !== undefined) return server.message;
    if (!showErrors) return undefined;
    return issues.find((issue) => issue.key === key)?.message;
  };

  const set = (key: string, value: CustomFieldValue): void => {
    onChange({ ...values, [key]: value });
  };

  return (
    <fieldset className="tiq-fieldset">
      <legend>{legend}</legend>
      <div className="tiq-form-grid">
        {fields.map((field) => {
          const required = isCustomFieldRequired(field, values, context ?? {});
          const hintParts = [field.purpose];
          if (field.requiredMode === 'conditional') {
            hintParts.push(requirementText(field, fields));
          }
          if (source.audience === 'buyer') {
            hintParts.push(tEnum('custom_fields.audience', field.audience));
          }
          const common = {
            label: field.label,
            hint: hintParts.join(' · '),
            required,
            error: errorFor(field.key),
          };
          const value = values[field.key];
          switch (field.fieldType) {
            case 'number':
              return (
                <NumberInput
                  key={field.key}
                  {...common}
                  value={textOf(value)}
                  places={4}
                  allowNegative
                  onChange={(next) => set(field.key, next === '' ? null : next)}
                />
              );
            case 'date':
              return (
                <DateInput
                  key={field.key}
                  {...common}
                  value={textOf(value)}
                  onChange={(next) => set(field.key, next === '' ? null : next)}
                />
              );
            case 'boolean':
              return (
                <RadioGroup
                  key={field.key}
                  {...common}
                  inline
                  value={textOf(value)}
                  options={[
                    { value: 'true', label: t('admin-policy.common.yes') },
                    { value: 'false', label: t('admin-policy.common.no') },
                  ]}
                  onChange={(next) => set(field.key, next === 'true')}
                />
              );
            case 'choice':
              return (
                <Select
                  key={field.key}
                  {...common}
                  value={textOf(value)}
                  placeholder={t('admin-policy.common.choose')}
                  options={field.allowedValues.map((choice) => ({ value: choice, label: choice }))}
                  onChange={(next) => set(field.key, next === '' ? null : next)}
                />
              );
            case 'text':
              return (
                <TextField
                  key={field.key}
                  {...common}
                  value={textOf(value)}
                  maxLength={4000}
                  onChange={(next) => set(field.key, next === '' ? null : next)}
                />
              );
          }
          return null;
        })}
      </div>
    </fieldset>
  );
}
