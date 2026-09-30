/**
 * Operator requests for missing identity evidence (SUP-02 "resolve missing evidence", OPS-01; DD-27). Identity
 * verification is its own status, separate from registration, contact verification and qualification (FR-02, AC-07):
 *
 * - Makgadikgadi Civil Works is registered and contact-verified, not identity-verified and not qualified (AC-07). The
 *   operator asked for a current company extract and an ownership declaration; the request is open.
 * - Letlhakane Solar's registration is pending (contact verified); the operator asked for its incorporation
 *   certificate.
 * - Chobe Pipe answered a request with its incorporation certificate before identity verification (closed).
 */
import type { EvidenceItemsEvidenceType } from '../../../contracts/enums.js';
import type { VerificationRequestStatus } from '../../../contracts/suppliers.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureVerificationRequest {
  readonly id: number;
  readonly supplierTenantId: number;
  readonly status: VerificationRequestStatus;
  readonly reason: string;
  readonly evidenceTypes: readonly EvidenceItemsEvidenceType[];
  readonly dueDate: string | null;
  readonly requestedByUserId: number;
  readonly requestedAt: string;
  readonly response: {
    readonly respondedByUserId: number;
    readonly respondedAt: string;
    readonly note: string | null;
    readonly evidenceItemIds: readonly number[];
  } | null;
}

/** The platform operator persona (`ops.admin`). */
const OPS_ADMIN = 1;

/** How a supplier sees who asked: the team, never an individual operator. */
export const VERIFICATION_REQUESTER_LABEL = 'TenderIQ platform operations';

export const VERIFICATION_REQUESTS: readonly FixtureVerificationRequest[] = Object.freeze([
  {
    id: 1,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    status: 'closed',
    reason: 'Upload the certificate of incorporation for registration number BW00002345678 so we can verify the organization’s identity.',
    evidenceTypes: ['registration'],
    dueDate: '2026-02-20',
    requestedByUserId: OPS_ADMIN,
    requestedAt: '2026-02-12T07:00:00Z',
    response: { respondedByUserId: 28, respondedAt: '2026-02-12T08:10:00Z', note: null, evidenceItemIds: [501] },
  },
  {
    id: 2,
    supplierTenantId: TENANT_IDS.makgadikgadi,
    status: 'open',
    reason:
      'The certificate of incorporation does not show the current directors, and the ownership stated on the profile is not supported by a document. Supply a current company extract and a declaration covering ownership so we can verify the organization’s identity.',
    evidenceTypes: ['registration', 'declaration'],
    dueDate: '2026-10-09',
    requestedByUserId: OPS_ADMIN,
    requestedAt: '2026-09-21T09:00:00Z',
    response: null,
  },
  {
    id: 3,
    supplierTenantId: 56,
    status: 'open',
    reason: 'Upload the certificate of incorporation for registration number BW00008123456 to complete the registration.',
    evidenceTypes: ['registration'],
    dueDate: '2026-10-12',
    requestedByUserId: OPS_ADMIN,
    requestedAt: '2026-09-28T08:30:00Z',
    response: null,
  },
] satisfies FixtureVerificationRequest[]);

export function verificationRequestsOf(supplierTenantId: number): FixtureVerificationRequest[] {
  return VERIFICATION_REQUESTS.filter((request) => request.supplierTenantId === supplierTenantId);
}
