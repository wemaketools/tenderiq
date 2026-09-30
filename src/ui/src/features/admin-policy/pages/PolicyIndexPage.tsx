/**
 * The entry of the policy administration area: opens the first of ADM-06, ADM-07, ADM-08 and ADM-11 that the
 * membership may use (the route itself requires at least one of them).
 */
import { Navigate } from 'react-router';

import { usePermission } from '../../../auth/permissions';
import { RestrictedState } from '../../../components/ui';
import { policyPaths } from '../lib/paths';
import { FIELDS_READ, PORTAL_READ, PROFILES_READ, TEMPLATES_READ } from '../lib/permissions';

export default function PolicyIndexPage() {
  const profiles = usePermission(PROFILES_READ);
  const fields = usePermission(FIELDS_READ);
  const templates = usePermission(TEMPLATES_READ);
  const portal = usePermission(PORTAL_READ);
  const target = profiles
    ? policyPaths.profiles
    : fields
      ? policyPaths.fields
      : templates
        ? policyPaths.templates
        : portal
          ? policyPaths.portal
          : null;
  if (target === null) return <RestrictedState />;
  return <Navigate to={target} replace />;
}
