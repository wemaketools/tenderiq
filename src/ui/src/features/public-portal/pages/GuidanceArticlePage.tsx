/**
 * PUB-07 one guidance article: the published text, its topic and dates, and related articles. General guidance never
 * overrides the binding conditions of a particular tender.
 */
import { useParams } from 'react-router';

import { publicationEndpoints } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonBlock,
} from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { portalPaths } from '../../publication/lib/paths';
import { GuidanceList } from '../components/PortalLists';
import { SimpleMarkdown } from '../components/SimpleMarkdown';

export default function GuidanceArticlePage() {
  const { articleSlug = '' } = useParams();
  const query = useApiQuery(publicationEndpoints.publicGuidanceArticle, {
    params: { articleSlug },
  });
  const back = { to: portalPaths.guidance, label: t('public-portal.guidance.back') };

  if (
    query.error !== null &&
    (query.error.kind === 'not_found' || query.error.kind === 'validation')
  ) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('public-portal.guidance.notFoundTitle')} back={back} />
        <EmptyState
          icon="bookOpen"
          title={t('public-portal.guidance.notFoundTitle')}
          description={t('public-portal.guidance.notFound')}
          action={
            <ButtonLink to={portalPaths.guidance}>{t('public-portal.guidance.back')}</ButtonLink>
          }
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('public-portal.guidance.loadingTitle')} back={back} />
        {query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  const article = query.data;
  return (
    <div className="tiq-page">
      <PageHeader
        title={article.title}
        subtitle={article.excerpt}
        back={back}
        meta={
          <>
            <Chip tone="neutral" size="sm">
              {tEnum('help_articles.topic', article.topic)}
            </Chip>
            <span className="tiq-text-muted">
              {t('public-portal.guidance.dates', {
                published: formatInstantDate(article.publishedAt, article.officialTimeZone),
                updated: formatInstantDate(article.updatedAt, article.officialTimeZone),
              })}
            </span>
          </>
        }
      />
      <Banner tone="info">
        <p>{t('public-portal.guidance.binding')}</p>
      </Banner>
      <div className="tiq-grid tiq-grid--sidebar">
        <Card>
          <SimpleMarkdown markdown={article.bodyMarkdown} />
        </Card>
        <GuidanceList articles={article.related} />
      </div>
    </div>
  );
}
