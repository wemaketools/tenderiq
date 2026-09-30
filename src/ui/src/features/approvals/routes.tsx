/**
 * Workspace — COM-04 approvals view and COM-05 approval decision (BR-06, BR-07, BR-10; AC-05, AC-06). Personal
 * (`/me/approvals`): the caller's approval work in every active organization (DD-21). Approvals are buyer work, so
 * the sidebar entry shows in buyer organizations; the pages stay reachable from notifications and tasks.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'approvals',
    area: 'common',
    routes: [
      {
        path: 'approvals',
        load: () => import('./pages/ApprovalInboxPage'),
        title: 'approvals.nav.approvals',
      },
      {
        path: 'approvals/:approvalId',
        load: () => import('./pages/ApprovalDecisionPage'),
        title: 'approvals.detail.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'me.approvals',
        label: 'approvals.nav.approvals',
        path: 'approvals',
        section: 'work',
        order: 20,
        icon: 'checkSquare',
        tenantKinds: ['buyer'],
      },
    ],
  },
];
