/**
 * ADM-05 commands (FR-03, BR-06, BR-07): create or end an authority limit, create or revoke a delegation (capped at
 * the delegator's own limit: the delegator's current limits are shown while choosing), create a committee, and
 * change a segregation-of-duties rule (documented alternative oversight needs a note; a control is never silently
 * disabled). Each is confirmed with the acting organization and capacity (COM-02).
 */
import { useState } from 'react';

import {
  AUTHORITY_LIMITS_DECISION_TYPE,
  AUTHORITY_LIMITS_SUBJECT_TYPE,
  COMMITTEES_PURPOSE,
  SOD_POLICIES_MODE,
} from '@contracts/enums';
import type {
  AuthorityLimitsDecisionType,
  AuthorityLimitsSubjectType,
  CommitteesPurpose,
  SodPoliciesMode,
} from '@contracts/enums';
import { orgAdminEndpoints } from '@contracts/org-admin';
import type {
  AuthorityLimitRow,
  CommitteeDetail,
  DelegationRow,
  SodPolicyRow,
} from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  MoneyInput,
  MultiSelect,
  NumberInput,
  RadioGroup,
  Select,
  TextArea,
  TextField,
  formErrors,
} from '../../../components/ui';
import { formatInstantDate, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { MemberSelect } from '../../admin-access/components/Pickers';
import { dialogError } from '../../admin-access/lib/errors';
import { useOfficialTimeZone } from '../../admin-access/lib/hooks';

function useCurrencies(): string[] {
  const tenant = useActiveTenant();
  return [tenant?.defaultCurrency ?? 'BWP'];
}

function useScopeOptions() {
  const entities = useApiQuery(orgAdminEndpoints.legalEntitiesList, {
    query: { active: true, pageSize: 100, sort: 'name' },
  });
  const categories = useApiQuery(orgAdminEndpoints.categoriesList, {
    query: { active: true, pageSize: 100, sort: 'name' },
  });
  return {
    entities: (entities.data?.items ?? []).map((row) => ({
      value: String(row.id),
      label: row.name,
    })),
    categories: (categories.data?.items ?? []).map((row) => ({
      value: String(row.id),
      label: row.name,
    })),
  };
}

const decisionOptions = () =>
  AUTHORITY_LIMITS_DECISION_TYPE.map((value) => ({
    value,
    label: tEnum('authority_limits.decision_type', value),
  }));

const LIMIT_FIELDS = [
  'subjectType',
  'subjectId',
  'decisionType',
  'maxAmount',
  'legalEntityId',
  'categoryId',
  'effectiveFrom',
  'effectiveTo',
];

export function CreateLimitDialog({
  now,
  onClose,
  onDone,
}: {
  readonly now: number;
  readonly onClose: () => void;
  readonly onDone: (row: AuthorityLimitRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const currencies = useCurrencies();
  const scope = useScopeOptions();
  const create = useApiMutation(orgAdminEndpoints.createAuthorityLimit);
  const [subjectType, setSubjectType] = useState<AuthorityLimitsSubjectType>('user');
  const [subjectId, setSubjectId] = useState('');
  const [decisionType, setDecisionType] = useState<AuthorityLimitsDecisionType | ''>('');
  const [unlimited, setUnlimited] = useState(false);
  const [amount, setAmount] = useState({ amount: '', currency: currencies[0] ?? 'BWP' });
  const [legalEntityId, setLegalEntityId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(() =>
    new Date(now).toISOString(),
  );
  const [effectiveTo, setEffectiveTo] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const roles = useApiQuery(
    orgAdminEndpoints.buyerListRoles,
    subjectType === 'role' ? { query: { active: true, pageSize: 100, sort: 'name' } } : null,
  );
  const committees = useApiQuery(
    orgAdminEndpoints.listCommittees,
    subjectType === 'committee' ? { query: { active: true, pageSize: 100 } } : null,
  );
  const server = formErrors(create.error, LIMIT_FIELDS);
  const inverted =
    effectiveFrom !== null &&
    effectiveTo !== null &&
    Date.parse(effectiveTo) <= Date.parse(effectiveFrom);
  const local: Record<string, string | undefined> = checked
    ? {
        subjectId: subjectId === '' ? t('admin-org.authority.subjectRequired') : undefined,
        decisionType: decisionType === '' ? t('admin-org.authority.decisionRequired') : undefined,
        maxAmount:
          !unlimited && amount.amount.trim() === ''
            ? t('admin-org.authority.amountRequired')
            : undefined,
        effectiveTo: inverted ? t('admin-access.common.endAfterStart') : undefined,
      }
    : {};
  const errorOf = (field: string): string | undefined => local[field] ?? server.forField(field);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-org.authority.limitTitle')}
      scope={
        decisionType === ''
          ? t('admin-org.authority.limitScope')
          : tEnum('authority_limits.decision_type', decisionType)
      }
      consequence={t('admin-org.authority.limitConsequence')}
      confirmLabel={t('admin-org.authority.createLimit')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={create.pending}
      error={dialogError(create.error, LIMIT_FIELDS)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (
          subjectId === '' ||
          decisionType === '' ||
          (!unlimited && amount.amount.trim() === '') ||
          effectiveFrom === null ||
          inverted
        )
          return;
        try {
          onDone(
            await create.mutate({
              body: {
                subjectType,
                subjectId: Number(subjectId),
                decisionType,
                maxAmount: unlimited ? null : amount,
                legalEntityId: legalEntityId === '' ? null : Number(legalEntityId),
                categoryId: categoryId === '' ? null : Number(categoryId),
                effectiveFrom,
                effectiveTo,
                reason,
              },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        <Select
          label={t('admin-org.authority.subjectType')}
          value={subjectType}
          options={AUTHORITY_LIMITS_SUBJECT_TYPE.map((value) => ({
            value,
            label: tEnum('authority_limits.subject_type', value),
          }))}
          onChange={(value) => {
            setSubjectType(value as AuthorityLimitsSubjectType);
            setSubjectId('');
          }}
          required
        />
        {subjectType === 'user' ? (
          <MemberSelect
            label={t('admin-org.authority.subject')}
            value={subjectId}
            onChange={setSubjectId}
            error={errorOf('subjectId')}
            required
          />
        ) : (
          <Select
            label={t('admin-org.authority.subject')}
            value={subjectId}
            onChange={setSubjectId}
            placeholder={t('admin-access.common.choose')}
            options={
              subjectType === 'role'
                ? (roles.data?.items ?? []).map((row) => ({
                    value: String(row.roleId),
                    label: row.name,
                  }))
                : (committees.data?.items ?? []).map((row) => ({
                    value: String(row.committeeId),
                    label: row.name,
                  }))
            }
            error={errorOf('subjectId')}
            required
          />
        )}
        <Select
          label={t('admin-org.authority.decisionType')}
          value={decisionType}
          onChange={(value) => setDecisionType(value as AuthorityLimitsDecisionType)}
          placeholder={t('admin-access.common.choose')}
          options={decisionOptions()}
          error={errorOf('decisionType')}
          required
        />
        <div className="tiq-stack">
          <MoneyInput
            label={t('admin-org.authority.maxAmount')}
            value={amount}
            onChange={setAmount}
            currencies={currencies}
            disabled={unlimited}
            error={errorOf('maxAmount')}
            required={!unlimited}
          />
          <Checkbox
            label={t('admin-org.authority.unlimited')}
            hint={t('admin-org.authority.unlimitedHint')}
            checked={unlimited}
            onChange={setUnlimited}
          />
        </div>
        <Select
          label={t('admin-org.authority.legalEntity')}
          placeholder={t('admin-org.authority.allEntities')}
          value={legalEntityId}
          options={scope.entities}
          onChange={setLegalEntityId}
          error={errorOf('legalEntityId')}
        />
        <Select
          label={t('admin-org.authority.category')}
          placeholder={t('admin-org.authority.allCategories')}
          value={categoryId}
          options={scope.categories}
          onChange={setCategoryId}
          error={errorOf('categoryId')}
        />
        <DateTimeInput
          label={t('admin-org.authority.effectiveFrom')}
          value={effectiveFrom}
          onChange={setEffectiveFrom}
          timeZone={timeZone}
          error={errorOf('effectiveFrom')}
          required
        />
        <DateTimeInput
          label={t('admin-org.authority.effectiveTo')}
          hint={t('admin-org.authority.effectiveToHint')}
          value={effectiveTo}
          onChange={setEffectiveTo}
          timeZone={timeZone}
          error={errorOf('effectiveTo')}
        />
      </div>
    </ConfirmActionDialog>
  );
}

export function EndLimitDialog({
  row,
  now,
  onClose,
  onDone,
}: {
  readonly row: AuthorityLimitRow;
  readonly now: number;
  readonly onClose: () => void;
  readonly onDone: (row: AuthorityLimitRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const end = useApiMutation(orgAdminEndpoints.endAuthorityLimit);
  const [effectiveTo, setEffectiveTo] = useState<string | null>(() => new Date(now).toISOString());
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-org.authority.endTitle')}
      scope={`${row.subject.name} · ${tEnum('authority_limits.decision_type', row.decisionType)}`}
      consequence={t('admin-org.authority.endConsequence')}
      confirmLabel={t('admin-org.authority.end')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={end.pending}
      error={dialogError(end.error, ['effectiveTo'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        if (effectiveTo === null) return;
        try {
          onDone(
            await end.mutate({ params: { limitId: row.limitId }, body: { effectiveTo, reason } }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <DateTimeInput
        label={t('admin-org.authority.effectiveTo')}
        value={effectiveTo}
        onChange={setEffectiveTo}
        timeZone={timeZone}
        required
        error={formErrors(end.error, ['effectiveTo']).forField('effectiveTo')}
      />
    </ConfirmActionDialog>
  );
}

const DELEGATION_FIELDS = [
  'delegatorUserId',
  'delegateUserId',
  'decisionTypes',
  'maxAmount',
  'legalEntityId',
  'categoryId',
  'startsAt',
  'endsAt',
];

export function CreateDelegationDialog({
  now,
  onClose,
  onDone,
}: {
  readonly now: number;
  readonly onClose: () => void;
  readonly onDone: (row: DelegationRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const currencies = useCurrencies();
  const scope = useScopeOptions();
  const create = useApiMutation(orgAdminEndpoints.createDelegation);
  const [delegator, setDelegator] = useState('');
  const [delegate, setDelegate] = useState('');
  const [decisionTypes, setDecisionTypes] = useState<string[]>([]);
  const [amount, setAmount] = useState({ amount: '', currency: currencies[0] ?? 'BWP' });
  const [legalEntityId, setLegalEntityId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startsAt, setStartsAt] = useState<string | null>(() => new Date(now).toISOString());
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const limits = useApiQuery(
    orgAdminEndpoints.listAuthorityLimits,
    delegator === ''
      ? null
      : {
          query: { userId: Number(delegator), status: ['active', 'expiring_soon'], pageSize: 100 },
        },
  );
  const server = formErrors(create.error, DELEGATION_FIELDS);
  const inverted =
    startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt);
  const local: Record<string, string | undefined> = checked
    ? {
        delegatorUserId: delegator === '' ? t('admin-access.common.personRequired') : undefined,
        delegateUserId:
          delegate === ''
            ? t('admin-access.common.personRequired')
            : delegate === delegator
              ? t('admin-org.authority.sameDelegate')
              : undefined,
        decisionTypes:
          decisionTypes.length === 0 ? t('admin-org.authority.decisionsRequired') : undefined,
        maxAmount:
          amount.amount.trim() === '' ? t('admin-org.authority.amountRequired') : undefined,
        endsAt:
          endsAt === null
            ? t('admin-org.authority.endRequired')
            : inverted
              ? t('admin-access.common.endAfterStart')
              : undefined,
      }
    : {};
  const errorOf = (field: string): string | undefined => local[field] ?? server.forField(field);
  const delegatorLimits = (limits.data?.items ?? []).filter(
    (row) => decisionTypes.length === 0 || decisionTypes.includes(row.decisionType),
  );
  return (
    <ConfirmActionDialog
      open
      title={t('admin-org.authority.delegationTitle')}
      scope={t('admin-org.authority.delegationScope', { count: decisionTypes.length })}
      consequence={t('admin-org.authority.delegationConsequence')}
      confirmLabel={t('admin-org.authority.createDelegation')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={create.pending}
      error={dialogError(create.error, DELEGATION_FIELDS)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (
          delegator === '' ||
          delegate === '' ||
          delegate === delegator ||
          decisionTypes.length === 0 ||
          amount.amount.trim() === '' ||
          startsAt === null ||
          endsAt === null ||
          inverted
        )
          return;
        try {
          onDone(
            await create.mutate({
              body: {
                delegatorUserId: Number(delegator),
                delegateUserId: Number(delegate),
                decisionTypes: decisionTypes as AuthorityLimitsDecisionType[],
                maxAmount: amount,
                legalEntityId: legalEntityId === '' ? null : Number(legalEntityId),
                categoryId: categoryId === '' ? null : Number(categoryId),
                startsAt,
                endsAt,
                reason,
              },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        <MemberSelect
          label={t('admin-org.authority.delegator')}
          value={delegator}
          onChange={setDelegator}
          error={errorOf('delegatorUserId')}
          required
        />
        <MemberSelect
          label={t('admin-org.authority.delegate')}
          value={delegate}
          onChange={setDelegate}
          exclude={delegator === '' ? [] : [Number(delegator)]}
          error={errorOf('delegateUserId')}
          required
        />
        <MultiSelect
          label={t('admin-org.authority.decisions')}
          value={decisionTypes}
          onChange={setDecisionTypes}
          options={decisionOptions()}
          error={errorOf('decisionTypes')}
          required
          fieldClassName="tiq-form-full"
        />
        <MoneyInput
          label={t('admin-org.authority.delegatedMax')}
          hint={
            delegator === ''
              ? t('admin-org.authority.capHint')
              : delegatorLimits.length === 0
                ? t('admin-org.authority.noDelegatorLimit')
                : t('admin-org.authority.delegatorLimits', {
                    limits: delegatorLimits
                      .map(
                        (row) =>
                          `${tEnum('authority_limits.decision_type', row.decisionType)}: ${[
                            row.maxAmount === null
                              ? t('admin-access.common.unlimited')
                              : formatMoney(row.maxAmount),
                            row.legalEntity?.name,
                            row.category?.name,
                            row.effectiveTo === null
                              ? undefined
                              : t('admin-access.common.until', {
                                  date: formatInstantDate(row.effectiveTo, timeZone),
                                }),
                          ]
                            .filter((part) => part !== undefined)
                            .join(', ')}`,
                      )
                      .join('; '),
                  })
          }
          value={amount}
          onChange={setAmount}
          currencies={currencies}
          error={errorOf('maxAmount')}
          required
        />
        <Select
          label={t('admin-org.authority.legalEntity')}
          placeholder={t('admin-org.authority.allEntities')}
          value={legalEntityId}
          options={scope.entities}
          onChange={setLegalEntityId}
          error={errorOf('legalEntityId')}
        />
        <Select
          label={t('admin-org.authority.category')}
          placeholder={t('admin-org.authority.allCategories')}
          value={categoryId}
          options={scope.categories}
          onChange={setCategoryId}
          error={errorOf('categoryId')}
        />
        <DateTimeInput
          label={t('admin-org.authority.startsAt')}
          value={startsAt}
          onChange={setStartsAt}
          timeZone={timeZone}
          error={errorOf('startsAt')}
          required
        />
        <DateTimeInput
          label={t('admin-org.authority.endsAt')}
          value={endsAt}
          onChange={setEndsAt}
          timeZone={timeZone}
          error={errorOf('endsAt')}
          required
        />
      </div>
    </ConfirmActionDialog>
  );
}

export function RevokeDelegationDialog({
  row,
  onClose,
  onDone,
}: {
  readonly row: DelegationRow;
  readonly onClose: () => void;
  readonly onDone: (row: DelegationRow) => void;
}) {
  const revoke = useApiMutation(orgAdminEndpoints.revokeDelegation);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t('admin-org.authority.revokeTitle')}
      scope={t('admin-org.authority.delegationLine', {
        from: row.delegator.fullName,
        to: row.delegate.fullName,
      })}
      consequence={t('admin-org.authority.revokeConsequence')}
      confirmLabel={t('admin-org.authority.revoke')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={revoke.pending}
      error={dialogError(revoke.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          onDone(
            await revoke.mutate({ params: { delegationId: row.delegationId }, body: { reason } }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}

export function CreateCommitteeDialog({
  onClose,
  onDone,
}: {
  readonly onClose: () => void;
  readonly onDone: (committee: CommitteeDetail) => void;
}) {
  const scope = useScopeOptions();
  const create = useApiMutation(orgAdminEndpoints.createCommittee);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState<CommitteesPurpose>('evaluation');
  const [quorum, setQuorum] = useState('3');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [checked, setChecked] = useState(false);
  const server = formErrors(create.error, ['name', 'purpose', 'quorum', 'legalEntityId']);
  const quorumValue = Number(quorum);
  const quorumInvalid = !Number.isInteger(quorumValue) || quorumValue < 1 || quorumValue > 25;
  return (
    <ConfirmActionDialog
      open
      title={t('admin-org.committees.createTitle')}
      scope={name.trim() === '' ? t('admin-org.committees.newCommittee') : name.trim()}
      consequence={t('admin-org.committees.createConsequence')}
      confirmLabel={t('admin-org.committees.create')}
      pending={create.pending}
      error={dialogError(create.error, ['name', 'purpose', 'quorum', 'legalEntityId'])}
      onCancel={onClose}
      onConfirm={async () => {
        setChecked(true);
        if (name.trim().length < 3 || quorumInvalid) return;
        try {
          onDone(
            await create.mutate({
              body: {
                name: name.trim(),
                purpose,
                quorum: quorumValue,
                legalEntityId: legalEntityId === '' ? null : Number(legalEntityId),
              },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('admin-org.committees.name')}
          value={name}
          onChange={setName}
          error={
            checked && name.trim().length < 3
              ? t('admin-org.committees.nameInvalid')
              : server.forField('name')
          }
          required
        />
        <Select
          label={t('admin-org.committees.purpose')}
          value={purpose}
          options={COMMITTEES_PURPOSE.map((value) => ({
            value,
            label: tEnum('committees.purpose', value),
          }))}
          onChange={(value) => setPurpose(value as CommitteesPurpose)}
          error={server.forField('purpose')}
          required
        />
        <NumberInput
          label={t('admin-org.committees.quorum')}
          hint={t('admin-org.committees.quorumHint')}
          value={quorum}
          places={0}
          onChange={setQuorum}
          error={
            checked && quorumInvalid
              ? t('admin-org.committees.quorumInvalid')
              : server.forField('quorum')
          }
          required
        />
        <Select
          label={t('admin-org.authority.legalEntity')}
          placeholder={t('admin-org.authority.allEntities')}
          value={legalEntityId}
          options={scope.entities}
          onChange={setLegalEntityId}
          error={server.forField('legalEntityId')}
        />
      </div>
    </ConfirmActionDialog>
  );
}

export function SodPolicyDialog({
  row,
  onClose,
  onDone,
}: {
  readonly row: SodPolicyRow;
  readonly onClose: () => void;
  readonly onDone: (row: SodPolicyRow) => void;
}) {
  const update = useApiMutation(orgAdminEndpoints.updateSodPolicy);
  const [mode, setMode] = useState<SodPoliciesMode>(row.mode);
  const [note, setNote] = useState(row.alternativeOversightNote ?? '');
  const [checked, setChecked] = useState(false);
  const noteInvalid = mode === 'alternative_oversight' && note.trim().length < 20;
  return (
    <ConfirmActionDialog
      open
      tone={mode === 'alternative_oversight' ? 'danger' : 'primary'}
      title={t('admin-org.sod.changeTitle')}
      scope={tEnum('sod_policies.rule_code', row.ruleCode)}
      consequence={
        mode === 'enforced'
          ? t('admin-org.sod.enforcedConsequence')
          : t('admin-org.sod.alternativeConsequence')
      }
      confirmLabel={t('admin-org.sod.save')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={update.pending}
      error={dialogError(update.error, ['mode', 'alternativeOversightNote'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (noteInvalid) return;
        try {
          onDone(
            await update.mutate({
              params: { ruleCode: row.ruleCode },
              body: {
                mode,
                alternativeOversightNote: mode === 'enforced' ? null : note.trim(),
                reason,
              },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <RadioGroup
        label={t('admin-org.sod.mode')}
        value={mode}
        onChange={(value) => setMode(value as SodPoliciesMode)}
        options={SOD_POLICIES_MODE.map((value) => ({
          value,
          label: tEnum('sod_policies.mode', value),
          hint: t(`admin-org.sod.modeHint.${value}`),
        }))}
      />
      {mode === 'alternative_oversight' && (
        <TextArea
          label={t('admin-org.sod.note')}
          hint={t('admin-org.sod.noteHint')}
          value={note}
          onChange={setNote}
          rows={4}
          required
          error={
            checked && noteInvalid
              ? t('admin-org.sod.noteRequired')
              : formErrors(update.error, ['alternativeOversightNote']).forField(
                  'alternativeOversightNote',
                )
          }
        />
      )}
    </ConfirmActionDialog>
  );
}
