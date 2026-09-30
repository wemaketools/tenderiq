/**
 * SUP-22 — Complaints and appeals: the supplier's OWN cases across buyers with their subject, status, response
 * deadline, outcome and whether a procurement hold is active. Other suppliers' cases and the buyer's private
 * deliberations are never shown.
 */

import { SUPPLIER_COMPLAINT_SORT_FIELDS, listSupplierComplaints } from '@contracts/awards';
import type { SupplierComplaintRow } from '@contracts/awards';
import { COMPLAINTS_STATUS, COMPLAINTS_SUBJECT } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
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
import { useOfficialTimeZone } from '../../awards/lib/hooks';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../../awards/lib/lists';
import { outcomePaths } from '../lib/paths';

const CLOSED = ['closed', 'withdrawn'];

const DEFAULTS = {
  q: '',
  status: '',
  subject: '',
  receivedFrom: '',
  receivedTo: '',
  sort: 'receivedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function SupplierComplaintsPage() {
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-22', DEFAULTS);

  const query = useApiQuery(listSupplierComplaints, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, COMPLAINTS_STATUS),
      subject: oneOf(filters.subject, COMPLAINTS_SUBJECT),
      receivedFrom: dateOf(filters.receivedFrom),
      receivedTo: dateOf(filters.receivedTo),
      sort: sortOf(filters.sort, SUPPLIER_COMPLAINT_SORT_FIELDS, 'receivedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listSupplierComplaints, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const loaded = overview.data !== undefined;
  const count = (rows: readonly SupplierComplaintRow[]): string =>
    loaded ? formatCount(rows.length) : '…';

  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.subject !== '' ||
    filters.receivedFrom !== '' ||
    filters.receivedTo !== '';

  const columns: DataTableColumn<SupplierComplaintRow>[] = [
    {
      id: 'reference',
      header: t('outcomes.complaints.col.reference'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} />
          <span className="tiq-cell-sub">{row.buyer.name}</span>
        </>
      ),
    },
    {
      id: 'tender',
      header: t('outcomes.complaints.col.tender'),
      cell: (row) => (
        <>
          <span>{`${row.tender.reference} ${row.tender.title}`}</span>
          <span className="tiq-cell-sub">
            {row.lot === null
              ? t('awards.common.allLots')
              : t('awards.common.lotLabel', { no: row.lot.lotNo, title: row.lot.title })}
          </span>
        </>
      ),
    },
    {
      id: 'subject',
      header: t('outcomes.complaints.col.subject'),
      cell: (row) => tEnum('complaints.subject', row.subject),
    },
    {
      id: 'status',
      header: t('outcomes.complaints.col.status'),
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
      header: t('outcomes.complaints.col.received'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatDateTime(row.receivedAt, timeZone)}</span>
          <span className="tiq-cell-sub">
            {row.acknowledgedAt === null
              ? t('outcomes.complaints.notAcknowledged')
              : t('outcomes.complaints.acknowledgedAt', {
                  at: formatDateTime(row.acknowledgedAt, timeZone),
                })}
          </span>
        </>
      ),
    },
    {
      id: 'responseDue',
      header: t('outcomes.complaints.col.responseDue'),
      cell: (row) =>
        row.responseDueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.responseDueAt} showLocal={false} />
        ),
    },
    {
      id: 'hold',
      header: t('outcomes.complaints.col.hold'),
      cell: (row) =>
        row.procurementHoldActive ? (
          <Chip tone="danger" size="sm" icon="pause">
            {t('outcomes.complaints.holdActive')}
          </Chip>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('outcomes.complaints.title')}
        subtitle={t('outcomes.complaints.intro')}
      />
      <FilterBar
        label={t('outcomes.complaints.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('outcomes.common.search')}
          placeholder={t('outcomes.complaints.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('outcomes.complaints.filter.status')}
          placeholder={t('outcomes.common.allStatuses')}
          value={filters.status}
          options={COMPLAINTS_STATUS.map((value) => ({
            value,
            label: tEnum('complaints.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('outcomes.complaints.filter.subject')}
          placeholder={t('outcomes.complaints.filter.allSubjects')}
          value={filters.subject}
          options={COMPLAINTS_SUBJECT.map((value) => ({
            value,
            label: tEnum('complaints.subject', value),
          }))}
          onChange={(subject) => setFilters({ subject, page: 1 })}
        />
        <DateInput
          label={t('outcomes.complaints.filter.receivedFrom')}
          value={filters.receivedFrom}
          onChange={(receivedFrom) => setFilters({ receivedFrom, page: 1 })}
        />
        <DateInput
          label={t('outcomes.complaints.filter.receivedTo')}
          value={filters.receivedTo}
          onChange={(receivedTo) => setFilters({ receivedTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('outcomes.complaints.kpi.open')}
          icon="scale"
          value={count(all.filter((row) => !CLOSED.includes(row.status)))}
          hint={t('outcomes.complaints.kpi.openHint')}
        />
        <KpiCard
          label={t('outcomes.complaints.kpi.holds')}
          icon="pause"
          tone="danger"
          value={count(all.filter((row) => row.procurementHoldActive))}
          hint={t('outcomes.complaints.kpi.holdsHint')}
        />
        <KpiCard
          label={t('outcomes.complaints.kpi.responded')}
          icon="messageSquare"
          tone="info"
          value={count(all.filter((row) => row.outcome !== null))}
          hint={t('outcomes.complaints.kpi.respondedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('outcomes.complaints.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.complaintId)}
          rowLabel={(row) => `${row.reference} ${row.tender.reference}`}
          rowHref={(row) => outcomePaths.complaint(row.complaintId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="scale"
              title={
                filtered ? t('outcomes.complaints.emptyFiltered') : t('outcomes.complaints.empty')
              }
              description={filtered ? undefined : t('outcomes.complaints.emptyHint')}
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
