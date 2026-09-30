/**
 * Notifications client (the `notifications` contract, COM-06 and COM-03). Reading, acknowledging and accepting
 * terms are separate calls (BR-41); row actions carry the notification's tenant as `X-Tenant-Id` (DD-21).
 */
import {
  acknowledgeNotification,
  getMyNotificationSummary,
  getNotificationPreferences,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '@contracts/notifications';
import type {
  AcknowledgeNotificationBody,
  MarkAllNotificationsReadBody,
  MarkAllNotificationsReadResult,
  NotificationItem,
  NotificationPage,
  NotificationPreferences,
  NotificationSummary,
  UpdateNotificationPreferencesBody,
} from '@contracts/notifications';
import type { EndpointQuery } from '@contracts/endpoint';

import { call } from './client';

/** GET /api/v1/me/notifications. */
export function fetchMyNotifications(
  query: EndpointQuery<typeof listMyNotifications> = {},
): Promise<NotificationPage> {
  return call(listMyNotifications, { query });
}

/** GET /api/v1/me/notification-summary: unread and awaiting-acknowledgment counts. */
export function fetchMyNotificationSummary(): Promise<NotificationSummary> {
  return call(getMyNotificationSummary, {});
}

/** POST /api/v1/me/notifications/:notificationId/read in the row's organization (never acknowledges). */
export function markRead(notificationId: number, tenantId: number): Promise<NotificationItem> {
  return call(markNotificationRead, { params: { notificationId } }, { tenantId });
}

/** POST /api/v1/me/notifications/read-all: every organization, or one. */
export function markAllRead(
  body: MarkAllNotificationsReadBody = {},
): Promise<MarkAllNotificationsReadResult> {
  return call(markAllNotificationsRead, { body });
}

/** POST /api/v1/me/notifications/:notificationId/acknowledge in the row's organization. */
export function acknowledge(
  notificationId: number,
  tenantId: number,
  body: AcknowledgeNotificationBody = {},
): Promise<NotificationItem> {
  return call(acknowledgeNotification, { params: { notificationId }, body }, { tenantId });
}

/** GET /api/v1/me/notification-preferences. */
export function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return call(getNotificationPreferences, {});
}

/** PUT /api/v1/me/notification-preferences (optional events only). */
export function saveNotificationPreferences(
  body: UpdateNotificationPreferencesBody,
): Promise<NotificationPreferences> {
  return call(updateNotificationPreferences, { body });
}
