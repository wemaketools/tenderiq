/**
 * DocumentList: the document panel of a record (buyer or supplier side): title and purpose linking to the document
 * viewer (COM-07), classification (with redacted-copy marker), current version, status and update time, with
 * download and version history per row, and "Add document" when the caller may upload. Sealed and restricted
 * documents appear only where the API lets the caller read them.
 */
import { useState } from 'react';

import { listBuyerDocuments, listSupplierDocuments } from '@contracts/documents';
import type { DocumentSummary } from '@contracts/documents';
import type { DocumentsClassification, DocumentsRelatedType } from '@contracts/enums';

import { invalidateApiQueries, useApiQuery } from '../../api/hooks';
import { useActiveTenant } from '../../app/hooks';
import { formatDateTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import type { DataTableSort } from '../ui/DataTable';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { StatusChip } from '../ui/StatusChip';
import { useToast } from '../ui/toastContext';
import { Reference } from '../ui/Values';
import { ClassificationBadge } from './ClassificationBadge';
import { DocumentUploader } from './DocumentUploader';
import { DocumentVersionHistory } from './DocumentVersionHistory';
import { DownloadVersionButton } from './DownloadVersionButton';

export interface DocumentListProps {
  readonly audience: 'buyer' | 'supplier';
  readonly relatedType: DocumentsRelatedType;
  readonly relatedId: number;
  readonly title?: string;
  /** Shows "Add document" (the API still checks the permission). */
  readonly canUpload?: boolean;
  readonly defaultClassification?: DocumentsClassification;
  readonly classifications?: readonly DocumentsClassification[];
}

type SortKey = 'title' | 'updatedAt' | 'precedence' | 'status';

export function DocumentList({
  audience,
  relatedType,
  relatedId,
  title,
  canUpload = false,
  defaultClassification = audience === 'buyer' ? 'buyer_internal' : 'supplier_private',
  classifications,
}: DocumentListProps) {
  const tenant = useActiveTenant();
  const toast = useToast();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<DataTableSort>({ key: 'updatedAt', dir: 'desc' });
  const [historyOf, setHistoryOf] = useState<DocumentSummary | null>(null);
  const [uploading, setUploading] = useState(false);

  const endpoint = (
    audience === 'buyer' ? listBuyerDocuments : listSupplierDocuments
  ) as typeof listBuyerDocuments;
  const query = useApiQuery(endpoint, {
    query: { relatedType, relatedId, page, pageSize, sort: sort.key as SortKey, dir: sort.dir },
  });

  return (
    <Card
      flush
      title={title ?? t('documentWidget.panel.title')}
      actions={
        canUpload ? (
          <Button size="sm" icon="upload" onClick={() => setUploading(true)}>
            {t('documentWidget.panel.add')}
          </Button>
        ) : undefined
      }
    >
      <DataTable
        caption={title ?? t('documentWidget.panel.title')}
        rows={query.data?.items}
        loading={query.status === 'loading'}
        error={query.error}
        onRetry={query.reload}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        empty={<EmptyState compact icon="files" title={t('documentWidget.panel.empty')} />}
        pagination={
          query.data === undefined
            ? undefined
            : {
                page: query.data.page,
                pageSize: query.data.pageSize,
                total: query.data.total,
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                },
              }
        }
        columns={[
          {
            id: 'title',
            header: t('documentWidget.col.title'),
            sortable: true,
            cell: (row) => (
              <>
                <Reference value={row.title} to={`/me/documents/${row.id}`} />
                {row.purpose !== null && <span className="tiq-cell-sub">{row.purpose}</span>}
              </>
            ),
          },
          {
            id: 'classification',
            header: t('documentWidget.col.classification'),
            cell: (row) => (
              <ClassificationBadge
                classification={row.classification}
                redactedCopy={row.isRedactedCopy}
              />
            ),
          },
          {
            id: 'version',
            header: t('documentWidget.col.version'),
            cell: (row) =>
              row.currentVersion === null ? (
                '—'
              ) : (
                <>
                  {t('documentWidget.versionNo', { version: row.currentVersion.versionNo })}
                  <span className="tiq-cell-sub">{row.currentVersion.fileName}</span>
                </>
              ),
          },
          {
            id: 'status',
            header: t('documentWidget.col.status'),
            sortable: true,
            cell: (row) => <StatusChip enum="documents.status" value={row.status} size="sm" />,
          },
          {
            id: 'updatedAt',
            header: t('documentWidget.col.updated'),
            sortable: true,
            cell: (row) => formatDateTime(row.updatedAt, timeZone),
          },
          {
            id: 'actions',
            header: <span className="tiq-visually-hidden">{t('documentWidget.col.actions')}</span>,
            cell: (row) => (
              <div className="tiq-row-actions">
                {row.currentVersion !== null && row.currentVersion.uploadStatus === 'confirmed' && (
                  <DownloadVersionButton
                    documentId={row.id}
                    versionId={row.currentVersion.id}
                    fileName={row.currentVersion.fileName}
                  />
                )}
                <Button size="sm" variant="ghost" icon="history" onClick={() => setHistoryOf(row)}>
                  {t('documentWidget.history')}
                </Button>
              </div>
            ),
          },
        ]}
      />
      {historyOf !== null && (
        <Dialog
          open
          size="lg"
          title={t('documentWidget.versions.title', { title: historyOf.title })}
          onClose={() => setHistoryOf(null)}
        >
          <DocumentVersionHistory documentId={historyOf.id} />
        </Dialog>
      )}
      {uploading && (
        <Dialog
          open
          size="lg"
          title={t('documentWidget.panel.add')}
          onClose={() => setUploading(false)}
        >
          <DocumentUploader
            audience={audience}
            relatedType={relatedType}
            relatedId={relatedId}
            defaultClassification={defaultClassification}
            classifications={classifications}
            onUploaded={(result) => {
              toast.show(
                t('documentWidget.upload.done', { title: result.document.title }),
                'success',
              );
              invalidateApiQueries(
                audience === 'buyer' ? 'buyer.documents.list' : 'supplier.documents.list',
              );
            }}
          />
        </Dialog>
      )}
    </Card>
  );
}
