/**
 * The editor of one additional business field (ADM-07): label, purpose, form, type, allowed values, required
 * status (optional, required, or required when another field or a core value of the form holds a value), audience
 * and reporting. Once issued records carry the field, its key, type and existing choices are locked and its
 * audience can only be narrowed (the form says so and disables the wider audiences), so issued forms are never
 * rewritten silently and captured values are never disclosed more widely (PRD §4.3, §18.1).
 */
import {
  CUSTOM_FIELDS_AUDIENCE,
  CUSTOM_FIELDS_ENTITY_TYPE,
  CUSTOM_FIELDS_FIELD_TYPE,
  CUSTOM_FIELDS_REQUIRED_MODE,
  TENDERS_PROCEDURE_WRITE,
} from '@contracts/enums';
import type { CustomFieldsAudience, CustomFieldsEntityType } from '@contracts/enums';
import {
  CUSTOM_FIELD_CORE_CONDITIONS,
  VALUE_BANDS,
  listCustomFields,
  widensAudience,
} from '@contracts/policy';
import type { CustomFieldSummary } from '@contracts/policy';

import { useApiQuery } from '../../../api/hooks';
import { Banner, Checkbox, RadioGroup, Select, TextArea, TextField } from '../../../components/ui';
import type { SelectOption } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import type { FieldDraft } from '../lib/fieldDraft';
import type { ErrorLookup } from '../lib/validation';

function isEntityType(value: string): value is CustomFieldsEntityType {
  return (CUSTOM_FIELDS_ENTITY_TYPE as readonly string[]).includes(value);
}

export interface FieldDefinitionFormProps {
  readonly mode: 'create' | 'edit';
  readonly value: FieldDraft;
  readonly onChange: (value: FieldDraft) => void;
  readonly errors: ErrorLookup;
  /** Key, type and existing choices are locked by issued records. */
  readonly structureLocked?: boolean;
  /** The audience the issued records were captured under; wider audiences are disabled while locked. */
  readonly issuedAudience?: CustomFieldsAudience;
  /** The id of the edited field (excluded from condition sources). */
  readonly fieldId?: number;
}

export function FieldDefinitionForm({
  mode,
  value,
  onChange,
  errors,
  structureLocked = false,
  issuedAudience,
  fieldId,
}: FieldDefinitionFormProps) {
  const audienceLocked = structureLocked && issuedAudience !== undefined;
  const set = (patch: Partial<FieldDraft>): void => onChange({ ...value, ...patch });
  const entityType = isEntityType(value.entityType) ? value.entityType : null;
  const siblings = useApiQuery(
    listCustomFields,
    entityType === null
      ? null
      : { query: { entityType: [entityType], active: true, pageSize: 100 } },
  );
  const otherFields: readonly CustomFieldSummary[] = (siblings.data?.items ?? []).filter(
    (field) => field.id !== fieldId,
  );
  const coreSources: readonly string[] =
    entityType === null ? [] : CUSTOM_FIELD_CORE_CONDITIONS[entityType];
  const sourceOptions: SelectOption[] = [
    ...coreSources.map((source) => ({
      value: source,
      label: t('admin-policy.fieldForm.coreSource', { name: t(`admin-policy.core.${source}`) }),
    })),
    ...otherFields.map((field) => ({
      value: field.key,
      label: t('admin-policy.fieldForm.fieldSource', { name: field.label }),
    })),
  ];
  const source = value.requiredConditionField;
  const sourceField = otherFields.find((field) => field.key === source);
  let valueOptions: SelectOption[] | null = null;
  if (source === 'value_band') {
    valueOptions = VALUE_BANDS.map((band) => ({
      value: band,
      label: t(`admin-policy.valueBand.${band}`),
    }));
  } else if (source === 'procedure') {
    valueOptions = TENDERS_PROCEDURE_WRITE.map((procedure) => ({
      value: procedure,
      label: tEnum('tenders.procedure', procedure),
    }));
  } else if (sourceField?.fieldType === 'choice') {
    valueOptions = sourceField.allowedValues.map((choice) => ({ value: choice, label: choice }));
  } else if (sourceField?.fieldType === 'boolean') {
    valueOptions = [
      { value: 'true', label: t('admin-policy.common.yes') },
      { value: 'false', label: t('admin-policy.common.no') },
    ];
  }

  return (
    <div className="tiq-form-stack">
      {structureLocked && (
        <Banner tone="info" title={t('admin-policy.fieldForm.lockedTitle')}>
          <p>{t('admin-policy.fieldForm.locked')}</p>
        </Banner>
      )}
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.fieldForm.identity')}</legend>
        <div className="tiq-form-grid">
          <Select
            label={t('admin-policy.fieldForm.form')}
            required
            disabled={mode === 'edit'}
            placeholder={t('admin-policy.common.choose')}
            value={value.entityType}
            options={CUSTOM_FIELDS_ENTITY_TYPE.map((option) => ({
              value: option,
              label: tEnum('custom_fields.entity_type', option),
            }))}
            onChange={(entityType) =>
              set({ entityType, requiredConditionField: '', requiredConditionValue: '' })
            }
            error={errors.forField('entityType')}
          />
          <TextField
            label={t('admin-policy.fieldForm.key')}
            hint={t('admin-policy.fieldForm.keyHint')}
            required
            disabled={mode === 'edit'}
            className="tiq-mono"
            value={value.key}
            onChange={(key) => set({ key: key.toLowerCase() })}
            error={errors.forField('key')}
          />
          <TextField
            label={t('admin-policy.fieldForm.label')}
            required
            value={value.label}
            onChange={(label) => set({ label })}
            error={errors.forField('label')}
          />
          <Select
            label={t('admin-policy.fieldForm.type')}
            required
            disabled={structureLocked}
            value={value.fieldType}
            options={CUSTOM_FIELDS_FIELD_TYPE.map((option) => ({
              value: option,
              label: tEnum('custom_fields.field_type', option),
            }))}
            onChange={(fieldType) => set({ fieldType })}
            error={errors.forField('fieldType')}
          />
          <TextArea
            label={t('admin-policy.fieldForm.purpose')}
            hint={t('admin-policy.fieldForm.purposeHint')}
            required
            rows={2}
            value={value.purpose}
            onChange={(purpose) => set({ purpose })}
            error={errors.forField('purpose')}
            fieldClassName="tiq-form-full"
          />
          {value.fieldType === 'choice' && (
            <TextArea
              label={t('admin-policy.fieldForm.choices')}
              hint={
                structureLocked
                  ? t('admin-policy.fieldForm.choicesLockedHint')
                  : t('admin-policy.fieldForm.choicesHint')
              }
              required
              rows={4}
              value={value.allowedValues}
              onChange={(allowedValues) => set({ allowedValues })}
              error={errors.forField('allowedValues')}
              fieldClassName="tiq-form-full"
            />
          )}
        </div>
      </fieldset>
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.fieldForm.requirement')}</legend>
        <div className="tiq-form-grid">
          <RadioGroup
            label={t('admin-policy.fieldForm.requiredMode')}
            value={value.requiredMode}
            options={CUSTOM_FIELDS_REQUIRED_MODE.map((option) => ({
              value: option,
              label: tEnum('custom_fields.required_mode', option),
              hint: t(`admin-policy.fieldForm.mode.${option}`),
            }))}
            onChange={(requiredMode) =>
              set(
                requiredMode === 'conditional'
                  ? { requiredMode }
                  : { requiredMode, requiredConditionField: '', requiredConditionValue: '' },
              )
            }
            error={errors.forField('requiredMode')}
            fieldClassName="tiq-form-full"
          />
          {value.requiredMode === 'conditional' && (
            <>
              <Select
                label={t('admin-policy.fieldForm.conditionField')}
                required
                placeholder={t('admin-policy.common.choose')}
                value={value.requiredConditionField}
                options={sourceOptions}
                onChange={(requiredConditionField) =>
                  set({ requiredConditionField, requiredConditionValue: '' })
                }
                error={errors.forField('requiredConditionField')}
              />
              {valueOptions === null ? (
                <TextField
                  label={t('admin-policy.fieldForm.conditionValue')}
                  required
                  value={value.requiredConditionValue}
                  onChange={(requiredConditionValue) => set({ requiredConditionValue })}
                  error={errors.forField('requiredConditionValue')}
                />
              ) : (
                <Select
                  label={t('admin-policy.fieldForm.conditionValue')}
                  required
                  placeholder={t('admin-policy.common.choose')}
                  value={value.requiredConditionValue}
                  options={valueOptions}
                  onChange={(requiredConditionValue) => set({ requiredConditionValue })}
                  error={errors.forField('requiredConditionValue')}
                />
              )}
            </>
          )}
        </div>
      </fieldset>
      <fieldset className="tiq-fieldset">
        <legend>{t('admin-policy.fieldForm.audienceTitle')}</legend>
        <div className="tiq-form-grid">
          <RadioGroup
            label={t('admin-policy.fieldForm.audience')}
            value={value.audience}
            hint={audienceLocked ? t('admin-policy.fieldForm.audienceLocked') : undefined}
            options={CUSTOM_FIELDS_AUDIENCE.map((option) => ({
              value: option,
              label: tEnum('custom_fields.audience', option),
              hint: t(`admin-policy.fieldForm.audienceHint.${option}`),
              disabled: audienceLocked && widensAudience(issuedAudience, option),
            }))}
            onChange={(audience) => set({ audience })}
            error={errors.forField('audience')}
          />
          <Checkbox
            label={t('admin-policy.fieldForm.reports')}
            hint={t('admin-policy.fieldForm.reportsHint')}
            checked={value.includeInReports}
            onChange={(includeInReports) => set({ includeInReports })}
          />
        </div>
      </fieldset>
      {mode === 'edit' && (
        <TextArea
          label={t('admin-policy.fieldForm.changeNote')}
          hint={t('admin-policy.fieldForm.changeNoteHint')}
          required
          rows={2}
          value={value.changeNote}
          onChange={(changeNote) => set({ changeNote })}
          error={errors.forField('changeNote')}
        />
      )}
    </div>
  );
}
