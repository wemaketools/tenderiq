/**
 * CON-08 — Contract financial view: award, original value, approved and pending changes, ceiling, accepted milestones,
 * invoices, payments and their sources. Every figure states its source and as-of time; estimates are flagged and
 * pending or disputed amounts are never presented as paid spend. Reconcile by recording invoices and investigate by
 * disputing them (FR-19).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type {
  ContractDetail,
  ContractFinancials,
  ContractInvoiceView,
  FinancialFigure,
} from '@contracts/contracts';
import { compare, isDecimal } from '@contracts/decimal';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DetailList,
  EmptyState,
  FooterBar,
  KpiCard,
  KpiGrid,
  MoneyInput,
  MoneyText,
  QueryView,
  Select,
  StatusChip,
  TextField,
} from '../../../components/ui';
import type { DataTableColumn, IconName } from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { FormDialog } from '../components/FormDialog';
import { splitCommandError } from '../lib/errors';
import { useContractCommand } from '../lib/hooks';
import { idOf, optionalText } from '../lib/lists';
import { CONTRACT_MANAGE } from '../lib/permissions';

function figureHint(figure: FinancialFigure, timeZone: string): string {
  const parts = [figure.source];
  if (figure.sourceSystem !== null)
    parts.push(tEnum('contract_invoices.source', figure.sourceSystem));
  parts.push(
    figure.asOf === null
      ? t('contracts.financials.noAsOf')
      : t('contracts.common.asOf', { at: formatDateTime(figure.asOf, timeZone) }),
  );
  if (figure.isEstimate) parts.push(t('contracts.financials.estimate'));
  return parts.join(' · ');
}

function Figure({
  label,
  figure,
  icon,
  tone,
  timeZone,
}: {
  readonly label: string;
  readonly figure: FinancialFigure | null;
  readonly icon: IconName;
  readonly tone?: 'accent' | 'warning' | 'danger' | 'success' | 'info';
  readonly timeZone: string;
}) {
  return (
    <KpiCard
      label={label}
      icon={icon}
      tone={tone}
      value={figure === null ? null : formatMoney(figure.amount)}
      hint={
        figure === null ? t('contracts.financials.notApplicable') : figureHint(figure, timeZone)
      }
    />
  );
}

function RecordInvoiceDialog({
  contract,
  financials,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly financials: ContractFinancials;
  readonly onClose: () => void;
}) {
  const currency = financials.currency;
  const milestones = financials.invoices
    .map((invoice) => invoice.obligation)
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const obligationsQuery = useApiQuery(contractsEndpoints.obligations, {
    params: { contractId: contract.id },
    query: { paymentMilestone: true, pageSize: 100 },
  });
  const options = (
    obligationsQuery.data?.items ??
    milestones.map((item) => ({ id: item.obligationId, title: item.title }))
  ).map((item) => ({ value: String(item.id), label: item.title }));
  const [invoiceRef, setInvoiceRef] = useState('');
  const [obligationId, setObligationId] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [note, setNote] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const command = useContractCommand(contractsEndpoints.recordInvoice, (row) =>
    t('contracts.financials.invoiceRecorded', { ref: row.invoiceRef }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'invoiceRef',
    'obligationId',
    'amount',
    'invoiceDate',
    'note',
  ]);
  const errorFor = (field: string): string | undefined =>
    local[field] ?? fieldErrors.forField(field);

  const submit = async (): Promise<void> => {
    const errors: Record<string, string> = {};
    if (invoiceRef.trim().length < 2) errors.invoiceRef = t('contracts.financials.refRequired');
    if (!(isDecimal(amount) && compare(amount, '0') > 0))
      errors.amount = t('contracts.financials.amountRequired');
    if (invoiceDate === '') errors.invoiceDate = t('contracts.financials.dateRequired');
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const obligation = idOf(obligationId);
    const text = optionalText(note);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        invoiceRef: invoiceRef.trim(),
        amount: { amount, currency },
        invoiceDate,
        ...(obligation === undefined ? {} : { obligationId: obligation }),
        ...(text === undefined ? {} : { note: text }),
      },
    });
    if (result !== null) onClose();
  };

  return (
    <FormDialog
      open
      title={t('contracts.financials.recordInvoice')}
      description={t('contracts.financials.recordInvoiceHint')}
      submitLabel={t('contracts.financials.record')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('contracts.financials.col.invoice')}
          required
          value={invoiceRef}
          onChange={setInvoiceRef}
          error={errorFor('invoiceRef')}
        />
        <DateInput
          label={t('contracts.financials.col.date')}
          required
          value={invoiceDate}
          onChange={setInvoiceDate}
          error={errorFor('invoiceDate')}
        />
        <MoneyInput
          label={t('contracts.financials.col.amount')}
          required
          value={{ amount, currency }}
          currencies={[currency]}
          onChange={(value) => setAmount(value.amount)}
          error={errorFor('amount')}
        />
        <Select
          label={t('contracts.financials.col.milestone')}
          placeholder={t('contracts.common.none')}
          value={obligationId}
          options={options}
          onChange={setObligationId}
          error={errorFor('obligationId')}
        />
        <TextField
          label={t('contracts.common.note')}
          value={note}
          onChange={setNote}
          error={errorFor('note')}
          fieldClassName="tiq-form-full"
        />
      </div>
    </FormDialog>
  );
}

function FinancialsBody({
  contract,
  recording,
  onRecorded,
}: {
  readonly contract: ContractDetail;
  readonly recording: boolean;
  readonly onRecorded: () => void;
}) {
  const canManage = usePermission(CONTRACT_MANAGE) && contract.status !== 'closed';
  const [disputing, setDisputing] = useState<ContractInvoiceView | null>(null);
  const query = useApiQuery(contractsEndpoints.financials, { params: { contractId: contract.id } });
  const dispute = useContractCommand(contractsEndpoints.disputeInvoice, (row) =>
    t('contracts.financials.disputed', { ref: row.invoiceRef }),
  );
  const tz = contract.timeZone;

  return (
    <QueryView query={query}>
      {(financials) => {
        const columns: DataTableColumn<ContractInvoiceView>[] = [
          {
            id: 'invoice',
            header: t('contracts.financials.col.invoice'),
            cell: (row) => (
              <>
                <span className="tiq-mono">{row.invoiceRef}</span>
                <span className="tiq-cell-sub">{formatCalendarDate(row.invoiceDate)}</span>
              </>
            ),
          },
          {
            id: 'milestone',
            header: t('contracts.financials.col.milestone'),
            cell: (row) =>
              row.obligation === null ? (
                <span className="tiq-text-muted">{t('contracts.common.none')}</span>
              ) : (
                <>
                  <span>{row.obligation.title}</span>
                  <span className="tiq-cell-sub">
                    {t('contracts.financials.milestoneStatus', {
                      status: tEnum('obligations.status', row.obligation.status),
                    })}
                  </span>
                </>
              ),
          },
          {
            id: 'amount',
            header: t('contracts.financials.col.amount'),
            numeric: true,
            cell: (row) => <MoneyText value={row.amount} />,
          },
          {
            id: 'acceptance',
            header: t('contracts.financials.col.acceptance'),
            cell: (row) => (
              <StatusChip
                enum="contract_invoices.acceptance_status"
                value={row.acceptanceStatus}
                size="sm"
              />
            ),
          },
          {
            id: 'payment',
            header: t('contracts.financials.col.payment'),
            cell: (row) => (
              <>
                <StatusChip
                  enum="contract_invoices.payment_status"
                  value={row.paymentStatus}
                  size="sm"
                />
                {row.disputeReason !== null && (
                  <span className="tiq-cell-sub tiq-text-danger">{row.disputeReason}</span>
                )}
              </>
            ),
          },
          {
            id: 'source',
            header: t('contracts.financials.col.source'),
            cell: (row) => (
              <>
                <span>{tEnum('contract_invoices.source', row.source)}</span>
                <span className="tiq-cell-sub">
                  {t('contracts.common.asOf', { at: formatDateTime(row.asOf, tz) })}
                </span>
              </>
            ),
          },
          ...(canManage
            ? [
                {
                  id: 'actions',
                  header: t('contracts.register.col.actions'),
                  cell: (row: ContractInvoiceView) =>
                    row.paymentStatus === 'paid' || row.paymentStatus === 'disputed' ? null : (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onClick={() => {
                          dispute.reset();
                          setDisputing(row);
                        }}
                        aria-label={t('contracts.financials.disputeFor', { ref: row.invoiceRef })}
                      >
                        {t('contracts.financials.dispute')}
                      </Button>
                    ),
                },
              ]
            : []),
        ];
        const asOf = financials.invoices.reduce<string | null>(
          (latest, invoice) => (latest === null || invoice.asOf > latest ? invoice.asOf : latest),
          financials.paid.asOf,
        );
        return (
          <div className="tiq-stack">
            <Banner tone="info" title={t('contracts.financials.rule')}>
              {t('contracts.financials.ruleDetail')}
            </Banner>
            <KpiGrid>
              <Figure
                label={t('contracts.financials.award')}
                figure={financials.awardValue}
                icon="award"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.original')}
                figure={financials.originalValue}
                icon="fileSignature"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.approvedChanges')}
                figure={financials.approvedChanges}
                icon="gitBranch"
                tone="info"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.pendingChanges')}
                figure={financials.pendingChanges}
                icon="hourglass"
                tone="warning"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.current')}
                figure={financials.currentValue}
                icon="coins"
                tone="success"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.ceiling')}
                figure={financials.ceiling}
                icon="layers"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.remaining')}
                figure={financials.remainingCeiling}
                icon="wallet"
                tone="info"
                timeZone={tz}
              />
            </KpiGrid>
            <KpiGrid>
              <Figure
                label={t('contracts.financials.accepted')}
                figure={financials.acceptedMilestones}
                icon="checkCircle"
                tone="success"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.invoiced')}
                figure={financials.invoiced}
                icon="receipt"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.approvedForPayment')}
                figure={financials.approvedForPayment}
                icon="clipboardCheck"
                tone="info"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.paid')}
                figure={financials.paid}
                icon="dollar"
                tone="success"
                timeZone={tz}
              />
              <Figure
                label={t('contracts.financials.disputedTotal')}
                figure={financials.disputed}
                icon="alertTriangle"
                tone="danger"
                timeZone={tz}
              />
            </KpiGrid>
            <div className="tiq-grid tiq-grid--sidebar">
              <Card
                flush
                title={t('contracts.financials.invoices')}
                subtitle={t('contracts.financials.invoicesHint')}
              >
                <DataTable
                  caption={t('contracts.financials.invoices')}
                  columns={columns}
                  rows={financials.invoices}
                  rowKey={(row) => String(row.id)}
                  empty={<EmptyState compact title={t('contracts.financials.noInvoices')} />}
                />
              </Card>
              <div className="tiq-stack">
                <Card title={t('contracts.financials.reconciliation')}>
                  <DetailList
                    stacked
                    items={[
                      {
                        label: t('contracts.financials.acceptedNotInvoiced'),
                        value: <MoneyText value={financials.reconciliation.acceptedNotInvoiced} />,
                      },
                      {
                        label: t('contracts.financials.invoicedNotAccepted'),
                        value: <MoneyText value={financials.reconciliation.invoicedNotAccepted} />,
                      },
                      {
                        label: t('contracts.financials.disputedInvoices'),
                        value: (
                          <Chip
                            tone={
                              financials.reconciliation.disputedInvoices > 0 ? 'danger' : 'neutral'
                            }
                            size="sm"
                          >
                            {t('contracts.financials.disputedCount', {
                              count: financials.reconciliation.disputedInvoices,
                            })}
                          </Chip>
                        ),
                      },
                    ]}
                  />
                </Card>
                <Card title={t('contracts.financials.notes')}>
                  {financials.notes.length === 0 ? (
                    <EmptyState compact title={t('contracts.financials.noNotes')} />
                  ) : (
                    <ul className="tiq-check-list">
                      {financials.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
            <FooterBar
              currency={financials.currency}
              asOf={asOf}
              timeZone={tz}
              onRefresh={query.reload}
              refreshing={query.isFetching}
            />
            {recording && (
              <RecordInvoiceDialog
                contract={contract}
                financials={financials}
                onClose={onRecorded}
              />
            )}
            {disputing !== null && (
              <ConfirmActionDialog
                open
                tone="danger"
                title={t('contracts.financials.disputeTitle')}
                scope={`${financials.reference} · ${disputing.invoiceRef} · ${formatMoney(disputing.amount)}`}
                consequence={t('contracts.financials.disputeConsequence')}
                confirmLabel={t('contracts.financials.dispute')}
                reason={{ label: t('contracts.common.reason'), required: true }}
                onConfirm={async ({ reason }) => {
                  const result = await dispute.run({
                    params: { contractId: contract.id, invoiceId: disputing.id },
                    body: { reason },
                  });
                  if (result !== null) setDisputing(null);
                }}
                onCancel={() => setDisputing(null)}
                pending={dispute.pending}
                error={dispute.error}
              />
            )}
          </div>
        );
      }}
    </QueryView>
  );
}

export default function FinancialsPage() {
  const canManage = usePermission(CONTRACT_MANAGE);
  const [recording, setRecording] = useState(false);
  return (
    <ContractWorkspace
      screen="CON-08"
      primaryAction={(contract) =>
        canManage && contract.status !== 'closed' ? (
          <Button variant="primary" icon="receipt" onClick={() => setRecording(true)}>
            {t('contracts.financials.recordInvoice')}
          </Button>
        ) : undefined
      }
    >
      {(contract) => (
        <FinancialsBody
          contract={contract}
          recording={recording}
          onRecorded={() => setRecording(false)}
        />
      )}
    </ContractWorkspace>
  );
}
