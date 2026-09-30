/**
 * ADM-13 — Controlled export history (PRD §13.2, DD-16): every report, evidence-pack and other export the caller may
 * see, with its scope, format, status, requester and time, a link to the manifest, and the audited download of a
 * ready export. Callers without report.manage or audit.view see their own exports only.
 */
import { EXPORTS_EXPORT_TYPE, EXPORTS_FORMAT, EXPORTS_STATUS } from '@contracts/enums';
import { EXPORT_SORT_FIELDS, reportingEndpoints } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { Banner, Card, DateInput, FilterBar, Select } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { ExportsTable } from '../components/ExportsTable';
import { ReportAdminHeader } from '../components/ReportAdminTabs';
import { compact, oneOf } from '../lib/shared';

const DEFAULTS = {
  exportType: '',
  status: '',
  format: '',
  from: '',
  to: '',
  sort: 'requestedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function ExportsPage() {
  const seesAll = usePermission(['report.manage', 'audit.view']);
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-13:exports', DEFAULTS);
  const exportType = oneOf(filters.exportType, EXPORTS_EXPORT_TYPE);
  const status = oneOf(filters.status, EXPORTS_STATUS);
  const format = oneOf(filters.format, EXPORTS_FORMAT);
  const query = useApiQuery(reportingEndpoints.listExports, {
    query: {
      ...compact({
        exportType: exportType === undefined ? undefined : [exportType],
        status: status === undefined ? undefined : [status],
        format: format === undefined ? undefined : [format],
        from: filters.from,
        to: filters.to,
      }),
      sort: oneOf(filters.sort, EXPORT_SORT_FIELDS),
      dir: filters.dir === 'asc' ? 'asc' : 'desc',
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  const data = query.data;
  const filtered = (['exportType', 'status', 'format', 'from', 'to'] as const).some(
    (key) => filters[key] !== '',
  );

  return (
    <div className="tiq-page">
      <ReportAdminHeader />
      {!seesAll && (
        <Banner tone="info" title={t('reports.exports.ownOnlyTitle')}>
          <p>{t('reports.exports.ownOnly')}</p>
        </Banner>
      )}
      <FilterBar label={t('reports.exports.filters')} onClear={clearFilters} canClear={filtered}>
        <Select
          label={t('reports.exports.type')}
          value={filters.exportType}
          placeholder={t('reports.report.all')}
          options={EXPORTS_EXPORT_TYPE.map((value) => ({
            value,
            label: tEnum('exports.export_type', value),
          }))}
          onChange={(value) => setFilters({ exportType: value, page: 1 })}
        />
        <Select
          label={t('reports.exports.status')}
          value={filters.status}
          placeholder={t('reports.report.all')}
          options={EXPORTS_STATUS.map((value) => ({
            value,
            label: tEnum('exports.status', value),
          }))}
          onChange={(value) => setFilters({ status: value, page: 1 })}
        />
        <Select
          label={t('reports.exports.format')}
          value={filters.format}
          placeholder={t('reports.report.all')}
          options={EXPORTS_FORMAT.map((value) => ({ value, label: value.toUpperCase() }))}
          onChange={(value) => setFilters({ format: value, page: 1 })}
        />
        <DateInput
          label={t('reports.exports.from')}
          value={filters.from}
          onChange={(value) => setFilters({ from: value, page: 1 })}
        />
        <DateInput
          label={t('reports.exports.to')}
          value={filters.to}
          onChange={(value) => setFilters({ to: value, page: 1 })}
        />
      </FilterBar>
      <Card
        flush
        title={t('reports.exports.title')}
        subtitle={
          data === undefined ? undefined : t('reports.exports.count', { count: data.total })
        }
      >
        <ExportsTable
          caption={t('reports.exports.title')}
          rows={data?.items}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          emptyTitle={filtered ? t('reports.exports.noMatch') : t('reports.exports.empty')}
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
    </div>
  );
}
