/**
 * Permission checks for navigation and control visibility (brief §5.8, §10). They answer "does the ACTIVE
 * membership hold X?" from the effective permissions /me/context returned for the active tenant. Hiding is a
 * convenience only: the API enforces every permission.
 */
import type { AnyEndpoint } from '@contracts/endpoint';
import type { PermissionCode } from '@contracts/permissions';

import { useAppSelector } from '../app/hooks';
import { hasPermission } from '../app/featureRegistry';
import type { PermissionRequirement } from '../app/featureRegistry';

const NONE: readonly PermissionCode[] = [];

/** The effective permissions of the active membership (empty without an active tenant). */
export function usePermissions(): readonly PermissionCode[] {
  return useAppSelector((state) => state.session.activeTenant?.permissions ?? NONE);
}

/** True when the active membership holds the permission (or any of a list). */
export function usePermission(requirement: PermissionRequirement | undefined): boolean {
  const permissions = usePermissions();
  return hasPermission(requirement, permissions);
}

/**
 * True when the active membership holds the permission an API endpoint requires (its contract's `permission`), so a
 * page can leave out a panel, tab or tile it could not load instead of showing a restricted placeholder (DD-49), and
 * skip its query. Endpoints without a permission (plain `me` and `public`) are always callable.
 */
export function useCanCall(endpoint: Pick<AnyEndpoint, 'permission'>): boolean {
  return usePermission(endpoint.permission);
}
