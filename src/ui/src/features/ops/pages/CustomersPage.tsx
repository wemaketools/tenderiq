/**
 * OPS-01 Customer organization register. Required information: customer identity, service owner, onboarding stage,
 * plan, account status and designated administrators. Principal actions: establish a customer relationship (buyers)
 * and manage it from the customer page. The operator never gains automatic visibility of customer tender content.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { PLAN_CODES, operationsEndpoints } from '@contracts/operations';
import type { CustomerRow, PlanCode } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { TenantsOnboardingStage, TenantsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
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
  useToast,
} from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { CreateCustomerDialog } from '../components/CreateCustomerDialog';
import { opsOptions } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { CUSTOMERS_MANAGE } from '../lib/permissions';
import { useOperatorStaffOptions } from '../lib/staff';
import { OpsChip } from '../components/OpsChip';

const DEFAULTS = {
  q: '',
  kind: '',
  status: '',
  stage: '',
  plan: '',
  owner: '',
  from: '',
  to: '',
  page: 1,
  sort: 'name',
  dir: 'asc',
};

type SortField = 'name' | 'kind' | 'status' | 'onboardingStage' | 'createdAt';

const IN_ONBOARDING: readonly TenantsOnboardingStage[] = ['setup', 'configuring', 'pilot'];

export default function CustomersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CUSTOMERS_MANAGE);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-01', DEFAULTS);
  const staff = useOperatorStaffOptions();

  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.kind === '' ? {} : { kind: [filters.kind as 'buyer' | 'supplier'] }),
    ...(filters.status === '' ? {} : { status: [filters.status as TenantsStatus] }),
    ...(filters.stage === '' ? {} : { onboardingStage: [filters.stage as TenantsOnboardingStage] }),
    ...(filters.plan === '' ? {} : { planCode: [filters.plan as PlanCode] }),
    ...(filters.owner === '' ? {} : { serviceOwnerUserId: Number(filters.owner) }),
    ...(filters.from === '' ? {} : { createdFrom: filters.from }),
    ...(filters.to === '' ? {} : { createdTo: filters.to }),
  };
  const customers = useApiQuery(operationsEndpoints.listCustomers, { query });
  const all = useApiQuery(operationsEndpoints.listCustomers, { query: { pageSize: 100 } });
  const everyone = all.data?.items;
  const count = (predicate: (row: CustomerRow) => boolean): string | null =>
    everyone === undefined ? null : formatCount(everyone.filter(predicate).length);

  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.kind !== '' ||
    filters.status !== '' ||
    filters.stage !== '' ||
    filters.plan !== '' ||
    filters.owner !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('ops.customers.title')}
        subtitle={t('ops.customers.subtitle')}
        primaryAction={
          canManage ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t('ops.customers.create.open')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('ops.customers.noContentTitle')}>
        <p>{t('ops.customers.noContent')}</p>
      </Banner>

      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('ops.customers.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('ops.customers.filter.kind')}
          placeholder={t('ops.common.all')}
          value={filters.kind}
          onChange={(value) => update({ kind: value })}
          options={[
            { value: 'buyer', label: t('ops.customers.kind.buyer') },
            { value: 'supplier', label: t('ops.customers.kind.supplier') },
          ]}
        />
        <Select
          label={t('ops.customers.filter.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('tenants.status')}
        />
        <Select
          label={t('ops.customers.filter.stage')}
          placeholder={t('ops.common.all')}
          value={filters.stage}
          onChange={(value) => update({ stage: value })}
          options={enumOptions('tenants.onboarding_stage')}
        />
        <Select
          label={t('ops.customers.filter.plan')}
          placeholder={t('ops.common.all')}
          value={filters.plan}
          onChange={(value) => update({ plan: value })}
          options={opsOptions('plan', PLAN_CODES)}
        />
        <Select
          label={t('ops.customers.filter.owner')}
          placeholder={t('ops.common.all')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          options={staff}
        />
        <DateInput
          label={t('ops.customers.filter.from')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('ops.customers.filter.to')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('ops.customers.kpi.buyers')}
          icon="building"
          value={count((row) => row.kind === 'buyer')}
          hint={t('ops.customers.kpi.buyersHint')}
        />
        <KpiCard
          label={t('ops.customers.kpi.suppliers')}
          icon="briefcase"
          tone="info"
          value={count((row) => row.kind === 'supplier')}
          hint={t('ops.customers.kpi.suppliersHint')}
        />
        <KpiCard
          label={t('ops.customers.kpi.onboarding')}
          icon="listChecks"
          tone="warning"
          value={count(
            (row) => row.onboardingStage !== null && IN_ONBOARDING.includes(row.onboardingStage),
          )}
          hint={t('ops.customers.kpi.onboardingHint')}
        />
        <KpiCard
          label={t('ops.customers.kpi.offboarding')}
          icon="logOut"
          tone="danger"
          value={count(
            (row) => row.status === 'offboarding' || row.onboardingStage === 'offboarding',
          )}
          hint={t('ops.customers.kpi.offboardingHint')}
          to={opsPaths.offboarding}
        />
      </KpiGrid>

      <Card flush title={t('ops.customers.register')}>
        <DataTable<CustomerRow>
          caption={t('ops.customers.register')}
          rows={customers.data?.items}
          rowKey={(row) => String(row.tenantId)}
          loading={customers.isFetching}
          error={customers.error}
          onRetry={customers.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          rowHref={(row) => opsPaths.customer(row.tenantId)}
          rowLabel={(row) => t('ops.customers.rowLabel', { name: row.name })}
          empty={
            <EmptyState
              compact
              icon="building"
              title={t('ops.customers.empty')}
              description={t('ops.customers.emptyHint')}
            />
          }
          pagination={
            customers.data === undefined
              ? undefined
              : {
                  page: customers.data.page,
                  pageSize: customers.data.pageSize,
                  total: customers.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'name',
              header: t('ops.customers.col.customer'),
              sortable: true,
              cell: (row) => (
                <>
                  <strong>{row.name}</strong>
                  {row.legalName !== row.name && (
                    <span className="tiq-cell-sub">{row.legalName}</span>
                  )}
                  <span className="tiq-cell-sub">{row.slug}</span>
                </>
              ),
            },
            {
              id: 'kind',
              header: t('ops.customers.col.kind'),
              sortable: true,
              cell: (row) => t(`ops.customers.kind.${row.kind}`),
            },
            {
              id: 'serviceOwner',
              header: t('ops.customers.col.serviceOwner'),
              cell: (row) =>
                row.serviceOwner === null ? (
                  <span className="tiq-text-muted">{t('ops.common.unassigned')}</span>
                ) : (
                  row.serviceOwner.fullName
                ),
            },
            {
              id: 'onboardingStage',
              header: t('ops.customers.col.stage'),
              sortable: true,
              cell: (row) =>
                row.onboardingStage === null ? (
                  <span className="tiq-text-muted">{t('ops.customers.freeParticipation')}</span>
                ) : (
                  <StatusChip
                    enum="tenants.onboarding_stage"
                    value={row.onboardingStage}
                    size="sm"
                  />
                ),
            },
            {
              id: 'plan',
              header: t('ops.customers.col.plan'),
              cell: (row) =>
                row.planCode === null ? (
                  <span className="tiq-text-muted">{t('ops.customers.noPlan')}</span>
                ) : (
                  <div className="tiq-stack tiq-stack--start">
                    <span>
                      <OpsChip kind="plan" value={row.planCode} size="sm" />
                    </span>
                    {row.subscriptionStatus !== null && (
                      <StatusChip
                        enum="subscriptions.status"
                        value={row.subscriptionStatus}
                        size="sm"
                      />
                    )}
                  </div>
                ),
            },
            {
              id: 'status',
              header: t('ops.customers.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="tenants.status" value={row.status} />,
            },
            {
              id: 'administrators',
              header: t('ops.customers.col.administrators'),
              cell: (row) =>
                row.administrators.length === 0 ? (
                  <span className="tiq-text-warning">{t('ops.customers.noAdministrator')}</span>
                ) : (
                  row.administrators.map((admin) => admin.fullName).join(', ')
                ),
            },
            {
              id: 'support',
              header: t('ops.customers.col.support'),
              cell: (row) => (
                <span className="tiq-cell-sub">
                  {t('ops.customers.supportSummary', {
                    cases: t('ops.customers.supportCases', { count: row.openSupportCases }),
                    grants: t('ops.customers.supportGrants', { count: row.activeSupportGrants }),
                  })}
                </span>
              ),
            },
            {
              id: 'createdAt',
              header: t('ops.customers.col.created'),
              sortable: true,
              cell: (row) => formatInstantDate(row.createdAt, timeZone),
            },
          ]}
        />
      </Card>

      {creating && (
        <CreateCustomerDialog
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            toast.show(t('ops.customers.create.done', { name: created.name }), 'success');
            navigate(opsPaths.customer(created.tenantId));
          }}
        />
      )}
    </div>
  );
}
