/**
 * BUY-07 — Tender register and creation (docs/plan/design1 §3 "Tenders"): events with their method, status, owner,
 * category, value, dates and source request as a broad working table. The stage segmented control maps to the
 * existing `phase` filter and its counts come from the API's whole-register `statusCounts`; every row keeps its
 * EXACT status, so "Closed (awaiting opening)" is never folded into "Under assessment". Search and owner stay in the
 * toolbar; the other filters move into a disclosure that stays available. Principal actions: create a tender (the
 * shell's section action) and link stages.
 *
 * Holders of `tender.create` or `audit.view` see the whole register; other `tender.view` holders see the tenders
 * whose team they are on (the API filters; `total` counts only visible rows).
 */
import { useState } from 'react';
import { Link } from 'react-router';

import {
  TENDERS_EVENT_TYPE,
  TENDERS_PARTICIPATION,
  TENDERS_PROCEDURE,
  TENDERS_STATUS,
} from '@contracts/enums';
import { enumTone } from '@contracts/enums';
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
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  FilterDisclosure,
  IconTile,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Person,
  Reference,
  SearchField,
  Select,
  StatusLabel,
  Tabs,
  Toolbar,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, TabItem } from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
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

/** The segmented control's "all phases" entry. */
const ALL_PHASES = 'all';

function sortField(value: string): SortField {
  return (TENDER_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as SortField)
    : 'updatedAt';
}

function countOf(
  counts: readonly { readonly status: string; readonly count: number }[] | undefined,
  statuses: readonly string[],
): number | undefined {
  if (counts === undefined) return undefined;
  return counts
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total + row.count, 0);
}

/** The exact status with the release-approval note below it. */
function StageCell({ row }: { readonly row: TenderRow }) {
  const approval =
    row.readiness === null
      ? undefined
      : row.releaseApprovalStatus === null
        ? t('tender-authoring.register.noApproval')
        : t('tender-authoring.register.approval', {
            status: tEnum('approval_requests.status', row.releaseApprovalStatus),
          });
  return (
    <StatusLabel tone={enumTone('tenders.status', row.status)} sub={approval}>
      {tEnum('tenders.status', row.status)}
    </StatusLabel>
  );
}

function ReadinessChips({ row }: { readonly row: TenderRow }) {
  if (row.readiness === null) return null;
  return (
    <span className="tiq-inline tiq-cell-sub">
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
  );
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
  const advanced =
    [
      filters.status,
      filters.eventType,
      filters.procedure,
      filters.participation,
      filters.category,
      filters.deadlineFrom,
      filters.deadlineTo,
    ].filter((value) => value !== '').length + (filters.mine ? 1 : 0);
  const filtered =
    advanced > 0 || [filters.q, filters.phase, filters.owner].some((value) => value !== '');

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

  const phaseTabs: TabItem[] = [
    {
      id: ALL_PHASES,
      label: t('tender-authoring.register.filter.allPhasesShort'),
      count: countOf(counts, TENDERS_STATUS),
    },
    ...TENDER_PHASES.map((phase) => ({
      id: phase,
      label: t(`tender-authoring.phase.${phase}`),
      count: countOf(counts, TENDER_PHASE_STATUSES[phase]),
    })),
  ];

  const columns: DataTableColumn<TenderRow>[] = [
    {
      id: 'reference',
      header: t('tender-authoring.register.col.name'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-cell-lead">
          <IconTile icon="fileText" size="sm" />
          <span>
            <span className="tiq-cell-title">
              <Link to={tenderPaths.overview(row.id)}>{row.title}</Link>
            </span>
            <span className="tiq-cell-sub tiq-dotsep">
              <Reference value={row.reference} />
              <span>{tEnum('tenders.event_type', row.eventType)}</span>
              {row.sourceRequest !== null && (
                <span>
                  {t('tender-authoring.register.from')}{' '}
                  <Reference value={row.sourceRequest.reference} />
                </span>
              )}
            </span>
            {row.linkedFrom !== null && row.linkType !== null && (
              <span className="tiq-cell-sub">
                {t('tender-authoring.register.stage', {
                  stage: row.stageNo,
                  type: tEnum('tenders.link_type', row.linkType),
                  from: row.linkedFrom.reference,
                })}
              </span>
            )}
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      header: t('tender-authoring.register.col.stage'),
      sortable: true,
      cell: (row) => <StageCell row={row} />,
    },
    {
      id: 'owner',
      header: t('tender-authoring.register.col.owner'),
      cell: (row) => (
        <>
          <Person name={row.owner.fullName} size="sm" />
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
      header: t('tender-authoring.register.col.nextDate'),
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
      id: 'readiness',
      header: t('tender-authoring.register.col.readiness'),
      cell: (row) =>
        row.readiness === null ? <OrDash>{null}</OrDash> : <ReadinessChips row={row} />,
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('tender-authoring.register.title')}
        headline={t('tender-authoring.register.headline')}
        subtitle={t('tender-authoring.register.intro')}
        actions={
          canEdit ? (
            <Button icon="link" onClick={() => setLinkOpen(true)}>
              {t('tender-authoring.register.linkStages')}
            </Button>
          ) : undefined
        }
      />
      <Tabs
        variant="segmented"
        label={t('tender-authoring.register.filter.phase')}
        tabs={phaseTabs}
        selected={filters.phase === '' ? ALL_PHASES : filters.phase}
        onSelect={(id) => setFilters({ phase: id === ALL_PHASES ? '' : id, page: 1 })}
      >
        <FilterDisclosure
          activeCount={advanced}
          render={(toggle, panel) => (
            <>
              <Toolbar label={t('tender-authoring.register.filters')} end={toggle}>
                <div className="tiq-toolbar-search">
                  <SearchField
                    label={t('tender-authoring.register.filter.search')}
                    placeholder={t('tender-authoring.register.filter.searchPlaceholder')}
                    value={filters.q}
                    onChange={(q) => setFilters({ q, page: 1 })}
                    hideLabel
                    full
                  />
                </div>
                <Select
                  label={t('tender-authoring.register.filter.owner')}
                  aria-label={t('tender-authoring.register.filter.owner')}
                  placeholder={t('tender-authoring.register.filter.allOwners')}
                  value={filters.owner}
                  options={ownerOptions}
                  onChange={(owner) => setFilters({ owner, page: 1 })}
                />
              </Toolbar>
              {panel}
            </>
          )}
        >
          <FilterBar
            variant="panel"
            label={t('tender-authoring.register.advancedFilters')}
            onClear={clearFilters}
            canClear={filtered}
          >
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
            <Checkbox
              label={t('tender-authoring.register.filter.mine')}
              checked={filters.mine}
              onChange={(mine) => setFilters({ mine, page: 1 })}
            />
          </FilterBar>
        </FilterDisclosure>
        <DataTable
          variant="plain"
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
        {query.data !== undefined && query.data.total > 0 && (
          <p className="tiq-register-foot" aria-live="polite">
            {t('tender-authoring.register.total', { count: query.data.total })}
          </p>
        )}
      </Tabs>
      {canEdit && (
        <LinkStageDialog open={linkOpen} onClose={() => setLinkOpen(false)} onLinked={onLinked} />
      )}
    </div>
  );
}
