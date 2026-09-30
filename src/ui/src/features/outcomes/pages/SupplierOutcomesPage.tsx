/**
 * SUP-21 — Outcomes and debriefings: the supplier's own results across buyers — preferred (intention to award) or
 * final award, unsuccessful and cancelled lots, waiting periods, notices awaiting acknowledgment, debrief and
 * complaint status. Other suppliers' results never appear (PRD §4.3).
 */
import { useNavigate } from 'react-router';

import {
  SUPPLIER_OUTCOME_RESULTS,
  SUPPLIER_OUTCOME_SORT_FIELDS,
  listSupplierOutcomes,
} from '@contracts/awards';
import type { SupplierOutcomeRow } from '@contracts/awards';

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
import { t } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../../awards/lib/hooks';
import { LOT_RESULT_TONE, OUTCOME_RESULT_TONE } from '../../awards/lib/labels';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../../awards/lib/lists';
import { outcomePaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  result: '',
  awaiting: false,
  noticeFrom: '',
  noticeTo: '',
  sort: 'latestNoticeAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function SupplierOutcomesPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-21', DEFAULTS);

  const query = useApiQuery(listSupplierOutcomes, {
    query: compact({
      q: filters.q.trim(),
      result: oneOf(filters.result, SUPPLIER_OUTCOME_RESULTS),
      awaitingAcknowledgment: filters.awaiting ? true : undefined,
      noticeFrom: dateOf(filters.noticeFrom),
      noticeTo: dateOf(filters.noticeTo),
      sort: sortOf(filters.sort, SUPPLIER_OUTCOME_SORT_FIELDS, 'latestNoticeAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listSupplierOutcomes, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const loaded = overview.data !== undefined;
  const count = (rows: readonly SupplierOutcomeRow[]): string =>
    loaded ? formatCount(rows.length) : '…';
  const hasLot = (row: SupplierOutcomeRow, result: string): boolean =>
    row.lots.some((lot) => lot.result === result);

  const filtered =
    filters.q !== '' ||
    filters.result !== '' ||
    filters.awaiting ||
    filters.noticeFrom !== '' ||
    filters.noticeTo !== '';

  const columns: DataTableColumn<SupplierOutcomeRow>[] = [
    {
      id: 'reference',
      header: t('outcomes.list.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    { id: 'buyer', header: t('outcomes.list.col.buyer'), cell: (row) => row.buyer.name },
    {
      id: 'result',
      header: t('outcomes.list.col.result'),
      cell: (row) => (
        <Chip tone={OUTCOME_RESULT_TONE[row.result]}>{t(`outcomes.result.${row.result}`)}</Chip>
      ),
    },
    {
      id: 'lots',
      header: t('outcomes.list.col.lots'),
      cell: (row) => (
        <span className="tiq-inline">
          {row.lots.map((lot) => (
            <Chip key={lot.lot.lotId} tone={LOT_RESULT_TONE[lot.result]} size="sm">
              {t('outcomes.lotResult', {
                no: lot.lot.lotNo,
                result: t(`outcomes.lotResultValue.${lot.result}`),
              })}
            </Chip>
          ))}
        </span>
      ),
    },
    {
      id: 'latestNoticeAt',
      header: t('outcomes.list.col.latestNotice'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatDateTime(row.latestNoticeAt, timeZone)}</span>
          {row.awaitingAcknowledgment > 0 && (
            <span className="tiq-cell-sub tiq-text-warning">
              {t('outcomes.list.awaitingAck', { count: row.awaitingAcknowledgment })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'standstill',
      header: t('outcomes.list.col.standstill'),
      cell: (row) =>
        row.standstillEndsAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.standstillEndsAt} showLocal={false} />
        ),
    },
    {
      id: 'debrief',
      header: t('outcomes.list.col.debrief'),
      cell: (row) =>
        row.debriefStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="debrief_requests.status" value={row.debriefStatus} size="sm" />
        ),
    },
    {
      id: 'complaints',
      header: t('outcomes.list.col.complaints'),
      numeric: true,
      cell: (row) => formatCount(row.openComplaintCount),
    },
  ];

  return (
    <>
      <PageHeader title={t('outcomes.list.title')} subtitle={t('outcomes.list.intro')} />
      <FilterBar label={t('outcomes.list.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('outcomes.common.search')}
          placeholder={t('outcomes.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('outcomes.list.filter.result')}
          placeholder={t('outcomes.list.filter.allResults')}
          value={filters.result}
          options={SUPPLIER_OUTCOME_RESULTS.map((value) => ({
            value,
            label: t(`outcomes.result.${value}`),
          }))}
          onChange={(result) => setFilters({ result, page: 1 })}
        />
        <DateInput
          label={t('outcomes.list.filter.noticeFrom')}
          value={filters.noticeFrom}
          onChange={(noticeFrom) => setFilters({ noticeFrom, page: 1 })}
        />
        <DateInput
          label={t('outcomes.list.filter.noticeTo')}
          value={filters.noticeTo}
          onChange={(noticeTo) => setFilters({ noticeTo, page: 1 })}
        />
        <Checkbox
          label={t('outcomes.list.filter.awaiting')}
          checked={filters.awaiting}
          onChange={(awaiting) => setFilters({ awaiting, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('outcomes.list.kpi.awarded')}
          icon="trophy"
          tone="success"
          value={count(all.filter((row) => hasLot(row, 'awarded')))}
          hint={t('outcomes.list.kpi.awardedHint')}
        />
        <KpiCard
          label={t('outcomes.list.kpi.intent')}
          icon="flag"
          tone="accent"
          value={count(all.filter((row) => hasLot(row, 'intent_to_award')))}
          hint={t('outcomes.list.kpi.intentHint')}
        />
        <KpiCard
          label={t('outcomes.list.kpi.unsuccessful')}
          icon="xCircle"
          tone="info"
          value={count(all.filter((row) => hasLot(row, 'unsuccessful')))}
          hint={t('outcomes.list.kpi.unsuccessfulHint')}
        />
        <KpiCard
          label={t('outcomes.list.kpi.awaiting')}
          icon="bell"
          tone="warning"
          value={count(all.filter((row) => row.awaitingAcknowledgment > 0))}
          hint={t('outcomes.list.kpi.awaitingHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('outcomes.list.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => `${row.buyer.tenantId}-${row.tenderId}`}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          onRowClick={(row) => void navigate(outcomePaths.outcome(row.tenderId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="trophy"
              title={filtered ? t('outcomes.list.emptyFiltered') : t('outcomes.list.empty')}
              description={filtered ? undefined : t('outcomes.list.emptyHint')}
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
