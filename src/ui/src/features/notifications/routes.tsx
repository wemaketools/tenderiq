/**
 * Workspace — COM-06 notification center (every account holder, `/me/notifications`, BR-41, BR-42) and ADM-12
 * notification rules and messages (buyer administration, `org.notifications.manage`, BR-43).
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'notifications',
    area: 'common',
    routes: [
      {
        path: 'notifications',
        load: () => import('./pages/NotificationCenterPage'),
        title: 'notifications.center.title',
      },
    ],
    nav: [
      {
        id: 'me.notifications',
        label: 'notifications.nav.center',
        path: 'notifications',
        section: 'work',
        order: 30,
        icon: 'bell',
        badge: 'notifications',
      },
    ],
  },
  {
    id: 'notification-rules',
    area: 'buyer',
    routes: [
      {
        path: 'admin/notification-rules',
        load: () => import('./pages/NotificationRulesPage'),
        permission: 'org.notifications.manage',
        title: 'notifications.rules.title',
      },
      {
        path: 'admin/notification-rules/new',
        load: () => import('./pages/NotificationRuleNewPage'),
        permission: 'org.notifications.manage',
        title: 'notifications.rule.newTitle',
      },
      {
        path: 'admin/notification-rules/:ruleId',
        load: () => import('./pages/NotificationRulePage'),
        permission: 'org.notifications.manage',
        title: 'notifications.rule.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'buyer.notification-rules',
        label: 'notifications.nav.rules',
        path: 'admin/notification-rules',
        section: 'admin',
        order: 60,
        icon: 'signal',
        permission: 'org.notifications.manage',
        sectionAction: {
          label: 'notifications.rules.new',
          path: 'admin/notification-rules/new',
          icon: 'plus',
          permission: 'org.notifications.manage',
        },
      },
    ],
  },
];
