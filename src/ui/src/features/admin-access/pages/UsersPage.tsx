/**
 * ADM-03 — User directory (buyers) and SUP-04 — Supplier users (suppliers): the same screen serves
 * `/buyer/admin/users` and `/supplier/admin/users`. Members with capacity, roles, groups, status, invitation state,
 * outstanding work and delegations (suppliers also see submission authority and signing limits, AC-03), and the
 * invitations register: invite, reissue an expired invitation without a new identity, or revoke (FR-03).
 */
import { useState } from 'react';

import { INVITATIONS_STATUS, MEMBERSHIPS_STATUS } from '@contracts/enums';
import { INVITATION_SORTS, MEMBER_SORTS } from '@contracts/org-admin';
import type { InvitationRow, MemberRow } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  NumberInput,
  OfficialDeadline,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
  Tabs,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { PersonCell, RoleChips } from '../components/AccessBits';
import { InviteMemberDialog } from '../components/InviteMemberDialog';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';
import {
  booleanFilter,
  compact,
  directionOf,
  idFilter,
  isFiltered,
  oneOf,
  pagingOf,
  sortOf,
  tableSort,
} from '../lib/lists';

const MEMBER_DEFAULTS = {
  q: '',
  status: '',
  roleId: '',
  groupId: '',
  hasOpenWork: '',
  joinedFrom: '',
  joinedTo: '',
  sort: 'fullName',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

const INVITATION_DEFAULTS = {
  q: '',
  status: '',
  createdFrom: '',
  createdTo: '',
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

function MembersTab() {
  const admin = useMemberAdmin();
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters(
    `${admin.usersScreen}:members`,
    MEMBER_DEFAULTS,
  );
  const query = useApiQuery(admin.endpoints.listMembers, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, MEMBERSHIPS_STATUS),
      roleId: idFilter(filters.roleId),
      groupId: idFilter(filters.groupId),
      hasOpenWork: booleanFilter(filters.hasOpenWork),
      joinedFrom: filters.joinedFrom,
      joinedTo: filters.joinedTo,
      sort: sortOf(filters.sort, MEMBER_SORTS, 'fullName'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(admin.endpoints.listMembers, { query: { pageSize: 100 } });
  const roles = useApiQuery(admin.endpoints.listRoles, { query: { pageSize: 100, sort: 'name' } });
  const groups = useApiQuery(admin.endpoints.listGroups, {
    query: { pageSize: 100, sort: 'name' },
  });
  const all = overview.data?.items ?? [];
  const loadingKpi = overview.data === undefined;
  const count = (rows: readonly MemberRow[]): string =>
    loadingKpi ? '…' : formatCount(rows.length);
  const filtered = isFiltered(filters);

  const columns: DataTableColumn<MemberRow>[] = [
    {
      id: 'fullName',
      header: t('admin-access.users.col.name'),
      sortable: true,
      cell: (row) => <PersonCell name={row.fullName} sub={row.email} />,
    },
    {
      id: 'capacity',
      header: t('admin-access.users.col.capacity'),
      cell: (row) => <PersonCell name={row.capacity ?? '—'} />,
    },
    {
      id: 'roles',
      header: t('admin-access.users.col.roles'),
      cell: (row) => (
        <>
          <RoleChips roles={row.roles} />
          {row.groups.length > 0 && (
            <span className="tiq-cell-sub">
              {t('admin-access.users.viaGroups', {
                groups: row.groups.map((group) => group.name).join(', '),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('admin-access.users.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="memberships.status" value={row.membershipStatus} size="sm" />
          {row.userStatus !== 'active' && row.userStatus !== 'invited' && (
            <span className="tiq-cell-sub">
              {t('admin-access.users.account', { status: tEnum('users.status', row.userStatus) })}
            </span>
          )}
          {row.invitation !== null && (
            <span className="tiq-cell-sub">
              {t('admin-access.users.invitation', {
                status: tEnum('invitations.status', row.invitation.status),
              })}
            </span>
          )}
        </>
      ),
    },
    ...(admin.kind === 'supplier'
      ? [
          {
            id: 'authority',
            header: t('admin-access.users.col.authority'),
            cell: (row: MemberRow) =>
              row.supplierAuthority === null ? (
                '—'
              ) : (
                <>
                  <span className="tiq-inline">
                    {row.supplierAuthority.canSubmit ? (
                      <Chip tone="success" size="sm">
                        {t('admin-access.authority.submit')}
                      </Chip>
                    ) : (
                      <Chip tone="neutral-outlined" size="sm">
                        {t('admin-access.authority.noSubmit')}
                      </Chip>
                    )}
                    {row.supplierAuthority.canApprove && (
                      <Chip tone="info" size="sm">
                        {t('admin-access.authority.approve')}
                      </Chip>
                    )}
                  </span>
                  {row.supplierAuthority.signingLimit !== null && (
                    <span className="tiq-cell-sub">
                      {t('admin-access.authority.limit')}{' '}
                      <MoneyText value={row.supplierAuthority.signingLimit} />
                    </span>
                  )}
                </>
              ),
          } satisfies DataTableColumn<MemberRow>,
        ]
      : []),
    {
      id: 'openWorkCount',
      header: t('admin-access.users.col.work'),
      sortable: true,
      numeric: true,
      cell: (row) => (
        <>
          <span>{formatCount(row.openWorkCount)}</span>
          {row.activeDelegationCount > 0 && (
            <span className="tiq-cell-sub">
              {t('admin-access.users.delegations', { count: row.activeDelegationCount })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'lastSeenAt',
      header: t('admin-access.users.col.lastSeen'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.lastSeenAt === null ? '—' : formatInstantDate(row.lastSeenAt, timeZone)}</span>
          {row.joinedAt !== null && (
            <span className="tiq-cell-sub">
              {t('admin-access.users.joinedOn', {
                date: formatInstantDate(row.joinedAt, timeZone),
              })}
            </span>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <FilterBar label={t('admin-access.users.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.users.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.users.filter.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.status}
          options={MEMBERSHIPS_STATUS.map((value) => ({
            value,
            label: tEnum('memberships.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('admin-access.users.filter.role')}
          placeholder={t('admin-access.users.filter.allRoles')}
          value={filters.roleId}
          options={(roles.data?.items ?? []).map((role) => ({
            value: String(role.roleId),
            label: role.name,
          }))}
          onChange={(roleId) => setFilters({ roleId, page: 1 })}
        />
        <Select
          label={t('admin-access.users.filter.group')}
          placeholder={t('admin-access.users.filter.allGroups')}
          value={filters.groupId}
          options={(groups.data?.items ?? []).map((group) => ({
            value: String(group.groupId),
            label: group.name,
          }))}
          onChange={(groupId) => setFilters({ groupId, page: 1 })}
        />
        <Select
          label={t('admin-access.users.filter.work')}
          placeholder={t('admin-access.common.all')}
          value={filters.hasOpenWork}
          options={[
            { value: 'true', label: t('admin-access.users.filter.withWork') },
            { value: 'false', label: t('admin-access.users.filter.withoutWork') },
          ]}
          onChange={(hasOpenWork) => setFilters({ hasOpenWork, page: 1 })}
        />
        <DateInput
          label={t('admin-access.users.filter.joinedFrom')}
          value={filters.joinedFrom}
          onChange={(joinedFrom) => setFilters({ joinedFrom, page: 1 })}
        />
        <DateInput
          label={t('admin-access.users.filter.joinedTo')}
          value={filters.joinedTo}
          onChange={(joinedTo) => setFilters({ joinedTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-access.users.kpi.active')}
          icon="userCheck"
          tone="success"
          restricted={overview.error?.kind === 'forbidden'}
          value={count(all.filter((row) => row.membershipStatus === 'active'))}
          hint={t('admin-access.users.kpi.activeHint')}
        />
        <KpiCard
          label={t('admin-access.users.kpi.pending')}
          icon="userPlus"
          tone="info"
          restricted={overview.error?.kind === 'forbidden'}
          value={count(
            all.filter(
              (row) =>
                row.membershipStatus === 'invited' || row.membershipStatus === 'pending_approval',
            ),
          )}
          hint={t('admin-access.users.kpi.pendingHint')}
        />
        <KpiCard
          label={t('admin-access.users.kpi.suspended')}
          icon="pause"
          tone="warning"
          restricted={overview.error?.kind === 'forbidden'}
          value={count(
            all.filter(
              (row) => row.membershipStatus === 'suspended' || row.membershipStatus === 'revoked',
            ),
          )}
          hint={t('admin-access.users.kpi.suspendedHint')}
        />
        <KpiCard
          label={t('admin-access.users.kpi.work')}
          icon="clipboardCheck"
          tone="danger"
          restricted={overview.error?.kind === 'forbidden'}
          value={count(
            all.filter((row) => row.openWorkCount > 0 && row.membershipStatus !== 'active'),
          )}
          hint={t('admin-access.users.kpi.workHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('admin-access.users.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.userId)}
          rowLabel={(row) => row.fullName}
          rowHref={(row) => admin.paths.user(row.userId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('admin-access.users.emptyFiltered') : t('admin-access.users.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
    </div>
  );
}

type InvitationCommand =
  | { readonly kind: 'reissue'; readonly row: InvitationRow }
  | { readonly kind: 'revoke'; readonly row: InvitationRow };

function InvitationsTab({ latest }: { readonly latest: InvitationRow | null }) {
  const admin = useMemberAdmin();
  const toast = useToast();
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters(
    `${admin.usersScreen}:invitations`,
    INVITATION_DEFAULTS,
  );
  const [command, setCommand] = useState<InvitationCommand | null>(null);
  const [days, setDays] = useState('14');
  const [results, setResults] = useState<Readonly<Record<number, InvitationRow>>>({});
  const reissue = useApiMutation(admin.endpoints.reissueInvitation);
  const revoke = useApiMutation(admin.endpoints.revokeInvitation);
  const query = useApiQuery(admin.endpoints.listInvitations, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, INVITATIONS_STATUS),
      createdFrom: filters.createdFrom,
      createdTo: filters.createdTo,
      sort: sortOf(filters.sort, INVITATION_SORTS, 'createdAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const filtered = isFiltered(filters);
  const rows = (query.data?.items ?? []).map((row) => results[row.invitationId] ?? row);
  const shown =
    latest !== null && !rows.some((row) => row.invitationId === latest.invitationId)
      ? [latest, ...rows]
      : rows;

  const close = (): void => {
    setCommand(null);
    reissue.reset();
    revoke.reset();
  };

  const columns: DataTableColumn<InvitationRow>[] = [
    {
      id: 'email',
      header: t('admin-access.invitations.col.person'),
      sortable: true,
      cell: (row) => <PersonCell name={row.fullName ?? row.email} sub={row.email} />,
    },
    {
      id: 'capacity',
      header: t('admin-access.invitations.col.capacity'),
      cell: (row) => (
        <>
          <span>{row.capacity ?? '—'}</span>
          <span className="tiq-cell-sub">{row.roles.map((role) => role.name).join(', ')}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('admin-access.invitations.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="invitations.status" value={row.status} size="sm" />
          {row.reissuedFromId !== null && (
            <span className="tiq-cell-sub">{t('admin-access.invitations.reissued')}</span>
          )}
        </>
      ),
    },
    {
      id: 'expiresAt',
      header: t('admin-access.invitations.col.expires'),
      sortable: true,
      cell: (row) =>
        row.status === 'accepted' || row.status === 'revoked' || row.status === 'reissued' ? (
          <span className="tiq-text-muted">
            {row.acceptedAt === null
              ? tEnum('invitations.status', row.status)
              : t('admin-access.invitations.acceptedOn', {
                  date: formatInstantDate(row.acceptedAt, timeZone),
                })}
          </span>
        ) : (
          <OfficialDeadline deadline={{ at: row.expiresAt, timeZone }} showLocal={false} />
        ),
    },
    {
      id: 'invitedBy',
      header: t('admin-access.invitations.col.invitedBy'),
      cell: (row) => (
        <>
          <span>{row.invitedBy?.fullName ?? '—'}</span>
          <span className="tiq-cell-sub">
            {t('admin-access.invitations.sent', {
              date: formatInstantDate(row.createdAt, timeZone),
              count: row.sentCount,
            })}
          </span>
        </>
      ),
    },
    {
      id: 'createdAt',
      header: t('admin-access.invitations.col.created'),
      sortable: true,
      cell: (row) => formatInstantDate(row.createdAt, timeZone),
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) =>
        admin.canManageUsers && (row.canReissue || row.canRevoke) ? (
          <div className="tiq-row-actions">
            {row.canReissue && (
              <Button size="sm" onClick={() => setCommand({ kind: 'reissue', row })}>
                {t('admin-access.invitations.reissue')}
              </Button>
            )}
            {row.canRevoke && (
              <Button size="sm" onClick={() => setCommand({ kind: 'revoke', row })}>
                {t('admin-access.invitations.revoke')}
              </Button>
            )}
          </div>
        ) : (
          '—'
        ),
    },
  ];

  const target = command?.row;
  const daysValid = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 30;

  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-access.invitations.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.invitations.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.invitations.filter.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.status}
          options={INVITATIONS_STATUS.map((value) => ({
            value,
            label: tEnum('invitations.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('admin-access.invitations.filter.createdFrom')}
          value={filters.createdFrom}
          onChange={(createdFrom) => setFilters({ createdFrom, page: 1 })}
        />
        <DateInput
          label={t('admin-access.invitations.filter.createdTo')}
          value={filters.createdTo}
          onChange={(createdTo) => setFilters({ createdTo, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-access.invitations.caption')}
          columns={columns}
          rows={query.data === undefined ? undefined : shown}
          rowKey={(row) => String(row.invitationId)}
          rowLabel={(row) => row.email}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered
                  ? t('admin-access.invitations.emptyFiltered')
                  : t('admin-access.invitations.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {target !== undefined && command?.kind === 'reissue' && (
        <ConfirmActionDialog
          open
          title={t('admin-access.invitations.reissueTitle')}
          scope={t('admin-access.invitations.scope', { email: target.email })}
          consequence={t('admin-access.invitations.reissueConsequence', { days })}
          confirmLabel={t('admin-access.invitations.reissue')}
          pending={reissue.pending}
          error={dialogError(reissue.error, ['expiresInDays'])}
          onCancel={close}
          onConfirm={async () => {
            if (!daysValid) return;
            try {
              const result = await reissue.mutate({
                params: { invitationId: target.invitationId },
                body: { expiresInDays: Number(days) },
              });
              setResults({
                ...results,
                [target.invitationId]: {
                  ...target,
                  status: 'reissued',
                  canReissue: false,
                  canRevoke: false,
                  reissuedToId: result.invitationId,
                },
                [result.invitationId]: result,
              });
              toast.show(t('admin-access.invitations.reissued'), 'success');
              close();
            } catch {
              // Shown in the dialog.
            }
          }}
        >
          <NumberInput
            label={t('admin-access.invite.expiresInDays')}
            value={days}
            places={0}
            onChange={setDays}
            error={
              daysValid
                ? formErrors(reissue.error, ['expiresInDays']).forField('expiresInDays')
                : t('admin-access.invite.error.expiry')
            }
            required
          />
        </ConfirmActionDialog>
      )}
      {target !== undefined && command?.kind === 'revoke' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('admin-access.invitations.revokeTitle')}
          scope={t('admin-access.invitations.scope', { email: target.email })}
          consequence={t('admin-access.invitations.revokeConsequence')}
          confirmLabel={t('admin-access.invitations.revoke')}
          reason={{ label: t('admin-access.common.reason'), required: true }}
          pending={revoke.pending}
          error={dialogError(revoke.error, [])}
          onCancel={close}
          onConfirm={async ({ reason }) => {
            try {
              const result = await revoke.mutate({
                params: { invitationId: target.invitationId },
                body: { reason },
              });
              setResults({ ...results, [target.invitationId]: result });
              toast.show(t('admin-access.invitations.revoked'), 'success');
              close();
            } catch {
              // Shown in the dialog.
            }
          }}
        />
      )}
    </div>
  );
}

type Tab = 'members' | 'invitations';

export default function UsersPage() {
  const admin = useMemberAdmin();
  const tenant = useActiveTenant();
  const [tab, setTab] = useState<Tab>('members');
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<InvitationRow | null>(null);
  const supplier = admin.kind === 'supplier';
  return (
    <AccessLayout>
      <PageHeader
        title={supplier ? t('admin-access.users.supplierTitle') : t('admin-access.users.title')}
        subtitle={
          supplier
            ? t('admin-access.users.supplierIntro', { organization: tenant?.name ?? '' })
            : t('admin-access.users.intro', { organization: tenant?.name ?? '' })
        }
        primaryAction={
          admin.canManageUsers ? (
            <Button variant="primary" icon="userPlus" onClick={() => setInviting(true)}>
              {t('admin-access.users.invite')}
            </Button>
          ) : undefined
        }
      />
      {invited !== null && (
        <Banner
          tone="success"
          title={t('admin-access.invite.sentTitle', { email: invited.email })}
          actions={
            <Button size="sm" variant="ghost" onClick={() => setInvited(null)}>
              {t('admin-access.common.dismiss')}
            </Button>
          }
        >
          <p>{t('admin-access.invite.sentBody')}</p>
        </Banner>
      )}
      <Tabs
        label={t('admin-access.users.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={[
          {
            id: 'members',
            label: supplier
              ? t('admin-access.users.tab.members')
              : t('admin-access.users.tab.users'),
          },
          { id: 'invitations', label: t('admin-access.users.tab.invitations') },
        ]}
      >
        {tab === 'members' ? <MembersTab /> : <InvitationsTab latest={invited} />}
      </Tabs>
      <InviteMemberDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={(invitation) => {
          setInviting(false);
          setInvited(invitation);
          setTab('invitations');
        }}
      />
    </AccessLayout>
  );
}
