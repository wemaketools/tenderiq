/**
 * Mock handlers of the notifications contract (`src/contracts/notifications.ts`; COM-06, COM-03, BR-41, BR-42,
 * DD-11, DD-21, DD-23, DD-42, DD-44).
 *
 * - The center lists the caller's own notifications across active memberships (rows live in the recipient's
 *   tenant). Row actions carry `X-Tenant-Id` = the row's tenant, which completes the row identity (ids are unique
 *   per tenant only).
 * - Reading never acknowledges; acknowledging never accepts terms unless asked (BR-41). A formal supplier notice
 *   needs `supplier.notices.acknowledge` in that supplier (DD-23).
 * - Mandatory formal notices ignore preferences: they cannot be muted, emailed less or digested.
 */
import type { NotificationRulesEventType } from '../../../contracts/enums.js';
import { NOTIFICATION_RULES_EVENT_TYPE, isMandatoryNotificationEvent } from '../../../contracts/enums.js';
import type {
  NotificationAcknowledgeBlock,
  NotificationItem,
  NotificationPreferences,
  NotificationSummary,
} from '../../../contracts/notifications.js';
import {
  acknowledgeNotification,
  getMyNotificationSummary,
  getNotificationPreferences,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../../../contracts/notifications.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { storylineInstant } from '../../fixtures/approvals/world.js';
import { NOTIFICATIONS, PREFERENCES, defaultPreference, findFixtureNotification } from '../../fixtures/notifications.js';
import type { FixtureNotification } from '../../fixtures/notifications.js';
import { activeMemberships, findTenantById, membershipPermissions, organizationLabel, personRef } from '../../persona.js';
import type { Persona } from '../../persona.js';

/** Actions are stamped on the storyline clock: never before the fixtures' "as of" instant. */
function iso(date: Date): string {
  return storylineInstant(date);
}

/** A formal notice delivered to a supplier organization: acknowledging it needs `supplier.notices.acknowledge` (DD-23). */
function isFormalSupplierNotice(row: FixtureNotification): boolean {
  return row.noticeRecipientId !== null && findTenantById(row.tenantId)?.kind === 'supplier';
}

/** Why `persona` cannot acknowledge `row` now, or `null` when they can (DD-23, BR-41). */
function acknowledgeBlock(row: FixtureNotification, persona: Persona): NotificationAcknowledgeBlock | null {
  if (!row.requiresAcknowledgment) {
    return 'not_required';
  }
  if (row.acknowledgedAt !== null) {
    return 'already_acknowledged';
  }
  if (isFormalSupplierNotice(row)) {
    const membership = activeMemberships(persona).find((candidate) => candidate.tenantId === row.tenantId);
    if (membership === undefined || !membershipPermissions(membership).includes('supplier.notices.acknowledge')) {
      return 'not_authorized';
    }
  }
  return null;
}

function toItem(row: FixtureNotification, persona: Persona): NotificationItem {
  const block = acknowledgeBlock(row, persona);
  return {
    canAcknowledge: block === null,
    acknowledgeBlockedReason: block === 'not_required' ? null : block,
    id: row.id,
    organization: organizationLabel(row.tenantId),
    eventType: row.eventType,
    category: row.category,
    title: row.title,
    body: row.body,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceReference: row.sourceReference,
    linkPath: row.linkPath,
    mandatory: row.mandatory,
    requiresAcknowledgment: row.requiresAcknowledgment,
    createdAt: row.createdAt,
    readAt: row.readAt,
    acknowledgedAt: row.acknowledgedAt,
    noticeRecipientId: row.noticeRecipientId,
    deliveries: row.deliveries.map((delivery) => ({ ...delivery })),
    hasTerms: row.hasTerms,
    termsAcceptedAt: row.termsAcceptedAt,
    acknowledgedBy: row.acknowledgedByUserId === null ? null : personRef(row.acknowledgedByUserId),
    deadline: row.deadline,
  };
}

function scopeTenantIds(persona: Persona): number[] {
  return activeMemberships(persona).map((membership) => membership.tenantId);
}

function mine(persona: Persona): FixtureNotification[] {
  const tenants = scopeTenantIds(persona);
  return NOTIFICATIONS.filter((row) => row.recipientUserId === persona.userId && tenants.includes(row.tenantId));
}

function awaitingAcknowledgment(row: Pick<FixtureNotification, 'requiresAcknowledgment' | 'acknowledgedAt'>): boolean {
  return row.requiresAcknowledgment && row.acknowledgedAt === null;
}

function summaryOf(persona: Persona, rows: readonly FixtureNotification[]): NotificationSummary {
  return {
    unread: rows.filter((row) => row.readAt === null).length,
    requiresAcknowledgment: rows.filter(awaitingAcknowledgment).length,
    byOrganization: activeMemberships(persona).map((membership) => {
      const inTenant = rows.filter((row) => row.tenantId === membership.tenantId);
      return {
        ...organizationLabel(membership.tenantId),
        unread: inTenant.filter((row) => row.readAt === null).length,
        requiresAcknowledgment: inTenant.filter(awaitingAcknowledgment).length,
      };
    }),
  };
}

function preferencesOf(persona: Persona): NotificationPreferences {
  return {
    items: NOTIFICATION_RULES_EVENT_TYPE.map((eventType) => {
      const mandatory = isMandatoryNotificationEvent(eventType);
      if (mandatory) {
        return { eventType, mandatory, inApp: true, email: true, digest: 'none' as const };
      }
      const own = PREFERENCES.find((row) => row.userId === persona.userId && row.eventType === eventType);
      return { eventType, mandatory, ...(own === undefined ? defaultPreference(eventType) : { inApp: own.inApp, email: own.email, digest: own.digest }) };
    }),
    emailEnabled: true,
  };
}

export function register(app: MockApp): void {
  mockRoute(app, listMyNotifications, ({ requirePersona, query, fixtures }) => {
    const persona = requirePersona();
    const q = query.q?.toLowerCase();
    const rows = mine(persona).filter((row) => {
      if (
        q !== undefined &&
        !row.title.toLowerCase().includes(q) &&
        !row.body.toLowerCase().includes(q) &&
        !(row.sourceReference ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (query.category !== undefined && !query.category.includes(row.category)) {
        return false;
      }
      if (query.eventType !== undefined && !query.eventType.includes(row.eventType)) {
        return false;
      }
      if (query.unread !== undefined && (row.readAt === null) !== query.unread) {
        return false;
      }
      if (query.requiresAcknowledgment !== undefined && row.requiresAcknowledgment !== query.requiresAcknowledgment) {
        return false;
      }
      if (query.awaitingAcknowledgment !== undefined && awaitingAcknowledgment(row) !== query.awaitingAcknowledgment) {
        return false;
      }
      if (query.tenantId !== undefined && row.tenantId !== query.tenantId) {
        return false;
      }
      if (query.from !== undefined && Date.parse(row.createdAt) < Date.parse(query.from)) {
        return false;
      }
      return !(query.to !== undefined && Date.parse(row.createdAt) > Date.parse(query.to));
    });
    const sortKey = query.sort ?? 'createdAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    const factor = dir === 'desc' ? -1 : 1;
    const value = (row: FixtureNotification): string | number =>
      sortKey === 'category' ? row.category : sortKey === 'title' ? row.title.toLowerCase() : Date.parse(row.createdAt);
    const ordered = [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return factor * (left < right ? -1 : left > right ? 1 : 0) || b.id - a.id;
    });
    return fixtures.page(ordered.map((row) => toItem(row, persona)));
  });

  mockRoute(app, getMyNotificationSummary, ({ requirePersona }) => {
    const persona = requirePersona();
    return summaryOf(persona, mine(persona));
  });

  mockRoute(app, markNotificationRead, ({ requirePersona, requireTenant, params, now, fail }) => {
    const persona = requirePersona();
    const row = findFixtureNotification(requireTenant().tenant.id, params.notificationId);
    if (row === undefined || row.recipientUserId !== persona.userId) {
      return fail(404, 'NOTIFICATION_NOT_FOUND');
    }
    return toItem({ ...row, readAt: row.readAt ?? iso(now) }, persona);
  });

  mockRoute(app, markAllNotificationsRead, ({ requirePersona, body, now, fail }) => {
    const persona = requirePersona();
    if (body.tenantId !== undefined && !scopeTenantIds(persona).includes(body.tenantId)) {
      return fail(422, 'ORGANIZATION_NOT_IN_SCOPE', 'You have no active membership in that organization.');
    }
    const at = iso(now);
    const rows = mine(persona);
    const inScope = (row: FixtureNotification): boolean => body.tenantId === undefined || row.tenantId === body.tenantId;
    const updated = rows.filter((row) => inScope(row) && row.readAt === null).length;
    const after = rows.map((row) => (inScope(row) && row.readAt === null ? { ...row, readAt: at } : row));
    return { updated, summary: summaryOf(persona, after) };
  });

  mockRoute(app, acknowledgeNotification, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const persona = requirePersona();
    const { tenant, permissions } = requireTenant();
    const row = findFixtureNotification(tenant.id, params.notificationId);
    if (row === undefined || row.recipientUserId !== persona.userId) {
      return fail(404, 'NOTIFICATION_NOT_FOUND');
    }
    if (!row.requiresAcknowledgment) {
      return fail(409, 'ACKNOWLEDGMENT_NOT_REQUIRED', 'This notification does not ask for an acknowledgment; opening it is enough.');
    }
    if (row.acknowledgedAt !== null) {
      return fail(409, 'ALREADY_ACKNOWLEDGED', 'This notice was already acknowledged for your organization.');
    }
    if (body.acceptTerms && !row.hasTerms) {
      return fail(422, 'NO_TERMS_TO_ACCEPT', 'This notice carries no terms to accept.');
    }
    if (isFormalSupplierNotice(row) && !permissions.includes('supplier.notices.acknowledge')) {
      return fail(403, 'ACKNOWLEDGMENT_NOT_AUTHORIZED', 'Only colleagues authorized to acknowledge formal notices can do this.');
    }
    const at = iso(now);
    return toItem(
      {
        ...row,
        readAt: row.readAt ?? at,
        acknowledgedAt: at,
        acknowledgedByUserId: persona.userId,
        termsAcceptedAt: body.acceptTerms ? at : row.termsAcceptedAt,
      },
      persona,
    );
  });

  mockRoute(app, getNotificationPreferences, ({ requirePersona }) => preferencesOf(requirePersona()));

  mockRoute(app, updateNotificationPreferences, ({ requirePersona, body, fail }) => {
    const persona = requirePersona();
    const seen = new Set<NotificationRulesEventType>();
    for (const item of body.items) {
      if (seen.has(item.eventType)) {
        return fail(422, 'DUPLICATE_EVENT_TYPE', `${item.eventType} appears more than once.`);
      }
      seen.add(item.eventType);
      if (isMandatoryNotificationEvent(item.eventType) && (!item.inApp || !item.email || item.digest !== 'none')) {
        return fail(422, 'MANDATORY_EVENT_NOT_MUTABLE', `${item.eventType} is a mandatory formal notice and cannot be muted or digested.`);
      }
    }
    const current = preferencesOf(persona);
    return {
      ...current,
      items: current.items.map((item) => {
        const change = body.items.find((candidate) => candidate.eventType === item.eventType);
        return change === undefined || item.mandatory ? item : { ...item, inApp: change.inApp, email: change.email, digest: change.digest };
      }),
    };
  });
}
