/**
 * Tables shared by the contract workspace: awarded-lot allocations (BR-33) and securities, insurance and licenses
 * with their release decisions (CON-05, CON-11).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { ContractDetail, ContractLotAllocation, ContractSecurity } from '@contracts/contracts';

import {
  Button,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  MoneyText,
  OrDash,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useContractCommand } from '../lib/hooks';
import { ApprovalSummary, InstantText } from './shared';

export function AllocationsTable({
  allocations,
}: {
  readonly allocations: readonly ContractLotAllocation[];
}) {
  const columns: DataTableColumn<ContractLotAllocation>[] = [
    {
      id: 'lot',
      header: t('contracts.overview.alloc.lot'),
      cell: (row) => (
        <>
          <span>{t('contracts.create.lotTitle', { lot: row.lotNumber, title: row.lotTitle })}</span>
          <span className="tiq-cell-sub">{row.tenderReference}</span>
        </>
      ),
    },
    {
      id: 'awarded',
      header: t('contracts.overview.alloc.awarded'),
      numeric: true,
      cell: (row) => <MoneyText value={row.awardedValue} />,
    },
    {
      id: 'allocated',
      header: t('contracts.overview.alloc.allocated'),
      numeric: true,
      cell: (row) => <MoneyText value={row.allocatedValue} />,
    },
    {
      id: 'elsewhere',
      header: t('contracts.overview.alloc.elsewhere'),
      numeric: true,
      cell: (row) => <MoneyText value={row.allocatedElsewhere} />,
    },
    {
      id: 'unallocated',
      header: t('contracts.overview.alloc.unallocated'),
      numeric: true,
      cell: (row) => <MoneyText value={row.unallocated} />,
    },
  ];
  return (
    <DataTable
      caption={t('contracts.overview.allocations')}
      columns={columns}
      rows={allocations}
      rowKey={(row) => String(row.id)}
      empty={<EmptyState compact title={t('contracts.overview.noAllocations')} />}
    />
  );
}

export function SecuritiesTable({
  contract,
  canRelease,
}: {
  readonly contract: Pick<ContractDetail, 'id' | 'reference' | 'timeZone' | 'securities'>;
  readonly canRelease: boolean;
}) {
  const [releasing, setReleasing] = useState<ContractSecurity | null>(null);
  const command = useContractCommand(contractsEndpoints.releaseSecurity, (security) =>
    t('contracts.securities.released', {
      type: tEnum('contract_securities.security_type', security.securityType),
    }),
  );
  const columns: DataTableColumn<ContractSecurity>[] = [
    {
      id: 'type',
      header: t('contracts.securities.col.type'),
      cell: (row) => (
        <>
          <span>{tEnum('contract_securities.security_type', row.securityType)}</span>
          <span className="tiq-cell-sub">
            <OrDash>{row.issuer}</OrDash>
          </span>
        </>
      ),
    },
    {
      id: 'amount',
      header: t('contracts.securities.col.amount'),
      numeric: true,
      cell: (row) => <MoneyText value={row.amount} />,
    },
    {
      id: 'expires',
      header: t('contracts.securities.col.expires'),
      cell: (row) => <InstantText at={row.expiresAt} timeZone={contract.timeZone} />,
    },
    {
      id: 'status',
      header: t('contracts.securities.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="contract_securities.status" value={row.status} size="sm" />
          {row.releasedAt !== null && (
            <span className="tiq-cell-sub">
              {t('contracts.securities.releasedAt', {
                at: formatDateTime(row.releasedAt, contract.timeZone),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'release',
      header: t('contracts.securities.col.release'),
      cell: (row) => (
        <ApprovalSummary approval={row.releaseApproval} timeZone={contract.timeZone} />
      ),
    },
    {
      id: 'evidence',
      header: t('contracts.securities.col.evidence'),
      cell: (row) => <OrDash>{row.evidence?.title}</OrDash>,
    },
    ...(canRelease
      ? [
          {
            id: 'actions',
            header: t('contracts.register.col.actions'),
            cell: (row: ContractSecurity) =>
              row.status === 'released' ? null : (
                <Button
                  size="sm"
                  onClick={() => {
                    command.reset();
                    setReleasing(row);
                  }}
                  aria-label={t('contracts.securities.releaseFor', {
                    type: tEnum('contract_securities.security_type', row.securityType),
                  })}
                >
                  {t('contracts.securities.release')}
                </Button>
              ),
          },
        ]
      : []),
  ];
  return (
    <>
      <DataTable
        caption={t('contracts.securities.title')}
        columns={columns}
        rows={contract.securities}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState compact title={t('contracts.securities.empty')} />}
      />
      {releasing !== null && (
        <ConfirmActionDialog
          open
          title={t('contracts.securities.releaseTitle')}
          scope={`${contract.reference} · ${tEnum('contract_securities.security_type', releasing.securityType)}`}
          consequence={t('contracts.securities.releaseConsequence')}
          confirmLabel={t('contracts.securities.release')}
          reason={{ label: t('contracts.common.reason'), required: true }}
          onConfirm={async ({ reason }) => {
            const result = await command.run({
              params: { contractId: contract.id, securityId: releasing.id },
              body: { reason },
            });
            if (result !== null) setReleasing(null);
          }}
          onCancel={() => setReleasing(null)}
          pending={command.pending}
          error={command.error}
        />
      )}
    </>
  );
}
