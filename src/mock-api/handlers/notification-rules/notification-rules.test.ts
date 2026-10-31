import { beforeAll, describe, expect, it } from 'vitest';

import { NotificationRuleDetail, notificationRuleEndpoints } from '../../../contracts/notification-rules.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

const ADMIN = 'admin.kwu@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ modules: [{ name: 'notification-rules', register }] });
});

const rule = {
  recipientRoles: ['assigned_approver', 'record_owner'],
  mandatory: false,
  subjectTemplate: 'Approval needed: {{recordReference}}',
  bodyTemplate: 'Decide by {{dueDate}}. {{link}}',
  reminderOffsetsHours: [24],
  escalateAfterHours: null,
  escalationRole: null,
} as const;

describe('notification-rules module', () => {
  it('loads without skipped modules', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('notification-rules');
  });
});

describe('buyer.notificationRules.list / get', () => {
  it('lists the active buyer’s rules only and filters mandatory ones', async () => {
    const all = await api.callAs(ADMIN, notificationRuleEndpoints.listNotificationRules, { tenant: 'kwu', query: { pageSize: 100 } });
    expect(notificationRuleEndpoints.listNotificationRules.response.parse(all.body).total).toBe(32);
    const odc = await api.callAs('admin.odc@tenderiq.local', notificationRuleEndpoints.listNotificationRules, { tenant: 'odc' });
    expect(notificationRuleEndpoints.listNotificationRules.response.parse(odc.body).total).toBe(6);
    const mandatory = await api.callAs(ADMIN, notificationRuleEndpoints.listNotificationRules, {
      tenant: 'kwu',
      query: { mandatory: 'true', pageSize: 100 },
    });
    expect(notificationRuleEndpoints.listNotificationRules.response.parse(mandatory.body).items.every((row) => row.mandatoryLocked)).toBe(true);
  });

  it('shows a rule with placeholders, allowed recipients and delivery statistics', async () => {
    const response = await api.callAs(ADMIN, notificationRuleEndpoints.getNotificationRule, { tenant: 'kwu', params: { ruleId: 7 } });
    const detail = NotificationRuleDetail.parse(response.body);
    expect(detail).toMatchObject({ eventType: 'addendum_issued', mandatory: true, mandatoryLocked: true, deliveryStats: { failed: 1 } });
    expect(detail.placeholders.map((placeholder) => placeholder.name)).toContain('officialDeadline');
  });

  it('hides another buyer’s rule and refuses members without org.notifications.manage', async () => {
    expect((await api.callAs(ADMIN, notificationRuleEndpoints.getNotificationRule, { tenant: 'kwu', params: { ruleId: 41 } })).body).toMatchObject({
      code: 'RULE_NOT_FOUND',
    });
    const officer = await api.callAs('tebogo.officer@tenderiq.local', notificationRuleEndpoints.listNotificationRules, { tenant: 'kwu' });
    expect(officer.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('rule commands', () => {
  it('refuses a second rule for an event that has one, and creates one for an event without', async () => {
    const existing = await api.callAs(ADMIN, notificationRuleEndpoints.createNotificationRule, {
      tenant: 'kwu',
      body: { ...rule, eventType: 'approval_needed' },
    });
    expect(existing.body).toMatchObject({ code: 'RULE_ALREADY_EXISTS' });
    const created = await api.callAs('admin.odc@tenderiq.local', notificationRuleEndpoints.createNotificationRule, {
      tenant: 'odc',
      body: { ...rule, eventType: 'approval_needed' },
    });
    expect(created.status).toBe(201);
    expect(NotificationRuleDetail.parse(created.body).eventType).toBe('approval_needed');
  });

  it('refuses confidential and unknown placeholders in a general alert (BR-43)', async () => {
    const confidential = await api.callAs(ADMIN, notificationRuleEndpoints.updateNotificationRule, {
      tenant: 'kwu',
      params: { ruleId: 16 },
      body: { ...rule, recipientRoles: ['interested_supplier_users'], subjectTemplate: 'Closing soon — current lowest {{bidPrice}}' },
    });
    expect(confidential.body).toMatchObject({ code: 'CONFIDENTIAL_PLACEHOLDER_NOT_ALLOWED' });
    const unknown = await api.callAs(ADMIN, notificationRuleEndpoints.updateNotificationRule, {
      tenant: 'kwu',
      params: { ruleId: 16 },
      body: { ...rule, recipientRoles: ['interested_supplier_users'], subjectTemplate: 'Closing {{closingWeekday}}' },
    });
    expect(unknown.body).toMatchObject({ code: 'TEMPLATE_PLACEHOLDER_UNKNOWN' });
  });

  it('keeps mandatory notices mandatory and active', async () => {
    const optional = await api.callAs(ADMIN, notificationRuleEndpoints.updateNotificationRule, {
      tenant: 'kwu',
      params: { ruleId: 7 },
      body: { ...rule, recipientRoles: ['affected_participants'], subjectTemplate: 'Addendum {{versionLabel}}' },
    });
    expect(optional.body).toMatchObject({ code: 'MANDATORY_EVENT_LOCKED' });
    const off = await api.callAs(ADMIN, notificationRuleEndpoints.setNotificationRuleStatus, {
      tenant: 'kwu',
      params: { ruleId: 7 },
      body: { active: false, reason: 'Too many emails' },
    });
    expect(off.body).toMatchObject({ code: 'MANDATORY_RULE_NOT_DEACTIVATABLE' });
  });

  it('activates an optional rule and refuses an unchanged status', async () => {
    const on = await api.callAs(ADMIN, notificationRuleEndpoints.setNotificationRuleStatus, {
      tenant: 'kwu',
      params: { ruleId: 32 },
      body: { active: true, reason: 'Pilot finished' },
    });
    expect(NotificationRuleDetail.parse(on.body).active).toBe(true);
    const again = await api.callAs(ADMIN, notificationRuleEndpoints.setNotificationRuleStatus, {
      tenant: 'kwu',
      params: { ruleId: 30 },
      body: { active: true, reason: 'Again' },
    });
    expect(again.body).toMatchObject({ code: 'RULE_STATUS_UNCHANGED' });
  });

  it('refuses recipients that do not receive the event and an escalation without a recipient', async () => {
    const recipients = await api.callAs(ADMIN, notificationRuleEndpoints.updateNotificationRule, {
      tenant: 'kwu',
      params: { ruleId: 19 },
      body: { ...rule, recipientRoles: ['approved_supplier_audience'] },
    });
    expect(recipients.body).toMatchObject({ code: 'RECIPIENT_ROLE_NOT_ALLOWED' });
    const escalation = await api.callAs(ADMIN, notificationRuleEndpoints.updateNotificationRule, {
      tenant: 'kwu',
      params: { ruleId: 19 },
      body: { ...rule, escalateAfterHours: 24 },
    });
    expect(escalation.status).toBe(422);
    expect(escalation.body).toMatchObject({ errors: [{ field: 'escalationRole', code: 'ESCALATION_ROLE_REQUIRED' }] });
  });
});

describe('preview, catalog and delivery exceptions', () => {
  it('renders sample values and limits the email to title, deadline and link (DD-44)', async () => {
    const response = await api.callAs(ADMIN, notificationRuleEndpoints.previewNotificationTemplate, {
      tenant: 'kwu',
      body: { eventType: 'closing_approaching', subjectTemplate: '{{recordReference}} closes {{officialDeadline}}', bodyTemplate: 'Hi {{recipientName}} {{bidPrice}}' },
    });
    const preview = notificationRuleEndpoints.previewNotificationTemplate.response.parse(response.body);
    expect(preview.subject).toBe('T-2026-0002 closes 14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone');
    expect(preview.confidentialPlaceholders).toEqual(['bidPrice']);
    expect(preview.emailBody).not.toContain('Boago');
  });

  it('lists every event type with its rule where one exists', async () => {
    const response = await api.callAs('admin.odc@tenderiq.local', notificationRuleEndpoints.listNotificationEvents, { tenant: 'odc' });
    const catalog = notificationRuleEndpoints.listNotificationEvents.response.parse(response.body);
    expect(catalog.items).toHaveLength(35);
    expect(catalog.items.filter((item) => item.ruleId !== null)).toHaveLength(6);
  });

  it('lists the organization’s delivery exceptions with their exception task (BR-42)', async () => {
    const response = await api.callAs(ADMIN, notificationRuleEndpoints.listDeliveryExceptions, { tenant: 'kwu', query: { state: 'open' } });
    const [open] = notificationRuleEndpoints.listDeliveryExceptions.response.parse(response.body).items;
    expect(open).toMatchObject({ exceptionTaskId: 114, channel: 'email', deadline: { at: '2026-10-21T10:00:00Z' } });
    const odc = await api.callAs('admin.odc@tenderiq.local', notificationRuleEndpoints.listDeliveryExceptions, { tenant: 'odc' });
    expect(notificationRuleEndpoints.listDeliveryExceptions.response.parse(odc.body).total).toBe(0);
  });
});
