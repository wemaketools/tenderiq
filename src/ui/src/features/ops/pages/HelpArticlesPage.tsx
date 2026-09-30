/**
 * OPS-07 Help content: guidance and training articles with topic, audience, language, status and publication.
 * Actions: write an article, publish it after review, archive it. General guidance never overrides the binding
 * conditions of a tender.
 */

import { operationsEndpoints } from '@contracts/operations';
import type { HelpArticleRow } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { HelpArticlesAudience, HelpArticlesStatus, HelpArticlesTopic } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
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
import { opsPaths } from '../lib/paths';
import { CONTENT_MANAGE } from '../lib/permissions';

const DEFAULTS = {
  q: '',
  status: '',
  topic: '',
  audience: '',
  from: '',
  to: '',
  page: 1,
  sort: 'updatedAt',
  dir: 'desc',
};

type SortField = 'title' | 'topic' | 'audience' | 'status' | 'publishedAt' | 'updatedAt';

export default function HelpArticlesPage() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CONTENT_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-07-help', DEFAULTS);
  const articles = useApiQuery(operationsEndpoints.listHelpArticles, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as SortField,
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(filters.status === '' ? {} : { status: [filters.status as HelpArticlesStatus] }),
      ...(filters.topic === '' ? {} : { topic: [filters.topic as HelpArticlesTopic] }),
      ...(filters.audience === '' ? {} : { audience: [filters.audience as HelpArticlesAudience] }),
      ...(filters.from === '' ? {} : { updatedFrom: filters.from }),
      ...(filters.to === '' ? {} : { updatedTo: filters.to }),
    },
  });
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.topic !== '' ||
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
            <ButtonLink variant="primary" icon="plus" to={opsPaths.helpArticleNew}>
              {t('ops.content.newArticle')}
            </ButtonLink>
          ) : undefined
        }
      />
      <ContentTabs />
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('ops.content.searchArticles')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('ops.content.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('help_articles.status')}
        />
        <Select
          label={t('ops.content.col.topic')}
          placeholder={t('ops.common.all')}
          value={filters.topic}
          onChange={(value) => update({ topic: value })}
          options={enumOptions('help_articles.topic')}
        />
        <Select
          label={t('ops.content.col.audience')}
          placeholder={t('ops.common.all')}
          value={filters.audience}
          onChange={(value) => update({ audience: value })}
          options={enumOptions('help_articles.audience')}
        />
        <DateInput
          label={t('ops.content.filter.updatedFrom')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('ops.content.filter.updatedTo')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>
      <Card flush title={t('ops.content.help')}>
        <DataTable<HelpArticleRow>
          caption={t('ops.content.help')}
          rows={articles.data?.items}
          rowKey={(row) => String(row.id)}
          loading={articles.isFetching}
          error={articles.error}
          onRetry={articles.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          rowHref={(row) => opsPaths.helpArticle(row.id)}
          rowLabel={(row) => row.title}
          empty={<EmptyState compact icon="bookOpen" title={t('ops.content.noArticles')} />}
          pagination={
            articles.data === undefined
              ? undefined
              : {
                  page: articles.data.page,
                  pageSize: articles.data.pageSize,
                  total: articles.data.total,
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
                  <div className="tiq-cell-sub">{row.excerpt}</div>
                </>
              ),
            },
            {
              id: 'topic',
              header: t('ops.content.col.topic'),
              sortable: true,
              cell: (row) => <StatusChip enum="help_articles.topic" value={row.topic} size="sm" />,
            },
            {
              id: 'audience',
              header: t('ops.content.col.audience'),
              sortable: true,
              cell: (row) => (
                <StatusChip enum="help_articles.audience" value={row.audience} size="sm" />
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
              cell: (row) => <StatusChip enum="help_articles.status" value={row.status} />,
            },
            {
              id: 'publishedAt',
              header: t('ops.content.col.published'),
              sortable: true,
              cell: (row) =>
                row.publishedAt === null ? (
                  <span className="tiq-text-muted">{t('ops.content.notPublished')}</span>
                ) : (
                  formatDateTime(row.publishedAt, timeZone)
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
