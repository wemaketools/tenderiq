/**
 * Operator — possible duplicate supplier organizations (BR-44): detected or raised by a buyer, with the reason and
 * decision. A similar name or e-mail domain is never enough to merge; the review page compares the records side by
 * side and a merge never re-points historical records.
 */

import {
  DUPLICATE_CANDIDATES_DETECTED_REASON,
  DUPLICATE_CANDIDATES_STATUS,
} from '@contracts/enums';
import { suppliersEndpoints } from '@contracts/suppliers';
import type { DuplicateCandidate } from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../../supplier-org/lib/hooks';
import {
  compact,
  dateOf,
  directionOf,
  oneOf,
  sortOf,
  tableSort,
} from '../../supplier-org/lib/lists';
import { OpsReviewTabs } from '../components/OpsReviewTabs';
import { directoryPaths } from '../lib/paths';

const SORTS = ['createdAt', 'status', 'detectedReason'] as const;
const DEFAULTS = {
  q: '',
  status: '',
  detectedReason: '',
  createdFrom: '',
  createdTo: '',
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function OpsDuplicatesPage() {
  const zone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-01-duplicates', DEFAULTS);
  const query = useApiQuery(suppliersEndpoints.listDuplicates, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, DUPLICATE_CANDIDATES_STATUS),
      detectedReason: oneOf(filters.detectedReason, DUPLICATE_CANDIDATES_DETECTED_REASON),
      createdFrom: dateOf(filters.createdFrom),
      createdTo: dateOf(filters.createdTo),
      sort: sortOf(filters.sort, SORTS, 'createdAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(suppliersEndpoints.listDuplicates, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const count = (status: DuplicateCandidate['status']): string =>
    overview.data === undefined
      ? '…'
      : formatCount(all.filter((row) => row.status === status).length);
  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.detectedReason !== '' ||
    filters.createdFrom !== '' ||
    filters.createdTo !== '';

  const columns: DataTableColumn<DuplicateCandidate>[] = [
    {
      id: 'records',
      header: t('supplier-directory.duplicates.col.records'),
      cell: (row) => (
        <>
          <span>{row.tenantA.legalName}</span>
          <span className="tiq-cell-sub">
            {t('supplier-directory.duplicates.versus', { name: row.tenantB.legalName })}
          </span>
        </>
      ),
    },
    {
      id: 'detectedReason',
      header: t('supplier-directory.duplicates.reason'),
      sortable: true,
      cell: (row) => tEnum('duplicate_candidates.detected_reason', row.detectedReason),
    },
    {
      id: 'raisedBy',
      header: t('supplier-directory.duplicates.col.raisedBy'),
      cell: (row) => row.raisedBy?.tenantName ?? t('supplier-directory.duplicates.automatic'),
    },
    {
      id: 'status',
      header: t('supplier-directory.duplicates.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="duplicate_candidates.status" value={row.status} />,
    },
    {
      id: 'reviewed',
      header: t('supplier-directory.duplicates.col.reviewed'),
      cell: (row) =>
        row.reviewedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{row.reviewedBy?.fullName ?? ''}</span>
            <span className="tiq-cell-sub">{formatDateTime(row.reviewedAt, zone)}</span>
          </>
        ),
    },
    {
      id: 'createdAt',
      header: t('supplier-directory.duplicates.created'),
      sortable: true,
      cell: (row) => formatDateTime(row.createdAt, zone),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-directory.duplicates.pageTitle')}
        subtitle={t('supplier-directory.duplicates.intro')}
      />
      <OpsReviewTabs />
      <FilterBar
        onClear={clearFilters}
        canClear={filtered}
        label={t('supplier-directory.duplicates.filters')}
      >
        <Select
          label={t('supplier-directory.duplicates.status')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.status}
          options={DUPLICATE_CANDIDATES_STATUS.map((value) => ({
            value,
            label: tEnum('duplicate_candidates.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('supplier-directory.duplicates.reason')}
          placeholder={t('supplier-org.common.all')}
          value={filters.detectedReason}
          options={DUPLICATE_CANDIDATES_DETECTED_REASON.map((value) => ({
            value,
            label: tEnum('duplicate_candidates.detected_reason', value),
          }))}
          onChange={(detectedReason) => setFilters({ detectedReason, page: 1 })}
        />
        <DateInput
          label={t('supplier-directory.duplicates.createdFrom')}
          value={filters.createdFrom}
          onChange={(createdFrom) => setFilters({ createdFrom, page: 1 })}
        />
        <DateInput
          label={t('supplier-directory.duplicates.createdTo')}
          value={filters.createdTo}
          onChange={(createdTo) => setFilters({ createdTo, page: 1 })}
        />
        <SearchField
          label={t('supplier-org.common.search')}
          placeholder={t('supplier-directory.duplicates.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={tEnum('duplicate_candidates.status', 'open')}
          icon="flag"
          tone="warning"
          value={count('open')}
          hint={t('supplier-directory.duplicates.kpi.openHint')}
        />
        <KpiCard
          label={tEnum('duplicate_candidates.status', 'escalated')}
          icon="alertTriangle"
          tone="danger"
          value={count('escalated')}
          hint={t('supplier-directory.duplicates.kpi.escalatedHint')}
        />
        <KpiCard
          label={tEnum('duplicate_candidates.status', 'merged')}
          icon="gitBranch"
          tone="info"
          value={count('merged')}
          hint={t('supplier-directory.duplicates.kpi.mergedHint')}
        />
        <KpiCard
          label={tEnum('duplicate_candidates.status', 'not_duplicate')}
          icon="checkCircle"
          tone="success"
          value={count('not_duplicate')}
          hint={t('supplier-directory.duplicates.kpi.notDuplicateHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('supplier-directory.duplicates.pageTitle')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => `${row.tenantA.legalName} / ${row.tenantB.legalName}`}
          rowHref={(row) => directoryPaths.duplicate(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered
                  ? t('supplier-directory.duplicates.emptyFiltered')
                  : t('supplier-directory.duplicates.emptyOps')
              }
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
