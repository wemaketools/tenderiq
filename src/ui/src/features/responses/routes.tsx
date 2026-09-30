/**
 * Supplier responses (domain 09, FR-11, FR-12): the response workspace — answers (SUP-12), pricing (SUP-13),
 * declarations (SUP-14), internal review (SUP-15), final review and submission (SUP-16), receipts, revisions and
 * withdrawal (SUP-17) — plus the supplier's official receipts register.
 */
import { Navigate } from 'react-router';

import type { FeatureModule } from '../../app/featureRegistry';
import { RECEIPT_READ, RESPONSE_READ } from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'responses',
    area: 'supplier',
    routes: [
      {
        path: 'responses',
        load: () => import('./pages/ResponsesPage'),
        permission: RESPONSE_READ,
        title: 'responses.list.title',
      },
      {
        path: 'responses/:bidId',
        element: <Navigate to="answers" replace />,
        permission: RESPONSE_READ,
        title: 'responses.answers.pageTitle',
      },
      {
        path: 'responses/:bidId/answers',
        load: () => import('./pages/AnswersPage'),
        permission: RESPONSE_READ,
        title: 'responses.answers.pageTitle',
      },
      {
        path: 'responses/:bidId/answers/:requirementId',
        load: () => import('./pages/AnswerPage'),
        permission: RESPONSE_READ,
        title: 'responses.answer.pageTitle',
      },
      {
        path: 'responses/:bidId/pricing',
        load: () => import('./pages/PricingPage'),
        permission: RESPONSE_READ,
        title: 'responses.pricing.pageTitle',
      },
      {
        path: 'responses/:bidId/declarations',
        load: () => import('./pages/DeclarationsPage'),
        permission: RESPONSE_READ,
        title: 'responses.declarations.pageTitle',
      },
      {
        path: 'responses/:bidId/review',
        load: () => import('./pages/ReviewPage'),
        permission: RESPONSE_READ,
        title: 'responses.review.pageTitle',
      },
      {
        path: 'responses/:bidId/submit',
        load: () => import('./pages/SubmitPage'),
        permission: RESPONSE_READ,
        title: 'responses.submit.pageTitle',
      },
      {
        path: 'responses/:bidId/receipts',
        load: () => import('./pages/ResponseHistoryPage'),
        permission: RESPONSE_READ,
        title: 'responses.history.pageTitle',
      },
      {
        path: 'receipts',
        load: () => import('./pages/ReceiptsPage'),
        permission: RECEIPT_READ,
        title: 'responses.receipts.title',
      },
      {
        path: 'receipts/:receiptId',
        load: () => import('./pages/ReceiptPage'),
        permission: RECEIPT_READ,
        title: 'responses.receipt.pageTitle',
      },
    ],
    nav: [
      {
        id: 'supplier.responses',
        label: 'responses.nav.responses',
        path: 'responses',
        section: 'sourcing',
        order: 50,
        icon: 'send',
        permission: RESPONSE_READ,
      },
      {
        id: 'supplier.receipts',
        label: 'responses.nav.receipts',
        path: 'receipts',
        section: 'sourcing',
        order: 55,
        icon: 'receipt',
        permission: RECEIPT_READ,
      },
    ],
  },
];
