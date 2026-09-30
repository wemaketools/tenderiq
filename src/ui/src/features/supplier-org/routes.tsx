/**
 * Supplier organization feature (domain 03): public registration and claiming an invited organization (SUP-02), the
 * requester's membership requests, the organization profile and identity changes (SUP-03), and the evidence library
 * (SUP-05).
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { supplierOrgRoutes } from './lib/paths';
import { EVIDENCE_MANAGE, EVIDENCE_READ, PROFILE_MANAGE, PROFILE_READ } from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'supplier-org.public',
    area: 'public',
    routes: [
      {
        path: supplierOrgRoutes.register,
        load: () => import('./pages/RegisterPage'),
        title: 'supplier-org.register.title',
      },
      {
        path: supplierOrgRoutes.claim,
        load: () => import('./pages/ClaimOrganizationPage'),
        title: 'supplier-org.claim.title',
      },
    ],
  },
  {
    id: 'supplier-org.me',
    area: 'common',
    routes: [
      {
        path: supplierOrgRoutes.myMembershipRequests,
        load: () => import('./pages/MyMembershipRequestsPage'),
        title: 'supplier-org.mine.title',
      },
    ],
    nav: [
      {
        id: 'me.supplierMembershipRequests',
        label: 'supplier-org.nav.membershipRequests',
        path: supplierOrgRoutes.myMembershipRequests,
        section: 'admin',
        order: 92,
        icon: 'userCheck',
        tenantKinds: ['supplier'],
      },
    ],
  },
  {
    id: 'supplier-org',
    area: 'supplier',
    routes: [
      {
        path: supplierOrgRoutes.profile,
        load: () => import('./pages/OrganizationProfilePage'),
        permission: PROFILE_READ,
        title: 'supplier-org.profile.title',
      },
      {
        path: supplierOrgRoutes.editProfile,
        load: () => import('./pages/ProfileEditPage'),
        permission: PROFILE_MANAGE,
        title: 'supplier-org.edit.title',
      },
      {
        path: supplierOrgRoutes.newIdentityChange,
        load: () => import('./pages/IdentityChangeNewPage'),
        permission: PROFILE_MANAGE,
        title: 'supplier-org.change.newTitle',
      },
      {
        path: supplierOrgRoutes.identityChange,
        load: () => import('./pages/IdentityChangeDetailPage'),
        permission: PROFILE_READ,
        title: 'supplier-org.change.detailTitle',
      },
      {
        path: supplierOrgRoutes.evidence,
        load: () => import('./pages/EvidenceLibraryPage'),
        permission: EVIDENCE_READ,
        title: 'supplier-org.evidence.title',
      },
      {
        path: supplierOrgRoutes.newEvidence,
        load: () => import('./pages/EvidenceNewPage'),
        permission: EVIDENCE_MANAGE,
        title: 'supplier-org.evidenceForm.newTitle',
      },
      {
        path: supplierOrgRoutes.evidenceItem,
        load: () => import('./pages/EvidenceDetailPage'),
        permission: EVIDENCE_READ,
        title: 'supplier-org.evidenceDetail.title',
      },
    ],
    nav: [
      {
        id: 'supplier.evidence',
        label: 'supplier-org.nav.evidence',
        path: supplierOrgRoutes.evidence,
        section: 'suppliers',
        order: 20,
        icon: 'folder',
        permission: EVIDENCE_READ,
      },
      {
        id: 'supplier.organization',
        label: 'supplier-org.nav.organization',
        path: supplierOrgRoutes.profile,
        section: 'admin',
        order: 10,
        icon: 'building',
        permission: PROFILE_READ,
      },
    ],
  },
];
