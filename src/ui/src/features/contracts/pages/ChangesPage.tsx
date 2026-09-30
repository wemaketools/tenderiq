/**
 * CON-09 — Changes, disputes and remedies: change requests with reason, scope, cost, schedule, funding, cumulative
 * value, approvals and supplier agreement; the authority check on the CUMULATIVE value (AC-31, BR-36); claims,
 * disputes and remedies recorded only under the agreed terms and authorized decisions. Assess, request approval,
 * approve / reject / return (negotiate), withdraw and incorporate agreed changes.
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type {
  ChangeRequestDetail,
  ChangeRequestRow,
  ContractChanges,
  ContractDetail,
  ContractDisputeView,
} from '@contracts/contracts';
import {
  CHANGE_REQUESTS_RAISED_BY_PARTY,
  CHANGE_REQUESTS_STATUS,
  CONTRACT_DISPUTES_DISPUTE_TYPE,
  CONTRACT_DISPUTES_STATUS,
} from '@contracts/enums';
import { isDecimal } from '@contracts/decimal';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  Dialog,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyInput,
  MoneyText,
  NumberInput,
  OrDash,
  QueryView,
  RadioGroup,
  Select,
  StatusChip,
  TextArea,
  TextField,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AuthorityCheck } from '../components/AuthorityCheck';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { FormDialog } from '../components/FormDialog';
import { ApprovalSummary, InstantText, PersonName } from '../components/shared';
import { splitCommandError } from '../lib/errors';
import { useContractCommand, useDialog } from '../lib/hooks';
import { compact, oneOf, optionalMoney, optionalText, pick } from '../lib/lists';
import { CONTRACT_CHANGE_APPROVE, CONTRACT_MANAGE } from '../lib/permissions';

const WITHDRAWABLE: readonly string[] = [
  'draft',
  'submitted',
  'impact_assessment',
  'approval_pending',
];
const REMEDY_TYPES: readonly string[] = ['remedy', 'credit', 'penalty', 'settlement'];

function scheduleText(days: number | null): string | null {
  if (days === null) return null;
  return t('contracts.changes.scheduleDays', { count: days });
}

function NewChangeDialog({
  contract,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly onClose: () => void;
}) {
  const currency = contract.value.currency;
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [scopeChange, setScopeChange] = useState('');
  const [cost, setCost] = useState('');
  const [days, setDays] = useState('');
  const [funding, setFunding] = useState('');
  const [submit, setSubmit] = useState(true);
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.createChange, (row) =>
    t('contracts.changes.created', { number: row.displayNumber }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'title',
    'reason',
    'scopeChange',
    'costImpact',
    'scheduleImpactDays',
    'fundingNote',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const save = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (title.trim().length < 3) errors.title = t('contracts.create.errors.title');
    if (reason.trim() === '') errors.reason = t('contracts.changes.reasonRequired');
    if (cost !== '' && !isDecimal(cost)) errors.costImpact = t('contracts.changes.costInvalid');
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const costImpact = optionalMoney({ amount: cost, currency });
    const scope = optionalText(scopeChange);
    const fundingNote = optionalText(funding);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        title: title.trim(),
        reason: reason.trim(),
        submit,
        ...(costImpact === undefined ? {} : { costImpact }),
        ...(scope === undefined ? {} : { scopeChange: scope }),
        ...(fundingNote === undefined ? {} : { fundingNote }),
        ...(days === '' ? {} : { scheduleImpactDays: Number(days) }),
      },
    });
    if (result !== null) onClose();
  };

  return (
    <FormDialog
      open
      size="lg"
      title={t('contracts.changes.newTitle')}
      description={t('contracts.changes.newHint')}
      submitLabel={submit ? t('contracts.changes.submitChange') : t('contracts.changes.saveDraft')}
      onSubmit={() => void save()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('contracts.changes.col.title')}
          required
          value={title}
          onChange={setTitle}
          error={errorFor('title')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('contracts.changes.reason')}
          required
          value={reason}
          onChange={setReason}
          error={errorFor('reason')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('contracts.changes.scope')}
          value={scopeChange}
          onChange={setScopeChange}
          error={errorFor('scopeChange')}
          fieldClassName="tiq-form-full"
        />
        <MoneyInput
          label={t('contracts.changes.cost')}
          hint={t('contracts.changes.costHint')}
          value={{ amount: cost, currency }}
          currencies={[currency]}
          onChange={(value) => setCost(value.amount)}
          error={errorFor('costImpact')}
        />
        <NumberInput
          label={t('contracts.changes.schedule')}
          allowNegative
          value={days}
          onChange={setDays}
          suffix={t('contracts.changes.daysSuffix')}
          error={errorFor('scheduleImpactDays')}
        />
        <TextArea
          label={t('contracts.changes.funding')}
          value={funding}
          onChange={setFunding}
          error={errorFor('fundingNote')}
          fieldClassName="tiq-form-full"
        />
        <Checkbox
          label={t('contracts.changes.submitNow')}
          hint={t('contracts.changes.submitNowHint')}
          checked={submit}
          onChange={setSubmit}
        />
      </div>
    </FormDialog>
  );
}

function AssessDialog({
  contract,
  change,
  onClose,
  onDone,
}: {
  readonly contract: ContractDetail;
  readonly change: ChangeRequestDetail;
  readonly onClose: () => void;
  readonly onDone: () => void;
}) {
  const currency = contract.value.currency;
  const [scopeChange, setScopeChange] = useState(change.scopeChange ?? '');
  const [cost, setCost] = useState(change.costImpact?.amount ?? '');
  const [days, setDays] = useState(
    change.scheduleImpactDays === null ? '' : String(change.scheduleImpactDays),
  );
  const [funding, setFunding] = useState(change.fundingNote ?? '');
  const [assessment, setAssessment] = useState(change.impactAssessment ?? '');
  const [basis, setBasis] = useState(change.affectsProcurementBasis);
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.assessChange, (row) =>
    t('contracts.changes.assessed', { number: row.displayNumber }),
  );
  const fields = [
    'scopeChange',
    'costImpact',
    'scheduleImpactDays',
    'fundingNote',
    'impactAssessment',
    'affectsProcurementBasis',
  ];
  const { dialogError, fieldErrors } = splitCommandError(command.error, fields);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const confirm = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (scopeChange.trim() === '') errors.scopeChange = t('contracts.changes.scopeRequired');
    if (!isDecimal(cost)) errors.costImpact = t('contracts.changes.costRequired');
    if (!/^-?\d+$/.test(days)) errors.scheduleImpactDays = t('contracts.changes.daysRequired');
    if (funding.trim() === '') errors.fundingNote = t('contracts.changes.fundingRequired');
    if (assessment.trim() === '')
      errors.impactAssessment = t('contracts.changes.assessmentRequired');
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const result = await command.run({
      params: { contractId: contract.id, changeId: change.id },
      body: {
        scopeChange: scopeChange.trim(),
        costImpact: { amount: cost, currency },
        scheduleImpactDays: Number(days),
        fundingNote: funding.trim(),
        impactAssessment: assessment.trim(),
        affectsProcurementBasis: basis,
      },
    });
    if (result !== null) onDone();
  };

  return (
    <ConfirmActionDialog
      open
      title={t('contracts.changes.assessTitle')}
      scope={`${contract.reference} · ${change.displayNumber} ${change.title}`}
      consequence={t('contracts.changes.assessConsequence')}
      confirmLabel={t('contracts.changes.assess')}
      onConfirm={confirm}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      <TextArea
        label={t('contracts.changes.scope')}
        required
        value={scopeChange}
        onChange={setScopeChange}
        error={errorFor('scopeChange')}
      />
      <MoneyInput
        label={t('contracts.changes.cost')}
        required
        value={{ amount: cost, currency }}
        currencies={[currency]}
        onChange={(value) => setCost(value.amount)}
        error={errorFor('costImpact')}
      />
      <NumberInput
        label={t('contracts.changes.schedule')}
        required
        allowNegative
        value={days}
        onChange={setDays}
        suffix={t('contracts.changes.daysSuffix')}
        error={errorFor('scheduleImpactDays')}
      />
      <TextArea
        label={t('contracts.changes.funding')}
        required
        value={funding}
        onChange={setFunding}
        error={errorFor('fundingNote')}
      />
      <TextArea
        label={t('contracts.changes.assessment')}
        required
        value={assessment}
        onChange={setAssessment}
        error={errorFor('impactAssessment')}
      />
      <Checkbox
        label={t('contracts.changes.basis')}
        hint={t('contracts.changes.basisHint')}
        checked={basis}
        onChange={setBasis}
        error={errorFor('affectsProcurementBasis')}
      />
    </ConfirmActionDialog>
  );
}

type ChangeAction = 'assess' | 'request' | 'decide' | 'withdraw' | 'incorporate';

function ChangeDetailDialog({
  contract,
  change,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly change: ChangeRequestRow;
  readonly onClose: () => void;
}) {
  const canManage = usePermission(CONTRACT_MANAGE) && contract.status !== 'closed';
  const canApprove = usePermission(CONTRACT_CHANGE_APPROVE);
  const [action, setAction] = useState<ChangeAction | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'return'>('approve');
  const query = useApiQuery(contractsEndpoints.changeRequest, {
    params: { contractId: contract.id, changeId: change.id },
  });
  const request = useContractCommand(contractsEndpoints.requestChangeApproval, (row) =>
    t('contracts.changes.approvalRequested', { number: row.displayNumber }),
  );
  const decide = useContractCommand(contractsEndpoints.decideChange, (row) =>
    t('contracts.changes.decided', {
      number: row.displayNumber,
      status: tEnum('change_requests.status', row.status),
    }),
  );
  const withdraw = useContractCommand(contractsEndpoints.withdrawChange, (row) =>
    t('contracts.changes.withdrawn', { number: row.displayNumber }),
  );
  const incorporate = useContractCommand(contractsEndpoints.incorporateChange, (row) =>
    t('contracts.changes.incorporated', { number: row.displayNumber }),
  );
  const scope = `${contract.reference} · ${change.displayNumber} ${change.title}`;
  const detail = query.data;

  return (
    <>
      <Dialog
        open={action === null}
        size="lg"
        title={`${change.displayNumber} ${change.title}`}
        onClose={onClose}
      >
        <QueryView query={query}>
          {(detail) => (
            <div className="tiq-stack">
              <DetailList
                items={[
                  {
                    label: t('contracts.changes.col.status'),
                    value: <StatusChip enum="change_requests.status" value={detail.status} />,
                  },
                  {
                    label: t('contracts.changes.col.raisedBy'),
                    value: `${tEnum('change_requests.raised_by_party', detail.raisedByParty)}${
                      detail.raisedBy === null ? '' : ` · ${detail.raisedBy.fullName}`
                    }`,
                  },
                  { label: t('contracts.changes.reason'), value: detail.reason },
                  { label: t('contracts.changes.scope'), value: detail.scopeChange },
                  {
                    label: t('contracts.changes.cost'),
                    value: <MoneyText value={detail.costImpact} />,
                  },
                  {
                    label: t('contracts.changes.schedule'),
                    value: scheduleText(detail.scheduleImpactDays),
                  },
                  { label: t('contracts.changes.funding'), value: detail.fundingNote },
                  { label: t('contracts.changes.assessment'), value: detail.impactAssessment },
                  {
                    label: t('contracts.changes.col.cumulative'),
                    value: <MoneyText value={detail.cumulativeValueAfter} />,
                  },
                  {
                    label: t('contracts.changes.basis'),
                    value: detail.affectsProcurementBasis
                      ? t('contracts.common.yes')
                      : t('contracts.common.no'),
                  },
                  {
                    label: t('contracts.changes.col.agreed'),
                    value:
                      detail.supplierAgreedAt === null ? (
                        t('contracts.changes.notAgreed')
                      ) : (
                        <InstantText at={detail.supplierAgreedAt} timeZone={contract.timeZone} />
                      ),
                  },
                  {
                    label: t('contracts.changes.col.approval'),
                    value: (
                      <ApprovalSummary approval={detail.approval} timeZone={contract.timeZone} />
                    ),
                  },
                ]}
              />
              {detail.affectsProcurementBasis && (
                <Banner tone="warning" title={t('contracts.changes.basisWarning')}>
                  {t('contracts.changes.basisWarningDetail')}
                </Banner>
              )}
              {detail.authority !== null && <AuthorityCheck check={detail.authority} />}
              <div className="tiq-inline">
                {canManage &&
                  (detail.status === 'submitted' || detail.status === 'impact_assessment') && (
                    <Button onClick={() => setAction('assess')}>
                      {t('contracts.changes.assess')}
                    </Button>
                  )}
                {canManage && detail.status === 'impact_assessment' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      request.reset();
                      setAction('request');
                    }}
                  >
                    {t('contracts.changes.requestApproval')}
                  </Button>
                )}
                {canApprove && detail.status === 'approval_pending' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      decide.reset();
                      setAction('decide');
                    }}
                  >
                    {t('contracts.changes.decide')}
                  </Button>
                )}
                {canManage && detail.status === 'agreed' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      incorporate.reset();
                      setAction('incorporate');
                    }}
                  >
                    {t('contracts.changes.incorporate')}
                  </Button>
                )}
                {canManage && WITHDRAWABLE.includes(detail.status) && (
                  <Button
                    variant="danger-soft"
                    onClick={() => {
                      withdraw.reset();
                      setAction('withdraw');
                    }}
                  >
                    {t('contracts.changes.withdraw')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </QueryView>
      </Dialog>
      {detail !== undefined && (
        <>
          {action === 'assess' && (
            <AssessDialog
              contract={contract}
              change={detail}
              onClose={() => setAction(null)}
              onDone={onClose}
            />
          )}
          <ConfirmActionDialog
            open={action === 'request'}
            title={t('contracts.changes.requestTitle')}
            scope={scope}
            consequence={t('contracts.changes.requestConsequence')}
            confirmLabel={t('contracts.changes.requestApproval')}
            reason={{ label: t('contracts.changes.justification'), required: true }}
            onConfirm={async ({ reason }) => {
              const result = await request.run({
                params: { contractId: contract.id, changeId: change.id },
                body: { justification: reason },
              });
              if (result !== null) onClose();
            }}
            onCancel={() => setAction(null)}
            pending={request.pending}
            error={request.error}
          >
            {detail.authority !== null && <AuthorityCheck check={detail.authority} />}
          </ConfirmActionDialog>
          <ConfirmActionDialog
            open={action === 'decide'}
            tone={decision === 'approve' ? 'primary' : 'danger'}
            title={t('contracts.changes.decideTitle')}
            scope={scope}
            consequence={t(`contracts.changes.decideConsequence.${decision}`)}
            confirmLabel={t(`contracts.changes.decision.${decision}`)}
            reason={{ label: t('contracts.common.reason'), required: true }}
            onConfirm={async ({ reason }) => {
              const result = await decide.run({
                params: { contractId: contract.id, changeId: change.id },
                body: { decision, reason },
              });
              if (result !== null) onClose();
            }}
            onCancel={() => setAction(null)}
            pending={decide.pending}
            error={decide.error}
          >
            {detail.authority !== null && <AuthorityCheck check={detail.authority} />}
            <RadioGroup
              label={t('contracts.changes.decisionLabel')}
              inline
              value={decision}
              onChange={(value) =>
                setDecision(pick(value, ['approve', 'reject', 'return'] as const) ?? 'approve')
              }
              options={[
                { value: 'approve', label: t('contracts.changes.decision.approve') },
                { value: 'return', label: t('contracts.changes.decision.return') },
                { value: 'reject', label: t('contracts.changes.decision.reject') },
              ]}
            />
          </ConfirmActionDialog>
          <ConfirmActionDialog
            open={action === 'withdraw'}
            tone="danger"
            title={t('contracts.changes.withdrawTitle')}
            scope={scope}
            consequence={t('contracts.changes.withdrawConsequence')}
            confirmLabel={t('contracts.changes.withdraw')}
            reason={{ label: t('contracts.common.reason'), required: true }}
            onConfirm={async ({ reason }) => {
              const result = await withdraw.run({
                params: { contractId: contract.id, changeId: change.id },
                body: { reason },
              });
              if (result !== null) onClose();
            }}
            onCancel={() => setAction(null)}
            pending={withdraw.pending}
            error={withdraw.error}
          />
          <ConfirmActionDialog
            open={action === 'incorporate'}
            title={t('contracts.changes.incorporateTitle')}
            scope={scope}
            consequence={t('contracts.changes.incorporateConsequence')}
            confirmLabel={t('contracts.changes.incorporate')}
            onConfirm={async () => {
              const result = await incorporate.run({
                params: { contractId: contract.id, changeId: change.id },
              });
              if (result !== null) onClose();
            }}
            onCancel={() => setAction(null)}
            pending={incorporate.pending}
            error={incorporate.error}
          />
        </>
      )}
    </>
  );
}

function RecordDisputeDialog({
  contract,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly onClose: () => void;
}) {
  const currency = contract.value.currency;
  const [type, setType] = useState('dispute');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [basis, setBasis] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.recordDispute, (row) =>
    t('contracts.disputes.recorded', {
      type: tEnum('contract_disputes.dispute_type', row.disputeType),
    }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'disputeType',
    'amount',
    'description',
    'contractBasis',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const submit = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    const disputeType = pick(type, CONTRACT_DISPUTES_DISPUTE_TYPE);
    if (description.trim() === '') errors.description = t('contracts.disputes.descriptionRequired');
    if (REMEDY_TYPES.includes(type) && basis.trim() === '')
      errors.contractBasis = t('contracts.disputes.basisRequired');
    if (amount !== '' && !isDecimal(amount)) errors.amount = t('contracts.changes.costInvalid');
    setLocal(errors);
    if (Object.keys(errors).length > 0 || disputeType === undefined) return;
    const money = optionalMoney({ amount, currency });
    const contractBasis = optionalText(basis);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        disputeType,
        description: description.trim(),
        ...(money === undefined ? {} : { amount: money }),
        ...(contractBasis === undefined ? {} : { contractBasis }),
      },
    });
    if (result !== null) onClose();
  };

  return (
    <FormDialog
      open
      title={t('contracts.disputes.recordTitle')}
      description={t('contracts.disputes.recordHint')}
      submitLabel={t('contracts.disputes.record')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <Select
        label={t('contracts.disputes.col.type')}
        required
        value={type}
        options={CONTRACT_DISPUTES_DISPUTE_TYPE.map((value) => ({
          value,
          label: tEnum('contract_disputes.dispute_type', value),
        }))}
        onChange={setType}
        error={errorFor('disputeType')}
      />
      <MoneyInput
        label={t('contracts.disputes.col.amount')}
        value={{ amount, currency }}
        currencies={[currency]}
        onChange={(value) => setAmount(value.amount)}
        error={errorFor('amount')}
      />
      <TextArea
        label={t('contracts.disputes.col.description')}
        required
        value={description}
        onChange={setDescription}
        error={errorFor('description')}
      />
      <TextArea
        label={t('contracts.disputes.col.basis')}
        hint={t('contracts.disputes.basisHint')}
        required={REMEDY_TYPES.includes(type)}
        value={basis}
        onChange={setBasis}
        error={errorFor('contractBasis')}
      />
    </FormDialog>
  );
}

function UpdateDisputeDialog({
  contract,
  dispute,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly dispute: ContractDisputeView;
  readonly onClose: () => void;
}) {
  const [status, setStatus] = useState<string>(
    dispute.status === 'open' ? 'negotiating' : 'resolved',
  );
  const command = useContractCommand(contractsEndpoints.updateDispute, (row) =>
    t('contracts.disputes.updated', { status: tEnum('contract_disputes.status', row.status) }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, ['status']);
  const needsDecision = REMEDY_TYPES.includes(dispute.disputeType) && status === 'resolved';
  return (
    <ConfirmActionDialog
      open
      title={t('contracts.disputes.updateTitle')}
      scope={`${contract.reference} · ${tEnum('contract_disputes.dispute_type', dispute.disputeType)}`}
      consequence={t('contracts.disputes.updateConsequence')}
      confirmLabel={t('contracts.disputes.update')}
      reason={{ label: t('contracts.common.note'), required: true }}
      onConfirm={async ({ reason }) => {
        const next = pick(status, CONTRACT_DISPUTES_STATUS);
        if (next === undefined) return;
        const result = await command.run({
          params: { contractId: contract.id, disputeId: dispute.id },
          body: { status: next, note: reason },
        });
        if (result !== null) onClose();
      }}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      <Select
        label={t('contracts.disputes.col.status')}
        required
        value={status}
        options={CONTRACT_DISPUTES_STATUS.filter((value) => value !== 'open').map((value) => ({
          value,
          label: tEnum('contract_disputes.status', value),
        }))}
        onChange={setStatus}
        error={fieldErrors.forField('status')}
      />
      {needsDecision && (
        <Banner
          tone={dispute.authorizedDecision?.status === 'approved' ? 'info' : 'warning'}
          title={t('contracts.disputes.decisionNeeded')}
        >
          <ApprovalSummary approval={dispute.authorizedDecision} timeZone={contract.timeZone} />
        </Banner>
      )}
    </ConfirmActionDialog>
  );
}

function DisputesCard({
  contract,
  canManage,
}: {
  readonly contract: ContractDetail;
  readonly canManage: boolean;
}) {
  const [filters, setFilters, clearFilters] = useScreenFilters('CON-09-disputes', {
    status: '',
    type: '',
  });
  const dialog = useDialog<'record' | 'update', ContractDisputeView>();
  const query = useApiQuery(contractsEndpoints.disputes, {
    params: { contractId: contract.id },
    query: compact({
      status: oneOf(filters.status, CONTRACT_DISPUTES_STATUS),
      disputeType: oneOf(filters.type, CONTRACT_DISPUTES_DISPUTE_TYPE),
    }),
  });
  const columns: DataTableColumn<ContractDisputeView>[] = [
    {
      id: 'type',
      header: t('contracts.disputes.col.type'),
      cell: (row) => (
        <>
          <span>{tEnum('contract_disputes.dispute_type', row.disputeType)}</span>
          <span className="tiq-cell-sub">
            {row.raisedByOrganization}
            {row.raisedBy === null ? '' : ` · ${row.raisedBy.fullName}`} ·{' '}
            {formatDateTime(row.raisedAt, contract.timeZone)}
          </span>
        </>
      ),
    },
    {
      id: 'description',
      header: t('contracts.disputes.col.description'),
      cell: (row) => row.description,
    },
    {
      id: 'amount',
      header: t('contracts.disputes.col.amount'),
      numeric: true,
      cell: (row) => <MoneyText value={row.amount} />,
    },
    {
      id: 'basis',
      header: t('contracts.disputes.col.basis'),
      cell: (row) => <OrDash>{row.contractBasis}</OrDash>,
    },
    {
      id: 'status',
      header: t('contracts.disputes.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="contract_disputes.status" value={row.status} size="sm" />
          {row.resolutionNote !== null && (
            <span className="tiq-cell-sub">{row.resolutionNote}</span>
          )}
        </>
      ),
    },
    {
      id: 'decision',
      header: t('contracts.disputes.col.decision'),
      cell: (row) =>
        REMEDY_TYPES.includes(row.disputeType) ? (
          <ApprovalSummary approval={row.authorizedDecision} timeZone={contract.timeZone} />
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: t('contracts.register.col.actions'),
            cell: (row: ContractDisputeView) =>
              row.status === 'resolved' || row.status === 'withdrawn' ? null : (
                <Button size="sm" onClick={() => dialog.show('update', row)}>
                  {t('contracts.disputes.update')}
                </Button>
              ),
          },
        ]
      : []),
  ];
  return (
    <QueryView query={query}>
      {(data) => (
        <div className="tiq-stack">
          <Card
            flush
            title={t('contracts.disputes.title')}
            actions={
              canManage ? (
                <Button size="sm" icon="plus" onClick={() => dialog.show('record')}>
                  {t('contracts.disputes.recordTitle')}
                </Button>
              ) : undefined
            }
          >
            <Banner tone="info" title={t('contracts.disputes.rule')}>
              {data.remedyRule}
            </Banner>
            <FilterBar
              label={t('contracts.disputes.filters')}
              onClear={clearFilters}
              canClear={filters.status !== '' || filters.type !== ''}
            >
              <Select
                label={t('contracts.disputes.col.status')}
                placeholder={t('contracts.common.all')}
                value={filters.status}
                options={CONTRACT_DISPUTES_STATUS.map((value) => ({
                  value,
                  label: tEnum('contract_disputes.status', value),
                }))}
                onChange={(status) => setFilters({ status })}
              />
              <Select
                label={t('contracts.disputes.col.type')}
                placeholder={t('contracts.common.all')}
                value={filters.type}
                options={CONTRACT_DISPUTES_DISPUTE_TYPE.map((value) => ({
                  value,
                  label: tEnum('contract_disputes.dispute_type', value),
                }))}
                onChange={(type) => setFilters({ type })}
              />
            </FilterBar>
            <DataTable
              caption={t('contracts.disputes.title')}
              columns={columns}
              rows={data.items}
              rowKey={(row) => String(row.id)}
              loading={query.isFetching}
              empty={<EmptyState compact title={t('contracts.disputes.empty')} />}
            />
          </Card>
          {dialog.open === 'record' && (
            <RecordDisputeDialog contract={contract} onClose={dialog.close} />
          )}
          {dialog.open === 'update' && dialog.target !== null && (
            <UpdateDisputeDialog
              contract={contract}
              dispute={dialog.target}
              onClose={dialog.close}
            />
          )}
        </div>
      )}
    </QueryView>
  );
}

function ChangesTable({
  contract,
  changes,
  onOpen,
}: {
  readonly contract: ContractDetail;
  readonly changes: ContractChanges;
  readonly onOpen: (row: ChangeRequestRow) => void;
}) {
  const columns: DataTableColumn<ChangeRequestRow>[] = [
    {
      id: 'number',
      header: t('contracts.changes.col.number'),
      cell: (row) => (
        <>
          <span className="tiq-ref">{row.displayNumber}</span>
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'raisedBy',
      header: t('contracts.changes.col.raisedBy'),
      cell: (row) => (
        <>
          <span>{tEnum('change_requests.raised_by_party', row.raisedByParty)}</span>
          <span className="tiq-cell-sub">
            <PersonName person={row.raisedBy} />
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('contracts.changes.col.status'),
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="change_requests.status" value={row.status} size="sm" />
          {row.affectsProcurementBasis && (
            <Chip tone="warning" size="sm">
              {t('contracts.changes.basisChip')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'cost',
      header: t('contracts.changes.cost'),
      numeric: true,
      cell: (row) => <MoneyText value={row.costImpact} />,
    },
    {
      id: 'schedule',
      header: t('contracts.changes.schedule'),
      cell: (row) => <OrDash>{scheduleText(row.scheduleImpactDays)}</OrDash>,
    },
    {
      id: 'cumulative',
      header: t('contracts.changes.col.cumulative'),
      numeric: true,
      cell: (row) => <MoneyText value={row.cumulativeValueAfter} />,
    },
    {
      id: 'agreed',
      header: t('contracts.changes.col.agreed'),
      cell: (row) =>
        row.supplierAgreedAt === null ? (
          <span className="tiq-text-muted">{t('contracts.changes.notAgreed')}</span>
        ) : (
          <InstantText at={row.supplierAgreedAt} timeZone={contract.timeZone} />
        ),
    },
    {
      id: 'approval',
      header: t('contracts.changes.col.approval'),
      cell: (row) => <ApprovalSummary approval={row.approval} timeZone={contract.timeZone} />,
    },
  ];
  return (
    <DataTable
      caption={t('contracts.changes.title')}
      columns={columns}
      rows={changes.items}
      rowKey={(row) => String(row.id)}
      rowLabel={(row) => `${row.displayNumber} ${row.title}`}
      onRowClick={onOpen}
      empty={<EmptyState compact title={t('contracts.changes.empty')} />}
    />
  );
}

function ChangesBody({
  contract,
  creating,
  onCreated,
}: {
  readonly contract: ContractDetail;
  readonly creating: boolean;
  readonly onCreated: () => void;
}) {
  const canManage = usePermission(CONTRACT_MANAGE) && contract.status !== 'closed';
  const [filters, setFilters, clearFilters] = useScreenFilters('CON-09', { status: '', party: '' });
  const [open, setOpen] = useState<ChangeRequestRow | null>(null);
  const query = useApiQuery(contractsEndpoints.changes, {
    params: { contractId: contract.id },
    query: compact({
      status: oneOf(filters.status, CHANGE_REQUESTS_STATUS),
      raisedByParty: pick(filters.party, CHANGE_REQUESTS_RAISED_BY_PARTY),
    }),
  });
  return (
    <div className="tiq-stack">
      <FilterBar
        label={t('contracts.changes.filters')}
        onClear={clearFilters}
        canClear={filters.status !== '' || filters.party !== ''}
      >
        <Select
          label={t('contracts.changes.col.status')}
          placeholder={t('contracts.common.all')}
          value={filters.status}
          options={CHANGE_REQUESTS_STATUS.map((value) => ({
            value,
            label: tEnum('change_requests.status', value),
          }))}
          onChange={(status) => setFilters({ status })}
        />
        <Select
          label={t('contracts.changes.col.raisedBy')}
          placeholder={t('contracts.common.all')}
          value={filters.party}
          options={CHANGE_REQUESTS_RAISED_BY_PARTY.map((value) => ({
            value,
            label: tEnum('change_requests.raised_by_party', value),
          }))}
          onChange={(party) => setFilters({ party })}
        />
      </FilterBar>
      <QueryView query={query}>
        {(changes) => (
          <>
            <KpiGrid>
              <KpiCard
                label={t('contracts.changes.kpi.original')}
                icon="fileSignature"
                value={formatMoney(changes.originalValue)}
              />
              <KpiCard
                label={t('contracts.changes.kpi.approved')}
                icon="checkCircle"
                tone="success"
                value={formatMoney(changes.approvedChanges)}
                hint={t('contracts.changes.kpi.approvedHint')}
              />
              <KpiCard
                label={t('contracts.changes.kpi.pending')}
                icon="hourglass"
                tone="warning"
                value={formatMoney(changes.pendingChanges)}
                hint={t('contracts.changes.kpi.pendingHint')}
              />
              <KpiCard
                label={t('contracts.changes.kpi.exposure')}
                icon="layers"
                tone="danger"
                value={formatMoney(changes.cumulativeExposure)}
                hint={t('contracts.changes.kpi.exposureHint')}
              />
              <KpiCard
                label={t('contracts.changes.kpi.current')}
                icon="coins"
                tone="info"
                value={formatMoney(changes.currentValue)}
                hint={
                  changes.ceiling === null
                    ? t('contracts.changes.kpi.noCeiling')
                    : t('contracts.changes.kpi.ceiling', { ceiling: formatMoney(changes.ceiling) })
                }
              />
            </KpiGrid>
            {changes.pendingAuthority !== null && (
              <Card
                title={t('contracts.authority.title')}
                subtitle={t('contracts.authority.subtitle')}
              >
                <AuthorityCheck check={changes.pendingAuthority} />
              </Card>
            )}
            <Card flush title={t('contracts.changes.title')} subtitle={t('contracts.changes.hint')}>
              <ChangesTable contract={contract} changes={changes} onOpen={setOpen} />
            </Card>
          </>
        )}
      </QueryView>
      <DisputesCard contract={contract} canManage={canManage} />
      {open !== null && (
        <ChangeDetailDialog contract={contract} change={open} onClose={() => setOpen(null)} />
      )}
      {creating && <NewChangeDialog contract={contract} onClose={onCreated} />}
    </div>
  );
}

export default function ChangesPage() {
  const canManage = usePermission(CONTRACT_MANAGE);
  const [creating, setCreating] = useState(false);
  return (
    <ContractWorkspace
      screen="CON-09"
      primaryAction={(contract) =>
        canManage && contract.status !== 'closed' ? (
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t('contracts.changes.new')}
          </Button>
        ) : undefined
      }
    >
      {(contract) => (
        <ChangesBody contract={contract} creating={creating} onCreated={() => setCreating(false)} />
      )}
    </ContractWorkspace>
  );
}
