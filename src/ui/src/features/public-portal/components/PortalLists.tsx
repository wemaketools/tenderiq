/**
 * Lists of the public homes (PUB-01): future notices (forecasts, never invitations to bid), recent outcomes and
 * participation guidance.
 */
import type {
  AdvanceNoticeTeaser,
  HelpArticleSummary,
  RecentOutcome,
} from '@contracts/publication';

import { Card, CardLink, Chip, EmptyState, Reference, StatusChip } from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { portalPaths } from '../../publication/lib/paths';

/** Future notices of one or more buyers; each date renders in its buyer's official zone (DD-33). */
export function AdvanceNoticeList({
  notices,
}: {
  readonly notices: readonly AdvanceNoticeTeaser[];
}) {
  return (
    <Card
      title={t('public-portal.plans.title')}
      subtitle={t('public-portal.plans.forecastNote')}
      actions={<CardLink to={portalPaths.plans}>{t('public-portal.plans.all')}</CardLink>}
    >
      {notices.length === 0 ? (
        <EmptyState compact icon="calendar" title={t('public-portal.plans.none')} />
      ) : (
        <ul className="tiq-stack tiq-stack--spaced">
          {notices.map((notice) => (
            <li key={notice.advanceNoticeId} className="tiq-stack">
              <span className="tiq-inline">
                <strong>{notice.title}</strong>
                <Chip tone="warning" size="sm" outlined>
                  {t('public-portal.plans.forecast')}
                </Chip>
              </span>
              <span className="tiq-text-muted">
                {t('public-portal.plans.meta', {
                  buyer: notice.buyer.name,
                  category: notice.category.name,
                  timing: notice.indicativeTiming,
                  published: formatInstantDate(notice.publishedAt, notice.buyer.officialTimeZone),
                })}
              </span>
              <span>{notice.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Released outcomes; an intention to award is labelled as such, never as a decision. */
export function RecentOutcomeList({ outcomes }: { readonly outcomes: readonly RecentOutcome[] }) {
  return (
    <Card
      title={t('public-portal.outcomes.title')}
      actions={<CardLink to={portalPaths.awards}>{t('public-portal.outcomes.all')}</CardLink>}
    >
      {outcomes.length === 0 ? (
        <EmptyState compact icon="award" title={t('public-portal.outcomes.none')} />
      ) : (
        <ul className="tiq-stack tiq-stack--spaced">
          {outcomes.map((outcome) => (
            <li key={`${outcome.buyer.slug}/${outcome.reference}`} className="tiq-stack">
              <span className="tiq-inline">
                <Reference value={outcome.reference} to={outcome.linkPath} />
                <strong>{outcome.title}</strong>
                <StatusChip enum="tenders.status" value={outcome.status} size="sm" />
              </span>
              <span className="tiq-text-muted">
                {t(outcomeMetaKey(outcome.status), {
                  buyer: outcome.buyer.name,
                  date: formatInstantDate(outcome.decidedAt, outcome.buyer.officialTimeZone),
                })}
              </span>
              <span>{outcome.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The wording of an outcome date: an intention to award or collected information is not an award decision. */
function outcomeMetaKey(status: RecentOutcome['status']): string {
  switch (status) {
    case 'award_pending':
      return 'public-portal.outcomes.metaIntention';
    case 'information_collected':
      return 'public-portal.outcomes.metaInformation';
    case 'cancelled':
      return 'public-portal.outcomes.metaCancelled';
    case 'completed_without_award':
      return 'public-portal.outcomes.metaWithoutAward';
    default:
      return 'public-portal.outcomes.meta';
  }
}

export function GuidanceList({ articles }: { readonly articles: readonly HelpArticleSummary[] }) {
  return (
    <Card
      title={t('public-portal.guidance.title')}
      subtitle={t('public-portal.guidance.generalNote')}
      actions={<CardLink to={portalPaths.guidance}>{t('public-portal.guidance.all')}</CardLink>}
    >
      {articles.length === 0 ? (
        <EmptyState compact icon="bookOpen" title={t('public-portal.guidance.none')} />
      ) : (
        <ul className="tiq-stack tiq-stack--spaced">
          {articles.map((article) => (
            <li key={article.slug} className="tiq-stack">
              <span className="tiq-inline">
                <CardLink to={article.linkPath}>{article.title}</CardLink>
                <Chip tone="neutral" size="sm">
                  {tEnum('help_articles.topic', article.topic)}
                </Chip>
              </span>
              <span className="tiq-text-muted">{article.excerpt}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
