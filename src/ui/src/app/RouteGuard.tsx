/**
 * RouteGuard (brief §10, docs/technical/09-frontend.md §8): a usability layer over the API's own 401/403 checks.
 *
 * 1. While the session is being established → loading screen.
 * 2. Signed out (or the context failed) → /signin, remembering the requested URL.
 * 3. `requireTenant` and no active organization → /select-organization (COM-02).
 * 4. `area` whose tenant kind differs from the active organization's → ContextRequired (the areas mirror the API's
 *    audience prefixes).
 * 5. `permission` not held by the active membership → Forbidden.
 * Otherwise it renders `children`, or the nested route (`<Outlet />`).
 */
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { ContextRequiredPage } from '../pages/ContextRequiredPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { LoadingScreen } from '../pages/LoadingScreen';
import { t } from '../lib/i18n';
import { AREA_TENANT_KIND, hasPermission } from './featureRegistry';
import type { FeatureArea, PermissionRequirement } from './featureRegistry';
import { useAppSelector } from './hooks';
import { sessionPhase } from './sessionSelectors';

export interface RouteGuardProps {
  readonly requireTenant?: boolean;
  readonly area?: FeatureArea;
  readonly permission?: PermissionRequirement;
  readonly children?: ReactNode;
}

export function RouteGuard({ requireTenant = false, area, permission, children }: RouteGuardProps) {
  const session = useAppSelector((state) => state.session);
  const location = useLocation();
  const phase = sessionPhase(session);

  if (phase === 'initializing' || phase === 'loadingContext') {
    return <LoadingScreen />;
  }
  if (phase === 'switchingTenant' && session.activeTenant === null) {
    return <LoadingScreen message={t('shell.loading.organization')} />;
  }
  if (phase === 'signedOut' || phase === 'contextError') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/signin" replace state={{ from }} />;
  }
  const tenant = session.activeTenant;
  if (requireTenant && tenant === null) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/select-organization" replace state={{ from }} />;
  }
  if (area !== undefined && tenant !== null) {
    const kind = AREA_TENANT_KIND[area];
    if (kind !== null && kind !== tenant.kind) {
      return <ContextRequiredPage requiredKind={kind} />;
    }
  }
  if (permission !== undefined && !hasPermission(permission, tenant?.permissions ?? [])) {
    return <ForbiddenPage />;
  }
  return <>{children ?? <Outlet />}</>;
}
