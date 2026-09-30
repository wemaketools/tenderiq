/**
 * BUY-05 resource demand: planned procurement effort (days) per owner and month against the owner's monthly
 * capacity, plus the demand that has no owner yet (allocate owners).
 */
import { requestEndpoints } from '@contracts/requests';
import type { ResourceDemand } from '@contracts/requests';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { Card, Chip, DataTable, EmptyState, FilterBar, Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { addMonths, monthLabel, monthOf, shortMonthLabel } from '../lib';

interface DemandRow {
  readonly id: string;
  readonly owner: string;
  readonly capacity: number | null;
  readonly months: ReadonlyMap<string, { readonly demand: number; readonly over: boolean }>;
}

function rowsOf(data: ResourceDemand): DemandRow[] {
  const owners: DemandRow[] = data.owners.map((owner) => ({
    id: String(owner.owner.userId),
    owner: owner.owner.fullName,
    capacity: owner.capacityDaysPerMonth,
    months: new Map(
      owner.months.map((month) => [
        month.month,
        { demand: month.demandDays, over: month.overAllocated },
      ]),
    ),
  }));
  const unassigned = data.unassigned.filter((month) => month.demandDays > 0);
  if (unassigned.length === 0) return owners;
  return [
    ...owners,
    {
      id: 'unassigned',
      owner: t('planning.common.unassigned'),
      capacity: null,
      months: new Map(
        unassigned.map((month) => [month.month, { demand: month.demandDays, over: false }]),
      ),
    },
  ];
}

export function ResourceDemandTab() {
  const tenant = useActiveTenant();
  const now = useNow();
  const current = monthOf(now, tenant?.officialTimeZone ?? 'UTC');
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-05.demand', {
    from: '',
    span: 6,
  });
  const from = filters.from === '' ? current : filters.from;
  const to = addMonths(from, filters.span - 1);
  const demand = useApiQuery(requestEndpoints.getResourceDemand, { query: { from, to } });
  const monthChoices = Array.from({ length: 13 }, (_, index) => addMonths(current, index - 3));
  const rows = demand.data === undefined ? undefined : rowsOf(demand.data);
  const overCount = (demand.data?.owners ?? []).filter((owner) =>
    owner.months.some((month) => month.overAllocated),
  ).length;

  return (
    <div className="tiq-stack">
      <FilterBar
        label={t('planning.demand.filters')}
        onClear={clearFilters}
        canClear={filters.from !== '' || filters.span !== 6}
      >
        <Select
          label={t('planning.demand.from')}
          value={from}
          onChange={(value) => setFilters({ from: value })}
          options={monthChoices.map((month) => ({ value: month, label: monthLabel(month) }))}
        />
        <Select
          label={t('planning.demand.span')}
          value={String(filters.span)}
          onChange={(value) => setFilters({ span: Number(value) })}
          options={[3, 6, 9, 12].map((span) => ({
            value: String(span),
            label: t('planning.common.months', { count: span }),
          }))}
        />
      </FilterBar>

      <Card
        flush
        title={t('planning.demand.title', { from: monthLabel(from), to: monthLabel(to) })}
        subtitle={
          overCount > 0
            ? t('planning.demand.overSummary', { count: overCount })
            : t('planning.demand.withinSummary')
        }
      >
        <DataTable<DemandRow>
          caption={t('planning.demand.title', { from: monthLabel(from), to: monthLabel(to) })}
          rows={rows}
          rowKey={(row) => row.id}
          loading={demand.isFetching}
          error={demand.error}
          onRetry={demand.reload}
          empty={<EmptyState compact icon="users" title={t('planning.demand.empty')} />}
          columns={[
            {
              id: 'owner',
              header: t('planning.demand.col.owner'),
              cell: (row) => (
                <>
                  {row.owner}
                  <div className="tiq-cell-sub">
                    {row.capacity === null
                      ? t('planning.demand.allocate')
                      : t('planning.demand.capacity', { days: row.capacity })}
                  </div>
                </>
              ),
            },
            ...(demand.data?.months ?? []).map((month) => ({
              id: month,
              header: shortMonthLabel(month),
              numeric: true,
              cell: (row: DemandRow) => {
                const cell = row.months.get(month);
                if (cell === undefined || cell.demand === 0) {
                  return <span className="tiq-text-muted">0</span>;
                }
                return cell.over ? (
                  <div>
                    <Chip tone="danger" size="sm" title={t('planning.demand.over')}>
                      {row.capacity === null
                        ? String(cell.demand)
                        : t('planning.demand.ofCapacity', {
                            demand: cell.demand,
                            capacity: row.capacity,
                          })}
                    </Chip>
                  </div>
                ) : (
                  <span className={row.capacity === null ? 'tiq-text-warning' : undefined}>
                    {row.capacity === null
                      ? String(cell.demand)
                      : t('planning.demand.ofCapacity', {
                          demand: cell.demand,
                          capacity: row.capacity,
                        })}
                  </span>
                );
              },
            })),
          ]}
        />
      </Card>
    </div>
  );
}
