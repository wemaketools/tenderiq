/**
 * COM-04 — Task and approval inbox (approvals view): the approvals the caller decides (directly or as a delegate)
 * or requested, in every active organization (DD-21), with the record, amount, due date, current step, status and
 * whether the caller can decide now or what blocks them.
 */
import { useNavigate } from 'react-router';

import { APPROVAL_INVOLVEMENTS, APPROVAL_SORT_FIELDS, listMyApprovals } from '@contracts/approvals';
import type { ApprovalInvolvement, MyApprovalItem } from '@contracts/approvals';
import { APPROVAL_REQUESTS_STATUS, APPROVAL_REQUESTS_SUBJECT_TYPE } from '@contracts/enums';
import type { ApprovalRequestsStatus, ApprovalRequestsSubjectType } from '@contracts/enums';
import { getMyTaskSummary } from '@contracts/tasks';

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
  OverdueChip,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { InboxTabs } from '../../tasks/components/InboxTabs';
import { INBOX_PATHS } from '../../tasks/lib/paths';
import {
  compact,
  directionOf,
  oneOf,
  positiveId,
  useDisplayTimeZone,
  useOrganizationOptions,
} from '../../tasks/lib/shared';
import { isBlockedForMe } from '../lib/status';

type SortField = (typeof APPROVAL_SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  tenant: '',
  status: '',
  subjectType: '',
  involvement: '',
  requestedFrom: '',
  requestedTo: '',
  awaiting: false,
  overdue: false,
  sort: 'dueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (APPROVAL_SORT_FIELDS as readonly string[]).includes(value)
    ? (value as SortField)
    : 'dueAt';
}

function MyPart({ row }: { readonly row: MyApprovalItem }) {
  return (
    <span className="tiq-inline">
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
    </span>
  );
}

export default function ApprovalInboxPage() {
  const navigate = useNavigate();
  const timeZone = useDisplayTimeZone();
  const organizations = useOrganizationOptions();
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-04-approvals', DEFAULTS);
  const summary = useApiQuery(getMyTaskSummary, {});
  const overview = useApiQuery(listMyApprovals, { query: { pageSize: 100 } });
  const query = useApiQuery(listMyApprovals, {
    query: compact({
      q: filters.q.trim(),
      tenantId: positiveId(filters.tenant),
      status: oneOf<ApprovalRequestsStatus>(filters.status, APPROVAL_REQUESTS_STATUS),
      subjectType: oneOf<ApprovalRequestsSubjectType>(
        filters.subjectType,
        APPROVAL_REQUESTS_SUBJECT_TYPE,
      ),
      involvement: oneOf<ApprovalInvolvement>(filters.involvement, APPROVAL_INVOLVEMENTS),
      requestedFrom: filters.requestedFrom,
      requestedTo: filters.requestedTo,
      awaitingMyDecision: filters.awaiting ? true : undefined,
      overdue: filters.overdue ? true : undefined,
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const all = overview.data?.items ?? [];
  const kpi = (count: (rows: readonly MyApprovalItem[]) => number): string =>
    overview.data === undefined ? '…' : formatCount(count(all));
  const filtered =
    filters.awaiting ||
    filters.overdue ||
    [
      filters.q,
      filters.tenant,
      filters.status,
      filters.subjectType,
      filters.involvement,
      filters.requestedFrom,
      filters.requestedTo,
    ].some((value) => value !== '');
  const awaitingCount = all.filter((row) => row.myStep?.canDecide === true).length;

  const columns: DataTableColumn<MyApprovalItem>[] = [
    {
      id: 'title',
      header: t('approvals.list.col.approval'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('approval_requests.subject_type', row.subjectType)}
          </span>
        </>
      ),
    },
    {
      id: 'reference',
      header: t('approvals.list.col.reference'),
      cell: (row) => (
        <>
          {row.subjectReference === null ? (
            '—'
          ) : (
            <Reference value={row.subjectReference} to={row.subjectLinkPath ?? null} />
          )}
          <span className="tiq-cell-sub">
            {t('approvals.detail.version', { version: row.subjectVersion })}
          </span>
        </>
      ),
    },
    {
      id: 'organization',
      header: t('approvals.list.col.organization'),
      cell: (row) => row.organization.tenantName,
    },
    {
      id: 'amount',
      header: t('approvals.list.col.amount'),
      sortable: true,
      numeric: true,
      cell: (row) => <MoneyText value={row.amount} />,
    },
    {
      id: 'requestedAt',
      header: t('approvals.list.col.requested'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatInstantDate(row.requestedAt, timeZone)}</span>
          <span className="tiq-cell-sub">
            {t('approvals.list.requestedBy', { name: row.requestedBy.fullName })}
          </span>
        </>
      ),
    },
    {
      id: 'dueAt',
      header: t('approvals.list.col.dueZone', { zone: timeZone }),
      sortable: true,
      cell: (row) =>
        row.dueAt === null ? (
          <span className="tiq-text-muted">{t('approvals.list.noDue')}</span>
        ) : (
          <span className="tiq-inline">
            <span className={row.isOverdue ? 'tiq-text-danger' : undefined}>
              {formatDateTime(row.dueAt, timeZone)}
            </span>
            {row.isOverdue && <OverdueChip />}
          </span>
        ),
    },
    {
      id: 'step',
      header: t('approvals.list.col.step'),
      cell: (row) => {
        const step = row.currentStep;
        if (step === null)
          return <span className="tiq-text-muted">{t('approvals.list.noStep')}</span>;
        if (step.committee !== null) {
          return t('approvals.list.stepCommittee', {
            sequence: step.sequence,
            name: step.committee.name,
          });
        }
        return t('approvals.list.stepLine', {
          sequence: step.sequence,
          name: step.approver?.fullName ?? '—',
        });
      },
    },
    {
      id: 'status',
      header: t('approvals.list.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="approval_requests.status" value={row.status} size="sm" />,
    },
    {
      id: 'mine',
      header: t('approvals.list.col.mine'),
      cell: (row) => <MyPart row={row} />,
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader title={t('tasks.inbox.title')} subtitle={t('tasks.inbox.intro')} />
      <InboxTabs
        taskCount={summary.data?.open}
        approvalCount={overview.data === undefined ? undefined : awaitingCount}
      />
      <FilterBar label={t('approvals.list.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('approvals.list.search')}
          placeholder={t('approvals.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
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
          onChange={(status) => setFilters({ status, page: 1 })}
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
        <Select
          label={t('approvals.list.involvement')}
          placeholder={t('approvals.list.anyInvolvement')}
          value={filters.involvement}
          options={APPROVAL_INVOLVEMENTS.map((value) => ({
            value,
            label: t(`approvals.involvement.${value}`),
          }))}
          onChange={(involvement) => setFilters({ involvement, page: 1 })}
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
          label={t('approvals.list.awaitingMine')}
          checked={filters.awaiting}
          onChange={(awaiting) => setFilters({ awaiting, page: 1 })}
        />
        <Checkbox
          label={t('approvals.list.overdueOnly')}
          checked={filters.overdue}
          onChange={(overdue) => setFilters({ overdue, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('approvals.kpi.awaiting')}
          icon="checkSquare"
          value={kpi((rows) => rows.filter((row) => row.myStep?.canDecide === true).length)}
          hint={t('approvals.kpi.awaitingHint')}
        />
        <KpiCard
          label={t('approvals.kpi.blocked')}
          icon="lock"
          tone="warning"
          value={kpi((rows) => rows.filter(isBlockedForMe).length)}
          hint={t('approvals.kpi.blockedHint')}
        />
        <KpiCard
          label={t('approvals.kpi.overdue')}
          icon="alertTriangle"
          tone="danger"
          value={kpi((rows) => rows.filter((row) => row.isOverdue).length)}
          hint={t('approvals.kpi.overdueHint')}
        />
        <KpiCard
          label={t('approvals.kpi.invalidated')}
          icon="refresh"
          tone="info"
          value={kpi(
            (rows) =>
              rows.filter((row) => row.status === 'invalidated' || row.status === 'returned')
                .length,
          )}
          hint={t('approvals.kpi.invalidatedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('approvals.list.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.title}
          onRowClick={(row) => void navigate(INBOX_PATHS.approval(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: sortField(filters.sort), dir: directionOf(filters.dir) }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="checkCircle"
              title={filtered ? t('approvals.list.emptyFiltered') : t('approvals.list.empty')}
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
