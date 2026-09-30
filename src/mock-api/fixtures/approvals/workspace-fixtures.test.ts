/**
 * Consistency of the workspace fixtures: unique ids, resolvable references between tasks, approvals,
 * notifications, documents and calendars, contract-valid values, and templates that only use catalog placeholders.
 */
import { describe, expect, it } from 'vitest';

import { AuditAction, AuditEntityType } from '../../../contracts/audit.js';
import { ContentHash } from '../../../contracts/approvals.js';
import { CalendarDate, Instant, LinkPath, Money, TimeZone } from '../../../contracts/common.js';
import { DocumentVersion, Sha256 } from '../../../contracts/documents.js';
import { NotificationRecipientRole, templatePlaceholders } from '../../../contracts/notification-rules.js';
import { APPROVALS, AUTHORITY_LIMITS, DELEGATIONS } from '../approvals.js';
import { AUDIT_ENTRIES, AUDITED_ENTITY_TYPES } from '../audit.js';
import { CALENDARS, CALENDAR_DEADLINES } from '../calendars.js';
import { DOCUMENTS } from '../documents.js';
import { CONFIDENTIAL_PLACEHOLDERS, DELIVERY_EXCEPTIONS, EVENT_CATALOG, NOTIFICATION_RULES } from '../notification-rules.js';
import { NOTIFICATIONS } from '../notifications.js';
import { TASKS } from '../tasks.js';
import { findPersonaById } from '../../persona.js';

function unique(values: readonly (string | number)[]): boolean {
  return new Set(values).size === values.length;
}

describe('workspace fixtures', () => {
  it('use unique ids per table', () => {
    expect(unique(APPROVALS.map((row) => row.id))).toBe(true);
    expect(unique(APPROVALS.flatMap((row) => row.steps.map((step) => step.id)))).toBe(true);
    expect(unique(TASKS.map((row) => row.id))).toBe(true);
    expect(unique(NOTIFICATIONS.map((row) => `${row.tenantId}:${row.id}`))).toBe(true);
    expect(unique(DOCUMENTS.map((row) => row.id))).toBe(true);
    expect(unique(DOCUMENTS.flatMap((row) => row.versions.map((version) => version.id)))).toBe(true);
    expect(unique(CALENDARS.map((row) => row.id))).toBe(true);
    expect(unique(NOTIFICATION_RULES.map((row) => row.id))).toBe(true);
    expect(unique(NOTIFICATION_RULES.map((row) => `${row.tenantId}:${row.eventType}`))).toBe(true);
    expect(unique(AUDIT_ENTRIES.map((row) => row.id))).toBe(true);
  });

  it('keep approvals version-bound and internally consistent', () => {
    for (const approval of APPROVALS) {
      expect(ContentHash.safeParse(approval.contentHash).success, `approval ${approval.id}`).toBe(true);
      expect(LinkPath.safeParse(approval.subjectLinkPath).success, `approval ${approval.id}`).toBe(true);
      if (approval.amount !== null) {
        expect(Money.safeParse(approval.amount).success).toBe(true);
      }
      expect(approval.steps.map((step) => step.sequence)).toEqual(approval.steps.map((_, index) => index + 1));
      expect(approval.status === 'invalidated').toBe(approval.invalidation !== null);
      if (approval.status === 'invalidated') {
        expect(approval.subjectVersion, `approval ${approval.id}`).not.toBe(approval.currentSubjectVersion);
      }
      if (approval.status === 'pending') {
        expect(approval.subjectVersion, `approval ${approval.id}`).toBe(approval.currentSubjectVersion);
      }
      for (const pinned of approval.evidence) {
        const version = DOCUMENTS.find((document) => document.id === pinned.documentId)?.versions.find(
          (candidate) => candidate.id === pinned.versionId,
        );
        expect(version, `approval ${approval.id} → document ${pinned.documentId} version ${pinned.versionId}`).toBeDefined();
        // The pinned version existed when the snapshot was captured (never a later version).
        expect(Date.parse(version?.createdAt ?? '') <= Date.parse(approval.snapshotCapturedAt), `approval ${approval.id}`).toBe(true);
      }
      expect(findPersonaById(approval.requestedByUserId)).toBeDefined();
    }
    for (const limit of AUTHORITY_LIMITS) {
      expect(findPersonaById(limit.userId)?.memberships.some((membership) => membership.tenantId === limit.tenantId)).toBe(true);
    }
    for (const delegation of DELEGATIONS) {
      const own = AUTHORITY_LIMITS.find((limit) => limit.userId === delegation.delegatorUserId);
      expect(own?.maxAmount === null || Number(own?.maxAmount?.amount) >= Number(delegation.maxAmount.amount)).toBe(true);
    }
  });

  it('link approval tasks and notifications to existing approvals', () => {
    const approvalIds = new Set(APPROVALS.map((row) => row.id));
    for (const task of TASKS.filter((row) => row.sourceType === 'approval_request')) {
      expect(approvalIds.has(task.sourceId ?? -1), `task ${task.id}`).toBe(true);
    }
    for (const notification of NOTIFICATIONS.filter((row) => row.sourceType === 'approval_request')) {
      expect(approvalIds.has(notification.sourceId ?? -1), `notification ${notification.id}`).toBe(true);
    }
  });

  it('carry valid instants, links and people', () => {
    for (const task of TASKS) {
      expect(Instant.safeParse(task.createdAt).success).toBe(true);
      if (task.dueAt !== null) {
        expect(Instant.safeParse(task.dueAt).success).toBe(true);
      }
      if (task.sourceLinkPath !== null) {
        expect(LinkPath.safeParse(task.sourceLinkPath).success, `task ${task.id}`).toBe(true);
      }
      expect(task.assigneeUserId !== null || task.groupId !== null, `task ${task.id} has an owner`).toBe(true);
    }
    for (const notification of NOTIFICATIONS) {
      expect(findPersonaById(notification.recipientUserId)?.memberships.some((membership) => membership.tenantId === notification.tenantId)).toBe(true);
      if (notification.linkPath !== null) {
        expect(LinkPath.safeParse(notification.linkPath).success, `notification ${notification.id}`).toBe(true);
      }
      expect(notification.acknowledgedAt === null || notification.requiresAcknowledgment).toBe(true);
      expect(notification.termsAcceptedAt === null || notification.hasTerms).toBe(true);
    }
  });

  it('describe documents with valid versions, digests and redaction links', () => {
    for (const document of DOCUMENTS) {
      for (const version of document.versions) {
        expect(Sha256.safeParse(version.sha256).success).toBe(true);
        expect(
          DocumentVersion.safeParse({
            ...version,
            documentId: document.id,
            createdBy: null,
          }).success,
        ).toBe(true);
      }
      if (document.redactedFromDocumentId !== null) {
        expect(document.isRedactedCopy).toBe(true);
        expect(DOCUMENTS.some((original) => original.id === document.redactedFromDocumentId)).toBe(true);
      }
      if (document.evidence?.expiresAt !== undefined && document.evidence.expiresAt !== null) {
        expect(CalendarDate.safeParse(document.evidence.expiresAt).success).toBe(true);
      }
    }
  });

  it('keep calendars and their deadlines valid', () => {
    for (const calendar of CALENDARS) {
      expect(TimeZone.safeParse(calendar.timeZone).success).toBe(true);
      expect(unique(calendar.holidays.map((holiday) => holiday.date))).toBe(true);
      expect(calendar.holidays.every((holiday) => CalendarDate.safeParse(holiday.date).success)).toBe(true);
    }
    for (const deadline of CALENDAR_DEADLINES) {
      expect(CALENDARS.some((calendar) => calendar.id === deadline.calendarId)).toBe(true);
      expect(Instant.safeParse(deadline.deadline).success).toBe(true);
    }
    expect(CALENDARS.filter((calendar) => calendar.isDefault).map((calendar) => calendar.tenantId)).toEqual([2, 3]);
  });

  it('write rule templates with catalog placeholders only and never confidential content', () => {
    for (const rule of NOTIFICATION_RULES) {
      const allowed = EVENT_CATALOG[rule.eventType].placeholders.map((placeholder) => placeholder.name);
      const used = [rule.subjectTemplate, rule.bodyTemplate].flatMap(templatePlaceholders);
      expect(used.filter((name) => !allowed.includes(name)), `rule ${rule.id}`).toEqual([]);
      expect(used.filter((name) => CONFIDENTIAL_PLACEHOLDERS.includes(name))).toEqual([]);
      for (const role of rule.recipientRoles) {
        expect(NotificationRecipientRole.safeParse(role).success).toBe(true);
        expect(EVENT_CATALOG[rule.eventType].allowedRecipientRoles).toContain(role);
      }
      expect(rule.escalateAfterHours === null).toBe(rule.escalationRole === null);
    }
    for (const exception of DELIVERY_EXCEPTIONS) {
      expect(exception.exceptionTaskId === null || TASKS.some((task) => task.id === exception.exceptionTaskId)).toBe(true);
    }
  });

  it('write audit entries with valid actions and audited entity types', () => {
    for (const entry of AUDIT_ENTRIES) {
      expect(AuditAction.safeParse(entry.action).success, entry.action).toBe(true);
      expect(AuditEntityType.safeParse(entry.entityType).success).toBe(true);
      expect(AUDITED_ENTITY_TYPES).toContain(entry.entityType);
      expect(entry.sensitivity === 'restricted' ? entry.beforeState === null && entry.afterState === null : true).toBe(true);
    }
  });
});
