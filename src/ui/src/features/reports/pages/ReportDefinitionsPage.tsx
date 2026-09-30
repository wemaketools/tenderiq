/**
 * ADM-13 — Reports and controlled exports: report definitions (FR-21, PRD §13.2). Each definition shows its family,
 * owner, authorized audience, scheduled delivery, recipients and last run, with search, filters, sort and
 * pagination. Report managers create and share business views; a `report.view` holder sees only the definitions
 * whose audience permission they hold.
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router';

import { REPORT_DEFINITIONS_FAMILY } from '@contracts/enums';
import { REPORT_DEFINITION_SORT_FIELDS, reportingEndpoints } from '@contracts/reporting';
import type { ReportDefinitionRow } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  SearchField,
  Select,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ReportAdminHeader } from '../components/ReportAdminTabs';
import { REPORT_READ, compact, idOf, oneOf } from '../lib/shared';

const DEFAULTS = {
  q: '',
  family: '',
  active: '',
  scheduled: '',
  owner: '',
  updatedFrom: '',
  updatedTo: '',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function ReportDefinitionsPage() {
  const canRead = usePermission(REPORT_READ);
  if (!canRead) {
    return <Navigate to="/buyer/admin/reports/exports" replace />;
  }
  return <DefinitionsList />;
}

function DefinitionsList() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-13', DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const family = oneOf(filters.family, REPORT_DEFINITIONS_FAMILY);
  const query = useApiQuery(reportingEndpoints.listReportDefinitions, {
    query: {
      ...compact({
        q: filters.q.trim(),
        family: family === undefined ? undefined : [family],
        active: filters.active === '' ? undefined : filters.active === 'true',
        scheduled: filters.scheduled === '' ? undefined : filters.scheduled === 'true',
        ownerUserId: idOf(filters.owner),
        updatedFrom: filters.updatedFrom,
        updatedTo: filters.updatedTo,
      }),
      sort: oneOf(filters.sort, REPORT_DEFINITION_SORT_FIELDS),
      dir: filters.dir === 'desc' ? 'desc' : 'asc',
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  const data = query.data;
  const owners = new Map<number, string>();
  for (const row of data?.items ?? []) owners.set(row.owner.userId, row.owner.fullName);
  const filtered = (
    ['q', 'family', 'active', 'scheduled', 'owner', 'updatedFrom', 'updatedTo'] as const
  ).some((key) => filters[key] !== '');

  const columns: DataTableColumn<ReportDefinitionRow>[] = [
    {
      id: 'name',
      header: t('reports.admin.col.name'),
      sortable: true,
      cell: (row) => <Link to={`/buyer/reports/definitions/${row.id}`}>{row.name}</Link>,
    },
    {
      id: 'family',
      header: t('reports.admin.col.family'),
      sortable: true,
      cell: (row) => tEnum('report_definitions.family', row.family),
    },
    {
      id: 'audience',
      header: t('reports.admin.col.audience'),
      cell: (row) => (
        <>
          <span>{t(`reports.audiences.${row.audiencePermission.replace(/\./g, '_')}`)}</span>
          <span className="tiq-cell-sub">
            {t('reports.admin.recipients', { count: row.recipientCount })}
          </span>
        </>
      ),
    },
    {
      id: 'schedule',
      header: t('reports.admin.col.schedule'),
      cell: (row) =>
        row.schedule === null ? (
          <span className="tiq-text-muted">{t('reports.definition.notScheduled')}</span>
        ) : (
          <>
            <span>{row.schedule.description}</span>
            <span className="tiq-cell-sub">
              {row.schedule.nextRunAt === null
                ? t('reports.preview.noNextRun')
                : t('reports.admin.next', {
                    when: formatDateTime(row.schedule.nextRunAt, row.schedule.timeZone),
                  })}
            </span>
          </>
        ),
    },
    {
      id: 'owner',
      header: t('reports.admin.col.owner'),
      cell: (row) => row.owner.fullName,
    },
    {
      id: 'status',
      header: t('reports.admin.col.status'),
      cell: (row) => (
        <Chip tone={row.active ? 'success' : 'neutral'} size="sm">
          {row.active ? t('reports.definition.active') : t('reports.definition.inactive')}
        </Chip>
      ),
    },
    {
      id: 'lastRunAt',
      header: t('reports.admin.col.lastRun'),
      sortable: true,
      cell: (row) =>
        row.lastRunAt === null ? (
          <span className="tiq-text-muted">{t('reports.catalog.neverRun')}</span>
        ) : (
          formatDateTime(row.lastRunAt, timeZone)
        ),
    },
    {
      id: 'updatedAt',
      header: t('reports.admin.col.updated'),
      sortable: true,
      cell: (row) => formatDateTime(row.updatedAt, timeZone),
    },
  ];

  return (
    <div className="tiq-page">
      <ReportAdminHeader />
      <FilterBar
        label={t('reports.admin.filters')}
        onClear={() => {
          setSearch('');
          clearFilters();
        }}
        canClear={filtered}
      >
        <SearchField
          label={t('reports.admin.search')}
          value={search}
          onChange={setSearch}
          onSubmit={(value) => setFilters({ q: value.trim(), page: 1 })}
          placeholder={t('reports.admin.searchPlaceholder')}
        />
        <Select
          label={t('reports.admin.family')}
          value={filters.family}
          placeholder={t('reports.report.all')}
          options={REPORT_DEFINITIONS_FAMILY.map((value) => ({
            value,
            label: tEnum('report_definitions.family', value),
          }))}
          onChange={(value) => setFilters({ family: value, page: 1 })}
        />
        <Select
          label={t('reports.admin.status')}
          value={filters.active}
          placeholder={t('reports.report.all')}
          options={[
            { value: 'true', label: t('reports.definition.active') },
            { value: 'false', label: t('reports.definition.inactive') },
          ]}
          onChange={(value) => setFilters({ active: value, page: 1 })}
        />
        <Select
          label={t('reports.admin.delivery')}
          value={filters.scheduled}
          placeholder={t('reports.report.all')}
          options={[
            { value: 'true', label: t('reports.admin.scheduledOnly') },
            { value: 'false', label: t('reports.admin.onDemand') },
          ]}
          onChange={(value) => setFilters({ scheduled: value, page: 1 })}
        />
        <Select
          label={t('reports.admin.owner')}
          value={filters.owner}
          placeholder={t('reports.report.all')}
          options={[...owners.entries()].map(([id, name]) => ({ value: String(id), label: name }))}
          onChange={(value) => setFilters({ owner: value, page: 1 })}
        />
        <DateInput
          label={t('reports.admin.updatedFrom')}
          value={filters.updatedFrom}
          onChange={(value) => setFilters({ updatedFrom: value, page: 1 })}
        />
        <DateInput
          label={t('reports.admin.updatedTo')}
          value={filters.updatedTo}
          onChange={(value) => setFilters({ updatedTo: value, page: 1 })}
        />
      </FilterBar>
      <Card
        flush
        title={t('reports.admin.definitionsTitle')}
        subtitle={
          data === undefined
            ? undefined
            : t('reports.admin.definitionsCount', { count: data.total })
        }
      >
        <DataTable
          caption={t('reports.admin.definitionsTitle')}
          columns={columns}
          rows={data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => t('reports.admin.openNamed', { name: row.name })}
          rowHref={(row) => `/buyer/reports/definitions/${row.id}`}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: filters.sort, dir: filters.dir === 'desc' ? 'desc' : 'asc' }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="bookOpen"
              title={filtered ? t('reports.admin.noMatch') : t('reports.admin.none')}
              description={t('reports.admin.noneHint')}
            />
          }
          pagination={
            data === undefined
              ? undefined
              : {
                  page: data.page,
                  pageSize: data.pageSize,
                  total: data.total,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
    </div>
  );
}
