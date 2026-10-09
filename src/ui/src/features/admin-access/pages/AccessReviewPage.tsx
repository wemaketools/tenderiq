/**
 * ADM-04 — Access review (buyers): incompatible authority per the segregation-of-duties policies, direct grants
 * expiring soon, dormant accounts, active restrictions and pending conflict reviews; the direct grants register
 * (owner, reason, dates; grant, extend, revoke), the restrictions register (restrictions win; add, lift) and the
 * effective access of any member with its sources.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import { ACCESS_RESTRICTIONS_RESTRICTION_TYPE } from '@contracts/enums';
import {
  ACCESS_FINDING_TYPES,
  ACCESS_ITEM_STATUSES,
  FINDING_SEVERITIES,
  FINDING_SORTS,
  GRANT_SORTS,
  RESTRICTION_SORTS,
  orgAdminEndpoints,
} from '@contracts/org-admin';
import type { AccessFinding, AccessGrantRow, AccessRestrictionRow } from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
  Tabs,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { AccessLayout } from '../components/AccessLayout';
import { AccessStatusChip, PersonCell, ScopeText } from '../components/AccessBits';
import { EffectiveAccessCard } from '../components/EffectiveAccessCard';
import {
  CreateGrantDialog,
  CreateRestrictionDialog,
  ExtendGrantDialog,
  LiftRestrictionDialog,
  RevokeGrantDialog,
} from '../components/GrantDialogs';
import { MemberSelect } from '../components/Pickers';
import { useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { compact, directionOf, isFiltered, oneOf, pagingOf, sortOf, tableSort } from '../lib/lists';
import { accessPaths, buyerAccessPaths } from '../lib/paths';
import { BUYER_FINDINGS_READ, BUYER_ROLES_MANAGE } from '../lib/permissions';
import { SEVERITY_TONE, accessStatusOptions } from '../lib/status';

type Tab = 'findings' | 'grants' | 'restrictions' | 'effective';

const FINDING_DEFAULTS = {
  q: '',
  type: '',
  severity: '',
  sort: 'severity',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};
const GRANT_DEFAULTS = {
  q: '',
  status: '',
  expiresFrom: '',
  expiresTo: '',
  sort: 'expiresAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};
const RESTRICTION_DEFAULTS = {
  q: '',
  status: '',
  restrictionType: '',
  sort: 'startsAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

const paths = accessPaths('buyer');

function findingLink(finding: AccessFinding): string {
  if (finding.type === 'pending_conflict_review' && finding.relatedId !== null) {
    return buyerAccessPaths.conflict(finding.relatedId);
  }
  return paths.user(finding.user.userId);
}

function FindingsTab() {
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-04:findings', FINDING_DEFAULTS);
  const query = useApiQuery(orgAdminEndpoints.listAccessFindings, {
    query: compact({
      q: filters.q.trim(),
      type: oneOf(filters.type, ACCESS_FINDING_TYPES),
      severity: oneOf(filters.severity, FINDING_SEVERITIES),
      sort: sortOf(filters.sort, FINDING_SORTS, 'severity'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const summary = query.data?.summary;
  const kpi = (value: number | undefined): string =>
    value === undefined ? '…' : formatCount(value);
  const filtered = isFiltered(filters);
  const columns: DataTableColumn<AccessFinding>[] = [
    {
      id: 'severity',
      header: t('admin-access.review.col.severity'),
      sortable: true,
      cell: (row) => (
        <Chip tone={SEVERITY_TONE[row.severity]} size="sm">
          {t(`admin-access.severity.${row.severity}`)}
        </Chip>
      ),
    },
    {
      id: 'type',
      header: t('admin-access.review.col.finding'),
      sortable: true,
      cell: (row) => (
        <>
          <Link to={findingLink(row)}>{row.title}</Link>
          <span className="tiq-cell-sub">{row.detail}</span>
        </>
      ),
    },
    {
      id: 'user',
      header: t('admin-access.review.col.person'),
      sortable: true,
      cell: (row) => <PersonCell name={row.user.fullName} sub={row.capacity} />,
    },
    {
      id: 'kind',
      header: t('admin-access.review.col.type'),
      cell: (row) => (
        <>
          <span>{t(`admin-access.findingType.${row.type}`)}</span>
          {row.ruleCode !== null && (
            <span className="tiq-cell-sub">{tEnum('sod_policies.rule_code', row.ruleCode)}</span>
          )}
        </>
      ),
    },
    {
      id: 'dueAt',
      header: t('admin-access.review.col.due'),
      sortable: true,
      cell: (row) =>
        row.dueAt === null ? (
          '—'
        ) : (
          <OfficialDeadline deadline={{ at: row.dueAt, timeZone }} showLocal={false} />
        ),
    },
  ];
  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-access.review.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.review.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.review.filter.type')}
          placeholder={t('admin-access.common.all')}
          value={filters.type}
          options={ACCESS_FINDING_TYPES.map((value) => ({
            value,
            label: t(`admin-access.findingType.${value}`),
          }))}
          onChange={(type) => setFilters({ type, page: 1 })}
        />
        <Select
          label={t('admin-access.review.filter.severity')}
          placeholder={t('admin-access.common.all')}
          value={filters.severity}
          options={FINDING_SEVERITIES.map((value) => ({
            value,
            label: t(`admin-access.severity.${value}`),
          }))}
          onChange={(severity) => setFilters({ severity, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-access.review.kpi.sod')}
          icon="scale"
          tone="danger"
          value={kpi(summary?.sodConflicts)}
          hint={t('admin-access.review.kpi.sodHint')}
        />
        <KpiCard
          label={t('admin-access.review.kpi.expiring')}
          icon="hourglass"
          tone="warning"
          value={kpi(summary?.expiringGrants)}
          hint={t('admin-access.review.kpi.expiringHint')}
        />
        <KpiCard
          label={t('admin-access.review.kpi.dormant')}
          icon="clock"
          tone="info"
          value={kpi(summary?.dormantAccounts)}
          hint={t('admin-access.review.kpi.dormantHint')}
        />
        <KpiCard
          label={t('admin-access.review.kpi.conflicts')}
          icon="alertTriangle"
          value={kpi(summary?.pendingConflictReviews)}
          to={buyerAccessPaths.conflicts}
          hint={
            summary === undefined
              ? undefined
              : t('admin-access.review.kpi.conflictsHint', {
                  restrictions: summary.activeRestrictions,
                })
          }
        />
      </KpiGrid>
      {summary !== undefined && (
        <p className="tiq-text-muted">
          {t('admin-access.review.generated', {
            at: formatDateTime(summary.generatedAt, timeZone),
          })}
        </p>
      )}
      <Card flush>
        <DataTable
          caption={t('admin-access.review.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.findingId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('admin-access.review.emptyFiltered') : t('admin-access.review.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
    </div>
  );
}

function GrantsTab({ created }: { readonly created: readonly AccessGrantRow[] }) {
  const timeZone = useOfficialTimeZone();
  const toast = useToast();
  const canManage = usePermission(BUYER_ROLES_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-04:grants', GRANT_DEFAULTS);
  const [open, setOpen] = useState<{ kind: 'extend' | 'revoke'; row: AccessGrantRow } | null>(null);
  const [results, setResults] = useState<Readonly<Record<number, AccessGrantRow>>>({});
  const query = useApiQuery(orgAdminEndpoints.listAccessGrants, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, ACCESS_ITEM_STATUSES),
      expiresFrom: filters.expiresFrom,
      expiresTo: filters.expiresTo,
      sort: sortOf(filters.sort, GRANT_SORTS, 'expiresAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const filtered = isFiltered(filters);
  const loaded = (query.data?.items ?? []).map((row) => results[row.grantId] ?? row);
  const rows = [
    ...created.filter((row) => !loaded.some((item) => item.grantId === row.grantId)),
    ...loaded,
  ];
  const columns: DataTableColumn<AccessGrantRow>[] = [
    {
      id: 'user',
      header: t('admin-access.review.col.person'),
      sortable: true,
      cell: (row) => <PersonCell name={row.user.fullName} sub={row.capacity} />,
    },
    {
      id: 'permissionCode',
      header: t('admin-access.grants.col.permission'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.permissionCode}</span>
          <span className="tiq-cell-sub">{row.permissionDescription}</span>
        </>
      ),
    },
    {
      id: 'scope',
      header: t('admin-access.member.col.scope'),
      cell: (row) => <ScopeText scope={row.scope} />,
    },
    {
      id: 'owner',
      header: t('admin-access.grants.col.owner'),
      cell: (row) => <PersonCell name={row.owner.fullName} sub={row.reason} />,
    },
    {
      id: 'startsAt',
      header: t('admin-access.grants.col.starts'),
      sortable: true,
      cell: (row) => (
        <PersonCell
          name={formatInstantDate(row.startsAt, timeZone)}
          sub={
            row.grantedBy === null
              ? null
              : t('admin-access.grants.by', { name: row.grantedBy.fullName })
          }
        />
      ),
    },
    {
      id: 'expiresAt',
      header: t('admin-access.grants.col.expires'),
      sortable: true,
      cell: (row) => (
        <OfficialDeadline deadline={{ at: row.expiresAt, timeZone }} showLocal={false} />
      ),
    },
    {
      id: 'status',
      header: t('admin-access.member.col.status'),
      cell: (row) => <AccessStatusChip status={row.status} />,
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) =>
        canManage && row.status !== 'revoked' && row.status !== 'expired' ? (
          <div className="tiq-row-actions">
            <Button size="sm" onClick={() => setOpen({ kind: 'extend', row })}>
              {t('admin-access.grants.extend')}
            </Button>
            <Button size="sm" onClick={() => setOpen({ kind: 'revoke', row })}>
              {t('admin-access.grants.revoke')}
            </Button>
          </div>
        ) : (
          '—'
        ),
    },
  ];
  const finish = (row: AccessGrantRow, message: string): void => {
    setResults({ ...results, [row.grantId]: row });
    setOpen(null);
    toast.show(message, 'success');
  };
  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-access.grants.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.grants.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.grants.filter.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.status}
          options={accessStatusOptions(ACCESS_ITEM_STATUSES)}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('admin-access.grants.filter.expiresFrom')}
          value={filters.expiresFrom}
          onChange={(expiresFrom) => setFilters({ expiresFrom, page: 1 })}
        />
        <DateInput
          label={t('admin-access.grants.filter.expiresTo')}
          value={filters.expiresTo}
          onChange={(expiresTo) => setFilters({ expiresTo, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-access.grants.caption')}
          columns={columns}
          rows={query.data === undefined ? undefined : rows}
          rowKey={(row) => String(row.grantId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('admin-access.grants.emptyFiltered') : t('admin-access.grants.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {open?.kind === 'extend' && (
        <ExtendGrantDialog
          grant={open.row}
          onClose={() => setOpen(null)}
          onDone={(row) => finish(row, t('admin-access.grants.extended'))}
        />
      )}
      {open?.kind === 'revoke' && (
        <RevokeGrantDialog
          grant={open.row}
          onClose={() => setOpen(null)}
          onDone={(row) => finish(row, t('admin-access.grants.revoked'))}
        />
      )}
    </div>
  );
}

function RestrictionsTab({ created }: { readonly created: readonly AccessRestrictionRow[] }) {
  const timeZone = useOfficialTimeZone();
  const toast = useToast();
  const canManage = usePermission(BUYER_ROLES_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters(
    'ADM-04:restrictions',
    RESTRICTION_DEFAULTS,
  );
  const [lifting, setLifting] = useState<AccessRestrictionRow | null>(null);
  const [results, setResults] = useState<Readonly<Record<number, AccessRestrictionRow>>>({});
  const query = useApiQuery(orgAdminEndpoints.listAccessRestrictions, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, ACCESS_ITEM_STATUSES),
      restrictionType: oneOf(filters.restrictionType, ACCESS_RESTRICTIONS_RESTRICTION_TYPE),
      sort: sortOf(filters.sort, RESTRICTION_SORTS, 'startsAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const filtered = isFiltered(filters);
  const loaded = (query.data?.items ?? []).map((row) => results[row.restrictionId] ?? row);
  const rows = [
    ...created.filter((row) => !loaded.some((item) => item.restrictionId === row.restrictionId)),
    ...loaded,
  ];
  const columns: DataTableColumn<AccessRestrictionRow>[] = [
    {
      id: 'user',
      header: t('admin-access.review.col.person'),
      sortable: true,
      cell: (row) => <PersonCell name={row.user.fullName} sub={row.capacity} />,
    },
    {
      id: 'type',
      header: t('admin-access.restrictions.col.type'),
      cell: (row) => (
        <>
          <StatusChip
            enum="access_restrictions.restriction_type"
            value={row.restrictionType}
            size="sm"
          />
          {row.conflictDeclarationId !== null && (
            <Link
              className="tiq-cell-sub"
              to={buyerAccessPaths.conflict(row.conflictDeclarationId)}
            >
              {t('admin-access.restrictions.fromDeclaration')}
            </Link>
          )}
        </>
      ),
    },
    {
      id: 'permission',
      header: t('admin-access.grants.col.permission'),
      cell: (row) =>
        row.permissionCode === null ? (
          t('admin-access.restrictions.allPermissions')
        ) : (
          <span className="tiq-mono">{row.permissionCode}</span>
        ),
    },
    {
      id: 'scope',
      header: t('admin-access.member.col.scope'),
      cell: (row) => <ScopeText scope={row.scope} />,
    },
    {
      id: 'reason',
      header: t('admin-access.restrictions.col.reason'),
      cell: (row) => (
        <PersonCell
          name={row.reason}
          sub={
            row.imposedBy === null
              ? null
              : t('admin-access.grants.by', { name: row.imposedBy.fullName })
          }
        />
      ),
    },
    {
      id: 'startsAt',
      header: t('admin-access.grants.col.starts'),
      sortable: true,
      cell: (row) => formatInstantDate(row.startsAt, timeZone),
    },
    {
      id: 'endsAt',
      header: t('admin-access.restrictions.col.ends'),
      sortable: true,
      cell: (row) =>
        row.endsAt === null
          ? t('admin-access.common.openEnded')
          : formatInstantDate(row.endsAt, timeZone),
    },
    {
      id: 'status',
      header: t('admin-access.member.col.status'),
      cell: (row) => <AccessStatusChip status={row.status} />,
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) =>
        canManage && row.status !== 'revoked' && row.status !== 'expired' ? (
          row.restrictionType === 'conflict' && row.conflictDeclarationId !== null ? (
            <span className="tiq-cell-sub">{t('admin-access.restrictions.viaReview')}</span>
          ) : (
            <div className="tiq-row-actions">
              <Button size="sm" onClick={() => setLifting(row)}>
                {t('admin-access.restrictions.lift')}
              </Button>
            </div>
          )
        ) : (
          '—'
        ),
    },
  ];
  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-access.restrictions.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.restrictions.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.restrictions.col.type')}
          placeholder={t('admin-access.common.all')}
          value={filters.restrictionType}
          options={ACCESS_RESTRICTIONS_RESTRICTION_TYPE.map((value) => ({
            value,
            label: tEnum('access_restrictions.restriction_type', value),
          }))}
          onChange={(restrictionType) => setFilters({ restrictionType, page: 1 })}
        />
        <Select
          label={t('admin-access.grants.filter.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.status}
          options={accessStatusOptions(ACCESS_ITEM_STATUSES)}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-access.restrictions.caption')}
          columns={columns}
          rows={query.data === undefined ? undefined : rows}
          rowKey={(row) => String(row.restrictionId)}
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
                  ? t('admin-access.restrictions.emptyFiltered')
                  : t('admin-access.restrictions.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {lifting !== null && (
        <LiftRestrictionDialog
          restriction={lifting}
          onClose={() => setLifting(null)}
          onDone={(row) => {
            setResults({ ...results, [row.restrictionId]: row });
            setLifting(null);
            toast.show(t('admin-access.restrictions.lifted'), 'success');
          }}
        />
      )}
    </div>
  );
}

function EffectiveTab() {
  const initial = useIdParam('userId');
  const [userId, setUserId] = useState(initial === null ? '' : String(initial));
  return (
    <div className="tiq-page">
      <Card title={t('admin-access.effective.chooseTitle')}>
        <div className="tiq-form-grid">
          <MemberSelect
            label={t('admin-access.effective.person')}
            value={userId}
            onChange={setUserId}
          />
        </div>
      </Card>
      {userId === '' ? (
        <EmptyState title={t('admin-access.effective.chooseHint')} icon="user" />
      ) : (
        <EffectiveAccessCard key={userId} userId={Number(userId)} />
      )}
    </div>
  );
}

export default function AccessReviewPage() {
  const toast = useToast();
  const now = useNow();
  const canFindings = usePermission(BUYER_FINDINGS_READ);
  const canManage = usePermission(BUYER_ROLES_MANAGE);
  const [tab, setTab] = useState<Tab>(canFindings ? 'findings' : 'grants');
  const [creating, setCreating] = useState<'grant' | 'restriction' | null>(null);
  const [grants, setGrants] = useState<readonly AccessGrantRow[]>([]);
  const [restrictions, setRestrictions] = useState<readonly AccessRestrictionRow[]>([]);
  const primary =
    canManage && tab === 'grants' ? (
      <Button variant="primary" icon="key" onClick={() => setCreating('grant')}>
        {t('admin-access.grants.create')}
      </Button>
    ) : canManage && tab === 'restrictions' ? (
      <Button variant="primary" icon="lock" onClick={() => setCreating('restriction')}>
        {t('admin-access.restrictions.create')}
      </Button>
    ) : undefined;
  return (
    <AccessLayout>
      <PageHeader
        title={t('admin-access.review.title')}
        subtitle={t('admin-access.review.intro')}
        primaryAction={primary}
      />
      <Tabs
        label={t('admin-access.review.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={[
          ...(canFindings
            ? [{ id: 'findings', label: t('admin-access.review.tab.findings') }]
            : []),
          { id: 'grants', label: t('admin-access.review.tab.grants') },
          { id: 'restrictions', label: t('admin-access.review.tab.restrictions') },
          { id: 'effective', label: t('admin-access.review.tab.effective') },
        ]}
      >
        {tab === 'findings' && canFindings && <FindingsTab />}
        {tab === 'grants' && <GrantsTab created={grants} />}
        {tab === 'restrictions' && <RestrictionsTab created={restrictions} />}
        {tab === 'effective' && <EffectiveTab />}
      </Tabs>
      {creating === 'grant' && (
        <CreateGrantDialog
          now={now}
          onClose={() => setCreating(null)}
          onCreated={(grant) => {
            setGrants([grant, ...grants]);
            setCreating(null);
            toast.show(t('admin-access.grants.created'), 'success');
          }}
        />
      )}
      {creating === 'restriction' && (
        <CreateRestrictionDialog
          now={now}
          onClose={() => setCreating(null)}
          onCreated={(restriction) => {
            setRestrictions([restriction, ...restrictions]);
            setCreating(null);
            toast.show(t('admin-access.restrictions.created'), 'success');
          }}
        />
      )}
    </AccessLayout>
  );
}
