/**
 * Mock handlers of the records contract (`src/contracts/records.ts`, ADM-14): summary, audit viewer, retention
 * classes, holds, disposal requests, evidence packs and the record lookup.
 *
 * AC-35 is enforced here exactly as Stage B must: a disposal request under an active hold cannot be approved or
 * executed (`DISPOSAL_BLOCKED_BY_HOLD`), and releasing a hold returns its records to ordinary review without
 * disposing of anything. Static fixtures only; commands return the outcome and persist nothing.
 */
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { DisposalRequest, DisposalRequestRow, Hold, HoldDetail, RecordAuditEvent, RetentionClass } from '../../../contracts/records.js';
import {
  approveDisposalRequest,
  createEvidencePack,
  createHold,
  executeDisposalRequest,
  getDisposalRequest,
  getHold,
  getRecordsSummary,
  listAuditEvents,
  listDisposalRequests,
  listEvidencePacks,
  listHolds,
  listRecordSubjects,
  listRetentionClasses,
  rejectDisposalRequest,
  releaseHold,
  updateRetentionClass,
} from '../../../contracts/records.js';
import type { ExportRecord } from '../../../contracts/reporting.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { AUDIT_EVENTS, DISPOSAL_REQUESTS, HOLDS, RECORD_SUBJECTS, RETENTION_CLASSES } from '../../fixtures/records/index.js';
import type { FixtureDisposalRequest, FixtureHold, FixtureRecordSubject } from '../../fixtures/records/index.js';
import { EXPORTS, REPORTING_AS_OF, REPORTING_AS_OF_DATE } from '../../fixtures/reporting/index.js';
import { findPersonaById, personRef } from '../../persona.js';
import { containsText, hasAny, sortRows, syntheticExportId } from '../reporting/engine.js';
import { syntheticExport } from '../reporting/reports.js';
import { EVIDENCE_PACK_SUBJECTS, evidencePackIndex } from './packs.js';

const RECORDS_READ: readonly PermissionCode[] = ['audit.view', 'records.retention.manage', 'records.hold.manage', 'records.disposal.approve'];
const DAY_MS = 86_400_000;

function isoNow(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function addDaysToDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function activeHolds(tenantId: number): FixtureHold[] {
  return HOLDS.filter((hold) => hold.tenantId === tenantId && hold.releasedAt === null);
}

/** Holds still in force among those a request was blocked by. */
function blockingHoldsOf(request: FixtureDisposalRequest): FixtureHold[] {
  return activeHolds(request.tenantId).filter((hold) => request.blockedByHoldIds.includes(hold.id));
}

function toDisposalRow(request: FixtureDisposalRequest): DisposalRequestRow {
  return {
    id: request.id,
    recordClass: request.recordClass,
    entityType: request.entityType,
    entityCount: request.entities.length,
    scopeLabel: request.scopeLabel,
    status: request.status,
    disposition: request.disposition,
    eligibilityCheckedAt: request.eligibilityCheckedAt,
    blockedByHoldIds: [...request.blockedByHoldIds],
    proposedAt: request.proposedAt,
  };
}

function toDisposal(request: FixtureDisposalRequest): DisposalRequest {
  return {
    ...toDisposalRow(request),
    entities: request.entities.map((entity) => ({ ...entity })),
    blockingHolds: blockingHoldsOf(request).map((hold) => ({
      holdId: hold.id,
      holdType: hold.holdType,
      reason: hold.reason,
      reviewDate: hold.reviewDate,
      owner: personRef(hold.ownerUserId),
    })),
    approval:
      request.approval === null
        ? null
        : {
            approvalRequestId: request.approval.approvalRequestId,
            status: request.approval.status,
            decidedBy: request.approval.decidedBy === null ? null : personRef(request.approval.decidedBy),
            decidedAt: request.approval.decidedAt,
            reason: request.approval.reason,
          },
    dispositionRecord: request.dispositionRecord,
    executedAt: request.executedAt,
    eligibilityNote: request.eligibilityNote,
  };
}

function toHold(hold: FixtureHold): Hold {
  const blocked = DISPOSAL_REQUESTS.filter((request) => request.tenantId === hold.tenantId && request.status === 'blocked' && request.blockedByHoldIds.includes(hold.id));
  return {
    id: hold.id,
    subjectType: hold.subjectType,
    subjectId: hold.subjectId,
    subjectLabel: hold.subjectLabel,
    subjectReference: hold.subjectReference,
    holdType: hold.holdType,
    state: hold.releasedAt === null ? 'active' : 'released',
    reason: hold.reason,
    owner: personRef(hold.ownerUserId),
    authorityNote: hold.authorityNote,
    blockedActions: [...hold.blockedActions],
    scopeDescription: hold.scopeDescription,
    startedAt: hold.startedAt,
    reviewDate: hold.reviewDate,
    reviewDue: hold.releasedAt === null && hold.reviewDate <= addDaysToDate(REPORTING_AS_OF_DATE, 30),
    releasedAt: hold.releasedAt,
    releasedBy: hold.releasedBy === null ? null : personRef(hold.releasedBy),
    releaseReason: hold.releaseReason,
    affectedRecordCount: hold.records.length,
    blockedDisposalCount: hold.releasedAt === null ? blocked.length : 0,
  };
}

function toHoldDetail(hold: FixtureHold, blockedDisposals: readonly DisposalRequestRow[]): HoldDetail {
  return {
    ...toHold(hold),
    blockedDisposalCount: hold.releasedAt === null ? blockedDisposals.filter((row) => row.status === 'blocked').length : 0,
    affectedRecords: hold.records.map((record) => ({
      entityType: record.entityType,
      entityId: record.entityId,
      label: record.label,
      reference: record.reference,
      recordClass: record.recordClass,
      retentionEndedOn: record.retentionEndedOn,
      pastRetention: record.retentionEndedOn !== null && record.retentionEndedOn <= REPORTING_AS_OF_DATE,
      to: record.to,
    })),
    blockedDisposals: [...blockedDisposals],
    history: hold.history.map((entry) => ({ at: entry.at, action: entry.action, actor: entry.actor === null ? null : personRef(entry.actor), note: entry.note })),
  };
}

function subjectUnderHold(subject: FixtureRecordSubject): boolean {
  return activeHolds(subject.tenantId).some(
    (hold) =>
      (hold.subjectType === subject.subjectType && hold.subjectId === subject.subjectId) ||
      (hold.subjectType === 'record_class' && RETENTION_CLASSES.find((row) => row.id === hold.subjectId)?.recordClass === subject.recordClass && subject.subjectType === 'record_class'),
  );
}

/** Disposal requests a new hold on `subject` would block. */
function disposalsCoveredBy(subject: FixtureRecordSubject): FixtureDisposalRequest[] {
  return DISPOSAL_REQUESTS.filter((request) => {
    if (request.tenantId !== subject.tenantId || (request.status !== 'proposed' && request.status !== 'approved' && request.status !== 'blocked')) {
      return false;
    }
    if (subject.subjectType === 'record_class') {
      return request.recordClass === subject.recordClass;
    }
    return request.entities.some((entity) => entity.reference !== null && entity.reference === subject.reference);
  });
}

function exportVisible(record: { requestedBy: number }, userId: number, permissions: readonly PermissionCode[]): boolean {
  return record.requestedBy === userId || hasAny(permissions, ['audit.view', 'report.manage']);
}

export function register(app: MockApp): void {
  mockRoute(app, getRecordsSummary, ({ requireTenant, requirePersona }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const canRead = hasAny(permissions, RECORDS_READ);
    const since = addDaysToDate(REPORTING_AS_OF_DATE, -30);
    const recent = AUDIT_EVENTS.filter((event) => event.tenantId === tenant.id && event.occurredAt.slice(0, 10) >= since);
    const holds = activeHolds(tenant.id);
    const disposals = DISPOSAL_REQUESTS.filter((request) => request.tenantId === tenant.id);
    const classes = RETENTION_CLASSES.filter((row) => row.tenantId === tenant.id);
    const packs = EXPORTS.filter((row) => row.tenantId === tenant.id && row.exportType === 'evidence_pack' && exportVisible(row, persona.userId, permissions));
    const count = (status: FixtureDisposalRequest['status']) => disposals.filter((request) => request.status === status).length;
    return {
      asOf: REPORTING_AS_OF,
      audit: permissions.includes('audit.view')
        ? {
            eventsLast30Days: recent.length,
            restrictedEventsLast30Days: recent.filter((event) => event.sensitivity === 'restricted').length,
            accessEventsLast30Days: recent.filter((event) => event.category === 'access_event').length,
          }
        : null,
      retention: canRead ? { classes: classes.length, recordsPastRetention: classes.reduce((total, row) => total + row.pastRetention, 0) } : null,
      holds: canRead
        ? {
            active: holds.length,
            reviewDueWithin30Days: holds.filter((hold) => hold.reviewDate <= addDaysToDate(REPORTING_AS_OF_DATE, 30)).length,
            heldRecords: holds.reduce((total, hold) => total + hold.records.length, 0),
          }
        : null,
      disposals: canRead ? { proposed: count('proposed'), blocked: count('blocked'), approved: count('approved'), executed: count('executed') } : null,
      evidencePacks: hasAny(permissions, ['audit.view', 'export.create'])
        ? { ready: packs.filter((row) => row.status === 'ready').length, inProgress: packs.filter((row) => row.status === 'queued' || row.status === 'running').length }
        : null,
    };
  });

  mockRoute(app, listAuditEvents, ({ requireTenant, query, fixtures, fail }) => {
    const { tenant } = requireTenant();
    if (query.from !== undefined && query.to !== undefined && query.from > query.to) {
      fail(422, 'INVALID_DATE_RANGE', 'The start date must be on or before the end date.');
    }
    const held = activeHolds(tenant.id);
    const heldRefs = new Set(held.flatMap((hold) => [hold.subjectReference, ...hold.records.map((record) => record.reference)]).filter((value): value is string => value !== null));
    const rows = AUDIT_EVENTS.filter((event) => event.tenantId === tenant.id)
      .filter((event) => containsText(`${event.action} ${event.entityLabel ?? ''} ${event.entityReference ?? ''} ${event.reason ?? ''} ${event.actorCapacity ?? ''}`, query.q))
      .filter((event) => query.category === undefined || query.category.includes(event.category))
      .filter((event) => query.action === undefined || query.action.includes(event.action))
      .filter((event) => query.entityType === undefined || query.entityType.includes(event.entityType))
      .filter((event) => query.entityId === undefined || event.entityId === query.entityId)
      .filter((event) => query.actorUserId === undefined || event.actorUserId === query.actorUserId)
      .filter((event) => query.sensitivity === undefined || query.sensitivity.includes(event.sensitivity))
      .filter((event) => query.from === undefined || event.occurredAt.slice(0, 10) >= query.from)
      .filter((event) => query.to === undefined || event.occurredAt.slice(0, 10) <= query.to)
      .map((event): RecordAuditEvent => {
        const restricted = event.sensitivity === 'restricted';
        const actor = event.actorUserId === null ? null : findPersonaById(event.actorUserId);
        return {
          id: event.id,
          occurredAt: event.occurredAt,
          actor: actor === undefined || actor === null ? null : { userId: actor.userId, fullName: actor.fullName, capacity: event.actorCapacity },
          actorCapacity: event.actorCapacity,
          onBehalfOf: event.onBehalfOfUserId === null ? null : personRef(event.onBehalfOfUserId),
          delegationId: null,
          supportGrantId: event.supportGrantId,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          reason: restricted ? null : event.reason,
          beforeState: restricted ? null : event.beforeState,
          afterState: restricted ? null : event.afterState,
          correlationId: event.correlationId,
          sensitivity: event.sensitivity,
          redacted: restricted,
          category: event.category,
          entityLabel: event.entityLabel,
          entityReference: event.entityReference,
          classification: event.classification,
          retentionClass: event.retentionClass,
          underHold: event.entityReference !== null && heldRefs.has(event.entityReference),
          to: event.to,
        };
      });
    const keys = {
      occurredAt: (row: RecordAuditEvent) => row.occurredAt,
      action: (row: RecordAuditEvent) => row.action,
      entityType: (row: RecordAuditEvent) => row.entityType,
    } as const;
    return fixtures.page(sortRows(rows, keys[query.sort ?? 'occurredAt'], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, listRetentionClasses, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = RETENTION_CLASSES.filter((row) => row.tenantId === tenant.id)
      .filter((row) => containsText(`${row.recordClass.replace(/_/g, ' ')} ${row.purpose}`, query.q))
      .filter((row) => query.disposition === undefined || query.disposition.includes(row.disposition))
      .filter((row) => query.ownerUserId === undefined || row.ownerUserId === query.ownerUserId)
      .map(
        (row): RetentionClass => ({
          id: row.id,
          recordClass: row.recordClass,
          triggerEvent: row.triggerEvent,
          durationMonths: row.durationMonths,
          owner: personRef(row.ownerUserId),
          disposition: row.disposition,
          approvedBy: row.approvedBy === null ? null : personRef(row.approvedBy),
          purpose: row.purpose,
          updatedAt: row.updatedAt,
          stats: { recordsInScope: row.recordsInScope, pastRetention: row.pastRetention, heldRecords: row.heldRecords, disposalBlocked: row.disposalBlocked },
        }),
      );
    const keys = {
      recordClass: (row: RetentionClass) => row.recordClass,
      durationMonths: (row: RetentionClass) => row.durationMonths,
    } as const;
    return fixtures.page(sortRows(rows, query.sort === undefined ? null : keys[query.sort], query.dir));
  });

  mockRoute(app, updateRetentionClass, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const row = RETENTION_CLASSES.find((item) => item.id === params.retentionClassId && item.tenantId === tenant.id);
    if (row === undefined) {
      return notFound('No such retention class.');
    }
    const owner = findPersonaById(body.ownerUserId);
    if (owner === undefined || !owner.memberships.some((membership) => membership.tenantId === tenant.id && membership.status === 'active')) {
      fail(422, 'OWNER_NOT_ELIGIBLE', 'The owner must be an active member of this organization.');
    }
    if (row.recordClass === 'contract' && body.durationMonths < 72) {
      fail(409, 'RETENTION_SHORTER_THAN_LIVE_OBLIGATIONS', 'Live contracts and their warranties run beyond this period; keep contract records at least 72 months after closure.');
    }
    return {
      id: row.id,
      recordClass: row.recordClass,
      triggerEvent: body.triggerEvent,
      durationMonths: body.durationMonths,
      owner: personRef(body.ownerUserId),
      disposition: body.disposition,
      approvedBy: personRef(persona.userId),
      purpose: body.purpose,
      updatedAt: isoNow(now),
      stats: { recordsInScope: row.recordsInScope, pastRetention: row.pastRetention, heldRecords: row.heldRecords, disposalBlocked: row.disposalBlocked },
    };
  });

  mockRoute(app, listHolds, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = HOLDS.filter((hold) => hold.tenantId === tenant.id)
      .map(toHold)
      .filter((hold) => containsText(`${hold.subjectLabel} ${hold.subjectReference ?? ''} ${hold.reason} ${hold.scopeDescription}`, query.q))
      .filter((hold) => query.holdType === undefined || query.holdType.includes(hold.holdType))
      .filter((hold) => query.state === undefined || query.state.includes(hold.state))
      .filter((hold) => query.subjectType === undefined || query.subjectType.includes(hold.subjectType))
      .filter((hold) => query.ownerUserId === undefined || hold.owner.userId === query.ownerUserId)
      .filter((hold) => query.startedFrom === undefined || hold.startedAt.slice(0, 10) >= query.startedFrom)
      .filter((hold) => query.startedTo === undefined || hold.startedAt.slice(0, 10) <= query.startedTo);
    const keys = {
      startedAt: (row: Hold) => row.startedAt,
      reviewDate: (row: Hold) => row.reviewDate,
      holdType: (row: Hold) => row.holdType,
    } as const;
    const byState = (rowsIn: Hold[]) => [...rowsIn].sort((a, b) => Number(a.state === 'released') - Number(b.state === 'released'));
    return fixtures.page(query.sort === undefined ? byState(rows) : sortRows(rows, keys[query.sort], query.dir));
  });

  mockRoute(app, getHold, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const hold = HOLDS.find((row) => row.id === params.holdId && row.tenantId === tenant.id);
    if (hold === undefined) {
      return notFound('No such hold.');
    }
    const blocked = DISPOSAL_REQUESTS.filter((request) => request.tenantId === tenant.id && request.blockedByHoldIds.includes(hold.id)).map(toDisposalRow);
    return toHoldDetail(hold, blocked);
  });

  mockRoute(app, createHold, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const subject = RECORD_SUBJECTS.find((row) => row.tenantId === tenant.id && row.subjectType === body.subjectType && row.subjectId === body.subjectId);
    if (subject === undefined) {
      return fail(422, 'HOLD_SUBJECT_NOT_FOUND', 'Choose a record of this organization.');
    }
    if (activeHolds(tenant.id).some((hold) => hold.subjectType === subject.subjectType && hold.subjectId === subject.subjectId && hold.holdType === body.holdType)) {
      fail(409, 'HOLD_ALREADY_ACTIVE', 'A hold of this type is already in force on this record.');
    }
    if (body.reviewDate <= now.toISOString().slice(0, 10)) {
      fail(422, 'REVIEW_DATE_IN_PAST', 'The review date must be in the future.');
    }
    const at = isoNow(now);
    const hold: FixtureHold = {
      id: 900,
      tenantId: tenant.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      subjectLabel: subject.label,
      subjectReference: subject.reference,
      holdType: body.holdType,
      reason: body.reason,
      ownerUserId: persona.userId,
      authorityNote: body.authorityNote,
      blockedActions: body.blockedActions,
      scopeDescription: body.scopeDescription,
      startedAt: at,
      reviewDate: body.reviewDate,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      records: [
        {
          entityType: subject.subjectType,
          entityId: subject.subjectId,
          label: subject.label,
          reference: subject.reference,
          recordClass: subject.recordClass,
          retentionEndedOn: null,
          to: subject.to,
        },
      ],
      history: [{ at, action: 'Hold imposed', actor: persona.userId, note: `Blocks: ${body.blockedActions.join(', ')}.` }],
    };
    const blocked = disposalsCoveredBy(subject).map((request) => ({
      ...toDisposalRow(request),
      status: 'blocked' as const,
      blockedByHoldIds: [...request.blockedByHoldIds, 900],
    }));
    return toHoldDetail(hold, blocked);
  });

  mockRoute(app, releaseHold, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const hold = HOLDS.find((row) => row.id === params.holdId && row.tenantId === tenant.id);
    if (hold === undefined) {
      return notFound('No such hold.');
    }
    if (hold.releasedAt !== null) {
      fail(409, 'HOLD_ALREADY_RELEASED', 'This hold has already been released.');
    }
    const at = isoNow(now);
    const released: FixtureHold = {
      ...hold,
      releasedAt: at,
      releasedBy: persona.userId,
      releaseReason: body.reason,
      history: [
        ...hold.history,
        { at, action: 'Hold released', actor: persona.userId, note: 'Records returned to ordinary eligibility review; nothing was disposed of (PRD §18.3).' },
      ],
    };
    const returned = DISPOSAL_REQUESTS.filter((request) => request.tenantId === tenant.id && request.blockedByHoldIds.includes(hold.id)).map((request) => {
      const remaining = request.blockedByHoldIds.filter((id) => id !== hold.id && activeHolds(tenant.id).some((other) => other.id === id));
      return { ...toDisposalRow(request), blockedByHoldIds: remaining, status: remaining.length > 0 ? ('blocked' as const) : ('proposed' as const) };
    });
    return toHoldDetail(released, returned);
  });

  mockRoute(app, listDisposalRequests, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = DISPOSAL_REQUESTS.filter((request) => request.tenantId === tenant.id)
      .filter((request) => containsText(`${request.scopeLabel} ${request.recordClass.replace(/_/g, ' ')} ${request.eligibilityNote}`, query.q))
      .filter((request) => query.status === undefined || query.status.includes(request.status))
      .filter((request) => query.recordClass === undefined || query.recordClass.includes(request.recordClass))
      .filter((request) => query.from === undefined || request.proposedAt.slice(0, 10) >= query.from)
      .filter((request) => query.to === undefined || request.proposedAt.slice(0, 10) <= query.to)
      .map(toDisposalRow);
    const keys = {
      proposedAt: (row: DisposalRequestRow) => row.proposedAt,
      status: (row: DisposalRequestRow) => row.status,
      recordClass: (row: DisposalRequestRow) => row.recordClass,
    } as const;
    return fixtures.page(sortRows(rows, keys[query.sort ?? 'proposedAt'], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, getDisposalRequest, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const request = DISPOSAL_REQUESTS.find((row) => row.id === params.disposalRequestId && row.tenantId === tenant.id);
    return request === undefined ? notFound('No such disposal request.') : toDisposal(request);
  });

  mockRoute(app, approveDisposalRequest, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const request = DISPOSAL_REQUESTS.find((row) => row.id === params.disposalRequestId && row.tenantId === tenant.id);
    if (request === undefined) {
      return notFound('No such disposal request.');
    }
    if (request.status === 'approved' || request.status === 'executed' || request.status === 'rejected') {
      fail(409, 'DISPOSAL_ALREADY_DECIDED', `This request is already ${request.status}.`);
    }
    const holds = blockingHoldsOf(request);
    if (request.status === 'blocked' || holds.length > 0) {
      fail(409, 'DISPOSAL_BLOCKED_BY_HOLD', `Disposal is blocked by ${holds.map((hold) => `hold ${hold.id} (${hold.holdType.replace(/_/g, ' ')})`).join(', ')}; release the hold first (BR-40).`);
    }
    if (request.failsRecheck) {
      fail(409, 'DISPOSAL_NOT_ELIGIBLE', 'The eligibility re-check found a live claim or obligation that still needs these records.');
    }
    return toDisposal({
      ...request,
      status: 'approved',
      approval: { approvalRequestId: 900, status: 'approved', decidedBy: persona.userId, decidedAt: isoNow(now), reason: body.reason },
      eligibilityNote: `${request.eligibilityNote} Eligibility confirmed at approval.`,
    });
  });

  mockRoute(app, rejectDisposalRequest, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const request = DISPOSAL_REQUESTS.find((row) => row.id === params.disposalRequestId && row.tenantId === tenant.id);
    if (request === undefined) {
      return notFound('No such disposal request.');
    }
    if (request.status === 'approved' || request.status === 'executed' || request.status === 'rejected') {
      fail(409, 'DISPOSAL_ALREADY_DECIDED', `This request is already ${request.status}.`);
    }
    return toDisposal({
      ...request,
      status: 'rejected',
      approval: { approvalRequestId: 900, status: 'rejected', decidedBy: persona.userId, decidedAt: isoNow(now), reason: body.reason },
      eligibilityNote: 'Rejected: the records are retained and their history is unchanged.',
    });
  });

  mockRoute(app, executeDisposalRequest, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const request = DISPOSAL_REQUESTS.find((row) => row.id === params.disposalRequestId && row.tenantId === tenant.id);
    if (request === undefined) {
      return notFound('No such disposal request.');
    }
    if (request.status === 'blocked' || blockingHoldsOf(request).length > 0) {
      fail(409, 'DISPOSAL_BLOCKED_BY_HOLD', 'A hold in force blocks disposal of these records (BR-40).');
    }
    if (request.status !== 'approved') {
      fail(409, 'DISPOSAL_NOT_APPROVED', request.status === 'executed' ? 'This disposal was already executed.' : 'Only an approved disposal request can be executed.');
    }
    return toDisposal({ ...request, status: 'executed', dispositionRecord: body.dispositionRecord, executedAt: isoNow(now) });
  });

  mockRoute(app, listEvidencePacks, ({ requireTenant, requirePersona, query, fixtures }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const rows = EXPORTS.filter((row) => row.tenantId === tenant.id && row.exportType === 'evidence_pack' && exportVisible(row, persona.userId, permissions))
      .filter((row) => containsText(`${row.scopeDescription} ${row.subjectLabel ?? ''}`, query.q))
      .filter((row) => query.subjectType === undefined || (row.subjectType !== null && (query.subjectType as readonly string[]).includes(row.subjectType)))
      .filter((row) => query.from === undefined || row.requestedAt.slice(0, 10) >= query.from)
      .filter((row) => query.to === undefined || row.requestedAt.slice(0, 10) <= query.to)
      .map((row): ExportRecord => {
        const { tenantId: _tenantId, requestedBy, ...rest } = row;
        return { ...rest, requestedBy: personRef(requestedBy) };
      });
    const keys = {
      requestedAt: (row: ExportRecord) => row.requestedAt,
      status: (row: ExportRecord) => row.status,
    } as const;
    return fixtures.page(sortRows(rows, keys[query.sort ?? 'requestedAt'], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, createEvidencePack, ({ requireTenant, requirePersona, body, now, fail, notFound }) => {
    const tenant = requireTenant();
    const persona = requirePersona();
    const subject = EVIDENCE_PACK_SUBJECTS.find((row) => row.tenantId === tenant.tenant.id && row.subjectType === body.subjectType && row.subjectId === body.subjectId);
    if (subject === undefined) {
      return fail(422, 'EVIDENCE_SUBJECT_NOT_FOUND', 'Choose a record of this organization.');
    }
    if (body.includeRestrictedMetadata && !tenant.permissions.includes('audit.view')) {
      fail(403, 'RESTRICTED_METADATA_REQUIRES_AUDIT_VIEW', 'Only audit.view holders may include restricted audit metadata (DD-31).');
    }
    const id = syntheticExportId('evidence', body.format, evidencePackIndex(subject, body.includeAuditTrail, body.includeRestrictedMetadata));
    const record = syntheticExport(id, tenant, persona.userId, now);
    return record ?? notFound('No such record.');
  });

  mockRoute(app, listRecordSubjects, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = RECORD_SUBJECTS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.subjectType === undefined || query.subjectType.includes(row.subjectType))
      .filter((row) => containsText(`${row.label} ${row.reference ?? ''}`, query.q))
      .map((row) => ({
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        label: row.label,
        reference: row.reference,
        recordClass: row.recordClass,
        underHold: subjectUnderHold(row),
        pastRetention: row.pastRetention,
      }));
    const keys = {
      label: (row: { label: string }) => row.label,
      reference: (row: { reference: string | null }) => row.reference,
    } as const;
    return fixtures.page(sortRows(rows, query.sort === undefined ? null : keys[query.sort], query.dir));
  });
}
