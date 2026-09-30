/**
 * Records fixtures (domain 15, ADM-14): retention classes, legal and investigation holds with the records they
 * hold, disposal requests, the audit trail and the record lookup (PRD §18; BR-38..BR-40; AC-35; DD-20, DD-31).
 *
 * AC-35: the imported legacy tender T-2025-0003 closed on 30 Nov 2018; its tender, bid and evaluation records
 * passed their 84-month retention on 30 Nov 2025. Legal hold 1 (imposed 14 Aug 2026) blocks disposal, so disposal
 * requests 1 and 2 are `blocked` and cannot be approved or executed. The audit trail of those records stays intact.
 * Hold 3 was released: its records went back to ordinary review and disposal request 3 is `proposed`.
 *
 * Only KWU has records staff in the demo (Okavango District Council has no persona with a records permission).
 */
import type { AuditLogSensitivity, DisposalRequestsStatus, DocumentsClassification, HoldsBlockedActions, HoldsSubjectType, RetentionClassesDisposition, RetentionClassesRecordClass, RetentionClassesTriggerEvent } from '../../../contracts/enums.js';
import type { JsonObject } from '../../../contracts/common.js';
import type { AuditEventCategory, RecordSubjectType, RecordsHoldType } from '../../../contracts/records.js';
import { KWU, LEGACY_CONTRACT_ID, LEGACY_TENDER_ID, LINKS, USERS, lotLabel } from '../reporting/storyline.js';

// ---------------------------------------------------------------------------------------------------------
// Retention classes
// ---------------------------------------------------------------------------------------------------------

export interface FixtureRetentionClass {
  readonly id: number;
  readonly tenantId: number;
  readonly recordClass: RetentionClassesRecordClass;
  readonly triggerEvent: RetentionClassesTriggerEvent;
  readonly durationMonths: number;
  readonly ownerUserId: number;
  readonly disposition: RetentionClassesDisposition;
  readonly approvedBy: number | null;
  readonly purpose: string;
  readonly updatedAt: string;
  readonly recordsInScope: number;
  readonly pastRetention: number;
  readonly heldRecords: number;
  readonly disposalBlocked: number;
}

export const RETENTION_CLASSES: readonly FixtureRetentionClass[] = [
  { id: 1, tenantId: KWU, recordClass: 'tender', triggerEvent: 'event_closed', durationMonths: 84, ownerUserId: USERS.mpho, disposition: 'review', approvedBy: USERS.keabetswe, purpose: 'Reconstruct issued conditions and decisions of each procurement event (PRD §18.2).', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 12, pastRetention: 1, heldRecords: 1, disposalBlocked: 1 },
  { id: 2, tenantId: KWU, recordClass: 'bid', triggerEvent: 'event_closed', durationMonths: 84, ownerUserId: USERS.mpho, disposition: 'destroy', approvedBy: USERS.keabetswe, purpose: 'Keep effective responses and receipts for challenges and audits.', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 46, pastRetention: 3, heldRecords: 3, disposalBlocked: 3 },
  { id: 3, tenantId: KWU, recordClass: 'financial_evidence', triggerEvent: 'event_closed', durationMonths: 60, ownerUserId: USERS.lesego, disposition: 'destroy', approvedBy: USERS.keabetswe, purpose: 'Supplier financial statements collected for qualification and award only.', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 31, pastRetention: 0, heldRecords: 0, disposalBlocked: 0 },
  { id: 4, tenantId: KWU, recordClass: 'communication', triggerEvent: 'record_created', durationMonths: 60, ownerUserId: USERS.tebogo, disposition: 'destroy', approvedBy: USERS.keabetswe, purpose: 'Official procurement correspondence and notices.', updatedAt: '2026-06-30T12:00:00Z', recordsInScope: 812, pastRetention: 48, heldRecords: 6, disposalBlocked: 0 },
  { id: 5, tenantId: KWU, recordClass: 'evaluation', triggerEvent: 'event_closed', durationMonths: 84, ownerUserId: USERS.boitumelo, disposition: 'archive', approvedBy: USERS.keabetswe, purpose: 'Individual assessments and moderation, preserved together (BR-27).', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 58, pastRetention: 1, heldRecords: 1, disposalBlocked: 0 },
  { id: 6, tenantId: KWU, recordClass: 'contract', triggerEvent: 'contract_closed', durationMonths: 120, ownerUserId: USERS.masego, disposition: 'archive', approvedBy: USERS.keabetswe, purpose: 'Contracts, changes, performance and closeout for the contract life plus limitation periods.', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 3, pastRetention: 0, heldRecords: 1, disposalBlocked: 0 },
  { id: 7, tenantId: KWU, recordClass: 'complaint', triggerEvent: 'complaint_closed', durationMonths: 120, ownerUserId: USERS.dineo, disposition: 'review', approvedBy: USERS.keabetswe, purpose: 'Complaints, responses and appeals for the full appeal and limitation period.', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 2, pastRetention: 0, heldRecords: 0, disposalBlocked: 0 },
  { id: 8, tenantId: KWU, recordClass: 'personal_account', triggerEvent: 'account_deactivated', durationMonths: 24, ownerUserId: USERS.adminKwu, disposition: 'destroy', approvedBy: USERS.keabetswe, purpose: 'Personal account data only; formal approvals and submissions stay in the business record (BR-38, BR-39).', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 4, pastRetention: 2, heldRecords: 0, disposalBlocked: 0 },
  { id: 9, tenantId: KWU, recordClass: 'audit', triggerEvent: 'record_created', durationMonths: 120, ownerUserId: USERS.pule, disposition: 'archive', approvedBy: USERS.keabetswe, purpose: 'Audit trail of actions and access events (PRD §18.2).', updatedAt: '2026-02-10T09:00:00Z', recordsInScope: 18420, pastRetention: 0, heldRecords: 6, disposalBlocked: 0 },
];

// ---------------------------------------------------------------------------------------------------------
// Record subjects (lookup targets for holds and evidence packs)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureRecordSubject {
  readonly tenantId: number;
  readonly subjectType: RecordSubjectType;
  readonly subjectId: number;
  readonly label: string;
  readonly reference: string | null;
  readonly recordClass: RetentionClassesRecordClass;
  readonly pastRetention: boolean;
  readonly to: string | null;
  /** The subject holds sealed content before its opening (evidence packs omit it). */
  readonly sealedBeforeOpening: boolean;
}

export const RECORD_SUBJECTS: readonly FixtureRecordSubject[] = [
  { tenantId: KWU, subjectType: 'tender', subjectId: 1, label: 'Borehole pump replacement programme', reference: 'T-2026-0001', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(1), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'lot', subjectId: 103, label: `T-2026-0001 ${lotLabel(1, 103)}`, reference: 'T-2026-0001', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(1), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'tender', subjectId: 2, label: 'Smart water meter supply', reference: 'T-2026-0002', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(2), sealedBeforeOpening: true },
  { tenantId: KWU, subjectType: 'tender', subjectId: 3, label: 'SCADA telemetry upgrade', reference: 'T-2026-0003', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(3), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'tender', subjectId: 7, label: 'Reservoir rehabilitation works', reference: 'T-2026-0007', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(7), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'tender', subjectId: 8, label: 'Pipeline valves bulk supply', reference: 'T-2026-0008', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(8), sealedBeforeOpening: true },
  { tenantId: KWU, subjectType: 'tender', subjectId: 9, label: 'Acoustic leak detection services', reference: 'T-2026-0009', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(9), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'tender', subjectId: 10, label: 'Fleet vehicle maintenance', reference: 'T-2026-0010', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(10), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'tender', subjectId: LEGACY_TENDER_ID, label: 'Maun wellfield pump supply (legacy import, 2018)', reference: 'T-2025-0003', recordClass: 'tender', pastRetention: true, to: LINKS.auditTrail('tender', LEGACY_TENDER_ID), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'tender', subjectId: 12, label: 'Treatment works electrical maintenance', reference: 'T-2026-0012', recordClass: 'tender', pastRetention: false, to: LINKS.buyerTender(12), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'contract', subjectId: 1, label: 'Fleet vehicle maintenance', reference: 'C-2026-0001', recordClass: 'contract', pastRetention: false, to: LINKS.buyerContract(1), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'contract', subjectId: 2, label: 'Borehole pumps Lot 1: supply and installation', reference: 'C-2026-0002', recordClass: 'contract', pastRetention: false, to: LINKS.buyerContract(2), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'contract', subjectId: LEGACY_CONTRACT_ID, label: 'Legacy meter reading services (imported)', reference: 'C-2025-0007', recordClass: 'contract', pastRetention: false, to: LINKS.buyerContract(LEGACY_CONTRACT_ID), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'contract', subjectId: 6, label: 'Network valve maintenance call-out services', reference: 'C-2025-0005', recordClass: 'contract', pastRetention: false, to: LINKS.buyerContract(6), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'complaint', subjectId: 92, label: 'Complaint by Limpopo Environmental Services — T-2026-0007', reference: 'CMP-2026-0002', recordClass: 'complaint', pastRetention: false, to: LINKS.buyerComplaint(92), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'complaint', subjectId: 91, label: 'Complaint by Chobe Pipe & Valve Supplies — T-2026-0001 Lot 1', reference: 'CMP-2026-0001', recordClass: 'complaint', pastRetention: false, to: LINKS.buyerComplaint(91), sealedBeforeOpening: false },
  { tenantId: KWU, subjectType: 'complaint', subjectId: 94, label: 'Complaint by Gaborone Metering Co. — T-2026-0002', reference: 'CMP-2026-0003', recordClass: 'complaint', pastRetention: false, to: LINKS.buyerComplaint(94), sealedBeforeOpening: true },
  { tenantId: KWU, subjectType: 'qualification_application', subjectId: 503, label: 'Makgadikgadi Civil Works — Water Infrastructure Suppliers', reference: 'QA-2026-0006', recordClass: 'financial_evidence', pastRetention: false, to: LINKS.buyerQualification(503), sealedBeforeOpening: false },
  ...RETENTION_CLASSES.map(
    (row): FixtureRecordSubject => ({
      tenantId: row.tenantId,
      subjectType: 'record_class',
      subjectId: row.id,
      label: `All ${row.recordClass.replace(/_/g, ' ')} records`,
      reference: null,
      recordClass: row.recordClass,
      pastRetention: row.pastRetention > 0,
      to: null,
      sealedBeforeOpening: false,
    }),
  ),
];

// ---------------------------------------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------------------------------------

export interface FixtureHeldRecord {
  readonly entityType: string;
  readonly entityId: number;
  readonly label: string;
  readonly reference: string | null;
  readonly recordClass: RetentionClassesRecordClass;
  readonly retentionEndedOn: string | null;
  readonly to: string | null;
}

export interface FixtureHold {
  readonly id: number;
  readonly tenantId: number;
  readonly subjectType: HoldsSubjectType;
  readonly subjectId: number;
  readonly subjectLabel: string;
  readonly subjectReference: string | null;
  readonly holdType: RecordsHoldType;
  readonly reason: string;
  readonly ownerUserId: number;
  readonly authorityNote: string;
  readonly blockedActions: readonly HoldsBlockedActions[];
  readonly scopeDescription: string;
  readonly startedAt: string;
  readonly reviewDate: string;
  readonly releasedAt: string | null;
  readonly releasedBy: number | null;
  readonly releaseReason: string | null;
  readonly records: readonly FixtureHeldRecord[];
  readonly history: ReadonlyArray<{ readonly at: string; readonly action: string; readonly actor: number | null; readonly note: string | null }>;
}

export const HOLDS: readonly FixtureHold[] = [
  {
    id: 1,
    tenantId: KWU,
    subjectType: 'tender',
    subjectId: LEGACY_TENDER_ID,
    subjectLabel: 'Maun wellfield pump supply (legacy import, 2018)',
    subjectReference: 'T-2025-0003',
    holdType: 'legal_hold',
    reason: 'Civil claim by a former bidder concerning the 2018 pump supply award; the records are evidence in the proceedings.',
    ownerUserId: USERS.dineo,
    authorityNote: 'Instruction of the Legal Counsel under the KWU Records Policy §7, 14 Aug 2026.',
    blockedActions: ['disposal'],
    scopeDescription: 'All tender, bid, evaluation and correspondence records of T-2025-0003, including the imported legacy files.',
    startedAt: '2026-08-14T09:30:00Z',
    reviewDate: '2027-02-14',
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    records: [
      { entityType: 'tender', entityId: LEGACY_TENDER_ID, label: 'Tender record and notice', reference: 'T-2025-0003', recordClass: 'tender', retentionEndedOn: '2025-11-30', to: LINKS.auditTrail('tender', LEGACY_TENDER_ID) },
      { entityType: 'bid_revision', entityId: 1201, label: 'Bid — Kweneng Borehole Services', reference: 'T-2025-0003', recordClass: 'bid', retentionEndedOn: '2025-11-30', to: null },
      { entityType: 'bid_revision', entityId: 1202, label: 'Bid — Tsodilo Engineering', reference: 'T-2025-0003', recordClass: 'bid', retentionEndedOn: '2025-11-30', to: null },
      { entityType: 'bid_revision', entityId: 1203, label: 'Bid — Maun Mechanical Works', reference: 'T-2025-0003', recordClass: 'bid', retentionEndedOn: '2025-11-30', to: null },
      { entityType: 'evaluation_report', entityId: 1210, label: 'Evaluation report (2018)', reference: 'T-2025-0003', recordClass: 'evaluation', retentionEndedOn: '2025-11-30', to: null },
      { entityType: 'communication', entityId: 1220, label: 'Award correspondence bundle (6 letters)', reference: 'T-2025-0003', recordClass: 'communication', retentionEndedOn: '2023-11-30', to: null },
    ],
    history: [
      { at: '2026-08-14T09:30:00Z', action: 'Hold imposed', actor: USERS.dineo, note: 'Disposal of every record in scope blocked.' },
      { at: '2026-08-15T09:07:31Z', action: 'Evidence pack produced', actor: USERS.pule, note: 'Export 7 (HTML) with manifest.' },
      { at: '2026-09-06T04:00:00Z', action: 'Disposal requests blocked', actor: null, note: 'The weekly retention-eligibility check found expired records under this hold (requests 1 and 2).' },
    ],
  },
  {
    id: 2,
    tenantId: KWU,
    subjectType: 'contract',
    subjectId: LEGACY_CONTRACT_ID,
    subjectLabel: 'Legacy meter reading services (imported)',
    subjectReference: 'C-2025-0007',
    holdType: 'investigation_hold',
    reason: 'Internal audit investigation of meter-reading invoice discrepancies in 2025.',
    ownerUserId: USERS.dineo,
    authorityNote: 'Audit committee resolution AC-2026-14, 2 Sep 2026.',
    blockedActions: ['disposal'],
    scopeDescription: 'Contract C-2025-0007 with its invoices, acceptance records and warranty correspondence.',
    startedAt: '2026-09-02T11:00:00Z',
    reviewDate: '2026-10-20',
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    records: [
      { entityType: 'contract', entityId: LEGACY_CONTRACT_ID, label: 'Contract record (imported)', reference: 'C-2025-0007', recordClass: 'contract', retentionEndedOn: null, to: LINKS.buyerContract(LEGACY_CONTRACT_ID) },
      { entityType: 'contract_invoice', entityId: 3101, label: 'Invoices 2025 (12)', reference: 'C-2025-0007', recordClass: 'financial_evidence', retentionEndedOn: null, to: null },
    ],
    history: [{ at: '2026-09-02T11:00:00Z', action: 'Hold imposed', actor: USERS.dineo, note: 'Investigation hold; review on 20 Oct 2026.' }],
  },
  {
    id: 3,
    tenantId: KWU,
    subjectType: 'record_class',
    subjectId: 4,
    subjectLabel: 'Procurement correspondence 2018–2019',
    subjectReference: null,
    holdType: 'legal_hold',
    reason: 'Litigation hold on 2018–2019 procurement correspondence.',
    ownerUserId: USERS.dineo,
    authorityNote: 'Instruction of the Legal Counsel, 3 Mar 2025.',
    blockedActions: ['disposal'],
    scopeDescription: 'Correspondence records created between 1 Jan 2018 and 31 Dec 2019.',
    startedAt: '2025-03-03T08:00:00Z',
    reviewDate: '2026-09-03',
    releasedAt: '2026-06-30T12:00:00Z',
    releasedBy: USERS.dineo,
    releaseReason: 'Claim settled on 12 Jun 2026; the hold is no longer required. Records return to ordinary eligibility review.',
    records: [
      { entityType: 'communication', entityId: 3301, label: 'Correspondence 2018–2019 (48 records)', reference: null, recordClass: 'communication', retentionEndedOn: '2024-12-31', to: null },
    ],
    history: [
      { at: '2025-03-03T08:00:00Z', action: 'Hold imposed', actor: USERS.dineo, note: null },
      { at: '2026-06-30T12:00:00Z', action: 'Hold released', actor: USERS.dineo, note: 'Records returned to ordinary eligibility review; nothing was disposed of.' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------
// Disposal requests
// ---------------------------------------------------------------------------------------------------------

export interface FixtureDisposalRequest {
  readonly id: number;
  readonly tenantId: number;
  readonly recordClass: RetentionClassesRecordClass;
  readonly entityType: string;
  readonly scopeLabel: string;
  readonly entities: ReadonlyArray<{ readonly entityId: number; readonly label: string; readonly reference: string | null; readonly retentionEndedOn: string; readonly to: string | null }>;
  readonly status: DisposalRequestsStatus;
  readonly disposition: RetentionClassesDisposition;
  readonly eligibilityCheckedAt: string;
  readonly blockedByHoldIds: readonly number[];
  readonly proposedAt: string;
  readonly approval: { readonly approvalRequestId: number; readonly status: 'approved' | 'rejected' | 'pending'; readonly decidedBy: number | null; readonly decidedAt: string | null; readonly reason: string | null } | null;
  readonly dispositionRecord: string | null;
  readonly executedAt: string | null;
  readonly eligibilityNote: string;
  /** The eligibility re-check at approval time fails (a live dispute or obligation needs the records). */
  readonly failsRecheck: boolean;
}

export const DISPOSAL_REQUESTS: readonly FixtureDisposalRequest[] = [
  {
    id: 1,
    tenantId: KWU,
    recordClass: 'bid',
    entityType: 'bid_revision',
    scopeLabel: 'Bids of T-2025-0003 (3 bids)',
    entities: [
      { entityId: 1201, label: 'Bid — Kweneng Borehole Services', reference: 'T-2025-0003', retentionEndedOn: '2025-11-30', to: null },
      { entityId: 1202, label: 'Bid — Tsodilo Engineering', reference: 'T-2025-0003', retentionEndedOn: '2025-11-30', to: null },
      { entityId: 1203, label: 'Bid — Maun Mechanical Works', reference: 'T-2025-0003', retentionEndedOn: '2025-11-30', to: null },
    ],
    status: 'blocked',
    disposition: 'destroy',
    eligibilityCheckedAt: '2026-09-06T04:00:00Z',
    blockedByHoldIds: [1],
    proposedAt: '2026-09-06T04:00:00Z',
    approval: null,
    dispositionRecord: null,
    executedAt: null,
    eligibilityNote: 'Retention ended on 30 Nov 2025, but legal hold 1 blocks disposal (BR-40).',
    failsRecheck: false,
  },
  {
    id: 2,
    tenantId: KWU,
    recordClass: 'tender',
    entityType: 'tender',
    scopeLabel: 'Tender record T-2025-0003',
    entities: [{ entityId: LEGACY_TENDER_ID, label: 'Maun wellfield pump supply (legacy import, 2018)', reference: 'T-2025-0003', retentionEndedOn: '2025-11-30', to: LINKS.auditTrail('tender', LEGACY_TENDER_ID) }],
    status: 'blocked',
    disposition: 'review',
    eligibilityCheckedAt: '2026-09-06T04:00:00Z',
    blockedByHoldIds: [1],
    proposedAt: '2026-09-06T04:00:00Z',
    approval: null,
    dispositionRecord: null,
    executedAt: null,
    eligibilityNote: 'Retention ended on 30 Nov 2025, but legal hold 1 blocks disposal (BR-40).',
    failsRecheck: false,
  },
  {
    id: 3,
    tenantId: KWU,
    recordClass: 'communication',
    entityType: 'communication',
    scopeLabel: 'Procurement correspondence 2018–2019 (48 records)',
    entities: [{ entityId: 3301, label: 'Correspondence 2018–2019 (48 records)', reference: null, retentionEndedOn: '2024-12-31', to: null }],
    status: 'proposed',
    disposition: 'destroy',
    eligibilityCheckedAt: '2026-10-04T04:00:00Z',
    blockedByHoldIds: [],
    proposedAt: '2026-07-05T04:00:00Z',
    approval: null,
    dispositionRecord: null,
    executedAt: null,
    eligibilityNote: 'Eligible: retention ended on 31 Dec 2024 and hold 3 was released on 30 Jun 2026. Approval is still required.',
    failsRecheck: false,
  },
  {
    id: 4,
    tenantId: KWU,
    recordClass: 'personal_account',
    entityType: 'user_profile',
    scopeLabel: 'Personal account data of two users deactivated in 2023',
    entities: [
      { entityId: 1901, label: 'Personal profile — deactivated 14 Mar 2023', reference: null, retentionEndedOn: '2025-03-14', to: null },
      { entityId: 1902, label: 'Personal profile — deactivated 2 Aug 2023', reference: null, retentionEndedOn: '2025-08-02', to: null },
    ],
    status: 'approved',
    disposition: 'destroy',
    eligibilityCheckedAt: '2026-09-13T04:00:00Z',
    blockedByHoldIds: [],
    proposedAt: '2026-09-13T04:00:00Z',
    approval: { approvalRequestId: 61, status: 'approved', decidedBy: USERS.mpho, decidedAt: '2026-09-20T10:00:00Z', reason: 'Personal data only; their approvals and submissions stay in the business record (BR-38, BR-39).' },
    dispositionRecord: null,
    executedAt: null,
    eligibilityNote: 'Personal account data only. Formal approvals, submissions and audit rows of these users are retained (BR-38, BR-39).',
    failsRecheck: false,
  },
  {
    id: 5,
    tenantId: KWU,
    recordClass: 'financial_evidence',
    entityType: 'evidence_submission',
    scopeLabel: 'Supplier financial statements submitted in 2019 (12)',
    entities: [{ entityId: 1501, label: 'Financial statements 2019 (12 submissions)', reference: null, retentionEndedOn: '2025-06-30', to: null }],
    status: 'executed',
    disposition: 'destroy',
    eligibilityCheckedAt: '2026-06-28T04:00:00Z',
    blockedByHoldIds: [],
    proposedAt: '2026-06-28T04:00:00Z',
    approval: { approvalRequestId: 58, status: 'approved', decidedBy: USERS.mpho, decidedAt: '2026-07-10T09:00:00Z', reason: 'Retention ended; no hold, dispute or live contract depends on them.' },
    dispositionRecord: '12 financial statement submissions destroyed on 15 Jul 2026 by the records service; certificate of destruction DR-5 retained with this record.',
    executedAt: '2026-07-15T08:30:00Z',
    eligibilityNote: 'Eligible when checked on 28 Jun 2026.',
    failsRecheck: false,
  },
  {
    id: 6,
    tenantId: KWU,
    recordClass: 'evaluation',
    entityType: 'evaluation_report',
    scopeLabel: 'Evaluation records of 2018 events (4)',
    entities: [{ entityId: 1601, label: 'Evaluation records 2018 (4 events)', reference: null, retentionEndedOn: '2025-12-31', to: null }],
    status: 'rejected',
    disposition: 'archive',
    eligibilityCheckedAt: '2026-08-02T04:00:00Z',
    blockedByHoldIds: [],
    proposedAt: '2026-08-02T04:00:00Z',
    approval: { approvalRequestId: 59, status: 'rejected', decidedBy: USERS.mpho, decidedAt: '2026-08-12T14:00:00Z', reason: 'Records support an open contract dispute; retain until it is resolved.' },
    dispositionRecord: null,
    executedAt: null,
    eligibilityNote: 'Rejected: the records are retained and their history is unchanged.',
    failsRecheck: false,
  },
  {
    id: 7,
    tenantId: KWU,
    recordClass: 'contract',
    entityType: 'contract',
    scopeLabel: 'Water tanker hire contract 2014 (imported)',
    entities: [{ entityId: 1701, label: 'Water tanker hire contract 2014', reference: null, retentionEndedOn: '2026-08-31', to: null }],
    status: 'proposed',
    disposition: 'archive',
    eligibilityCheckedAt: '2026-10-04T04:00:00Z',
    blockedByHoldIds: [],
    proposedAt: '2026-10-04T04:00:00Z',
    approval: null,
    dispositionRecord: null,
    executedAt: null,
    eligibilityNote: 'Proposed by the weekly check. A warranty claim was opened on 2 Oct 2026; the re-check at approval will find it.',
    failsRecheck: true,
  },
];

// ---------------------------------------------------------------------------------------------------------
// Audit trail (ADM-14 viewer)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureAuditEvent {
  readonly id: number;
  readonly tenantId: number;
  readonly occurredAt: string;
  readonly actorUserId: number | null;
  readonly actorCapacity: string | null;
  readonly onBehalfOfUserId: number | null;
  readonly supportGrantId: number | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: number;
  readonly entityLabel: string | null;
  readonly entityReference: string | null;
  readonly reason: string | null;
  readonly beforeState: JsonObject | null;
  readonly afterState: JsonObject | null;
  readonly correlationId: string | null;
  readonly sensitivity: AuditLogSensitivity;
  readonly category: AuditEventCategory;
  readonly classification: DocumentsClassification | null;
  readonly retentionClass: RetentionClassesRecordClass | null;
  readonly to: string | null;
}

type AuditInput = Omit<FixtureAuditEvent, 'tenantId' | 'onBehalfOfUserId' | 'supportGrantId' | 'beforeState' | 'afterState' | 'classification' | 'correlationId' | 'reason'> &
  Partial<Pick<FixtureAuditEvent, 'onBehalfOfUserId' | 'supportGrantId' | 'beforeState' | 'afterState' | 'classification' | 'correlationId' | 'reason'>>;

function audit(input: AuditInput): FixtureAuditEvent {
  return {
    tenantId: KWU,
    onBehalfOfUserId: null,
    supportGrantId: null,
    beforeState: null,
    afterState: null,
    classification: null,
    correlationId: `c-${String(input.id).padStart(6, '0')}`,
    reason: null,
    ...input,
  };
}

export const AUDIT_EVENTS: readonly FixtureAuditEvent[] = [
  audit({ id: 5001, occurredAt: '2025-03-12T10:15:00Z', actorUserId: USERS.adminKwu, actorCapacity: 'Organization Administrator', action: 'import.accepted', entityType: 'tender', entityId: LEGACY_TENDER_ID, entityLabel: 'Maun wellfield pump supply (legacy import, 2018)', entityReference: 'T-2025-0003', reason: 'Historical onboarding from the legacy spreadsheet (original dates preserved).', afterState: { origin: 'Legacy spreadsheet 2025', originalClosedOn: '2018-11-30' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'tender', to: LINKS.auditTrail('tender', LEGACY_TENDER_ID) }),
  audit({ id: 5002, occurredAt: '2025-11-24T09:00:00Z', actorUserId: USERS.formerOfficer, actorCapacity: 'Procurement Officer', action: 'approval.decided', entityType: 'approval_request', entityId: 12, entityLabel: 'Strategy approval — fleet vehicle maintenance', entityReference: 'T-2026-0010', afterState: { decision: 'approved' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'tender', to: LINKS.buyerTender(10) }),
  audit({ id: 5003, occurredAt: '2026-08-14T09:30:00Z', actorUserId: USERS.dineo, actorCapacity: 'Legal Counsel', action: 'hold.imposed', entityType: 'hold', entityId: 1, entityLabel: 'Legal hold — T-2025-0003', entityReference: 'T-2025-0003', reason: 'Civil claim by a former bidder concerning the 2018 award.', afterState: { holdType: 'legal_hold', blockedActions: ['disposal'], reviewDate: '2027-02-14' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'tender', to: LINKS.holds(1) }),
  audit({ id: 5004, occurredAt: '2026-08-15T09:07:31Z', actorUserId: USERS.pule, actorCapacity: 'Internal Auditor', action: 'export.created', entityType: 'export', entityId: 7, entityLabel: 'Evidence pack — T-2025-0003', entityReference: 'T-2025-0003', reason: 'Evidence for the legal proceedings.', afterState: { format: 'html', exportType: 'evidence_pack' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'audit', to: null }),
  audit({ id: 5005, occurredAt: '2026-08-15T09:12:00Z', actorUserId: USERS.dineo, actorCapacity: 'Legal Counsel', action: 'export.downloaded', entityType: 'export', entityId: 7, entityLabel: 'Evidence pack — T-2025-0003', entityReference: 'T-2025-0003', sensitivity: 'normal', category: 'access_event', classification: 'buyer_internal', retentionClass: 'audit', to: null }),
  audit({ id: 5006, occurredAt: '2026-09-02T11:00:00Z', actorUserId: USERS.dineo, actorCapacity: 'Legal Counsel', action: 'hold.imposed', entityType: 'hold', entityId: 2, entityLabel: 'Investigation hold — C-2025-0007', entityReference: 'C-2025-0007', reason: 'Internal audit investigation of invoice discrepancies.', afterState: { holdType: 'investigation_hold', blockedActions: ['disposal'], reviewDate: '2026-10-20' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'contract', to: LINKS.holds(2) }),
  audit({ id: 5007, occurredAt: '2026-09-06T04:00:00Z', actorUserId: null, actorCapacity: 'retention-eligibility job', action: 'disposal.blocked', entityType: 'disposal_request', entityId: 1, entityLabel: 'Bids of T-2025-0003', entityReference: 'T-2025-0003', reason: 'Legal hold 1 blocks disposal.', afterState: { status: 'blocked', blockedByHoldIds: [1] }, sensitivity: 'normal', category: 'business_action', retentionClass: 'bid', to: null }),
  audit({ id: 5008, occurredAt: '2026-09-06T04:00:00Z', actorUserId: null, actorCapacity: 'retention-eligibility job', action: 'disposal.blocked', entityType: 'disposal_request', entityId: 2, entityLabel: 'Tender record T-2025-0003', entityReference: 'T-2025-0003', reason: 'Legal hold 1 blocks disposal.', afterState: { status: 'blocked', blockedByHoldIds: [1] }, sensitivity: 'normal', category: 'business_action', retentionClass: 'tender', to: null }),
  audit({ id: 5009, occurredAt: '2026-09-18T15:30:00Z', actorUserId: USERS.adminKwu, actorCapacity: 'Organization Administrator', action: 'membership.revoked', entityType: 'membership', entityId: 21, entityLabel: 'Gaone Letsholo — Procurement Officer', entityReference: null, reason: 'Left the organization; open work reassigned to Tebogo Molefe.', beforeState: { status: 'active' }, afterState: { status: 'revoked' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'personal_account', to: null }),
  audit({ id: 5010, occurredAt: '2026-08-28T08:00:00Z', actorUserId: USERS.oratile, actorCapacity: 'Bid Opening Officer', action: 'envelope.opened', entityType: 'opening_session', entityId: 31, entityLabel: 'Technical envelope opening — T-2026-0003', entityReference: 'T-2026-0003', sensitivity: 'restricted', category: 'business_action', retentionClass: 'bid', to: LINKS.buyerTender(3) }),
  audit({ id: 5011, occurredAt: '2026-09-12T14:22:00Z', actorUserId: USERS.thato, actorCapacity: 'Evaluator, Technical Services', action: 'evaluation.score_submitted', entityType: 'evaluation_score', entityId: 3311, entityLabel: 'Individual assessment — T-2026-0003', entityReference: 'T-2026-0003', sensitivity: 'restricted', category: 'business_action', retentionClass: 'evaluation', to: LINKS.buyerTender(3) }),
  audit({ id: 5012, occurredAt: '2026-09-19T10:05:00Z', actorUserId: USERS.boitumelo, actorCapacity: 'Evaluation Chair', action: 'moderation.score_changed', entityType: 'moderated_score', entityId: 3321, entityLabel: 'Moderation — T-2026-0003 criterion 2', entityReference: 'T-2026-0003', reason: 'Consensus after discussing the evidence; original scores preserved.', sensitivity: 'restricted', category: 'business_action', retentionClass: 'evaluation', to: LINKS.buyerTender(3) }),
  audit({ id: 5013, occurredAt: '2026-09-25T07:40:00Z', actorUserId: USERS.limpopoAdmin, actorCapacity: 'Limpopo Environmental Services — Organization Administrator', action: 'complaint.received', entityType: 'complaint', entityId: 92, entityLabel: 'Complaint — T-2026-0007', entityReference: 'CMP-2026-0002', afterState: { subject: 'evaluation', status: 'received' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'complaint', to: LINKS.buyerComplaint(92) }),
  audit({ id: 5014, occurredAt: '2026-09-25T15:40:00Z', actorUserId: USERS.dineo, actorCapacity: 'Legal Counsel', action: 'hold.imposed', entityType: 'hold', entityId: 21, entityLabel: 'Complaint hold — T-2026-0007', entityReference: 'T-2026-0007', reason: 'Blocking complaint during the standstill period.', afterState: { holdType: 'complaint_hold', blockedActions: ['award_final', 'contract_sign'] }, sensitivity: 'normal', category: 'business_action', retentionClass: 'tender', to: LINKS.buyerTender(7) }),
  audit({ id: 5015, occurredAt: '2026-10-01T12:05:00Z', actorUserId: USERS.masego, actorCapacity: 'Contract Manager', action: 'change_request.submitted', entityType: 'change_request', entityId: 903, entityLabel: 'CR-0003 — C-2026-0001', entityReference: 'C-2026-0001', afterState: { amount: '285000.00', currency: 'BWP', cumulative: '430000.00', approvalId: 36 }, sensitivity: 'normal', category: 'business_action', retentionClass: 'contract', to: LINKS.buyerContract(1) }),
  audit({ id: 5016, occurredAt: '2026-09-29T08:10:00Z', actorUserId: USERS.supportAgent, actorCapacity: 'TenderIQ Support Agent', supportGrantId: 1, action: 'support_access.used', entityType: 'support_case', entityId: 1, entityLabel: 'Support case 1 — metadata-only access', entityReference: null, reason: 'Investigating a reported upload error (customer-authorized, metadata only).', sensitivity: 'normal', category: 'access_event', retentionClass: 'audit', to: null }),
  audit({ id: 5017, occurredAt: '2026-09-25T08:00:00Z', actorUserId: null, actorCapacity: 'closing job', action: 'tender.closed', entityType: 'tender', entityId: 8, entityLabel: 'Pipeline valves bulk supply', entityReference: 'T-2026-0008', beforeState: { status: 'open' }, afterState: { status: 'closed', sealedSubmissions: 1 }, sensitivity: 'normal', category: 'business_action', retentionClass: 'tender', to: LINKS.buyerTender(8) }),
  audit({ id: 5018, occurredAt: '2026-10-01T10:44:00Z', actorUserId: USERS.pule, actorCapacity: 'Internal Auditor', action: 'document.downloaded', entityType: 'document', entityId: 201, entityLabel: 'Tender package — Smart water meter supply', entityReference: 'T-2026-0002', sensitivity: 'normal', category: 'access_event', classification: 'participating_suppliers', retentionClass: 'tender', to: LINKS.document(201) }),
  audit({ id: 5019, occurredAt: '2026-10-02T12:45:00Z', actorUserId: USERS.tebogo, actorCapacity: 'Procurement Officer', action: 'approval.invalidated', entityType: 'approval_request', entityId: 31, entityLabel: 'Release approval — T-2026-0005', entityReference: 'T-2026-0005', reason: 'Material change to scope and estimated value after approval (BR-10).', beforeState: { status: 'approved', estimatedValue: '1450000.00' }, afterState: { status: 'invalidated', estimatedValue: '1920000.00' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'tender', to: LINKS.buyerTender(5) }),
  audit({ id: 5020, occurredAt: '2026-09-24T08:00:00Z', actorUserId: USERS.tebogo, actorCapacity: 'Procurement Officer', action: 'addendum.issued', entityType: 'addendum', entityId: 21, entityLabel: 'Addendum 1 — Smart water meter supply', entityReference: 'T-2026-0002', afterState: { materiality: 'material', existingSubmissionAction: 'supplement' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'communication', to: LINKS.buyerTender(2) }),
  audit({ id: 5021, occurredAt: '2026-10-04T04:00:00Z', actorUserId: null, actorCapacity: 'retention-eligibility job', action: 'disposal.proposed', entityType: 'disposal_request', entityId: 7, entityLabel: 'Water tanker hire contract 2014', entityReference: null, afterState: { status: 'proposed' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'contract', to: null }),
  audit({ id: 5022, occurredAt: '2026-10-04T14:20:22Z', actorUserId: USERS.mpho, actorCapacity: 'Procurement Manager', action: 'export.created', entityType: 'export', entityId: 4, entityLabel: 'Participation by tender (unique organizations)', entityReference: null, afterState: { format: 'csv', exportType: 'report' }, sensitivity: 'normal', category: 'business_action', retentionClass: 'audit', to: null }),
  audit({ id: 5023, occurredAt: '2026-10-05T04:00:00Z', actorUserId: null, actorCapacity: 'report-schedules job', action: 'report.run', entityType: 'report_definition', entityId: 1, entityLabel: 'Weekly pipeline for ExCo', entityReference: null, afterState: { recipients: 4, excluded: 0 }, sensitivity: 'normal', category: 'business_action', retentionClass: 'audit', to: null }),
];
