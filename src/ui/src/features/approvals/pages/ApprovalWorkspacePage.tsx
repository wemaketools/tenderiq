/**
 * COM-04 approvals view and COM-05 approval decision as one workspace (docs/plan/design1 §4): the inbox list on the
 * left, the selected record on the right. Selection is the route (`/me/approvals/:approvalId`), so every record stays
 * addressable and back/forward work; below the tablet width the list route shows the list and the record route shows
 * the record with a back link. The views (To review, Sent, History) map onto the inbox endpoint's own filters; the
 * other filters stay available in a disclosure. The inbox spans every active organization (DD-21): each row and the
 * record name their organization, and a decision runs in the record's organization, never the active one.
 */
import { useState } from 'react';

import { getMyApproval, listMyApprovals } from '@contracts/approvals';
import type {
  ApprovalDecision,
  ApprovalDetail as ApprovalDetailRecord,
  MyApprovalItem,
} from '@contracts/approvals';
import { APPROVAL_REQUESTS_STATUS, APPROVAL_REQUESTS_SUBJECT_TYPE } from '@contracts/enums';
import type { ApprovalRequestsStatus, ApprovalRequestsSubjectType } from '@contracts/enums';
import { getMyTaskSummary } from '@contracts/tasks';

import { invalidateApiQueries, useApiQuery } from '../../../api/hooks';
import type { QueryResult } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Checkbox,
  Chip,
  DateInput,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterDisclosure,
  IconTile,
  MoneyText,
  OverdueChip,
  PageHeader,
  Pagination,
  SearchField,
  Select,
  SkeletonBlock,
  Split,
  StatusChip,
  Tabs,
  Toolbar,
} from '../../../components/ui';
// WorkRow is not re-exported from the index yet (follow-up for the shared index).
import { WorkList, WorkRow } from '../../../components/ui/WorkRow';
import {
  addCalendarDays,
  calendarDateOf,
  formatCount,
  formatInstantDate,
} from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { useNow } from '../../../lib/useNow';
import { InboxTabs } from '../../tasks/components/InboxTabs';
import { INBOX_PATHS } from '../../tasks/lib/paths';
import {
  compact,
  directionOf,
  oneOf,
  positiveId,
  useCommandResult,
  useDisplayTimeZone,
  useIdParam,
  useOrganizationOptions,
} from '../../tasks/lib/shared';
import { ApprovalDetail } from '../components/ApprovalDetail';
import { DecisionDialog } from '../components/DecisionDialog';
import { SubjectReference } from '../components/SubjectReference';
import { isBlockedForMe } from '../lib/status';
import { APPROVAL_VIEWS, approvalView, inView, viewQuery } from '../lib/views';
import type { ApprovalView } from '../lib/views';

/** Below this width the list and the record show one at a time. */
const NARROW_QUERY = '(max-width: 1023px)';

const DEFAULTS = {
  view: 'all',
  q: '',
  tenant: '',
  status: '',
  subjectType: '',
  requestedFrom: '',
  requestedTo: '',
  overdue: false,
  page: 1,
  pageSize: 25,
};

function MyPart({ row }: { readonly row: MyApprovalItem }) {
  return (
    <>
      {row.involvement !== undefined && (
        <Chip tone="neutral" size="sm">
          {t(`approvals.involvement.${row.involvement}`)}
        </Chip>
      )}
      {row.myStep?.canDecide === true && (
        <Chip tone="accent" size="sm" icon="checkSquare">
          {t('approvals.list.canDecide')}
        </Chip>
      )}
      {isBlockedForMe(row) && (
        <Chip
          tone="warning"
          size="sm"
          icon="lock"
          title={row.myStep?.blockers.map((code) => t(`approvals.blocker.${code}`)).join(' ')}
        >
          {t('approvals.list.blocked')}
        </Chip>
      )}
    </>
  );
}

/** "Today", "Tomorrow" or the date, in the display zone; overdue rows carry the flag. */
function DueAside({
  row,
  timeZone,
  today,
}: {
  readonly row: MyApprovalItem;
  readonly timeZone: string;
  readonly today: string;
}) {
  if (row.dueAt === null) {
    return <span className="tiq-text-muted">{t('approvals.list.noDue')}</span>;
  }
  const day = calendarDateOf(row.dueAt, timeZone);
  const text =
    day === today
      ? t('approvals.list.dueToday')
      : day === addCalendarDays(today, 1)
        ? t('approvals.list.dueTomorrow')
        : formatInstantDate(row.dueAt, timeZone);
  return (
    <>
      <span
        className={row.isOverdue ? 'tiq-text-danger' : day === today ? 'tiq-attention' : undefined}
      >
        {text}
      </span>
      {row.isOverdue && <OverdueChip />}
    </>
  );
}

function RecordPane({
  approvalId,
  query,
  hideTitle,
}: {
  readonly approvalId: number | null;
  readonly query: QueryResult<ApprovalDetailRecord>;
  readonly hideTitle: boolean;
}) {
  const [result, setResult] = useCommandResult<ApprovalDetailRecord>(approvalId);
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);

  if (approvalId === null) {
    return (
      <EmptyState
        icon="checkSquare"
        title={t('approvals.workspace.pickTitle')}
        description={t('approvals.workspace.pickBody')}
      />
    );
  }
  const approval = result ?? query.data;
  if (approval === undefined) {
    return query.error === null ? (
      <SkeletonBlock lines={8} />
    ) : (
      <ErrorState error={query.error} onRetry={query.reload} />
    );
  }
  return (
    <>
      <ApprovalDetail
        approval={approval}
        recorded={result !== null}
        onDecide={setDecision}
        hideTitle={hideTitle}
      />
      {decision !== null && (
        <DecisionDialog
          approval={approval}
          decision={decision}
          onClose={() => setDecision(null)}
          onDecided={(decided) => {
            setResult(decided);
            setDecision(null);
            invalidateApiQueries('me.approvals.list');
            invalidateApiQueries('me.tasks.');
          }}
        />
      )}
    </>
  );
}

export default function ApprovalWorkspacePage() {
  const timeZone = useDisplayTimeZone();
  const now = useNow();
  const today = calendarDateOf(new Date(now), timeZone);
  const narrow = useMediaQuery(NARROW_QUERY);
  const organizations = useOrganizationOptions();
  const approvalId = useIdParam('approvalId');
  const record = useApiQuery(
    getMyApproval,
    approvalId === null ? null : { params: { approvalId } },
  );
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-04-approvals', DEFAULTS);
  const view = approvalView(filters.view);
  const summary = useApiQuery(getMyTaskSummary, {});
  const overview = useApiQuery(listMyApprovals, { query: { pageSize: 100 } });
  const status = oneOf<ApprovalRequestsStatus>(filters.status, APPROVAL_REQUESTS_STATUS);
  const query = useApiQuery(listMyApprovals, {
    query: compact({
      q: filters.q.trim(),
      tenantId: positiveId(filters.tenant),
      subjectType: oneOf<ApprovalRequestsSubjectType>(
        filters.subjectType,
        APPROVAL_REQUESTS_SUBJECT_TYPE,
      ),
      requestedFrom: filters.requestedFrom,
      requestedTo: filters.requestedTo,
      overdue: filters.overdue ? true : undefined,
      ...viewQuery(view, status),
      sort: 'dueAt',
      dir: directionOf('asc'),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const all = overview.data?.items ?? [];
  // Counts only from a complete overview: a capped page never stands for the whole inbox.
  const complete = overview.data !== undefined && overview.data.total <= all.length;
  const awaiting = complete ? all.filter((row) => inView(row, 'review')).length : null;
  const countOf = (which: ApprovalView): number | undefined =>
    complete ? all.filter((row) => inView(row, which)).length : undefined;
  const advanced =
    [
      filters.tenant,
      filters.status,
      filters.subjectType,
      filters.requestedFrom,
      filters.requestedTo,
    ].filter((value) => value !== '').length + (filters.overdue ? 1 : 0);
  const filtered = advanced > 0 || filters.q !== '' || view !== 'all';

  const list = (
    <div className="tiq-stack tiq-stack--spaced">
      <Toolbar
        label={t('approvals.list.filters')}
        end={
          <FilterDisclosure
            activeCount={advanced}
            render={(toggle, panel) => (
              <>
                {toggle}
                {panel !== null && <div className="tiq-approval-filters">{panel}</div>}
              </>
            )}
          >
            <FilterBar
              variant="panel"
              label={t('approvals.list.filters')}
              onClear={clearFilters}
              canClear={filtered}
            >
              <Select
                label={t('approvals.list.organization')}
                placeholder={t('approvals.list.allOrganizations')}
                value={filters.tenant}
                options={organizations}
                onChange={(tenant) => setFilters({ tenant, page: 1 })}
              />
              <Select
                label={t('approvals.list.status')}
                placeholder={t('approvals.list.allStatuses')}
                value={filters.status}
                options={APPROVAL_REQUESTS_STATUS.map((value) => ({
                  value,
                  label: tEnum('approval_requests.status', value),
                }))}
                onChange={(value) => setFilters({ status: value, page: 1 })}
              />
              <Select
                label={t('approvals.list.subjectType')}
                placeholder={t('approvals.list.allSubjectTypes')}
                value={filters.subjectType}
                options={APPROVAL_REQUESTS_SUBJECT_TYPE.map((value) => ({
                  value,
                  label: tEnum('approval_requests.subject_type', value),
                }))}
                onChange={(subjectType) => setFilters({ subjectType, page: 1 })}
              />
              <DateInput
                label={t('approvals.list.requestedFrom')}
                value={filters.requestedFrom}
                onChange={(requestedFrom) => setFilters({ requestedFrom, page: 1 })}
              />
              <DateInput
                label={t('approvals.list.requestedTo')}
                value={filters.requestedTo}
                onChange={(requestedTo) => setFilters({ requestedTo, page: 1 })}
              />
              <Checkbox
                label={t('approvals.list.overdueOnly')}
                checked={filters.overdue}
                onChange={(overdue) => setFilters({ overdue, page: 1 })}
              />
            </FilterBar>
          </FilterDisclosure>
        }
      >
        <div className="tiq-toolbar-search">
          <SearchField
            label={t('approvals.list.search')}
            placeholder={t('approvals.list.searchPlaceholder')}
            value={filters.q}
            hideLabel
            full
            onChange={(q) => setFilters({ q, page: 1 })}
          />
        </div>
      </Toolbar>
      {query.error !== null && query.data === undefined ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : query.data === undefined ? (
        <SkeletonBlock lines={6} label={t('ui.loading')} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          compact
          icon="checkCircle"
          title={filtered ? t('approvals.list.emptyFiltered') : t('approvals.list.empty')}
        />
      ) : (
        <>
          <WorkList label={t('approvals.list.caption')}>
            {query.data.items.map((row) => (
              <WorkRow
                key={row.id}
                id={`approval-${row.id}`}
                to={INBOX_PATHS.approval(row.id)}
                openLabel={t('approvals.list.open', { title: row.title })}
                selected={row.id === approvalId}
                stretch
                lead={
                  <IconTile
                    icon="clipboardCheck"
                    tone={row.myStep?.canDecide === true ? 'accent' : 'neutral'}
                  />
                }
                title={row.title}
                meta={[
                  row.amount === null ? null : <MoneyText value={row.amount} />,
                  row.organization.tenantName,
                  tEnum('approval_requests.subject_type', row.subjectType),
                  row.subjectReference !== null || row.subjectLinkPath !== null ? (
                    <SubjectReference value={row.subjectReference} to={row.subjectLinkPath} />
                  ) : null,
                  <MyPart row={row} />,
                  row.status === 'pending' ? null : (
                    <StatusChip enum="approval_requests.status" value={row.status} size="sm" />
                  ),
                ]}
                aside={<DueAside row={row} timeZone={timeZone} today={today} />}
              />
            ))}
          </WorkList>
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={(page) => setFilters({ page })}
            onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
          />
        </>
      )}
    </div>
  );

  if (narrow && approvalId !== null) {
    const title = record.data?.title ?? null;
    return (
      <div className="tiq-page">
        <PageHeader
          title={title ?? t('approvals.detail.loadingTitle')}
          back={{ to: INBOX_PATHS.approvals, label: t('approvals.detail.back') }}
        />
        <RecordPane approvalId={approvalId} query={record} hideTitle={title !== null} />
      </div>
    );
  }

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('approvals.nav.approvals')}
        headline={t('approvals.workspace.headline')}
        subtitle={
          awaiting === null
            ? t('approvals.workspace.ledeUnknown')
            : t('approvals.workspace.lede', { count: awaiting, formatted: formatCount(awaiting) })
        }
      />
      <InboxTabs taskCount={summary.data?.open} approvalCount={awaiting ?? undefined} />
      <Tabs
        variant="segmented"
        label={t('approvals.workspace.views')}
        selected={view}
        onSelect={(id) => setFilters({ view: id, page: 1 })}
        tabs={APPROVAL_VIEWS.map((id) => ({
          id,
          label: t(`approvals.workspace.view.${id}`),
          count: countOf(id),
          countBadge: id === 'review',
        }))}
      >
        <Split
          list={list}
          detail={<RecordPane approvalId={approvalId} query={record} hideTitle={false} />}
          listLabel={t('approvals.list.caption')}
          narrow={narrow}
          narrowShows="list"
        />
      </Tabs>
    </div>
  );
}
