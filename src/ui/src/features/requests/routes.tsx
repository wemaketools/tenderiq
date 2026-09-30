/**
 * Requests feature (FR-04, FR-05): the request register (BUY-02), the request and business case (BUY-03), the
 * request and funding decision (BUY-04) and market research and strategy (BUY-06). The procurement plan (BUY-05)
 * and the public plans (PUB-06) live in the `planning` feature.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { DECISION_READ, REQUEST_READ, STRATEGY_READ } from './lib';

export const features: FeatureModule[] = [
  {
    id: 'requests',
    area: 'buyer',
    routes: [
      {
        path: 'requests',
        load: () => import('./pages/RequestRegisterPage'),
        permission: REQUEST_READ,
        title: 'requests.register.title',
      },
      {
        path: 'requests/new',
        load: () => import('./pages/RequestFormPage'),
        permission: 'request.create',
        title: 'requests.form.newTitle',
      },
      {
        path: 'requests/:requestId',
        load: () => import('./pages/RequestPage'),
        permission: REQUEST_READ,
        title: 'requests.detail.title',
      },
      {
        path: 'requests/:requestId/edit',
        load: () => import('./pages/RequestFormPage'),
        permission: 'request.create',
        title: 'requests.form.title',
      },
      {
        path: 'requests/:requestId/decision',
        load: () => import('./pages/RequestDecisionPage'),
        permission: DECISION_READ,
        title: 'requests.decision.title',
      },
      {
        path: 'strategies',
        load: () => import('./pages/StrategiesPage'),
        permission: STRATEGY_READ,
        title: 'requests.strategies.title',
      },
      {
        path: 'strategies/new',
        load: () => import('./pages/StrategyFormPage'),
        permission: 'strategy.manage',
        title: 'requests.strategyForm.newTitle',
      },
      {
        path: 'strategies/:strategyId',
        load: () => import('./pages/StrategyPage'),
        permission: STRATEGY_READ,
        title: 'requests.strategy.title',
      },
      {
        path: 'strategies/:strategyId/edit',
        load: () => import('./pages/StrategyFormPage'),
        permission: 'strategy.manage',
        title: 'requests.strategyForm.title',
      },
    ],
    nav: [
      {
        id: 'buyer.requests',
        label: 'requests.nav.requests',
        path: 'requests',
        section: 'planning',
        order: 10,
        icon: 'clipboard',
        permission: REQUEST_READ,
        sectionAction: {
          label: 'requests.register.new',
          path: 'requests/new',
          icon: 'plus',
          permission: 'request.create',
        },
      },
      {
        id: 'buyer.strategies',
        label: 'requests.nav.strategies',
        path: 'strategies',
        section: 'planning',
        order: 30,
        icon: 'compass',
        permission: STRATEGY_READ,
        sectionAction: {
          label: 'requests.strategies.new',
          path: 'strategies/new',
          icon: 'plus',
          permission: 'strategy.manage',
        },
      },
    ],
  },
];
