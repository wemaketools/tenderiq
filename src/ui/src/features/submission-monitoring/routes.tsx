/**
 * Buyer submission monitoring and closing (domain 09, BUY-19): receipt metadata only before opening (BR-17), the
 * effective submission count as unique suppliers, deadlines, closing status and service incidents.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'submission-monitoring',
    area: 'buyer',
    routes: [
      {
        path: 'submissions',
        load: () => import('./pages/MonitoringListPage'),
        permission: 'bid.monitor',
        title: 'submission-monitoring.list.title',
      },
      {
        path: 'submissions/:tenderId',
        load: () => import('./pages/MonitoringTenderPage'),
        permission: 'bid.monitor',
        title: 'submission-monitoring.detail.title',
      },
    ],
    nav: [
      {
        id: 'buyer.submissions',
        label: 'submission-monitoring.nav.submissions',
        path: 'submissions',
        section: 'sourcing',
        order: 50,
        icon: 'uploadCloud',
        permission: 'bid.monitor',
      },
    ],
  },
];
