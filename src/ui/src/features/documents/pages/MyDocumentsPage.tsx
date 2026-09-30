/**
 * COM-07 index — the documents of records the caller may read in every active organization (DD-21): title,
 * related record, classification, status, current version and whether download is permitted. Released originals
 * stay distinguishable from redacted copies (PRD §14.1); sealed content is metadata only.
 */

import { MY_DOCUMENT_SORT_FIELDS, listMyDocuments } from '@contracts/documents';
import type { MyDocumentItem } from '@contracts/documents';
import {
  DOCUMENTS_CLASSIFICATION,
  DOCUMENTS_RELATED_TYPE,
  DOCUMENTS_STATUS,
} from '@contracts/enums';
import type {
  DocumentsClassification,
  DocumentsRelatedType,
  DocumentsStatus,
} from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { ClassificationBadge, DownloadVersionButton } from '../../../components/documents';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  compact,
  directionOf,
  oneOf,
  positiveId,
  triState,
  useDisplayTimeZone,
  useOrganizationOptions,
} from '../../tasks/lib/shared';
import { documentPaths, RESTRICTED_CLASSIFICATIONS } from '../lib/documents';

type SortField = (typeof MY_DOCUMENT_SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  tenant: '',
  classification: '',
  status: '',
  relatedType: '',
  redacted: '',
  updatedFrom: '',
  updatedTo: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (MY_DOCUMENT_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as SortField)
    : 'updatedAt';
}

export default function MyDocumentsPage() {
  const timeZone = useDisplayTimeZone();
  const organizations = useOrganizationOptions();
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-07', DEFAULTS);
  const overview = useApiQuery(listMyDocuments, { query: { pageSize: 100 } });
  const query = useApiQuery(listMyDocuments, {
    query: compact({
      q: filters.q.trim(),
      tenantId: positiveId(filters.tenant),
      classification: oneOf<DocumentsClassification>(
        filters.classification,
        DOCUMENTS_CLASSIFICATION,
      ),
      status: oneOf<DocumentsStatus>(filters.status, DOCUMENTS_STATUS),
      relatedType: oneOf<DocumentsRelatedType>(filters.relatedType, DOCUMENTS_RELATED_TYPE),
      redactedCopy: triState(filters.redacted),
      updatedFrom: filters.updatedFrom,
      updatedTo: filters.updatedTo,
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const all = overview.data?.items ?? [];
  const kpi = (predicate: (row: MyDocumentItem) => boolean): string =>
    overview.data === undefined ? '…' : formatCount(all.filter(predicate).length);
  const filtered = [
    filters.q,
    filters.tenant,
    filters.classification,
    filters.status,
    filters.relatedType,
    filters.redacted,
    filters.updatedFrom,
    filters.updatedTo,
  ].some((value) => value !== '');

  const columns: DataTableColumn<MyDocumentItem>[] = [
    {
      id: 'title',
      header: t('documents.list.col.document'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.title}</span>
          {row.purpose !== null && <span className="tiq-cell-sub">{row.purpose}</span>}
        </>
      ),
    },
    {
      id: 'related',
      header: t('documents.list.col.related'),
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.relatedReference ?? '—'}</span>
          <span className="tiq-cell-sub">{tEnum('documents.related_type', row.relatedType)}</span>
        </>
      ),
    },
    {
      id: 'organization',
      header: t('documents.list.col.organization'),
      cell: (row) => row.organization.tenantName,
    },
    {
      id: 'classification',
      header: t('documents.list.col.classification'),
      sortable: true,
      cell: (row) => (
        <ClassificationBadge
          classification={row.classification}
          redactedCopy={row.isRedactedCopy}
        />
      ),
    },
    {
      id: 'status',
      header: t('documents.list.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="documents.status" value={row.status} size="sm" />,
    },
    {
      id: 'version',
      header: t('documents.list.col.version'),
      cell: (row) =>
        row.currentVersion === null ? (
          <span className="tiq-text-muted">{t('documents.list.noVersion')}</span>
        ) : (
          <>
            <span>
              {t('documents.list.versionLine', { version: row.currentVersion.versionNo })}
            </span>
            <span className="tiq-cell-sub">{row.currentVersion.fileName}</span>
          </>
        ),
    },
    {
      id: 'updatedAt',
      header: t('documents.list.col.updated'),
      sortable: true,
      cell: (row) => formatInstantDate(row.updatedAt, timeZone),
    },
    {
      id: 'download',
      header: t('documents.list.col.download'),
      cell: (row) =>
        row.canDownload && row.currentVersion?.uploadStatus === 'confirmed' ? (
          <div className="tiq-row-actions">
            <DownloadVersionButton
              documentId={row.id}
              versionId={row.currentVersion.id}
              fileName={row.currentVersion.fileName}
            />
          </div>
        ) : (
          <Chip tone="neutral-outlined" size="sm" icon="lock">
            {t('documents.list.notDownloadable')}
          </Chip>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader title={t('documents.list.title')} subtitle={t('documents.list.intro')} />
      <FilterBar label={t('documents.list.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('documents.list.search')}
          placeholder={t('documents.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('documents.list.organization')}
          placeholder={t('documents.list.allOrganizations')}
          value={filters.tenant}
          options={organizations}
          onChange={(tenant) => setFilters({ tenant, page: 1 })}
        />
        <Select
          label={t('documents.list.classification')}
          placeholder={t('documents.list.allClassifications')}
          value={filters.classification}
          options={DOCUMENTS_CLASSIFICATION.map((value) => ({
            value,
            label: tEnum('documents.classification', value),
          }))}
          onChange={(classification) => setFilters({ classification, page: 1 })}
        />
        <Select
          label={t('documents.list.status')}
          placeholder={t('documents.list.allStatuses')}
          value={filters.status}
          options={DOCUMENTS_STATUS.map((value) => ({
            value,
            label: tEnum('documents.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('documents.list.relatedType')}
          placeholder={t('documents.list.allRelatedTypes')}
          value={filters.relatedType}
          options={DOCUMENTS_RELATED_TYPE.map((value) => ({
            value,
            label: tEnum('documents.related_type', value),
          }))}
          onChange={(relatedType) => setFilters({ relatedType, page: 1 })}
        />
        <Select
          label={t('documents.list.edition')}
          placeholder={t('documents.list.anyEdition')}
          value={filters.redacted}
          options={[
            { value: 'false', label: t('documents.list.originals') },
            { value: 'true', label: t('documents.list.redacted') },
          ]}
          onChange={(redacted) => setFilters({ redacted, page: 1 })}
        />
        <DateInput
          label={t('documents.list.updatedFrom')}
          value={filters.updatedFrom}
          onChange={(updatedFrom) => setFilters({ updatedFrom, page: 1 })}
        />
        <DateInput
          label={t('documents.list.updatedTo')}
          value={filters.updatedTo}
          onChange={(updatedTo) => setFilters({ updatedTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('documents.kpi.visible')}
          icon="files"
          value={overview.data === undefined ? '…' : formatCount(overview.data.total)}
          hint={t('documents.kpi.visibleHint')}
        />
        <KpiCard
          label={t('documents.kpi.restricted')}
          icon="lock"
          tone="warning"
          value={kpi((row) => RESTRICTED_CLASSIFICATIONS.includes(row.classification))}
          hint={t('documents.kpi.restrictedHint')}
        />
        <KpiCard
          label={t('documents.kpi.redacted')}
          icon="eyeOff"
          tone="info"
          value={kpi((row) => row.isRedactedCopy)}
          hint={t('documents.kpi.redactedHint')}
        />
        <KpiCard
          label={t('documents.kpi.viewOnly')}
          icon="eye"
          tone="danger"
          value={kpi((row) => !row.canDownload)}
          hint={t('documents.kpi.viewOnlyHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('documents.list.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.title}
          rowHref={(row) => documentPaths.document(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: sortField(filters.sort), dir: directionOf(filters.dir) }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="files"
              title={filtered ? t('documents.list.emptyFiltered') : t('documents.list.empty')}
            />
          }
          pagination={
            query.data === undefined
              ? undefined
              : {
                  page: query.data.page,
                  pageSize: query.data.pageSize,
                  total: query.data.total,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
    </div>
  );
}
