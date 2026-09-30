/**
 * Supplier responses (entry to SUP-12..SUP-17): every response of the supplier with its OFFICIAL status
 * (`submissionState`), the working revision, progress, the official deadline and the effective receipt. Internal
 * approval is shown as a revision status, never as submission (AC-11).
 */
import { useNavigate, useSearchParams } from 'react-router';

import { BID_LIST_SORTS, listBids } from '@contracts/bids';
import type { BidSummary } from '@contracts/bids';
import { BID_REVISIONS_STATUS, BIDS_ROUND_TYPE, BIDS_SUBMISSION_STATE } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Checkbox,
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
import { ProgressMeter } from '../components/ProgressMeter';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, directionOf, fromDate, oneOf, sortOf, tableSort, toDate } from '../lib/lists';
import { nextActionOf } from '../lib/nextAction';
import { responsePaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  submissionState: '',
  revisionStatus: '',
  roundType: '',
  assignedToMe: false,
  deadlineFrom: '',
  deadlineTo: '',
  sort: 'deadline',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function ResponsesPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const [search, setSearch] = useSearchParams();
  const tenderParam = search.get('tenderId');
  const tenderId =
    tenderParam !== null && /^[1-9]\d*$/.test(tenderParam) ? Number(tenderParam) : undefined;
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-12', DEFAULTS);

  const query = useApiQuery(listBids, {
    query: compact({
      q: filters.q.trim(),
      submissionState: oneOf(filters.submissionState, BIDS_SUBMISSION_STATE),
      revisionStatus: oneOf(filters.revisionStatus, BID_REVISIONS_STATUS),
      roundType: oneOf(filters.roundType, BIDS_ROUND_TYPE),
      assignedToMe: filters.assignedToMe,
      deadlineFrom: fromDate(filters.deadlineFrom),
      deadlineTo: toDate(filters.deadlineTo),
      tenderId,
      sort: sortOf(filters.sort, BID_LIST_SORTS, 'deadline'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listBids, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const inPreparation = all.filter(
    (row) =>
      row.submissionState !== 'withdrawn' &&
      (row.workingRevision?.status === 'draft' ||
        row.workingRevision?.status === 'internal_review'),
  ).length;
  const approvedNotSubmitted = all.filter(
    (row) => row.workingRevision?.status === 'approved_internally',
  ).length;
  const submitted = all.filter((row) => row.submissionState === 'submitted').length;
  const withdrawn = all.filter((row) => row.submissionState === 'withdrawn').length;
  const kpiValue = (value: number): string =>
    overview.data === undefined ? '…' : formatCount(value);

  const filtered =
    filters.q !== '' ||
    filters.submissionState !== '' ||
    filters.revisionStatus !== '' ||
    filters.roundType !== '' ||
    filters.assignedToMe ||
    filters.deadlineFrom !== '' ||
    filters.deadlineTo !== '' ||
    tenderId !== undefined;

  const clearAll = (): void => {
    clearFilters();
    if (tenderId !== undefined) setSearch({});
  };

  const columns: DataTableColumn<BidSummary>[] = [
    {
      id: 'reference',
      header: t('responses.list.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} to={responsePaths.answers(row.id)} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
          <span className="tiq-cell-sub">{row.tender.buyer.name}</span>
          <span className="tiq-cell-sub">
            {tEnum('bids.round_type', row.roundType)} ·{' '}
            {row.lots.map((lot) => t('responses.common.lotNo', { no: lot.lotNo })).join(', ')}
            {row.isAlternative ? ` · ${t('responses.list.alternative')}` : ''}
          </span>
        </>
      ),
    },
    {
      id: 'deadline',
      header: t('responses.list.col.deadline'),
      sortable: true,
      cell: (row) => <OfficialDeadline deadline={row.deadline} showLocal={false} />,
    },
    {
      id: 'submissionState',
      header: t('responses.list.col.official'),
      sortable: true,
      cell: (row) => <StatusChip enum="bids.submission_state" value={row.submissionState} />,
    },
    {
      id: 'working',
      header: t('responses.list.col.working'),
      cell: (row) =>
        row.workingRevision === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-inline">
            <span>{t('responses.common.revisionNo', { no: row.workingRevision.revisionNo })}</span>
            <StatusChip enum="bid_revisions.status" value={row.workingRevision.status} size="sm" />
          </span>
        ),
    },
    {
      id: 'progress',
      header: t('responses.list.col.progress'),
      cell: (row) => <ProgressMeter progress={row.progress} />,
    },
    {
      id: 'receipt',
      header: t('responses.list.col.receipt'),
      cell: (row) =>
        row.effectiveReceipt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <Reference
              value={row.effectiveReceipt.receiptNo}
              to={responsePaths.receipt(row.effectiveReceipt.id)}
            />
            <span className="tiq-cell-sub">
              {formatDateTime(row.effectiveReceipt.receivedAt, row.deadline.timeZone)}
            </span>
          </>
        ),
    },
    {
      id: 'next',
      header: t('responses.list.col.next'),
      cell: (row) => t(`responses.next.${nextActionOf(row).key}`),
    },
    {
      id: 'updatedAt',
      header: t('responses.list.col.owner'),
      sortable: true,
      cell: (row) => (
        <>
          <OrDash>{row.bidManager?.fullName}</OrDash>
          <span className="tiq-cell-sub">
            {t('responses.list.updated', { time: formatDateTime(row.updatedAt, timeZone) })}
          </span>
        </>
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader title={t('responses.list.title')} subtitle={t('responses.list.intro')} />
      <FilterBar label={t('responses.list.filters')} onClear={clearAll} canClear={filtered}>
        <SearchField
          label={t('responses.common.search')}
          placeholder={t('responses.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('responses.list.filter.official')}
          placeholder={t('responses.common.all')}
          value={filters.submissionState}
          options={BIDS_SUBMISSION_STATE.map((value) => ({
            value,
            label: tEnum('bids.submission_state', value),
          }))}
          onChange={(submissionState) => setFilters({ submissionState, page: 1 })}
        />
        <Select
          label={t('responses.list.filter.working')}
          placeholder={t('responses.common.all')}
          value={filters.revisionStatus}
          options={BID_REVISIONS_STATUS.map((value) => ({
            value,
            label: tEnum('bid_revisions.status', value),
          }))}
          onChange={(revisionStatus) => setFilters({ revisionStatus, page: 1 })}
        />
        <Select
          label={t('responses.list.filter.round')}
          placeholder={t('responses.common.all')}
          value={filters.roundType}
          options={BIDS_ROUND_TYPE.map((value) => ({
            value,
            label: tEnum('bids.round_type', value),
          }))}
          onChange={(roundType) => setFilters({ roundType, page: 1 })}
        />
        <DateInput
          label={t('responses.list.filter.deadlineFrom')}
          value={filters.deadlineFrom}
          onChange={(deadlineFrom) => setFilters({ deadlineFrom, page: 1 })}
        />
        <DateInput
          label={t('responses.list.filter.deadlineTo')}
          value={filters.deadlineTo}
          onChange={(deadlineTo) => setFilters({ deadlineTo, page: 1 })}
        />
        <Checkbox
          label={t('responses.list.filter.assignedToMe')}
          checked={filters.assignedToMe}
          onChange={(assignedToMe) => setFilters({ assignedToMe, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('responses.list.kpi.preparing')}
          icon="edit"
          tone="info"
          value={kpiValue(inPreparation)}
          hint={t('responses.list.kpi.preparingHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('responses.list.kpi.approved')}
          icon="alertTriangle"
          tone="warning"
          value={kpiValue(approvedNotSubmitted)}
          hint={t('responses.list.kpi.approvedHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('responses.list.kpi.submitted')}
          icon="receipt"
          tone="success"
          value={kpiValue(submitted)}
          hint={t('responses.list.kpi.submittedHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('responses.list.kpi.withdrawn')}
          icon="archive"
          value={kpiValue(withdrawn)}
          hint={t('responses.list.kpi.withdrawnHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('responses.list.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => `${row.tender.reference} ${row.tender.title}`}
          onRowClick={(row) => void navigate(responsePaths.answers(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={filtered ? t('responses.list.emptyFiltered') : t('responses.list.empty')}
              description={filtered ? undefined : t('responses.list.emptyHint')}
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
