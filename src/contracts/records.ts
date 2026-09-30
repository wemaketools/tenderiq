/**
 * Records contract (domain 15): the ADM-14 audit viewer, retention classes, legal and investigation holds,
 * disposal requests and evidence packs (FR-22; PRD §13.2 ADM-14, §18; BR-38, BR-39, BR-40, BR-43; AC-35;
 * DD-11, DD-16, DD-20, DD-31).
 *
 * Rules every implementation (mock and Stage B) must honor:
 * - A legal or investigation hold whose `blocked_actions` contain `disposal` prevents disposal of every record in
 *   its scope, even after the ordinary retention period has ended (BR-40, AC-35). Approving or executing such a
 *   disposal request fails with `DISPOSAL_BLOCKED_BY_HOLD`. Releasing a hold never disposes of anything: the
 *   records return to ordinary eligibility review (PRD §18.3).
 * - A hold or a rejected disposal never deletes history; the audit trail of held records stays intact (AC-35).
 * - The audit viewer requires `audit.view`. Restricted rows (sealed content, evaluator scores) are metadata only:
 *   no before/after state (DD-31).
 * - Evidence packs are controlled exports (`exports.export_type = 'evidence_pack'`) with a manifest. Sealed
 *   content before its opening is never included; the manifest lists the omission.
 * - Personal account deletion and business-record retention are separate decisions (BR-39).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  PersonRef,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { AuditAction, AuditEntityType, AuditEntry } from './audit.js';
import { defineEndpoint } from './endpoint.js';
import {
  APPROVAL_REQUESTS_STATUS,
  AuditLogSensitivity,
  DISPOSAL_REQUESTS_STATUS,
  DOCUMENTS_CLASSIFICATION,
  EXPORTS_FORMAT,
  HOLDS_BLOCKED_ACTIONS,
  HOLDS_SUBJECT_TYPE,
  RETENTION_CLASSES_DISPOSITION,
  RETENTION_CLASSES_RECORD_CLASS,
  RETENTION_CLASSES_TRIGGER_EVENT,
} from './enums.js';
import { ExportRecord } from './reporting.js';

// ---------------------------------------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------------------------------------

/** Hold types managed as records holds on ADM-14 (a subset of `holds.hold_type`). */
export const RECORDS_HOLD_TYPES = ['legal_hold', 'investigation_hold'] as const;
export const RecordsHoldType = z.enum(RECORDS_HOLD_TYPES);
export type RecordsHoldType = (typeof RECORDS_HOLD_TYPES)[number];

/** The derived state of a hold (`released_at` null or not). */
export const HOLD_STATES = ['active', 'released'] as const;
export const HoldState = z.enum(HOLD_STATES);
export type HoldState = (typeof HOLD_STATES)[number];

/** Whether an audit row is a business action or an access event (downloads, exports, support access). */
export const AUDIT_EVENT_CATEGORIES = ['business_action', 'access_event'] as const;
export const AuditEventCategory = z.enum(AUDIT_EVENT_CATEGORIES);
export type AuditEventCategory = (typeof AUDIT_EVENT_CATEGORIES)[number];

/** Records a hold, an evidence pack or a lookup can target. */
export const RECORD_SUBJECT_TYPES = ['tender', 'lot', 'contract', 'qualification_application', 'complaint', 'record_class'] as const;
export const RecordSubjectType = z.enum(RECORD_SUBJECT_TYPES);
export type RecordSubjectType = (typeof RECORD_SUBJECT_TYPES)[number];

/** Records an evidence pack can be assembled for. */
export const EVIDENCE_PACK_SUBJECT_TYPES = ['tender', 'contract', 'complaint', 'qualification_application'] as const;
export const EvidencePackSubjectType = z.enum(EVIDENCE_PACK_SUBJECT_TYPES);
export type EvidencePackSubjectType = (typeof EVIDENCE_PACK_SUBJECT_TYPES)[number];

const RecordClass = z.enum(RETENTION_CLASSES_RECORD_CLASS);

/** Permissions that open the ADM-14 workspace (any of them). */
const RECORDS_READ = ['audit.view', 'records.retention.manage', 'records.hold.manage', 'records.disposal.approve'] as const;

// ---------------------------------------------------------------------------------------------------------
// ADM-14 summary
// ---------------------------------------------------------------------------------------------------------

/** Each block is `null` when the caller lacks the permission behind it (no counts leak, BR-43). */
export const RecordsSummary = z.object({
  asOf: Instant,
  audit: z
    .object({
      eventsLast30Days: z.number().int().min(0),
      restrictedEventsLast30Days: z.number().int().min(0),
      accessEventsLast30Days: z.number().int().min(0),
    })
    .nullable(),
  retention: z
    .object({
      classes: z.number().int().min(0),
      recordsPastRetention: z.number().int().min(0),
    })
    .nullable(),
  holds: z
    .object({
      active: z.number().int().min(0),
      reviewDueWithin30Days: z.number().int().min(0),
      heldRecords: z.number().int().min(0),
    })
    .nullable(),
  disposals: z
    .object({
      proposed: z.number().int().min(0),
      blocked: z.number().int().min(0),
      approved: z.number().int().min(0),
      executed: z.number().int().min(0),
    })
    .nullable(),
  evidencePacks: z
    .object({
      ready: z.number().int().min(0),
      inProgress: z.number().int().min(0),
    })
    .nullable(),
});
export type RecordsSummary = z.infer<typeof RecordsSummary>;

export const getRecordsSummary = defineEndpoint({
  id: 'buyer.records.summary',
  method: 'GET',
  path: '/api/v1/buyer/records/summary',
  audience: 'buyer',
  permission: [...RECORDS_READ, 'export.create'],
  response: RecordsSummary,
  errors: [],
  screens: ['ADM-14'],
});

// ---------------------------------------------------------------------------------------------------------
// Audit viewer
// ---------------------------------------------------------------------------------------------------------

export const RecordAuditEvent = AuditEntry.extend({
  category: AuditEventCategory,
  entityLabel: z.string().nullable(),
  entityReference: z.string().nullable(),
  /** Document classification for access events on documents (PRD §18.1). */
  classification: z.enum(DOCUMENTS_CLASSIFICATION).nullable(),
  retentionClass: RecordClass.nullable(),
  /** The record is under an active records hold. */
  underHold: z.boolean(),
  to: LinkPath.nullable(),
});
export type RecordAuditEvent = z.infer<typeof RecordAuditEvent>;

export const AUDIT_EVENT_SORT_FIELDS = ['occurredAt', 'action', 'entityType'] as const;

export const AuditEventQuery = listQueryWithSort(AUDIT_EVENT_SORT_FIELDS).extend({
  category: queryList(AuditEventCategory).optional(),
  action: queryList(AuditAction).optional(),
  entityType: queryList(AuditEntityType).optional(),
  entityId: IdParam.optional(),
  actorUserId: IdParam.optional(),
  sensitivity: queryList(AuditLogSensitivity).optional(),
  from: CalendarDate.optional(),
  to: CalendarDate.optional(),
});
export type AuditEventQuery = z.input<typeof AuditEventQuery>;

export const listAuditEvents = defineEndpoint({
  id: 'buyer.records.auditEvents',
  method: 'GET',
  path: '/api/v1/buyer/records/audit-events',
  audience: 'buyer',
  permission: 'audit.view',
  query: AuditEventQuery,
  response: pageOf(RecordAuditEvent),
  errors: ['INVALID_DATE_RANGE'],
  screens: ['ADM-14'],
  summary: 'Business actions and access events of the active buyer. Restricted rows are metadata only (DD-31).',
});

// ---------------------------------------------------------------------------------------------------------
// Retention classes
// ---------------------------------------------------------------------------------------------------------

export const RetentionClass = z.object({
  id: Id,
  recordClass: RecordClass,
  triggerEvent: z.enum(RETENTION_CLASSES_TRIGGER_EVENT),
  durationMonths: z.number().int().min(1),
  owner: PersonRef,
  disposition: z.enum(RETENTION_CLASSES_DISPOSITION),
  approvedBy: PersonRef.nullable(),
  purpose: z.string().min(1),
  updatedAt: Instant,
  stats: z.object({
    recordsInScope: z.number().int().min(0),
    pastRetention: z.number().int().min(0),
    heldRecords: z.number().int().min(0),
    disposalBlocked: z.number().int().min(0),
  }),
});
export type RetentionClass = z.infer<typeof RetentionClass>;

export const RetentionClassListQuery = listQueryWithSort(['recordClass', 'durationMonths'] as const).extend({
  disposition: queryList(z.enum(RETENTION_CLASSES_DISPOSITION)).optional(),
  ownerUserId: IdParam.optional(),
});
export type RetentionClassListQuery = z.input<typeof RetentionClassListQuery>;

export const listRetentionClasses = defineEndpoint({
  id: 'buyer.records.retentionClasses.list',
  method: 'GET',
  path: '/api/v1/buyer/records/retention-classes',
  audience: 'buyer',
  permission: [...RECORDS_READ],
  query: RetentionClassListQuery,
  response: pageOf(RetentionClass),
  errors: [],
  screens: ['ADM-14'],
});

export const RetentionClassParams = z.object({ retentionClassId: IdParam });

export const UpdateRetentionClassBody = z.object({
  triggerEvent: z.enum(RETENTION_CLASSES_TRIGGER_EVENT),
  durationMonths: z
    .number()
    .int(issue('INVALID_DURATION', 'Use whole months.'))
    .min(1, issue('INVALID_DURATION', 'At least 1 month.'))
    .max(1200, issue('INVALID_DURATION', 'At most 1200 months.')),
  ownerUserId: Id,
  disposition: z.enum(RETENTION_CLASSES_DISPOSITION),
  purpose: z
    .string()
    .trim()
    .min(10, issue('PURPOSE_REQUIRED', 'State the retention purpose (at least 10 characters).'))
    .max(1000, issue('TEXT_TOO_LONG', 'At most 1000 characters.')),
  reason: ReasonText,
});
export type UpdateRetentionClassBody = z.infer<typeof UpdateRetentionClassBody>;

export const updateRetentionClass = defineEndpoint({
  id: 'buyer.records.retentionClasses.update',
  method: 'PUT',
  path: '/api/v1/buyer/records/retention-classes/:retentionClassId',
  audience: 'buyer',
  permission: 'records.retention.manage',
  params: RetentionClassParams,
  body: UpdateRetentionClassBody,
  response: RetentionClass,
  errors: ['OWNER_NOT_ELIGIBLE', 'RETENTION_SHORTER_THAN_LIVE_OBLIGATIONS'],
  screens: ['ADM-14'],
  summary: 'Changes a retention schedule prospectively; records already under a hold stay held.',
});

// ---------------------------------------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------------------------------------

export const Hold = z.object({
  id: Id,
  subjectType: z.enum(HOLDS_SUBJECT_TYPE),
  subjectId: Id,
  subjectLabel: z.string().min(1),
  subjectReference: z.string().nullable(),
  holdType: RecordsHoldType,
  state: HoldState,
  reason: z.string().min(1),
  owner: PersonRef,
  authorityNote: z.string().min(1),
  blockedActions: z.array(z.enum(HOLDS_BLOCKED_ACTIONS)),
  scopeDescription: z.string().min(1),
  startedAt: Instant,
  reviewDate: CalendarDate,
  /** The review date has passed or falls within 30 days of `asOf`. */
  reviewDue: z.boolean(),
  releasedAt: Instant.nullable(),
  releasedBy: PersonRef.nullable(),
  releaseReason: z.string().nullable(),
  affectedRecordCount: z.number().int().min(0),
  blockedDisposalCount: z.number().int().min(0),
});
export type Hold = z.infer<typeof Hold>;

export const HeldRecord = z.object({
  entityType: z.string().min(1),
  entityId: Id,
  label: z.string().min(1),
  reference: z.string().nullable(),
  recordClass: RecordClass,
  retentionEndedOn: CalendarDate.nullable(),
  /** True when the ordinary retention period has ended; the hold still prevents disposal (BR-40). */
  pastRetention: z.boolean(),
  to: LinkPath.nullable(),
});
export type HeldRecord = z.infer<typeof HeldRecord>;

export const HoldHistoryEntry = z.object({
  at: Instant,
  action: z.string().min(1),
  actor: PersonRef.nullable(),
  note: z.string().nullable(),
});

export const DisposalRequestRow = z.object({
  id: Id,
  recordClass: RecordClass,
  entityType: z.string().min(1),
  entityCount: z.number().int().min(0),
  scopeLabel: z.string().min(1),
  status: z.enum(DISPOSAL_REQUESTS_STATUS),
  disposition: z.enum(RETENTION_CLASSES_DISPOSITION),
  eligibilityCheckedAt: Instant,
  blockedByHoldIds: z.array(Id),
  proposedAt: Instant,
});
export type DisposalRequestRow = z.infer<typeof DisposalRequestRow>;

export const HoldDetail = Hold.extend({
  affectedRecords: z.array(HeldRecord),
  blockedDisposals: z.array(DisposalRequestRow),
  history: z.array(HoldHistoryEntry),
});
export type HoldDetail = z.infer<typeof HoldDetail>;

export const HOLD_SORT_FIELDS = ['startedAt', 'reviewDate', 'holdType'] as const;

export const HoldListQuery = listQueryWithSort(HOLD_SORT_FIELDS).extend({
  holdType: queryList(RecordsHoldType).optional(),
  state: queryList(HoldState).optional(),
  subjectType: queryList(z.enum(HOLDS_SUBJECT_TYPE)).optional(),
  ownerUserId: IdParam.optional(),
  startedFrom: CalendarDate.optional(),
  startedTo: CalendarDate.optional(),
});
export type HoldListQuery = z.input<typeof HoldListQuery>;

export const listHolds = defineEndpoint({
  id: 'buyer.records.holds.list',
  method: 'GET',
  path: '/api/v1/buyer/records/holds',
  audience: 'buyer',
  permission: [...RECORDS_READ],
  query: HoldListQuery,
  response: pageOf(Hold),
  errors: [],
  screens: ['ADM-14'],
});

export const HoldParams = z.object({ holdId: IdParam });

export const getHold = defineEndpoint({
  id: 'buyer.records.holds.get',
  method: 'GET',
  path: '/api/v1/buyer/records/holds/:holdId',
  audience: 'buyer',
  permission: [...RECORDS_READ],
  params: HoldParams,
  response: HoldDetail,
  errors: [],
  screens: ['ADM-14'],
});

export const CreateHoldBody = z.object({
  subjectType: z.enum(HOLDS_SUBJECT_TYPE),
  subjectId: Id,
  holdType: RecordsHoldType,
  reason: ReasonText,
  authorityNote: z
    .string()
    .trim()
    .min(3, issue('AUTHORITY_REQUIRED', 'Name the authority for the hold.'))
    .max(1000, issue('TEXT_TOO_LONG', 'At most 1000 characters.')),
  scopeDescription: z
    .string()
    .trim()
    .min(3, issue('SCOPE_REQUIRED', 'Describe the records in scope.'))
    .max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')),
  reviewDate: CalendarDate,
  blockedActions: z
    .array(z.enum(HOLDS_BLOCKED_ACTIONS))
    .min(1, issue('BLOCKED_ACTIONS_REQUIRED', 'Select at least one blocked action.'))
    .refine((actions) => actions.includes('disposal'), issue('HOLD_MUST_BLOCK_DISPOSAL', 'A records hold must block disposal.')),
});
export type CreateHoldBody = z.infer<typeof CreateHoldBody>;

export const createHold = defineEndpoint({
  id: 'buyer.records.holds.create',
  method: 'POST',
  path: '/api/v1/buyer/records/holds',
  audience: 'buyer',
  permission: 'records.hold.manage',
  body: CreateHoldBody,
  response: HoldDetail,
  status: 201,
  idempotent: true,
  errors: ['HOLD_SUBJECT_NOT_FOUND', 'HOLD_ALREADY_ACTIVE', 'REVIEW_DATE_IN_PAST'],
  screens: ['ADM-14'],
  summary: 'Imposes a legal or investigation hold. Disposal of every record in scope is blocked from now on (BR-40).',
});

export const ReleaseHoldBody = z.object({ reason: ReasonText });

export const releaseHold = defineEndpoint({
  id: 'buyer.records.holds.release',
  method: 'POST',
  path: '/api/v1/buyer/records/holds/:holdId/release',
  audience: 'buyer',
  permission: 'records.hold.manage',
  params: HoldParams,
  body: ReleaseHoldBody,
  response: HoldDetail,
  errors: ['HOLD_ALREADY_RELEASED'],
  screens: ['ADM-14'],
  summary: 'Releases a hold. Nothing is disposed of: the records return to ordinary eligibility review (PRD §18.3).',
});

// ---------------------------------------------------------------------------------------------------------
// Disposal requests
// ---------------------------------------------------------------------------------------------------------

export const DisposalEntity = z.object({
  entityId: Id,
  label: z.string().min(1),
  reference: z.string().nullable(),
  retentionEndedOn: CalendarDate,
  to: LinkPath.nullable(),
});
export type DisposalEntity = z.infer<typeof DisposalEntity>;

export const DisposalBlockingHold = z.object({
  holdId: Id,
  holdType: RecordsHoldType,
  reason: z.string().min(1),
  reviewDate: CalendarDate,
  owner: PersonRef,
});

export const DisposalRequest = DisposalRequestRow.extend({
  entities: z.array(DisposalEntity),
  blockingHolds: z.array(DisposalBlockingHold),
  approval: z
    .object({
      approvalRequestId: Id,
      status: z.enum(APPROVAL_REQUESTS_STATUS),
      decidedBy: PersonRef.nullable(),
      decidedAt: Instant.nullable(),
      reason: z.string().nullable(),
    })
    .nullable(),
  /** The retained disposition record once executed (PRD §18.3). */
  dispositionRecord: z.string().nullable(),
  executedAt: Instant.nullable(),
  eligibilityNote: z.string().min(1),
});
export type DisposalRequest = z.infer<typeof DisposalRequest>;

export const DISPOSAL_SORT_FIELDS = ['proposedAt', 'status', 'recordClass'] as const;

export const DisposalListQuery = listQueryWithSort(DISPOSAL_SORT_FIELDS).extend({
  status: queryList(z.enum(DISPOSAL_REQUESTS_STATUS)).optional(),
  recordClass: queryList(RecordClass).optional(),
  from: CalendarDate.optional(),
  to: CalendarDate.optional(),
});
export type DisposalListQuery = z.input<typeof DisposalListQuery>;

export const listDisposalRequests = defineEndpoint({
  id: 'buyer.records.disposals.list',
  method: 'GET',
  path: '/api/v1/buyer/records/disposal-requests',
  audience: 'buyer',
  permission: [...RECORDS_READ],
  query: DisposalListQuery,
  response: pageOf(DisposalRequestRow),
  errors: [],
  screens: ['ADM-14'],
});

export const DisposalParams = z.object({ disposalRequestId: IdParam });

export const getDisposalRequest = defineEndpoint({
  id: 'buyer.records.disposals.get',
  method: 'GET',
  path: '/api/v1/buyer/records/disposal-requests/:disposalRequestId',
  audience: 'buyer',
  permission: [...RECORDS_READ],
  params: DisposalParams,
  response: DisposalRequest,
  errors: [],
  screens: ['ADM-14'],
});

export const DisposalDecisionBody = z.object({
  reason: ReasonText,
  /** The approver confirms the records are eligible and not needed for a live contract, dispute or complaint. */
  confirmEligibility: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the eligibility review.') }),
});

export const approveDisposalRequest = defineEndpoint({
  id: 'buyer.records.disposals.approve',
  method: 'POST',
  path: '/api/v1/buyer/records/disposal-requests/:disposalRequestId/approve',
  audience: 'buyer',
  permission: 'records.disposal.approve',
  params: DisposalParams,
  body: DisposalDecisionBody,
  response: DisposalRequest,
  errors: ['DISPOSAL_BLOCKED_BY_HOLD', 'DISPOSAL_ALREADY_DECIDED', 'DISPOSAL_NOT_ELIGIBLE'],
  screens: ['ADM-14'],
  summary: 'Approves permitted disposal. A request blocked by a hold cannot be approved (BR-40, AC-35).',
});

export const RejectDisposalBody = z.object({ reason: ReasonText });

export const rejectDisposalRequest = defineEndpoint({
  id: 'buyer.records.disposals.reject',
  method: 'POST',
  path: '/api/v1/buyer/records/disposal-requests/:disposalRequestId/reject',
  audience: 'buyer',
  permission: 'records.disposal.approve',
  params: DisposalParams,
  body: RejectDisposalBody,
  response: DisposalRequest,
  errors: ['DISPOSAL_ALREADY_DECIDED'],
  screens: ['ADM-14'],
  summary: 'Rejects a disposal request; the records are retained and their history is untouched.',
});

export const ExecuteDisposalBody = z.object({
  dispositionRecord: z
    .string()
    .trim()
    .min(10, issue('DISPOSITION_RECORD_REQUIRED', 'Describe the disposition (at least 10 characters).'))
    .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
});

export const executeDisposalRequest = defineEndpoint({
  id: 'buyer.records.disposals.execute',
  method: 'POST',
  path: '/api/v1/buyer/records/disposal-requests/:disposalRequestId/execute',
  audience: 'buyer',
  permission: 'records.disposal.approve',
  params: DisposalParams,
  body: ExecuteDisposalBody,
  response: DisposalRequest,
  errors: ['DISPOSAL_BLOCKED_BY_HOLD', 'DISPOSAL_NOT_APPROVED'],
  screens: ['ADM-14'],
  summary: 'Records the approved disposal with a retained disposition record. Holds are re-checked first.',
});

// ---------------------------------------------------------------------------------------------------------
// Evidence packs
// ---------------------------------------------------------------------------------------------------------

export const EvidencePackListQuery = listQueryWithSort(['requestedAt', 'status'] as const).extend({
  subjectType: queryList(EvidencePackSubjectType).optional(),
  from: CalendarDate.optional(),
  to: CalendarDate.optional(),
});
export type EvidencePackListQuery = z.input<typeof EvidencePackListQuery>;

export const listEvidencePacks = defineEndpoint({
  id: 'buyer.records.evidencePacks.list',
  method: 'GET',
  path: '/api/v1/buyer/records/evidence-packs',
  audience: 'buyer',
  permission: ['audit.view', 'export.create'],
  query: EvidencePackListQuery,
  response: pageOf(ExportRecord),
  errors: [],
  screens: ['ADM-14'],
});

export const CreateEvidencePackBody = z.object({
  subjectType: EvidencePackSubjectType,
  subjectId: Id,
  purpose: ReasonText,
  includeAuditTrail: z.boolean(),
  /** Restricted audit rows are included as metadata only, and only for audit.view holders (DD-31). */
  includeRestrictedMetadata: z.boolean(),
  format: z.enum(EXPORTS_FORMAT),
});
export type CreateEvidencePackBody = z.infer<typeof CreateEvidencePackBody>;

export const createEvidencePack = defineEndpoint({
  id: 'buyer.records.evidencePacks.create',
  method: 'POST',
  path: '/api/v1/buyer/records/evidence-packs',
  audience: 'buyer',
  permission: 'export.create',
  body: CreateEvidencePackBody,
  response: ExportRecord,
  status: 201,
  idempotent: true,
  errors: ['EVIDENCE_SUBJECT_NOT_FOUND', 'RESTRICTED_METADATA_REQUIRES_AUDIT_VIEW'],
  screens: ['ADM-14'],
  summary: 'Authorizes an evidence pack for one record; sealed content before opening is omitted and listed in the manifest.',
});

// ---------------------------------------------------------------------------------------------------------
// Record lookup (hold and evidence-pack targets)
// ---------------------------------------------------------------------------------------------------------

export const RecordSubject = z.object({
  subjectType: RecordSubjectType,
  subjectId: Id,
  label: z.string().min(1),
  reference: z.string().nullable(),
  recordClass: RecordClass,
  underHold: z.boolean(),
  pastRetention: z.boolean(),
});
export type RecordSubject = z.infer<typeof RecordSubject>;

export const RecordSubjectQuery = listQueryWithSort(['label', 'reference'] as const).extend({
  subjectType: queryList(RecordSubjectType).optional(),
});
export type RecordSubjectQuery = z.input<typeof RecordSubjectQuery>;

export const listRecordSubjects = defineEndpoint({
  id: 'buyer.records.subjects',
  method: 'GET',
  path: '/api/v1/buyer/records/subjects',
  audience: 'buyer',
  permission: ['records.hold.manage', 'export.create', 'audit.view'],
  query: RecordSubjectQuery,
  response: pageOf(RecordSubject),
  errors: [],
  screens: ['ADM-14'],
});

// ---------------------------------------------------------------------------------------------------------
// Endpoint map
// ---------------------------------------------------------------------------------------------------------

/** The records endpoint map. */
export const recordsEndpoints = {
  getRecordsSummary,
  listAuditEvents,
  listRetentionClasses,
  updateRetentionClass,
  listHolds,
  getHold,
  createHold,
  releaseHold,
  listDisposalRequests,
  getDisposalRequest,
  approveDisposalRequest,
  rejectDisposalRequest,
  executeDisposalRequest,
  listEvidencePacks,
  createEvidencePack,
  listRecordSubjects,
} as const;
