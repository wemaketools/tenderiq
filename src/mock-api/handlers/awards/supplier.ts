/**
 * Supplier outcome and complaint handlers (SUP-21, SUP-22). Audience isolation (PRD §4.3): a supplier sees only
 * the notices addressed to its own organization, its own debrief and result, and its own complaints (across
 * buyers). Other suppliers' recipients, scores, debriefs and complaints never leave the handler, and internal case
 * events (`supplierVisible: false`) are removed.
 */
import {
  acceptOutcomeNoticeTerms,
  acknowledgeOutcomeNotice,
  appealComplaint,
  createComplaint,
  getSupplierComplaint,
  getSupplierOutcome,
  listComplaintTenders,
  listSupplierComplaints,
  listSupplierOutcomes,
  requestDebrief,
  withdrawComplaint,
} from '../../../contracts/awards.js';
import type {
  SupplierComplaintDetail,
  SupplierComplaintRow,
  SupplierDebrief,
  SupplierLotResult,
  SupplierOutcomeDetail,
  SupplierOutcomeNotice,
  SupplierOutcomeRow,
} from '../../../contracts/awards.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  AWARD_TENDERS,
  COMPLAINTS,
  DEBRIEFS,
  OUTCOME_NOTICES,
  SUPPLIER_OUTCOMES,
  buyer,
  deadline,
  lotRef,
  tenderBrief,
} from '../../fixtures/awards/index.js';
import type { ComplaintFixture, SupplierOutcomeFixture } from '../../fixtures/awards/index.js';
import { OPEN_COMPLAINT_STATUSES, complaintView, inDateRange, isoInstant, matchesText, sortRows } from './shared.js';

/** Lot results without a debrief: awards, intentions, pending lots and preferred-bidder states (not outcomes). */
const NO_DEBRIEF_RESULTS: readonly SupplierLotResult[] = ['awarded', 'intent_to_award', 'pending', 'preferred_bidder', 'preferred_withdrawn'];

function noticesFor(fixture: SupplierOutcomeFixture): SupplierOutcomeNotice[] {
  const awarded = fixture.core.lots.some((lot) => lot.result === 'awarded');
  return OUTCOME_NOTICES.filter(
    (row) => row.tenantId === fixture.tenantId && fixture.noticeIds.includes(row.detail.noticeId) && row.detail.status === 'issued',
  ).flatMap((row) => {
    const recipient = row.detail.recipients.find((entry) => entry.supplier.supplierTenantId === fixture.supplierTenantId);
    if (recipient === undefined || row.detail.issuedAt === null) {
      return [];
    }
    return [
      {
        noticeId: row.detail.noticeId,
        noticeType: row.detail.noticeType,
        title: row.detail.title,
        body: row.detail.body,
        lotNos: row.detail.lotNos,
        issuedAt: row.detail.issuedAt,
        requiresAcknowledgment: row.detail.requiresAcknowledgment,
        hasTerms: row.hasTerms && awarded,
        acknowledgedAt: recipient.acknowledgedAt,
        acknowledgedBy: recipient.acknowledgedBy,
        termsAcceptedAt: recipient.termsAcceptedAt,
      },
    ];
  });
}

function debriefFor(fixture: SupplierOutcomeFixture): SupplierDebrief | null {
  const debrief = DEBRIEFS.find(
    (row) =>
      row.tenantId === fixture.tenantId &&
      row.supplierTenantId === fixture.supplierTenantId &&
      row.detail.tender.tenderId === fixture.core.tenderId,
  )?.detail;
  if (debrief === undefined) {
    return null;
  }
  return {
    debriefId: debrief.debriefId,
    status: debrief.status,
    requestedBy: debrief.requestedBy,
    requestedAt: debrief.requestedAt,
    dueAt: debrief.dueAt,
    meetingAt: debrief.meetingAt,
    writtenResponse: debrief.writtenResponse,
    effectOnDeadlines: debrief.effectOnDeadlines,
    declineReason: debrief.declineReason,
    // The supplier's own result is released with the debrief (AC-27): never before it is provided.
    ownResult: debrief.status === 'provided' ? debrief.ownResult : null,
  };
}

function complaintsFor(supplierTenantId: number, buyerTenantId: number, tenderId: number): ComplaintFixture[] {
  return COMPLAINTS.filter(
    (row) => row.supplierTenantId === supplierTenantId && row.tenantId === buyerTenantId && row.detail.tender.tenderId === tenderId,
  );
}

function outcomeDetail(fixture: SupplierOutcomeFixture): SupplierOutcomeDetail {
  const notices = noticesFor(fixture);
  const debrief = debriefFor(fixture);
  const complaints = complaintsFor(fixture.supplierTenantId, fixture.tenantId, fixture.core.tenderId);
  const latest = notices.map((row) => row.issuedAt).sort().at(-1) ?? '2026-01-01T00:00:00Z';
  return {
    ...fixture.core,
    latestNoticeAt: latest,
    awaitingAcknowledgment: notices.filter((row) => row.requiresAcknowledgment && row.acknowledgedAt === null).length,
    debriefStatus: debrief?.status ?? null,
    openComplaintCount: complaints.filter((row) => OPEN_COMPLAINT_STATUSES.includes(row.detail.status)).length,
    notices,
    debrief,
    complaints: complaints.map((row) => ({ complaintId: row.detail.complaintId, reference: row.detail.reference, status: row.detail.status })),
  };
}

function outcomeRow(detail: SupplierOutcomeDetail): SupplierOutcomeRow {
  return {
    tenderId: detail.tenderId,
    buyer: detail.buyer,
    reference: detail.reference,
    title: detail.title,
    result: detail.result,
    lots: detail.lots,
    latestNoticeAt: detail.latestNoticeAt,
    standstillEndsAt: detail.standstillEndsAt,
    awaitingAcknowledgment: detail.awaitingAcknowledgment,
    debriefStatus: detail.debriefStatus,
    openComplaintCount: detail.openComplaintCount,
  };
}

function supplierComplaintDetail(fixture: ComplaintFixture): SupplierComplaintDetail {
  const view = complaintView(fixture);
  const tenant = AWARD_TENDERS.find((row) => row.ref.tenderId === view.tender.tenderId && row.tenantId === fixture.tenantId);
  return {
    complaintId: view.complaintId,
    reference: view.reference,
    buyer: buyer(tenant?.buyerSlug ?? 'kwu'),
    tender: view.tender,
    lot: view.lot,
    subject: view.subject,
    status: view.status,
    receivedAt: view.receivedAt,
    acknowledgedAt: view.acknowledgedAt,
    outcome: view.outcome,
    procurementHoldActive: view.holdActive,
    responseDueAt: view.responseDueAt,
    grounds: view.grounds,
    complainantUser: view.complainantUser,
    withinWindow: view.withinWindow,
    responseText: view.responseText,
    remedy: view.remedy,
    appealGrounds: view.appealGrounds,
    appealOutcome: view.appealOutcome,
    appealAvailable: view.status === 'response_issued' && fixture.appealDeadline !== null,
    appealDeadline: fixture.appealDeadline === null ? null : deadline(fixture.appealDeadline),
    closedAt: view.closedAt,
    events: view.events.filter((event) => event.supplierVisible),
  };
}

function supplierComplaintRow(detail: SupplierComplaintDetail): SupplierComplaintRow {
  return {
    complaintId: detail.complaintId,
    reference: detail.reference,
    buyer: detail.buyer,
    tender: detail.tender,
    lot: detail.lot,
    subject: detail.subject,
    status: detail.status,
    receivedAt: detail.receivedAt,
    acknowledgedAt: detail.acknowledgedAt,
    outcome: detail.outcome,
    procurementHoldActive: detail.procurementHoldActive,
    responseDueAt: detail.responseDueAt,
  };
}

export function registerSupplierRoutes(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Outcomes and debriefs (SUP-21)
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, listSupplierOutcomes, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = SUPPLIER_OUTCOMES.filter((row) => row.supplierTenantId === tenant.id)
      .map(outcomeDetail)
      .filter(
        (row) =>
          matchesText(query.q, row.reference, row.title, row.buyer.name) &&
          (query.result === undefined || query.result.includes(row.result)) &&
          (query.awaitingAcknowledgment === undefined || (row.awaitingAcknowledgment > 0) === query.awaitingAcknowledgment) &&
          inDateRange(row.latestNoticeAt, query.noticeFrom, query.noticeTo),
      )
      .map(outcomeRow);
    return fixtures.page(
      sortRows(
        rows,
        { latestNoticeAt: (row) => row.latestNoticeAt, reference: (row) => row.reference, title: (row) => row.title },
        query.sort,
        query.dir,
        'latestNoticeAt',
      ),
    );
  });

  mockRoute(app, getSupplierOutcome, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const fixture = SUPPLIER_OUTCOMES.find((row) => row.supplierTenantId === tenant.id && row.core.tenderId === params.tenderId);
    return fixture === undefined ? notFound() : outcomeDetail(fixture);
  });

  function ownNotice(supplierTenantId: number, noticeId: number) {
    const outcome = SUPPLIER_OUTCOMES.find((row) => row.supplierTenantId === supplierTenantId && row.noticeIds.includes(noticeId));
    if (outcome === undefined) {
      return undefined;
    }
    return noticesFor(outcome).find((row) => row.noticeId === noticeId);
  }

  mockRoute(app, acknowledgeOutcomeNotice, ({ requireTenant, requirePersona, params, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const notice = ownNotice(tenant.id, params.noticeId);
    if (notice === undefined) {
      return notFound();
    }
    if (!notice.requiresAcknowledgment) {
      return fail(409, 'ACKNOWLEDGMENT_NOT_REQUIRED', 'This notice is for information and needs no acknowledgment.');
    }
    if (notice.acknowledgedAt !== null) {
      return fail(409, 'NOTICE_ALREADY_ACKNOWLEDGED', `Acknowledged on ${notice.acknowledgedAt} by ${notice.acknowledgedBy?.fullName ?? 'your organization'}.`);
    }
    return {
      noticeId: notice.noticeId,
      acknowledgedAt: isoInstant(now),
      acknowledgedBy: fixtures.personRef(requirePersona().userId),
      termsAcceptedAt: null,
    };
  });

  mockRoute(app, acceptOutcomeNoticeTerms, ({ requireTenant, params, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const notice = ownNotice(tenant.id, params.noticeId);
    if (notice === undefined) {
      return notFound();
    }
    if (!notice.hasTerms) {
      return fail(409, 'NOTICE_HAS_NO_TERMS', 'This notice has no terms to accept.');
    }
    if (notice.acknowledgedAt === null || notice.acknowledgedBy === null) {
      return fail(409, 'NOTICE_NOT_ACKNOWLEDGED', 'Acknowledge the notice before accepting its terms.');
    }
    if (notice.termsAcceptedAt !== null) {
      return fail(409, 'TERMS_ALREADY_ACCEPTED', `The terms were accepted on ${notice.termsAcceptedAt}.`);
    }
    return {
      noticeId: notice.noticeId,
      acknowledgedAt: notice.acknowledgedAt,
      acknowledgedBy: notice.acknowledgedBy,
      termsAcceptedAt: isoInstant(now),
    };
  });

  mockRoute(app, requestDebrief, ({ requireTenant, requirePersona, params, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const fixture = SUPPLIER_OUTCOMES.find((row) => row.supplierTenantId === tenant.id && row.core.tenderId === params.tenderId);
    if (fixture === undefined) {
      return notFound();
    }
    if (fixture.core.lots.every((lot) => NO_DEBRIEF_RESULTS.includes(lot.result))) {
      return fail(409, 'DEBRIEF_NOT_AVAILABLE', 'Debriefings are offered on unsuccessful or cancelled lots once the outcome is notified.');
    }
    const existing = debriefFor(fixture);
    if (existing !== null) {
      return fail(409, 'DEBRIEF_ALREADY_REQUESTED', `A debrief was requested on ${existing.requestedAt} and is ${existing.status}.`);
    }
    if (!fixture.core.canRequestDebrief || fixture.core.debriefDeadline === null) {
      return fail(409, 'DEBRIEF_WINDOW_CLOSED', 'The debrief window stated in the outcome notice has closed.');
    }
    return {
      debriefId: 900,
      status: 'requested' as const,
      requestedBy: fixtures.personRef(requirePersona().userId),
      requestedAt: isoInstant(now),
      dueAt: fixture.core.debriefDeadline,
      meetingAt: null,
      writtenResponse: null,
      effectOnDeadlines: 'To be assessed by the buyer when the debrief is scheduled.',
      declineReason: null,
      ownResult: null,
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Complaints and appeals (SUP-22)
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, listSupplierComplaints, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = COMPLAINTS.filter((row) => row.supplierTenantId === tenant.id)
      .map(supplierComplaintDetail)
      .filter(
        (row) =>
          matchesText(query.q, row.reference, row.tender.reference, row.tender.title, row.buyer.name) &&
          (query.status === undefined || query.status.includes(row.status)) &&
          (query.subject === undefined || query.subject.includes(row.subject)) &&
          inDateRange(row.receivedAt, query.receivedFrom, query.receivedTo),
      )
      .map(supplierComplaintRow);
    return fixtures.page(
      sortRows(
        rows,
        { receivedAt: (row) => row.receivedAt, reference: (row) => row.reference, status: (row) => row.status },
        query.sort,
        query.dir,
        'receivedAt',
      ),
    );
  });

  mockRoute(app, getSupplierComplaint, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const fixture = COMPLAINTS.find((row) => row.supplierTenantId === tenant.id && row.detail.complaintId === params.complaintId);
    return fixture === undefined ? notFound() : supplierComplaintDetail(fixture);
  });

  mockRoute(app, listComplaintTenders, ({ requireTenant, fixtures }) => {
    const { tenant } = requireTenant();
    const tenders = AWARD_TENDERS.filter(
      (tender) =>
        tender.bidders.some((bidder) => fixtures.tenantBySlug(bidder.supplierSlug)?.id === tenant.id) ||
        (tender.ref.status === 'open' && tender.ref.procedure === 'open'),
    )
      .map((tender) => {
        const outcome = SUPPLIER_OUTCOMES.find(
          (row) => row.supplierTenantId === tenant.id && row.core.tenderId === tender.ref.tenderId,
        );
        return {
          tenderId: tender.ref.tenderId,
          buyer: buyer(tender.buyerSlug),
          reference: tender.ref.reference,
          title: tender.ref.title,
          status: tender.ref.status,
          lots: tender.lots.map((lot) => lotRef(lot.lotId)),
          complaintDeadline: outcome?.core.complaintDeadline ?? null,
        };
      })
      .sort((a, b) => a.reference.localeCompare(b.reference));
    return { tenders };
  });

  mockRoute(app, createComplaint, ({ requireTenant, requirePersona, body, now, fail, fixtures }) => {
    const { tenant } = requireTenant();
    const tender = AWARD_TENDERS.find((row) => row.ref.tenderId === body.tenderId);
    const participates =
      tender !== undefined &&
      (tender.bidders.some((bidder) => fixtures.tenantBySlug(bidder.supplierSlug)?.id === tenant.id) ||
        (tender.ref.status === 'open' && tender.ref.procedure === 'open'));
    if (tender === undefined || !participates) {
      return fail(422, 'TENDER_NOT_AVAILABLE', 'You can complain only about a tender you can take part in.');
    }
    if (body.lotId !== undefined && !tender.lots.some((lot) => lot.lotId === body.lotId)) {
      return fail(422, 'LOT_NOT_IN_TENDER', `Lot ${body.lotId} is not a lot of ${tender.ref.reference}.`);
    }
    const duplicate = COMPLAINTS.find(
      (row) =>
        row.supplierTenantId === tenant.id &&
        row.detail.tender.tenderId === body.tenderId &&
        row.detail.subject === body.subject &&
        OPEN_COMPLAINT_STATUSES.includes(row.detail.status),
    );
    if (duplicate !== undefined) {
      return fail(409, 'DUPLICATE_OPEN_COMPLAINT', `${duplicate.detail.reference} on the same subject is still open.`);
    }
    const persona = requirePersona();
    const at = isoInstant(now);
    const sequence = COMPLAINTS.filter((row) => row.tenantId === tender.tenantId).length + 1;
    const actor = fixtures.personRef(persona.userId);
    return {
      complaintId: 900,
      reference: `CMP-2026-${String(sequence).padStart(4, '0')}`,
      buyer: buyer(tender.buyerSlug),
      tender: tenderBrief(tender.ref.tenderId),
      lot: body.lotId === undefined ? null : lotRef(body.lotId),
      subject: body.subject,
      status: 'received' as const,
      receivedAt: at,
      acknowledgedAt: null,
      outcome: null,
      procurementHoldActive: false,
      responseDueAt: null,
      grounds: body.grounds,
      complainantUser: actor,
      withinWindow: true,
      responseText: null,
      remedy: null,
      appealGrounds: null,
      appealOutcome: null,
      appealAvailable: false,
      appealDeadline: null,
      closedAt: null,
      events: [
        {
          eventId: 90001,
          eventType: 'received' as const,
          fromStatus: null,
          toStatus: 'received' as const,
          note: 'Complaint received. The buyer assesses the complaint window and your standing when it acknowledges the case.',
          actor,
          occurredAt: at,
          supplierVisible: true,
        },
      ],
    };
  });

  mockRoute(app, appealComplaint, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const fixture = COMPLAINTS.find((row) => row.supplierTenantId === tenant.id && row.detail.complaintId === params.complaintId);
    if (fixture === undefined) {
      return notFound();
    }
    const detail = supplierComplaintDetail(fixture);
    if (!detail.appealAvailable) {
      return fail(409, 'APPEAL_NOT_AVAILABLE', `The complaint is ${detail.status}; an appeal is possible only after a response.`);
    }
    if (detail.appealDeadline !== null && isoInstant(now) > detail.appealDeadline.at) {
      return fail(409, 'APPEAL_WINDOW_CLOSED', `The appeal window closed on ${detail.appealDeadline.at}.`);
    }
    const at = isoInstant(now);
    return {
      ...detail,
      status: 'appealed' as const,
      appealGrounds: body.appealGrounds,
      appealAvailable: false,
      events: [
        ...detail.events,
        {
          eventId: 90000 + detail.events.length + 1,
          eventType: 'appeal_lodged' as const,
          fromStatus: detail.status,
          toStatus: 'appealed' as const,
          note: 'Appeal lodged.',
          actor: fixtures.personRef(requirePersona().userId),
          occurredAt: at,
          supplierVisible: true,
        },
      ],
    };
  });

  mockRoute(app, withdrawComplaint, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const fixture = COMPLAINTS.find((row) => row.supplierTenantId === tenant.id && row.detail.complaintId === params.complaintId);
    if (fixture === undefined) {
      return notFound();
    }
    const detail = supplierComplaintDetail(fixture);
    if (!OPEN_COMPLAINT_STATUSES.includes(detail.status)) {
      return fail(409, 'COMPLAINT_ALREADY_CLOSED', `The complaint is ${detail.status}.`);
    }
    const at = isoInstant(now);
    return {
      ...detail,
      status: 'withdrawn' as const,
      outcome: 'withdrawn' as const,
      appealAvailable: false,
      events: [
        ...detail.events,
        {
          eventId: 90000 + detail.events.length + 1,
          eventType: 'withdrawn' as const,
          fromStatus: detail.status,
          toStatus: 'withdrawn' as const,
          note: body.reason,
          actor: fixtures.personRef(requirePersona().userId),
          occurredAt: at,
          supplierVisible: true,
        },
      ],
    };
  });
}
