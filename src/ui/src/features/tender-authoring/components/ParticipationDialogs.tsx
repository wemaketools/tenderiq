/**
 * BUY-12 editors: the envelope stages (single-stage opening opens every envelope together; staged opening opens them
 * in order, BR-17) and the participation conditions suppliers must meet (confidentiality undertaking, qualification,
 * mandatory briefing…), each either blocking or informational.
 */
import { useState } from 'react';

import {
  PARTICIPATION_CONDITIONS_CONDITION_TYPE,
  TENDERS_OPENING_MODE,
  TENDER_ENVELOPES_ENVELOPE,
} from '@contracts/enums';
import type {
  ParticipationConditionsConditionType,
  TenderEnvelopesEnvelope,
  TendersOpeningMode,
} from '@contracts/enums';
import {
  createParticipationCondition,
  updateEnvelopes,
  updateParticipationCondition,
} from '@contracts/tenders';
import type {
  ConditionMutationResult,
  ParticipationCondition,
  TenderTimetable,
  TimetableMutationResult,
} from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import {
  Checkbox,
  NumberInput,
  RadioGroup,
  Select,
  TextArea,
  formErrors,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { FormDialog } from './FormDialog';

// ---------------------------------------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------------------------------------

export interface EnvelopesDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly draftRevision: number;
  readonly timetable: TenderTimetable;
  readonly onClose: () => void;
  readonly onSaved: (result: TimetableMutationResult) => void;
}

type EnvelopeState = Record<TenderEnvelopesEnvelope, { used: boolean; order: string }>;

function envelopeState(timetable: TenderTimetable): EnvelopeState {
  const state = {} as EnvelopeState;
  for (const envelope of TENDER_ENVELOPES_ENVELOPE) {
    const row = timetable.envelopes.find((item) => item.envelope === envelope);
    state[envelope] = {
      used: row !== undefined,
      order: row === undefined ? '1' : String(row.openOrder),
    };
  }
  return state;
}

export function EnvelopesDialog({
  open,
  tenderId,
  draftRevision,
  timetable,
  onClose,
  onSaved,
}: EnvelopesDialogProps) {
  const mutation = useApiMutation(updateEnvelopes);
  const [mode, setMode] = useState<string>(timetable.openingMode);
  const [envelopes, setEnvelopes] = useState<EnvelopeState>(() => envelopeState(timetable));
  const errors = formErrors(mutation.error, ['openingMode', 'envelopes']);
  const used = TENDER_ENVELOPES_ENVELOPE.filter((envelope) => envelopes[envelope].used);
  const orders = used.map((envelope) => envelopes[envelope].order);
  const local =
    used.length === 0
      ? t('tender-authoring.envelopes.required')
      : mode === 'staged' && (used.length < 2 || new Set(orders).size !== used.length)
        ? t('tender-authoring.envelopes.stagedOrder')
        : undefined;
  const [touched, setTouched] = useState(false);

  const close = (): void => {
    mutation.reset();
    setMode(timetable.openingMode);
    setEnvelopes(envelopeState(timetable));
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (local !== undefined) return;
    try {
      const result = await mutation.mutate({
        params: { tenderId },
        body: {
          expectedDraftRevision: draftRevision,
          openingMode: mode as TendersOpeningMode,
          envelopes: used.map((envelope) => ({
            envelope,
            openOrder: mode === 'staged' ? Number(envelopes[envelope].order) : 1,
          })),
        },
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
      title={t('tender-authoring.envelopes.title')}
      description={t('tender-authoring.common.materialNote')}
      submitLabel={t('tender-authoring.common.saveDraft')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <RadioGroup
        label={t('tender-authoring.envelopes.mode')}
        value={mode}
        onChange={setMode}
        options={TENDERS_OPENING_MODE.map((value) => ({
          value,
          label: tEnum('tenders.opening_mode', value),
          hint: t(`tender-authoring.envelopes.modeHint.${value}`),
        }))}
        error={errors.forField('openingMode')}
      />
      {TENDER_ENVELOPES_ENVELOPE.map((envelope) => (
        <div key={envelope} className="tiq-form-grid">
          <Checkbox
            label={tEnum('tender_envelopes.envelope', envelope)}
            checked={envelopes[envelope].used}
            onChange={(checked) =>
              setEnvelopes({ ...envelopes, [envelope]: { ...envelopes[envelope], used: checked } })
            }
          />
          {mode === 'staged' && envelopes[envelope].used && (
            <NumberInput
              label={t('tender-authoring.envelopes.order', {
                envelope: tEnum('tender_envelopes.envelope', envelope),
              })}
              value={envelopes[envelope].order}
              places={0}
              onChange={(order) =>
                setEnvelopes({ ...envelopes, [envelope]: { ...envelopes[envelope], order } })
              }
            />
          )}
        </div>
      ))}
      {(errors.forField('envelopes') ?? (touched ? local : undefined)) !== undefined && (
        <p className="tiq-field-error" role="alert">
          {errors.forField('envelopes') ?? local}
        </p>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Participation conditions
// ---------------------------------------------------------------------------------------------------------

export interface ConditionDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly programs: TenderTimetable['qualificationPrograms'];
  readonly condition: ParticipationCondition | null;
  readonly onClose: () => void;
  readonly onSaved: (result: ConditionMutationResult) => void;
}

export function ConditionDialog({
  open,
  tenderId,
  programs,
  condition,
  onClose,
  onSaved,
}: ConditionDialogProps) {
  const create = useApiMutation(createParticipationCondition);
  const update = useApiMutation(updateParticipationCondition);
  const mutation = condition === null ? create : update;
  const initial = {
    type: condition?.conditionType ?? '',
    description: condition?.description ?? '',
    program:
      condition?.qualificationProgram === null || condition === null
        ? ''
        : String(condition.qualificationProgram.id),
    blocking: condition?.blocking ?? true,
  };
  const [draft, setDraft] = useState(initial);
  const [last, setLast] = useState(condition);
  const [touched, setTouched] = useState(false);
  if (condition !== last) {
    setLast(condition);
    setDraft(initial);
    setTouched(false);
  }
  const errors = formErrors(mutation.error, [
    'conditionType',
    'description',
    'qualificationProgramId',
    'sessionId',
    'blocking',
  ]);
  const local = {
    type: draft.type === '' ? t('tender-authoring.create.required') : undefined,
    description:
      draft.description.trim().length < 3
        ? t('tender-authoring.conditions.descriptionRequired')
        : undefined,
    program:
      draft.type === 'qualification_required' && draft.program === ''
        ? t('tender-authoring.conditions.programRequired')
        : undefined,
  };

  const close = (): void => {
    create.reset();
    update.reset();
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (Object.values(local).some((value) => value !== undefined)) return;
    const body = {
      conditionType: draft.type as ParticipationConditionsConditionType,
      description: draft.description.trim(),
      qualificationProgramId:
        draft.type === 'qualification_required' ? Number(draft.program) : null,
      blocking: draft.blocking,
    };
    try {
      const result =
        condition === null
          ? await create.mutate({ params: { tenderId }, body })
          : await update.mutate({ params: { tenderId, conditionId: condition.id }, body });
      onSaved(result);
      close();
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <FormDialog
      open={open}
      title={
        condition === null
          ? t('tender-authoring.conditions.addTitle')
          : t('tender-authoring.conditions.editTitle')
      }
      description={t('tender-authoring.common.materialNote')}
      submitLabel={t('tender-authoring.common.saveDraft')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <Select
        label={t('tender-authoring.conditions.type')}
        required
        placeholder={t('tender-authoring.common.select')}
        value={draft.type}
        options={PARTICIPATION_CONDITIONS_CONDITION_TYPE.map((value) => ({
          value,
          label: tEnum('participation_conditions.condition_type', value),
        }))}
        onChange={(type) => setDraft({ ...draft, type })}
        error={errors.forField('conditionType') ?? (touched ? local.type : undefined)}
      />
      <TextArea
        label={t('tender-authoring.conditions.description')}
        required
        value={draft.description}
        onChange={(description) => setDraft({ ...draft, description })}
        rows={3}
        error={errors.forField('description') ?? (touched ? local.description : undefined)}
      />
      {draft.type === 'qualification_required' && (
        <Select
          label={t('tender-authoring.conditions.program')}
          required
          placeholder={
            programs.length === 0
              ? t('tender-authoring.conditions.noPrograms')
              : t('tender-authoring.common.select')
          }
          value={draft.program}
          options={programs.map((program) => ({ value: String(program.id), label: program.name }))}
          onChange={(program) => setDraft({ ...draft, program })}
          error={errors.forField('qualificationProgramId') ?? (touched ? local.program : undefined)}
        />
      )}
      <Checkbox
        label={t('tender-authoring.conditions.blocking')}
        hint={t('tender-authoring.conditions.blockingHint')}
        checked={draft.blocking}
        onChange={(blocking) => setDraft({ ...draft, blocking })}
      />
    </FormDialog>
  );
}
