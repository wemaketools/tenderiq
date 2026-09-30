/**
 * Cross-fixture consistency: the reporting and records fixtures agree with the domains that own the facts they
 * summarize. Bids domain: unique bidding organizations, submitted revisions, submission states, receipts and bid
 * ids (AC-34, BR-18). Tenders domain: lot titles. Awards domain: complaint ids and the T-2026-0007 standstill end.
 */
import { describe, expect, it } from 'vitest';

import { COMPLAINTS, STANDSTILL_PERIODS } from '../awards/index.js';
import { BIDS, SUBMISSION_RECEIPTS } from '../bids/responses.js';
import { PARTICIPANTS } from '../publication/participants.js';
import { CONTRACTS } from '../contracts/core.js';
import { DEMO_AS_OF } from '../demo-clock.js';
import { EVIDENCE_ITEMS } from '../suppliers/evidence-items.js';
import { LOTS } from '../tenders/structure.js';
import { TENDERS } from '../tenders/tenders.js';
import { MILESTONES as TENDER_MILESTONES } from '../tenders/timetable.js';
import { AUDIT_EVENTS, HOLDS, RECORD_SUBJECTS } from '../records/index.js';
import {
  CONTRACT_FACTS,
  EXPORTS,
  REPORT_DEFINITIONS,
  REPORT_RUNS,
  REPORTING_AS_OF,
  SUPPLIER_DEADLINES,
  SUPPLIER_EVIDENCE,
  DASHBOARD_ATTENTION,
  DASHBOARD_COMPLAINTS,
  DASHBOARD_DEADLINES,
  LEGACY_TENDER_ID,
  LINKS,
  REPORT_ROWS,
  SEARCH_INDEX,
  SUPPLIER_OUTCOMES,
  SUPPLIER_PURSUITS,
  TENDER_FACTS,
  lotLabel,
} from './index.js';

function competingSuppliers(tenderId: number, lotId?: number): number[] {
  return [
    ...new Set(
      BIDS.filter(
        (bid) => bid.tenderId === tenderId && bid.submissionState === 'submitted' && (lotId === undefined || bid.lotIds.includes(lotId)),
      ).map((bid) => bid.supplierTenantId),
    ),
  ].sort((a, b) => a - b);
}

function countCell(row: (typeof REPORT_ROWS)[number], key: string): number | null {
  const value = row.cells[key];
  return value?.kind === 'count' ? value.value : null;
}

const participation = REPORT_ROWS.filter((row) => row.family === 'participation');

describe('participation report vs the bids domain (AC-34)', () => {
  it('counts exactly the organizations with a submitted bid on each event, once each', () => {
    // Arrange
    const events = participation.filter((row) => row.level === 'event');

    // Act / Assert
    expect(events.length).toBeGreaterThan(0);
    for (const row of events) {
      if (row.tenderId === null) throw new Error(`Participation row ${row.id} has no tender.`);
      const expected = competingSuppliers(row.tenderId);
      expect([...row.bidderTenantIds].sort((a, b) => a - b), row.id).toEqual(expected);
      expect(countCell(row, 'uniqueBidders'), row.id).toBe(expected.length);
    }
  });

  it('counts each lot’s bidders per lot from the bids domain', () => {
    const lots = participation.filter((row) => row.level === 'lot');
    expect(lots).toHaveLength(3);
    for (const row of lots) {
      const lot = TENDER_FACTS.find((tender) => tender.id === row.tenderId)?.lots.find((item) => row.id.endsWith(`-${item.number}`));
      if (lot === undefined || row.tenderId === null) throw new Error(`No lot for ${row.id}.`);
      expect([...row.bidderTenantIds].sort((a, b) => a - b), row.id).toEqual(competingSuppliers(row.tenderId, lot.id));
    }
  });

  it('counts every official receipt as a revision, never as another organization', () => {
    for (const row of participation.filter((item) => item.level === 'event')) {
      const bidIds = BIDS.filter((bid) => bid.tenderId === row.tenderId).map((bid) => bid.id);
      const receipts = SUBMISSION_RECEIPTS.filter((receipt) => bidIds.includes(receipt.bidId) && receipt.status !== 'late_rejected');
      expect(countCell(row, 'submittedRevisions'), row.id).toBe(receipts.length);
      expect(countCell(row, 'uniqueBidders') ?? 0).toBeLessThanOrEqual(receipts.length);
    }
  });

  it('includes the restricted multi-stage T-2026-0009: five receipts from three organizations', () => {
    const row = participation.find((item) => item.id === 'pa-9');
    expect(row).toBeDefined();
    if (row === undefined) return;
    expect(countCell(row, 'uniqueBidders')).toBe(3);
    expect(countCell(row, 'submittedRevisions')).toBe(5);
  });

  it('does not count withdrawn or unsubmitted bids as competing (T-2026-0008, T-2026-0002)', () => {
    const t8 = participation.find((item) => item.id === 'pa-8');
    const t2 = participation.find((item) => item.id === 'pa-2');
    const withdrawn = BIDS.find((bid) => bid.id === 20);
    const draft = BIDS.find((bid) => bid.id === 5);
    expect(withdrawn?.submissionState).toBe('withdrawn');
    expect(draft?.submissionState).toBe('not_submitted');
    expect(t8?.bidderTenantIds).not.toContain(withdrawn?.supplierTenantId);
    expect(t2?.bidderTenantIds).not.toContain(draft?.supplierTenantId);
  });

  it('takes invited, interest and no-bid counts from the publication domain participants', () => {
    for (const row of participation.filter((item) => item.level === 'event')) {
      const participants = PARTICIPANTS.filter((item) => item.tenderId === row.tenderId);
      expect(countCell(row, 'registeredInterest'), row.id).toBe(new Set(participants.map((item) => item.supplierTenantId)).size);
      expect(countCell(row, 'invited'), row.id).toBe(participants.filter((item) => item.invitationStatus !== 'not_invited').length);
    }
  });
});

describe('supplier pursuits and search vs the bids domain (SUP-01, COM-08, BR-18)', () => {
  it('links every pursuit to the supplier’s OWN bid with the bids-domain state and receipt', () => {
    for (const pursuit of SUPPLIER_PURSUITS) {
      if (pursuit.bidId === null) {
        expect(BIDS.some((bid) => bid.supplierTenantId === pursuit.supplierTenantId && bid.tenderId === pursuit.tenderId)).toBe(false);
        continue;
      }
      const bid = BIDS.find((item) => item.id === pursuit.bidId);
      expect(bid?.supplierTenantId).toBe(pursuit.supplierTenantId);
      expect(bid?.tenderId).toBe(pursuit.tenderId);
      expect(pursuit.submissionState).toBe(bid?.submissionState);
      if (pursuit.effectiveReceiptNo !== null) {
        const receipt = SUBMISSION_RECEIPTS.find((item) => item.receiptNo === pursuit.effectiveReceiptNo && item.bidId === pursuit.bidId);
        expect(receipt, `${pursuit.effectiveReceiptNo} belongs to bid ${pursuit.bidId}`).toBeDefined();
      }
    }
  });

  it('shows Tsodilo’s withdrawn T-2026-0008 bid without a receipt and Chobe’s as submitted', () => {
    const tsodilo = SUPPLIER_PURSUITS.find((row) => row.bidId === 20);
    const chobe = SUPPLIER_PURSUITS.find((row) => row.bidId === 19);
    expect(tsodilo).toMatchObject({ tenderId: 8, submissionState: 'withdrawn', effectiveReceiptNo: null });
    expect(chobe).toMatchObject({ tenderId: 8, submissionState: 'submitted', latestRevisionStatus: 'late_rejected', effectiveReceiptNo: 'RCPT-2026-000024' });
  });

  it('lists Tsodilo’s T-2026-0007 pursuit and Limpopo’s T-2026-0009 pursuit (latest round for the multi-stage event)', () => {
    expect(SUPPLIER_PURSUITS.find((row) => row.bidId === 18)).toMatchObject({ tenderId: 7, submissionState: 'submitted' });
    expect(SUPPLIER_PURSUITS.find((row) => row.tenderId === 9 && row.supplierTenantId === BIDS.find((bid) => bid.id === 25)?.supplierTenantId)).toMatchObject({ bidId: 25, effectiveReceiptNo: 'RCPT-2026-000017' });
  });

  it('opens a supplier search result on the caller’s own bid, outcome or opportunity, never a tender id as a bid id', () => {
    const supplierTenders = SEARCH_INDEX.filter((row) => row.type === 'tender' && row.visibleWith.includes('supplier.opportunities.view'));
    expect(supplierTenders.length).toBe(SUPPLIER_PURSUITS.length);
    for (const row of supplierTenders) {
      const pursuit = SUPPLIER_PURSUITS.find((item) => item.supplierTenantId === row.tenantId && item.tenderId === row.recordId);
      expect(pursuit, `${row.tenantId}:${row.recordId}`).toBeDefined();
      const hasOutcome = SUPPLIER_OUTCOMES.some((item) => item.supplierTenantId === row.tenantId && item.tenderId === row.recordId);
      const expected = hasOutcome
        ? LINKS.supplierOutcome(row.recordId)
        : pursuit?.bidId === null || pursuit === undefined
          ? LINKS.supplierOpportunity(row.recordId)
          : LINKS.supplierResponse(pursuit.bidId);
      expect(row.to).toBe(expected);
    }
  });

  it('states withdrawn, not submitted and submitted in the supplier search subtitles as the bids domain does', () => {
    const tsodiloT8 = SEARCH_INDEX.find((row) => row.to === LINKS.supplierResponse(20));
    const chobeT8 = SEARCH_INDEX.find((row) => row.to === LINKS.supplierResponse(19));
    expect(tsodiloT8?.subtitle).toContain('withdrawn');
    expect(chobeT8?.subtitle).toContain('RCPT-2026-000024');
    expect(SEARCH_INDEX.find((row) => row.to === LINKS.supplierResponse(7))?.subtitle).toContain('not submitted');
  });
});

describe('storyline alignment with the tenders and awards domains', () => {
  it('names lots exactly as the tenders domain does', () => {
    for (const tender of TENDER_FACTS) {
      for (const lot of tender.lots) {
        const owned = LOTS.find((item) => item.id === lot.id);
        expect(owned?.title, `lot ${lot.id}`).toBe(lot.title);
        expect(lotLabel(tender.id, lot.id)).toBe(`Lot ${lot.number}: ${owned?.title ?? ''}`);
      }
    }
    const lotCells = REPORT_ROWS.filter((row) => row.level === 'lot').flatMap((row) => Object.values(row.cells));
    expect(lotCells.some((value) => value.kind === 'text' && value.value.includes('wellfields'))).toBe(false);
  });

  it('points complaint links at awards-domain complaints of the same buyer', () => {
    for (const row of DASHBOARD_COMPLAINTS) {
      const complaint = COMPLAINTS.find((item) => item.detail.complaintId === row.complaintId);
      expect(complaint?.tenantId, `complaint ${row.complaintId}`).toBe(row.tenantId);
      expect(complaint?.detail.tender.tenderId).toBe(row.tenderId);
    }
    const complaintLinks = [
      ...DASHBOARD_ATTENTION.map((row) => row.to),
      ...REPORT_ROWS.map((row) => row.drillThrough),
      ...RECORD_SUBJECTS.map((row) => row.to),
      ...AUDIT_EVENTS.map((row) => row.to),
    ].filter((to): to is string => to !== null && to.startsWith('/buyer/award-cases/complaints/'));
    expect(complaintLinks.length).toBeGreaterThan(0);
    for (const to of complaintLinks) {
      const id = Number(to.split('/').pop());
      expect(COMPLAINTS.some((item) => item.detail.complaintId === id), to).toBe(true);
    }
  });

  it('states the T-2026-0007 standstill end the awards domain computed', () => {
    const period = STANDSTILL_PERIODS.find((row) => row.period.tenderId === 7)?.period;
    expect(period?.effectiveEndsAt.at).toBe('2026-10-08T15:00:00Z');
    expect(TENDER_FACTS.find((tender) => tender.id === 7)?.nextMilestoneLabel).toContain('8 Oct 2026, 17:00');
    expect(DASHBOARD_DEADLINES.find((row) => row.tenderId === 7 && row.milestone === 'standstill_end')?.at).toBe(period?.effectiveEndsAt.at);
    for (const outcome of SUPPLIER_OUTCOMES.filter((row) => row.tenderId === 7)) {
      expect(outcome.standstillEndsAt).toBe(period?.effectiveEndsAt.at);
    }
  });

  it('opens the legacy tender under legal hold on its audit trail, not on a tender page that does not exist (AC-35)', () => {
    const legacyLinks = [
      ...RECORD_SUBJECTS.filter((row) => row.subjectId === LEGACY_TENDER_ID).map((row) => row.to),
      ...HOLDS.flatMap((hold) => hold.records.filter((row) => row.entityId === LEGACY_TENDER_ID).map((row) => row.to)),
      ...REPORT_ROWS.filter((row) => row.tenderId === LEGACY_TENDER_ID).map((row) => row.drillThrough),
      ...SEARCH_INDEX.filter((row) => row.recordId === LEGACY_TENDER_ID && row.type === 'tender').map((row) => row.to),
    ];
    expect(legacyLinks.length).toBeGreaterThanOrEqual(4);
    for (const to of legacyLinks) {
      expect(to).toBe(LINKS.auditTrail('tender', LEGACY_TENDER_ID));
    }
  });
});

describe('dashboard and search facts vs the owning domains (one demo world)', () => {
  it('mirrors every register tender of the tenders domain, with its status, dimensions and estimate', () => {
    for (const tender of TENDERS.filter((row) => !row.isTemplate)) {
      const fact = TENDER_FACTS.find((row) => row.id === tender.id);
      expect(fact, tender.reference).toBeDefined();
      expect(fact, tender.reference).toMatchObject({
        tenantId: tender.tenantId,
        reference: tender.reference,
        title: tender.title,
        status: tender.status,
        categoryId: tender.categoryId,
        departmentId: tender.departmentId,
        ownerUserId: tender.ownerUserId,
      });
      expect(fact?.estimatedValue?.amount ?? null, tender.reference).toBe(tender.estimatedValue);
    }
  });

  it('takes every dashboard deadline from the tender timetables, so addenda-moved deadlines agree (T-2026-0002, T-2026-0011)', () => {
    for (const row of DASHBOARD_DEADLINES) {
      expect(
        TENDER_MILESTONES.some((milestone) => milestone.tenderId === row.tenderId && milestone.milestone === row.milestone && milestone.at === row.at),
        `${row.tenderId} ${row.milestone} ${row.at}`,
      ).toBe(true);
    }
    for (const row of SUPPLIER_DEADLINES) {
      expect(TENDER_MILESTONES.some((milestone) => milestone.tenderId === row.tenderId && milestone.milestone === row.milestone && milestone.at === row.at)).toBe(true);
    }
    expect(DASHBOARD_DEADLINES.find((row) => row.tenderId === 2 && row.milestone === 'submission_deadline')?.at).toBe('2026-10-21T10:00:00Z');
    expect(DASHBOARD_DEADLINES.find((row) => row.tenderId === 11 && row.milestone === 'submission_deadline')?.at).toBe('2026-10-23T10:00:00Z');
    expect(TENDER_FACTS.find((row) => row.id === 2)?.nextMilestoneLabel).toContain('21 Oct 2026');
  });

  it('links every supplier evidence row and search hit to an item of that supplier’s own library', () => {
    const evidenceLinks = [
      ...SUPPLIER_EVIDENCE.map((row) => ({ tenantId: row.supplierTenantId, id: row.evidenceId })),
      ...SEARCH_INDEX.filter((row) => row.to.startsWith('/supplier/evidence/')).map((row) => ({ tenantId: row.tenantId, id: Number(row.to.split('/').pop()) })),
    ];
    expect(evidenceLinks.length).toBeGreaterThan(0);
    for (const link of evidenceLinks) {
      const item = EVIDENCE_ITEMS.find((candidate) => candidate.id === link.id);
      expect(item?.tenantId, `evidence ${link.id}`).toBe(link.tenantId);
    }
    expect(SUPPLIER_EVIDENCE.find((row) => row.evidenceId === 504)).toMatchObject({ expiresAt: '2026-10-08' });
  });

  it('values the contracts as the contracts domain does', () => {
    for (const fact of CONTRACT_FACTS) {
      const contract = CONTRACTS.find((row) => row.id === fact.id);
      expect(contract, fact.reference).toMatchObject({ reference: fact.reference, title: fact.title, status: fact.status, value: fact.value });
    }
    expect(CONTRACT_FACTS.find((row) => row.reference === 'C-2026-0002')?.value).toEqual({ amount: '4668000.00', currency: 'BWP' });
  });

  it('computes every "as of" value at the single demo clock, with no activity after it', () => {
    expect(REPORTING_AS_OF).toBe(DEMO_AS_OF);
    const activity = [
      ...SEARCH_INDEX.map((row) => row.updatedAt),
      ...REPORT_DEFINITIONS.map((row) => row.updatedAt),
      ...REPORT_RUNS.map((row) => row.runAt),
      ...EXPORTS.map((row) => row.requestedAt),
      ...AUDIT_EVENTS.map((row) => row.occurredAt),
    ];
    expect(activity.filter((at) => at > DEMO_AS_OF)).toEqual([]);
  });
});
