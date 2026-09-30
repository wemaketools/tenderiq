/**
 * Public portal (FR-08; PUB-01, PUB-02, PUB-03, PUB-07): browsable without an account inside the PublicShell. Only
 * public notices appear (AC-01). Public URLs carry the buyer slug and the reference (DD-22).
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'public-portal',
    area: 'public',
    routes: [
      { path: '', load: () => import('./pages/PortalHomePage'), title: 'public-portal.home.title' },
      {
        path: 'b/:buyerSlug',
        load: () => import('./pages/BuyerPortalPage'),
        title: 'public-portal.home.title',
      },
      {
        path: 'opportunities',
        load: () => import('./pages/OpportunitySearchPage'),
        title: 'public-portal.search.title',
      },
      {
        path: 'opportunities/:buyerSlug/:ref',
        load: () => import('./pages/NoticePage'),
        title: 'public-portal.notice.loadingTitle',
      },
      {
        path: 'guidance',
        load: () => import('./pages/GuidancePage'),
        title: 'public-portal.guidance.pageTitle',
      },
      {
        path: 'guidance/:articleSlug',
        load: () => import('./pages/GuidanceArticlePage'),
        title: 'public-portal.guidance.pageTitle',
      },
    ],
  },
];
