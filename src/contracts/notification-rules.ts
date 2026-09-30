/**
 * Notification rules contract: event types, recipients, mandatory notices, message templates, reminders and
 * escalations of a buyer organization (ADM-12; PRD §14.3; BR-41, BR-42, BR-43; DD-44; blueprint Migration 03
 * `notification_rules`, Migration 04 `notification_deliveries`).
 *
 * - One rule per event type and tenant (`unique (tenant_id, event_type)`). A rule names the recipient roles, the
 *   subject and body templates, reminder offsets before the deadline and the escalation after an overdue period.
 * - Mandatory formal notices (`MANDATORY_NOTIFICATION_EVENT_TYPES`) cannot be made optional or deactivated, and no
 *   user preference mutes them (PRD §14.3).
 * - Templates use `{{placeholder}}` names from the event catalog. Confidential content (prices, scores, bidder
 *   names, response content) is never available to a general alert: those names are refused with
 *   CONFIDENTIAL_PLACEHOLDER_NOT_ALLOWED (ADM-12, BR-43). Email content is limited to title, official deadline and
 *   a link (DD-44).
 * - A failed delivery never changes a deadline: it creates a delivery exception task for the responsible owner
 *   (BR-42). The exception register lists them for the administrator.
 */
import { z } from 'zod';

import {
  Id,
  IdParam,
  Instant,
  LinkPath,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import {
  NotificationDeliveriesChannel,
  NotificationRulesEventType,
  NotificationsCategory,
  TasksStatus,
} from './enums.js';

// ---------------------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------------------

/**
 * Recipient roles a rule may address (`notification_rules.recipient_roles`). They are resolved per event at send
 * time from the record's assignments (PRD §14.3 "Recipients" column); a role never widens record access (BR-43).
 */
export const NOTIFICATION_RECIPIENT_ROLES = [
  'affected_user',
  'responsible_administrator',
  'requester',
  'record_owner',
  'assigned_reviewers',
  'assigned_approver',
  'approved_supplier_audience',
  'affected_participants',
  'buyer_stakeholders',
  'supplier_bid_manager',
  'submitter',
  'interested_supplier_users',
  'assessor',
  'evaluation_chair',
  'escalation_owner',
  'supplier_evidence_owner',
  'buyer_reviewer',
  'case_parties',
  'responsible_buyer_roles',
  'contract_owner',
  'supplier_contacts',
  'decision_owners',
  'task_assignee',
  'all_members',
] as const;
export const NotificationRecipientRole = z.enum(NOTIFICATION_RECIPIENT_ROLES, {
  error: issue('RECIPIENT_ROLE_UNKNOWN', 'Choose a recipient role from the list.'),
});
export type NotificationRecipientRole = z.infer<typeof NotificationRecipientRole>;

/** Largest reminder offset: 60 days. */
export const MAX_REMINDER_OFFSET_HOURS = 1440;

/** A `{{name}}` placeholder of a template. */
export const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g;

/** The placeholder names used by a template, in order of first use. */
export function templatePlaceholders(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1];
    if (name !== undefined && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/** One placeholder the templates of an event type may use. */
export const TemplatePlaceholder = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
  description: z.string().min(1),
  /** Sample value used by the preview. */
  example: z.string(),
});
export type TemplatePlaceholder = z.infer<typeof TemplatePlaceholder>;

// ---------------------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------------------

/** A rule row (`notification_rules`). */
export const NotificationRuleSummary = z.object({
  id: Id,
  eventType: NotificationRulesEventType,
  category: NotificationsCategory,
  recipientRoles: z.array(NotificationRecipientRole),
  mandatory: z.boolean(),
  /** True when the event type is a formal notice that can never be made optional (PRD §14.3). */
  mandatoryLocked: z.boolean(),
  subjectTemplate: z.string().min(1),
  reminderOffsetsHours: z.array(z.number().int().min(1)),
  escalateAfterHours: z.number().int().min(1).nullable(),
  escalationRole: NotificationRecipientRole.nullable(),
  active: z.boolean(),
  updatedAt: Instant,
  updatedBy: PersonRef.nullable(),
});
export type NotificationRuleSummary = z.infer<typeof NotificationRuleSummary>;

/** One recent delivery statistic of a rule (last 30 days). */
export const RuleDeliveryStats = z.object({
  sent: z.number().int().min(0),
  delivered: z.number().int().min(0),
  failed: z.number().int().min(0),
  /** Email not configured in this environment (DD-44): in-app only. */
  notConfigured: z.number().int().min(0),
});
export type RuleDeliveryStats = z.infer<typeof RuleDeliveryStats>;

/** Everything ADM-12 shows for one rule. */
export const NotificationRuleDetail = NotificationRuleSummary.extend({
  bodyTemplate: z.string().min(1),
  /** Placeholders the templates of this event type may use. */
  placeholders: z.array(TemplatePlaceholder),
  /** Recipient roles that make sense for this event type (the editor offers only these). */
  allowedRecipientRoles: z.array(NotificationRecipientRole),
  /** Channels a notification of this rule is delivered on (`email` only where configured, DD-44). */
  channels: z.array(NotificationDeliveriesChannel),
  deliveryStats: RuleDeliveryStats,
  createdAt: Instant,
});
export type NotificationRuleDetail = z.infer<typeof NotificationRuleDetail>;

export const NOTIFICATION_RULE_SORT_FIELDS = ['eventType', 'category', 'updatedAt'] as const;

export const NotificationRuleListQuery = listQueryWithSort(NOTIFICATION_RULE_SORT_FIELDS).extend({
  eventType: queryList(NotificationRulesEventType).optional(),
  category: queryList(NotificationsCategory).optional(),
  mandatory: QueryBoolean.optional(),
  active: QueryBoolean.optional(),
  /** Only rules that send reminders before a deadline. */
  hasReminders: QueryBoolean.optional(),
  /** Only rules that escalate overdue work. */
  hasEscalation: QueryBoolean.optional(),
});
export type NotificationRuleListQuery = z.input<typeof NotificationRuleListQuery>;

export const NotificationRulePage = pageOf(NotificationRuleSummary);
export type NotificationRulePage = z.infer<typeof NotificationRulePage>;

export const NotificationRuleParams = z.object({ ruleId: IdParam });

const TemplateText = (field: string, max: number) =>
  z
    .string({ error: issue('TEMPLATE_REQUIRED', `The ${field} is required.`) })
    .trim()
    .min(1, issue('TEMPLATE_REQUIRED', `The ${field} is required.`))
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));

const ReminderOffsets = z
  .array(
    z
      .number()
      .int(issue('INVALID_REMINDER_OFFSET', 'Use whole hours.'))
      .min(1, issue('INVALID_REMINDER_OFFSET', 'At least 1 hour before the deadline.'))
      .max(MAX_REMINDER_OFFSET_HOURS, issue('INVALID_REMINDER_OFFSET', 'At most 60 days (1440 hours) before.')),
  )
  .max(6, issue('TOO_MANY_REMINDERS', 'At most 6 reminders; consolidate repeated reminders (PRD §14.3).'))
  .refine((offsets) => new Set(offsets).size === offsets.length, issue('DUPLICATE_REMINDER_OFFSET', 'Each offset may appear once.'));

/** The editable part of a rule. */
const RuleFields = z.object({
  recipientRoles: z
    .array(NotificationRecipientRole)
    .min(1, issue('RECIPIENTS_REQUIRED', 'Choose at least one recipient role.'))
    .refine((roles) => new Set(roles).size === roles.length, issue('DUPLICATE_RECIPIENT_ROLE', 'Each role may appear once.')),
  mandatory: z.boolean(),
  subjectTemplate: TemplateText('subject', 200),
  bodyTemplate: TemplateText('message body', 4000),
  reminderOffsetsHours: ReminderOffsets.default([]),
  escalateAfterHours: z
    .number()
    .int(issue('INVALID_ESCALATION', 'Use whole hours.'))
    .min(1, issue('INVALID_ESCALATION', 'At least 1 hour.'))
    .max(MAX_REMINDER_OFFSET_HOURS, issue('INVALID_ESCALATION', 'At most 1440 hours.'))
    .nullable()
    .default(null),
  escalationRole: NotificationRecipientRole.nullable().default(null),
  active: z.boolean().default(true),
});

function checkEscalation(
  value: { escalateAfterHours: number | null; escalationRole: NotificationRecipientRole | null },
  ctx: z.RefinementCtx,
): void {
  if (value.escalateAfterHours !== null && value.escalationRole === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['escalationRole'],
      message: issue('ESCALATION_ROLE_REQUIRED', 'Choose who receives the escalation.'),
    });
  }
  if (value.escalateAfterHours === null && value.escalationRole !== null) {
    ctx.addIssue({
      code: 'custom',
      path: ['escalateAfterHours'],
      message: issue('ESCALATION_DELAY_REQUIRED', 'Say after how many overdue hours the escalation is sent.'),
    });
  }
}

export const CreateNotificationRuleBody = RuleFields.extend({
  eventType: NotificationRulesEventType,
}).superRefine(checkEscalation);
export type CreateNotificationRuleBody = z.input<typeof CreateNotificationRuleBody>;

export const UpdateNotificationRuleBody = RuleFields.omit({ active: true })
  .extend({
    /** Why the rule changes (recorded in the audit trail). */
    changeNote: z.string().trim().max(1000, issue('TEXT_TOO_LONG', 'At most 1000 characters.')).optional(),
  })
  .superRefine(checkEscalation);
export type UpdateNotificationRuleBody = z.input<typeof UpdateNotificationRuleBody>;

export const SetNotificationRuleStatusBody = z.object({
  active: z.boolean(),
  reason: ReasonText,
});
export type SetNotificationRuleStatusBody = z.infer<typeof SetNotificationRuleStatusBody>;

const TEMPLATE_ERRORS = ['TEMPLATE_PLACEHOLDER_UNKNOWN', 'CONFIDENTIAL_PLACEHOLDER_NOT_ALLOWED', 'RECIPIENT_ROLE_NOT_ALLOWED'] as const;

/** GET /api/v1/buyer/notification-rules (ADM-12). */
export const listNotificationRules = defineEndpoint({
  id: 'buyer.notificationRules.list',
  method: 'GET',
  path: '/api/v1/buyer/notification-rules',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  query: NotificationRuleListQuery,
  response: NotificationRulePage,
  errors: [],
  screens: ['ADM-12'],
});

/** GET /api/v1/buyer/notification-rules/:ruleId (ADM-12). */
export const getNotificationRule = defineEndpoint({
  id: 'buyer.notificationRules.get',
  method: 'GET',
  path: '/api/v1/buyer/notification-rules/:ruleId',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  params: NotificationRuleParams,
  response: NotificationRuleDetail,
  errors: ['RULE_NOT_FOUND'],
  screens: ['ADM-12'],
});

/** POST /api/v1/buyer/notification-rules: a rule for an event type that has none yet. */
export const createNotificationRule = defineEndpoint({
  id: 'buyer.notificationRules.create',
  method: 'POST',
  path: '/api/v1/buyer/notification-rules',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  body: CreateNotificationRuleBody,
  response: NotificationRuleDetail,
  idempotent: true,
  errors: ['RULE_ALREADY_EXISTS', 'MANDATORY_EVENT_LOCKED', ...TEMPLATE_ERRORS],
  screens: ['ADM-12'],
});

/** PUT /api/v1/buyer/notification-rules/:ruleId: recipients, templates, reminders and escalation. */
export const updateNotificationRule = defineEndpoint({
  id: 'buyer.notificationRules.update',
  method: 'PUT',
  path: '/api/v1/buyer/notification-rules/:ruleId',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  params: NotificationRuleParams,
  body: UpdateNotificationRuleBody,
  response: NotificationRuleDetail,
  errors: ['RULE_NOT_FOUND', 'MANDATORY_EVENT_LOCKED', ...TEMPLATE_ERRORS],
  screens: ['ADM-12'],
  summary: 'Changes apply to notifications created afterwards; notifications already sent keep their content.',
});

/** POST /api/v1/buyer/notification-rules/:ruleId/status: activate or deactivate an optional rule. */
export const setNotificationRuleStatus = defineEndpoint({
  id: 'buyer.notificationRules.setStatus',
  method: 'POST',
  path: '/api/v1/buyer/notification-rules/:ruleId/status',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  params: NotificationRuleParams,
  body: SetNotificationRuleStatusBody,
  response: NotificationRuleDetail,
  errors: ['RULE_NOT_FOUND', 'MANDATORY_RULE_NOT_DEACTIVATABLE', 'RULE_STATUS_UNCHANGED'],
  screens: ['ADM-12'],
});

// ---------------------------------------------------------------------------------------------------------
// Template preview
// ---------------------------------------------------------------------------------------------------------

export const PreviewNotificationBody = z.object({
  eventType: NotificationRulesEventType,
  subjectTemplate: TemplateText('subject', 200),
  bodyTemplate: TemplateText('message body', 4000),
});
export type PreviewNotificationBody = z.infer<typeof PreviewNotificationBody>;

/** The rendered message with sample values; nothing is sent. */
export const NotificationPreview = z.object({
  eventType: NotificationRulesEventType,
  subject: z.string(),
  body: z.string(),
  /** The email version: title, official deadline and link only (DD-44). */
  emailSubject: z.string(),
  emailBody: z.string(),
  usedPlaceholders: z.array(z.string()),
  unknownPlaceholders: z.array(z.string()),
  confidentialPlaceholders: z.array(z.string()),
  sampleDeadline: OfficialDeadline.nullable(),
});
export type NotificationPreview = z.infer<typeof NotificationPreview>;

/** POST /api/v1/buyer/notification-rule-preview: renders unsaved templates with sample data (ADM-12). */
export const previewNotificationTemplate = defineEndpoint({
  id: 'buyer.notificationRules.preview',
  method: 'POST',
  path: '/api/v1/buyer/notification-rule-preview',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  body: PreviewNotificationBody,
  response: NotificationPreview,
  errors: [],
  screens: ['ADM-12'],
  summary: 'Unknown and confidential placeholders are reported, not rendered; saving such a template is refused.',
});

// ---------------------------------------------------------------------------------------------------------
// Event catalog
// ---------------------------------------------------------------------------------------------------------

/** One event type of PRD §14.3 with what a rule for it may contain. */
export const NotificationEventCatalogItem = z.object({
  eventType: NotificationRulesEventType,
  category: NotificationsCategory,
  /** The PRD §14.3 trigger and required content, for the editor. */
  description: z.string().min(1),
  mandatory: z.boolean(),
  defaultRecipientRoles: z.array(NotificationRecipientRole),
  allowedRecipientRoles: z.array(NotificationRecipientRole),
  placeholders: z.array(TemplatePlaceholder),
  /** Whether the event refers to a deadline (reminder offsets apply). */
  supportsReminders: z.boolean(),
  /** The organization's rule for it, if any. */
  ruleId: Id.nullable(),
});
export type NotificationEventCatalogItem = z.infer<typeof NotificationEventCatalogItem>;

export const NotificationEventCatalog = z.object({
  items: z.array(NotificationEventCatalogItem),
});
export type NotificationEventCatalog = z.infer<typeof NotificationEventCatalog>;

/** GET /api/v1/buyer/notification-events: every event type with its placeholders and whether a rule exists. */
export const listNotificationEvents = defineEndpoint({
  id: 'buyer.notificationRules.events',
  method: 'GET',
  path: '/api/v1/buyer/notification-events',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  response: NotificationEventCatalog,
  errors: [],
  screens: ['ADM-12'],
});

// ---------------------------------------------------------------------------------------------------------
// Delivery exceptions (BR-42)
// ---------------------------------------------------------------------------------------------------------

export const DELIVERY_EXCEPTION_STATES = ['open', 'resolved'] as const;
export const DeliveryExceptionState = z.enum(DELIVERY_EXCEPTION_STATES);
export type DeliveryExceptionState = z.infer<typeof DeliveryExceptionState>;

/** A failed delivery and the exception task it created for the responsible owner. */
export const DeliveryException = z.object({
  id: Id,
  eventType: NotificationRulesEventType,
  title: z.string().min(1),
  channel: NotificationDeliveriesChannel,
  /** The recipient: a person, and the organization they were notified in (a supplier for formal notices). */
  recipient: PersonRef,
  recipientOrganization: z.string().min(1),
  attemptedAt: Instant,
  failureReason: z.string().min(1),
  sourceReference: z.string().nullable(),
  linkPath: LinkPath.nullable(),
  /** The deadline the notice concerns. A delivery failure never changes it (BR-42). */
  deadline: OfficialDeadline.nullable(),
  state: DeliveryExceptionState,
  exceptionTaskId: Id.nullable(),
  exceptionTaskStatus: TasksStatus.nullable(),
  owner: PersonRef.nullable(),
  resolutionNote: z.string().nullable(),
});
export type DeliveryException = z.infer<typeof DeliveryException>;

export const DELIVERY_EXCEPTION_SORT_FIELDS = ['attemptedAt', 'eventType'] as const;

export const DeliveryExceptionListQuery = listQueryWithSort(DELIVERY_EXCEPTION_SORT_FIELDS).extend({
  state: queryList(DeliveryExceptionState).optional(),
  channel: queryList(NotificationDeliveriesChannel).optional(),
  eventType: queryList(NotificationRulesEventType).optional(),
  from: Instant.optional(),
  to: Instant.optional(),
});
export type DeliveryExceptionListQuery = z.input<typeof DeliveryExceptionListQuery>;

export const DeliveryExceptionPage = pageOf(DeliveryException);
export type DeliveryExceptionPage = z.infer<typeof DeliveryExceptionPage>;

/** GET /api/v1/buyer/notification-delivery-exceptions: failed deliveries and their exception tasks (BR-42). */
export const listDeliveryExceptions = defineEndpoint({
  id: 'buyer.notificationRules.deliveryExceptions',
  method: 'GET',
  path: '/api/v1/buyer/notification-delivery-exceptions',
  audience: 'buyer',
  permission: 'org.notifications.manage',
  query: DeliveryExceptionListQuery,
  response: DeliveryExceptionPage,
  errors: [],
  screens: ['ADM-12', 'COM-06'],
  summary: 'Failed deliveries of notifications issued by the organization, with the exception task of the responsible owner.',
});

/** The notification-rules endpoint map. */
export const notificationRuleEndpoints = {
  listNotificationRules,
  getNotificationRule,
  createNotificationRule,
  updateNotificationRule,
  setNotificationRuleStatus,
  previewNotificationTemplate,
  listNotificationEvents,
  listDeliveryExceptions,
} as const;
