/**
 * SUP-11 Briefings and site visits: the sessions of the tenders the supplier participates in, with venue, available
 * places, mandatory status, the registration deadline and the supplier's own booking.
 */
import { useNavigate } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { SupplierSessionRow } from '@contracts/clarifications';
import type { SessionsSessionType, SessionsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import {
  Card,
  Checkbox,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableSort } from '../../../../components/ui';
import { EMPTY_VALUE, formatCount, formatOfficialTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { enumOptions, supplierPaths } from '../../lib';

const DEFAULT_FILTERS = {
  tender: '',
  type: '',
  status: '',
  registered: false,
  q: '',
  page: 1,
  sort: 'startsAt',
  dir: 'asc',
};

const TENDERS_REQUEST = { query: { pageSize: 100 } } as const;

export default function SupplierSessionsPage() {
  const navigate = useNavigate();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-11', DEFAULT_FILTERS);
  const tenders = useApiQuery(clarificationsEndpoints.supplierTenders, TENDERS_REQUEST);
  const tenderId = filters.tender === '' ? undefined : Number(filters.tender);
  const sessions = useApiQuery(clarificationsEndpoints.supplierSessionsList, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as 'startsAt' | 'tenderReference',
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(tenderId === undefined ? {} : { tenderId }),
      ...(filters.type === '' ? {} : { sessionType: filters.type as SessionsSessionType }),
      ...(filters.status === '' ? {} : { status: [filters.status as SessionsStatus] }),
      ...(filters.registered ? { registered: true } : {}),
    },
  });
  const rows = sessions.data?.items;
  const count = (predicate: (row: SupplierSessionRow) => boolean): number | null =>
    rows === undefined ? null : rows.filter(predicate).length;
  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.tender !== '' ||
    filters.type !== '' ||
    filters.status !== '' ||
    filters.registered ||
    filters.q !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };
  const booked = (row: SupplierSessionRow): boolean =>
    row.ownRegistration !== null && row.ownRegistration.status !== 'cancelled';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.supplierSessions.title')}
        subtitle={t('clarifications.supplierSessions.subtitle')}
      />
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <Select
          label={t('clarifications.filters.tender')}
          value={filters.tender}
          onChange={(value) => update({ tender: value })}
          placeholder={t('clarifications.filters.allTenders')}
          options={(tenders.data?.items ?? []).map((row) => ({
            value: String(row.tenderId),
            label: `${row.reference} · ${row.title}`,
          }))}
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
        <SearchField
          label={t('clarifications.filters.search')}
          placeholder={t('clarifications.sessions.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Checkbox
          label={t('clarifications.filters.registeredOnly')}
          checked={filters.registered}
          onChange={(checked) => update({ registered: checked })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('clarifications.supplierSessions.kpi.upcoming')}
          icon="calendar"
          value={formatCount(count((row) => row.status === 'scheduled'))}
          hint={t('clarifications.sessions.kpi.listHint')}
        />
        <KpiCard
          label={t('clarifications.supplierSessions.kpi.booked')}
          icon="userCheck"
          tone="success"
          value={formatCount(count(booked))}
          hint={t('clarifications.sessions.kpi.listHint')}
        />
        <KpiCard
          label={t('clarifications.supplierSessions.kpi.mandatory')}
          icon="alertTriangle"
          tone="warning"
          value={formatCount(
            count((row) => row.mandatory && row.status === 'scheduled' && !booked(row)),
          )}
          hint={t('clarifications.supplierSessions.kpi.mandatoryHint')}
        />
        <KpiCard
          label={t('clarifications.supplierSessions.kpi.minutes')}
          icon="fileText"
          tone="info"
          value={formatCount(count((row) => row.minutesPublishedAt !== null))}
          hint={t('clarifications.sessions.kpi.listHint')}
        />
      </KpiGrid>

      <Card flush title={t('clarifications.supplierSessions.list')}>
        <DataTable<SupplierSessionRow>
          caption={t('clarifications.supplierSessions.list')}
          rows={rows}
          rowKey={(row) => String(row.id)}
          loading={sessions.isFetching}
          error={sessions.error}
          onRetry={sessions.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(supplierPaths.session(row.id))}
          rowLabel={(row) => row.title}
          empty={
            <EmptyState
              compact
              icon="calendar"
              title={t('clarifications.supplierSessions.empty')}
              description={t('clarifications.supplierSessions.emptyHint')}
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
              id: 'session',
              header: t('clarifications.sessions.col.session'),
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
              cell: (row) => (
                <>
                  <Reference
                    value={row.tender.reference}
                    to={supplierPaths.tender(row.tender.tenderId)}
                  />
                  <div className="tiq-cell-sub">{row.buyer.name}</div>
                </>
              ),
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
              cell: (row) => t('clarifications.sessions.available', { count: row.placesAvailable }),
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
              id: 'deadline',
              header: t('clarifications.sessionPage.registrationDeadline'),
              cell: (row) =>
                row.registrationDeadline === null ? (
                  EMPTY_VALUE
                ) : (
                  <OfficialDeadline deadline={row.registrationDeadline} showLocal={false} />
                ),
            },
            {
              id: 'booking',
              header: t('clarifications.supplierSessions.col.booking'),
              cell: (row) =>
                row.ownRegistration === null ? (
                  <span className="tiq-text-muted">
                    {row.registrationOpen
                      ? t('clarifications.supplierSessions.notBooked')
                      : t('clarifications.supplierSessions.registrationClosed')}
                  </span>
                ) : (
                  <StatusChip
                    enum="session_registrations.status"
                    value={row.ownRegistration.status}
                    size="sm"
                  />
                ),
            },
            {
              id: 'status',
              header: t('clarifications.sessions.col.status'),
              cell: (row) => <StatusChip enum="sessions.status" value={row.status} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
