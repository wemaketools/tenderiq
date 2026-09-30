/**
 * Mock handler of the audit contract (`src/contracts/audit.ts`; ADM-14 and the record history panels; DD-11,
 * DD-31): the history of one record in the active buyer tenant, newest first. Restricted rows (sealed content,
 * evaluator scores) are metadata only, even for `audit.view` holders.
 */
import type { AuditEntry } from '../../../contracts/audit.js';
import { getEntityHistory } from '../../../contracts/audit.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { AUDITED_ENTITY_TYPES, AUDIT_ENTRIES } from '../../fixtures/audit.js';
import type { FixtureAuditEntry } from '../../fixtures/audit.js';
import { personRef } from '../../persona.js';

function toEntry(row: FixtureAuditEntry): AuditEntry {
  const restricted = row.sensitivity === 'restricted';
  return {
    id: row.id,
    occurredAt: row.occurredAt,
    actor: row.actorUserId === null ? null : { ...personRef(row.actorUserId), capacity: row.actorCapacity },
    actorCapacity: row.actorCapacity,
    onBehalfOf: row.onBehalfOfUserId === null ? null : personRef(row.onBehalfOfUserId),
    delegationId: row.delegationId,
    supportGrantId: row.supportGrantId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    reason: restricted ? null : row.reason,
    beforeState: restricted ? null : row.beforeState,
    afterState: restricted ? null : row.afterState,
    correlationId: row.correlationId,
    sensitivity: row.sensitivity,
    redacted: restricted,
  };
}

export function register(app: MockApp): void {
  mockRoute(app, getEntityHistory, ({ requireTenant, params, query, fixtures, fail }) => {
    const { tenant } = requireTenant();
    if (!AUDITED_ENTITY_TYPES.includes(params.entityType)) {
      return fail(422, 'ENTITY_TYPE_NOT_AUDITED', `${params.entityType} is not an audited record type.`);
    }
    const q = query.q?.toLowerCase();
    const rows = AUDIT_ENTRIES.filter(
      (row) =>
        row.tenantId === tenant.id &&
        row.entityType === params.entityType &&
        row.entityId === params.entityId &&
        (query.action === undefined || query.action.includes(row.action)) &&
        (query.actorUserId === undefined || row.actorUserId === query.actorUserId) &&
        (query.sensitivity === undefined || query.sensitivity.includes(row.sensitivity)) &&
        (query.from === undefined || Date.parse(row.occurredAt) >= Date.parse(query.from)) &&
        (query.to === undefined || Date.parse(row.occurredAt) <= Date.parse(query.to)) &&
        (q === undefined ||
          row.action.includes(q) ||
          (row.sensitivity === 'normal' && (row.reason ?? '').toLowerCase().includes(q))),
    );
    const factor = query.sort === undefined || query.dir === 'desc' ? -1 : 1;
    const ordered = [...rows].sort((a, b) =>
      query.sort === 'action'
        ? factor * a.action.localeCompare(b.action) || b.id - a.id
        : factor * (Date.parse(a.occurredAt) - Date.parse(b.occurredAt)) || factor * (a.id - b.id),
    );
    return fixtures.page(ordered.map(toEntry));
  });
}
