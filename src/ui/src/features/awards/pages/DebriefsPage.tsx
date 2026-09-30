/**
 * BUY-29 — Debrief requests: every supplier request with its tender, requester, due date (official time zone),
 * meeting and status. Search, filters, sorting and pagination are served by the API.
 */
import { useNavigate } from 'react-router';

import { DEBRIEF_SORT_FIELDS, listDebriefs } from '@contracts/awards';
import type { DebriefRow } from '@contracts/awards';
import { DEBRIEF_REQUESTS_STATUS } from '@contracts/enums';

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
  OfficialDeadline,
  OrDash,
  OverdueChip,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { CasesTabs } from '../components/CasesTabs';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { awardPaths } from '../lib/paths';

const OPEN = ['requested', 'scheduled'];

const DEFAULTS = {
  q: '',
  status: '',
  dueFrom: '',
  dueTo: '',
  sort: 'dueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function DebriefsPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const now = useNow();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-29-debriefs', DEFAULTS);

  const query = useApiQuery(listDebriefs, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, DEBRIEF_REQUESTS_STATUS),
      dueFrom: dateOf(filters.dueFrom),
      dueTo: dateOf(filters.dueTo),
      sort: sortOf(filters.sort, DEBRIEF_SORT_FIELDS, 'dueAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listDebriefs, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const loaded = overview.data !== undefined;
  const isOverdue = (row: DebriefRow): boolean =>
    OPEN.includes(row.status) && new Date(row.dueAt.at).getTime() < now;
  const count = (rows: readonly DebriefRow[]): string => (loaded ? formatCount(rows.length) : '…');

  const filtered =
    filters.q !== '' || filters.status !== '' || filters.dueFrom !== '' || filters.dueTo !== '';

  const columns: DataTableColumn<DebriefRow>[] = [
    {
      id: 'reference',
      header: t('awards.debriefs.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
        </>
      ),
    },
    { id: 'supplier', header: t('awards.debriefs.col.supplier'), cell: (row) => row.supplier.name },
    {
      id: 'requestedAt',
      header: t('awards.debriefs.col.requested'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatDateTime(row.requestedAt, timeZone)}</span>
          <span className="tiq-cell-sub">{row.requestedBy.fullName}</span>
        </>
      ),
    },
    {
      id: 'dueAt',
      header: t('awards.debriefs.col.due'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <OfficialDeadline deadline={row.dueAt} showLocal={false} />
          {isOverdue(row) && <OverdueChip />}
        </span>
      ),
    },
    {
      id: 'meeting',
      header: t('awards.debriefs.col.meeting'),
      cell: (row) =>
        row.meetingAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.meetingAt} showLocal={false} />
        ),
    },
    {
      id: 'status',
      header: t('awards.debriefs.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="debrief_requests.status" value={row.status} />,
    },
    {
      id: 'owner',
      header: t('awards.debriefs.col.provider'),
      cell: (row) => row.providedBy?.fullName ?? <OrDash>{null}</OrDash>,
    },
  ];

  return (
    <>
      <PageHeader title={t('awards.cases.title')} subtitle={t('awards.cases.intro')} />
      <CasesTabs />
      <FilterBar label={t('awards.debriefs.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('awards.common.search')}
          placeholder={t('awards.debriefs.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('awards.debriefs.filter.status')}
          placeholder={t('awards.common.allStatuses')}
          value={filters.status}
          options={DEBRIEF_REQUESTS_STATUS.map((value) => ({
            value,
            label: tEnum('debrief_requests.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('awards.debriefs.filter.dueFrom')}
          value={filters.dueFrom}
          onChange={(dueFrom) => setFilters({ dueFrom, page: 1 })}
        />
        <DateInput
          label={t('awards.debriefs.filter.dueTo')}
          value={filters.dueTo}
          onChange={(dueTo) => setFilters({ dueTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('awards.debriefs.kpi.open')}
          icon="messageSquare"
          value={count(all.filter((row) => OPEN.includes(row.status)))}
          hint={t('awards.debriefs.kpi.openHint')}
        />
        <KpiCard
          label={t('awards.debriefs.kpi.overdue')}
          icon="alertTriangle"
          tone="danger"
          value={count(all.filter(isOverdue))}
          hint={t('awards.debriefs.kpi.overdueHint')}
        />
        <KpiCard
          label={t('awards.debriefs.kpi.provided')}
          icon="checkCircle"
          tone="success"
          value={count(all.filter((row) => row.status === 'provided'))}
          hint={t('awards.debriefs.kpi.providedHint')}
        />
        <KpiCard
          label={t('awards.debriefs.kpi.declined')}
          icon="ban"
          tone="warning"
          value={count(all.filter((row) => row.status === 'declined'))}
          hint={t('awards.debriefs.kpi.declinedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('awards.debriefs.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.debriefId)}
          rowLabel={(row) => `${row.tender.reference} ${row.supplier.name}`}
          onRowClick={(row) => void navigate(awardPaths.debrief(row.debriefId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="messageSquare"
              title={filtered ? t('awards.debriefs.emptyFiltered') : t('awards.debriefs.empty')}
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
