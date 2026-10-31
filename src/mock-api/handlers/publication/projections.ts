/**
 * Publication handlers: fixture lookups, audience visibility rules and the projections from fixture rows to
 * contract shapes, shared by the public, buyer and supplier handlers.
 *
 * Visibility (PRD §4.3, DD-13):
 * - public: released, `participation = 'open'`, the buyer's portal enabled, and a public-safe status;
 * - supplier: the public set plus released events in which the supplier organization is a participant;
 * - buyer: only its own tenders.
 */
import type { CalendarDate, PersonRef } from '../../../contracts/common.js';
import type { TendersStatus } from '../../../contracts/enums.js';
import type {
  BuyerLabel,
  CategoryLabel,
  NoticeCondition,
  OwnParticipation,
  PackageDocument,
  ParticipantEvent,
  ParticipantRow,
  PublicNotice,
  PublicNoticeSummary,
  PublicationException,
  PublicationRow,
  SupplierParty,
  TenderLabel,
} from '../../../contracts/publication.js';
import {
  CATEGORIES,
  EXTERNAL_CHANNEL_NAME,
  INTEGRATION_EXCEPTIONS,
  OFFICIAL_TZ,
  PARTICIPANTS,
  PORTAL_SETTINGS,
  PUBLICATIONS,
  TENDERS,
  base64Of,
  documentBytes,
} from '../../fixtures/publication.js';
import type {
  FixtureDocument,
  FixtureParticipant,
  FixturePortalSettings,
  FixturePublication,
  FixtureTender,
} from '../../fixtures/publication.js';
import { findFixtureTask } from '../../fixtures/tasks.js';
import { findPersonaById, findTenantById } from '../../persona.js';
import { formatOfficialInstant } from '../bids/time.js';

// ---------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------

/** Statuses a public notice may have (`v_public_tenders`, DD-13). */
export const PUBLIC_STATUSES: ReadonlySet<TendersStatus> = new Set<TendersStatus>([
  'open',
  'closed',
  'under_assessment',
  'award_pending',
  'awarded',
  'partially_awarded',
  'completed_without_award',
  'information_collected',
  'cancelled',
]);

export function tenderById(tenderId: number): FixtureTender | undefined {
  return TENDERS.find((tender) => tender.id === tenderId);
}

export function tendersOf(tenantId: number): FixtureTender[] {
  return TENDERS.filter((tender) => tender.tenantId === tenantId);
}

export function portalOf(tenantId: number): FixturePortalSettings | undefined {
  return PORTAL_SETTINGS.find((settings) => settings.tenantId === tenantId);
}

export function categoryOf(code: string): CategoryLabel {
  const category = CATEGORIES.find((entry) => entry.code === code);
  if (category === undefined) {
    throw new Error(`Unknown category ${code} in the publication fixtures.`);
  }
  return category;
}

export function isKnownCategory(code: string): boolean {
  return CATEGORIES.some((entry) => entry.code === code);
}

export function buyerLabel(tenantId: number): BuyerLabel {
  const tenant = findTenantById(tenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown tenant ${tenantId}.`);
  }
  return { tenantId: tenant.id, slug: tenant.slug, name: tenant.name, officialTimeZone: tenant.officialTimeZone };
}

export function supplierParty(tenantId: number): SupplierParty {
  const tenant = findTenantById(tenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown supplier tenant ${tenantId}.`);
  }
  return { supplierTenantId: tenant.id, name: tenant.name, legalName: tenant.legalName };
}

export function personOf(userId: number | null): PersonRef | null {
  if (userId === null) {
    return null;
  }
  const persona = findPersonaById(userId);
  return persona === undefined ? null : { userId: persona.userId, fullName: persona.fullName };
}

export function participantsOf(tenderId: number): FixtureParticipant[] {
  return PARTICIPANTS.filter((participant) => participant.tenderId === tenderId);
}

export function participantOf(tenderId: number, supplierTenantId: number): FixtureParticipant | undefined {
  return PARTICIPANTS.find((participant) => participant.tenderId === tenderId && participant.supplierTenantId === supplierTenantId);
}

// ---------------------------------------------------------------------------------------------------------
// Time and text helpers
// ---------------------------------------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: OFFICIAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar date of an instant in the official time zone (`YYYY-MM-DD`). */
export function officialDate(instant: string): CalendarDate {
  return dateFormatter.format(new Date(instant));
}

/** True when the instant's official date is within the optional inclusive range. */
export function inDateRange(instant: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  if (instant === null) {
    return false;
  }
  const date = officialDate(instant);
  return (from === undefined || date >= from) && (to === undefined || date <= to);
}

/** True when `from` is after `to` (the declared INVALID_DATE_RANGE business error). */
export function isInvertedRange(from: string | undefined, to: string | undefined): boolean {
  return from !== undefined && to !== undefined && from > to;
}

/** Case-insensitive match of every word of `q` against any of the fields. */
export function matchesText(q: string | undefined, ...fields: ReadonlyArray<string | null | undefined>): boolean {
  if (q === undefined || q.trim() === '') {
    return true;
  }
  const haystack = fields.filter((field): field is string => typeof field === 'string').join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .every((word) => haystack.includes(word));
}

/** Sorts rows by a key (strings compared with localeCompare; nulls last). */
export function sortRows<T>(rows: readonly T[], key: (row: T) => string | number | null, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === right) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    if (right === null) {
      return -1;
    }
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
    return order * factor;
  });
}

/** An instant in a tender's official time, for messages: `1 Sep 2026, 09:00 (UTC+02:00) Africa/Gaborone` (DD-33). */
export function officialText(instant: string, timeZone: string): string {
  return formatOfficialInstant(instant, timeZone, false);
}

/** An ISO instant without milliseconds (the contract `Instant` format). */
export function isoInstant(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------------------------------------

/** `v_public_tenders`: released, open participation, portal enabled, public-safe status (DD-13, AC-01). */
export function isPubliclyVisible(tender: FixtureTender): boolean {
  return (
    tender.releasedAt !== null &&
    tender.participation === 'open' &&
    portalOf(tender.tenantId)?.publicPortalEnabled === true &&
    PUBLIC_STATUSES.has(tender.status)
  );
}

/**
 * True when a participant row authorizes its organization to see an event that is not public: any participant of an
 * open event, and for an invitation-only or restricted event only an invited legal supplier or an admitted one
 * (access granted). A pending or denied access request, for example one based on a forwarded invitation, does not
 * authorize (PRD §7.5, §4.3; AC-01, BR-15): the requester follows its request under /supplier/invitations.
 */
export function authorizesVisibility(tender: FixtureTender, participant: FixtureParticipant): boolean {
  return tender.participation === 'open' || participant.source === 'invited' || participant.accessStatus === 'granted';
}

/** A supplier sees the public set plus released events it is authorized to take part in (PRD §4.3, §7.5). */
export function isVisibleToSupplier(tender: FixtureTender, supplierTenantId: number): boolean {
  if (tender.releasedAt === null) {
    return false;
  }
  if (isPubliclyVisible(tender)) {
    return true;
  }
  const participant = participantOf(tender.id, supplierTenantId);
  return participant !== undefined && authorizesVisibility(tender, participant);
}

/** The response window is open: status `open` and the deadline still ahead. */
export function isAcceptingResponses(tender: FixtureTender, now: Date): boolean {
  return tender.status === 'open' && tender.submissionDeadline !== null && new Date(tender.submissionDeadline) > now;
}

// ---------------------------------------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------------------------------------

export function tenderLabel(tender: FixtureTender): TenderLabel {
  return {
    tenderId: tender.id,
    reference: tender.reference,
    title: tender.title,
    status: tender.status,
    eventType: tender.eventType,
    procedure: tender.procedure,
    participation: tender.participation,
  };
}

export function closingAt(tender: FixtureTender): { at: string; timeZone: string } | null {
  return tender.submissionDeadline === null ? null : { at: tender.submissionDeadline, timeZone: tender.officialTimeZone };
}

export function noticePath(tender: FixtureTender): string {
  return `/opportunities/${buyerLabel(tender.tenantId).slug}/${tender.reference}`;
}

export function lastAmendedAt(tender: FixtureTender): string | null {
  const last = tender.addenda.at(-1);
  return last === undefined ? null : last.issuedAt;
}

export function publicSummary(tender: FixtureTender, now: Date): PublicNoticeSummary {
  if (tender.releasedAt === null) {
    throw new Error(`Tender ${tender.reference} is not released.`);
  }
  return {
    reference: tender.reference,
    buyer: buyerLabel(tender.tenantId),
    title: tender.title,
    summary: tender.summary,
    eventType: tender.eventType,
    procedure: tender.procedure,
    category: categoryOf(tender.categoryCode),
    regions: [...tender.regions],
    status: tender.status,
    isAcceptingResponses: isAcceptingResponses(tender, now),
    publishedAt: tender.releasedAt,
    closingAt: closingAt(tender),
    lotCount: tender.lots.length,
    currentVersionNo: Math.max(tender.currentVersionNo, 1),
    amendmentCount: tender.addenda.length,
    lastAmendedAt: lastAmendedAt(tender),
    linkPath: noticePath(tender),
  };
}

/** A document as the contracts return it (the access rule and the byte spec stay internal). */
export function packageDocumentOf(document: FixtureDocument): PackageDocument {
  const { accessRule: _accessRule, spec: _spec, ...rest } = document;
  return rest;
}

/** True when the tender has a confidentiality undertaking condition. */
export function requiresConfidentiality(tender: FixtureTender): boolean {
  return tender.conditions.some((condition) => condition.conditionType === 'confidentiality_undertaking');
}

/**
 * True when document access must be requested and decided: an eligibility review, or an event that is not open to
 * all (an organization that is not invited, for example one holding a forwarded invitation, must ask).
 */
export function requiresAccessDecision(tender: FixtureTender): boolean {
  return tender.participation !== 'open' || tender.conditions.some((condition) => condition.conditionType === 'eligibility_review');
}

/** True when the participant may open access-controlled documents: no decision needed, access granted, or invited and accepted. */
export function hasDocumentAccess(tender: FixtureTender, participant: FixtureParticipant): boolean {
  return !requiresAccessDecision(tender) || participant.accessStatus === 'granted' || participant.invitationStatus === 'accepted';
}

export function publicNotice(tender: FixtureTender, now: Date): PublicNotice {
  const summary = publicSummary(tender, now);
  const policy = portalOf(tender.tenantId)?.publicDocumentPolicy ?? 'public';
  const publicDocuments = tender.documents.filter((document) => document.accessRule === 'public');
  const accepting = summary.isAcceptingResponses;
  return {
    ...summary,
    officialTimeZone: tender.officialTimeZone,
    eligibilitySummary: tender.eligibilitySummary,
    deliveryRequirements: tender.deliveryRequirements,
    submissionRules: tender.submissionRules,
    communicationChannelNote: tender.communicationChannelNote,
    acceptedLanguages: [...tender.acceptedLanguages],
    lots: [...tender.lots],
    milestones: [...tender.milestones],
    documents: publicDocuments.map(packageDocumentOf),
    documentPolicy: policy,
    restrictedDocumentCount: tender.documents.length - publicDocuments.length,
    conditions: tender.conditions.map((condition): NoticeCondition => ({ ...condition })),
    addenda: tender.addenda.map(({ acknowledgmentRequired: _required, ...addendum }) => addendum),
    versions: [...tender.versions],
    cancellation:
      tender.cancelledAt === null ? null : { cancelledAt: tender.cancelledAt, reason: tender.cancellationReason ?? 'Cancelled by the buyer.' },
    outcome: tender.outcome,
    participationRoutes: {
      registerInterest: accepting,
      requestAccess: accepting && (requiresAccessDecision(tender) || requiresConfidentiality(tender)),
      startParticipation: accepting,
    },
    clarificationsLinkPath: `/clarifications/${summary.buyer.slug}/${tender.reference}`,
  };
}

/** The acknowledgment subjects every participant of the tender must acknowledge. */
export function requiredAcknowledgments(tender: FixtureTender): Array<{ subjectType: 'addendum'; subjectId: number; label: string; requiredSince: string }> {
  return tender.addenda
    .filter((addendum) => addendum.acknowledgmentRequired)
    .map((addendum) => ({
      subjectType: 'addendum' as const,
      subjectId: addendum.addendumId,
      label: `Addendum ${addendum.number} — ${addendum.title}`,
      requiredSince: addendum.issuedAt,
    }));
}

function hasAcknowledged(participant: FixtureParticipant, subject: { subjectType: 'addendum'; subjectId: number }): boolean {
  return participant.acknowledgments.some((ack) => ack.subjectType === subject.subjectType && ack.subjectId === subject.subjectId);
}

/**
 * The acknowledgment subjects this participant must acknowledge: the addenda issued while it took part (it held the
 * earlier version and is a recipient). An organization that joined after an addendum received the amended version
 * directly, so that addendum is not asked of it (unless it acknowledged anyway); the addendum's recipients and the
 * participants' acknowledgment counts therefore agree (BUY-15, BUY-17).
 */
export function requiredAcknowledgmentsFor(tender: FixtureTender, participant: FixtureParticipant) {
  return requiredAcknowledgments(tender).filter((subject) => participant.registeredAt <= subject.requiredSince || hasAcknowledged(participant, subject));
}

export function outstandingAcknowledgments(tender: FixtureTender, participant: FixtureParticipant) {
  return requiredAcknowledgmentsFor(tender, participant).filter((subject) => !hasAcknowledged(participant, subject));
}

/** The latest formal delivery status of a participant. */
export function latestDeliveryStatus(participant: FixtureParticipant) {
  const latest = [...participant.deliveries].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)).at(-1);
  return latest === undefined ? null : latest.deliveryStatus;
}

export function lotNosOf(tender: FixtureTender, lotIds: readonly number[]): number[] {
  return tender.lots.filter((entry) => lotIds.includes(entry.lotId)).map((entry) => entry.lotNo);
}

export function participantRow(participant: FixtureParticipant): ParticipantRow {
  const tender = tenderById(participant.tenderId);
  if (tender === undefined) {
    throw new Error(`Participant ${participant.id} names unknown tender ${participant.tenderId}.`);
  }
  const required = requiredAcknowledgmentsFor(tender, participant);
  return {
    id: participant.id,
    tenderId: participant.tenderId,
    supplier: supplierParty(participant.supplierTenantId),
    source: participant.source,
    invitationStatus: participant.invitationStatus,
    invitedContactName: participant.invitedContactName,
    invitedContactEmail: participant.invitedContactEmail,
    invitedAt: participant.invitedAt,
    invitationExpiresAt: participant.invitationExpiresAt,
    accessStatus: participant.accessStatus,
    accessDecidedAt: participant.accessDecidedAt,
    confidentialityAcceptedAt: participant.confidentialityAcceptedAt,
    bidIntent: participant.bidIntent,
    sharedNoBidReason: participant.sharedNoBidReason,
    intentChangedAt: participant.intentChangedAt,
    qualificationGate: participant.qualificationGate,
    acknowledgments: { required: required.length, acknowledged: required.length - outstandingAcknowledgments(tender, participant).length },
    deliveryStatus: latestDeliveryStatus(participant),
    selectedLotNos: lotNosOf(tender, participant.selectedLotIds),
    registeredAt: participant.registeredAt,
  };
}

export function ownParticipation(participant: FixtureParticipant): OwnParticipation {
  return {
    participantId: participant.id,
    source: participant.source,
    invitationStatus: participant.invitationStatus,
    accessStatus: participant.accessStatus,
    confidentialityAcceptedAt: participant.confidentialityAcceptedAt,
    bidIntent: participant.bidIntent,
    sharedNoBidReason: participant.sharedNoBidReason,
    intentChangedAt: participant.intentChangedAt,
    qualificationGate: participant.qualificationGate,
    selectedLotIds: [...participant.selectedLotIds],
  };
}

export function participantHistory(participant: FixtureParticipant): ParticipantEvent[] {
  return participant.history.map((event) => {
    const persona = event.actorUserId === null ? undefined : findPersonaById(event.actorUserId);
    const capacity = persona?.memberships.find((membership) => membership.tenantId === event.actorTenantId)?.capacity ?? null;
    return {
      at: event.at,
      actor: persona === undefined ? null : { userId: persona.userId, fullName: persona.fullName, capacity },
      actorOrganization: findTenantById(event.actorTenantId)?.name ?? 'TenderIQ',
      event: event.event,
      detail: event.detail,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Publications
// ---------------------------------------------------------------------------------------------------------

/** The version whose publications count as "current": the first version while unreleased. */
export function currentPublicationVersion(tender: FixtureTender): number {
  return Math.max(tender.currentVersionNo, 1);
}

export function publicationException(publication: FixturePublication): PublicationException | null {
  if (publication.exceptionId === null) {
    return null;
  }
  const exception = INTEGRATION_EXCEPTIONS.find((entry) => entry.id === publication.exceptionId);
  if (exception === undefined) {
    return null;
  }
  return {
    id: exception.id,
    recordType: 'publication',
    recordId: exception.recordId,
    description: exception.description,
    status: exception.status,
    owner: personOf(exception.ownerUserId),
    openedAt: exception.openedAt,
    resolvedAt: exception.resolvedAt,
    resolution: exception.resolution,
    // Only a task the owner can find in the inbox is linked (`tasks`, same tenant); otherwise no link is offered.
    taskId: exception.taskId !== null && findFixtureTask(exception.taskId)?.tenantId === exception.tenantId ? exception.taskId : null,
  };
}

export function publicationRow(publication: FixturePublication): PublicationRow {
  const tender = tenderById(publication.tenderId);
  if (tender === undefined) {
    throw new Error(`Publication ${publication.id} names unknown tender ${publication.tenderId}.`);
  }
  return {
    id: publication.id,
    tender: tenderLabel(tender),
    versionNo: publication.versionNo,
    channel: publication.channel,
    channelName: publication.channel === 'external_notice' ? EXTERNAL_CHANNEL_NAME : null,
    status: publication.status,
    scheduledAt: publication.scheduledAt,
    publishedAt: publication.publishedAt,
    externalReference: publication.externalReference,
    confirmationReceivedAt: publication.confirmationReceivedAt,
    failureReason: publication.failureReason,
    reconciled: publication.reconciled,
    exception: publicationException(publication),
    isCurrentVersion: publication.versionNo === currentPublicationVersion(tender),
    updatedAt: publication.updatedAt,
  };
}

export function publicationsOf(tenderId: number): FixturePublication[] {
  return PUBLICATIONS.filter((publication) => publication.tenderId === tenderId);
}

/** Advertised = every external channel of the current version confirmed and reconciled, or the portal published. */
export function isAdvertised(tender: FixtureTender): boolean {
  const current = publicationsOf(tender.id).filter((publication) => publication.versionNo === currentPublicationVersion(tender));
  const external = current.filter((publication) => publication.channel === 'external_notice');
  const portal = current.filter((publication) => publication.channel === 'portal');
  if (portal.length === 0 || portal.some((publication) => publication.status !== 'published')) {
    return false;
  }
  return external.every((publication) => publication.status === 'confirmed' && publication.reconciled);
}

// ---------------------------------------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------------------------------------

/** A short-lived download link carrying the document bytes inline (prototype: nothing is stored remotely). */
export function downloadLinkOf(document: FixtureDocument, now: Date) {
  const bytes = documentBytes(document.spec);
  return {
    url: `data:${document.contentType};base64,${base64Of(bytes)}`,
    expiresAt: isoInstant(new Date(now.getTime() + 15 * 60 * 1000)),
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    sha256: document.sha256,
  };
}
