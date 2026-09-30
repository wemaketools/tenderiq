import { beforeEach, describe, expect, it } from 'vitest';

import { configureApiClient } from '../api/client';
import { readRememberedTenant, rememberTenant } from '../lib/storage';
import { installFetch, problem } from '../test/fetchMock';
import { makeContext, makeMembership, makeTenant, makeUser } from '../test/fixtures';
import { bootstrapSession, isEnterableMembership, selectTenant } from './sessionActions';
import { sessionPhase } from './sessionSelectors';
import { authSignedIn } from './slices/session';
import { createAppStore } from './store';

beforeEach(() => {
  configureApiClient({
    getAccessToken: () => Promise.resolve('jwt'),
    getActiveTenantId: () => null,
    onUnauthorized: () => undefined,
  });
});

const kwu = makeMembership();
const tsodilo = makeMembership({
  membershipId: 12,
  tenantId: 5,
  tenantKind: 'supplier',
  tenantName: 'Tsodilo Engineering',
  tenantSlug: 'tsodilo',
  capacity: 'Technical Contributor',
});
const pending = makeMembership({
  membershipId: 13,
  tenantId: 7,
  tenantName: 'Serowe ICT Solutions',
  tenantSlug: 'serowe-ict',
  tenantKind: 'supplier',
  status: 'pending_approval',
});

function contextRoutes(memberships = [kwu, tsodilo, pending]) {
  return {
    'GET /api/v1/me/context': (request: { search: string }) => {
      const tenantId = new URLSearchParams(request.search).get('tenantId');
      const membership = memberships.find((item) => String(item.tenantId) === tenantId);
      if (tenantId !== null && (membership === undefined || !isEnterableMembership(membership))) {
        return problem(403, 'Forbidden', { code: 'TENANT_ACCESS_DENIED' });
      }
      return {
        body: makeContext({
          memberships,
          activeTenant:
            membership === undefined
              ? null
              : makeTenant({
                  tenantId: membership.tenantId,
                  kind: membership.tenantKind,
                  name: membership.tenantName,
                  slug: membership.tenantSlug,
                  capacity: membership.capacity,
                }),
        }),
      };
    },
  };
}

function signedInStore() {
  const store = createAppStore();
  store.dispatch(authSignedIn({ email: 'sam.dual@tenderiq.local' }));
  return store;
}

describe('isEnterableMembership', () => {
  it('accepts active memberships of active or offboarding organizations only', () => {
    expect(isEnterableMembership(kwu)).toBe(true);
    expect(isEnterableMembership(makeMembership({ tenantStatus: 'offboarding' }))).toBe(true);
    expect(isEnterableMembership(pending)).toBe(false);
    expect(isEnterableMembership(makeMembership({ tenantStatus: 'suspended' }))).toBe(false);
  });
});

describe('bootstrapSession', () => {
  it('restores the remembered organization when /me/context confirms it', async () => {
    installFetch(contextRoutes());
    rememberTenant(makeUser().id, 5);
    const store = signedInStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().session.activeTenant?.name).toBe('Tsodilo Engineering');
    expect(sessionPhase(store.getState().session)).toBe('ready');
  });

  it('asks the user to choose when several organizations qualify and none is remembered', async () => {
    installFetch(contextRoutes());
    const store = signedInStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().session.activeTenant).toBeNull();
    expect(store.getState().session.memberships).toHaveLength(3);
    expect(sessionPhase(store.getState().session)).toBe('ready');
  });

  it('enters the only enterable organization automatically', async () => {
    installFetch(contextRoutes([kwu, pending]));
    const store = signedInStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().session.activeTenant?.tenantId).toBe(2);
    expect(readRememberedTenant(makeUser().id)).toBe(2);
  });

  it('forgets a remembered organization the API refuses and falls back', async () => {
    installFetch(contextRoutes([kwu]));
    rememberTenant(makeUser().id, 7);
    const store = signedInStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().session.activeTenant?.tenantId).toBe(2);
  });

  it('records a failed context load', async () => {
    installFetch({ 'GET /api/v1/me/context': () => problem(500, 'Internal') });
    const store = signedInStore();
    await store.dispatch(bootstrapSession());
    expect(sessionPhase(store.getState().session)).toBe('contextError');
    expect(store.getState().session.contextError?.correlationId).toBe('corr-test-1');
  });
});

describe('selectTenant', () => {
  it('reports failure with the identical 403 and keeps no remembered tenant', async () => {
    installFetch(contextRoutes());
    const store = signedInStore();
    const ok = await store.dispatch(selectTenant(7));
    expect(ok).toBe(false);
    expect(store.getState().session.tenantError?.status).toBe(403);
    expect(readRememberedTenant(makeUser().id)).toBeNull();
  });
});
