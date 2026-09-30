/** Session states of the reporting feature tests (test data only). */
import type { PermissionCode } from '@contracts/permissions';

import { makeMembership, makeTenant, signedInSession, stateWith } from '../../test/fixtures';

export function buyerState(permissions: readonly PermissionCode[]) {
  return stateWith(
    signedInSession({
      activeTenant: makeTenant({ capacity: 'Procurement Manager' }, permissions),
    }),
  );
}

export function supplierState(permissions: readonly PermissionCode[]) {
  return stateWith(
    signedInSession({
      memberships: [
        makeMembership({
          tenantId: 4,
          tenantKind: 'supplier',
          tenantName: 'Tsodilo Engineering',
          tenantSlug: 'tsodilo',
          capacity: 'Bid Manager',
        }),
      ],
      activeTenant: makeTenant(
        {
          tenantId: 4,
          kind: 'supplier',
          name: 'Tsodilo Engineering',
          slug: 'tsodilo',
          capacity: 'Bid Manager',
        },
        permissions,
      ),
    }),
  );
}

export const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 25 };
