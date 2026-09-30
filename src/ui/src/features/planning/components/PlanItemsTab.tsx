/**
 * BUY-05 plan items: planned events with their owner, budget period, expected value, planned release and award,
 * resource demand, priority, dependency, expiring contract, advance notice and scheduling warnings.
 */
import { Link, useNavigate } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { PlanItemRow } from '@contracts/requests';
import type { PlanItemsStatus, ProcurementRequestsPriority } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  MoneyText,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableSort } from '../../../components/ui';
import { formatCalendarDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { enumOptions, planningPaths } from '../lib';

const DEFAULT_FILTERS = {
  q: '',
  status: '',
  priority: '',
  owner: '',
  period: '',
  from: '',
  to: '',
  page: 1,
  sort: 'plannedReleaseDate',
  dir: 'asc',
};

type SortField =
  'title' | 'plannedReleaseDate' | 'plannedAwardDate' | 'expectedValue' | 'priority' | 'status';

export function PlanItemsTab() {
  const navigate = useNavigate();
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-05.items', DEFAULT_FILTERS);
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.status === '' ? {} : { status: [filters.status as PlanItemsStatus] }),
    ...(filters.priority === ''
      ? {}
      : { priority: [filters.priority as ProcurementRequestsPriority] }),
    ...(filters.owner === '' ? {} : { ownerUserId: Number(filters.owner) }),
    ...(filters.period === '' ? {} : { budgetPeriod: filters.period }),
    ...(filters.from === '' ? {} : { releaseFrom: filters.from }),
    ...(filters.to === '' ? {} : { releaseTo: filters.to }),
  };
  const items = useApiQuery(requestEndpoints.listPlanItems, { query });
  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.priority !== '' ||
    filters.owner !== '' ||
    filters.period !== '' ||
    filters.from !== '' ||
    filters.to !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };
  const owners = (options.data?.people ?? []).filter((person) =>
    person.roles.includes('plan_owner'),
  );

  return (
    <div className="tiq-stack">
      <FilterBar onClear={clearFilters} canClear={canClear} label={t('planning.items.filters')}>
        <SearchField
          label={t('planning.filters.search')}
          placeholder={t('planning.items.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('planning.filters.status')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          placeholder={t('planning.filters.allStatuses')}
          options={enumOptions('plan_items.status')}
        />
        <Select
          label={t('planning.filters.priority')}
          value={filters.priority}
          onChange={(value) => update({ priority: value })}
          placeholder={t('planning.filters.allPriorities')}
          options={enumOptions('procurement_requests.priority')}
        />
        <Select
          label={t('planning.filters.owner')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          placeholder={t('planning.filters.allOwners')}
          options={owners.map((owner) => ({ value: String(owner.userId), label: owner.fullName }))}
        />
        <Select
          label={t('planning.filters.budgetPeriod')}
          value={filters.period}
          onChange={(value) => update({ period: value })}
          placeholder={t('planning.filters.allPeriods')}
          options={(options.data?.budgetPeriods ?? []).map((period) => ({
            value: period,
            label: period,
          }))}
        />
        <DateInput
          label={t('planning.filters.releaseFrom')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('planning.filters.releaseTo')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>

      <Card flush title={t('planning.items.table')}>
        <DataTable<PlanItemRow>
          caption={t('planning.items.table')}
          rows={items.data?.items}
          rowKey={(row) => String(row.id)}
          loading={items.isFetching}
          error={items.error}
          onRetry={items.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(planningPaths.item(row.id))}
          rowLabel={(row) => row.title}
          empty={
            <EmptyState
              compact
              icon="calendar"
              title={t('planning.items.empty')}
              description={
                canClear ? t('planning.items.emptyFiltered') : t('planning.items.emptyHint')
              }
            />
          }
          pagination={
            items.data === undefined
              ? undefined
              : {
                  page: items.data.page,
                  pageSize: items.data.pageSize,
                  total: items.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'title',
              header: t('planning.items.col.item'),
              sortable: true,
              cell: (row) => (
                <>
                  <Link to={planningPaths.item(row.id)}>{row.title}</Link>
                  <div className="tiq-cell-sub">
                    {[row.request?.reference, row.project?.reference]
                      .filter((value): value is string => value !== undefined)
                      .join(' · ')}
                  </div>
                  {row.dependsOn !== null && (
                    <div className="tiq-cell-sub">
                      {t('planning.items.dependsOnLine', { title: row.dependsOn.title })}
                    </div>
                  )}
                </>
              ),
            },
            {
              id: 'owner',
              header: t('planning.items.col.owner'),
              cell: (row) =>
                row.owner === null ? (
                  <span className="tiq-text-warning">{t('planning.common.unassigned')}</span>
                ) : (
                  row.owner.fullName
                ),
            },
            {
              id: 'budgetPeriod',
              header: t('planning.items.col.period'),
              cell: (row) => row.budgetPeriod,
            },
            {
              id: 'expectedValue',
              header: t('planning.items.col.value'),
              sortable: true,
              numeric: true,
              cell: (row) => <MoneyText value={row.expectedValue} />,
            },
            {
              id: 'plannedReleaseDate',
              header: t('planning.items.col.release'),
              sortable: true,
              cell: (row) =>
                row.plannedReleaseDate === null ? (
                  <span className="tiq-text-warning">{t('planning.common.unscheduled')}</span>
                ) : (
                  <>
                    {formatCalendarDate(row.plannedReleaseDate)}
                    {row.plannedAwardDate !== null && (
                      <div className="tiq-cell-sub">
                        {t('planning.items.awardLine', {
                          date: formatCalendarDate(row.plannedAwardDate),
                        })}
                      </div>
                    )}
                  </>
                ),
            },
            {
              id: 'demand',
              header: t('planning.items.col.demand'),
              numeric: true,
              cell: (row) => t('planning.common.days', { count: row.resourceDemandDays }),
            },
            {
              id: 'priority',
              header: t('planning.items.col.priority'),
              sortable: true,
              cell: (row) => (
                <div>
                  <StatusChip enum="procurement_requests.priority" value={row.priority} size="sm" />
                </div>
              ),
            },
            {
              id: 'status',
              header: t('planning.items.col.status'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <div>
                    <StatusChip enum="plan_items.status" value={row.status} />
                  </div>
                  {row.expiringContract !== null && (
                    <span className="tiq-cell-sub">
                      {t('planning.items.expiring', {
                        reference: row.expiringContract.reference,
                        date: formatCalendarDate(row.expiringContract.expiresOn),
                      })}
                    </span>
                  )}
                  {row.advanceNotice !== null && (
                    <span className="tiq-cell-sub">
                      {t('planning.items.notice')}{' '}
                      <StatusChip
                        enum="advance_notices.status"
                        value={row.advanceNotice.status}
                        size="sm"
                      />
                    </span>
                  )}
                  {row.warnings.length > 0 && (
                    <div>
                      <Chip
                        tone="warning"
                        outlined
                        size="sm"
                        icon="alertTriangle"
                        title={row.warnings.join(' ')}
                      >
                        {t('planning.items.warnings', { count: row.warnings.length })}
                      </Chip>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
