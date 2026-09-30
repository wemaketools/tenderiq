/**
 * Supplier opportunities (FR-09): discovery, saved searches, subscriptions and watchlist (SUP-06), invitations and
 * access requests (SUP-07), the opportunity workspace (SUP-08) and the private bid/no-bid pursuit (SUP-09).
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { OPPORTUNITY_READ, PURSUIT_READ } from '../publication/lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'opportunities',
    area: 'supplier',
    routes: [
      {
        path: 'opportunities',
        load: () => import('./pages/DiscoveryPage'),
        permission: OPPORTUNITY_READ,
        title: 'opportunities.nav.opportunities',
      },
      {
        path: 'opportunities/find/:buyerSlug/:ref',
        load: () => import('./pages/OpportunityLookupPage'),
        permission: OPPORTUNITY_READ,
        title: 'opportunities.nav.opportunities',
      },
      {
        path: 'opportunities/:tenderId',
        load: () => import('./pages/OpportunityWorkspacePage'),
        permission: OPPORTUNITY_READ,
        title: 'opportunities.workspace.loadingTitle',
      },
      {
        path: 'opportunities/:tenderId/pursuit',
        load: () => import('./pages/PursuitPage'),
        permission: PURSUIT_READ,
        title: 'opportunities.nav.pursuits',
      },
      {
        path: 'opportunities/:tenderId/response',
        load: () => import('./pages/ResponseRedirectPage'),
        permission: OPPORTUNITY_READ,
        title: 'opportunities.nav.opportunities',
      },
      {
        path: 'invitations',
        load: () => import('./pages/InvitationsPage'),
        permission: OPPORTUNITY_READ,
        title: 'opportunities.nav.invitations',
      },
      {
        path: 'invitations/:participantId',
        load: () => import('./pages/InvitationPage'),
        permission: OPPORTUNITY_READ,
        title: 'opportunities.nav.invitations',
      },
      {
        path: 'pursuits',
        load: () => import('./pages/PursuitsPage'),
        permission: PURSUIT_READ,
        title: 'opportunities.nav.pursuits',
      },
    ],
    nav: [
      {
        id: 'supplier.opportunities',
        label: 'opportunities.nav.opportunities',
        path: 'opportunities',
        section: 'sourcing',
        order: 10,
        icon: 'compass',
        permission: OPPORTUNITY_READ,
      },
      {
        id: 'supplier.invitations',
        label: 'opportunities.nav.invitations',
        path: 'invitations',
        section: 'sourcing',
        order: 20,
        icon: 'mail',
        permission: OPPORTUNITY_READ,
      },
      {
        id: 'supplier.pursuits',
        label: 'opportunities.nav.pursuits',
        path: 'pursuits',
        section: 'sourcing',
        order: 30,
        icon: 'target',
        permission: PURSUIT_READ,
      },
    ],
  },
];
