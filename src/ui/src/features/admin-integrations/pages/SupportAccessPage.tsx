/**
 * Support access authorization (OPS-04, customer side; DD-23): every request by platform support to look at this
 * organization's records, with the case, business need, permitted records, requested duration and status. The
 * organization administrator authorizes, narrows, denies or revokes each grant; support never gets access otherwise.
 */
import { useNavigate } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { CustomerSupportGrant } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { SupportAccessGrantsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  Select,
  StatusChip,
} from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';
import { grantWindow } from '../../ops/lib/grants';

const DEFAULTS = { status: '', page: 1, sort: 'requestedAt', dir: 'desc' };

export default function SupportAccessPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-04-customer', DEFAULTS);
  const grants = useApiQuery(operationsEndpoints.listCustomerSupportGrants, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as 'requestedAt' | 'expiresAt' | 'status',
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.status === '' ? {} : { status: [filters.status as SupportAccessGrantsStatus] }),
    },
  });
  const all = useApiQuery(operationsEndpoints.listCustomerSupportGrants, {
    query: { pageSize: 100 },
  });
  const rows = all.data?.items;
  const count = (status: SupportAccessGrantsStatus): string | null =>
    rows === undefined ? null : formatCount(rows.filter((row) => row.status === status).length);

  return (
    <ServiceLayout>
      <PageHeader
        title={t('admin-integrations.support.title')}
        subtitle={t('admin-integrations.support.subtitle')}
      />
      <Banner tone="info" title={t('admin-integrations.support.ruleTitle')}>
        <p>{t('admin-integrations.support.rule')}</p>
      </Banner>
      <FilterBar onClear={clearFilters} canClear={filters.status !== ''}>
        <Select
          label={t('ops.grants.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => setFilters({ status: value, page: 1 })}
          options={enumOptions('support_access_grants.status')}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-integrations.support.kpi.requested')}
          icon="bell"
          tone="warning"
          value={count('requested')}
          hint={t('admin-integrations.support.kpi.requestedHint')}
        />
        <KpiCard
          label={t('admin-integrations.support.kpi.active')}
          icon="key"
          tone="info"
          value={count('active')}
          hint={t('admin-integrations.support.kpi.activeHint')}
        />
        <KpiCard
          label={t('admin-integrations.support.kpi.revoked')}
          icon="ban"
          tone="danger"
          value={count('revoked')}
          hint={t('admin-integrations.support.kpi.revokedHint')}
        />
        <KpiCard
          label={t('admin-integrations.support.kpi.expired')}
          icon="clock"
          value={count('expired')}
          hint={t('admin-integrations.support.kpi.expiredHint')}
        />
      </KpiGrid>
      <Card flush title={t('admin-integrations.support.register')}>
        <DataTable<CustomerSupportGrant>
          caption={t('admin-integrations.support.register')}
          rows={grants.data?.items}
          rowKey={(row) => String(row.id)}
          loading={grants.isFetching}
          error={grants.error}
          onRetry={grants.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(servicePaths.supportGrant(row.id))}
          rowLabel={(row) =>
            t('admin-integrations.support.rowLabel', { reference: row.caseReference })
          }
          empty={
            <EmptyState
              compact
              icon="key"
              title={t('admin-integrations.support.empty')}
              description={t('admin-integrations.support.emptyHint')}
            />
          }
          pagination={
            grants.data === undefined
              ? undefined
              : {
                  page: grants.data.page,
                  pageSize: grants.data.pageSize,
                  total: grants.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'case',
              header: t('admin-integrations.support.col.case'),
              width: '28%',
              cell: (row) => (
                <>
                  <span className="tiq-mono">{row.caseReference}</span>
                  <div className="tiq-cell-sub">{row.caseSubject}</div>
                </>
              ),
            },
            { id: 'need', header: t('ops.grants.col.need'), cell: (row) => row.businessNeed },
            {
              id: 'operator',
              header: t('ops.grants.col.operator'),
              cell: (row) => row.operator.fullName,
            },
            {
              id: 'scope',
              header: t('ops.grants.col.scope'),
              cell: (row) => (
                <>
                  <StatusChip enum="support_access_grants.scope" value={row.scope} size="sm" />
                  {row.recordRefs.length > 0 && (
                    <div className="tiq-cell-sub tiq-mono">{row.recordRefs.join(', ')}</div>
                  )}
                </>
              ),
            },
            {
              id: 'requestedAt',
              header: t('admin-integrations.support.col.requested'),
              sortable: true,
              cell: (row) => (
                <>
                  {formatDateTime(row.requestedAt, timeZone)}
                  <div className="tiq-cell-sub">
                    {t('admin-integrations.support.days', { count: row.requestedDays })}
                  </div>
                </>
              ),
            },
            {
              id: 'expiresAt',
              header: t('ops.grants.col.window'),
              sortable: true,
              cell: (row) => grantWindow(row, timeZone),
            },
            {
              id: 'status',
              header: t('ops.grants.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="support_access_grants.status" value={row.status} />,
            },
          ]}
        />
      </Card>
    </ServiceLayout>
  );
}
