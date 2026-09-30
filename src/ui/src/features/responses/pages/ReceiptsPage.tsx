/**
 * SUP-17 — Official receipts of the supplier across all responses: receipt number, tender, lots, revision, official
 * receipt time, status (received, superseded, withdrawn, late/rejected, selected for evaluation) and which receipt
 * is effective. A receipt confirms receipt only, never compliance, qualification or award.
 */

import { listSupplierReceipts } from '@contracts/bids';
import type { SupplierReceiptRow } from '@contracts/bids';
import { SUBMISSION_RECEIPTS_STATUS } from '@contracts/enums';

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
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ReceiptDownloadButton } from '../components/ReceiptDownloadButton';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, directionOf, fromDate, oneOf, sortOf, tableSort, toDate } from '../lib/lists';
import { responsePaths } from '../lib/paths';
import { formatReceiptTime } from '../lib/time';

const SORTS = ['receivedAt', 'receiptNo', 'reference'] as const;

const DEFAULTS = {
  q: '',
  status: '',
  effectiveOnly: false,
  receivedFrom: '',
  receivedTo: '',
  sort: 'receivedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function ReceiptsPage() {
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-17', DEFAULTS);
  const query = useApiQuery(listSupplierReceipts, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, SUBMISSION_RECEIPTS_STATUS),
      effectiveOnly: filters.effectiveOnly,
      receivedFrom: fromDate(filters.receivedFrom),
      receivedTo: toDate(filters.receivedTo),
      sort: sortOf(filters.sort, SORTS, 'receivedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listSupplierReceipts, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const count = (predicate: (row: SupplierReceiptRow) => boolean): string =>
    overview.data === undefined ? '…' : formatCount(all.filter(predicate).length);
  const restricted = overview.error?.kind === 'forbidden';

  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.effectiveOnly ||
    filters.receivedFrom !== '' ||
    filters.receivedTo !== '';

  const columns: DataTableColumn<SupplierReceiptRow>[] = [
    {
      id: 'receiptNo',
      header: t('responses.receipts.col.receipt'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.receiptNo} to={responsePaths.receipt(row.id)} />
          {row.isEffective && (
            <Chip tone="success" size="sm">
              {t('responses.history.effective')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'reference',
      header: t('responses.receipts.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.tender.reference}</span>
          <span className="tiq-cell-sub">{row.tender.title}</span>
          <span className="tiq-cell-sub">{row.tender.buyer.name}</span>
        </>
      ),
    },
    {
      id: 'lots',
      header: t('responses.receipts.col.lots'),
      cell: (row) => (
        <>
          <span>{row.lotsSummary}</span>
          <span className="tiq-cell-sub">
            {tEnum('bids.round_type', row.roundType)} ·{' '}
            {t('responses.common.revisionNo', { no: row.revisionNo })}
          </span>
        </>
      ),
    },
    {
      id: 'receivedAt',
      header: t('responses.receipts.col.received'),
      sortable: true,
      cell: (row) => formatReceiptTime(row.receivedAt, timeZone),
    },
    {
      id: 'status',
      header: t('responses.receipts.col.status'),
      cell: (row) => <StatusChip enum="submission_receipts.status" value={row.status} />,
    },
    {
      id: 'documents',
      header: t('responses.receipts.col.documents'),
      numeric: true,
      cell: (row) => formatCount(row.documentCount),
    },
    {
      id: 'download',
      header: t('responses.common.actions'),
      cell: (row) => <ReceiptDownloadButton receiptId={row.id} receiptNo={row.receiptNo} />,
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader title={t('responses.receipts.title')} subtitle={t('responses.receipts.intro')} />
      <FilterBar label={t('responses.receipts.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('responses.common.search')}
          placeholder={t('responses.receipts.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('responses.receipts.filter.status')}
          placeholder={t('responses.common.all')}
          value={filters.status}
          options={SUBMISSION_RECEIPTS_STATUS.map((value) => ({
            value,
            label: tEnum('submission_receipts.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('responses.receipts.filter.from')}
          value={filters.receivedFrom}
          onChange={(receivedFrom) => setFilters({ receivedFrom, page: 1 })}
        />
        <DateInput
          label={t('responses.receipts.filter.to')}
          value={filters.receivedTo}
          onChange={(receivedTo) => setFilters({ receivedTo, page: 1 })}
        />
        <Checkbox
          label={t('responses.receipts.filter.effectiveOnly')}
          checked={filters.effectiveOnly}
          onChange={(effectiveOnly) => setFilters({ effectiveOnly, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('responses.receipts.kpi.effective')}
          icon="receipt"
          tone="success"
          value={count((row) => row.isEffective)}
          hint={t('responses.receipts.kpi.effectiveHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('responses.receipts.kpi.superseded')}
          icon="history"
          value={count((row) => row.status === 'superseded')}
          hint={t('responses.receipts.kpi.supersededHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('responses.receipts.kpi.withdrawn')}
          icon="ban"
          tone="warning"
          value={count((row) => row.status === 'withdrawn')}
          hint={t('responses.receipts.kpi.withdrawnHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('responses.receipts.kpi.late')}
          icon="clock"
          tone="danger"
          value={count((row) => row.status === 'late_rejected')}
          hint={t('responses.receipts.kpi.lateHint')}
          restricted={restricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('responses.receipts.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.receiptNo}
          rowHref={(row) => responsePaths.receipt(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('responses.receipts.emptyFiltered') : t('responses.receipts.empty')
              }
              description={filtered ? undefined : t('responses.receipts.emptyHint')}
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
