/**
 * COM-09 guidance article: the article text with its topic and audience, the reminder that general guidance never
 * overrides a tender's binding conditions, and related articles.
 */
import { useNavigate, useParams } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { MyHelpArticle } from '@contracts/operations';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  QueryView,
  StatusChip,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ArticleBody } from '../components/ArticleBody';
import { helpPaths } from '../lib/paths';

export default function HelpArticlePage() {
  const navigate = useNavigate();
  const { articleSlug } = useParams();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const article = useApiQuery(operationsEndpoints.getMyHelpArticle, {
    params: { articleSlug: articleSlug ?? '' },
  });
  return (
    <div className="tiq-page">
      {article.data === undefined && (
        <PageHeader
          title={t('help.article.title')}
          back={{ to: helpPaths.home, label: t('help.title') }}
        />
      )}
      <QueryView query={article}>
        {(data) => (
          <>
            <PageHeader
              title={data.title}
              subtitle={data.excerpt}
              back={{ to: helpPaths.home, label: t('help.title') }}
              meta={
                <>
                  <StatusChip enum="help_articles.topic" value={data.topic} />
                  <StatusChip enum="help_articles.audience" value={data.audience} />
                  <span>
                    {t('help.article.updated', { at: formatDateTime(data.updatedAt, timeZone) })}
                  </span>
                </>
              }
            />
            <Banner tone="info" title={t('help.article.bindingTitle')}>
              <p>{data.bindingNote}</p>
            </Banner>
            <div className="tiq-grid tiq-grid--sidebar">
              <Card>
                <ArticleBody markdown={data.bodyMarkdown} />
              </Card>
              <Card flush title={t('help.article.related')}>
                <DataTable<MyHelpArticle>
                  caption={t('help.article.related')}
                  rows={data.related}
                  rowKey={(row) => String(row.id)}
                  onRowClick={(row) => navigate(helpPaths.article(row.slug))}
                  rowLabel={(row) => t('help.guidance.rowLabel', { title: row.title })}
                  empty={<EmptyState compact title={t('help.article.noRelated')} />}
                  columns={[
                    {
                      id: 'title',
                      header: t('help.guidance.col.article'),
                      cell: (row) => (
                        <>
                          <strong>{row.title}</strong>
                          <div className="tiq-cell-sub">{row.excerpt}</div>
                        </>
                      ),
                    },
                  ]}
                />
              </Card>
            </div>
          </>
        )}
      </QueryView>
    </div>
  );
}
