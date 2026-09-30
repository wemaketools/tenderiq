/**
 * ADM-15 exception queue: every failed or disputed exchange with the affected record, what stays unconfirmed, the
 * owner and the resolution (AC-33). Open to integration managers and to tender owners, who resolve failed
 * publications of their tenders: without `org.integrations.manage` the queue holds only publication and notice
 * exceptions (and those assigned to the caller), so the connection filter and the other record types are hidden.
 */
import { useNavigate } from 'react-router';

import {
  INTEGRATION_RECORD_TYPES,
  TENDER_OWNER_EXCEPTION_RECORD_TYPES,
  operationsEndpoints,
} from '@contracts/operations';
import type { IntegrationExceptionRow, IntegrationRecordType } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { IntegrationExceptionsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Card,
  DateInput,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  Select,
} from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ExceptionsTable } from '../components/ExceptionsTable';
import { usePeopleOptions } from '../components/people';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';
import { INTEGRATIONS_MANAGE } from '../lib/permissions';

const DEFAULTS = {
  status: '',
  connection: '',
  recordType: '',
  owner: '',
  from: '',
  to: '',
  page: 1,
  sort: 'openedAt',
  dir: 'desc',
};

type SortField = 'openedAt' | 'status' | 'connectionName' | 'resolvedAt';

const OPEN: readonly IntegrationExceptionsStatus[] = ['open', 'investigating'];

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(INTEGRATIONS_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-15-exceptions', DEFAULTS);
  const people = usePeopleOptions();
  const recordTypes: readonly IntegrationRecordType[] = canManage
    ? INTEGRATION_RECORD_TYPES
    : TENDER_OWNER_EXCEPTION_RECORD_TYPES;
  const connections = useApiQuery(
    operationsEndpoints.listIntegrations,
    canManage ? { query: { pageSize: 100, sort: 'name' } } : null,
  );
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.status === '' ? {} : { status: [filters.status as IntegrationExceptionsStatus] }),
    ...(filters.connection === '' ? {} : { connectionId: Number(filters.connection) }),
    ...(filters.recordType === ''
      ? {}
      : { recordType: [filters.recordType as IntegrationRecordType] }),
    ...(filters.owner === '' ? {} : { ownerUserId: Number(filters.owner) }),
    ...(filters.from === '' ? {} : { openedFrom: filters.from }),
    ...(filters.to === '' ? {} : { openedTo: filters.to }),
  };
  const exceptions = useApiQuery(operationsEndpoints.listIntegrationExceptions, { query });
  const all = useApiQuery(operationsEndpoints.listIntegrationExceptions, {
    query: { pageSize: 100 },
  });
  const rows = all.data?.items;
  const count = (predicate: (row: IntegrationExceptionRow) => boolean): string | null =>
    rows === undefined ? null : formatCount(rows.filter(predicate).length);
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.status !== '' ||
    filters.connection !== '' ||
    filters.recordType !== '' ||
    filters.owner !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  return (
    <ServiceLayout>
      <PageHeader
        title={t('admin-integrations.exceptions.title')}
        subtitle={t('admin-integrations.exceptions.subtitle')}
      />
      <Banner tone="warning" title={t('admin-integrations.exceptions.ruleTitle')}>
        <p>{t('admin-integrations.exceptions.rule')}</p>
        {!canManage && <p>{t('admin-integrations.exceptions.scopedNote')}</p>}
      </Banner>
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <Select
          label={t('admin-integrations.exceptions.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('integration_exceptions.status')}
        />
        {canManage && (
          <Select
            label={t('admin-integrations.exceptions.col.connection')}
            placeholder={t('ops.common.all')}
            value={filters.connection}
            onChange={(value) => update({ connection: value })}
            options={(connections.data?.items ?? []).map((row) => ({
              value: String(row.id),
              label: row.name,
            }))}
          />
        )}
        <Select
          label={t('admin-integrations.exceptions.recordType')}
          placeholder={t('ops.common.all')}
          value={filters.recordType}
          onChange={(value) => update({ recordType: value })}
          options={recordTypes.map((value) => ({
            value,
            label: t(`admin-integrations.recordType.${value}`),
          }))}
        />
        <Select
          label={t('admin-integrations.exceptions.col.owner')}
          placeholder={t('ops.common.all')}
          value={filters.owner}
          onChange={(value) => update({ owner: value })}
          options={people}
        />
        <DateInput
          label={t('admin-integrations.exceptions.from')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('admin-integrations.exceptions.to')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-integrations.exceptions.kpi.open')}
          icon="alertTriangle"
          tone="danger"
          value={count((row) => OPEN.includes(row.status))}
          hint={t('admin-integrations.exceptions.kpi.openHint')}
        />
        <KpiCard
          label={t('admin-integrations.exceptions.kpi.unassigned')}
          icon="userPlus"
          tone="warning"
          value={count((row) => OPEN.includes(row.status) && row.owner === null)}
          hint={t('admin-integrations.exceptions.kpi.unassignedHint')}
        />
        <KpiCard
          label={t('admin-integrations.exceptions.kpi.publications')}
          icon="globe"
          tone="info"
          value={count((row) => OPEN.includes(row.status) && row.recordType === 'publication')}
          hint={t('admin-integrations.exceptions.kpi.publicationsHint')}
        />
        <KpiCard
          label={t('admin-integrations.exceptions.kpi.resolved')}
          icon="checkCircle"
          tone="success"
          value={count((row) => !OPEN.includes(row.status))}
          hint={t('admin-integrations.exceptions.kpi.resolvedHint')}
        />
      </KpiGrid>
      <Card flush title={t('admin-integrations.exceptions.queue')}>
        <ExceptionsTable
          rows={exceptions.data?.items}
          timeZone={timeZone}
          caption={t('admin-integrations.exceptions.queue')}
          onOpen={(row) => navigate(servicePaths.exception(row.id))}
          loading={exceptions.isFetching}
          error={exceptions.error}
          onRetry={exceptions.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          pagination={
            exceptions.data === undefined
              ? undefined
              : {
                  page: exceptions.data.page,
                  pageSize: exceptions.data.pageSize,
                  total: exceptions.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
        />
      </Card>
    </ServiceLayout>
  );
}
