/**
 * ADM-14 — Disposal eligibility (PRD §18.3, BR-40, AC-35): disposal requests with their record class, scope,
 * disposition, eligibility check and status. A request whose records are under an active hold is BLOCKED, even when
 * the ordinary retention period has ended; approvers act on each request from its page.
 */
import { useNavigate } from 'react-router';

import { DISPOSAL_REQUESTS_STATUS, RETENTION_CLASSES_RECORD_CLASS } from '@contracts/enums';
import { DISPOSAL_SORT_FIELDS, recordsEndpoints } from '@contracts/records';
import type { DisposalRequestRow } from '@contracts/records';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { compact, oneOf } from '../../reports/lib/shared';
import { RecordsHeader } from '../components/RecordsHeader';
import { recordsPaths } from '../lib/permissions';

const DEFAULTS = {
  status: '',
  recordClass: '',
  from: '',
  to: '',
  sort: 'proposedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function DisposalsPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-14:disposals', DEFAULTS);
  const status = oneOf(filters.status, DISPOSAL_REQUESTS_STATUS);
  const recordClass = oneOf(filters.recordClass, RETENTION_CLASSES_RECORD_CLASS);
  const query = useApiQuery(recordsEndpoints.listDisposalRequests, {
    query: {
      ...compact({
        status: status === undefined ? undefined : [status],
        recordClass: recordClass === undefined ? undefined : [recordClass],
        from: filters.from,
        to: filters.to,
      }),
      sort: oneOf(filters.sort, DISPOSAL_SORT_FIELDS),
      dir: filters.dir === 'asc' ? 'asc' : 'desc',
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  const data = query.data;
  const filtered = (['status', 'recordClass', 'from', 'to'] as const).some(
    (key) => filters[key] !== '',
  );

  const columns: DataTableColumn<DisposalRequestRow>[] = [
    {
      id: 'scope',
      header: t('records.disposals.col.scope'),
      cell: (row) => (
        <>
          <span>{row.scopeLabel}</span>
          <span className="tiq-cell-sub">
            {t('records.disposals.entities', { count: row.entityCount, type: row.entityType })}
          </span>
        </>
      ),
    },
    {
      id: 'recordClass',
      header: t('records.disposals.col.class'),
      sortable: true,
      cell: (row) => tEnum('retention_classes.record_class', row.recordClass),
    },
    {
      id: 'disposition',
      header: t('records.disposals.col.disposition'),
      cell: (row) => tEnum('retention_classes.disposition', row.disposition),
    },
    {
      id: 'status',
      header: t('records.disposals.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="disposal_requests.status" value={row.status} size="sm" />
          {row.blockedByHoldIds.length > 0 && (
            <Chip tone="danger" size="sm" icon="lock" outlined>
              {t('records.disposals.heldBy', {
                holds: row.blockedByHoldIds
                  .map((id) => t('records.disposals.holdRef', { id }))
                  .join(', '),
              })}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'eligibility',
      header: t('records.disposals.col.checked'),
      cell: (row) => formatDateTime(row.eligibilityCheckedAt, timeZone),
    },
    {
      id: 'proposedAt',
      header: t('records.disposals.col.proposed'),
      sortable: true,
      cell: (row) => formatDateTime(row.proposedAt, timeZone),
    },
  ];

  return (
    <div className="tiq-page">
      <RecordsHeader subtitle={t('records.disposals.intro')} />
      <FilterBar label={t('records.disposals.filters')} onClear={clearFilters} canClear={filtered}>
        <Select
          label={t('records.disposals.status')}
          value={filters.status}
          placeholder={t('records.all')}
          options={DISPOSAL_REQUESTS_STATUS.map((value) => ({
            value,
            label: tEnum('disposal_requests.status', value),
          }))}
          onChange={(value) => setFilters({ status: value, page: 1 })}
        />
        <Select
          label={t('records.disposals.class')}
          value={filters.recordClass}
          placeholder={t('records.all')}
          options={RETENTION_CLASSES_RECORD_CLASS.map((value) => ({
            value,
            label: tEnum('retention_classes.record_class', value),
          }))}
          onChange={(value) => setFilters({ recordClass: value, page: 1 })}
        />
        <DateInput
          label={t('records.disposals.from')}
          value={filters.from}
          onChange={(value) => setFilters({ from: value, page: 1 })}
        />
        <DateInput
          label={t('records.disposals.to')}
          value={filters.to}
          onChange={(value) => setFilters({ to: value, page: 1 })}
        />
      </FilterBar>
      <Card
        flush
        title={t('records.disposals.title')}
        subtitle={
          data === undefined ? undefined : t('records.disposals.count', { count: data.total })
        }
      >
        <DataTable
          caption={t('records.disposals.title')}
          columns={columns}
          rows={data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => t('records.disposals.openNamed', { scope: row.scopeLabel })}
          onRowClick={(row) => void navigate(recordsPaths.disposal(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: filters.sort, dir: filters.dir === 'asc' ? 'asc' : 'desc' }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={<EmptyState compact icon="archive" title={t('records.disposals.empty')} />}
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
