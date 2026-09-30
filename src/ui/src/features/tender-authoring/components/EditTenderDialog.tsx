/**
 * Edits the tender's general fields (BUY-08): title, summary, method, participation, value, budget, award model,
 * what the procedure permits and the organization's additional business fields (ADM-07). Only changed fields are sent, with the draft revision the edit was made against
 * (`REVISION_CONFLICT` when someone saved first). A material change starts a new draft revision and invalidates a
 * pending or approved release approval (BR-10); the dialog warns before saving.
 */
import { useMemo, useState } from 'react';

import {
  TENDERS_AWARD_MODEL,
  TENDERS_EVENT_TYPE,
  TENDERS_PARTICIPATION,
  TENDERS_PROCEDURE_WRITE,
} from '@contracts/enums';
import { valueBandOf } from '@contracts/policy';
import type { CustomFieldIssue, CustomFieldValues } from '@contracts/policy';
import { updateTender } from '@contracts/tenders';
import type { TenderDetail, TenderUpdateResult, UpdateTenderBody } from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Checkbox,
  MoneyInput,
  NumberInput,
  Select,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { CustomFieldsSection } from '../../admin-policy/components/CustomFieldsSection';
import { FormDialog } from './FormDialog';

const FLAGS = [
  'partialBidsAllowed',
  'alternativesAllowed',
  'negotiationPermitted',
  'demonstrationsPermitted',
  'referencesPermitted',
  'bafoPermitted',
  'independentEvaluation',
  'anonymizedEvaluation',
] as const;
type Flag = (typeof FLAGS)[number];

interface Draft {
  title: string;
  summary: string;
  eventType: string;
  procedure: string;
  participation: string;
  estimatedValue: string;
  budgetAmount: string;
  awardModel: string;
  maxLotsPerSupplier: string;
  eligibilitySummary: string;
  deliveryRequirements: string;
  anonymizationLimitations: string;
  flags: Record<Flag, boolean>;
  customFields: CustomFieldValues;
}

const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/;

function sameCustomValues(a: Readonly<CustomFieldValues>, b: Readonly<CustomFieldValues>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? null) === (b[key] ?? null));
}

function draftOf(tender: TenderDetail): Draft {
  return {
    title: tender.title,
    summary: tender.summary ?? '',
    eventType: tender.eventType,
    procedure: tender.procedure,
    participation: tender.participation,
    estimatedValue: tender.estimatedValue?.amount ?? '',
    budgetAmount: tender.budgetAmount?.amount ?? '',
    awardModel: tender.awardModel,
    maxLotsPerSupplier: tender.maxLotsPerSupplier === null ? '' : String(tender.maxLotsPerSupplier),
    eligibilitySummary: tender.eligibilitySummary ?? '',
    deliveryRequirements: tender.deliveryRequirements ?? '',
    anonymizationLimitations: tender.anonymizationLimitations ?? '',
    flags: Object.fromEntries(FLAGS.map((flag) => [flag, tender[flag]])) as Record<Flag, boolean>,
    customFields: { ...(tender.customFields ?? {}) },
  };
}

function textOrNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

/** The changed fields as an update body (without the revision). */
function changedFields(
  tender: TenderDetail,
  draft: Draft,
): Omit<UpdateTenderBody, 'expectedDraftRevision'> {
  const initial = draftOf(tender);
  const body: Record<string, unknown> = {};
  if (draft.title.trim() !== initial.title) body.title = draft.title.trim();
  if (draft.summary !== initial.summary) body.summary = textOrNull(draft.summary);
  if (draft.eventType !== initial.eventType) body.eventType = draft.eventType;
  if (draft.procedure !== initial.procedure) body.procedure = draft.procedure;
  if (draft.participation !== initial.participation) body.participation = draft.participation;
  for (const key of ['estimatedValue', 'budgetAmount'] as const) {
    if (draft[key] !== initial[key]) {
      body[key] = draft[key] === '' ? null : { amount: draft[key], currency: tender.currency };
    }
  }
  if (draft.awardModel !== initial.awardModel) body.awardModel = draft.awardModel;
  if (draft.maxLotsPerSupplier !== initial.maxLotsPerSupplier) {
    body.maxLotsPerSupplier =
      draft.maxLotsPerSupplier === '' ? null : Number(draft.maxLotsPerSupplier);
  }
  for (const key of [
    'eligibilitySummary',
    'deliveryRequirements',
    'anonymizationLimitations',
  ] as const) {
    if (draft[key] !== initial[key]) body[key] = textOrNull(draft[key]);
  }
  for (const flag of FLAGS) {
    if (draft.flags[flag] !== initial.flags[flag]) body[flag] = draft.flags[flag];
  }
  if (!sameCustomValues(draft.customFields, initial.customFields)) {
    body.customFields = draft.customFields;
  }
  return body as Omit<UpdateTenderBody, 'expectedDraftRevision'>;
}

export interface EditTenderDialogProps {
  readonly open: boolean;
  readonly tender: TenderDetail;
  readonly onClose: () => void;
  readonly onSaved: (result: TenderUpdateResult) => void;
}

export function EditTenderDialog({ open, tender, onClose, onSaved }: EditTenderDialogProps) {
  const mutation = useApiMutation(updateTender);
  const [draft, setDraft] = useState<Draft>(() => draftOf(tender));
  const [noChanges, setNoChanges] = useState(false);
  const [tried, setTried] = useState(false);
  const [customIssues, setCustomIssues] = useState<readonly CustomFieldIssue[]>([]);
  const customContext = useMemo(
    () => ({
      category_code: tender.category?.code ?? null,
      procedure: draft.procedure,
      event_type: draft.eventType,
      participation: draft.participation,
      value_band: DECIMAL_AMOUNT.test(draft.estimatedValue)
        ? valueBandOf(draft.estimatedValue)
        : null,
    }),
    [tender.category, draft.procedure, draft.eventType, draft.participation, draft.estimatedValue],
  );
  const fields = [
    'title',
    'summary',
    'eventType',
    'procedure',
    'participation',
    'estimatedValue',
    'budgetAmount',
    'awardModel',
    'maxLotsPerSupplier',
    'eligibilitySummary',
    'deliveryRequirements',
    'anonymizationLimitations',
    ...FLAGS,
  ];
  const errors = formErrors(mutation.error, fields);
  const set = (patch: Partial<Draft>): void => {
    setNoChanges(false);
    setDraft((current) => ({ ...current, ...patch }));
  };
  const titleError =
    draft.title.trim().length < 3 ? t('tender-authoring.create.titleShort') : undefined;
  const limitationsError =
    draft.flags.anonymizedEvaluation && draft.anonymizationLimitations.trim() === ''
      ? t('tender-authoring.edit.limitationsRequired')
      : undefined;

  const close = (): void => {
    mutation.reset();
    setDraft(draftOf(tender));
    setNoChanges(false);
    setTried(false);
    onClose();
  };

  const submit = async (): Promise<void> => {
    setTried(true);
    if (titleError !== undefined || limitationsError !== undefined) return;
    // Required additional fields are checked when release approval is requested; wrong values block the save.
    if (customIssues.some((issue) => issue.code !== 'CUSTOM_FIELD_REQUIRED')) return;
    const changes = changedFields(tender, draft);
    if (Object.keys(changes).length === 0) {
      setNoChanges(true);
      return;
    }
    try {
      const result = await mutation.mutate({
        params: { tenderId: tender.id },
        body: { expectedDraftRevision: tender.draftRevision, ...changes },
      });
      onSaved(result);
      onClose();
      mutation.reset();
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <FormDialog
      open={open}
      size="lg"
      title={t('tender-authoring.edit.title')}
      description={t('tender-authoring.edit.description', { revision: tender.draftRevision })}
      submitLabel={t('tender-authoring.common.saveDraft')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      {tender.releaseApproval !== null && tender.releaseApproval.status !== 'invalidated' && (
        <Banner tone="warning" title={t('tender-authoring.edit.materialTitle')}>
          <p>{t('tender-authoring.edit.material')}</p>
        </Banner>
      )}
      {noChanges && (
        <Banner tone="info" title={t('tender-authoring.edit.noChanges')}>
          <p>{t('tender-authoring.edit.noChangesDetail')}</p>
        </Banner>
      )}
      <TextField
        label={t('tender-authoring.fields.title')}
        required
        value={draft.title}
        onChange={(title) => set({ title })}
        error={errors.forField('title') ?? titleError}
        maxLength={300}
      />
      <TextArea
        label={t('tender-authoring.fields.summary')}
        value={draft.summary}
        onChange={(summary) => set({ summary })}
        error={errors.forField('summary')}
        rows={3}
      />
      <div className="tiq-form-grid">
        <Select
          label={t('tender-authoring.fields.eventType')}
          value={draft.eventType}
          options={TENDERS_EVENT_TYPE.map((value) => ({
            value,
            label: tEnum('tenders.event_type', value),
          }))}
          onChange={(eventType) => set({ eventType })}
          error={errors.forField('eventType')}
        />
        <Select
          label={t('tender-authoring.fields.procedure')}
          value={draft.procedure}
          options={TENDERS_PROCEDURE_WRITE.map((value) => ({
            value,
            label: tEnum('tenders.procedure', value),
          }))}
          onChange={(procedure) => set({ procedure })}
          error={errors.forField('procedure')}
        />
        <Select
          label={t('tender-authoring.fields.participation')}
          value={draft.participation}
          options={TENDERS_PARTICIPATION.map((value) => ({
            value,
            label: tEnum('tenders.participation', value),
          }))}
          onChange={(participation) => set({ participation })}
          error={errors.forField('participation')}
        />
        <Select
          label={t('tender-authoring.fields.awardModel')}
          value={draft.awardModel}
          options={TENDERS_AWARD_MODEL.map((value) => ({
            value,
            label: tEnum('tenders.award_model', value),
          }))}
          onChange={(awardModel) => set({ awardModel })}
          error={errors.forField('awardModel')}
        />
        <MoneyInput
          label={t('tender-authoring.fields.estimatedValue')}
          value={{ amount: draft.estimatedValue, currency: tender.currency }}
          currencies={[tender.currency]}
          onChange={(value) => set({ estimatedValue: value.amount })}
          error={errors.forField('estimatedValue')}
        />
        <MoneyInput
          label={t('tender-authoring.fields.budgetAmount')}
          value={{ amount: draft.budgetAmount, currency: tender.currency }}
          currencies={[tender.currency]}
          onChange={(value) => set({ budgetAmount: value.amount })}
          error={errors.forField('budgetAmount')}
        />
        <NumberInput
          label={t('tender-authoring.fields.maxLotsPerSupplier')}
          value={draft.maxLotsPerSupplier}
          places={0}
          onChange={(maxLotsPerSupplier) => set({ maxLotsPerSupplier })}
          error={errors.forField('maxLotsPerSupplier')}
        />
      </div>
      <TextArea
        label={t('tender-authoring.fields.eligibilitySummary')}
        value={draft.eligibilitySummary}
        onChange={(eligibilitySummary) => set({ eligibilitySummary })}
        error={errors.forField('eligibilitySummary')}
        rows={2}
      />
      <TextArea
        label={t('tender-authoring.fields.deliveryRequirements')}
        value={draft.deliveryRequirements}
        onChange={(deliveryRequirements) => set({ deliveryRequirements })}
        error={errors.forField('deliveryRequirements')}
        rows={2}
      />
      <fieldset className="tiq-fieldset">
        <legend>{t('tender-authoring.edit.permitted')}</legend>
        {FLAGS.map((flag) => (
          <Checkbox
            key={flag}
            label={t(`tender-authoring.fields.${flag}`)}
            checked={draft.flags[flag]}
            onChange={(checked) => set({ flags: { ...draft.flags, [flag]: checked } })}
            error={errors.forField(flag)}
          />
        ))}
      </fieldset>
      {draft.flags.anonymizedEvaluation && (
        <TextArea
          label={t('tender-authoring.fields.anonymizationLimitations')}
          required
          value={draft.anonymizationLimitations}
          onChange={(anonymizationLimitations) => set({ anonymizationLimitations })}
          error={errors.forField('anonymizationLimitations') ?? limitationsError}
          rows={2}
        />
      )}
      <CustomFieldsSection
        entityType="tender"
        values={draft.customFields}
        onChange={(customFields) => set({ customFields })}
        context={customContext}
        showErrors={tried}
        serverErrors={mutation.error?.fieldErrors}
        onValidationChange={setCustomIssues}
      />
    </FormDialog>
  );
}
