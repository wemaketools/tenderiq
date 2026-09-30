/**
 * Notification-rules client (the `notification-rules` contract, ADM-12): rules, the event catalog, template
 * previews and delivery exceptions of the active buyer organization.
 */
import {
  createNotificationRule,
  getNotificationRule,
  listDeliveryExceptions,
  listNotificationEvents,
  listNotificationRules,
  previewNotificationTemplate,
  setNotificationRuleStatus,
  updateNotificationRule,
} from '@contracts/notification-rules';
import type {
  CreateNotificationRuleBody,
  DeliveryExceptionPage,
  NotificationEventCatalog,
  NotificationPreview,
  NotificationRuleDetail,
  NotificationRulePage,
  PreviewNotificationBody,
  SetNotificationRuleStatusBody,
  UpdateNotificationRuleBody,
} from '@contracts/notification-rules';
import type { EndpointQuery } from '@contracts/endpoint';

import { call } from './client';

/** GET /api/v1/buyer/notification-rules. */
export function fetchNotificationRules(
  query: EndpointQuery<typeof listNotificationRules> = {},
): Promise<NotificationRulePage> {
  return call(listNotificationRules, { query });
}

/** GET /api/v1/buyer/notification-rules/:ruleId. */
export function fetchNotificationRule(ruleId: number): Promise<NotificationRuleDetail> {
  return call(getNotificationRule, { params: { ruleId } });
}

/** POST /api/v1/buyer/notification-rules (idempotent). */
export function createRule(body: CreateNotificationRuleBody): Promise<NotificationRuleDetail> {
  return call(createNotificationRule, { body });
}

/** PUT /api/v1/buyer/notification-rules/:ruleId. */
export function saveRule(
  ruleId: number,
  body: UpdateNotificationRuleBody,
): Promise<NotificationRuleDetail> {
  return call(updateNotificationRule, { params: { ruleId }, body });
}

/** POST /api/v1/buyer/notification-rules/:ruleId/status: activate or deactivate an optional rule. */
export function setRuleStatus(
  ruleId: number,
  body: SetNotificationRuleStatusBody,
): Promise<NotificationRuleDetail> {
  return call(setNotificationRuleStatus, { params: { ruleId }, body });
}

/** POST /api/v1/buyer/notification-rule-preview: renders unsaved templates with sample values. */
export function previewTemplate(body: PreviewNotificationBody): Promise<NotificationPreview> {
  return call(previewNotificationTemplate, { body });
}

/** GET /api/v1/buyer/notification-events: the event catalog. */
export function fetchNotificationEvents(): Promise<NotificationEventCatalog> {
  return call(listNotificationEvents, {});
}

/** GET /api/v1/buyer/notification-delivery-exceptions (BR-42). */
export function fetchDeliveryExceptions(
  query: EndpointQuery<typeof listDeliveryExceptions> = {},
): Promise<DeliveryExceptionPage> {
  return call(listDeliveryExceptions, { query });
}
