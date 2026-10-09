/**
 * The entry of the users-and-access area: opens the first screen the membership may use (users, roles, access
 * review or conflict reviews for buyers; members for suppliers). The route itself requires at least one of them.
 */
import { Navigate } from 'react-router';

import { usePermission } from '../../../auth/permissions';
import { ForbiddenPage } from '../../../pages/ForbiddenPage';
import { useAdminKind } from '../lib/audience';
import { accessPaths, buyerAccessPaths } from '../lib/paths';
import {
  BUYER_CONFLICTS_READ,
  BUYER_GRANTS_READ,
  BUYER_ROLES_READ,
  BUYER_USERS_READ,
  SUPPLIER_USERS_MANAGE,
} from '../lib/permissions';

export default function AccessIndexPage() {
  const kind = useAdminKind();
  const users = usePermission(BUYER_USERS_READ);
  const roles = usePermission(BUYER_ROLES_READ);
  const grants = usePermission(BUYER_GRANTS_READ);
  const conflicts = usePermission(BUYER_CONFLICTS_READ);
  const supplier = usePermission(SUPPLIER_USERS_MANAGE);
  const paths = accessPaths(kind);
  let target: string | null = null;
  if (kind === 'supplier') {
    target = supplier ? paths.users : null;
  } else if (users) {
    target = paths.users;
  } else if (roles) {
    target = paths.roles;
  } else if (grants) {
    target = buyerAccessPaths.review;
  } else if (conflicts) {
    target = buyerAccessPaths.conflicts;
  }
  if (target === null) return <ForbiddenPage />;
  return <Navigate to={target} replace />;
}
