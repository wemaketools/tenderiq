/**
 * Context required: the URL belongs to another kind of organization than the active one (for example a supplier page
 * while acting for a buyer). The areas mirror the API's audience prefixes; switching organization is the way in.
 */
import type { TenantKind } from '@contracts/common';

import { useActiveTenant, useMemberships } from '../app/hooks';
import { AREA_ROOTS, TENANT_KIND_AREA } from '../app/featureTypes';
import { isEnterableMembership } from '../app/sessionActions';
import { ButtonLink } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { RestrictedState } from '../components/ui/EmptyState';
import { t, tEnum } from '../lib/i18n';

export interface ContextRequiredPageProps {
  /** The organization kind the page needs. */
  readonly requiredKind: TenantKind;
}

export function ContextRequiredPage({ requiredKind }: ContextRequiredPageProps) {
  const tenant = useActiveTenant();
  const memberships = useMemberships();
  const hasMatching = memberships.some(
    (membership) => membership.tenantKind === requiredKind && isEnterableMembership(membership),
  );
  const kindLabel = tEnum('tenants.kind', requiredKind).toLowerCase();
  return (
    <div className="tiq-page">
      <PageHeader title={t('pages.contextRequired.title')} />
      <div className="tiq-card">
        <RestrictedState
          title={t('pages.contextRequired.heading', { kind: kindLabel })}
          description={
            hasMatching
              ? t('pages.contextRequired.switch', {
                  kind: kindLabel,
                  organization: tenant?.name ?? '',
                })
              : t('pages.contextRequired.none', { kind: kindLabel })
          }
          action={
            hasMatching ? (
              <ButtonLink to="/select-organization" variant="primary" icon="switchOrg">
                {t('shell.user.switch')}
              </ButtonLink>
            ) : tenant !== null ? (
              <ButtonLink to={AREA_ROOTS[TENANT_KIND_AREA[tenant.kind]]}>
                {t('pages.contextRequired.back', { organization: tenant.name })}
              </ButtonLink>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
