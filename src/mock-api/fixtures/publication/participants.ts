/**
 * Publication fixtures: `participants` of every released event, with acknowledgments
 * (`participant_acknowledgments`, authoritative per DD-42), lot selections, formal deliveries
 * (`notice_recipients`), session registrations and the participant history (BUY-15, SUP-07, SUP-08).
 *
 * Participant ids are `tender * 100 + supplier tenant id` (T-2026-0006 × Tsodilo = 604).
 *
 * The organizations follow the bids and clarifications fixtures (who bid, who acknowledged, who registered for a
 * session): acknowledgments, addendum deliveries and session registrations are DERIVED from the clarifications
 * fixtures (`withOwnedFacts`). Storyline anchors:
 * - T-2026-0002 (AC-10): addendum 1 acknowledged by Gaborone Metering, Tsodilo and Serowe ICT, NOT by Chobe;
 *   KWU invited Makgadikgadi (installation capacity) and the invitation awaits an authorized answer (SUP-07).
 * - T-2026-0006 (invitation-only, AC-01): Tsodilo and Chobe invited and accepted; Chobe's first invitation bounced
 *   and its contact was replaced without changing the invited legal supplier. Makgadikgadi received a forwarded
 *   invitation and asked for access: forwarding does not authorize it, and its qualification gate is not met.
 * - T-2026-0001: Makgadikgadi's qualification gate is not met (AC-07).
 * - T-2026-0008: Gaborone Metering shared a no-bid reason with the buyer (DD-41).
 * - T-2026-0009 (restricted): three access requests granted, one denied.
 * - T-2026-0011 (ODC, eligibility review + confidentiality undertaking): Limpopo (Lots 1 and 2) and Makgadikgadi
 *   (Lot 1) were admitted and bid. Chobe registered after Addendum 1 and was admitted on 25 Sep; it has not yet
 *   accepted the confidentiality undertaking, acknowledged the addendum or selected lots (SUP-08 actions).
 */
import type {
  NoticeRecipientsDeliveryStatus,
  NoticesNoticeType,
  ParticipantAcknowledgmentsSubjectType,
  ParticipantsAccessStatus,
  ParticipantsBidIntent,
  ParticipantsInvitationStatus,
  ParticipantsQualificationGate,
  ParticipantsSource,
  SessionRegistrationsStatus,
} from '../../../contracts/enums.js';
import type { ParticipantEvent } from '../../../contracts/publication.js';
import { ADDENDA, SESSIONS } from '../clarifications/index.js';
import { PERSONAS, TENANT_IDS } from '../platform.js';

export interface FixtureAcknowledgment {
  readonly subjectType: ParticipantAcknowledgmentsSubjectType;
  readonly subjectId: number;
  readonly acknowledgedAt: string;
  readonly acknowledgedByUserId: number;
}

export interface FixtureDelivery {
  readonly noticeId: number;
  readonly noticeType: NoticesNoticeType;
  readonly title: string;
  readonly recipientUserId: number | null;
  readonly recipientEmail: string | null;
  readonly deliveryStatus: NoticeRecipientsDeliveryStatus;
  readonly deliveredAt: string | null;
  readonly openedAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly failureReason: string | null;
  readonly issuedAt: string;
}

export interface FixtureParticipantEvent {
  readonly at: string;
  readonly actorUserId: number | null;
  /** The organization the actor acted for (buyer or supplier tenant). */
  readonly actorTenantId: number;
  readonly event: ParticipantEvent['event'];
  readonly detail: string | null;
}

export interface FixtureParticipant {
  readonly id: number;
  /** The buyer tenant that owns the participant row. */
  readonly tenantId: number;
  readonly tenderId: number;
  readonly supplierTenantId: number;
  readonly source: ParticipantsSource;
  readonly invitationStatus: ParticipantsInvitationStatus;
  readonly invitedContactName: string | null;
  readonly invitedContactEmail: string | null;
  readonly invitedAt: string | null;
  readonly invitationExpiresAt: string | null;
  readonly invitationMessage: string | null;
  readonly respondedAt: string | null;
  readonly accessStatus: ParticipantsAccessStatus;
  readonly accessRequestedAt: string | null;
  readonly accessRequestReason: string | null;
  readonly accessDecidedByUserId: number | null;
  readonly accessDecidedAt: string | null;
  readonly accessDecisionReason: string | null;
  readonly confidentialityAcceptedAt: string | null;
  readonly confidentialityAcceptedByUserId: number | null;
  readonly bidIntent: ParticipantsBidIntent;
  readonly sharedNoBidReason: string | null;
  readonly intentChangedAt: string | null;
  readonly qualificationGate: ParticipantsQualificationGate;
  readonly selectedLotIds: readonly number[];
  readonly registeredAt: string;
  readonly acknowledgments: readonly FixtureAcknowledgment[];
  readonly deliveries: readonly FixtureDelivery[];
  readonly sessionRegistrations: ReadonlyArray<{ readonly sessionId: number; readonly status: SessionRegistrationsStatus }>;
  readonly history: readonly FixtureParticipantEvent[];
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;
const TSODILO = TENANT_IDS.tsodilo;
const CHOBE = TENANT_IDS['chobe-pipe'];
const MAKGADIKGADI = TENANT_IDS.makgadikgadi;
const SEROWE = TENANT_IDS['serowe-ict'];
const LIMPOPO = TENANT_IDS['limpopo-env'];
const GABORONE_METER = TENANT_IDS['gaborone-meter'];

const TEBOGO = 5;
const OFFICER_ODC = 23;

/** Persona user ids used as supplier actors. */
const U = {
  tsodiloBidManager: 25,
  tsodiloSignatory: 27,
  chobeAdmin: 28,
  chobeBidManager: 29,
  makgadikgadiAdmin: 40,
  seroweBidManager: 33,
  limpopoAdmin: 41,
  gaboroneBidManager: 37,
} as const;

const EMAIL = (login: string) => `${login}@tenderiq.local`;

/** Defaults of a participant that registered interest in an open event. */
function interested(
  tenderId: number,
  tenantId: number,
  supplierTenantId: number,
  registeredAt: string,
  actorUserId: number,
  overrides: Partial<FixtureParticipant> = {},
): FixtureParticipant {
  return {
    id: tenderId * 100 + supplierTenantId,
    tenantId,
    tenderId,
    supplierTenantId,
    source: 'registered_interest',
    invitationStatus: 'not_invited',
    invitedContactName: null,
    invitedContactEmail: null,
    invitedAt: null,
    invitationExpiresAt: null,
    invitationMessage: null,
    respondedAt: null,
    accessStatus: 'not_required',
    accessRequestedAt: null,
    accessRequestReason: null,
    accessDecidedByUserId: null,
    accessDecidedAt: null,
    accessDecisionReason: null,
    confidentialityAcceptedAt: null,
    confidentialityAcceptedByUserId: null,
    bidIntent: 'intends_to_bid',
    sharedNoBidReason: null,
    intentChangedAt: null,
    qualificationGate: 'not_required',
    selectedLotIds: [],
    registeredAt,
    acknowledgments: [],
    deliveries: [],
    sessionRegistrations: [],
    history: [{ at: registeredAt, actorUserId, actorTenantId: supplierTenantId, event: 'interest_registered', detail: null }],
    ...overrides,
  };
}

function delivered(
  noticeId: number,
  noticeType: NoticesNoticeType,
  title: string,
  recipientUserId: number,
  login: string,
  issuedAt: string,
  deliveredAt: string,
  openedAt: string | null,
  acknowledgedAt: string | null,
): FixtureDelivery {
  return {
    noticeId,
    noticeType,
    title,
    recipientUserId,
    recipientEmail: EMAIL(login),
    deliveryStatus: 'delivered',
    deliveredAt,
    openedAt,
    acknowledgedAt,
    failureReason: null,
    issuedAt,
  };
}

const T6_INVITATION = 'Invitation to quote — T-2026-0006 Chlorine dosing equipment';

const LOCAL_PARTICIPANTS: FixtureParticipant[] = [
  // T-2026-0001 ------------------------------------------------------------------------------------------------
  interested(1, KWU, TSODILO, '2026-06-16T09:10:00Z', U.tsodiloBidManager, {
    qualificationGate: 'met',
    selectedLotIds: [101, 103],
    intentChangedAt: '2026-06-20T08:00:00Z',
    history: [
      { at: '2026-06-16T09:10:00Z', actorUserId: U.tsodiloBidManager, actorTenantId: TSODILO, event: 'interest_registered', detail: null },
      { at: '2026-06-20T08:00:00Z', actorUserId: U.tsodiloBidManager, actorTenantId: TSODILO, event: 'bid_intent_shared', detail: 'Intends to bid for Lots 1 and 3.' },
    ],
  }),
  interested(1, KWU, CHOBE, '2026-06-17T11:30:00Z', U.chobeBidManager, {
    qualificationGate: 'met',
    selectedLotIds: [101, 102],
    intentChangedAt: '2026-06-22T09:00:00Z',
  }),
  interested(1, KWU, MAKGADIKGADI, '2026-06-17T13:00:00Z', U.makgadikgadiAdmin, {
    qualificationGate: 'not_met',
    selectedLotIds: [102],
    intentChangedAt: '2026-06-25T10:00:00Z',
  }),
  // T-2026-0002 ------------------------------------------------------------------------------------------------
  interested(2, KWU, GABORONE_METER, '2026-09-14T07:30:00Z', U.gaboroneBidManager, {
    intentChangedAt: '2026-09-15T08:00:00Z',
    history: [
      { at: '2026-09-14T07:30:00Z', actorUserId: U.gaboroneBidManager, actorTenantId: GABORONE_METER, event: 'interest_registered', detail: null },
      { at: '2026-09-15T08:00:00Z', actorUserId: U.gaboroneBidManager, actorTenantId: GABORONE_METER, event: 'bid_intent_shared', detail: 'Intends to bid.' },
    ],
  }),
  interested(2, KWU, TSODILO, '2026-09-14T10:30:00Z', U.tsodiloBidManager, {
    intentChangedAt: '2026-09-16T09:00:00Z',
  }),
  interested(2, KWU, CHOBE, '2026-09-15T07:00:00Z', U.chobeBidManager, {
    intentChangedAt: '2026-09-16T10:00:00Z',
    history: [
      { at: '2026-09-15T07:00:00Z', actorUserId: U.chobeBidManager, actorTenantId: CHOBE, event: 'interest_registered', detail: null },
      { at: '2026-09-16T10:00:00Z', actorUserId: U.chobeBidManager, actorTenantId: CHOBE, event: 'bid_intent_shared', detail: 'Intends to bid.' },
      { at: '2026-09-29T08:00:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'reminder_sent', detail: 'Addendum 1 is not yet acknowledged.' },
    ],
  }),
  interested(2, KWU, SEROWE, '2026-09-15T09:00:00Z', U.seroweBidManager, {
    intentChangedAt: '2026-09-17T08:00:00Z',
  }),
  {
    ...interested(2, KWU, MAKGADIKGADI, '2026-09-25T09:00:00Z', U.makgadikgadiAdmin),
    source: 'invited',
    invitationStatus: 'invited',
    invitedContactName: 'Sethunya Makgadi',
    invitedContactEmail: EMAIL('makgadikgadi.admin'),
    invitedAt: '2026-09-25T09:00:00Z',
    invitationExpiresAt: '2026-10-09T15:00:00Z',
    invitationMessage:
      'Kalahari Water Utilities invites Makgadikgadi Civil Works (Pty) Ltd to quote for T-2026-0002: the meters include installation, and your civil capacity is relevant.',
    bidIntent: 'undecided',
    deliveries: [
      delivered(7022, 'invitation', 'Invitation to quote — T-2026-0002 Smart water meter supply', U.makgadikgadiAdmin, 'makgadikgadi.admin', '2026-09-25T09:00:00Z', '2026-09-25T09:00:30Z', '2026-09-25T11:20:00Z', null),
    ],
    history: [{ at: '2026-09-25T09:00:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'invited', detail: 'Contact: Sethunya Makgadi.' }],
  },
  // T-2026-0003 ------------------------------------------------------------------------------------------------
  interested(3, KWU, SEROWE, '2026-07-21T08:00:00Z', U.seroweBidManager, {
    confidentialityAcceptedAt: '2026-07-21T08:10:00Z',
    confidentialityAcceptedByUserId: U.seroweBidManager,
    intentChangedAt: '2026-07-24T08:00:00Z',
  }),
  interested(3, KWU, TSODILO, '2026-07-22T09:00:00Z', U.tsodiloBidManager, {
    confidentialityAcceptedAt: '2026-07-22T09:20:00Z',
    confidentialityAcceptedByUserId: U.tsodiloSignatory,
    intentChangedAt: '2026-07-29T08:00:00Z',
  }),
  interested(3, KWU, MAKGADIKGADI, '2026-07-24T10:00:00Z', U.makgadikgadiAdmin, {
    confidentialityAcceptedAt: '2026-07-24T10:05:00Z',
    confidentialityAcceptedByUserId: U.makgadikgadiAdmin,
    intentChangedAt: '2026-07-31T08:00:00Z',
  }),
  // T-2026-0004 (RFI) -------------------------------------------------------------------------------------------
  interested(4, KWU, TSODILO, '2026-05-06T08:00:00Z', U.tsodiloBidManager, { intentChangedAt: '2026-05-06T08:05:00Z' }),
  interested(4, KWU, LIMPOPO, '2026-05-07T08:00:00Z', U.limpopoAdmin, { intentChangedAt: '2026-05-07T08:05:00Z' }),
  interested(4, KWU, SEROWE, '2026-05-08T08:00:00Z', U.seroweBidManager, { intentChangedAt: '2026-05-08T08:05:00Z' }),
  // T-2026-0006 (invitation-only) --------------------------------------------------------------------------------
  {
    ...interested(6, KWU, TSODILO, '2026-09-21T07:05:00Z', U.tsodiloBidManager),
    source: 'invited',
    invitationStatus: 'accepted',
    invitedContactName: 'Boago Moremi',
    invitedContactEmail: EMAIL('tsodilo.bidmanager'),
    invitedAt: '2026-09-21T07:05:00Z',
    invitationExpiresAt: '2026-10-09T15:00:00Z',
    invitationMessage: 'Kalahari Water Utilities invites Tsodilo Engineering (Pty) Ltd to quote for the chlorine dosing equipment.',
    respondedAt: '2026-09-22T08:20:00Z',
    confidentialityAcceptedAt: '2026-09-22T08:20:00Z',
    confidentialityAcceptedByUserId: U.tsodiloSignatory,
    qualificationGate: 'met',
    intentChangedAt: '2026-09-22T09:30:00Z',
    deliveries: [delivered(7061, 'invitation', T6_INVITATION, U.tsodiloBidManager, 'tsodilo.bidmanager', '2026-09-21T07:05:00Z', '2026-09-21T07:05:40Z', '2026-09-21T09:40:00Z', '2026-09-22T08:20:00Z')],
    history: [
      { at: '2026-09-21T07:05:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'invited', detail: 'Contact: Boago Moremi.' },
      { at: '2026-09-22T08:20:00Z', actorUserId: U.tsodiloSignatory, actorTenantId: TSODILO, event: 'invitation_accepted', detail: 'Accepted for Tsodilo Engineering (Pty) Ltd by the Managing Director.' },
      { at: '2026-09-22T08:20:00Z', actorUserId: U.tsodiloSignatory, actorTenantId: TSODILO, event: 'confidentiality_accepted', detail: null },
      { at: '2026-09-22T09:30:00Z', actorUserId: U.tsodiloBidManager, actorTenantId: TSODILO, event: 'bid_intent_shared', detail: 'Intends to bid.' },
    ],
  },
  {
    ...interested(6, KWU, CHOBE, '2026-09-21T07:05:00Z', U.chobeBidManager),
    source: 'invited',
    invitationStatus: 'accepted',
    invitedContactName: 'Bakang Chobe',
    invitedContactEmail: EMAIL('chobe-pipe.bidmanager'),
    invitedAt: '2026-09-21T07:05:00Z',
    invitationExpiresAt: '2026-10-09T15:00:00Z',
    invitationMessage: 'Kalahari Water Utilities invites Chobe Pipe & Valve Supplies (Pty) Ltd to quote for the chlorine dosing equipment.',
    respondedAt: '2026-09-23T10:00:00Z',
    confidentialityAcceptedAt: '2026-09-23T10:00:00Z',
    confidentialityAcceptedByUserId: U.chobeBidManager,
    qualificationGate: 'met',
    intentChangedAt: '2026-09-23T10:05:00Z',
    deliveries: [
      {
        noticeId: 7061,
        noticeType: 'invitation',
        title: T6_INVITATION,
        recipientUserId: U.chobeAdmin,
        recipientEmail: EMAIL('chobe-pipe.admin'),
        deliveryStatus: 'failed',
        deliveredAt: null,
        openedAt: null,
        acknowledgedAt: null,
        failureReason: 'Recipient address rejected by the organization mail server (SMTP 550).',
        issuedAt: '2026-09-21T07:05:00Z',
      },
      delivered(7062, 'invitation', `${T6_INVITATION} (resent)`, U.chobeBidManager, 'chobe-pipe.bidmanager', '2026-09-22T10:00:00Z', '2026-09-22T10:00:35Z', '2026-09-22T11:15:00Z', '2026-09-23T10:00:00Z'),
    ],
    history: [
      { at: '2026-09-21T07:05:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'invited', detail: 'Contact: Chedza Ramokate.' },
      { at: '2026-09-21T07:06:00Z', actorUserId: null, actorTenantId: KWU, event: 'delivery_failed', detail: 'E-mail rejected (SMTP 550).' },
      {
        at: '2026-09-22T09:55:00Z',
        actorUserId: TEBOGO,
        actorTenantId: KWU,
        event: 'contact_replaced',
        detail: 'Contact changed from Chedza Ramokate to Bakang Chobe at the supplier’s request. The invited supplier remains Chobe Pipe & Valve Supplies (Pty) Ltd.',
      },
      { at: '2026-09-22T10:00:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'invitation_resent', detail: null },
      { at: '2026-09-23T10:00:00Z', actorUserId: U.chobeBidManager, actorTenantId: CHOBE, event: 'invitation_accepted', detail: 'Accepted for Chobe Pipe & Valve Supplies (Pty) Ltd.' },
      { at: '2026-09-23T10:00:00Z', actorUserId: U.chobeBidManager, actorTenantId: CHOBE, event: 'confidentiality_accepted', detail: null },
    ],
  },
  {
    ...interested(6, KWU, MAKGADIKGADI, '2026-09-26T08:00:00Z', U.makgadikgadiAdmin),
    source: 'access_request',
    accessStatus: 'requested',
    accessRequestedAt: '2026-09-26T08:00:00Z',
    accessRequestReason: 'A partner forwarded the invitation to us; we would install the dosing skids and ask to take part.',
    bidIntent: 'undecided',
    qualificationGate: 'not_met',
    history: [
      {
        at: '2026-09-26T08:00:00Z',
        actorUserId: U.makgadikgadiAdmin,
        actorTenantId: MAKGADIKGADI,
        event: 'access_requested',
        detail: 'Received a forwarded invitation; a forwarded invitation does not authorize another organization.',
      },
    ],
  },
  // T-2026-0007 ------------------------------------------------------------------------------------------------
  interested(7, KWU, MAKGADIKGADI, '2026-05-13T08:00:00Z', U.makgadikgadiAdmin, { intentChangedAt: '2026-05-25T08:00:00Z' }),
  interested(7, KWU, LIMPOPO, '2026-05-14T08:00:00Z', U.limpopoAdmin, { intentChangedAt: '2026-05-26T08:00:00Z' }),
  interested(7, KWU, TSODILO, '2026-05-15T08:00:00Z', U.tsodiloBidManager, { intentChangedAt: '2026-05-28T08:00:00Z' }),
  // T-2026-0008 ------------------------------------------------------------------------------------------------
  interested(8, KWU, CHOBE, '2026-08-25T08:00:00Z', U.chobeBidManager, {
    selectedLotIds: [801, 802],
    intentChangedAt: '2026-08-27T08:00:00Z',
  }),
  interested(8, KWU, TSODILO, '2026-08-25T09:00:00Z', U.tsodiloBidManager, {
    selectedLotIds: [801],
    intentChangedAt: '2026-08-28T08:00:00Z',
  }),
  interested(8, KWU, MAKGADIKGADI, '2026-08-26T08:00:00Z', U.makgadikgadiAdmin, {
    bidIntent: 'undecided',
  }),
  interested(8, KWU, GABORONE_METER, '2026-08-26T10:00:00Z', U.gaboroneBidManager, {
    bidIntent: 'no_bid',
    sharedNoBidReason: 'Our range does not cover butterfly valves above DN300; we will not bid this time.',
    intentChangedAt: '2026-09-02T08:00:00Z',
    history: [
      { at: '2026-08-26T10:00:00Z', actorUserId: U.gaboroneBidManager, actorTenantId: GABORONE_METER, event: 'interest_registered', detail: null },
      { at: '2026-09-02T08:00:00Z', actorUserId: U.gaboroneBidManager, actorTenantId: GABORONE_METER, event: 'bid_intent_shared', detail: 'No bid, with a shared reason.' },
    ],
  }),
  // T-2026-0009 (restricted) -------------------------------------------------------------------------------------
  interested(9, KWU, SEROWE, '2026-07-07T08:00:00Z', U.seroweBidManager, {
    source: 'access_request',
    accessStatus: 'granted',
    accessRequestedAt: '2026-07-07T08:00:00Z',
    accessRequestReason: 'Four acoustic surveys for municipal networks since 2022.',
    accessDecidedByUserId: TEBOGO,
    accessDecidedAt: '2026-07-09T08:00:00Z',
    accessDecisionReason: 'Meets the published experience threshold.',
    intentChangedAt: '2026-07-10T08:00:00Z',
    history: [
      { at: '2026-07-07T08:00:00Z', actorUserId: U.seroweBidManager, actorTenantId: SEROWE, event: 'access_requested', detail: null },
      { at: '2026-07-09T08:00:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'access_granted', detail: null },
    ],
  }),
  interested(9, KWU, LIMPOPO, '2026-07-07T09:00:00Z', U.limpopoAdmin, {
    source: 'access_request',
    accessStatus: 'granted',
    accessRequestedAt: '2026-07-07T09:00:00Z',
    accessRequestReason: 'Acoustic leak-detection surveys for two district councils since 2023.',
    accessDecidedByUserId: TEBOGO,
    accessDecidedAt: '2026-07-09T08:10:00Z',
    accessDecisionReason: 'Meets the published experience threshold.',
    intentChangedAt: '2026-07-10T09:00:00Z',
    history: [
      { at: '2026-07-07T09:00:00Z', actorUserId: U.limpopoAdmin, actorTenantId: LIMPOPO, event: 'access_requested', detail: null },
      { at: '2026-07-09T08:10:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'access_granted', detail: null },
    ],
  }),
  interested(9, KWU, GABORONE_METER, '2026-07-08T08:00:00Z', U.gaboroneBidManager, {
    source: 'access_request',
    accessStatus: 'granted',
    accessRequestedAt: '2026-07-08T08:00:00Z',
    accessRequestReason: 'District-metered-area surveys with correlators.',
    accessDecidedByUserId: TEBOGO,
    accessDecidedAt: '2026-07-09T08:20:00Z',
    accessDecisionReason: 'Meets the published experience threshold.',
    intentChangedAt: '2026-07-10T10:00:00Z',
    history: [
      { at: '2026-07-08T08:00:00Z', actorUserId: U.gaboroneBidManager, actorTenantId: GABORONE_METER, event: 'access_requested', detail: null },
      { at: '2026-07-09T08:20:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'access_granted', detail: null },
    ],
  }),
  interested(9, KWU, MAKGADIKGADI, '2026-07-08T10:00:00Z', U.makgadikgadiAdmin, {
    source: 'access_request',
    accessStatus: 'denied',
    accessRequestedAt: '2026-07-08T10:00:00Z',
    accessRequestReason: 'We would partner with an acoustic specialist.',
    accessDecidedByUserId: TEBOGO,
    accessDecidedAt: '2026-07-09T08:30:00Z',
    accessDecisionReason: 'Restricted procedure: the applicant does not meet the published threshold of comparable acoustic surveys.',
    bidIntent: 'undecided',
    history: [
      { at: '2026-07-08T10:00:00Z', actorUserId: U.makgadikgadiAdmin, actorTenantId: MAKGADIKGADI, event: 'access_requested', detail: null },
      { at: '2026-07-09T08:30:00Z', actorUserId: TEBOGO, actorTenantId: KWU, event: 'access_denied', detail: 'Experience threshold not met.' },
    ],
  }),
  // T-2026-0010 ------------------------------------------------------------------------------------------------
  interested(10, KWU, TSODILO, '2026-03-04T08:00:00Z', U.tsodiloBidManager, { intentChangedAt: '2026-03-10T08:00:00Z' }),
  interested(10, KWU, MAKGADIKGADI, '2026-03-05T08:00:00Z', U.makgadikgadiAdmin, { intentChangedAt: '2026-03-11T08:00:00Z' }),
  // T-2026-0011 (ODC): the council admits each applicant before releasing the floor plans (eligibility review).
  interested(11, ODC, LIMPOPO, '2026-09-17T08:00:00Z', U.limpopoAdmin, {
    accessStatus: 'granted',
    accessRequestedAt: '2026-09-17T08:05:00Z',
    accessRequestReason: 'Cleaning contractor for three district councils; we need the floor plans to price the headquarters.',
    accessDecidedByUserId: OFFICER_ODC,
    accessDecidedAt: '2026-09-18T07:30:00Z',
    accessDecisionReason: 'Registered cleaning contractor with the required public liability insurance.',
    confidentialityAcceptedAt: '2026-09-18T08:10:00Z',
    confidentialityAcceptedByUserId: U.limpopoAdmin,
    intentChangedAt: '2026-09-18T08:00:00Z',
    selectedLotIds: [1101, 1102],
    history: [
      { at: '2026-09-17T08:00:00Z', actorUserId: U.limpopoAdmin, actorTenantId: LIMPOPO, event: 'interest_registered', detail: null },
      { at: '2026-09-17T08:05:00Z', actorUserId: U.limpopoAdmin, actorTenantId: LIMPOPO, event: 'access_requested', detail: null },
      { at: '2026-09-18T07:30:00Z', actorUserId: OFFICER_ODC, actorTenantId: ODC, event: 'access_granted', detail: null },
      { at: '2026-09-18T08:00:00Z', actorUserId: U.limpopoAdmin, actorTenantId: LIMPOPO, event: 'bid_intent_shared', detail: 'Intends to bid for Lots 1 and 2.' },
      { at: '2026-09-18T08:10:00Z', actorUserId: U.limpopoAdmin, actorTenantId: LIMPOPO, event: 'confidentiality_accepted', detail: null },
    ],
  }),
  interested(11, ODC, MAKGADIKGADI, '2026-09-17T09:00:00Z', U.makgadikgadiAdmin, {
    accessStatus: 'granted',
    accessRequestedAt: '2026-09-17T09:05:00Z',
    accessRequestReason: 'We clean the Maun district offices under a current contract.',
    accessDecidedByUserId: OFFICER_ODC,
    accessDecidedAt: '2026-09-18T07:40:00Z',
    accessDecisionReason: 'Registered cleaning contractor with the required public liability insurance.',
    confidentialityAcceptedAt: '2026-09-20T09:00:00Z',
    confidentialityAcceptedByUserId: U.makgadikgadiAdmin,
    intentChangedAt: '2026-09-18T09:00:00Z',
    selectedLotIds: [1101],
    history: [
      { at: '2026-09-17T09:00:00Z', actorUserId: U.makgadikgadiAdmin, actorTenantId: MAKGADIKGADI, event: 'interest_registered', detail: null },
      { at: '2026-09-17T09:05:00Z', actorUserId: U.makgadikgadiAdmin, actorTenantId: MAKGADIKGADI, event: 'access_requested', detail: null },
      { at: '2026-09-18T07:40:00Z', actorUserId: OFFICER_ODC, actorTenantId: ODC, event: 'access_granted', detail: null },
      { at: '2026-09-18T09:00:00Z', actorUserId: U.makgadikgadiAdmin, actorTenantId: MAKGADIKGADI, event: 'bid_intent_shared', detail: 'Intends to bid for Lot 1.' },
      { at: '2026-09-20T09:00:00Z', actorUserId: U.makgadikgadiAdmin, actorTenantId: MAKGADIKGADI, event: 'confidentiality_accepted', detail: null },
    ],
  }),
  interested(11, ODC, CHOBE, '2026-09-24T08:00:00Z', U.chobeBidManager, {
    accessStatus: 'granted',
    accessRequestedAt: '2026-09-24T08:05:00Z',
    accessRequestReason: 'Our facilities division provides contract cleaning in the North-West district from the Maun depot.',
    accessDecidedByUserId: OFFICER_ODC,
    accessDecidedAt: '2026-09-25T07:30:00Z',
    accessDecisionReason: 'Registered contractor with the required public liability insurance.',
    bidIntent: 'undecided',
    history: [
      { at: '2026-09-24T08:00:00Z', actorUserId: U.chobeBidManager, actorTenantId: CHOBE, event: 'interest_registered', detail: null },
      { at: '2026-09-24T08:05:00Z', actorUserId: U.chobeBidManager, actorTenantId: CHOBE, event: 'access_requested', detail: null },
      { at: '2026-09-25T07:30:00Z', actorUserId: OFFICER_ODC, actorTenantId: ODC, event: 'access_granted', detail: null },
    ],
  }),
];

/** The contact that receives formal notices for each supplier (its bid manager or administrator persona). */
const NOTICE_CONTACT: Readonly<Record<number, number>> = {
  [TSODILO]: U.tsodiloBidManager,
  [CHOBE]: U.chobeBidManager,
  [MAKGADIKGADI]: U.makgadikgadiAdmin,
  [SEROWE]: U.seroweBidManager,
  [LIMPOPO]: U.limpopoAdmin,
  [GABORONE_METER]: U.gaboroneBidManager,
};

function emailOf(userId: number): string | null {
  return PERSONAS.find((persona) => persona.userId === userId)?.email ?? null;
}

/**
 * Adds the facts the clarifications fixtures own: the acknowledgments and formal deliveries of every issued addendum
 * (`addenda` recipients; `participant_acknowledgments` is authoritative, DD-42) and the session registrations
 * (`session_registrations`). The participant history shows each acknowledgment.
 */
function withOwnedFacts(participant: FixtureParticipant): FixtureParticipant {
  const recipients = ADDENDA.filter((addendum) => addendum.tenderId === participant.tenderId && addendum.status === 'issued' && addendum.issuedAt !== null).flatMap(
    (addendum) =>
      addendum.recipients
        .filter((recipient) => recipient.supplierTenantId === participant.supplierTenantId)
        .map((recipient) => ({ addendum, recipient })),
  );
  const acknowledgments: FixtureAcknowledgment[] = recipients.flatMap(({ addendum, recipient }) =>
    recipient.acknowledgedAt === null || recipient.acknowledgedBy === null
      ? []
      : [{ subjectType: 'addendum' as const, subjectId: addendum.id, acknowledgedAt: recipient.acknowledgedAt, acknowledgedByUserId: recipient.acknowledgedBy }],
  );
  const deliveries: FixtureDelivery[] = recipients.map(({ addendum, recipient }) => {
    const recipientUserId = recipient.acknowledgedBy ?? NOTICE_CONTACT[participant.supplierTenantId] ?? null;
    return {
      noticeId: addendum.notice?.noticeId ?? 7000 + addendum.id,
      noticeType: addendum.notice?.noticeType ?? 'addendum',
      title: addendum.notice?.title ?? `Addendum ${addendum.number}: ${addendum.title}`,
      recipientUserId,
      recipientEmail: recipientUserId === null ? null : emailOf(recipientUserId),
      deliveryStatus: recipient.deliveryStatus,
      deliveredAt: recipient.deliveredAt,
      openedAt: recipient.openedAt,
      acknowledgedAt: recipient.acknowledgedAt,
      failureReason: recipient.failureReason,
      issuedAt: addendum.issuedAt ?? '',
    };
  });
  const sessionRegistrations = SESSIONS.filter((session) => session.tenderId === participant.tenderId).flatMap((session) =>
    session.registrations
      .filter((registration) => registration.supplierTenantId === participant.supplierTenantId)
      .map((registration) => ({ sessionId: session.id, status: registration.status })),
  );
  const acknowledged: FixtureParticipantEvent[] = recipients.flatMap(({ addendum, recipient }) =>
    recipient.acknowledgedAt === null
      ? []
      : [
          {
            at: recipient.acknowledgedAt,
            actorUserId: recipient.acknowledgedBy,
            actorTenantId: participant.supplierTenantId,
            event: 'acknowledged' as const,
            detail: `Addendum ${addendum.number}`,
          },
        ],
  );
  return {
    ...participant,
    acknowledgments,
    deliveries: [...participant.deliveries, ...deliveries].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)),
    sessionRegistrations,
    history: [...participant.history, ...acknowledged].sort((a, b) => a.at.localeCompare(b.at)),
  };
}

export const PARTICIPANTS: readonly FixtureParticipant[] = Object.freeze(LOCAL_PARTICIPANTS.map(withOwnedFacts));

