/**
 * BUY-10 editors: a pricing schedule (lot, instructions, tax treatment, evaluation periods, accepted discounts and
 * how they enter comparison, accepted price entries), a pricing item (unit,
 * quantity, one-time vs recurring charge, optional, provisional, included in evaluation), a commercial term and the
 * commercial settings (currency, accepted currencies, bid validity, alternatives and partial bids).
 */
import { useState } from 'react';

import { PRICING_ITEMS_CHARGE_TYPE, PRICING_ITEMS_RECURRENCE } from '@contracts/enums';
import type {
  PricingItemsChargeType,
  PricingItemsRecurrence,
  TenderTermsTermType,
} from '@contracts/enums';
import {
  DEFAULT_PRICE_ENTRIES,
  DISCOUNT_TYPES,
  PRICE_ENTRY_TYPES,
  createPricingItem,
  createPricingSchedule,
  updatePricingItem,
  updatePricingSchedule,
  updateTender,
  upsertTenderTerm,
} from '@contracts/tenders';
import type {
  DiscountType,
  LotSummary,
  PriceEntryType,
  PricingItem,
  PricingItemMutationResult,
  PricingSchedule,
  PricingScheduleMutationResult,
  TenderDetail,
  TenderTerm,
  TenderUpdateResult,
  TermMutationResult,
} from '@contracts/tenders';

import { useApiMutation } from '../../../api/hooks';
import {
  Checkbox,
  MultiSelect,
  NumberInput,
  Select,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { lotLabel } from '../lib/labels';
import { FormDialog } from './FormDialog';

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

// ---------------------------------------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------------------------------------

export interface ScheduleDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly lots: readonly LotSummary[];
  readonly schedule: PricingSchedule | null;
  readonly onClose: () => void;
  readonly onSaved: (result: PricingScheduleMutationResult) => void;
}

export function ScheduleDialog({
  open,
  tenderId,
  lots,
  schedule,
  onClose,
  onSaved,
}: ScheduleDialogProps) {
  const create = useApiMutation(createPricingSchedule);
  const update = useApiMutation(updatePricingSchedule);
  const mutation = schedule === null ? create : update;
  const initial = {
    lot: schedule?.lot === null || schedule?.lot === undefined ? '' : String(schedule.lot.id),
    name: schedule?.name ?? '',
    instructions: schedule?.instructions ?? '',
    taxTreatment: schedule?.taxTreatment ?? '',
    periods:
      schedule?.evaluationPeriods === null || schedule?.evaluationPeriods === undefined
        ? ''
        : String(schedule.evaluationPeriods),
    discounts: [...(schedule?.discountsAccepted ?? [])] as string[],
    discountNote: schedule?.discountEvaluationNote ?? '',
    entries: [...(schedule?.priceEntries ?? DEFAULT_PRICE_ENTRIES)] as string[],
  };
  const [draft, setDraft] = useState(initial);
  const [last, setLast] = useState(schedule);
  const [touched, setTouched] = useState(false);
  if (schedule !== last) {
    setLast(schedule);
    setDraft(initial);
    setTouched(false);
  }
  const errors = formErrors(mutation.error, [
    'lotId',
    'name',
    'instructions',
    'taxTreatment',
    'evaluationPeriods',
    'discountsAccepted',
    'discountEvaluationNote',
    'priceEntries',
  ]);
  const nameError =
    draft.name.trim().length < 2 ? t('tender-authoring.pricing.nameRequired') : undefined;
  const basisError =
    draft.discounts.length > 0 && draft.discountNote.trim() === ''
      ? t('tender-authoring.pricing.discounts.basisRequired')
      : undefined;

  const close = (): void => {
    create.reset();
    update.reset();
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (nameError !== undefined || basisError !== undefined) return;
    const body = {
      lotId: draft.lot === '' ? null : Number(draft.lot),
      name: draft.name.trim(),
      instructions: orNull(draft.instructions),
      taxTreatment: orNull(draft.taxTreatment),
      evaluationPeriods: draft.periods === '' ? null : Number(draft.periods),
      discountsAccepted: DISCOUNT_TYPES.filter((type): type is DiscountType =>
        draft.discounts.includes(type),
      ),
      discountEvaluationNote: draft.discounts.length === 0 ? null : orNull(draft.discountNote),
      priceEntries: PRICE_ENTRY_TYPES.filter(
        (entry): entry is PriceEntryType => entry === 'priced' || draft.entries.includes(entry),
      ),
    };
    try {
      const result =
        schedule === null
          ? await create.mutate({ params: { tenderId }, body })
          : await update.mutate({ params: { tenderId, scheduleId: schedule.id }, body });
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
        schedule === null
          ? t('tender-authoring.pricing.addSchedule')
          : t('tender-authoring.pricing.editSchedule', { name: schedule.name })
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
        label={t('tender-authoring.pricing.scheduleName')}
        required
        value={draft.name}
        onChange={(name) => setDraft({ ...draft, name })}
        error={errors.forField('name') ?? (touched ? nameError : undefined)}
      />
      <Select
        label={t('tender-authoring.requirements.col.lot')}
        placeholder={t('tender-authoring.common.wholeTender')}
        value={draft.lot}
        options={lots.map((lot) => ({ value: String(lot.id), label: lotLabel(lot) }))}
        onChange={(lot) => setDraft({ ...draft, lot })}
        error={errors.forField('lotId')}
      />
      <TextArea
        label={t('tender-authoring.pricing.instructions')}
        value={draft.instructions}
        onChange={(instructions) => setDraft({ ...draft, instructions })}
        error={errors.forField('instructions')}
        rows={2}
      />
      <TextArea
        label={t('tender-authoring.pricing.tax')}
        value={draft.taxTreatment}
        onChange={(taxTreatment) => setDraft({ ...draft, taxTreatment })}
        error={errors.forField('taxTreatment')}
        rows={2}
      />
      <NumberInput
        label={t('tender-authoring.pricing.periods')}
        hint={t('tender-authoring.pricing.periodsHint')}
        value={draft.periods}
        places={0}
        onChange={(periods) => setDraft({ ...draft, periods })}
        error={errors.forField('evaluationPeriods')}
      />
      <MultiSelect
        label={t('tender-authoring.pricing.discounts.label')}
        hint={t('tender-authoring.pricing.discounts.hint')}
        value={draft.discounts}
        onChange={(discounts) => setDraft({ ...draft, discounts })}
        options={DISCOUNT_TYPES.map((value) => ({
          value,
          label: t(`tender-authoring.pricing.discounts.type.${value}`),
        }))}
        error={errors.forField('discountsAccepted')}
      />
      {draft.discounts.length > 0 && (
        <TextArea
          label={t('tender-authoring.pricing.discounts.basis')}
          hint={t('tender-authoring.pricing.discounts.basisHint')}
          required
          value={draft.discountNote}
          onChange={(discountNote) => setDraft({ ...draft, discountNote })}
          error={errors.forField('discountEvaluationNote') ?? (touched ? basisError : undefined)}
          rows={2}
        />
      )}
      <MultiSelect
        label={t('tender-authoring.pricing.entries.label')}
        hint={t('tender-authoring.pricing.entries.hint')}
        value={['priced', ...draft.entries.filter((entry) => entry !== 'priced')]}
        onChange={(entries) => setDraft({ ...draft, entries })}
        options={PRICE_ENTRY_TYPES.map((value) => ({
          value,
          label: `${t(`tender-authoring.pricing.entries.type.${value}`)}: ${t(`tender-authoring.pricing.entries.meaning.${value}`)}`,
          disabled: value === 'priced',
        }))}
        error={errors.forField('priceEntries')}
      />
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------------------------------------

export interface ItemDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly schedule: PricingSchedule | null;
  readonly item: PricingItem | null;
  readonly onClose: () => void;
  readonly onSaved: (result: PricingItemMutationResult) => void;
}

interface ItemDraft {
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  chargeType: string;
  recurrence: string;
  isOptional: boolean;
  isProvisional: boolean;
  includeInEvaluation: boolean;
}

function itemDraft(item: PricingItem | null): ItemDraft {
  return {
    itemCode: item?.itemCode ?? '',
    description: item?.description ?? '',
    unit: item?.unit ?? '',
    quantity: item?.quantity ?? '',
    chargeType: item?.chargeType ?? 'one_time',
    recurrence: item?.recurrence ?? '',
    isOptional: item?.isOptional ?? false,
    isProvisional: item?.isProvisional ?? false,
    includeInEvaluation: item?.includeInEvaluation ?? true,
  };
}

export function ItemDialog({ open, tenderId, schedule, item, onClose, onSaved }: ItemDialogProps) {
  const create = useApiMutation(createPricingItem);
  const update = useApiMutation(updatePricingItem);
  const mutation = item === null ? create : update;
  const [draft, setDraft] = useState<ItemDraft>(() => itemDraft(item));
  const [last, setLast] = useState(item);
  const [touched, setTouched] = useState(false);
  if (item !== last) {
    setLast(item);
    setDraft(itemDraft(item));
    setTouched(false);
  }
  const set = (patch: Partial<ItemDraft>): void =>
    setDraft((current) => ({ ...current, ...patch }));
  const errors = formErrors(mutation.error, [
    'itemCode',
    'description',
    'unit',
    'quantity',
    'chargeType',
    'recurrence',
    'isOptional',
    'isProvisional',
    'includeInEvaluation',
  ]);
  const local: Record<string, string | undefined> = {
    itemCode: /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(draft.itemCode.trim())
      ? undefined
      : t('tender-authoring.pricing.itemCodeFormat'),
    description:
      draft.description.trim().length < 2 ? t('tender-authoring.create.required') : undefined,
    unit: draft.unit.trim() === '' ? t('tender-authoring.create.required') : undefined,
    quantity: draft.quantity === '' ? t('tender-authoring.create.required') : undefined,
    recurrence:
      draft.chargeType === 'recurring' && draft.recurrence === ''
        ? t('tender-authoring.pricing.recurrenceRequired')
        : undefined,
  };
  const show = (field: string): string | undefined =>
    errors.forField(field) ?? (touched ? local[field] : undefined);

  const close = (): void => {
    create.reset();
    update.reset();
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (schedule === null || Object.values(local).some((value) => value !== undefined)) return;
    const body = {
      itemCode: draft.itemCode.trim(),
      description: draft.description.trim(),
      unit: draft.unit.trim(),
      quantity: draft.quantity,
      chargeType: draft.chargeType as PricingItemsChargeType,
      recurrence:
        draft.chargeType === 'recurring' ? (draft.recurrence as PricingItemsRecurrence) : null,
      isOptional: draft.isOptional,
      isProvisional: draft.isProvisional,
      includeInEvaluation: draft.includeInEvaluation,
    };
    try {
      const result =
        item === null
          ? await create.mutate({ params: { tenderId, scheduleId: schedule.id }, body })
          : await update.mutate({
              params: { tenderId, scheduleId: schedule.id, itemId: item.id },
              body,
            });
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
        item === null
          ? t('tender-authoring.pricing.addItem')
          : t('tender-authoring.pricing.editItem', { code: item.itemCode })
      }
      description={schedule === null ? undefined : schedule.name}
      submitLabel={t('tender-authoring.common.saveDraft')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('tender-authoring.pricing.col.code')}
          required
          value={draft.itemCode}
          onChange={(itemCode) => set({ itemCode: itemCode.toUpperCase() })}
          error={show('itemCode')}
          maxLength={20}
        />
        <TextField
          label={t('tender-authoring.pricing.col.unit')}
          required
          value={draft.unit}
          onChange={(unit) => set({ unit })}
          error={show('unit')}
        />
      </div>
      <TextField
        label={t('tender-authoring.pricing.col.description')}
        required
        value={draft.description}
        onChange={(description) => set({ description })}
        error={show('description')}
      />
      <div className="tiq-form-grid">
        <NumberInput
          label={t('tender-authoring.pricing.col.quantity')}
          required
          value={draft.quantity}
          places={3}
          onChange={(quantity) => set({ quantity })}
          error={show('quantity')}
        />
        <Select
          label={t('tender-authoring.pricing.col.charge')}
          required
          value={draft.chargeType}
          options={PRICING_ITEMS_CHARGE_TYPE.map((value) => ({
            value,
            label: tEnum('pricing_items.charge_type', value),
          }))}
          onChange={(chargeType) =>
            set({ chargeType, recurrence: chargeType === 'recurring' ? draft.recurrence : '' })
          }
          error={show('chargeType')}
        />
        {draft.chargeType === 'recurring' && (
          <Select
            label={t('tender-authoring.pricing.recurrence')}
            required
            placeholder={t('tender-authoring.common.select')}
            value={draft.recurrence}
            options={PRICING_ITEMS_RECURRENCE.map((value) => ({
              value,
              label: tEnum('pricing_items.recurrence', value),
            }))}
            onChange={(recurrence) => set({ recurrence })}
            error={show('recurrence')}
          />
        )}
      </div>
      <Checkbox
        label={t('tender-authoring.pricing.optional')}
        hint={t('tender-authoring.pricing.optionalHint')}
        checked={draft.isOptional}
        onChange={(isOptional) => set({ isOptional })}
      />
      <Checkbox
        label={t('tender-authoring.pricing.provisional')}
        hint={t('tender-authoring.pricing.provisionalHint')}
        checked={draft.isProvisional}
        onChange={(isProvisional) => set({ isProvisional })}
      />
      <Checkbox
        label={t('tender-authoring.pricing.inEvaluation')}
        checked={draft.includeInEvaluation}
        onChange={(includeInEvaluation) => set({ includeInEvaluation })}
      />
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Term
// ---------------------------------------------------------------------------------------------------------

export interface TermDialogProps {
  readonly open: boolean;
  readonly tenderId: number;
  readonly termType: TenderTermsTermType | null;
  readonly term: TenderTerm | null;
  readonly onClose: () => void;
  readonly onSaved: (result: TermMutationResult) => void;
}

export function TermDialog({ open, tenderId, termType, term, onClose, onSaved }: TermDialogProps) {
  const mutation = useApiMutation(upsertTenderTerm);
  const [content, setContent] = useState(term?.content ?? '');
  const [last, setLast] = useState(term);
  const [lastType, setLastType] = useState(termType);
  const [touched, setTouched] = useState(false);
  if (term !== last || termType !== lastType) {
    setLast(term);
    setLastType(termType);
    setContent(term?.content ?? '');
    setTouched(false);
  }
  const errors = formErrors(mutation.error, ['content', 'documentId']);
  const contentError =
    content.trim().length < 3 ? t('tender-authoring.pricing.termRequired') : undefined;
  const close = (): void => {
    mutation.reset();
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (termType === null || contentError !== undefined) return;
    try {
      const result = await mutation.mutate({
        params: { tenderId, termType },
        body: {
          content: content.trim(),
          ...(term?.document === null || term === null
            ? {}
            : { documentId: term.document.documentId }),
        },
      });
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
        termType === null
          ? ''
          : t('tender-authoring.pricing.editTerm', {
              term: tEnum('tender_terms.term_type', termType),
            })
      }
      description={t('tender-authoring.common.materialNote')}
      submitLabel={t('tender-authoring.common.saveDraft')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      <TextArea
        label={t('tender-authoring.pricing.termContent')}
        required
        value={content}
        onChange={setContent}
        rows={8}
        error={errors.forField('content') ?? (touched ? contentError : undefined)}
      />
      {term?.document !== null && term?.document !== undefined && (
        <p className="tiq-text-muted">
          {t('tender-authoring.pricing.termDocument', { title: term.document.title })}
        </p>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Commercial settings
// ---------------------------------------------------------------------------------------------------------

export interface CommercialDialogProps {
  readonly open: boolean;
  readonly tender: TenderDetail;
  readonly onClose: () => void;
  readonly onSaved: (result: TenderUpdateResult) => void;
}

export function CommercialDialog({ open, tender, onClose, onSaved }: CommercialDialogProps) {
  const mutation = useApiMutation(updateTender);
  const initial = {
    currency: tender.currency,
    accepted: tender.acceptedCurrencies.join(', '),
    validity: tender.bidValidityDays === null ? '' : String(tender.bidValidityDays),
    alternatives: tender.alternativesAllowed,
    partial: tender.partialBidsAllowed,
  };
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState(false);
  const errors = formErrors(mutation.error, [
    'currency',
    'acceptedCurrencies',
    'bidValidityDays',
    'alternativesAllowed',
    'partialBidsAllowed',
  ]);
  const accepted = draft.accepted
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value !== '');
  const local = {
    currency: /^[A-Z]{3}$/.test(draft.currency)
      ? undefined
      : t('tender-authoring.pricing.currencyFormat'),
    accepted:
      accepted.length === 0 || accepted.some((value) => !/^[A-Z]{3}$/.test(value))
        ? t('tender-authoring.pricing.currencyFormat')
        : !accepted.includes(draft.currency)
          ? t('tender-authoring.pricing.currencyNotAccepted')
          : undefined,
  };
  const close = (): void => {
    mutation.reset();
    setDraft(initial);
    setTouched(false);
    onClose();
  };
  const submit = async (): Promise<void> => {
    setTouched(true);
    if (local.currency !== undefined || local.accepted !== undefined) return;
    try {
      const result = await mutation.mutate({
        params: { tenderId: tender.id },
        body: {
          expectedDraftRevision: tender.draftRevision,
          currency: draft.currency,
          acceptedCurrencies: accepted,
          bidValidityDays: draft.validity === '' ? null : Number(draft.validity),
          alternativesAllowed: draft.alternatives,
          partialBidsAllowed: draft.partial,
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
      title={t('tender-authoring.pricing.commercialTitle')}
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
          label={t('tender-authoring.pricing.currency')}
          required
          value={draft.currency}
          onChange={(currency) => setDraft({ ...draft, currency: currency.toUpperCase() })}
          maxLength={3}
          error={errors.forField('currency') ?? (touched ? local.currency : undefined)}
        />
        <TextField
          label={t('tender-authoring.pricing.accepted')}
          required
          hint={t('tender-authoring.pricing.acceptedHint')}
          value={draft.accepted}
          onChange={(value) => setDraft({ ...draft, accepted: value })}
          error={errors.forField('acceptedCurrencies') ?? (touched ? local.accepted : undefined)}
        />
        <NumberInput
          label={t('tender-authoring.pricing.validity')}
          value={draft.validity}
          places={0}
          onChange={(validity) => setDraft({ ...draft, validity })}
          error={errors.forField('bidValidityDays')}
        />
      </div>
      <Checkbox
        label={t('tender-authoring.fields.alternativesAllowed')}
        checked={draft.alternatives}
        onChange={(alternatives) => setDraft({ ...draft, alternatives })}
      />
      <Checkbox
        label={t('tender-authoring.fields.partialBidsAllowed')}
        checked={draft.partial}
        onChange={(partial) => setDraft({ ...draft, partial })}
      />
    </FormDialog>
  );
}
