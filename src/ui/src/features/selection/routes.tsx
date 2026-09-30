/**
 * Selection feature (FR-15, FR-16, BR-30, BR-31): demonstrations and references (BUY-22), shortlists (BUY-23),
 * preferred bidders (BUY-24), due diligence (BUY-25), negotiations and final offers (BUY-27) for buyers; assessment
 * invitations (SUP-18) and the supplier's own negotiation and final-offer rounds (SUP-19) for suppliers.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  ASSESSMENT_READ,
  NEGOTIATION_CONDUCT,
  SELECTION_MANAGE,
  SELECTION_READ,
  SUPPLIER_INVITES_READ,
  SUPPLIER_NEGOTIATION_READ,
} from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'selection',
    area: 'buyer',
    routes: [
      {
        path: 'selection',
        load: () => import('./pages/buyer/SelectionRegisterPage'),
        permission: ASSESSMENT_READ,
        title: 'selection.register.title',
      },
      {
        path: 'selection/tenders/:tenderId',
        load: () => import('./pages/buyer/TenderSelectionPage'),
        permission: SELECTION_READ,
        title: 'selection.tender.title',
      },
      {
        path: 'selection/assessments',
        load: () => import('./pages/buyer/AssessmentsPage'),
        permission: ASSESSMENT_READ,
        title: 'selection.assessments.title',
      },
      {
        path: 'selection/assessments/new',
        load: () => import('./pages/buyer/AssessmentSessionFormPage'),
        permission: SELECTION_MANAGE,
        title: 'selection.sessionForm.title',
      },
      {
        path: 'selection/assessments/:sessionId',
        load: () => import('./pages/buyer/AssessmentSessionPage'),
        permission: ASSESSMENT_READ,
        title: 'selection.session.title',
      },
      {
        path: 'selection/references',
        load: () => import('./pages/buyer/ReferenceChecksPage'),
        permission: ASSESSMENT_READ,
        title: 'selection.references.pageTitle',
      },
      {
        path: 'selection/shortlists',
        load: () => import('./pages/buyer/ShortlistsPage'),
        permission: SELECTION_READ,
        title: 'selection.shortlists.title',
      },
      {
        path: 'selection/shortlists/new',
        load: () => import('./pages/buyer/ShortlistFormPage'),
        permission: SELECTION_MANAGE,
        title: 'selection.shortlistForm.title',
      },
      {
        path: 'selection/shortlists/:shortlistId',
        load: () => import('./pages/buyer/ShortlistPage'),
        permission: SELECTION_READ,
        title: 'selection.shortlist.title',
      },
      {
        path: 'selection/preferred-bidders',
        load: () => import('./pages/buyer/PreferredBiddersPage'),
        permission: SELECTION_READ,
        title: 'selection.preferred.title',
      },
      {
        path: 'selection/preferred-bidders/new',
        load: () => import('./pages/buyer/PreferredBidderFormPage'),
        permission: SELECTION_MANAGE,
        title: 'selection.preferredForm.title',
      },
      {
        path: 'selection/preferred-bidders/:preferredBidderId',
        load: () => import('./pages/buyer/PreferredBidderPage'),
        permission: SELECTION_READ,
        title: 'selection.preferredBidder.title',
      },
      {
        path: 'selection/due-diligence',
        load: () => import('./pages/buyer/DiligenceCasesPage'),
        permission: SELECTION_READ,
        title: 'selection.diligence.title',
      },
      {
        path: 'selection/due-diligence/:caseId',
        load: () => import('./pages/buyer/DiligenceCasePage'),
        permission: SELECTION_READ,
        title: 'selection.diligenceCase.title',
      },
      {
        path: 'selection/negotiations',
        load: () => import('./pages/buyer/NegotiationsPage'),
        permission: SELECTION_READ,
        title: 'selection.negotiations.title',
      },
      {
        path: 'selection/negotiations/new',
        load: () => import('./pages/buyer/NegotiationFormPage'),
        permission: NEGOTIATION_CONDUCT,
        title: 'selection.negotiationForm.title',
      },
      {
        path: 'selection/negotiations/:negotiationId',
        load: () => import('./pages/buyer/NegotiationPage'),
        permission: SELECTION_READ,
        title: 'selection.negotiation.title',
      },
      {
        path: 'selection/final-offers',
        load: () => import('./pages/buyer/FinalOffersPage'),
        permission: SELECTION_READ,
        title: 'selection.finalOffers.title',
      },
      {
        path: 'selection/final-offers/new',
        load: () => import('./pages/buyer/FinalOfferFormPage'),
        permission: SELECTION_MANAGE,
        title: 'selection.finalOfferForm.title',
      },
      {
        path: 'selection/final-offers/:roundId',
        load: () => import('./pages/buyer/FinalOfferPage'),
        permission: SELECTION_READ,
        title: 'selection.finalOffer.title',
      },
    ],
    nav: [
      {
        id: 'buyer.selection',
        label: 'selection.nav.buyer',
        path: 'selection',
        section: 'award',
        order: 5,
        icon: 'handshake',
        permission: ASSESSMENT_READ,
      },
    ],
  },
  {
    id: 'selection-supplier',
    area: 'supplier',
    routes: [
      {
        path: 'assessment-invites',
        load: () => import('./pages/supplier/SupplierInvitesPage'),
        permission: SUPPLIER_INVITES_READ,
        title: 'selection.supplierInvites.title',
      },
      {
        path: 'negotiations',
        load: () => import('./pages/supplier/SupplierNegotiationsPage'),
        permission: SUPPLIER_NEGOTIATION_READ,
        title: 'selection.supplierNegotiations.title',
      },
      {
        path: 'negotiations/:negotiationId',
        load: () => import('./pages/supplier/SupplierNegotiationPage'),
        permission: SUPPLIER_NEGOTIATION_READ,
        title: 'selection.supplierNegotiation.title',
      },
      {
        path: 'final-offers/:roundId',
        load: () => import('./pages/supplier/SupplierFinalOfferPage'),
        permission: SUPPLIER_NEGOTIATION_READ,
        title: 'selection.supplierFinalOffer.title',
      },
    ],
    nav: [
      {
        id: 'supplier.selection.invites',
        label: 'selection.nav.supplierInvites',
        path: 'assessment-invites',
        section: 'responding',
        order: 70,
        icon: 'calendar',
        permission: SUPPLIER_INVITES_READ,
      },
      {
        id: 'supplier.selection.negotiations',
        label: 'selection.nav.supplierNegotiations',
        path: 'negotiations',
        section: 'award',
        order: 20,
        icon: 'handshake',
        permission: SUPPLIER_NEGOTIATION_READ,
      },
    ],
  },
];
