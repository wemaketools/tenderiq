/**
 * Buyer case and closeout handlers: debriefs, complaints and holds (BUY-29) and event closeout (BUY-30). Every
 * lookup is scoped to the active buyer tenant. Commands return the static outcome; nothing persists.
 */
import {
  acknowledgeComplaint,
  archiveEvent,
  assignComplaintOwner,
  closeEvent,
  declineDebrief,
  getCloseout,
  getComplaint,
  getDebrief,
  listComplaintOwnerCandidates,
  listComplaints,
  listDebriefs,
  placeComplaintHold,
  provideDebrief,
  recordComplaintAppealOutcome,
  releaseComplaintHold,
  requestEvidencePack,
  respondToComplaint,
  scheduleDebrief,
  transitionComplaint,
  updateCloseout,
} from '../../../contracts/awards.js';
import type { ComplaintDetail, ComplaintEvent, ComplaintEventType, DebriefDetail, TenderBrief } from '../../../contracts/awards.js';
import type { ComplaintsStatus } from '../../../contracts/enums.js';
import type { PersonRef } from '../../../contracts/common.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { AWARD_TENDERS, CHALLENGED_CONDUCT, CLOSEOUTS, COMPLAINTS, DEBRIEFS, tenderBrief } from '../../fixtures/awards/index.js';
import { allPersonas, findPersonaById, membershipPermissions } from '../../persona.js';
import { OPEN_DEBRIEF_STATUSES, complaintView, inDateRange, isoInstant, matchesText, sortRows } from './shared.js';

const CLOSED_COMPLAINT_STATUSES: readonly ComplaintsStatus[] = ['closed', 'withdrawn'];
const DECIDED_COMPLAINT_STATUSES: readonly ComplaintsStatus[] = ['response_issued', 'appealed', 'resolved', 'closed', 'withdrawn'];

/** Allowed generic transitions (PRD §8.3, lifecycle doc §10). */
const TRANSITIONS: Readonly<Partial<Record<ComplaintsStatus, readonly ComplaintsStatus[]>>> = {
  acknowledged: ['admissibility_review'],
  admissibility_review: ['under_investigation'],
  response_issued: ['resolved'],
  resolved: ['closed'],
  withdrawn: ['closed'],
};

function debriefIn(tenantId: number, debriefId: number): DebriefDetail | undefined {
  return DEBRIEFS.find((row) => row.tenantId === tenantId && row.detail.debriefId === debriefId)?.detail;
}

/**
 * Why a person is not independent of the conduct a complaint challenges (FR-17), or null when they are: the tender
 * owner, or anyone recorded as taking part in the challenged decision.
 */
function independenceIssue(complaint: ComplaintDetail, userId: number): string | null {
  const tenderOwnerId = AWARD_TENDERS.find((row) => row.ref.tenderId === complaint.tender.tenderId)?.ownerUserId ?? null;
  if (userId === tenderOwnerId) {
    return 'Owns the challenged tender; not independent of the challenged conduct.';
  }
  return CHALLENGED_CONDUCT.find((row) => row.complaintId === complaint.complaintId && row.userId === userId)?.note ?? null;
}

function complaintIn(tenantId: number, complaintId: number): ComplaintDetail | undefined {
  const fixture = COMPLAINTS.find((row) => row.tenantId === tenantId && row.detail.complaintId === complaintId);
  return fixture === undefined ? undefined : complaintView(fixture);
}

function withEvent(
  complaint: ComplaintDetail,
  change: Partial<ComplaintDetail>,
  event: { type: ComplaintEventType; to: ComplaintsStatus | null; note: string; actor: PersonRef; at: string; supplierVisible: boolean },
): ComplaintDetail {
  const appended: ComplaintEvent = {
    eventId: 90000 + complaint.events.length + 1,
    eventType: event.type,
    fromStatus: event.to === null ? null : complaint.status,
    toStatus: event.to,
    note: event.note,
    actor: event.actor,
    occurredAt: event.at,
    supplierVisible: event.supplierVisible,
  };
  return { ...complaint, ...change, events: [...complaint.events, appended] };
}

export function registerBuyerCaseRoutes(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Debriefs
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, listDebriefs, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = DEBRIEFS.filter((row) => row.tenantId === tenant.id)
      .map((row) => row.detail)
      .filter(
        (row) =>
          matchesText(query.q, row.tender.reference, row.tender.title, row.supplier.name) &&
          (query.status === undefined || query.status.includes(row.status)) &&
          (query.tenderId === undefined || row.tender.tenderId === query.tenderId) &&
          inDateRange(row.dueAt.at, query.dueFrom, query.dueTo),
      )
      .map(
        ({ requestNote: _n, writtenResponse: _w, effectOnDeadlines: _e, declineReason: _d, ownResult: _o, challengeInstructions: _c, ...row }) =>
          row,
      );
    return fixtures.page(
      sortRows(
        rows,
        {
          dueAt: (row) => row.dueAt.at,
          requestedAt: (row) => row.requestedAt,
          status: (row) => row.status,
          reference: (row) => row.tender.reference,
        },
        query.sort,
        query.dir,
        'dueAt',
      ),
    );
  });

  mockRoute(app, getDebrief, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    return debriefIn(tenant.id, params.debriefId) ?? notFound();
  });

  mockRoute(app, scheduleDebrief, ({ requireTenant, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const debrief = debriefIn(tenant.id, params.debriefId);
    if (debrief === undefined) {
      return notFound();
    }
    if (!OPEN_DEBRIEF_STATUSES.includes(debrief.status)) {
      return fail(409, 'DEBRIEF_NOT_OPEN', `The debrief is ${debrief.status}.`);
    }
    if (body.meetingAt > debrief.dueAt.at) {
      return fail(422, 'MEETING_AFTER_DUE_DATE', `Schedule the meeting before the debrief is due (${debrief.dueAt.at}).`);
    }
    return {
      ...debrief,
      status: 'scheduled' as const,
      meetingAt: { at: body.meetingAt, timeZone: debrief.dueAt.timeZone },
      effectOnDeadlines: body.effectOnDeadlines ?? debrief.effectOnDeadlines,
    };
  });

  mockRoute(app, provideDebrief, ({ requireTenant, requirePersona, params, body, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const debrief = debriefIn(tenant.id, params.debriefId);
    if (debrief === undefined) {
      return notFound();
    }
    if (!OPEN_DEBRIEF_STATUSES.includes(debrief.status)) {
      return fail(409, 'DEBRIEF_NOT_OPEN', `The debrief is ${debrief.status}.`);
    }
    return {
      ...debrief,
      status: 'provided' as const,
      writtenResponse: body.writtenResponse,
      effectOnDeadlines: body.effectOnDeadlines,
      providedBy: fixtures.personRef(requirePersona().userId),
    };
  });

  mockRoute(app, declineDebrief, ({ requireTenant, requirePersona, params, body, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const debrief = debriefIn(tenant.id, params.debriefId);
    if (debrief === undefined) {
      return notFound();
    }
    if (!OPEN_DEBRIEF_STATUSES.includes(debrief.status)) {
      return fail(409, 'DEBRIEF_NOT_OPEN', `The debrief is ${debrief.status}.`);
    }
    return {
      ...debrief,
      status: 'declined' as const,
      declineReason: body.reason,
      providedBy: fixtures.personRef(requirePersona().userId),
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Complaints and holds
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, listComplaints, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = COMPLAINTS.filter((row) => row.tenantId === tenant.id)
      .map(complaintView)
      .filter(
        (row) =>
          matchesText(query.q, row.reference, row.tender.reference, row.tender.title, row.complainant.name) &&
          (query.status === undefined || query.status.includes(row.status)) &&
          (query.subject === undefined || query.subject.includes(row.subject)) &&
          (query.tenderId === undefined || row.tender.tenderId === query.tenderId) &&
          (query.ownerUserId === undefined || row.caseOwner?.userId === query.ownerUserId) &&
          (query.blocking === undefined || row.isBlocking === query.blocking) &&
          inDateRange(row.receivedAt, query.receivedFrom, query.receivedTo),
      )
      .map(
        ({
          grounds: _g,
          complainantUser: _u,
          hold: _h,
          responseText: _r,
          remedy: _m,
          appealGrounds: _ag,
          appealOutcome: _ao,
          closedAt: _c,
          publicSummary: _p,
          procurementEffect: _pe,
          events: _ev,
          ...row
        }) => row,
      );
    return fixtures.page(
      sortRows(
        rows,
        {
          receivedAt: (row) => row.receivedAt,
          reference: (row) => row.reference,
          status: (row) => row.status,
          responseDueAt: (row) => row.responseDueAt?.at ?? null,
        },
        query.sort,
        query.dir,
        'receivedAt',
      ),
    );
  });

  mockRoute(app, getComplaint, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    return complaintIn(tenant.id, params.complaintId) ?? notFound();
  });

  mockRoute(app, acknowledgeComplaint, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    if (complaint.status !== 'received') {
      return fail(409, 'INVALID_COMPLAINT_TRANSITION', `The complaint is ${complaint.status}; only a received complaint is acknowledged.`);
    }
    const at = isoInstant(now);
    return withEvent(
      complaint,
      { status: 'acknowledged', acknowledgedAt: at, standingConfirmed: body.standingConfirmed, withinWindow: body.withinWindow },
      {
        type: 'acknowledged',
        to: 'acknowledged',
        note: body.note ?? (body.standingConfirmed ? 'Acknowledged; standing confirmed.' : 'Acknowledged; standing to be assessed.'),
        actor: fixtures.personRef(requirePersona().userId),
        at,
        supplierVisible: true,
      },
    );
  });

  mockRoute(app, listComplaintOwnerCandidates, ({ requireTenant, params, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    const candidates = allPersonas()
      .filter((persona) => persona.status === 'active')
      .flatMap((persona) => {
        const membership = persona.memberships.find((row) => row.tenantId === tenant.id && row.status === 'active');
        if (membership === undefined || !membershipPermissions(membership).includes('complaint.manage')) {
          return [];
        }
        const issue = independenceIssue(complaint, persona.userId);
        return [
          {
            person: fixtures.personRef(persona.userId),
            capacity: membership.capacity,
            independent: issue === null,
            note: issue,
          },
        ];
      })
      .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
    return { candidates };
  });

  mockRoute(app, assignComplaintOwner, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    if (CLOSED_COMPLAINT_STATUSES.includes(complaint.status)) {
      return fail(409, 'COMPLAINT_CLOSED', `The complaint is ${complaint.status}.`);
    }
    const issue = independenceIssue(complaint, body.caseOwnerUserId);
    if (issue !== null) {
      return fail(409, 'OWNER_NOT_INDEPENDENT', `${issue} Choose an independent case owner.`);
    }
    const owner = findPersonaById(body.caseOwnerUserId);
    const membership = owner?.memberships.find((row) => row.tenantId === tenant.id && row.status === 'active');
    if (owner === undefined || membership === undefined || !membershipPermissions(membership).includes('complaint.manage')) {
      return fail(422, 'OWNER_LACKS_PERMISSION', 'The case owner must hold complaint.manage in this organization.');
    }
    const ownerRef = fixtures.personRef(owner.userId);
    return withEvent(
      complaint,
      { caseOwner: ownerRef, independenceConfirmed: true },
      {
        type: 'owner_assigned',
        to: null,
        note: `Case owner ${ownerRef.fullName}; independence from the challenged conduct confirmed.`,
        actor: fixtures.personRef(requirePersona().userId),
        at: isoInstant(now),
        supplierVisible: false,
      },
    );
  });

  mockRoute(app, transitionComplaint, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    if (!(TRANSITIONS[complaint.status] ?? []).includes(body.toStatus)) {
      return fail(409, 'INVALID_COMPLAINT_TRANSITION', `A ${complaint.status} complaint cannot move to ${body.toStatus}.`);
    }
    if (body.toStatus === 'admissibility_review' && !complaint.standingConfirmed) {
      return fail(409, 'STANDING_NOT_ASSESSED', 'Confirm the complainant’s standing before the admissibility review.');
    }
    if (body.toStatus === 'under_investigation' && (complaint.caseOwner === null || !complaint.independenceConfirmed)) {
      return fail(409, 'INDEPENDENT_OWNER_REQUIRED', 'Assign an independent case owner before the investigation.');
    }
    if (body.toStatus === 'closed' && complaint.holdActive) {
      return fail(409, 'HOLD_STILL_ACTIVE', 'Release the complaint hold through its own decision before closing the case.');
    }
    const at = isoInstant(now);
    return withEvent(
      complaint,
      { status: body.toStatus, closedAt: body.toStatus === 'closed' ? at : complaint.closedAt },
      {
        type: body.toStatus === 'closed' ? 'closed' : 'status_changed',
        to: body.toStatus,
        note: body.note,
        actor: fixtures.personRef(requirePersona().userId),
        at,
        supplierVisible: true,
      },
    );
  });

  mockRoute(app, respondToComplaint, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    const allowed =
      complaint.status === 'under_investigation' || (complaint.status === 'admissibility_review' && body.outcome === 'inadmissible');
    if (!allowed) {
      return fail(409, 'INVALID_COMPLAINT_TRANSITION', `A ${complaint.status} complaint cannot receive a ${body.outcome} response.`);
    }
    if (complaint.caseOwner === null || !complaint.independenceConfirmed) {
      return fail(409, 'INDEPENDENT_OWNER_REQUIRED', 'Only an independent case owner may issue the response.');
    }
    return withEvent(
      complaint,
      {
        status: 'response_issued',
        outcome: body.outcome,
        responseText: body.responseText,
        remedy: body.remedy ?? null,
        publicSummary: body.publicSummary ?? complaint.publicSummary,
      },
      {
        type: 'response_issued',
        to: 'response_issued',
        note: `Response issued: ${body.outcome.replace('_', ' ')}.`,
        actor: fixtures.personRef(requirePersona().userId),
        at: isoInstant(now),
        supplierVisible: true,
      },
    );
  });

  mockRoute(app, recordComplaintAppealOutcome, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    if (complaint.status !== 'appealed') {
      return fail(409, 'INVALID_COMPLAINT_TRANSITION', `The complaint is ${complaint.status}; no appeal is pending.`);
    }
    return withEvent(
      complaint,
      { status: 'resolved', appealOutcome: body.appealOutcome },
      {
        type: 'appeal_decided',
        to: 'resolved',
        note: body.appealOutcome,
        actor: fixtures.personRef(requirePersona().userId),
        at: isoInstant(now),
        supplierVisible: true,
      },
    );
  });

  mockRoute(app, placeComplaintHold, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    if (CLOSED_COMPLAINT_STATUSES.includes(complaint.status)) {
      return fail(409, 'COMPLAINT_CLOSED', `The complaint is ${complaint.status}.`);
    }
    if (complaint.holdActive) {
      return fail(409, 'HOLD_ALREADY_ACTIVE', 'A complaint hold is already in force for this case.');
    }
    const at = isoInstant(now);
    const actor = fixtures.personRef(requirePersona().userId);
    const hold = {
      holdId: 900,
      subjectType: complaint.lot === null ? ('tender' as const) : ('lot' as const),
      subjectLabel:
        complaint.lot === null
          ? `${complaint.tender.reference} — ${complaint.tender.title}`
          : `${complaint.tender.reference} lot ${complaint.lot.lotNo} — ${complaint.lot.title}`,
      holdType: 'complaint_hold' as const,
      reason: body.reason,
      owner: complaint.caseOwner ?? actor,
      authorityNote: null,
      blockedActions: body.blockedActions,
      scopeDescription: `Blocks ${body.blockedActions.join(', ')} for ${complaint.tender.reference}. Dates are not changed by the hold.`,
      startedAt: at,
      reviewDate: body.reviewDate,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      complaintId: complaint.complaintId,
      complaintReference: complaint.reference,
    };
    return withEvent(
      complaint,
      {
        isBlocking: true,
        hold,
        holdActive: true,
        procurementEffect: { ...complaint.procurementEffect, blockedActions: body.blockedActions },
      },
      { type: 'hold_placed', to: null, note: body.reason, actor, at, supplierVisible: true },
    );
  });

  mockRoute(app, releaseComplaintHold, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const complaint = complaintIn(tenant.id, params.complaintId);
    if (complaint === undefined) {
      return notFound();
    }
    if (complaint.hold === null || !complaint.holdActive) {
      return fail(409, 'HOLD_NOT_ACTIVE', 'No complaint hold is in force for this case.');
    }
    if (!DECIDED_COMPLAINT_STATUSES.includes(complaint.status)) {
      return fail(409, 'COMPLAINT_NOT_DECIDED', `The complaint is ${complaint.status}; release the hold after the decision.`);
    }
    const at = isoInstant(now);
    const actor = fixtures.personRef(requirePersona().userId);
    return withEvent(
      complaint,
      { hold: { ...complaint.hold, releasedAt: at, releasedBy: actor, releaseReason: body.reason }, holdActive: false },
      { type: 'hold_released', to: null, note: body.reason, actor, at, supplierVisible: true },
    );
  });

  // ---------------------------------------------------------------------------------------------------
  // Event closeout
  // ---------------------------------------------------------------------------------------------------

  function closeoutIn(tenantId: number, tenderId: number) {
    return CLOSEOUTS.find((row) => row.tenantId === tenantId && row.state.tender.tenderId === tenderId)?.state;
  }

  mockRoute(app, getCloseout, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    return closeoutIn(tenant.id, params.tenderId) ?? notFound();
  });

  mockRoute(app, updateCloseout, ({ requireTenant, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const state = closeoutIn(tenant.id, params.tenderId);
    if (state === undefined) {
      return notFound();
    }
    if (state.status === 'closed' || state.status === 'archived') {
      return fail(409, 'CLOSEOUT_ALREADY_CLOSED', `The event is ${state.status}.`);
    }
    let linkedNextTender: TenderBrief | null = null;
    if (body.linkedNextTenderId !== null) {
      const linked = AWARD_TENDERS.find((row) => row.tenantId === tenant.id && row.ref.tenderId === body.linkedNextTenderId);
      if (linked === undefined || linked.ref.tenderId === params.tenderId) {
        return fail(422, 'LINKED_TENDER_NOT_FOUND', 'The linked event must be another tender of this organization.');
      }
      linkedNextTender = tenderBrief(linked.ref.tenderId);
    }
    return {
      ...state,
      lessonsLearned: body.lessonsLearned,
      retentionClass: body.retentionClass,
      marketFindings: body.marketFindings,
      nextStepDecision: body.nextStepDecision,
      linkedNextTender,
      securitiesNote: body.securitiesNote,
      gate: state.gate.map((check) =>
        check.code === 'retention_class' && body.retentionClass !== null ? { ...check, status: 'passed' as const, detail: null } : check,
      ),
    };
  });

  mockRoute(app, closeEvent, ({ requireTenant, requirePersona, params, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const state = closeoutIn(tenant.id, params.tenderId);
    if (state === undefined) {
      return notFound();
    }
    if (state.status === 'closed' || state.status === 'archived') {
      return fail(409, 'CLOSEOUT_ALREADY_CLOSED', `The event is ${state.status}.`);
    }
    if (state.isInformationOnly && (state.marketFindings === null || state.nextStepDecision === null)) {
      return fail(409, 'RFI_FINDINGS_REQUIRED', 'Record the market findings and the next-step decision first.');
    }
    const handover = state.gate.find((check) => check.code === 'handover_accepted' && check.status === 'blocking');
    const unaccepted = state.contracts.find((contract) => contract.handoverStatus !== 'accepted');
    if (handover !== undefined && unaccepted !== undefined) {
      return fail(
        409,
        'HANDOVER_NOT_ACCEPTED',
        state.blockingReasons.length > 0 ? state.blockingReasons.join(' ') : `The handover of ${unaccepted.reference} is not accepted.`,
      );
    }
    if (state.gate.some((check) => check.status === 'blocking')) {
      return fail(409, 'CLOSEOUT_BLOCKED', state.blockingReasons.join(' '));
    }
    return {
      ...state,
      closeoutId: state.closeoutId ?? 900,
      status: 'closed' as const,
      closedBy: fixtures.personRef(requirePersona().userId),
      closedAt: isoInstant(now),
    };
  });

  mockRoute(app, archiveEvent, ({ requireTenant, params, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const state = closeoutIn(tenant.id, params.tenderId);
    if (state === undefined) {
      return notFound();
    }
    if (state.status === 'archived') {
      return fail(409, 'ALREADY_ARCHIVED', `Archived on ${state.archivedAt ?? ''}.`);
    }
    if (state.status !== 'closed') {
      return fail(409, 'CLOSEOUT_NOT_CLOSED', 'Close the event before archiving it.');
    }
    if (state.retentionClass === null) {
      return fail(409, 'RETENTION_CLASS_REQUIRED', 'Set the retention classification first.');
    }
    return { ...state, status: 'archived' as const, archivedAt: isoInstant(now) };
  });

  mockRoute(app, requestEvidencePack, ({ requireTenant, requirePersona, params, body, now, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    if (closeoutIn(tenant.id, params.tenderId) === undefined) {
      return notFound();
    }
    return {
      exportId: 900,
      exportType: 'evidence_pack' as const,
      status: 'queued' as const,
      scopeDescription: body.scopeDescription,
      requestedBy: fixtures.personRef(requirePersona().userId),
      requestedAt: isoInstant(now),
      completedAt: null,
    };
  });
}
