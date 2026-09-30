/**
 * Mock handlers of the notification-rules contract (`src/contracts/notification-rules.ts`; ADM-12, PRD §14.3,
 * BR-41, BR-42, BR-43, DD-44).
 *
 * - Rules are per buyer tenant, one per event type. Mandatory formal notices stay mandatory and active.
 * - Templates may only use the event's catalog placeholders; confidential names are refused, so no general alert
 *   can carry bid, score or bidder content (BR-43).
 * - Commands return the rule as it would be after the change; nothing is stored.
 */
import type { NotificationRulesEventType } from '../../../contracts/enums.js';
import { isMandatoryNotificationEvent } from '../../../contracts/enums.js';
import type {
  DeliveryException,
  NotificationPreview,
  NotificationRecipientRole,
  NotificationRuleDetail,
  NotificationRuleSummary,
} from '../../../contracts/notification-rules.js';
import {
  createNotificationRule,
  getNotificationRule,
  listDeliveryExceptions,
  listNotificationEvents,
  listNotificationRules,
  previewNotificationTemplate,
  setNotificationRuleStatus,
  templatePlaceholders,
  updateNotificationRule,
} from '../../../contracts/notification-rules.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { storylineInstant } from '../../fixtures/approvals/world.js';
import {
  CONFIDENTIAL_PLACEHOLDERS,
  DELIVERY_EXCEPTIONS,
  EVENT_CATALOG,
  EVENT_TYPES,
  NOTIFICATION_RULES,
} from '../../fixtures/notification-rules.js';
import type { FixtureNotificationRule } from '../../fixtures/notification-rules.js';
import { findFixtureTask } from '../../fixtures/tasks.js';
import { findTenantById, personRef } from '../../persona.js';

type Fail = (status: number, code: string, detail?: string) => never;

/** Actions are stamped on the storyline clock: never before the fixtures' "as of" instant. */
function iso(date: Date): string {
  return storylineInstant(date);
}

function toSummary(rule: FixtureNotificationRule): NotificationRuleSummary {
  return {
    id: rule.id,
    eventType: rule.eventType,
    category: EVENT_CATALOG[rule.eventType].category,
    recipientRoles: [...rule.recipientRoles],
    mandatory: rule.mandatory,
    mandatoryLocked: isMandatoryNotificationEvent(rule.eventType),
    subjectTemplate: rule.subjectTemplate,
    reminderOffsetsHours: [...rule.reminderOffsetsHours].sort((a, b) => b - a),
    escalateAfterHours: rule.escalateAfterHours,
    escalationRole: rule.escalationRole,
    active: rule.active,
    updatedAt: rule.updatedAt,
    updatedBy: rule.updatedByUserId === null ? null : personRef(rule.updatedByUserId),
  };
}

function toDetail(rule: FixtureNotificationRule): NotificationRuleDetail {
  const definition = EVENT_CATALOG[rule.eventType];
  return {
    ...toSummary(rule),
    bodyTemplate: rule.bodyTemplate,
    placeholders: definition.placeholders.map((placeholder) => ({ ...placeholder })),
    allowedRecipientRoles: [...definition.allowedRecipientRoles],
    channels: definition.category === 'promotional' ? ['in_app'] : ['in_app', 'email'],
    deliveryStats: { ...rule.stats },
    createdAt: rule.createdAt,
  };
}

/** Unknown and confidential placeholder names of the templates. */
function placeholderProblems(eventType: NotificationRulesEventType, templates: readonly string[]): { unknown: string[]; confidential: string[] } {
  const allowed = new Set(EVENT_CATALOG[eventType].placeholders.map((placeholder) => placeholder.name));
  const used = [...new Set(templates.flatMap(templatePlaceholders))];
  return {
    confidential: used.filter((name) => CONFIDENTIAL_PLACEHOLDERS.includes(name)),
    unknown: used.filter((name) => !allowed.has(name) && !CONFIDENTIAL_PLACEHOLDERS.includes(name)),
  };
}

/** Refuses templates and recipients the event does not allow. */
function checkRule(
  eventType: NotificationRulesEventType,
  body: {
    recipientRoles: readonly NotificationRecipientRole[];
    escalationRole: NotificationRecipientRole | null;
    subjectTemplate: string;
    bodyTemplate: string;
    mandatory: boolean;
  },
  fail: Fail,
): void {
  if (isMandatoryNotificationEvent(eventType) && !body.mandatory) {
    fail(422, 'MANDATORY_EVENT_LOCKED', 'This formal notice is mandatory and cannot be made optional.');
  }
  const problems = placeholderProblems(eventType, [body.subjectTemplate, body.bodyTemplate]);
  if (problems.confidential.length > 0) {
    fail(422, 'CONFIDENTIAL_PLACEHOLDER_NOT_ALLOWED', `Confidential content cannot appear in a general alert: ${problems.confidential.join(', ')}.`);
  }
  if (problems.unknown.length > 0) {
    fail(422, 'TEMPLATE_PLACEHOLDER_UNKNOWN', `Unknown placeholders: ${problems.unknown.join(', ')}.`);
  }
  const allowed = EVENT_CATALOG[eventType].allowedRecipientRoles;
  const refused = [...body.recipientRoles, ...(body.escalationRole === null ? [] : [body.escalationRole])].filter(
    (role) => !allowed.includes(role),
  );
  if (refused.length > 0) {
    fail(422, 'RECIPIENT_ROLE_NOT_ALLOWED', `Not a recipient of this event: ${refused.join(', ')}.`);
  }
}

function ruleIn(tenantId: number, ruleId: number, fail: Fail): FixtureNotificationRule {
  const rule = NOTIFICATION_RULES.find((candidate) => candidate.id === ruleId && candidate.tenantId === tenantId);
  if (rule === undefined) {
    return fail(404, 'RULE_NOT_FOUND');
  }
  return rule;
}

function render(template: string, values: ReadonlyMap<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, (whole, name: string) => values.get(name) ?? whole);
}

export function register(app: MockApp): void {
  mockRoute(app, listNotificationRules, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const q = query.q?.toLowerCase();
    const rows = NOTIFICATION_RULES.filter((rule) => {
      if (rule.tenantId !== tenant.id) {
        return false;
      }
      if (
        q !== undefined &&
        !rule.eventType.replace(/_/g, ' ').includes(q) &&
        !rule.subjectTemplate.toLowerCase().includes(q) &&
        !EVENT_CATALOG[rule.eventType].description.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (query.eventType !== undefined && !query.eventType.includes(rule.eventType)) {
        return false;
      }
      if (query.category !== undefined && !query.category.includes(EVENT_CATALOG[rule.eventType].category)) {
        return false;
      }
      if (query.mandatory !== undefined && rule.mandatory !== query.mandatory) {
        return false;
      }
      if (query.active !== undefined && rule.active !== query.active) {
        return false;
      }
      if (query.hasReminders !== undefined && rule.reminderOffsetsHours.length > 0 !== query.hasReminders) {
        return false;
      }
      return !(query.hasEscalation !== undefined && (rule.escalateAfterHours !== null) !== query.hasEscalation);
    });
    const factor = query.dir === 'desc' ? -1 : 1;
    const value = (rule: FixtureNotificationRule): string | number =>
      query.sort === 'category'
        ? EVENT_CATALOG[rule.eventType].category
        : query.sort === 'updatedAt'
          ? Date.parse(rule.updatedAt)
          : EVENT_TYPES.indexOf(rule.eventType);
    const ordered = [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return factor * (left < right ? -1 : left > right ? 1 : 0) || a.id - b.id;
    });
    return fixtures.page(ordered.map(toSummary));
  });

  mockRoute(app, getNotificationRule, ({ requireTenant, params, fail }) => toDetail(ruleIn(requireTenant().tenant.id, params.ruleId, fail)));

  mockRoute(app, createNotificationRule, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant } = requireTenant();
    if (NOTIFICATION_RULES.some((rule) => rule.tenantId === tenant.id && rule.eventType === body.eventType)) {
      return fail(409, 'RULE_ALREADY_EXISTS', 'The organization already has a rule for this event; edit it instead.');
    }
    checkRule(body.eventType, body, fail);
    const at = iso(now);
    return toDetail({
      id: 900,
      tenantId: tenant.id,
      eventType: body.eventType,
      recipientRoles: body.recipientRoles,
      mandatory: body.mandatory,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
      reminderOffsetsHours: body.reminderOffsetsHours,
      escalateAfterHours: body.escalateAfterHours,
      escalationRole: body.escalationRole,
      active: body.active,
      createdAt: at,
      updatedAt: at,
      updatedByUserId: requirePersona().userId,
      stats: { sent: 0, delivered: 0, failed: 0, notConfigured: 0 },
    });
  });

  mockRoute(app, updateNotificationRule, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const rule = ruleIn(requireTenant().tenant.id, params.ruleId, fail);
    checkRule(rule.eventType, body, fail);
    return toDetail({
      ...rule,
      recipientRoles: body.recipientRoles,
      mandatory: body.mandatory,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
      reminderOffsetsHours: body.reminderOffsetsHours,
      escalateAfterHours: body.escalateAfterHours,
      escalationRole: body.escalationRole,
      updatedAt: iso(now),
      updatedByUserId: requirePersona().userId,
    });
  });

  mockRoute(app, setNotificationRuleStatus, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const rule = ruleIn(requireTenant().tenant.id, params.ruleId, fail);
    if (rule.active === body.active) {
      return fail(409, 'RULE_STATUS_UNCHANGED', body.active ? 'The rule is already active.' : 'The rule is already inactive.');
    }
    if (!body.active && rule.mandatory) {
      return fail(409, 'MANDATORY_RULE_NOT_DEACTIVATABLE', 'Mandatory formal notices are always sent.');
    }
    return toDetail({ ...rule, active: body.active, updatedAt: iso(now), updatedByUserId: requirePersona().userId });
  });

  mockRoute(app, previewNotificationTemplate, ({ requireTenant, body }) => {
    const { tenant } = requireTenant();
    const definition = EVENT_CATALOG[body.eventType];
    const values = new Map(definition.placeholders.map((placeholder) => [placeholder.name, placeholder.example]));
    values.set('organization', findTenantById(tenant.id)?.name ?? tenant.name);
    const problems = placeholderProblems(body.eventType, [body.subjectTemplate, body.bodyTemplate]);
    const used = [...new Set([body.subjectTemplate, body.bodyTemplate].flatMap(templatePlaceholders))];
    const subject = render(body.subjectTemplate, values);
    const deadline = values.get('officialDeadline');
    const link = values.get('link') ?? '';
    const preview: NotificationPreview = {
      eventType: body.eventType,
      subject,
      body: render(body.bodyTemplate, values),
      emailSubject: subject,
      emailBody: deadline === undefined ? `${subject}\n\n${link}` : `${subject}\n\nOfficial deadline: ${deadline}\n\n${link}`,
      usedPlaceholders: used,
      unknownPlaceholders: problems.unknown,
      confidentialPlaceholders: problems.confidential,
      sampleDeadline: deadline === undefined ? null : { at: '2026-10-14T10:00:00Z', timeZone: tenant.officialTimeZone },
    };
    return preview;
  });

  mockRoute(app, listNotificationEvents, ({ requireTenant }) => {
    const { tenant } = requireTenant();
    return {
      items: EVENT_TYPES.map((eventType) => {
        const definition = EVENT_CATALOG[eventType];
        return {
          eventType,
          category: definition.category,
          description: definition.description,
          mandatory: isMandatoryNotificationEvent(eventType),
          defaultRecipientRoles: [...definition.defaultRecipientRoles],
          allowedRecipientRoles: [...definition.allowedRecipientRoles],
          placeholders: definition.placeholders.map((placeholder) => ({ ...placeholder })),
          supportsReminders: definition.supportsReminders,
          ruleId: NOTIFICATION_RULES.find((rule) => rule.tenantId === tenant.id && rule.eventType === eventType)?.id ?? null,
        };
      }),
    };
  });

  mockRoute(app, listDeliveryExceptions, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const q = query.q?.toLowerCase();
    const rows: DeliveryException[] = DELIVERY_EXCEPTIONS.filter((row) => row.tenantId === tenant.id).map((row) => {
      const task = row.exceptionTaskId === null ? undefined : findFixtureTask(row.exceptionTaskId);
      return {
        id: row.id,
        eventType: row.eventType,
        title: row.title,
        channel: row.channel,
        recipient: personRef(row.recipientUserId),
        recipientOrganization: findTenantById(row.recipientTenantId)?.name ?? '',
        attemptedAt: row.attemptedAt,
        failureReason: row.failureReason,
        sourceReference: row.sourceReference,
        linkPath: row.linkPath,
        deadline: row.deadline,
        state: row.resolvedAt === null ? 'open' : 'resolved',
        exceptionTaskId: row.exceptionTaskId,
        exceptionTaskStatus: task?.status ?? null,
        owner: row.ownerUserId === null ? null : personRef(row.ownerUserId),
        resolutionNote: row.resolutionNote,
      };
    });
    const filtered = rows.filter(
      (row) =>
        (q === undefined || row.title.toLowerCase().includes(q) || (row.sourceReference ?? '').toLowerCase().includes(q)) &&
        (query.state === undefined || query.state.includes(row.state)) &&
        (query.channel === undefined || query.channel.includes(row.channel)) &&
        (query.eventType === undefined || query.eventType.includes(row.eventType)) &&
        (query.from === undefined || Date.parse(row.attemptedAt) >= Date.parse(query.from)) &&
        (query.to === undefined || Date.parse(row.attemptedAt) <= Date.parse(query.to)),
    );
    const factor = query.sort === undefined || query.dir === 'desc' ? -1 : 1;
    const ordered = [...filtered].sort((a, b) =>
      query.sort === 'eventType'
        ? factor * a.eventType.localeCompare(b.eventType)
        : factor * (Date.parse(a.attemptedAt) - Date.parse(b.attemptedAt)),
    );
    return fixtures.page(ordered);
  });
}
