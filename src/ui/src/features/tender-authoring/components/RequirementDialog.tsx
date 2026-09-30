/**
 * Add or edit a requirement (BUY-09): reference code, section, text, lot applicability, owner, response type and
 * instructions, required evidence, treatment (mandatory gate, rated or information only), envelope, the consequence
 * of a missing answer and the criterion that rates it. Contradictions (a gate that only warns, a rated requirement
 * without a criterion…) are returned as issues after saving; the form flags the obvious ones before.
 */
import { useState } from 'react';

import {
  REQUIREMENTS_ENVELOPE,
  REQUIREMENTS_MISSING_CONSEQUENCE,
  REQUIREMENTS_RESPONSE_TYPE,
  REQUIREMENTS_TREATMENT,
} from '@contracts/enums';
import type {
  RequirementsEnvelope,
  RequirementsMissingConsequence,
  RequirementsResponseType,
  RequirementsTreatment,
} from '@contracts/enums';
import { createRequirement, updateRequirement } from '@contracts/tenders';
import type { LotSummary, Requirement, RequirementMutationResult } from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import { Banner, Select, TextArea, TextField, formErrors } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { lotLabel } from '../lib/labels';
import { useCriterionOptions, useOwnerOptions } from '../lib/options';
import { FormDialog } from './FormDialog';

const FIELDS = [
  'lotId',
  'section',
  'refCode',
  'text',
  'ownerUserId',
  'applicability',
  'responseType',
  'choices',
  'responseInstructions',
  'evidenceRequired',
  'treatment',
  'envelope',
  'missingConsequence',
  'criterionId',
];

interface Draft {
  lot: string;
  section: string;
  refCode: string;
  text: string;
  owner: string;
  applicability: string;
  responseType: string;
  choices: string;
  responseInstructions: string;
  evidenceRequired: string;
  treatment: string;
  envelope: string;
  missingConsequence: string;
  criterion: string;
}

function draftOf(row: Requirement | null): Draft {
  return {
    lot: row?.lot === null || row?.lot === undefined ? '' : String(row.lot.id),
    section: row?.section ?? '',
    refCode: row?.refCode ?? '',
    text: row?.text ?? '',
    owner: row?.owner === null || row?.owner === undefined ? '' : String(row.owner.userId),
    applicability: row?.applicability ?? '',
    responseType: row?.responseType ?? '',
    choices: row?.choices.join('\n') ?? '',
    responseInstructions: row?.responseInstructions ?? '',
    evidenceRequired: row?.evidenceRequired ?? '',
    treatment: row?.treatment ?? '',
    envelope: row?.envelope ?? '',
    missingConsequence: row?.missingConsequence ?? '',
    criterion:
      row?.criterion === null || row?.criterion === undefined ? '' : String(row.criterion.id),
  };
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Contradictions the form can see before saving (the API returns the full list as issues). */
function contradictions(draft: Draft): string[] {
  const found: string[] = [];
  if (draft.treatment === 'mandatory_gate' && draft.missingConsequence === 'warning') {
    found.push(t('tender-authoring.requirements.contradiction.gateWarns'));
  }
  if (draft.treatment === 'information_only' && draft.missingConsequence === 'reject') {
    found.push(t('tender-authoring.requirements.contradiction.infoRejects'));
  }
  if (draft.treatment === 'rated' && draft.criterion === '') {
    found.push(t('tender-authoring.requirements.contradiction.ratedNoCriterion'));
  }
  if (draft.treatment === 'mandatory_gate' && draft.criterion !== '') {
    found.push(t('tender-authoring.requirements.contradiction.gateRated'));
  }
  if (draft.owner === '') found.push(t('tender-authoring.requirements.contradiction.noOwner'));
  return found;
}

export interface RequirementDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly lots: readonly LotSummary[];
  readonly requirement: Requirement | null;
  readonly onClose: () => void;
  readonly onSaved: (result: RequirementMutationResult) => void;
}

export function RequirementDialog({
  open,
  tenderId,
  lots,
  requirement,
  onClose,
  onSaved,
}: RequirementDialogProps) {
  const create = useApiMutation(createRequirement);
  const update = useApiMutation(updateRequirement);
  const mutation = requirement === null ? create : update;
  const owners = useOwnerOptions(tenderId, open);
  const criteria = useCriterionOptions(tenderId, open);
  const [draft, setDraft] = useState<Draft>(() => draftOf(requirement));
  const [last, setLast] = useState(requirement);
  const [touched, setTouched] = useState(false);
  if (requirement !== last) {
    setLast(requirement);
    setDraft(draftOf(requirement));
    setTouched(false);
  }
  const set = (patch: Partial<Draft>): void => setDraft((current) => ({ ...current, ...patch }));
  const errors = formErrors(mutation.error, FIELDS);
  const choiceList = draft.choices
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => value !== '');
  const required = t('tender-authoring.create.required');
  const local: Record<string, string | undefined> = {
    section: draft.section.trim() === '' ? required : undefined,
    refCode: /^[A-Z0-9][A-Z0-9-]{0,39}$/.test(draft.refCode.trim())
      ? undefined
      : t('tender-authoring.requirements.refCodeFormat'),
    text:
      draft.text.trim().length < 3 ? t('tender-authoring.requirements.textRequired') : undefined,
    responseType: draft.responseType === '' ? required : undefined,
    choices:
      draft.responseType === 'choice' && choiceList.length < 2
        ? t('tender-authoring.requirements.choicesRequired')
        : undefined,
    treatment: draft.treatment === '' ? required : undefined,
    envelope: draft.envelope === '' ? required : undefined,
    missingConsequence: draft.missingConsequence === '' ? required : undefined,
  };
  const show = (field: string): string | undefined =>
    errors.forField(field) ?? (touched ? local[field] : undefined);
  const warnings = contradictions(draft);

  const close = (): void => {
    create.reset();
    update.reset();
    setDraft(draftOf(requirement));
    setTouched(false);
    onClose();
  };

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (Object.values(local).some((value) => value !== undefined)) return;
    const fields = {
      lotId: draft.lot === '' ? null : Number(draft.lot),
      section: draft.section.trim(),
      refCode: draft.refCode.trim(),
      text: draft.text.trim(),
      ownerUserId: draft.owner === '' ? null : Number(draft.owner),
      applicability: orNull(draft.applicability),
      responseType: draft.responseType as RequirementsResponseType,
      choices: draft.responseType === 'choice' ? choiceList : [],
      responseInstructions: orNull(draft.responseInstructions),
      evidenceRequired: orNull(draft.evidenceRequired),
      treatment: draft.treatment as RequirementsTreatment,
      envelope: draft.envelope as RequirementsEnvelope,
      missingConsequence: draft.missingConsequence as RequirementsMissingConsequence,
      criterionId: draft.criterion === '' ? null : Number(draft.criterion),
    };
    try {
      const result =
        requirement === null
          ? await create.mutate({ params: { tenderId }, body: fields })
          : await update.mutate({
              params: { tenderId, requirementId: requirement.id },
              body: fields,
            });
      onSaved(result);
      close();
    } catch {
      // Shown in the dialog.
    }
  };

  const enumOptions = (
    name:
      | 'requirements.response_type'
      | 'requirements.treatment'
      | 'requirements.envelope'
      | 'requirements.missing_consequence',
    values: readonly string[],
  ) => values.map((value) => ({ value, label: tEnum(name, value) }));

  return (
    <FormDialog
      open={open}
      size="lg"
      title={
        requirement === null
          ? t('tender-authoring.requirements.addTitle')
          : t('tender-authoring.requirements.editTitle', { code: requirement.refCode })
      }
      description={t('tender-authoring.common.materialNote')}
      submitLabel={t('tender-authoring.common.saveDraft')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('tender-authoring.requirements.col.ref')}
          required
          value={draft.refCode}
          onChange={(refCode) => set({ refCode: refCode.toUpperCase() })}
          hint={t('tender-authoring.requirements.refCodeHint')}
          error={show('refCode')}
          maxLength={40}
        />
        <TextField
          label={t('tender-authoring.requirements.col.section')}
          required
          value={draft.section}
          onChange={(section) => set({ section })}
          error={show('section')}
        />
        <Select
          label={t('tender-authoring.requirements.col.lot')}
          placeholder={t('tender-authoring.common.wholeTender')}
          value={draft.lot}
          options={lots.map((lot) => ({ value: String(lot.id), label: lotLabel(lot) }))}
          onChange={(lot) => set({ lot })}
          error={errors.forField('lotId')}
        />
        <Select
          label={t('tender-authoring.requirements.col.owner')}
          placeholder={
            owners === undefined
              ? t('tender-authoring.common.loading')
              : t('tender-authoring.requirements.noOwner')
          }
          value={draft.owner}
          options={owners ?? []}
          onChange={(owner) => set({ owner })}
          error={errors.forField('ownerUserId')}
        />
      </div>
      <TextArea
        label={t('tender-authoring.requirements.col.text')}
        required
        value={draft.text}
        onChange={(text) => set({ text })}
        error={show('text')}
        rows={3}
      />
      <TextField
        label={t('tender-authoring.requirements.applicability')}
        value={draft.applicability}
        onChange={(applicability) => set({ applicability })}
        hint={t('tender-authoring.requirements.applicabilityHint')}
        error={errors.forField('applicability')}
      />
      <div className="tiq-form-grid">
        <Select
          label={t('tender-authoring.requirements.responseType')}
          required
          placeholder={t('tender-authoring.common.select')}
          value={draft.responseType}
          options={enumOptions('requirements.response_type', REQUIREMENTS_RESPONSE_TYPE)}
          onChange={(responseType) => set({ responseType })}
          error={show('responseType')}
        />
        <Select
          label={t('tender-authoring.requirements.col.treatment')}
          required
          placeholder={t('tender-authoring.common.select')}
          value={draft.treatment}
          options={enumOptions('requirements.treatment', REQUIREMENTS_TREATMENT)}
          onChange={(treatment) => set({ treatment })}
          error={show('treatment')}
        />
        <Select
          label={t('tender-authoring.requirements.col.envelope')}
          required
          placeholder={t('tender-authoring.common.select')}
          value={draft.envelope}
          options={enumOptions('requirements.envelope', REQUIREMENTS_ENVELOPE)}
          onChange={(envelope) => set({ envelope })}
          error={show('envelope')}
        />
        <Select
          label={t('tender-authoring.requirements.consequence')}
          required
          placeholder={t('tender-authoring.common.select')}
          value={draft.missingConsequence}
          options={enumOptions(
            'requirements.missing_consequence',
            REQUIREMENTS_MISSING_CONSEQUENCE,
          )}
          onChange={(missingConsequence) => set({ missingConsequence })}
          error={show('missingConsequence')}
        />
        <Select
          label={t('tender-authoring.requirements.col.criterion')}
          placeholder={t('tender-authoring.requirements.noCriterion')}
          value={draft.criterion}
          options={criteria}
          onChange={(criterion) => set({ criterion })}
          error={errors.forField('criterionId')}
        />
      </div>
      {draft.responseType === 'choice' && (
        <TextArea
          label={t('tender-authoring.requirements.choices')}
          required
          hint={t('tender-authoring.requirements.choicesHint')}
          value={draft.choices}
          onChange={(choices) => set({ choices })}
          error={show('choices')}
          rows={3}
        />
      )}
      <TextArea
        label={t('tender-authoring.requirements.instructions')}
        value={draft.responseInstructions}
        onChange={(responseInstructions) => set({ responseInstructions })}
        error={errors.forField('responseInstructions')}
        rows={2}
      />
      <TextArea
        label={t('tender-authoring.requirements.evidence')}
        value={draft.evidenceRequired}
        onChange={(evidenceRequired) => set({ evidenceRequired })}
        error={errors.forField('evidenceRequired')}
        rows={2}
      />
      {warnings.length > 0 && (
        <Banner tone="warning" title={t('tender-authoring.requirements.contradictionTitle')}>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Banner>
      )}
    </FormDialog>
  );
}
