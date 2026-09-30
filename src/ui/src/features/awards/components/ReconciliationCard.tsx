/**
 * Award totals reconciliation (BR-33): each lot's outcome, status and value, the recommendation total labelled by
 * what it represents (recommended, approved, intended or final awarded: never "awarded" before the final award,
 * BR-31), the contract allocations and what remains unallocated, with an explicit "reconciles" verdict (AC-26).
 */
import { Link } from 'react-router';

import type { AwardReconciliation } from '@contracts/awards';

import {
  Banner,
  Card,
  DataTable,
  DetailList,
  MoneyText,
  OrDash,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { valueBasisLabel } from '../lib/labels';
import { awardPaths } from '../lib/paths';

type LotTotal = AwardReconciliation['lotTotals'][number];
type Allocation = AwardReconciliation['contractAllocations'][number];

export interface ReconciliationCardProps {
  readonly reconciliation: AwardReconciliation;
}

export function ReconciliationCard({ reconciliation }: ReconciliationCardProps) {
  const lotColumns: DataTableColumn<LotTotal>[] = [
    {
      id: 'lot',
      header: t('awards.recon.col.lot'),
      cell: (row) => t('awards.common.lotNo', { no: row.lotNo }),
    },
    {
      id: 'outcome',
      header: t('awards.recon.col.outcome'),
      cell: (row) =>
        row.outcome === null ? (
          <span className="tiq-text-muted">{t('awards.recon.noOutcome')}</span>
        ) : (
          <StatusChip enum="lot_outcomes.outcome" value={row.outcome} size="sm" />
        ),
    },
    {
      id: 'status',
      header: t('awards.recon.col.status'),
      cell: (row) =>
        row.status === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="lot_outcomes.status" value={row.status} size="sm" />
        ),
    },
    {
      id: 'value',
      header: t('awards.recon.col.value'),
      numeric: true,
      cell: (row) =>
        row.awardedValue === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <MoneyText value={row.awardedValue} />
        ),
    },
  ];
  const allocationColumns: DataTableColumn<Allocation>[] = [
    {
      id: 'contract',
      header: t('awards.recon.col.contract'),
      cell: (row) => (
        <Link className="tiq-ref" to={awardPaths.contract(row.contractId)}>
          {row.contractReference}
        </Link>
      ),
    },
    {
      id: 'status',
      header: t('awards.recon.col.contractStatus'),
      cell: (row) => <StatusChip enum="contracts.status" value={row.contractStatus} size="sm" />,
    },
    {
      id: 'allocated',
      header: t('awards.recon.col.allocated'),
      numeric: true,
      cell: (row) => <MoneyText value={row.allocatedValue} />,
    },
  ];
  return (
    <Card title={t('awards.recon.title')} subtitle={t('awards.recon.subtitle')}>
      <div className="tiq-stack">
        {reconciliation.reconciles ? (
          <Banner tone="success" title={t('awards.recon.reconciles')}>
            {reconciliation.note ?? t('awards.recon.reconcilesHint')}
          </Banner>
        ) : (
          <Banner tone="error" title={t('awards.recon.doesNotReconcile')}>
            {reconciliation.note ?? t('awards.recon.doesNotReconcileHint')}
          </Banner>
        )}
        <DetailList
          items={[
            {
              label: valueBasisLabel(reconciliation.value.basis),
              value: <MoneyText value={reconciliation.value.total} />,
            },
            ...(reconciliation.value.basis === 'final_awarded' ||
            reconciliation.value.finalAwardedTotal.amount === reconciliation.value.total.amount
              ? []
              : [
                  {
                    label: valueBasisLabel('final_awarded'),
                    value: <MoneyText value={reconciliation.value.finalAwardedTotal} />,
                  },
                ]),
            {
              label: t('awards.recon.allocatedTotal'),
              value: <MoneyText value={reconciliation.allocatedTotal} />,
            },
            {
              label: t('awards.recon.unallocated'),
              value: <MoneyText value={reconciliation.unallocated} />,
            },
          ]}
        />
        <div className="tiq-grid tiq-grid--2">
          <DataTable
            caption={t('awards.recon.lotsCaption')}
            columns={lotColumns}
            rows={reconciliation.lotTotals}
            rowKey={(row) => String(row.lotId)}
          />
          <DataTable
            caption={t('awards.recon.allocationsCaption')}
            columns={allocationColumns}
            rows={reconciliation.contractAllocations}
            rowKey={(row) => `${row.contractId}-${row.lotOutcomeId}`}
            empty={<p className="tiq-text-muted">{t('awards.recon.noAllocations')}</p>}
          />
        </div>
      </div>
    </Card>
  );
}
