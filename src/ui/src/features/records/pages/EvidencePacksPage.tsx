/**
 * ADM-14 — Evidence packs (PRD §18.2, DD-16, DD-31): controlled exports of one record with its decision history,
 * each with a manifest of contents, versions, omissions (sealed content before opening is never included) and
 * redactions. Auditors and export holders authorize packs; downloads are audited.
 */
import { useState } from 'react';

import { EVIDENCE_PACK_SUBJECT_TYPES, recordsEndpoints } from '@contracts/records';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { Button, Card, DateInput, FilterBar, Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { ExportsTable } from '../../reports/components/ExportsTable';
import { compact, oneOf } from '../../reports/lib/shared';
import { EvidencePackDialog } from '../components/EvidencePackDialog';
import { RecordsHeader } from '../components/RecordsHeader';

const DEFAULTS = {
  subjectType: '',
  from: '',
  to: '',
  sort: 'requestedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function EvidencePacksPage() {
  const canCreate = usePermission('export.create');
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-14:packs', DEFAULTS);
  const [creating, setCreating] = useState(false);
  const subjectType = oneOf(filters.subjectType, EVIDENCE_PACK_SUBJECT_TYPES);
  const query = useApiQuery(recordsEndpoints.listEvidencePacks, {
    query: {
      ...compact({
        subjectType: subjectType === undefined ? undefined : [subjectType],
        from: filters.from,
        to: filters.to,
      }),
      sort: oneOf(filters.sort, ['requestedAt', 'status'] as const),
      dir: filters.dir === 'asc' ? 'asc' : 'desc',
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  const data = query.data;
  const filtered = (['subjectType', 'from', 'to'] as const).some((key) => filters[key] !== '');

  return (
    <div className="tiq-page">
      <RecordsHeader
        subtitle={t('records.packs.intro')}
        primaryAction={
          canCreate ? (
            <Button variant="primary" icon="package" onClick={() => setCreating(true)}>
              {t('records.packs.create')}
            </Button>
          ) : undefined
        }
      />
      <FilterBar label={t('records.packs.filters')} onClear={clearFilters} canClear={filtered}>
        <Select
          label={t('records.packs.subjectType')}
          value={filters.subjectType}
          placeholder={t('records.all')}
          options={EVIDENCE_PACK_SUBJECT_TYPES.map((value) => ({
            value,
            label: t(`records.subjectTypes.${value}`),
          }))}
          onChange={(value) => setFilters({ subjectType: value, page: 1 })}
        />
        <DateInput
          label={t('records.packs.from')}
          value={filters.from}
          onChange={(value) => setFilters({ from: value, page: 1 })}
        />
        <DateInput
          label={t('records.packs.to')}
          value={filters.to}
          onChange={(value) => setFilters({ to: value, page: 1 })}
        />
      </FilterBar>
      <Card
        flush
        title={t('records.packs.title')}
        subtitle={data === undefined ? undefined : t('records.packs.count', { count: data.total })}
      >
        <ExportsTable
          caption={t('records.packs.title')}
          rows={data?.items}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          emptyTitle={filtered ? t('records.packs.noMatch') : t('records.packs.empty')}
          sort={{ key: filters.sort, dir: filters.dir === 'asc' ? 'asc' : 'desc' }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
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
      <EvidencePackDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => setCreating(false)}
      />
    </div>
  );
}
