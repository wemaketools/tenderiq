import { describe, expect, it } from 'vitest';

import { makeTenant, signedInSession } from '../../test/fixtures';
import { createAppStore } from '../store';
import { navBadgeSet, notificationCountsLoaded, taskCountsLoaded } from './badges';
import { filtersChanged, filtersCleared, filtersReplaced } from './filters';
import {
  activeTenantCleared,
  activeTenantSet,
  authSignedIn,
  signedOut,
  tenantSwitchFailed,
  tenantSwitchStarted,
  themeChanged,
} from './session';

describe('session slice', () => {
  it('increases the tenant epoch whenever the active tenant is set or cleared', () => {
    const store = createAppStore({ session: signedInSession({ tenantEpoch: 4 }) });
    store.dispatch(activeTenantSet(makeTenant({ tenantId: 3 })));
    expect(store.getState().session.tenantEpoch).toBe(5);
    store.dispatch(activeTenantCleared());
    expect(store.getState().session.activeTenant).toBeNull();
    expect(store.getState().session.tenantEpoch).toBe(6);
  });

  it('keeps the current tenant when a switch fails and records the problem', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(tenantSwitchStarted({ tenantId: 99 }));
    expect(store.getState().session.tenantStatus).toBe('switching');
    store.dispatch(
      tenantSwitchFailed({
        kind: 'forbidden',
        status: 403,
        title: 'Forbidden',
        correlationId: 'c',
      }),
    );
    expect(store.getState().session.tenantStatus).toBe('active');
    expect(store.getState().session.activeTenant?.tenantId).toBe(2);
    expect(store.getState().session.tenantError?.status).toBe(403);
  });

  it('resets everything on sign-out and records the reason', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(signedOut('expired'));
    const session = store.getState().session;
    expect(session.authStatus).toBe('signedOut');
    expect(session.user).toBeNull();
    expect(session.activeTenant).toBeNull();
    expect(session.signOutReason).toBe('expired');
    store.dispatch(authSignedIn({ email: 'a@b.c' }));
    expect(store.getState().session.signOutReason).toBeNull();
  });

  it('changes the theme of the signed-in user', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(themeChanged('dark'));
    expect(store.getState().session.user?.theme).toBe('dark');
  });
});

describe('filters slice (tenant-scoped)', () => {
  it('merges, replaces and clears a screen’s filters', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(filtersChanged({ screen: 'BUY-07', values: { status: 'open' } }));
    store.dispatch(filtersChanged({ screen: 'BUY-07', values: { q: 'pump' } }));
    expect(store.getState().filters.byScreen['BUY-07']).toEqual({ status: 'open', q: 'pump' });
    store.dispatch(filtersReplaced({ screen: 'BUY-07', values: { owner: 'me' } }));
    expect(store.getState().filters.byScreen['BUY-07']).toEqual({ owner: 'me' });
    store.dispatch(filtersCleared({ screen: 'BUY-07' }));
    expect(store.getState().filters.byScreen['BUY-07']).toBeUndefined();
  });

  it('clears every filter when the organization changes', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(filtersChanged({ screen: 'BUY-07', values: { status: 'open' } }));
    store.dispatch(activeTenantSet(makeTenant({ tenantId: 3 })));
    expect(store.getState().filters.byScreen).toEqual({});
  });
});

describe('badges slice', () => {
  it('keeps personal counts across a tenant switch but clears tenant nav badges', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(notificationCountsLoaded({ unread: 3, requiresAcknowledgment: 1 }));
    store.dispatch(taskCountsLoaded({ open: 7, overdue: 2 }));
    store.dispatch(navBadgeSet({ id: 'buyer.clarifications', count: 4 }));
    store.dispatch(activeTenantSet(makeTenant({ tenantId: 3 })));
    const badges = store.getState().badges;
    expect(badges.me.notificationsUnread).toBe(3);
    expect(badges.me.tasksOverdue).toBe(2);
    expect(badges.nav).toEqual({});
  });

  it('hides a badge when its count is unavailable and resets on sign-out', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(taskCountsLoaded({ open: 7, overdue: 2 }));
    store.dispatch(notificationCountsLoaded(null));
    expect(store.getState().badges.me.notificationsUnread).toBeNull();
    store.dispatch(navBadgeSet({ id: 'x', count: 2 }));
    store.dispatch(navBadgeSet({ id: 'x', count: 0 }));
    expect(store.getState().badges.nav).toEqual({});
    store.dispatch(signedOut());
    expect(store.getState().badges.me.tasksOpen).toBeNull();
  });
});
