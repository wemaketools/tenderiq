/**
 * Outcomes (domain 13, FR-17): the supplier side of awards — SUP-21 outcomes and debriefings, SUP-22 complaints
 * and appeals — and the public PUB-05 award search and detail. The buyer screens live in the `awards` feature.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'outcomes',
    area: 'supplier',
    routes: [
      {
        path: 'outcomes',
        load: () => import('./pages/SupplierOutcomesPage'),
        permission: 'supplier.outcomes.view',
        title: 'outcomes.list.title',
      },
      {
        path: 'outcomes/:tenderId',
        load: () => import('./pages/SupplierOutcomePage'),
        permission: 'supplier.outcomes.view',
        title: 'outcomes.detail.title',
      },
      {
        path: 'complaints',
        load: () => import('./pages/SupplierComplaintsPage'),
        permission: ['supplier.complaint.submit', 'supplier.outcomes.view'],
        title: 'outcomes.complaints.title',
      },
      {
        path: 'complaints/new',
        load: () => import('./pages/NewComplaintPage'),
        permission: 'supplier.complaint.submit',
        title: 'outcomes.newComplaint.title',
      },
      {
        path: 'complaints/:complaintId',
        load: () => import('./pages/SupplierComplaintPage'),
        permission: ['supplier.complaint.submit', 'supplier.outcomes.view'],
        title: 'outcomes.complaint.title',
      },
    ],
    nav: [
      {
        id: 'supplier.outcomes',
        label: 'outcomes.nav.outcomes',
        path: 'outcomes',
        section: 'award',
        order: 10,
        icon: 'trophy',
        permission: 'supplier.outcomes.view',
      },
      {
        id: 'supplier.complaints',
        label: 'outcomes.nav.complaints',
        path: 'complaints',
        section: 'award',
        order: 30,
        icon: 'scale',
        permission: ['supplier.complaint.submit', 'supplier.outcomes.view'],
      },
    ],
  },
  {
    id: 'outcomes-public',
    area: 'public',
    routes: [
      {
        path: 'awards',
        load: () => import('./pages/PublicAwardsPage'),
        title: 'outcomes.public.title',
      },
      {
        path: 'awards/:buyerSlug/:reference',
        load: () => import('./pages/PublicAwardPage'),
        title: 'outcomes.public.detailTitle',
      },
    ],
    nav: [],
  },
];
