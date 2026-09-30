/**
 * DocumentVersionHistory (COM-07 "change history"): every version of a document, newest first, with file, size,
 * SHA-256, upload status, author, time and change note, and a download for confirmed versions.
 */
import { listMyDocumentVersions } from '@contracts/documents';

import { useApiQuery } from '../../api/hooks';
import { useActiveTenant } from '../../app/hooks';
import { browserTimeZone, formatBytes, formatOfficialTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { StatusChip } from '../ui/StatusChip';
import { DownloadVersionButton } from './DownloadVersionButton';

export interface DocumentVersionHistoryProps {
  readonly documentId: number;
  /** Hide downloads when the caller may not download (from `capabilities.canDownload`). */
  readonly canDownload?: boolean;
}

export function DocumentVersionHistory({
  documentId,
  canDownload = true,
}: DocumentVersionHistoryProps) {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? browserTimeZone();
  const query = useApiQuery(listMyDocumentVersions, { params: { documentId } });
  return (
    <DataTable
      caption={t('documentWidget.versions.caption')}
      rows={query.data?.items}
      loading={query.status === 'loading'}
      error={query.error}
      onRetry={query.reload}
      rowKey={(row) => String(row.id)}
      empty={<EmptyState compact title={t('documentWidget.versions.empty')} />}
      columns={[
        {
          id: 'version',
          header: t('documentWidget.versions.col.version'),
          numeric: true,
          cell: (row) => row.versionNo,
        },
        {
          id: 'file',
          header: t('documentWidget.versions.col.file'),
          cell: (row) => (
            <>
              {row.fileName}
              <span className="tiq-cell-sub">{formatBytes(row.sizeBytes)}</span>
            </>
          ),
        },
        {
          id: 'hash',
          header: t('documentWidget.versions.col.hash'),
          cell: (row) => (
            <span className="tiq-mono" title={row.sha256}>
              {row.sha256.slice(0, 12)}…
            </span>
          ),
        },
        {
          id: 'status',
          header: t('documentWidget.versions.col.status'),
          cell: (row) => (
            <StatusChip enum="document_versions.upload_status" value={row.uploadStatus} size="sm" />
          ),
        },
        {
          id: 'created',
          header: t('documentWidget.versions.col.created'),
          cell: (row) => (
            <>
              {formatOfficialTime(row.createdAt, timeZone)}
              <span className="tiq-cell-sub">
                {row.createdBy?.fullName ?? t('documentWidget.versions.system')}
              </span>
            </>
          ),
        },
        {
          id: 'note',
          header: t('documentWidget.versions.col.note'),
          cell: (row) => row.changeNote ?? '—',
        },
        {
          id: 'actions',
          header: (
            <span className="tiq-visually-hidden">{t('documentWidget.versions.col.actions')}</span>
          ),
          cell: (row) =>
            canDownload && row.uploadStatus === 'confirmed' ? (
              <div className="tiq-row-actions">
                <DownloadVersionButton
                  documentId={documentId}
                  versionId={row.id}
                  fileName={row.fileName}
                />
              </div>
            ) : null,
        },
      ]}
    />
  );
}
