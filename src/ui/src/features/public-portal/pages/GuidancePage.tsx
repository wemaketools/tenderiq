/**
 * PUB-07 Supplier participation guidance: registration, qualification, submission, complaint, accessibility and
 * contact guidance, searchable and filterable by topic. General guidance never overrides the binding conditions of a
 * particular tender, and the page says so.
 */
import { useSearchParams } from 'react-router';

import { HELP_ARTICLES_TOPIC } from '@contracts/enums';
import { GUIDANCE_SORT_FIELDS, publicationEndpoints } from '@contracts/publication';
import type { HelpArticleSummary } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  Reference,
  SearchField,
  Select,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { compact, directionOf, oneOf, sortOf, tableSort } from '../../publication/lib/lists';
import { portalPaths } from '../../publication/lib/paths';
import { languageName } from '../lib/viewer';

export default function GuidancePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const topic = params.get('topic') ?? '';
  const sort = sortOf(params.get('sort') ?? '', GUIDANCE_SORT_FIELDS, 'title');
  const dir = directionOf(params.get('dir') ?? 'asc');
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const update = (values: Record<string, string>): void => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!('page' in values)) next.delete('page');
    setParams(next, { replace: true });
  };

  const query = useApiQuery(publicationEndpoints.publicGuidance, {
    query: compact({
      q: q.trim(),
      topic: oneOf(topic, HELP_ARTICLES_TOPIC),
      sort,
      dir,
      page,
      pageSize: 25,
    }),
  });

  const columns: DataTableColumn<HelpArticleSummary>[] = [
    {
      id: 'title',
      header: t('public-portal.guidance.col.article'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.title} to={row.linkPath} />
          <span className="tiq-cell-sub">{row.excerpt}</span>
        </>
      ),
    },
    {
      id: 'topic',
      header: t('public-portal.guidance.col.topic'),
      sortable: true,
      cell: (row) => (
        <Chip tone="neutral" size="sm">
          {tEnum('help_articles.topic', row.topic)}
        </Chip>
      ),
    },
    {
      id: 'language',
      header: t('public-portal.guidance.col.language'),
      cell: (row) => languageName(row.language),
    },
    {
      id: 'publishedAt',
      header: t('public-portal.guidance.col.published'),
      sortable: true,
      cell: (row) => formatInstantDate(row.publishedAt, row.officialTimeZone),
    },
  ];

  const filtered = q !== '' || topic !== '';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('public-portal.guidance.pageTitle')}
        subtitle={t('public-portal.guidance.intro')}
        back={{ to: portalPaths.home, label: t('public-portal.actions.backHome') }}
      />
      <Banner tone="info" title={t('public-portal.guidance.bindingTitle')}>
        <p>{t('public-portal.guidance.binding')}</p>
      </Banner>
      <FilterBar
        label={t('public-portal.guidance.filters')}
        onClear={() => setParams({})}
        canClear={filtered}
      >
        <SearchField
          label={t('public-portal.search.keywords')}
          placeholder={t('public-portal.guidance.placeholder')}
          value={q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('public-portal.guidance.col.topic')}
          placeholder={t('public-portal.search.all')}
          value={topic}
          options={HELP_ARTICLES_TOPIC.map((value) => ({
            value,
            label: tEnum('help_articles.topic', value),
          }))}
          onChange={(value) => update({ topic: value })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('public-portal.guidance.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => row.slug}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(sort, dir)}
          onSortChange={(next) => update({ sort: next.key, dir: next.dir })}
          empty={
            <EmptyState
              compact
              icon="bookOpen"
              title={
                filtered
                  ? t('public-portal.guidance.emptyFiltered')
                  : t('public-portal.guidance.none')
              }
            />
          }
          pagination={
            query.data === undefined
              ? undefined
              : {
                  page: query.data.page,
                  pageSize: query.data.pageSize,
                  total: query.data.total,
                  onPageChange: (next) => update({ page: String(next) }),
                }
          }
        />
      </Card>
    </div>
  );
}
