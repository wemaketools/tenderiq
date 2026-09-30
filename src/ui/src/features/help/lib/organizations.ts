/** The organizations a person may make a service request for (active memberships), and the default one. */
import { useActiveTenant, useMemberships } from '../../../app/hooks';

export function useRequestOrganizations() {
  const memberships = useMemberships();
  return memberships.filter((membership) => membership.status === 'active');
}

export function useDefaultOrganization(): string {
  const tenant = useActiveTenant();
  const organizations = useRequestOrganizations();
  if (
    tenant !== null &&
    organizations.some((membership) => membership.tenantId === tenant.tenantId)
  ) {
    return String(tenant.tenantId);
  }
  return organizations.length === 1 ? String(organizations[0]?.tenantId ?? '') : '';
}
