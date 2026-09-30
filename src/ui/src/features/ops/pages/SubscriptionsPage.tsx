/**
 * OPS-03 Plans, entitlements and commercial accounts. Required information: buyer plans, optional services,
 * subscription dates, agreed limits, invoices and disputes. Principal action: manage service entitlements (on the
 * subscription page) without changing competition results or supplier eligibility. Suppliers never pay to take part.
 */

import { PLAN_CODES, operationsEndpoints } from '@contracts/operations';
import type { PlanCode, PlanDefinition, SubscriptionRow } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { SubscriptionsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Card,
  Checkbox,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  MoneyText,
  PageHeader,
  QueryView,
  RestrictedState,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { opsOptions } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { PLANS_READ } from '../lib/permissions';
import { OpsChip } from '../components/OpsChip';

const DEFAULTS = {
  q: '',
  status: '',
  plan: '',
  from: '',
  to: '',
  actions: false,
  page: 1,
  sort: 'customer',
  dir: 'asc',
};

type SortField = 'customer' | 'planCode' | 'status' | 'startsAt' | 'renewsAt';

function PlanCard({ plan }: { readonly plan: PlanDefinition }) {
  return (
    <Card
      title={plan.name}
      subtitle={plan.description}
      actions={<OpsChip kind="plan" value={plan.code} size="sm" />}
      footer={
        <span className="tiq-text-muted">
          {t('ops.plans.customers', { count: plan.customers })}
        </span>
      }
    >
      <p>
        <MoneyText value={plan.annualFee} />{' '}
        <span className="tiq-text-muted">{t('ops.plans.perYear')}</span>
      </p>
      <ul className="tiq-stack">
        {plan.entitlements.map((entitlement) => (
          <li key={entitlement.featureCode}>
            {entitlement.label}:{' '}
            <strong>
              {entitlement.limitValue === null
                ? t('ops.plans.included')
                : `${entitlement.limitValue} ${entitlement.unit}`}
            </strong>
          </li>
        ))}
      </ul>
      {plan.optionalServices.length > 0 && (
        <p className="tiq-cell-sub">
          {t('ops.plans.optional')}: {plan.optionalServices.join(', ')}
        </p>
      )}
    </Card>
  );
}

export default function SubscriptionsPage() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canSeePlans = usePermission(PLANS_READ);
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-03', DEFAULTS);
  const catalog = useApiQuery(operationsEndpoints.getPlanCatalog, canSeePlans ? {} : null);
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.status === '' ? {} : { status: [filters.status as SubscriptionsStatus] }),
    ...(filters.plan === '' ? {} : { planCode: [filters.plan as PlanCode] }),
    ...(filters.from === '' ? {} : { renewsFrom: filters.from }),
    ...(filters.to === '' ? {} : { renewsTo: filters.to }),
    ...(filters.actions ? { hasOpenServiceActions: true } : {}),
  };
  const subscriptions = useApiQuery(operationsEndpoints.listSubscriptions, { query });
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.plan !== '' ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.actions;

  return (
    <div className="tiq-page">
      <PageHeader title={t('ops.plans.title')} subtitle={t('ops.plans.subtitle')} />
      {canSeePlans ? (
        <QueryView query={catalog}>
          {(data) => (
            <>
              <Banner tone="info" title={t('ops.plans.supplierTitle')}>
                <p>{data.supplierAccessNote}</p>
              </Banner>
              <div className="tiq-grid tiq-grid--3">
                {data.plans.map((plan) => (
                  <PlanCard key={plan.code} plan={plan} />
                ))}
              </div>
            </>
          )}
        </QueryView>
      ) : (
        <RestrictedState compact />
      )}

      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('ops.plans.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('ops.plans.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('subscriptions.status')}
        />
        <Select
          label={t('ops.plans.col.plan')}
          placeholder={t('ops.common.all')}
          value={filters.plan}
          onChange={(value) => update({ plan: value })}
          options={opsOptions('plan', PLAN_CODES)}
        />
        <DateInput
          label={t('ops.plans.filter.renewFrom')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('ops.plans.filter.renewTo')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
        <Checkbox
          label={t('ops.plans.filter.actions')}
          checked={filters.actions}
          onChange={(checked) => update({ actions: checked })}
        />
      </FilterBar>

      <Card flush title={t('ops.plans.register')}>
        <DataTable<SubscriptionRow>
          caption={t('ops.plans.register')}
          rows={subscriptions.data?.items}
          rowKey={(row) => String(row.id)}
          loading={subscriptions.isFetching}
          error={subscriptions.error}
          onRetry={subscriptions.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          rowHref={(row) => opsPaths.subscription(row.id)}
          rowLabel={(row) => t('ops.plans.rowLabel', { name: row.customer.name })}
          empty={
            <EmptyState
              compact
              icon="receipt"
              title={t('ops.plans.empty')}
              description={t('ops.plans.emptyHint')}
            />
          }
          pagination={
            subscriptions.data === undefined
              ? undefined
              : {
                  page: subscriptions.data.page,
                  pageSize: subscriptions.data.pageSize,
                  total: subscriptions.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'customer',
              header: t('ops.plans.col.customer'),
              sortable: true,
              cell: (row) => <strong>{row.customer.name}</strong>,
            },
            {
              id: 'planCode',
              header: t('ops.plans.col.plan'),
              sortable: true,
              cell: (row) => <OpsChip kind="plan" value={row.planCode} size="sm" />,
            },
            {
              id: 'status',
              header: t('ops.plans.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="subscriptions.status" value={row.status} />,
            },
            {
              id: 'startsAt',
              header: t('ops.plans.col.starts'),
              sortable: true,
              cell: (row) => formatInstantDate(row.startsAt, timeZone),
            },
            {
              id: 'renewsAt',
              header: t('ops.plans.col.renews'),
              sortable: true,
              cell: (row) => formatInstantDate(row.renewsAt, timeZone),
            },
            {
              id: 'contact',
              header: t('ops.plans.col.contact'),
              cell: (row) => row.commercialContact ?? t('ops.common.none'),
            },
            {
              id: 'attention',
              header: t('ops.plans.col.attention'),
              cell: (row) => (
                <div className="tiq-stack">
                  <span
                    className={row.openServiceActions > 0 ? 'tiq-text-warning' : 'tiq-text-muted'}
                  >
                    {t('ops.plans.openActions', { count: row.openServiceActions })}
                  </span>
                  <span className={row.disputedInvoices > 0 ? 'tiq-text-danger' : 'tiq-text-muted'}>
                    {t('ops.plans.disputes', { count: row.disputedInvoices })}
                  </span>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
