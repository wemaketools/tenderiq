/**
 * ADM-04 / SUP-04 — Groups: user groups with their members and the roles they carry. Groups simplify assignment
 * but never bypass restrictions, conflicts or authority limits (PRD §4.2). Create a group, then manage its
 * membership on the group page.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { GROUP_SORTS } from '@contracts/org-admin';
import type { GroupRow } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchField,
  Select,
  TextArea,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { RoleChips } from '../components/AccessBits';
import { useMemberAdmin } from '../lib/audience';
import { dialogError } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import { booleanFilter, compact, directionOf, pagingOf, sortOf, tableSort } from '../lib/lists';

const DEFAULTS = { q: '', active: 'true', sort: 'name', dir: 'asc', page: 1, pageSize: 25 };

function CreateGroupDialog({ onClose }: { readonly onClose: () => void }) {
  const admin = useMemberAdmin();
  const navigate = useNavigate();
  const toast = useToast();
  const create = useApiMutation(admin.endpoints.createGroup);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [checked, setChecked] = useState(false);
  const server = formErrors(create.error, ['name', 'description']);
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.groups.createTitle')}
      scope={name.trim() === '' ? t('admin-access.groups.newGroup') : name.trim()}
      consequence={t('admin-access.groups.createConsequence')}
      confirmLabel={t('admin-access.groups.create')}
      pending={create.pending}
      error={dialogError(create.error, ['name', 'description'])}
      onCancel={onClose}
      onConfirm={async () => {
        setChecked(true);
        if (name.trim().length < 3) return;
        try {
          const group = await create.mutate({
            body: {
              name: name.trim(),
              description: description.trim() === '' ? null : description.trim(),
            },
          });
          toast.show(t('admin-access.groups.created', { name: group.name }), 'success');
          onClose();
          void navigate(admin.paths.group(group.groupId), { state: { record: group } });
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <TextField
        label={t('admin-access.groups.name')}
        value={name}
        onChange={setName}
        error={
          checked && name.trim().length < 3
            ? t('admin-access.roles.form.nameInvalid')
            : server.forField('name')
        }
        required
      />
      <TextArea
        label={t('admin-access.groups.description')}
        value={description}
        onChange={setDescription}
        error={server.forField('description')}
        rows={3}
      />
    </ConfirmActionDialog>
  );
}

export default function GroupsPage() {
  const admin = useMemberAdmin();
  const timeZone = useOfficialTimeZone();
  const [creating, setCreating] = useState(false);
  const [filters, setFilters, clearFilters] = useScreenFilters(
    `${admin.rolesScreen}:groups`,
    DEFAULTS,
  );
  const query = useApiQuery(admin.endpoints.listGroups, {
    query: compact({
      q: filters.q.trim(),
      active: booleanFilter(filters.active),
      sort: sortOf(filters.sort, GROUP_SORTS, 'name'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const filtered = filters.q !== '' || filters.active !== 'true';
  const columns: DataTableColumn<GroupRow>[] = [
    {
      id: 'name',
      header: t('admin-access.groups.col.name'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.name}</span>
          <span className="tiq-cell-sub">{row.description ?? ''}</span>
        </>
      ),
    },
    {
      id: 'roles',
      header: t('admin-access.groups.col.roles'),
      cell: (row) => <RoleChips roles={row.roles} />,
    },
    {
      id: 'memberCount',
      header: t('admin-access.groups.col.members'),
      sortable: true,
      numeric: true,
      cell: (row) => formatCount(row.memberCount),
    },
    {
      id: 'createdAt',
      header: t('admin-access.groups.col.created'),
      sortable: true,
      cell: (row) => formatInstantDate(row.createdAt, timeZone),
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
        title={t('admin-access.groups.title')}
        subtitle={t('admin-access.groups.intro')}
        primaryAction={
          admin.canManageRoles ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t('admin-access.groups.new')}
            </Button>
          ) : undefined
        }
      />
      <FilterBar
        label={t('admin-access.groups.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.groups.searchPlaceholder')}
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
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('admin-access.groups.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.groupId)}
          rowLabel={(row) => row.name}
          rowHref={(row) => admin.paths.group(row.groupId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('admin-access.groups.emptyFiltered') : t('admin-access.groups.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {creating && <CreateGroupDialog onClose={() => setCreating(false)} />}
    </AccessLayout>
  );
}
