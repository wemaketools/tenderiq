/**
 * CON-11 — Closeout and continuing obligations: final acceptance, financial reconciliation, outstanding claims,
 * security release, warranties, lessons learned and retention. The closeout record is saved while in progress; closing
 * the contract is a separate, confirmed step, and surviving obligations stay tracked afterwards (FR-19).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type {
  ContractCloseout,
  ContractDetail,
  ContractDisputeView,
  ObligationRow,
} from '@contracts/contracts';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DateTimeInput,
  DetailList,
  EmptyState,
  FormErrorSummary,
  MoneyText,
  QueryView,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { SecuritiesTable } from '../components/ContractTables';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { ChecksPanel, DeadlineText, InstantText, PersonName } from '../components/shared';
import { contractErrorMessage, splitCommandError } from '../lib/errors';
import { useContractCommand } from '../lib/hooks';
import { CONTRACT_MANAGE } from '../lib/permissions';

const CLOSABLE: readonly string[] = ['expired', 'terminated'];
const FIELDS = [
  'finalAcceptanceAt',
  'reconciliationNote',
  'outstandingClaims',
  'warrantyUntil',
  'lessonsLearned',
  'retentionStart',
] as const;

interface Draft {
  finalAcceptanceAt: string | null;
  reconciliationNote: string;
  outstandingClaims: string;
  warrantyUntil: string;
  lessonsLearned: string;
  retentionStart: string;
}

function draftOf(closeout: ContractCloseout): Draft {
  return {
    finalAcceptanceAt: closeout.finalAcceptanceAt,
    reconciliationNote: closeout.reconciliationNote ?? '',
    outstandingClaims: closeout.outstandingClaims ?? '',
    warrantyUntil: closeout.warrantyUntil ?? '',
    lessonsLearned: closeout.lessonsLearned ?? '',
    retentionStart: closeout.retentionStart ?? '',
  };
}

function CloseoutForm({
  contract,
  closeout,
  editable,
}: {
  readonly contract: ContractDetail;
  readonly closeout: ContractCloseout;
  readonly editable: boolean;
}) {
  const initial = draftOf(closeout);
  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState<string | null>(null);
  const command = useContractCommand(contractsEndpoints.saveCloseout, (result) => result.message);
  const { dialogError, fieldErrors } = splitCommandError(command.error, FIELDS);
  const changed = (Object.keys(initial) as (keyof Draft)[]).filter(
    (key) => draft[key] !== initial[key],
  );
  const dirty = changed.length > 0 && saved === null;
  const set = (values: Partial<Draft>): void => {
    setSaved(null);
    setDraft((current) => ({ ...current, ...values }));
  };

  const save = async (): Promise<void> => {
    const body: Record<string, string | null> = {};
    for (const key of changed) {
      const value = draft[key];
      body[key] = value === null || value.trim() === '' ? null : value.trim();
    }
    const result = await command.run({ params: { contractId: contract.id }, body });
    if (result !== null) setSaved(result.message);
  };

  return (
    <Card
      title={t('contracts.closeout.record')}
      subtitle={t('contracts.closeout.recordHint')}
      actions={
        editable ? (
          <Button
            icon="check"
            loading={command.pending}
            disabled={changed.length === 0}
            onClick={() => void save()}
          >
            {t('contracts.closeout.save')}
          </Button>
        ) : undefined
      }
    >
      <UnsavedChangesGuard when={dirty} />
      {saved !== null && (
        <Banner tone="success" title={t('contracts.closeout.savedTitle')}>
          {saved}
        </Banner>
      )}
      <div className="tiq-form-grid">
        <DateTimeInput
          label={t('contracts.closeout.finalAcceptance')}
          value={draft.finalAcceptanceAt}
          onChange={(finalAcceptanceAt) => set({ finalAcceptanceAt })}
          timeZone={contract.timeZone}
          disabled={!editable}
          error={fieldErrors.forField('finalAcceptanceAt')}
        />
        <DateInput
          label={t('contracts.closeout.warrantyUntil')}
          value={draft.warrantyUntil}
          onChange={(warrantyUntil) => set({ warrantyUntil })}
          disabled={!editable}
          error={fieldErrors.forField('warrantyUntil')}
        />
        <DateInput
          label={t('contracts.closeout.retentionStart')}
          hint={t('contracts.closeout.retentionHint')}
          value={draft.retentionStart}
          onChange={(retentionStart) => set({ retentionStart })}
          disabled={!editable}
          error={fieldErrors.forField('retentionStart')}
        />
        <TextArea
          label={t('contracts.closeout.reconciliationNote')}
          value={draft.reconciliationNote}
          onChange={(reconciliationNote) => set({ reconciliationNote })}
          disabled={!editable}
          error={fieldErrors.forField('reconciliationNote')}
        />
        <TextArea
          label={t('contracts.closeout.claims')}
          value={draft.outstandingClaims}
          onChange={(outstandingClaims) => set({ outstandingClaims })}
          disabled={!editable}
          error={fieldErrors.forField('outstandingClaims')}
        />
        <TextArea
          label={t('contracts.closeout.lessons')}
          value={draft.lessonsLearned}
          onChange={(lessonsLearned) => set({ lessonsLearned })}
          disabled={!editable}
          error={fieldErrors.forField('lessonsLearned')}
          fieldClassName="tiq-form-full"
        />
      </div>
      {fieldErrors.other.length > 0 && <FormErrorSummary errors={fieldErrors.other} />}
      {dialogError !== null && (
        <Banner tone="error" title={dialogError.title}>
          {contractErrorMessage(dialogError)}
        </Banner>
      )}
    </Card>
  );
}

function CloseoutBody({
  contract,
  closing,
  onCloseDialog,
}: {
  readonly contract: ContractDetail;
  readonly closing: boolean;
  readonly onCloseDialog: () => void;
}) {
  const canManage = usePermission(CONTRACT_MANAGE);
  const query = useApiQuery(contractsEndpoints.closeout, { params: { contractId: contract.id } });
  const close = useContractCommand(contractsEndpoints.closeContract, (result) => result.message);

  return (
    <QueryView query={query}>
      {(closeout) => {
        const editable =
          canManage && CLOSABLE.includes(closeout.contractStatus) && closeout.status !== 'closed';
        const obligationColumns: DataTableColumn<ObligationRow>[] = [
          {
            id: 'title',
            header: t('contracts.obligations.col.title'),
            cell: (row) => (
              <>
                <span>{row.title}</span>
                <span className="tiq-cell-sub">{tEnum('obligations.kind', row.kind)}</span>
              </>
            ),
          },
          {
            id: 'party',
            header: t('contracts.obligations.col.party'),
            cell: (row) => tEnum('obligations.party', row.party),
          },
          {
            id: 'owner',
            header: t('contracts.obligations.col.owner'),
            cell: (row) => <PersonName person={row.owner} />,
          },
          {
            id: 'due',
            header: t('contracts.obligations.col.due'),
            cell: (row) => <DeadlineText deadline={row.dueAt} />,
          },
          {
            id: 'status',
            header: t('contracts.obligations.col.status'),
            cell: (row) => <StatusChip enum="obligations.status" value={row.status} size="sm" />,
          },
        ];
        const disputeColumns: DataTableColumn<ContractDisputeView>[] = [
          {
            id: 'type',
            header: t('contracts.disputes.col.type'),
            cell: (row) => tEnum('contract_disputes.dispute_type', row.disputeType),
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
            id: 'status',
            header: t('contracts.disputes.col.status'),
            cell: (row) => (
              <StatusChip enum="contract_disputes.status" value={row.status} size="sm" />
            ),
          },
        ];
        return (
          <div className="tiq-stack">
            {!CLOSABLE.includes(closeout.contractStatus) &&
              closeout.contractStatus !== 'closed' && (
                <Banner tone="info" title={t('contracts.closeout.notYet')}>
                  {t('contracts.closeout.notYetDetail', {
                    status: tEnum('contracts.status', closeout.contractStatus),
                  })}
                </Banner>
              )}
            {closeout.survivingObligations.length > 0 && (
              <Banner
                tone="warning"
                title={t('contracts.closeout.surviving', {
                  count: closeout.survivingObligations.length,
                })}
              >
                {t('contracts.closeout.survivingDetail')}
              </Banner>
            )}
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('contracts.closeout.status')}>
                <DetailList
                  items={[
                    {
                      label: t('contracts.closeout.contractStatus'),
                      value: <StatusChip enum="contracts.status" value={closeout.contractStatus} />,
                    },
                    {
                      label: t('contracts.closeout.closeoutStatus'),
                      value:
                        closeout.status === null ? (
                          t('contracts.closeout.notStarted')
                        ) : (
                          <StatusChip enum="contract_closeouts.status" value={closeout.status} />
                        ),
                    },
                    {
                      label: t('contracts.closeout.securitiesReleased'),
                      value:
                        closeout.securitiesReleased === null
                          ? null
                          : closeout.securitiesReleased
                            ? t('contracts.common.yes')
                            : t('contracts.common.no'),
                    },
                    {
                      label: t('contracts.closeout.closedBy'),
                      value: <PersonName person={closeout.closedBy} />,
                    },
                    {
                      label: t('contracts.closeout.closedAt'),
                      value: <InstantText at={closeout.closedAt} timeZone={contract.timeZone} />,
                    },
                  ]}
                />
                <ChecksPanel checks={closeout.checks} label={t('contracts.closeout.checks')} />
              </Card>
              <Card title={t('contracts.closeout.reconciliation')}>
                <DetailList
                  items={[
                    {
                      label: t('contracts.closeout.finalValue'),
                      value: <MoneyText value={closeout.reconciliation.finalValue} />,
                    },
                    {
                      label: t('contracts.financials.invoiced'),
                      value: <MoneyText value={closeout.reconciliation.invoiced} />,
                    },
                    {
                      label: t('contracts.financials.paid'),
                      value: <MoneyText value={closeout.reconciliation.paid} />,
                    },
                    {
                      label: t('contracts.closeout.invoicedUnpaid'),
                      value: <MoneyText value={closeout.reconciliation.invoicedUnpaid} />,
                    },
                    {
                      label: t('contracts.closeout.disputed'),
                      value: <MoneyText value={closeout.reconciliation.disputed} />,
                    },
                    {
                      label: t('contracts.closeout.notYetInvoiced'),
                      value: <MoneyText value={closeout.reconciliation.notYetInvoiced} />,
                    },
                  ]}
                />
              </Card>
            </div>
            <CloseoutForm
              key={closeout.closeoutId ?? 0}
              contract={contract}
              closeout={closeout}
              editable={editable}
            />
            <Card
              flush
              title={t('contracts.closeout.survivingTitle')}
              subtitle={t('contracts.closeout.survivingHint')}
            >
              <DataTable
                caption={t('contracts.closeout.survivingTitle')}
                columns={obligationColumns}
                rows={closeout.survivingObligations}
                rowKey={(row) => String(row.id)}
                empty={<EmptyState compact title={t('contracts.closeout.noSurviving')} />}
              />
            </Card>
            <Card flush title={t('contracts.securities.title')}>
              <SecuritiesTable
                contract={{ ...contract, securities: closeout.securities }}
                canRelease={canManage && contract.status !== 'closed'}
              />
            </Card>
            <Card flush title={t('contracts.closeout.disputes')}>
              <DataTable
                caption={t('contracts.closeout.disputes')}
                columns={disputeColumns}
                rows={closeout.openDisputes}
                rowKey={(row) => String(row.id)}
                empty={<EmptyState compact title={t('contracts.closeout.noDisputes')} />}
              />
            </Card>
            <ConfirmActionDialog
              open={closing}
              tone="danger"
              title={t('contracts.closeout.closeTitle')}
              scope={`${contract.reference} · ${contract.title}`}
              consequence={t('contracts.closeout.closeConsequence', {
                count: closeout.survivingObligations.length,
              })}
              confirmLabel={t('contracts.closeout.close')}
              acknowledgement={t('contracts.closeout.closeAck')}
              onConfirm={async () => {
                const result = await close.run({
                  params: { contractId: contract.id },
                  body: { confirm: true },
                });
                if (result !== null) onCloseDialog();
              }}
              onCancel={onCloseDialog}
              pending={close.pending}
              error={close.error}
            >
              <ChecksPanel checks={closeout.checks} label={t('contracts.closeout.checks')} />
            </ConfirmActionDialog>
          </div>
        );
      }}
    </QueryView>
  );
}

export default function CloseoutPage() {
  const canManage = usePermission(CONTRACT_MANAGE);
  const [closing, setClosing] = useState(false);
  return (
    <ContractWorkspace
      screen="CON-11"
      primaryAction={(contract) =>
        canManage && CLOSABLE.includes(contract.status) ? (
          <Button variant="primary" icon="archive" onClick={() => setClosing(true)}>
            {t('contracts.closeout.close')}
          </Button>
        ) : undefined
      }
    >
      {(contract) => (
        <CloseoutBody
          contract={contract}
          closing={closing}
          onCloseDialog={() => setClosing(false)}
        />
      )}
    </ContractWorkspace>
  );
}
