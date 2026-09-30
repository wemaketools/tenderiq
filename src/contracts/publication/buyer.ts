/**
 * Buyer publication and participant endpoints (BUY-14, BUY-15; FR-08; BR-14, BR-15; AC-01, AC-33; DD-15, DD-17,
 * DD-25, DD-41, DD-42).
 *
 * Publication (BUY-14, blueprint `publications`, `integration_exceptions`):
 * - A `ready` tender with a current release approval is published now or scheduled (`tenders.scheduled_release_at`
 *   is authoritative, `publications.scheduled_at` mirrors it per channel, DD-15).
 * - An external notice channel moves `awaiting_confirmation` → `confirmed`, or `failed` with an open integration
 *   exception. A tender is "advertised" only when every external channel of the current version is confirmed and
 *   reconciled (FR-08, AC-33): a failure stays visibly unconfirmed until it is reconciled.
 *
 * Participants (BUY-15, blueprint `participants`, `participant_acknowledgments`, `notice_recipients`):
 * - Invitations name the legal supplier and an intended contact. Replacing the contact never changes the invited
 *   supplier (FR-08).
 * - The buyer sees interest, invitation, access, confidentiality, acknowledgment, delivery and qualification-gate
 *   state, and the bid intent the supplier chose to share (DD-41). It never sees supplier drafts, pursuits or
 *   private notes (PRD §4.3).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  ActorRef,
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  OfficialDeadline,
  PersonRef,
  ReasonText,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
  QueryBoolean,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import type { EndpointPermission } from '../endpoint.js';
import {
  ApprovalRequestsStatus,
  IntegrationExceptionsStatus,
  NoticeRecipientsDeliveryStatus,
  NoticesNoticeType,
  ParticipantAcknowledgmentsSubjectType,
  ParticipantsAccessStatus,
  ParticipantsBidIntent,
  ParticipantsInvitationStatus,
  ParticipantsQualificationGate,
  ParticipantsSource,
  PublicationsChannel,
  PublicationsStatus,
  TendersParticipation,
  VQualificationStatusEffectiveStatus,
} from '../enums.js';
import { BuyerLabel, CategoryLabel, NoticeCondition, ReadinessCheck, TenderLabel } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Publication (BUY-14)
// ---------------------------------------------------------------------------------------------------------

/** The integration exception raised for a failed external publication (`integration_exceptions`, AC-33). */
export const PublicationException = z.object({
  id: Id,
  recordType: z.literal('publication'),
  recordId: Id,
  description: z.string().min(1),
  status: IntegrationExceptionsStatus,
  owner: PersonRef.nullable(),
  openedAt: Instant,
  resolvedAt: Instant.nullable(),
  resolution: z.string().nullable(),
  /** The task assigned to the owner (`publications.exception_task_id`). */
  taskId: Id.nullable(),
});
export type PublicationException = z.infer<typeof PublicationException>;

/** One publication of one version on one channel (`publications`). */
export const PublicationRow = z.object({
  id: Id,
  tender: TenderLabel,
  versionNo: z.number().int().min(1),
  channel: PublicationsChannel,
  /** The external service name for `external_notice` (e.g. the Government Gazette gateway); `null` for the portal. */
  channelName: z.string().nullable(),
  status: PublicationsStatus,
  scheduledAt: Instant.nullable(),
  publishedAt: Instant.nullable(),
  externalReference: z.string().nullable(),
  confirmationReceivedAt: Instant.nullable(),
  failureReason: z.string().nullable(),
  reconciled: z.boolean(),
  exception: PublicationException.nullable(),
  /** True for a row of the tender's current version. */
  isCurrentVersion: z.boolean(),
  updatedAt: Instant,
});
export type PublicationRow = z.infer<typeof PublicationRow>;

/** The release approval that authorizes the publication (tender_release approval request). */
export const ReleaseApprovalState = z.object({
  approvalRequestId: Id.nullable(),
  status: ApprovalRequestsStatus.nullable(),
  subjectVersion: z.number().int().min(1).nullable(),
  approvedAt: Instant.nullable(),
  approvedBy: PersonRef.nullable(),
  invalidatedReason: z.string().nullable(),
});
export type ReleaseApprovalState = z.infer<typeof ReleaseApprovalState>;

/** The approved audience of the release (FR-08, BR-15). */
export const PublicationAudience = z.object({
  participation: TendersParticipation,
  description: z.string().min(1),
  /** The public notice path, or `null` when the event is not public (invitation-only, restricted). */
  publicNoticePath: LinkPath.nullable(),
  invitedCount: z.number().int().min(0),
  pendingInvitationCount: z.number().int().min(0),
  failedDeliveryCount: z.number().int().min(0),
});
export type PublicationAudience = z.infer<typeof PublicationAudience>;

/** What the caller may do on BUY-14 now. */
export const PublicationCapabilities = z.object({
  canPublish: z.boolean(),
  canSchedule: z.boolean(),
  canCancelSchedule: z.boolean(),
  canDistributeInvitations: z.boolean(),
  canRetryExternal: z.boolean(),
  canReconcile: z.boolean(),
});
export type PublicationCapabilities = z.infer<typeof PublicationCapabilities>;

/** BUY-14: notice, audience, approved date, channels, confirmations and failures. */
export const PublicationOverview = z.object({
  tender: TenderLabel.extend({
    summary: z.string().nullable(),
    category: CategoryLabel,
    officialTimeZone: TimeZone,
    currentVersionNo: z.number().int().min(0),
    draftRevision: z.number().int().min(1),
    scheduledReleaseAt: Instant.nullable(),
    releasedAt: Instant.nullable(),
    submissionDeadline: OfficialDeadline.nullable(),
    owner: PersonRef,
  }),
  releaseApproval: ReleaseApprovalState,
  audience: PublicationAudience,
  publications: z.array(PublicationRow),
  /** True only when every external channel of the current version is confirmed and reconciled (AC-33). */
  isAdvertised: z.boolean(),
  checks: z.array(ReadinessCheck),
  capabilities: PublicationCapabilities,
});
export type PublicationOverview = z.infer<typeof PublicationOverview>;

export const TenderParams = z.object({ tenderId: IdParam });
export const PublicationParams = z.object({ publicationId: IdParam });

export const PUBLICATION_SORT_FIELDS = ['updatedAt', 'publishedAt', 'scheduledAt', 'tender', 'status'] as const;
export const PublicationListQuery = listQueryWithSort(PUBLICATION_SORT_FIELDS).extend({
  tenderId: IdParam.optional(),
  channel: queryList(PublicationsChannel).optional(),
  status: queryList(PublicationsStatus).optional(),
  /** Only rows with an unresolved exception or an unconfirmed external channel. */
  needsAttention: QueryBoolean.optional(),
  from: CalendarDate.optional(),
  to: CalendarDate.optional(),
});
export type PublicationListQuery = z.input<typeof PublicationListQuery>;

export const PublicationPage = pageOf(PublicationRow);
export type PublicationPage = z.infer<typeof PublicationPage>;

/** Publish now or schedule (FR-08). The caller confirms the organization and capacity (COM-02). */
export const PublishBody = z
  .object({
    mode: z.enum(['now', 'scheduled']),
    scheduledAt: z.iso
      .datetime({ offset: false, local: false, error: issue('INVALID_INSTANT', 'Use an ISO 8601 UTC timestamp.') })
      .optional(),
    channels: z
      .array(PublicationsChannel)
      .min(1, issue('CHANNEL_REQUIRED', 'Choose at least one channel.'))
      .refine((channels) => channels.includes('portal'), issue('PORTAL_CHANNEL_REQUIRED', 'The portal channel is always published.'))
      .refine((channels) => new Set(channels).size === channels.length, issue('DUPLICATE_CHANNEL', 'Each channel may appear once.')),
    /** The draft revision the caller reviewed: a later material edit invalidates the approval (AC-06). */
    draftRevision: z.number().int().min(1),
  })
  .refine((body) => body.mode === 'now' || body.scheduledAt !== undefined, {
    message: issue('SCHEDULE_REQUIRED', 'Choose the release date and time.'),
    path: ['scheduledAt'],
  });
export type PublishBody = z.infer<typeof PublishBody>;

/** The outcome of publish, schedule or cancel-schedule. */
export const PublicationOutcome = z.object({
  tenderId: Id,
  tenderStatus: TenderLabel.shape.status,
  scheduledReleaseAt: Instant.nullable(),
  releasedAt: Instant.nullable(),
  publications: z.array(PublicationRow),
  message: z.string().min(1),
});
export type PublicationOutcome = z.infer<typeof PublicationOutcome>;

export const CancelScheduleBody = z.object({ reason: ReasonText });

/** Reconcile a failed or unconfirmed external notice with the official version (FR-08, AC-33). */
export const ReconcileBody = z.object({
  outcome: z.enum(['confirmed', 'manual_fallback_used']),
  externalReference: z
    .string()
    .trim()
    .min(3, issue('EXTERNAL_REFERENCE_REQUIRED', 'Enter the reference the external service issued.'))
    .max(120, issue('TEXT_TOO_LONG', 'At most 120 characters.')),
  confirmedVersionNo: z.number().int().min(1),
  confirmationReceivedAt: z.iso.datetime({ offset: false, local: false, error: issue('INVALID_INSTANT', 'Use an ISO 8601 UTC timestamp.') }),
  resolution: ReasonText,
});
export type ReconcileBody = z.infer<typeof ReconcileBody>;

// ---------------------------------------------------------------------------------------------------------
// Participants (BUY-15)
// ---------------------------------------------------------------------------------------------------------

/** The invited or participating legal supplier (the tenant and its legal name, FR-08). */
export const SupplierParty = z.object({
  supplierTenantId: Id,
  name: z.string().min(1),
  legalName: z.string().min(1),
});
export type SupplierParty = z.infer<typeof SupplierParty>;

/** Outstanding acknowledgments of a participant (DD-42: `participant_acknowledgments` is authoritative). */
export const AcknowledgmentProgress = z.object({
  required: z.number().int().min(0),
  acknowledged: z.number().int().min(0),
});

/** A participant row (`participants`), without anything from the supplier's private workspace. */
export const ParticipantRow = z.object({
  id: Id,
  tenderId: Id,
  supplier: SupplierParty,
  source: ParticipantsSource,
  invitationStatus: ParticipantsInvitationStatus,
  invitedContactName: z.string().nullable(),
  invitedContactEmail: z.string().nullable(),
  invitedAt: Instant.nullable(),
  invitationExpiresAt: Instant.nullable(),
  accessStatus: ParticipantsAccessStatus,
  accessDecidedAt: Instant.nullable(),
  confidentialityAcceptedAt: Instant.nullable(),
  bidIntent: ParticipantsBidIntent,
  sharedNoBidReason: z.string().nullable(),
  intentChangedAt: Instant.nullable(),
  qualificationGate: ParticipantsQualificationGate,
  acknowledgments: AcknowledgmentProgress,
  /** The latest formal delivery to this participant (`notice_recipients.delivery_status`). */
  deliveryStatus: NoticeRecipientsDeliveryStatus.nullable(),
  selectedLotNos: z.array(z.number().int().min(1)),
  registeredAt: Instant,
});
export type ParticipantRow = z.infer<typeof ParticipantRow>;

/** Send the pending invitations of an invitation-only or restricted event (BUY-14 "distribute invitations"). */
export const DistributeInvitationsBody = z.object({
  /** The participants to send; omitted = every participant whose invitation has not been delivered. */
  participantIds: z.array(Id).min(1, issue('PARTICIPANTS_REQUIRED', 'Choose at least one participant.')).optional(),
});

export const DistributionOutcome = z.object({
  tenderId: Id,
  sentCount: z.number().int().min(0),
  participants: z.array(ParticipantRow),
  message: z.string().min(1),
});

/** One required acknowledgment and its state. */
export const ParticipantAcknowledgment = z.object({
  subjectType: ParticipantAcknowledgmentsSubjectType,
  subjectId: Id,
  label: z.string().min(1),
  requiredSince: Instant,
  acknowledgedAt: Instant.nullable(),
  acknowledgedBy: PersonRef.nullable(),
});
export type ParticipantAcknowledgment = z.infer<typeof ParticipantAcknowledgment>;

/** One formal delivery (`notice_recipients`). */
export const ParticipantDelivery = z.object({
  noticeId: Id,
  noticeType: NoticesNoticeType,
  title: z.string().min(1),
  recipient: PersonRef.nullable(),
  recipientEmail: z.string().nullable(),
  deliveryStatus: NoticeRecipientsDeliveryStatus,
  deliveredAt: Instant.nullable(),
  openedAt: Instant.nullable(),
  acknowledgedAt: Instant.nullable(),
  failureReason: z.string().nullable(),
  issuedAt: Instant,
});
export type ParticipantDelivery = z.infer<typeof ParticipantDelivery>;

/** A historical event of the participant record (contact replacements, decisions, intents). */
export const ParticipantEvent = z.object({
  at: Instant,
  actor: ActorRef.nullable(),
  /** The organization the actor acted for. */
  actorOrganization: z.string().min(1),
  event: z.enum([
    'interest_registered',
    'invited',
    'invitation_resent',
    'contact_replaced',
    'invitation_accepted',
    'invitation_declined',
    'access_requested',
    'access_granted',
    'access_denied',
    'confidentiality_accepted',
    'acknowledged',
    'bid_intent_shared',
    'reminder_sent',
    'delivery_failed',
  ]),
  detail: z.string().nullable(),
});
export type ParticipantEvent = z.infer<typeof ParticipantEvent>;

/** BUY-15 detail of one participant. */
export const ParticipantDetail = ParticipantRow.extend({
  tender: TenderLabel,
  accessRequestReason: z.string().nullable(),
  accessDecidedBy: PersonRef.nullable(),
  accessDecisionReason: z.string().nullable(),
  confidentialityAcceptedBy: PersonRef.nullable(),
  /** The supplier's qualification status for the event's required program (`v_qualification_status`). */
  qualification: z
    .object({
      programName: z.string().min(1),
      effectiveStatus: VQualificationStatusEffectiveStatus,
      effectiveTo: CalendarDate.nullable(),
      conditions: z.string().nullable(),
    })
    .nullable(),
  acknowledgmentItems: z.array(ParticipantAcknowledgment),
  deliveries: z.array(ParticipantDelivery),
  history: z.array(ParticipantEvent),
  capabilities: z.object({
    canReplaceContact: z.boolean(),
    canDecideAccess: z.boolean(),
    canResendInvitation: z.boolean(),
    canSendReminder: z.boolean(),
  }),
});
export type ParticipantDetail = z.infer<typeof ParticipantDetail>;

export const ParticipantParams = z.object({ tenderId: IdParam, participantId: IdParam });

export const PARTICIPANT_SORT_FIELDS = ['supplier', 'registeredAt', 'invitationStatus', 'accessStatus', 'bidIntent'] as const;
export const ParticipantListQuery = listQueryWithSort(PARTICIPANT_SORT_FIELDS).extend({
  source: queryList(ParticipantsSource).optional(),
  invitationStatus: queryList(ParticipantsInvitationStatus).optional(),
  accessStatus: queryList(ParticipantsAccessStatus).optional(),
  bidIntent: queryList(ParticipantsBidIntent).optional(),
  qualificationGate: queryList(ParticipantsQualificationGate).optional(),
  deliveryStatus: queryList(NoticeRecipientsDeliveryStatus).optional(),
  /** Only participants with an outstanding acknowledgment. */
  outstandingAcknowledgments: QueryBoolean.optional(),
  registeredFrom: CalendarDate.optional(),
  registeredTo: CalendarDate.optional(),
});
export type ParticipantListQuery = z.input<typeof ParticipantListQuery>;

export const ParticipantPage = pageOf(ParticipantRow);
export type ParticipantPage = z.infer<typeof ParticipantPage>;

/** Counts and conditions shown above the BUY-15 table. */
export const ParticipantSummary = z.object({
  tender: TenderLabel.extend({ submissionDeadline: OfficialDeadline.nullable() }),
  buyer: BuyerLabel,
  total: z.number().int().min(0),
  bySource: z.array(z.object({ source: ParticipantsSource, count: z.number().int().min(0) })),
  invitationsPending: z.number().int().min(0),
  accessRequestsPending: z.number().int().min(0),
  confidentialityOutstanding: z.number().int().min(0),
  acknowledgmentsOutstanding: z.number().int().min(0),
  deliveryFailures: z.number().int().min(0),
  qualificationGateNotMet: z.number().int().min(0),
  intendsToBid: z.number().int().min(0),
  noBid: z.number().int().min(0),
  conditions: z.array(NoticeCondition),
  /** The subjects every participant must acknowledge (issued addenda, conditions). */
  acknowledgmentSubjects: z.array(
    z.object({
      subjectType: ParticipantAcknowledgmentsSubjectType,
      subjectId: Id,
      label: z.string().min(1),
      acknowledgedCount: z.number().int().min(0),
      requiredCount: z.number().int().min(0),
    }),
  ),
  capabilities: z.object({ canInvite: z.boolean(), canManage: z.boolean() }),
});
export type ParticipantSummary = z.infer<typeof ParticipantSummary>;

/** A supplier the buyer may invite, with its qualification status for the event (BUY-15). */
export const InvitationCandidate = z.object({
  supplier: SupplierParty,
  categories: z.array(CategoryLabel),
  qualificationStatus: VQualificationStatusEffectiveStatus.nullable(),
  /** True when the event's qualification gate blocks the invitation (BR-15, AC-07). */
  blockedByQualification: z.boolean(),
  alreadyParticipant: z.boolean(),
  suggestedContact: z.object({ name: z.string().min(1), email: z.string().min(3) }).nullable(),
});
export type InvitationCandidate = z.infer<typeof InvitationCandidate>;

export const InvitationCandidateQuery = listQueryWithSort(['name', 'qualificationStatus'] as const).extend({
  includeParticipants: QueryBoolean.optional(),
});

const ContactName = z
  .string()
  .trim()
  .min(2, issue('CONTACT_NAME_REQUIRED', 'Enter the contact name.'))
  .max(120, issue('TEXT_TOO_LONG', 'At most 120 characters.'));
const ContactEmail = z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.'));

/** Invite a legal supplier with an intended contact (FR-08). */
export const InviteSupplierBody = z.object({
  supplierTenantId: Id,
  contactName: ContactName,
  contactEmail: ContactEmail,
  invitationExpiresAt: z.iso
    .datetime({ offset: false, local: false, error: issue('INVALID_INSTANT', 'Use an ISO 8601 UTC timestamp.') })
    .optional(),
  message: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
});
export type InviteSupplierBody = z.infer<typeof InviteSupplierBody>;

/** Replace the intended contact; the invited legal supplier never changes (FR-08). */
export const ReplaceContactBody = z.object({
  contactName: ContactName,
  contactEmail: ContactEmail,
  reason: ReasonText,
});
export type ReplaceContactBody = z.infer<typeof ReplaceContactBody>;

/** Decide an access request (BR-15, DD-25). */
export const AccessDecisionBody = z.object({
  decision: z.enum(['granted', 'denied']),
  reason: ReasonText,
});
export type AccessDecisionBody = z.infer<typeof AccessDecisionBody>;

/** Remind a participant of what is outstanding. */
export const ReminderBody = z.object({
  topic: z.enum(['acknowledgments', 'confidentiality', 'invitation_response']),
  message: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
});
export type ReminderBody = z.infer<typeof ReminderBody>;

export const ReminderOutcome = z.object({
  participantId: Id,
  topic: ReminderBody.shape.topic,
  sentAt: Instant,
  recipientEmail: z.string().nullable(),
  message: z.string().min(1),
});

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const PUBLICATION_READ: EndpointPermission = ['tender.view', 'tender.publish'];
const PARTICIPANT_READ: EndpointPermission = ['tender.view', 'tender.participants.manage'];

/** GET /api/v1/buyer/publications: every publication of the buyer's tenders (BUY-14 register). */
export const listPublications = defineEndpoint({
  id: 'buyer.publication.list',
  method: 'GET',
  path: '/api/v1/buyer/publications',
  audience: 'buyer',
  permission: PUBLICATION_READ,
  query: PublicationListQuery,
  response: PublicationPage,
  errors: ['INVALID_DATE_RANGE'],
  screens: ['BUY-14'],
});

/** GET /api/v1/buyer/tenders/:tenderId/publication (BUY-14). */
export const getPublicationOverview = defineEndpoint({
  id: 'buyer.publication.overview',
  method: 'GET',
  path: '/api/v1/buyer/tenders/:tenderId/publication',
  audience: 'buyer',
  permission: PUBLICATION_READ,
  params: TenderParams,
  response: PublicationOverview,
  errors: ['TENDER_NOT_FOUND'],
  screens: ['BUY-14'],
});

/** POST …/publication/publish: publish now or schedule (BUY-14, FR-08). */
export const publishTender = defineEndpoint({
  id: 'buyer.publication.publish',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/publication/publish',
  audience: 'buyer',
  permission: 'tender.publish',
  params: TenderParams,
  body: PublishBody,
  response: PublicationOutcome,
  idempotent: true,
  status: 201,
  errors: [
    'TENDER_NOT_FOUND',
    'TENDER_NOT_READY',
    'ALREADY_PUBLISHED',
    'RELEASE_APPROVAL_MISSING',
    'RELEASE_APPROVAL_INVALIDATED',
    'DRAFT_REVISION_CHANGED',
    'SCHEDULE_IN_PAST',
    'SCHEDULE_AFTER_DEADLINE',
    'PUBLICATION_HOLD_ACTIVE',
    'EXTERNAL_CHANNEL_NOT_CONFIGURED',
  ],
  screens: ['BUY-14'],
});

/** POST …/publication/cancel-schedule: withdraw a scheduled release before it runs (BUY-14). */
export const cancelScheduledPublication = defineEndpoint({
  id: 'buyer.publication.cancelSchedule',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/publication/cancel-schedule',
  audience: 'buyer',
  permission: 'tender.publish',
  params: TenderParams,
  body: CancelScheduleBody,
  response: PublicationOutcome,
  errors: ['TENDER_NOT_FOUND', 'NOT_SCHEDULED'],
  screens: ['BUY-14'],
});

/** POST /api/v1/buyer/publications/:publicationId/retry: resend a failed external notice (AC-33). */
export const retryExternalPublication = defineEndpoint({
  id: 'buyer.publication.retry',
  method: 'POST',
  path: '/api/v1/buyer/publications/:publicationId/retry',
  audience: 'buyer',
  permission: 'tender.publish',
  params: PublicationParams,
  response: PublicationRow,
  errors: ['PUBLICATION_NOT_FOUND', 'PUBLICATION_NOT_FAILED', 'NOT_EXTERNAL_CHANNEL'],
  screens: ['BUY-14'],
});

/** POST /api/v1/buyer/publications/:publicationId/reconcile: record the confirmation and close the exception. */
export const reconcileExternalPublication = defineEndpoint({
  id: 'buyer.publication.reconcile',
  method: 'POST',
  path: '/api/v1/buyer/publications/:publicationId/reconcile',
  audience: 'buyer',
  permission: 'tender.publish',
  params: PublicationParams,
  body: ReconcileBody,
  response: PublicationRow,
  errors: ['PUBLICATION_NOT_FOUND', 'NOT_EXTERNAL_CHANNEL', 'ALREADY_RECONCILED', 'VERSION_MISMATCH', 'CONFIRMATION_BEFORE_PUBLICATION'],
  screens: ['BUY-14'],
});

/** POST …/invitations/distribute: send pending invitations (BUY-14). */
export const distributeInvitations = defineEndpoint({
  id: 'buyer.publication.distributeInvitations',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/invitations/distribute',
  audience: 'buyer',
  permission: ['tender.publish', 'tender.participants.manage'],
  params: TenderParams,
  body: DistributeInvitationsBody,
  response: DistributionOutcome,
  errors: ['TENDER_NOT_FOUND', 'TENDER_NOT_RELEASED', 'NO_PENDING_INVITATIONS', 'PARTICIPANT_NOT_FOUND'],
  screens: ['BUY-14', 'BUY-15'],
});

/** GET /api/v1/buyer/tenders/:tenderId/participants (BUY-15). */
export const listParticipants = defineEndpoint({
  id: 'buyer.participants.list',
  method: 'GET',
  path: '/api/v1/buyer/tenders/:tenderId/participants',
  audience: 'buyer',
  permission: PARTICIPANT_READ,
  params: TenderParams,
  query: ParticipantListQuery,
  response: ParticipantPage,
  errors: ['TENDER_NOT_FOUND', 'INVALID_DATE_RANGE'],
  screens: ['BUY-15'],
});

/** GET /api/v1/buyer/tenders/:tenderId/participant-summary (BUY-15). */
export const getParticipantSummary = defineEndpoint({
  id: 'buyer.participants.summary',
  method: 'GET',
  path: '/api/v1/buyer/tenders/:tenderId/participant-summary',
  audience: 'buyer',
  permission: PARTICIPANT_READ,
  params: TenderParams,
  response: ParticipantSummary,
  errors: ['TENDER_NOT_FOUND'],
  screens: ['BUY-15', 'BUY-14'],
});

/** GET /api/v1/buyer/tenders/:tenderId/participants/:participantId (BUY-15). */
export const getParticipant = defineEndpoint({
  id: 'buyer.participants.get',
  method: 'GET',
  path: '/api/v1/buyer/tenders/:tenderId/participants/:participantId',
  audience: 'buyer',
  permission: PARTICIPANT_READ,
  params: ParticipantParams,
  response: ParticipantDetail,
  errors: ['TENDER_NOT_FOUND', 'PARTICIPANT_NOT_FOUND'],
  screens: ['BUY-15'],
});

/** GET /api/v1/buyer/tenders/:tenderId/invitation-candidates (BUY-15). */
export const listInvitationCandidates = defineEndpoint({
  id: 'buyer.participants.candidates',
  method: 'GET',
  path: '/api/v1/buyer/tenders/:tenderId/invitation-candidates',
  audience: 'buyer',
  permission: 'tender.participants.manage',
  params: TenderParams,
  query: InvitationCandidateQuery,
  response: pageOf(InvitationCandidate),
  errors: ['TENDER_NOT_FOUND'],
  screens: ['BUY-15'],
});

/** POST /api/v1/buyer/tenders/:tenderId/participants: invite a legal supplier (BUY-15). */
export const inviteSupplier = defineEndpoint({
  id: 'buyer.participants.invite',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/participants',
  audience: 'buyer',
  permission: 'tender.participants.manage',
  params: TenderParams,
  body: InviteSupplierBody,
  response: ParticipantRow,
  idempotent: true,
  status: 201,
  errors: [
    'TENDER_NOT_FOUND',
    'TENDER_CLOSED',
    'SUPPLIER_NOT_FOUND',
    'SUPPLIER_ALREADY_PARTICIPANT',
    'SUPPLIER_NOT_QUALIFIED',
    'SUPPLIER_RESTRICTED',
    'INVITATION_EXPIRY_INVALID',
  ],
  screens: ['BUY-15'],
});

/** POST …/participants/:participantId/contact: replace the intended contact (BUY-15). */
export const replaceParticipantContact = defineEndpoint({
  id: 'buyer.participants.replaceContact',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/participants/:participantId/contact',
  audience: 'buyer',
  permission: 'tender.participants.manage',
  params: ParticipantParams,
  body: ReplaceContactBody,
  response: ParticipantRow,
  errors: ['TENDER_NOT_FOUND', 'PARTICIPANT_NOT_FOUND', 'NOT_INVITED', 'CONTACT_UNCHANGED', 'TENDER_CLOSED'],
  screens: ['BUY-15'],
});

/** POST …/participants/:participantId/access-decision: grant or deny document access (BUY-15). */
export const decideParticipantAccess = defineEndpoint({
  id: 'buyer.participants.decideAccess',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/participants/:participantId/access-decision',
  audience: 'buyer',
  permission: 'tender.participants.manage',
  params: ParticipantParams,
  body: AccessDecisionBody,
  response: ParticipantRow,
  errors: ['TENDER_NOT_FOUND', 'PARTICIPANT_NOT_FOUND', 'ACCESS_NOT_REQUESTED', 'ACCESS_ALREADY_DECIDED', 'QUALIFICATION_GATE_NOT_MET', 'TENDER_CLOSED'],
  screens: ['BUY-15'],
});

/** POST …/participants/:participantId/resend: resend the invitation to the current contact (BUY-15). */
export const resendInvitation = defineEndpoint({
  id: 'buyer.participants.resendInvitation',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/participants/:participantId/resend',
  audience: 'buyer',
  permission: 'tender.participants.manage',
  params: ParticipantParams,
  response: ParticipantRow,
  errors: ['TENDER_NOT_FOUND', 'PARTICIPANT_NOT_FOUND', 'INVITATION_NOT_PENDING', 'INVITATION_EXPIRED'],
  screens: ['BUY-15'],
});

/** POST …/participants/:participantId/reminders: remind of outstanding acknowledgments or responses (BUY-15). */
export const remindParticipant = defineEndpoint({
  id: 'buyer.participants.remind',
  method: 'POST',
  path: '/api/v1/buyer/tenders/:tenderId/participants/:participantId/reminders',
  audience: 'buyer',
  permission: 'tender.participants.manage',
  params: ParticipantParams,
  body: ReminderBody,
  response: ReminderOutcome,
  errors: ['TENDER_NOT_FOUND', 'PARTICIPANT_NOT_FOUND', 'NOTHING_OUTSTANDING', 'TENDER_CLOSED'],
  screens: ['BUY-15'],
});
