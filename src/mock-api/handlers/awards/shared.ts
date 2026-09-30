/**
 * Shared helpers of the awards mock handlers: tenant-scoped lookups, projections that join the fixtures, list
 * filtering and sorting. Pure functions over static fixtures; nothing is stored.
 */
import { createHash } from 'node:crypto';

import { APPROVED_LOT_OUTCOME_STATUSES } from '../../../contracts/awards.js';
import type {
  AwardOverview,
  AwardRegisterRow,
  ComplaintDetail,
  FinalAwardApprovalState,
  Hold,
  LotOutcome,
  NoticeRecipient,
  OutcomeNoticeDetail,
  OutcomeNoticeSummary,
  StandstillOverview,
} from '../../../contracts/awards.js';
import type { ComplaintsStatus, DebriefRequestsStatus } from '../../../contracts/enums.js';
import {
  AWARD_FILES,
  AWARD_HOLDS,
  AWARD_TENDERS,
  CLOSEOUTS,
  COMPLAINTS,
  DEBRIEFS,
  OUTCOME_NOTICES,
  PUBLIC_NOTICES,
  RECOMMENDATIONS,
  STANDSTILL_PERIODS,
  isHoldActive,
  lotOutcomesOfTender,
} from '../../fixtures/awards/index.js';
import type { AwardFileFixture, AwardTenderFixture, ComplaintFixture } from '../../fixtures/awards/index.js';

/** Complaint statuses that still need buyer work (the case is open). */
export const OPEN_COMPLAINT_STATUSES: readonly ComplaintsStatus[] = [
  'received',
  'acknowledged',
  'admissibility_review',
  'under_investigation',
  'response_issued',
  'appealed',
];

/** Debrief statuses that still need buyer work. */
export const OPEN_DEBRIEF_STATUSES: readonly DebriefRequestsStatus[] = ['requested', 'scheduled'];

/** An ISO instant without milliseconds (`Instant` in the contracts). */
export function isoInstant(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** The `YYYY-MM-DD` part of an instant (date filters compare on it). */
export function datePart(instant: string): string {
  return instant.slice(0, 10);
}

/** True when `instant` falls inside the optional inclusive date range. */
export function inDateRange(instant: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  if (instant === null) {
    return false;
  }
  const day = datePart(instant);
  return (from === undefined || day >= from) && (to === undefined || day <= to);
}

/** Case-insensitive "contains" over several fields. */
export function matchesText(q: string | undefined, ...fields: readonly (string | null | undefined)[]): boolean {
  if (q === undefined || q.length === 0) {
    return true;
  }
  const needle = q.toLowerCase();
  return fields.some((field) => field !== null && field !== undefined && field.toLowerCase().includes(needle));
}

type SortValue = string | number | null;

/** Sorts rows by a named key (nulls last in both directions); returns a new array. */
export function sortRows<T>(
  rows: readonly T[],
  keys: Readonly<Record<string, (row: T) => SortValue>>,
  sort: string | undefined,
  dir: 'asc' | 'desc',
  fallback: string,
): T[] {
  const key = keys[sort ?? fallback] ?? keys[fallback];
  if (key === undefined) {
    return [...rows];
  }
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = key(left);
    const b = key(right);
    if (a === b) {
      return 0;
    }
    if (a === null) {
      return 1;
    }
    if (b === null) {
      return -1;
    }
    return (a < b ? -1 : 1) * factor;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Tenant-scoped lookups (another tenant's record is simply not found)
// ---------------------------------------------------------------------------------------------------------

export function tenderIn(tenantId: number, tenderId: number): AwardTenderFixture | undefined {
  return AWARD_TENDERS.find((row) => row.tenantId === tenantId && row.ref.tenderId === tenderId);
}

export function awardFileIn(tenantId: number, tenderId: number): AwardFileFixture | undefined {
  return AWARD_FILES.find((row) => row.tenantId === tenantId && row.tenderId === tenderId);
}

export function holdsOfTender(tenderId: number): Hold[] {
  return AWARD_HOLDS.filter((row) => row.tenderId === tenderId).map((row) => row.hold);
}

export function activeHoldsOfTender(tenderId: number): Hold[] {
  return holdsOfTender(tenderId).filter(isHoldActive);
}

export function recommendationsOfTender(tenderId: number) {
  return RECOMMENDATIONS.filter((row) => row.detail.tender.tenderId === tenderId)
    .map((row) => row.detail)
    .sort((a, b) => a.version - b.version);
}

export function standstillsOfTender(tenderId: number) {
  return STANDSTILL_PERIODS.filter((row) => row.period.tenderId === tenderId).map((row) => row.period);
}

/** A standstill that still blocks final award. */
export function isStandstillActive(status: string): boolean {
  return status === 'running' || status === 'extended' || status === 'suspended';
}

export function complaintsOfTender(tenderId: number): ComplaintFixture[] {
  return COMPLAINTS.filter((row) => row.detail.tender.tenderId === tenderId);
}

/** The complaint view with its hold joined from the holds fixture. */
export function complaintView(fixture: ComplaintFixture): ComplaintDetail {
  const hold = AWARD_HOLDS.find((row) => row.hold.complaintId === fixture.detail.complaintId)?.hold ?? null;
  return { ...fixture.detail, hold, holdActive: hold !== null && isHoldActive(hold) };
}

export function noticeSummary(detail: OutcomeNoticeDetail): OutcomeNoticeSummary {
  const {
    body: _body,
    audienceDescription: _audience,
    approvalRequestId: _approval,
    disclosureReview: _review,
    recipients: _recipients,
    ...summary
  } = detail;
  return summary;
}

export function recipientCounts(recipients: readonly NoticeRecipient[]) {
  return {
    recipientCount: recipients.length,
    deliveredCount: recipients.filter((row) => row.deliveryStatus === 'delivered').length,
    failedCount: recipients.filter((row) => row.deliveryStatus === 'failed').length,
    acknowledgedCount: recipients.filter((row) => row.acknowledgedAt !== null).length,
  };
}

export function noticesOfTender(tenderId: number): OutcomeNoticeDetail[] {
  return OUTCOME_NOTICES.filter((row) => row.detail.tenderId === tenderId).map((row) => row.detail);
}

export function lotOutcomeOf(tenderId: number, lotId: number): LotOutcome | null {
  return lotOutcomesOfTender(tenderId).find((row) => row.lot.lotId === lotId) ?? null;
}

const AWARDING_OUTCOMES: readonly string[] = ['award', 'partial_award', 'conditional_award'];

/** The deterministic content hash of a lot outcome version (the exact version a final-award approval covers). */
export function lotOutcomeHash(outcome: LotOutcome): string {
  const seed = [
    'final_award',
    outcome.lotOutcomeId,
    outcome.recommendationId,
    outcome.outcome,
    outcome.supplier?.supplierTenantId ?? '',
    outcome.awardedValue === null ? '' : `${outcome.awardedValue.amount} ${outcome.awardedValue.currency}`,
    outcome.conditions ?? '',
  ].join('|');
  return createHash('sha256').update(seed).digest('hex');
}

/**
 * The final-award approval state of a lot outcome (DD-14): requestable once the intention is notified, while no
 * final-award approval exists and no active hold blocks the final award.
 */
export function finalAwardApprovalOf(tenderId: number, outcome: LotOutcome | null): FinalAwardApprovalState | null {
  if (outcome === null || !AWARDING_OUTCOMES.includes(outcome.outcome)) {
    return null;
  }
  const hold = activeHoldsOfTender(tenderId).find((row) => row.blockedActions.includes('award_final'));
  let unavailableReason: string | null = null;
  if (outcome.status === 'final_awarded') {
    unavailableReason = 'The final award is recorded.';
  } else if (outcome.finalAwardApprovalId !== null) {
    unavailableReason = 'A final-award approval is already recorded for this lot outcome.';
  } else if (outcome.status !== 'intent_notified') {
    unavailableReason = 'Available once the recommendation is approved and the intention to award is notified.';
  } else if (hold !== undefined) {
    unavailableReason = `Cannot be requested while the hold${
      hold.complaintReference === null ? '' : ` on ${hold.complaintReference}`
    } blocks the final award.`;
  }
  return {
    lotOutcomeId: outcome.lotOutcomeId,
    subjectVersion: 1,
    contentHash: lotOutcomeHash(outcome),
    approvalRequestId: outcome.finalAwardApprovalId,
    requestable: unavailableReason === null,
    unavailableReason,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------------------------------------

export function awardOverview(tender: AwardTenderFixture, file: AwardFileFixture, ownerRef: AwardOverview['owner']): AwardOverview {
  const tenderId = tender.ref.tenderId;
  const recommendations = recommendationsOfTender(tenderId);
  const latest = recommendations.at(-1);
  const periods = standstillsOfTender(tenderId);
  return {
    tender: tender.ref,
    owner: ownerRef,
    awardModel: tender.awardModel,
    lots: tender.lots.map((lot) => {
      const period = periods.find((row) => row.lot?.lotId === lot.lotId) ?? null;
      const outcome = lotOutcomeOf(tenderId, lot.lotId);
      return {
        lot: { lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title },
        stage: lot.stage,
        outcome,
        standstillStatus: period?.status ?? null,
        standstillEndsAt: period?.effectiveEndsAt ?? null,
        finalAwardGate: [...(file.lotGates[lot.lotId] ?? [])],
        finalAwardApproval: finalAwardApprovalOf(tenderId, outcome),
      };
    }),
    recommendations: recommendations.map((row) => ({
      recommendationId: row.recommendationId,
      version: row.version,
      status: row.status,
      lotNos: row.lotOutcomes.map((outcome) => outcome.lot.lotNo),
      createdAt: row.createdAt,
      decidedAt: row.approval.decidedAt,
    })),
    reconciliation: latest?.reconciliation ?? null,
    holds: holdsOfTender(tenderId),
    openComplaintCount: complaintsOfTender(tenderId).filter((row) => OPEN_COMPLAINT_STATUSES.includes(row.detail.status)).length,
    openDebriefCount: DEBRIEFS.filter(
      (row) => row.detail.tender.tenderId === tenderId && OPEN_DEBRIEF_STATUSES.includes(row.detail.status),
    ).length,
    publicNoticeStatus: PUBLIC_NOTICES.find((row) => row.notice.tenderId === tenderId)?.notice.status ?? null,
    closeoutStatus: CLOSEOUTS.find((row) => row.state.tender.tenderId === tenderId)?.state.status ?? null,
    nextStep: file.nextStep,
  };
}

export function registerRow(overview: AwardOverview, updatedAt: string): AwardRegisterRow {
  const latest = overview.recommendations.at(-1);
  const running = overview.lots.find((lot) => lot.standstillStatus !== null && isStandstillActive(lot.standstillStatus));
  const anyStandstill = running ?? overview.lots.find((lot) => lot.standstillStatus !== null);
  const outcomes = overview.lots.map((lot) => lot.outcome).filter((outcome): outcome is LotOutcome => outcome !== null);
  return {
    tender: overview.tender,
    owner: overview.owner,
    lotCount: overview.lots.length,
    lotsWithOutcome: outcomes.filter((outcome) => APPROVED_LOT_OUTCOME_STATUSES.includes(outcome.status)).length,
    lotsWithProposedOutcome: outcomes.filter((outcome) => outcome.status === 'recommended').length,
    lotsFinalAwarded: outcomes.filter((outcome) => outcome.status === 'final_awarded').length,
    latestRecommendation:
      latest === undefined ? null : { recommendationId: latest.recommendationId, version: latest.version, status: latest.status },
    value: overview.reconciliation?.value ?? null,
    standstillStatus: anyStandstill?.standstillStatus ?? null,
    standstillEndsAt: anyStandstill?.standstillEndsAt ?? null,
    activeHoldCount: overview.holds.filter(isHoldActive).length,
    openComplaintCount: overview.openComplaintCount,
    closeoutStatus: overview.closeoutStatus,
    nextStep: overview.nextStep,
    updatedAt,
  };
}

export function standstillOverview(tender: AwardTenderFixture, file: AwardFileFixture): StandstillOverview {
  const tenderId = tender.ref.tenderId;
  const holds = holdsOfTender(tenderId);
  const blocked = new Set(holds.filter(isHoldActive).flatMap((hold) => hold.blockedActions));
  return {
    tender: tender.ref,
    policy: tender.policy,
    periods: standstillsOfTender(tenderId),
    holds,
    blockedActions: [...blocked],
    lotReadiness: tender.lots.map((lot) => ({
      lot: { lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title },
      lotOutcomeId: lotOutcomeOf(tenderId, lot.lotId)?.lotOutcomeId ?? null,
      checks: [...(file.lotGates[lot.lotId] ?? [])],
    })),
  };
}
