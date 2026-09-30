/**
 * PUB-01 Public procurement home of one buyer (`/b/:buyerSlug`): buyer identity, active opportunities, future
 * notices (when the buyer shows them), recent awards (when enabled) and the buyer's own participation guidance.
 * Confidential tenders remain absent. An unknown buyer or a disabled portal answers PORTAL_NOT_AVAILABLE.
 */
import { useParams } from 'react-router';

import { publicationEndpoints } from '@contracts/publication';
import type { BuyerPortal } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import {
  ButtonLink,
  Card,
  CardLink,
  DetailList,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonBlock,
} from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { portalPaths } from '../../publication/lib/paths';
import { AdvanceNoticeList, GuidanceList, RecentOutcomeList } from '../components/PortalLists';
import { LanguagePicker, NoticeCards, RegistrationCallout } from '../components/PortalBits';
import { SimpleMarkdown } from '../components/SimpleMarkdown';

export default function BuyerPortalPage() {
  const { buyerSlug = '' } = useParams();
  const query = useApiQuery(publicationEndpoints.buyerPortal, { params: { buyerSlug } });

  if (
    query.error !== null &&
    (query.error.kind === 'not_found' || query.error.code === 'PORTAL_NOT_AVAILABLE')
  ) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('public-portal.buyer.unavailableTitle')}
          back={{ to: portalPaths.home, label: t('public-portal.actions.backHome') }}
        />
        <EmptyState
          icon="building"
          title={t('public-portal.buyer.unavailableTitle')}
          description={t('public-portal.buyer.unavailable')}
          action={
            <ButtonLink to={portalPaths.search}>{t('public-portal.home.browseAll')}</ButtonLink>
          }
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('public-portal.buyer.loadingTitle')} />
        {query.error === null ? (
          <SkeletonBlock lines={6} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return <BuyerView data={query.data} />;
}

function BuyerView({ data }: { readonly data: BuyerPortal }) {
  const { buyer } = data;
  const searchPath = `${portalPaths.search}?buyer=${encodeURIComponent(buyer.slug)}`;
  return (
    <div className="tiq-page">
      <PageHeader
        title={buyer.name}
        subtitle={buyer.portalIntro ?? undefined}
        back={{ to: portalPaths.home, label: t('public-portal.actions.backHome') }}
        actions={
          <ButtonLink to={searchPath} variant="primary" icon="search">
            {t('public-portal.buyer.searchBuyer')}
          </ButtonLink>
        }
      />
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('public-portal.buyer.identityTitle')}>
          <DetailList
            items={[
              { key: 'legal', label: t('public-portal.buyer.legalName'), value: buyer.legalName },
              {
                key: 'open',
                label: t('public-portal.buyer.openCount'),
                value: formatCount(buyer.openOpportunityCount),
              },
              {
                key: 'zone',
                label: t('public-portal.buyer.officialTime'),
                value: data.officialTimeZone,
              },
            ]}
          />
        </Card>
        <Card title={t('public-portal.language.title')}>
          <LanguagePicker languages={data.languages} />
        </Card>
      </div>

      <Card
        title={t('public-portal.buyer.openTitle')}
        actions={<CardLink to={searchPath}>{t('public-portal.home.seeAll')}</CardLink>}
      >
        <NoticeCards
          notices={data.openOpportunities}
          emptyTitle={t('public-portal.buyer.noOpen')}
        />
      </Card>

      {(data.showAdvanceNotices || data.showAwards) && (
        <div className="tiq-grid tiq-grid--2">
          {data.showAdvanceNotices && <AdvanceNoticeList notices={data.advanceNotices} />}
          {data.showAwards && <RecentOutcomeList outcomes={data.recentOutcomes} />}
        </div>
      )}

      <div className="tiq-grid tiq-grid--2">
        <Card
          title={t('public-portal.buyer.guidanceTitle', { buyer: buyer.name })}
          subtitle={t('public-portal.buyer.guidanceNote')}
        >
          {data.guidanceMarkdown === null ? (
            <EmptyState compact icon="bookOpen" title={t('public-portal.buyer.noGuidance')} />
          ) : (
            <SimpleMarkdown markdown={data.guidanceMarkdown} />
          )}
        </Card>
        <GuidanceList articles={data.guidance} />
      </div>
      <RegistrationCallout />
    </div>
  );
}
