/**
 * Bids fixtures, part 1: the tender-side facts a response is prepared against (docs/plan/demo-storyline.md).
 *
 * These are the bids domain's PROJECTIONS of records owned by other domains (tenders, lots, requirements, pricing
 * items, addenda, acknowledgments, evidence items, service incidents). They use the storyline's natural keys and the
 * id conventions below, so the integration consistency test can reconcile them with the owning domains:
 * - tender id = the number in its reference (T-2026-0002 → 2); lot id = tender id × 100 + lot number;
 * - requirement id = tender id × 1000 + n; pricing item id = schedule id × 10 + n;
 * - evidence item id = supplier tenant id × 100 + n.
 *
 * Storyline timeline (official zone Africa/Gaborone, UTC+02:00). Deadlines follow the tenders domain timetable and
 * addenda follow the clarifications domain:
 * - T-2026-0002 is open until 21 Oct 2026 12:00. Addendum 1 (24 Sep) moved the deadline from 14 Oct and added the
 *   mandatory OIML R49 certificate after Gaborone Metering and Tsodilo had submitted (AC-10). A service incident on
 *   24 Sep coincided with Gaborone Metering's failed supplement, so its first receipt stays effective (AC-12).
 *   Serowe ICT's response is approved internally but not submitted (AC-11). Chobe has not acknowledged addendum 1.
 * - T-2026-0006 (invitation only: Tsodilo, Chobe) closes 14 Oct 2026 12:00: Tsodilo's draft (AC-03) and Chobe's
 *   internally approved replacement of its effective receipt (submission and withdrawal demos, AC-14).
 * - T-2026-0008 stopped accepting submissions at its deadline on 25 Sep 2026 10:00 (status `closed`): Chobe's sealed
 *   submission stays effective after its replacement completed 38 s after the deadline and was rejected with the true
 *   time (AC-13); Tsodilo withdrew (AC-14, AC-15). The closing RECORD under the approved rules is not yet recorded
 *   (`closedAt` null): the officer reviews the late attempt first, so BUY-19 shows it as "deadline passed, closing not
 *   recorded" and the Close action is demonstrable in the live prototype (deviation from the tenders timetable, which
 *   carries closed_at = the deadline; reported to the tenders and opening domains).
 * - AC-13 is anchored on T-2026-0008 rather than T-2026-0002 (the storyline's table): T-2026-0002 is open until
 *   21 Oct, so no attempt on it can be late yet. Chobe's T-2026-0002 response stays a draft that has not
 *   acknowledged addendum 1. Recorded as a storyline deviation for the storyline owner and the reporting domain.
 *
 * Static data: never mutated.
 */
import type {
  AddendaExistingSubmissionAction,
  BidAnswersEnvelope,
  BidInternalApprovalsApprovalType,
  BidsRoundType,
  EvidenceItemsEvidenceType,
  EvidenceItemsStatus,
  EvidenceItemsVerificationStatus,
  LotsStage,
  PricingItemsChargeType,
  PricingItemsRecurrence,
  RequirementsMissingConsequence,
  RequirementsResponseType,
  RequirementsTreatment,
  ServiceIncidentsStatus,
  TendersEventType,
  TendersParticipation,
  TendersStatus,
} from '../../../contracts/enums.js';
import type { ServiceIncidentSeverity } from '../../../contracts/operations/shared.js';
import { INCIDENT_SLOW_UPLOADS_WINDOW } from '../operations/incidents.js';
import { TENANT_IDS } from '../platform.js';

export const GABORONE = 'Africa/Gaborone';

export interface FixtureBidLot {
  readonly id: number;
  readonly lotNo: number;
  readonly title: string;
  readonly description: string | null;
  readonly stage: LotsStage;
  /** `lots.submission_deadline`; null = the tender's (DD-15). */
  readonly deadline: string | null;
}

export interface FixtureRound {
  readonly roundType: BidsRoundType;
  readonly deadline: string;
}

export interface FixtureBidTender {
  readonly id: number;
  readonly buyerTenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly eventType: TendersEventType;
  readonly participation: TendersParticipation;
  readonly status: TendersStatus;
  readonly ownerUserId: number;
  readonly officialTimeZone: string;
  readonly currency: string;
  readonly acceptedCurrencies: readonly string[];
  readonly bidValidityDays: number;
  readonly partialBidsAllowed: boolean;
  readonly alternativesAllowed: boolean;
  readonly maxLotsPerSupplier: number | null;
  readonly currentVersionNo: number;
  /** Rounds in order; the last one is current. Its deadline is the tender's submission deadline. */
  readonly rounds: readonly FixtureRound[];
  /**
   * When the closing record was made. Null while the tender is open, or when submissions stopped at the deadline
   * (status `closed`) but the closing record under the approved rules is still pending (BUY-19 "deadline passed").
   */
  readonly closedAt: string | null;
  /** Null when closing was recorded automatically at the deadline (or is still pending). */
  readonly closedByUserId: number | null;
  /** Supplier tenants invited (invitation-only and restricted events); null for open participation. */
  readonly invitedSupplierTenantIds: readonly number[] | null;
  readonly lots: readonly FixtureBidLot[];
}

const kwu = TENANT_IDS.kwu;
const odc = TENANT_IDS.odc;

function lot(tenderId: number, lotNo: number, title: string, stage: LotsStage, description: string | null = null): FixtureBidLot {
  return { id: tenderId * 100 + lotNo, lotNo, title, description, stage, deadline: null };
}

export const BID_TENDERS: readonly FixtureBidTender[] = Object.freeze([
  {
    id: 1,
    buyerTenantId: kwu,
    reference: 'T-2026-0001',
    title: 'Borehole pump replacement programme (3 lots)',
    eventType: 'tender',
    participation: 'open',
    status: 'partially_awarded',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 120,
    partialBidsAllowed: true,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 2,
    rounds: [{ roundType: 'initial', deadline: '2026-07-24T08:00:00Z' }],
    closedAt: '2026-07-24T08:00:00Z',
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [
      lot(1, 1, 'Submersible borehole pumps — Central District', 'awarded', '24 submersible pumps with motors and cable.'),
      lot(1, 2, 'Solar pumping systems — Kgalagadi', 'cancelled', 'Solar pumping systems for remote boreholes.'),
      lot(1, 3, 'Pump controls and telemetry panels', 'under_assessment', 'Drives, control panels and telemetry interfaces.'),
    ],
  },
  {
    id: 2,
    buyerTenantId: kwu,
    reference: 'T-2026-0002',
    title: 'Smart water meter supply',
    eventType: 'rfq',
    participation: 'open',
    status: 'open',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP', 'ZAR'],
    bidValidityDays: 90,
    partialBidsAllowed: true,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 2,
    rounds: [{ roundType: 'initial', deadline: '2026-10-21T10:00:00Z' }],
    closedAt: null,
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [
      lot(2, 1, 'Smart meters with AMR modules', 'open', '12,000 domestic meters and 180 bulk district meters with AMR modules and data loggers.'),
    ],
  },
  {
    id: 3,
    buyerTenantId: kwu,
    reference: 'T-2026-0003',
    title: 'SCADA telemetry upgrade',
    eventType: 'rfp',
    participation: 'open',
    status: 'under_assessment',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 120,
    partialBidsAllowed: false,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 2,
    rounds: [{ roundType: 'initial', deadline: '2026-08-28T08:00:00Z' }],
    closedAt: '2026-08-28T08:00:00Z',
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [lot(3, 1, 'SCADA telemetry upgrade', 'under_assessment', 'Telemetry outstations, radios and the SCADA master upgrade.')],
  },
  {
    id: 4,
    buyerTenantId: kwu,
    reference: 'T-2026-0004',
    title: 'Leak-detection market consultation',
    eventType: 'rfi',
    participation: 'open',
    status: 'information_collected',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 30,
    partialBidsAllowed: false,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 1,
    rounds: [{ roundType: 'initial', deadline: '2026-06-05T13:00:00Z' }],
    closedAt: '2026-06-05T13:00:00Z',
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [lot(4, 1, 'Leak-detection market consultation', 'closed')],
  },
  {
    id: 5,
    buyerTenantId: kwu,
    reference: 'T-2026-0005',
    title: 'Water treatment chemicals framework',
    eventType: 'tender',
    participation: 'open',
    status: 'awaiting_release_approval',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 120,
    partialBidsAllowed: true,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 0,
    rounds: [{ roundType: 'initial', deadline: '2026-11-18T10:00:00Z' }],
    closedAt: null,
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [lot(5, 1, 'Aluminium sulphate (granular)', 'draft'), lot(5, 2, 'Calcium hypochlorite (HTH granules)', 'draft'), lot(5, 3, 'Polyelectrolyte flocculant', 'draft')],
  },
  {
    id: 6,
    buyerTenantId: kwu,
    reference: 'T-2026-0006',
    title: 'Chlorine dosing equipment',
    eventType: 'rfq',
    participation: 'invitation_only',
    status: 'open',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 90,
    partialBidsAllowed: false,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 1,
    rounds: [{ roundType: 'initial', deadline: '2026-10-14T10:00:00Z' }],
    closedAt: null,
    closedByUserId: null,
    invitedSupplierTenantIds: [TENANT_IDS.tsodilo, TENANT_IDS['chobe-pipe']],
    lots: [lot(6, 1, 'Chlorine dosing equipment', 'open', 'Gas chlorinators with automatic changeover: four gas dosing skids with residual analysers for two treatment works.')],
  },
  {
    id: 7,
    buyerTenantId: kwu,
    reference: 'T-2026-0007',
    title: 'Reservoir rehabilitation works',
    eventType: 'tender',
    participation: 'open',
    status: 'award_pending',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 120,
    partialBidsAllowed: false,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 1,
    rounds: [{ roundType: 'initial', deadline: '2026-06-26T08:00:00Z' }],
    closedAt: '2026-06-26T08:00:00Z',
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [lot(7, 1, 'Reservoir rehabilitation works', 'award_pending')],
  },
  {
    id: 8,
    buyerTenantId: kwu,
    reference: 'T-2026-0008',
    title: 'Pipeline valves bulk supply',
    eventType: 'tender',
    participation: 'open',
    status: 'closed',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 120,
    partialBidsAllowed: true,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 1,
    rounds: [{ roundType: 'initial', deadline: '2026-09-25T08:00:00Z' }],
    // Submissions stopped at the deadline; the closing record is pending the officer's review of the late attempt.
    closedAt: null,
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [
      lot(8, 1, 'Gate and butterfly valves (DN100–DN600)', 'closed'),
      lot(8, 2, 'Air-release valves', 'closed'),
    ],
  },
  {
    id: 9,
    buyerTenantId: kwu,
    reference: 'T-2026-0009',
    title: 'Acoustic leak detection services',
    eventType: 'rfp',
    participation: 'restricted',
    status: 'under_assessment',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 120,
    partialBidsAllowed: false,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 1,
    rounds: [
      { roundType: 'initial', deadline: '2026-06-30T10:00:00Z' },
      { roundType: 'next_stage', deadline: '2026-08-14T08:00:00Z' },
    ],
    closedAt: '2026-08-14T08:00:00Z',
    closedByUserId: 5,
    invitedSupplierTenantIds: [TENANT_IDS['serowe-ict'], TENANT_IDS.tsodilo, TENANT_IDS['gaborone-meter']],
    lots: [lot(9, 1, 'Acoustic leak detection services', 'under_assessment')],
  },
  {
    id: 10,
    buyerTenantId: kwu,
    reference: 'T-2026-0010',
    title: 'Fleet vehicle maintenance',
    eventType: 'rfq',
    participation: 'open',
    status: 'awarded',
    ownerUserId: 5,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 90,
    partialBidsAllowed: false,
    alternativesAllowed: false,
    maxLotsPerSupplier: null,
    currentVersionNo: 1,
    rounds: [{ roundType: 'initial', deadline: '2026-02-03T08:00:00Z' }],
    closedAt: '2026-02-03T08:00:00Z',
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [lot(10, 1, 'Fleet vehicle maintenance', 'awarded')],
  },
  {
    id: 11,
    buyerTenantId: odc,
    reference: 'T-2026-0011',
    title: 'Office cleaning services',
    eventType: 'rfq',
    participation: 'open',
    status: 'open',
    ownerUserId: 23,
    officialTimeZone: GABORONE,
    currency: 'BWP',
    acceptedCurrencies: ['BWP'],
    bidValidityDays: 60,
    partialBidsAllowed: true,
    alternativesAllowed: false,
    maxLotsPerSupplier: 2,
    currentVersionNo: 2,
    rounds: [{ roundType: 'initial', deadline: '2026-10-23T10:00:00Z' }],
    closedAt: null,
    closedByUserId: null,
    invitedSupplierTenantIds: null,
    lots: [
      lot(11, 1, 'Lot 1 — Council headquarters, Maun', 'open'),
      lot(11, 2, 'Lot 2 — District clinics', 'open'),
    ],
  },
]);

/** Tender statuses that are released (visible to participants and monitored in BUY-19). */
export const RELEASED_TENDER_STATUSES: readonly TendersStatus[] = [
  'open',
  'closed',
  'under_assessment',
  'award_pending',
  'awarded',
  'partially_awarded',
  'completed_without_award',
  'information_collected',
  'cancelled',
];

// ---------------------------------------------------------------------------------------------------------
// Addenda and acknowledgments (DD-42: participant_acknowledgments is authoritative)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureAddendum {
  readonly id: number;
  readonly tenderId: number;
  readonly number: number;
  readonly title: string;
  readonly issuedAt: string;
  readonly material: boolean;
  readonly existingSubmissionAction: AddendaExistingSubmissionAction;
  readonly acknowledgmentRequired: boolean;
  readonly resultingVersionNo: number;
}

/** Issued addenda. The clarifications domain owns them; ids, dates, titles and actions match its fixtures. */
export const BID_ADDENDA: readonly FixtureAddendum[] = Object.freeze([
  {
    id: 11,
    tenderId: 1,
    number: 1,
    title: 'Lot 3 rising main quantity',
    issuedAt: '2026-06-11T08:00:00Z',
    material: true,
    existingSubmissionAction: 'none',
    acknowledgmentRequired: true,
    resultingVersionNo: 2,
  },
  {
    id: 21,
    tenderId: 2,
    number: 1,
    title: 'OIML R49 type-approval certificate and deadline extension',
    issuedAt: '2026-09-24T08:00:00Z',
    material: true,
    existingSubmissionAction: 'supplement',
    acknowledgmentRequired: true,
    resultingVersionNo: 2,
  },
  {
    id: 31,
    tenderId: 3,
    number: 1,
    title: 'Sites using IEC 60870-5-104',
    issuedAt: '2026-08-05T09:30:00Z',
    material: false,
    existingSubmissionAction: 'acknowledge',
    acknowledgmentRequired: true,
    resultingVersionNo: 2,
  },
  {
    id: 111,
    tenderId: 11,
    number: 1,
    title: 'Revised floor plan and deadline extension',
    issuedAt: '2026-09-20T07:00:00Z',
    material: true,
    existingSubmissionAction: 'none',
    acknowledgmentRequired: true,
    resultingVersionNo: 2,
  },
]);

export interface FixtureAcknowledgment {
  readonly addendumId: number;
  readonly supplierTenantId: number;
  readonly userId: number;
  readonly acknowledgedAt: string;
}

/** `participant_acknowledgments` (DD-42). Chobe has not acknowledged T-2026-0002 addendum 1. */
export const BID_ACKNOWLEDGMENTS: readonly FixtureAcknowledgment[] = Object.freeze([
  { addendumId: 11, supplierTenantId: TENANT_IDS.tsodilo, userId: 25, acknowledgedAt: '2026-06-11T12:00:00Z' },
  { addendumId: 11, supplierTenantId: TENANT_IDS['chobe-pipe'], userId: 29, acknowledgedAt: '2026-06-12T08:30:00Z' },
  { addendumId: 11, supplierTenantId: TENANT_IDS.makgadikgadi, userId: 40, acknowledgedAt: '2026-06-12T09:10:00Z' },
  { addendumId: 21, supplierTenantId: TENANT_IDS['gaborone-meter'], userId: 37, acknowledgedAt: '2026-09-24T10:05:00Z' },
  { addendumId: 21, supplierTenantId: TENANT_IDS.tsodilo, userId: 25, acknowledgedAt: '2026-09-25T07:45:00Z' },
  { addendumId: 21, supplierTenantId: TENANT_IDS['serowe-ict'], userId: 33, acknowledgedAt: '2026-09-27T08:12:31Z' },
  { addendumId: 31, supplierTenantId: TENANT_IDS['serowe-ict'], userId: 33, acknowledgedAt: '2026-08-05T11:00:00Z' },
  { addendumId: 31, supplierTenantId: TENANT_IDS.tsodilo, userId: 25, acknowledgedAt: '2026-08-06T07:30:00Z' },
  { addendumId: 31, supplierTenantId: TENANT_IDS.makgadikgadi, userId: 40, acknowledgedAt: '2026-08-06T09:00:00Z' },
  { addendumId: 111, supplierTenantId: TENANT_IDS['limpopo-env'], userId: 41, acknowledgedAt: '2026-09-21T08:00:00Z' },
  { addendumId: 111, supplierTenantId: TENANT_IDS.makgadikgadi, userId: 40, acknowledgedAt: '2026-09-22T07:40:00Z' },
]);

// ---------------------------------------------------------------------------------------------------------
// Requirements (the supplier-facing projection of `requirements`)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureRequirement {
  readonly id: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly section: string;
  readonly refCode: string;
  readonly text: string;
  readonly responseType: RequirementsResponseType;
  readonly choices: readonly string[];
  readonly responseInstructions: string | null;
  readonly evidenceRequired: string | null;
  readonly treatment: RequirementsTreatment;
  readonly envelope: BidAnswersEnvelope;
  readonly missingConsequence: RequirementsMissingConsequence;
  readonly addendumNumber: number | null;
}

const ELIGIBILITY = 'Company and eligibility';
const TECHNICAL = 'Technical proposal';
const DELIVERY = 'Delivery and installation';
const COMMERCIAL = 'Commercial';

function requirement(
  tenderId: number,
  n: number,
  fields: Omit<FixtureRequirement, 'id' | 'tenderId' | 'lotId' | 'choices' | 'responseInstructions' | 'evidenceRequired' | 'addendumNumber'> &
    Partial<Pick<FixtureRequirement, 'lotId' | 'choices' | 'responseInstructions' | 'evidenceRequired' | 'addendumNumber'>>,
): FixtureRequirement {
  return {
    id: tenderId * 1000 + n,
    tenderId,
    lotId: fields.lotId ?? null,
    choices: fields.choices ?? [],
    responseInstructions: fields.responseInstructions ?? null,
    evidenceRequired: fields.evidenceRequired ?? null,
    addendumNumber: fields.addendumNumber ?? null,
    section: fields.section,
    refCode: fields.refCode,
    text: fields.text,
    responseType: fields.responseType,
    treatment: fields.treatment,
    envelope: fields.envelope,
    missingConsequence: fields.missingConsequence,
  };
}

/** Three standard requirements for the events that are past submission (historical responses). */
function standardRequirements(tenderId: number, technical: string, experience: string): FixtureRequirement[] {
  return [
    requirement(tenderId, 1, {
      section: ELIGIBILITY,
      refCode: 'Q-01',
      text: 'Provide the certificate of incorporation and a valid tax clearance certificate.',
      responseType: 'document',
      evidenceRequired: 'Certificate of incorporation; tax clearance certificate',
      treatment: 'mandatory_gate',
      envelope: 'qualification',
      missingConsequence: 'reject',
    }),
    requirement(tenderId, 2, {
      section: TECHNICAL,
      refCode: 'T-01',
      text: technical,
      responseType: 'text',
      responseInstructions: 'At most 1,500 words. Refer to drawings by number.',
      treatment: 'rated',
      envelope: 'technical',
      missingConsequence: 'clarify',
    }),
    requirement(tenderId, 3, {
      section: TECHNICAL,
      refCode: 'T-02',
      text: experience,
      responseType: 'text',
      responseInstructions: 'List at least three contracts with client, value, year and a contact.',
      treatment: 'rated',
      envelope: 'technical',
      missingConsequence: 'clarify',
    }),
  ];
}

export const BID_REQUIREMENTS: readonly FixtureRequirement[] = Object.freeze([
  ...standardRequirements(
    1,
    'Describe the pump selection, motor protection and installation method for each offered lot.',
    'Describe borehole pump installations completed in the last five years.',
  ),
  // T-2026-0002 Smart water meter supply
  requirement(2, 1, {
    section: ELIGIBILITY,
    refCode: 'Q-01',
    text: 'Provide the certificate of incorporation and a valid tax clearance certificate.',
    responseType: 'document',
    evidenceRequired: 'Certificate of incorporation; tax clearance certificate',
    treatment: 'mandatory_gate',
    envelope: 'qualification',
    missingConsequence: 'reject',
  }),
  requirement(2, 2, {
    section: ELIGIBILITY,
    refCode: 'Q-02',
    text: 'State the number of smart water meters supplied in the last three years.',
    responseType: 'number',
    treatment: 'rated',
    envelope: 'qualification',
    missingConsequence: 'clarify',
  }),
  requirement(2, 3, {
    section: TECHNICAL,
    refCode: 'T-01',
    text: 'Describe the metrology class (ISO 4064, R400) of the offered meter models.',
    responseType: 'text',
    treatment: 'mandatory_gate',
    envelope: 'technical',
    missingConsequence: 'reject',
  }),
  requirement(2, 4, {
    section: TECHNICAL,
    refCode: 'T-02',
    text: 'Describe the AMR communication technology and the meter data platform.',
    responseType: 'text',
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'clarify',
  }),
  requirement(2, 5, {
    section: TECHNICAL,
    refCode: 'T-03',
    text: 'Confirm a battery life of at least 15 years under the stated reading profile.',
    responseType: 'yes_no',
    treatment: 'mandatory_gate',
    envelope: 'technical',
    missingConsequence: 'reject',
  }),
  requirement(2, 6, {
    lotId: 201,
    section: DELIVERY,
    refCode: 'D-01',
    text: 'Provide the delivery and installation programme for 12,000 domestic meters.',
    responseType: 'text',
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'clarify',
  }),
  requirement(2, 7, {
    section: DELIVERY,
    refCode: 'D-02',
    text: 'Describe the commissioning method for district bulk meters, including chamber works.',
    responseType: 'text',
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'clarify',
  }),
  requirement(2, 8, {
    section: ELIGIBILITY,
    refCode: 'Q-05',
    text: 'Provide a valid OIML R49 type-approval certificate for every offered meter model.',
    responseType: 'document',
    evidenceRequired: 'OIML R49 type-approval certificates',
    treatment: 'mandatory_gate',
    envelope: 'qualification',
    missingConsequence: 'reject',
    addendumNumber: 1,
  }),
  requirement(2, 9, {
    section: COMMERCIAL,
    refCode: 'C-01',
    text: 'Choose the warranty period offered for meters and loggers.',
    responseType: 'choice',
    choices: ['2 years', '5 years', '10 years'],
    treatment: 'rated',
    envelope: 'commercial',
    missingConsequence: 'clarify',
  }),
  ...standardRequirements(
    3,
    'Describe the telemetry architecture, radio coverage and the SCADA master migration plan.',
    'Describe SCADA or telemetry projects for water utilities in the last five years.',
  ),
  ...standardRequirements(
    4,
    'Describe the leak-detection methods you would recommend for a 2,400 km distribution network.',
    'Describe comparable leak-detection programmes and the water loss reduction achieved.',
  ),
  // T-2026-0006 Chlorine dosing equipment
  requirement(6, 1, {
    section: ELIGIBILITY,
    refCode: 'Q-01',
    text: 'Provide a valid tax clearance certificate.',
    responseType: 'document',
    evidenceRequired: 'Tax clearance certificate',
    treatment: 'mandatory_gate',
    envelope: 'qualification',
    missingConsequence: 'reject',
  }),
  requirement(6, 2, {
    section: ELIGIBILITY,
    refCode: 'Q-02',
    text: 'Provide the ISO 9001 certificate covering manufacture or assembly.',
    responseType: 'document',
    evidenceRequired: 'ISO 9001 certificate',
    treatment: 'mandatory_gate',
    envelope: 'qualification',
    missingConsequence: 'reject',
  }),
  requirement(6, 3, {
    section: TECHNICAL,
    refCode: 'T-01',
    text: 'Describe the dosing skid design, the capacity range and the control philosophy.',
    responseType: 'text',
    responseInstructions: 'Include the behaviour on loss of chlorine feed and on analyser failure.',
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'clarify',
  }),
  requirement(6, 4, {
    section: TECHNICAL,
    refCode: 'T-02',
    text: 'Describe similar chlorine dosing installations completed in the last five years.',
    responseType: 'text',
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'clarify',
  }),
  requirement(6, 5, {
    section: TECHNICAL,
    refCode: 'T-03',
    text: 'Confirm compliance with the chlorine gas safety requirements of Annex C.',
    responseType: 'yes_no',
    treatment: 'mandatory_gate',
    envelope: 'technical',
    missingConsequence: 'reject',
  }),
  requirement(6, 6, {
    section: DELIVERY,
    refCode: 'D-01',
    text: 'State the delivery lead time in weeks from the purchase order (target: 12 weeks).',
    responseType: 'number',
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'warning',
  }),
  requirement(6, 7, {
    section: DELIVERY,
    refCode: 'D-02',
    text: 'Describe operator training and the handover documentation.',
    responseType: 'text',
    treatment: 'information_only',
    envelope: 'technical',
    missingConsequence: 'warning',
  }),
  requirement(6, 8, {
    section: COMMERCIAL,
    refCode: 'C-01',
    text: 'State the period in years for which spare parts remain available.',
    responseType: 'number',
    treatment: 'rated',
    envelope: 'commercial',
    missingConsequence: 'clarify',
  }),
  ...standardRequirements(
    7,
    'Describe the method statement for concrete repair, waterproofing and disinfection of the reservoirs.',
    'Describe reservoir or water-retaining structure works in the last five years.',
  ),
  ...standardRequirements(
    8,
    'Confirm the valve standards, pressure classes and coating system offered for each lot.',
    'Describe bulk valve supply contracts for water utilities in the last five years.',
  ),
  ...standardRequirements(
    9,
    'Describe the acoustic survey method, correlator equipment and reporting format.',
    'Describe acoustic leak detection surveys completed in the last five years.',
  ),
  ...standardRequirements(
    10,
    'Describe the maintenance schedule, workshop capacity and turnaround times for the fleet.',
    'Describe fleet maintenance contracts of comparable size in the last five years.',
  ),
  ...standardRequirements(
    11,
    'Describe the cleaning schedule, staffing and supervision for each offered lot.',
    'Describe office or clinic cleaning contracts in the last three years.',
  ),
]);

// ---------------------------------------------------------------------------------------------------------
// Pricing schedules and items
// ---------------------------------------------------------------------------------------------------------

export interface FixturePricingItem {
  readonly id: number;
  readonly itemCode: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: string;
  readonly chargeType: PricingItemsChargeType;
  readonly recurrence: PricingItemsRecurrence | null;
  readonly isOptional: boolean;
  readonly isProvisional: boolean;
  readonly includeInEvaluation: boolean;
}

export interface FixturePriceSchedule {
  readonly id: number;
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly title: string;
  readonly items: readonly FixturePricingItem[];
}

function item(
  scheduleId: number,
  n: number,
  itemCode: string,
  description: string,
  unit: string,
  quantity: string,
  extra: Partial<Pick<FixturePricingItem, 'chargeType' | 'recurrence' | 'isOptional' | 'isProvisional' | 'includeInEvaluation'>> = {},
): FixturePricingItem {
  const isOptional = extra.isOptional ?? false;
  return {
    id: scheduleId * 10 + n,
    itemCode,
    description,
    unit,
    quantity,
    chargeType: extra.chargeType ?? 'one_time',
    recurrence: extra.recurrence ?? null,
    isOptional,
    isProvisional: extra.isProvisional ?? false,
    includeInEvaluation: extra.includeInEvaluation ?? !isOptional,
  };
}

function standardSchedule(tenderId: number, lotId: number | null, title: string, supply: string, service: string): FixturePriceSchedule {
  const id = 9000 + tenderId * 10 + (lotId === null ? 0 : lotId % 100);
  return {
    id,
    tenderId,
    lotId,
    title,
    items: [item(id, 1, 'S-01', supply, 'lump sum', '1'), item(id, 2, 'S-02', service, 'lump sum', '1')],
  };
}

export const BID_PRICE_SCHEDULES: readonly FixturePriceSchedule[] = Object.freeze([
  standardSchedule(1, 101, 'Lot 1 — Submersible pumps', 'Supply of pumps, motors and cable', 'Installation and commissioning'),
  standardSchedule(1, 102, 'Lot 2 — Pump house civil works', 'Civil works', 'Preliminaries and general'),
  standardSchedule(1, 103, 'Lot 3 — Drives and controls', 'Supply of drives and panels', 'Integration and commissioning'),
  {
    id: 2101,
    tenderId: 2,
    lotId: 201,
    title: 'Smart meters with AMR modules',
    items: [
      item(2101, 1, 'SM-01', 'Smart water meter DN15, AMR-ready', 'each', '10000'),
      item(2101, 2, 'SM-02', 'Smart water meter DN20, AMR-ready', 'each', '2000'),
      item(2101, 3, 'SM-03', 'Installation and meter exchange', 'each', '12000'),
      item(2101, 4, 'SM-04', 'AMR data platform subscription', 'month', '1', { chargeType: 'recurring', recurrence: 'monthly' }),
      item(2101, 5, 'SM-05', 'Spare meters DN15', 'each', '200', { isOptional: true }),
      item(2101, 6, 'BM-01', 'Bulk meter DN50 with data logger', 'each', '100'),
      item(2101, 7, 'BM-02', 'Bulk meter DN100 with data logger', 'each', '60'),
      item(2101, 8, 'BM-03', 'Bulk meter DN150 with data logger', 'each', '20'),
      item(2101, 9, 'BM-04', 'Chamber works and commissioning', 'provisional sum', '1', { isProvisional: true }),
    ],
  },
  standardSchedule(3, 301, 'SCADA telemetry upgrade', 'Supply of outstations, radios and SCADA licences', 'Installation, migration and training'),
  standardSchedule(4, 401, 'Indicative costs', 'Indicative survey cost per 100 km', 'Indicative reporting and training cost'),
  {
    id: 6101,
    tenderId: 6,
    lotId: 601,
    title: 'Gas chlorinators with automatic changeover',
    items: [
      item(6101, 1, 'CD-01', 'Chlorine gas dosing skid, 0–20 kg/h', 'each', '4'),
      item(6101, 2, 'CD-02', 'Free chlorine residual analyser', 'each', '8'),
      item(6101, 3, 'CD-03', 'Installation and commissioning', 'lump sum', '1'),
      item(6101, 4, 'CD-04', 'Operator training (two sessions)', 'lump sum', '1'),
      item(6101, 5, 'CD-05', 'Annual maintenance contract', 'year', '1', { chargeType: 'recurring', recurrence: 'annual' }),
      item(6101, 6, 'CD-06', 'Spare parts kit', 'each', '4', { isOptional: true }),
    ],
  },
  standardSchedule(7, 701, 'Reservoir rehabilitation', 'Concrete repair and waterproofing', 'Preliminaries, disinfection and testing'),
  standardSchedule(8, 801, 'Lot 1 — Gate and butterfly valves', 'Supply of gate and butterfly valves', 'Delivery to Gaborone stores'),
  standardSchedule(8, 802, 'Lot 2 — Air valves and fittings', 'Supply of air valves and fittings', 'Delivery to Gaborone stores'),
  standardSchedule(9, 901, 'Acoustic leak detection services', 'Acoustic survey, 800 km', 'Reporting and repair verification'),
  standardSchedule(10, 1001, 'Fleet vehicle maintenance', 'Scheduled maintenance, 12 months', 'Parts handling and roadside assistance'),
  standardSchedule(11, 1101, 'Lot 1 — Council headquarters', 'Daily cleaning, 12 months', 'Consumables'),
  standardSchedule(11, 1102, 'Lot 2 — District clinics', 'Daily cleaning, 12 months', 'Consumables'),
]);

// ---------------------------------------------------------------------------------------------------------
// Supplier internal approval policy and evidence library (projections of supplier-owned records)
// ---------------------------------------------------------------------------------------------------------

/** The internal approvals each supplier's policy requires before submission (FR-11: optional or required). */
export const SUPPLIER_APPROVAL_POLICIES: Readonly<Record<number, readonly BidInternalApprovalsApprovalType[]>> = Object.freeze({
  [TENANT_IDS.tsodilo]: ['commercial', 'executive'],
  [TENANT_IDS['chobe-pipe']]: ['executive'],
  [TENANT_IDS['serowe-ict']]: ['commercial', 'executive'],
  [TENANT_IDS['gaborone-meter']]: ['executive'],
  [TENANT_IDS.makgadikgadi]: [],
  [TENANT_IDS['limpopo-env']]: [],
});

export interface FixtureEvidenceItem {
  readonly id: number;
  readonly supplierTenantId: number;
  readonly title: string;
  readonly evidenceType: EvidenceItemsEvidenceType;
  readonly issuer: string | null;
  readonly validFrom: string | null;
  readonly expiresAt: string | null;
  readonly status: EvidenceItemsStatus;
  readonly verificationStatus: EvidenceItemsVerificationStatus;
  readonly documentId: number;
  readonly documentVersionId: number;
  readonly versionNo: number;
  readonly fileName: string;
}

function evidence(
  supplierTenantId: number,
  n: number,
  title: string,
  evidenceType: EvidenceItemsEvidenceType,
  issuer: string | null,
  validFrom: string | null,
  expiresAt: string | null,
  status: EvidenceItemsStatus,
  verificationStatus: EvidenceItemsVerificationStatus,
  fileName: string,
  versionNo = 1,
): FixtureEvidenceItem {
  const id = supplierTenantId * 100 + n;
  return {
    id,
    supplierTenantId,
    title,
    evidenceType,
    issuer,
    validFrom,
    expiresAt,
    status,
    verificationStatus,
    documentId: 50_000 + id,
    documentVersionId: 60_000 + id * 10 + versionNo,
    versionNo,
    fileName,
  };
}

const T = TENANT_IDS.tsodilo;
const C = TENANT_IDS['chobe-pipe'];
const S = TENANT_IDS['serowe-ict'];
const G = TENANT_IDS['gaborone-meter'];
const M = TENANT_IDS.makgadikgadi;
const L = TENANT_IDS['limpopo-env'];
const CIPA = 'Companies and Intellectual Property Authority';
const BURS = 'Botswana Unified Revenue Service';

export const BID_EVIDENCE_ITEMS: readonly FixtureEvidenceItem[] = Object.freeze([
  evidence(T, 1, 'Certificate of incorporation', 'registration', CIPA, '2011-03-14T00:00:00Z', null, 'current', 'independently_verified', 'tsodilo-incorporation.pdf'),
  evidence(T, 2, 'ISO 9001:2015 certificate', 'certificate', 'SGS Botswana', '2024-04-01T00:00:00Z', '2027-03-31T00:00:00Z', 'current', 'independently_verified', 'tsodilo-iso9001.pdf', 2),
  evidence(T, 3, 'Tax clearance certificate 2025/26', 'certificate', BURS, '2025-07-01T00:00:00Z', '2026-06-30T00:00:00Z', 'expired', 'supplier_provided', 'tsodilo-tax-2025.pdf'),
  evidence(T, 4, 'Tax clearance certificate 2026/27', 'certificate', BURS, '2026-07-01T00:00:00Z', '2027-06-30T00:00:00Z', 'current', 'supplier_provided', 'tsodilo-tax-2026.pdf'),
  evidence(T, 5, 'Public liability insurance', 'insurance', 'Hollard Botswana', '2026-02-01T00:00:00Z', '2027-01-31T00:00:00Z', 'current', 'supplier_provided', 'tsodilo-liability.pdf'),
  evidence(C, 1, 'Certificate of incorporation', 'registration', CIPA, '2008-09-02T00:00:00Z', null, 'current', 'independently_verified', 'chobe-incorporation.pdf'),
  evidence(C, 2, 'ISO 9001:2015 certificate', 'certificate', 'Bureau Veritas', '2024-06-01T00:00:00Z', '2027-05-31T00:00:00Z', 'current', 'independently_verified', 'chobe-iso9001.pdf'),
  evidence(C, 3, 'Public liability insurance', 'insurance', 'Botswana Insurance Company', '2025-10-08T00:00:00Z', '2026-10-08T00:00:00Z', 'current', 'supplier_provided', 'chobe-liability.pdf'),
  evidence(C, 4, 'Tax clearance certificate 2026/27', 'certificate', BURS, '2026-04-01T00:00:00Z', '2027-03-31T00:00:00Z', 'current', 'supplier_provided', 'chobe-tax-2026.pdf'),
  evidence(S, 1, 'Certificate of incorporation', 'registration', CIPA, '2014-01-20T00:00:00Z', null, 'current', 'independently_verified', 'serowe-incorporation.pdf'),
  evidence(S, 2, 'ISO/IEC 27001 certificate', 'certificate', 'BSI', '2024-03-01T00:00:00Z', '2027-02-28T00:00:00Z', 'current', 'independently_verified', 'serowe-iso27001.pdf'),
  evidence(S, 3, 'Tax clearance certificate 2026/27', 'certificate', BURS, '2026-05-01T00:00:00Z', '2027-04-30T00:00:00Z', 'current', 'supplier_provided', 'serowe-tax-2026.pdf'),
  evidence(G, 1, 'Certificate of incorporation', 'registration', CIPA, '2016-11-11T00:00:00Z', null, 'current', 'independently_verified', 'gaborone-meter-incorporation.pdf'),
  evidence(G, 2, 'OIML R49 type approval — GM-Smart 15/20', 'certificate', 'NMi Certin', '2023-02-01T00:00:00Z', '2028-01-31T00:00:00Z', 'current', 'independently_verified', 'gm-oiml-r49.pdf'),
  evidence(G, 3, 'Tax clearance certificate 2026/27', 'certificate', BURS, '2026-02-01T00:00:00Z', '2027-01-31T00:00:00Z', 'current', 'supplier_provided', 'gaborone-meter-tax-2026.pdf'),
  evidence(G, 4, 'OIML R49 type approval — GM-Bulk 50/100/150', 'certificate', 'NMi Certin', '2025-03-01T00:00:00Z', '2030-02-28T00:00:00Z', 'current', 'independently_verified', 'gm-oiml-r49-bulk.pdf'),
  evidence(M, 1, 'Certificate of incorporation', 'registration', CIPA, '2012-05-07T00:00:00Z', null, 'current', 'independently_verified', 'makgadikgadi-incorporation.pdf'),
  evidence(L, 1, 'Certificate of incorporation', 'registration', CIPA, '2018-08-15T00:00:00Z', null, 'current', 'independently_verified', 'limpopo-incorporation.pdf'),
]);

// ---------------------------------------------------------------------------------------------------------
// Service incidents affecting tenders (projection of operations' service_incidents × impacts)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureTenderIncident {
  readonly incidentId: number;
  readonly buyerTenantId: number;
  readonly tenderId: number;
  readonly title: string;
  /** `service_incidents.severity` as the operations contract fixes it (low, medium, high, critical). */
  readonly severity: ServiceIncidentSeverity;
  readonly status: ServiceIncidentsStatus;
  readonly startedAt: string;
  readonly resolvedAt: string | null;
  readonly impactNote: string | null;
  readonly buyerDecisionNote: string | null;
}

export const BID_TENDER_INCIDENTS: readonly FixtureTenderIncident[] = Object.freeze([
  {
    incidentId: 1,
    buyerTenantId: kwu,
    tenderId: 2,
    title: 'Slow document uploads',
    severity: 'high',
    status: 'resolved',
    startedAt: INCIDENT_SLOW_UPLOADS_WINDOW.startedAt,
    resolvedAt: INCIDENT_SLOW_UPLOADS_WINDOW.resolvedAt,
    impactNote:
      'Uploads to submission storage were delayed for 45 minutes. One replacement attempt on T-2026-0002 did not complete; the earlier receipt stayed effective.',
    buyerDecisionNote:
      'No deadline extension: the deadline in force (21 Oct 2026) was four weeks later and every affected supplier could resubmit. Recorded by the tender owner on 25 Sep 2026.',
  },
]);
