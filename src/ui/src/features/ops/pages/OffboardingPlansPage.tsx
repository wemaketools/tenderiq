/**
 * OPS-02 offboarding plan register: every customer exit with its status, the active events and contracts it must
 * keep serving, the service end date, customer agreement and owner. Plans are started from the customer page.
 */

import { operationsEndpoints } from '@contracts/operations';
import type { OffboardingPlanRow } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { OffboardingPlansStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Card,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { useOperatorStaffOptions } from '../lib/staff';

const DEFAULTS = {
  q: '',
  status: '',
  owner: '',
  from: '',
  to: '',
  page: 1,
  sort: 'updatedAt',
  dir: 'desc',
};

type SortField = 'customer' | 'status' | 'serviceEndDate' | 'updatedAt';

export default function OffboardingPlansPage() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-02', DEFAULTS);
  const staff = useOperatorStaffOptions();
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.status === '' ? {} : { status: [filters.status as OffboardingPlansStatus] }),
    ...(filters.owner === '' ? {} : { ownerUserId: Number(filters.owner) }),
    ...(filters.from === '' ? {} : { serviceEndFrom: filters.from }),
    ...(filters.to === '' ? {} : { serviceEndTo: filters.to }),
  };
  const plans = useApiQuery(operationsEndpoints.listOffboardingPlans, { query });
  const all = useApiQuery(operationsEndpoints.listOffboardingPlans, { query: { pageSize: 100 } });
  const rows = all.data?.items;
  const sum = (pick: (row: OffboardingPlanRow) => number): string | null =>
    rows === undefined ? null : formatCount(rows.reduce((total, row) => total + pick(row), 0));
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.owner !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  return (
    <div className="tiq-page">
      <PageHeader title={t('ops.offboarding.title')} subtitle={t('ops.offboarding.subtitle')} />
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('ops.offboarding.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('ops.offboarding.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('offboarding_plans.status')}
        />
        <Select
          label={t('ops.offboarding.col.owner')}
          placeholder={t('ops.common.all')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          options={staff}
        />
        <DateInput
          label={t('ops.offboarding.filter.from')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('ops.offboarding.filter.to')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('ops.offboarding.kpi.plans')}
          icon="logOut"
          value={
            rows === undefined
              ? null
              : formatCount(rows.filter((row) => row.status !== 'completed').length)
          }
          hint={t('ops.offboarding.kpi.plansHint')}
        />
        <KpiCard
          label={t('ops.offboarding.kpi.awaiting')}
          icon="handshake"
          tone="warning"
          value={
            rows === undefined
              ? null
              : formatCount(rows.filter((row) => row.agreedByCustomerAt === null).length)
          }
          hint={t('ops.offboarding.kpi.awaitingHint')}
        />
        <KpiCard
          label={t('ops.offboarding.kpi.events')}
          icon="fileText"
          tone="danger"
          value={sum((row) => row.activeEventsCount)}
          hint={t('ops.offboarding.kpi.eventsHint')}
        />
        <KpiCard
          label={t('ops.offboarding.kpi.contracts')}
          icon="fileSignature"
          tone="info"
          value={sum((row) => row.activeContractsCount)}
          hint={t('ops.offboarding.kpi.contractsHint')}
        />
      </KpiGrid>
      <Card flush title={t('ops.offboarding.register')}>
        <DataTable<OffboardingPlanRow>
          caption={t('ops.offboarding.register')}
          rows={plans.data?.items}
          rowKey={(row) => String(row.id)}
          loading={plans.isFetching}
          error={plans.error}
          onRetry={plans.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          rowHref={(row) => opsPaths.offboardingPlan(row.id)}
          rowLabel={(row) => t('ops.offboarding.rowLabel', { name: row.customer.name })}
          empty={
            <EmptyState
              compact
              icon="logOut"
              title={t('ops.offboarding.empty')}
              description={t('ops.offboarding.emptyHint')}
            />
          }
          pagination={
            plans.data === undefined
              ? undefined
              : {
                  page: plans.data.page,
                  pageSize: plans.data.pageSize,
                  total: plans.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'customer',
              header: t('ops.offboarding.col.customer'),
              sortable: true,
              cell: (row) => (
                <>
                  <strong>{row.customer.name}</strong>
                  <div className="tiq-cell-sub">
                    <StatusChip enum="tenants.status" value={row.customer.status} size="sm" />
                  </div>
                </>
              ),
            },
            {
              id: 'status',
              header: t('ops.offboarding.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="offboarding_plans.status" value={row.status} />,
            },
            {
              id: 'obligations',
              header: t('ops.offboarding.col.obligations'),
              cell: (row) =>
                t('ops.offboarding.obligationsValue', {
                  events: row.activeEventsCount,
                  contracts: row.activeContractsCount,
                }),
            },
            {
              id: 'serviceEndDate',
              header: t('ops.offboarding.col.serviceEnd'),
              sortable: true,
              cell: (row) => formatCalendarDate(row.serviceEndDate),
            },
            {
              id: 'agreed',
              header: t('ops.offboarding.col.agreed'),
              cell: (row) =>
                row.agreedByCustomerAt === null ? (
                  <span className="tiq-text-warning">{t('ops.offboarding.notAgreed')}</span>
                ) : (
                  formatDateTime(row.agreedByCustomerAt, timeZone)
                ),
            },
            {
              id: 'owner',
              header: t('ops.offboarding.col.owner'),
              cell: (row) => personName(row.owner),
            },
            {
              id: 'updatedAt',
              header: t('ops.offboarding.col.updated'),
              sortable: true,
              cell: (row) => formatDateTime(row.updatedAt, timeZone),
            },
          ]}
        />
      </Card>
    </div>
  );
}
