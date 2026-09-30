/**
 * Continues from a public notice (PUB-03, `/opportunities/:buyerSlug/:ref`) into the supplier workspace (SUP-08):
 * supplier API paths use tender ids (DD-22), so the notice is looked up among the opportunities this supplier may
 * see and the page redirects to its workspace.
 */
import { Navigate, useParams } from 'react-router';

import { publicationEndpoints } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  RestrictedState,
  SkeletonBlock,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { opportunityPaths, portalPaths } from '../../publication/lib/paths';

export default function OpportunityLookupPage() {
  const { buyerSlug = '', ref = '' } = useParams();
  const query = useApiQuery(publicationEndpoints.listOpportunities, {
    query: { q: ref, includeDismissed: true, pageSize: 100 },
  });
  const match = query.data?.items.find(
    (row) => row.tender.reference === ref && row.buyer.slug === buyerSlug,
  );

  if (match !== undefined) {
    return <Navigate to={opportunityPaths.workspace(match.tender.tenderId)} replace />;
  }
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('opportunities.lookup.title', { reference: ref })}
        back={{ to: opportunityPaths.discovery, label: t('opportunities.workspace.back') }}
      />
      {query.data === undefined && query.error === null ? (
        <SkeletonBlock lines={3} label={t('opportunities.lookup.loading')} />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState />
      ) : query.error !== null ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : (
        <EmptyState
          icon="search"
          title={t('opportunities.lookup.notFound')}
          description={t('opportunities.lookup.notFoundHint')}
          action={
            <ButtonLink to={portalPaths.notice(buyerSlug, ref)}>
              {t('opportunities.lookup.backToNotice')}
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
