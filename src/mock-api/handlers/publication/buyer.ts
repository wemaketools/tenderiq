/**
 * Mock handlers of the buyer publication and participant screens (BUY-14, BUY-15; FR-08; AC-33; DD-15, DD-41,
 * DD-42).
 *
 * Every read is scoped to the active buyer tenant: another buyer's tender answers TENDER_NOT_FOUND (it is never
 * revealed). The buyer sees participant state and the bid intent the supplier chose to share, never supplier
 * drafts or pursuits. Commands return the static outcome the fixture state implies; nothing is persisted.
 */
import type {
  InvitationCandidate,
  ParticipantDetail,
  ParticipantRow,
  PublicationOverview,
  PublicationRow,
  ReadinessCheck,
} from '../../../contracts/publication.js';
import {
  cancelScheduledPublication,
  decideParticipantAccess,
  distributeInvitations,
  getParticipant,
  getParticipantSummary,
  getPublicationOverview,
  inviteSupplier,
  listInvitationCandidates,
  listParticipants,
  listPublications,
  publishTender,
  reconcileExternalPublication,
  remindParticipant,
  replaceParticipantContact,
  resendInvitation,
  retryExternalPublication,
} from '../../../contracts/publication.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { PUBLICATIONS, QUALIFICATION_STATUSES, SUPPLIER_PROFILES } from '../../fixtures/publication.js';
import type { FixtureParticipant, FixturePublication, FixtureTender } from '../../fixtures/publication.js';
import { allPersonas, allTenants, findTenantById } from '../../persona.js';
import {
  buyerLabel,
  categoryOf,
  closingAt,
  currentPublicationVersion,
  inDateRange,
  isAdvertised,
  isInvertedRange,
  isPubliclyVisible,
  isoInstant,
  officialText,
  latestDeliveryStatus,
  matchesText,
  noticePath,
  outstandingAcknowledgments,
  participantHistory,
  participantRow,
  participantsOf,
  personOf,
  publicationException,
  publicationRow,
  publicationsOf,
  requiredAcknowledgments,
  requiresConfidentiality,
  sortRows,
  supplierParty,
  tenderById,
  tenderLabel,
} from './projections.js';

type Fail = (status: number, code: string, detail?: string) => never;

/** Statuses in which participants can still be managed. */
const MANAGEABLE: ReadonlySet<string> = new Set(['ready', 'open']);

function ownTender(tenantId: number, tenderId: number, fail: Fail): FixtureTender {
  const tender = tenderById(tenderId);
  if (tender === undefined || tender.tenantId !== tenantId) {
    return fail(404, 'TENDER_NOT_FOUND', 'No tender with this id in the active organization.');
  }
  return tender;
}

function ownParticipant(tender: FixtureTender, participantId: number, fail: Fail): FixtureParticipant {
  const participant = participantsOf(tender.id).find((entry) => entry.id === participantId);
  if (participant === undefined) {
    return fail(404, 'PARTICIPANT_NOT_FOUND', 'No participant with this id in the tender.');
  }
  return participant;
}

function ownPublication(tenantId: number, publicationId: number, fail: Fail): FixturePublication {
  const publication = PUBLICATIONS.find((entry) => entry.id === publicationId && entry.tenantId === tenantId);
  if (publication === undefined) {
    return fail(404, 'PUBLICATION_NOT_FOUND', 'No publication with this id in the active organization.');
  }
  return publication;
}

function qualificationOf(tender: FixtureTender, supplierTenantId: number) {
  if (tender.qualificationProgram === null) {
    return null;
  }
  const status = QUALIFICATION_STATUSES.find(
    (entry) => entry.buyerTenantId === tender.tenantId && entry.supplierTenantId === supplierTenantId && entry.programName === tender.qualificationProgram,
  );
  return {
    programName: tender.qualificationProgram,
    effectiveStatus: status?.effectiveStatus ?? ('not_assessed' as const),
    effectiveTo: status?.effectiveTo ?? null,
    conditions: status?.conditions ?? null,
  };
}

function isQualified(status: string | undefined): boolean {
  return status === 'qualified' || status === 'qualified_with_conditions';
}

function publicationChecks(tender: FixtureTender, rows: readonly PublicationRow[]): ReadinessCheck[] {
  const approval = tender.releaseApproval;
  const released = tender.releasedAt !== null;
  const checks: ReadinessCheck[] = [];
  checks.push(
    !tender.releaseApprovalRequired
      ? { id: 'release_approval', label: 'Release approval', status: 'passed', detail: 'Not required by the organization’s procurement rules.' }
      : released
      ? { id: 'release_approval', label: 'Release approval', status: 'passed', detail: `Approved release of revision ${approval.subjectVersion ?? 1}.` }
      : approval.status === 'approved' && approval.subjectVersion === tender.draftRevision
        ? { id: 'release_approval', label: 'Release approval', status: 'passed', detail: `Approved for draft revision ${tender.draftRevision}.` }
        : {
            id: 'release_approval',
            label: 'Release approval',
            status: 'blocking',
            detail: approval.invalidatedReason ?? 'The release package has no current approval.',
          },
  );
  checks.push(
    released
      ? { id: 'tender_state', label: 'Tender state', status: 'passed', detail: `Released on ${officialText(tender.releasedAt ?? '', tender.officialTimeZone)}.` }
      : tender.status === 'ready'
        ? { id: 'tender_state', label: 'Tender state', status: 'passed', detail: 'Ready for release.' }
        : { id: 'tender_state', label: 'Tender state', status: 'blocking', detail: 'Only a tender in the Ready state can be published.' },
  );
  if (tender.scheduledReleaseAt !== null && tender.submissionDeadline !== null) {
    checks.push({
      id: 'schedule',
      label: 'Release date before the deadline',
      status: tender.scheduledReleaseAt < tender.submissionDeadline ? 'passed' : 'blocking',
      detail: null,
    });
  }
  checks.push(
    tender.publicationHold
      ? { id: 'holds', label: 'Holds', status: 'blocking', detail: 'An active hold blocks publication.' }
      : { id: 'holds', label: 'Holds', status: 'passed', detail: 'No hold blocks publication.' },
  );
  const external = rows.filter((row) => row.channel === 'external_notice' && row.isCurrentVersion);
  if (released && external.length > 0) {
    const failed = external.find((row) => row.status === 'failed');
    const pending = external.find((row) => row.status === 'awaiting_confirmation' || (row.status === 'confirmed' && !row.reconciled));
    checks.push(
      failed !== undefined
        ? {
            id: 'external_confirmation',
            label: 'External notice confirmed',
            status: 'blocking',
            detail: `Version ${failed.versionNo} failed: ${(failed.failureReason ?? 'no reason reported').replace(/\.$/, '')}. The event is not advertised until it is reconciled.`,
          }
        : pending !== undefined
          ? { id: 'external_confirmation', label: 'External notice confirmed', status: 'warning', detail: 'Awaiting confirmation from the external notice service.' }
          : { id: 'external_confirmation', label: 'External notice confirmed', status: 'passed', detail: 'Confirmed and reconciled with the official version.' },
    );
  }
  if (tender.participation !== 'open') {
    const failedDeliveries = participantsOf(tender.id).filter((participant) => latestDeliveryStatus(participant) === 'failed').length;
    checks.push({
      id: 'invitation_delivery',
      label: 'Invitations delivered',
      status: failedDeliveries > 0 ? 'warning' : 'passed',
      detail: failedDeliveries > 0 ? `${failedDeliveries} invitation delivery failed.` : null,
    });
  }
  return checks;
}

function pendingInvitations(tender: FixtureTender): FixtureParticipant[] {
  return participantsOf(tender.id).filter((participant) => participant.source === 'invited' && participant.invitationStatus === 'invited');
}

function overviewOf(tender: FixtureTender, permissions: readonly PermissionCode[]): PublicationOverview {
  const rows = sortRows(publicationsOf(tender.id), (row) => row.versionNo * 10 + (row.channel === 'portal' ? 1 : 2), 'desc').map(publicationRow);
  const canPublishPermission = permissions.includes('tender.publish');
  const approvalCurrent =
    !tender.releaseApprovalRequired ||
    (tender.releaseApproval.status === 'approved' && tender.releaseApproval.subjectVersion === tender.draftRevision);
  const participants = participantsOf(tender.id);
  const invited = participants.filter((participant) => participant.source === 'invited');
  return {
    tender: {
      ...tenderLabel(tender),
      summary: tender.summary,
      category: categoryOf(tender.categoryCode),
      officialTimeZone: tender.officialTimeZone,
      currentVersionNo: tender.currentVersionNo,
      draftRevision: tender.draftRevision,
      scheduledReleaseAt: tender.scheduledReleaseAt,
      releasedAt: tender.releasedAt,
      submissionDeadline: closingAt(tender),
      owner: personOf(tender.ownerUserId) ?? { userId: tender.ownerUserId, fullName: 'Tender owner' },
    },
    releaseApproval: tender.releaseApproval,
    audience: {
      participation: tender.participation,
      description:
        tender.participation === 'open'
          ? 'Public notice on the portal and the external notice service; anyone may register interest.'
          : tender.participation === 'invitation_only'
            ? 'Invited legal suppliers only. The event never appears on the public portal.'
            : 'Suppliers admitted after an access request. The event never appears on the public portal.',
      publicNoticePath: tender.participation === 'open' && (tender.releasedAt === null || isPubliclyVisible(tender)) ? noticePath(tender) : null,
      invitedCount: invited.length,
      pendingInvitationCount: pendingInvitations(tender).length,
      failedDeliveryCount: participants.filter((participant) => latestDeliveryStatus(participant) === 'failed').length,
    },
    publications: rows,
    isAdvertised: isAdvertised(tender),
    checks: publicationChecks(tender, rows),
    capabilities: {
      canPublish: canPublishPermission && tender.status === 'ready' && approvalCurrent && !tender.publicationHold,
      canSchedule: canPublishPermission && tender.status === 'ready' && approvalCurrent && !tender.publicationHold,
      canCancelSchedule: canPublishPermission && tender.status === 'ready' && tender.scheduledReleaseAt !== null,
      canDistributeInvitations:
        (canPublishPermission || permissions.includes('tender.participants.manage')) &&
        tender.releasedAt !== null &&
        pendingInvitations(tender).length > 0,
      canRetryExternal: canPublishPermission && rows.some((row) => row.channel === 'external_notice' && row.status === 'failed'),
      canReconcile:
        canPublishPermission &&
        rows.some((row) => row.channel === 'external_notice' && !row.reconciled && (row.status === 'failed' || row.status === 'awaiting_confirmation')),
    },
  };
}

function participantDetail(tender: FixtureTender, participant: FixtureParticipant, permissions: readonly PermissionCode[]): ParticipantDetail {
  const manage = permissions.includes('tender.participants.manage') && MANAGEABLE.has(tender.status);
  const outstanding = outstandingAcknowledgments(tender, participant);
  return {
    ...participantRow(participant),
    tender: tenderLabel(tender),
    accessRequestReason: participant.accessRequestReason,
    accessDecidedBy: personOf(participant.accessDecidedByUserId),
    accessDecisionReason: participant.accessDecisionReason,
    confidentialityAcceptedBy: personOf(participant.confidentialityAcceptedByUserId),
    qualification: qualificationOf(tender, participant.supplierTenantId),
    acknowledgmentItems: requiredAcknowledgments(tender).map((subject) => {
      const ack = participant.acknowledgments.find((entry) => entry.subjectType === subject.subjectType && entry.subjectId === subject.subjectId);
      return {
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        label: subject.label,
        requiredSince: subject.requiredSince,
        acknowledgedAt: ack?.acknowledgedAt ?? null,
        acknowledgedBy: personOf(ack?.acknowledgedByUserId ?? null),
      };
    }),
    deliveries: participant.deliveries.map((delivery) => ({
      noticeId: delivery.noticeId,
      noticeType: delivery.noticeType,
      title: delivery.title,
      recipient: personOf(delivery.recipientUserId),
      recipientEmail: delivery.recipientEmail,
      deliveryStatus: delivery.deliveryStatus,
      deliveredAt: delivery.deliveredAt,
      openedAt: delivery.openedAt,
      acknowledgedAt: delivery.acknowledgedAt,
      failureReason: delivery.failureReason,
      issuedAt: delivery.issuedAt,
    })),
    history: participantHistory(participant),
    capabilities: {
      canReplaceContact: manage && participant.invitationStatus !== 'not_invited',
      canDecideAccess: manage && participant.accessStatus === 'requested',
      canResendInvitation: manage && participant.invitationStatus === 'invited',
      canSendReminder:
        manage &&
        (outstanding.length > 0 ||
          participant.invitationStatus === 'invited' ||
          (requiresConfidentiality(tender) && participant.confidentialityAcceptedAt === null && participant.accessStatus !== 'denied')),
    },
  };
}

function withDelivery(row: ParticipantRow, deliveryStatus: ParticipantRow['deliveryStatus']): ParticipantRow {
  return { ...row, deliveryStatus };
}

export function registerBuyer(app: MockApp): void {
  mockRoute(app, listPublications, ({ requireTenant, query, fail, fixtures }) => {
    const { tenant } = requireTenant();
    if (isInvertedRange(query.from, query.to)) {
      return fail(422, 'INVALID_DATE_RANGE', 'The start date must not be after the end date.');
    }
    const rows = PUBLICATIONS.filter((publication) => publication.tenantId === tenant.id)
      .filter((publication) => query.tenderId === undefined || publication.tenderId === query.tenderId)
      .filter((publication) => query.channel === undefined || query.channel.includes(publication.channel))
      .filter((publication) => query.status === undefined || query.status.includes(publication.status))
      .filter(
        (publication) =>
          query.needsAttention !== true ||
          (publication.channel === 'external_notice' && !publication.reconciled && publication.status !== 'scheduled') ||
          publicationException(publication)?.status === 'open',
      )
      .filter((publication) => inDateRange(publication.publishedAt ?? publication.scheduledAt, query.from, query.to))
      .map(publicationRow)
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.externalReference, row.channelName));
    const sort = query.sort ?? 'updatedAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    return fixtures.page(
      sortRows(
        rows,
        (row) =>
          sort === 'publishedAt'
            ? row.publishedAt
            : sort === 'scheduledAt'
              ? row.scheduledAt
              : sort === 'tender'
                ? row.tender.reference
                : sort === 'status'
                  ? row.status
                  : row.updatedAt,
        dir,
      ),
    );
  });

  mockRoute(app, getPublicationOverview, ({ requireTenant, params, fail }) => {
    const access = requireTenant();
    return overviewOf(ownTender(access.tenant.id, params.tenderId, fail), access.permissions);
  });

  mockRoute(app, publishTender, ({ requireTenant, params, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    if (tender.releasedAt !== null) {
      return fail(409, 'ALREADY_PUBLISHED', `${tender.reference} was released on ${officialText(tender.releasedAt, tender.officialTimeZone)}.`);
    }
    if (tender.releaseApprovalRequired && tender.releaseApproval.status === 'invalidated') {
      return fail(409, 'RELEASE_APPROVAL_INVALIDATED', tender.releaseApproval.invalidatedReason ?? 'The release approval was invalidated.');
    }
    if (tender.releaseApprovalRequired && tender.releaseApproval.status !== 'approved') {
      return fail(409, 'RELEASE_APPROVAL_MISSING', 'The release package has no approval yet.');
    }
    if (tender.status !== 'ready') {
      return fail(409, 'TENDER_NOT_READY', 'Only a tender in the Ready state can be published.');
    }
    if (
      body.draftRevision !== tender.draftRevision ||
      (tender.releaseApprovalRequired && tender.releaseApproval.subjectVersion !== tender.draftRevision)
    ) {
      return fail(409, 'DRAFT_REVISION_CHANGED', `The package changed: the current draft revision is ${tender.draftRevision}.`);
    }
    if (tender.publicationHold) {
      return fail(409, 'PUBLICATION_HOLD_ACTIVE', 'An active hold blocks publication.');
    }
    const at = body.mode === 'now' ? isoInstant(now) : (body.scheduledAt ?? isoInstant(now));
    if (body.mode === 'scheduled' && new Date(at) <= now) {
      return fail(422, 'SCHEDULE_IN_PAST', 'Choose a release time in the future.');
    }
    if (tender.submissionDeadline !== null && new Date(at) >= new Date(tender.submissionDeadline)) {
      return fail(422, 'SCHEDULE_AFTER_DEADLINE', 'The release must come before the submission deadline.');
    }
    const version = currentPublicationVersion(tender);
    // One publication per (tender, version, channel) (DD-07): publishing a scheduled version updates its row.
    const existing = publicationsOf(tender.id);
    const publications = body.channels.map((channel) =>
      publicationRow({
        id:
          existing.find((publication) => publication.versionNo === version && publication.channel === channel)?.id ??
          tender.id * 100 + version * 10 + (channel === 'portal' ? 1 : 2),
        tenantId: tenant.id,
        tenderId: tender.id,
        versionNo: version,
        channel,
        status: body.mode === 'scheduled' ? 'scheduled' : channel === 'portal' ? 'published' : 'awaiting_confirmation',
        scheduledAt: body.mode === 'scheduled' ? at : null,
        publishedAt: body.mode === 'now' ? at : null,
        externalReference: null,
        confirmationReceivedAt: null,
        failureReason: null,
        reconciled: channel === 'portal' && body.mode === 'now',
        exceptionId: null,
        updatedAt: isoInstant(now),
      }),
    );
    return {
      tenderId: tender.id,
      tenderStatus: body.mode === 'now' ? ('open' as const) : ('ready' as const),
      scheduledReleaseAt: body.mode === 'scheduled' ? at : null,
      releasedAt: body.mode === 'now' ? at : null,
      publications,
      message:
        body.mode === 'now'
          ? `${tender.reference} is published. The external notice awaits confirmation before the event counts as advertised.`
          : `${tender.reference} is scheduled for release on ${officialText(at, tender.officialTimeZone)}.`,
    };
  });

  mockRoute(app, cancelScheduledPublication, ({ requireTenant, params, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    if (tender.status !== 'ready' || tender.scheduledReleaseAt === null) {
      return fail(409, 'NOT_SCHEDULED', `${tender.reference} has no scheduled release.`);
    }
    return {
      tenderId: tender.id,
      tenderStatus: 'ready' as const,
      scheduledReleaseAt: null,
      releasedAt: null,
      publications: publicationsOf(tender.id)
        .filter((publication) => publication.status === 'scheduled')
        .map((publication) => publicationRow({ ...publication, status: 'withdrawn', updatedAt: isoInstant(now) })),
      message: `The scheduled release of ${tender.reference} is cancelled; the tender stays Ready.`,
    };
  });

  mockRoute(app, retryExternalPublication, ({ requireTenant, params, now, fail }) => {
    const { tenant } = requireTenant();
    const publication = ownPublication(tenant.id, params.publicationId, fail);
    if (publication.channel !== 'external_notice') {
      return fail(409, 'NOT_EXTERNAL_CHANNEL', 'Only external notices can be retried.');
    }
    if (publication.status !== 'failed') {
      return fail(409, 'PUBLICATION_NOT_FAILED', 'Only a failed external notice can be retried.');
    }
    const row = publicationRow({ ...publication, status: 'awaiting_confirmation', publishedAt: isoInstant(now), failureReason: null, updatedAt: isoInstant(now) });
    return { ...row, exception: row.exception === null ? null : { ...row.exception, status: 'investigating' as const } };
  });

  mockRoute(app, reconcileExternalPublication, ({ requireTenant, params, body, now, fail }) => {
    const { tenant } = requireTenant();
    const publication = ownPublication(tenant.id, params.publicationId, fail);
    if (publication.channel !== 'external_notice') {
      return fail(409, 'NOT_EXTERNAL_CHANNEL', 'Only external notices are reconciled.');
    }
    if (publication.reconciled && publication.status === 'confirmed') {
      return fail(409, 'ALREADY_RECONCILED', 'This notice is already confirmed and reconciled.');
    }
    if (body.confirmedVersionNo !== publication.versionNo) {
      return fail(409, 'VERSION_MISMATCH', `The external notice must match version ${publication.versionNo} of the tender.`);
    }
    if (publication.publishedAt !== null && new Date(body.confirmationReceivedAt) < new Date(publication.publishedAt)) {
      return fail(422, 'CONFIRMATION_BEFORE_PUBLICATION', 'The confirmation cannot precede the publication.');
    }
    const row = publicationRow({
      ...publication,
      status: 'confirmed',
      externalReference: body.externalReference,
      confirmationReceivedAt: body.confirmationReceivedAt,
      publishedAt: publication.publishedAt ?? body.confirmationReceivedAt,
      failureReason: null,
      reconciled: true,
      updatedAt: isoInstant(now),
    });
    return {
      ...row,
      exception:
        row.exception === null
          ? null
          : {
              ...row.exception,
              status: body.outcome === 'confirmed' ? ('reconciled' as const) : ('manual_fallback_used' as const),
              resolvedAt: isoInstant(now),
              resolution: body.resolution,
            },
    };
  });

  mockRoute(app, distributeInvitations, ({ requireTenant, params, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    if (tender.releasedAt === null) {
      return fail(409, 'TENDER_NOT_RELEASED', 'Invitations are distributed when the tender is released.');
    }
    const participants = participantsOf(tender.id);
    for (const id of body.participantIds ?? []) {
      if (!participants.some((participant) => participant.id === id)) {
        return fail(404, 'PARTICIPANT_NOT_FOUND', `Participant ${id} is not part of ${tender.reference}.`);
      }
    }
    const pending = pendingInvitations(tender).filter((participant) => body.participantIds === undefined || body.participantIds.includes(participant.id));
    if (pending.length === 0) {
      return fail(409, 'NO_PENDING_INVITATIONS', 'Every invitation has been answered.');
    }
    return {
      tenderId: tender.id,
      sentCount: pending.length,
      participants: pending.map((participant) => withDelivery(participantRow(participant), 'pending')),
      message: `${pending.length} invitation(s) sent at ${isoInstant(now)}; delivery is tracked per recipient.`,
    };
  });

  mockRoute(app, listParticipants, ({ requireTenant, params, query, fail, fixtures }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    if (isInvertedRange(query.registeredFrom, query.registeredTo)) {
      return fail(422, 'INVALID_DATE_RANGE', 'The start date must not be after the end date.');
    }
    const rows = participantsOf(tender.id)
      .filter((participant) => query.source === undefined || query.source.includes(participant.source))
      .filter((participant) => query.invitationStatus === undefined || query.invitationStatus.includes(participant.invitationStatus))
      .filter((participant) => query.accessStatus === undefined || query.accessStatus.includes(participant.accessStatus))
      .filter((participant) => query.bidIntent === undefined || query.bidIntent.includes(participant.bidIntent))
      .filter((participant) => query.qualificationGate === undefined || query.qualificationGate.includes(participant.qualificationGate))
      .filter((participant) => {
        if (query.deliveryStatus === undefined) {
          return true;
        }
        const status = latestDeliveryStatus(participant);
        return status !== null && query.deliveryStatus.includes(status);
      })
      .filter((participant) => query.outstandingAcknowledgments !== true || outstandingAcknowledgments(tender, participant).length > 0)
      .filter((participant) => inDateRange(participant.registeredAt, query.registeredFrom, query.registeredTo))
      .map(participantRow)
      .filter((row) => matchesText(query.q, row.supplier.name, row.supplier.legalName, row.invitedContactName, row.invitedContactEmail));
    const sort = query.sort ?? 'supplier';
    return fixtures.page(
      sortRows(
        rows,
        (row) =>
          sort === 'registeredAt'
            ? row.registeredAt
            : sort === 'invitationStatus'
              ? row.invitationStatus
              : sort === 'accessStatus'
                ? row.accessStatus
                : sort === 'bidIntent'
                  ? row.bidIntent
                  : row.supplier.name,
        query.dir,
      ),
    );
  });

  mockRoute(app, getParticipantSummary, ({ requireTenant, params, fail }) => {
    const access = requireTenant();
    const tender = ownTender(access.tenant.id, params.tenderId, fail);
    const participants = participantsOf(tender.id);
    const sources = ['invited', 'registered_interest', 'access_request', 'shortlisted', 'next_stage'] as const;
    return {
      tender: { ...tenderLabel(tender), submissionDeadline: closingAt(tender) },
      buyer: buyerLabel(tender.tenantId),
      total: participants.length,
      bySource: sources
        .map((source) => ({ source, count: participants.filter((participant) => participant.source === source).length }))
        .filter((entry) => entry.count > 0),
      invitationsPending: participants.filter((participant) => participant.invitationStatus === 'invited').length,
      accessRequestsPending: participants.filter((participant) => participant.accessStatus === 'requested').length,
      confidentialityOutstanding: requiresConfidentiality(tender)
        ? participants.filter(
            (participant) =>
              participant.confidentialityAcceptedAt === null &&
              participant.accessStatus !== 'denied' &&
              participant.invitationStatus !== 'declined',
          ).length
        : 0,
      acknowledgmentsOutstanding: participants.filter((participant) => outstandingAcknowledgments(tender, participant).length > 0).length,
      deliveryFailures: participants.filter((participant) => latestDeliveryStatus(participant) === 'failed').length,
      qualificationGateNotMet: participants.filter((participant) => participant.qualificationGate === 'not_met').length,
      intendsToBid: participants.filter((participant) => participant.bidIntent === 'intends_to_bid').length,
      noBid: participants.filter((participant) => participant.bidIntent === 'no_bid').length,
      conditions: [...tender.conditions],
      acknowledgmentSubjects: requiredAcknowledgments(tender).map((subject) => ({
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        label: subject.label,
        acknowledgedCount: participants.filter((participant) =>
          participant.acknowledgments.some((ack) => ack.subjectType === subject.subjectType && ack.subjectId === subject.subjectId),
        ).length,
        requiredCount: participants.length,
      })),
      capabilities: {
        canInvite: access.permissions.includes('tender.participants.manage') && MANAGEABLE.has(tender.status),
        canManage: access.permissions.includes('tender.participants.manage') && MANAGEABLE.has(tender.status),
      },
    };
  });

  mockRoute(app, getParticipant, ({ requireTenant, params, fail }) => {
    const access = requireTenant();
    const tender = ownTender(access.tenant.id, params.tenderId, fail);
    return participantDetail(tender, ownParticipant(tender, params.participantId, fail), access.permissions);
  });

  mockRoute(app, listInvitationCandidates, ({ requireTenant, params, query, fail, fixtures }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    const participants = participantsOf(tender.id);
    const rows: InvitationCandidate[] = allTenants()
      .filter((candidate) => candidate.kind === 'supplier' && candidate.status === 'active')
      .map((candidate) => {
        const qualification = qualificationOf(tender, candidate.id);
        const contact =
          allPersonas().find((persona) =>
            persona.memberships.some(
              (membership) => membership.tenantId === candidate.id && membership.status === 'active' && membership.capacity === 'Bid Manager',
            ),
          ) ??
          allPersonas().find((persona) =>
            persona.memberships.some((membership) => membership.tenantId === candidate.id && membership.status === 'active' && membership.capacity === 'Organization Administrator'),
          );
        const profile = SUPPLIER_PROFILES.find((entry) => entry.tenantId === candidate.id);
        return {
          supplier: supplierParty(candidate.id),
          categories: (profile?.catalogCodes ?? []).map(categoryOf),
          qualificationStatus: qualification?.effectiveStatus ?? null,
          blockedByQualification: qualification !== null && !isQualified(qualification.effectiveStatus),
          alreadyParticipant: participants.some((participant) => participant.supplierTenantId === candidate.id),
          suggestedContact: contact === undefined ? null : { name: contact.fullName, email: contact.email },
        };
      })
      .filter((row) => query.includeParticipants === true || !row.alreadyParticipant)
      .filter((row) => matchesText(query.q, row.supplier.name, row.supplier.legalName, ...row.categories.map((category) => category.name)));
    const sort = query.sort ?? 'name';
    return fixtures.page(
      sortRows(rows, (row) => (sort === 'qualificationStatus' ? (row.qualificationStatus ?? '') : row.supplier.name), query.dir),
    );
  });

  mockRoute(app, inviteSupplier, ({ requireTenant, params, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    if (!MANAGEABLE.has(tender.status)) {
      return fail(409, 'TENDER_CLOSED', `${tender.reference} no longer accepts new participants.`);
    }
    const supplier = findTenantById(body.supplierTenantId);
    if (supplier === undefined || supplier.kind !== 'supplier') {
      return fail(404, 'SUPPLIER_NOT_FOUND', 'No supplier organization with this id.');
    }
    if (supplier.status !== 'active') {
      return fail(409, 'SUPPLIER_RESTRICTED', `${supplier.name} is not active on the platform.`);
    }
    if (participantsOf(tender.id).some((participant) => participant.supplierTenantId === supplier.id)) {
      return fail(409, 'SUPPLIER_ALREADY_PARTICIPANT', `${supplier.name} already takes part in ${tender.reference}.`);
    }
    const qualification = qualificationOf(tender, supplier.id);
    if (qualification !== null && !isQualified(qualification.effectiveStatus)) {
      return fail(409, 'SUPPLIER_NOT_QUALIFIED', `${supplier.name} holds no current "${qualification.programName}" qualification.`);
    }
    const expiresAt = body.invitationExpiresAt ?? tender.submissionDeadline;
    if (expiresAt !== undefined && expiresAt !== null && (new Date(expiresAt) <= now || (tender.submissionDeadline !== null && new Date(expiresAt) > new Date(tender.submissionDeadline)))) {
      return fail(422, 'INVITATION_EXPIRY_INVALID', 'The invitation must expire in the future and no later than the submission deadline.');
    }
    const invitedAt = isoInstant(now);
    return {
      id: 900_000 + tender.id * 100 + supplier.id,
      tenderId: tender.id,
      supplier: supplierParty(supplier.id),
      source: 'invited' as const,
      invitationStatus: 'invited' as const,
      invitedContactName: body.contactName,
      invitedContactEmail: body.contactEmail,
      invitedAt,
      invitationExpiresAt: expiresAt ?? null,
      accessStatus: 'not_required' as const,
      accessDecidedAt: null,
      confidentialityAcceptedAt: null,
      bidIntent: 'undecided' as const,
      sharedNoBidReason: null,
      intentChangedAt: null,
      qualificationGate: qualification === null ? ('not_required' as const) : ('met' as const),
      acknowledgments: { required: requiredAcknowledgments(tender).length, acknowledged: 0 },
      deliveryStatus: tender.releasedAt === null ? null : ('pending' as const),
      selectedLotNos: [],
      registeredAt: invitedAt,
    };
  });

  mockRoute(app, replaceParticipantContact, ({ requireTenant, params, body, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    const participant = ownParticipant(tender, params.participantId, fail);
    if (!MANAGEABLE.has(tender.status)) {
      return fail(409, 'TENDER_CLOSED', `${tender.reference} is closed.`);
    }
    if (participant.invitationStatus === 'not_invited') {
      return fail(409, 'NOT_INVITED', 'Only an invited participant has an intended contact.');
    }
    if (participant.invitedContactName === body.contactName && participant.invitedContactEmail?.toLowerCase() === body.contactEmail.toLowerCase()) {
      return fail(409, 'CONTACT_UNCHANGED', 'This is already the intended contact.');
    }
    return {
      ...participantRow(participant),
      invitedContactName: body.contactName,
      invitedContactEmail: body.contactEmail,
      deliveryStatus: participant.invitationStatus === 'invited' ? ('pending' as const) : latestDeliveryStatus(participant),
    };
  });

  mockRoute(app, decideParticipantAccess, ({ requireTenant, params, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    const participant = ownParticipant(tender, params.participantId, fail);
    if (!MANAGEABLE.has(tender.status)) {
      return fail(409, 'TENDER_CLOSED', `${tender.reference} is closed.`);
    }
    if (participant.accessStatus === 'granted' || participant.accessStatus === 'denied') {
      return fail(409, 'ACCESS_ALREADY_DECIDED', `Access was already ${participant.accessStatus} on ${participant.accessDecidedAt ?? ''}.`);
    }
    if (participant.accessStatus !== 'requested') {
      return fail(409, 'ACCESS_NOT_REQUESTED', 'This participant has not requested access.');
    }
    if (body.decision === 'granted' && participant.qualificationGate === 'not_met') {
      return fail(409, 'QUALIFICATION_GATE_NOT_MET', 'The qualification gate of this event is not met.');
    }
    return { ...participantRow(participant), accessStatus: body.decision, accessDecidedAt: isoInstant(now) };
  });

  mockRoute(app, resendInvitation, ({ requireTenant, params, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    const participant = ownParticipant(tender, params.participantId, fail);
    if (participant.invitationStatus !== 'invited') {
      return fail(409, 'INVITATION_NOT_PENDING', 'Only an unanswered invitation can be resent.');
    }
    if (participant.invitationExpiresAt !== null && new Date(participant.invitationExpiresAt) <= now) {
      return fail(409, 'INVITATION_EXPIRED', 'The invitation has expired; issue a new one.');
    }
    return withDelivery(participantRow(participant), 'pending');
  });

  mockRoute(app, remindParticipant, ({ requireTenant, params, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = ownTender(tenant.id, params.tenderId, fail);
    const participant = ownParticipant(tender, params.participantId, fail);
    if (!MANAGEABLE.has(tender.status)) {
      return fail(409, 'TENDER_CLOSED', `${tender.reference} is closed.`);
    }
    const outstanding =
      body.topic === 'acknowledgments'
        ? outstandingAcknowledgments(tender, participant).length > 0
        : body.topic === 'confidentiality'
          ? requiresConfidentiality(tender) && participant.confidentialityAcceptedAt === null && participant.accessStatus !== 'denied'
          : participant.invitationStatus === 'invited';
    if (!outstanding) {
      return fail(409, 'NOTHING_OUTSTANDING', 'Nothing is outstanding for this reminder.');
    }
    return {
      participantId: participant.id,
      topic: body.topic,
      sentAt: isoInstant(now),
      recipientEmail: participant.invitedContactEmail ?? participant.deliveries.at(-1)?.recipientEmail ?? null,
      message: `Reminder sent to ${supplierParty(participant.supplierTenantId).name}.`,
    };
  });
}
