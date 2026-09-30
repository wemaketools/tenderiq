/**
 * Supplier reviews: legal-identity change requests (`supplier_identity_changes`), membership requests
 * (`supplier_membership_requests`), duplicate candidates (`duplicate_candidates` [G]) and merges (`supplier_merges`
 * [G]) (FR-02, BR-44).
 *
 * - Tsodilo's legal-name change was approved on 2026-03-15 (effective 2026-04-01); submissions made before keep the
 *   former name. Chobe's ownership change is submitted and Serowe's representation transfer is under review, so the
 *   operator queue has work. Makgadikgadi's registration-number correction was rejected.
 * - `sam.dual` has a pending request at Serowe ICT (his `pending_approval` membership, COM-02) and approved ones at
 *   Tsodilo and Chobe.
 * - Duplicates: a new registration resembling Tsodilo's former name (open), an ODC import resembling Chobe
 *   (escalated), two suppliers sharing an e-mail domain (not a duplicate: a shared domain is not evidence, FR-02),
 *   a merged Gaborone Metering record (history kept, BR-44) and a registration re-using Serowe's registration number
 *   flagged by KWU (open).
 */
import type {
  DuplicateCandidatesDetectedReason,
  DuplicateCandidatesStatus,
  SupplierIdentityChangesChangeType,
  SupplierIdentityChangesStatus,
  SupplierMembershipRequestsStatus,
} from '../../../contracts/enums.js';
import type { EvidenceDocumentRef } from '../../../contracts/suppliers.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureIdentityChange {
  readonly id: number;
  readonly tenantId: number;
  readonly changeType: SupplierIdentityChangesChangeType;
  readonly previousValue: string | null;
  readonly proposedValue: string;
  readonly reason: string;
  readonly evidenceDocument: EvidenceDocumentRef | null;
  readonly status: SupplierIdentityChangesStatus;
  readonly submittedByUserId: number;
  readonly submittedAt: string;
  readonly reviewedByUserId: number | null;
  readonly reviewedAt: string | null;
  readonly effectiveAt: string | null;
  readonly decisionNote: string | null;
}

export interface FixtureMembershipRequest {
  readonly id: number;
  /** Supplier tenant the person asked to join. */
  readonly tenantId: number;
  readonly userId: number;
  readonly message: string;
  readonly status: SupplierMembershipRequestsStatus;
  readonly decidedByUserId: number | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly createdAt: string;
}

export interface FixtureDuplicateCandidate {
  readonly id: number;
  readonly tenantAId: number;
  readonly tenantBId: number;
  readonly detectedReason: DuplicateCandidatesDetectedReason;
  readonly status: DuplicateCandidatesStatus;
  readonly raisedByTenantId: number | null;
  readonly raisedByUserId: number | null;
  readonly reviewedByUserId: number | null;
  readonly reviewedAt: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface FixtureSupplierMerge {
  readonly id: number;
  readonly candidateId: number;
  readonly survivingTenantId: number;
  readonly mergedTenantId: number;
  readonly approvedByUserId: number;
  readonly reason: string;
  readonly mergedAt: string;
}

const OPS_ADMIN = 1;

function doc(documentId: number, fileName: string): EvidenceDocumentRef {
  return { documentId, fileName, versionNo: 1 };
}

export const IDENTITY_CHANGES: readonly FixtureIdentityChange[] = Object.freeze([
  {
    id: 1,
    tenantId: TENANT_IDS.tsodilo,
    changeType: 'legal_name',
    previousValue: 'Tsodilo Engineering Services (Pty) Ltd',
    proposedValue: 'Tsodilo Engineering (Pty) Ltd',
    reason: 'Change of name registered with CIPA on 2 Mar 2026 (certificate of change of name attached).',
    evidenceDocument: doc(5101, 'CIPA-change-of-name-certificate.pdf'),
    status: 'approved',
    submittedByUserId: 24,
    submittedAt: '2026-03-05T09:10:00Z',
    reviewedByUserId: OPS_ADMIN,
    reviewedAt: '2026-03-15T10:00:00Z',
    effectiveAt: '2026-03-31T22:00:00Z',
    decisionNote: 'Verified against the CIPA register extract of 10 Mar 2026. Submissions before 1 Apr 2026 keep the former legal name.',
  },
  {
    id: 2,
    tenantId: TENANT_IDS['chobe-pipe'],
    changeType: 'ownership',
    previousValue: 'Chobe Holdings (Pty) Ltd 75%; Gorata Mphoeng 25%.',
    proposedValue: 'Okavango Industrial Holdings (Pty) Ltd 60%; Chobe Holdings (Pty) Ltd 25%; Gorata Mphoeng 15%.',
    reason: 'Share purchase agreement completed on 15 Sep 2026; updated share register attached.',
    evidenceDocument: doc(5102, 'Share-register-2026-09-15.pdf'),
    status: 'submitted',
    submittedByUserId: 28,
    submittedAt: '2026-09-22T08:30:00Z',
    reviewedByUserId: null,
    reviewedAt: null,
    effectiveAt: null,
    decisionNote: null,
  },
  {
    id: 3,
    tenantId: TENANT_IDS['serowe-ict'],
    changeType: 'representation_transfer',
    previousValue: 'Otsile Serowe (Director) as authorized representative.',
    proposedValue: 'Tshepiso Khama (Managing Director) as authorized representative.',
    reason: 'Board resolution of 1 Sep 2026 appointing Tshepiso Khama as the authorized representative for tenders.',
    evidenceDocument: doc(5103, 'Board-resolution-2026-09-01.pdf'),
    status: 'under_review',
    submittedByUserId: 32,
    submittedAt: '2026-09-10T07:30:00Z',
    reviewedByUserId: null,
    reviewedAt: null,
    effectiveAt: null,
    decisionNote: null,
  },
  {
    id: 4,
    tenantId: TENANT_IDS.makgadikgadi,
    changeType: 'registration',
    previousValue: 'BW00003456789',
    proposedValue: 'BW00003456798',
    reason: 'Correct a transposed digit in the registration number.',
    evidenceDocument: doc(5104, 'Company-letterhead-registration.pdf'),
    status: 'rejected',
    submittedByUserId: 40,
    submittedAt: '2026-06-02T11:00:00Z',
    reviewedByUserId: OPS_ADMIN,
    reviewedAt: '2026-06-09T09:30:00Z',
    effectiveAt: null,
    decisionNote: 'The CIPA register confirms BW00003456789 is correct; the proposed number belongs to another company.',
  },
  {
    id: 5,
    tenantId: TENANT_IDS['gaborone-meter'],
    changeType: 'admin_recovery',
    previousValue: 'Administrator: Sipho Mothobi (left on 30 Apr 2026).',
    proposedValue: 'Administrator: Palesa Gabo.',
    reason: 'The previous administrator left the company; the board appointed a new administrator.',
    evidenceDocument: doc(5105, 'Board-resolution-admin-appointment.pdf'),
    status: 'approved',
    submittedByUserId: 36,
    submittedAt: '2026-05-18T08:00:00Z',
    reviewedByUserId: OPS_ADMIN,
    reviewedAt: '2026-05-22T09:00:00Z',
    effectiveAt: '2026-05-22T09:00:00Z',
    decisionNote: 'Resolution verified by telephone with two directors listed in the CIPA register.',
  },
] satisfies FixtureIdentityChange[]);

export const MEMBERSHIP_REQUESTS: readonly FixtureMembershipRequest[] = Object.freeze([
  { id: 1, tenantId: TENANT_IDS.tsodilo, userId: 42, message: 'Joining the Tsodilo telemetry team as a contributing engineer.', status: 'approved', decidedByUserId: 24, decidedAt: '2026-03-30T08:00:00Z', decisionNote: 'Approved as Technical Contributor.', createdAt: '2026-03-28T10:00:00Z' },
  { id: 2, tenantId: TENANT_IDS['chobe-pipe'], userId: 42, message: 'Contributing technical specifications for valve submissions.', status: 'approved', decidedByUserId: 28, decidedAt: '2026-03-31T09:00:00Z', decisionNote: 'Approved as Technical Contributor.', createdAt: '2026-03-29T12:00:00Z' },
  { id: 3, tenantId: TENANT_IDS['serowe-ict'], userId: 42, message: 'Requesting access to contribute to SCADA proposals as a contracted engineer.', status: 'pending', decidedByUserId: null, decidedAt: null, decisionNote: null, createdAt: '2026-09-25T15:00:00Z' },
  { id: 4, tenantId: TENANT_IDS.tsodilo, userId: 70, message: 'I manage tenders for Tsodilo Engineering Services in Maun.', status: 'rejected', decidedByUserId: 24, decidedAt: '2026-09-21T08:00:00Z', decisionNote: 'Not an employee of Tsodilo Engineering (Pty) Ltd. If you represent a different company, complete your own registration.', createdAt: '2026-09-20T14:20:00Z' },
  { id: 5, tenantId: TENANT_IDS['chobe-pipe'], userId: 71, message: 'New estimator at the Francistown depot (started 21 Sep 2026).', status: 'pending', decidedByUserId: null, decidedAt: null, decisionNote: null, createdAt: '2026-09-28T07:45:00Z' },
  { id: 6, tenantId: TENANT_IDS['gaborone-meter'], userId: 72, message: 'Field technician needing access to contract evidence uploads.', status: 'approved', decidedByUserId: 36, decidedAt: '2026-06-03T10:00:00Z', decisionNote: 'Approved as Field Technician.', createdAt: '2026-06-02T09:00:00Z' },
  { id: 7, tenantId: TENANT_IDS.tsodilo, userId: 73, message: 'Temporary bid writer for the pump programme.', status: 'withdrawn', decidedByUserId: null, decidedAt: null, decisionNote: null, createdAt: '2026-06-28T13:00:00Z' },
] satisfies FixtureMembershipRequest[]);

export const DUPLICATE_CANDIDATES: readonly FixtureDuplicateCandidate[] = Object.freeze([
  { id: 1, tenantAId: TENANT_IDS.tsodilo, tenantBId: 52, detectedReason: 'similar_name', status: 'open', raisedByTenantId: null, raisedByUserId: null, reviewedByUserId: null, reviewedAt: null, note: 'Name matches the former legal name of Tsodilo Engineering (Pty) Ltd; registration numbers differ.', createdAt: '2026-09-20T14:05:00Z' },
  { id: 2, tenantAId: TENANT_IDS['chobe-pipe'], tenantBId: 53, detectedReason: 'import_match', status: 'escalated', raisedByTenantId: TENANT_IDS.odc, raisedByUserId: 23, reviewedByUserId: OPS_ADMIN, reviewedAt: '2026-07-20T11:00:00Z', note: 'Same address, registration numbers differ by two digits. Asked ODC to confirm with the CIPA register before any merge.', createdAt: '2026-07-14T09:05:00Z' },
  { id: 3, tenantAId: TENANT_IDS.makgadikgadi, tenantBId: TENANT_IDS['limpopo-env'], detectedReason: 'same_email_domain', status: 'not_duplicate', raisedByTenantId: null, raisedByUserId: null, reviewedByUserId: OPS_ADMIN, reviewedAt: '2026-05-12T08:30:00Z', note: 'Both use a public mail provider; different owners, registrations and addresses.', createdAt: '2026-05-10T06:00:00Z' },
  { id: 4, tenantAId: TENANT_IDS['gaborone-meter'], tenantBId: 54, detectedReason: 'same_registration_number', status: 'merged', raisedByTenantId: null, raisedByUserId: null, reviewedByUserId: OPS_ADMIN, reviewedAt: '2026-04-20T10:00:00Z', note: 'Second registration created by a Gaborone Metering employee; no submissions under the duplicate record.', createdAt: '2026-03-30T11:05:00Z' },
  { id: 5, tenantAId: TENANT_IDS['serowe-ict'], tenantBId: 55, detectedReason: 'same_registration_number', status: 'open', raisedByTenantId: TENANT_IDS.kwu, raisedByUserId: 5, reviewedByUserId: null, reviewedAt: null, note: 'New registration quotes the registration number of Serowe ICT Solutions; the registrant is not a known Serowe ICT contact.', createdAt: '2026-08-05T10:20:00Z' },
] satisfies FixtureDuplicateCandidate[]);

export const SUPPLIER_MERGES: readonly FixtureSupplierMerge[] = Object.freeze([
  { id: 1, candidateId: 4, survivingTenantId: TENANT_IDS['gaborone-meter'], mergedTenantId: 54, approvedByUserId: OPS_ADMIN, reason: 'Same legal person (identical CIPA registration); the duplicate record had no submissions. Records were not re-pointed.', mergedAt: '2026-04-20T10:00:00Z' },
] satisfies FixtureSupplierMerge[]);
