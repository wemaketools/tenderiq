/**
 * BUY-18 Briefings and visits: the sessions of the active buyer with logistics, registered suppliers, attendance,
 * mandatory status, accommodations and minutes. Scheduling, attendance, shared answers and attendance exceptions
 * run on the session page.
 */
import { useNavigate } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { BuyerSessionRow } from '@contracts/clarifications';
import type { SessionsSessionType, SessionsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import {
  ButtonLink,
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
} from '../../../../components/ui';
import type { DataTableSort } from '../../../../components/ui';
import { formatCount, formatOfficialTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { BuyerTabs } from '../../components/BuyerTabs';
import { BuyerTenderSelect } from '../../components/BuyerTenderSelect';
import { useBuyerTenders } from '../../hooks';
import { buyerPaths, enumOptions } from '../../lib';

const DEFAULT_FILTERS = {
  tender: '',
  type: '',
  status: '',
  mandatory: false,
  from: '',
  to: '',
  q: '',
  page: 1,
  sort: 'startsAt',
  dir: 'asc',
};

type SortField = 'startsAt' | 'title' | 'tenderReference' | 'status';

export default function SessionsPage() {
  const navigate = useNavigate();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-18', DEFAULT_FILTERS);
  const tenders = useBuyerTenders();
  const tenderId = filters.tender === '' ? undefined : Number(filters.tender);
  const sessions = useApiQuery(clarificationsEndpoints.sessionsList, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as SortField,
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(tenderId === undefined ? {} : { tenderId }),
      ...(filters.type === '' ? {} : { sessionType: filters.type as SessionsSessionType }),
      ...(filters.status === '' ? {} : { status: [filters.status as SessionsStatus] }),
      ...(filters.mandatory ? { mandatory: true } : {}),
      ...(filters.from === '' ? {} : { startsFrom: filters.from }),
      ...(filters.to === '' ? {} : { startsTo: filters.to }),
    },
  });
  const rows = sessions.data?.items;
  const total = (pick: (row: BuyerSessionRow) => number): number | null =>
    rows === undefined ? null : rows.reduce((sum, row) => sum + pick(row), 0);
  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.tender !== '' ||
    filters.type !== '' ||
    filters.status !== '' ||
    filters.mandatory ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.q !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.sessions.title')}
        subtitle={t('clarifications.sessions.subtitle')}
        primaryAction={
          <ButtonLink
            variant="primary"
            icon="plus"
            to={
              tenderId === undefined
                ? buyerPaths.newSession
                : `${buyerPaths.newSession}?tenderId=${tenderId}`
            }
          >
            {t('clarifications.sessions.new')}
          </ButtonLink>
        }
      />
      <BuyerTabs />

      <FilterBar onClear={clearFilters} canClear={canClear}>
        <BuyerTenderSelect
          tenders={tenders.data?.items}
          value={filters.tender}
          onChange={(value) => update({ tender: value })}
          placeholder={t('clarifications.filters.allTenders')}
        />
        <Select
          label={t('clarifications.filters.sessionType')}
          value={filters.type}
          onChange={(value) => update({ type: value })}
          placeholder={t('clarifications.filters.allTypes')}
          options={enumOptions('sessions.session_type')}
        />
        <Select
          label={t('clarifications.filters.status')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          placeholder={t('clarifications.filters.allStatuses')}
          options={enumOptions('sessions.status')}
        />
        <DateInput
          label={t('clarifications.filters.startsFrom')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('clarifications.filters.startsTo')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
        <SearchField
          label={t('clarifications.filters.search')}
          placeholder={t('clarifications.sessions.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Checkbox
          label={t('clarifications.filters.mandatoryOnly')}
          checked={filters.mandatory}
          onChange={(checked) => update({ mandatory: checked })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('clarifications.sessions.kpi.scheduled')}
          icon="calendar"
          value={formatCount(
            rows === undefined ? null : rows.filter((row) => row.status === 'scheduled').length,
          )}
          hint={t('clarifications.sessions.kpi.listHint')}
        />
        <KpiCard
          label={t('clarifications.sessions.kpi.registered')}
          icon="users"
          tone="info"
          value={formatCount(total((row) => row.registered))}
          hint={t('clarifications.sessions.kpi.listHint')}
        />
        <KpiCard
          label={t('clarifications.sessions.kpi.accommodations')}
          icon="userCheck"
          tone="warning"
          value={formatCount(total((row) => row.accessibilityRequests))}
          hint={t('clarifications.sessions.kpi.listHint')}
        />
        <KpiCard
          label={t('clarifications.sessions.kpi.exceptions')}
          icon="alertTriangle"
          tone="danger"
          value={formatCount(total((row) => row.openAttendanceExceptions))}
          hint={t('clarifications.sessions.kpi.exceptionsHint')}
        />
      </KpiGrid>

      <Card flush title={t('clarifications.sessions.register')}>
        <DataTable<BuyerSessionRow>
          caption={t('clarifications.sessions.register')}
          rows={rows}
          rowKey={(row) => String(row.id)}
          loading={sessions.isFetching}
          error={sessions.error}
          onRetry={sessions.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(buyerPaths.session(row.id))}
          rowLabel={(row) => row.title}
          empty={
            <EmptyState
              compact
              icon="calendar"
              title={t('clarifications.sessions.empty')}
              description={t('clarifications.sessions.emptyHint')}
            />
          }
          pagination={
            sessions.data === undefined
              ? undefined
              : {
                  page: sessions.data.page,
                  pageSize: sessions.data.pageSize,
                  total: sessions.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'title',
              header: t('clarifications.sessions.col.session'),
              sortable: true,
              cell: (row) => (
                <>
                  <span className="tiq-inline">
                    <StatusChip enum="sessions.session_type" value={row.sessionType} size="sm" />
                    {row.title}
                  </span>
                  <div className="tiq-cell-sub">{row.venue}</div>
                </>
              ),
            },
            {
              id: 'tenderReference',
              header: t('clarifications.sessions.col.tender'),
              sortable: true,
              cell: (row) => <Reference value={row.tender.reference} />,
            },
            {
              id: 'startsAt',
              header: t('clarifications.sessions.col.starts'),
              sortable: true,
              cell: (row) => formatOfficialTime(row.startsAt, row.timeZone),
            },
            {
              id: 'places',
              header: t('clarifications.sessions.col.places'),
              numeric: true,
              cell: (row) => (
                <>
                  {t('clarifications.sessions.placesValue', {
                    registered: row.registered,
                    capacity: row.capacity,
                  })}
                  <div className="tiq-cell-sub">
                    {t('clarifications.sessions.available', { count: row.placesAvailable })}
                  </div>
                </>
              ),
            },
            {
              id: 'mandatory',
              header: t('clarifications.sessions.col.mandatory'),
              cell: (row) =>
                row.mandatory ? (
                  <Chip tone="warning" size="sm">
                    {t('clarifications.sessions.mandatory')}
                  </Chip>
                ) : (
                  <span className="tiq-text-muted">{t('clarifications.sessions.optional')}</span>
                ),
            },
            {
              id: 'attendance',
              header: t('clarifications.sessions.col.attendance'),
              cell: (row) =>
                row.status === 'completed' ? (
                  <>
                    {t('clarifications.sessions.attendanceValue', {
                      attended: row.attended,
                      absent: row.absent,
                    })}
                    {row.openAttendanceExceptions > 0 && (
                      <div className="tiq-cell-sub tiq-text-danger">
                        {t('clarifications.sessions.exceptions', {
                          count: row.openAttendanceExceptions,
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="tiq-text-muted">{t('clarifications.sessions.notHeld')}</span>
                ),
            },
            {
              id: 'accommodations',
              header: t('clarifications.sessions.col.accommodations'),
              numeric: true,
              cell: (row) => formatCount(row.accessibilityRequests),
            },
            {
              id: 'minutes',
              header: t('clarifications.sessions.col.minutes'),
              cell: (row) =>
                row.minutesPublishedAt === null ? (
                  <span className="tiq-text-muted">{t('clarifications.sessions.noMinutes')}</span>
                ) : (
                  <Chip tone="success" size="sm">
                    {t('clarifications.sessions.minutesPublished')}
                  </Chip>
                ),
            },
            {
              id: 'status',
              header: t('clarifications.sessions.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="sessions.status" value={row.status} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
