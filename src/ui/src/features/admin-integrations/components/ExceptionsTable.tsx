/**
 * ADM-15 integration exceptions: the affected record, what stays unconfirmed while the exception is open (AC-33),
 * the owner and the resolution. A failed transfer stays visible until it is resolved.
 */
import type { IntegrationExceptionRow } from '@contracts/operations';

import type { ApiError } from '../../../api/client';
import { DataTable, EmptyState, StatusChip } from '../../../components/ui';
import type { DataTableSort, PaginationProps } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { personName } from '../../ops/lib/labels';

export interface ExceptionsTableProps {
  readonly rows: readonly IntegrationExceptionRow[] | undefined;
  readonly timeZone: string;
  readonly caption: string;
  readonly onOpen: (row: IntegrationExceptionRow) => void;
  readonly loading?: boolean;
  readonly error?: ApiError | null;
  readonly onRetry?: () => void;
  readonly pagination?: PaginationProps;
  readonly sort?: DataTableSort;
  readonly onSortChange?: (sort: DataTableSort) => void;
}

export function ExceptionsTable({
  rows,
  timeZone,
  caption,
  onOpen,
  loading,
  error,
  onRetry,
  pagination,
  sort,
  onSortChange,
}: ExceptionsTableProps) {
  return (
    <DataTable<IntegrationExceptionRow>
      caption={caption}
      rows={rows}
      rowKey={(row) => String(row.id)}
      loading={loading}
      error={error}
      onRetry={onRetry}
      pagination={pagination}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={onOpen}
      rowLabel={(row) => t('admin-integrations.exceptions.rowLabel', { record: row.recordLabel })}
      empty={
        <EmptyState
          compact
          icon="checkCircle"
          title={t('admin-integrations.exceptions.empty')}
          description={t('admin-integrations.exceptions.emptyHint')}
        />
      }
      columns={[
        {
          id: 'record',
          header: t('admin-integrations.exceptions.col.record'),
          width: '30%',
          cell: (row) => (
            <>
              <strong>{row.recordLabel}</strong>
              <div className="tiq-cell-sub">{row.description}</div>
            </>
          ),
        },
        {
          id: 'connectionName',
          header: t('admin-integrations.exceptions.col.connection'),
          sortable: onSortChange !== undefined,
          cell: (row) => (
            <>
              {row.connectionName}
              <div className="tiq-cell-sub">
                <StatusChip
                  enum="integration_connections.system_type"
                  value={row.systemType}
                  size="sm"
                />
              </div>
            </>
          ),
        },
        {
          id: 'effect',
          header: t('admin-integrations.exceptions.col.effect'),
          cell: (row) =>
            row.unconfirmedEffect === null ? (
              <span className="tiq-text-muted">{t('ops.common.none')}</span>
            ) : (
              <span className="tiq-text-danger">{row.unconfirmedEffect}</span>
            ),
        },
        {
          id: 'status',
          header: t('admin-integrations.exceptions.col.status'),
          sortable: onSortChange !== undefined,
          cell: (row) => <StatusChip enum="integration_exceptions.status" value={row.status} />,
        },
        {
          id: 'owner',
          header: t('admin-integrations.exceptions.col.owner'),
          cell: (row) => personName(row.owner),
        },
        {
          id: 'openedAt',
          header: t('admin-integrations.exceptions.col.opened'),
          sortable: onSortChange !== undefined,
          cell: (row) => formatDateTime(row.openedAt, timeZone),
        },
        {
          id: 'resolvedAt',
          header: t('admin-integrations.exceptions.col.resolution'),
          sortable: onSortChange !== undefined,
          cell: (row) =>
            row.resolvedAt === null ? (
              <span className="tiq-text-warning">
                {t('admin-integrations.exceptions.unresolved')}
              </span>
            ) : (
              <>
                {formatDateTime(row.resolvedAt, timeZone)}
                {row.resolution !== null && <div className="tiq-cell-sub">{row.resolution}</div>}
              </>
            ),
        },
      ]}
    />
  );
}
