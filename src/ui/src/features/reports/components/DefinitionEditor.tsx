/**
 * REP-02 — Report definition editor: business fields, filters and reporting period, currency basis, audience,
 * recipients and scheduled delivery, with a PREVIEW of the scope, redactions, omissions and recipient authorization
 * that must be reviewed before the definition is saved and shared (PRD §13.4, §15.2, DD-19).
 */
import { useState } from 'react';

import { REPORT_DEFINITIONS_FAMILY, TENDERS_EVENT_TYPE, TENDERS_STATUS } from '@contracts/enums';
import type { TendersEventType, TendersStatus } from '@contracts/enums';
import {
  REPORT_AUDIENCE_PERMISSIONS,
  REPORT_LEVEL_FILTERS,
  reportingEndpoints,
} from '@contracts/reporting';
import type { ReportDefinition, ReportFamilySummary, ReportPreview } from '@contracts/reporting';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  DateInput,
  FormErrorSummary,
  MultiSelect,
  Select,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { bodyOf, validateForm } from '../lib/definitions';
import type { DefinitionForm } from '../lib/definitions';
import type { DimensionOptions } from '../lib/dimensions';
import { businessErrorMessage } from '../lib/errors';
import { DefinitionPreviewPanel } from './DefinitionPreviewPanel';

/** Business error codes that belong to one field of the form. */
const CODE_FIELD: Readonly<Record<string, string>> = {
  DUPLICATE_REPORT_NAME: 'name',
  FIELD_NOT_IN_FAMILY: 'fields',
  RECIPIENT_NOT_AUTHORIZED: 'recipientUserIds',
  SCHEDULE_REQUIRES_RECIPIENTS: 'recipientUserIds',
  CURRENCY_BASIS_UNAVAILABLE: 'currencyBasis',
};

const KNOWN_FIELDS = [
  'name',
  'family',
  'fields',
  'filters',
  'currencyBasis',
  'conversionDate',
  'audiencePermission',
  'scheduleCron',
  'recipientUserIds',
];

export interface DefinitionEditorProps {
  readonly initial: DefinitionForm;
  readonly families: readonly ReportFamilySummary[];
  readonly options: DimensionOptions;
  /** Editing an existing definition (PUT) instead of creating one. */
  readonly definitionId: number | null;
  readonly onSaved: (definition: ReportDefinition) => void;
  readonly onCancel: () => void;
}

export function DefinitionEditor({
  initial,
  families,
  options,
  definitionId,
  onSaved,
  onCancel,
}: DefinitionEditorProps) {
  const toast = useToast();
  const [form, setForm] = useState<DefinitionForm>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [preview, setPreview] = useState<{
    readonly key: string;
    readonly data: ReportPreview;
  } | null>(null);
  const previewer = useApiMutation(reportingEndpoints.previewReportDefinition);
  const create = useApiMutation(reportingEndpoints.createReportDefinition);
  const update = useApiMutation(reportingEndpoints.updateReportDefinition);
  const candidates = useApiQuery(reportingEndpoints.listRecipientCandidates, {
    query: { audiencePermission: form.audiencePermission, pageSize: 100 },
  });

  const family = families.find((item) => item.family === form.family);
  const body = bodyOf(form);
  const bodyKey = JSON.stringify(body);
  const previewCurrent = preview !== null && preview.key === bodyKey;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const localErrors = validateForm(form);
  const saveError = create.error ?? update.error;
  const apiError = saveError ?? previewer.error;
  const apiErrors = formErrors(apiError, KNOWN_FIELDS);
  const codeField =
    apiError !== null && apiError.code !== null ? CODE_FIELD[apiError.code] : undefined;
  const saving = create.pending || update.pending;

  const errorFor = (field: string): string | undefined => {
    const local = localErrors[field];
    if (showErrors && local !== undefined) return t(local);
    const api = apiErrors.forField(field);
    if (api !== undefined) return api;
    if (codeField === field && apiError !== null) return businessErrorMessage(apiError);
    return undefined;
  };

  const set = (patch: Partial<DefinitionForm>): void =>
    setForm((current) => ({ ...current, ...patch }));

  const runPreview = async (): Promise<void> => {
    setShowErrors(true);
    if (Object.keys(localErrors).length > 0) return;
    try {
      const data = await previewer.mutate({ body });
      setPreview({ key: bodyKey, data });
    } catch {
      // Shown beside the fields.
    }
  };

  const save = async (): Promise<void> => {
    setShowErrors(true);
    if (Object.keys(localErrors).length > 0 || !previewCurrent) return;
    try {
      const saved =
        definitionId === null
          ? await create.mutate({ body })
          : await update.mutate({ params: { definitionId }, body });
      toast.show(t('reports.definition.savedToast', { name: saved.name }), 'success');
      invalidateApiQueries('buyer.reportDefinitions.');
      invalidateApiQueries('buyer.reports.');
      onSaved(saved);
    } catch {
      // Shown beside the fields.
    }
  };

  const fieldOptions = (family?.fields ?? []).map((field) => ({
    value: field.key,
    label:
      field.sensitivity === 'restricted'
        ? t('reports.definition.restrictedField', { label: field.label })
        : field.label,
  }));
  const unmatched = apiErrors.other.filter((item) => !KNOWN_FIELDS.includes(item.field));
  const conflict =
    apiError !== null && apiError.fieldErrors.length === 0 && codeField === undefined
      ? apiError
      : null;

  return (
    <div className="tiq-stack">
      <UnsavedChangesGuard when={dirty && !saving} />
      <Banner tone="info" title={t('reports.definition.sharingTitle')}>
        <p>{t('reports.definition.sharingNote')}</p>
      </Banner>

      <Card
        title={t('reports.definition.sections.what')}
        subtitle={t('reports.definition.sections.whatHint')}
      >
        <div className="tiq-form-grid">
          <TextField
            label={t('reports.definition.name')}
            required
            value={form.name}
            maxLength={120}
            onChange={(name) => set({ name })}
            error={errorFor('name')}
          />
          <Select
            label={t('reports.definition.family')}
            required
            value={form.family}
            options={REPORT_DEFINITIONS_FAMILY.map((value) => ({
              value,
              label:
                families.find((item) => item.family === value)?.title ??
                tEnum('report_definitions.family', value),
              disabled: families.find((item) => item.family === value)?.restricted === true,
            }))}
            onChange={(value) => {
              const next = REPORT_DEFINITIONS_FAMILY.find((item) => item === value);
              if (next === undefined) return;
              const nextFamily = families.find((item) => item.family === next);
              set({
                family: next,
                fields: (nextFamily?.fields ?? [])
                  .filter((field) => field.sensitivity === 'normal')
                  .map((field) => field.key),
              });
            }}
            error={errorFor('family')}
          />
          <MultiSelect
            label={t('reports.definition.fields')}
            hint={t('reports.definition.fieldsHint')}
            required
            fieldClassName="tiq-form-full"
            value={[...form.fields]}
            options={fieldOptions}
            onChange={(fields) => set({ fields })}
            error={errorFor('fields')}
          />
        </div>
      </Card>

      <Card
        title={t('reports.definition.sections.filters')}
        subtitle={t('reports.definition.sections.filtersHint')}
      >
        <div className="tiq-form-grid">
          <DateInput
            label={t('reports.definition.from')}
            value={form.from}
            onChange={(from) => set({ from })}
            error={errorFor('filters.from')}
          />
          <DateInput
            label={t('reports.definition.to')}
            value={form.to}
            onChange={(to) => set({ to })}
            error={errorFor('filters.to')}
          />
          <Select
            label={t('reports.definition.level')}
            hint={t('reports.definition.levelHint')}
            value={form.level}
            options={REPORT_LEVEL_FILTERS.map((value) => ({
              value,
              label: t(`reports.report.levels.${value}`),
            }))}
            onChange={(value) => {
              const level = REPORT_LEVEL_FILTERS.find((item) => item === value);
              if (level !== undefined) set({ level });
            }}
          />
          <MultiSelect
            label={t('reports.definition.entities')}
            value={[...form.legalEntityIds]}
            options={options.legalEntities.map((item) => ({
              value: String(item.id),
              label: item.label,
            }))}
            onChange={(legalEntityIds) => set({ legalEntityIds })}
          />
          <MultiSelect
            label={t('reports.definition.departments')}
            value={[...form.departmentIds]}
            options={options.departments.map((item) => ({
              value: String(item.id),
              label: item.label,
            }))}
            onChange={(departmentIds) => set({ departmentIds })}
          />
          <MultiSelect
            label={t('reports.definition.categories')}
            value={[...form.categoryIds]}
            options={options.categories.map((item) => ({
              value: String(item.id),
              label: item.label,
            }))}
            onChange={(categoryIds) => set({ categoryIds })}
          />
          <MultiSelect
            label={t('reports.definition.owners')}
            value={[...form.ownerUserIds]}
            options={options.owners.map((item) => ({
              value: String(item.userId),
              label: item.fullName,
            }))}
            onChange={(ownerUserIds) => set({ ownerUserIds })}
          />
          <MultiSelect
            label={t('reports.definition.stages')}
            value={[...form.stages]}
            options={TENDERS_STATUS.map((value) => ({
              value,
              label: tEnum('tenders.status', value),
            }))}
            onChange={(stages) =>
              set({
                stages: TENDERS_STATUS.filter((value): value is TendersStatus =>
                  stages.includes(value),
                ),
              })
            }
          />
          <MultiSelect
            label={t('reports.definition.eventTypes')}
            value={[...form.eventTypes]}
            options={TENDERS_EVENT_TYPE.map((value) => ({
              value,
              label: tEnum('tenders.event_type', value),
            }))}
            onChange={(eventTypes) =>
              set({
                eventTypes: TENDERS_EVENT_TYPE.filter((value): value is TendersEventType =>
                  eventTypes.includes(value),
                ),
              })
            }
          />
        </div>
      </Card>

      <Card
        title={t('reports.definition.sections.currency')}
        subtitle={t('reports.definition.sections.currencyHint')}
      >
        <div className="tiq-form-grid">
          <TextField
            label={t('reports.definition.currency')}
            required
            value={form.currencyBasis}
            maxLength={3}
            onChange={(value) => set({ currencyBasis: value.toUpperCase() })}
            error={errorFor('currencyBasis')}
          />
          <DateInput
            label={t('reports.definition.conversionDate')}
            hint={t('reports.definition.conversionHint')}
            value={form.conversionDate}
            onChange={(conversionDate) => set({ conversionDate })}
            error={errorFor('conversionDate')}
          />
        </div>
      </Card>

      <Card
        title={t('reports.definition.sections.audience')}
        subtitle={t('reports.definition.sections.audienceHint')}
      >
        <div className="tiq-form-grid">
          <Select
            label={t('reports.definition.audience')}
            required
            hint={t('reports.definition.audienceHint')}
            value={form.audiencePermission}
            options={REPORT_AUDIENCE_PERMISSIONS.map((value) => ({
              value,
              label: t(`reports.audiences.${value.replace(/\./g, '_')}`),
            }))}
            onChange={(value) => {
              const audience = REPORT_AUDIENCE_PERMISSIONS.find((item) => item === value);
              if (audience !== undefined) set({ audiencePermission: audience });
            }}
            error={errorFor('audiencePermission')}
          />
          <div className="tiq-form-full">
            {candidates.data === undefined ? (
              <p className="tiq-text-muted">
                {candidates.error === null
                  ? t('reports.definition.loadingRecipients')
                  : t('reports.definition.recipientsError')}
              </p>
            ) : (
              <MultiSelect
                label={t('reports.definition.recipients')}
                hint={t('reports.definition.recipientsHint')}
                value={form.recipientUserIds.map(String)}
                options={candidates.data.items.map((candidate) => ({
                  value: String(candidate.user.userId),
                  label: candidate.authorized
                    ? t('reports.definition.recipientOption', {
                        name: candidate.user.fullName,
                        capacity: candidate.capacity ?? t('reports.definition.member'),
                      })
                    : t('reports.definition.recipientBlocked', {
                        name: candidate.user.fullName,
                        reason: candidate.reason ?? t('reports.definition.notAuthorized'),
                      }),
                  disabled:
                    !candidate.authorized && !form.recipientUserIds.includes(candidate.user.userId),
                }))}
                onChange={(values) =>
                  set({ recipientUserIds: values.map(Number).filter((value) => value > 0) })
                }
                error={errorFor('recipientUserIds')}
              />
            )}
          </div>
          <div className="tiq-form-full">
            <Checkbox
              label={t('reports.definition.scheduled')}
              hint={t('reports.definition.scheduledHint')}
              checked={form.scheduled}
              onChange={(scheduled) => set({ scheduled })}
            />
          </div>
          {form.scheduled && (
            <TextField
              label={t('reports.definition.schedule')}
              hint={t('reports.definition.scheduleHint')}
              required
              value={form.scheduleCron}
              onChange={(scheduleCron) => set({ scheduleCron })}
              error={errorFor('scheduleCron')}
              className="tiq-mono"
            />
          )}
        </div>
      </Card>

      {preview !== null && (
        <DefinitionPreviewPanel preview={preview.data} stale={!previewCurrent} />
      )}

      {conflict !== null && (
        <Banner tone="error" title={conflict.title}>
          <p>{businessErrorMessage(conflict)}</p>
        </Banner>
      )}
      {unmatched.length > 0 && (
        <FormErrorSummary title={t('reports.definition.invalid')} errors={unmatched} />
      )}

      <div className="tiq-inline" style={{ justifyContent: 'flex-end' }}>
        {!previewCurrent && (
          <span className="tiq-text-warning" role="status">
            {t('reports.definition.previewFirst')}
          </span>
        )}
        <Button onClick={onCancel} disabled={saving}>
          {t('reports.definition.cancel')}
        </Button>
        <Button icon="eye" loading={previewer.pending} onClick={() => void runPreview()}>
          {t('reports.definition.preview')}
        </Button>
        <Button
          variant="primary"
          icon="check"
          loading={saving}
          disabled={!previewCurrent}
          onClick={() => void save()}
        >
          {definitionId === null
            ? t('reports.definition.create')
            : t('reports.definition.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
