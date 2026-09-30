/**
 * ADM-06 — Procurement policy profiles: the register of the organization's versioned policy profiles, with the
 * current and pending version of each, the procedures they permit and how many tenders use them (FR-22, BR-09).
 */
import { useNavigate } from 'react-router';

import {
  POLICY_PROFILE_VERSIONS_STATUS,
  POLICY_PROFILES_STATUS,
  TENDERS_PROCEDURE_WRITE,
} from '@contracts/enums';
import { listPolicyProfiles } from '@contracts/policy';
import type { PolicyProfileSummary } from '@contracts/policy';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  ButtonLink,
  Card,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { PolicyLayout } from '../components/PolicyLayout';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, directionOf, fromDate, oneOf, tableSort, toDate } from '../lib/lists';
import { policyPaths } from '../lib/paths';

const SORT_FIELDS = ['name', 'status', 'updatedAt', 'usageCount'] as const;
type SortField = (typeof SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  status: '',
  versionStatus: '',
  procedure: '',
  updatedFrom: '',
  updatedTo: '',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (SORT_FIELDS as readonly string[]).includes(value) ? (value as SortField) : 'name';
}

export default function PolicyProfilesPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission('org.policy.manage');
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-06', DEFAULTS);

  const query = useApiQuery(listPolicyProfiles, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, POLICY_PROFILES_STATUS),
      versionStatus: oneOf(filters.versionStatus, POLICY_PROFILE_VERSIONS_STATUS),
      procedure: oneOf(filters.procedure, TENDERS_PROCEDURE_WRITE),
      updatedFrom: fromDate(filters.updatedFrom),
      updatedTo: toDate(filters.updatedTo),
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listPolicyProfiles, { query: { pageSize: 100 } });

  const all = overview.data?.items ?? [];
  const activeCount = all.filter((row) => row.status === 'active').length;
  const inReview = all.filter((row) => row.pendingVersion?.status === 'in_review').length;
  const drafts = all.filter((row) => row.pendingVersion?.status === 'draft').length;
  const tendersUsing = all.reduce((total, row) => total + row.usageCount, 0);
  const kpiRestricted = overview.error?.kind === 'forbidden';

  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.versionStatus !== '' ||
    filters.procedure !== '' ||
    filters.updatedFrom !== '' ||
    filters.updatedTo !== '';

  const columns: DataTableColumn<PolicyProfileSummary>[] = [
    {
      id: 'name',
      header: t('admin-policy.profiles.col.name'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.name}</span>
          <span className="tiq-cell-sub">{row.description}</span>
        </>
      ),
    },
    {
      id: 'current',
      header: t('admin-policy.profiles.col.current'),
      cell: (row) =>
        row.currentVersion === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{t('admin-policy.common.versionNo', { no: row.currentVersion.versionNo })}</span>
            <span className="tiq-cell-sub">
              {row.currentVersion.effectiveFrom === null
                ? t('admin-policy.profiles.notEffective')
                : t('admin-policy.profiles.effectiveFrom', {
                    date: formatInstantDate(row.currentVersion.effectiveFrom, timeZone),
                  })}
            </span>
          </>
        ),
    },
    {
      id: 'pending',
      header: t('admin-policy.profiles.col.pending'),
      cell: (row) =>
        row.pendingVersion === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-inline">
            <span>{t('admin-policy.common.versionNo', { no: row.pendingVersion.versionNo })}</span>
            <StatusChip
              enum="policy_profile_versions.status"
              value={row.pendingVersion.status}
              size="sm"
            />
          </span>
        ),
    },
    {
      id: 'procedures',
      header: t('admin-policy.profiles.col.procedures'),
      cell: (row) =>
        row.permittedProcedures
          .map((procedure) => tEnum('tenders.procedure', procedure))
          .join(', '),
    },
    {
      id: 'usageCount',
      header: t('admin-policy.profiles.col.usage'),
      sortable: true,
      numeric: true,
      cell: (row) => formatCount(row.usageCount),
    },
    {
      id: 'status',
      header: t('admin-policy.profiles.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="policy_profiles.status" value={row.status} />,
    },
    {
      id: 'updatedAt',
      header: t('admin-policy.profiles.col.updated'),
      sortable: true,
      cell: (row) => formatInstantDate(row.updatedAt, timeZone),
    },
  ];

  return (
    <PolicyLayout>
      <PageHeader
        title={t('admin-policy.profiles.title')}
        subtitle={t('admin-policy.profiles.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to={policyPaths.newProfile} variant="primary" icon="plus">
              {t('admin-policy.profiles.new')}
            </ButtonLink>
          ) : undefined
        }
      />
      <FilterBar
        label={t('admin-policy.profiles.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-policy.common.search')}
          placeholder={t('admin-policy.profiles.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-policy.profiles.filter.status')}
          placeholder={t('admin-policy.common.allStatuses')}
          value={filters.status}
          options={POLICY_PROFILES_STATUS.map((value) => ({
            value,
            label: tEnum('policy_profiles.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('admin-policy.profiles.filter.versionStatus')}
          placeholder={t('admin-policy.common.allStatuses')}
          value={filters.versionStatus}
          options={POLICY_PROFILE_VERSIONS_STATUS.map((value) => ({
            value,
            label: tEnum('policy_profile_versions.status', value),
          }))}
          onChange={(versionStatus) => setFilters({ versionStatus, page: 1 })}
        />
        <Select
          label={t('admin-policy.profiles.filter.procedure')}
          placeholder={t('admin-policy.common.allProcedures')}
          value={filters.procedure}
          options={TENDERS_PROCEDURE_WRITE.map((value) => ({
            value,
            label: tEnum('tenders.procedure', value),
          }))}
          onChange={(procedure) => setFilters({ procedure, page: 1 })}
        />
        <DateInput
          label={t('admin-policy.common.updatedFrom')}
          value={filters.updatedFrom}
          onChange={(updatedFrom) => setFilters({ updatedFrom, page: 1 })}
        />
        <DateInput
          label={t('admin-policy.common.updatedTo')}
          value={filters.updatedTo}
          onChange={(updatedTo) => setFilters({ updatedTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-policy.profiles.kpi.active')}
          icon="shieldCheck"
          value={overview.data === undefined ? '…' : formatCount(activeCount)}
          hint={t('admin-policy.profiles.kpi.activeHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('admin-policy.profiles.kpi.inReview')}
          icon="clipboardCheck"
          tone="warning"
          value={overview.data === undefined ? '…' : formatCount(inReview)}
          hint={t('admin-policy.profiles.kpi.inReviewHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('admin-policy.profiles.kpi.drafts')}
          icon="edit"
          tone="info"
          value={overview.data === undefined ? '…' : formatCount(drafts)}
          hint={t('admin-policy.profiles.kpi.draftsHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('admin-policy.profiles.kpi.usage')}
          icon="fileText"
          tone="success"
          value={overview.data === undefined ? '…' : formatCount(tendersUsing)}
          hint={t('admin-policy.profiles.kpi.usageHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('admin-policy.profiles.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.name}
          onRowClick={(row) => void navigate(policyPaths.profile(row.id))}
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
                  ? t('admin-policy.profiles.emptyFiltered')
                  : t('admin-policy.profiles.empty')
              }
              description={filtered ? undefined : t('admin-policy.profiles.emptyHint')}
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
    </PolicyLayout>
  );
}
