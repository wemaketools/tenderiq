/**
 * Publication fixtures: the notice side of every demo tender (docs/plan/demo-storyline.md "Tenders").
 *
 * The facts other domains own are DERIVED, never copied (`deriveTender`): release dates, lots and disclosed
 * milestones from the tenders fixtures; issued addenda (hence versions, the current version and a moved deadline)
 * and sessions from the clarifications fixtures; the lots the tenders fixtures do not structure (single-lot events,
 * T-2026-0011) from the bids fixtures; the release approval decision from the tenders fixtures. Categories come from the
 * shared catalog. Ids: tender `T-2026-000N` = N, lot `tender * 100 + lotNo`, condition `tender * 10 + n`, package
 * document `7000 + tender * 10 + k` (publication-owned package files).
 *
 * - Public (`v_public_tenders`, DD-13): participation `open`, portal enabled, public-safe status. T-2026-0006
 *   (invitation-only) and T-2026-0009 (restricted) never appear publicly (AC-01). T-2026-0005 (awaiting release
 *   approval), T-2026-0012 (draft) and T-2026-0013 (ready) are not released.
 * - T-2026-0013 (ODC, `ready`, scheduled; ODC needs no release approval) makes "publish now or schedule"
 *   demonstrable on BUY-14.
 * - T-2026-0011 (ODC, open, version 2 after Addendum 1, closing 23 Oct 2026 12:00) is the public notice with a
 *   restricted document: an eligibility review and a confidentiality undertaking guard the council floor plans,
 *   so "request restricted access" (PUB-03, SUP-07), confidentiality acceptance and lot selection (SUP-08) are
 *   demonstrable.
 * - Internal values (estimates, budgets) are deliberately absent: the publication domain never returns them.
 */
import type { ReleaseApprovalState } from '../../../contracts/publication/buyer.js';
import type {
  NoticeAddendum,
  NoticeCondition,
  NoticeLot,
  NoticeMilestone,
  NoticeOutcome,
  NoticeVersion,
} from '../../../contracts/publication.js';
import type {
  SessionsSessionType,
  SessionsStatus,
  TendersEventType,
  TendersParticipation,
  TendersProcedure,
  TendersStatus,
} from '../../../contracts/enums.js';
import { BID_TENDERS } from '../bids/index.js';
import { ADDENDA, SESSIONS } from '../clarifications/index.js';
import type { AddendumFixture } from '../clarifications/index.js';
import { TENANT_IDS } from '../platform.js';
import { LOTS, MILESTONES, RELEASE_APPROVALS, TENDERS as OWNER_TENDERS } from '../tenders/index.js';
import { OFFICIAL_TZ } from './catalog.js';
import { packageDocument } from './documents.js';
import type { DocumentAccessRule, FixtureDocument } from './documents.js';

export interface FixtureAddendum extends NoticeAddendum {
  readonly acknowledgmentRequired: boolean;
}

export interface FixtureSession {
  readonly sessionId: number;
  readonly sessionType: SessionsSessionType;
  readonly title: string;
  readonly lotNo: number | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly venue: string;
  readonly mandatory: boolean;
  /** The session this one is a permitted alternative date of (either satisfies a mandatory attendance). */
  readonly alternativeOfId: number | null;
  readonly capacity: number | null;
  readonly placesLeft: number | null;
  readonly registrationDeadline: string | null;
  readonly status: SessionsStatus;
}

export interface FixtureTender {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly summary: string;
  readonly eventType: TendersEventType;
  readonly procedure: TendersProcedure;
  readonly participation: TendersParticipation;
  readonly status: TendersStatus;
  readonly categoryCode: string;
  readonly regions: readonly string[];
  readonly officialTimeZone: string;
  readonly ownerUserId: number;
  readonly currentVersionNo: number;
  readonly draftRevision: number;
  readonly releasedAt: string | null;
  readonly scheduledReleaseAt: string | null;
  readonly submissionDeadline: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly eligibilitySummary: string | null;
  readonly deliveryRequirements: string | null;
  readonly submissionRules: string | null;
  readonly communicationChannelNote: string | null;
  readonly contractConditions: string | null;
  readonly acceptedLanguages: readonly string[];
  readonly maxLotsPerSupplier: number | null;
  readonly lots: readonly NoticeLot[];
  readonly milestones: readonly NoticeMilestone[];
  readonly documents: readonly FixtureDocument[];
  readonly addenda: readonly FixtureAddendum[];
  readonly versions: readonly NoticeVersion[];
  readonly conditions: readonly NoticeCondition[];
  /** The confidentiality undertaking text, when a `confidentiality_undertaking` condition applies. */
  readonly confidentialityText: string | null;
  readonly sessions: readonly FixtureSession[];
  /** The qualification program a `qualification_required` condition names. */
  readonly qualificationProgram: string | null;
  readonly outcome: NoticeOutcome | null;
  readonly outcomeDecidedAt: string | null;
  /** Whether the buyer's policy requires a release approval (ODC's rules do not). */
  readonly releaseApprovalRequired: boolean;
  readonly releaseApproval: ReleaseApprovalState;
  /** An active hold that blocks `publish` (`holds.blocked_actions`). */
  readonly publicationHold: boolean;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;
const KWU_NAME = 'Kalahari Water Utilities (Pilot)';
const ODC_NAME = 'Okavango District Council';

const dl = (at: string) => ({ at, timeZone: OFFICIAL_TZ });

const TEBOGO = 5;
const OFFICER_ODC = 23;
const MPHO = { userId: 4, fullName: 'Mpho Dikgang' };

const CATEGORY_A = 'Water Infrastructure Suppliers — Category A';

const KWU_SUBMISSION_RULES =
  'Submit electronically through TenderIQ before the official deadline. A submission may be revised or withdrawn until the deadline; the last complete submission counts. Each submission receives a receipt.';
const KWU_CHANNEL = 'All questions and notices go through the TenderIQ clarification channel. Contact with evaluators is not permitted.';
const ODC_CHANNEL = 'Questions through TenderIQ only.';
const ODC_CONFIDENTIALITY =
  'The respondent undertakes to use the council floor plans only to prepare its quotation, not to copy or share them outside its bid team, and to delete them when the procurement ends.';
const KWU_CONFIDENTIALITY =
  'The respondent undertakes to use the restricted documents only to prepare its response, to share them only with named members of its bid team and subcontractors bound by the same obligation, and to delete them when the procurement ends or on request.';

interface DocSpec {
  readonly k: number;
  readonly title: string;
  readonly fileName: string;
  readonly classification: FixtureDocument['classification'];
  readonly accessRule: DocumentAccessRule;
  readonly versionNo?: number;
  readonly precedence?: number | null;
  /** The addendum that issued this version; the document is dated with that addendum (else with the release). */
  readonly addendumNo?: number | null;
}

/** Descriptive fields of a lot the owning fixtures do not carry (T-2026-0011, whose lots only the bids fixtures model). */
type LotDetails = Pick<NoticeLot, 'description' | 'quantityDescription' | 'deliveryLocation'>;

/** The fields every tender derives from its owning fixtures (see `deriveTender`). */
type DerivedKey =
  | 'releasedAt'
  | 'currentVersionNo'
  | 'submissionDeadline'
  | 'lots'
  | 'milestones'
  | 'addenda'
  | 'versions'
  | 'sessions'
  | 'documents';

/**
 * A tender as written here: the notice attributes this domain owns, the package document specs, and (only for a
 * tender no other domain models, T-2026-0013) its own timetable, lots and versions.
 */
type LocalTender = Omit<FixtureTender, DerivedKey> &
  Partial<Omit<Pick<FixtureTender, DerivedKey>, 'documents'>> & {
    readonly documentSpecs: readonly DocSpec[];
    readonly lotDetails?: Readonly<Record<number, LotDetails>>;
  };

const LOT_TITLE_PREFIX = /^Lot \d+ — /;

function isoOf(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Issued addenda of a tender (the clarifications fixtures own `addenda`), in issue order. */
function issuedAddenda(tenderId: number): AddendumFixture[] {
  return ADDENDA.filter((addendum) => addendum.tenderId === tenderId && addendum.status === 'issued' && addendum.issuedAt !== null).sort(
    (a, b) => a.number - b.number,
  );
}

/**
 * Lots from the tenders fixtures; a tender they do not structure takes the bids fixtures' lots, including a single
 * lot (T-2026-0002 Lot 1, T-2026-0011): the clarification, addendum and bid domains cite those lots, so the notice
 * publishes the same Lot 1 rather than "no lots" (PUB-03, PUB-04, SUP-08).
 */
function deriveLots(local: LocalTender): NoticeLot[] {
  const owned = LOTS.filter((entry) => entry.tenderId === local.id);
  if (owned.length > 0) {
    return owned
      .map((entry) => ({
        lotId: entry.id,
        lotNo: entry.lotNo,
        title: entry.title,
        description: entry.description,
        quantityDescription: entry.quantityDescription,
        deliveryLocation: entry.deliveryLocation,
        stage: entry.stage,
        submissionDeadline: entry.submissionDeadline === null ? null : dl(entry.submissionDeadline),
        outcomeReason: entry.outcomeReason,
      }))
      .sort((a, b) => a.lotNo - b.lotNo);
  }
  const bidLots = BID_TENDERS.find((entry) => entry.id === local.id)?.lots ?? [];
  if (bidLots.length > 0) {
    return bidLots.map((entry) => ({
      lotId: entry.id,
      lotNo: entry.lotNo,
      title: entry.title.replace(LOT_TITLE_PREFIX, ''),
      description: local.lotDetails?.[entry.lotNo]?.description ?? entry.description,
      quantityDescription: local.lotDetails?.[entry.lotNo]?.quantityDescription ?? null,
      deliveryLocation: local.lotDetails?.[entry.lotNo]?.deliveryLocation ?? null,
      stage: entry.stage,
      submissionDeadline: entry.deadline === null ? null : dl(entry.deadline),
      outcomeReason: null,
    }));
  }
  return [...(local.lots ?? [])];
}

/**
 * The release approval as the tenders fixtures record it (`approval_requests`, BUY-08): the decision time and the
 * approved version come from there, so BUY-08 and BUY-14 show one approval record.
 */
function deriveReleaseApproval(local: ReleaseApprovalState): ReleaseApprovalState {
  const owner = RELEASE_APPROVALS.find((entry) => entry.approvalId === local.approvalRequestId);
  if (owner === undefined || owner.status !== 'approved' || local.status !== 'approved') {
    return local;
  }
  return { ...local, subjectVersion: owner.subjectVersion, approvedAt: owner.decidedAt ?? local.approvedAt };
}

function lotNoOf(lots: readonly NoticeLot[], lotId: number | null): number | null {
  return lots.find((entry) => entry.lotId === lotId)?.lotNo ?? null;
}

/**
 * Derives the notice facts from the owning fixtures, so every domain describes one demo world:
 * - release date: the tenders fixtures (`tenders.released_at`);
 * - addenda, versions and the current version: the issued addenda of the clarifications fixtures (version 1 is the
 *   release; each issued addendum creates its resulting version);
 * - lots: the tenders fixtures (`lots`), else the bids fixtures (single-lot events and T-2026-0011);
 * - timetable: the disclosed milestones of the tenders fixtures, with the submission deadline (and the opening after
 *   it) moved by the latest issued addendum that changed it;
 * - sessions and their places: the clarifications fixtures (`sessions`, `session_registrations`);
 * - package documents: dated with the release, or with the addendum that issued them.
 * A tender no other domain models (T-2026-0013) keeps its own values.
 */
function deriveTender(local: LocalTender): FixtureTender {
  const owner = OWNER_TENDERS.find((entry) => entry.id === local.id);
  const releasedAt = owner === undefined ? (local.releasedAt ?? null) : owner.releasedAt;
  const lots = deriveLots(local);
  const addenda: FixtureAddendum[] = issuedAddenda(local.id).map((addendum) => ({
    addendumId: addendum.id,
    number: addendum.number,
    title: addendum.title,
    changeDescription: addendum.changeDescription,
    materiality: addendum.materiality,
    issuedAt: addendum.issuedAt ?? '',
    resultingVersionNo: addendum.resultingVersionNo ?? addendum.number + 1,
    newSubmissionDeadline: addendum.newSubmissionDeadline === null ? null : dl(addendum.newSubmissionDeadline),
    affectedLotNos: addendum.lotIds.map((lotId) => lotNoOf(lots, lotId)).filter((lotNo): lotNo is number => lotNo !== null),
    existingSubmissionAction: addendum.existingSubmissionAction,
    acknowledgmentRequired: addendum.acknowledgmentRequired,
  }));
  const versions: NoticeVersion[] =
    owner === undefined
      ? [...(local.versions ?? [])]
      : releasedAt === null
        ? []
        : [
            { versionNo: 1, issuedAt: releasedAt, changeSummary: 'Initial release.', addendumNo: null },
            ...addenda.map((addendum) => ({
              versionNo: addendum.resultingVersionNo,
              issuedAt: addendum.issuedAt,
              changeSummary: `Addendum ${addendum.number}: ${addendum.title}.`,
              addendumNo: addendum.number,
            })),
          ];
  const timetable = MILESTONES.filter((entry) => entry.tenderId === local.id);
  const plannedDeadline = timetable.find((entry) => entry.milestone === 'submission_deadline' && entry.lotId === null)?.at ?? null;
  const moving = [...addenda].reverse().find((addendum) => addendum.newSubmissionDeadline !== null);
  const submissionDeadline = moving?.newSubmissionDeadline?.at ?? plannedDeadline ?? local.submissionDeadline ?? null;
  const shift = plannedDeadline === null || submissionDeadline === null ? 0 : Date.parse(submissionDeadline) - Date.parse(plannedDeadline);
  const milestones: NoticeMilestone[] =
    timetable.length === 0
      ? [...(local.milestones ?? [])]
      : timetable
          .filter((entry) => entry.isDisclosed)
          .map((entry) => {
            const moved = shift !== 0 && entry.lotId === null && (entry.milestone === 'submission_deadline' || entry.milestone === 'opening');
            return {
              milestone: entry.milestone,
              lotNo: lotNoOf(lots, entry.lotId),
              at: dl(moved ? isoOf(Date.parse(entry.at) + shift) : entry.at),
              note: moved && entry.milestone === 'submission_deadline' ? `Set by addendum ${moving?.number ?? 1}.` : entry.note,
            };
          });
  const ownedSessions = SESSIONS.filter((session) => session.tenderId === local.id);
  const sessions: FixtureSession[] =
    ownedSessions.length === 0
      ? [...(local.sessions ?? [])]
      : ownedSessions.map((session) => ({
          sessionId: session.id,
          sessionType: session.sessionType,
          title: session.title,
          lotNo: lotNoOf(lots, session.lotId),
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          venue: session.venue,
          mandatory: session.mandatory,
          alternativeOfId: session.alternativeOfId,
          capacity: session.capacity,
          placesLeft: Math.max(0, session.capacity - session.registrations.filter((entry) => entry.status !== 'cancelled').length),
          registrationDeadline: session.registrationDeadline,
          status: session.status,
        }));
  const buyerName = local.tenantId === ODC ? ODC_NAME : KWU_NAME;
  const documents = local.documentSpecs.map((spec) => {
    const addendum = spec.addendumNo === undefined || spec.addendumNo === null ? undefined : addenda.find((entry) => entry.number === spec.addendumNo);
    return packageDocument({
      documentId: 7000 + local.id * 10 + spec.k,
      title: spec.title,
      fileName: spec.fileName,
      classification: spec.classification,
      accessRule: spec.accessRule,
      versionNo: spec.versionNo ?? 1,
      precedence: spec.precedence ?? null,
      publishedAt: addendum?.issuedAt ?? releasedAt ?? local.scheduledReleaseAt ?? '',
      addendumNo: spec.addendumNo ?? null,
      tenderReference: local.reference,
      buyerName,
    });
  });
  const { documentSpecs: _specs, lotDetails: _details, ...attributes } = local;
  return {
    ...attributes,
    releaseApproval: deriveReleaseApproval(local.releaseApproval),
    releasedAt,
    currentVersionNo: versions.length,
    submissionDeadline,
    lots,
    milestones,
    addenda,
    versions,
    sessions,
    documents,
  };
}

function condition(tenderId: number, n: number, fields: Omit<NoticeCondition, 'conditionId'>): NoticeCondition {
  return { conditionId: tenderId * 10 + n, ...fields };
}

/** The approved release approval of a released KWU tender (tenders fixtures, ids 201–210). */
function approved(approvalRequestId: number, subjectVersion: number, approvedAt: string): ReleaseApprovalState {
  return { approvalRequestId, status: 'approved', subjectVersion, approvedAt, approvedBy: MPHO, invalidatedReason: null };
}

const NO_APPROVAL: ReleaseApprovalState = {
  approvalRequestId: null,
  status: null,
  subjectVersion: null,
  approvedAt: null,
  approvedBy: null,
  invalidatedReason: null,
};

const BASE = {
  officialTimeZone: OFFICIAL_TZ,
  cancelledAt: null,
  cancellationReason: null,
  acceptedLanguages: ['en'],
  scheduledReleaseAt: null,
  submissionRules: KWU_SUBMISSION_RULES,
  communicationChannelNote: KWU_CHANNEL,
  confidentialityText: null,
  qualificationProgram: null,
  outcome: null,
  outcomeDecidedAt: null,
  releaseApprovalRequired: true,
  publicationHold: false,
  maxLotsPerSupplier: null,
} as const;

const REGISTRATION = (tenderId: number, description = 'Register on TenderIQ before downloading the documents.') =>
  condition(tenderId, 1, { conditionType: 'registration', description, blocking: true });

const LOCAL_TENDERS: readonly LocalTender[] = [
  // T-2026-0001 — 3 lots, per-lot outcomes (AC-26)
  {
    ...BASE,
    id: 1,
    tenantId: KWU,
    reference: 'T-2026-0001',
    title: 'Borehole pump replacement programme',
    summary:
      'Supply, installation and commissioning of replacement borehole pumps in three lots: submersible pumps for the Central District, solar pumping systems for Kgalagadi, and pump controls with telemetry panels.',
    eventType: 'tender',
    procedure: 'open',
    participation: 'open',
    status: 'partially_awarded',
    categoryCode: 'WTR-PUMP',
    regions: ['Central District', 'Kgalagadi'],
    ownerUserId: TEBOGO,
    draftRevision: 4,
    eligibilitySummary: 'Registered suppliers qualified in the WTR-PUMP category (or with an application decided before award).',
    deliveryRequirements: 'Delivery to the named borehole sites; installation within 30 days of delivery.',
    contractConditions: 'KWU General Conditions of Supply 2025; 12-month defects liability; performance security of 10%.',
    maxLotsPerSupplier: 2,
    documentSpecs: [
      { k: 1, title: 'Tender document — instructions and conditions', fileName: 'T-2026-0001-tender-document.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
      { k: 2, title: 'Technical specification — Lots 1 to 3', fileName: 'T-2026-0001-technical-specification-v2.pdf', classification: 'public', accessRule: 'public', versionNo: 2, precedence: 2, addendumNo: 1 },
      { k: 3, title: 'Pricing schedule workbook', fileName: 'T-2026-0001-pricing-schedule.pdf', classification: 'participating_suppliers', accessRule: 'participants', precedence: 3 },
      { k: 4, title: 'Addendum 1 — Corrected pump duty points for lot 1', fileName: 'T-2026-0001-addendum-1.pdf', classification: 'public', accessRule: 'public', addendumNo: 1 },
    ],
    conditions: [
      REGISTRATION(1, 'Register on TenderIQ and accept the tender terms before downloading the documents.'),
      condition(1, 2, { conditionType: 'qualification_required', description: 'Qualification in the WTR-PUMP category is required before award.', blocking: false }),
    ],
    qualificationProgram: CATEGORY_A,
    outcome: {
      summary: 'Lot 1 awarded. Lot 2 cancelled: no compliant bid was received. Lot 3 is still under evaluation.',
      awardLinkPath: '/awards/kwu/T-2026-0001',
    },
    outcomeDecidedAt: '2026-09-10T10:00:00Z',
    releaseApproval: approved(201, 2, '2026-06-13T09:00:00Z'),
  },
  // T-2026-0002 — open RFQ with a material addendum (AC-10) and a failed external notice (AC-33)
  {
    ...BASE,
    id: 2,
    tenantId: KWU,
    reference: 'T-2026-0002',
    title: 'Smart water meter supply',
    summary:
      'Supply of 12,000 domestic smart ultrasonic water meters and 180 bulk district meters with AMR modules and data loggers for the Gaborone and Lobatse networks.',
    eventType: 'rfq',
    procedure: 'open',
    participation: 'open',
    status: 'open',
    categoryCode: 'WTR-METER',
    regions: ['South-East District', 'Southern District'],
    ownerUserId: TEBOGO,
    draftRevision: 3,
    eligibilitySummary: 'Open to registered suppliers of water metering equipment.',
    deliveryRequirements: 'Delivery to the KWU central stores, Gaborone, in two consignments.',
    contractConditions: 'KWU General Conditions of Supply 2025; 24-month meter warranty; liquidated damages 0.5% per week.',
    lotDetails: {
      1: {
        description: '12,000 domestic meters and 180 bulk district meters with AMR modules and data loggers.',
        quantityDescription: '12,000 domestic meters (DN15–DN20) and 180 bulk district meters (DN50–DN200)',
        deliveryLocation: 'KWU central stores, Gaborone (two consignments)',
      },
    },
    documentSpecs: [
      { k: 1, title: 'Request for quotation — instructions', fileName: 'T-2026-0002-rfq-instructions.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
      { k: 2, title: 'Meter technical specification', fileName: 'T-2026-0002-meter-specification-v2.pdf', classification: 'public', accessRule: 'public', versionNo: 2, precedence: 2, addendumNo: 1 },
      { k: 3, title: 'Network installation drawings', fileName: 'T-2026-0002-installation-drawings.pdf', classification: 'participating_suppliers', accessRule: 'participants', precedence: 3 },
      { k: 4, title: 'Price schedule template', fileName: 'T-2026-0002-price-schedule.pdf', classification: 'participating_suppliers', accessRule: 'participants', precedence: 4 },
      { k: 5, title: 'Addendum 1 — OIML R49 certificate and new deadline', fileName: 'T-2026-0002-addendum-1.pdf', classification: 'public', accessRule: 'public', addendumNo: 1 },
    ],
    conditions: [REGISTRATION(2)],
    releaseApproval: approved(202, 2, '2026-09-12T08:30:00Z'),
  },
  // T-2026-0003 — staged RFP under assessment
  {
    ...BASE,
    id: 3,
    tenantId: KWU,
    reference: 'T-2026-0003',
    title: 'SCADA telemetry upgrade',
    summary: 'Design, supply and commissioning of a SCADA telemetry upgrade for 42 pumping stations and reservoirs, with five years of support.',
    eventType: 'rfp',
    procedure: 'open',
    participation: 'open',
    status: 'under_assessment',
    categoryCode: 'ICT-SCADA',
    regions: ['South-East District', 'Central District'],
    ownerUserId: TEBOGO,
    draftRevision: 2,
    eligibilitySummary: 'Suppliers with at least two completed SCADA projects for a water utility.',
    deliveryRequirements: 'Phased migration over 14 months without loss of monitoring.',
    contractConditions: 'KWU ICT Services Conditions 2025; five-year support term.',
    documentSpecs: [
      { k: 1, title: 'Request for proposal', fileName: 'T-2026-0003-rfp.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
      { k: 2, title: 'Functional specification', fileName: 'T-2026-0003-functional-specification.pdf', classification: 'public', accessRule: 'public', precedence: 2 },
      { k: 3, title: 'Network drawings and existing SCADA architecture', fileName: 'T-2026-0003-network-drawings.pdf', classification: 'participating_suppliers', accessRule: 'confidential', precedence: 3 },
      { k: 4, title: 'Addendum 1 — Sites using IEC 60870-5-104', fileName: 'T-2026-0003-addendum-1.pdf', classification: 'public', accessRule: 'public', addendumNo: 1 },
    ],
    conditions: [condition(3, 1, { conditionType: 'confidentiality_undertaking', description: 'Sign the confidentiality undertaking to access network drawings.', blocking: true })],
    confidentialityText: KWU_CONFIDENTIALITY,
    releaseApproval: approved(203, 2, '2026-07-17T09:00:00Z'),
  },
  // T-2026-0004 — RFI, information collected (AC-39)
  {
    ...BASE,
    id: 4,
    tenantId: KWU,
    reference: 'T-2026-0004',
    title: 'Leak-detection market consultation',
    summary: 'Request for information on acoustic and satellite leak-detection services for distribution networks.',
    eventType: 'rfi',
    procedure: 'rfi',
    participation: 'open',
    status: 'information_collected',
    categoryCode: 'ENV-LEAK',
    regions: ['South-East District', 'Kweneng'],
    ownerUserId: TEBOGO,
    draftRevision: 1,
    eligibilitySummary: 'Open to any organization; responses do not create an obligation to procure.',
    deliveryRequirements: null,
    submissionRules: 'Responses are information only and are not evaluated.',
    contractConditions: null,
    documentSpecs: [
      { k: 1, title: 'Request for information', fileName: 'T-2026-0004-rfi.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
    ],
    conditions: [],
    outcome: { summary: 'Market consultation closed. Information was collected from respondents and a follow-on procurement is planned.', awardLinkPath: null },
    outcomeDecidedAt: '2026-06-30T09:00:00Z',
    releaseApproval: approved(204, 1, '2026-05-01T08:00:00Z'),
  },
  // T-2026-0005 — awaiting release approval; a material edit invalidated approval 31 (AC-06)
  {
    ...BASE,
    id: 5,
    tenantId: KWU,
    reference: 'T-2026-0005',
    title: 'Water treatment chemicals framework',
    summary:
      'Three-year framework for the supply of water treatment chemicals to five treatment works: aluminium sulphate, calcium hypochlorite and, from revision 3, polyelectrolyte flocculant.',
    eventType: 'tender',
    procedure: 'open',
    participation: 'open',
    status: 'awaiting_release_approval',
    categoryCode: 'WTR-CHEM',
    regions: ['South-East District', 'Central District'],
    ownerUserId: TEBOGO,
    draftRevision: 3,
    scheduledReleaseAt: '2026-10-19T07:00:00Z',
    eligibilitySummary: 'Manufacturers or authorized distributors with SABS/BOBS certified products.',
    deliveryRequirements: 'Delivered to five treatment works within 10 working days of each call-off order.',
    contractConditions: 'Framework agreement, three years; prices fixed for year one and indexed thereafter.',
    acceptedLanguages: ['en', 'tn'],
    maxLotsPerSupplier: 2,
    documentSpecs: [],
    conditions: [
      REGISTRATION(5, 'Register on TenderIQ and accept the framework terms before downloading the documents.'),
      condition(5, 2, { conditionType: 'eligibility_review', description: 'Distributors must show the manufacturer’s authorization; KWU reviews it before the deadline.', blocking: false }),
    ],
    releaseApproval: {
      approvalRequestId: 31,
      status: 'invalidated',
      subjectVersion: 2,
      approvedAt: '2026-09-25T12:10:00Z',
      approvedBy: MPHO,
      invalidatedReason:
        'Material change in revision 3: Lot 3 (polyelectrolyte flocculant) added and the estimated value raised. A new release approval is required.',
    },
  },
  // T-2026-0006 — invitation-only, invisible to the public (AC-01)
  {
    ...BASE,
    id: 6,
    tenantId: KWU,
    reference: 'T-2026-0006',
    title: 'Chlorine dosing equipment',
    summary: 'Supply and installation of gas chlorinators and dosing panels at the Mmamashia and Letsibogo works.',
    eventType: 'rfq',
    procedure: 'invitation_only',
    participation: 'invitation_only',
    status: 'open',
    categoryCode: 'WTR-DOSE',
    regions: ['Central District', 'South-East District'],
    ownerUserId: TEBOGO,
    draftRevision: 2,
    eligibilitySummary: 'By invitation to qualified suppliers of the Water Infrastructure Suppliers — Category A program.',
    deliveryRequirements: 'Installation during the planned shutdown in February 2027.',
    submissionRules: 'Only invited legal suppliers may respond. Forwarding the invitation does not authorize another organization.',
    contractConditions: 'KWU General Conditions of Supply 2025; commissioning certificate required before payment.',
    documentSpecs: [
      { k: 1, title: 'Invitation to quote — instructions', fileName: 'T-2026-0006-invitation-to-quote.pdf', classification: 'participating_suppliers', accessRule: 'participants', precedence: 1 },
      { k: 2, title: 'Dosing equipment specification', fileName: 'T-2026-0006-specification.pdf', classification: 'participating_suppliers', accessRule: 'participants', precedence: 2 },
      { k: 3, title: 'Works layout drawings', fileName: 'T-2026-0006-layout-drawings.pdf', classification: 'participating_suppliers', accessRule: 'confidential', precedence: 3 },
    ],
    conditions: [
      condition(6, 1, { conditionType: 'qualification_required', description: 'Only suppliers qualified in Water Infrastructure Suppliers — Category A are invited.', blocking: true }),
      condition(6, 2, { conditionType: 'confidentiality_undertaking', description: 'Sign the confidentiality undertaking for the works drawings.', blocking: true }),
    ],
    confidentialityText: KWU_CONFIDENTIALITY,
    qualificationProgram: CATEGORY_A,
    releaseApproval: approved(206, 2, '2026-09-18T08:00:00Z'),
  },
  // T-2026-0007 — award pending, standstill running
  {
    ...BASE,
    id: 7,
    tenantId: KWU,
    reference: 'T-2026-0007',
    title: 'Reservoir rehabilitation works',
    summary: 'Structural repair, relining and roof replacement of the Kgale Hill 20 ML reservoir.',
    eventType: 'tender',
    procedure: 'open',
    participation: 'open',
    status: 'award_pending',
    categoryCode: 'CIV-RES',
    regions: ['South-East District'],
    ownerUserId: TEBOGO,
    draftRevision: 2,
    eligibilitySummary: 'Contractors registered with PPADB in civil works grade E or above.',
    deliveryRequirements: 'Works completed within 10 months of site handover, with the reservoir back in service by the end of month 8.',
    contractConditions: 'FIDIC Short Form of Contract with KWU particular conditions.',
    documentSpecs: [
      { k: 1, title: 'Tender document and bill of quantities', fileName: 'T-2026-0007-tender-document.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
      { k: 2, title: 'Structural condition survey', fileName: 'T-2026-0007-condition-survey.pdf', classification: 'public', accessRule: 'public', precedence: 2 },
    ],
    conditions: [condition(7, 1, { conditionType: 'mandatory_briefing', description: 'Attend the mandatory briefing at Kgale Hill reservoir on 22 May 2026.', blocking: true })],
    outcome: { summary: 'An intention to award has been issued; the standstill period is in progress.', awardLinkPath: null },
    outcomeDecidedAt: '2026-09-25T10:00:00Z',
    releaseApproval: approved(207, 2, '2026-05-08T09:00:00Z'),
  },
  // T-2026-0008 — closed awaiting opening (sealed)
  {
    ...BASE,
    id: 8,
    tenantId: KWU,
    reference: 'T-2026-0008',
    title: 'Pipeline valves bulk supply',
    summary: 'Supply of gate, butterfly and air-release valves (DN100–DN600) for the North-South Carrier maintenance programme.',
    eventType: 'tender',
    procedure: 'open',
    participation: 'open',
    status: 'closed',
    categoryCode: 'WTR-PIPE',
    regions: ['South-East District', 'Central District'],
    ownerUserId: TEBOGO,
    draftRevision: 2,
    eligibilitySummary: 'Manufacturers or distributors of valves to SANS 664 / EN 1074.',
    deliveryRequirements: 'Delivery to the KWU central stores, Gaborone.',
    contractConditions: 'KWU General Conditions of Supply 2025.',
    maxLotsPerSupplier: 2,
    documentSpecs: [
      { k: 1, title: 'Tender document', fileName: 'T-2026-0008-tender-document.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
      { k: 2, title: 'Valve schedule and specification', fileName: 'T-2026-0008-valve-schedule.pdf', classification: 'public', accessRule: 'public', precedence: 2 },
    ],
    conditions: [],
    releaseApproval: approved(208, 2, '2026-08-21T09:00:00Z'),
  },
  // T-2026-0009 — restricted two-stage RFP, invisible to the public
  {
    ...BASE,
    id: 9,
    tenantId: KWU,
    reference: 'T-2026-0009',
    title: 'Acoustic leak detection services',
    summary: 'Two-stage restricted procurement of acoustic leak-detection surveys across 1,200 km of distribution mains.',
    eventType: 'rfp',
    procedure: 'restricted',
    participation: 'restricted',
    status: 'under_assessment',
    categoryCode: 'ENV-LEAK',
    regions: ['South-East District', 'Kweneng'],
    ownerUserId: TEBOGO,
    draftRevision: 3,
    eligibilitySummary: 'Applicants admitted after an access request, then shortlisted on financial standing and experience.',
    deliveryRequirements: 'Survey of 1,200 km of mains per year.',
    submissionRules: 'Stage 1 proposals, shortlist, demonstrations, then best and final offers where permitted.',
    contractConditions: 'KWU Services Conditions 2025.',
    documentSpecs: [
      { k: 1, title: 'Request for proposal — stage 1', fileName: 'T-2026-0009-rfp-stage-1.pdf', classification: 'participating_suppliers', accessRule: 'confidential', precedence: 1 },
    ],
    conditions: [
      condition(9, 1, { conditionType: 'eligibility_review', description: 'Stage 1 applicants are shortlisted on financial standing and experience before stage 2 invitations.', blocking: true }),
    ],
    releaseApproval: approved(209, 3, '2026-07-04T08:00:00Z'),
  },
  // T-2026-0010 — awarded (contract C-2026-0001)
  {
    ...BASE,
    id: 10,
    tenantId: KWU,
    reference: 'T-2026-0010',
    title: 'Fleet vehicle maintenance',
    summary:
      'Scheduled and breakdown maintenance of 86 light and heavy vehicles at the Gaborone and Mahalapye depots for twelve months, with one 12-month renewal option and one 3-month extension option.',
    eventType: 'rfq',
    procedure: 'open',
    participation: 'open',
    status: 'awarded',
    categoryCode: 'FLT-MAINT',
    regions: ['South-East District'],
    ownerUserId: TEBOGO,
    draftRevision: 2,
    eligibilitySummary: 'Workshops accredited by the Motor Trade Association.',
    deliveryRequirements: 'Collection and return within Greater Gaborone.',
    contractConditions: 'KWU Services Conditions 2025; twelve-month term with one 12-month renewal option and one 3-month extension option.',
    documentSpecs: [
      { k: 1, title: 'Request for quotation', fileName: 'T-2026-0010-rfq.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
    ],
    conditions: [],
    outcome: { summary: 'Awarded. The award notice lists the awarded supplier and value.', awardLinkPath: '/awards/kwu/T-2026-0010' },
    outcomeDecidedAt: '2026-03-06T10:00:00Z',
    releaseApproval: approved(210, 2, '2026-01-08T09:00:00Z'),
  },
  // T-2026-0011 — ODC open RFQ (cross-buyer segregation); ODC needs no release approval
  {
    ...BASE,
    id: 11,
    tenantId: ODC,
    reference: 'T-2026-0011',
    title: 'Office cleaning services',
    summary: 'Daily cleaning and hygiene services for the council offices in Maun and Shakawe for two years.',
    eventType: 'rfq',
    procedure: 'open',
    participation: 'open',
    status: 'open',
    categoryCode: 'FAC-CLEAN',
    regions: ['Ngamiland'],
    ownerUserId: OFFICER_ODC,
    draftRevision: 2,
    eligibilitySummary: 'Cleaning contractors registered in Botswana with public liability insurance of at least BWP 1,000,000.',
    deliveryRequirements: 'Services from 1 January 2027 at the council offices in Maun and Shakawe.',
    submissionRules: 'Submit electronically through TenderIQ before the official deadline.',
    communicationChannelNote: ODC_CHANNEL,
    contractConditions: 'ODC Standard Services Agreement; two years.',
    maxLotsPerSupplier: 2,
    lotDetails: {
      1: {
        description: 'Daily cleaning of the council headquarters, including the library annex added by addendum 1.',
        quantityDescription: '3,850 m² of offices, meeting rooms and ablutions, five days a week',
        deliveryLocation: 'Okavango District Council headquarters, Maun',
      },
      2: {
        description: 'Daily cleaning and hygiene services at the district clinics.',
        quantityDescription: 'Four clinics, seven days a week',
        deliveryLocation: 'District clinics in Maun and Shakawe',
      },
    },
    documentSpecs: [
      { k: 1, title: 'Request for quotation — cleaning services', fileName: 'T-2026-0011-rfq.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
      { k: 2, title: 'Site schedule and floor areas', fileName: 'T-2026-0011-site-schedule.pdf', classification: 'public', accessRule: 'public', precedence: 2 },
      { k: 3, title: 'Addendum 1 — Revised floor plan and deadline extension', fileName: 'T-2026-0011-addendum-1.pdf', classification: 'public', accessRule: 'public', addendumNo: 1 },
      { k: 4, title: 'Council headquarters floor plans (revised, with the library annex)', fileName: 'T-2026-0011-floor-plans-v2.pdf', classification: 'participating_suppliers', accessRule: 'confidential', versionNo: 2, precedence: 3, addendumNo: 1 },
    ],
    conditions: [
      REGISTRATION(11),
      condition(11, 2, {
        conditionType: 'eligibility_review',
        description: 'The council admits each applicant before releasing the building floor plans (security of council premises).',
        blocking: true,
      }),
      condition(11, 3, { conditionType: 'confidentiality_undertaking', description: 'Sign the confidentiality undertaking to open the floor plans of council buildings.', blocking: true }),
    ],
    confidentialityText: ODC_CONFIDENTIALITY,
    releaseApprovalRequired: false,
    releaseApproval: NO_APPROVAL,
  },
  // T-2026-0012 — KWU early draft (not released; publication blocked)
  {
    ...BASE,
    id: 12,
    tenantId: KWU,
    reference: 'T-2026-0012',
    title: 'Treatment works electrical maintenance',
    summary: 'Preventive and corrective maintenance of MV/LV switchgear, motors and standby generators at four treatment works.',
    eventType: 'rfq',
    procedure: 'open',
    participation: 'open',
    status: 'draft',
    categoryCode: 'WTR-TREAT',
    regions: ['South-East District', 'Central District'],
    ownerUserId: TEBOGO,
    draftRevision: 2,
    scheduledReleaseAt: '2026-12-09T07:00:00Z',
    eligibilitySummary: 'Electrical contractors registered with the Botswana Energy Regulatory Authority.',
    deliveryRequirements: null,
    contractConditions: null,
    documentSpecs: [],
    conditions: [condition(12, 1, { conditionType: 'mandatory_briefing', description: 'Attend the switch-room walk-through at Mmamashia.', blocking: true })],
    releaseApproval: NO_APPROVAL,
  },
  // T-2026-0013 — ODC, ready and scheduled (BUY-14 publish now / schedule)
  {
    ...BASE,
    id: 13,
    tenantId: ODC,
    reference: 'T-2026-0013',
    title: 'Community borehole drilling — Maun cluster',
    summary: 'Drilling, test-pumping and equipping of six community boreholes around Maun.',
    eventType: 'tender',
    procedure: 'open',
    participation: 'open',
    status: 'ready',
    categoryCode: 'WTR-INFRA',
    regions: ['Ngamiland'],
    ownerUserId: OFFICER_ODC,
    currentVersionNo: 0,
    draftRevision: 2,
    releasedAt: null,
    scheduledReleaseAt: '2026-10-20T06:00:00Z',
    submissionDeadline: '2026-11-18T08:00:00Z',
    eligibilitySummary: 'Drilling contractors registered with the Department of Water and Sanitation.',
    deliveryRequirements: 'All six boreholes equipped within 7 months.',
    submissionRules: 'Single-stage opening. Late submissions are not accepted.',
    communicationChannelNote: ODC_CHANNEL,
    contractConditions: 'ODC Standard Works Agreement.',
    milestones: [{ milestone: 'submission_deadline', lotNo: null, at: dl('2026-11-18T08:00:00Z'), note: null }],
    documentSpecs: [
      { k: 1, title: 'Tender document — borehole drilling', fileName: 'T-2026-0013-tender-document.pdf', classification: 'public', accessRule: 'public', precedence: 1 },
    ],
    versions: [],
    conditions: [REGISTRATION(13)],
    releaseApprovalRequired: false,
    releaseApproval: NO_APPROVAL,
  },
];

export const TENDERS: readonly FixtureTender[] = Object.freeze(LOCAL_TENDERS.map(deriveTender));
