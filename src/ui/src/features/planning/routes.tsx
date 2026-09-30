/**
 * Planning feature (FR-04 planning, BUY-05, PUB-06): the procurement plan, calendar, resource demand and advance
 * notices for buyers, and the public procurement plans page.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { PLAN_READ } from './lib';

export const features: FeatureModule[] = [
  {
    id: 'planning',
    area: 'buyer',
    routes: [
      {
        path: 'planning',
        load: () => import('./pages/PlanningPage'),
        permission: PLAN_READ,
        title: 'planning.plan.title',
      },
      {
        path: 'planning/items/new',
        load: () => import('./pages/PlanItemFormPage'),
        permission: 'plan.manage',
        title: 'planning.form.newTitle',
      },
      {
        path: 'planning/items/:planItemId',
        load: () => import('./pages/PlanItemPage'),
        permission: PLAN_READ,
        title: 'planning.item.title',
      },
      {
        path: 'planning/items/:planItemId/edit',
        load: () => import('./pages/PlanItemFormPage'),
        permission: 'plan.manage',
        title: 'planning.form.title',
      },
      {
        path: 'planning/notices/new',
        load: () => import('./pages/AdvanceNoticeFormPage'),
        permission: 'plan.manage',
        title: 'planning.noticeForm.title',
      },
      {
        path: 'planning/notices/:noticeId',
        load: () => import('./pages/AdvanceNoticePage'),
        permission: PLAN_READ,
        title: 'planning.notice.title',
      },
    ],
    nav: [
      {
        id: 'buyer.planning',
        label: 'planning.nav.plan',
        path: 'planning',
        section: 'planning',
        order: 20,
        icon: 'calendar',
        permission: PLAN_READ,
        sectionAction: {
          label: 'planning.plan.newItem',
          path: 'planning/items/new',
          icon: 'plus',
          permission: 'plan.manage',
        },
      },
    ],
  },
  {
    id: 'planning-public',
    area: 'public',
    routes: [
      {
        path: 'plans',
        load: () => import('./pages/public/PublicPlansPage'),
        title: 'planning.public.title',
      },
      {
        path: 'plans/:buyerSlug/:noticeId',
        load: () => import('./pages/public/PublicNoticePage'),
        title: 'planning.public.noticeTitle',
      },
    ],
  },
];
