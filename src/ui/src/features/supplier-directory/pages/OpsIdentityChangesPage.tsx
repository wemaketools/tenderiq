/**
 * Operator — legal-identity change review queue (FR-02): legal name, registration, ownership, merger, succession,
 * representation transfer and administrator recovery requests from supplier organizations, with evidence.
 */
import { useNavigate } from 'react-router';

import {
  SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE,
  SUPPLIER_IDENTITY_CHANGES_STATUS,
} from '@contracts/enums';
import { suppliersEndpoints } from '@contracts/suppliers';
import type { OpsIdentityChangeRow } from '@contracts/suppliers';

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

const SORTS = ['submittedAt', 'status', 'changeType'] as const;
const DEFAULTS = {
  q: '',
  status: '',
  changeType: '',
  submittedFrom: '',
  submittedTo: '',
  sort: 'submittedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function OpsIdentityChangesPage() {
  const navigate = useNavigate();
  const zone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-01-identity', DEFAULTS);
  const query = useApiQuery(suppliersEndpoints.listOpsIdentityChanges, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, SUPPLIER_IDENTITY_CHANGES_STATUS),
      changeType: oneOf(filters.changeType, SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE),
      submittedFrom: dateOf(filters.submittedFrom),
      submittedTo: dateOf(filters.submittedTo),
      sort: sortOf(filters.sort, SORTS, 'submittedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(suppliersEndpoints.listOpsIdentityChanges, {
    query: { pageSize: 100 },
  });
  const all = overview.data?.items ?? [];
  const count = (status: OpsIdentityChangeRow['status']): string =>
    overview.data === undefined
      ? '…'
      : formatCount(all.filter((row) => row.status === status).length);
  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.changeType !== '' ||
    filters.submittedFrom !== '' ||
    filters.submittedTo !== '';

  const columns: DataTableColumn<OpsIdentityChangeRow>[] = [
    {
      id: 'supplier',
      header: t('supplier-directory.opsIdentity.col.supplier'),
      cell: (row) => (
        <>
          <span>{row.supplier.legalName}</span>
          <span className="tiq-cell-sub">
            <StatusChip enum="tenants.status" value={row.supplier.status} size="sm" />
          </span>
        </>
      ),
    },
    {
      id: 'changeType',
      header: t('supplier-org.identity.col.type'),
      sortable: true,
      cell: (row) => tEnum('supplier_identity_changes.change_type', row.changeType),
    },
    {
      id: 'values',
      header: t('supplier-org.identity.col.values'),
      cell: (row) => (
        <>
          <span>{row.proposedValue}</span>
          <span className="tiq-cell-sub">
            {t('supplier-org.identity.previous', { value: row.previousValue ?? '—' })}
          </span>
        </>
      ),
    },
    {
      id: 'submittedAt',
      header: t('supplier-org.identity.col.submitted'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatDateTime(row.submittedAt, zone)}</span>
          <span className="tiq-cell-sub">{row.submittedBy.fullName}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('supplier-org.identity.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="supplier_identity_changes.status" value={row.status} />,
    },
    {
      id: 'reviewer',
      header: t('supplier-org.change.reviewedBy'),
      cell: (row) => row.reviewedBy?.fullName ?? <OrDash>{null}</OrDash>,
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-directory.opsIdentity.title')}
        subtitle={t('supplier-directory.opsIdentity.intro')}
      />
      <OpsReviewTabs />
      <FilterBar
        onClear={clearFilters}
        canClear={filtered}
        label={t('supplier-org.identity.filters')}
      >
        <Select
          label={t('supplier-org.identity.filterType')}
          placeholder={t('supplier-org.common.allTypes')}
          value={filters.changeType}
          options={SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE.map((value) => ({
            value,
            label: tEnum('supplier_identity_changes.change_type', value),
          }))}
          onChange={(changeType) => setFilters({ changeType, page: 1 })}
        />
        <Select
          label={t('supplier-org.identity.filterStatus')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.status}
          options={SUPPLIER_IDENTITY_CHANGES_STATUS.map((value) => ({
            value,
            label: tEnum('supplier_identity_changes.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('supplier-org.common.submittedFrom')}
          value={filters.submittedFrom}
          onChange={(submittedFrom) => setFilters({ submittedFrom, page: 1 })}
        />
        <DateInput
          label={t('supplier-org.common.submittedTo')}
          value={filters.submittedTo}
          onChange={(submittedTo) => setFilters({ submittedTo, page: 1 })}
        />
        <SearchField
          label={t('supplier-org.common.search')}
          placeholder={t('supplier-directory.opsIdentity.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={tEnum('supplier_identity_changes.status', 'submitted')}
          icon="inbox"
          tone="warning"
          value={count('submitted')}
          hint={t('supplier-directory.opsIdentity.kpi.submittedHint')}
        />
        <KpiCard
          label={tEnum('supplier_identity_changes.status', 'under_review')}
          icon="eye"
          tone="info"
          value={count('under_review')}
          hint={t('supplier-directory.opsIdentity.kpi.reviewHint')}
        />
        <KpiCard
          label={tEnum('supplier_identity_changes.status', 'approved')}
          icon="checkCircle"
          tone="success"
          value={count('approved')}
          hint={t('supplier-directory.opsIdentity.kpi.approvedHint')}
        />
        <KpiCard
          label={tEnum('supplier_identity_changes.status', 'rejected')}
          icon="xCircle"
          tone="danger"
          value={count('rejected')}
          hint={t('supplier-directory.opsIdentity.kpi.rejectedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('supplier-directory.opsIdentity.title')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) =>
            `${row.supplier.legalName}: ${tEnum('supplier_identity_changes.change_type', row.changeType)}`
          }
          onRowClick={(row) => void navigate(directoryPaths.identityChange(row.id))}
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
                  ? t('supplier-org.identity.emptyFiltered')
                  : t('supplier-org.identity.empty')
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
