/**
 * Dashboards (FR-21): BUY-01, the procurement dashboard of a buyer organization, and SUP-01, the dashboard of a
 * supplier organization. Each is the first destination of its area for the memberships that may read it.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'dashboard-buyer',
    area: 'buyer',
    routes: [
      {
        path: 'dashboard',
        load: () => import('./pages/BuyerDashboardPage'),
        permission: 'dashboard.view',
        title: 'dashboard.buyer.title',
      },
    ],
    nav: [
      {
        id: 'buyer.dashboard',
        label: 'dashboard.nav.overview',
        path: 'dashboard',
        section: 'home',
        order: 10,
        icon: 'dashboard',
        permission: 'dashboard.view',
        sectionAction: {
          label: 'dashboard.buyer.openReports',
          path: 'reports',
          icon: 'barChart',
          permission: ['report.view', 'report.manage'],
        },
      },
    ],
  },
  {
    id: 'dashboard-supplier',
    area: 'supplier',
    routes: [
      {
        path: 'dashboard',
        load: () => import('./pages/SupplierDashboardPage'),
        permission: 'supplier.dashboard.view',
        title: 'dashboard.supplier.title',
      },
    ],
    nav: [
      {
        id: 'supplier.dashboard',
        label: 'dashboard.nav.overview',
        path: 'dashboard',
        section: 'home',
        order: 10,
        icon: 'dashboard',
        permission: 'supplier.dashboard.view',
      },
    ],
  },
];
