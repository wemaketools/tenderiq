/**
 * ADM-15 Integration register: business connections with their record owners, exchanged information, outstanding
 * exceptions, last confirmation and responsible owner. Actions: add a connection (enabling it needs a documented
 * manual fallback), open a connection to reconcile or confirm it.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { IntegrationRow } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type {
  IntegrationConnectionsStatus,
  IntegrationConnectionsSystemType,
} from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
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
import { formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { IntegrationFormDialog } from '../components/IntegrationForm';
import { usePeopleOptions } from '../components/people';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  system: '',
  status: '',
  owner: '',
  exceptions: false,
  page: 1,
  sort: 'name',
  dir: 'asc',
};

type SortField = 'name' | 'systemType' | 'status' | 'lastConfirmedAt' | 'openExceptions';

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [creating, setCreating] = useState(false);
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-15', DEFAULTS);
  const people = usePeopleOptions();
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.system === ''
      ? {}
      : { systemType: [filters.system as IntegrationConnectionsSystemType] }),
    ...(filters.status === '' ? {} : { status: [filters.status as IntegrationConnectionsStatus] }),
    ...(filters.owner === '' ? {} : { businessOwnerUserId: Number(filters.owner) }),
    ...(filters.exceptions ? { hasOpenExceptions: true } : {}),
  };
  const integrations = useApiQuery(operationsEndpoints.listIntegrations, { query });
  const all = useApiQuery(operationsEndpoints.listIntegrations, { query: { pageSize: 100 } });
  const rows = all.data?.items;
  const count = (predicate: (row: IntegrationRow) => boolean): string | null =>
    rows === undefined ? null : formatCount(rows.filter(predicate).length);
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.system !== '' ||
    filters.status !== '' ||
    filters.owner !== '' ||
    filters.exceptions;

  return (
    <ServiceLayout>
      <PageHeader
        title={t('admin-integrations.list.title')}
        subtitle={t('admin-integrations.list.subtitle')}
        primaryAction={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t('admin-integrations.form.open')}
          </Button>
        }
      />
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('admin-integrations.list.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('admin-integrations.col.system')}
          placeholder={t('ops.common.all')}
          value={filters.system}
          onChange={(value) => update({ system: value })}
          options={enumOptions('integration_connections.system_type')}
        />
        <Select
          label={t('admin-integrations.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('integration_connections.status')}
        />
        <Select
          label={t('admin-integrations.col.owner')}
          placeholder={t('ops.common.all')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          options={people}
        />
        <Checkbox
          label={t('admin-integrations.list.withExceptions')}
          checked={filters.exceptions}
          onChange={(checked) => update({ exceptions: checked })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-integrations.kpi.active')}
          icon="plug"
          value={count((row) => row.status === 'active')}
          hint={t('admin-integrations.kpi.activeHint')}
        />
        <KpiCard
          label={t('admin-integrations.kpi.exceptions')}
          icon="alertTriangle"
          tone="danger"
          value={
            rows === undefined
              ? null
              : formatCount(rows.reduce((total, row) => total + row.openExceptions, 0))
          }
          hint={t('admin-integrations.kpi.exceptionsHint')}
          to={servicePaths.exceptions}
        />
        <KpiCard
          label={t('admin-integrations.kpi.noFallback')}
          icon="alertCircle"
          tone="warning"
          value={count((row) => !row.hasManualFallback)}
          hint={t('admin-integrations.kpi.noFallbackHint')}
        />
        <KpiCard
          label={t('admin-integrations.kpi.planned')}
          icon="clock"
          tone="info"
          value={count((row) => row.status === 'planned')}
          hint={t('admin-integrations.kpi.plannedHint')}
        />
      </KpiGrid>
      <Card flush title={t('admin-integrations.list.register')}>
        <DataTable<IntegrationRow>
          caption={t('admin-integrations.list.register')}
          rows={integrations.data?.items}
          rowKey={(row) => String(row.id)}
          loading={integrations.isFetching}
          error={integrations.error}
          onRetry={integrations.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          rowHref={(row) => servicePaths.integration(row.id)}
          rowLabel={(row) => t('admin-integrations.list.rowLabel', { name: row.name })}
          empty={
            <EmptyState
              compact
              icon="plug"
              title={t('admin-integrations.list.empty')}
              description={t('admin-integrations.list.emptyHint')}
            />
          }
          pagination={
            integrations.data === undefined
              ? undefined
              : {
                  page: integrations.data.page,
                  pageSize: integrations.data.pageSize,
                  total: integrations.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'name',
              header: t('admin-integrations.col.name'),
              sortable: true,
              width: '30%',
              cell: (row) => (
                <>
                  <strong>{row.name}</strong>
                  <div className="tiq-cell-sub">{row.purpose}</div>
                </>
              ),
            },
            {
              id: 'systemType',
              header: t('admin-integrations.col.system'),
              sortable: true,
              cell: (row) => (
                <StatusChip
                  enum="integration_connections.system_type"
                  value={row.systemType}
                  size="sm"
                />
              ),
            },
            {
              id: 'owner',
              header: t('admin-integrations.col.owner'),
              cell: (row) => row.businessOwner.fullName,
            },
            {
              id: 'status',
              header: t('admin-integrations.col.status'),
              sortable: true,
              cell: (row) => (
                <StatusChip enum="integration_connections.status" value={row.status} />
              ),
            },
            {
              id: 'lastConfirmedAt',
              header: t('admin-integrations.col.lastConfirmed'),
              sortable: true,
              cell: (row) =>
                row.lastConfirmedAt === null ? (
                  <span className="tiq-text-warning">
                    {t('admin-integrations.list.neverConfirmed')}
                  </span>
                ) : (
                  formatDateTime(row.lastConfirmedAt, timeZone)
                ),
            },
            {
              id: 'openExceptions',
              header: t('admin-integrations.col.exceptions'),
              sortable: true,
              numeric: true,
              cell: (row) =>
                row.openExceptions === 0 ? (
                  '0'
                ) : (
                  <Chip tone="danger" size="sm">
                    {formatCount(row.openExceptions)}
                  </Chip>
                ),
            },
            {
              id: 'fallback',
              header: t('admin-integrations.col.fallback'),
              cell: (row) =>
                row.hasManualFallback ? (
                  <Chip tone="success" size="sm">
                    {t('admin-integrations.list.fallbackDocumented')}
                  </Chip>
                ) : (
                  <Chip tone="warning" size="sm">
                    {t('admin-integrations.list.fallbackMissing')}
                  </Chip>
                ),
            },
          ]}
        />
      </Card>
      {creating && (
        <IntegrationFormDialog
          existing={null}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            toast.show(t('admin-integrations.form.created', { name: saved.name }), 'success');
            navigate(servicePaths.integration(saved.id));
          }}
        />
      )}
    </ServiceLayout>
  );
}
