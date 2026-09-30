/**
 * OPS-07 Product announcements: release notices and service messages with their audience, language, status and
 * publication. Actions: write an announcement, publish it after review. Product announcements are not formal tender
 * notices; those are issued from the tender by the buyer.
 */
import { useNavigate } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { Announcement } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { AnnouncementsAudience, AnnouncementsStatus } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  ButtonLink,
  Card,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ContentTabs } from '../components/SupportTabs';
import { personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { CONTENT_MANAGE } from '../lib/permissions';

const DEFAULTS = {
  q: '',
  status: '',
  audience: '',
  from: '',
  to: '',
  page: 1,
  sort: 'updatedAt',
  dir: 'desc',
};

type SortField = 'title' | 'audience' | 'status' | 'publishedAt' | 'updatedAt';

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CONTENT_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-07-announcements', DEFAULTS);
  const announcements = useApiQuery(operationsEndpoints.listAnnouncements, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as SortField,
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(filters.status === '' ? {} : { status: [filters.status as AnnouncementsStatus] }),
      ...(filters.audience === '' ? {} : { audience: [filters.audience as AnnouncementsAudience] }),
      ...(filters.from === '' ? {} : { publishedFrom: filters.from }),
      ...(filters.to === '' ? {} : { publishedTo: filters.to }),
    },
  });
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.audience !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('ops.content.title')}
        subtitle={t('ops.content.subtitle')}
        primaryAction={
          canManage ? (
            <ButtonLink variant="primary" icon="plus" to={opsPaths.announcementNew}>
              {t('ops.content.newAnnouncement')}
            </ButtonLink>
          ) : undefined
        }
      />
      <ContentTabs />
      <Banner tone="info" title={t('ops.content.distinctionTitle')}>
        <p>{t('ops.content.distinction')}</p>
      </Banner>
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('ops.content.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('ops.content.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('announcements.status')}
        />
        <Select
          label={t('ops.content.col.audience')}
          placeholder={t('ops.common.all')}
          value={filters.audience}
          onChange={(value) => update({ audience: value })}
          options={enumOptions('announcements.audience')}
        />
        <DateInput
          label={t('ops.content.filter.from')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('ops.content.filter.to')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>
      <Card flush title={t('ops.content.announcements')}>
        <DataTable<Announcement>
          caption={t('ops.content.announcements')}
          rows={announcements.data?.items}
          rowKey={(row) => String(row.id)}
          loading={announcements.isFetching}
          error={announcements.error}
          onRetry={announcements.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(opsPaths.announcement(row.id))}
          rowLabel={(row) => row.title}
          empty={<EmptyState compact icon="megaphone" title={t('ops.content.noAnnouncements')} />}
          pagination={
            announcements.data === undefined
              ? undefined
              : {
                  page: announcements.data.page,
                  pageSize: announcements.data.pageSize,
                  total: announcements.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'title',
              header: t('ops.content.col.title'),
              sortable: true,
              width: '36%',
              cell: (row) => (
                <>
                  <strong>{row.title}</strong>
                  <div className="tiq-cell-sub">{row.body.slice(0, 120)}</div>
                </>
              ),
            },
            {
              id: 'audience',
              header: t('ops.content.col.audience'),
              sortable: true,
              cell: (row) => (
                <StatusChip enum="announcements.audience" value={row.audience} size="sm" />
              ),
            },
            {
              id: 'language',
              header: t('ops.content.col.language'),
              cell: (row) => row.language.toUpperCase(),
            },
            {
              id: 'status',
              header: t('ops.content.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="announcements.status" value={row.status} />,
            },
            {
              id: 'publishedAt',
              header: t('ops.content.col.published'),
              sortable: true,
              cell: (row) =>
                row.publishedAt === null ? (
                  <span className="tiq-text-muted">{t('ops.content.notPublished')}</span>
                ) : (
                  <>
                    {formatDateTime(row.publishedAt, timeZone)}
                    <div className="tiq-cell-sub">{personName(row.publishedBy)}</div>
                  </>
                ),
            },
            {
              id: 'updatedAt',
              header: t('ops.content.col.updated'),
              sortable: true,
              cell: (row) => (
                <>
                  {formatDateTime(row.updatedAt, timeZone)}
                  <div className="tiq-cell-sub">{row.updatedBy.fullName}</div>
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
