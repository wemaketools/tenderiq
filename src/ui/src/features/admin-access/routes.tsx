/**
 * Users and access (domain 01, FR-03, PRD §4.2, §5.3, §5.4): ADM-03 users, ADM-04 roles, groups, access review and
 * conflict reviews for buyers; SUP-04 members, roles, groups, authority and tender assignments for suppliers. The
 * users, roles and groups pages are the same components under `/buyer/admin/*` and `/supplier/admin/*`. One sidebar
 * entry per area opens the first screen the membership may use; the sub-navigation lists the others.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  BUYER_ACCESS_AREA,
  BUYER_CONFLICTS_READ,
  BUYER_GRANTS_READ,
  BUYER_ROLES_READ,
  BUYER_USERS_READ,
  SUPPLIER_USERS_MANAGE,
} from './lib/permissions';

const home = () => import('./pages/AccessIndexPage');
const users = () => import('./pages/UsersPage');
const user = () => import('./pages/UserDetailPage');
const roles = () => import('./pages/RolesPage');
const role = () => import('./pages/RoleDetailPage');
const groups = () => import('./pages/GroupsPage');
const group = () => import('./pages/GroupDetailPage');

export const features: FeatureModule[] = [
  {
    id: 'admin-access',
    area: 'buyer',
    routes: [
      {
        path: 'admin/access',
        load: home,
        permission: BUYER_ACCESS_AREA,
        title: 'admin-access.nav.title',
      },
      {
        path: 'admin/access/users',
        load: users,
        permission: BUYER_USERS_READ,
        title: 'admin-access.users.title',
      },
      {
        path: 'admin/access/users/:userId',
        load: user,
        permission: BUYER_USERS_READ,
        title: 'admin-access.users.title',
      },
      {
        path: 'admin/access/roles',
        load: roles,
        permission: BUYER_ROLES_READ,
        title: 'admin-access.roles.title',
      },
      {
        path: 'admin/access/roles/:roleId',
        load: role,
        permission: BUYER_ROLES_READ,
        title: 'admin-access.roles.title',
      },
      {
        path: 'admin/access/groups',
        load: groups,
        permission: BUYER_ROLES_READ,
        title: 'admin-access.groups.title',
      },
      {
        path: 'admin/access/groups/:groupId',
        load: group,
        permission: BUYER_ROLES_READ,
        title: 'admin-access.groups.title',
      },
      {
        path: 'admin/access/review',
        load: () => import('./pages/AccessReviewPage'),
        permission: BUYER_GRANTS_READ,
        title: 'admin-access.review.title',
      },
      {
        path: 'admin/access/conflicts',
        load: () => import('./pages/ConflictsPage'),
        permission: BUYER_CONFLICTS_READ,
        title: 'admin-access.conflicts.title',
      },
      {
        path: 'admin/access/conflicts/:declarationId',
        load: () => import('./pages/ConflictDetailPage'),
        permission: BUYER_CONFLICTS_READ,
        title: 'admin-access.conflicts.title',
      },
    ],
    nav: [
      {
        id: 'buyer.admin-access',
        label: 'admin-access.nav.title',
        path: 'admin/access',
        section: 'admin',
        order: 20,
        icon: 'userPlus',
        permission: BUYER_ACCESS_AREA,
      },
    ],
  },
  {
    id: 'admin-access-supplier',
    area: 'supplier',
    routes: [
      {
        path: 'admin/access',
        load: home,
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.nav.supplierTitle',
      },
      {
        path: 'admin/access/users',
        load: users,
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.users.supplierTitle',
      },
      {
        path: 'admin/access/users/:userId',
        load: user,
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.users.supplierTitle',
      },
      {
        path: 'admin/access/roles',
        load: roles,
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.roles.title',
      },
      {
        path: 'admin/access/roles/:roleId',
        load: role,
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.roles.title',
      },
      {
        path: 'admin/access/groups',
        load: groups,
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.groups.title',
      },
      {
        path: 'admin/access/groups/:groupId',
        load: group,
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.groups.title',
      },
      {
        path: 'admin/access/authority',
        load: () => import('./pages/SupplierAuthorityPage'),
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.authority.title',
      },
      {
        path: 'admin/access/assignments',
        load: () => import('./pages/TenderAssignmentsPage'),
        permission: SUPPLIER_USERS_MANAGE,
        title: 'admin-access.assignments.title',
      },
    ],
    nav: [
      {
        id: 'supplier.admin-access',
        label: 'admin-access.nav.supplierTitle',
        path: 'admin/access',
        section: 'admin',
        order: 20,
        icon: 'userPlus',
        permission: SUPPLIER_USERS_MANAGE,
      },
    ],
  },
];
