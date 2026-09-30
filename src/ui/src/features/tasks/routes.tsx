/**
 * Workspace — COM-04 task inbox (FR-21). Personal (`/me/tasks`): the caller's own tasks in every active
 * organization (DD-21). Every signed-in account holder has one, whatever the organization kind.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'tasks',
    area: 'common',
    routes: [
      {
        path: 'tasks',
        load: () => import('./pages/TaskInboxPage'),
        title: 'tasks.inbox.title',
      },
    ],
    nav: [
      {
        id: 'me.tasks',
        label: 'tasks.nav.inbox',
        path: 'tasks',
        section: 'work',
        order: 10,
        icon: 'inbox',
        badge: 'tasks',
        end: true,
      },
    ],
  },
];
