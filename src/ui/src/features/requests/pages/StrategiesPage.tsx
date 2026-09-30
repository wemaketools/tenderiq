/**
 * BUY-06 Market research and strategy: the strategy register. Each strategy shows its procedure, award model,
 * approval status, pending fairness reviews and the events it led to; the strategy page holds the research,
 * procedure comparison, consultations, exceptions and approval (FR-05, AC-39).
 */
import { Link } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { StrategyRow } from '@contracts/requests';
import type {
  ProcurementStrategiesEventType,
  ProcurementStrategiesProcedure,
  ProcurementStrategiesStatus,
} from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableSort } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useActiveTenant } from '../../../app/hooks';
import { enumOptions, requestPaths } from '../lib';

const DEFAULT_FILTERS = {
  q: '',
  status: '',
  procedure: '',
  eventType: '',
  owner: '',
  page: 1,
  sort: 'updatedAt',
  dir: 'desc',
};

type SortField = 'title' | 'status' | 'procedure' | 'updatedAt' | 'estimatedValue';

const ALL_REQUEST = { query: { pageSize: 100 } } as const;

export default function StrategiesPage() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-06', DEFAULT_FILTERS);
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.status === '' ? {} : { status: [filters.status as ProcurementStrategiesStatus] }),
    ...(filters.procedure === ''
      ? {}
      : { procedure: [filters.procedure as ProcurementStrategiesProcedure] }),
    ...(filters.eventType === ''
      ? {}
      : { eventType: [filters.eventType as ProcurementStrategiesEventType] }),
    ...(filters.owner === '' ? {} : { ownerUserId: Number(filters.owner) }),
  };
  const strategies = useApiQuery(requestEndpoints.listStrategies, { query });
  const all = useApiQuery(requestEndpoints.listStrategies, ALL_REQUEST);
  const rows = all.data?.items;
  const count = (predicate: (row: StrategyRow) => boolean): string | null =>
    rows === undefined ? null : formatCount(rows.filter(predicate).length);
  const owners = new Map<number, string>();
  for (const row of rows ?? []) {
    if (row.owner !== null) owners.set(row.owner.userId, row.owner.fullName);
  }

  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.procedure !== '' ||
    filters.eventType !== '' ||
    filters.owner !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('requests.strategies.title')}
        subtitle={t('requests.strategies.subtitle')}
      />

      <FilterBar
        onClear={clearFilters}
        canClear={canClear}
        label={t('requests.strategies.filters')}
      >
        <SearchField
          label={t('requests.filters.search')}
          placeholder={t('requests.strategies.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('requests.filters.status')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          placeholder={t('requests.filters.allStatuses')}
          options={enumOptions('procurement_strategies.status')}
        />
        <Select
          label={t('requests.strategies.procedure')}
          value={filters.procedure}
          onChange={(value) => update({ procedure: value })}
          placeholder={t('requests.strategies.allProcedures')}
          options={enumOptions('procurement_strategies.procedure')}
        />
        <Select
          label={t('requests.strategies.eventType')}
          value={filters.eventType}
          onChange={(value) => update({ eventType: value })}
          placeholder={t('requests.strategies.allEventTypes')}
          options={enumOptions('procurement_strategies.event_type')}
        />
        <Select
          label={t('requests.filters.owner')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          placeholder={t('requests.filters.allOwners')}
          options={[...owners.entries()].map(([userId, name]) => ({
            value: String(userId),
            label: name,
          }))}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('requests.strategies.kpi.draft')}
          icon="edit"
          value={count((row) => row.status === 'draft' || row.status === 'returned')}
          hint={t('requests.strategies.kpi.draftHint')}
        />
        <KpiCard
          label={t('requests.strategies.kpi.awaiting')}
          icon="gavel"
          tone="info"
          value={count((row) => row.status === 'awaiting_approval')}
          hint={t('requests.strategies.kpi.awaitingHint')}
        />
        <KpiCard
          label={t('requests.strategies.kpi.fairness')}
          icon="scale"
          tone="warning"
          value={
            rows === undefined
              ? null
              : formatCount(rows.reduce((total, row) => total + row.pendingFairnessReviews, 0))
          }
          hint={t('requests.strategies.kpi.fairnessHint')}
        />
        <KpiCard
          label={t('requests.strategies.kpi.approved')}
          icon="checkCircle"
          tone="success"
          value={count((row) => row.status === 'approved')}
          hint={t('requests.strategies.kpi.approvedHint')}
        />
      </KpiGrid>

      <Card flush title={t('requests.strategies.table')}>
        <DataTable<StrategyRow>
          caption={t('requests.strategies.table')}
          rows={strategies.data?.items}
          rowKey={(row) => String(row.id)}
          loading={strategies.isFetching}
          error={strategies.error}
          onRetry={strategies.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          rowHref={(row) => requestPaths.strategy(row.id)}
          rowLabel={(row) => row.title}
          empty={
            <EmptyState
              compact
              icon="compass"
              title={t('requests.strategies.empty')}
              description={
                canClear ? t('requests.register.emptyFiltered') : t('requests.strategies.emptyHint')
              }
            />
          }
          pagination={
            strategies.data === undefined
              ? undefined
              : {
                  page: strategies.data.page,
                  pageSize: strategies.data.pageSize,
                  total: strategies.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'title',
              header: t('requests.strategies.col.strategy'),
              sortable: true,
              cell: (row) => (
                <>
                  <Link to={requestPaths.strategy(row.id)}>{row.title}</Link>
                  <div className="tiq-cell-sub">
                    {row.request !== null
                      ? `${row.request.reference} · `
                      : row.project !== null
                        ? `${row.project.reference} · `
                        : ''}
                    {t('requests.detail.revision', { revision: row.revision })}
                  </div>
                </>
              ),
            },
            {
              id: 'procedure',
              header: t('requests.strategies.col.procedure'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <StatusChip
                    enum="procurement_strategies.procedure"
                    value={row.procedure}
                    size="sm"
                  />
                  <span className="tiq-cell-sub">
                    <StatusChip
                      enum="procurement_strategies.event_type"
                      value={row.eventType}
                      size="sm"
                    />{' '}
                    <StatusChip
                      enum="procurement_strategies.award_model"
                      value={row.awardModel}
                      size="sm"
                    />
                  </span>
                </div>
              ),
            },
            {
              id: 'category',
              header: t('requests.strategies.col.category'),
              cell: (row) => row.category?.name ?? '',
            },
            {
              id: 'estimatedValue',
              header: t('requests.strategies.col.estimate'),
              sortable: true,
              numeric: true,
              cell: (row) => <MoneyText value={row.estimatedValue} />,
            },
            {
              id: 'owner',
              header: t('requests.register.col.owner'),
              cell: (row) =>
                row.owner === null ? (
                  <span className="tiq-text-warning">{t('requests.common.unassigned')}</span>
                ) : (
                  row.owner.fullName
                ),
            },
            {
              id: 'status',
              header: t('requests.register.col.status'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <div>
                    <StatusChip enum="procurement_strategies.status" value={row.status} />
                  </div>
                  {row.pendingFairnessReviews > 0 && (
                    <div>
                      <Chip tone="warning" outlined size="sm">
                        {t('requests.strategies.pendingFairness', {
                          count: row.pendingFairnessReviews,
                        })}
                      </Chip>
                    </div>
                  )}
                </div>
              ),
            },
            {
              id: 'tenders',
              header: t('requests.strategies.col.events'),
              cell: (row) =>
                row.tenders.length === 0 ? (
                  <span className="tiq-text-muted">{t('requests.strategies.noEvents')}</span>
                ) : (
                  <div className="tiq-stack">
                    {row.tenders.map((tender) => (
                      <span key={tender.id}>
                        <Reference value={tender.reference} />{' '}
                        <div>
                          <StatusChip enum="tenders.status" value={tender.status} size="sm" />
                        </div>
                      </span>
                    ))}
                  </div>
                ),
            },
            {
              id: 'updatedAt',
              header: t('requests.strategies.col.updated'),
              sortable: true,
              cell: (row) => formatDateTime(row.updatedAt, timeZone),
            },
          ]}
        />
      </Card>
    </div>
  );
}
