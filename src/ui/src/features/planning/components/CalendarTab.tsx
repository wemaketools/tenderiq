/**
 * BUY-05 month calendar in the buyer's official time zone: planned releases and awards, advance notices, contract
 * expiries and renewal notices, with the month's resource demand per owner against capacity.
 */
import { Link } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { PlanCalendarEntry, PlanCalendarEntryKind } from '@contracts/requests';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Select,
  SkeletonBlock,
} from '../../../components/ui';
import type { ChipTone } from '@contracts/enums';
import { formatCalendarDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { addMonths, monthLabel, monthOf, monthWeeks, weekdayNames } from '../lib';

const KIND_TONES: Record<PlanCalendarEntryKind, ChipTone> = {
  planned_release: 'accent',
  planned_award: 'success',
  advance_notice: 'info',
  contract_expiry: 'danger',
  renewal_notice: 'warning',
};

function EntryChip({ entry }: { readonly entry: PlanCalendarEntry }) {
  const label = `${t(`planning.calendar.kinds.${entry.kind}`)}: ${entry.title}`;
  const chip = (
    <Chip tone={KIND_TONES[entry.kind]} size="sm" title={label}>
      {entry.reference ?? (entry.title.length > 16 ? `${entry.title.slice(0, 15)}…` : entry.title)}
    </Chip>
  );
  return (
    <div>
      {entry.link === null ? (
        chip
      ) : (
        <Link to={entry.link} aria-label={label}>
          {chip}
        </Link>
      )}
    </div>
  );
}

export function CalendarTab() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const now = useNow();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-05.calendar', {
    month: '',
    owner: '',
  });
  const month = filters.month === '' ? monthOf(now, timeZone) : filters.month;
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const calendar = useApiQuery(requestEndpoints.getPlanCalendar, {
    query: { month, ...(filters.owner === '' ? {} : { ownerUserId: Number(filters.owner) }) },
  });
  const owners = (options.data?.people ?? []).filter((person) =>
    person.roles.includes('plan_owner'),
  );
  const entries = calendar.data?.entries ?? [];
  const byDate = new Map<string, PlanCalendarEntry[]>();
  for (const entry of entries) {
    byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  }
  const weekdays = weekdayNames();

  return (
    <div className="tiq-stack">
      <FilterBar
        label={t('planning.calendar.filters')}
        onClear={clearFilters}
        canClear={filters.month !== '' || filters.owner !== ''}
      >
        <div className="tiq-inline" role="group" aria-label={t('planning.calendar.month')}>
          <Button
            size="sm"
            icon="chevronLeft"
            onClick={() => setFilters({ month: addMonths(month, -1) })}
          >
            {t('planning.calendar.previous')}
          </Button>
          <strong aria-live="polite">{monthLabel(month)}</strong>
          <Button
            size="sm"
            iconAfter="chevronRight"
            onClick={() => setFilters({ month: addMonths(month, 1) })}
          >
            {t('planning.calendar.next')}
          </Button>
        </div>
        <Select
          label={t('planning.filters.owner')}
          value={filters.owner}
          onChange={(value) => setFilters({ owner: value })}
          placeholder={t('planning.filters.allOwners')}
          options={owners.map((owner) => ({ value: String(owner.userId), label: owner.fullName }))}
        />
      </FilterBar>

      <Card
        title={monthLabel(month)}
        subtitle={t('planning.calendar.zone', { zone: calendar.data?.timeZone ?? timeZone })}
      >
        {calendar.status === 'loading' && <SkeletonBlock />}
        {calendar.status === 'error' && calendar.error !== null && (
          <ErrorState error={calendar.error} onRetry={calendar.reload} />
        )}
        {calendar.data !== undefined && (
          <>
            <div className="tiq-inline" aria-label={t('planning.calendar.legend')}>
              {(Object.keys(KIND_TONES) as PlanCalendarEntryKind[]).map((kind) => (
                <Chip key={kind} tone={KIND_TONES[kind]} size="sm">
                  {t(`planning.calendar.kinds.${kind}`)}
                </Chip>
              ))}
            </div>
            <div className="tiq-table-wrap">
              <table style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  {weekdays.map((day) => (
                    <col key={day} style={{ width: `${100 / 7}%` }} />
                  ))}
                </colgroup>
                <caption className="tiq-visually-hidden">
                  {t('planning.calendar.caption', { month: monthLabel(month) })}
                </caption>
                <thead>
                  <tr>
                    {weekdays.map((day) => (
                      <th key={day} scope="col">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthWeeks(month).map((week) => (
                    <tr key={week.find((day) => day !== null) ?? 'empty'}>
                      {week.map((day, index) =>
                        day === null ? (
                          <td key={`blank-${index}`} aria-hidden="true" />
                        ) : (
                          <td key={day}>
                            <div className="tiq-cell-sub">{Number(day.slice(8))}</div>
                            {(byDate.get(day) ?? []).length > 0 && (
                              <div
                                className="tiq-stack"
                                role="group"
                                aria-label={formatCalendarDate(day)}
                              >
                                {(byDate.get(day) ?? []).map((entry) => (
                                  <EntryChip key={entry.id} entry={entry} />
                                ))}
                              </div>
                            )}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {entries.length === 0 && (
              <EmptyState compact icon="calendar" title={t('planning.calendar.empty')} />
            )}
            {calendar.data.unscheduledCount > 0 && (
              <p className="tiq-text-warning">
                {t('planning.calendar.unscheduled', { count: calendar.data.unscheduledCount })}
              </p>
            )}
          </>
        )}
      </Card>

      <Card flush title={t('planning.calendar.demandTitle', { month: monthLabel(month) })}>
        <DataTable
          caption={t('planning.calendar.demandTitle', { month: monthLabel(month) })}
          rows={calendar.data?.resourceDemand}
          rowKey={(row) => String(row.owner.userId)}
          loading={calendar.isFetching}
          error={calendar.error}
          onRetry={calendar.reload}
          empty={<EmptyState compact title={t('planning.demand.empty')} />}
          columns={[
            {
              id: 'owner',
              header: t('planning.demand.col.owner'),
              cell: (row) => row.owner.fullName,
            },
            {
              id: 'items',
              header: t('planning.demand.col.items'),
              numeric: true,
              cell: (row) => row.itemCount,
            },
            {
              id: 'demand',
              header: t('planning.demand.col.demand'),
              numeric: true,
              cell: (row) =>
                t('planning.demand.ofCapacity', {
                  demand: row.demandDays,
                  capacity: row.capacityDays,
                }),
            },
            {
              id: 'state',
              header: t('planning.demand.col.state'),
              cell: (row) =>
                row.overAllocated ? (
                  <div>
                    <Chip tone="danger" size="sm" icon="alertTriangle">
                      {t('planning.demand.over')}
                    </Chip>
                  </div>
                ) : (
                  <div>
                    <Chip tone="success" size="sm">
                      {t('planning.demand.within')}
                    </Chip>
                  </div>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
