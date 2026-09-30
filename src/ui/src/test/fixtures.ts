/**
 * Contract-valid session values for SPA tests (test data only; the application's data comes from the API).
 */
import type {
  ActiveTenantContext,
  SessionContext,
  SessionMembership,
  SessionUser,
} from '@contracts/session';
import type { PermissionCode } from '@contracts/permissions';

import { initialSessionState } from '../app/slices/session';
import type { SessionState } from '../app/slices/session';
import type { RootState } from '../app/store';

export function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 101,
    email: 'tebogo.officer@tenderiq.local',
    fullName: 'Tebogo Molefe',
    phone: null,
    locale: 'en',
    displayTimeZone: null,
    theme: 'light',
    status: 'active',
    isPlatformOperator: false,
    lastSeenAt: null,
    ...overrides,
  };
}

export function makeMembership(overrides: Partial<SessionMembership> = {}): SessionMembership {
  return {
    membershipId: 11,
    tenantId: 2,
    tenantKind: 'buyer',
    tenantName: 'Kalahari Water Utilities (Pilot)',
    tenantSlug: 'kwu',
    tenantStatus: 'active',
    capacity: 'Procurement Officer',
    status: 'active',
    joinedAt: '2026-01-05T08:00:00Z',
    roles: [
      {
        roleId: 7,
        code: 'procurement_officer',
        name: 'Procurement officer',
        templateCode: 'procurement_officer',
        scopeType: 'organization',
        scopeId: null,
        scopeLabel: null,
      },
    ],
    ...overrides,
  };
}

export function makeTenant(
  overrides: Partial<ActiveTenantContext> = {},
  permissions: readonly PermissionCode[] = ['tender.view', 'dashboard.view'],
): ActiveTenantContext {
  return {
    tenantId: 2,
    kind: 'buyer',
    name: 'Kalahari Water Utilities (Pilot)',
    slug: 'kwu',
    officialTimeZone: 'Africa/Gaborone',
    defaultCurrency: 'BWP',
    workingLanguages: ['en'],
    capacity: 'Procurement Officer',
    access: 'membership',
    supportGrant: null,
    permissions: [...permissions],
    ...overrides,
  };
}

export function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    user: makeUser(),
    memberships: [makeMembership()],
    activeTenant: null,
    environment: { mode: 'prototype', appEnv: 'local' },
    serverTime: '2026-09-29T08:00:00Z',
    ...overrides,
  };
}

/** A session slice for a signed-in user with an active organization. */
export function signedInSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...initialSessionState,
    authStatus: 'signedIn',
    authUserEmail: 'tebogo.officer@tenderiq.local',
    contextStatus: 'ready',
    user: makeUser(),
    memberships: [makeMembership()],
    environment: { mode: 'prototype', appEnv: 'local' },
    serverTime: '2026-09-29T08:00:00Z',
    activeTenant: makeTenant(),
    tenantStatus: 'active',
    tenantEpoch: 1,
    ...overrides,
  };
}

export function stateWith(session: SessionState): Partial<RootState> {
  return { session };
}
