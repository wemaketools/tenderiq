/**
 * BUY-01 — Procurement dashboard (FR-21, PRD §12.1, modelled on `overview.png`). Pipeline, active events,
 * deadlines, workload, approvals, exceptions and upcoming renewals of the active buyer, filtered by authorized legal
 * entity, department, owner, category, value and stage. Every card links to the underlying records. A panel the
 * caller may not read shows the restricted state, never a zero or a count (BR-43).
 */
import { Link } from 'react-router';

import type { JsonObject } from '@contracts/common';
import { BUYER_DASHBOARD_KPIS, reportingEndpoints } from '@contracts/reporting';
import type {
  BuyerDashboard,
  BuyerDashboardKpiKey,
  DashboardApproval,
  DashboardRenewal,
  SavedView,
} from '@contracts/reporting';
import { TENDERS_STATUS } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { BarList, StackedBarChart } from '../../../components/charts';
import {
  Banner,
  ButtonLink,
  Card,
  CardLink,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  FilterBar,
  FooterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  NumberInput,
  OverdueChip,
  PageHeader,
  QuickRanges,
  RestrictedState,
  Select,
  SkeletonBlock,
  Reference,
  formErrors,
} from '../../../components/ui';
import type { DataTableColumn, IconName } from '../../../components/ui';
import {
  formatCalendarDate,
  formatCount,
  formatInstantDate,
  formatMoney,
} from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  QUICK_RANGES,
  REPORT_READ,
  compact,
  idOf,
  oneOf,
  quickRangeDates,
} from '../../reports/lib/shared';
import { SavedViewsMenu } from '../../search/components/SavedViews';
import { AttentionList } from '../components/AttentionList';
import { DeadlineList } from '../components/DeadlineList';
import { kpiDelta } from '../lib/kpi';

const DEFAULTS = {
  range: '',
  from: '',
  to: '',
  legalEntityId: '',
  departmentId: '',
  categoryId: '',
  ownerUserId: '',
  stage: '',
  minValue: '',
  maxValue: '',
};

type Filters = typeof DEFAULTS;

const KPI_ICON: Readonly<Record<BuyerDashboardKpiKey, IconName>> = {
  active_events: 'activity',
  pending_approvals: 'checkSquare',
  closing_within_7_days: 'clock',
  open_complaints: 'alertTriangle',
  renewals_within_90_days: 'repeat',
  overdue_obligations: 'alertCircle',
};

const KPI_TONE: Readonly<Record<BuyerDashboardKpiKey, 'accent' | 'warning' | 'danger'>> = {
  active_events: 'accent',
  pending_approvals: 'accent',
  closing_within_7_days: 'warning',
  open_complaints: 'danger',
  renewals_within_90_days: 'accent',
  overdue_obligations: 'danger',
};

function filtersOfView(view: SavedView): Partial<Filters> {
  const next: Partial<Filters> = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof Filters)[]) {
    const value = view.filters[key];
    if (typeof value === 'string' || typeof value === 'number') next[key] = String(value);
    if (key === 'stage' && Array.isArray(value) && typeof value[0] === 'string') {
      next.stage = value[0];
    }
  }
  return next;
}

export default function BuyerDashboardPage() {
  const tenant = useActiveTenant();
  const canReport = usePermission(REPORT_READ);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-01', DEFAULTS);

  const stage = oneOf(filters.stage, TENDERS_STATUS);
  const query = useApiQuery(reportingEndpoints.getBuyerDashboard, {
    query: compact({
      from: filters.from,
      to: filters.to,
      legalEntityId: idOf(filters.legalEntityId),
      departmentId: idOf(filters.departmentId),
      categoryId: idOf(filters.categoryId),
      ownerUserId: idOf(filters.ownerUserId),
      stage: stage === undefined ? undefined : [stage],
      minValue: filters.minValue,
      maxValue: filters.maxValue,
    }),
  });
  const errors = formErrors(query.error, ['from', 'to', 'minValue', 'maxValue']);
  const data = query.data;
  const filtered = (Object.keys(DEFAULTS) as (keyof Filters)[]).some((key) => filters[key] !== '');
  const current: JsonObject = compact({ ...filters }) as JsonObject;

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('dashboard.buyer.title')}
        subtitle={t('dashboard.buyer.intro', { organization: tenant?.name ?? '' })}
        primaryAction={
          canReport ? (
            <ButtonLink to="/buyer/reports" variant="primary" icon="barChart">
              {t('dashboard.buyer.openReports')}
            </ButtonLink>
          ) : undefined
        }
        actions={
          <SavedViewsMenu
            scope="BUY-01"
            current={current}
            onApply={(view) => setFilters(filtersOfView(view))}
          />
        }
      />

      <FilterBar
        label={t('dashboard.filters.label')}
        onClear={clearFilters}
        canClear={filtered}
        quickRanges={
          <QuickRanges
            label={t('dashboard.filters.quickRanges')}
            options={QUICK_RANGES.map((id) => ({ id, label: t(`dashboard.ranges.${id}`) }))}
            selected={filters.range === '' ? null : filters.range}
            onSelect={(id) => {
              const range = oneOf(id, QUICK_RANGES);
              if (range === undefined) return;
              setFilters({ range, ...quickRangeDates(range, new Date()) });
            }}
          />
        }
      >
        <DateInput
          label={t('dashboard.filters.from')}
          value={filters.from}
          onChange={(from) => setFilters({ from, range: '' })}
          error={errors.forField('from')}
        />
        <DateInput
          label={t('dashboard.filters.to')}
          value={filters.to}
          onChange={(to) => setFilters({ to, range: '' })}
          error={errors.forField('to')}
        />
        <Select
          label={t('dashboard.filters.entity')}
          value={filters.legalEntityId}
          placeholder={t('dashboard.filters.all')}
          options={(data?.filterOptions.legalEntities ?? []).map((item) => ({
            value: String(item.id),
            label: item.label,
          }))}
          onChange={(legalEntityId) => setFilters({ legalEntityId })}
        />
        <Select
          label={t('dashboard.filters.department')}
          value={filters.departmentId}
          placeholder={t('dashboard.filters.all')}
          options={(data?.filterOptions.departments ?? []).map((item) => ({
            value: String(item.id),
            label: item.label,
          }))}
          onChange={(departmentId) => setFilters({ departmentId })}
        />
        <Select
          label={t('dashboard.filters.owner')}
          value={filters.ownerUserId}
          placeholder={t('dashboard.filters.all')}
          options={(data?.filterOptions.owners ?? []).map((item) => ({
            value: String(item.userId),
            label: item.fullName,
          }))}
          onChange={(ownerUserId) => setFilters({ ownerUserId })}
        />
        <Select
          label={t('dashboard.filters.category')}
          value={filters.categoryId}
          placeholder={t('dashboard.filters.all')}
          options={(data?.filterOptions.categories ?? []).map((item) => ({
            value: String(item.id),
            label: item.label,
          }))}
          onChange={(categoryId) => setFilters({ categoryId })}
        />
        <Select
          label={t('dashboard.filters.stage')}
          value={filters.stage}
          placeholder={t('dashboard.filters.all')}
          options={(data?.filterOptions.stages ?? []).map((value) => ({
            value,
            label: tEnum('tenders.status', value),
          }))}
          onChange={(value) => setFilters({ stage: value })}
        />
        <NumberInput
          label={t('dashboard.filters.minValue', {
            currency: data?.currency ?? tenant?.defaultCurrency ?? '',
          })}
          value={filters.minValue}
          places={2}
          onChange={(minValue) => setFilters({ minValue })}
          error={errors.forField('minValue')}
        />
        <NumberInput
          label={t('dashboard.filters.maxValue', {
            currency: data?.currency ?? tenant?.defaultCurrency ?? '',
          })}
          value={filters.maxValue}
          places={2}
          onChange={(maxValue) => setFilters({ maxValue })}
          error={errors.forField('maxValue')}
        />
      </FilterBar>

      {query.error !== null && (
        <ErrorState error={query.error} onRetry={query.reload} title={t('dashboard.loadError')} />
      )}
      {data === undefined ? (
        query.error === null && <SkeletonBlock lines={8} />
      ) : (
        <DashboardBody data={data} />
      )}

      <FooterBar
        currency={data?.currency ?? null}
        asOf={data?.asOf ?? null}
        timeZone={data?.timeZone ?? tenant?.officialTimeZone ?? 'UTC'}
        refreshing={query.isFetching}
        onRefresh={query.reload}
      />
    </div>
  );
}

function DashboardBody({ data }: { readonly data: BuyerDashboard }) {
  const kpis = BUYER_DASHBOARD_KPIS.map((key) => data.kpis.find((kpi) => kpi.key === key)).filter(
    (kpi) => kpi !== undefined,
  );
  const stageTotal = data.pipelineByStage.items.reduce((sum, item) => sum + item.count, 0);

  return (
    <>
      {!data.completeness.complete && (
        <Banner tone="warning" title={t('dashboard.incompleteTitle')}>
          <p>{data.completeness.note ?? t('dashboard.incompleteNote')}</p>
        </Banner>
      )}
      <KpiGrid>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={t(`dashboard.kpi.${kpi.key}`)}
            value={kpi.value === null ? null : formatCount(kpi.value)}
            icon={KPI_ICON[kpi.key]}
            tone={KPI_TONE[kpi.key]}
            restricted={kpi.restricted}
            delta={kpiDelta(kpi.delta)}
            hint={
              kpi.delta !== null
                ? t('dashboard.kpi.hintCompared', {
                    hint: kpi.hint ?? '',
                    compared: kpi.delta.comparedTo,
                  })
                : (kpi.hint ?? undefined)
            }
            to={kpi.to ?? undefined}
          />
        ))}
        <KpiCard
          label={t('dashboard.kpi.pipeline_value')}
          value={
            data.pipelineValue === null ? null : formatMoney(data.pipelineValue, { compact: true })
          }
          icon="coins"
          restricted={data.pipelineValue === null}
          hint={t('dashboard.kpi.pipelineHint')}
        />
      </KpiGrid>

      <div className="tiq-grid tiq-grid--3">
        <Card
          title={t('dashboard.pipeline.title')}
          subtitle={t('dashboard.pipeline.subtitle', { count: stageTotal })}
          actions={<CardLink to="/buyer/tenders">{t('dashboard.pipeline.viewAll')}</CardLink>}
        >
          {data.pipelineByStage.restricted ? (
            <RestrictedState compact description={t('dashboard.restricted.pipeline')} />
          ) : (
            <BarList
              label={t('dashboard.pipeline.title')}
              items={data.pipelineByStage.items.map((item) => ({
                id: item.stage,
                label: tEnum('tenders.status', item.stage),
                value: item.count,
                to: item.to,
              }))}
            />
          )}
          {!data.pipelineByStage.restricted && data.pipelineByStage.items.length > 0 && (
            <p className="tiq-text-muted">
              {t('dashboard.pipeline.valueNote', {
                value: data.pipelineValue === null ? '—' : formatMoney(data.pipelineValue),
              })}
            </p>
          )}
        </Card>

        <Card
          title={t('dashboard.deadlines.title')}
          subtitle={t('dashboard.deadlines.subtitle')}
          actions={<CardLink to="/buyer/tenders">{t('dashboard.deadlines.viewAll')}</CardLink>}
        >
          {data.deadlines.restricted ? (
            <RestrictedState compact description={t('dashboard.restricted.deadlines')} />
          ) : (
            <DeadlineList
              label={t('dashboard.deadlines.title')}
              items={data.deadlines.items.slice(0, 5).map((item) => ({
                id: `${item.tenderId}-${item.milestone}-${item.lotLabel ?? 'event'}`,
                reference: item.reference,
                title: item.title,
                milestone: tEnum('tender_milestones.milestone', item.milestone),
                lotLabel: item.lotLabel,
                deadline: item.deadline,
                detail: t('dashboard.deadlines.owner', { name: item.owner.fullName }),
                to: item.to,
              }))}
            />
          )}
        </Card>

        <Card title={t('dashboard.workload.title')} subtitle={t('dashboard.workload.subtitle')}>
          {data.workload.restricted ? (
            <RestrictedState compact description={t('dashboard.restricted.workload')} />
          ) : data.workload.items.length === 0 ? (
            <EmptyState compact icon="users" title={t('dashboard.workload.empty')} />
          ) : (
            <StackedBarChart
              horizontal
              height={Math.max(180, data.workload.items.length * 48)}
              label={t('dashboard.workload.title')}
              series={[
                {
                  key: 'activeEvents',
                  label: t('dashboard.workload.activeEvents'),
                  tone: 'accent',
                },
                { key: 'openTasks', label: t('dashboard.workload.openTasks'), tone: 'info' },
                {
                  key: 'overdueTasks',
                  label: t('dashboard.workload.overdueTasks'),
                  tone: 'danger',
                },
                {
                  key: 'pendingApprovals',
                  label: t('dashboard.workload.pendingApprovals'),
                  tone: 'warning',
                },
              ]}
              points={data.workload.items.map((item) => ({
                x: item.owner.fullName,
                values: {
                  activeEvents: item.activeEvents,
                  openTasks: item.openTasks,
                  overdueTasks: item.overdueTasks,
                  pendingApprovals: item.pendingApprovals,
                },
              }))}
            />
          )}
        </Card>
      </div>

      <div className="tiq-grid tiq-grid--sidebar">
        <ApprovalsCard data={data} />
        <Card title={t('dashboard.attention.title')} subtitle={t('dashboard.attention.subtitle')}>
          <AttentionList
            label={t('dashboard.attention.title')}
            empty={t('dashboard.attention.empty')}
            items={data.attention.map((item) => ({
              id: item.key,
              label: item.label,
              detail: item.detail,
              count: item.count,
              tone: item.tone,
              to: item.to,
            }))}
          />
        </Card>
      </div>

      <RenewalsCard data={data} />
    </>
  );
}

function ApprovalsCard({ data }: { readonly data: BuyerDashboard }) {
  const columns: DataTableColumn<DashboardApproval>[] = [
    {
      id: 'title',
      header: t('dashboard.approvals.col.subject'),
      cell: (row) => (
        <>
          <Link to={row.to}>{row.title}</Link>
          <span className="tiq-cell-sub">
            {tEnum('approval_requests.subject_type', row.subjectType)}
          </span>
        </>
      ),
    },
    {
      id: 'amount',
      header: t('dashboard.approvals.col.amount'),
      numeric: true,
      cell: (row) => <MoneyText value={row.amount} />,
    },
    {
      id: 'requestedBy',
      header: t('dashboard.approvals.col.requestedBy'),
      cell: (row) => (
        <>
          <span>{row.requestedBy.fullName}</span>
          <span className="tiq-cell-sub">{formatInstantDate(row.requestedAt, data.timeZone)}</span>
        </>
      ),
    },
    {
      id: 'due',
      header: t('dashboard.approvals.col.due'),
      cell: (row) => (
        <span className="tiq-inline">
          {row.dueAt === null
            ? t('dashboard.approvals.noDue')
            : formatInstantDate(row.dueAt, data.timeZone)}
          {row.overdue && <OverdueChip />}
        </span>
      ),
    },
  ];
  return (
    <Card
      flush
      title={t('dashboard.approvals.title')}
      subtitle={t('dashboard.approvals.subtitle')}
      actions={<CardLink to="/me/tasks">{t('dashboard.approvals.viewAll')}</CardLink>}
    >
      <DataTable
        caption={t('dashboard.approvals.title')}
        columns={columns}
        rows={data.approvals.restricted ? [] : data.approvals.items}
        rowKey={(row) => String(row.approvalId)}
        restricted={
          data.approvals.restricted ? (
            <RestrictedState compact description={t('dashboard.restricted.approvals')} />
          ) : (
            false
          )
        }
        empty={<EmptyState compact icon="checkSquare" title={t('dashboard.approvals.empty')} />}
      />
    </Card>
  );
}

function RenewalsCard({ data }: { readonly data: BuyerDashboard }) {
  const columns: DataTableColumn<DashboardRenewal>[] = [
    {
      id: 'contract',
      header: t('dashboard.renewals.col.contract'),
      cell: (row) => (
        <>
          <Reference value={row.reference} to={row.to} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'supplier',
      header: t('dashboard.renewals.col.supplier'),
      cell: (row) => row.supplierName,
    },
    {
      id: 'option',
      header: t('dashboard.renewals.col.option'),
      cell: (row) => tEnum('renewal_options.option_type', row.optionType),
    },
    {
      id: 'window',
      header: t('dashboard.renewals.col.window'),
      cell: (row) => formatCalendarDate(row.noticeWindowOpensOn),
    },
    {
      id: 'decision',
      header: t('dashboard.renewals.col.decisionDue'),
      cell: (row) => formatCalendarDate(row.decisionDueOn),
    },
    {
      id: 'state',
      header: t('dashboard.renewals.col.state'),
      cell: (row) =>
        row.decided ? (
          <Chip tone="success" size="sm">
            {t('dashboard.renewals.decided')}
          </Chip>
        ) : (
          <Chip tone="warning" size="sm">
            {t('dashboard.renewals.awaiting')}
          </Chip>
        ),
    },
  ];
  return (
    <Card
      flush
      title={t('dashboard.renewals.title')}
      subtitle={t('dashboard.renewals.subtitle')}
      actions={<CardLink to="/buyer/contracts">{t('dashboard.renewals.viewAll')}</CardLink>}
    >
      <DataTable
        caption={t('dashboard.renewals.title')}
        columns={columns}
        rows={data.renewals.restricted ? [] : data.renewals.items}
        rowKey={(row) => `${row.contractId}-${row.optionType}-${row.decisionDueOn}`}
        restricted={
          data.renewals.restricted ? (
            <RestrictedState compact description={t('dashboard.restricted.renewals')} />
          ) : (
            false
          )
        }
        empty={<EmptyState compact icon="repeat" title={t('dashboard.renewals.empty')} />}
      />
    </Card>
  );
}
