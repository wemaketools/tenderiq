/**
 * BUY-29 — Complaint cases: every complaint with its tender and lot, complainant, subject, status, standing and
 * timeliness, independent case owner, blocking hold, outcome and response deadline. The procurement hold is shown
 * separately from the case status (PRD §8.3).
 */
import { useNavigate } from 'react-router';

import { COMPLAINT_SORT_FIELDS, listComplaints } from '@contracts/awards';
import type { ComplaintRow } from '@contracts/awards';
import { COMPLAINTS_STATUS, COMPLAINTS_SUBJECT } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Checkbox,
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
import { CasesTabs } from '../components/CasesTabs';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { awardPaths } from '../lib/paths';

const CLOSED = ['closed', 'withdrawn'];

const DEFAULTS = {
  q: '',
  status: '',
  subject: '',
  blocking: false,
  receivedFrom: '',
  receivedTo: '',
  sort: 'receivedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function ComplaintsPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-29-complaints', DEFAULTS);

  const query = useApiQuery(listComplaints, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, COMPLAINTS_STATUS),
      subject: oneOf(filters.subject, COMPLAINTS_SUBJECT),
      blocking: filters.blocking ? true : undefined,
      receivedFrom: dateOf(filters.receivedFrom),
      receivedTo: dateOf(filters.receivedTo),
      sort: sortOf(filters.sort, COMPLAINT_SORT_FIELDS, 'receivedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listComplaints, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const loaded = overview.data !== undefined;
  const count = (rows: readonly ComplaintRow[]): string =>
    loaded ? formatCount(rows.length) : '…';

  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.subject !== '' ||
    filters.blocking ||
    filters.receivedFrom !== '' ||
    filters.receivedTo !== '';

  const columns: DataTableColumn<ComplaintRow>[] = [
    {
      id: 'reference',
      header: t('awards.complaints.col.reference'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} />
          <span className="tiq-cell-sub">
            {row.tender.reference}
            {row.lot === null ? '' : ` · ${t('awards.common.lotNo', { no: row.lot.lotNo })}`}
          </span>
        </>
      ),
    },
    {
      id: 'complainant',
      header: t('awards.complaints.col.complainant'),
      cell: (row) => (
        <>
          <span>{row.complainant.name}</span>
          <span className="tiq-cell-sub">{tEnum('complaints.subject', row.subject)}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('awards.complaints.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="complaints.status" value={row.status} />
          {row.outcome !== null && (
            <span className="tiq-cell-sub">{tEnum('complaints.outcome', row.outcome)}</span>
          )}
        </>
      ),
    },
    {
      id: 'receivedAt',
      header: t('awards.complaints.col.received'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatDateTime(row.receivedAt, timeZone)}</span>
          <span className={row.withinWindow ? 'tiq-cell-sub' : 'tiq-cell-sub tiq-text-warning'}>
            {row.withinWindow ? t('awards.complaints.timely') : t('awards.complaints.late')}
          </span>
        </>
      ),
    },
    {
      id: 'owner',
      header: t('awards.complaints.col.owner'),
      cell: (row) =>
        row.caseOwner === null ? (
          <span className="tiq-text-warning">{t('awards.complaints.unassigned')}</span>
        ) : (
          <>
            <span>{row.caseOwner.fullName}</span>
            <span className="tiq-cell-sub">
              {row.independenceConfirmed
                ? t('awards.complaints.independent')
                : t('awards.complaints.independenceUnconfirmed')}
            </span>
          </>
        ),
    },
    {
      id: 'hold',
      header: t('awards.complaints.col.hold'),
      cell: (row) =>
        row.holdActive ? (
          <Chip tone="danger" size="sm" icon="pause">
            {t('awards.complaints.holdActive')}
          </Chip>
        ) : row.isBlocking ? (
          <Chip tone="warning" size="sm">
            {t('awards.complaints.blocking')}
          </Chip>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
    {
      id: 'responseDueAt',
      header: t('awards.complaints.col.responseDue'),
      sortable: true,
      cell: (row) =>
        row.responseDueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.responseDueAt} showLocal={false} />
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t('awards.cases.title')} subtitle={t('awards.cases.intro')} />
      <CasesTabs />
      <FilterBar label={t('awards.complaints.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('awards.common.search')}
          placeholder={t('awards.complaints.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('awards.complaints.filter.status')}
          placeholder={t('awards.common.allStatuses')}
          value={filters.status}
          options={COMPLAINTS_STATUS.map((value) => ({
            value,
            label: tEnum('complaints.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('awards.complaints.filter.subject')}
          placeholder={t('awards.complaints.filter.allSubjects')}
          value={filters.subject}
          options={COMPLAINTS_SUBJECT.map((value) => ({
            value,
            label: tEnum('complaints.subject', value),
          }))}
          onChange={(subject) => setFilters({ subject, page: 1 })}
        />
        <DateInput
          label={t('awards.complaints.filter.receivedFrom')}
          value={filters.receivedFrom}
          onChange={(receivedFrom) => setFilters({ receivedFrom, page: 1 })}
        />
        <DateInput
          label={t('awards.complaints.filter.receivedTo')}
          value={filters.receivedTo}
          onChange={(receivedTo) => setFilters({ receivedTo, page: 1 })}
        />
        <Checkbox
          label={t('awards.complaints.filter.blocking')}
          checked={filters.blocking}
          onChange={(blocking) => setFilters({ blocking, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('awards.complaints.kpi.open')}
          icon="scale"
          value={count(all.filter((row) => !CLOSED.includes(row.status)))}
          hint={t('awards.complaints.kpi.openHint')}
        />
        <KpiCard
          label={t('awards.complaints.kpi.holds')}
          icon="pause"
          tone="danger"
          value={count(all.filter((row) => row.holdActive))}
          hint={t('awards.complaints.kpi.holdsHint')}
        />
        <KpiCard
          label={t('awards.complaints.kpi.unacknowledged')}
          icon="inbox"
          tone="warning"
          value={count(
            all.filter((row) => row.acknowledgedAt === null && !CLOSED.includes(row.status)),
          )}
          hint={t('awards.complaints.kpi.unacknowledgedHint')}
        />
        <KpiCard
          label={t('awards.complaints.kpi.unassigned')}
          icon="userCheck"
          tone="info"
          value={count(all.filter((row) => row.caseOwner === null && !CLOSED.includes(row.status)))}
          hint={t('awards.complaints.kpi.unassignedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('awards.complaints.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.complaintId)}
          rowLabel={(row) => `${row.reference} ${row.complainant.name}`}
          onRowClick={(row) => void navigate(awardPaths.complaint(row.complaintId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="scale"
              title={filtered ? t('awards.complaints.emptyFiltered') : t('awards.complaints.empty')}
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
