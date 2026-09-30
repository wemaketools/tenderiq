/**
 * Opening feature (domain 10; FR-13): BUY-20 opening, BUY-21 compliance and exclusions, EVA-03 clarification
 * coordination (buyer area) and SUP-18 assessment requests (supplier area). Every route requires the contract's
 * read permissions, so administrators, auditors and operator support get the restricted page (AC-15).
 */
import {
  ASSESSMENT_REQUEST_VIEW_PERMISSIONS,
  CLARIFICATION_VIEW_PERMISSIONS,
  COMPLIANCE_VIEW_PERMISSIONS,
  OPENING_VIEW_PERMISSIONS,
} from '@contracts/opening';

import type { FeatureModule } from '../../app/featureRegistry';

const EXCLUSION_VIEW_PERMISSIONS = ['compliance.assess', 'exclusion.approve'] as const;

export const features: FeatureModule[] = [
  {
    id: 'opening',
    area: 'buyer',
    routes: [
      {
        path: 'opening',
        load: () => import('./pages/OpeningPage'),
        permission: OPENING_VIEW_PERMISSIONS,
        title: 'opening.hub.title',
      },
      {
        path: 'opening/tenders/:tenderId',
        load: () => import('./pages/TenderOpeningPage'),
        permission: OPENING_VIEW_PERMISSIONS,
        title: 'opening.tender.loadingTitle',
      },
      {
        path: 'opening/sessions/:sessionId',
        load: () => import('./pages/OpeningSessionPage'),
        permission: OPENING_VIEW_PERMISSIONS,
        title: 'opening.session.loadingTitle',
      },
      {
        path: 'compliance',
        load: () => import('./pages/CompliancePage'),
        permission: COMPLIANCE_VIEW_PERMISSIONS,
        title: 'opening.compliance.title',
      },
      {
        path: 'compliance/tenders/:tenderId',
        load: () => import('./pages/ComplianceRegisterPage'),
        permission: COMPLIANCE_VIEW_PERMISSIONS,
        title: 'opening.register.loadingTitle',
      },
      {
        path: 'compliance/bids/:bidId',
        load: () => import('./pages/BidCompliancePage'),
        permission: COMPLIANCE_VIEW_PERMISSIONS,
        title: 'opening.bid.loadingTitle',
      },
      {
        path: 'compliance/exclusions/:exclusionId',
        load: () => import('./pages/ExclusionPage'),
        permission: EXCLUSION_VIEW_PERMISSIONS,
        title: 'opening.exclusion.loadingTitle',
      },
      {
        path: 'bid-clarifications',
        load: () => import('./pages/ClarificationsPage'),
        permission: CLARIFICATION_VIEW_PERMISSIONS,
        title: 'opening.coordination.title',
      },
      {
        path: 'bid-clarifications/:clarificationId',
        load: () => import('./pages/ClarificationPage'),
        permission: CLARIFICATION_VIEW_PERMISSIONS,
        title: 'opening.clarification.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'buyer.opening',
        label: 'opening.nav.opening',
        path: 'opening',
        section: 'evaluation',
        order: 10,
        icon: 'unlock',
        permission: OPENING_VIEW_PERMISSIONS,
      },
      {
        id: 'buyer.compliance',
        label: 'opening.nav.compliance',
        path: 'compliance',
        section: 'evaluation',
        order: 20,
        icon: 'shield',
        permission: COMPLIANCE_VIEW_PERMISSIONS,
      },
      {
        id: 'buyer.bidClarifications',
        label: 'opening.nav.clarifications',
        path: 'bid-clarifications',
        section: 'evaluation',
        order: 30,
        icon: 'messageSquare',
        permission: CLARIFICATION_VIEW_PERMISSIONS,
      },
    ],
  },
  {
    id: 'opening.supplier',
    area: 'supplier',
    routes: [
      {
        path: 'assessment-requests',
        load: () => import('./pages/AssessmentRequestsPage'),
        permission: ASSESSMENT_REQUEST_VIEW_PERMISSIONS,
        title: 'opening.supplier.title',
      },
      {
        path: 'assessment-requests/:requestId',
        load: () => import('./pages/AssessmentRequestPage'),
        permission: ASSESSMENT_REQUEST_VIEW_PERMISSIONS,
        title: 'opening.supplier.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'supplier.assessmentRequests',
        label: 'opening.nav.assessmentRequests',
        path: 'assessment-requests',
        section: 'sourcing',
        order: 60,
        icon: 'messageSquare',
        permission: ASSESSMENT_REQUEST_VIEW_PERMISSIONS,
      },
    ],
  },
];
