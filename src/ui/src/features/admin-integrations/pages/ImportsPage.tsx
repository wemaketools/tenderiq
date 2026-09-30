/**
 * ADM-16 Imports, duplicate review and historical onboarding: batches with their origin, record type, status,
 * uploader and decision counts (pending, accepted, rejected, quality issues, duplicate candidates). Actions: start a
 * new import, open a batch to review its rows.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { ImportBatchRow } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { ImportBatchesRecordType, ImportBatchesStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  DataTable,
  DateInput,
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
import { NewImportDialog } from '../components/NewImportDialog';
import { usePeopleOptions } from '../components/people';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  recordType: '',
  status: '',
  uploader: '',
  from: '',
  to: '',
  page: 1,
  sort: 'uploadedAt',
  dir: 'desc',
};

type SortField = 'uploadedAt' | 'origin' | 'recordType' | 'status';

export default function ImportsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [creating, setCreating] = useState(false);
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-16', DEFAULTS);
  const people = usePeopleOptions();
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.recordType === ''
      ? {}
      : { recordType: [filters.recordType as ImportBatchesRecordType] }),
    ...(filters.status === '' ? {} : { status: [filters.status as ImportBatchesStatus] }),
    ...(filters.uploader === '' ? {} : { uploadedByUserId: Number(filters.uploader) }),
    ...(filters.from === '' ? {} : { uploadedFrom: filters.from }),
    ...(filters.to === '' ? {} : { uploadedTo: filters.to }),
  };
  const batches = useApiQuery(operationsEndpoints.listImportBatches, { query });
  const all = useApiQuery(operationsEndpoints.listImportBatches, { query: { pageSize: 100 } });
  const rows = all.data?.items;
  const sum = (pick: (row: ImportBatchRow) => number): string | null =>
    rows === undefined ? null : formatCount(rows.reduce((total, row) => total + pick(row), 0));
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.recordType !== '' ||
    filters.status !== '' ||
    filters.uploader !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  return (
    <ServiceLayout>
      <PageHeader
        title={t('admin-integrations.imports.title')}
        subtitle={t('admin-integrations.imports.subtitle')}
        primaryAction={
          <Button variant="primary" icon="upload" onClick={() => setCreating(true)}>
            {t('admin-integrations.imports.new.open')}
          </Button>
        }
      />
      <Banner tone="info" title={t('admin-integrations.imports.ruleTitle')}>
        <p>{t('admin-integrations.imports.rule')}</p>
      </Banner>
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('admin-integrations.imports.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('admin-integrations.imports.col.recordType')}
          placeholder={t('ops.common.all')}
          value={filters.recordType}
          onChange={(value) => update({ recordType: value })}
          options={enumOptions('import_batches.record_type')}
        />
        <Select
          label={t('admin-integrations.imports.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('import_batches.status')}
        />
        <Select
          label={t('admin-integrations.imports.col.uploadedBy')}
          placeholder={t('ops.common.all')}
          value={filters.uploader}
          onChange={(value) => update({ uploader: value })}
          options={people}
        />
        <DateInput
          label={t('admin-integrations.imports.from')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('admin-integrations.imports.to')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-integrations.imports.kpi.pending')}
          icon="hourglass"
          tone="warning"
          value={sum((row) => row.counts.pending)}
          hint={t('admin-integrations.imports.kpi.pendingHint')}
        />
        <KpiCard
          label={t('admin-integrations.imports.kpi.quality')}
          icon="alertTriangle"
          tone="danger"
          value={sum((row) => row.counts.withQualityIssues)}
          hint={t('admin-integrations.imports.kpi.qualityHint')}
        />
        <KpiCard
          label={t('admin-integrations.imports.kpi.duplicates')}
          icon="copy"
          tone="info"
          value={sum((row) => row.counts.withDuplicateCandidates)}
          hint={t('admin-integrations.imports.kpi.duplicatesHint')}
        />
        <KpiCard
          label={t('admin-integrations.imports.kpi.accepted')}
          icon="checkCircle"
          tone="success"
          value={sum((row) => row.counts.accepted)}
          hint={t('admin-integrations.imports.kpi.acceptedHint')}
        />
      </KpiGrid>
      <Card flush title={t('admin-integrations.imports.register')}>
        <DataTable<ImportBatchRow>
          caption={t('admin-integrations.imports.register')}
          rows={batches.data?.items}
          rowKey={(row) => String(row.id)}
          loading={batches.isFetching}
          error={batches.error}
          onRetry={batches.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(servicePaths.importBatch(row.id))}
          rowLabel={(row) => t('admin-integrations.imports.rowLabel', { origin: row.origin })}
          empty={
            <EmptyState
              compact
              icon="upload"
              title={t('admin-integrations.imports.empty')}
              description={t('admin-integrations.imports.emptyHint')}
            />
          }
          pagination={
            batches.data === undefined
              ? undefined
              : {
                  page: batches.data.page,
                  pageSize: batches.data.pageSize,
                  total: batches.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'origin',
              header: t('admin-integrations.imports.col.origin'),
              sortable: true,
              width: '28%',
              cell: (row) => (
                <>
                  <strong>{row.origin}</strong>
                  <div className="tiq-cell-sub tiq-mono">{row.sourceFileName}</div>
                </>
              ),
            },
            {
              id: 'recordType',
              header: t('admin-integrations.imports.col.recordType'),
              sortable: true,
              cell: (row) => (
                <StatusChip enum="import_batches.record_type" value={row.recordType} size="sm" />
              ),
            },
            {
              id: 'status',
              header: t('admin-integrations.imports.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="import_batches.status" value={row.status} />,
            },
            {
              id: 'counts',
              header: t('admin-integrations.imports.col.rows'),
              cell: (row) => (
                <>
                  {t('admin-integrations.imports.countsValue', {
                    total: row.counts.total,
                    pending: row.counts.pending,
                    accepted: row.counts.accepted,
                    rejected: row.counts.rejected,
                  })}
                  <div className="tiq-cell-sub">
                    {t('admin-integrations.imports.issuesValue', {
                      quality: row.counts.withQualityIssues,
                      duplicates: row.counts.withDuplicateCandidates,
                    })}
                  </div>
                </>
              ),
            },
            {
              id: 'uploadedAt',
              header: t('admin-integrations.imports.col.uploaded'),
              sortable: true,
              cell: (row) => (
                <>
                  {formatDateTime(row.uploadedAt, timeZone)}
                  <div className="tiq-cell-sub">{row.uploadedBy.fullName}</div>
                </>
              ),
            },
            {
              id: 'review',
              header: t('admin-integrations.imports.col.review'),
              cell: (row) =>
                row.completedAt === null ? (
                  <span className="tiq-text-warning">
                    {t('admin-integrations.imports.inReview')}
                  </span>
                ) : (
                  <>
                    {formatDateTime(row.completedAt, timeZone)}
                    {row.reviewedBy !== null && (
                      <div className="tiq-cell-sub">{row.reviewedBy.fullName}</div>
                    )}
                  </>
                ),
            },
          ]}
        />
      </Card>
      {creating && (
        <NewImportDialog
          onClose={() => setCreating(false)}
          onCreated={(batch) => {
            setCreating(false);
            toast.show(t('admin-integrations.imports.new.done'), 'success');
            navigate(servicePaths.importBatch(batch.id));
          }}
        />
      )}
    </ServiceLayout>
  );
}
