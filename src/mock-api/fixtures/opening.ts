/**
 * Opening fixtures (domain 10; docs/plan/demo-storyline.md): opening sessions, the unseal records, price gates,
 * compliance checks, bid clarifications and exclusions for the KWU and ODC buyers.
 *
 * One demo world: the tender register, official submission deadlines, closing times and lots come from the tenders
 * fixtures (`./tenders/index.js`), and the receipt number, receipt time, lots, inventory size and submission state of
 * every T-2026-0001, T-2026-0003 and T-2026-0008 bid come from the bids fixtures (`./bids/index.js`), so BUY-20 shows
 * the same facts as BUY-10, BUY-19 and SUP-11. Only the opening mode and envelope order are opening's own (see
 * `OPENING_MODES`).
 *
 * Storyline anchors:
 * - T-2026-0001 (staged, 3 lots, closed 24 Jul 2026): every stage opened for Lot 1 after its price gate; Lot 3's
 *   price gate is still closed (evaluation domain); Makgadikgadi (Lot 2 only) excluded, not qualified for WTR-PUMP
 *   (AC-07); a Chobe exclusion was withdrawn after a clarification cured an administrative omission.
 * - T-2026-0003 (staged, closed 28 Aug 2026, AC-16, AC-17): qualification → technical → price gate released by the
 *   chair → commercial. Makgadikgadi fails REQ-Q-03 (ISO 9001, expired 30 Nov 2025); its exclusion awaits approval
 *   (approval request 37) and its commercial envelope is withheld. Evaluator questions show consolidation (EVA-03).
 * - T-2026-0008 (staged, closed 25 Sep 2026, AC-14, AC-15): today's qualification session is ready (officer and
 *   witness confirmed, quorum met). Chobe's revision 1 is the one sealed effective submission (its late
 *   replacement was rejected, AC-13); Tsodilo withdrew (WDR-2026-000001, AC-14). No envelope is opened, so nobody
 *   reads content, and administrators, auditors and support hold no opening permission at all.
 * - T-2026-0009 (single stage, closed 14 Aug 2026): opened; presentation, reference and due-diligence requests
 *   (SUP-18); a rejected exclusion (administrative omission resolved by clarification).
 * - T-2026-0002 (open): a scheduled single-stage session nobody can confirm before closing. T-2026-0006 and ODC's
 *   T-2026-0011 (open): no session yet.
 *
 * Ids: tenders use their sequence number (T-2026-0003 → 3), lots `tender × 100 + n` (tenders fixtures), bids
 * `tender × 1000 + n`, revisions `bid × 10 + 1`, checks `bid × 100 + n`, clarifications 41xx, exclusions 51xx,
 * approval requests (approvals fixtures: 37 for exclusion 5101; 2602 and 2604 are the historical decisions of 5102 and
 * 5104) and notices 27xx, documents 96xx/97xx. Static data: nothing is mutated at runtime.
 */
import type {
  BidClarificationsEffect,
  BidClarificationsSource,
  BidClarificationsStatus,
  BidsComplianceStatus,
  BidsEvaluationStatus,
  BidsSubmissionState,
  ComplianceChecksCheckType,
  ComplianceChecksFindingClass,
  ComplianceChecksResult,
  ExclusionsStatus,
  ApprovalRequestsStatus,
  LotsStage,
  NoticesStatus,
  OpeningParticipantsRole,
  OpeningSessionsEnvelope,
  OpeningSessionsStatus,
  SubmissionReceiptsStatus,
  TenderEnvelopesEnvelope,
  TenderTeamMembersTeamRole,
  TendersEventType,
  TendersOpeningMode,
  TendersParticipation,
  TendersProcedure,
  TendersStatus,
} from '../../contracts/enums.js';
import { BIDS as BID_RESPONSES, RECEIPT_INVENTORY, SUBMISSION_RECEIPTS } from './bids/index.js';
import { TENANTS, TENANT_IDS } from './platform.js';
import { LOTS as TENDER_LOTS, MILESTONES, TENDERS as TENDER_REGISTER } from './tenders/index.js';

/** The official time zone of every KWU and ODC event. */
export const OPENING_TIME_ZONE = 'Africa/Gaborone';

/** Persona user ids used below (platform fixtures, foundation-contract §5). */
export const OPENING_USERS = {
  mpho: 4,
  tebogo: 5,
  boitumelo: 10,
  thato: 11,
  kabo: 12,
  amantle: 13,
  refilwe: 14,
  oratile: 15,
  goitse: 16,
  dineo: 17,
  officerOdc: 23,
  tsodiloSignatory: 27,
  chobeSignatory: 31,
  seroweSignatory: 35,
  gaboroneSignatory: 39,
  makgadikgadiAdmin: 40,
  limpopoAdmin: 41,
} as const;

const U = OPENING_USERS;

// ---------------------------------------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------------------------------------

export interface FixtureOpeningLot {
  readonly lotId: number;
  readonly tenderId: number;
  readonly lotNo: number;
  readonly title: string;
  readonly stage: LotsStage;
}

export interface FixtureOpeningTender {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly reference: string;
  readonly title: string;
  readonly eventType: TendersEventType;
  readonly procedure: TendersProcedure;
  readonly participation: TendersParticipation;
  readonly status: TendersStatus;
  readonly openingMode: TendersOpeningMode;
  readonly ownerUserId: number;
  readonly submissionDeadline: string;
  readonly closedAt: string | null;
  /** `tender_envelopes` in `open_order` (a single-stage tender opens them together, `envelope = 'all'`). */
  readonly envelopes: readonly TenderEnvelopesEnvelope[];
  readonly publicOpeningRequired: boolean;
}

export interface FixtureOpeningBid {
  readonly tenantId: number;
  readonly bidId: number;
  readonly tenderId: number;
  readonly supplierTenantId: number;
  /** The supplier legal name valid at `receivedAt` (DD-13). */
  readonly supplierName: string;
  readonly revisionId: number;
  readonly receiptNo: string;
  readonly receivedAt: string;
  readonly submissionState: BidsSubmissionState;
  readonly receiptStatus: SubmissionReceiptsStatus;
  readonly documentCount: number;
  readonly lotIds: readonly number[];
  readonly complianceStatus: BidsComplianceStatus;
  readonly evaluationStatus: BidsEvaluationStatus;
}

export interface FixtureOpeningSession {
  readonly tenantId: number;
  readonly id: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly envelope: OpeningSessionsEnvelope;
  readonly scheduledAt: string;
  readonly openedAt: string | null;
  readonly status: OpeningSessionsStatus;
  readonly openingOfficerUserId: number;
  readonly quorumRequired: number;
  readonly minutes: string | null;
  readonly irregularities: string | null;
  readonly publicReleaseSummary: string | null;
  readonly publicReleaseApproved: boolean;
}

export interface FixtureOpeningParticipant {
  readonly id: number;
  readonly sessionId: number;
  readonly userId: number;
  readonly role: OpeningParticipantsRole;
  readonly confirmedAt: string | null;
}

export interface FixtureEnvelopeOpening {
  readonly tenantId: number;
  readonly id: number;
  readonly sessionId: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly envelope: TenderEnvelopesEnvelope;
  readonly openedAt: string;
}

export interface FixturePriceGateRelease {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly releasedAt: string;
  readonly releasedBy: number;
  readonly nonPriceCompleteConfirmed: boolean;
  readonly note: string | null;
}

export interface FixtureRequirement {
  readonly requirementId: number;
  readonly refCode: string;
  readonly text: string;
}

export interface FixtureComplianceCheck {
  readonly tenantId: number;
  readonly id: number;
  readonly bidId: number;
  readonly revisionId: number;
  readonly checkType: ComplianceChecksCheckType;
  readonly requirement: FixtureRequirement | null;
  readonly findingClass: ComplianceChecksFindingClass;
  readonly result: ComplianceChecksResult;
  readonly reason: string | null;
  readonly evidenceRef: string | null;
  readonly assessedBy: number | null;
  readonly assessedAt: string | null;
}

export interface FixtureAttachment {
  readonly documentId: number;
  readonly versionId: number;
  readonly title: string;
  readonly fileName: string;
}

export interface FixtureBidClarification {
  readonly tenantId: number;
  readonly id: number;
  readonly bidId: number;
  readonly raisedBy: number;
  readonly raisedAt: string;
  readonly source: BidClarificationsSource;
  readonly question: string;
  readonly permittedScope: string;
  readonly dueAt: string | null;
  readonly status: BidClarificationsStatus;
  readonly approvedBy: number | null;
  readonly consolidatedIntoId: number | null;
  readonly responseText: string | null;
  readonly respondedBy: number | null;
  readonly respondedAt: string | null;
  readonly effect: BidClarificationsEffect | null;
  readonly effectNote: string | null;
  readonly attachments: readonly FixtureAttachment[];
  readonly distributedTo: readonly number[];
}

export interface FixtureExclusion {
  readonly tenantId: number;
  readonly id: number;
  readonly bidId: number;
  readonly grounds: string;
  readonly checkIds: readonly number[];
  readonly status: ExclusionsStatus;
  readonly proposedBy: number;
  readonly proposedAt: string;
  readonly approvalRequestId: number | null;
  readonly approvalStatus: ApprovalRequestsStatus | null;
  readonly approvalDecidedAt: string | null;
  readonly approvalDecidedBy: number | null;
  readonly noticeId: number | null;
  readonly noticeStatus: NoticesStatus | null;
  readonly notifiedAt: string | null;
  readonly challengeRoute: string;
  readonly withdrawnReason: string | null;
}

export interface FixtureOpeningTeamMember {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly userId: number;
  readonly teamRole: TenderTeamMembersTeamRole;
  readonly eligibleRoles: readonly OpeningParticipantsRole[];
}

// ---------------------------------------------------------------------------------------------------------
// Tenders and lots
// ---------------------------------------------------------------------------------------------------------

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;
const STAGED: readonly TenderEnvelopesEnvelope[] = ['qualification', 'technical', 'commercial'];

interface OpeningMode {
  readonly openingMode: TendersOpeningMode;
  readonly envelopes: readonly TenderEnvelopesEnvelope[];
  readonly publicOpeningRequired: boolean;
}

/**
 * The opening configuration of each tender in the opening domain (`tenders.opening_mode`, `tender_envelopes`,
 * `tenders.public_opening_required`). Everything else about a tender comes from the tenders fixtures.
 */
const OPENING_MODES: ReadonlyArray<readonly [number, OpeningMode]> = [
  [1, { openingMode: 'staged', envelopes: STAGED, publicOpeningRequired: false }],
  [2, { openingMode: 'single_stage', envelopes: STAGED, publicOpeningRequired: true }],
  [3, { openingMode: 'staged', envelopes: STAGED, publicOpeningRequired: true }],
  [6, { openingMode: 'single_stage', envelopes: STAGED, publicOpeningRequired: false }],
  [8, { openingMode: 'staged', envelopes: STAGED, publicOpeningRequired: true }],
  [9, { openingMode: 'single_stage', envelopes: STAGED, publicOpeningRequired: false }],
  [11, { openingMode: 'single_stage', envelopes: STAGED, publicOpeningRequired: false }],
];

/** The official submission deadline of a tender (`tender_milestones`, tender level) from the tenders fixtures. */
function submissionDeadlineOf(tenderId: number): string {
  const milestone = MILESTONES.find(
    (row) => row.tenderId === tenderId && row.lotId === null && row.milestone === 'submission_deadline',
  );
  if (milestone === undefined) {
    throw new Error(`Tender ${tenderId} has no submission deadline in the tenders fixtures.`);
  }
  return milestone.at;
}

function openingTender(tenderId: number, mode: OpeningMode): FixtureOpeningTender {
  const tender = TENDER_REGISTER.find((row) => row.id === tenderId);
  if (tender === undefined) {
    throw new Error(`Tender ${tenderId} is missing from the tenders fixtures.`);
  }
  return {
    tenantId: tender.tenantId,
    tenderId,
    reference: tender.reference,
    title: tender.title,
    eventType: tender.eventType,
    procedure: tender.procedure,
    participation: tender.participation,
    status: tender.status,
    ownerUserId: tender.ownerUserId,
    submissionDeadline: submissionDeadlineOf(tenderId),
    closedAt: tender.closedAt,
    ...mode,
  };
}

export const OPENING_TENDERS: readonly FixtureOpeningTender[] = Object.freeze(
  OPENING_MODES.map(([tenderId, mode]) => openingTender(tenderId, mode)),
);

/** The lots of the opening tenders, exactly as the tenders fixtures define them (ids `tender × 100 + n`). */
export const OPENING_LOTS: readonly FixtureOpeningLot[] = Object.freeze(
  TENDER_LOTS.filter((lot) => OPENING_TENDERS.some((tender) => tender.tenderId === lot.tenderId)).map((lot) => ({
    lotId: lot.id,
    tenderId: lot.tenderId,
    lotNo: lot.lotNo,
    title: lot.title,
    stage: lot.stage,
  })),
);

// ---------------------------------------------------------------------------------------------------------
// Bids (receipt metadata only, v_bid_receipt_metadata)
// ---------------------------------------------------------------------------------------------------------

function legalNameOf(tenantId: number): string {
  const tenant = TENANTS.find((row) => row.id === tenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown supplier tenant ${tenantId}.`);
  }
  return tenant.legalName;
}

type BidSeed = Omit<FixtureOpeningBid, 'tenantId' | 'supplierName' | 'revisionId' | 'receiptNo'> & {
  readonly receiptSuffix: string;
};

/** A bid whose receipt metadata is written here (T-2026-0009, whose stage-two proposals the bids fixtures omit). */
function bid(seed: BidSeed): FixtureOpeningBid {
  const { receiptSuffix, ...rest } = seed;
  return {
    ...rest,
    tenantId: KWU,
    supplierName: legalNameOf(seed.supplierTenantId),
    revisionId: seed.bidId * 10 + 1,
    receiptNo: `RCPT-2026-${receiptSuffix}`,
  };
}

type ReceivedSeed = Pick<FixtureOpeningBid, 'bidId' | 'tenderId' | 'supplierTenantId' | 'complianceStatus' | 'evaluationStatus'>;

/**
 * A bid whose receipt metadata comes from the bids fixtures: the effective receipt of the supplier's response to the
 * tender (a superseded or late-rejected revision never counts, BR-19), its receipt time and status, the size of its
 * receipt inventory, its lots (only lots the tenders fixtures define) and its submission state.
 */
function received(seed: ReceivedSeed): FixtureOpeningBid {
  const response = BID_RESPONSES.find(
    (row) => row.buyerTenantId === KWU && row.tenderId === seed.tenderId && row.supplierTenantId === seed.supplierTenantId,
  );
  const receipt = SUBMISSION_RECEIPTS.find(
    (row) => row.bidId === response?.id && row.status !== 'superseded' && row.status !== 'late_rejected',
  );
  if (response === undefined || receipt === undefined) {
    throw new Error(`No effective receipt in the bids fixtures for tender ${seed.tenderId}, supplier ${seed.supplierTenantId}.`);
  }
  const tenderLots = new Set(TENDER_LOTS.filter((lot) => lot.tenderId === seed.tenderId).map((lot) => lot.id));
  return {
    ...seed,
    tenantId: KWU,
    supplierName: legalNameOf(seed.supplierTenantId),
    revisionId: seed.bidId * 10 + 1,
    receiptNo: receipt.receiptNo,
    receivedAt: receipt.receivedAt,
    submissionState: response.submissionState,
    receiptStatus: receipt.status,
    documentCount: RECEIPT_INVENTORY.filter((item) => item.receiptId === receipt.id).length,
    lotIds: response.lotIds.filter((lotId) => tenderLots.has(lotId)),
  };
}

const S = {
  tsodilo: TENANT_IDS.tsodilo,
  chobe: TENANT_IDS['chobe-pipe'],
  makgadikgadi: TENANT_IDS.makgadikgadi,
  serowe: TENANT_IDS['serowe-ict'],
  limpopo: TENANT_IDS['limpopo-env'],
  gaborone: TENANT_IDS['gaborone-meter'],
} as const;

export const OPENING_BIDS: readonly FixtureOpeningBid[] = Object.freeze([
  // T-2026-0001 (Tsodilo: Lots 1 and 3; Chobe: all lots; Makgadikgadi: Lot 2 only)
  received({ bidId: 1001, tenderId: 1, supplierTenantId: S.tsodilo, complianceStatus: 'compliant', evaluationStatus: 'evaluated' }),
  received({ bidId: 1002, tenderId: 1, supplierTenantId: S.chobe, complianceStatus: 'pending', evaluationStatus: 'in_evaluation' }),
  received({ bidId: 1003, tenderId: 1, supplierTenantId: S.makgadikgadi, complianceStatus: 'excluded', evaluationStatus: 'excluded' }),
  // T-2026-0003 (no lots)
  received({ bidId: 3001, tenderId: 3, supplierTenantId: S.serowe, complianceStatus: 'clarification_pending', evaluationStatus: 'in_evaluation' }),
  received({ bidId: 3002, tenderId: 3, supplierTenantId: S.tsodilo, complianceStatus: 'compliant', evaluationStatus: 'in_evaluation' }),
  received({ bidId: 3003, tenderId: 3, supplierTenantId: S.makgadikgadi, complianceStatus: 'non_compliant', evaluationStatus: 'not_started' }),
  // T-2026-0008 (closed, awaiting opening): Chobe's revision 1 is effective; Tsodilo withdrew (AC-14)
  received({ bidId: 8001, tenderId: 8, supplierTenantId: S.chobe, complianceStatus: 'pending', evaluationStatus: 'not_started' }),
  received({ bidId: 8002, tenderId: 8, supplierTenantId: S.tsodilo, complianceStatus: 'pending', evaluationStatus: 'not_started' }),
  // T-2026-0009
  bid({ bidId: 9001, tenderId: 9, supplierTenantId: S.serowe, receiptSuffix: '000901', receivedAt: '2026-08-10T12:15:37Z', submissionState: 'submitted', receiptStatus: 'selected_for_evaluation', documentCount: 19, lotIds: [], complianceStatus: 'compliant', evaluationStatus: 'evaluated' }),
  bid({ bidId: 9002, tenderId: 9, supplierTenantId: S.gaborone, receiptSuffix: '000902', receivedAt: '2026-08-11T06:42:03Z', submissionState: 'submitted', receiptStatus: 'selected_for_evaluation', documentCount: 22, lotIds: [], complianceStatus: 'compliant', evaluationStatus: 'evaluated' }),
  bid({ bidId: 9003, tenderId: 9, supplierTenantId: S.limpopo, receiptSuffix: '000903', receivedAt: '2026-08-11T09:12:26Z', submissionState: 'submitted', receiptStatus: 'selected_for_evaluation', documentCount: 13, lotIds: [], complianceStatus: 'compliant', evaluationStatus: 'evaluated' }),
]);

function bidRow(bidId: number): FixtureOpeningBid {
  const row = OPENING_BIDS.find((candidate) => candidate.bidId === bidId);
  if (row === undefined) {
    throw new Error(`Unknown opening bid ${bidId}.`);
  }
  return row;
}

/** A readable date of an instant in the official time zone, for minutes and evidence text (e.g. "28 Aug 2026"). */
function officialDay(instant: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: OPENING_TIME_ZONE }).format(
    new Date(instant),
  );
}

const T1 = OPENING_TENDERS.find((row) => row.tenderId === 1);
const T3 = OPENING_TENDERS.find((row) => row.tenderId === 3);
if (T1 === undefined || T3 === undefined) {
  throw new Error('T-2026-0001 and T-2026-0003 must be opening tenders.');
}
const T1_CLOSED = officialDay(T1.submissionDeadline);
const T3_CLOSED = officialDay(T3.submissionDeadline);

// ---------------------------------------------------------------------------------------------------------
// Opening sessions, participants, unseal records and price gates
// ---------------------------------------------------------------------------------------------------------

export const OPENING_SESSIONS: readonly FixtureOpeningSession[] = Object.freeze([
  {
    tenantId: KWU,
    id: 110,
    tenderId: 1,
    lotId: null,
    envelope: 'qualification',
    scheduledAt: '2026-07-24T09:00:00Z',
    openedAt: '2026-07-24T09:06:12Z',
    status: 'completed',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes:
      'Opening officer and witness present in the KWU tender room one hour after closing. Three effective submissions listed from the receipt register; qualification envelopes of all three opened in receipt order.',
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 111,
    tenderId: 1,
    lotId: null,
    envelope: 'technical',
    scheduledAt: '2026-07-28T07:00:00Z',
    openedAt: '2026-07-28T07:03:40Z',
    status: 'completed',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes: 'Technical envelopes of the three effective submissions opened after the qualification review was recorded.',
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 112,
    tenderId: 1,
    lotId: 101,
    envelope: 'commercial',
    scheduledAt: '2026-08-05T07:00:00Z',
    openedAt: '2026-08-05T07:04:55Z',
    status: 'completed',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes:
      'Lot 1 price gate released by the evaluation chair on 4 August 2026. Commercial envelopes of the two Lot 1 bidders, Tsodilo Engineering and Chobe Pipe & Valve Supplies, opened. The commercial envelope of Makgadikgadi Civil Works (Lot 2 only) was not opened: the bid was excluded on 30 July 2026. The Lot 3 price gate is not released.',
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 129,
    tenderId: 3,
    lotId: null,
    envelope: 'qualification',
    scheduledAt: '2026-08-28T10:00:00Z',
    openedAt: null,
    status: 'aborted',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes: null,
    irregularities:
      'The appointed witness could not attend. Session aborted before any envelope was opened and rescheduled for 31 August 2026, 09:00 Africa/Gaborone.',
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 130,
    tenderId: 3,
    lotId: null,
    envelope: 'qualification',
    scheduledAt: '2026-08-31T07:00:00Z',
    openedAt: '2026-08-31T07:05:31Z',
    status: 'completed',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes:
      'Three effective submissions read from the receipt register. Qualification envelopes opened. The late attempt register shows no attempt for this tender.',
    irregularities: null,
    publicReleaseSummary:
      'Three submissions were received by the deadline of 28 August 2026, 10:00 (UTC+02:00) Africa/Gaborone, from Makgadikgadi Civil Works (Pty) Ltd, Serowe ICT Solutions (Pty) Ltd and Tsodilo Engineering (Pty) Ltd. Qualification envelopes were opened on 31 August 2026. No prices are disclosed at this stage.',
    publicReleaseApproved: true,
  },
  {
    tenantId: KWU,
    id: 131,
    tenderId: 3,
    lotId: null,
    envelope: 'technical',
    scheduledAt: '2026-09-10T07:00:00Z',
    openedAt: '2026-09-10T07:02:18Z',
    status: 'completed',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes: 'Technical envelopes of the three effective submissions opened for the technical evaluation.',
    irregularities: `The technical envelope of Serowe ICT Solutions lists ${bidRow(3001).documentCount + 1} files while the receipt inventory shows ${bidRow(3001).documentCount} documents: the envelope index counts a zero-byte cover page twice. Recorded for the compliance review; no content was altered.`,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 132,
    tenderId: 3,
    lotId: null,
    envelope: 'commercial',
    scheduledAt: '2026-09-25T07:00:00Z',
    openedAt: '2026-09-25T07:07:02Z',
    status: 'completed',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes:
      'Price gate released by the evaluation chair on 24 September 2026 after non-price moderation was finalized. Commercial envelopes of Serowe ICT Solutions and Tsodilo Engineering opened. The commercial envelope of Makgadikgadi Civil Works was withheld: its qualification envelope failed mandatory requirement REQ-Q-03 (substantive noncompliance recorded on 12 September 2026) and its exclusion is being prepared.',
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 180,
    tenderId: 8,
    lotId: null,
    envelope: 'qualification',
    scheduledAt: '2026-10-02T08:00:00Z',
    openedAt: null,
    status: 'scheduled',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes: null,
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 181,
    tenderId: 8,
    lotId: null,
    envelope: 'technical',
    scheduledAt: '2026-10-05T08:00:00Z',
    openedAt: null,
    status: 'scheduled',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes: null,
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 190,
    tenderId: 9,
    lotId: null,
    envelope: 'all',
    scheduledAt: '2026-08-14T10:00:00Z',
    openedAt: '2026-08-14T10:04:09Z',
    status: 'completed',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes: 'Single-stage opening of the three stage-one proposals from the restricted list. All envelopes opened.',
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
  {
    tenantId: KWU,
    id: 120,
    tenderId: 2,
    lotId: null,
    envelope: 'all',
    scheduledAt: '2026-10-16T12:00:00Z',
    openedAt: null,
    status: 'scheduled',
    openingOfficerUserId: U.oratile,
    quorumRequired: 2,
    minutes: null,
    irregularities: null,
    publicReleaseSummary: null,
    publicReleaseApproved: false,
  },
]);

function participants(
  sessionId: number,
  rows: ReadonlyArray<readonly [number, OpeningParticipantsRole, string | null]>,
): FixtureOpeningParticipant[] {
  return rows.map(([userId, role, confirmedAt], index) => ({ id: sessionId * 10 + index + 1, sessionId, userId, role, confirmedAt }));
}

export const OPENING_PARTICIPANTS: readonly FixtureOpeningParticipant[] = Object.freeze([
  ...participants(110, [
    [U.oratile, 'opening_officer', '2026-07-24T08:58:02Z'],
    [U.goitse, 'witness', '2026-07-24T09:01:15Z'],
  ]),
  ...participants(111, [
    [U.oratile, 'opening_officer', '2026-07-28T06:57:40Z'],
    [U.goitse, 'witness', '2026-07-28T07:00:05Z'],
  ]),
  ...participants(112, [
    [U.oratile, 'opening_officer', '2026-08-05T06:59:12Z'],
    [U.goitse, 'witness', '2026-08-05T07:00:48Z'],
    [U.boitumelo, 'observer', '2026-08-05T07:01:30Z'],
  ]),
  ...participants(129, [
    [U.oratile, 'opening_officer', '2026-08-28T09:58:20Z'],
    [U.goitse, 'witness', null],
  ]),
  ...participants(130, [
    [U.oratile, 'opening_officer', '2026-08-31T06:57:03Z'],
    [U.goitse, 'witness', '2026-08-31T07:02:44Z'],
  ]),
  ...participants(131, [
    [U.oratile, 'opening_officer', '2026-09-10T06:59:50Z'],
    [U.goitse, 'witness', '2026-09-10T07:00:31Z'],
  ]),
  ...participants(132, [
    [U.oratile, 'opening_officer', '2026-09-25T06:58:11Z'],
    [U.goitse, 'witness', '2026-09-25T07:03:26Z'],
    [U.refilwe, 'observer', '2026-09-25T07:04:02Z'],
  ]),
  // Today's session (the demo clock is 30 Sep 2026): officer and witness confirmed presence early in the morning, so
  // the quorum is met and the officer can open. The technical session (181) shows the confirm and QUORUM_NOT_MET paths.
  ...participants(180, [
    [U.oratile, 'opening_officer', '2026-09-30T05:12:08Z'],
    [U.goitse, 'witness', '2026-09-30T05:20:41Z'],
  ]),
  ...participants(181, [
    [U.oratile, 'opening_officer', null],
    [U.goitse, 'witness', null],
  ]),
  ...participants(190, [
    [U.oratile, 'opening_officer', '2026-08-14T09:59:44Z'],
    [U.goitse, 'witness', '2026-08-14T10:01:02Z'],
  ]),
  ...participants(120, [
    [U.oratile, 'opening_officer', null],
    [U.goitse, 'witness', null],
  ]),
]);

let openingSequence = 60000;
function openings(
  sessionId: number,
  envelopes: readonly TenderEnvelopesEnvelope[],
  bidIds: readonly number[],
  openedAt: string,
): FixtureEnvelopeOpening[] {
  return bidIds.flatMap((bidId) =>
    envelopes.map((envelope) => {
      openingSequence += 1;
      return { tenantId: KWU, id: openingSequence, sessionId, bidId, revisionId: bidId * 10 + 1, envelope, openedAt };
    }),
  );
}

/** The unseal records (`envelope_openings`). An excluded or pending bid never gets a commercial row (AC-17). */
export const ENVELOPE_OPENINGS: readonly FixtureEnvelopeOpening[] = Object.freeze([
  ...openings(110, ['qualification'], [1001, 1002, 1003], '2026-07-24T09:06:12Z'),
  ...openings(111, ['technical'], [1001, 1002, 1003], '2026-07-28T07:03:40Z'),
  ...openings(112, ['commercial'], [1001, 1002], '2026-08-05T07:04:55Z'),
  ...openings(130, ['qualification'], [3001, 3002, 3003], '2026-08-31T07:05:31Z'),
  ...openings(131, ['technical'], [3001, 3002, 3003], '2026-09-10T07:02:18Z'),
  ...openings(132, ['commercial'], [3001, 3002], '2026-09-25T07:07:02Z'),
  ...openings(190, ['qualification', 'technical', 'commercial'], [9001, 9002, 9003], '2026-08-14T10:04:09Z'),
]);

/**
 * Price gates (`price_gate_releases`, owned by evaluation and read here). T-2026-0001 releases per lot (Lot 1 only;
 * Lot 3 is still closed, as in the evaluation fixtures); T-2026-0008 has none yet (AC-16).
 */
export const PRICE_GATE_RELEASES: readonly FixturePriceGateRelease[] = Object.freeze([
  {
    tenantId: KWU,
    tenderId: 1,
    lotId: 101,
    releasedAt: '2026-08-04T12:30:00Z',
    releasedBy: U.boitumelo,
    nonPriceCompleteConfirmed: true,
    note: 'Lot 1 technical moderation finalized on 3 August 2026. Lot 3 restarted its technical evaluation and keeps its own price gate.',
  },
  {
    tenantId: KWU,
    tenderId: 3,
    lotId: null,
    releasedAt: '2026-09-24T12:00:00Z',
    releasedBy: U.boitumelo,
    nonPriceCompleteConfirmed: true,
    note: 'Non-price moderation finalized on 23 September 2026; one technical score changed by consensus.',
  },
]);

/** People on each tender team who may take part in an opening (`tender_team_members`). */
function team(tenderId: number, tenantId: number = KWU): FixtureOpeningTeamMember[] {
  if (tenantId === ODC) {
    return [{ tenantId, tenderId, userId: U.officerOdc, teamRole: 'owner', eligibleRoles: ['observer'] }];
  }
  return [
    { tenantId, tenderId, userId: U.oratile, teamRole: 'opening_officer', eligibleRoles: ['opening_officer', 'observer'] },
    { tenantId, tenderId, userId: U.goitse, teamRole: 'witness', eligibleRoles: ['witness', 'observer'] },
    { tenantId, tenderId, userId: U.boitumelo, teamRole: 'evaluation_chair', eligibleRoles: ['committee_member', 'observer'] },
    { tenantId, tenderId, userId: U.dineo, teamRole: 'legal_reviewer', eligibleRoles: ['committee_member', 'observer'] },
    { tenantId, tenderId, userId: U.refilwe, teamRole: 'commercial_reviewer', eligibleRoles: ['observer'] },
    { tenantId, tenderId, userId: U.tebogo, teamRole: 'owner', eligibleRoles: ['observer'] },
  ];
}

export const OPENING_TEAM: readonly FixtureOpeningTeamMember[] = Object.freeze([
  ...team(1),
  ...team(2),
  ...team(3),
  ...team(6),
  ...team(8),
  ...team(9),
  ...team(11, ODC),
]);

// ---------------------------------------------------------------------------------------------------------
// Compliance checks (one checklist per opened bid)
// ---------------------------------------------------------------------------------------------------------

const REQUIREMENTS = {
  t1: { requirementId: 1205, refCode: 'REQ-T-05', text: 'Pump hydraulic efficiency of at least 78% at the specified duty point, evidenced by a certified test curve.' },
  t3: { requirementId: 3203, refCode: 'REQ-Q-03', text: 'A valid ISO 9001 quality management certificate held at the closing date.' },
  t9: { requirementId: 9204, refCode: 'REQ-Q-04', text: 'At least two field operators certified on acoustic leak correlators.' },
} as const satisfies Record<string, FixtureRequirement>;

type CheckOverride = Partial<Pick<FixtureComplianceCheck, 'findingClass' | 'result' | 'reason' | 'evidenceRef' | 'assessedBy' | 'assessedAt'>>;

const CHECK_ORDER: readonly ComplianceChecksCheckType[] = [
  'timeliness',
  'declarations',
  'required_documents',
  'eligibility',
  'mandatory_requirement',
  'qualification_status',
  'acknowledgments',
  'securities',
  'lot_restrictions',
  'attendance',
];

interface ChecklistPlan {
  readonly requirement: FixtureRequirement;
  readonly assessedBy: number;
  readonly assessedAt: string;
  readonly defaults: Partial<Record<ComplianceChecksCheckType, CheckOverride>>;
}

const CHECKLISTS: Record<number, ChecklistPlan> = {
  1: {
    requirement: REQUIREMENTS.t1,
    assessedBy: U.tebogo,
    assessedAt: '2026-07-27T14:00:00Z',
    defaults: {
      qualification_status: { result: 'pass', evidenceRef: `Qualification status record, programme "Water Infrastructure Suppliers — Category A", category WTR-PUMP, as at ${T1_CLOSED}.` },
      securities: { result: 'pass', evidenceRef: 'Bid security guarantee of BWP 50,000.00 in the qualification envelope, valid to 12 Jan 2027.' },
      lot_restrictions: { result: 'pass', evidenceRef: 'Lots selected in the bid form match the lot envelopes submitted (section 2.6).' },
      attendance: { result: 'not_applicable', findingClass: 'none', reason: 'No mandatory briefing or site visit was set for this tender.', evidenceRef: null },
    },
  },
  3: {
    requirement: REQUIREMENTS.t3,
    assessedBy: U.tebogo,
    assessedAt: '2026-09-09T13:00:00Z',
    defaults: {
      qualification_status: { result: 'not_applicable', findingClass: 'none', reason: 'No qualification programme is declared for category ICT-SCADA.', evidenceRef: null },
      securities: { result: 'not_applicable', findingClass: 'none', reason: 'The tender documents require no bid security.', evidenceRef: null },
      lot_restrictions: { result: 'not_applicable', findingClass: 'none', reason: 'The tender has no lots.', evidenceRef: null },
      attendance: { result: 'pass', evidenceRef: 'Site briefing attendance register of 18 Aug 2026 (non-mandatory, recorded for information).' },
    },
  },
  9: {
    requirement: REQUIREMENTS.t9,
    assessedBy: U.tebogo,
    assessedAt: '2026-08-17T12:00:00Z',
    defaults: {
      qualification_status: { result: 'not_applicable', findingClass: 'none', reason: 'Participation was restricted to the pre-selected list; no programme gate applies.', evidenceRef: null },
      securities: { result: 'not_applicable', findingClass: 'none', reason: 'The request for proposals requires no bid security.', evidenceRef: null },
      lot_restrictions: { result: 'not_applicable', findingClass: 'none', reason: 'The event has no lots.', evidenceRef: null },
      attendance: { result: 'not_applicable', findingClass: 'none', reason: 'Attendance is assessed at the demonstration stage.', evidenceRef: null },
    },
  },
};

const DEFAULT_EVIDENCE: Record<ComplianceChecksCheckType, (receiptNo: string) => string> = {
  timeliness: (receiptNo) => `Official receipt ${receiptNo}; received before the submission deadline.`,
  declarations: () => 'Qualification envelope: authority to bid, eligibility, no conflict and no collusion declarations signed.',
  required_documents: (receiptNo) => `Receipt inventory of ${receiptNo}: every required form present.`,
  eligibility: () => 'Company registration and tax clearance certificate valid at closing.',
  mandatory_requirement: () => 'Evidence file cited in the qualification envelope meets the requirement.',
  qualification_status: () => 'Qualification status record at closing.',
  acknowledgments: () => 'Participant acknowledgments: every issued addendum acknowledged before closing.',
  securities: () => 'Bid security in the qualification envelope.',
  lot_restrictions: () => 'Lot selection within the published limits.',
  attendance: () => 'Attendance register.',
};

const BID_OVERRIDES: Record<number, Partial<Record<ComplianceChecksCheckType, CheckOverride>>> = {
  1002: {
    required_documents: {
      result: 'pass',
      findingClass: 'administrative_omission',
      reason: 'Page 2 of the public liability insurance certificate was missing; the complete certificate was supplied by clarification on 29 Jul 2026.',
      evidenceRef: 'Clarification response of 29 Jul 2026, file "Chobe-PL-insurance-2026.pdf" (certificate INS-44810, cover BWP 5,000,000.00).',
      assessedAt: '2026-07-30T09:00:00Z',
    },
    securities: {
      result: 'fail',
      findingClass: 'administrative_omission',
      reason:
        'The bid security guarantee expired on 28 Sep 2026 after the bid validity was extended to 12 Jan 2027 for Lot 3; no extended guarantee has been received. The compliance review of the bid is reopened.',
      evidenceRef: 'Guarantee BG-CPV-2026-031 (qualification envelope, item 6), expiry 28 Sep 2026; bid validity extension notice of 14 Sep 2026.',
      assessedAt: '2026-09-29T09:00:00Z',
    },
  },
  1003: {
    qualification_status: {
      result: 'fail',
      findingClass: 'substantive_noncompliance',
      reason: 'Makgadikgadi Civil Works is registered but not qualified for category WTR-PUMP, which section 2.4 declares as the participation gate for every lot, including Lot 2, the only lot it bid for.',
      evidenceRef: `Qualification status record at ${T1_CLOSED}: WTR-PUMP not assessed (application QA-2026-0004 in more information required).`,
    },
    securities: { result: 'pass', evidenceRef: 'Bid security guarantee of BWP 50,000.00 in the qualification envelope.' },
  },
  3001: {
    declarations: {
      result: 'pass',
      findingClass: 'administrative_omission',
      reason: 'The board resolution naming the signatory was not attached; supplied by clarification on 11 Sep 2026.',
      evidenceRef: 'Clarification response of 11 Sep 2026, board resolution BR-2026-014 dated 20 Aug 2026.',
      assessedAt: '2026-09-11T12:00:00Z',
    },
    required_documents: {
      result: 'clarification_required',
      findingClass: 'clarifiable',
      reason: 'Pricing schedule Form C line 14 "RTU spares kit" is marked included without naming the line that prices it.',
      evidenceRef: 'Commercial envelope, file "Serowe-FormC-pricing.xlsx", line 14.',
      assessedAt: '2026-09-26T09:30:00Z',
    },
    attendance: { result: 'pending', findingClass: 'none', reason: null, evidenceRef: null, assessedBy: null, assessedAt: null },
  },
  3003: {
    mandatory_requirement: {
      result: 'fail',
      findingClass: 'substantive_noncompliance',
      reason: `No ISO 9001 certificate valid at the closing date (${T3_CLOSED}). The clarification response confirms recertification is only planned for November 2026.`,
      evidenceRef: `Qualification envelope, file "ISO9001-Makgadikgadi.pdf" (receipt ${bidRow(3003).receiptNo}, item 4): certificate QMS-88213 valid until 30 Nov 2025; clarification response of 11 Sep 2026.`,
      assessedAt: '2026-09-12T10:00:00Z',
    },
  },
  9003: {
    acknowledgments: {
      result: 'pass',
      findingClass: 'administrative_omission',
      reason: 'Addendum 1 was acknowledged by e-mail on 30 Jul 2026, before closing, but not in the platform. Administrative omission resolved by clarification.',
      evidenceRef: 'Clarification response of 19 Aug 2026 with the e-mail acknowledgment of 30 Jul 2026, 14:12 Africa/Gaborone.',
      assessedAt: '2026-08-20T10:00:00Z',
    },
  },
};

function checklist(bidRow: FixtureOpeningBid): FixtureComplianceCheck[] {
  const plan = CHECKLISTS[bidRow.tenderId];
  if (plan === undefined) {
    return [];
  }
  return CHECK_ORDER.map((checkType, index) => {
    const override: CheckOverride = { ...plan.defaults[checkType], ...BID_OVERRIDES[bidRow.bidId]?.[checkType] };
    return {
      tenantId: bidRow.tenantId,
      id: bidRow.bidId * 100 + index + 1,
      bidId: bidRow.bidId,
      revisionId: bidRow.revisionId,
      checkType,
      requirement: checkType === 'mandatory_requirement' ? plan.requirement : null,
      findingClass: override.findingClass ?? 'none',
      result: override.result ?? 'pass',
      reason: override.reason ?? null,
      evidenceRef: override.evidenceRef === undefined ? DEFAULT_EVIDENCE[checkType](bidRow.receiptNo) : override.evidenceRef,
      assessedBy: override.assessedBy === undefined ? plan.assessedBy : override.assessedBy,
      assessedAt: override.assessedAt === undefined ? plan.assessedAt : override.assessedAt,
    };
  });
}

/** Compliance checks exist only for bids whose qualification envelope is opened (T-2026-0008 has none, AC-15). */
export const COMPLIANCE_CHECKS: readonly FixtureComplianceCheck[] = Object.freeze(
  OPENING_BIDS.filter((row) => row.submissionState === 'submitted').flatMap(checklist),
);

// ---------------------------------------------------------------------------------------------------------
// Bid clarifications (BUY-21, EVA-03, SUP-18)
// ---------------------------------------------------------------------------------------------------------

const NO_ATTACHMENTS: readonly FixtureAttachment[] = [];

export const BID_CLARIFICATIONS: readonly FixtureBidClarification[] = Object.freeze([
  {
    tenantId: KWU,
    id: 4101,
    bidId: 3001,
    raisedBy: U.tebogo,
    raisedAt: '2026-09-09T09:00:00Z',
    source: 'compliance',
    question:
      'Your authority-to-bid declaration (Form Q-1) is signed, but the board resolution naming the signatory is not attached. Please provide the resolution that was in force on 28 August 2026.',
    permittedScope:
      'Documentary confirmation of the signatory’s authority as at the closing date only. No change to the qualification, technical or commercial content of the bid is permitted.',
    dueAt: '2026-09-14T10:00:00Z',
    status: 'closed',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText:
      'Attached is board resolution BR-2026-014 dated 20 August 2026, which authorizes Otsile Serowe to sign tender submissions on behalf of the company.',
    respondedBy: U.seroweSignatory,
    respondedAt: '2026-09-11T08:40:00Z',
    effect: 'resolved',
    effectNote: 'Authority confirmed as at closing. Declarations check recorded as pass (administrative omission).',
    attachments: [{ documentId: 9601, versionId: 9701, title: 'Board resolution BR-2026-014', fileName: 'Serowe-board-resolution-BR-2026-014.pdf' }],
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4102,
    bidId: 3003,
    raisedBy: U.tebogo,
    raisedAt: '2026-09-09T09:30:00Z',
    source: 'compliance',
    question:
      'The ISO 9001 certificate in your qualification envelope (QMS-88213) shows an expiry date of 30 November 2025. Please confirm whether a certificate valid on 28 August 2026 was held and, if so, provide it.',
    permittedScope:
      'Confirmation of the certification held at the closing date only. A certificate obtained after closing cannot be accepted.',
    dueAt: '2026-09-14T10:00:00Z',
    status: 'closed',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText:
      'Our ISO 9001 certificate expired on 30 November 2025. The recertification audit is scheduled for November 2026 with the same certification body.',
    respondedBy: U.makgadikgadiAdmin,
    respondedAt: '2026-09-11T14:10:00Z',
    effect: 'not_resolved',
    effectNote: 'No certificate valid at closing. REQ-Q-03 remains failed as a substantive noncompliance.',
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4103,
    bidId: 3002,
    raisedBy: U.thato,
    raisedAt: '2026-09-16T09:00:00Z',
    source: 'evaluation',
    question:
      'Section T-4.2 of your proposal states that historian data is retained "as configured". Please state the default retention period offered for one-second telemetry data.',
    permittedScope:
      'Confirm the retention period already offered in your technical proposal. No new equipment, services or price changes may be introduced.',
    dueAt: '2026-10-07T10:00:00Z',
    status: 'draft',
    approvedBy: null,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4104,
    bidId: 3002,
    raisedBy: U.kabo,
    raisedAt: '2026-09-16T11:20:00Z',
    source: 'evaluation',
    question: 'How long does the proposed historian keep raw telemetry before it is aggregated or deleted?',
    permittedScope: 'Confirmation of the historian configuration already proposed. No change to the offer.',
    dueAt: '2026-10-06T13:00:00Z',
    status: 'draft',
    approvedBy: null,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4105,
    bidId: 3002,
    raisedBy: U.amantle,
    raisedAt: '2026-09-17T08:00:00Z',
    source: 'evaluation',
    question: 'Which gateway connects the water-quality analysers to the SCADA network in your proposal?',
    permittedScope: 'Identify the gateway already listed in the proposal. No change to the equipment offered.',
    dueAt: '2026-09-24T10:00:00Z',
    status: 'closed',
    approvedBy: null,
    consolidatedIntoId: 4108,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4106,
    bidId: 3001,
    raisedBy: U.thato,
    raisedAt: '2026-09-26T09:00:00Z',
    source: 'evaluation',
    question:
      'Your technical proposal lists a 4-hour battery backup for the remote terminal units, but Annex T-3 shows 8 hours. Please confirm which figure applies to the offer as submitted.',
    permittedScope:
      'Identify which of the two figures already in your proposal applies. You may not change the equipment offered or its price.',
    dueAt: '2026-10-02T13:00:00Z',
    status: 'issued',
    approvedBy: U.boitumelo,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4107,
    bidId: 3001,
    raisedBy: U.tebogo,
    raisedAt: '2026-09-26T10:00:00Z',
    source: 'compliance',
    question:
      'Pricing schedule Form C line 14 "RTU spares kit" is marked "included" without naming the line that prices it. Please identify the line of the submitted schedule in which the spares are priced.',
    permittedScope:
      'Point to where the spares are priced in the submitted schedule. Prices and quantities cannot be changed; any arithmetic correction follows the published rule.',
    dueAt: '2026-10-05T10:00:00Z',
    status: 'approved',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4108,
    bidId: 3002,
    raisedBy: U.amantle,
    raisedAt: '2026-09-17T08:30:00Z',
    source: 'evaluation',
    question:
      'Please confirm which gateway model connects the water-quality analysers to the SCADA network, as listed in Annex T-7 of your proposal.',
    permittedScope: 'Identify the gateway already listed in Annex T-7. No change to the equipment offered or its price.',
    dueAt: '2026-09-24T10:00:00Z',
    status: 'responded',
    approvedBy: U.boitumelo,
    consolidatedIntoId: null,
    responseText:
      'The analyser integration uses the Modbus TCP gateway model MTG-400 listed in Annex T-7, item 3. No other gateway is proposed.',
    respondedBy: U.tsodiloSignatory,
    respondedAt: '2026-09-22T09:15:00Z',
    effect: null,
    effectNote: null,
    attachments: [{ documentId: 9602, versionId: 9702, title: 'Annex T-7 extract (as submitted)', fileName: 'Tsodilo-Annex-T7-extract.pdf' }],
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4109,
    bidId: 1002,
    raisedBy: U.kabo,
    raisedAt: '2026-09-28T08:00:00Z',
    source: 'evaluation',
    question:
      'For Lot 3, your datasheet lists the control panel enclosure as IP55 while the compliance statement says IP65. Please confirm the rating of the enclosure offered.',
    permittedScope: 'Confirm the rating of the enclosure already offered for Lot 3. The enclosure model and price cannot change.',
    dueAt: '2026-10-05T13:00:00Z',
    status: 'issued',
    approvedBy: U.boitumelo,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4110,
    bidId: 9002,
    raisedBy: U.tebogo,
    raisedAt: '2026-08-20T09:00:00Z',
    source: 'presentation',
    question:
      'Please confirm attendance at the demonstration on 3 September 2026, 09:00 (UTC+02:00) Africa/Gaborone, KWU Head Office Boardroom 2, and name up to three presenters.',
    permittedScope: 'Confirmation of attendance and presenters only. The demonstration follows the published agenda and scoring guide.',
    dueAt: '2026-08-27T10:00:00Z',
    status: 'closed',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText: 'Confirmed. Presenters: Kagiso Metsi (bid manager), Omphile Ditshego (field lead) and Lame Ntshole (director).',
    respondedBy: U.gaboroneSignatory,
    respondedAt: '2026-08-22T11:05:00Z',
    effect: 'no_effect',
    effectNote: 'Attendance confirmed; no effect on compliance.',
    attachments: NO_ATTACHMENTS,
    distributedTo: [U.thato, U.kabo],
  },
  {
    tenantId: KWU,
    id: 4111,
    bidId: 9001,
    raisedBy: U.tebogo,
    raisedAt: '2026-09-28T08:30:00Z',
    source: 'reference',
    question: 'Please provide contact details for the two referees named in Form R-2 and confirm that they consent to be contacted.',
    permittedScope: 'Referees already named in your submission only. No new references may be added.',
    dueAt: '2026-10-02T10:00:00Z',
    status: 'issued',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4112,
    bidId: 9002,
    raisedBy: U.tebogo,
    raisedAt: '2026-09-10T08:00:00Z',
    source: 'due_diligence',
    question: 'Please provide audited financial statements for the year ended 31 March 2026, as required by the due-diligence plan.',
    permittedScope: 'Financial statements for the stated period only. No change to the proposal or its price.',
    dueAt: '2026-09-17T10:00:00Z',
    status: 'closed',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText: 'The audit of our 2026 statements is not yet finalized. We attach management accounts to 31 March 2026.',
    respondedBy: U.gaboroneSignatory,
    respondedAt: '2026-09-15T13:40:00Z',
    effect: 'not_resolved',
    effectNote: 'Audited statements not available; the due-diligence condition is not met (recorded in the due-diligence case).',
    attachments: [{ documentId: 9603, versionId: 9703, title: 'Management accounts to 31 March 2026', fileName: 'GMC-management-accounts-2026-03.pdf' }],
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4113,
    bidId: 1002,
    raisedBy: U.tebogo,
    raisedAt: '2026-07-27T09:00:00Z',
    source: 'compliance',
    question: 'Page 2 of your public liability insurance certificate is missing from the qualification envelope. Please provide the complete certificate held at closing.',
    permittedScope: 'The complete copy of the certificate already referenced in your bid. No new or different policy can be accepted.',
    dueAt: '2026-07-31T10:00:00Z',
    status: 'closed',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText: 'Attached is the complete certificate INS-44810 (two pages), issued on 3 March 2026.',
    respondedBy: U.chobeSignatory,
    respondedAt: '2026-07-29T10:25:00Z',
    effect: 'resolved',
    effectNote: 'Complete certificate provided; required documents check recorded as pass (administrative omission).',
    attachments: [{ documentId: 9604, versionId: 9704, title: 'Public liability insurance certificate INS-44810', fileName: 'Chobe-PL-insurance-2026.pdf' }],
    distributedTo: [U.kabo],
  },
  {
    tenantId: KWU,
    id: 4114,
    bidId: 1001,
    raisedBy: U.thato,
    raisedAt: '2026-09-01T08:00:00Z',
    source: 'evaluation',
    question: 'For Lot 3, please confirm the firmware version of the pump controllers offered.',
    permittedScope: 'Confirmation of the firmware version already offered. No change to the equipment or price.',
    dueAt: '2026-09-08T10:00:00Z',
    status: 'expired',
    approvedBy: U.boitumelo,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4115,
    bidId: 9003,
    raisedBy: U.tebogo,
    raisedAt: '2026-08-17T09:00:00Z',
    source: 'compliance',
    question: 'The platform shows no acknowledgment of Addendum 1 from your organization. Please provide any acknowledgment you sent before closing.',
    permittedScope: 'Evidence of an acknowledgment made before the closing date only.',
    dueAt: '2026-08-20T10:00:00Z',
    status: 'closed',
    approvedBy: U.mpho,
    consolidatedIntoId: null,
    responseText: 'We acknowledged Addendum 1 by e-mail to the tender mailbox on 30 July 2026 at 14:12. The e-mail is attached.',
    respondedBy: U.limpopoAdmin,
    respondedAt: '2026-08-19T07:50:00Z',
    effect: 'resolved',
    effectNote: 'Acknowledgment made before closing; administrative omission resolved and the proposed exclusion was rejected.',
    attachments: [{ documentId: 9605, versionId: 9705, title: 'E-mail acknowledgment of Addendum 1', fileName: 'Limpopo-addendum-1-ack.pdf' }],
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4118,
    bidId: 3002,
    raisedBy: U.boitumelo,
    raisedAt: '2026-09-29T08:00:00Z',
    source: 'evaluation',
    question: 'Please confirm the number of training days for control-room operators included in your proposal.',
    permittedScope: 'Confirmation of the training already offered in section T-9. No change to the services or price.',
    dueAt: '2026-10-08T10:00:00Z',
    status: 'draft',
    approvedBy: null,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
  {
    tenantId: KWU,
    id: 4117,
    bidId: 1002,
    raisedBy: U.amantle,
    raisedAt: '2026-09-15T08:00:00Z',
    source: 'evaluation',
    question: 'For Lot 3, please confirm the spare-parts lead time stated in your delivery schedule.',
    permittedScope: 'Confirmation of the lead time already stated. No change to the delivery schedule or price.',
    dueAt: '2026-09-25T10:00:00Z',
    status: 'issued',
    approvedBy: U.boitumelo,
    consolidatedIntoId: null,
    responseText: null,
    respondedBy: null,
    respondedAt: null,
    effect: null,
    effectNote: null,
    attachments: NO_ATTACHMENTS,
    distributedTo: [],
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Exclusions (AC-17)
// ---------------------------------------------------------------------------------------------------------

const CHALLENGE_ROUTE =
  'You may ask for a review of this decision by the KWU Procurement Review Panel within 10 working days of this notice, through Complaints in TenderIQ, quoting the tender reference.';

export const EXCLUSIONS: readonly FixtureExclusion[] = Object.freeze([
  {
    tenantId: KWU,
    id: 5101,
    bidId: 3003,
    grounds: `Mandatory requirement REQ-Q-03 (ISO 9001 certificate valid at closing) is not met. The certificate submitted expired on 30 November 2025 and the clarification response of 11 September 2026 confirms that no valid certificate was held at closing (${T3_CLOSED}). This substantive noncompliance cannot be cured by clarification (BR-22).`,
    checkIds: [300305],
    status: 'awaiting_approval',
    proposedBy: U.boitumelo,
    proposedAt: '2026-09-29T11:00:00Z',
    approvalRequestId: 37,
    approvalStatus: 'pending',
    approvalDecidedAt: null,
    approvalDecidedBy: null,
    noticeId: null,
    noticeStatus: null,
    notifiedAt: null,
    challengeRoute: CHALLENGE_ROUTE,
    withdrawnReason: null,
  },
  {
    tenantId: KWU,
    id: 5102,
    bidId: 1003,
    grounds:
      'Makgadikgadi Civil Works is registered but not qualified for category WTR-PUMP, which section 2.4 of the tender declares as the participation gate for every lot, including Lot 2, the only lot it bid for. Registration is not qualification (BR-03).',
    checkIds: [100306],
    status: 'approved',
    proposedBy: U.tebogo,
    proposedAt: '2026-07-28T08:00:00Z',
    approvalRequestId: 2602,
    approvalStatus: 'approved',
    approvalDecidedAt: '2026-07-30T13:00:00Z',
    approvalDecidedBy: U.mpho,
    noticeId: 2701,
    noticeStatus: 'issued',
    notifiedAt: '2026-07-31T08:00:00Z',
    challengeRoute: CHALLENGE_ROUTE,
    withdrawnReason: null,
  },
  {
    tenantId: KWU,
    id: 5103,
    bidId: 1002,
    grounds: 'The public liability insurance certificate required by section 3.2 is incomplete (page 2 missing).',
    checkIds: [100203],
    status: 'withdrawn',
    proposedBy: U.tebogo,
    proposedAt: '2026-07-27T08:30:00Z',
    approvalRequestId: null,
    approvalStatus: null,
    approvalDecidedAt: null,
    approvalDecidedBy: null,
    noticeId: null,
    noticeStatus: null,
    notifiedAt: null,
    challengeRoute: CHALLENGE_ROUTE,
    withdrawnReason: 'The clarification of 29 July 2026 produced the complete certificate held at closing; the omission was administrative and is resolved.',
  },
  {
    tenantId: KWU,
    id: 5104,
    bidId: 9003,
    grounds: 'No acknowledgment of Addendum 1 was recorded before closing, as section 1.9 of the request for proposals requires.',
    checkIds: [900307],
    status: 'rejected',
    proposedBy: U.tebogo,
    proposedAt: '2026-08-17T08:00:00Z',
    approvalRequestId: 2604,
    approvalStatus: 'rejected',
    approvalDecidedAt: '2026-08-20T09:00:00Z',
    approvalDecidedBy: U.mpho,
    noticeId: null,
    noticeStatus: null,
    notifiedAt: null,
    challengeRoute: CHALLENGE_ROUTE,
    withdrawnReason: null,
  },
]);
