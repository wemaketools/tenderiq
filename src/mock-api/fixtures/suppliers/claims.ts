/**
 * Claim invitations of the buyer-created provisional suppliers (FR-02, DD-17; SUP-02 "claim an invited
 * organization"). Each provisional tenant has one: the buyer recorded the organization and invited a contact, who
 * follows `/register/claim/:token` to complete the registration. Claiming still leads through contact verification
 * (the e-mail goes only to the invited address), identity verification and, separately, each buyer's qualification.
 *
 * The invitation state agrees with the organization's `registration.verificationEmailStatus` (organizations.ts). A
 * stored `pending` invitation past `expiresAt` is reported as `expired` at request time.
 */
import type { ClaimInvitationState } from '../../../contracts/suppliers.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureClaimInvitation {
  readonly token: string;
  readonly supplierTenantId: number;
  readonly buyerTenantId: number;
  /** The invited contact (a person in `EXTERNAL_PEOPLE`). */
  readonly contactUserId: number;
  readonly state: ClaimInvitationState;
  readonly sentAt: string;
  readonly sentCount: number;
  readonly expiresAt: string;
  readonly revokedReason: string | null;
}

export const CLAIM_INVITATIONS: readonly FixtureClaimInvitation[] = Object.freeze([
  {
    token: 'clm_K4sBoreh0le7Qx2',
    supplierTenantId: 50,
    buyerTenantId: TENANT_IDS.kwu,
    contactUserId: 77,
    state: 'pending',
    sentAt: '2026-09-10T08:15:00Z',
    sentCount: 1,
    expiresAt: '2026-10-10T15:00:00Z',
    revokedReason: null,
  },
  {
    token: 'clm_M4unHyg1ene3Rt',
    supplierTenantId: 51,
    buyerTenantId: TENANT_IDS.odc,
    contactUserId: 78,
    state: 'pending',
    sentAt: '2026-09-03T10:00:00Z',
    sentCount: 2,
    expiresAt: '2026-10-13T15:00:00Z',
    revokedReason: null,
  },
  {
    token: 'clm_Ch0beVa1ves9Kn',
    supplierTenantId: 53,
    buyerTenantId: TENANT_IDS.odc,
    contactUserId: 79,
    state: 'expired',
    sentAt: '2026-07-14T09:00:00Z',
    sentCount: 1,
    expiresAt: '2026-08-13T15:00:00Z',
    revokedReason: null,
  },
] satisfies FixtureClaimInvitation[]);

export function findClaimInvitation(token: string): FixtureClaimInvitation | undefined {
  return CLAIM_INVITATIONS.find((invitation) => invitation.token === token);
}

export function claimInvitationOf(supplierTenantId: number): FixtureClaimInvitation | undefined {
  return CLAIM_INVITATIONS.find((invitation) => invitation.supplierTenantId === supplierTenantId);
}
