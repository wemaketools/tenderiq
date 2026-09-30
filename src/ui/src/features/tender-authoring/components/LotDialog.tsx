/**
 * Add or edit a lot (BUY-09): title, description, quantity, value, delivery location and date, an optional
 * lot-specific submission deadline entered in the tender's OFFICIAL time zone, and the accountable owner (BR-01).
 */
import { useState } from 'react';

import { createLot, updateLot } from '@contracts/tenders';
import type { Lot, LotMutationResult } from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import {
  DateInput,
  DateTimeInput,
  MoneyInput,
  Select,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useOwnerOptions } from '../lib/options';
import { FormDialog } from './FormDialog';

const FIELDS = [
  'title',
  'description',
  'quantityDescription',
  'estimatedValue',
  'deliveryLocation',
  'deliveryDate',
  'submissionDeadline',
  'ownerUserId',
];

interface Draft {
  title: string;
  description: string;
  quantityDescription: string;
  amount: string;
  deliveryLocation: string;
  deliveryDate: string;
  submissionDeadline: string | null;
  owner: string;
}

function draftOf(lot: Lot | null): Draft {
  return {
    title: lot?.title ?? '',
    description: lot?.description ?? '',
    quantityDescription: lot?.quantityDescription ?? '',
    amount: lot?.estimatedValue?.amount ?? '',
    deliveryLocation: lot?.deliveryLocation ?? '',
    deliveryDate: lot?.deliveryDate ?? '',
    submissionDeadline: lot?.submissionDeadline?.at ?? null,
    owner: lot?.owner === null || lot?.owner === undefined ? '' : String(lot.owner.userId),
  };
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export interface LotDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly timeZone: string;
  readonly currency: string;
  /** The lot to edit, or null to add one. */
  readonly lot: Lot | null;
  readonly onClose: () => void;
  readonly onSaved: (result: LotMutationResult) => void;
}

export function LotDialog({
  open,
  tenderId,
  timeZone,
  currency,
  lot,
  onClose,
  onSaved,
}: LotDialogProps) {
  const create = useApiMutation(createLot);
  const update = useApiMutation(updateLot);
  const mutation = lot === null ? create : update;
  const owners = useOwnerOptions(tenderId, open);
  const [draft, setDraft] = useState<Draft>(() => draftOf(lot));
  const [lastLot, setLastLot] = useState(lot);
  const [touched, setTouched] = useState(false);
  if (lot !== lastLot) {
    setLastLot(lot);
    setDraft(draftOf(lot));
    setTouched(false);
  }
  const errors = formErrors(mutation.error, FIELDS);
  const set = (patch: Partial<Draft>): void => setDraft((current) => ({ ...current, ...patch }));
  const titleError =
    draft.title.trim().length < 3 ? t('tender-authoring.create.titleShort') : undefined;

  const close = (): void => {
    create.reset();
    update.reset();
    setDraft(draftOf(lot));
    setTouched(false);
    onClose();
  };

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (titleError !== undefined) return;
    const fields = {
      title: draft.title.trim(),
      description: orNull(draft.description),
      quantityDescription: orNull(draft.quantityDescription),
      estimatedValue: draft.amount === '' ? null : { amount: draft.amount, currency },
      deliveryLocation: orNull(draft.deliveryLocation),
      deliveryDate: draft.deliveryDate === '' ? null : draft.deliveryDate,
      submissionDeadline: draft.submissionDeadline,
      ownerUserId: draft.owner === '' ? null : Number(draft.owner),
    };
    try {
      const result =
        lot === null
          ? await create.mutate({ params: { tenderId }, body: fields })
          : await update.mutate({ params: { tenderId, lotId: lot.id }, body: fields });
      onSaved(result);
      close();
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <FormDialog
      open={open}
      size="lg"
      title={
        lot === null
          ? t('tender-authoring.lots.addTitle')
          : t('tender-authoring.lots.editTitle', { no: lot.lotNo })
      }
      description={t('tender-authoring.common.materialNote')}
      submitLabel={t('tender-authoring.common.saveDraft')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <TextField
        label={t('tender-authoring.lots.col.title')}
        required
        value={draft.title}
        onChange={(title) => set({ title })}
        error={errors.forField('title') ?? (touched ? titleError : undefined)}
        maxLength={300}
      />
      <TextArea
        label={t('tender-authoring.lots.description')}
        value={draft.description}
        onChange={(description) => set({ description })}
        error={errors.forField('description')}
        rows={2}
      />
      <div className="tiq-form-grid">
        <TextField
          label={t('tender-authoring.lots.quantity')}
          value={draft.quantityDescription}
          onChange={(quantityDescription) => set({ quantityDescription })}
          error={errors.forField('quantityDescription')}
        />
        <MoneyInput
          label={t('tender-authoring.lots.col.value')}
          value={{ amount: draft.amount, currency }}
          currencies={[currency]}
          onChange={(value) => set({ amount: value.amount })}
          error={errors.forField('estimatedValue')}
        />
        <TextField
          label={t('tender-authoring.lots.location')}
          value={draft.deliveryLocation}
          onChange={(deliveryLocation) => set({ deliveryLocation })}
          error={errors.forField('deliveryLocation')}
        />
        <DateInput
          label={t('tender-authoring.lots.deliveryDate')}
          value={draft.deliveryDate}
          onChange={(deliveryDate) => set({ deliveryDate })}
          error={errors.forField('deliveryDate')}
        />
        <Select
          label={t('tender-authoring.lots.col.owner')}
          placeholder={
            owners === undefined
              ? t('tender-authoring.common.loading')
              : t('tender-authoring.lots.noOwner')
          }
          value={draft.owner}
          options={owners ?? []}
          onChange={(owner) => set({ owner })}
          hint={t('tender-authoring.lots.ownerHint')}
          error={errors.forField('ownerUserId')}
        />
      </div>
      <DateTimeInput
        label={t('tender-authoring.lots.deadline')}
        hint={t('tender-authoring.lots.deadlineHint')}
        value={draft.submissionDeadline}
        timeZone={timeZone}
        onChange={(submissionDeadline) => set({ submissionDeadline })}
        error={errors.forField('submissionDeadline')}
      />
    </FormDialog>
  );
}
