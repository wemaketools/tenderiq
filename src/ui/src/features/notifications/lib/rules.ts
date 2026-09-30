/** Conversions between the ADM-12 rule editor and the notification-rules contract. */
import type {
  NotificationRecipientRole,
  NotificationRuleDetail,
} from '@contracts/notification-rules';
import { NOTIFICATION_RECIPIENT_ROLES } from '@contracts/notification-rules';

import { t } from '../../../lib/i18n';

export function valuesOf(rule: NotificationRuleDetail): RuleFormValues {
  return {
    recipientRoles: rule.recipientRoles,
    mandatory: rule.mandatory,
    subjectTemplate: rule.subjectTemplate,
    bodyTemplate: rule.bodyTemplate,
    reminderOffsetsHours: rule.reminderOffsetsHours,
    escalateAfterHours: rule.escalateAfterHours === null ? '' : String(rule.escalateAfterHours),
    escalationRole: rule.escalationRole ?? '',
  };
}

function roleOf(value: string): NotificationRecipientRole | null {
  return (NOTIFICATION_RECIPIENT_ROLES as readonly string[]).includes(value)
    ? (value as NotificationRecipientRole)
    : null;
}

/** The editable fields of a rule, as the contract expects them. */
export function ruleFields(values: RuleFormValues) {
  const hours = values.escalateAfterHours.trim();
  return {
    recipientRoles: [...values.recipientRoles],
    mandatory: values.mandatory,
    subjectTemplate: values.subjectTemplate.trim(),
    bodyTemplate: values.bodyTemplate.trim(),
    reminderOffsetsHours: [...values.reminderOffsetsHours],
    escalateAfterHours: hours === '' ? null : Number(hours),
    escalationRole: roleOf(values.escalationRole),
  };
}

export interface RuleFormValues {
  readonly recipientRoles: readonly NotificationRecipientRole[];
  readonly mandatory: boolean;
  readonly subjectTemplate: string;
  readonly bodyTemplate: string;
  readonly reminderOffsetsHours: readonly number[];
  readonly escalateAfterHours: string;
  readonly escalationRole: string;
}

export const RULE_FIELDS = [
  'eventType',
  'recipientRoles',
  'mandatory',
  'subjectTemplate',
  'bodyTemplate',
  'reminderOffsetsHours',
  'escalateAfterHours',
  'escalationRole',
  'changeNote',
] as const;

export function sameValues(a: RuleFormValues, b: RuleFormValues): boolean {
  return (
    a.mandatory === b.mandatory &&
    a.subjectTemplate === b.subjectTemplate &&
    a.bodyTemplate === b.bodyTemplate &&
    a.escalateAfterHours === b.escalateAfterHours &&
    a.escalationRole === b.escalationRole &&
    a.recipientRoles.join(',') === b.recipientRoles.join(',') &&
    a.reminderOffsetsHours.join(',') === b.reminderOffsetsHours.join(',')
  );
}

/** Client-side checks mirroring the contract, so mistakes show before the round trip. */
export function validateRule(values: RuleFormValues): Record<string, string> {
  const problems: Record<string, string> = {};
  if (values.recipientRoles.length === 0) {
    problems.recipientRoles = t('notifications.errors.recipientsRequired');
  }
  if (values.subjectTemplate.trim() === '') {
    problems.subjectTemplate = t('notifications.errors.subjectRequired');
  }
  if (values.bodyTemplate.trim() === '') {
    problems.bodyTemplate = t('notifications.errors.bodyRequired');
  }
  const hours = values.escalateAfterHours.trim();
  if (hours !== '' && !/^[1-9]\d*$/.test(hours)) {
    problems.escalateAfterHours = t('notifications.errors.escalationHours');
  } else if (hours !== '' && Number(hours) > 1440) {
    problems.escalateAfterHours = t('notifications.errors.escalationHours');
  }
  if (hours !== '' && values.escalationRole === '') {
    problems.escalationRole = t('notifications.errors.escalationRoleRequired');
  }
  if (hours === '' && values.escalationRole !== '') {
    problems.escalateAfterHours = t('notifications.errors.escalationDelayRequired');
  }
  return problems;
}
