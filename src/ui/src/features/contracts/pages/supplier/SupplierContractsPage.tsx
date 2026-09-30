/**
 * SUP-23 — Supplier contracts and performance (list): the supplier's OWN contracts only, with signature status,
 * open and overdue obligations, pending change requests and the next official due date.
 */
import { useNavigate } from 'react-router';

import { SUPPLIER_CONTRACT_SORT_FIELDS, contractsEndpoints } from '@contracts/contracts';
import type { SupplierContractRow } from '@contracts/contracts';
import { CONTRACTS_STATUS } from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCalendarDate, formatCount } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { compact, directionOf, oneOf, pick, tableSort } from '../../lib/lists';
import { contractPaths } from '../../lib/paths';

/** Supplier-visible statuses (a supplier never sees internal drafts or reviews). */
const VISIBLE_STATUSES = CONTRACTS_STATUS.filter(
  (status) => status !== 'draft' && status !== 'under_review',
);

const DEFAULTS = {
  q: '',
  status: '',
  action: '',
  sort: 'reference',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function SupplierContractsPage() {
  const navigate = useNavigate();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-23', DEFAULTS);
  const query = useApiQuery(contractsEndpoints.supplierList, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, VISIBLE_STATUSES),
      actionRequired: filters.action === 'yes' ? true : undefined,
      sort: pick(filters.sort, SUPPLIER_CONTRACT_SORT_FIELDS),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(contractsEndpoints.supplierList, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const loading = overview.data === undefined;
  const filtered = filters.q !== '' || filters.status !== '' || filters.action !== '';

  const columns: DataTableColumn<SupplierContractRow>[] = [
    {
      id: 'reference',
      header: t('contracts.supplier.col.contract'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} to={contractPaths.supplierContract(row.id)} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'buyer',
      header: t('contracts.supplier.col.buyer'),
      cell: (row) => (
        <>
          <span>{row.buyer.name}</span>
          <span className="tiq-cell-sub">{row.legalEntity.name}</span>
        </>
      ),
    },
    {
      id: 'value',
      header: t('contracts.supplier.col.value'),
      numeric: true,
      cell: (row) => <MoneyText value={row.currentValue} />,
    },
    {
      id: 'termEnd',
      header: t('contracts.supplier.col.term'),
      sortable: true,
      cell: (row) => (
        <OrDash>
          {row.termStart === null && row.termEnd === null
            ? null
            : t('contracts.register.term', {
                start: row.termStart === null ? '…' : formatCalendarDate(row.termStart),
                end: row.termEnd === null ? '…' : formatCalendarDate(row.termEnd),
              })}
        </OrDash>
      ),
    },
    {
      id: 'status',
      header: t('contracts.supplier.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="contracts.status" value={row.status} size="sm" />
          {row.mySignatureStatus === 'pending' && (
            <Chip tone="warning" size="sm" icon="fileSignature">
              {t('contracts.supplier.signaturePending')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'obligations',
      header: t('contracts.supplier.col.obligations'),
      cell: (row) => (
        <>
          <span>{t('contracts.supplier.open', { count: row.openObligations })}</span>
          {row.overdueObligations > 0 && (
            <span className="tiq-cell-sub tiq-text-danger">
              {t('contracts.register.overdue', { count: row.overdueObligations })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'changes',
      header: t('contracts.supplier.col.changes'),
      numeric: true,
      cell: (row) => formatCount(row.pendingChangeRequests),
    },
    {
      id: 'nextDue',
      header: t('contracts.supplier.col.nextDue'),
      cell: (row) =>
        row.nextDueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.nextDueAt} showLocal={false} />
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t('contracts.supplier.title')} subtitle={t('contracts.supplier.intro')} />
      <FilterBar label={t('contracts.supplier.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('contracts.common.search')}
          placeholder={t('contracts.register.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('contracts.register.filter.status')}
          placeholder={t('contracts.common.all')}
          value={filters.status}
          options={VISIBLE_STATUSES.map((value) => ({
            value,
            label: tEnum('contracts.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('contracts.supplier.filterAction')}
          placeholder={t('contracts.common.all')}
          value={filters.action}
          options={[{ value: 'yes', label: t('contracts.supplier.actionRequired') }]}
          onChange={(action) => setFilters({ action, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('contracts.supplier.kpi.active')}
          icon="fileSignature"
          value={loading ? '…' : formatCount(all.filter((row) => row.status === 'active').length)}
          hint={t('contracts.supplier.kpi.activeHint')}
        />
        <KpiCard
          label={t('contracts.supplier.kpi.signature')}
          icon="edit"
          tone="warning"
          value={
            loading
              ? '…'
              : formatCount(all.filter((row) => row.mySignatureStatus === 'pending').length)
          }
          hint={t('contracts.supplier.kpi.signatureHint')}
        />
        <KpiCard
          label={t('contracts.supplier.kpi.overdue')}
          icon="alertTriangle"
          tone="danger"
          value={
            loading ? '…' : formatCount(all.reduce((sum, row) => sum + row.overdueObligations, 0))
          }
          hint={t('contracts.supplier.kpi.overdueHint')}
        />
        <KpiCard
          label={t('contracts.supplier.kpi.changes')}
          icon="gitBranch"
          tone="info"
          value={
            loading
              ? '…'
              : formatCount(all.reduce((sum, row) => sum + row.pendingChangeRequests, 0))
          }
          hint={t('contracts.supplier.kpi.changesHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('contracts.supplier.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          onRowClick={(row) => void navigate(contractPaths.supplierContract(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('contracts.supplier.emptyFiltered') : t('contracts.supplier.empty')
              }
              description={filtered ? undefined : t('contracts.supplier.emptyHint')}
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
    </>
  );
}
