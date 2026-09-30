/**
 * ADM-04 — Roles (buyers) and SUP-04 roles (suppliers): system and custom roles of this organization with their
 * template, permission count and active holders; create an approved role combination from the organization's own
 * role catalog (templates and permissions of its kind only).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ROLE_SORTS } from '@contracts/org-admin';
import type { RoleRow } from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  SearchField,
  Select,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { RoleFormDialog } from '../components/RoleForm';
import { useMemberAdmin } from '../lib/audience';
import { booleanFilter, compact, directionOf, pagingOf, sortOf, tableSort } from '../lib/lists';

const DEFAULTS = {
  q: '',
  active: 'true',
  isSystem: '',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function RolesPage() {
  const admin = useMemberAdmin();
  const navigate = useNavigate();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [filters, setFilters, clearFilters] = useScreenFilters(
    `${admin.rolesScreen}:roles`,
    DEFAULTS,
  );
  const query = useApiQuery(admin.endpoints.listRoles, {
    query: compact({
      q: filters.q.trim(),
      active: booleanFilter(filters.active),
      isSystem: booleanFilter(filters.isSystem),
      sort: sortOf(filters.sort, ROLE_SORTS, 'name'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(admin.endpoints.listRoles, { query: { pageSize: 100 } });
  const catalog = useApiQuery(admin.endpoints.getRoleCatalog, creating ? {} : null);
  const all = overview.data?.items ?? [];
  const value = (rows: readonly RoleRow[]): string =>
    overview.data === undefined ? '…' : formatCount(rows.length);
  const filtered =
    Object.entries(filters).some(
      ([key, item]) => !['sort', 'dir', 'page', 'pageSize', 'active'].includes(key) && item !== '',
    ) || filters.active !== 'true';

  const columns: DataTableColumn<RoleRow>[] = [
    {
      id: 'name',
      header: t('admin-access.roles.col.name'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.name}</span>
          <span className="tiq-cell-sub">{row.description ?? ''}</span>
        </>
      ),
    },
    {
      id: 'code',
      header: t('admin-access.roles.col.code'),
      sortable: true,
      cell: (row) => <span className="tiq-mono">{row.code}</span>,
    },
    {
      id: 'kind',
      header: t('admin-access.roles.col.kind'),
      cell: (row) =>
        row.isSystem ? (
          <Chip tone="neutral" size="sm">
            {t('admin-access.roles.system')}
          </Chip>
        ) : (
          <Chip tone="accent" size="sm">
            {t('admin-access.roles.custom')}
          </Chip>
        ),
    },
    {
      id: 'permissions',
      header: t('admin-access.roles.col.permissions'),
      numeric: true,
      cell: (row) => formatCount(row.permissionCount),
    },
    {
      id: 'activeAssignmentCount',
      header: t('admin-access.roles.col.holders'),
      sortable: true,
      numeric: true,
      cell: (row) => formatCount(row.activeAssignmentCount),
    },
    {
      id: 'status',
      header: t('admin-access.roles.col.status'),
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
    <AccessLayout>
      <PageHeader
        title={t('admin-access.roles.title')}
        subtitle={
          admin.kind === 'buyer'
            ? t('admin-access.roles.intro')
            : t('admin-access.roles.supplierIntro')
        }
        primaryAction={
          admin.canManageRoles ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t('admin-access.roles.new')}
            </Button>
          ) : undefined
        }
      />
      <FilterBar label={t('admin-access.roles.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.roles.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.roles.filter.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.active}
          options={[
            { value: 'true', label: t('admin-access.common.active') },
            { value: 'false', label: t('admin-access.common.inactive') },
          ]}
          onChange={(active) => setFilters({ active, page: 1 })}
        />
        <Select
          label={t('admin-access.roles.filter.kind')}
          placeholder={t('admin-access.common.all')}
          value={filters.isSystem}
          options={[
            { value: 'true', label: t('admin-access.roles.system') },
            { value: 'false', label: t('admin-access.roles.custom') },
          ]}
          onChange={(isSystem) => setFilters({ isSystem, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-access.roles.kpi.active')}
          icon="shield"
          value={value(all.filter((row) => row.active))}
          restricted={overview.error?.kind === 'forbidden'}
          hint={t('admin-access.roles.kpi.activeHint')}
        />
        <KpiCard
          label={t('admin-access.roles.kpi.custom')}
          icon="sliders"
          tone="info"
          value={value(all.filter((row) => !row.isSystem))}
          restricted={overview.error?.kind === 'forbidden'}
          hint={t('admin-access.roles.kpi.customHint')}
        />
        <KpiCard
          label={t('admin-access.roles.kpi.unused')}
          icon="alertTriangle"
          tone="warning"
          value={value(all.filter((row) => row.active && row.activeAssignmentCount === 0))}
          restricted={overview.error?.kind === 'forbidden'}
          hint={t('admin-access.roles.kpi.unusedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('admin-access.roles.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.roleId)}
          rowLabel={(row) => row.name}
          rowHref={(row) => admin.paths.role(row.roleId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('admin-access.roles.emptyFiltered') : t('admin-access.roles.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {creating && catalog.data !== undefined && (
        <RoleFormDialog
          catalog={catalog.data}
          role={null}
          onClose={() => setCreating(false)}
          onSaved={(role) => {
            setCreating(false);
            toast.show(t('admin-access.roles.created', { name: role.name }), 'success');
            void navigate(admin.paths.role(role.roleId), { state: { record: role } });
          }}
        />
      )}
      {creating && catalog.error !== null && (
        <EmptyState
          title={t('admin-access.roles.catalogFailed')}
          description={catalog.error.detail ?? catalog.error.title}
          action={
            <Button onClick={() => setCreating(false)}>{t('admin-access.common.dismiss')}</Button>
          }
        />
      )}
    </AccessLayout>
  );
}
