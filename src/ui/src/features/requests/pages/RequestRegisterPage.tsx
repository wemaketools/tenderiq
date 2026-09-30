/**
 * BUY-02 Request register. Required information: requests, requester, purpose, estimate, funding, priority, status
 * and age. Principal actions: create, assign, group (combine), filter, defer or route a request, preserving
 * ownership and history (FR-04, PRD §8.1).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { RequestAction, RequestRow } from '@contracts/requests';
import type {
  ProcurementRequestsFundingStatus,
  ProcurementRequestsPriority,
  ProcurementRequestsStatus,
} from '@contracts/enums';

import { useApiQuery, invalidateApiQueries } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission, usePermissions } from '../../../auth/permissions';
import {
  ButtonLink,
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
  MoneyText,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableSort, MenuEntry } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatMoney } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { RequestActionDialog } from '../components/RequestActionDialog';
import type { RequestDialogKind } from '../components/RequestActionDialog';
import { enumOptions, requestPaths, rowActions } from '../lib';

const DEFAULT_FILTERS = {
  q: '',
  status: '',
  priority: '',
  funding: '',
  owner: '',
  mine: false,
  from: '',
  to: '',
  page: 1,
  sort: 'submittedAt',
  dir: 'desc',
};

type SortField =
  | 'reference'
  | 'title'
  | 'submittedAt'
  | 'estimatedValue'
  | 'priority'
  | 'status'
  | 'targetDate'
  | 'ageDays';

const ACTION_ICONS: Record<
  string,
  'userPlus' | 'pause' | 'link' | 'layers' | 'refresh' | 'archive'
> = {
  assign: 'userPlus',
  defer: 'pause',
  route_to_contract: 'link',
  combine: 'layers',
  reconsider: 'refresh',
  close: 'archive',
};

/** One line of purpose in the register; the full text is on the request page. */
function shorten(text: string): string {
  return text.length <= 70 ? text : `${text.slice(0, 67).trimEnd()}…`;
}

export default function RequestRegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const permissions: readonly string[] = usePermissions();
  const canCreate = usePermission('request.create');
  const canReview = usePermission('request.review');
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-02', DEFAULT_FILTERS);
  const [dialog, setDialog] = useState<{ kind: RequestDialogKind; row: RequestRow } | null>(null);

  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const summary = useApiQuery(requestEndpoints.getRequestSummary, {});
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.status === '' ? {} : { status: [filters.status as ProcurementRequestsStatus] }),
    ...(filters.priority === ''
      ? {}
      : { priority: [filters.priority as ProcurementRequestsPriority] }),
    ...(filters.funding === ''
      ? {}
      : { fundingStatus: [filters.funding as ProcurementRequestsFundingStatus] }),
    ...(filters.owner === 'unassigned' ? { unassigned: true } : {}),
    ...(filters.owner !== '' && filters.owner !== 'unassigned'
      ? { ownerUserId: Number(filters.owner) }
      : {}),
    ...(filters.mine ? { mine: true } : {}),
    ...(filters.from === '' ? {} : { submittedFrom: filters.from }),
    ...(filters.to === '' ? {} : { submittedTo: filters.to }),
  };
  const requests = useApiQuery(requestEndpoints.listRequests, { query });

  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.priority !== '' ||
    filters.funding !== '' ||
    filters.owner !== '' ||
    filters.mine ||
    filters.from !== '' ||
    filters.to !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };
  const owners = (options.data?.people ?? []).filter((person) => person.roles.includes('owner'));
  const openValue = summary.data?.openEstimatedValue ?? [];
  const summaryValue = (pick: (data: NonNullable<typeof summary.data>) => number) =>
    summary.data === undefined ? null : formatCount(pick(summary.data));

  const menuEntries = (row: RequestRow): MenuEntry[] => {
    const actions: RequestAction[] = rowActions(row.status, permissions);
    return [
      {
        kind: 'link',
        id: 'open',
        label: t('requests.register.actions.open'),
        icon: 'eye',
        to: requestPaths.request(row.id),
      },
      ...(canReview || permissions.includes('request.approve')
        ? [
            {
              kind: 'link' as const,
              id: 'decision',
              label: t('requests.register.actions.decision'),
              icon: 'gavel' as const,
              to: requestPaths.decision(row.id),
            },
          ]
        : []),
      ...actions.map((action) => ({
        id: action,
        label: t(`requests.actions.${action}`),
        icon: ACTION_ICONS[action],
        danger: action === 'close',
        onSelect: () => setDialog({ kind: action as RequestDialogKind, row }),
      })),
    ];
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('requests.register.title')}
        subtitle={t('requests.register.subtitle')}
        primaryAction={
          canCreate ? (
            <ButtonLink to={requestPaths.create} variant="primary" icon="plus">
              {t('requests.register.new')}
            </ButtonLink>
          ) : undefined
        }
      />

      <FilterBar onClear={clearFilters} canClear={canClear} label={t('requests.register.filters')}>
        <SearchField
          label={t('requests.filters.search')}
          placeholder={t('requests.register.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('requests.filters.status')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          placeholder={t('requests.filters.allStatuses')}
          options={enumOptions('procurement_requests.status')}
        />
        <Select
          label={t('requests.filters.priority')}
          value={filters.priority}
          onChange={(value) => update({ priority: value })}
          placeholder={t('requests.filters.allPriorities')}
          options={enumOptions('procurement_requests.priority')}
        />
        <Select
          label={t('requests.filters.funding')}
          value={filters.funding}
          onChange={(value) => update({ funding: value })}
          placeholder={t('requests.filters.allFunding')}
          options={enumOptions('procurement_requests.funding_status')}
        />
        <Select
          label={t('requests.filters.owner')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          placeholder={t('requests.filters.allOwners')}
          options={[
            { value: 'unassigned', label: t('requests.common.unassigned') },
            ...owners.map((owner) => ({ value: String(owner.userId), label: owner.fullName })),
          ]}
        />
        <DateInput
          label={t('requests.filters.submittedFrom')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('requests.filters.submittedTo')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
        <Checkbox
          label={t('requests.filters.mine')}
          checked={filters.mine}
          onChange={(checked) => update({ mine: checked })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('requests.register.kpi.open')}
          icon="inbox"
          value={summaryValue((data) => data.openCount)}
          hint={
            openValue.length === 0
              ? t('requests.register.kpi.openHint')
              : openValue.map((money) => formatMoney(money, { compact: true })).join(' · ')
          }
        />
        <KpiCard
          label={t('requests.register.kpi.unassigned')}
          icon="userPlus"
          tone="warning"
          value={summaryValue((data) => data.unassignedCount)}
          hint={t('requests.register.kpi.unassignedHint')}
        />
        <KpiCard
          label={t('requests.register.kpi.awaitingDecision')}
          icon="gavel"
          tone="info"
          value={summaryValue((data) => data.awaitingMyDecisionCount)}
          hint={t('requests.register.kpi.awaitingDecisionHint')}
        />
        <KpiCard
          label={t('requests.register.kpi.reapproval')}
          icon="alertTriangle"
          tone="danger"
          value={summaryValue((data) => data.reapprovalRequiredCount)}
          hint={t('requests.register.kpi.reapprovalHint', {
            count: summary.data?.openInfoRequestCount ?? 0,
          })}
        />
      </KpiGrid>

      {summary.data !== undefined && (
        <div className="tiq-inline" role="group" aria-label={t('requests.register.byStatus')}>
          {summary.data.byStatus
            .filter((entry) => entry.count > 0)
            .map((entry) => (
              <button
                key={entry.status}
                type="button"
                className="tiq-btn tiq-btn--ghost tiq-btn--sm"
                aria-pressed={filters.status === entry.status}
                onClick={() =>
                  update({ status: filters.status === entry.status ? '' : entry.status })
                }
              >
                <StatusChip enum="procurement_requests.status" value={entry.status} size="sm" />
                <span className="tiq-count tiq-count--muted">{entry.count}</span>
              </button>
            ))}
        </div>
      )}

      <Card flush title={t('requests.register.table')}>
        <DataTable<RequestRow>
          caption={t('requests.register.table')}
          rows={requests.data?.items}
          rowKey={(row) => String(row.id)}
          loading={requests.isFetching}
          error={requests.error}
          onRetry={requests.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(requestPaths.request(row.id))}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          empty={
            <EmptyState
              compact
              icon="inbox"
              title={t('requests.register.empty')}
              description={
                canClear ? t('requests.register.emptyFiltered') : t('requests.register.emptyHint')
              }
            />
          }
          pagination={
            requests.data === undefined
              ? undefined
              : {
                  page: requests.data.page,
                  pageSize: requests.data.pageSize,
                  total: requests.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'reference',
              header: t('requests.register.col.request'),
              sortable: true,
              width: '30%',
              cell: (row) => (
                <>
                  <Reference value={row.reference} to={requestPaths.request(row.id)} />
                  <div>{row.title}</div>
                  {row.problemStatement !== null && (
                    <div className="tiq-cell-sub" title={row.problemStatement}>
                      {shorten(row.problemStatement)}
                    </div>
                  )}
                </>
              ),
            },
            {
              id: 'requester',
              header: t('requests.register.col.requester'),
              cell: (row) => (
                <>
                  {row.requester.fullName}
                  {row.department !== null && (
                    <div className="tiq-cell-sub">{row.department.name}</div>
                  )}
                </>
              ),
            },
            {
              id: 'owner',
              header: t('requests.register.col.owner'),
              cell: (row) =>
                row.owner === null ? (
                  <span className="tiq-text-warning">{t('requests.common.unassigned')}</span>
                ) : (
                  row.owner.fullName
                ),
            },
            {
              id: 'estimatedValue',
              header: t('requests.register.col.estimate'),
              sortable: true,
              numeric: true,
              cell: (row) => (
                <>
                  <MoneyText value={row.estimatedValue} />
                  {row.estimatedTotalCommitment !== null && (
                    <div className="tiq-cell-sub">
                      {t('requests.register.totalCommitment', {
                        value: formatMoney(row.estimatedTotalCommitment),
                      })}
                    </div>
                  )}
                </>
              ),
            },
            {
              id: 'funding',
              header: t('requests.register.col.funding'),
              cell: (row) => (
                <StatusChip
                  enum="procurement_requests.funding_status"
                  value={row.fundingStatus}
                  size="sm"
                />
              ),
            },
            {
              id: 'priority',
              header: t('requests.register.col.priority'),
              sortable: true,
              cell: (row) => (
                <StatusChip enum="procurement_requests.priority" value={row.priority} size="sm" />
              ),
            },
            {
              id: 'status',
              header: t('requests.register.col.status'),
              sortable: true,
              cell: (row) => (
                <>
                  <StatusChip enum="procurement_requests.status" value={row.status} />
                  {row.reapprovalRequired && (
                    <div>
                      <Chip tone="danger" outlined size="sm">
                        {t('requests.common.reapprovalRequired')}
                      </Chip>
                    </div>
                  )}
                  {row.combinedInto !== null && (
                    <div className="tiq-cell-sub">
                      {t('requests.common.combinedInto', { reference: row.combinedInto.reference })}
                    </div>
                  )}
                  {row.deferredUntil !== null && (
                    <div className="tiq-cell-sub">
                      {t('requests.common.deferredUntil', {
                        date: formatCalendarDate(row.deferredUntil),
                      })}
                    </div>
                  )}
                </>
              ),
            },
            {
              id: 'ageDays',
              header: t('requests.register.col.age'),
              sortable: true,
              numeric: true,
              cell: (row) => (
                <>
                  {t('requests.common.days', { count: row.ageDays })}
                  <div className="tiq-cell-sub">
                    {row.submittedAt === null
                      ? t('requests.register.notSubmitted')
                      : formatCalendarDate(row.submittedAt.slice(0, 10))}
                  </div>
                  {row.targetDate !== null && (
                    <div className="tiq-cell-sub">
                      {t('requests.register.targetOn', {
                        date: formatCalendarDate(row.targetDate),
                      })}
                    </div>
                  )}
                </>
              ),
            },
            {
              id: 'actions',
              header: t('requests.register.col.actions'),
              accessibleHeader: t('requests.register.col.actions'),
              cell: (row) => (
                <Menu
                  label={t('requests.register.rowMenu', { reference: row.reference })}
                  entries={menuEntries(row)}
                  trigger={(props) => (
                    <IconButton
                      icon="moreHorizontal"
                      variant="ghost"
                      size="sm"
                      label={t('requests.register.rowMenu', { reference: row.reference })}
                      {...props}
                    />
                  )}
                />
              ),
            },
          ]}
        />
      </Card>

      {dialog !== null && (
        <RequestActionDialog
          kind={dialog.kind}
          request={dialog.row}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            toast.show(message, 'success');
            invalidateApiQueries('buyer.requests.');
          }}
        />
      )}
    </div>
  );
}
