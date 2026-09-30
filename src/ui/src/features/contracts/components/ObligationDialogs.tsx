/**
 * Obligation commands of CON-05 / CON-06: add an obligation, milestone or deliverable; assign its owner and escalation
 * contact; escalate an overdue commitment. Consequential steps are confirmed with organization, capacity, scope and
 * result (COM-02).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { CreateObligationBody, ObligationRow } from '@contracts/contracts';
import { OBLIGATIONS_KIND, OBLIGATIONS_PARTY } from '@contracts/enums';
import type { ObligationsKind, ObligationsParty } from '@contracts/enums';
import { compare, isDecimal } from '@contracts/decimal';

import {
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  MoneyInput,
  Select,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { splitCommandError } from '../lib/errors';
import { useContractCommand } from '../lib/hooks';
import { idOf, optionalText, pick } from '../lib/lists';
import { useAssigneeOptions } from '../lib/assignees';
import { FormDialog } from './FormDialog';

const CREATE_FIELDS = [
  'kind',
  'party',
  'title',
  'description',
  'ownerUserId',
  'supplierContact',
  'dueAt',
  'recurrence',
  'acceptanceCriteria',
  'evidenceRequired',
  'consequence',
  'dependsOnId',
  'escalationUserId',
  'isPaymentMilestone',
  'amount',
  'survivesCloseout',
] as const;

type CreateField = (typeof CREATE_FIELDS)[number];

export interface CreateObligationDialogProps {
  readonly contractId: number;
  readonly contractReference: string;
  readonly currency: string;
  readonly timeZone: string;
  readonly defaultKind: ObligationsKind;
  readonly dependencies: readonly Pick<ObligationRow, 'id' | 'title'>[];
  readonly onClose: () => void;
}

export function CreateObligationDialog({
  contractId,
  contractReference,
  currency,
  timeZone,
  defaultKind,
  dependencies,
  onClose,
}: CreateObligationDialogProps) {
  const owners = useAssigneeOptions('obligation_owner');
  const [kind, setKind] = useState<string>(defaultKind);
  const [party, setParty] = useState<string>('supplier');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [evidenceRequired, setEvidenceRequired] = useState('');
  const [consequence, setConsequence] = useState('');
  const [dependsOnId, setDependsOnId] = useState('');
  const [escalationUserId, setEscalationUserId] = useState('');
  const [isPaymentMilestone, setIsPaymentMilestone] = useState(false);
  const [amount, setAmount] = useState('');
  const [survivesCloseout, setSurvivesCloseout] = useState(false);
  const [local, setLocal] = useState<Partial<Record<CreateField, string>>>({});
  const command = useContractCommand(contractsEndpoints.createObligation, (row) =>
    t('contracts.obligations.created', { title: row.title }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, CREATE_FIELDS);
  const errorFor = (field: CreateField): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const submit = async (): Promise<void> => {
    const errors: Partial<Record<CreateField, string>> = {};
    const chosenKind = pick(kind, OBLIGATIONS_KIND);
    const chosenParty = pick(party, OBLIGATIONS_PARTY);
    if (chosenKind === undefined) errors.kind = t('contracts.obligations.form.kindRequired');
    if (chosenParty === undefined) errors.party = t('contracts.obligations.form.partyRequired');
    if (title.trim().length < 3) errors.title = t('contracts.obligations.form.titleRequired');
    if (chosenKind !== 'obligation' && dueAt === null) {
      errors.dueAt = t('contracts.obligations.form.dueRequired');
    }
    if (isPaymentMilestone && chosenKind !== 'milestone') {
      errors.isPaymentMilestone = t('contracts.obligations.form.paymentKind');
    }
    if (isPaymentMilestone && !(isDecimal(amount) && compare(amount, '0') > 0)) {
      errors.amount = t('contracts.obligations.form.amountRequired');
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0 || chosenKind === undefined || chosenParty === undefined) {
      return;
    }
    const body: CreateObligationBody = {
      kind: chosenKind,
      party: chosenParty,
      title: title.trim(),
      isPaymentMilestone,
      survivesCloseout,
    };
    const text: [keyof CreateObligationBody, string][] = [
      ['description', description],
      ['supplierContact', supplierContact],
      ['recurrence', recurrence],
      ['acceptanceCriteria', acceptanceCriteria],
      ['evidenceRequired', evidenceRequired],
      ['consequence', consequence],
    ];
    const optional: Record<string, unknown> = {};
    for (const [key, value] of text) {
      const trimmed = optionalText(value);
      if (trimmed !== undefined) optional[key] = trimmed;
    }
    const owner = idOf(ownerUserId);
    if (owner !== undefined) optional.ownerUserId = owner;
    const escalation = idOf(escalationUserId);
    if (escalation !== undefined) optional.escalationUserId = escalation;
    const dependency = idOf(dependsOnId);
    if (dependency !== undefined) optional.dependsOnId = dependency;
    if (dueAt !== null) optional.dueAt = dueAt;
    if (isPaymentMilestone) optional.amount = { amount, currency };
    const result = await command.run({
      params: { contractId },
      body: { ...body, ...optional } as CreateObligationBody,
    });
    if (result !== null) onClose();
  };

  return (
    <FormDialog
      open
      size="lg"
      title={t('contracts.obligations.form.title')}
      description={contractReference}
      submitLabel={t('contracts.obligations.form.submit')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <div className="tiq-form-grid">
        <Select
          label={t('contracts.obligations.form.kind')}
          required
          value={kind}
          options={OBLIGATIONS_KIND.map((value) => ({
            value,
            label: tEnum('obligations.kind', value),
          }))}
          onChange={setKind}
          error={errorFor('kind')}
        />
        <Select
          label={t('contracts.obligations.form.party')}
          required
          value={party}
          options={OBLIGATIONS_PARTY.map((value: ObligationsParty) => ({
            value,
            label: tEnum('obligations.party', value),
          }))}
          onChange={setParty}
          error={errorFor('party')}
        />
        <TextField
          label={t('contracts.obligations.form.titleField')}
          required
          value={title}
          onChange={setTitle}
          error={errorFor('title')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('contracts.obligations.form.description')}
          value={description}
          onChange={setDescription}
          error={errorFor('description')}
          fieldClassName="tiq-form-full"
        />
        <Select
          label={t('contracts.obligations.form.owner')}
          placeholder={t('contracts.common.select')}
          value={ownerUserId}
          options={owners.options}
          onChange={setOwnerUserId}
          error={errorFor('ownerUserId')}
        />
        <TextField
          label={t('contracts.obligations.form.supplierContact')}
          value={supplierContact}
          onChange={setSupplierContact}
          error={errorFor('supplierContact')}
        />
        <DateTimeInput
          label={t('contracts.obligations.form.due')}
          required={kind !== 'obligation'}
          value={dueAt}
          onChange={setDueAt}
          timeZone={timeZone}
          error={errorFor('dueAt')}
        />
        <TextField
          label={t('contracts.obligations.form.recurrence')}
          hint={t('contracts.obligations.form.recurrenceHint')}
          value={recurrence}
          onChange={setRecurrence}
          error={errorFor('recurrence')}
        />
        <TextArea
          label={t('contracts.obligations.form.criteria')}
          value={acceptanceCriteria}
          onChange={setAcceptanceCriteria}
          error={errorFor('acceptanceCriteria')}
        />
        <TextArea
          label={t('contracts.obligations.form.evidence')}
          value={evidenceRequired}
          onChange={setEvidenceRequired}
          error={errorFor('evidenceRequired')}
        />
        <TextArea
          label={t('contracts.obligations.form.consequence')}
          value={consequence}
          onChange={setConsequence}
          error={errorFor('consequence')}
        />
        <Select
          label={t('contracts.obligations.form.dependsOn')}
          placeholder={t('contracts.common.none')}
          value={dependsOnId}
          options={dependencies.map((item) => ({ value: String(item.id), label: item.title }))}
          onChange={setDependsOnId}
          error={errorFor('dependsOnId')}
        />
        <Select
          label={t('contracts.obligations.form.escalation')}
          placeholder={t('contracts.common.select')}
          value={escalationUserId}
          options={owners.options}
          onChange={setEscalationUserId}
          error={errorFor('escalationUserId')}
        />
        <Checkbox
          label={t('contracts.obligations.form.payment')}
          hint={t('contracts.obligations.form.paymentHint')}
          checked={isPaymentMilestone}
          onChange={setIsPaymentMilestone}
          error={errorFor('isPaymentMilestone')}
        />
        {isPaymentMilestone && (
          <MoneyInput
            label={t('contracts.obligations.form.amount')}
            required
            value={{ amount, currency }}
            currencies={[currency]}
            onChange={(value) => setAmount(value.amount)}
            error={errorFor('amount')}
          />
        )}
        <Checkbox
          label={t('contracts.obligations.form.survives')}
          hint={t('contracts.obligations.form.survivesHint')}
          checked={survivesCloseout}
          onChange={setSurvivesCloseout}
          error={errorFor('survivesCloseout')}
        />
      </div>
    </FormDialog>
  );
}

export interface AssignObligationDialogProps {
  readonly contractId: number;
  readonly contractReference: string;
  readonly obligation: Pick<ObligationRow, 'id' | 'title' | 'owner'>;
  readonly onClose: () => void;
}

export function AssignObligationDialog({
  contractId,
  contractReference,
  obligation,
  onClose,
}: AssignObligationDialogProps) {
  const owners = useAssigneeOptions('obligation_owner');
  const [ownerUserId, setOwnerUserId] = useState(
    obligation.owner === null ? '' : String(obligation.owner.userId),
  );
  const [escalationUserId, setEscalationUserId] = useState('');
  const [missing, setMissing] = useState(false);
  const command = useContractCommand(contractsEndpoints.assignObligation, (row) =>
    t('contracts.obligations.assigned', {
      title: row.title,
      name: row.owner?.fullName ?? t('contracts.common.none'),
    }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'ownerUserId',
    'escalationUserId',
  ]);

  const confirm = async (): Promise<void> => {
    const owner = idOf(ownerUserId);
    if (owner === undefined) {
      setMissing(true);
      return;
    }
    const escalation = idOf(escalationUserId);
    const result = await command.run({
      params: { contractId, obligationId: obligation.id },
      body:
        escalation === undefined
          ? { ownerUserId: owner }
          : { ownerUserId: owner, escalationUserId: escalation },
    });
    if (result !== null) onClose();
  };

  return (
    <ConfirmActionDialog
      open
      title={t('contracts.obligations.assignTitle')}
      scope={`${contractReference} · ${obligation.title}`}
      consequence={t('contracts.obligations.assignConsequence')}
      confirmLabel={t('contracts.obligations.assign')}
      onConfirm={confirm}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      <Select
        label={t('contracts.obligations.form.owner')}
        required
        placeholder={t('contracts.common.select')}
        value={ownerUserId}
        options={owners.options}
        onChange={(value) => {
          setOwnerUserId(value);
          setMissing(false);
        }}
        error={
          fieldErrors.forField('ownerUserId') ??
          (missing ? t('contracts.obligations.form.ownerRequired') : undefined)
        }
      />
      <Select
        label={t('contracts.obligations.form.escalation')}
        placeholder={t('contracts.common.select')}
        value={escalationUserId}
        options={owners.options}
        onChange={setEscalationUserId}
        error={fieldErrors.forField('escalationUserId')}
      />
    </ConfirmActionDialog>
  );
}

export interface EscalateDialogProps {
  readonly contractId: number;
  readonly contractReference: string;
  readonly obligation: Pick<ObligationRow, 'id' | 'title'>;
  readonly onClose: () => void;
}

export function EscalateDialog({
  contractId,
  contractReference,
  obligation,
  onClose,
}: EscalateDialogProps) {
  const command = useContractCommand(
    contractsEndpoints.escalateObligation,
    (result) => result.message,
  );
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('contracts.obligations.escalateTitle')}
      scope={`${contractReference} · ${obligation.title}`}
      consequence={t('contracts.obligations.escalateConsequence')}
      confirmLabel={t('contracts.obligations.escalate')}
      reason={{ label: t('contracts.common.reason'), required: true }}
      onConfirm={async ({ reason }) => {
        const result = await command.run({
          params: { contractId, obligationId: obligation.id },
          body: { reason },
        });
        if (result !== null) onClose();
      }}
      onCancel={onClose}
      pending={command.pending}
      error={command.error}
    />
  );
}
