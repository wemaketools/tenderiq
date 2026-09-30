/**
 * The home of an area (`/buyer`, `/supplier`, `/ops`, `/me`) when no feature claims the area root: it opens the
 * first destination the active membership may use, or explains that none is available with its permissions.
 */
import { Navigate } from 'react-router';

import { features, firstNavDestination, navGroupsFor } from '../app/featureRegistry';
import type { FeatureArea, FeatureModule } from '../app/featureRegistry';
import { useActiveTenant } from '../app/hooks';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ButtonLink } from '../components/ui/Button';
import { t } from '../lib/i18n';

export function AreaHomePage({
  area,
  modules = features,
}: {
  readonly area: FeatureArea;
  readonly modules?: readonly FeatureModule[];
}) {
  const tenant = useActiveTenant();
  if (tenant === null) {
    return null;
  }
  const groups = navGroupsFor(modules, {
    tenantKind: tenant.kind,
    permissions: tenant.permissions,
  });
  const destination = firstNavDestination(groups, area);
  if (destination !== null) {
    return <Navigate to={destination} replace />;
  }
  return (
    <div className="tiq-page">
      <PageHeader title={t('pages.areaHome.title', { organization: tenant.name })} />
      <div className="tiq-card">
        <EmptyState
          icon="compass"
          title={t('pages.areaHome.emptyTitle')}
          description={t('pages.areaHome.empty', {
            capacity: tenant.capacity ?? t('shell.user.member'),
          })}
          action={
            <ButtonLink to="/select-organization" icon="switchOrg">
              {t('shell.user.switch')}
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
