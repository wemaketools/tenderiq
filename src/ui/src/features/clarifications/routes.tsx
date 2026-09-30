/**
 * Clarifications feature (FR-10): Tender Q&A (BUY-16), addenda and date changes (BUY-17), briefings and site visits
 * (BUY-18) for buyers; questions, clarifications and addenda (SUP-10) and briefings (SUP-11) for suppliers; and the
 * public clarification edition (PUB-04).
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  ADDENDUM_READ_PERMISSION,
  BUYER_AREA_PERMISSION,
  QUESTION_PERMISSION,
  SESSION_PERMISSION,
  SUPPLIER_READ_PERMISSION,
} from './lib';

export const features: FeatureModule[] = [
  {
    id: 'clarifications',
    area: 'buyer',
    routes: [
      {
        path: 'clarifications',
        load: () => import('./pages/BuyerClarificationsHome'),
        permission: BUYER_AREA_PERMISSION,
        title: 'clarifications.nav.buyer',
      },
      {
        path: 'clarifications/questions',
        load: () => import('./pages/buyer/QuestionsPage'),
        permission: QUESTION_PERMISSION,
        title: 'clarifications.questions.title',
      },
      {
        path: 'clarifications/questions/:questionId',
        load: () => import('./pages/buyer/QuestionPage'),
        permission: QUESTION_PERMISSION,
        title: 'clarifications.questions.title',
      },
      {
        path: 'clarifications/addenda',
        load: () => import('./pages/buyer/AddendaPage'),
        permission: ADDENDUM_READ_PERMISSION,
        title: 'clarifications.addenda.title',
      },
      {
        path: 'clarifications/addenda/new',
        load: () => import('./pages/buyer/AddendumFormPage'),
        permission: QUESTION_PERMISSION,
        title: 'clarifications.addendumForm.newTitle',
      },
      {
        path: 'clarifications/addenda/:addendumId',
        load: () => import('./pages/buyer/AddendumPage'),
        permission: ADDENDUM_READ_PERMISSION,
        title: 'clarifications.addenda.title',
      },
      {
        path: 'clarifications/addenda/:addendumId/edit',
        load: () => import('./pages/buyer/AddendumFormPage'),
        permission: QUESTION_PERMISSION,
        title: 'clarifications.addendumForm.editTitle',
      },
      {
        path: 'clarifications/sessions',
        load: () => import('./pages/buyer/SessionsPage'),
        permission: SESSION_PERMISSION,
        title: 'clarifications.sessions.title',
      },
      {
        path: 'clarifications/sessions/new',
        load: () => import('./pages/buyer/SessionFormPage'),
        permission: SESSION_PERMISSION,
        title: 'clarifications.sessionForm.newTitle',
      },
      {
        path: 'clarifications/sessions/:sessionId',
        load: () => import('./pages/buyer/SessionPage'),
        permission: SESSION_PERMISSION,
        title: 'clarifications.sessions.title',
      },
      {
        path: 'clarifications/sessions/:sessionId/edit',
        load: () => import('./pages/buyer/SessionFormPage'),
        permission: SESSION_PERMISSION,
        title: 'clarifications.sessionForm.editTitle',
      },
    ],
    nav: [
      {
        id: 'buyer.clarifications',
        label: 'clarifications.nav.buyer',
        path: 'clarifications',
        section: 'sourcing',
        order: 40,
        icon: 'messageQuestion',
        permission: BUYER_AREA_PERMISSION,
        badge: { navBadgeId: 'buyer.clarifications' },
      },
    ],
  },
  {
    id: 'clarifications-supplier',
    area: 'supplier',
    routes: [
      {
        path: 'clarifications',
        load: () => import('./pages/supplier/SupplierClarificationsPage'),
        permission: SUPPLIER_READ_PERMISSION,
        title: 'clarifications.supplier.title',
      },
      {
        path: 'clarifications/tenders/:tenderId',
        load: () => import('./pages/supplier/SupplierTenderPage'),
        permission: SUPPLIER_READ_PERMISSION,
        title: 'clarifications.supplier.title',
      },
      {
        path: 'clarifications/questions/:questionId',
        load: () => import('./pages/supplier/SupplierQuestionPage'),
        permission: SUPPLIER_READ_PERMISSION,
        title: 'clarifications.supplier.title',
      },
      {
        path: 'clarifications/addenda/:addendumId',
        load: () => import('./pages/supplier/SupplierAddendumPage'),
        permission: SUPPLIER_READ_PERMISSION,
        title: 'clarifications.supplier.title',
      },
      {
        path: 'briefings',
        load: () => import('./pages/supplier/SupplierSessionsPage'),
        permission: SUPPLIER_READ_PERMISSION,
        title: 'clarifications.supplierSessions.title',
      },
      {
        path: 'briefings/:sessionId',
        load: () => import('./pages/supplier/SupplierSessionPage'),
        permission: SUPPLIER_READ_PERMISSION,
        title: 'clarifications.supplierSessions.title',
      },
    ],
    nav: [
      {
        id: 'supplier.clarifications',
        label: 'clarifications.nav.supplier',
        path: 'clarifications',
        section: 'sourcing',
        order: 40,
        icon: 'messageQuestion',
        permission: SUPPLIER_READ_PERMISSION,
        badge: { navBadgeId: 'supplier.clarifications' },
      },
      {
        id: 'supplier.briefings',
        label: 'clarifications.nav.supplierSessions',
        path: 'briefings',
        section: 'sourcing',
        order: 45,
        icon: 'mapPin',
        permission: SUPPLIER_READ_PERMISSION,
      },
    ],
  },
  {
    id: 'clarifications-public',
    area: 'public',
    routes: [
      {
        path: 'clarifications/:buyerSlug/:ref',
        load: () => import('./pages/public/PublicClarificationsPage'),
        title: 'clarifications.public.title',
      },
    ],
  },
];
