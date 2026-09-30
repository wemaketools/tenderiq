/**
 * The award register (BUY-26) and its closeout view (BUY-30): tenders at the award, notice or closeout stage with
 * per-lot progress, the latest recommendation, standstill, holds, owner and next required action. Search, filters,
 * sorting and pagination are served by the API; the KPI row summarizes the whole register.
 */
import { useNavigate } from 'react-router';

import { AWARD_NEXT_STEPS, AWARD_REGISTER_SORT_FIELDS, listAwards } from '@contracts/awards';
import type { AwardRegisterRow } from '@contracts/awards';
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
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../lib/hooks';
import { nextStepLabel, valueBasisLabel } from '../lib/labels';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { awardPaths } from '../lib/paths';
import { NextStepChip } from './NextStepChip';

export type AwardRegisterMode = 'award' | 'closeout';

const DEFAULTS = {
  q: '',
  status: '',
  recommendationStatus: '',
  closeoutStatus: '',
  nextStep: '',
  holds: false,
  updatedFrom: '',
  updatedTo: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export function AwardRegister({ mode }: { readonly mode: AwardRegisterMode }) {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const screen = mode === 'award' ? 'BUY-26' : 'BUY-30';
  const [filters, setFilters, clearFilters] = useScreenFilters(screen, DEFAULTS);
  const stepFilter = oneOf(filters.nextStep, AWARD_NEXT_STEPS);

  const query = useApiQuery(listAwards, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, TENDERS_STATUS),
      recommendationStatus: oneOf(filters.recommendationStatus, AWARD_RECOMMENDATIONS_STATUS),
      nextStep: stepFilter,
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
  const count = (rows: readonly AwardRegisterRow[]): string =>
    loaded ? formatCount(rows.length) : '…';

  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.recommendationStatus !== '' ||
    filters.closeoutStatus !== '' ||
    filters.nextStep !== '' ||
    filters.holds ||
    filters.updatedFrom !== '' ||
    filters.updatedTo !== '';

  const open = (row: AwardRegisterRow): void => {
    void navigate(
      mode === 'award'
        ? awardPaths.file(row.tender.tenderId)
        : awardPaths.closeout(row.tender.tenderId),
    );
  };

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
  ];
  if (mode === 'award') {
    columns.push(
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
    );
  } else {
    columns.push({
      id: 'closeout',
      header: t('awards.register.col.closeout'),
      cell: (row) =>
        row.closeoutStatus === null ? (
          <span className="tiq-text-muted">{t('awards.register.closeoutNotStarted')}</span>
        ) : (
          <StatusChip enum="event_closeouts.status" value={row.closeoutStatus} />
        ),
    });
  }
  columns.push(
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
  );

  const stepOptions = AWARD_NEXT_STEPS.map((value) => ({
    value,
    label: nextStepLabel(value),
  }));

  return (
    <div className="tiq-page">
      <PageHeader
        title={mode === 'award' ? t('awards.register.title') : t('awards.closeoutRegister.title')}
        subtitle={
          mode === 'award' ? t('awards.register.intro') : t('awards.closeoutRegister.intro')
        }
      />
      <FilterBar label={t('awards.register.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('awards.common.search')}
          placeholder={t('awards.register.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
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
        {mode === 'award' && (
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
        )}
        {mode === 'closeout' && (
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
        )}
        <Select
          label={t('awards.register.filter.nextStep')}
          placeholder={t('awards.register.filter.allSteps')}
          value={filters.nextStep}
          options={stepOptions}
          onChange={(nextStep) => setFilters({ nextStep, page: 1 })}
        />
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
        <Checkbox
          label={t('awards.register.filter.holds')}
          checked={filters.holds}
          onChange={(holds) => setFilters({ holds, page: 1 })}
        />
      </FilterBar>
      {mode === 'award' ? (
        <KpiGrid>
          <KpiCard
            label={t('awards.register.kpi.files')}
            icon="award"
            value={count(all)}
            hint={t('awards.register.kpi.filesHint')}
          />
          <KpiCard
            label={t('awards.register.kpi.awaitingApproval')}
            icon="clipboardCheck"
            tone="warning"
            value={count(
              all.filter((row) => row.latestRecommendation?.status === 'awaiting_approval'),
            )}
            hint={t('awards.register.kpi.awaitingApprovalHint')}
          />
          <KpiCard
            label={t('awards.register.kpi.standstill')}
            icon="hourglass"
            tone="info"
            value={count(
              all.filter(
                (row) => row.standstillStatus === 'running' || row.standstillStatus === 'extended',
              ),
            )}
            hint={t('awards.register.kpi.standstillHint')}
          />
          <KpiCard
            label={t('awards.register.kpi.holds')}
            icon="pause"
            tone="danger"
            value={count(all.filter((row) => row.activeHoldCount > 0))}
            hint={t('awards.register.kpi.holdsHint')}
          />
        </KpiGrid>
      ) : (
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
      )}
      <Card flush>
        <DataTable
          caption={
            mode === 'award' ? t('awards.register.caption') : t('awards.closeoutRegister.caption')
          }
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
          empty={
            <EmptyState
              compact
              icon="award"
              title={filtered ? t('awards.register.emptyFiltered') : t('awards.register.empty')}
              description={filtered ? undefined : t('awards.register.emptyHint')}
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
    </div>
  );
}
