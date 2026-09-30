/**
 * Notification rule fixtures (ADM-12; PRD §14.3; BR-41, BR-42, BR-43; DD-44): the event catalog (category,
 * recipients, placeholders), each buyer organization's rules, recent delivery statistics and the delivery
 * exceptions created by failed deliveries.
 *
 * Templates only use catalog placeholders; confidential content (prices, scores, bidder identities, response
 * content) is never available to a general alert.
 */
import type { Instant } from '../../contracts/common.js';
import type { NotificationRecipientRole } from '../../contracts/notification-rules.js';
import type { NotificationDeliveriesChannel, NotificationRulesEventType, NotificationsCategory } from '../../contracts/enums.js';
import { NOTIFICATION_RULES_EVENT_TYPE, isMandatoryNotificationEvent } from '../../contracts/enums.js';
import { RECORDS, tid, uid } from './approvals/world.js';

// ---------------------------------------------------------------------------------------------------------
// Event catalog
// ---------------------------------------------------------------------------------------------------------

export interface FixturePlaceholder {
  readonly name: string;
  readonly description: string;
  readonly example: string;
}

export interface FixtureEventDefinition {
  readonly category: NotificationsCategory;
  readonly description: string;
  readonly defaultRecipientRoles: readonly NotificationRecipientRole[];
  readonly allowedRecipientRoles: readonly NotificationRecipientRole[];
  readonly placeholders: readonly FixturePlaceholder[];
  readonly supportsReminders: boolean;
}

/** Placeholders every event may use. */
const COMMON: readonly FixturePlaceholder[] = [
  { name: 'organization', description: 'The organization that issues the notification.', example: 'Kalahari Water Utilities (Pilot)' },
  { name: 'recipientName', description: 'The recipient’s name.', example: 'Boago Moremi' },
  { name: 'recordReference', description: 'Reference of the source record.', example: 'T-2026-0002' },
  { name: 'recordTitle', description: 'Title of the source record.', example: 'Smart water meter supply' },
  { name: 'link', description: 'Link to the record in TenderIQ (access is checked when opened).', example: 'https://tenderiq.local/supplier/opportunities/2' },
];

const DEADLINE: FixturePlaceholder = {
  name: 'officialDeadline',
  description: 'The official deadline with its time zone and offset.',
  example: '14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone',
};
const DUE: FixturePlaceholder = { name: 'dueDate', description: 'Due date of the requested action.', example: '9 Oct 2026' };
const ACTION: FixturePlaceholder = { name: 'requiredAction', description: 'What the recipient must do.', example: 'Acknowledge the addendum and supplement your response' };
const VERSION: FixturePlaceholder = { name: 'versionLabel', description: 'The version the notice refers to.', example: 'Addendum 2 (version 3)' };
const DECISION: FixturePlaceholder = { name: 'decisionStatus', description: 'The exact decision status (never an unconditional award).', example: 'Intent to award — standstill applies' };
const VALUE: FixturePlaceholder = { name: 'decisionValue', description: 'The value under decision (internal approvals only).', example: 'BWP 3,400,000.00' };
const ROLE: FixturePlaceholder = { name: 'roleName', description: 'The role or authority concerned.', example: 'Procurement Officer' };
const RECEIPT: FixturePlaceholder = { name: 'receiptNumber', description: 'Official receipt number.', example: 'R-2026-0002-003' };
const EVIDENCE: FixturePlaceholder = { name: 'evidenceName', description: 'The evidence item.', example: 'Public liability insurance' };
const EXPIRY: FixturePlaceholder = { name: 'expiryDate', description: 'Expiry date of the evidence or window.', example: '14 Oct 2026' };
const CASE: FixturePlaceholder = { name: 'caseReference', description: 'Complaint or incident reference.', example: 'CMP-2026-0001' };

/** Placeholder names that would disclose confidential content in a general alert (ADM-12, BR-43). */
export const CONFIDENTIAL_PLACEHOLDERS: readonly string[] = [
  'bidPrice',
  'bidTotal',
  'evaluationScore',
  'ranking',
  'bidderNames',
  'bidderCount',
  'responseContent',
  'deliberationNotes',
  'budgetAmount',
];

const SUPPLIER_AUDIENCE: readonly NotificationRecipientRole[] = [
  'approved_supplier_audience',
  'affected_participants',
  'supplier_bid_manager',
  'interested_supplier_users',
  'buyer_stakeholders',
  'record_owner',
];

function event(
  category: NotificationsCategory,
  description: string,
  defaults: readonly NotificationRecipientRole[],
  allowed: readonly NotificationRecipientRole[],
  extra: readonly FixturePlaceholder[],
  supportsReminders = false,
): FixtureEventDefinition {
  return {
    category,
    description,
    defaultRecipientRoles: defaults,
    allowedRecipientRoles: [...new Set([...defaults, ...allowed, 'escalation_owner' as const])],
    placeholders: [...COMMON, ...extra],
    supportsReminders,
  };
}

export const EVENT_CATALOG: Readonly<Record<NotificationRulesEventType, FixtureEventDefinition>> = {
  user_invitation: event('system', 'User invitation: organization, role, acceptance requirements and expiry.', ['affected_user', 'responsible_administrator'], [], [ROLE, EXPIRY]),
  authority_change: event('system', 'Authority change: the role or delegation granted, changed or revoked.', ['affected_user', 'responsible_administrator'], [], [ROLE, EXPIRY]),
  request_submitted: event('task', 'Request submitted: required decision and due date.', ['requester', 'record_owner', 'assigned_reviewers'], [], [DUE, ACTION]),
  request_returned: event('task', 'Request returned: missing information and due date.', ['requester', 'record_owner'], ['assigned_reviewers'], [DUE, ACTION]),
  tender_issued: event('formal_notice', 'Tender issued: event, current deadline, official zone and participation instructions.', ['approved_supplier_audience', 'record_owner'], SUPPLIER_AUDIENCE, [DEADLINE, VERSION], true),
  invitation_received: event('formal_notice', 'Invitation received: event, deadline, zone and participation instructions.', ['approved_supplier_audience', 'record_owner'], SUPPLIER_AUDIENCE, [DEADLINE, ACTION], true),
  addendum_issued: event('formal_notice', 'Addendum issued: what changed, applicable version, new dates and required response action.', ['affected_participants', 'buyer_stakeholders'], SUPPLIER_AUDIENCE, [DEADLINE, VERSION, ACTION]),
  deadline_changed: event('formal_notice', 'Deadline change: the new official deadline for every affected participant.', ['affected_participants', 'buyer_stakeholders'], SUPPLIER_AUDIENCE, [DEADLINE, VERSION]),
  question_answered: event('system', 'Question answered: where the authorized answer can be read.', ['affected_participants'], ['supplier_bid_manager', 'record_owner'], [DEADLINE]),
  clarification_requested: event('task', 'Clarification requested: response deadline and authorized location.', ['supplier_bid_manager', 'assigned_reviewers'], ['record_owner'], [DUE, ACTION], true),
  evidence_expiring: event('reminder', 'Qualification evidence expiring: evidence, scope, expiry, renewal action and consequence.', ['supplier_evidence_owner', 'buyer_reviewer'], ['record_owner'], [EVIDENCE, EXPIRY, ACTION], true),
  submission_succeeded: event('formal_notice', 'Submission succeeded: official outcome and receipt.', ['supplier_bid_manager', 'submitter'], [], [RECEIPT]),
  submission_failed: event('formal_notice', 'Submission failed: official outcome and corrective action.', ['supplier_bid_manager', 'submitter'], [], [RECEIPT, ACTION, DEADLINE]),
  submission_replaced: event('formal_notice', 'Submission replaced: the new effective receipt.', ['supplier_bid_manager', 'submitter'], [], [RECEIPT]),
  submission_withdrawn: event('formal_notice', 'Submission withdrawn: withdrawal confirmation.', ['supplier_bid_manager', 'submitter'], [], [RECEIPT]),
  closing_approaching: event('reminder', 'Closing approaching: official deadline and readiness reminder (no implied guarantee of receipt).', ['interested_supplier_users'], ['supplier_bid_manager'], [DEADLINE], true),
  evaluation_assigned: event('task', 'Evaluation assigned: assignment, due date and required declarations.', ['assessor', 'evaluation_chair'], [], [DUE, ACTION], true),
  evaluation_overdue: event('reminder', 'Evaluation overdue: outstanding work.', ['assessor', 'evaluation_chair', 'escalation_owner'], [], [DUE, ACTION], true),
  approval_needed: event('task', 'Approval needed: decision scope, value, due date and version under review.', ['assigned_approver', 'record_owner'], [], [DUE, VALUE, VERSION], true),
  approval_returned: event('system', 'Approval returned or invalidated: reason and next step.', ['record_owner', 'requester'], ['assigned_approver'], [VERSION, ACTION]),
  approval_expired: event('system', 'Approval expired without a decision.', ['record_owner', 'requester'], ['assigned_approver'], [VERSION]),
  preferred_bidder_selected: event('formal_notice', 'Preferred selection: exact status (not an award), deadlines and next steps.', ['approved_supplier_audience'], SUPPLIER_AUDIENCE, [DECISION, DEADLINE]),
  intent_to_award: event('formal_notice', 'Intent to award: decision status, standstill deadline and next steps.', ['approved_supplier_audience'], SUPPLIER_AUDIENCE, [DECISION, DEADLINE]),
  exclusion_decided: event('formal_notice', 'Exclusion: permitted explanation and challenge instructions.', ['approved_supplier_audience'], SUPPLIER_AUDIENCE, [DECISION]),
  award_decided: event('formal_notice', 'Award: exact decision status, relevant deadlines and next steps.', ['approved_supplier_audience', 'buyer_stakeholders'], SUPPLIER_AUDIENCE, [DECISION, DEADLINE]),
  complaint_update: event('formal_notice', 'Complaint update: case action, revised date and blocked procurement actions.', ['case_parties', 'responsible_buyer_roles'], [], [CASE, DEADLINE]),
  standstill_changed: event('formal_notice', 'Waiting-period change: revised date and blocked actions.', ['case_parties', 'approved_supplier_audience', 'responsible_buyer_roles'], [], [DEADLINE, CASE]),
  contract_milestone_due: event('reminder', 'Contract milestone due: commitment, date, evidence and escalation.', ['contract_owner', 'supplier_contacts'], [], [DUE, ACTION], true),
  contract_expiry: event('reminder', 'Contract expiry: date, decision and escalation.', ['contract_owner', 'supplier_contacts'], ['decision_owners'], [EXPIRY, ACTION], true),
  renewal_window: event('reminder', 'Renewal window: dates and decision required (never an automatic renewal).', ['contract_owner', 'decision_owners'], ['supplier_contacts'], [EXPIRY, ACTION], true),
  service_incident: event('formal_notice', 'Service incident: known impact, status, support route; deadline decisions are issued separately.', ['affected_participants', 'decision_owners'], ['all_members'], [CASE]),
  delivery_exception: event('system', 'Delivery exception: a notice could not be delivered; the deadline is unchanged.', ['record_owner'], ['responsible_administrator'], [ACTION]),
  task_assigned: event('task', 'Task assigned: what to do and by when.', ['task_assignee'], [], [DUE, ACTION], true),
  task_overdue: event('reminder', 'Task overdue: outstanding work and escalation.', ['task_assignee', 'escalation_owner'], [], [DUE, ACTION], true),
  product_announcement: event('promotional', 'Product announcement: optional, never mixed with formal notices.', ['all_members'], [], []),
};

/** The category of an event type. */
export function categoryOf(eventType: NotificationRulesEventType): NotificationsCategory {
  return EVENT_CATALOG[eventType].category;
}

// ---------------------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------------------

export interface FixtureNotificationRule {
  readonly id: number;
  readonly tenantId: number;
  readonly eventType: NotificationRulesEventType;
  readonly recipientRoles: readonly NotificationRecipientRole[];
  readonly mandatory: boolean;
  readonly subjectTemplate: string;
  readonly bodyTemplate: string;
  readonly reminderOffsetsHours: readonly number[];
  readonly escalateAfterHours: number | null;
  readonly escalationRole: NotificationRecipientRole | null;
  readonly active: boolean;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly updatedByUserId: number | null;
  readonly stats: { sent: number; delivered: number; failed: number; notConfigured: number };
}

interface RuleSpec {
  readonly id: number;
  readonly eventType: NotificationRulesEventType;
  readonly subject: string;
  readonly body: string;
  readonly recipients?: readonly NotificationRecipientRole[];
  readonly reminders?: readonly number[];
  readonly escalateAfter?: number;
  readonly escalationRole?: NotificationRecipientRole;
  readonly active?: boolean;
  readonly mandatory?: boolean;
  readonly updatedAt?: Instant;
  readonly updatedBy?: string;
  readonly stats?: { sent: number; delivered: number; failed: number; notConfigured?: number };
}

function rules(tenant: 'kwu' | 'odc', admin: string, specs: readonly RuleSpec[]): FixtureNotificationRule[] {
  return specs.map((spec) => {
    const mandatory = isMandatoryNotificationEvent(spec.eventType) || (spec.mandatory ?? false);
    const stats = spec.stats ?? { sent: 0, delivered: 0, failed: 0 };
    return {
      id: spec.id,
      tenantId: tid(tenant),
      eventType: spec.eventType,
      recipientRoles: spec.recipients ?? EVENT_CATALOG[spec.eventType].defaultRecipientRoles,
      mandatory,
      subjectTemplate: spec.subject,
      bodyTemplate: spec.body,
      reminderOffsetsHours: spec.reminders ?? [],
      escalateAfterHours: spec.escalateAfter ?? null,
      escalationRole: spec.escalationRole ?? null,
      active: spec.active ?? true,
      createdAt: '2026-04-01T07:00:00Z',
      updatedAt: spec.updatedAt ?? '2026-04-01T07:00:00Z',
      updatedByUserId: uid(spec.updatedBy ?? admin),
      stats: { ...stats, notConfigured: stats.notConfigured ?? 0 },
    };
  });
}

const SIGN_OFF = '\n\nOpen the record in TenderIQ: {{link}}';

export const NOTIFICATION_RULES: readonly FixtureNotificationRule[] = Object.freeze([
  ...rules('kwu', 'admin.kwu', [
    {
      id: 1,
      eventType: 'user_invitation',
      subject: 'Invitation to join {{organization}} as {{roleName}}',
      body: 'Hello {{recipientName}},\n\n{{organization}} invites you to TenderIQ as {{roleName}}. Accept before {{expiryDate}}.' + SIGN_OFF,
      stats: { sent: 6, delivered: 6, failed: 0 },
    },
    {
      id: 2,
      eventType: 'authority_change',
      subject: 'Your authority at {{organization}} changed',
      body: 'Hello {{recipientName}},\n\nYour role or delegation changed: {{roleName}} (until {{expiryDate}}).' + SIGN_OFF,
      stats: { sent: 9, delivered: 9, failed: 0 },
    },
    {
      id: 3,
      eventType: 'request_submitted',
      subject: 'Request {{recordReference}} submitted — decision due {{dueDate}}',
      body: '{{recordReference}} {{recordTitle}} was submitted. {{requiredAction}} by {{dueDate}}.' + SIGN_OFF,
      reminders: [48],
      stats: { sent: 14, delivered: 14, failed: 0 },
    },
    {
      id: 4,
      eventType: 'request_returned',
      subject: 'Request {{recordReference}} returned for information',
      body: '{{recordReference}} {{recordTitle}} was returned. {{requiredAction}} by {{dueDate}}.' + SIGN_OFF,
      stats: { sent: 3, delivered: 3, failed: 0 },
    },
    {
      id: 5,
      eventType: 'tender_issued',
      subject: '{{recordReference}} {{recordTitle}} is open for responses',
      body: '{{organization}} has issued {{recordReference}} {{recordTitle}} ({{versionLabel}}).\n\nOfficial submission deadline: {{officialDeadline}}.' + SIGN_OFF,
      reminders: [168],
      stats: { sent: 41, delivered: 40, failed: 1 },
    },
    {
      id: 6,
      eventType: 'invitation_received',
      subject: 'Invitation to respond: {{recordReference}} {{recordTitle}}',
      body: '{{organization}} invites your organization to respond to {{recordReference}}.\n\nOfficial deadline: {{officialDeadline}}. {{requiredAction}}.' + SIGN_OFF,
      stats: { sent: 4, delivered: 4, failed: 0 },
    },
    {
      id: 7,
      eventType: 'addendum_issued',
      subject: '{{versionLabel}} issued for {{recordReference}} — action required',
      body: '{{organization}} issued {{versionLabel}} for {{recordReference}} {{recordTitle}}.\n\n{{requiredAction}}. Official deadline: {{officialDeadline}}.' + SIGN_OFF,
      stats: { sent: 12, delivered: 11, failed: 1 },
      updatedAt: '2026-09-02T08:00:00Z',
    },
    {
      id: 8,
      eventType: 'deadline_changed',
      subject: 'Deadline changed for {{recordReference}}',
      body: 'The official deadline of {{recordReference}} {{recordTitle}} is now {{officialDeadline}} ({{versionLabel}}).' + SIGN_OFF,
      stats: { sent: 3, delivered: 3, failed: 0 },
    },
    {
      id: 9,
      eventType: 'question_answered',
      subject: 'A clarification was published for {{recordReference}}',
      body: 'A clarification answer is available for {{recordReference}}. Responses remain due by {{officialDeadline}}.' + SIGN_OFF,
      stats: { sent: 18, delivered: 18, failed: 0 },
    },
    {
      id: 10,
      eventType: 'clarification_requested',
      subject: 'Clarification requested on {{recordReference}} — reply by {{dueDate}}',
      body: '{{requiredAction}} by {{dueDate}}.' + SIGN_OFF,
      reminders: [24],
      stats: { sent: 5, delivered: 5, failed: 0 },
    },
    {
      id: 11,
      eventType: 'evidence_expiring',
      subject: '{{evidenceName}} expires on {{expiryDate}}',
      body: '{{evidenceName}} used for your qualification with {{organization}} expires on {{expiryDate}}. {{requiredAction}}.' + SIGN_OFF,
      reminders: [720, 240, 72],
      stats: { sent: 7, delivered: 7, failed: 0 },
    },
    {
      id: 12,
      eventType: 'submission_succeeded',
      subject: 'Receipt {{receiptNumber}} — submission received for {{recordReference}}',
      body: 'Your submission for {{recordReference}} was received. Official receipt: {{receiptNumber}}.' + SIGN_OFF,
      stats: { sent: 9, delivered: 9, failed: 0 },
    },
    {
      id: 13,
      eventType: 'submission_failed',
      subject: 'Submission NOT received for {{recordReference}}',
      body: 'Your submission attempt for {{recordReference}} did not complete. {{requiredAction}}. Official deadline: {{officialDeadline}}.' + SIGN_OFF,
      stats: { sent: 2, delivered: 2, failed: 0 },
    },
    {
      id: 14,
      eventType: 'submission_replaced',
      subject: 'Replacement received for {{recordReference}} — receipt {{receiptNumber}}',
      body: 'Your replacement submission is now effective. Official receipt: {{receiptNumber}}.' + SIGN_OFF,
    },
    {
      id: 15,
      eventType: 'submission_withdrawn',
      subject: 'Withdrawal confirmed for {{recordReference}}',
      body: 'Your submission for {{recordReference}} was withdrawn. Confirmation: {{receiptNumber}}.' + SIGN_OFF,
      stats: { sent: 1, delivered: 1, failed: 0 },
    },
    {
      id: 16,
      eventType: 'closing_approaching',
      subject: '{{recordReference}} closes on {{officialDeadline}}',
      body: 'Reminder: {{recordReference}} {{recordTitle}} closes on {{officialDeadline}}. Only an official receipt establishes a submission.' + SIGN_OFF,
      reminders: [168, 48, 4],
      stats: { sent: 36, delivered: 36, failed: 0 },
    },
    {
      id: 17,
      eventType: 'evaluation_assigned',
      subject: 'Evaluation assigned: {{recordReference}}',
      body: 'You are assigned to evaluate {{recordReference}}. {{requiredAction}} by {{dueDate}}.' + SIGN_OFF,
      reminders: [48],
      stats: { sent: 8, delivered: 8, failed: 0 },
    },
    {
      id: 18,
      eventType: 'evaluation_overdue',
      subject: 'Evaluation overdue: {{recordReference}}',
      body: 'Outstanding evaluation work on {{recordReference}} was due on {{dueDate}}. {{requiredAction}}.' + SIGN_OFF,
      escalateAfter: 48,
      escalationRole: 'evaluation_chair',
      stats: { sent: 3, delivered: 3, failed: 0 },
    },
    {
      id: 19,
      eventType: 'approval_needed',
      subject: 'Approval needed: {{recordReference}} ({{decisionValue}})',
      body: 'Please decide on {{recordReference}} {{recordTitle}}, {{versionLabel}}, value {{decisionValue}}, by {{dueDate}}.' + SIGN_OFF,
      reminders: [48, 8],
      escalateAfter: 72,
      escalationRole: 'escalation_owner',
      stats: { sent: 27, delivered: 27, failed: 0 },
      updatedAt: '2026-06-12T09:00:00Z',
    },
    {
      id: 20,
      eventType: 'approval_returned',
      subject: 'Approval returned: {{recordReference}}',
      body: 'The approval of {{recordReference}} ({{versionLabel}}) was returned or invalidated. {{requiredAction}}.' + SIGN_OFF,
      stats: { sent: 4, delivered: 4, failed: 0 },
    },
    {
      id: 21,
      eventType: 'approval_expired',
      subject: 'Approval expired: {{recordReference}}',
      body: 'The approval of {{recordReference}} ({{versionLabel}}) expired without a decision.' + SIGN_OFF,
      stats: { sent: 1, delivered: 1, failed: 0 },
    },
    {
      id: 22,
      eventType: 'intent_to_award',
      subject: 'Decision notice for {{recordReference}}: {{decisionStatus}}',
      body: '{{organization}} gives notice for {{recordReference}}: {{decisionStatus}}. The standstill period ends on {{officialDeadline}}.' + SIGN_OFF,
      stats: { sent: 3, delivered: 3, failed: 0 },
    },
    {
      id: 23,
      eventType: 'award_decided',
      subject: 'Award decision for {{recordReference}}: {{decisionStatus}}',
      body: '{{organization}} gives notice for {{recordReference}}: {{decisionStatus}}.' + SIGN_OFF,
      stats: { sent: 3, delivered: 3, failed: 0 },
    },
    {
      id: 24,
      eventType: 'complaint_update',
      subject: 'Complaint {{caseReference}}: update on {{recordReference}}',
      body: 'There is an update on complaint {{caseReference}}. Revised date: {{officialDeadline}}.' + SIGN_OFF,
      stats: { sent: 4, delivered: 4, failed: 0 },
    },
    {
      id: 25,
      eventType: 'standstill_changed',
      subject: 'Standstill period changed for {{recordReference}}',
      body: 'The standstill period for {{recordReference}} now ends on {{officialDeadline}} ({{caseReference}}).' + SIGN_OFF,
      stats: { sent: 3, delivered: 3, failed: 0 },
    },
    {
      id: 26,
      eventType: 'contract_milestone_due',
      subject: 'Milestone due on {{recordReference}}: {{dueDate}}',
      body: '{{requiredAction}} by {{dueDate}}.' + SIGN_OFF,
      reminders: [336, 72],
      escalateAfter: 120,
      escalationRole: 'contract_owner',
      stats: { sent: 6, delivered: 6, failed: 0 },
    },
    {
      id: 27,
      eventType: 'renewal_window',
      subject: 'Renewal window for {{recordReference}} opens on {{expiryDate}}',
      body: 'A renewal decision is required for {{recordReference}} {{recordTitle}}. Nothing renews automatically. {{requiredAction}}.' + SIGN_OFF,
      reminders: [1440, 720, 120],
      escalateAfter: 168,
      escalationRole: 'decision_owners',
      stats: { sent: 2, delivered: 2, failed: 0 },
    },
    {
      id: 28,
      eventType: 'service_incident',
      subject: 'Service incident {{caseReference}} affecting {{recordReference}}',
      body: 'A service incident may affect participation. Deadline decisions are issued separately by {{organization}}.' + SIGN_OFF,
      stats: { sent: 12, delivered: 12, failed: 0 },
    },
    {
      id: 29,
      eventType: 'delivery_exception',
      subject: 'Delivery exception on {{recordReference}}',
      body: 'A notice could not be delivered. The deadline is unchanged. {{requiredAction}}.' + SIGN_OFF,
      stats: { sent: 2, delivered: 2, failed: 0 },
    },
    {
      id: 30,
      eventType: 'task_assigned',
      subject: 'New task: {{recordTitle}}',
      body: '{{requiredAction}} by {{dueDate}}.' + SIGN_OFF,
      stats: { sent: 64, delivered: 64, failed: 0 },
    },
    {
      id: 31,
      eventType: 'task_overdue',
      subject: 'Overdue: {{recordTitle}}',
      body: 'Your task on {{recordReference}} was due on {{dueDate}}. {{requiredAction}}.' + SIGN_OFF,
      escalateAfter: 48,
      escalationRole: 'escalation_owner',
      stats: { sent: 11, delivered: 11, failed: 0 },
    },
    {
      id: 32,
      eventType: 'product_announcement',
      subject: 'What’s new in TenderIQ',
      body: 'New features are available for {{organization}}.' + SIGN_OFF,
      active: false,
      updatedAt: '2026-08-15T08:00:00Z',
    },
  ]),
  ...rules('odc', 'admin.odc', [
    {
      id: 41,
      eventType: 'tender_issued',
      subject: '{{recordReference}} {{recordTitle}} is open',
      body: '{{organization}} has issued {{recordReference}}. Official deadline: {{officialDeadline}}.' + SIGN_OFF,
      reminders: [72],
      stats: { sent: 9, delivered: 9, failed: 0 },
    },
    {
      id: 42,
      eventType: 'addendum_issued',
      subject: 'Addendum for {{recordReference}}',
      body: '{{versionLabel}} was issued. {{requiredAction}}. Official deadline: {{officialDeadline}}.' + SIGN_OFF,
    },
    {
      id: 43,
      eventType: 'closing_approaching',
      subject: '{{recordReference}} closes soon',
      body: '{{recordReference}} closes on {{officialDeadline}}.' + SIGN_OFF,
      reminders: [48],
      stats: { sent: 6, delivered: 6, failed: 0 },
    },
    {
      id: 44,
      eventType: 'question_answered',
      subject: 'Clarification published for {{recordReference}}',
      body: 'A clarification answer is available for {{recordReference}}.' + SIGN_OFF,
    },
    {
      id: 45,
      eventType: 'task_assigned',
      subject: 'New task: {{recordTitle}}',
      body: '{{requiredAction}} by {{dueDate}}.' + SIGN_OFF,
      stats: { sent: 7, delivered: 7, failed: 0 },
    },
    {
      id: 46,
      eventType: 'submission_succeeded',
      subject: 'Receipt {{receiptNumber}} for {{recordReference}}',
      body: 'Your submission for {{recordReference}} was received. Official receipt: {{receiptNumber}}.' + SIGN_OFF,
      stats: { sent: 2, delivered: 2, failed: 0 },
    },
  ]),
] satisfies FixtureNotificationRule[]);

/** Every event type in catalog order (the event catalog screen). */
export const EVENT_TYPES: readonly NotificationRulesEventType[] = NOTIFICATION_RULES_EVENT_TYPE;

// ---------------------------------------------------------------------------------------------------------
// Delivery exceptions (BR-42)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureDeliveryException {
  readonly id: number;
  /** The tenant that issued the notice (the buyer). */
  readonly tenantId: number;
  readonly notificationId: number;
  readonly eventType: NotificationRulesEventType;
  readonly title: string;
  readonly channel: NotificationDeliveriesChannel;
  readonly recipientUserId: number;
  readonly recipientTenantId: number;
  readonly attemptedAt: Instant;
  readonly failureReason: string;
  readonly sourceReference: string | null;
  readonly linkPath: string | null;
  readonly deadline: { at: Instant; timeZone: string } | null;
  readonly exceptionTaskId: number | null;
  readonly ownerUserId: number | null;
  readonly resolvedAt: Instant | null;
  readonly resolutionNote: string | null;
}

export const DELIVERY_EXCEPTIONS: readonly FixtureDeliveryException[] = Object.freeze([
  {
    id: 1,
    tenantId: tid('kwu'),
    notificationId: 611,
    eventType: 'addendum_issued',
    title: 'Addendum 1 issued for T-2026-0002 — action required',
    channel: 'email',
    recipientUserId: uid('chobe-pipe.bidmanager'),
    recipientTenantId: tid('chobe-pipe'),
    attemptedAt: '2026-09-24T08:06:40Z',
    failureReason: '552 Mailbox full (remote server)',
    sourceReference: `${RECORDS.t2.reference} Addendum 1`,
    linkPath: RECORDS.t2.buyerLink,
    deadline: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
    exceptionTaskId: 114,
    ownerUserId: uid('tebogo.officer'),
    resolvedAt: null,
    resolutionNote: null,
  },
  {
    id: 2,
    tenantId: tid('kwu'),
    notificationId: 690,
    eventType: 'tender_issued',
    title: 'T-2026-0006 Chlorine dosing equipment is open for responses',
    channel: 'email',
    recipientUserId: uid('chobe-pipe.signatory'),
    recipientTenantId: tid('chobe-pipe'),
    attemptedAt: '2026-09-24T08:05:10Z',
    failureReason: '550 Recipient address rejected',
    sourceReference: RECORDS.t6.reference,
    linkPath: RECORDS.t6.buyerLink,
    deadline: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
    exceptionTaskId: null,
    ownerUserId: uid('tebogo.officer'),
    resolvedAt: '2026-09-24T11:30:00Z',
    resolutionNote: 'Confirmed by telephone with Gorata Mphoeng; in-app notice was delivered. Contact address corrected by the supplier.',
  },
] satisfies FixtureDeliveryException[]);
