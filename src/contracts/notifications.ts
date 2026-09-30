/**
 * Notifications contract: the personal notification center and preferences (COM-06, COM-03; BR-41, BR-42;
 * DD-11, DD-21, DD-44).
 *
 * - A notification row lives in the RECIPIENT's tenant (DD-11), and its id is unique per tenant only
 *   (`notifications` is partitioned, PK `(tenant_id, id)`). Reads span every active membership; `read` and
 *   `acknowledge` send `X-Tenant-Id` equal to the row's tenant (DD-21), which completes the row identity.
 * - Reading, acknowledging and accepting terms are distinct events (BR-41). A formal supplier notice
 *   acknowledgment also writes the authoritative `participant_acknowledgments` row in the same transaction
 *   (DD-42); the service requires `supplier.notices.acknowledge` in that supplier tenant (DD-23).
 * - Delivery channels are `in_app` and `email` (DD-44). A failed delivery never changes a deadline; it
 *   creates a delivery exception for the responsible owner (BR-42).
 * - Mandatory formal notices ignore preferences; optional events follow them (PRD §14.3).
 */
import { z } from 'zod';

import {
  IdParam,
  Id,
  Instant,
  LinkPath,
  OrganizationLabel,
  QueryBoolean,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import {
  NotificationDeliveriesChannel,
  NotificationDeliveriesStatus,
  NotificationRulesEventType,
  NotificationsCategory,
  UserNotificationPreferencesDigest,
} from './enums.js';

/** One delivery attempt of a notification on one channel (`notification_deliveries`). */
export const NotificationDelivery = z.object({
  channel: NotificationDeliveriesChannel,
  status: NotificationDeliveriesStatus,
  attemptedAt: Instant.nullable(),
  failureReason: z.string().nullable(),
});
export type NotificationDelivery = z.infer<typeof NotificationDelivery>;

/** One notification of the caller (`notifications`), labelled with its organization. */
export const NotificationItem = z.object({
  id: Id,
  organization: OrganizationLabel,
  eventType: NotificationRulesEventType,
  category: NotificationsCategory,
  title: z.string().min(1),
  body: z.string(),
  sourceType: z.string().nullable(),
  sourceId: Id.nullable(),
  sourceReference: z.string().nullable(),
  linkPath: LinkPath.nullable(),
  mandatory: z.boolean(),
  requiresAcknowledgment: z.boolean(),
  createdAt: Instant,
  readAt: Instant.nullable(),
  acknowledgedAt: Instant.nullable(),
  /** Set when the notification delivers a formal notice to a supplier organization. */
  noticeRecipientId: Id.nullable(),
  deliveries: z.array(NotificationDelivery),
});
export type NotificationItem = z.infer<typeof NotificationItem>;

export const NOTIFICATION_SORT_FIELDS = ['createdAt', 'category', 'title'] as const;

export const NotificationListQuery = listQueryWithSort(NOTIFICATION_SORT_FIELDS).extend({
  category: queryList(NotificationsCategory).optional(),
  eventType: queryList(NotificationRulesEventType).optional(),
  unread: QueryBoolean.optional(),
  requiresAcknowledgment: QueryBoolean.optional(),
  /** Only rows still awaiting the caller's acknowledgment. */
  awaitingAcknowledgment: QueryBoolean.optional(),
  tenantId: IdParam.optional(),
  from: Instant.optional(),
  to: Instant.optional(),
});
export type NotificationListQuery = z.input<typeof NotificationListQuery>;

export const NotificationPage = pageOf(NotificationItem);
export type NotificationPage = z.infer<typeof NotificationPage>;

export const NotificationOrganizationCount = OrganizationLabel.extend({
  unread: z.number().int().min(0),
  requiresAcknowledgment: z.number().int().min(0),
});

export const NotificationSummary = z.object({
  /** Unread notifications of the caller (the bell badge). */
  unread: z.number().int().min(0),
  /** Notifications that require acknowledgment and are not yet acknowledged. */
  requiresAcknowledgment: z.number().int().min(0),
  byOrganization: z.array(NotificationOrganizationCount),
});
export type NotificationSummary = z.infer<typeof NotificationSummary>;

export const NotificationParams = z.object({ notificationId: IdParam });

/** GET /api/v1/me/notifications (COM-06). */
export const listMyNotifications = defineEndpoint({
  id: 'me.notifications.list',
  method: 'GET',
  path: '/api/v1/me/notifications',
  audience: 'me',
  query: NotificationListQuery,
  response: NotificationPage,
  errors: [],
  screens: ['COM-06'],
  summary: 'The caller’s notifications across every active membership, newest first by default (DD-21).',
});

/** GET /api/v1/me/notification-summary: unread and awaiting-acknowledgment counts (shell bell). */
export const getMyNotificationSummary = defineEndpoint({
  id: 'me.notifications.summary',
  method: 'GET',
  path: '/api/v1/me/notification-summary',
  audience: 'me',
  response: NotificationSummary,
  errors: [],
  screens: ['COM-06', 'BUY-01', 'SUP-01'],
});

/** POST /api/v1/me/notifications/:notificationId/read (X-Tenant-Id = the row's tenant). Idempotent by state. */
export const markNotificationRead = defineEndpoint({
  id: 'me.notifications.markRead',
  method: 'POST',
  path: '/api/v1/me/notifications/:notificationId/read',
  audience: 'me',
  rowTenant: true,
  params: NotificationParams,
  response: NotificationItem,
  errors: ['NOTIFICATION_NOT_FOUND'],
  screens: ['COM-06'],
  summary: 'Records that the caller opened the notification. Reading never counts as acknowledgment (BR-41).',
});

export const AcknowledgeNotificationBody = z.object({
  /** Also accept the terms the notice carries (a separate event, BR-41). Only valid when the notice has terms. */
  acceptTerms: z.boolean().default(false),
});
export type AcknowledgeNotificationBody = z.input<typeof AcknowledgeNotificationBody>;

/** POST /api/v1/me/notifications/:notificationId/acknowledge (X-Tenant-Id = the row's tenant). */
export const acknowledgeNotification = defineEndpoint({
  id: 'me.notifications.acknowledge',
  method: 'POST',
  path: '/api/v1/me/notifications/:notificationId/acknowledge',
  audience: 'me',
  rowTenant: true,
  params: NotificationParams,
  body: AcknowledgeNotificationBody,
  response: NotificationItem,
  errors: [
    'NOTIFICATION_NOT_FOUND',
    'ACKNOWLEDGMENT_NOT_REQUIRED',
    'ALREADY_ACKNOWLEDGED',
    'NO_TERMS_TO_ACCEPT',
    'ACKNOWLEDGMENT_NOT_AUTHORIZED',
  ],
  screens: ['COM-06'],
  summary:
    'Acknowledges a notice that requires it. For a formal supplier notice the caller needs supplier.notices.acknowledge in that organization (DD-23), and the participant acknowledgment is written in the same transaction (DD-42).',
});

/** One event type's delivery preference (`user_notification_preferences`). */
export const NotificationPreference = z.object({
  eventType: NotificationRulesEventType,
  /** Mandatory formal notices are always delivered in-app and by email where enabled; toggles are ignored. */
  mandatory: z.boolean(),
  inApp: z.boolean(),
  email: z.boolean(),
  digest: UserNotificationPreferencesDigest,
});
export type NotificationPreference = z.infer<typeof NotificationPreference>;

export const NotificationPreferences = z.object({
  items: z.array(NotificationPreference),
  /** False where the email channel is not configured (EMAIL_ENABLED off): only in-app delivery runs (DD-44). */
  emailEnabled: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferences>;

/** GET /api/v1/me/notification-preferences (COM-03). */
export const getNotificationPreferences = defineEndpoint({
  id: 'me.notifications.preferences',
  method: 'GET',
  path: '/api/v1/me/notification-preferences',
  audience: 'me',
  response: NotificationPreferences,
  errors: [],
  screens: ['COM-03', 'COM-06'],
});

export const NotificationPreferenceUpdate = z.object({
  eventType: NotificationRulesEventType,
  inApp: z.boolean(),
  email: z.boolean(),
  digest: UserNotificationPreferencesDigest,
});
export type NotificationPreferenceUpdate = z.infer<typeof NotificationPreferenceUpdate>;

export const UpdateNotificationPreferencesBody = z.object({
  items: z.array(NotificationPreferenceUpdate).min(1),
});
export type UpdateNotificationPreferencesBody = z.infer<typeof UpdateNotificationPreferencesBody>;

/** PUT /api/v1/me/notification-preferences: optional events only; mandatory notices cannot be muted. */
export const updateNotificationPreferences = defineEndpoint({
  id: 'me.notifications.updatePreferences',
  method: 'PUT',
  path: '/api/v1/me/notification-preferences',
  audience: 'me',
  body: UpdateNotificationPreferencesBody,
  response: NotificationPreferences,
  errors: ['MANDATORY_EVENT_NOT_MUTABLE', 'EMAIL_CHANNEL_NOT_ENABLED', 'DUPLICATE_EVENT_TYPE'],
  screens: ['COM-03'],
});

/** The notifications endpoint map. */
export const notificationEndpoints = {
  listMyNotifications,
  getMyNotificationSummary,
  markNotificationRead,
  acknowledgeNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} as const;
