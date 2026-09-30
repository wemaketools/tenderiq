/**
 * Audit fixtures (ADM-14 and the record history panels; DD-11, DD-31): entries in the partition of the tenant that
 * owns the record. A supplier acting on a buyer record appears with the supplier organization as its capacity;
 * support access is written to the customer tenant; sealed-content actions are `restricted` and carry ids only.
 */
import type { Instant } from '../../contracts/common.js';
import type { AuditLogSensitivity } from '../../contracts/enums.js';
import { RECORDS, tid, uid } from './approvals/world.js';
import type { TenantSlug } from './platform.js';

/** Entity types written to the audit log (anything else answers ENTITY_TYPE_NOT_AUDITED). */
export const AUDITED_ENTITY_TYPES: readonly string[] = [
  'tender',
  'lot',
  'addendum',
  'bid_revision',
  'approval_request',
  'procurement_request',
  'procurement_strategy',
  'qualification_application',
  'contract',
  'change_request',
  'document',
  'calendar',
  'notification_rule',
  'policy_profile',
  'template',
  'user',
  'membership',
  'task',
  'complaint',
  'award_recommendation',
  'evaluation_report',
  'opening_session',
  'support_access_grant',
];

export interface FixtureAuditEntry {
  readonly id: number;
  readonly tenantId: number;
  readonly occurredAt: Instant;
  readonly actorUserId: number | null;
  readonly actorCapacity: string | null;
  readonly onBehalfOfUserId: number | null;
  readonly delegationId: number | null;
  readonly supportGrantId: number | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: number;
  readonly reason: string | null;
  readonly beforeState: Record<string, string | number | boolean | null> | null;
  readonly afterState: Record<string, string | number | boolean | null> | null;
  readonly correlationId: string | null;
  readonly sensitivity: AuditLogSensitivity;
}

interface EntrySpec {
  readonly id: number;
  readonly tenant?: TenantSlug;
  readonly at: Instant;
  readonly actor: string | null;
  readonly capacity?: string;
  readonly onBehalfOf?: string;
  readonly delegationId?: number;
  readonly supportGrantId?: number;
  readonly action: string;
  readonly entity: readonly [string, number];
  readonly reason?: string;
  readonly before?: Record<string, string | number | boolean | null>;
  readonly after?: Record<string, string | number | boolean | null>;
  readonly restricted?: boolean;
}

const CAPACITY: Readonly<Record<string, string>> = {
  'tebogo.officer': 'Procurement Officer',
  'mpho.manager': 'Procurement Manager',
  'keabetswe.approver': 'Chief Executive (Award Approver)',
  'kagiso.requester': 'Operations Engineer',
  'admin.kwu': 'Organization Administrator',
  'masego.contracts': 'Contract Manager',
  'boitumelo.chair': 'Evaluation Chair',
  'oratile.opener': 'Bid Opening Officer',
  'former.officer': 'Procurement Officer (departed)',
  'dineo.legal': 'Legal Counsel',
  'admin.odc': 'Organization Administrator',
  'officer.odc': 'Procurement Officer',
};

function entry(spec: EntrySpec): FixtureAuditEntry {
  return {
    id: spec.id,
    tenantId: tid(spec.tenant ?? 'kwu'),
    occurredAt: spec.at,
    actorUserId: spec.actor === null ? null : uid(spec.actor),
    actorCapacity: spec.capacity ?? (spec.actor === null ? null : (CAPACITY[spec.actor] ?? null)),
    onBehalfOfUserId: spec.onBehalfOf === undefined ? null : uid(spec.onBehalfOf),
    delegationId: spec.delegationId ?? null,
    supportGrantId: spec.supportGrantId ?? null,
    action: spec.action,
    entityType: spec.entity[0],
    entityId: spec.entity[1],
    reason: spec.reason ?? null,
    beforeState: spec.restricted === true ? null : (spec.before ?? null),
    afterState: spec.restricted === true ? null : (spec.after ?? null),
    correlationId: `c0ffee${String(spec.id).padStart(6, '0')}-2026-4a1b-9c3d-000000000000`.slice(0, 36),
    sensitivity: spec.restricted === true ? 'restricted' : 'normal',
  };
}

export const AUDIT_ENTRIES: readonly FixtureAuditEntry[] = Object.freeze([
  // T-2026-0005 and its invalidated release approval (AC-06; tenders/release.ts: approval 31 of revision 2)
  entry({ id: 1001, at: '2026-09-08T08:00:00Z', actor: 'tebogo.officer', action: 'tender.created', entity: ['tender', RECORDS.t5.id], after: { status: 'draft', revision: 1 } }),
  entry({ id: 1002, at: '2026-09-24T08:30:00Z', actor: 'tebogo.officer', action: 'approval.requested', entity: ['approval_request', 31], after: { subjectVersion: 2, status: 'pending', approver: 'Mpho Dikgang', estimatedValue: 'BWP 1,450,000.00' } }),
  entry({ id: 1003, at: '2026-09-25T12:10:00Z', actor: 'mpho.manager', action: 'approval.decided', entity: ['approval_request', 31], before: { status: 'pending' }, after: { status: 'approved', subjectVersion: 2 } }),
  entry({ id: 1004, at: '2026-09-28T09:12:00Z', actor: 'tebogo.officer', action: 'tender.version_created', entity: ['tender', RECORDS.t5.id], reason: 'Lot 3 — polyelectrolyte flocculant added, with requirement REQ-T-03 and its pricing schedule.', before: { revision: 2, lots: 2 }, after: { revision: 3, lots: 3 } }),
  entry({ id: 1005, at: '2026-09-28T09:14:00Z', actor: 'tebogo.officer', action: 'tender.version_created', entity: ['tender', RECORDS.t5.id], reason: 'Estimated framework value increased.', before: { revision: 3, estimatedValue: 'BWP 1,450,000.00' }, after: { revision: 3, estimatedValue: 'BWP 1,920,000.00' } }),
  entry({ id: 1006, at: '2026-09-28T09:14:01Z', actor: null, capacity: 'System (material change rule)', action: 'approval.invalidated', entity: ['approval_request', 31], reason: 'Material change in revision 3: Lot 3 added and the estimated value raised from BWP 1,450,000.00 to BWP 1,920,000.00.', before: { status: 'approved', subjectVersion: 2 }, after: { status: 'invalidated' } }),
  entry({ id: 1007, at: '2026-09-28T09:14:01Z', actor: null, capacity: 'System (material change rule)', action: 'tender.status_changed', entity: ['tender', RECORDS.t5.id], before: { releaseApproval: 'approved (revision 2)' }, after: { releaseApproval: 'required again (revision 3)' } }),
  // PR-2026-0003 routed above the manager's authority (AC-05; requests/requests.ts: approval 305)
  entry({ id: 1011, at: '2026-09-14T07:45:00Z', actor: 'kagiso.requester', action: 'request.submitted', entity: ['procurement_request', RECORDS.pr3.id], before: { status: 'draft' }, after: { status: 'submitted', estimatedValue: 'BWP 4,850,000.00', totalCommitment: 'BWP 5,120,000.00' } }),
  entry({ id: 1012, at: '2026-09-23T08:15:00Z', actor: 'mpho.manager', action: 'approval.requested', entity: ['approval_request', 305], after: { subjectVersion: 1, amount: 'BWP 5,120,000.00' } }),
  entry({ id: 1013, at: '2026-09-23T08:15:00Z', actor: 'mpho.manager', action: 'approval.step_skipped', entity: ['approval_request', 305], reason: 'Total commitment BWP 5,120,000 exceeds my BWP 2,000,000 request authority.', after: { step: 1, status: 'skipped' } }),
  entry({ id: 1014, at: '2026-09-23T08:15:05Z', actor: null, capacity: 'System (authority routing)', action: 'approval.routed', entity: ['approval_request', 305], after: { step: 2, approver: 'Keabetswe Nkwe', limit: 'BWP 10,000,000.00' } }),
  entry({ id: 1015, at: '2026-09-23T08:15:06Z', actor: null, capacity: 'System (authority routing)', action: 'request.routed', entity: ['procurement_request', RECORDS.pr3.id], after: { approver: 'Keabetswe Nkwe' } }),
  // T-2026-0008: ownership handover (AC-04) and sealed receipts (restricted, DD-31)
  entry({ id: 1021, at: '2026-09-10T08:00:00Z', actor: 'former.officer', action: 'tender.published', entity: ['tender', RECORDS.t8.id], after: { status: 'open', version: 1 } }),
  entry({ id: 1022, at: '2026-09-22T08:00:00Z', actor: 'admin.kwu', action: 'tender.owner_changed', entity: ['tender', RECORDS.t8.id], reason: 'Gaone Letsholo left the organization.', before: { owner: 'Gaone Letsholo' }, after: { owner: 'Tebogo Molefe' } }),
  entry({ id: 1023, at: '2026-09-29T13:41:00Z', actor: 'tsodilo.bidmanager', capacity: 'Tsodilo Engineering (Pty) Ltd — Bid Manager', action: 'bid.received', entity: ['tender', RECORDS.t8.id], restricted: true }),
  entry({ id: 1024, at: '2026-09-30T09:15:00Z', actor: 'chobe-pipe.bidmanager', capacity: 'Chobe Pipe & Valve Supplies — Bid Manager', action: 'bid.received', entity: ['tender', RECORDS.t8.id], restricted: true }),
  entry({ id: 1025, at: '2026-10-01T08:30:00Z', actor: 'chobe-pipe.bidmanager', capacity: 'Chobe Pipe & Valve Supplies — Bid Manager', action: 'bid.withdrawn', entity: ['tender', RECORDS.t8.id], reason: 'Withdrawn by the supplier before closing.', restricted: true }),
  entry({ id: 1026, at: '2026-09-30T10:00:00Z', actor: null, capacity: 'System (closing job)', action: 'tender.closed', entity: ['tender', RECORDS.t8.id], before: { status: 'open' }, after: { status: 'closed' } }),
  // T-2026-0002: addendum, delivery failure (BR-42) and support access (metadata only)
  entry({ id: 1031, at: '2026-09-24T08:00:00Z', actor: 'tebogo.officer', action: 'addendum.issued', entity: ['tender', RECORDS.t2.id], after: { addendum: 'Addendum 1', requirement: 'Q-05', deadlineChanged: true } }),
  entry({ id: 1032, at: '2026-09-24T08:06:40Z', actor: null, capacity: 'System (notifications)', action: 'notice.delivery_failed', entity: ['tender', RECORDS.t2.id], reason: 'Email to Chobe Pipe & Valve Supplies failed: 552 Mailbox full. The deadline is not changed by the failure.', after: { channel: 'email', exceptionTask: 114 } }),
  entry({ id: 1033, at: '2026-09-25T08:00:38Z', actor: 'chobe-pipe.bidmanager', capacity: 'Chobe Pipe & Valve Supplies — Bid Manager', action: 'submission.rejected_late', entity: ['tender', RECORDS.t8.id], reason: 'Replacement completed 38 seconds after the submission deadline; true time recorded.', after: { attemptedAt: '2026-09-25T08:00:38Z' } }),
  entry({ id: 1034, at: '2026-09-29T11:40:00Z', actor: 'support.agent', capacity: 'Platform support (read-only)', supportGrantId: 1, action: 'support.record_viewed', entity: ['tender', RECORDS.t3.id], reason: 'Support case SC-2026-0001 (evaluation assignment metadata only).' }),
  entry({ id: 1035, at: '2026-09-24T13:42:55Z', actor: 'gaborone-meter.bidmanager', capacity: 'Gaborone Metering Co. — Bid Manager', action: 'submission.replacement_failed', entity: ['tender', RECORDS.t2.id], reason: 'Upload incomplete; receipt RCPT-2026-000021 remains effective.', restricted: true }),
  // Contracts
  entry({ id: 1041, at: '2026-10-01T12:05:00Z', actor: 'masego.contracts', action: 'change_request.submitted', entity: ['contract', RECORDS.c1.id], after: { changeRequest: 'CR-0003', value: 'BWP 285,000.00', cumulative: 'BWP 430,000.00' } }),
  entry({ id: 1042, at: '2026-10-01T08:10:00Z', actor: 'masego.contracts', action: 'contract.difference_recorded', entity: ['contract', RECORDS.c2.id], before: { value: 'BWP 4,620,000.00', delivery: '12 weeks' }, after: { value: 'BWP 4,668,000.00', delivery: '16 weeks' } }),
  entry({ id: 1043, at: '2026-10-01T12:05:05Z', actor: null, capacity: 'System (authority routing)', action: 'approval.requested', entity: ['approval_request', 36], after: { approver: 'Keabetswe Nkwe', delegate: 'Mpho Dikgang' } }),
  // Administration
  entry({ id: 1051, at: '2026-09-22T07:55:00Z', actor: 'admin.kwu', action: 'user.deactivated', entity: ['user', uid('former.officer')], reason: 'Employee left the organization.', before: { status: 'active' }, after: { status: 'deactivated' } }),
  entry({ id: 1052, at: '2025-11-20T09:00:00Z', actor: 'mpho.manager', action: 'calendar.approved', entity: ['calendar', 1], before: { status: 'draft' }, after: { status: 'approved' } }),
  entry({ id: 1053, at: '2026-10-02T09:00:00Z', actor: 'mpho.manager', action: 'calendar.created', entity: ['calendar', 2], after: { name: 'Botswana Public Holidays 2027', holidays: 15 } }),
  entry({ id: 1054, at: '2026-06-12T09:00:00Z', actor: 'admin.kwu', action: 'notification_rule.updated', entity: ['notification_rule', 19], reason: 'Add a same-day reminder before approval due dates.', before: { reminderOffsetsHours: '48' }, after: { reminderOffsetsHours: '48, 8' } }),
  entry({ id: 1055, at: '2026-08-15T08:00:00Z', actor: 'admin.kwu', action: 'notification_rule.deactivated', entity: ['notification_rule', 32], reason: 'Promotional messages paused during the pilot.', before: { active: true }, after: { active: false } }),
  entry({ id: 1056, at: '2026-09-25T08:30:00Z', actor: 'tebogo.officer', action: 'document.redacted_copy_created', entity: ['document', 207], reason: 'Debrief disclosure for T-2026-0007.', after: { copy: 208, classification: 'participating_suppliers' } }),
  entry({ id: 1057, at: '2026-09-30T16:00:00Z', actor: 'keabetswe.approver', action: 'delegation.created', entity: ['user', uid('mpho.manager')], after: { delegate: 'Mpho Dikgang', decisionTypes: 'change_approval', maxAmount: 'BWP 500,000.00', until: '2026-10-20' } }),
  // ODC
  entry({ id: 1061, tenant: 'odc', at: '2026-09-21T07:00:00Z', actor: 'officer.odc', action: 'tender.published', entity: ['tender', RECORDS.t11.id], after: { status: 'open', version: 1 } }),
  entry({ id: 1062, tenant: 'odc', at: '2026-01-12T08:00:00Z', actor: 'admin.odc', action: 'calendar.approved', entity: ['calendar', 5], before: { status: 'draft' }, after: { status: 'approved' } }),
] satisfies FixtureAuditEntry[]);
