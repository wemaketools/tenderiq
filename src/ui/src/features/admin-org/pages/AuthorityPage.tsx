/**
 * ADM-05 — Authority, committees and delegations (FR-03, BR-06, BR-07): approval and signature limits by person,
 * role or committee with legal entity, category and effective dates; delegations with the delegator's cap (a
 * delegation never exceeds the grantor's own authority); committees with quorum, chair and alternates; and the
 * segregation-of-duties incompatibilities (enforced, or documented alternative oversight).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  AUTHORITY_LIMITS_DECISION_TYPE,
  AUTHORITY_LIMITS_SUBJECT_TYPE,
  COMMITTEES_PURPOSE,
} from '@contracts/enums';
import {
  ACCESS_ITEM_STATUSES,
  AUTHORITY_LIMIT_SORTS,
  COMMITTEE_SORTS,
  DELEGATION_SORTS,
  orgAdminEndpoints,
} from '@contracts/org-admin';
import type {
  AuthorityLimitRow,
  CommitteeRow,
  DelegationRow,
  SodPolicyRow,
} from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  PageHeader,
  QueryView,
  RestrictedState,
  SearchField,
  Select,
  Tabs,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { AccessStatusChip, PersonCell } from '../../admin-access/components/AccessBits';
import { useOfficialTimeZone } from '../../admin-access/lib/hooks';
import {
  booleanFilter,
  compact,
  directionOf,
  isFiltered,
  oneOf,
  pagingOf,
  sortOf,
  tableSort,
} from '../../admin-access/lib/lists';
import { accessStatusOptions } from '../../admin-access/lib/status';
import {
  CreateCommitteeDialog,
  CreateDelegationDialog,
  CreateLimitDialog,
  EndLimitDialog,
  RevokeDelegationDialog,
  SodPolicyDialog,
} from '../components/AuthorityDialogs';
import { OrgLayout } from '../components/OrgLayout';
import { orgPaths } from '../lib/paths';
import { AUTHORITY_MANAGE, AUTHORITY_READ, COMMITTEES_READ } from '../lib/permissions';

type Tab = 'limits' | 'delegations' | 'committees' | 'sod';

const LIMIT_DEFAULTS = {
  q: '',
  subjectType: '',
  decisionType: '',
  status: '',
  sort: 'decisionType',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};
const DELEGATION_DEFAULTS = {
  q: '',
  status: '',
  decisionType: '',
  sort: 'endsAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};
const COMMITTEE_DEFAULTS = {
  q: '',
  purpose: '',
  active: 'true',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function dateRange(from: string, to: string | null, timeZone: string) {
  return (
    <>
      <span>{formatInstantDate(from, timeZone)}</span>
      <span className="tiq-cell-sub">
        {to === null
          ? t('admin-access.common.openEnded')
          : t('admin-access.common.until', { date: formatInstantDate(to, timeZone) })}
      </span>
    </>
  );
}

function LimitsTab({
  created,
  onEnd,
}: {
  readonly created: readonly AuthorityLimitRow[];
  readonly onEnd: (row: AuthorityLimitRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(AUTHORITY_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-05:limits', LIMIT_DEFAULTS);
  const query = useApiQuery(orgAdminEndpoints.listAuthorityLimits, {
    query: compact({
      q: filters.q.trim(),
      subjectType: oneOf(filters.subjectType, AUTHORITY_LIMITS_SUBJECT_TYPE),
      decisionType: oneOf(filters.decisionType, AUTHORITY_LIMITS_DECISION_TYPE),
      status: oneOf(filters.status, ACCESS_ITEM_STATUSES),
      sort: sortOf(filters.sort, AUTHORITY_LIMIT_SORTS, 'decisionType'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const loaded = query.data?.items ?? [];
  const rows = [
    ...created.filter((row) => !loaded.some((item) => item.limitId === row.limitId)),
    ...loaded.map((row) => created.find((item) => item.limitId === row.limitId) ?? row),
  ];
  const filtered = isFiltered(filters);
  const columns: DataTableColumn<AuthorityLimitRow>[] = [
    {
      id: 'subject',
      header: t('admin-org.authority.col.holder'),
      sortable: true,
      cell: (row) => (
        <PersonCell
          name={row.subject.name}
          sub={tEnum('authority_limits.subject_type', row.subjectType)}
        />
      ),
    },
    {
      id: 'decisionType',
      header: t('admin-org.authority.col.decision'),
      sortable: true,
      cell: (row) => tEnum('authority_limits.decision_type', row.decisionType),
    },
    {
      id: 'maxAmount',
      header: t('admin-org.authority.col.max'),
      sortable: true,
      numeric: true,
      cell: (row) =>
        row.maxAmount === null ? (
          t('admin-access.common.unlimited')
        ) : (
          <MoneyText value={row.maxAmount} />
        ),
    },
    {
      id: 'scope',
      header: t('admin-org.authority.col.scope'),
      cell: (row) => (
        <PersonCell
          name={row.legalEntity?.name ?? t('admin-org.authority.allEntities')}
          sub={row.category?.name ?? t('admin-org.authority.allCategories')}
        />
      ),
    },
    {
      id: 'effectiveFrom',
      header: t('admin-org.authority.col.effective'),
      sortable: true,
      cell: (row) => dateRange(row.effectiveFrom, row.effectiveTo, timeZone),
    },
    {
      id: 'approvedBy',
      header: t('admin-org.authority.col.approvedBy'),
      cell: (row) => row.approvedBy?.fullName ?? '—',
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
        canManage &&
        (row.status === 'active' ||
          row.status === 'expiring_soon' ||
          row.status === 'scheduled') ? (
          <div className="tiq-row-actions">
            <Button size="sm" onClick={() => onEnd(row)}>
              {t('admin-org.authority.end')}
            </Button>
          </div>
        ) : (
          '—'
        ),
    },
  ];
  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-org.authority.limitFilters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-org.authority.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-org.authority.subjectType')}
          placeholder={t('admin-access.common.all')}
          value={filters.subjectType}
          options={AUTHORITY_LIMITS_SUBJECT_TYPE.map((value) => ({
            value,
            label: tEnum('authority_limits.subject_type', value),
          }))}
          onChange={(subjectType) => setFilters({ subjectType, page: 1 })}
        />
        <Select
          label={t('admin-org.authority.decisionType')}
          placeholder={t('admin-access.common.all')}
          value={filters.decisionType}
          options={AUTHORITY_LIMITS_DECISION_TYPE.map((value) => ({
            value,
            label: tEnum('authority_limits.decision_type', value),
          }))}
          onChange={(decisionType) => setFilters({ decisionType, page: 1 })}
        />
        <Select
          label={t('admin-access.member.col.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.status}
          options={accessStatusOptions(ACCESS_ITEM_STATUSES)}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-org.authority.limitsCaption')}
          columns={columns}
          rows={query.data === undefined ? undefined : rows}
          rowKey={(row) => String(row.limitId)}
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
                  ? t('admin-org.authority.emptyFiltered')
                  : t('admin-org.authority.limitsEmpty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
    </div>
  );
}

function DelegationsTab({
  created,
  onRevoke,
}: {
  readonly created: readonly DelegationRow[];
  readonly onRevoke: (row: DelegationRow) => void;
}) {
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(AUTHORITY_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters(
    'ADM-05:delegations',
    DELEGATION_DEFAULTS,
  );
  const query = useApiQuery(orgAdminEndpoints.listDelegations, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, ACCESS_ITEM_STATUSES),
      decisionType: oneOf(filters.decisionType, AUTHORITY_LIMITS_DECISION_TYPE),
      sort: sortOf(filters.sort, DELEGATION_SORTS, 'endsAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const loaded = query.data?.items ?? [];
  const rows = [
    ...created.filter((row) => !loaded.some((item) => item.delegationId === row.delegationId)),
    ...loaded.map((row) => created.find((item) => item.delegationId === row.delegationId) ?? row),
  ];
  const filtered = isFiltered(filters);
  const columns: DataTableColumn<DelegationRow>[] = [
    {
      id: 'delegator',
      header: t('admin-org.authority.delegator'),
      sortable: true,
      cell: (row) => row.delegator.fullName,
    },
    {
      id: 'delegate',
      header: t('admin-org.authority.delegate'),
      sortable: true,
      cell: (row) => row.delegate.fullName,
    },
    {
      id: 'decisions',
      header: t('admin-org.authority.decisions'),
      cell: (row) => (
        <PersonCell
          name={row.decisionTypes
            .map((value) => tEnum('authority_limits.decision_type', value))
            .join(', ')}
          sub={row.reason}
        />
      ),
    },
    {
      id: 'cap',
      header: t('admin-org.authority.col.cap'),
      numeric: true,
      cell: (row) => (
        <>
          {row.maxAmount === null ? (
            t('admin-access.common.unlimited')
          ) : (
            <MoneyText value={row.maxAmount} />
          )}
          <span className="tiq-cell-sub">
            {t('admin-org.authority.capOf', {
              cap:
                row.delegatorLimit === null
                  ? t('admin-access.common.unlimited')
                  : formatMoney(row.delegatorLimit),
            })}
          </span>
        </>
      ),
    },
    {
      id: 'scope',
      header: t('admin-org.authority.col.scope'),
      cell: (row) => (
        <PersonCell
          name={row.legalEntity?.name ?? t('admin-org.authority.allEntities')}
          sub={row.category?.name ?? t('admin-org.authority.allCategories')}
        />
      ),
    },
    {
      id: 'startsAt',
      header: t('admin-org.authority.col.dates'),
      sortable: true,
      cell: (row) => dateRange(row.startsAt, row.endsAt, timeZone),
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
            <Button size="sm" onClick={() => onRevoke(row)}>
              {t('admin-org.authority.revoke')}
            </Button>
          </div>
        ) : (
          '—'
        ),
    },
  ];
  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-org.authority.delegationFilters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-org.authority.delegationSearch')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-org.authority.decisionType')}
          placeholder={t('admin-access.common.all')}
          value={filters.decisionType}
          options={AUTHORITY_LIMITS_DECISION_TYPE.map((value) => ({
            value,
            label: tEnum('authority_limits.decision_type', value),
          }))}
          onChange={(decisionType) => setFilters({ decisionType, page: 1 })}
        />
        <Select
          label={t('admin-access.member.col.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.status}
          options={accessStatusOptions(ACCESS_ITEM_STATUSES)}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-org.authority.delegationsCaption')}
          columns={columns}
          rows={query.data === undefined ? undefined : rows}
          rowKey={(row) => String(row.delegationId)}
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
                  ? t('admin-org.authority.emptyFiltered')
                  : t('admin-org.authority.delegationsEmpty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
    </div>
  );
}

function CommitteesTab() {
  const navigate = useNavigate();
  const [filters, setFilters, clearFilters] = useScreenFilters(
    'ADM-05:committees',
    COMMITTEE_DEFAULTS,
  );
  const query = useApiQuery(orgAdminEndpoints.listCommittees, {
    query: compact({
      q: filters.q.trim(),
      purpose: oneOf(filters.purpose, COMMITTEES_PURPOSE),
      active: booleanFilter(filters.active),
      sort: sortOf(filters.sort, COMMITTEE_SORTS, 'name'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const filtered = filters.q !== '' || filters.purpose !== '' || filters.active !== 'true';
  const columns: DataTableColumn<CommitteeRow>[] = [
    {
      id: 'name',
      header: t('admin-org.committees.name'),
      sortable: true,
      cell: (row) => <PersonCell name={row.name} sub={row.legalEntity?.name ?? null} />,
    },
    {
      id: 'purpose',
      header: t('admin-org.committees.purpose'),
      sortable: true,
      cell: (row) => tEnum('committees.purpose', row.purpose),
    },
    {
      id: 'chair',
      header: t('admin-org.committees.chair'),
      cell: (row) => row.chair?.fullName ?? t('admin-org.committees.noChair'),
    },
    {
      id: 'members',
      header: t('admin-org.committees.members'),
      numeric: true,
      cell: (row) => (
        <PersonCell
          name={formatCount(row.votingMemberCount)}
          sub={t('admin-org.committees.alternates', { count: row.alternateCount })}
        />
      ),
    },
    {
      id: 'quorum',
      header: t('admin-org.committees.quorum'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <span>{formatCount(row.quorum)}</span>
          {row.quorumMet ? (
            <Chip tone="success" size="sm">
              {t('admin-org.committees.quorumMet')}
            </Chip>
          ) : (
            <Chip tone="danger" size="sm">
              {t('admin-org.committees.quorumShort')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('admin-access.member.col.status'),
      cell: (row) =>
        row.active ? (
          <Chip tone="success" size="sm">
            {t('admin-access.common.active')}
          </Chip>
        ) : (
          <Chip tone="neutral-outlined" size="sm">
            {t('admin-access.common.inactive')}
          </Chip>
        ),
    },
  ];
  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-org.committees.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-org.committees.search')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-org.committees.purpose')}
          placeholder={t('admin-access.common.all')}
          value={filters.purpose}
          options={COMMITTEES_PURPOSE.map((value) => ({
            value,
            label: tEnum('committees.purpose', value),
          }))}
          onChange={(purpose) => setFilters({ purpose, page: 1 })}
        />
        <Select
          label={t('admin-access.member.col.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.active}
          options={[
            { value: 'true', label: t('admin-access.common.active') },
            { value: 'false', label: t('admin-access.common.inactive') },
          ]}
          onChange={(active) => setFilters({ active, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-org.committees.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.committeeId)}
          rowLabel={(row) => row.name}
          onRowClick={(row) => void navigate(orgPaths.committee(row.committeeId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('admin-org.authority.emptyFiltered') : t('admin-org.committees.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
    </div>
  );
}

function SodTab() {
  const timeZone = useOfficialTimeZone();
  const toast = useToast();
  const canManage = usePermission(AUTHORITY_MANAGE);
  const query = useApiQuery(orgAdminEndpoints.listSodPolicies, {});
  const [editing, setEditing] = useState<SodPolicyRow | null>(null);
  const [results, setResults] = useState<Readonly<Record<string, SodPolicyRow>>>({});
  return (
    <div className="tiq-page">
      <QueryView
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState title={t('admin-org.sod.empty')} />}
      >
        {(data) => {
          const rows = data.items.map((row) => results[row.ruleCode] ?? row);
          return (
            <>
              <KpiGrid>
                <KpiCard
                  label={t('admin-org.sod.kpi.enforced')}
                  icon="shieldCheck"
                  tone="success"
                  value={formatCount(rows.filter((row) => row.mode === 'enforced').length)}
                  hint={t('admin-org.sod.kpi.enforcedHint')}
                />
                <KpiCard
                  label={t('admin-org.sod.kpi.alternative')}
                  icon="alertTriangle"
                  tone="warning"
                  value={formatCount(
                    rows.filter((row) => row.mode === 'alternative_oversight').length,
                  )}
                  hint={t('admin-org.sod.kpi.alternativeHint')}
                />
                <KpiCard
                  label={t('admin-org.sod.kpi.holders')}
                  icon="users"
                  tone="danger"
                  value={formatCount(rows.reduce((total, row) => total + row.holdersOfBoth, 0))}
                  hint={t('admin-org.sod.kpi.holdersHint')}
                />
              </KpiGrid>
              <Card flush>
                <DataTable
                  caption={t('admin-org.sod.caption')}
                  rows={rows}
                  rowKey={(row) => row.ruleCode}
                  columns={[
                    {
                      id: 'rule',
                      header: t('admin-org.sod.col.rule'),
                      cell: (row) => (
                        <PersonCell
                          name={tEnum('sod_policies.rule_code', row.ruleCode)}
                          sub={row.permissions.join(' ≠ ')}
                        />
                      ),
                    },
                    {
                      id: 'mode',
                      header: t('admin-org.sod.col.mode'),
                      cell: (row) => (
                        <>
                          <Chip tone={row.mode === 'enforced' ? 'success' : 'warning'} size="sm">
                            {tEnum('sod_policies.mode', row.mode)}
                          </Chip>
                          {!row.configured && (
                            <span className="tiq-cell-sub">{t('admin-org.sod.default')}</span>
                          )}
                        </>
                      ),
                    },
                    {
                      id: 'note',
                      header: t('admin-org.sod.col.note'),
                      cell: (row) => row.alternativeOversightNote ?? '—',
                    },
                    {
                      id: 'approved',
                      header: t('admin-org.sod.col.approved'),
                      cell: (row) => (
                        <PersonCell
                          name={row.approvedBy?.fullName ?? '—'}
                          sub={
                            row.effectiveFrom === null
                              ? null
                              : formatInstantDate(row.effectiveFrom, timeZone)
                          }
                        />
                      ),
                    },
                    {
                      id: 'holders',
                      header: t('admin-org.sod.col.holders'),
                      numeric: true,
                      cell: (row) =>
                        row.holdersOfBoth > 0 ? (
                          <Chip tone="danger" size="sm">
                            {formatCount(row.holdersOfBoth)}
                          </Chip>
                        ) : (
                          formatCount(0)
                        ),
                    },
                    {
                      id: 'actions',
                      header: t('admin-access.common.actions'),
                      cell: (row) =>
                        canManage ? (
                          <div className="tiq-row-actions">
                            <Button size="sm" onClick={() => setEditing(row)}>
                              {t('admin-org.sod.change')}
                            </Button>
                          </div>
                        ) : (
                          '—'
                        ),
                    },
                  ]}
                />
              </Card>
            </>
          );
        }}
      </QueryView>
      {editing !== null && (
        <SodPolicyDialog
          row={editing}
          onClose={() => setEditing(null)}
          onDone={(row) => {
            setResults({ ...results, [row.ruleCode]: row });
            setEditing(null);
            toast.show(t('admin-org.sod.saved'), 'success');
          }}
        />
      )}
    </div>
  );
}

export default function AuthorityPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const canRead = usePermission(AUTHORITY_READ);
  const canCommittees = usePermission(COMMITTEES_READ);
  const canManage = usePermission(AUTHORITY_MANAGE);
  const [tab, setTab] = useState<Tab>(canRead ? 'limits' : 'committees');
  const [open, setOpen] = useState<'limit' | 'delegation' | 'committee' | null>(null);
  const [ending, setEnding] = useState<AuthorityLimitRow | null>(null);
  const [revoking, setRevoking] = useState<DelegationRow | null>(null);
  const [limits, setLimits] = useState<readonly AuthorityLimitRow[]>([]);
  const [delegations, setDelegations] = useState<readonly DelegationRow[]>([]);
  const primary = !canManage
    ? undefined
    : tab === 'limits'
      ? { label: t('admin-org.authority.createLimit'), open: 'limit' as const }
      : tab === 'delegations'
        ? { label: t('admin-org.authority.createDelegation'), open: 'delegation' as const }
        : tab === 'committees'
          ? { label: t('admin-org.committees.create'), open: 'committee' as const }
          : undefined;
  const restricted = <RestrictedState description={t('admin-org.authority.restricted')} />;
  return (
    <OrgLayout>
      <PageHeader
        title={t('admin-org.authority.title')}
        subtitle={t('admin-org.authority.intro')}
        primaryAction={
          primary === undefined ? undefined : (
            <Button variant="primary" icon="plus" onClick={() => setOpen(primary.open)}>
              {primary.label}
            </Button>
          )
        }
      />
      <Tabs
        label={t('admin-org.authority.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={[
          { id: 'limits', label: t('admin-org.authority.tab.limits') },
          { id: 'delegations', label: t('admin-org.authority.tab.delegations') },
          { id: 'committees', label: t('admin-org.authority.tab.committees') },
          { id: 'sod', label: t('admin-org.authority.tab.sod') },
        ]}
      >
        {tab === 'limits' &&
          (canRead ? <LimitsTab created={limits} onEnd={setEnding} /> : restricted)}
        {tab === 'delegations' &&
          (canRead ? <DelegationsTab created={delegations} onRevoke={setRevoking} /> : restricted)}
        {tab === 'committees' && (canCommittees ? <CommitteesTab /> : restricted)}
        {tab === 'sod' && (canRead ? <SodTab /> : restricted)}
      </Tabs>
      {open === 'limit' && (
        <CreateLimitDialog
          now={now}
          onClose={() => setOpen(null)}
          onDone={(row) => {
            setLimits([row, ...limits]);
            setOpen(null);
            toast.show(t('admin-org.authority.limitCreated'), 'success');
          }}
        />
      )}
      {open === 'delegation' && (
        <CreateDelegationDialog
          now={now}
          onClose={() => setOpen(null)}
          onDone={(row) => {
            setDelegations([row, ...delegations]);
            setOpen(null);
            toast.show(t('admin-org.authority.delegationCreated'), 'success');
          }}
        />
      )}
      {open === 'committee' && (
        <CreateCommitteeDialog
          onClose={() => setOpen(null)}
          onDone={(committee) => {
            setOpen(null);
            toast.show(t('admin-org.committees.created', { name: committee.name }), 'success');
            void navigate(orgPaths.committee(committee.committeeId), {
              state: { record: committee },
            });
          }}
        />
      )}
      {ending !== null && (
        <EndLimitDialog
          row={ending}
          now={now}
          onClose={() => setEnding(null)}
          onDone={(row) => {
            setLimits([row, ...limits.filter((item) => item.limitId !== row.limitId)]);
            setEnding(null);
            toast.show(t('admin-org.authority.limitEnded'), 'success');
          }}
        />
      )}
      {revoking !== null && (
        <RevokeDelegationDialog
          row={revoking}
          onClose={() => setRevoking(null)}
          onDone={(row) => {
            setDelegations([
              row,
              ...delegations.filter((item) => item.delegationId !== row.delegationId),
            ]);
            setRevoking(null);
            toast.show(t('admin-org.authority.delegationRevoked'), 'success');
          }}
        />
      )}
    </OrgLayout>
  );
}
