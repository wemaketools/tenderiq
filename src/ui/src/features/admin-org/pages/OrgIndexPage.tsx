/**
 * The entry of the organization area: opens the first of ADM-01, ADM-02 and ADM-05 that the membership may use (the
 * route itself requires at least one of them).
 */
import { Navigate } from 'react-router';

import { usePermission } from '../../../auth/permissions';
import { RestrictedState } from '../../../components/ui';
import { orgPaths } from '../lib/paths';
import { AUTHORITY_READ, COMMITTEES_READ, ORG_READ, STRUCTURE_READ } from '../lib/permissions';

export default function OrgIndexPage() {
  const organization = usePermission(ORG_READ);
  const structure = usePermission(STRUCTURE_READ);
  const authority = usePermission(AUTHORITY_READ);
  const committees = usePermission(COMMITTEES_READ);
  const target = organization
    ? orgPaths.settings
    : structure
      ? orgPaths.structure
      : authority || committees
        ? orgPaths.authority
        : null;
  if (target === null) return <RestrictedState />;
  return <Navigate to={target} replace />;
}
