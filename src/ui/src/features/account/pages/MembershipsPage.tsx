/**
 * COM-02 — My organizations and capacities (beyond the shell picker; BR-02, DD-21, AC-02): every membership with
 * its organization, capacity, roles and status, the current context, and pending memberships with an explanation
 * that never exposes the other organization's data. Enter an organization, withdraw a pending request or decline
 * an invitation, or leave an organization (past actions stay attributed). A person who belongs to both a buyer and
 * a supplier is told that the current capacity is always shown and conflicts are routed for review.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { MEMBERSHIPS_STATUS, TENANTS_KIND } from '@contracts/enums';
import { MY_MEMBERSHIP_SORTS, orgAdminEndpoints } from '@contracts/org-admin';
import type { MyMembership } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useAppDispatch, useScreenFilters } from '../../../app/hooks';
import { AREA_ROOTS, TENANT_KIND_AREA } from '../../../app/featureTypes';
import { selectTenant } from '../../../app/sessionActions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { dialogError } from '../../admin-access/lib/errors';
import {
  compact,
  directionOf,
  isFiltered,
  oneOf,
  pagingOf,
  sortOf,
  tableSort,
} from '../../admin-access/lib/lists';

const DEFAULTS = {
  q: '',
  status: '',
  kind: '',
  sort: 'organization',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

type Open = { readonly kind: 'withdraw' | 'leave'; readonly row: MyMembership };

function dateOf(row: MyMembership, timeZone: string): string {
  if (row.endedAt !== null)
    return t('account.memberships.endedOn', { date: formatInstantDate(row.endedAt, timeZone) });
  if (row.joinedAt !== null)
    return t('account.memberships.joinedOn', { date: formatInstantDate(row.joinedAt, timeZone) });
  if (row.requestedAt !== null)
    return t('account.memberships.requestedOn', {
      date: formatInstantDate(row.requestedAt, timeZone),
    });
  return '—';
}

export default function MembershipsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const active = useActiveTenant();
  const timeZone = active?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-02:memberships', DEFAULTS);
  const [open, setOpen] = useState<Open | null>(null);
  const [results, setResults] = useState<Readonly<Record<number, MyMembership>>>({});
  const [entering, setEntering] = useState<number | null>(null);
  const withdraw = useApiMutation(orgAdminEndpoints.withdrawMembershipRequest);
  const leave = useApiMutation(orgAdminEndpoints.leaveMembership);
  const query = useApiQuery(orgAdminEndpoints.listMyMemberships, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, MEMBERSHIPS_STATUS),
      kind: oneOf(filters.kind, TENANTS_KIND),
      sort: sortOf(filters.sort, MY_MEMBERSHIP_SORTS, 'organization'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const summary = query.data?.summary;
  const rows = (query.data?.items ?? []).map((row) => results[row.membershipId] ?? row);
  const filtered = isFiltered(filters);
  const kpi = (value: number | undefined): string =>
    value === undefined ? '…' : formatCount(value);

  const enter = async (row: MyMembership): Promise<void> => {
    setEntering(row.membershipId);
    const ok = await dispatch(selectTenant(row.organization.tenantId));
    setEntering(null);
    if (ok) void navigate(AREA_ROOTS[TENANT_KIND_AREA[row.organization.tenantKind]]);
  };

  const close = (): void => {
    setOpen(null);
    withdraw.reset();
    leave.reset();
  };

  const columns: DataTableColumn<MyMembership>[] = [
    {
      id: 'organization',
      header: t('account.memberships.col.organization'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.organization.tenantName}</span>
          <span className="tiq-cell-sub">
            {t(`account.kind.${row.organization.tenantKind}`)}
            {active?.tenantId === row.organization.tenantId &&
              ` · ${t('account.memberships.current')}`}
          </span>
        </>
      ),
    },
    {
      id: 'capacity',
      header: t('account.memberships.col.capacity'),
      cell: (row) => (
        <>
          <span>{row.capacity ?? '—'}</span>
          <span className="tiq-cell-sub">{row.roleNames.join(', ')}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('account.memberships.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="memberships.status" value={row.status} size="sm" />
          {row.explanation !== null && <span className="tiq-cell-sub">{row.explanation}</span>}
        </>
      ),
    },
    {
      id: 'joinedAt',
      header: t('account.memberships.col.date'),
      sortable: true,
      cell: (row) => dateOf(row, timeZone),
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) => {
        const current = active?.tenantId === row.organization.tenantId;
        const buttons = [
          row.status === 'active' && !current ? (
            <Button
              key="enter"
              size="sm"
              loading={entering === row.membershipId}
              onClick={() => void enter(row)}
            >
              {t('account.memberships.enter')}
            </Button>
          ) : null,
          row.canWithdraw ? (
            <Button key="withdraw" size="sm" onClick={() => setOpen({ kind: 'withdraw', row })}>
              {row.status === 'invited'
                ? t('account.memberships.decline')
                : t('account.memberships.withdraw')}
            </Button>
          ) : null,
          row.canLeave ? (
            <Button
              key="leave"
              size="sm"
              variant="danger-soft"
              onClick={() => setOpen({ kind: 'leave', row })}
            >
              {t('account.memberships.leave')}
            </Button>
          ) : null,
        ].filter((item) => item !== null);
        return buttons.length === 0 ? '—' : <div className="tiq-row-actions">{buttons}</div>;
      },
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('account.memberships.title')}
        subtitle={t('account.memberships.intro')}
        primaryAction={
          <ButtonLink to="/select-organization" variant="primary" icon="switchOrg">
            {t('account.memberships.switch')}
          </ButtonLink>
        }
      />
      <Card title={t('account.memberships.currentTitle')}>
        <DetailList
          items={[
            {
              key: 'org',
              label: t('account.memberships.col.organization'),
              value:
                active === null
                  ? t('account.memberships.none')
                  : `${active.name} (${t(`account.kind.${active.kind}`)})`,
            },
            {
              key: 'capacity',
              label: t('account.memberships.col.capacity'),
              value: active?.capacity,
            },
            {
              key: 'access',
              label: t('account.memberships.access'),
              value: active === null ? null : t(`account.memberships.accessKind.${active.access}`),
            },
            {
              key: 'zone',
              label: t('account.memberships.officialZone'),
              value: active?.officialTimeZone,
            },
          ]}
        />
      </Card>
      {summary?.holdsBuyerAndSupplierMemberships === true && (
        <Banner tone="info" title={t('account.memberships.dualTitle')}>
          <p>{t('account.memberships.dualBody')}</p>
        </Banner>
      )}
      <FilterBar
        label={t('account.memberships.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('account.memberships.search')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('account.memberships.col.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.status}
          options={MEMBERSHIPS_STATUS.map((value) => ({
            value,
            label: tEnum('memberships.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('account.memberships.kindFilter')}
          placeholder={t('admin-access.common.all')}
          value={filters.kind}
          options={TENANTS_KIND.map((value) => ({ value, label: t(`account.kind.${value}`) }))}
          onChange={(kind) => setFilters({ kind, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('account.memberships.kpi.active')}
          icon="checkCircle"
          tone="success"
          value={kpi(summary?.active)}
          hint={t('account.memberships.kpi.activeHint')}
        />
        <KpiCard
          label={t('account.memberships.kpi.pending')}
          icon="hourglass"
          tone="info"
          value={kpi(summary?.pending)}
          hint={t('account.memberships.kpi.pendingHint')}
        />
        <KpiCard
          label={t('account.memberships.kpi.ended')}
          icon="pause"
          tone="warning"
          value={kpi(summary?.suspendedOrEnded)}
          hint={t('account.memberships.kpi.endedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('account.memberships.caption')}
          columns={columns}
          rows={query.data === undefined ? undefined : rows}
          rowKey={(row) => String(row.membershipId)}
          rowLabel={(row) => row.organization.tenantName}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('account.memberships.emptyFiltered') : t('account.memberships.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {open?.kind === 'withdraw' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={
            open.row.status === 'invited'
              ? t('account.memberships.declineTitle')
              : t('account.memberships.withdrawTitle')
          }
          organization={{ name: open.row.organization.tenantName, capacity: open.row.capacity }}
          scope={t('account.memberships.scope', { organization: open.row.organization.tenantName })}
          consequence={t('account.memberships.withdrawConsequence')}
          confirmLabel={
            open.row.status === 'invited'
              ? t('account.memberships.decline')
              : t('account.memberships.withdraw')
          }
          reason={{ label: t('account.memberships.optionalReason'), required: false }}
          pending={withdraw.pending}
          error={dialogError(withdraw.error, [])}
          onCancel={close}
          onConfirm={async ({ reason }) => {
            try {
              const row = await withdraw.mutate({
                params: { membershipId: open.row.membershipId },
                body: reason === '' ? {} : { reason },
              });
              setResults({ ...results, [row.membershipId]: row });
              close();
              toast.show(t('account.memberships.withdrawn'), 'success');
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
      {open?.kind === 'leave' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('account.memberships.leaveTitle')}
          organization={{ name: open.row.organization.tenantName, capacity: open.row.capacity }}
          scope={t('account.memberships.scope', { organization: open.row.organization.tenantName })}
          consequence={t('account.memberships.leaveConsequence')}
          confirmLabel={t('account.memberships.leave')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          acknowledgement={t('account.memberships.historyRetained')}
          pending={leave.pending}
          error={dialogError(leave.error, [])}
          onCancel={close}
          onConfirm={async ({ reason }) => {
            try {
              const row = await leave.mutate({
                params: { membershipId: open.row.membershipId },
                body: { reason, confirmHistoryRetained: true },
              });
              setResults({ ...results, [row.membershipId]: row });
              close();
              toast.show(t('account.memberships.left'), 'success');
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </div>
  );
}
