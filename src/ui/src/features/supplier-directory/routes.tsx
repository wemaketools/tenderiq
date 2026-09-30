/**
 * Supplier directory feature (domain 03): the buyer supplier directory (BUY-31) and relationship record (BUY-32),
 * and the operator supplier reviews (registrations, possible duplicates, legal-identity changes).
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { directoryRoutes } from './lib/paths';

export const features: FeatureModule[] = [
  {
    id: 'supplier-directory',
    area: 'buyer',
    routes: [
      {
        path: directoryRoutes.directory,
        load: () => import('./pages/SupplierDirectoryPage'),
        permission: 'supplier.directory.view',
        title: 'supplier-directory.list.title',
      },
      {
        path: directoryRoutes.record,
        load: () => import('./pages/SupplierRecordPage'),
        permission: 'supplier.directory.view',
        title: 'supplier-directory.record.title',
      },
    ],
    nav: [
      {
        id: 'buyer.suppliers',
        label: 'supplier-directory.nav.directory',
        path: directoryRoutes.directory,
        section: 'suppliers',
        order: 10,
        icon: 'briefcase',
        permission: 'supplier.directory.view',
        sectionAction: {
          label: 'supplier-directory.list.invite',
          path: 'suppliers?new=1',
          icon: 'userPlus',
          permission: 'supplier.relationship.manage',
        },
      },
    ],
  },
  {
    id: 'supplier-directory.ops',
    area: 'ops',
    routes: [
      {
        path: directoryRoutes.registrations,
        load: () => import('./pages/OpsRegistrationsPage'),
        permission: 'ops.customers.manage',
        title: 'supplier-directory.registrations.title',
      },
      {
        path: directoryRoutes.duplicates,
        load: () => import('./pages/OpsDuplicatesPage'),
        permission: 'ops.customers.manage',
        title: 'supplier-directory.duplicates.pageTitle',
      },
      {
        path: directoryRoutes.duplicate,
        load: () => import('./pages/OpsDuplicateDetailPage'),
        permission: 'ops.customers.manage',
        title: 'supplier-directory.duplicates.detailTitle',
      },
      {
        path: directoryRoutes.identityChanges,
        load: () => import('./pages/OpsIdentityChangesPage'),
        permission: 'ops.customers.manage',
        title: 'supplier-directory.opsIdentity.title',
      },
      {
        path: directoryRoutes.identityChange,
        load: () => import('./pages/OpsIdentityChangeDetailPage'),
        permission: 'ops.customers.manage',
        title: 'supplier-directory.opsIdentity.detailTitle',
      },
    ],
    nav: [
      {
        id: 'ops.supplierReviews',
        label: 'supplier-directory.nav.reviews',
        path: directoryRoutes.registrations,
        section: 'platform',
        order: 80,
        icon: 'userCheck',
        permission: 'ops.customers.manage',
      },
      {
        id: 'ops.supplierDuplicates',
        label: 'supplier-directory.nav.duplicates',
        path: directoryRoutes.duplicates,
        section: 'platform',
        order: 81,
        icon: 'copy',
        permission: 'ops.customers.manage',
      },
      {
        id: 'ops.supplierIdentityChanges',
        label: 'supplier-directory.nav.identityChanges',
        path: directoryRoutes.identityChanges,
        section: 'platform',
        order: 82,
        icon: 'edit',
        permission: 'ops.customers.manage',
      },
    ],
  },
];
