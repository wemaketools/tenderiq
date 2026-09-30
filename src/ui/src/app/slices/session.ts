/**
 * Session slice (brief §10, docs/technical/09-frontend.md §9): the signed-in user, every membership, the environment
 * reported by /me/context, and the ACTIVE tenant with its effective permissions. The session slice is the single
 * source of `X-Tenant-Id` for the API client.
 *
 * `tenantEpoch` increases every time the active tenant is set or cleared. Tenant-scoped slices reset on those actions
 * and the query hooks include the epoch in their cache key, so nothing fetched under one tenant renders under another
 * (BR-02).
 */
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type {
  ActiveTenantContext,
  SessionContext,
  SessionEnvironment,
  SessionMembership,
  SessionUser,
} from '@contracts/session';
import type { UsersTheme } from '@contracts/enums';

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn';
export type ContextStatus = 'idle' | 'loading' | 'ready' | 'error';
export type TenantStatus = 'none' | 'switching' | 'active' | 'error';
/** Why the last sign-out happened: the user chose it, the session expired, or the API rejected the account. */
export type SignOutReason = 'user' | 'expired' | 'rejected';

/** A serializable summary of a failed session request. */
export interface SessionProblem {
  readonly kind: string;
  readonly status: number;
  readonly title: string;
  readonly correlationId: string | null;
}

export interface SessionState {
  readonly authStatus: AuthStatus;
  readonly authUserEmail: string | null;
  readonly contextStatus: ContextStatus;
  readonly contextError: SessionProblem | null;
  readonly user: SessionUser | null;
  readonly memberships: readonly SessionMembership[];
  readonly environment: SessionEnvironment | null;
  readonly serverTime: string | null;
  readonly activeTenant: ActiveTenantContext | null;
  readonly tenantStatus: TenantStatus;
  readonly tenantError: SessionProblem | null;
  /** The tenant a switch is heading to (for progress text). */
  readonly pendingTenantId: number | null;
  readonly tenantEpoch: number;
  readonly signOutReason: SignOutReason | null;
}

export const initialSessionState: SessionState = {
  authStatus: 'initializing',
  authUserEmail: null,
  contextStatus: 'idle',
  contextError: null,
  user: null,
  memberships: [],
  environment: null,
  serverTime: null,
  activeTenant: null,
  tenantStatus: 'none',
  tenantError: null,
  pendingTenantId: null,
  tenantEpoch: 0,
  signOutReason: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState: initialSessionState,
  reducers: {
    authSignedIn(state, action: PayloadAction<{ email: string | null }>) {
      state.authStatus = 'signedIn';
      state.authUserEmail = action.payload.email;
      state.signOutReason = null;
    },
    signedOut(state, action: PayloadAction<SignOutReason | undefined>) {
      return {
        ...initialSessionState,
        authStatus: 'signedOut',
        tenantEpoch: state.tenantEpoch + 1,
        signOutReason: action.payload ?? null,
      };
    },
    contextLoading(state) {
      state.contextStatus = 'loading';
      state.contextError = null;
    },
    contextLoaded(state, action: PayloadAction<SessionContext>) {
      const context = action.payload;
      state.contextStatus = 'ready';
      state.contextError = null;
      state.user = context.user;
      state.memberships = context.memberships;
      state.environment = context.environment;
      state.serverTime = context.serverTime;
    },
    contextFailed(state, action: PayloadAction<SessionProblem>) {
      state.contextStatus = 'error';
      state.contextError = action.payload;
    },
    tenantSwitchStarted(state, action: PayloadAction<{ tenantId: number }>) {
      state.tenantStatus = 'switching';
      state.tenantError = null;
      state.pendingTenantId = action.payload.tenantId;
    },
    activeTenantSet(state, action: PayloadAction<ActiveTenantContext>) {
      state.activeTenant = action.payload;
      state.tenantStatus = 'active';
      state.tenantError = null;
      state.pendingTenantId = null;
      state.tenantEpoch += 1;
    },
    tenantSwitchFailed(state, action: PayloadAction<SessionProblem>) {
      state.tenantStatus = state.activeTenant === null ? 'error' : 'active';
      state.tenantError = action.payload;
      state.pendingTenantId = null;
    },
    activeTenantCleared(state) {
      state.activeTenant = null;
      state.tenantStatus = 'none';
      state.pendingTenantId = null;
      state.tenantEpoch += 1;
    },
    tenantErrorDismissed(state) {
      state.tenantError = null;
      if (state.tenantStatus === 'error') {
        state.tenantStatus = 'none';
      }
    },
    themeChanged(state, action: PayloadAction<UsersTheme>) {
      if (state.user !== null) {
        state.user.theme = action.payload;
      }
    },
  },
});

export const {
  authSignedIn,
  signedOut,
  contextLoading,
  contextLoaded,
  contextFailed,
  tenantSwitchStarted,
  activeTenantSet,
  tenantSwitchFailed,
  activeTenantCleared,
  tenantErrorDismissed,
  themeChanged,
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

/** Actions after which every tenant-scoped slice must reset. */
export const tenantBoundaryActions = [activeTenantSet, activeTenantCleared, signedOut] as const;
