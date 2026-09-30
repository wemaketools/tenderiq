/**
 * Export history rows (ADM-13, REP-01, ADM-14): type, scope, format, status, requester and time, with the manifest
 * link and a download for ready exports. Downloads are audited by the API.
 */
import { Link } from 'react-router';

import type { ExportRecord } from '@contracts/reporting';

import { useActiveTenant } from '../../../app/hooks';
import { Button, DataTable, EmptyState, StatusChip } from '../../../components/ui';
import type { DataTableColumn, DataTableProps } from '../../../components/ui';
import { formatBytes, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { exportPath, useExportDownload } from '../lib/exports';

export interface ExportsTableProps extends Pick<
  DataTableProps<ExportRecord>,
  'loading' | 'error' | 'onRetry' | 'pagination' | 'sort' | 'onSortChange' | 'restricted'
> {
  readonly rows: readonly ExportRecord[] | undefined;
  readonly caption: string;
  readonly emptyTitle?: string;
}

export function ExportsTable({ rows, caption, emptyTitle, ...table }: ExportsTableProps) {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const { download, pendingId } = useExportDownload();
  const columns: DataTableColumn<ExportRecord>[] = [
    {
      id: 'exportType',
      header: t('reports.exports.col.type'),
      sortable: true,
      cell: (row) => (
        <>
          <Link to={exportPath(row.id)}>{tEnum('exports.export_type', row.exportType)}</Link>
          <span className="tiq-cell-sub">{t('reports.exports.number', { id: row.id })}</span>
        </>
      ),
    },
    {
      id: 'scope',
      header: t('reports.exports.col.scope'),
      cell: (row) => (
        <>
          <span>{row.scopeDescription}</span>
          {row.subjectLabel !== null && <span className="tiq-cell-sub">{row.subjectLabel}</span>}
        </>
      ),
    },
    {
      id: 'format',
      header: t('reports.exports.col.format'),
      cell: (row) => row.format.toUpperCase(),
    },
    {
      id: 'status',
      header: t('reports.exports.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="exports.status" value={row.status} size="sm" />
          {row.error !== null && <span className="tiq-cell-sub tiq-text-danger">{row.error}</span>}
        </>
      ),
    },
    {
      id: 'requestedAt',
      header: t('reports.exports.col.requested'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.requestedBy.fullName}</span>
          <span className="tiq-cell-sub">{formatDateTime(row.requestedAt, timeZone)}</span>
        </>
      ),
    },
    {
      id: 'file',
      header: t('reports.exports.col.file'),
      cell: (row) =>
        row.status === 'ready' ? (
          <Button
            size="sm"
            icon="download"
            loading={pendingId === row.id}
            onClick={() => void download(row.id)}
            aria-label={t('reports.exports.downloadNamed', { id: row.id })}
          >
            {row.sizeBytes === null
              ? t('reports.exports.download')
              : t('reports.exports.downloadSize', { size: formatBytes(row.sizeBytes) })}
          </Button>
        ) : (
          <span className="tiq-text-muted">{t('reports.exports.notReady')}</span>
        ),
    },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.id)}
      empty={
        <EmptyState compact icon="download" title={emptyTitle ?? t('reports.exports.empty')} />
      }
      {...table}
    />
  );
}
