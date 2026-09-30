/**
 * Audit contract: the history of one record, for the record history panels (ADM-14 and every record workspace;
 * architecture-plan §3.5; DD-11, DD-31).
 *
 * - Entries come from `audit_log` in the partition of the tenant that owns the record (DD-11). A supplier acting on
 *   a buyer-owned record appears with `actorCapacity` naming the supplier organization; support-access events are
 *   written to the customer tenant so the customer can review them.
 * - Sealed content and evaluator scores are never stored in `before_state`/`after_state`: such actions carry ids and
 *   hashes only with `sensitivity = 'restricted'` (DD-31). This endpoint requires `audit.view`, and restricted rows
 *   are still redacted to metadata (`redacted: true`, no before/after).
 */
import { z } from 'zod';

import {
  ActorRef,
  Id,
  IdParam,
  Instant,
  JsonObject,
  PersonRef,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import { AuditLogSensitivity } from './enums.js';

/** An audited entity type (`audit_log.entity_type`), for example `tender`, `bid_revision`, `approval_request`. */
export const AuditEntityType = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,62}$/, issue('INVALID_ENTITY_TYPE', 'Use a snake_case entity type such as tender.'));
export type AuditEntityType = z.infer<typeof AuditEntityType>;

/** An audited action (`audit_log.action`), for example `tender.published`. */
export const AuditAction = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, issue('INVALID_ACTION', 'Use a dotted action such as tender.published.'));
export type AuditAction = z.infer<typeof AuditAction>;

/** One audit entry. */
export const AuditEntry = z.object({
  id: Id,
  occurredAt: Instant,
  actor: ActorRef.nullable(),
  /** The capacity the actor acted in (for a supplier on a buyer record: the supplier organization, DD-11). */
  actorCapacity: z.string().nullable(),
  onBehalfOf: PersonRef.nullable(),
  delegationId: Id.nullable(),
  /** Set when an operator acted under a support access grant (OPS-04). */
  supportGrantId: Id.nullable(),
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: Id,
  reason: z.string().nullable(),
  /** Omitted (`null`) for restricted rows (DD-31). */
  beforeState: JsonObject.nullable(),
  afterState: JsonObject.nullable(),
  correlationId: z.string().nullable(),
  sensitivity: AuditLogSensitivity,
  /** True when the row is restricted and shown as metadata only. */
  redacted: z.boolean(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const AUDIT_SORT_FIELDS = ['occurredAt', 'action'] as const;

export const EntityHistoryParams = z.object({
  entityType: AuditEntityType,
  entityId: IdParam,
});

export const EntityHistoryQuery = listQueryWithSort(AUDIT_SORT_FIELDS).extend({
  action: queryList(AuditAction).optional(),
  actorUserId: IdParam.optional(),
  sensitivity: queryList(AuditLogSensitivity).optional(),
  from: Instant.optional(),
  to: Instant.optional(),
});
export type EntityHistoryQuery = z.input<typeof EntityHistoryQuery>;

export const AuditPage = pageOf(AuditEntry);
export type AuditPage = z.infer<typeof AuditPage>;

/** GET /api/v1/buyer/audit/entities/:entityType/:entityId: the audit trail of one record, newest first by default. */
export const getEntityHistory = defineEndpoint({
  id: 'buyer.audit.entityHistory',
  method: 'GET',
  path: '/api/v1/buyer/audit/entities/:entityType/:entityId',
  audience: 'buyer',
  permission: 'audit.view',
  params: EntityHistoryParams,
  query: EntityHistoryQuery,
  response: AuditPage,
  errors: ['ENTITY_TYPE_NOT_AUDITED'],
  screens: ['ADM-14', 'BUY-07', 'BUY-04', 'CON-01', 'BUY-33'],
  summary:
    'The audit trail of one record in the active buyer tenant. Restricted rows are redacted to metadata (DD-31).',
});

/** The audit endpoint map. */
export const auditEndpoints = {
  getEntityHistory,
} as const;
