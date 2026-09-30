/**
 * ADM-10 — Calendars and deadline policies: working days, holidays, official zone, reminder periods and notice
 * rules; approved calendars are maintained, and changes are reviewed against active events before they apply
 * (BR-12). The deadline policy summarizes what applies with the calendars.
 */
import { useNavigate } from 'react-router';

import { CALENDAR_SORT_FIELDS, getDeadlinePolicy, listCalendars } from '@contracts/calendars';
import type { CalendarSummary } from '@contracts/calendars';
import { CALENDARS_STATUS } from '@contracts/enums';
import type { CalendarsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  ButtonLink,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  SearchField,
  Select,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { compact, directionOf, oneOf, triState, useDisplayTimeZone } from '../../tasks/lib/shared';
import { CalendarStatus, DeadlinePolicyCard } from '../components/CalendarParts';
import { calendarPaths, formatWorkingDays } from '../lib/calendars';

type SortField = (typeof CALENDAR_SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  status: '',
  active: '',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (CALENDAR_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as SortField)
    : 'name';
}

export default function CalendarsPage() {
  const navigate = useNavigate();
  const timeZone = useDisplayTimeZone();
  const canManage = usePermission('org.calendars.manage');
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-10', DEFAULTS);
  const policy = useApiQuery(getDeadlinePolicy, {});
  const overview = useApiQuery(listCalendars, { query: { pageSize: 100 } });
  const query = useApiQuery(listCalendars, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf<CalendarsStatus>(filters.status, CALENDARS_STATUS),
      active: triState(filters.active),
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const all = overview.data?.items ?? [];
  const loading = overview.data === undefined;
  const count = (predicate: (row: CalendarSummary) => boolean): string =>
    loading ? '…' : formatCount(all.filter(predicate).length);
  const defaultCalendar = all.find((row) => row.isDefault);
  const filtered = [filters.q, filters.status, filters.active].some((value) => value !== '');

  const columns: DataTableColumn<CalendarSummary>[] = [
    {
      id: 'name',
      header: t('calendars.list.col.name'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-inline">
            <span>{row.name}</span>
            {row.isDefault && (
              <Chip tone="accent" size="sm" icon="star">
                {t('calendars.list.default')}
              </Chip>
            )}
          </span>
          <span className="tiq-cell-sub">{t('calendars.list.zone', { zone: row.timeZone })}</span>
        </>
      ),
    },
    {
      id: 'workingDays',
      header: t('calendars.list.col.workingDays'),
      cell: (row) => formatWorkingDays(row.workingDays),
    },
    {
      id: 'holidays',
      header: t('calendars.list.col.holidays'),
      cell: (row) => (
        <>
          <span>{t('calendars.list.holidaysLine', { count: row.holidayCount })}</span>
          {row.coverageFrom !== undefined &&
            row.coverageFrom !== null &&
            row.coverageTo !== undefined &&
            row.coverageTo !== null && (
              <span className="tiq-cell-sub">
                {t('calendars.list.coverage', {
                  from: formatCalendarDate(row.coverageFrom),
                  to: formatCalendarDate(row.coverageTo),
                })}
              </span>
            )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('calendars.list.col.status'),
      sortable: true,
      cell: (row) => <CalendarStatus status={row.status} />,
    },
    {
      id: 'events',
      header: t('calendars.list.col.events'),
      numeric: true,
      cell: (row) => formatCount(row.activeEventCount),
    },
    {
      id: 'approved',
      header: t('calendars.list.col.approved'),
      cell: (row) =>
        row.approvedAt === null ? (
          <>
            <span className="tiq-text-muted">{t('calendars.list.notApproved')}</span>
            {row.createdBy !== undefined && row.createdBy !== null && (
              <span className="tiq-cell-sub">
                {t('calendars.list.createdBy', { name: row.createdBy.fullName })}
              </span>
            )}
          </>
        ) : (
          <>
            <span>{formatInstantDate(row.approvedAt, timeZone)}</span>
            {row.approvedBy !== null && (
              <span className="tiq-cell-sub">
                {t('calendars.list.approvedBy', { name: row.approvedBy.fullName })}
              </span>
            )}
          </>
        ),
    },
    {
      id: 'updatedAt',
      header: t('calendars.list.col.updated'),
      sortable: true,
      cell: (row) => formatInstantDate(row.updatedAt, timeZone),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('calendars.list.title')}
        subtitle={t('calendars.list.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to={calendarPaths.create} variant="primary" icon="plus">
              {t('calendars.list.new')}
            </ButtonLink>
          ) : undefined
        }
      />
      <FilterBar label={t('calendars.list.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('calendars.list.search')}
          placeholder={t('calendars.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('calendars.list.status')}
          placeholder={t('calendars.list.allStatuses')}
          value={filters.status}
          options={CALENDARS_STATUS.map((value) => ({
            value,
            label: tEnum('calendars.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('calendars.list.usable')}
          placeholder={t('calendars.list.anyUsable')}
          value={filters.active}
          options={[
            { value: 'true', label: t('calendars.list.activeOnly') },
            { value: 'false', label: t('calendars.list.inactiveOnly') },
          ]}
          onChange={(active) => setFilters({ active, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('calendars.kpi.approved')}
          icon="calendar"
          tone="success"
          value={count((row) => row.status === 'approved')}
          hint={t('calendars.kpi.approvedHint')}
        />
        <KpiCard
          label={t('calendars.kpi.drafts')}
          icon="edit"
          tone="warning"
          value={count((row) => row.status === 'draft')}
          hint={t('calendars.kpi.draftsHint')}
        />
        <KpiCard
          label={t('calendars.kpi.events')}
          icon="fileText"
          tone="info"
          value={
            loading ? '…' : formatCount(all.reduce((total, row) => total + row.activeEventCount, 0))
          }
          hint={t('calendars.kpi.eventsHint')}
        />
        <KpiCard
          label={t('calendars.kpi.defaultCalendar')}
          icon="star"
          value={loading ? '…' : (defaultCalendar?.name ?? t('calendars.kpi.noDefault'))}
          to={
            defaultCalendar === undefined ? undefined : calendarPaths.calendar(defaultCalendar.id)
          }
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('calendars.list.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.name}
          onRowClick={(row) => void navigate(calendarPaths.calendar(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: sortField(filters.sort), dir: directionOf(filters.dir) }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="calendar"
              title={filtered ? t('calendars.list.emptyFiltered') : t('calendars.list.empty')}
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
      <QueryView query={policy}>{(data) => <DeadlinePolicyCard policy={data} />}</QueryView>
    </div>
  );
}
