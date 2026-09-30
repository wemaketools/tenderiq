/**
 * PUB-01 Public procurement home (global): the buyers with a public portal, open opportunities, future notices,
 * recent outcomes and participation guidance, browsable without an account. Invitation-only and restricted events
 * never appear, not even in counts (AC-01). Visitors choose the portal language and navigate to registration.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { publicationEndpoints } from '@contracts/publication';
import type { PortalHome } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import {
  ButtonLink,
  Card,
  CardLink,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  SearchField,
} from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { portalPaths } from '../../publication/lib/paths';
import { AdvanceNoticeList, GuidanceList, RecentOutcomeList } from '../components/PortalLists';
import { LanguagePicker, NoticeCards, RegistrationCallout } from '../components/PortalBits';

export default function PortalHomePage() {
  const home = useApiQuery(publicationEndpoints.portalHome, {});
  return (
    <div className="tiq-page">
      <PageHeader title={t('public-portal.home.title')} subtitle={t('public-portal.home.intro')} />
      <QueryView query={home} errorTitle={t('public-portal.home.unavailable')}>
        {(data) => <HomeView data={data} />}
      </QueryView>
    </div>
  );
}

function HomeView({ data }: { readonly data: PortalHome }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const search = (value: string): void => {
    const text = value.trim();
    void navigate(
      text === '' ? portalPaths.search : `${portalPaths.search}?q=${encodeURIComponent(text)}`,
    );
  };

  return (
    <>
      <Card>
        <div className="tiq-form-grid">
          <SearchField
            label={t('public-portal.home.searchLabel')}
            placeholder={t('public-portal.home.searchPlaceholder')}
            value={q}
            onChange={setQ}
            onSubmit={search}
            full
          />
          <LanguagePicker languages={data.languages} />
        </div>
        <div className="tiq-inline">
          <ButtonLink to={portalPaths.search} variant="primary" icon="search">
            {t('public-portal.home.browseAll')}
          </ButtonLink>
          <ButtonLink to={portalPaths.plans} icon="calendar">
            {t('public-portal.home.plans')}
          </ButtonLink>
          <ButtonLink to={portalPaths.awards} icon="award">
            {t('public-portal.home.awards')}
          </ButtonLink>
        </div>
      </Card>

      <KpiGrid>
        <KpiCard
          label={t('public-portal.home.kpi.open')}
          icon="megaphone"
          value={formatCount(data.openOpportunityCount)}
          hint={t('public-portal.home.kpi.openHint')}
          to={`${portalPaths.search}?status=open`}
        />
        <KpiCard
          label={t('public-portal.home.kpi.buyers')}
          icon="building"
          tone="info"
          value={formatCount(data.buyers.length)}
          hint={t('public-portal.home.kpi.buyersHint')}
        />
        <KpiCard
          label={t('public-portal.home.kpi.plans')}
          icon="calendar"
          tone="warning"
          value={formatCount(data.advanceNotices.length)}
          hint={t('public-portal.home.kpi.plansHint')}
          to={portalPaths.plans}
        />
        <KpiCard
          label={t('public-portal.home.kpi.outcomes')}
          icon="award"
          tone="success"
          value={formatCount(data.recentOutcomes.length)}
          hint={t('public-portal.home.kpi.outcomesHint')}
          to={portalPaths.awards}
        />
      </KpiGrid>

      <Card
        title={t('public-portal.home.openTitle')}
        subtitle={t('public-portal.home.openIntro')}
        actions={<CardLink to={portalPaths.search}>{t('public-portal.home.seeAll')}</CardLink>}
      >
        <NoticeCards notices={data.openOpportunities} emptyTitle={t('public-portal.home.noOpen')} />
      </Card>

      <Card title={t('public-portal.home.buyersTitle')}>
        {data.buyers.length === 0 ? (
          <EmptyState compact icon="building" title={t('public-portal.home.noBuyers')} />
        ) : (
          <div className="tiq-grid tiq-grid--2">
            {data.buyers.map((buyer) => (
              <Card
                key={buyer.slug}
                headingLevel={3}
                title={buyer.name}
                subtitle={buyer.legalName}
                footer={
                  <ButtonLink to={buyer.linkPath} size="sm" iconAfter="arrowRight">
                    {t('public-portal.home.visitBuyer', {
                      count: buyer.openOpportunityCount,
                    })}
                  </ButtonLink>
                }
              >
                {buyer.portalIntro !== null && <p>{buyer.portalIntro}</p>}
              </Card>
            ))}
          </div>
        )}
      </Card>

      <div className="tiq-grid tiq-grid--2">
        <AdvanceNoticeList notices={data.advanceNotices} />
        <RecentOutcomeList outcomes={data.recentOutcomes} />
      </div>
      <div className="tiq-grid tiq-grid--2">
        <GuidanceList articles={data.guidance} />
        <RegistrationCallout />
      </div>
    </>
  );
}
