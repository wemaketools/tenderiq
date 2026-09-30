/**
 * OPS-04 Support cases: the case queue with purpose (category), customer, status, assignee, routing and whether a
 * customer-authorized access grant is active. Actions: log a case, open a case to assist within the grant. Support
 * never impersonates a customer and is never a bid-submission channel.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { SupportCaseRow } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { SupportCasesCategory, SupportCasesStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
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
  useToast,
} from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { LogCaseDialog } from '../components/LogCaseDialog';
import { SupportTabs } from '../components/SupportTabs';
import { opsPaths } from '../lib/paths';
import { SUPPORT_MANAGE } from '../lib/permissions';
import { useOperatorStaffOptions } from '../lib/staff';

const DEFAULTS = {
  q: '',
  status: '',
  category: '',
  customer: '',
  assignee: '',
  from: '',
  to: '',
  page: 1,
  sort: 'updatedAt',
  dir: 'desc',
};

type SortField = 'reference' | 'customer' | 'category' | 'status' | 'createdAt' | 'updatedAt';

const OPEN_STATUSES: readonly SupportCasesStatus[] = ['open', 'in_progress', 'awaiting_customer'];

export default function SupportCasesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(SUPPORT_MANAGE);
  const [logging, setLogging] = useState(false);
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-04', DEFAULTS);
  const staff = useOperatorStaffOptions();
  const customers = useApiQuery(operationsEndpoints.listCustomers, {
    query: { pageSize: 100, sort: 'name' },
  });
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.status === '' ? {} : { status: [filters.status as SupportCasesStatus] }),
    ...(filters.category === '' ? {} : { category: [filters.category as SupportCasesCategory] }),
    ...(filters.customer === '' ? {} : { customerTenantId: Number(filters.customer) }),
    ...(filters.assignee === 'unassigned' ? { unassigned: true } : {}),
    ...(filters.assignee !== '' && filters.assignee !== 'unassigned'
      ? { assignedOperatorUserId: Number(filters.assignee) }
      : {}),
    ...(filters.from === '' ? {} : { createdFrom: filters.from }),
    ...(filters.to === '' ? {} : { createdTo: filters.to }),
  };
  const cases = useApiQuery(operationsEndpoints.listSupportCases, { query });
  const all = useApiQuery(operationsEndpoints.listSupportCases, { query: { pageSize: 100 } });
  const everything = all.data?.items;
  const count = (predicate: (row: SupportCaseRow) => boolean): string | null =>
    everything === undefined ? null : formatCount(everything.filter(predicate).length);
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear = Object.entries(DEFAULTS).some(
    ([key, value]) =>
      !['page', 'sort', 'dir'].includes(key) && filters[key as keyof typeof DEFAULTS] !== value,
  );

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('ops.support.title')}
        subtitle={t('ops.support.subtitle')}
        primaryAction={
          canManage ? (
            <Button variant="primary" icon="plus" onClick={() => setLogging(true)}>
              {t('ops.support.log.open')}
            </Button>
          ) : undefined
        }
      />
      <SupportTabs />
      <Banner tone="info" title={t('ops.support.ruleTitle')}>
        <p>{t('ops.support.rule')}</p>
      </Banner>

      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('ops.support.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('ops.support.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('support_cases.status')}
        />
        <Select
          label={t('ops.support.col.category')}
          placeholder={t('ops.common.all')}
          value={filters.category}
          onChange={(value) => update({ category: value })}
          options={enumOptions('support_cases.category')}
        />
        <Select
          label={t('ops.support.col.customer')}
          placeholder={t('ops.common.all')}
          value={filters.customer}
          onChange={(value) => update({ customer: value })}
          options={(customers.data?.items ?? []).map((row) => ({
            value: String(row.tenantId),
            label: row.name,
          }))}
        />
        <Select
          label={t('ops.support.col.assignee')}
          placeholder={t('ops.common.all')}
          value={filters.assignee}
          onChange={(value) => update({ assignee: value })}
          options={[{ value: 'unassigned', label: t('ops.common.unassigned') }, ...staff]}
        />
        <DateInput
          label={t('ops.support.filter.from')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('ops.support.filter.to')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('ops.support.kpi.open')}
          icon="lifeBuoy"
          value={count((row) => OPEN_STATUSES.includes(row.status))}
          hint={t('ops.support.kpi.openHint')}
        />
        <KpiCard
          label={t('ops.support.kpi.unassigned')}
          icon="userPlus"
          tone="warning"
          value={count(
            (row) => row.assignedOperator === null && OPEN_STATUSES.includes(row.status),
          )}
          hint={t('ops.support.kpi.unassignedHint')}
        />
        <KpiCard
          label={t('ops.support.kpi.grants')}
          icon="key"
          tone="info"
          value={count((row) => row.activeGrant)}
          hint={t('ops.support.kpi.grantsHint')}
          to={opsPaths.supportGrants}
        />
        <KpiCard
          label={t('ops.support.kpi.routed')}
          icon="arrowRight"
          tone="success"
          value={count((row) => row.status === 'routed_to_buyer')}
          hint={t('ops.support.kpi.routedHint')}
        />
      </KpiGrid>

      <Card flush title={t('ops.support.queue')}>
        <DataTable<SupportCaseRow>
          caption={t('ops.support.queue')}
          rows={cases.data?.items}
          rowKey={(row) => String(row.id)}
          loading={cases.isFetching}
          error={cases.error}
          onRetry={cases.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          rowHref={(row) => opsPaths.supportCase(row.id)}
          rowLabel={(row) => t('ops.support.rowLabel', { reference: row.reference })}
          empty={
            <EmptyState
              compact
              icon="lifeBuoy"
              title={t('ops.support.empty')}
              description={t('ops.support.emptyHint')}
            />
          }
          pagination={
            cases.data === undefined
              ? undefined
              : {
                  page: cases.data.page,
                  pageSize: cases.data.pageSize,
                  total: cases.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'reference',
              header: t('ops.support.col.case'),
              sortable: true,
              width: '28%',
              cell: (row) => (
                <>
                  <span className="tiq-mono">{row.reference}</span>
                  <div className="tiq-cell-sub">{row.subject}</div>
                </>
              ),
            },
            {
              id: 'customer',
              header: t('ops.support.col.customer'),
              sortable: true,
              cell: (row) => (
                <>
                  {row.customer.name}
                  <div className="tiq-cell-sub">{row.openedBy.fullName}</div>
                </>
              ),
            },
            {
              id: 'category',
              header: t('ops.support.col.category'),
              sortable: true,
              cell: (row) => (
                <StatusChip enum="support_cases.category" value={row.category} size="sm" />
              ),
            },
            {
              id: 'assignee',
              header: t('ops.support.col.assignee'),
              cell: (row) =>
                row.assignedOperator === null ? (
                  <span className="tiq-text-warning">{t('ops.common.unassigned')}</span>
                ) : (
                  row.assignedOperator.fullName
                ),
            },
            {
              id: 'status',
              header: t('ops.support.col.status'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <span>
                    <StatusChip enum="support_cases.status" value={row.status} />
                  </span>
                  {row.routedTo !== null && (
                    <span className="tiq-cell-sub">
                      {t('ops.support.routedTo', { name: row.routedTo.name })}
                    </span>
                  )}
                </div>
              ),
            },
            {
              id: 'grant',
              header: t('ops.support.col.access'),
              cell: (row) =>
                row.activeGrant ? (
                  <Chip tone="info" size="sm" icon="key">
                    {t('ops.support.grantActive')}
                  </Chip>
                ) : (
                  <span className="tiq-text-muted">{t('ops.support.noGrant')}</span>
                ),
            },
            {
              id: 'createdAt',
              header: t('ops.support.col.opened'),
              sortable: true,
              cell: (row) => formatDateTime(row.createdAt, timeZone),
            },
            {
              id: 'updatedAt',
              header: t('ops.support.col.updated'),
              sortable: true,
              cell: (row) => formatDateTime(row.updatedAt, timeZone),
            },
          ]}
        />
      </Card>

      {logging && (
        <LogCaseDialog
          onClose={() => setLogging(false)}
          onCreated={(created) => {
            setLogging(false);
            toast.show(t('ops.support.log.done', { reference: created.reference }), 'success');
            navigate(opsPaths.supportCase(created.id));
          }}
        />
      )}
    </div>
  );
}
