/**
 * The member-administration audience of the active organization. The users, roles and groups screens are shared by
 * buyers (ADM-03, ADM-04) and suppliers (SUP-04): the endpoint set, the paths and the manage permission follow the
 * active tenant's kind, so a supplier administrator never reaches a buyer endpoint (and never sees buyer
 * privileges: the role catalog lists only the tenant's own kind).
 */
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { memberAdminEndpointsFor } from '../../../api/org-admin';
import type { MemberAdminEndpoints } from '../../../api/org-admin';
import { accessPaths } from './paths';
import type { AccessPaths, AdminKind } from './paths';
import { BUYER_ROLES_MANAGE, BUYER_USERS_MANAGE, SUPPLIER_USERS_MANAGE } from './permissions';

export interface MemberAdmin {
  readonly kind: AdminKind;
  readonly endpoints: MemberAdminEndpoints;
  readonly paths: AccessPaths;
  /** Lifecycle commands (invite, suspend, deactivate…). */
  readonly canManageUsers: boolean;
  /** Roles, groups and role assignments. */
  readonly canManageRoles: boolean;
  /** i18n key prefix of the screen id (`ADM-03` or `SUP-04`) used for filters. */
  readonly usersScreen: 'ADM-03' | 'SUP-04';
  readonly rolesScreen: 'ADM-04' | 'SUP-04';
}

export function useAdminKind(): AdminKind {
  return useActiveTenant()?.kind === 'supplier' ? 'supplier' : 'buyer';
}

export function useMemberAdmin(): MemberAdmin {
  const kind = useAdminKind();
  const buyerUsers = usePermission(BUYER_USERS_MANAGE);
  const buyerRoles = usePermission(BUYER_ROLES_MANAGE);
  const supplier = usePermission(SUPPLIER_USERS_MANAGE);
  return {
    kind,
    endpoints: memberAdminEndpointsFor(kind),
    paths: accessPaths(kind),
    canManageUsers: kind === 'buyer' ? buyerUsers : supplier,
    canManageRoles: kind === 'buyer' ? buyerRoles : supplier,
    usersScreen: kind === 'buyer' ? 'ADM-03' : 'SUP-04',
    rolesScreen: kind === 'buyer' ? 'ADM-04' : 'SUP-04',
  };
}
