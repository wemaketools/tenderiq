/**
 * Commercial tables shared by OPS-03 (operator) and ADM-17 (buyer): entitlements with usage, service actions raised
 * by usage limits (never blocking a supplier's submission, PRD §21.1) and invoices with disputes.
 */
import type { ReactNode } from 'react';

import type { EntitlementUsage, Invoice, ServiceAction } from '@contracts/operations';

import { Chip, DataTable, EmptyState, MoneyText } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { opsLabel, personName } from '../lib/labels';
import { OpsChip } from '../components/OpsChip';

/** An entitlement quantity with its unit in the right plural form ("1 entity", "3 entities"). */
function entitlementAmount(row: Pick<EntitlementUsage, 'featureCode'>, count: number): string {
  return t(`ops.commercial.unit.${row.featureCode}`, { count });
}

export function EntitlementsTable({
  rows,
  action,
}: {
  readonly rows: readonly EntitlementUsage[];
  readonly action?: (row: EntitlementUsage) => ReactNode;
}) {
  return (
    <DataTable<EntitlementUsage>
      caption={t('ops.commercial.entitlements')}
      rows={rows}
      rowKey={(row) => row.featureCode}
      empty={<EmptyState compact title={t('ops.commercial.noEntitlements')} />}
      columns={[
        { id: 'label', header: t('ops.commercial.col.entitlement'), cell: (row) => row.label },
        {
          id: 'usage',
          header: t('ops.commercial.col.usage'),
          numeric: true,
          cell: (row) => entitlementAmount(row, row.usageValue),
        },
        {
          id: 'limit',
          header: t('ops.commercial.col.limit'),
          numeric: true,
          cell: (row) =>
            row.limitValue === null
              ? t('ops.plans.included')
              : entitlementAmount(row, row.limitValue),
        },
        {
          id: 'state',
          header: t('ops.commercial.col.state'),
          cell: (row) =>
            row.limitReached ? (
              <Chip tone="warning" size="sm" icon="alertTriangle">
                {t('ops.commercial.limitReached')}
              </Chip>
            ) : (
              <Chip tone="success" size="sm">
                {t('ops.commercial.withinLimit')}
              </Chip>
            ),
        },
        ...(action === undefined
          ? []
          : [{ id: 'actions', header: t('ops.common.actions'), cell: action }]),
      ]}
    />
  );
}

export function ServiceActionsTable({
  rows,
  timeZone,
  action,
}: {
  readonly rows: readonly ServiceAction[];
  readonly timeZone: string;
  readonly action?: (row: ServiceAction) => ReactNode;
}) {
  return (
    <DataTable<ServiceAction>
      caption={t('ops.commercial.serviceActions')}
      rows={rows}
      rowKey={(row) => String(row.id)}
      empty={<EmptyState compact title={t('ops.commercial.noActions')} />}
      columns={[
        {
          id: 'description',
          header: t('ops.commercial.col.action'),
          width: '36%',
          cell: (row) => (
            <>
              {row.description}
              <div className="tiq-cell-sub">
                {t('ops.commercial.feature')}: {opsLabel('feature', row.featureCode)}
              </div>
              {!row.blocksSubmissions && (
                <div className="tiq-cell-sub">{t('ops.commercial.neverBlocks')}</div>
              )}
            </>
          ),
        },
        {
          id: 'status',
          header: t('ops.commercial.col.status'),
          cell: (row) => <OpsChip kind="serviceAction" value={row.status} size="sm" />,
        },
        {
          id: 'owner',
          header: t('ops.commercial.col.owner'),
          cell: (row) => personName(row.owner),
        },
        {
          id: 'raised',
          header: t('ops.commercial.col.raised'),
          cell: (row) => formatDateTime(row.raisedAt, timeZone),
        },
        {
          id: 'resolution',
          header: t('ops.commercial.col.resolution'),
          cell: (row) =>
            row.resolution === null ? (
              <span className="tiq-text-muted">{t('ops.commercial.unresolved')}</span>
            ) : (
              <>
                {row.resolution}
                {row.resolvedAt !== null && (
                  <div className="tiq-cell-sub">{formatDateTime(row.resolvedAt, timeZone)}</div>
                )}
              </>
            ),
        },
        ...(action === undefined
          ? []
          : [{ id: 'actions', header: t('ops.common.actions'), cell: action }]),
      ]}
    />
  );
}

export function InvoicesTable({ rows }: { readonly rows: readonly Invoice[] }) {
  return (
    <DataTable<Invoice>
      caption={t('ops.commercial.invoices')}
      rows={rows}
      rowKey={(row) => String(row.id)}
      empty={<EmptyState compact title={t('ops.commercial.noInvoices')} />}
      columns={[
        {
          id: 'number',
          header: t('ops.commercial.col.invoice'),
          cell: (row) => (
            <>
              <span className="tiq-mono">{row.number}</span>
              <div className="tiq-cell-sub">{row.periodLabel}</div>
            </>
          ),
        },
        {
          id: 'issued',
          header: t('ops.commercial.col.issued'),
          cell: (row) => formatCalendarDate(row.issuedOn),
        },
        {
          id: 'due',
          header: t('ops.commercial.col.due'),
          cell: (row) => formatCalendarDate(row.dueOn),
        },
        {
          id: 'amount',
          header: t('ops.commercial.col.amount'),
          numeric: true,
          cell: (row) => <MoneyText value={row.amount} />,
        },
        {
          id: 'status',
          header: t('ops.commercial.col.status'),
          cell: (row) => (
            <div className="tiq-stack">
              <span>
                <OpsChip kind="invoice" value={row.status} size="sm" />
              </span>
              {row.disputeNote !== null && <span className="tiq-cell-sub">{row.disputeNote}</span>}
            </div>
          ),
        },
      ]}
    />
  );
}
