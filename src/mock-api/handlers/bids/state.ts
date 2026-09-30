/**
 * Read helpers of the bids mock handlers: which revision is working or effective, whether the submission window
 * is open, who is on the supplier's response team, and what the caller may do. Pure functions over the static
 * fixtures (`fixtures/bids`); nothing here mutates state.
 */
import type { BidsRoundType, BidRevisionsStatus, PursuitTeamMembersResponsibility } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { BidViewer, BidTeamMember } from '../../../contracts/bids.js';
import {
  BIDS,
  BID_REVISIONS,
  BID_TENDERS,
  BID_WITHDRAWALS,
  SUBMISSION_ATTEMPTS,
  SUBMISSION_RECEIPTS,
  roundDeadline,
} from '../../fixtures/bids/index.js';
import type {
  FixtureAttempt,
  FixtureBid,
  FixtureBidTender,
  FixtureReceipt,
  FixtureRevision,
  FixtureWithdrawal,
} from '../../fixtures/bids/index.js';
import { TENANTS } from '../../fixtures/platform.js';
import { allPersonas, membershipPermissions, personRef } from '../../persona.js';

/** Revision statuses the team is still working on (a failed submission may be retried while the window is open). */
export const WORKING_STATUSES: readonly BidRevisionsStatus[] = ['draft', 'internal_review', 'approved_internally', 'submission_failed'];

/** Receipt statuses that establish a submission. */
export const EFFECTIVE_RECEIPT_STATUSES = ['received', 'selected_for_evaluation'] as const;

export function tenderById(id: number): FixtureBidTender | undefined {
  return BID_TENDERS.find((row) => row.id === id);
}

export function requireTender(bid: FixtureBid): FixtureBidTender {
  const tender = tenderById(bid.tenderId);
  if (tender === undefined) {
    throw new Error(`Bid ${bid.id} references unknown tender ${bid.tenderId}.`);
  }
  return tender;
}

/** A supplier's own bid, or undefined (another supplier's bid is simply not found). */
export function supplierBid(supplierTenantId: number, bidId: number): FixtureBid | undefined {
  return BIDS.find((row) => row.id === bidId && row.supplierTenantId === supplierTenantId);
}

export function revisionsOf(bidId: number): FixtureRevision[] {
  return BID_REVISIONS.filter((row) => row.bidId === bidId).sort((a, b) => a.revisionNo - b.revisionNo);
}

export function receiptsOf(bidId: number): FixtureReceipt[] {
  return SUBMISSION_RECEIPTS.filter((row) => row.bidId === bidId).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}

export function attemptsOf(bidId: number): FixtureAttempt[] {
  return SUBMISSION_ATTEMPTS.filter((row) => row.bidId === bidId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function withdrawalsOf(bidId: number): FixtureWithdrawal[] {
  return BID_WITHDRAWALS.filter((row) => row.bidId === bidId);
}

/** The receipt that currently establishes the bid's submission (BR-18, BR-19). */
export function effectiveReceipt(bid: FixtureBid): FixtureReceipt | null {
  if (bid.submissionState !== 'submitted') {
    return null;
  }
  const candidates = receiptsOf(bid.id).filter((row) => (EFFECTIVE_RECEIPT_STATUSES as readonly string[]).includes(row.status));
  return candidates[candidates.length - 1] ?? null;
}

export function workingRevision(bid: FixtureBid): FixtureRevision | null {
  const working = revisionsOf(bid.id).filter((row) => WORKING_STATUSES.includes(row.status));
  return working[working.length - 1] ?? null;
}

export function effectiveRevision(bid: FixtureBid): FixtureRevision | null {
  const receipt = effectiveReceipt(bid);
  return receipt === null ? null : (BID_REVISIONS.find((row) => row.id === receipt.revisionId) ?? null);
}

/** The revision a screen shows by default: the working one, else the effective one, else the latest. */
export function defaultRevision(bid: FixtureBid): FixtureRevision | null {
  const all = revisionsOf(bid.id);
  return workingRevision(bid) ?? effectiveRevision(bid) ?? all[all.length - 1] ?? null;
}

export function bidDeadline(bid: FixtureBid, tender: FixtureBidTender): string {
  return roundDeadline(tender, bid.roundType);
}

/** The current round of a tender (its last round). */
export function currentRound(tender: FixtureBidTender): BidsRoundType {
  return tender.rounds[tender.rounds.length - 1]?.roundType ?? 'initial';
}

/** Submissions are accepted while the tender is open, the bid's round is current and the deadline has not passed. */
export function windowOpen(tender: FixtureBidTender, roundType: BidsRoundType, now: Date): boolean {
  return tender.status === 'open' && currentRound(tender) === roundType && now.getTime() < Date.parse(roundDeadline(tender, roundType));
}

/** A revision may be edited while it is being worked on and the window is open. */
export function isEditable(revision: FixtureRevision, bid: FixtureBid, tender: FixtureBidTender, now: Date): boolean {
  return WORKING_STATUSES.includes(revision.status) && bid.submissionState !== 'withdrawn' && windowOpen(tender, bid.roundType, now);
}

export function legalNameOf(tenantId: number): string {
  return TENANTS.find((row) => row.id === tenantId)?.legalName ?? 'Unknown organization';
}

export function tenantNameOf(tenantId: number): string {
  return TENANTS.find((row) => row.id === tenantId)?.name ?? 'Unknown organization';
}

export function tenantSlugOf(tenantId: number): string {
  return TENANTS.find((row) => row.id === tenantId)?.slug ?? 'unknown';
}

// ---------------------------------------------------------------------------------------------------------
// Team and viewer
// ---------------------------------------------------------------------------------------------------------

const RESPONSE_PERMISSIONS: readonly PermissionCode[] = [
  'supplier.response.edit',
  'supplier.pricing.edit',
  'supplier.response.approve',
  'supplier.response.submit',
];

const RESPONSIBILITY_BY_TEMPLATE: Readonly<Record<string, PursuitTeamMembersResponsibility>> = {
  bid_manager: 'bid_manager',
  contributor: 'contributor',
  commercial_contributor: 'commercial_contributor',
  supplier_approver: 'approver',
  authorized_signatory: 'signatory',
};

interface TeamRow {
  readonly member: BidTeamMember;
  readonly permissions: readonly PermissionCode[];
}

/** Active members of a supplier with any response permission: its response team. */
export function supplierTeam(supplierTenantId: number): TeamRow[] {
  const rows: TeamRow[] = [];
  for (const persona of allPersonas()) {
    if (persona.status !== 'active') {
      continue;
    }
    for (const membership of persona.memberships) {
      if (membership.tenantId !== supplierTenantId || membership.status !== 'active') {
        continue;
      }
      const permissions = membershipPermissions(membership);
      if (!permissions.some((code) => RESPONSE_PERMISSIONS.includes(code))) {
        continue;
      }
      const template = membership.roles.map((role) => role.roleCode).find((code) => RESPONSIBILITY_BY_TEMPLATE[code] !== undefined);
      rows.push({
        permissions,
        member: {
          ...personRef(persona.userId),
          capacity: membership.capacity,
          responsibility: template === undefined ? 'contributor' : (RESPONSIBILITY_BY_TEMPLATE[template] ?? 'contributor'),
          canViewPricing: permissions.includes('supplier.pricing.edit') || permissions.includes('supplier.response.approve'),
          canApprove: permissions.includes('supplier.response.approve'),
          canSubmit: permissions.includes('supplier.response.submit'),
        },
      });
    }
  }
  return rows.sort((a, b) => a.member.userId - b.member.userId);
}

export function viewerOf(permissions: readonly PermissionCode[]): BidViewer {
  const has = (code: PermissionCode): boolean => permissions.includes(code);
  return {
    canEditResponse: has('supplier.response.edit'),
    canViewPricing: has('supplier.pricing.edit') || has('supplier.response.approve'),
    canEditPricing: has('supplier.pricing.edit'),
    canAssign: has('supplier.pursuit.manage'),
    canComment: has('supplier.response.edit') || has('supplier.response.approve'),
    canApprove: has('supplier.response.approve'),
    canSubmit: has('supplier.response.submit'),
  };
}

/** Adds seconds to an ISO instant (fixture arithmetic). */
export function isoPlus(instant: string, seconds: number): string {
  return new Date(Date.parse(instant) + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** A `Date` as an ISO instant without milliseconds. */
export function isoOf(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
