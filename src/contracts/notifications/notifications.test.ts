import { describe, expect, it } from 'vitest';

import { MarkAllNotificationsReadBody, NotificationAcknowledgeBlock, notificationEndpoints } from '../notifications.js';

describe('notifications contract extensions (COM-06)', () => {
  it('marks all read across memberships or in one organization', () => {
    expect(MarkAllNotificationsReadBody.parse({})).toEqual({});
    expect(MarkAllNotificationsReadBody.parse({ tenantId: 2 })).toEqual({ tenantId: 2 });
  });

  it('is a personal command without a row tenant (it never acknowledges, BR-41)', () => {
    expect(notificationEndpoints.markAllNotificationsRead).toMatchObject({ audience: 'me', method: 'POST' });
    expect(notificationEndpoints.markAllNotificationsRead.rowTenant).toBeUndefined();
  });

  it('names why a caller cannot acknowledge a notice (DD-23)', () => {
    expect(NotificationAcknowledgeBlock.options).toEqual(['not_required', 'already_acknowledged', 'not_authorized']);
    expect(notificationEndpoints.listMyNotifications.response.shape.items.element.shape.canAcknowledge.safeParse(false).success).toBe(true);
  });
});
