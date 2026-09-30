import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { splitIssueMessage } from '../common.js';
import { validateEndpointDefinition } from '../endpoint.js';
import type { AnyEndpoint } from '../endpoint.js';
import {
  CreateNotificationRuleBody,
  NotificationRuleListQuery,
  UpdateNotificationRuleBody,
  notificationRuleEndpoints,
  templatePlaceholders,
} from '../notification-rules.js';

function codes(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => splitIssueMessage(issue.message).code);
}

const valid = {
  eventType: 'closing_approaching',
  recipientRoles: ['interested_supplier_users'],
  mandatory: false,
  subjectTemplate: '{{recordReference}} closes on {{officialDeadline}}',
  bodyTemplate: 'Only an official receipt establishes a submission. {{link}}',
} as const;

const endpoints: AnyEndpoint[] = Object.values(notificationRuleEndpoints);

describe('notification-rules contract (ADM-12)', () => {
  it.each(endpoints.map((endpoint) => [endpoint.id, endpoint] as const))(
    '%s is a valid buyer endpoint guarded by org.notifications.manage',
    (_id, endpoint) => {
      expect(validateEndpointDefinition(endpoint)).toEqual([]);
      expect(endpoint.permission).toBe('org.notifications.manage');
    },
  );

  it('defaults reminders, escalation and activity on create', () => {
    expect(CreateNotificationRuleBody.parse(valid)).toMatchObject({
      reminderOffsetsHours: [],
      escalateAfterHours: null,
      escalationRole: null,
      active: true,
    });
  });

  it('requires recipients and both halves of an escalation', () => {
    expect(codes(CreateNotificationRuleBody, { ...valid, recipientRoles: [] })).toEqual(['RECIPIENTS_REQUIRED']);
    expect(codes(CreateNotificationRuleBody, { ...valid, escalateAfterHours: 24 })).toEqual(['ESCALATION_ROLE_REQUIRED']);
    expect(codes(UpdateNotificationRuleBody, { ...valid, escalationRole: 'escalation_owner' })).toEqual(['ESCALATION_DELAY_REQUIRED']);
  });

  it('refuses duplicate, excessive and out-of-range reminder offsets', () => {
    expect(codes(CreateNotificationRuleBody, { ...valid, reminderOffsetsHours: [48, 48] })).toEqual(['DUPLICATE_REMINDER_OFFSET']);
    expect(codes(CreateNotificationRuleBody, { ...valid, reminderOffsetsHours: [1, 2, 3, 4, 5, 6, 7] })).toEqual(['TOO_MANY_REMINDERS']);
    expect(codes(CreateNotificationRuleBody, { ...valid, reminderOffsetsHours: [0] })).toEqual(['INVALID_REMINDER_OFFSET']);
  });

  it('refuses unknown recipient roles and empty templates', () => {
    expect(codes(CreateNotificationRuleBody, { ...valid, recipientRoles: ['everyone'] })).toEqual(['RECIPIENT_ROLE_UNKNOWN']);
    expect(codes(CreateNotificationRuleBody, { ...valid, subjectTemplate: '  ' })).toEqual(['TEMPLATE_REQUIRED']);
  });

  it('extracts placeholder names in order of first use', () => {
    expect(templatePlaceholders('{{ link }} and {{recordReference}} then {{link}}')).toEqual(['link', 'recordReference']);
  });

  it('parses list filters from the query string', () => {
    expect(NotificationRuleListQuery.parse({ mandatory: 'true', category: 'formal_notice', hasReminders: 'false' })).toMatchObject({
      mandatory: true,
      category: ['formal_notice'],
      hasReminders: false,
    });
  });
});
