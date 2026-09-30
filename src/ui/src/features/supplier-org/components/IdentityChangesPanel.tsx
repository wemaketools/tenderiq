/**
 * SUP-03 — the supplier's legal-identity change requests (legal name, registration, ownership, merger, succession,
 * representation transfer, administrator recovery), with filters, status and the decision. Each change is reviewed
 * with evidence; historical submissions keep their original representation.
 */

import {
  SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE,
  SUPPLIER_IDENTITY_CHANGES_STATUS,
} from '@contracts/enums';
import { suppliersEndpoints } from '@contracts/suppliers';
import type { IdentityChange } from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  OrDash,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { supplierOrgPaths } from '../lib/paths';

const SORTS = ['submittedAt', 'status', 'changeType'] as const;
const DEFAULTS = {
  status: '',
  changeType: '',
  submittedFrom: '',
  submittedTo: '',
  sort: 'submittedAt',
  dir: 'desc',
  page: 1,
  pageSize: 10,
};

export function IdentityChangesPanel() {
  const zone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-03-identity', DEFAULTS);
  const query = useApiQuery(suppliersEndpoints.listIdentityChanges, {
    query: compact({
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
  const filtered =
    filters.status !== '' ||
    filters.changeType !== '' ||
    filters.submittedFrom !== '' ||
    filters.submittedTo !== '';

  const columns: DataTableColumn<IdentityChange>[] = [
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
      id: 'effective',
      header: t('supplier-org.identity.col.effective'),
      cell: (row) =>
        row.effectiveAt === null ? <OrDash>{null}</OrDash> : formatDateTime(row.effectiveAt, zone),
    },
  ];

  return (
    <div className="tiq-stack">
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
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('supplier-org.identity.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) =>
            `${tEnum('supplier_identity_changes.change_type', row.changeType)}: ${row.proposedValue}`
          }
          rowHref={(row) => supplierOrgPaths.identityChange(row.id)}
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
