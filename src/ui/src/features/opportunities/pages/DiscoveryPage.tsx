/**
 * SUP-06 Opportunity discovery and watchlist: matched opportunities, saved searches, watched tenders, deadlines and
 * buyer categories. Actions: save a search, subscribe, dismiss, watch and open an opportunity. A match is only a
 * suggestion from the supplier's categories, regions and saved searches: it never guarantees eligibility.
 * Invitation-only and restricted events appear only to their participants.
 */
import { useSearchParams } from 'react-router';

import { publicationEndpoints } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { useCanCall } from '../../../auth/permissions';
import { KpiCard, KpiGrid, PageHeader, Tabs } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import type { DiscoveryTab } from '../../publication/lib/paths';
import { opportunityPaths } from '../../publication/lib/paths';
import {
  DiscoverTab,
  SavedSearchesTab,
  SubscriptionsTab,
  WatchlistTab,
} from '../components/DiscoveryTabs';
import { DISCOVER_DEFAULTS } from '../lib/discovery';

const TABS: readonly DiscoveryTab[] = ['discover', 'watchlist', 'searches', 'subscriptions'];
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

export default function DiscoveryPage() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const requested: DiscoveryTab = TABS.includes(raw as DiscoveryTab)
    ? (raw as DiscoveryTab)
    : 'discover';
  const [, setDiscoverFilters] = useScreenFilters('SUP-06', DISCOVER_DEFAULTS);

  const filters = useApiQuery(publicationEndpoints.opportunityFilters, {});
  const overview = useApiQuery(publicationEndpoints.listOpportunities, {
    query: { pageSize: 100 },
  });
  const searches = useApiQuery(publicationEndpoints.listSavedSearches, {
    query: { pageSize: 100 },
  });
  // DD-49: without the watchlist, its tile and tab are left out and it is not queried.
  const canWatch = useCanCall(publicationEndpoints.listWatchlist);
  const watch = useApiQuery(
    publicationEndpoints.listWatchlist,
    canWatch ? { query: { pageSize: 100 } } : null,
  );
  const showWatch = canWatch && watch.error?.kind !== 'forbidden';
  const tab: DiscoveryTab = requested === 'watchlist' && !showWatch ? 'discover' : requested;

  const rows = overview.data?.items ?? [];
  const kpi = (value: number): string => (overview.data === undefined ? '…' : formatCount(value));
  const restricted = overview.error?.kind === 'forbidden';
  const matches = rows.filter((row) => row.match.isMatch && !row.dismissed).length;
  const invited = rows.filter((row) => row.participation?.invitationStatus === 'invited').length;
  const participating = rows.filter((row) => row.participation !== null).length;
  const closingSoon = rows.filter(
    (row) =>
      row.isAcceptingResponses &&
      row.closingAt !== null &&
      Date.parse(row.closingAt.at) - now <= FORTNIGHT_MS &&
      Date.parse(row.closingAt.at) >= now,
  ).length;

  const select = (id: string): void => {
    setParams(id === 'discover' ? {} : { tab: id }, { replace: true });
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('opportunities.discover.title')}
        subtitle={t('opportunities.discover.intro')}
      />
      <KpiGrid>
        <KpiCard
          label={t('opportunities.discover.kpi.matches')}
          icon="target"
          value={kpi(matches)}
          hint={t('opportunities.discover.kpi.matchesHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.discover.kpi.invited')}
          icon="mail"
          tone={invited > 0 ? 'warning' : 'info'}
          value={kpi(invited)}
          hint={t('opportunities.discover.kpi.invitedHint', { count: participating })}
          to={opportunityPaths.invitations}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.discover.kpi.closing')}
          icon="timer"
          tone={closingSoon > 0 ? 'danger' : 'success'}
          value={kpi(closingSoon)}
          hint={t('opportunities.discover.kpi.closingHint')}
          restricted={restricted}
        />
        {showWatch && (
          <KpiCard
            label={t('opportunities.discover.kpi.watched')}
            icon="eye"
            tone="info"
            value={watch.data === undefined ? '…' : formatCount(watch.data.total)}
            hint={t('opportunities.discover.kpi.watchedHint', {
              searches: searches.data?.total ?? 0,
            })}
          />
        )}
      </KpiGrid>
      <Tabs
        label={t('opportunities.discover.tabsLabel')}
        selected={tab}
        onSelect={select}
        tabs={[
          { id: 'discover', label: t('opportunities.tabs.discover'), count: overview.data?.total },
          ...(showWatch
            ? [
                {
                  id: 'watchlist',
                  label: t('opportunities.tabs.watchlist'),
                  count: watch.data?.total,
                },
              ]
            : []),
          { id: 'searches', label: t('opportunities.tabs.searches'), count: searches.data?.total },
          { id: 'subscriptions', label: t('opportunities.tabs.subscriptions') },
        ]}
      >
        {tab === 'discover' && (
          <DiscoverTab filters={filters.data} searches={searches.data?.items ?? []} />
        )}
        {tab === 'watchlist' && showWatch && <WatchlistTab />}
        {tab === 'searches' && (
          <SavedSearchesTab
            filters={filters.data}
            onRun={(search) => {
              setDiscoverFilters({ ...DISCOVER_DEFAULTS, savedSearchId: String(search.id) });
              select('discover');
            }}
          />
        )}
        {tab === 'subscriptions' && <SubscriptionsTab filters={filters.data} />}
      </Tabs>
    </div>
  );
}
