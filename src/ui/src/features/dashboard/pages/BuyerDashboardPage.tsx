/**
 * BUY-01 — Procurement overview (FR-21, PRD §12.1; docs/plan/design1 §3 "Overview"). Reading order: today's date
 * and how many items need the user, then "Up next" (approvals and deadlines merged, soonest first), the tenders at a
 * glance (pipeline by stage and each tender's nearest deadline) beside this week's calendar, the pipeline value and
 * the renewals to plan. The exceptions, workload, approvals, renewals and the KPI figures follow as secondary
 * sections, so nothing that was reachable before is lost. Every panel, KPI or figure the caller may not read is left
 * out entirely, never shown as a zero, a count or a placeholder (BR-43, DD-49); no trend is drawn, because no
 * historical series exists. Filters and saved views are kept, behind a disclosure.
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
import { StackedBarChart } from '../../../components/charts';
import {
  Banner,
  Card,
  CardLink,
  Chip,
  Columns,
  DataTable,
  DateBadge,
  DateInput,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterDisclosure,
  FooterBar,
  Icon,
  IconTile,
  KpiCard,
  KpiGrid,
  MoneyText,
  NumberInput,
  OfficialDeadline,
  OverdueChip,
  PageHeader,
  QuickRanges,
  Reference,
  Rule,
  Section,
  Select,
  SkeletonBlock,
  StageGlance,
  Stat,
  Toolbar,
  formErrors,
} from '../../../components/ui';
import { WorkList, WorkRow } from '../../../components/ui/WorkRow';
import type { DataTableColumn, IconName } from '../../../components/ui';
import { clockDate } from '../../../lib/clock';
import {
  formatCalendarDate,
  formatCount,
  formatInstantDate,
  formatMoney,
  instantDateParts,
} from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { QUICK_RANGES, compact, idOf, oneOf, quickRangeDates } from '../../reports/lib/shared';
import { SavedViewsMenu } from '../../search/components/SavedViews';
import { AttentionList } from '../components/AttentionList';
import { GlanceTable } from '../components/GlanceTable';
import { PanelGrid } from '../components/PanelGrid';
import { UpNextList } from '../components/UpNextList';
import { WeekStrip } from '../components/WeekStrip';
import { kpiDelta } from '../lib/kpi';
import {
  UP_NEXT_LIMIT,
  buildUpNext,
  decisionsNeeded,
  everythingMoving,
  tendersAtAGlance,
  upcomingDeadlines,
  weekDays,
} from '../lib/upNext';

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

/** Rows of the week column and of the glance table. */
const WEEK_LIMIT = 5;
const GLANCE_LIMIT = 5;

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
  const now = useNow();
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
  const activeFilters = (Object.keys(DEFAULTS) as (keyof Filters)[]).filter(
    (key) => key !== 'range' && filters[key] !== '',
  ).length;
  const filtered = activeFilters > 0 || filters.range !== '';
  const current: JsonObject = compact({ ...filters }) as JsonObject;
  const timeZone = data?.timeZone ?? tenant?.officialTimeZone ?? 'UTC';
  const today = instantDateParts(new Date(now), timeZone);

  const lede =
    data === undefined ? undefined : (
      <>
        <strong>
          {decisionsNeeded(data) === 0
            ? t('dashboard.buyer.noDecisions')
            : t('dashboard.buyer.decisions', { count: decisionsNeeded(data) })}
        </strong>{' '}
        {everythingMoving(data) ? t('dashboard.buyer.moving') : t('dashboard.buyer.busy')}
      </>
    );

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('dashboard.buyer.title')}
        headline={t('dashboard.buyer.headline')}
        eyebrow={
          <>
            <Icon name="sun" />
            {t('dashboard.buyer.eyebrow', {
              title: t('dashboard.buyer.title'),
              weekday: t(`format.weekday.${today.weekday}`),
              date: formatInstantDate(new Date(now), timeZone),
            })}
          </>
        }
        subtitle={lede}
        actions={
          <SavedViewsMenu
            scope="BUY-01"
            current={current}
            onApply={(view) => setFilters(filtersOfView(view))}
          />
        }
      />

      <FilterDisclosure
        activeCount={activeFilters}
        render={(toggle, panel) => (
          <>
            <Toolbar
              label={t('dashboard.filters.label')}
              end={
                <>
                  {filtered && (
                    <button type="button" className="tiq-btn tiq-btn--ghost" onClick={clearFilters}>
                      {t('ui.filters.clear')}
                    </button>
                  )}
                  {toggle}
                </>
              }
            >
              <QuickRanges
                label={t('dashboard.filters.quickRanges')}
                options={QUICK_RANGES.map((id) => ({ id, label: t(`dashboard.ranges.${id}`) }))}
                selected={filters.range === '' ? null : filters.range}
                onSelect={(id) => {
                  const range = oneOf(id, QUICK_RANGES);
                  if (range === undefined) return;
                  setFilters({ range, ...quickRangeDates(range, clockDate()) });
                }}
              />
            </Toolbar>
            {panel}
          </>
        )}
      >
        <FilterBar
          variant="panel"
          label={t('dashboard.filters.label')}
          onClear={clearFilters}
          canClear={filtered}
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
      </FilterDisclosure>

      {query.error !== null && (
        <ErrorState error={query.error} onRetry={query.reload} title={t('dashboard.loadError')} />
      )}
      {data === undefined ? (
        query.error === null && <SkeletonBlock lines={8} />
      ) : (
        <DashboardBody data={data} now={now} />
      )}

      <FooterBar
        currency={data?.currency ?? null}
        asOf={data?.asOf ?? null}
        timeZone={timeZone}
        refreshing={query.isFetching}
        onRefresh={query.reload}
      />
    </div>
  );
}

function DashboardBody({ data, now }: { readonly data: BuyerDashboard; readonly now: number }) {
  const kpis = BUYER_DASHBOARD_KPIS.map((key) => data.kpis.find((kpi) => kpi.key === key))
    .filter((kpi) => kpi !== undefined)
    .filter((kpi) => !kpi.restricted);
  const upNext = buildUpNext(data, now);
  const deadlines = data.deadlines.restricted ? [] : data.deadlines.items;
  const week = upcomingDeadlines(deadlines, now).slice(0, WEEK_LIMIT);
  const glance = tendersAtAGlance(deadlines, now).slice(0, GLANCE_LIMIT);
  const showGlance = !data.pipelineByStage.restricted || !data.deadlines.restricted;

  return (
    <>
      {!data.completeness.complete && (
        <Banner tone="warning" title={t('dashboard.incompleteTitle')}>
          <p>{data.completeness.note ?? t('dashboard.incompleteNote')}</p>
        </Banner>
      )}

      <Columns
        main={
          <>
            <Section
              title={t('dashboard.upNext.title')}
              count={t('dashboard.upNext.items', { count: upNext.length })}
              link={
                data.approvals.restricted
                  ? undefined
                  : { to: '/me/approvals', label: t('dashboard.upNext.viewAll') }
              }
            >
              {upNext.length === 0 ? (
                <EmptyState compact icon="checkCircle" title={t('dashboard.upNext.empty')} />
              ) : (
                <UpNextList
                  items={upNext.slice(0, UP_NEXT_LIMIT)}
                  now={now}
                  timeZone={data.timeZone}
                />
              )}
            </Section>

            {showGlance && (
              <Section
                title={t('dashboard.glance.title')}
                link={{ to: '/buyer/tenders', label: t('dashboard.glance.viewAll') }}
                className="tiq-dashboard-glance"
              >
                {!data.pipelineByStage.restricted && (
                  <StageGlance
                    label={t('dashboard.pipeline.title')}
                    items={data.pipelineByStage.items.map((item) => ({
                      id: item.stage,
                      label: tEnum('tenders.status', item.stage),
                      count: item.count,
                      to: item.to,
                    }))}
                  />
                )}
                {!data.deadlines.restricted &&
                  (glance.length === 0 ? (
                    <EmptyState compact icon="calendar" title={t('dashboard.glance.empty')} />
                  ) : (
                    <GlanceTable rows={glance} />
                  ))}
              </Section>
            )}
          </>
        }
        side={
          <>
            {!data.deadlines.restricted && (
              <Section title={t('dashboard.week.title')} headingLevel={2}>
                <WeekStrip days={weekDays(now, data.timeZone, deadlines)} />
                {week.length === 0 ? (
                  <EmptyState compact icon="calendar" title={t('dashboard.week.empty')} />
                ) : (
                  <WorkList label={t('dashboard.deadlines.title')}>
                    {week.map((item) => (
                      <WorkRow
                        key={`${item.tenderId}-${item.milestone}-${item.lotLabel ?? 'event'}`}
                        compact
                        lead={<DateBadge at={item.deadline.at} timeZone={item.deadline.timeZone} />}
                        title={
                          item.lotLabel === null
                            ? tEnum('tender_milestones.milestone', item.milestone)
                            : t('dashboard.deadlines.milestoneLot', {
                                milestone: tEnum('tender_milestones.milestone', item.milestone),
                                lot: item.lotLabel,
                              })
                        }
                        to={item.to}
                        openLabel={t('dashboard.upNext.open', {
                          title: `${item.reference} ${item.title}`,
                        })}
                        meta={[item.title]}
                        note={<OfficialDeadline deadline={item.deadline} showLocal={false} />}
                      />
                    ))}
                  </WorkList>
                )}
              </Section>
            )}

            {data.pipelineValue !== null && (
              <>
                <Rule />
                <Stat
                  value={formatMoney(data.pipelineValue, { compact: true })}
                  caption={t('dashboard.pipelineValue.caption')}
                />
              </>
            )}

            {!data.renewals.restricted && (
              <>
                <Rule />
                <WorkList label={t('dashboard.ahead.title')}>
                  <WorkRow
                    compact
                    lead={<IconTile icon="calendar" tone="info" size="sm" />}
                    title={t('dashboard.ahead.title')}
                    to="/buyer/contracts"
                    openLabel={t('dashboard.renewals.viewAll')}
                    meta={[
                      data.renewals.items.length === 0
                        ? t('dashboard.ahead.none')
                        : t('dashboard.ahead.renewals', {
                            count: data.renewals.items.filter((item) => !item.decided).length,
                          }),
                    ]}
                  />
                </WorkList>
              </>
            )}
          </>
        }
      />

      <Rule />

      <Section title={t('dashboard.buyer.more')} headingLevel={2}>
        <div className="tiq-stack tiq-stack--spaced">
          <PanelGrid variant="sidebar">
            {!data.approvals.restricted && (
              <ApprovalsCard approvals={data.approvals.items} timeZone={data.timeZone} />
            )}
            <Card
              title={t('dashboard.attention.title')}
              subtitle={t('dashboard.attention.subtitle')}
            >
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
          </PanelGrid>

          {!data.workload.restricted && (
            <Card title={t('dashboard.workload.title')} subtitle={t('dashboard.workload.subtitle')}>
              {data.workload.items.length === 0 ? (
                <EmptyState compact icon="users" title={t('dashboard.workload.empty')} />
              ) : (
                <StackedBarChart
                  horizontal
                  height={Math.max(180, data.workload.items.length * 48)}
                  label={t('dashboard.workload.title')}
                  categoryLabel={t('dashboard.workload.owner')}
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
          )}

          {!data.renewals.restricted && <RenewalsCard renewals={data.renewals.items} />}

          {kpis.length > 0 && (
            <KpiGrid>
              {kpis.map((kpi) => (
                <KpiCard
                  key={kpi.key}
                  label={t(`dashboard.kpi.${kpi.key}`)}
                  value={kpi.value === null ? null : formatCount(kpi.value)}
                  icon={KPI_ICON[kpi.key]}
                  tone={KPI_TONE[kpi.key]}
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
            </KpiGrid>
          )}
        </div>
      </Section>
    </>
  );
}

function ApprovalsCard({
  approvals,
  timeZone,
}: {
  readonly approvals: readonly DashboardApproval[];
  readonly timeZone: string;
}) {
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
          <span className="tiq-cell-sub">{formatInstantDate(row.requestedAt, timeZone)}</span>
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
            : formatInstantDate(row.dueAt, timeZone)}
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
        rows={approvals}
        rowKey={(row) => String(row.approvalId)}
        empty={<EmptyState compact icon="checkSquare" title={t('dashboard.approvals.empty')} />}
      />
    </Card>
  );
}

function RenewalsCard({ renewals }: { readonly renewals: readonly DashboardRenewal[] }) {
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
        rows={renewals}
        rowKey={(row) => `${row.contractId}-${row.optionType}-${row.decisionDueOn}`}
        empty={<EmptyState compact icon="repeat" title={t('dashboard.renewals.empty')} />}
      />
    </Card>
  );
}
