/**
 * Tender authoring and release approval (domain 06, FR-07): BUY-07 register and creation, BUY-08 overview and team,
 * BUY-09 scope, lots and requirements, BUY-10 pricing and terms, BUY-11 evaluation plan, BUY-12 timetable and
 * participation rules, BUY-13 document package and release review. The section pages match
 * `TENDER_SECTION_PAGES` of the contract.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { TENDER_CREATE, TENDER_VIEW } from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'tender-authoring',
    area: 'buyer',
    routes: [
      {
        path: 'tenders',
        load: () => import('./pages/TenderRegisterPage'),
        permission: TENDER_VIEW,
        title: 'tender-authoring.register.title',
      },
      {
        path: 'tenders/new',
        load: () => import('./pages/CreateTenderPage'),
        permission: TENDER_CREATE,
        title: 'tender-authoring.create.title',
      },
      {
        path: 'tenders/:tenderId',
        load: () => import('./pages/TenderOverviewPage'),
        permission: TENDER_VIEW,
        title: 'tender-authoring.tabs.overview',
      },
      {
        path: 'tenders/:tenderId/scope',
        load: () => import('./pages/ScopePage'),
        permission: TENDER_VIEW,
        title: 'tender-authoring.tabs.scope',
      },
      {
        path: 'tenders/:tenderId/pricing',
        load: () => import('./pages/PricingPage'),
        permission: TENDER_VIEW,
        title: 'tender-authoring.tabs.pricing',
      },
      {
        path: 'tenders/:tenderId/evaluation',
        load: () => import('./pages/EvaluationPlanPage'),
        permission: TENDER_VIEW,
        title: 'tender-authoring.tabs.evaluation',
      },
      {
        path: 'tenders/:tenderId/timetable',
        load: () => import('./pages/TimetablePage'),
        permission: TENDER_VIEW,
        title: 'tender-authoring.tabs.timetable',
      },
      {
        path: 'tenders/:tenderId/release',
        load: () => import('./pages/ReleaseReviewPage'),
        permission: TENDER_VIEW,
        title: 'tender-authoring.tabs.release',
      },
    ],
    nav: [
      {
        id: 'buyer.tenders',
        label: 'tender-authoring.nav.tenders',
        path: 'tenders',
        section: 'sourcing',
        order: 10,
        icon: 'fileText',
        permission: TENDER_VIEW,
        sectionAction: {
          label: 'tender-authoring.register.new',
          path: 'tenders/new',
          icon: 'plus',
          permission: 'tender.create',
        },
      },
    ],
  },
];
