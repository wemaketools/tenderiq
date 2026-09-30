/**
 * BUY-07 — Tender register and creation: events with their method, status, owner, category, value, dates and
 * source request. Principal actions: create a tender (from an approved template, prior content, a blank form or an
 * approved request/strategy) and link stages.
 *
 * Holders of `tender.create` or `audit.view` see the whole register; other `tender.view` holders see the tenders
 * whose team they are on (the API filters; `total` counts only visible rows).
 */
import { useState } from 'react';

import {
  TENDERS_EVENT_TYPE,
  TENDERS_PARTICIPATION,
  TENDERS_PROCEDURE,
  TENDERS_STATUS,
} from '@contracts/enums';
import {
  TENDER_PHASES,
  TENDER_PHASE_STATUSES,
  TENDER_SORT_FIELDS,
  listTenders,
} from '@contracts/tenders';
import type { TenderLinkState, TenderPhase, TenderRow } from '@contracts/tenders';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
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
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { LinkStageDialog } from '../components/LinkStageDialog';
import { useOfficialTimeZone } from '../lib/hooks';
import {
  compact,
  directionOf,
  oneOf,
  positiveId,
  single,
  tableSort,
  uniqueOptions,
} from '../lib/lists';
import { useOverlay } from '../lib/overlay';
import { tenderPaths } from '../lib/paths';
import { TENDER_CREATE, TENDER_EDIT } from '../lib/permissions';

type SortField = (typeof TENDER_SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  phase: '',
  status: '',
  eventType: '',
  procedure: '',
  participation: '',
  owner: '',
  category: '',
  deadlineFrom: '',
  deadlineTo: '',
  mine: false,
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (TENDER_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as SortField)
    : 'updatedAt';
}

function countOf(
  counts: readonly { readonly status: string; readonly count: number }[] | undefined,
  statuses: readonly string[],
): number | null {
  if (counts === undefined) return null;
  return counts
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total + row.count, 0);
}

export default function TenderRegisterPage() {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canCreate = usePermission(TENDER_CREATE);
  const canEdit = usePermission(TENDER_EDIT);
  const [linkOpen, setLinkOpen] = useState(false);
  const overlay = useOverlay<TenderRow>();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-07', DEFAULTS);

  const query = useApiQuery(listTenders, {
    query: compact({
      q: filters.q.trim(),
      phase: single<TenderPhase>(filters.phase, TENDER_PHASES),
      status: oneOf(filters.status, TENDERS_STATUS),
      eventType: oneOf(filters.eventType, TENDERS_EVENT_TYPE),
      procedure: oneOf(filters.procedure, TENDERS_PROCEDURE),
      participation: oneOf(filters.participation, TENDERS_PARTICIPATION),
      ownerUserId: positiveId(filters.owner),
      categoryId: positiveId(filters.category),
      deadlineFrom: filters.deadlineFrom,
      deadlineTo: filters.deadlineTo,
      mine: filters.mine ? true : undefined,
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const everything = useApiQuery(listTenders, { query: { pageSize: 100 } });
  const all = everything.data?.items ?? [];
  const counts = query.data?.statusCounts;
  const filtered =
    filters.mine ||
    [
      filters.q,
      filters.phase,
      filters.status,
      filters.eventType,
      filters.procedure,
      filters.participation,
      filters.owner,
      filters.category,
      filters.deadlineFrom,
      filters.deadlineTo,
    ].some((value) => value !== '');

  const ownerOptions = uniqueOptions(
    all.map((row) => ({ value: String(row.owner.userId), label: row.owner.fullName })),
  );
  const categoryOptions = uniqueOptions(
    all.flatMap((row) =>
      row.category === null ? [] : [{ value: String(row.category.id), label: row.category.name }],
    ),
  );

  const onLinked = (result: TenderLinkState): void => {
    const row = [...(query.data?.items ?? []), ...all].find((item) => item.id === result.tenderId);
    if (row !== undefined) {
      overlay.put({
        ...row,
        linkedFrom: result.linkedFrom,
        linkType: result.linkType,
        stageNo: result.stageNo,
      });
    }
    toast.show(
      t('tender-authoring.link.done', {
        from: result.linkedFrom.reference,
        type: tEnum('tenders.link_type', result.linkType),
      }),
      'success',
    );
  };

  const kpi = (value: number | null): string => (value === null ? '…' : formatCount(value));

  const columns: DataTableColumn<TenderRow>[] = [
    {
      id: 'reference',
      header: t('tender-authoring.register.col.reference'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} to={tenderPaths.overview(row.id)} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'method',
      header: t('tender-authoring.register.col.method'),
      cell: (row) => (
        <>
          <span>{tEnum('tenders.event_type', row.eventType)}</span>
          <span className="tiq-cell-sub">{tEnum('tenders.procedure', row.procedure)}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('tender-authoring.register.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="tenders.status" value={row.status} />
          {row.readiness !== null && (
            <span className="tiq-cell-sub">
              {row.releaseApprovalStatus === null
                ? t('tender-authoring.register.noApproval')
                : t('tender-authoring.register.approval', {
                    status: tEnum('approval_requests.status', row.releaseApprovalStatus),
                  })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'owner',
      header: t('tender-authoring.register.col.owner'),
      cell: (row) => (
        <>
          <span>{row.owner.fullName}</span>
          <span className="tiq-cell-sub">
            {row.category?.name ?? t('tender-authoring.register.noCategory')}
          </span>
        </>
      ),
    },
    {
      id: 'estimatedValue',
      header: t('tender-authoring.register.col.value'),
      sortable: true,
      numeric: true,
      cell: (row) => (
        <>
          <MoneyText value={row.estimatedValue} />
          {row.lotCount > 0 && (
            <span className="tiq-cell-sub">
              {t('tender-authoring.register.lots', { count: row.lotCount })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'submissionDeadline',
      header: t('tender-authoring.register.col.deadline'),
      sortable: true,
      cell: (row) => (
        <>
          {row.submissionDeadline === null ? (
            <OrDash>{null}</OrDash>
          ) : (
            <OfficialDeadline deadline={row.submissionDeadline} showLocal={false} />
          )}
          {row.releasedAt !== null ? (
            <span className="tiq-cell-sub">
              {t('tender-authoring.register.released', {
                date: formatInstantDate(row.releasedAt, timeZone),
              })}
            </span>
          ) : row.scheduledReleaseAt !== null ? (
            <span className="tiq-cell-sub">
              {t('tender-authoring.register.planned', {
                date: formatInstantDate(row.scheduledReleaseAt, timeZone),
              })}
            </span>
          ) : null}
        </>
      ),
    },
    {
      id: 'source',
      header: t('tender-authoring.register.col.source'),
      cell: (row) => (
        <>
          {row.sourceRequest === null ? (
            <OrDash>{null}</OrDash>
          ) : (
            <Reference value={row.sourceRequest.reference} />
          )}
          {row.linkedFrom !== null && row.linkType !== null && (
            <span className="tiq-cell-sub">
              {t('tender-authoring.register.stage', {
                stage: row.stageNo,
                type: tEnum('tenders.link_type', row.linkType),
                from: row.linkedFrom.reference,
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'readiness',
      header: t('tender-authoring.register.col.readiness'),
      cell: (row) =>
        row.readiness === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-inline">
            {row.readiness.blocking > 0 && (
              <Chip tone="danger" size="sm">
                {t('tender-authoring.issues.blockingCount', { count: row.readiness.blocking })}
              </Chip>
            )}
            {row.readiness.warnings > 0 && (
              <Chip tone="warning" size="sm">
                {t('tender-authoring.issues.warningCount', { count: row.readiness.warnings })}
              </Chip>
            )}
            {row.readiness.blocking === 0 && row.readiness.warnings === 0 && (
              <Chip tone="success" size="sm">
                {t('tender-authoring.register.ready')}
              </Chip>
            )}
          </span>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('tender-authoring.register.title')}
        subtitle={t('tender-authoring.register.intro')}
        primaryAction={
          canCreate ? (
            <ButtonLink to={tenderPaths.create} variant="primary" icon="plus">
              {t('tender-authoring.register.new')}
            </ButtonLink>
          ) : undefined
        }
        actions={
          canEdit ? (
            <Button icon="link" onClick={() => setLinkOpen(true)}>
              {t('tender-authoring.register.linkStages')}
            </Button>
          ) : undefined
        }
      />
      <FilterBar
        label={t('tender-authoring.register.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <Select
          label={t('tender-authoring.register.filter.phase')}
          placeholder={t('tender-authoring.register.filter.allPhases')}
          value={filters.phase}
          options={TENDER_PHASES.map((value) => ({
            value,
            label: t(`tender-authoring.phase.${value}`),
          }))}
          onChange={(phase) => setFilters({ phase, page: 1 })}
        />
        <Select
          label={t('tender-authoring.register.filter.status')}
          placeholder={t('tender-authoring.register.filter.allStatuses')}
          value={filters.status}
          options={TENDERS_STATUS.map((value) => ({
            value,
            label: tEnum('tenders.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('tender-authoring.register.filter.eventType')}
          placeholder={t('tender-authoring.register.filter.allEventTypes')}
          value={filters.eventType}
          options={TENDERS_EVENT_TYPE.map((value) => ({
            value,
            label: tEnum('tenders.event_type', value),
          }))}
          onChange={(eventType) => setFilters({ eventType, page: 1 })}
        />
        <Select
          label={t('tender-authoring.register.filter.procedure')}
          placeholder={t('tender-authoring.register.filter.allProcedures')}
          value={filters.procedure}
          options={TENDERS_PROCEDURE.map((value) => ({
            value,
            label: tEnum('tenders.procedure', value),
          }))}
          onChange={(procedure) => setFilters({ procedure, page: 1 })}
        />
        <Select
          label={t('tender-authoring.register.filter.participation')}
          placeholder={t('tender-authoring.register.filter.allParticipation')}
          value={filters.participation}
          options={TENDERS_PARTICIPATION.map((value) => ({
            value,
            label: tEnum('tenders.participation', value),
          }))}
          onChange={(participation) => setFilters({ participation, page: 1 })}
        />
        <Select
          label={t('tender-authoring.register.filter.owner')}
          placeholder={t('tender-authoring.register.filter.allOwners')}
          value={filters.owner}
          options={ownerOptions}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
        <Select
          label={t('tender-authoring.register.filter.category')}
          placeholder={t('tender-authoring.register.filter.allCategories')}
          value={filters.category}
          options={categoryOptions}
          onChange={(category) => setFilters({ category, page: 1 })}
        />
        <DateInput
          label={t('tender-authoring.register.filter.deadlineFrom')}
          value={filters.deadlineFrom}
          onChange={(deadlineFrom) => setFilters({ deadlineFrom, page: 1 })}
        />
        <DateInput
          label={t('tender-authoring.register.filter.deadlineTo')}
          value={filters.deadlineTo}
          onChange={(deadlineTo) => setFilters({ deadlineTo, page: 1 })}
        />
        <SearchField
          label={t('tender-authoring.register.filter.search')}
          placeholder={t('tender-authoring.register.filter.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Checkbox
          label={t('tender-authoring.register.filter.mine')}
          checked={filters.mine}
          onChange={(mine) => setFilters({ mine, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('tender-authoring.register.kpi.preparation')}
          icon="edit"
          tone="info"
          value={kpi(countOf(counts, TENDER_PHASE_STATUSES.preparation))}
          hint={t('tender-authoring.register.kpi.preparationHint')}
        />
        <KpiCard
          label={t('tender-authoring.register.kpi.awaiting')}
          icon="clipboardCheck"
          tone="warning"
          value={kpi(countOf(counts, ['awaiting_release_approval']))}
          hint={t('tender-authoring.register.kpi.awaitingHint')}
        />
        <KpiCard
          label={t('tender-authoring.register.kpi.market')}
          icon="megaphone"
          tone="accent"
          value={kpi(countOf(counts, TENDER_PHASE_STATUSES.in_market))}
          hint={t('tender-authoring.register.kpi.marketHint')}
        />
        <KpiCard
          label={t('tender-authoring.register.kpi.assessment')}
          icon="scale"
          tone="success"
          value={kpi(
            countOf(counts, [...TENDER_PHASE_STATUSES.assessment, ...TENDER_PHASE_STATUSES.award]),
          )}
          hint={t('tender-authoring.register.kpi.assessmentHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('tender-authoring.register.caption')}
          columns={columns}
          rows={query.data === undefined ? undefined : overlay.apply(query.data.items)}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          rowHref={(row) => tenderPaths.overview(row.id)}
          loading={query.isFetching}
          error={query.error?.kind === 'forbidden' ? null : query.error}
          restricted={query.error?.kind === 'forbidden'}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="fileText"
              title={
                filtered
                  ? t('tender-authoring.register.emptyFiltered')
                  : t('tender-authoring.register.empty')
              }
              action={
                !filtered && canCreate ? (
                  <ButtonLink to={tenderPaths.create} icon="plus">
                    {t('tender-authoring.register.new')}
                  </ButtonLink>
                ) : undefined
              }
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
      {canEdit && (
        <LinkStageDialog open={linkOpen} onClose={() => setLinkOpen(false)} onLinked={onLinked} />
      )}
    </div>
  );
}
