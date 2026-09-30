/**
 * Read helpers of the bids mock handlers: which revision is working or effective, whether the submission window
 * is open, who is on the supplier's response team, and what the caller may do. Pure functions over the static
 * fixtures (`fixtures/bids`); nothing here mutates state.
 */
import type { BidsRoundType, BidRevisionsStatus, PursuitTeamMembersResponsibility } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { BidStartBlock, BidViewer, BidTeamMember } from '../../../contracts/bids.js';
import {
  BIDS,
  BID_REVISIONS,
  BID_TENDERS,
  BID_WITHDRAWALS,
  RELEASED_TENDER_STATUSES,
  SUBMISSION_ATTEMPTS,
  SUBMISSION_RECEIPTS,
  fixtureHash,
  roundDeadline,
  supplierPeople,
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

// ---------------------------------------------------------------------------------------------------------
// Started workspaces (startBid). Nothing persists (architecture-plan §3.11): the workspace a supplier opens has a
// deterministic id derived from the supplier, the tender and the variant, and every later read DERIVES the same
// empty draft (revision 1) from that id for as long as the round is open and no fixture response exists.
// ---------------------------------------------------------------------------------------------------------

/** Started workspace ids: 5000 + 200 x supplier tenant + 2 x tender (+1 for an alternative offer). */
const STARTED_BID_BASE = 5000;
const STARTED_TENANT_STRIDE = 200;

export function startedBidId(supplierTenantId: number, tenderId: number, isAlternative: boolean): number {
  return STARTED_BID_BASE + supplierTenantId * STARTED_TENANT_STRIDE + tenderId * 2 + (isAlternative ? 1 : 0);
}

function decodeStartedBidId(bidId: number): { supplierTenantId: number; tenderId: number; isAlternative: boolean } | undefined {
  const offset = bidId - STARTED_BID_BASE;
  if (offset < STARTED_TENANT_STRIDE || offset >= STARTED_TENANT_STRIDE * 100) {
    return undefined;
  }
  const rest = offset % STARTED_TENANT_STRIDE;
  const tenderId = Math.floor(rest / 2);
  return tenderId < 1 ? undefined : { supplierTenantId: Math.floor(offset / STARTED_TENANT_STRIDE), tenderId, isAlternative: rest % 2 === 1 };
}

/** Whether the tender is released to the supplier (invitation-only events only to invited suppliers). */
export function tenderVisibleTo(tender: FixtureBidTender, supplierTenantId: number): boolean {
  return (
    RELEASED_TENDER_STATUSES.includes(tender.status) &&
    (tender.invitedSupplierTenantIds === null || tender.invitedSupplierTenantIds.includes(supplierTenantId))
  );
}

/** The supplier's fixture response for the tender's current round and variant. */
export function existingBidFor(supplierTenantId: number, tender: FixtureBidTender, roundType: BidsRoundType, isAlternative: boolean): FixtureBid | undefined {
  return BIDS.find(
    (row) =>
      row.supplierTenantId === supplierTenantId &&
      row.tenderId === tender.id &&
      row.roundType === roundType &&
      row.isAlternative === isAlternative,
  );
}

/**
 * The first reason a supplier cannot open a workspace for a round and variant of the tender (the `startBid` refusal
 * order), or null. Visibility (`TENDER_NOT_FOUND`) and the caller's permission are checked by the caller.
 */
export function startBlockOf(
  supplierTenantId: number,
  tender: FixtureBidTender,
  roundType: BidsRoundType,
  isAlternative: boolean,
  now: Date,
): Exclude<BidStartBlock, 'NOT_PERMITTED'> | null {
  if (isAlternative && !tender.alternativesAllowed) return 'ALTERNATIVES_NOT_ALLOWED';
  if (tender.status !== 'open') return 'TENDER_NOT_OPEN';
  if (currentRound(tender) !== roundType) return 'ROUND_NOT_OPEN';
  if (!windowOpen(tender, roundType, now)) return 'TENDER_NOT_OPEN';
  if (existingBidFor(supplierTenantId, tender, roundType, isAlternative) !== undefined) return 'BID_ALREADY_EXISTS';
  return null;
}

/** The empty draft workspace `startBid` opens for the current round (derived again on every later read of its id). */
export function startedBid(supplierTenantId: number, tender: FixtureBidTender, isAlternative: boolean): FixtureBid {
  const roundType = currentRound(tender);
  return {
    id: startedBidId(supplierTenantId, tender.id, isAlternative),
    supplierTenantId,
    buyerTenantId: tender.buyerTenantId,
    tenderId: tender.id,
    roundType,
    lotIds: tender.lots.length === 1 ? tender.lots.map((lot) => lot.id) : [],
    isAlternative,
    isConsortium: false,
    leadMemberName: null,
    submissionState: 'not_submitted',
    bidManagerUserId: supplierPeople(supplierTenantId)?.manager ?? null,
    // Deterministic without persistence: the workspace is dated one week before its round's deadline.
    createdAt: isoPlus(roundDeadline(tender, roundType), -7 * 24 * 3600),
  };
}

function startedRevision(bid: FixtureBid, tender: FixtureBidTender): FixtureRevision {
  return {
    id: bid.id * 10 + 1,
    bidId: bid.id,
    supplierTenantId: bid.supplierTenantId,
    revisionNo: 1,
    status: 'draft',
    basedOnRevisionId: null,
    contentHash: fixtureHash(`bid:${bid.id}:rev:1:started`),
    acknowledgedTenderVersion: tender.currentVersionNo,
    internallyApprovedAt: null,
    submittedAt: null,
    createdBy: bid.bidManagerUserId ?? supplierPeople(bid.supplierTenantId)?.manager ?? 0,
    createdAt: bid.createdAt,
    updatedAt: bid.createdAt,
  };
}

/** The started workspace behind a derived id while it can still be opened; undefined otherwise. */
function startedBidById(bidId: number, now: Date): FixtureBid | undefined {
  const decoded = decodeStartedBidId(bidId);
  if (decoded === undefined || supplierPeople(decoded.supplierTenantId) === undefined) {
    return undefined;
  }
  const tender = tenderById(decoded.tenderId);
  if (tender === undefined || !tenderVisibleTo(tender, decoded.supplierTenantId)) {
    return undefined;
  }
  const block = startBlockOf(decoded.supplierTenantId, tender, currentRound(tender), decoded.isAlternative, now);
  return block === null ? startedBid(decoded.supplierTenantId, tender, decoded.isAlternative) : undefined;
}

/** A supplier's own bid (a fixture response or a started workspace), or undefined (another supplier's is not found). */
export function supplierBid(supplierTenantId: number, bidId: number, now: Date): FixtureBid | undefined {
  const fixture = BIDS.find((row) => row.id === bidId && row.supplierTenantId === supplierTenantId);
  if (fixture !== undefined) {
    return fixture;
  }
  const started = startedBidById(bidId, now);
  return started !== undefined && started.supplierTenantId === supplierTenantId ? started : undefined;
}

/** The revisions of a bid in order (a started workspace has its derived draft revision 1). */
export function revisionsOf(bid: FixtureBid): FixtureRevision[] {
  const rows = BID_REVISIONS.filter((row) => row.bidId === bid.id).sort((a, b) => a.revisionNo - b.revisionNo);
  if (rows.length > 0 || decodeStartedBidId(bid.id) === undefined) {
    return rows;
  }
  const tender = tenderById(bid.tenderId);
  return tender === undefined ? [] : [startedRevision(bid, tender)];
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
  const working = revisionsOf(bid).filter((row) => WORKING_STATUSES.includes(row.status));
  return working[working.length - 1] ?? null;
}

export function effectiveRevision(bid: FixtureBid): FixtureRevision | null {
  const receipt = effectiveReceipt(bid);
  return receipt === null ? null : (BID_REVISIONS.find((row) => row.id === receipt.revisionId) ?? null);
}

/** The revision a screen shows by default: the working one, else the effective one, else the latest. */
export function defaultRevision(bid: FixtureBid): FixtureRevision | null {
  const all = revisionsOf(bid);
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
