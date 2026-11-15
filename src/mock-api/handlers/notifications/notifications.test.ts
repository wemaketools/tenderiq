import { beforeAll, describe, expect, it } from 'vitest';

import { MANDATORY_NOTIFICATION_EVENT_TYPES } from '../../../contracts/enums.js';
import { NotificationItem, notificationEndpoints } from '../../../contracts/notifications.js';
import { WORKSPACE_AS_OF } from '../../fixtures/approvals/world.js';
import { allPersonas } from '../../persona.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

const EMAIL = (login: string): string => `${login}@tenderiq.local`;

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ modules: [{ name: 'notifications', register }] });
});

describe('notifications module', () => {
  it('loads without skipped modules', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('notifications');
  });

  it.each(allPersonas().filter((persona) => persona.status === 'active').map((persona) => [persona.email] as const))(
    'serves a contract-valid center, summary and preferences with at least one notification for %s',
    async (email) => {
      const list = await api.callAs(email, notificationEndpoints.listMyNotifications, { query: { pageSize: 100 } });
      expect(list.status).toBe(200);
      expect(notificationEndpoints.listMyNotifications.response.parse(list.body).total).toBeGreaterThan(0);
      expect((await api.callAs(email, notificationEndpoints.getMyNotificationSummary)).status).toBe(200);
      expect((await api.callAs(email, notificationEndpoints.getNotificationPreferences)).status).toBe(200);
    },
  );
});

describe('me.notifications.list', () => {
  it('lists newest first by default', async () => {
    const list = await api.callAs(EMAIL('tebogo.officer'), notificationEndpoints.listMyNotifications);
    const times = notificationEndpoints.listMyNotifications.response.parse(list.body).items.map((row) => Date.parse(row.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('separates the unread and awaiting-acknowledgment tabs (BR-41)', async () => {
    const unread = await api.callAs(EMAIL('chobe-pipe.bidmanager'), notificationEndpoints.listMyNotifications, { query: { unread: 'true' } });
    const awaiting = await api.callAs(EMAIL('chobe-pipe.bidmanager'), notificationEndpoints.listMyNotifications, {
      query: { awaitingAcknowledgment: 'true' },
    });
    expect(notificationEndpoints.listMyNotifications.response.parse(unread.body).items).toEqual([]);
    const pending = notificationEndpoints.listMyNotifications.response.parse(awaiting.body).items;
    expect(pending.map((row) => row.id)).toEqual([611]);
    expect(pending[0]?.readAt).not.toBeNull();
    expect(pending[0]?.acknowledgedAt).toBeNull();
  });

  it('shows the failed email delivery without changing the deadline (BR-42)', async () => {
    const list = await api.callAs(EMAIL('chobe-pipe.bidmanager'), notificationEndpoints.listMyNotifications, {
      query: { eventType: 'addendum_issued' },
    });
    const [row] = notificationEndpoints.listMyNotifications.response.parse(list.body).items;
    expect(row?.deliveries.find((delivery) => delivery.channel === 'email')?.status).toBe('failed');
    expect(row?.deadline).toEqual({ at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' });
  });

  it('shows a person with several memberships only their own rows, labelled by organization', async () => {
    const list = await api.callAs(EMAIL('sam.dual'), notificationEndpoints.listMyNotifications, { query: { pageSize: 100 } });
    const rows = notificationEndpoints.listMyNotifications.response.parse(list.body).items;
    expect(new Set(rows.map((row) => row.organization.tenantId)).size).toBe(3);
    expect(rows.map((row) => row.id).sort()).toEqual([537, 607, 617, 618]);
  });

  it('filters by organization', async () => {
    const list = await api.callAs(EMAIL('sam.dual'), notificationEndpoints.listMyNotifications, { query: { tenantId: '4' } });
    expect(notificationEndpoints.listMyNotifications.response.parse(list.body).items.map((row) => row.id)).toEqual([607]);
  });
});

describe('notification actions', () => {
  it('marks a notification read without acknowledging it', async () => {
    const response = await api.callAs(EMAIL('chobe-pipe.admin'), notificationEndpoints.markNotificationRead, {
      params: { notificationId: 614 },
      tenant: 'chobe-pipe',
    });
    const item = NotificationItem.parse(response.body);
    expect(item.readAt).not.toBeNull();
    expect(item.acknowledgedAt).toBeNull();
  });

  it('answers NOTIFICATION_NOT_FOUND for a row of another tenant or another person', async () => {
    const wrongTenant = await api.callAs(EMAIL('sam.dual'), notificationEndpoints.markNotificationRead, {
      params: { notificationId: 617 },
      tenant: 'tsodilo',
    });
    expect(wrongTenant.body).toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    const otherPerson = await api.callAs(EMAIL('chobe-pipe.admin'), notificationEndpoints.markNotificationRead, {
      params: { notificationId: 611 },
      tenant: 'chobe-pipe',
    });
    expect(otherPerson.body).toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
  });

  it('acknowledges a formal notice and accepts its terms as a separate fact', async () => {
    const response = await api.callAs(EMAIL('tsodilo.signatory'), notificationEndpoints.acknowledgeNotification, {
      params: { notificationId: 603 },
      tenant: 'tsodilo',
      body: { acceptTerms: true },
    });
    const item = NotificationItem.parse(response.body);
    expect(item.acknowledgedAt).not.toBeNull();
    expect(item.termsAcceptedAt).not.toBeNull();
  });

  it.each([
    ['ACKNOWLEDGMENT_NOT_AUTHORIZED', 'chobe-pipe.contributor', 615, 'chobe-pipe', false],
    ['ALREADY_ACKNOWLEDGED', 'tsodilo.bidmanager', 601, 'tsodilo', false],
    ['ACKNOWLEDGMENT_NOT_REQUIRED', 'tebogo.officer', 511, 'kwu', false],
    ['NO_TERMS_TO_ACCEPT', 'chobe-pipe.bidmanager', 611, 'chobe-pipe', true],
  ] as const)('answers %s', async (code, login, notificationId, tenant, acceptTerms) => {
    const response = await api.callAs(EMAIL(login), notificationEndpoints.acknowledgeNotification, {
      params: { notificationId },
      tenant,
      body: { acceptTerms },
    });
    expect(response.body).toMatchObject({ code });
  });

  it('offers acknowledgment only to colleagues authorized for formal notices (DD-23)', async () => {
    // Act
    const contributor = await api.callAs(EMAIL('chobe-pipe.contributor'), notificationEndpoints.listMyNotifications, { query: { pageSize: 100 } });
    const bidManager = await api.callAs(EMAIL('chobe-pipe.bidmanager'), notificationEndpoints.listMyNotifications, { query: { pageSize: 100 } });
    const officer = await api.callAs(EMAIL('tebogo.officer'), notificationEndpoints.listMyNotifications, { query: { pageSize: 100 } });

    // Assert
    const find = (body: unknown, id: number) => notificationEndpoints.listMyNotifications.response.parse(body).items.find((row) => row.id === id);
    expect(find(contributor.body, 615)).toMatchObject({ requiresAcknowledgment: true, canAcknowledge: false, acknowledgeBlockedReason: 'not_authorized' });
    expect(find(bidManager.body, 611)).toMatchObject({ canAcknowledge: true, acknowledgeBlockedReason: null });
    expect(find(officer.body, 511)).toMatchObject({ requiresAcknowledgment: false, canAcknowledge: false, acknowledgeBlockedReason: null });
  });

  it('stamps reading and acknowledging on the storyline clock, never before the notice was created', async () => {
    // Arrange
    const created = Date.parse(WORKSPACE_AS_OF);

    // Act
    const response = await api.callAs(EMAIL('chobe-pipe.admin'), notificationEndpoints.acknowledgeNotification, {
      params: { notificationId: 614 },
      tenant: 'chobe-pipe',
      body: { acceptTerms: false },
    });

    // Assert
    const item = NotificationItem.parse(response.body);
    expect(Date.parse(item.acknowledgedAt ?? '')).toBeGreaterThanOrEqual(Date.parse(item.createdAt));
    expect(Date.parse(item.acknowledgedAt ?? '')).toBeGreaterThanOrEqual(created);
    expect(item).toMatchObject({ canAcknowledge: false, acknowledgeBlockedReason: 'already_acknowledged' });
  });

  it('marks everything read in one organization and never acknowledges', async () => {
    const response = await api.callAs(EMAIL('mpho.manager'), notificationEndpoints.markAllNotificationsRead, { body: { tenantId: 2 } });
    const result = notificationEndpoints.markAllNotificationsRead.response.parse(response.body);
    expect(result.updated).toBeGreaterThan(0);
    expect(result.summary.unread).toBe(0);
  });

  it('refuses mark-all-read for an organization outside the caller’s memberships', async () => {
    const response = await api.callAs(EMAIL('mpho.manager'), notificationEndpoints.markAllNotificationsRead, { body: { tenantId: 3 } });
    expect(response.body).toMatchObject({ code: 'ORGANIZATION_NOT_IN_SCOPE' });
  });
});

describe('notification preferences', () => {
  it('locks mandatory formal notices on', async () => {
    const response = await api.callAs(EMAIL('tsodilo.bidmanager'), notificationEndpoints.getNotificationPreferences);
    const preferences = notificationEndpoints.getNotificationPreferences.response.parse(response.body);
    const mandatory = preferences.items.filter((item) => item.mandatory);
    expect(mandatory.map((item) => item.eventType).sort()).toEqual([...MANDATORY_NOTIFICATION_EVENT_TYPES].sort());
    expect(mandatory.every((item) => item.inApp && item.email && item.digest === 'none')).toBe(true);
    expect(preferences.items.find((item) => item.eventType === 'task_assigned')).toMatchObject({ email: false, digest: 'daily' });
  });

  it('updates optional events and refuses to mute a mandatory one', async () => {
    const ok = await api.callAs(EMAIL('tebogo.officer'), notificationEndpoints.updateNotificationPreferences, {
      body: { items: [{ eventType: 'closing_approaching', inApp: true, email: false, digest: 'weekly' }] },
    });
    expect(notificationEndpoints.updateNotificationPreferences.response.parse(ok.body).items.find((item) => item.eventType === 'closing_approaching')).toMatchObject({
      email: false,
      digest: 'weekly',
    });
    const muted = await api.callAs(EMAIL('tebogo.officer'), notificationEndpoints.updateNotificationPreferences, {
      body: { items: [{ eventType: 'addendum_issued', inApp: true, email: false, digest: 'none' }] },
    });
    expect(muted.body).toMatchObject({ code: 'MANDATORY_EVENT_NOT_MUTABLE' });
    const duplicate = await api.callAs(EMAIL('tebogo.officer'), notificationEndpoints.updateNotificationPreferences, {
      body: {
        items: [
          { eventType: 'task_assigned', inApp: true, email: true, digest: 'none' },
          { eventType: 'task_assigned', inApp: true, email: false, digest: 'none' },
        ],
      },
    });
    expect(duplicate.body).toMatchObject({ code: 'DUPLICATE_EVENT_TYPE' });
  });
});
