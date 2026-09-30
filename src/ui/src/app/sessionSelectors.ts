/**
 * Where the session stands (docs/technical/09-frontend.md §9 state diagram) and where a signed-in user lands.
 */
import type { SessionState } from './slices/session';
import { AREA_ROOTS, TENANT_KIND_AREA } from './featureTypes';

export type SessionPhase =
  'initializing' | 'signedOut' | 'loadingContext' | 'contextError' | 'switchingTenant' | 'ready';

export function sessionPhase(session: SessionState): SessionPhase {
  if (session.authStatus === 'initializing') return 'initializing';
  if (session.authStatus === 'signedOut') return 'signedOut';
  if (session.contextStatus === 'error') return 'contextError';
  if (session.contextStatus !== 'ready') return 'loadingContext';
  if (session.tenantStatus === 'switching') return 'switchingTenant';
  return 'ready';
}

/** The home of the active organization's area, or the organization selection (COM-02). */
export function landingPath(session: SessionState): string {
  const tenant = session.activeTenant;
  if (tenant === null) {
    return '/select-organization';
  }
  return AREA_ROOTS[TENANT_KIND_AREA[tenant.kind]];
}
