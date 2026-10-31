/**
 * The award register (BUY-26) and its closeout view (BUY-30): tenders at the award, notice or closeout stage with
 * per-lot progress, the latest recommendation, standstill, holds, owner and next required action. Search, filters,
 * sorting and pagination are served by the API.
 *
 * Award mode (docs/plan/design1 §5): a content heading, the stage summary (a filter and, once the whole register is
 * loaded, a count view: never a stepper), a compact toolbar whose advanced filters open in a disclosure, and work
 * rows with an explicit next action and an inline readiness disclosure. Closeout mode keeps its own structure: the
 * KPI row and the filter card above a plain table.
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { AWARD_NEXT_STEPS, AWARD_REGISTER_SORT_FIELDS, listAwards } from '@contracts/awards';
import type { AwardNextStep, AwardRegisterRow } from '@contracts/awards';
import {
  AWARD_RECOMMENDATIONS_STATUS,
  EVENT_CLOSEOUTS_STATUS,
  TENDERS_STATUS,
} from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterDisclosure,
  KpiCard,
  KpiGrid,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Pagination,
  Reference,
  SearchField,
  Section,
  Select,
  SkeletonBlock,
  StageSummary,
  StatusChip,
  Toolbar,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../lib/hooks';
import { nextStepLabel, valueBasisLabel } from '../lib/labels';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { awardPaths } from '../lib/paths';
import {
  AWARD_STAGES,
  AWARD_STAGE_STEPS,
  COMPLETED_STAGE_ICON,
  countByStage,
  stageOf,
} from '../lib/stages';
import { AwardRows } from './AwardRows';
import { NextStepChip } from './NextStepChip';

export type AwardRegisterMode = 'award' | 'closeout';

const DEFAULTS = {
  q: '',
  status: '',
  recommendationStatus: '',
  closeoutStatus: '',
  nextStep: '',
  stage: '',
  holds: false,
  updatedFrom: '',
  updatedTo: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

/** The sort choices of the award rows (field and direction in one control), each with its catalog key. */
const SORTS = [
  { id: 'updatedAt:desc', sort: 'updatedAt', dir: 'desc', key: 'updatedDesc' },
  { id: 'updatedAt:asc', sort: 'updatedAt', dir: 'asc', key: 'updatedAsc' },
  { id: 'reference:asc', sort: 'reference', dir: 'asc', key: 'referenceAsc' },
  { id: 'title:asc', sort: 'title', dir: 'asc', key: 'titleAsc' },
  { id: 'status:asc', sort: 'status', dir: 'asc', key: 'statusAsc' },
  { id: 'standstillEndsAt:asc', sort: 'standstillEndsAt', dir: 'asc', key: 'standstillAsc' },
] as const;

function sortLabel(option: (typeof SORTS)[number]): string {
  return t(`awards.register.sort.${option.key}`);
}

/** The next steps the request filters by: the exact step when chosen, else the stage's group. */
function nextStepFilter(nextStep: string, stage: string): AwardNextStep[] | undefined {
  const exact = oneOf(nextStep, AWARD_NEXT_STEPS);
  if (exact !== undefined) return exact;
  const group = stageOf(stage);
  return group === null ? undefined : [...AWARD_STAGE_STEPS[group]];
}

export function AwardRegister({ mode }: { readonly mode: AwardRegisterMode }) {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const screen = mode === 'award' ? 'BUY-26' : 'BUY-30';
  const [filters, setFilters, clearFilters] = useScreenFilters(screen, DEFAULTS);

  const query = useApiQuery(listAwards, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, TENDERS_STATUS),
      recommendationStatus: oneOf(filters.recommendationStatus, AWARD_RECOMMENDATIONS_STATUS),
      nextStep:
        mode === 'award'
          ? nextStepFilter(filters.nextStep, filters.stage)
          : oneOf(filters.nextStep, AWARD_NEXT_STEPS),
      closeoutStatus:
        mode === 'closeout' ? oneOf(filters.closeoutStatus, EVENT_CLOSEOUTS_STATUS) : undefined,
      view: mode,
      hasActiveHold: filters.holds ? true : undefined,
      updatedFrom: dateOf(filters.updatedFrom),
      updatedTo: dateOf(filters.updatedTo),
      sort: sortOf(filters.sort, AWARD_REGISTER_SORT_FIELDS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listAwards, { query: { view: mode, pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const loaded = overview.data !== undefined;
  /** The capped overview covers the whole register only when its total fits in one page. */
  const wholeRegister = overview.data !== undefined && overview.data.total <= all.length;
  const count = (rows: readonly AwardRegisterRow[]): string =>
    loaded ? formatCount(rows.length) : '…';

  const advanced = [
    filters.status !== '',
    filters.recommendationStatus !== '',
    filters.closeoutStatus !== '',
    filters.nextStep !== '',
    filters.holds,
    filters.updatedFrom !== '',
    filters.updatedTo !== '',
  ].filter(Boolean).length;
  const filtered = filters.q !== '' || filters.stage !== '' || advanced > 0;

  const open = (row: AwardRegisterRow): void => {
    void navigate(
      mode === 'award'
        ? awardPaths.file(row.tender.tenderId)
        : awardPaths.closeout(row.tender.tenderId),
    );
  };

  const stepOptions = AWARD_NEXT_STEPS.map((value) => ({
    value,
    label: nextStepLabel(value),
  }));

  const statusFilter = (
    <Select
      label={t('awards.register.filter.status')}
      placeholder={t('awards.common.allStatuses')}
      value={filters.status}
      options={TENDERS_STATUS.map((value) => ({
        value,
        label: tEnum('tenders.status', value),
      }))}
      onChange={(status) => setFilters({ status, page: 1 })}
    />
  );
  const recommendationFilter = (
    <Select
      label={t('awards.register.filter.recommendation')}
      placeholder={t('awards.common.allStatuses')}
      value={filters.recommendationStatus}
      options={AWARD_RECOMMENDATIONS_STATUS.map((value) => ({
        value,
        label: tEnum('award_recommendations.status', value),
      }))}
      onChange={(recommendationStatus) => setFilters({ recommendationStatus, page: 1 })}
    />
  );
  const closeoutFilter = (
    <Select
      label={t('awards.register.filter.closeout')}
      placeholder={t('awards.register.filter.allCloseout')}
      value={filters.closeoutStatus}
      options={EVENT_CLOSEOUTS_STATUS.map((value) => ({
        value,
        label: tEnum('event_closeouts.status', value),
      }))}
      onChange={(closeoutStatus) => setFilters({ closeoutStatus, page: 1 })}
    />
  );
  const nextStepSelect = (
    <Select
      label={t('awards.register.filter.nextStep')}
      placeholder={t('awards.register.filter.allSteps')}
      value={filters.nextStep}
      options={stepOptions}
      onChange={(nextStep) => setFilters({ nextStep, page: 1 })}
    />
  );
  const dateFilters = (
    <>
      <DateInput
        label={t('awards.common.updatedFrom')}
        value={filters.updatedFrom}
        onChange={(updatedFrom) => setFilters({ updatedFrom, page: 1 })}
      />
      <DateInput
        label={t('awards.common.updatedTo')}
        value={filters.updatedTo}
        onChange={(updatedTo) => setFilters({ updatedTo, page: 1 })}
      />
    </>
  );
  const holdsFilter = (
    <Checkbox
      label={t('awards.register.filter.holds')}
      checked={filters.holds}
      onChange={(holds) => setFilters({ holds, page: 1 })}
    />
  );
  const search = (
    <SearchField
      label={t('awards.common.search')}
      placeholder={t('awards.register.searchPlaceholder')}
      value={filters.q}
      onChange={(q) => setFilters({ q, page: 1 })}
      hideLabel={mode === 'award'}
    />
  );
  const empty = (
    <EmptyState
      compact
      icon="award"
      title={filtered ? t('awards.register.emptyFiltered') : t('awards.register.empty')}
      description={filtered ? undefined : t('awards.register.emptyHint')}
    />
  );
  const pagination =
    query.data === undefined
      ? undefined
      : {
          page: query.data.page,
          pageSize: query.data.pageSize,
          total: query.data.total,
          onPageChange: (page: number) => setFilters({ page }),
          onPageSizeChange: (pageSize: number) => setFilters({ pageSize, page: 1 }),
        };

  if (mode === 'award') {
    const counts = wholeRegister ? countByStage(all) : null;
    const toggleStage = (id: string): void => {
      setFilters({ stage: filters.stage === id ? '' : id, nextStep: '', page: 1 });
    };
    const currentSort =
      SORTS.find((option) => option.sort === filters.sort && option.dir === filters.dir)?.id ??
      'updatedAt:desc';

    let body: ReactNode;
    if (query.error !== null && query.data === undefined) {
      body = <ErrorState error={query.error} onRetry={query.reload} />;
    } else if (query.data === undefined) {
      body = <SkeletonBlock lines={6} />;
    } else if (query.data.items.length === 0) {
      body = empty;
    } else {
      body = (
        <>
          {query.error !== null && <ErrorState error={query.error} onRetry={query.reload} />}
          <AwardRows rows={query.data.items} timeZone={timeZone} />
          {pagination !== undefined && (
            <div className="tiq-register-foot">
              <span>{t('awards.register.total', { count: query.data.total })}</span>
              <Pagination {...pagination} />
            </div>
          )}
        </>
      );
    }

    return (
      <div className="tiq-page">
        <PageHeader
          title={t('awards.register.title')}
          headline={t('awards.register.headline')}
          subtitle={t('awards.register.lede')}
        />
        <StageSummary
          label={t('awards.register.stages.label')}
          onToggle={toggleStage}
          items={AWARD_STAGES.map((stage) => ({
            id: stage,
            label: t(`awards.register.stages.${stage}`),
            note: t(`awards.register.stages.${stage}Note`),
            count:
              counts === null
                ? { icon: stage === 'completed' ? COMPLETED_STAGE_ICON : 'moreHorizontal' }
                : stage === 'completed'
                  ? { icon: COMPLETED_STAGE_ICON }
                  : counts[stage],
            selected: filters.stage === stage,
          }))}
        />
        {loaded && !wholeRegister && (
          <p className="tiq-text-muted">{t('awards.register.stages.countsCapped')}</p>
        )}
        <Section
          title={t('awards.register.all')}
          count={query.data === undefined ? undefined : `(${formatCount(query.data.total)})`}
        >
          <FilterDisclosure
            activeCount={advanced}
            render={(toggle, panel) => (
              <>
                <Toolbar label={t('awards.register.toolbar')}>
                  <div className="tiq-toolbar-search">{search}</div>
                  <Select
                    label={t('awards.register.sort.label')}
                    value={currentSort}
                    options={SORTS.map((option) => ({
                      value: option.id,
                      label: sortLabel(option),
                    }))}
                    onChange={(id) => {
                      const option = SORTS.find((item) => item.id === id);
                      if (option !== undefined) {
                        setFilters({ sort: option.sort, dir: option.dir, page: 1 });
                      }
                    }}
                  />
                  {toggle}
                </Toolbar>
                {panel}
              </>
            )}
          >
            <FilterBar
              variant="panel"
              label={t('awards.register.filters')}
              onClear={clearFilters}
              canClear={filtered}
            >
              {statusFilter}
              {recommendationFilter}
              {nextStepSelect}
              {dateFilters}
              {holdsFilter}
            </FilterBar>
          </FilterDisclosure>
          {body}
        </Section>
      </div>
    );
  }

  const columns: DataTableColumn<AwardRegisterRow>[] = [
    {
      id: 'reference',
      header: t('awards.register.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('awards.register.col.statusCases'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="tenders.status" value={row.tender.status} />
          {(row.activeHoldCount > 0 || row.openComplaintCount > 0) && (
            <span className="tiq-cell-sub tiq-inline">
              {row.activeHoldCount > 0 && (
                <Chip tone="danger" size="sm" icon="pause">
                  {t('awards.register.holds', { count: row.activeHoldCount })}
                </Chip>
              )}
              {row.openComplaintCount > 0 && (
                <Chip tone="warning" size="sm" icon="scale">
                  {t('awards.register.complaints', { count: row.openComplaintCount })}
                </Chip>
              )}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'lots',
      header: t('awards.register.col.lots'),
      cell: (row) => (
        <>
          <span>
            {row.lotsWithOutcome === 0 && row.lotsWithProposedOutcome > 0
              ? t('awards.register.lotsProposed', {
                  done: row.lotsWithProposedOutcome,
                  total: row.lotCount,
                })
              : t('awards.register.lotsWithOutcome', {
                  done: row.lotsWithOutcome,
                  total: row.lotCount,
                })}
          </span>
          <span className="tiq-cell-sub">
            {row.lotsWithOutcome > 0 && row.lotsWithProposedOutcome > 0
              ? `${t('awards.register.lotsProposedExtra', { count: row.lotsWithProposedOutcome })} · `
              : ''}
            {t('awards.register.lotsFinal', { count: row.lotsFinalAwarded })}
          </span>
        </>
      ),
    },
    {
      id: 'recommendation',
      header: t('awards.register.col.recommendation'),
      cell: (row) => (
        <>
          {row.latestRecommendation === null ? (
            <span className="tiq-text-muted">{t('awards.register.noRecommendation')}</span>
          ) : (
            <span className="tiq-inline">
              <span>{t('awards.common.version', { no: row.latestRecommendation.version })}</span>
              <StatusChip
                enum="award_recommendations.status"
                value={row.latestRecommendation.status}
                size="sm"
              />
            </span>
          )}
          {row.value !== null && (
            <>
              <span className="tiq-cell-sub">
                <MoneyText value={row.value.total} />
              </span>
              <span className="tiq-cell-sub">{valueBasisLabel(row.value.basis)}</span>
            </>
          )}
        </>
      ),
    },
    {
      id: 'standstillEndsAt',
      header: t('awards.register.col.standstill'),
      sortable: true,
      cell: (row) =>
        row.standstillStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <StatusChip enum="standstill_periods.status" value={row.standstillStatus} size="sm" />
            {row.standstillEndsAt !== null && (
              <span className="tiq-cell-sub">
                <OfficialDeadline deadline={row.standstillEndsAt} showLocal={false} />
              </span>
            )}
          </>
        ),
    },
    {
      id: 'closeout',
      header: t('awards.register.col.closeout'),
      cell: (row) =>
        row.closeoutStatus === null ? (
          <span className="tiq-text-muted">{t('awards.register.closeoutNotStarted')}</span>
        ) : (
          <StatusChip enum="event_closeouts.status" value={row.closeoutStatus} />
        ),
    },
    {
      id: 'nextStep',
      header: t('awards.register.col.nextStep'),
      cell: (row) => <NextStepChip step={row.nextStep} size="sm" />,
    },
    {
      id: 'updatedAt',
      header: t('awards.register.col.ownerUpdated'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.owner.fullName}</span>
          <span className="tiq-cell-sub">{formatInstantDate(row.updatedAt, timeZone)}</span>
        </>
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('awards.closeoutRegister.title')}
        subtitle={t('awards.closeoutRegister.intro')}
      />
      <FilterBar label={t('awards.register.filters')} onClear={clearFilters} canClear={filtered}>
        {search}
        {statusFilter}
        {closeoutFilter}
        {nextStepSelect}
        {dateFilters}
        {holdsFilter}
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('awards.closeoutRegister.kpi.ready')}
          icon="checkCircle"
          tone="success"
          value={count(all.filter((row) => row.nextStep === 'close_event'))}
          hint={t('awards.closeoutRegister.kpi.readyHint')}
        />
        <KpiCard
          label={t('awards.closeoutRegister.kpi.blocked')}
          icon="xCircle"
          tone="danger"
          value={count(all.filter((row) => row.closeoutStatus === 'blocked'))}
          hint={t('awards.closeoutRegister.kpi.blockedHint')}
        />
        <KpiCard
          label={t('awards.closeoutRegister.kpi.closed')}
          icon="archive"
          tone="info"
          value={count(
            all.filter(
              (row) => row.closeoutStatus === 'closed' || row.closeoutStatus === 'archived',
            ),
          )}
          hint={t('awards.closeoutRegister.kpi.closedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('awards.closeoutRegister.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.tender.tenderId)}
          rowLabel={(row) => `${row.tender.reference} ${row.tender.title}`}
          onRowClick={open}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={empty}
          pagination={pagination}
        />
      </Card>
    </div>
  );
}
