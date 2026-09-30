/**
 * Organization administration (domain 01, FR-01, FR-03, BR-06, BR-07): ADM-01 organization and legal entities,
 * ADM-02 departments, locations and business classifications, ADM-05 authority, committees and delegations. One
 * sidebar entry opens the first screen the membership may use; the sub-navigation lists the others.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  AUTHORITY_AREA,
  COMMITTEES_READ,
  ORG_AREA,
  ORG_READ,
  STRUCTURE_READ,
} from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'admin-org',
    area: 'buyer',
    routes: [
      {
        path: 'admin/organization',
        load: () => import('./pages/OrgIndexPage'),
        permission: ORG_AREA,
        title: 'admin-org.nav.title',
      },
      {
        path: 'admin/organization/settings',
        load: () => import('./pages/OrganizationPage'),
        permission: ORG_READ,
        title: 'admin-org.settings.title',
      },
      {
        path: 'admin/organization/structure',
        load: () => import('./pages/StructurePage'),
        permission: STRUCTURE_READ,
        title: 'admin-org.structure.title',
      },
      {
        path: 'admin/organization/authority',
        load: () => import('./pages/AuthorityPage'),
        permission: AUTHORITY_AREA,
        title: 'admin-org.authority.title',
      },
      {
        path: 'admin/organization/committees/:committeeId',
        load: () => import('./pages/CommitteePage'),
        permission: COMMITTEES_READ,
        title: 'admin-org.committees.title',
      },
    ],
    nav: [
      {
        id: 'buyer.admin-org',
        label: 'admin-org.nav.title',
        path: 'admin/organization',
        section: 'admin',
        order: 10,
        icon: 'building',
        permission: ORG_AREA,
      },
    ],
  },
];
