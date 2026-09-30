/**
 * Buyer routes of the bids contract: submission monitoring and closing (BUY-19).
 *
 * Only receipt METADATA leaves these handlers (`v_bid_receipt_metadata`, DD-13): supplier legal name, receipt number,
 * time, status, document count. Drafts never appear (a draft has no receipt), and no content is ever read (BR-17).
 * Counts are unique suppliers with an effective submission in the current round, not revisions (AC-34).
 */
import type { MonitoringDetail, MonitoringRow, ReceiptMetadataRow } from '../../../contracts/bids.js';
import { bidEndpoints } from '../../../contracts/bids.js';
import type { CloseBlocker, ClosingStatus } from '../../../contracts/bids.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  BIDS,
  BID_TENDERS,
  BID_TENDER_INCIDENTS,
  RECEIPT_INVENTORY,
  RELEASED_TENDER_STATUSES,
  SUBMISSION_ATTEMPTS,
  SUBMISSION_RECEIPTS,
} from '../../fixtures/bids/index.js';
import type { FixtureBidTender, FixtureReceipt } from '../../fixtures/bids/index.js';
import { personRef } from '../../persona.js';
import { currentRound, effectiveReceipt, isoOf, legalNameOf } from './state.js';

function deadlineOf(tender: FixtureBidTender): string {
  return tender.rounds[tender.rounds.length - 1]?.deadline ?? '';
}

/**
 * True when the deadline has stopped submissions but no closing record exists yet: an open tender past its deadline,
 * or a tender whose status is already `closed` (ordinary submissions stopped at the deadline) with `closedAt` null.
 */
function awaitingClosing(tender: FixtureBidTender, now: Date): boolean {
  if (tender.status === 'closed') {
    return tender.closedAt === null;
  }
  return tender.status === 'open' && now.getTime() >= Date.parse(deadlineOf(tender));
}

function closingStatusOf(tender: FixtureBidTender, now: Date): ClosingStatus {
  if (awaitingClosing(tender, now)) {
    return 'deadline_passed';
  }
  return tender.status === 'open' ? 'open' : 'closed';
}

function receiptsOfTender(tender: FixtureBidTender): FixtureReceipt[] {
  const bidIds = new Set(BIDS.filter((bid) => bid.tenderId === tender.id).map((bid) => bid.id));
  return SUBMISSION_RECEIPTS.filter((row) => bidIds.has(row.bidId));
}

function effectiveIds(tender: FixtureBidTender): Set<number> {
  const ids = new Set<number>();
  for (const bid of BIDS.filter((row) => row.tenderId === tender.id)) {
    const receipt = effectiveReceipt(bid);
    if (receipt !== null) {
      ids.add(receipt.id);
    }
  }
  return ids;
}

/** Unique suppliers with an effective submission in the tender's current round. */
function effectiveSuppliers(tender: FixtureBidTender, lotId?: number): Set<number> {
  const round = currentRound(tender);
  const suppliers = new Set<number>();
  for (const bid of BIDS.filter((row) => row.tenderId === tender.id && row.roundType === round)) {
    if (effectiveReceipt(bid) !== null && (lotId === undefined || bid.lotIds.includes(lotId))) {
      suppliers.add(bid.supplierTenantId);
    }
  }
  return suppliers;
}

function toRow(tender: FixtureBidTender, now: Date): MonitoringRow {
  const receipts = receiptsOfTender(tender);
  const last = receipts.map((row) => row.receivedAt).sort().at(-1) ?? null;
  return {
    tenderId: tender.id,
    reference: tender.reference,
    title: tender.title,
    eventType: tender.eventType,
    participation: tender.participation,
    status: tender.status,
    owner: personRef(tender.ownerUserId),
    deadline: { at: deadlineOf(tender), timeZone: tender.officialTimeZone },
    closingStatus: closingStatusOf(tender, now),
    closedAt: tender.closedAt,
    lotCount: tender.lots.length,
    effectiveSupplierCount: effectiveSuppliers(tender).size,
    receiptCount: receipts.length,
    lastReceiptAt: last,
    incidentCount: BID_TENDER_INCIDENTS.filter((row) => row.tenderId === tender.id).length,
  };
}

function closeBlockers(tender: FixtureBidTender, now: Date): CloseBlocker[] {
  const blockers: CloseBlocker[] = [];
  if (tender.status === 'open') {
    if (!awaitingClosing(tender, now)) {
      blockers.push('DEADLINE_NOT_REACHED');
    }
  } else if (!awaitingClosing(tender, now)) {
    blockers.push('TENDER_NOT_OPEN');
  }
  if (BID_TENDER_INCIDENTS.some((row) => row.tenderId === tender.id && row.status !== 'resolved')) {
    blockers.push('UNRESOLVED_SERVICE_INCIDENT');
  }
  return blockers;
}

function toDetail(tender: FixtureBidTender, now: Date): MonitoringDetail {
  const receipts = receiptsOfTender(tender);
  const effective = effectiveIds(tender);
  const byDay = new Map<string, number>();
  for (const receipt of receipts.filter((row) => effective.has(row.id))) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: tender.officialTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(receipt.receivedAt),
    );
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const bidIds = new Set(BIDS.filter((bid) => bid.tenderId === tender.id).map((bid) => bid.id));
  const blockers = closeBlockers(tender, now);
  return {
    ...toRow(tender, now),
    officialTimeZone: tender.officialTimeZone,
    lots: tender.lots.map((lot) => ({
      lotId: lot.id,
      lotNo: lot.lotNo,
      title: lot.title,
      stage: lot.stage,
      deadline: { at: lot.deadline ?? deadlineOf(tender), timeZone: tender.officialTimeZone },
      effectiveSupplierCount: effectiveSuppliers(tender, lot.id).size,
    })),
    closedBy: tender.closedByUserId === null ? null : personRef(tender.closedByUserId),
    counts: {
      effectiveSuppliers: effectiveSuppliers(tender).size,
      received: receipts.filter((row) => row.status === 'received').length,
      superseded: receipts.filter((row) => row.status === 'superseded').length,
      withdrawn: receipts.filter((row) => row.status === 'withdrawn').length,
      lateRejected: receipts.filter((row) => row.status === 'late_rejected').length,
      selectedForEvaluation: receipts.filter((row) => row.status === 'selected_for_evaluation').length,
    },
    receiptsByDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    incidents: BID_TENDER_INCIDENTS.filter((row) => row.tenderId === tender.id).map((row) => ({
      incidentId: row.incidentId,
      title: row.title,
      severity: row.severity,
      status: row.status,
      startedAt: row.startedAt,
      resolvedAt: row.resolvedAt,
      impactNote: row.impactNote,
      buyerDecisionNote: row.buyerDecisionNote,
    })),
    lateAttempts: SUBMISSION_ATTEMPTS.filter((row) => bidIds.has(row.bidId) && row.outcome === 'failed_late' && row.completedAt !== null).map((row) => ({
      attemptId: row.id,
      supplierTenantId: row.supplierTenantId,
      supplierLegalName: legalNameOf(row.supplierTenantId),
      completedAt: row.completedAt as string,
      deadlineAtAttempt: { at: row.deadlineAtAttempt, timeZone: tender.officialTimeZone },
      lateBySeconds: Math.max(1, Math.round((Date.parse(row.completedAt as string) - Date.parse(row.deadlineAtAttempt)) / 1000)),
      exceptionDecision: null,
    })),
    canClose: blockers.length === 0,
    closeBlockers: blockers,
  };
}

function matches(q: string | undefined, ...values: string[]): boolean {
  if (q === undefined || q === '') {
    return true;
  }
  const needle = q.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(needle));
}

export function registerBuyerRoutes(app: MockApp): void {
  mockRoute(app, bidEndpoints.listMonitoring, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = BID_TENDERS.filter((tender) => tender.buyerTenantId === tenant.id && RELEASED_TENDER_STATUSES.includes(tender.status))
      .map((tender) => toRow(tender, now))
      .filter((row) => {
        if (!matches(query.q, row.reference, row.title)) return false;
        if (query.status !== undefined && !query.status.includes(row.status)) return false;
        if (query.closingStatus !== undefined && !query.closingStatus.includes(row.closingStatus)) return false;
        if (query.eventType !== undefined && !query.eventType.includes(row.eventType)) return false;
        if (query.ownerUserId !== undefined && row.owner.userId !== query.ownerUserId) return false;
        if (query.deadlineFrom !== undefined && row.deadline.at < query.deadlineFrom) return false;
        if (query.deadlineTo !== undefined && row.deadline.at > query.deadlineTo) return false;
        return true;
      });
    const sort = query.sort ?? 'deadline';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    const sign = dir === 'desc' ? -1 : 1;
    const key = (row: MonitoringRow): string | number =>
      sort === 'reference' ? row.reference : sort === 'effectiveSupplierCount' ? row.effectiveSupplierCount : sort === 'lastReceiptAt' ? (row.lastReceiptAt ?? '') : row.deadline.at;
    rows.sort((a, b) => {
      const left = key(a);
      const right = key(b);
      return sign * (typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right)));
    });
    return fixtures.page(rows);
  });

  mockRoute(app, bidEndpoints.getMonitoring, ({ requireTenant, params, fail, now }) => {
    const { tenant } = requireTenant();
    const tender = BID_TENDERS.find(
      (row) => row.id === params.tenderId && row.buyerTenantId === tenant.id && RELEASED_TENDER_STATUSES.includes(row.status),
    );
    if (tender === undefined) {
      return fail(404, 'TENDER_NOT_FOUND', 'No released tender with this id exists in your organization.');
    }
    return toDetail(tender, now);
  });

  mockRoute(app, bidEndpoints.listMonitoringReceipts, ({ requireTenant, params, query, fail, fixtures }) => {
    const { tenant } = requireTenant();
    const tender = BID_TENDERS.find(
      (row) => row.id === params.tenderId && row.buyerTenantId === tenant.id && RELEASED_TENDER_STATUSES.includes(row.status),
    );
    if (tender === undefined) {
      return fail(404, 'TENDER_NOT_FOUND', 'No released tender with this id exists in your organization.');
    }
    const effective = effectiveIds(tender);
    const effectiveOnly = query.effectiveOnly ?? true;
    const rows: ReceiptMetadataRow[] = receiptsOfTender(tender)
      .filter((receipt) => !effectiveOnly || effective.has(receipt.id))
      .flatMap((receipt) => {
        const bid = BIDS.find((row) => row.id === receipt.bidId);
        if (bid === undefined) {
          return [];
        }
        return [
          {
            receiptId: receipt.id,
            receiptNo: receipt.receiptNo,
            bidId: receipt.bidId,
            supplierTenantId: receipt.supplierTenantId,
            supplierLegalName: legalNameOf(receipt.supplierTenantId),
            receivedAt: receipt.receivedAt,
            status: receipt.status,
            documentCount: countDocuments(receipt.id),
            isEffective: effective.has(receipt.id),
            roundType: bid.roundType,
          },
        ];
      })
      .filter((row) => {
        if (!matches(query.q, row.supplierLegalName, row.receiptNo)) return false;
        if (query.status !== undefined && !query.status.includes(row.status)) return false;
        if (query.receivedFrom !== undefined && row.receivedAt < query.receivedFrom) return false;
        if (query.receivedTo !== undefined && row.receivedAt > query.receivedTo) return false;
        return true;
      });
    const sort = query.sort ?? 'receivedAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    const sign = dir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const key = (row: ReceiptMetadataRow): string => (sort === 'supplierLegalName' ? row.supplierLegalName : sort === 'receiptNo' ? row.receiptNo : row.receivedAt);
      return sign * key(a).localeCompare(key(b));
    });
    return fixtures.page(rows);
  });

  mockRoute(app, bidEndpoints.closeTender, ({ requireTenant, requirePersona, params, body, fail, now }) => {
    const access = requireTenant();
    const persona = requirePersona();
    const tender = BID_TENDERS.find(
      (row) => row.id === params.tenderId && row.buyerTenantId === access.tenant.id && RELEASED_TENDER_STATUSES.includes(row.status),
    );
    if (tender === undefined) {
      return fail(404, 'TENDER_NOT_FOUND', 'No released tender with this id exists in your organization.');
    }
    if (body.confirmation.tenantId !== access.tenant.id) {
      return fail(409, 'CONTEXT_MISMATCH', 'The confirmed organization is not the one you are acting for.');
    }
    const blockers = closeBlockers(tender, now);
    if (blockers.includes('TENDER_NOT_OPEN')) {
      return fail(409, 'TENDER_NOT_OPEN', `${tender.reference} is already ${tender.status.replace(/_/g, ' ')}.`);
    }
    if (blockers.includes('DEADLINE_NOT_REACHED')) {
      return fail(409, 'DEADLINE_NOT_REACHED', `${tender.reference} cannot close before its official deadline ${deadlineOf(tender)} (${tender.officialTimeZone}).`);
    }
    if (blockers.includes('UNRESOLVED_SERVICE_INCIDENT')) {
      return fail(409, 'UNRESOLVED_SERVICE_INCIDENT', 'A service incident affecting this tender is unresolved; record a decision before closing.');
    }
    const bidIds = new Set(BIDS.filter((bid) => bid.tenderId === tender.id).map((bid) => bid.id));
    return {
      tenderId: tender.id,
      reference: tender.reference,
      status: 'closed',
      closingStatus: 'closed',
      closedAt: isoOf(now),
      closedBy: { ...personRef(persona.userId), capacity: access.capacity },
      deadline: { at: deadlineOf(tender), timeZone: tender.officialTimeZone },
      effectiveSupplierCount: effectiveSuppliers(tender).size,
      lateAttemptCount: SUBMISSION_ATTEMPTS.filter((row) => bidIds.has(row.bidId) && row.outcome === 'failed_late').length,
      note: body.note ?? null,
    };
  });
}

function countDocuments(receiptId: number): number {
  return RECEIPT_INVENTORY.filter((row) => row.receiptId === receiptId).length;
}
