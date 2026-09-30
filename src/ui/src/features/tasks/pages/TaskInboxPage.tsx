/**
 * COM-04 — Task and approval inbox (tasks view): the caller's assigned tasks in every active organization, with
 * source record, owner, due date, urgency, delegation and overdue status. Open, complete, return or reassign
 * within authority; each action runs in the task's organization (DD-21). The cross-organization counts come from
 * `/me/task-summary`.
 */
import { useState } from 'react';

import { TASKS_PRIORITY, TASKS_STATUS, TASKS_TASK_TYPE } from '@contracts/enums';
import type { TasksStatus } from '@contracts/enums';
import { getMyTaskSummary, listMyTasks, TASK_SORT_FIELDS } from '@contracts/tasks';
import type { TaskAction, TaskDetail, TaskItem } from '@contracts/tasks';

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
  IconButton,
  KpiCard,
  KpiGrid,
  Menu,
  OverdueChip,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn, IconName } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { InboxTabs } from '../components/InboxTabs';
import { TaskActionDialog } from '../components/TaskActionDialog';
import { TaskDetailDialog } from '../components/TaskDetailDialog';
import { sourceTypeLabel } from '../lib/labels';
import {
  compact,
  directionOf,
  positiveId,
  triState,
  useDisplayTimeZone,
  useOrganizationOptions,
} from '../lib/shared';

type SortField = (typeof TASK_SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  tenant: '',
  status: '',
  taskType: '',
  priority: '',
  sourceType: '',
  dueFrom: '',
  dueTo: '',
  overdue: false,
  delegated: '',
  group: '',
  sort: 'dueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

const OPEN_WORK: TasksStatus[] = ['open', 'in_progress'];

const ACTION_ICON: Readonly<Record<TaskAction, IconName>> = {
  complete: 'check',
  return: 'arrowLeft',
  reassign: 'users',
};

function sortField(value: string): SortField {
  return (TASK_SORT_FIELDS as readonly string[]).includes(value) ? (value as SortField) : 'dueAt';
}

function statusFilter(value: string): TasksStatus[] | undefined {
  if (value === '') return OPEN_WORK;
  if (value === 'all') return undefined;
  return (TASKS_STATUS as readonly string[]).includes(value) ? [value as TasksStatus] : OPEN_WORK;
}

export default function TaskInboxPage() {
  const timeZone = useDisplayTimeZone();
  const organizations = useOrganizationOptions();
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-04', DEFAULTS);
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [action, setAction] = useState<{ task: TaskItem; action: TaskAction } | null>(null);
  const [results, setResults] = useState<ReadonlyMap<number, TaskDetail>>(new Map());

  const summary = useApiQuery(getMyTaskSummary, {});
  const sources = useApiQuery(listMyTasks, { query: { pageSize: 100, status: [...TASKS_STATUS] } });
  const query = useApiQuery(listMyTasks, {
    query: compact({
      q: filters.q.trim(),
      tenantId: positiveId(filters.tenant),
      status: statusFilter(filters.status),
      taskType: (TASKS_TASK_TYPE as readonly string[]).includes(filters.taskType)
        ? [filters.taskType as TaskItem['taskType']]
        : undefined,
      priority: (TASKS_PRIORITY as readonly string[]).includes(filters.priority)
        ? [filters.priority as TaskItem['priority']]
        : undefined,
      sourceType: /^[a-z][a-z0-9_]{1,62}$/.test(filters.sourceType)
        ? [filters.sourceType]
        : undefined,
      dueFrom: filters.dueFrom,
      dueTo: filters.dueTo,
      overdue: filters.overdue ? true : undefined,
      delegated: triState(filters.delegated),
      groupAssigned: triState(filters.group),
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const filtered =
    filters.overdue ||
    [
      filters.q,
      filters.tenant,
      filters.status,
      filters.taskType,
      filters.priority,
      filters.sourceType,
      filters.dueFrom,
      filters.dueTo,
      filters.delegated,
      filters.group,
    ].some((value) => value !== '');

  const sourceTypes = [...new Set((sources.data?.items ?? []).map((row) => row.sourceType))].sort();
  const rows = query.data?.items.map((row) => results.get(row.id) ?? row);
  const done = (result: TaskDetail): void => {
    setResults((previous) => new Map(previous).set(result.id, result));
    setAction(null);
  };

  const columns: DataTableColumn<TaskItem>[] = [
    {
      id: 'title',
      header: t('tasks.list.col.task'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('tasks.task_type', row.taskType)}
            {row.delegatedFrom !== null &&
              ` · ${t('tasks.list.delegatedFrom', { name: row.delegatedFrom.fullName })}`}
          </span>
        </>
      ),
    },
    {
      id: 'source',
      header: t('tasks.list.col.source'),
      cell: (row) => (
        <>
          {row.sourceReference === null ? (
            <span>{sourceTypeLabel(row.sourceType)}</span>
          ) : (
            <Reference value={row.sourceReference} to={row.sourceLinkPath} />
          )}
          <span className="tiq-cell-sub">{sourceTypeLabel(row.sourceType)}</span>
        </>
      ),
    },
    {
      id: 'organization',
      header: t('tasks.list.col.organization'),
      cell: (row) => row.organization.tenantName,
    },
    {
      id: 'owner',
      header: t('tasks.list.col.owner'),
      cell: (row) => (
        <>
          <span>
            {row.assigneeGroup !== null
              ? t('tasks.list.groupLine', { name: row.assigneeGroup.name })
              : (row.assignee?.fullName ?? '—')}
          </span>
          {row.sourceOwner !== undefined && row.sourceOwner !== null && (
            <span className="tiq-cell-sub">
              {t('tasks.list.ownerLine', { name: row.sourceOwner.fullName })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'dueAt',
      header: t('tasks.list.col.dueZone', { zone: timeZone }),
      sortable: true,
      cell: (row) =>
        row.dueAt === null ? (
          <span className="tiq-text-muted">{t('tasks.list.noDue')}</span>
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
      id: 'priority',
      header: t('tasks.list.col.priority'),
      sortable: true,
      cell: (row) => <StatusChip enum="tasks.priority" value={row.priority} size="sm" />,
    },
    {
      id: 'status',
      header: t('tasks.list.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="tasks.status" value={row.status} size="sm" />,
    },
    {
      id: 'actions',
      header: t('tasks.list.col.actions'),
      accessibleHeader: t('tasks.list.col.actions'),
      cell: (row) => (
        <Menu
          label={t('tasks.list.rowActions', { title: row.title })}
          entries={[
            {
              id: 'details',
              label: t('tasks.list.details'),
              icon: 'info',
              onSelect: () => setSelected(row),
            },
            ...(row.sourceLinkPath === null
              ? []
              : [
                  {
                    kind: 'link' as const,
                    id: 'source',
                    label: t('tasks.list.openSource'),
                    icon: 'externalLink' as const,
                    to: row.sourceLinkPath,
                  },
                ]),
            ...row.allowedActions.map((next) => ({
              id: next,
              label: t(`tasks.action.${next}`),
              icon: ACTION_ICON[next],
              onSelect: () => setAction({ task: row, action: next }),
            })),
          ]}
          trigger={(props) => (
            <IconButton
              icon="moreHorizontal"
              variant="ghost"
              size="sm"
              label={t('tasks.list.rowActions', { title: row.title })}
              {...props}
            />
          )}
        />
      ),
    },
  ];

  const summaryData = summary.data;
  const organizationsWithWork = (summaryData?.byOrganization ?? []).filter((org) => org.open > 0);

  return (
    <div className="tiq-page">
      <PageHeader title={t('tasks.inbox.title')} subtitle={t('tasks.inbox.intro')} />
      <InboxTabs taskCount={summaryData?.open} />
      <FilterBar label={t('tasks.list.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('tasks.list.search')}
          placeholder={t('tasks.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('tasks.list.organization')}
          placeholder={t('tasks.list.allOrganizations')}
          value={filters.tenant}
          options={organizations}
          onChange={(tenant) => setFilters({ tenant, page: 1 })}
        />
        <Select
          label={t('tasks.list.status')}
          placeholder={t('tasks.list.openWork')}
          value={filters.status}
          options={[
            { value: 'all', label: t('tasks.list.allStatuses') },
            ...TASKS_STATUS.map((value) => ({ value, label: tEnum('tasks.status', value) })),
          ]}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('tasks.list.type')}
          placeholder={t('tasks.list.allTypes')}
          value={filters.taskType}
          options={TASKS_TASK_TYPE.map((value) => ({
            value,
            label: tEnum('tasks.task_type', value),
          }))}
          onChange={(taskType) => setFilters({ taskType, page: 1 })}
        />
        <Select
          label={t('tasks.list.priority')}
          placeholder={t('tasks.list.allPriorities')}
          value={filters.priority}
          options={TASKS_PRIORITY.map((value) => ({
            value,
            label: tEnum('tasks.priority', value),
          }))}
          onChange={(priority) => setFilters({ priority, page: 1 })}
        />
        <Select
          label={t('tasks.list.source')}
          placeholder={t('tasks.list.allSources')}
          value={filters.sourceType}
          options={sourceTypes.map((value) => ({ value, label: sourceTypeLabel(value) }))}
          onChange={(sourceType) => setFilters({ sourceType, page: 1 })}
        />
        <Select
          label={t('tasks.list.assignment')}
          placeholder={t('tasks.list.anyAssignment')}
          value={filters.group}
          options={[
            { value: 'false', label: t('tasks.list.personal') },
            { value: 'true', label: t('tasks.list.group') },
          ]}
          onChange={(group) => setFilters({ group, page: 1 })}
        />
        <Select
          label={t('tasks.list.delegation')}
          placeholder={t('tasks.list.anyDelegation')}
          value={filters.delegated}
          options={[
            { value: 'true', label: t('tasks.list.delegatedOnly') },
            { value: 'false', label: t('tasks.list.directOnly') },
          ]}
          onChange={(delegated) => setFilters({ delegated, page: 1 })}
        />
        <DateInput
          label={t('tasks.list.dueFrom')}
          value={filters.dueFrom}
          onChange={(dueFrom) => setFilters({ dueFrom, page: 1 })}
        />
        <DateInput
          label={t('tasks.list.dueTo')}
          value={filters.dueTo}
          onChange={(dueTo) => setFilters({ dueTo, page: 1 })}
        />
        <Checkbox
          label={t('tasks.list.overdueOnly')}
          checked={filters.overdue}
          onChange={(overdue) => setFilters({ overdue, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('tasks.kpi.open')}
          icon="inbox"
          value={summaryData === undefined ? '…' : formatCount(summaryData.open)}
          hint={t('tasks.kpi.openHint')}
        />
        <KpiCard
          label={t('tasks.kpi.overdue')}
          icon="alertTriangle"
          tone="danger"
          value={summaryData === undefined ? '…' : formatCount(summaryData.overdue)}
          hint={t('tasks.kpi.overdueHint')}
        />
        <KpiCard
          label={t('tasks.kpi.dueSoon')}
          icon="hourglass"
          tone="warning"
          value={summaryData === undefined ? '…' : formatCount(summaryData.dueSoon)}
          hint={t('tasks.kpi.dueSoonHint')}
        />
        <KpiCard
          label={t('tasks.kpi.organizations')}
          icon="building"
          tone="info"
          value={summaryData === undefined ? '…' : formatCount(organizationsWithWork.length)}
          hint={
            summaryData === undefined ? undefined : (
              <span className="tiq-inline">
                {organizationsWithWork.map((org) => (
                  <Chip key={org.tenantId} tone={org.overdue > 0 ? 'danger' : 'neutral'} size="sm">
                    {`${org.tenantName}: ${formatCount(org.open)}`}
                  </Chip>
                ))}
                {organizationsWithWork.length === 0 &&
                  t('tasks.kpi.organizationsHint', { count: 0 })}
              </span>
            )
          }
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('tasks.list.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.title}
          onRowClick={(row) => setSelected(row)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: sortField(filters.sort), dir: directionOf(filters.dir) }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="checkCircle"
              title={filtered ? t('tasks.list.emptyFiltered') : t('tasks.list.empty')}
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
      {selected !== null && action === null && (
        <TaskDetailDialog
          task={results.get(selected.id) ?? selected}
          result={results.get(selected.id) ?? null}
          onClose={() => setSelected(null)}
          onAction={(next) =>
            setAction({ task: results.get(selected.id) ?? selected, action: next })
          }
        />
      )}
      {action !== null && (
        <TaskActionDialog
          task={action.task}
          action={action.action}
          onClose={() => setAction(null)}
          onDone={done}
        />
      )}
    </div>
  );
}
