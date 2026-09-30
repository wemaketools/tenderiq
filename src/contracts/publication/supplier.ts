/**
 * Supplier opportunity endpoints (SUP-06, SUP-07, SUP-08, SUP-09; FR-08, FR-09; BR-14, BR-15, BR-46; DD-22, DD-41,
 * DD-42).
 *
 * - Discovery (SUP-06) lists the public notices plus the events the supplier organization takes part in
 *   (invitation-only and restricted events appear only for their participants). Matches are SUGGESTIONS from the
 *   supplier's categories, regions and saved searches: they never imply eligibility or an invitation.
 * - Saved searches, watchlist items and subscriptions belong to the signed-in user in the supplier organization
 *   (`saved_searches`, `watchlist_items`, `notice_subscriptions`).
 * - A dismissed suggestion is stored per user in `opportunity_dismissals [T]` (supplier `tenant_id`, `user_id`,
 *   `tender_id`, `dismissed_at`; unique (`tenant_id`, `user_id`, `tender_id`); RLS: own rows only). The blueprint
 *   does not list this table yet (reported as a follow-up); `dismissOpportunity` inserts the row,
 *   `restoreOpportunity` deletes it, and `OpportunityRow.dismissed` / `includeDismissed` read it.
 * - Invitations and access requests (SUP-07) are answered by an authorized representative
 *   (`supplier.notices.acknowledge`). Declining may share a reason with the buyer; it never removes access to a
 *   submitted bid or a contract.
 * - The opportunity workspace (SUP-08) shows the current package, versions, addenda with acknowledgment state,
 *   sessions, conditions and participation readiness. Acknowledgments are recorded in
 *   `participant_acknowledgments`, which is authoritative (DD-42).
 * - The pursuit (SUP-09, `pursuits`, `pursuit_team_members`, `pursuit_notes`) is supplier-private. The
 *   buyer-visible `participants.bid_intent` / `shared_no_bid_reason` change ONLY through `notifyBuyer` (DD-41).
 *
 * Supplier API paths use tender ids (DD-22).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
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
import { DownloadLink } from '../documents.js';
import { defineEndpoint } from '../endpoint.js';
import {
  ParticipantAcknowledgmentsSubjectType,
  ParticipantsAccessStatus,
  ParticipantsBidIntent,
  ParticipantsInvitationStatus,
  ParticipantsQualificationGate,
  ParticipantsSource,
  PursuitTeamMembersResponsibility,
  PursuitsDecision,
  SessionRegistrationsStatus,
  SessionsSessionType,
  SessionsStatus,
  TendersEventType,
  TendersProcedure,
  TendersProcedureWrite,
  TendersStatus,
  VQualificationStatusEffectiveStatus,
} from '../enums.js';
import { ParticipantEvent, SupplierParty } from './buyer.js';
import { FilterOption } from './public.js';
import {
  BuyerLabel,
  CatalogCode,
  CategoryLabel,
  NoticeAddendum,
  NoticeCondition,
  NoticeLot,
  NoticeMilestone,
  NoticeVersion,
  PackageDocument,
  ReadinessCheck,
  RegionName,
  TenderLabel,
} from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Discovery (SUP-06)
// ---------------------------------------------------------------------------------------------------------

/** The supplier's own participation in an event, when there is one (`participants`, own row only). */
export const OwnParticipation = z.object({
  participantId: Id,
  source: ParticipantsSource,
  invitationStatus: ParticipantsInvitationStatus,
  accessStatus: ParticipantsAccessStatus,
  confidentialityAcceptedAt: Instant.nullable(),
  bidIntent: ParticipantsBidIntent,
  sharedNoBidReason: z.string().nullable(),
  intentChangedAt: Instant.nullable(),
  qualificationGate: ParticipantsQualificationGate,
  selectedLotIds: z.array(Id),
});
export type OwnParticipation = z.infer<typeof OwnParticipation>;

/** Why an opportunity is suggested. A match is a suggestion, never an eligibility decision (FR-09). */
export const OpportunityMatch = z.object({
  isMatch: z.boolean(),
  reasons: z.array(
    z.object({
      kind: z.enum(['category', 'region', 'saved_search', 'subscription', 'invitation']),
      label: z.string().min(1),
    }),
  ),
});
export type OpportunityMatch = z.infer<typeof OpportunityMatch>;

/** A discovery row (SUP-06). */
export const OpportunityRow = z.object({
  tender: TenderLabel,
  buyer: BuyerLabel,
  summary: z.string().nullable(),
  category: CategoryLabel,
  regions: z.array(z.string().min(1)),
  publishedAt: Instant,
  closingAt: OfficialDeadline.nullable(),
  isAcceptingResponses: z.boolean(),
  lotCount: z.number().int().min(0),
  amendmentCount: z.number().int().min(0),
  match: OpportunityMatch,
  watchlistItemId: Id.nullable(),
  dismissed: z.boolean(),
  participation: OwnParticipation.nullable(),
  /** The supplier's private pursuit decision (never shown to the buyer). */
  pursuitDecision: PursuitsDecision.nullable(),
  linkPath: LinkPath,
});
export type OpportunityRow = z.infer<typeof OpportunityRow>;

export const OPPORTUNITY_SORT_FIELDS = ['closingAt', 'publishedAt', 'title', 'buyer', 'match'] as const;
export const OpportunityListQuery = listQueryWithSort(OPPORTUNITY_SORT_FIELDS).extend({
  buyer: queryList(IdParam).optional(),
  category: queryList(CatalogCode).optional(),
  region: queryList(z.string().min(2).max(80)).optional(),
  procedure: queryList(TendersProcedure).optional(),
  eventType: queryList(TendersEventType).optional(),
  status: queryList(TendersStatus).optional(),
  closingFrom: CalendarDate.optional(),
  closingTo: CalendarDate.optional(),
  matchedOnly: QueryBoolean.optional(),
  watchedOnly: QueryBoolean.optional(),
  participatingOnly: QueryBoolean.optional(),
  includeDismissed: QueryBoolean.optional(),
  savedSearchId: IdParam.optional(),
});
export type OpportunityListQuery = z.input<typeof OpportunityListQuery>;

export const OpportunityPage = pageOf(OpportunityRow);
export type OpportunityPage = z.infer<typeof OpportunityPage>;

/** Discovery filter options, counted over what this supplier may see. */
export const OpportunityFilters = z.object({
  buyers: z.array(FilterOption),
  categories: z.array(FilterOption),
  regions: z.array(FilterOption),
  procedures: z.array(FilterOption),
  eventTypes: z.array(FilterOption),
  statuses: z.array(FilterOption),
  /** The supplier profile's categories and service areas used for matching. */
  profileCategories: z.array(CategoryLabel),
  profileRegions: z.array(z.string().min(1)),
  total: z.number().int().min(0),
});
export type OpportunityFilters = z.infer<typeof OpportunityFilters>;

export const OpportunityParams = z.object({ tenderId: IdParam });

export const DismissOutcome = z.object({
  tenderId: Id,
  dismissed: z.boolean(),
  dismissedAt: Instant,
});
export type DismissOutcome = z.infer<typeof DismissOutcome>;

/** The suggestion is listed again (the `opportunity_dismissals` row is deleted). */
export const RestoreOutcome = z.object({
  tenderId: Id,
  dismissed: z.literal(false),
  restoredAt: Instant,
});
export type RestoreOutcome = z.infer<typeof RestoreOutcome>;

// Watchlist -------------------------------------------------------------------------------------------------

/** A watched tender (`watchlist_items`). */
export const WatchlistItem = z.object({
  id: Id,
  tender: TenderLabel,
  buyer: BuyerLabel,
  closingAt: OfficialDeadline.nullable(),
  isAcceptingResponses: z.boolean(),
  lastAmendedAt: Instant.nullable(),
  addedAt: Instant,
  linkPath: LinkPath,
});
export type WatchlistItem = z.infer<typeof WatchlistItem>;

export const WatchlistQuery = listQueryWithSort(['closingAt', 'addedAt', 'title'] as const).extend({
  status: queryList(TendersStatus).optional(),
});
export const AddWatchlistBody = z.object({ tenderId: Id });
export const WatchlistParams = z.object({ watchlistItemId: IdParam });

// Saved searches ----------------------------------------------------------------------------------------------

/** A saved search (`saved_searches`). */
export const SavedSearch = z.object({
  id: Id,
  name: z.string().min(1),
  keywords: z.string().nullable(),
  catalogCodes: z.array(CatalogCode),
  buyerTenantIds: z.array(Id),
  regions: z.array(z.string().min(1)),
  procedures: z.array(TendersProcedure),
  notify: z.boolean(),
  /** Visible opportunities currently matching it. */
  matchCount: z.number().int().min(0),
  createdAt: Instant,
  updatedAt: Instant,
});
export type SavedSearch = z.infer<typeof SavedSearch>;

export const SavedSearchBody = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, issue('NAME_REQUIRED', 'Name the search.'))
      .max(80, issue('TEXT_TOO_LONG', 'At most 80 characters.')),
    keywords: z.string().trim().max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.')).nullable(),
    catalogCodes: z.array(CatalogCode).max(20, issue('TOO_MANY_VALUES', 'At most 20 categories.')),
    buyerTenantIds: z.array(Id).max(20, issue('TOO_MANY_VALUES', 'At most 20 buyers.')),
    regions: z.array(RegionName).max(20, issue('TOO_MANY_VALUES', 'At most 20 regions.')),
    /** Write variant: `framework_calloff` is never offered (DD-40). */
    procedures: z.array(TendersProcedureWrite),
    notify: z.boolean(),
  })
  .refine(
    (body) =>
      (body.keywords !== null && body.keywords.length > 0) ||
      body.catalogCodes.length > 0 ||
      body.buyerTenantIds.length > 0 ||
      body.regions.length > 0 ||
      body.procedures.length > 0,
    { message: issue('SAVED_SEARCH_EMPTY', 'Add at least one keyword or filter.'), path: ['keywords'] },
  );
export type SavedSearchBody = z.infer<typeof SavedSearchBody>;

export const SavedSearchParams = z.object({ savedSearchId: IdParam });
export const SavedSearchQuery = listQueryWithSort(['name', 'updatedAt'] as const);

// Subscriptions -------------------------------------------------------------------------------------------------

/** A notice subscription (`notice_subscriptions`): by buyer, by category, or both. */
export const NoticeSubscription = z.object({
  id: Id,
  buyer: BuyerLabel.nullable(),
  category: CategoryLabel.nullable(),
  active: z.boolean(),
  createdAt: Instant,
});
export type NoticeSubscription = z.infer<typeof NoticeSubscription>;

export const CreateSubscriptionBody = z
  .object({
    buyerTenantId: Id.nullable(),
    catalogCode: CatalogCode.nullable(),
  })
  .refine((body) => body.buyerTenantId !== null || body.catalogCode !== null, {
    message: issue('SUBSCRIPTION_SCOPE_REQUIRED', 'Choose a buyer, a category or both.'),
    path: ['buyerTenantId'],
  });
export type CreateSubscriptionBody = z.infer<typeof CreateSubscriptionBody>;

export const UpdateSubscriptionBody = z.object({ active: z.boolean() });
export const SubscriptionParams = z.object({ subscriptionId: IdParam });
export const SubscriptionQuery = listQueryWithSort(['createdAt'] as const).extend({ active: QueryBoolean.optional() });

// ---------------------------------------------------------------------------------------------------------
// Invitations and access requests (SUP-07)
// ---------------------------------------------------------------------------------------------------------

/** An invitation or access request of the supplier organization. */
export const InvitationRow = z.object({
  participantId: Id,
  kind: z.enum(['invitation', 'access_request']),
  tender: TenderLabel,
  buyer: BuyerLabel,
  closingAt: OfficialDeadline.nullable(),
  invitationStatus: ParticipantsInvitationStatus,
  accessStatus: ParticipantsAccessStatus,
  invitedContactName: z.string().nullable(),
  invitedContactEmail: z.string().nullable(),
  invitedAt: Instant.nullable(),
  invitationExpiresAt: Instant.nullable(),
  accessRequestedAt: Instant.nullable(),
  accessDecidedAt: Instant.nullable(),
  confidentialityRequired: z.boolean(),
  confidentialityAcceptedAt: Instant.nullable(),
  /** True while a response or acceptance by an authorized representative is awaited. */
  awaitingResponse: z.boolean(),
});
export type InvitationRow = z.infer<typeof InvitationRow>;

/** A condition with this supplier's state (met, outstanding, not applicable). */
export const ConditionState = NoticeCondition.extend({
  state: z.enum(['met', 'outstanding', 'not_applicable']),
  metAt: Instant.nullable(),
});
export type ConditionState = z.infer<typeof ConditionState>;

/** SUP-07 detail: the intended legal supplier, conditions, decisions and history. */
export const InvitationDetail = InvitationRow.extend({
  intendedSupplier: SupplierParty,
  invitationMessage: z.string().nullable(),
  /** The confidentiality undertaking text the representative accepts, when one applies. */
  confidentialityText: z.string().nullable(),
  confidentialityAcceptedBy: PersonRef.nullable(),
  conditions: z.array(ConditionState),
  accessRequestReason: z.string().nullable(),
  accessDecisionReason: z.string().nullable(),
  sharedNoBidReason: z.string().nullable(),
  history: z.array(ParticipantEvent),
  /**
   * The opportunity workspace, or `null` while the event is not visible to the organization (an invitation-only or
   * restricted event before an invitation or an access grant: forwarding an invitation does not authorize, PRD §7.5).
   */
  opportunityPath: LinkPath.nullable(),
  capabilities: z.object({
    canRespond: z.boolean(),
    canAcceptConfidentiality: z.boolean(),
  }),
});
export type InvitationDetail = z.infer<typeof InvitationDetail>;

export const INVITATION_SORT_FIELDS = ['closingAt', 'invitedAt', 'buyer', 'status'] as const;
export const InvitationListQuery = listQueryWithSort(INVITATION_SORT_FIELDS).extend({
  kind: queryList(z.enum(['invitation', 'access_request'])).optional(),
  invitationStatus: queryList(ParticipantsInvitationStatus).optional(),
  accessStatus: queryList(ParticipantsAccessStatus).optional(),
  buyer: queryList(IdParam).optional(),
  awaitingResponse: QueryBoolean.optional(),
  closingFrom: CalendarDate.optional(),
  closingTo: CalendarDate.optional(),
});
export type InvitationListQuery = z.input<typeof InvitationListQuery>;

export const InvitationParams = z.object({ participantId: IdParam });

/** Accept an invitation for the named legal supplier (SUP-07, COM-02). */
export const AcceptInvitationBody = z.object({
  confirmLegalSupplier: z.literal(true, { error: issue('LEGAL_SUPPLIER_CONFIRMATION_REQUIRED', 'Confirm the organization you accept for.') }),
  acceptConfidentiality: z.boolean(),
});
export type AcceptInvitationBody = z.infer<typeof AcceptInvitationBody>;

/** Decline an invitation; the reason is shared with the buyer only when explicitly chosen (FR-09). */
export const DeclineInvitationBody = z
  .object({
    shareReasonWithBuyer: z.boolean(),
    sharedReason: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
  })
  .refine((body) => !body.shareReasonWithBuyer || (body.sharedReason !== undefined && body.sharedReason.length > 0), {
    message: issue('SHARED_REASON_REQUIRED', 'Enter the reason to share with the buyer.'),
    path: ['sharedReason'],
  });
export type DeclineInvitationBody = z.infer<typeof DeclineInvitationBody>;

// ---------------------------------------------------------------------------------------------------------
// Opportunity workspace (SUP-08)
// ---------------------------------------------------------------------------------------------------------

/** A lot with this supplier's eligibility and selection. */
export const WorkspaceLot = NoticeLot.extend({
  eligible: z.boolean(),
  ineligibleReason: z.string().nullable(),
  selected: z.boolean(),
});
export type WorkspaceLot = z.infer<typeof WorkspaceLot>;

/** A package document with its availability for this supplier. */
export const WorkspaceDocument = PackageDocument.extend({
  available: z.boolean(),
  lockedReason: z.string().nullable(),
});
export type WorkspaceDocument = z.infer<typeof WorkspaceDocument>;

/** An addendum with this supplier's acknowledgment (DD-42). */
export const WorkspaceAddendum = NoticeAddendum.extend({
  acknowledgmentRequired: z.boolean(),
  acknowledgedAt: Instant.nullable(),
  acknowledgedBy: PersonRef.nullable(),
});
export type WorkspaceAddendum = z.infer<typeof WorkspaceAddendum>;

/** A briefing or site visit with this supplier's registration (`sessions`, `session_registrations`). */
export const WorkspaceSession = z.object({
  sessionId: Id,
  sessionType: SessionsSessionType,
  title: z.string().min(1),
  lotNo: z.number().int().min(1).nullable(),
  startsAt: OfficialDeadline,
  endsAt: Instant,
  venue: z.string().min(1),
  mandatory: z.boolean(),
  capacity: z.number().int().min(0).nullable(),
  placesLeft: z.number().int().min(0).nullable(),
  /** The last moment to register, in the tender's official time zone (DD-33). */
  registrationDeadline: OfficialDeadline.nullable(),
  status: SessionsStatus,
  registrationStatus: SessionRegistrationsStatus.nullable(),
});
export type WorkspaceSession = z.infer<typeof WorkspaceSession>;

/** SUP-08: the current package and the supplier's participation readiness. */
export const OpportunityWorkspace = z.object({
  tender: TenderLabel.extend({
    summary: z.string().nullable(),
    category: CategoryLabel,
    regions: z.array(z.string().min(1)),
    officialTimeZone: TimeZone,
    currentVersionNo: z.number().int().min(1),
    eligibilitySummary: z.string().nullable(),
    deliveryRequirements: z.string().nullable(),
    submissionRules: z.string().nullable(),
    communicationChannelNote: z.string().nullable(),
    contractConditions: z.string().nullable(),
    acceptedLanguages: z.array(z.string().min(2)),
    maxLotsPerSupplier: z.number().int().min(1).nullable(),
    submissionDeadline: OfficialDeadline.nullable(),
    isAcceptingResponses: z.boolean(),
    publishedAt: Instant,
  }),
  buyer: BuyerLabel,
  participation: OwnParticipation.nullable(),
  lots: z.array(WorkspaceLot),
  milestones: z.array(NoticeMilestone),
  documents: z.array(WorkspaceDocument),
  versions: z.array(NoticeVersion),
  addenda: z.array(WorkspaceAddendum),
  sessions: z.array(WorkspaceSession),
  conditions: z.array(ConditionState),
  qualification: z
    .object({
      programName: z.string().min(1),
      effectiveStatus: VQualificationStatusEffectiveStatus,
      effectiveTo: CalendarDate.nullable(),
      conditions: z.string().nullable(),
    })
    .nullable(),
  readiness: z.array(ReadinessCheck),
  pursuitDecision: PursuitsDecision.nullable(),
  watchlistItemId: Id.nullable(),
  capabilities: z.object({
    canRegisterInterest: z.boolean(),
    canRequestAccess: z.boolean(),
    canAcceptConfidentiality: z.boolean(),
    canAcknowledge: z.boolean(),
    canSelectLots: z.boolean(),
    canManagePursuit: z.boolean(),
    canStartResponse: z.boolean(),
    /**
     * The organization takes part in the event's clarification channel (SUP-10, SUP-11): its questions, the
     * published answers and the briefing sessions. False for an organization that does not take part yet.
     */
    canViewClarifications: z.boolean(),
  }),
});
export type OpportunityWorkspace = z.infer<typeof OpportunityWorkspace>;

export const TenderDocumentParams = z.object({ tenderId: IdParam, documentId: IdParam });

/** Register interest in a public event as the signed-in supplier organization. */
export const RegisterInterestBody = z.object({
  contactName: z.string().trim().min(2, issue('CONTACT_NAME_REQUIRED', 'Enter the contact name.')).max(120),
  contactEmail: z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.')),
});
export type RegisterInterestBody = z.infer<typeof RegisterInterestBody>;

/** Request access to restricted documents (BR-15). */
export const AccessRequestBody = z.object({
  reason: ReasonText,
  contactName: z.string().trim().min(2, issue('CONTACT_NAME_REQUIRED', 'Enter the contact name.')).max(120),
  contactEmail: z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.')),
});
export type AccessRequestBody = z.infer<typeof AccessRequestBody>;

/** Accept the confidentiality undertaking for the organization (SUP-07, SUP-08). */
export const ConfidentialityBody = z.object({
  accept: z.literal(true, { error: issue('ACCEPTANCE_REQUIRED', 'Tick the box to accept the undertaking.') }),
});

/** Acknowledge an addendum, a condition, a version or a notice (DD-42). */
export const AcknowledgeBody = z.object({
  subjectType: ParticipantAcknowledgmentsSubjectType,
  subjectId: Id,
});
export type AcknowledgeBody = z.infer<typeof AcknowledgeBody>;

export const AcknowledgmentReceipt = z.object({
  participantId: Id,
  subjectType: ParticipantAcknowledgmentsSubjectType,
  subjectId: Id,
  acknowledgedAt: Instant,
  acknowledgedBy: PersonRef,
});
export type AcknowledgmentReceipt = z.infer<typeof AcknowledgmentReceipt>;

/** Choose the lots to respond to (`participant_lot_selections`). */
export const SelectLotsBody = z.object({
  lotIds: z
    .array(Id)
    .min(1, issue('LOTS_REQUIRED', 'Select at least one lot.'))
    .refine((ids) => new Set(ids).size === ids.length, issue('DUPLICATE_LOT', 'Each lot may appear once.')),
});
export type SelectLotsBody = z.infer<typeof SelectLotsBody>;

export const LotSelection = z.object({
  participantId: Id,
  selectedLotIds: z.array(Id),
  updatedAt: Instant,
});

/** The hand-off to response preparation (the bids domain owns the response). */
export const StartResponseOutcome = z.object({
  tenderId: Id,
  participantId: Id,
  readiness: z.array(ReadinessCheck),
  /** Where the SPA continues (SUP-12). */
  nextPath: LinkPath,
});

// ---------------------------------------------------------------------------------------------------------
// Pursuit (SUP-09)
// ---------------------------------------------------------------------------------------------------------

/** A bid-team member (`pursuit_team_members`). */
export const PursuitTeamMember = z.object({
  id: Id,
  user: PersonRef,
  capacity: z.string().nullable(),
  responsibility: PursuitTeamMembersResponsibility,
  sectionScope: z.array(z.string().min(1)),
  lotIds: z.array(Id),
  dueAt: Instant.nullable(),
  canViewPricing: z.boolean(),
});
export type PursuitTeamMember = z.infer<typeof PursuitTeamMember>;

/** A private pursuit note (`pursuit_notes`). */
export const PursuitNote = z.object({
  id: Id,
  author: PersonRef,
  body: z.string().min(1),
  createdAt: Instant,
});
export type PursuitNote = z.infer<typeof PursuitNote>;

/** The private pursuit (`pursuits`). The buyer never reads it. */
export const PursuitDetail = z.object({
  id: Id,
  tenderId: Id,
  attractiveness: z.number().int().min(1).max(5).nullable(),
  capacityNote: z.string().nullable(),
  estimatedEffortHours: z.number().int().min(0).nullable(),
  risks: z.string().nullable(),
  pursuitOwner: PersonRef.nullable(),
  decision: PursuitsDecision,
  internalRationale: z.string().nullable(),
  decidedAt: Instant.nullable(),
  decidedBy: PersonRef.nullable(),
  team: z.array(PursuitTeamMember),
  notes: z.array(PursuitNote),
  createdAt: Instant,
  updatedAt: Instant,
});
export type PursuitDetail = z.infer<typeof PursuitDetail>;

/** What the buyer sees of the supplier's intent (`participants.bid_intent`, DD-41). */
export const BuyerVisibleIntent = z.object({
  participantId: Id.nullable(),
  bidIntent: ParticipantsBidIntent,
  sharedNoBidReason: z.string().nullable(),
  intentChangedAt: Instant.nullable(),
});
export type BuyerVisibleIntent = z.infer<typeof BuyerVisibleIntent>;

/** SUP-09: the pursuit (or `null` before one is started) and the buyer-visible intent side by side. */
export const PursuitView = z.object({
  tender: TenderLabel.extend({
    closingAt: OfficialDeadline.nullable(),
    isAcceptingResponses: z.boolean(),
  }),
  buyer: BuyerLabel,
  lots: z.array(z.object({ lotId: Id, lotNo: z.number().int().min(1), title: z.string().min(1) })),
  pursuit: PursuitDetail.nullable(),
  buyerVisible: BuyerVisibleIntent,
  capabilities: z.object({
    canManage: z.boolean(),
    canNotifyBuyer: z.boolean(),
  }),
});
export type PursuitView = z.infer<typeof PursuitView>;

/** A pursuit row (SUP-09 list, SUP-01 widgets). */
export const PursuitRow = z.object({
  id: Id,
  tender: TenderLabel,
  buyer: BuyerLabel,
  closingAt: OfficialDeadline.nullable(),
  decision: PursuitsDecision,
  attractiveness: z.number().int().min(1).max(5).nullable(),
  estimatedEffortHours: z.number().int().min(0).nullable(),
  pursuitOwner: PersonRef.nullable(),
  teamSize: z.number().int().min(0),
  bidIntent: ParticipantsBidIntent.nullable(),
  updatedAt: Instant,
  linkPath: LinkPath,
});
export type PursuitRow = z.infer<typeof PursuitRow>;

export const PURSUIT_SORT_FIELDS = ['closingAt', 'updatedAt', 'attractiveness', 'title'] as const;
export const PursuitListQuery = listQueryWithSort(PURSUIT_SORT_FIELDS).extend({
  decision: queryList(PursuitsDecision).optional(),
  ownerUserId: IdParam.optional(),
  mine: QueryBoolean.optional(),
  closingFrom: CalendarDate.optional(),
  closingTo: CalendarDate.optional(),
});
export type PursuitListQuery = z.input<typeof PursuitListQuery>;

const OptionalText = (max: number) =>
  z.string().trim().max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`)).nullable();

/** Create or update the pursuit assessment. */
export const SavePursuitBody = z.object({
  attractiveness: z
    .number()
    .int()
    .min(1, issue('INVALID_RATING', 'Rate from 1 to 5.'))
    .max(5, issue('INVALID_RATING', 'Rate from 1 to 5.'))
    .nullable(),
  capacityNote: OptionalText(2000),
  estimatedEffortHours: z
    .number()
    .int(issue('INVALID_EFFORT', 'Use whole hours.'))
    .min(0, issue('INVALID_EFFORT', 'Cannot be negative.'))
    .max(100_000, issue('INVALID_EFFORT', 'Too large.'))
    .nullable(),
  risks: OptionalText(4000),
  pursuitOwnerUserId: Id.nullable(),
});
export type SavePursuitBody = z.infer<typeof SavePursuitBody>;

/** Record the private bid/no-bid decision (never sent to the buyer, DD-41). */
export const PursuitDecisionBody = z.object({
  decision: PursuitsDecision,
  internalRationale: ReasonText,
});
export type PursuitDecisionBody = z.infer<typeof PursuitDecisionBody>;

/** The explicit "notify buyer" action: the only way `bid_intent` / `shared_no_bid_reason` change (DD-41). */
export const NotifyBuyerBody = z
  .object({
    bidIntent: ParticipantsBidIntent,
    sharedNoBidReason: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).optional(),
  })
  .refine((body) => body.bidIntent === 'no_bid' || body.sharedNoBidReason === undefined, {
    message: issue('SHARED_REASON_ONLY_FOR_NO_BID', 'A reason is shared only with a no-bid.'),
    path: ['sharedNoBidReason'],
  });
export type NotifyBuyerBody = z.infer<typeof NotifyBuyerBody>;

export const TeamMemberBody = z.object({
  responsibility: PursuitTeamMembersResponsibility,
  sectionScope: z.array(z.string().trim().min(1).max(80)).max(30),
  lotIds: z.array(Id),
  dueAt: z.iso.datetime({ offset: false, local: false, error: issue('INVALID_INSTANT', 'Use an ISO 8601 UTC timestamp.') }).nullable(),
  canViewPricing: z.boolean(),
});
export type TeamMemberBody = z.infer<typeof TeamMemberBody>;

export const AddTeamMemberBody = TeamMemberBody.extend({ userId: Id });
export type AddTeamMemberBody = z.infer<typeof AddTeamMemberBody>;

export const TeamMemberParams = z.object({ tenderId: IdParam, memberId: IdParam });

export const AddNoteBody = z.object({
  body: z
    .string()
    .trim()
    .min(1, issue('NOTE_REQUIRED', 'Write the note.'))
    .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
});

/** A member of the supplier organization who can join a bid team. */
export const TeamCandidate = z.object({
  user: PersonRef,
  capacity: z.string().nullable(),
  roleNames: z.array(z.string().min(1)),
  /** Holds `supplier.pricing.edit` (only such members may see pricing). */
  canViewPricing: z.boolean(),
  canSubmit: z.boolean(),
});
export type TeamCandidate = z.infer<typeof TeamCandidate>;

export const TeamCandidateList = z.object({ items: z.array(TeamCandidate) });

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/opportunities (SUP-06). */
export const listOpportunities = defineEndpoint({
  id: 'supplier.opportunities.list',
  method: 'GET',
  path: '/api/v1/supplier/opportunities',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  query: OpportunityListQuery,
  response: OpportunityPage,
  errors: ['SAVED_SEARCH_NOT_FOUND', 'INVALID_DATE_RANGE'],
  screens: ['SUP-06'],
});

/** GET /api/v1/supplier/opportunity-filters (SUP-06). */
export const getOpportunityFilters = defineEndpoint({
  id: 'supplier.opportunities.filters',
  method: 'GET',
  path: '/api/v1/supplier/opportunity-filters',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  response: OpportunityFilters,
  errors: [],
  screens: ['SUP-06'],
});

/** GET /api/v1/supplier/opportunities/:tenderId: the opportunity workspace (SUP-08). */
export const getOpportunityWorkspace = defineEndpoint({
  id: 'supplier.opportunities.get',
  method: 'GET',
  path: '/api/v1/supplier/opportunities/:tenderId',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: OpportunityParams,
  response: OpportunityWorkspace,
  errors: ['OPPORTUNITY_NOT_FOUND'],
  screens: ['SUP-08'],
  summary: 'Invitation-only and restricted events answer OPPORTUNITY_NOT_FOUND to non-participants.',
});

/** POST …/dismiss: hide a suggestion from discovery (SUP-06). */
export const dismissOpportunity = defineEndpoint({
  id: 'supplier.opportunities.dismiss',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/dismiss',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: OpportunityParams,
  response: DismissOutcome,
  errors: ['OPPORTUNITY_NOT_FOUND', 'ALREADY_DISMISSED'],
  screens: ['SUP-06'],
});

/** DELETE …/dismiss: list a dismissed suggestion again (SUP-06, "Include dismissed" view). */
export const restoreOpportunity = defineEndpoint({
  id: 'supplier.opportunities.restore',
  method: 'DELETE',
  path: '/api/v1/supplier/opportunities/:tenderId/dismiss',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: OpportunityParams,
  response: RestoreOutcome,
  errors: ['OPPORTUNITY_NOT_FOUND', 'NOT_DISMISSED'],
  screens: ['SUP-06'],
});

/** POST …/interest: register interest as the organization (SUP-08, PUB-03). */
export const registerInterest = defineEndpoint({
  id: 'supplier.opportunities.registerInterest',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/interest',
  audience: 'supplier',
  permission: ['supplier.pursuit.manage', 'supplier.notices.acknowledge'],
  params: OpportunityParams,
  body: RegisterInterestBody,
  response: OwnParticipation,
  idempotent: true,
  status: 201,
  errors: ['OPPORTUNITY_NOT_FOUND', 'ALREADY_PARTICIPATING', 'NOTICE_NOT_OPEN', 'INVITATION_ONLY'],
  screens: ['SUP-08', 'SUP-06', 'PUB-03'],
});

/** POST …/access-request: request access to restricted documents (SUP-07). */
export const requestAccess = defineEndpoint({
  id: 'supplier.opportunities.requestAccess',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/access-request',
  audience: 'supplier',
  permission: 'supplier.notices.acknowledge',
  params: OpportunityParams,
  body: AccessRequestBody,
  response: OwnParticipation,
  idempotent: true,
  status: 201,
  errors: ['OPPORTUNITY_NOT_FOUND', 'ACCESS_NOT_REQUIRED', 'ACCESS_ALREADY_REQUESTED', 'ACCESS_ALREADY_GRANTED', 'NOTICE_NOT_OPEN'],
  screens: ['SUP-07', 'SUP-08', 'PUB-03'],
});

/** POST …/confidentiality: accept the confidentiality undertaking (SUP-07, SUP-08). */
export const acceptConfidentiality = defineEndpoint({
  id: 'supplier.opportunities.acceptConfidentiality',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/confidentiality',
  audience: 'supplier',
  permission: 'supplier.notices.acknowledge',
  params: OpportunityParams,
  body: ConfidentialityBody,
  response: OwnParticipation,
  errors: ['OPPORTUNITY_NOT_FOUND', 'NOT_A_PARTICIPANT', 'CONFIDENTIALITY_NOT_REQUIRED', 'CONFIDENTIALITY_ALREADY_ACCEPTED', 'ACCESS_NOT_GRANTED'],
  screens: ['SUP-07', 'SUP-08'],
});

/** POST …/acknowledgments: acknowledge an addendum, condition, version or notice (SUP-08, DD-42). */
export const acknowledgeSubject = defineEndpoint({
  id: 'supplier.opportunities.acknowledge',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/acknowledgments',
  audience: 'supplier',
  permission: 'supplier.notices.acknowledge',
  params: OpportunityParams,
  body: AcknowledgeBody,
  response: AcknowledgmentReceipt,
  idempotent: true,
  status: 201,
  errors: ['OPPORTUNITY_NOT_FOUND', 'NOT_A_PARTICIPANT', 'SUBJECT_NOT_FOUND', 'ACKNOWLEDGMENT_NOT_REQUIRED', 'ALREADY_ACKNOWLEDGED'],
  screens: ['SUP-08'],
});

/** PUT …/lots: select the lots to respond to (SUP-08). */
export const selectLots = defineEndpoint({
  id: 'supplier.opportunities.selectLots',
  method: 'PUT',
  path: '/api/v1/supplier/opportunities/:tenderId/lots',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: OpportunityParams,
  body: SelectLotsBody,
  response: LotSelection,
  errors: ['OPPORTUNITY_NOT_FOUND', 'NOT_A_PARTICIPANT', 'LOT_NOT_FOUND', 'LOT_NOT_OPEN', 'LOT_NOT_ELIGIBLE', 'MAX_LOTS_EXCEEDED'],
  screens: ['SUP-08'],
});

/** GET …/documents/:documentId/download: a package document (SUP-08); access is logged (`document_access_log`). */
export const downloadOpportunityDocument = defineEndpoint({
  id: 'supplier.opportunities.documentDownload',
  method: 'GET',
  path: '/api/v1/supplier/opportunities/:tenderId/documents/:documentId/download',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: TenderDocumentParams,
  response: DownloadLink,
  errors: ['OPPORTUNITY_NOT_FOUND', 'DOCUMENT_NOT_FOUND', 'DOCUMENT_ACCESS_NOT_GRANTED', 'CONFIDENTIALITY_NOT_ACCEPTED'],
  screens: ['SUP-08'],
});

/** POST …/start-response: move to response preparation once participation is ready (SUP-08). */
export const startResponse = defineEndpoint({
  id: 'supplier.opportunities.startResponse',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/start-response',
  audience: 'supplier',
  permission: ['supplier.response.edit', 'supplier.pursuit.manage'],
  params: OpportunityParams,
  response: StartResponseOutcome,
  errors: ['OPPORTUNITY_NOT_FOUND', 'NOT_A_PARTICIPANT', 'NOTICE_NOT_OPEN', 'READINESS_BLOCKED'],
  screens: ['SUP-08'],
});

/** GET /api/v1/supplier/watchlist (SUP-06). */
export const listWatchlist = defineEndpoint({
  id: 'supplier.watchlist.list',
  method: 'GET',
  path: '/api/v1/supplier/watchlist',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  query: WatchlistQuery,
  response: pageOf(WatchlistItem),
  errors: [],
  screens: ['SUP-06'],
});

/** POST /api/v1/supplier/watchlist (SUP-06). */
export const addToWatchlist = defineEndpoint({
  id: 'supplier.watchlist.add',
  method: 'POST',
  path: '/api/v1/supplier/watchlist',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  body: AddWatchlistBody,
  response: WatchlistItem,
  idempotent: true,
  status: 201,
  errors: ['OPPORTUNITY_NOT_FOUND', 'ALREADY_WATCHED'],
  screens: ['SUP-06', 'SUP-08'],
});

/** DELETE /api/v1/supplier/watchlist/:watchlistItemId (SUP-06). */
export const removeFromWatchlist = defineEndpoint({
  id: 'supplier.watchlist.remove',
  method: 'DELETE',
  path: '/api/v1/supplier/watchlist/:watchlistItemId',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: WatchlistParams,
  response: z.null(),
  status: 204,
  errors: ['WATCHLIST_ITEM_NOT_FOUND'],
  screens: ['SUP-06', 'SUP-08'],
});

/** GET /api/v1/supplier/saved-searches (SUP-06). */
export const listSavedSearches = defineEndpoint({
  id: 'supplier.savedSearches.list',
  method: 'GET',
  path: '/api/v1/supplier/saved-searches',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  query: SavedSearchQuery,
  response: pageOf(SavedSearch),
  errors: [],
  screens: ['SUP-06'],
});

/** POST /api/v1/supplier/saved-searches (SUP-06). */
export const createSavedSearch = defineEndpoint({
  id: 'supplier.savedSearches.create',
  method: 'POST',
  path: '/api/v1/supplier/saved-searches',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  body: SavedSearchBody,
  response: SavedSearch,
  idempotent: true,
  status: 201,
  errors: ['DUPLICATE_SAVED_SEARCH_NAME', 'UNKNOWN_CATEGORY', 'UNKNOWN_BUYER'],
  screens: ['SUP-06'],
});

/** PUT /api/v1/supplier/saved-searches/:savedSearchId (SUP-06). */
export const updateSavedSearch = defineEndpoint({
  id: 'supplier.savedSearches.update',
  method: 'PUT',
  path: '/api/v1/supplier/saved-searches/:savedSearchId',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: SavedSearchParams,
  body: SavedSearchBody,
  response: SavedSearch,
  errors: ['SAVED_SEARCH_NOT_FOUND', 'DUPLICATE_SAVED_SEARCH_NAME', 'UNKNOWN_CATEGORY', 'UNKNOWN_BUYER'],
  screens: ['SUP-06'],
});

/** DELETE /api/v1/supplier/saved-searches/:savedSearchId (SUP-06). */
export const deleteSavedSearch = defineEndpoint({
  id: 'supplier.savedSearches.delete',
  method: 'DELETE',
  path: '/api/v1/supplier/saved-searches/:savedSearchId',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: SavedSearchParams,
  response: z.null(),
  status: 204,
  errors: ['SAVED_SEARCH_NOT_FOUND'],
  screens: ['SUP-06'],
});

/** GET /api/v1/supplier/notice-subscriptions (SUP-06). */
export const listSubscriptions = defineEndpoint({
  id: 'supplier.subscriptions.list',
  method: 'GET',
  path: '/api/v1/supplier/notice-subscriptions',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  query: SubscriptionQuery,
  response: pageOf(NoticeSubscription),
  errors: [],
  screens: ['SUP-06'],
});

/** POST /api/v1/supplier/notice-subscriptions (SUP-06, PUB-02). */
export const createSubscription = defineEndpoint({
  id: 'supplier.subscriptions.create',
  method: 'POST',
  path: '/api/v1/supplier/notice-subscriptions',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  body: CreateSubscriptionBody,
  response: NoticeSubscription,
  idempotent: true,
  status: 201,
  errors: ['SUBSCRIPTION_EXISTS', 'UNKNOWN_CATEGORY', 'UNKNOWN_BUYER'],
  screens: ['SUP-06', 'PUB-02'],
});

/** PUT /api/v1/supplier/notice-subscriptions/:subscriptionId: pause or resume (SUP-06). */
export const updateSubscription = defineEndpoint({
  id: 'supplier.subscriptions.update',
  method: 'PUT',
  path: '/api/v1/supplier/notice-subscriptions/:subscriptionId',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: SubscriptionParams,
  body: UpdateSubscriptionBody,
  response: NoticeSubscription,
  errors: ['SUBSCRIPTION_NOT_FOUND'],
  screens: ['SUP-06'],
});

/** DELETE /api/v1/supplier/notice-subscriptions/:subscriptionId (SUP-06). */
export const deleteSubscription = defineEndpoint({
  id: 'supplier.subscriptions.delete',
  method: 'DELETE',
  path: '/api/v1/supplier/notice-subscriptions/:subscriptionId',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: SubscriptionParams,
  response: z.null(),
  status: 204,
  errors: ['SUBSCRIPTION_NOT_FOUND'],
  screens: ['SUP-06'],
});

/** GET /api/v1/supplier/invitations: invitations and access requests (SUP-07). */
export const listInvitations = defineEndpoint({
  id: 'supplier.invitations.list',
  method: 'GET',
  path: '/api/v1/supplier/invitations',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  query: InvitationListQuery,
  response: pageOf(InvitationRow),
  errors: ['INVALID_DATE_RANGE'],
  screens: ['SUP-07'],
});

/** GET /api/v1/supplier/invitations/:participantId (SUP-07). */
export const getInvitation = defineEndpoint({
  id: 'supplier.invitations.get',
  method: 'GET',
  path: '/api/v1/supplier/invitations/:participantId',
  audience: 'supplier',
  permission: 'supplier.opportunities.view',
  params: InvitationParams,
  response: InvitationDetail,
  errors: ['INVITATION_NOT_FOUND'],
  screens: ['SUP-07'],
});

/** POST /api/v1/supplier/invitations/:participantId/accept: by an authorized representative (SUP-07). */
export const acceptInvitation = defineEndpoint({
  id: 'supplier.invitations.accept',
  method: 'POST',
  path: '/api/v1/supplier/invitations/:participantId/accept',
  audience: 'supplier',
  permission: 'supplier.notices.acknowledge',
  params: InvitationParams,
  body: AcceptInvitationBody,
  response: InvitationDetail,
  errors: ['INVITATION_NOT_FOUND', 'NOT_AN_INVITATION', 'INVITATION_NOT_PENDING', 'INVITATION_EXPIRED', 'CONFIDENTIALITY_ACCEPTANCE_REQUIRED'],
  screens: ['SUP-07'],
});

/** POST /api/v1/supplier/invitations/:participantId/decline: optionally sharing a reason (SUP-07, FR-09). */
export const declineInvitation = defineEndpoint({
  id: 'supplier.invitations.decline',
  method: 'POST',
  path: '/api/v1/supplier/invitations/:participantId/decline',
  audience: 'supplier',
  permission: 'supplier.notices.acknowledge',
  params: InvitationParams,
  body: DeclineInvitationBody,
  response: InvitationDetail,
  errors: ['INVITATION_NOT_FOUND', 'NOT_AN_INVITATION', 'INVITATION_NOT_PENDING', 'INVITATION_EXPIRED'],
  screens: ['SUP-07'],
});

/** GET /api/v1/supplier/pursuits (SUP-09). */
export const listPursuits = defineEndpoint({
  id: 'supplier.pursuits.list',
  method: 'GET',
  path: '/api/v1/supplier/pursuits',
  audience: 'supplier',
  permission: ['supplier.pursuit.manage', 'supplier.opportunities.view'],
  query: PursuitListQuery,
  response: pageOf(PursuitRow),
  errors: ['INVALID_DATE_RANGE'],
  screens: ['SUP-09', 'SUP-06'],
});

/** GET /api/v1/supplier/pursuit-team-candidates: members who can join a bid team (SUP-09). */
export const listPursuitTeamCandidates = defineEndpoint({
  id: 'supplier.pursuits.teamCandidates',
  method: 'GET',
  path: '/api/v1/supplier/pursuit-team-candidates',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  response: TeamCandidateList,
  errors: [],
  screens: ['SUP-09'],
});

/** GET /api/v1/supplier/opportunities/:tenderId/pursuit (SUP-09). */
export const getPursuit = defineEndpoint({
  id: 'supplier.pursuits.get',
  method: 'GET',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit',
  audience: 'supplier',
  permission: ['supplier.pursuit.manage', 'supplier.opportunities.view'],
  params: OpportunityParams,
  response: PursuitView,
  errors: ['OPPORTUNITY_NOT_FOUND'],
  screens: ['SUP-09'],
});

/** PUT …/pursuit: create or update the pursuit assessment (SUP-09). */
export const savePursuit = defineEndpoint({
  id: 'supplier.pursuits.save',
  method: 'PUT',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: OpportunityParams,
  body: SavePursuitBody,
  response: PursuitDetail,
  errors: ['OPPORTUNITY_NOT_FOUND', 'PURSUIT_OWNER_NOT_MEMBER'],
  screens: ['SUP-09'],
});

/** POST …/pursuit/decision: the private bid/no-bid decision (SUP-09, DD-41). */
export const decidePursuit = defineEndpoint({
  id: 'supplier.pursuits.decide',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit/decision',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: OpportunityParams,
  body: PursuitDecisionBody,
  response: PursuitDetail,
  errors: ['OPPORTUNITY_NOT_FOUND', 'OPPORTUNITY_CLOSED', 'DECISION_UNCHANGED'],
  screens: ['SUP-09'],
});

/** POST …/pursuit/notify-buyer: share the bid intent (and a no-bid reason) with the buyer (SUP-09, DD-41). */
export const notifyBuyerOfIntent = defineEndpoint({
  id: 'supplier.pursuits.notifyBuyer',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit/notify-buyer',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: OpportunityParams,
  body: NotifyBuyerBody,
  response: BuyerVisibleIntent,
  errors: ['OPPORTUNITY_NOT_FOUND', 'NOT_A_PARTICIPANT', 'OPPORTUNITY_CLOSED', 'INTENT_UNCHANGED'],
  screens: ['SUP-09', 'SUP-07'],
});

/** POST …/pursuit/team: add a bid-team member (SUP-09). */
export const addPursuitTeamMember = defineEndpoint({
  id: 'supplier.pursuits.addTeamMember',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit/team',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: OpportunityParams,
  body: AddTeamMemberBody,
  response: PursuitTeamMember,
  idempotent: true,
  status: 201,
  errors: ['OPPORTUNITY_NOT_FOUND', 'PURSUIT_NOT_STARTED', 'USER_NOT_MEMBER', 'ALREADY_ON_TEAM', 'PRICING_ACCESS_NOT_PERMITTED', 'LOT_NOT_FOUND'],
  screens: ['SUP-09'],
});

/** PUT …/pursuit/team/:memberId (SUP-09). */
export const updatePursuitTeamMember = defineEndpoint({
  id: 'supplier.pursuits.updateTeamMember',
  method: 'PUT',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit/team/:memberId',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: TeamMemberParams,
  body: TeamMemberBody,
  response: PursuitTeamMember,
  errors: ['OPPORTUNITY_NOT_FOUND', 'PURSUIT_NOT_STARTED', 'MEMBER_NOT_FOUND', 'PRICING_ACCESS_NOT_PERMITTED', 'LOT_NOT_FOUND'],
  screens: ['SUP-09'],
});

/** DELETE …/pursuit/team/:memberId (SUP-09). */
export const removePursuitTeamMember = defineEndpoint({
  id: 'supplier.pursuits.removeTeamMember',
  method: 'DELETE',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit/team/:memberId',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: TeamMemberParams,
  response: z.null(),
  status: 204,
  errors: ['OPPORTUNITY_NOT_FOUND', 'PURSUIT_NOT_STARTED', 'MEMBER_NOT_FOUND', 'LAST_BID_MANAGER'],
  screens: ['SUP-09'],
});

/** POST …/pursuit/notes: add a private note (SUP-09). */
export const addPursuitNote = defineEndpoint({
  id: 'supplier.pursuits.addNote',
  method: 'POST',
  path: '/api/v1/supplier/opportunities/:tenderId/pursuit/notes',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: OpportunityParams,
  body: AddNoteBody,
  response: PursuitNote,
  idempotent: true,
  status: 201,
  errors: ['OPPORTUNITY_NOT_FOUND', 'PURSUIT_NOT_STARTED'],
  screens: ['SUP-09'],
});
