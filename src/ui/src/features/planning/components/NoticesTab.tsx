/**
 * BUY-05 advance notices: drafts, published and withdrawn notices of planned procurements. Publishing (on the notice
 * page) puts a notice on the public plans page (PUB-06), where it is shown as a forecast, never an invitation.
 */
import { Link, useNavigate } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { AdvanceNoticeRow } from '@contracts/requests';
import type { AdvanceNoticesStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableSort } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { enumOptions, planningPaths } from '../lib';

const DEFAULT_FILTERS = { q: '', status: '', page: 1, sort: 'updatedAt', dir: 'desc' };

type SortField = 'title' | 'publishedAt' | 'status' | 'updatedAt';

export function NoticesTab() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-05.notices', DEFAULT_FILTERS);
  const notices = useApiQuery(requestEndpoints.listAdvanceNotices, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as SortField,
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(filters.status === '' ? {} : { status: [filters.status as AdvanceNoticesStatus] }),
    },
  });
  const canClear = filters.q !== '' || filters.status !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };

  return (
    <div className="tiq-stack">
      <FilterBar onClear={clearFilters} canClear={canClear} label={t('planning.notices.filters')}>
        <SearchField
          label={t('planning.filters.search')}
          placeholder={t('planning.notices.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => setFilters({ q: value, page: 1 })}
        />
        <Select
          label={t('planning.filters.status')}
          value={filters.status}
          onChange={(value) => setFilters({ status: value, page: 1 })}
          placeholder={t('planning.filters.allStatuses')}
          options={enumOptions('advance_notices.status')}
        />
      </FilterBar>
      <Card flush title={t('planning.notices.table')}>
        <DataTable<AdvanceNoticeRow>
          caption={t('planning.notices.table')}
          rows={notices.data?.items}
          rowKey={(row) => String(row.id)}
          loading={notices.isFetching}
          error={notices.error}
          onRetry={notices.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(planningPaths.notice(row.id))}
          rowLabel={(row) => row.title}
          empty={
            <EmptyState
              compact
              icon="megaphone"
              title={t('planning.notices.empty')}
              description={t('planning.notices.emptyHint')}
            />
          }
          pagination={
            notices.data === undefined
              ? undefined
              : {
                  page: notices.data.page,
                  pageSize: notices.data.pageSize,
                  total: notices.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'title',
              header: t('planning.notices.col.notice'),
              sortable: true,
              cell: (row) => (
                <>
                  <Link to={planningPaths.notice(row.id)}>{row.title}</Link>
                  <div className="tiq-cell-sub">{row.summary}</div>
                </>
              ),
            },
            {
              id: 'planItem',
              header: t('planning.notices.col.planItem'),
              cell: (row) => (
                <>
                  {row.planItem.title}
                  <div>
                    <div>
                      <StatusChip enum="plan_items.status" value={row.planItem.status} size="sm" />
                    </div>
                  </div>
                </>
              ),
            },
            {
              id: 'category',
              header: t('planning.notices.col.category'),
              cell: (row) => row.category?.name ?? '',
            },
            {
              id: 'timing',
              header: t('planning.notices.col.timing'),
              cell: (row) => (
                <>
                  {row.indicativeTiming}
                  {row.estimatedValueBand !== null && (
                    <div className="tiq-cell-sub">{row.estimatedValueBand}</div>
                  )}
                </>
              ),
            },
            {
              id: 'status',
              header: t('planning.notices.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="advance_notices.status" value={row.status} />,
            },
            {
              id: 'publishedAt',
              header: t('planning.notices.col.published'),
              sortable: true,
              cell: (row) =>
                row.publishedAt === null ? (
                  <span className="tiq-text-muted">{t('planning.notices.notPublished')}</span>
                ) : (
                  <>
                    {formatDateTime(row.publishedAt, timeZone)}
                    {row.publishedBy !== null && (
                      <div className="tiq-cell-sub">{row.publishedBy.fullName}</div>
                    )}
                  </>
                ),
            },
            {
              id: 'public',
              header: t('planning.notices.col.public'),
              cell: (row) =>
                row.publicPath === null ? (
                  ''
                ) : (
                  <Reference value={t('planning.notices.publicLink')} to={row.publicPath} />
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
