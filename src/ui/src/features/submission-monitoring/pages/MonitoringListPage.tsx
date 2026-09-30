/**
 * BUY-19 — Submission monitoring and closing (register): released tenders with permitted receipt metadata only —
 * unique suppliers with an effective submission (never revisions, never drafts), receipt counts, the official
 * deadline, the closing status and service incidents. There is no access to sealed content (BR-17).
 */
import { useNavigate } from 'react-router';

import { CLOSING_STATUSES, listMonitoring } from '@contracts/bids';
import type { MonitoringRow } from '@contracts/bids';
import { TENDERS_EVENT_TYPE, TENDERS_STATUS } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CLOSING_TONE } from '../lib/closing';
import { monitoringPaths } from '../lib/paths';

const SORTS = ['deadline', 'reference', 'effectiveSupplierCount', 'lastReceiptAt'] as const;

const DEFAULTS = {
  q: '',
  closingStatus: '',
  status: '',
  eventType: '',
  deadlineFrom: '',
  deadlineTo: '',
  sort: 'deadline',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function oneOf<T extends string>(value: string, allowed: readonly T[]): T[] | undefined {
  return value !== '' && (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

export default function MonitoringListPage() {
  const navigate = useNavigate();
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-19', DEFAULTS);
  const sort = (SORTS as readonly string[]).includes(filters.sort)
    ? (filters.sort as (typeof SORTS)[number])
    : 'deadline';
  const request = {
    q: filters.q.trim() === '' ? undefined : filters.q.trim(),
    closingStatus: oneOf(filters.closingStatus, CLOSING_STATUSES),
    status: oneOf(filters.status, TENDERS_STATUS),
    eventType: oneOf(filters.eventType, TENDERS_EVENT_TYPE),
    deadlineFrom: filters.deadlineFrom === '' ? undefined : `${filters.deadlineFrom}T00:00:00Z`,
    deadlineTo: filters.deadlineTo === '' ? undefined : `${filters.deadlineTo}T23:59:59Z`,
    sort,
    dir: filters.dir === 'desc' ? ('desc' as const) : ('asc' as const),
    page: filters.page,
    pageSize: filters.pageSize,
  };
  const query = useApiQuery(listMonitoring, {
    query: Object.fromEntries(
      Object.entries(request).filter(([, value]) => value !== undefined),
    ) as typeof request,
  });
  const overview = useApiQuery(listMonitoring, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const value = (count: number): string => (overview.data === undefined ? '…' : formatCount(count));
  const restricted = overview.error?.kind === 'forbidden';

  const filtered =
    filters.q !== '' ||
    filters.closingStatus !== '' ||
    filters.status !== '' ||
    filters.eventType !== '' ||
    filters.deadlineFrom !== '' ||
    filters.deadlineTo !== '';

  const columns: DataTableColumn<MonitoringRow>[] = [
    {
      id: 'reference',
      header: t('submission-monitoring.list.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} to={monitoringPaths.tender(row.tenderId)} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'type',
      header: t('submission-monitoring.list.col.type'),
      cell: (row) => (
        <>
          <span>{tEnum('tenders.event_type', row.eventType)}</span>
          <span className="tiq-cell-sub">{tEnum('tenders.participation', row.participation)}</span>
        </>
      ),
    },
    {
      id: 'owner',
      header: t('submission-monitoring.list.col.owner'),
      cell: (row) => row.owner.fullName,
    },
    {
      id: 'deadline',
      header: t('submission-monitoring.list.col.deadline'),
      sortable: true,
      cell: (row) => <OfficialDeadline deadline={row.deadline} showLocal={false} />,
    },
    {
      id: 'closing',
      header: t('submission-monitoring.list.col.closing'),
      cell: (row) => (
        <>
          <Chip tone={CLOSING_TONE[row.closingStatus]}>
            {t(`submission-monitoring.closing.${row.closingStatus}`)}
          </Chip>
          {row.closedAt !== null && (
            <span className="tiq-cell-sub">
              {formatDateTime(row.closedAt, row.deadline.timeZone)}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('submission-monitoring.list.col.status'),
      cell: (row) => <StatusChip enum="tenders.status" value={row.status} size="sm" />,
    },
    {
      id: 'effectiveSupplierCount',
      header: t('submission-monitoring.list.col.suppliers'),
      sortable: true,
      numeric: true,
      cell: (row) => formatCount(row.effectiveSupplierCount),
    },
    {
      id: 'receipts',
      header: t('submission-monitoring.list.col.receipts'),
      numeric: true,
      cell: (row) => formatCount(row.receiptCount),
    },
    {
      id: 'lastReceiptAt',
      header: t('submission-monitoring.list.col.lastReceipt'),
      sortable: true,
      cell: (row) =>
        row.lastReceiptAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          formatDateTime(row.lastReceiptAt, row.deadline.timeZone)
        ),
    },
    {
      id: 'incidents',
      header: t('submission-monitoring.list.col.incidents'),
      numeric: true,
      cell: (row) =>
        row.incidentCount > 0 ? (
          <Chip tone="warning" size="sm">
            {formatCount(row.incidentCount)}
          </Chip>
        ) : (
          formatCount(0)
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('submission-monitoring.list.title')}
        subtitle={t('submission-monitoring.list.intro')}
      />
      <FilterBar
        label={t('submission-monitoring.list.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('submission-monitoring.common.search')}
          placeholder={t('submission-monitoring.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('submission-monitoring.list.filter.closing')}
          placeholder={t('submission-monitoring.common.all')}
          value={filters.closingStatus}
          options={CLOSING_STATUSES.map((status) => ({
            value: status,
            label: t(`submission-monitoring.closing.${status}`),
          }))}
          onChange={(closingStatus) => setFilters({ closingStatus, page: 1 })}
        />
        <Select
          label={t('submission-monitoring.list.filter.status')}
          placeholder={t('submission-monitoring.common.all')}
          value={filters.status}
          options={TENDERS_STATUS.map((status) => ({
            value: status,
            label: tEnum('tenders.status', status),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('submission-monitoring.list.filter.type')}
          placeholder={t('submission-monitoring.common.all')}
          value={filters.eventType}
          options={TENDERS_EVENT_TYPE.map((type) => ({
            value: type,
            label: tEnum('tenders.event_type', type),
          }))}
          onChange={(eventType) => setFilters({ eventType, page: 1 })}
        />
        <DateInput
          label={t('submission-monitoring.list.filter.deadlineFrom')}
          value={filters.deadlineFrom}
          onChange={(deadlineFrom) => setFilters({ deadlineFrom, page: 1 })}
        />
        <DateInput
          label={t('submission-monitoring.list.filter.deadlineTo')}
          value={filters.deadlineTo}
          onChange={(deadlineTo) => setFilters({ deadlineTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('submission-monitoring.list.kpi.open')}
          icon="clock"
          tone="accent"
          value={value(all.filter((row) => row.closingStatus === 'open').length)}
          hint={t('submission-monitoring.list.kpi.openHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('submission-monitoring.list.kpi.toClose')}
          icon="lock"
          tone="warning"
          value={value(all.filter((row) => row.closingStatus === 'deadline_passed').length)}
          hint={t('submission-monitoring.list.kpi.toCloseHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('submission-monitoring.list.kpi.suppliers')}
          icon="users"
          tone="success"
          value={value(
            all
              .filter((row) => row.closingStatus !== 'closed')
              .reduce((total, row) => total + row.effectiveSupplierCount, 0),
          )}
          hint={t('submission-monitoring.list.kpi.suppliersHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('submission-monitoring.list.kpi.incidents')}
          icon="alertTriangle"
          tone="danger"
          value={value(all.reduce((total, row) => total + row.incidentCount, 0))}
          hint={t('submission-monitoring.list.kpi.incidentsHint')}
          restricted={restricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('submission-monitoring.list.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.tenderId)}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          onRowClick={(row) => void navigate(monitoringPaths.tender(row.tenderId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: sort, dir: request.dir }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered
                  ? t('submission-monitoring.list.emptyFiltered')
                  : t('submission-monitoring.list.empty')
              }
              description={filtered ? undefined : t('submission-monitoring.list.emptyHint')}
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
      <p className="tiq-text-muted">
        {t('submission-monitoring.list.footnote', { zone: timeZone })}
      </p>
    </div>
  );
}
