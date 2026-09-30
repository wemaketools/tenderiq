/**
 * Session workflow (docs/technical/09-frontend.md §9 state diagram):
 * signed in → load /me/context → restore the remembered tenant when /me/context confirms it, or enter the only
 * enterable membership, otherwise the user chooses on /select-organization (COM-02). Switching organization sets the
 * new active tenant, which resets every tenant-scoped slice (BR-02). The remembered tenant is a convenience only
 * (DD-36).
 */
import type { SessionMembership } from '@contracts/session';

import { isApiError } from '../api/client';
import { fetchSessionContext } from '../api/session';
import { readRememberedTenant, rememberTenant } from '../lib/storage';
import type { AppDispatch, RootState } from './store';
import {
  activeTenantCleared,
  activeTenantSet,
  contextFailed,
  contextLoaded,
  contextLoading,
  tenantSwitchFailed,
  tenantSwitchStarted,
} from './slices/session';
import type { SessionProblem } from './slices/session';

type Thunk<R> = (dispatch: AppDispatch, getState: () => RootState) => Promise<R>;

/** Tenant statuses in which a member can still work in the organization. */
const ENTERABLE_TENANT_STATUSES: readonly string[] = ['active', 'offboarding'];

/** True when the membership can be selected as the active organization. */
export function isEnterableMembership(membership: SessionMembership): boolean {
  return (
    membership.status === 'active' && ENTERABLE_TENANT_STATUSES.includes(membership.tenantStatus)
  );
}

export function toSessionProblem(error: unknown): SessionProblem {
  if (isApiError(error)) {
    return {
      kind: error.kind,
      status: error.status,
      title: error.title,
      correlationId: error.correlationId,
    };
  }
  return {
    kind: 'network',
    status: 0,
    title: error instanceof Error ? error.message : 'The request failed.',
    correlationId: null,
  };
}

/** True while the user is still signed in (results that arrive after a sign-out are dropped). */
function stillSignedIn(getState: () => RootState): boolean {
  return getState().session.authStatus === 'signedIn';
}

/** Enters an organization: loads its effective permissions and makes it the active tenant. */
export function selectTenant(tenantId: number): Thunk<boolean> {
  return async (dispatch, getState) => {
    dispatch(tenantSwitchStarted({ tenantId }));
    try {
      const context = await fetchSessionContext(tenantId);
      if (!stillSignedIn(getState)) {
        return false;
      }
      if (context.activeTenant === null || context.activeTenant.tenantId !== tenantId) {
        throw new Error('The organization could not be entered.');
      }
      dispatch(contextLoaded(context));
      dispatch(activeTenantSet(context.activeTenant));
      rememberTenant(context.user.id, tenantId);
      return true;
    } catch (error) {
      if (!stillSignedIn(getState)) {
        return false;
      }
      const userId = getState().session.user?.id;
      if (userId !== undefined) {
        rememberTenant(userId, null);
      }
      dispatch(tenantSwitchFailed(toSessionProblem(error)));
      return false;
    }
  };
}

/** Leaves the active organization (for example before choosing another on COM-02). */
export function clearTenant(): Thunk<void> {
  return (dispatch) => {
    dispatch(activeTenantCleared());
    return Promise.resolve();
  };
}

/** Loads /me/context after sign-in and restores or picks the active organization. */
export function bootstrapSession(): Thunk<void> {
  return async (dispatch, getState) => {
    dispatch(contextLoading());
    let context;
    try {
      context = await fetchSessionContext();
    } catch (error) {
      if (stillSignedIn(getState)) {
        dispatch(contextFailed(toSessionProblem(error)));
      }
      return;
    }
    if (!stillSignedIn(getState)) {
      return;
    }
    // The context counts as loaded only once the organization decision is made, so guards never see a
    // "ready without tenant" moment while the remembered tenant is being restored.
    const enterable = context.memberships.filter(isEnterableMembership);
    const remembered = readRememberedTenant(context.user.id);
    const candidates: number[] = [];
    if (remembered !== null && enterable.some((membership) => membership.tenantId === remembered)) {
      candidates.push(remembered);
    }
    const only = enterable.length === 1 ? enterable[0] : undefined;
    if (only !== undefined && !candidates.includes(only.tenantId)) {
      candidates.push(only.tenantId);
    }
    for (const tenantId of candidates) {
      if (await dispatch(selectTenant(tenantId))) {
        return;
      }
    }
    if (stillSignedIn(getState)) {
      dispatch(contextLoaded(context));
    }
  };
}
