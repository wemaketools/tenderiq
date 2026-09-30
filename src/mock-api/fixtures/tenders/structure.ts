/**
 * Lots, team members and requirements of the demo tenders (BUY-08, BUY-09).
 *
 * Id scheme: lot `tenderId*100 + lotNo`, team member `tenderId*100 + n`, requirement `tenderId*1000 + n`,
 * evaluation criterion `tenderId*1000 + 500 + n` (see evaluation.ts).
 *
 * - T-2026-0003 carries REQ-Q-03 (ISO 9001), the mandatory requirement Makgadikgadi fails (AC-17), and Sam
 *   Keitumetse's pending conflict review (AC-02).
 * - T-2026-0005 revision 3 added Lot 3 and its jar-test requirement (the material edit behind AC-06).
 * - T-2026-0012 shows every authoring warning: missing owners, a gate that only warns, a rated requirement without
 *   a criterion, an information-only item that rejects, a choice without choices, an unconfigured envelope.
 */
import { TENANT_IDS } from '../platform.js';
import { USERS } from './reference.js';
import type { FxLot, FxRequirement, FxTeamMember } from './types.js';

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

function lot(
  tenderId: number,
  lotNo: number,
  fields: Omit<FxLot, 'id' | 'tenantId' | 'tenderId' | 'lotNo' | 'submissionDeadline' | 'outcomeReason'> &
    Partial<Pick<FxLot, 'submissionDeadline' | 'outcomeReason' | 'tenantId'>>,
): FxLot {
  return {
    id: tenderId * 100 + lotNo,
    tenantId: KWU,
    tenderId,
    lotNo,
    submissionDeadline: null,
    outcomeReason: null,
    ...fields,
  };
}

export const LOTS: readonly FxLot[] = Object.freeze([
  lot(1, 1, {
    title: 'Submersible borehole pumps — Central District',
    description: 'Supply, installation and commissioning of submersible pumps with motor protection.',
    quantityDescription: '24 submersible pumps (7.5–30 kW) with rising mains',
    estimatedValue: '2150000.00',
    deliveryLocation: 'Serowe, Palapye and Mahalapye wellfields',
    deliveryDate: '2026-11-30',
    ownerUserId: USERS.tebogo,
    stage: 'awarded',
  }),
  lot(1, 2, {
    title: 'Solar pumping systems — Kgalagadi',
    description: 'Solar-powered pumping systems with 8 kWp arrays and security fencing.',
    quantityDescription: '12 solar pumping systems',
    estimatedValue: '1600000.00',
    deliveryLocation: 'Tsabong and Hukuntsi boreholes',
    deliveryDate: '2027-01-29',
    ownerUserId: USERS.tebogo,
    stage: 'cancelled',
    outcomeReason: 'No compliant bid was received; a re-tender is planned for Q1 2027.',
  }),
  lot(1, 3, {
    title: 'Pump controls and telemetry panels',
    description: 'Variable-speed control panels with telemetry interfaces to the SCADA system.',
    quantityDescription: '36 control panels',
    estimatedValue: '1100000.00',
    deliveryLocation: 'Central District wellfields',
    deliveryDate: '2027-02-26',
    ownerUserId: USERS.mpho,
    stage: 'under_assessment',
  }),
  lot(5, 1, {
    title: 'Aluminium sulphate (granular)',
    description: 'Granular aluminium sulphate, Al2O3 of at least 17 %, in 50 kg bags on pallets.',
    quantityDescription: '1,800 t over three years (call-off orders of 20–40 t)',
    estimatedValue: '780000.00',
    deliveryLocation: 'Mmamashia, Gaborone, Letsibogo, Mambo and Nnywane treatment works',
    deliveryDate: null,
    ownerUserId: USERS.tebogo,
    stage: 'draft',
  }),
  lot(5, 2, {
    title: 'Calcium hypochlorite (HTH granules)',
    description: 'Calcium hypochlorite granules, 65–70 % available chlorine, in 45 kg drums.',
    quantityDescription: '240 t over three years',
    estimatedValue: '670000.00',
    deliveryLocation: 'Mmamashia, Gaborone, Letsibogo, Mambo and Nnywane treatment works',
    deliveryDate: null,
    ownerUserId: USERS.amantle,
    stage: 'draft',
  }),
  lot(5, 3, {
    title: 'Polyelectrolyte flocculant',
    description: 'Cationic polyelectrolyte for sludge thickening; added in revision 3.',
    quantityDescription: '60 t over three years',
    estimatedValue: '470000.00',
    deliveryLocation: 'Mmamashia and Letsibogo treatment works',
    deliveryDate: null,
    ownerUserId: USERS.tebogo,
    stage: 'draft',
  }),
  lot(8, 1, {
    title: 'Gate and butterfly valves (DN100–DN600)',
    description: 'Resilient-seated gate valves and double-flanged butterfly valves, PN16.',
    quantityDescription: '310 valves in 14 sizes',
    estimatedValue: '1650000.00',
    deliveryLocation: 'KWU central stores, Gaborone',
    deliveryDate: '2026-12-15',
    ownerUserId: USERS.tebogo,
    stage: 'closed',
  }),
  lot(8, 2, {
    title: 'Air-release valves',
    description: 'Double-orifice air-release valves with isolating valves.',
    quantityDescription: '120 valves',
    estimatedValue: '700000.00',
    deliveryLocation: 'KWU central stores, Gaborone',
    deliveryDate: '2026-12-15',
    ownerUserId: USERS.tebogo,
    stage: 'closed',
  }),
  lot(12, 1, {
    title: 'MV/LV switchgear and motors',
    description: 'Preventive maintenance of 11 kV and 400 V switchgear, motor control centres and pump motors.',
    quantityDescription: 'Four treatment works, quarterly visits',
    estimatedValue: '520000.00',
    deliveryLocation: 'Mmamashia, Gaborone, Letsibogo and Mambo treatment works',
    deliveryDate: null,
    ownerUserId: USERS.tebogo,
    stage: 'draft',
  }),
  lot(12, 2, {
    title: 'Standby generators',
    description: 'Servicing and load testing of standby diesel generators (250–1,000 kVA).',
    quantityDescription: '11 generators, monthly load tests',
    estimatedValue: '260000.00',
    deliveryLocation: 'Four treatment works',
    deliveryDate: null,
    ownerUserId: null,
    stage: 'draft',
  }),
  lot(11, 1, {
    tenantId: ODC,
    title: 'Council headquarters, Maun',
    description: 'Daily cleaning and hygiene services at the council headquarters in Maun.',
    quantityDescription: 'Daily cleaning, 12 months',
    estimatedValue: '260000.00',
    deliveryLocation: 'Maun',
    deliveryDate: null,
    ownerUserId: USERS.officerOdc,
    stage: 'open',
  }),
  lot(11, 2, {
    tenantId: ODC,
    title: 'District clinics',
    description: 'Daily cleaning and hygiene services at the district clinics in Maun and Shakawe.',
    quantityDescription: 'Daily cleaning, 12 months',
    estimatedValue: '160000.00',
    deliveryLocation: 'Maun and Shakawe',
    deliveryDate: null,
    ownerUserId: USERS.officerOdc,
    stage: 'open',
  }),
  lot(14, 1, {
    title: 'Flow meters',
    description: 'Electromagnetic flow meters for raw and treated water mains.',
    quantityDescription: '18 flow meters DN150–DN600',
    estimatedValue: '820000.00',
    deliveryLocation: 'Mmamashia, Letsibogo, Masama and Shashe treatment works',
    deliveryDate: '2027-02-26',
    ownerUserId: USERS.tebogo,
    stage: 'under_assessment',
  }),
  lot(14, 2, {
    title: 'Online water-quality analysers',
    description: 'Turbidity, free chlorine and pH analysers with data loggers.',
    quantityDescription: '24 analysers',
    estimatedValue: '760000.00',
    deliveryLocation: 'Mmamashia, Letsibogo, Masama and Shashe treatment works',
    deliveryDate: '2027-02-26',
    ownerUserId: USERS.tebogo,
    stage: 'under_assessment',
  }),
  lot(14, 3, {
    title: 'Level sensors',
    description: 'Radar level sensors for reservoirs and clear-water tanks.',
    quantityDescription: '30 level sensors',
    estimatedValue: '410000.00',
    deliveryLocation: 'Mmamashia, Letsibogo, Masama and Shashe treatment works',
    deliveryDate: '2027-02-26',
    ownerUserId: USERS.tebogo,
    stage: 'under_assessment',
  }),
  lot(14, 4, {
    title: 'Pressure transmitters',
    description: 'Pressure transmitters for pump stations and distribution mains.',
    quantityDescription: '40 pressure transmitters',
    estimatedValue: '380000.00',
    deliveryLocation: 'Mmamashia, Letsibogo, Masama and Shashe treatment works',
    deliveryDate: '2027-02-26',
    ownerUserId: USERS.tebogo,
    stage: 'under_assessment',
  }),
  lot(14, 5, {
    title: 'Chlorine dosing controllers',
    description: 'Residual-based chlorine dosing controllers with remote alarms.',
    quantityDescription: '8 dosing controllers',
    estimatedValue: '1280000.00',
    deliveryLocation: 'Mmamashia, Letsibogo, Masama and Shashe treatment works',
    deliveryDate: '2027-02-26',
    ownerUserId: USERS.tebogo,
    stage: 'under_assessment',
  }),
]);

// ---------------------------------------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------------------------------------

type TeamSpec = readonly [userId: number, role: FxTeamMember['teamRole'], assignedAt: string];

function team(tenderId: number, specs: readonly TeamSpec[], tenantId: number = KWU, assignedBy: number = USERS.tebogo): FxTeamMember[] {
  return specs.map(([userId, teamRole, assignedAt], index) => ({
    id: tenderId * 100 + index + 1,
    tenantId,
    tenderId,
    lotId: null,
    userId,
    teamRole,
    assignedBy: teamRole === 'owner' ? USERS.mpho : assignedBy,
    assignedAt,
    removedAt: null,
    removalReason: null,
    conflictReviewPending: false,
  }));
}

export const TEAM_MEMBERS: readonly FxTeamMember[] = Object.freeze([
  ...team(1, [
    [USERS.tebogo, 'owner', '2026-05-18T08:30:00Z'],
    [USERS.mpho, 'officer', '2026-05-18T08:40:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-05-25T09:00:00Z'],
    [USERS.thato, 'evaluator', '2026-05-25T09:05:00Z'],
    [USERS.kabo, 'evaluator', '2026-05-25T09:06:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-05-25T09:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-05-25T09:12:00Z'],
    [USERS.goitse, 'witness', '2026-05-25T09:13:00Z'],
    [USERS.dineo, 'legal_reviewer', '2026-05-26T10:00:00Z'],
    [USERS.lesego, 'finance_reviewer', '2026-05-26T10:05:00Z'],
  ]),
  ...team(2, [
    [USERS.tebogo, 'owner', '2026-08-24T09:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-08-31T08:00:00Z'],
    [USERS.kabo, 'evaluator', '2026-08-31T08:05:00Z'],
    [USERS.amantle, 'evaluator', '2026-08-31T08:06:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-08-31T08:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-08-31T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-08-31T08:13:00Z'],
  ]),
  ...team(3, [
    [USERS.tebogo, 'owner', '2026-06-22T10:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-06-29T08:00:00Z'],
    [USERS.thato, 'evaluator', '2026-06-29T08:05:00Z'],
    [USERS.kabo, 'evaluator', '2026-06-29T08:06:00Z'],
    [USERS.amantle, 'evaluator', '2026-06-29T08:07:00Z'],
    [USERS.sam, 'evaluator', '2026-06-29T08:08:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-06-29T08:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-06-29T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-06-29T08:13:00Z'],
    [USERS.lesego, 'finance_reviewer', '2026-06-29T08:15:00Z'],
  ]).map((member) => (member.userId === USERS.sam ? { ...member, conflictReviewPending: true } : member)),
  ...team(4, [
    [USERS.tebogo, 'owner', '2026-04-20T08:00:00Z'],
    [USERS.kabo, 'observer', '2026-04-20T08:10:00Z'],
  ]),
  ...team(5, [
    [USERS.tebogo, 'owner', '2026-09-07T08:10:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-09-10T08:00:00Z'],
    [USERS.amantle, 'evaluator', '2026-09-10T08:05:00Z'],
    [USERS.thato, 'evaluator', '2026-09-10T08:06:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-09-10T08:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-09-10T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-09-10T08:13:00Z'],
    [USERS.dineo, 'legal_reviewer', '2026-09-11T09:00:00Z'],
    [USERS.lesego, 'finance_reviewer', '2026-09-11T09:05:00Z'],
  ]),
  ...team(6, [
    [USERS.tebogo, 'owner', '2026-09-01T08:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-09-08T08:00:00Z'],
    [USERS.amantle, 'evaluator', '2026-09-08T08:05:00Z'],
    [USERS.kabo, 'evaluator', '2026-09-08T08:06:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-09-08T08:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-09-08T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-09-08T08:13:00Z'],
  ]),
  ...team(7, [
    [USERS.tebogo, 'owner', '2026-04-06T08:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-04-13T08:00:00Z'],
    [USERS.thato, 'evaluator', '2026-04-13T08:05:00Z'],
    [USERS.kabo, 'evaluator', '2026-04-13T08:06:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-04-13T08:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-04-13T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-04-13T08:13:00Z'],
    [USERS.dineo, 'legal_reviewer', '2026-04-14T09:00:00Z'],
    [USERS.keabetswe, 'observer', '2026-09-01T08:00:00Z'],
  ]),
  ...team(8, [
    [USERS.tebogo, 'owner', '2026-07-27T09:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-08-03T08:00:00Z'],
    [USERS.kabo, 'evaluator', '2026-08-03T08:05:00Z'],
    [USERS.thato, 'evaluator', '2026-08-03T08:06:00Z'],
    [USERS.oratile, 'opening_officer', '2026-08-03T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-08-03T08:13:00Z'],
  ]),
  ...team(9, [
    [USERS.tebogo, 'owner', '2026-06-15T08:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-06-22T08:00:00Z'],
    [USERS.kabo, 'evaluator', '2026-06-22T08:05:00Z'],
    [USERS.amantle, 'evaluator', '2026-06-22T08:06:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-06-22T08:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-06-22T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-06-22T08:13:00Z'],
    [USERS.dineo, 'legal_reviewer', '2026-06-23T09:00:00Z'],
    [USERS.lesego, 'finance_reviewer', '2026-06-23T09:05:00Z'],
  ]),
  // T-2026-0010: the departed officer created and owned it; ownership moved to Tebogo (AC-04 history).
  {
    id: 1000,
    tenantId: KWU,
    tenderId: 10,
    lotId: null,
    userId: USERS.former,
    teamRole: 'owner',
    assignedBy: USERS.mpho,
    assignedAt: '2026-02-09T08:00:00Z',
    removedAt: '2026-07-31T16:00:00Z',
    removalReason: 'Left the organization; ownership transferred to Tebogo Molefe.',
    conflictReviewPending: false,
  },
  ...team(10, [
    [USERS.tebogo, 'owner', '2026-08-01T09:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-02-16T08:00:00Z'],
    [USERS.thato, 'evaluator', '2026-02-16T08:05:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-02-16T08:10:00Z'],
    [USERS.oratile, 'opening_officer', '2026-02-16T08:12:00Z'],
    [USERS.goitse, 'witness', '2026-02-16T08:13:00Z'],
  ]),
  ...team(11, [[USERS.officerOdc, 'owner', '2026-08-31T08:00:00Z']], ODC, USERS.officerOdc).map((member) => ({
    ...member,
    assignedBy: USERS.officerOdc,
  })),
  ...team(13, [[USERS.officerOdc, 'owner', '2026-09-08T08:00:00Z']], ODC, USERS.officerOdc).map((member) => ({
    ...member,
    assignedBy: USERS.officerOdc,
  })),
  ...team(14, [
    [USERS.tebogo, 'owner', '2026-06-22T08:00:00Z'],
    [USERS.boitumelo, 'evaluation_chair', '2026-06-29T08:00:00Z'],
    [USERS.thato, 'evaluator', '2026-06-29T08:05:00Z'],
    [USERS.kabo, 'evaluator', '2026-06-29T08:06:00Z'],
    [USERS.refilwe, 'commercial_reviewer', '2026-06-29T08:10:00Z'],
    [USERS.lesego, 'finance_reviewer', '2026-06-29T08:12:00Z'],
    [USERS.oratile, 'opening_officer', '2026-06-29T08:14:00Z'],
    [USERS.goitse, 'witness', '2026-06-29T08:15:00Z'],
  ]),
  ...team(12, [
    [USERS.tebogo, 'owner', '2026-09-22T08:45:00Z'],
    [USERS.thato, 'evaluator', '2026-09-24T10:00:00Z'],
  ]),
]);

// ---------------------------------------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------------------------------------

type RequirementSpec = Partial<Omit<FxRequirement, 'id' | 'tenderId' | 'section' | 'refCode' | 'text'>>;

function req(tenderId: number, n: number, section: string, refCode: string, text: string, spec: RequirementSpec = {}): FxRequirement {
  return {
    id: tenderId * 1000 + n,
    tenantId: KWU,
    tenderId,
    lotId: null,
    section,
    refCode,
    text,
    ownerUserId: USERS.tebogo,
    applicability: null,
    responseType: 'document',
    choices: [],
    responseInstructions: null,
    evidenceRequired: null,
    treatment: 'mandatory_gate',
    envelope: 'qualification',
    missingConsequence: 'reject',
    criterionId: null,
    sortOrder: n * 10,
    ...spec,
  };
}

const Q = 'Qualification';
const T = 'Technical';
const C = 'Commercial';
const REGISTRATION = 'Valid company registration and tax clearance certificate';
const REGISTRATION_EVIDENCE = 'CIPA registration certificate and BURS tax clearance valid at the submission deadline';

function rated(criterionId: number, spec: RequirementSpec = {}): RequirementSpec {
  return { treatment: 'rated', envelope: 'technical', missingConsequence: 'clarify', criterionId, ...spec };
}

const PRICING: RequirementSpec = {
  envelope: 'commercial',
  evidenceRequired: 'The completed pricing schedule workbook of the package',
  responseInstructions: 'Use the pricing schedule of the package; do not change quantities or units.',
};

export const REQUIREMENTS: readonly FxRequirement[] = Object.freeze([
  // T-2026-0001
  req(1, 1, Q, 'REQ-Q-01', REGISTRATION, { evidenceRequired: REGISTRATION_EVIDENCE }),
  req(1, 2, Q, 'REQ-Q-02', 'Qualification in the WTR-PUMP category, or an application decided before award', {
    missingConsequence: 'clarify',
    evidenceRequired: 'Qualification decision or application reference',
  }),
  req(1, 3, T, 'REQ-T-01', 'Pump performance curves at the specified duty points', rated(1501, { lotId: 101, applicability: 'Each pump size offered' })),
  req(1, 4, T, 'REQ-T-02', 'Solar array sizing calculation for each site', rated(1501, { lotId: 102, applicability: 'Each site where a solar pumping system is offered' })),
  req(
    1,
    5,
    T,
    'REQ-T-03',
    'Telemetry protocol supported by the control panels',
    rated(1501, { lotId: 103, applicability: null, responseType: 'choice', choices: ['Modbus TCP', 'DNP3', 'Both'] }),
  ),
  req(1, 6, T, 'REQ-T-04', 'Installation and commissioning programme', rated(1502, { responseType: 'text', ownerUserId: USERS.mpho })),
  req(1, 7, T, 'REQ-T-05', 'After-sales service centre within 200 km of the sites', rated(1503, { responseType: 'yes_no', missingConsequence: 'warning' })),
  req(1, 8, C, 'REQ-C-01', 'Completed pricing schedule for each lot bid', PRICING),
  // T-2026-0002
  req(2, 1, Q, 'REQ-Q-01', REGISTRATION, { evidenceRequired: REGISTRATION_EVIDENCE }),
  req(2, 2, T, 'REQ-T-01', 'Meter accuracy class R400 type approval (ISO 4064)', {
    envelope: 'technical',
    evidenceRequired: 'ISO 4064 type-approval certificate',
    ownerUserId: USERS.kabo,
  }),
  req(2, 3, T, 'REQ-T-02', 'Rated battery life of the AMR module (years)', rated(2501, { responseType: 'number', ownerUserId: USERS.kabo })),
  req(2, 4, T, 'REQ-T-03', 'Delivery schedule for the two consignments', rated(2502, { responseType: 'text' })),
  req(2, 5, 'Technical (addendum 1)', 'REQ-T-04', 'Data security declaration for the AMR head-end system', {
    envelope: 'technical',
    evidenceRequired: 'Signed declaration on the addendum 1 form',
    ownerUserId: USERS.kabo,
  }),
  req(2, 6, C, 'REQ-C-01', 'Completed pricing schedule', PRICING),
  // T-2026-0003
  req(3, 1, Q, 'REQ-Q-01', REGISTRATION, { evidenceRequired: REGISTRATION_EVIDENCE }),
  req(3, 2, Q, 'REQ-Q-02', 'Two completed SCADA projects for a water utility in the last five years', {
    missingConsequence: 'clarify',
    evidenceRequired: 'Completion certificates or client letters',
  }),
  req(3, 3, Q, 'REQ-Q-03', 'ISO 9001 quality management certificate', {
    evidenceRequired: 'Valid ISO 9001:2015 certificate issued by an accredited certification body',
  }),
  req(3, 4, T, 'REQ-T-01', 'Solution architecture and RTU specification', rated(3501, { ownerUserId: USERS.thato })),
  req(3, 5, T, 'REQ-T-02', 'Implementation approach and programme', rated(3502, { responseType: 'text', ownerUserId: USERS.kabo })),
  req(3, 6, T, 'REQ-T-03', 'Reference projects and key personnel CVs', rated(3503, { ownerUserId: USERS.thato })),
  req(3, 7, T, 'REQ-T-04', 'Cybersecurity design aligned with IEC 62443', rated(3501, { responseType: 'text', ownerUserId: USERS.thato })),
  req(3, 8, C, 'REQ-C-01', 'Priced bill of quantities including five years of support', PRICING),
  // T-2026-0004 (RFI)
  req(4, 1, 'Market information', 'REQ-I-01', 'Describe your leak-detection methods and typical detection rates', {
    responseType: 'text',
    treatment: 'information_only',
    envelope: 'technical',
    missingConsequence: 'warning',
    ownerUserId: USERS.kabo,
  }),
  req(4, 2, 'Market information', 'REQ-I-02', 'Indicative pricing model', {
    responseType: 'choice',
    choices: ['Per km surveyed', 'Per leak found', 'Fixed monthly fee', 'Other'],
    treatment: 'information_only',
    envelope: 'commercial',
    missingConsequence: 'warning',
  }),
  req(4, 3, 'Market information', 'REQ-I-03', 'Utilities you have served in the last three years', {
    responseType: 'text',
    treatment: 'information_only',
    envelope: 'technical',
    missingConsequence: 'warning',
    ownerUserId: USERS.kabo,
  }),
  // T-2026-0005 (AC-06)
  req(5, 1, Q, 'REQ-Q-01', REGISTRATION, { evidenceRequired: REGISTRATION_EVIDENCE }),
  req(5, 2, Q, 'REQ-Q-02', 'SABS or BOBS product certification for each chemical offered', {
    evidenceRequired: 'Product certificates valid at the submission deadline',
    ownerUserId: USERS.amantle,
  }),
  req(5, 3, Q, 'REQ-Q-03', 'Safety data sheets (GHS format) for each product', {
    missingConsequence: 'clarify',
    evidenceRequired: 'Current GHS safety data sheets',
    ownerUserId: USERS.amantle,
  }),
  req(5, 4, T, 'REQ-T-01', 'Aluminium sulphate meets the specification (Al2O3 of at least 17 %)', {
    lotId: 501,
    applicability: 'Each source of supply offered, including imported product',
    responseType: 'yes_no',
    envelope: 'technical',
    ownerUserId: USERS.amantle,
  }),
  req(
    5,
    5,
    T,
    'REQ-T-02',
    'Calcium hypochlorite available chlorine (65–70 %) and storage requirements',
    rated(5501, { lotId: 502, applicability: 'Where the bidder holds stock in Botswana', ownerUserId: USERS.amantle }),
  ),
  req(
    5,
    6,
    T,
    'REQ-T-03',
    'Polyelectrolyte jar-test results on KWU raw water samples',
    rated(5501, { lotId: 503, applicability: null }),
  ),
  req(5, 7, T, 'REQ-T-04', 'Supply capacity, stockholding and delivery lead times', rated(5502, { responseType: 'text' })),
  req(5, 8, T, 'REQ-T-05', 'SHEQ management system and dangerous-goods transport', rated(5503, { ownerUserId: USERS.amantle })),
  req(5, 9, C, 'REQ-C-01', 'Completed pricing schedule for each lot bid', PRICING),
  req(5, 10, C, 'REQ-C-02', 'Acceptance of the price adjustment formula for years two and three', {
    envelope: 'commercial',
    responseType: 'yes_no',
    missingConsequence: 'clarify',
    ownerUserId: USERS.lesego,
  }),
  // T-2026-0006
  req(6, 1, Q, 'REQ-Q-01', 'Invitation acceptance and signed confidentiality undertaking', {
    evidenceRequired: 'Signed undertaking on the KWU form',
  }),
  req(6, 2, T, 'REQ-T-01', 'Chlorinator capacity at each site (kg/h)', rated(6501, { responseType: 'number', ownerUserId: USERS.amantle })),
  req(6, 3, T, 'REQ-T-02', 'Installation programme and shutdown plan', rated(6502, { responseType: 'text' })),
  req(6, 4, C, 'REQ-C-01', 'Completed pricing schedule', PRICING),
  // T-2026-0007
  req(7, 1, Q, 'REQ-Q-01', 'PPADB registration in civil works grade E or above', { evidenceRequired: 'PPADB registration certificate' }),
  req(7, 2, Q, 'REQ-Q-02', 'Attendance at the mandatory site briefing', { responseType: 'yes_no' }),
  req(7, 3, T, 'REQ-T-01', 'Method statement for relining and roof replacement', rated(7501, { ownerUserId: USERS.thato })),
  req(7, 4, T, 'REQ-T-02', 'CVs of the site agent and structural engineer', rated(7502)),
  req(7, 5, C, 'REQ-C-01', 'Priced bill of quantities', PRICING),
  req(7, 6, C, 'REQ-C-02', 'Undertaking to provide a 10 % performance security', { envelope: 'commercial', responseType: 'yes_no' }),
  // T-2026-0008
  req(8, 1, Q, 'REQ-Q-01', REGISTRATION, { evidenceRequired: REGISTRATION_EVIDENCE }),
  req(8, 2, T, 'REQ-T-01', 'PN16 pressure test certificates', {
    lotId: 801,
    applicability: 'Each valve size offered',
    envelope: 'technical',
    evidenceRequired: 'Factory test certificates to EN 12266-1',
    ownerUserId: USERS.kabo,
  }),
  req(8, 3, T, 'REQ-T-02', 'Air-release valve performance data', rated(8501, { lotId: 802, applicability: null, ownerUserId: USERS.kabo })),
  req(8, 4, T, 'REQ-T-03', 'Delivery schedule', rated(8502, { responseType: 'text' })),
  req(8, 5, C, 'REQ-C-01', 'Completed pricing schedule for each lot bid', PRICING),
  // T-2026-0009
  req(9, 1, Q, 'REQ-Q-01', 'Financial standing: audited statements for the last three years', {
    evidenceRequired: 'Audited financial statements 2023–2025',
    ownerUserId: USERS.lesego,
  }),
  req(9, 2, T, 'REQ-T-01', 'Survey approach and productivity (km per day)', rated(9501, { responseType: 'text', ownerUserId: USERS.kabo })),
  req(9, 3, T, 'REQ-T-02', 'Correlator and listening equipment specification', rated(9505, { ownerUserId: USERS.kabo })),
  req(9, 4, T, 'REQ-T-03', 'Data platform and reporting', rated(9506, { responseType: 'text', ownerUserId: USERS.amantle })),
  req(9, 5, T, 'REQ-T-04', 'Team experience', rated(9503)),
  req(9, 6, C, 'REQ-C-01', 'Rates per km surveyed and per confirmed leak', PRICING),
  // T-2026-0010
  req(10, 1, Q, 'REQ-Q-01', 'Workshop accreditation by the Motor Trade Association', { evidenceRequired: 'MTA accreditation certificate' }),
  req(10, 2, T, 'REQ-T-01', 'Service capability for light and heavy vehicles', rated(10501, { responseType: 'text' })),
  req(10, 3, T, 'REQ-T-02', 'Guaranteed turnaround time for scheduled services (hours)', rated(10502, { responseType: 'number' })),
  req(10, 4, C, 'REQ-C-01', 'Monthly service fee schedule', PRICING),
  // T-2026-0011 (ODC)
  ...[
    req(11, 1, Q, 'REQ-Q-01', REGISTRATION, { evidenceRequired: REGISTRATION_EVIDENCE }),
    req(11, 2, T, 'REQ-T-01', 'Cleaning methodology and schedule', rated(11501, { responseType: 'text' })),
    req(11, 3, T, 'REQ-T-02', 'Staffing plan and supervision', rated(11502, { responseType: 'text' })),
    req(11, 4, C, 'REQ-C-01', 'Monthly price schedule', PRICING),
  ].map((row) => ({ ...row, tenantId: ODC, ownerUserId: USERS.officerOdc })),
  // T-2026-0012 (authoring warnings)
  req(12, 1, Q, 'REQ-Q-01', 'Electrical contractor licence issued by BERA', { evidenceRequired: 'Current BERA licence' }),
  req(12, 2, Q, 'REQ-Q-02', 'Public liability insurance of at least BWP 5 million', {
    ownerUserId: null,
    missingConsequence: 'warning',
    evidenceRequired: 'Insurance certificate',
  }),
  req(12, 3, T, 'REQ-T-01', 'Maintenance methodology for MV switchgear', rated(12502, { lotId: 1201, applicability: null, responseType: 'text' })),
  req(12, 4, T, 'REQ-T-02', 'OEM authorization for generator servicing', {
    lotId: 1202,
    applicability: 'Bidders who are not the manufacturer (distributors and service agents)',
    ownerUserId: null,
    treatment: 'rated',
    envelope: 'technical',
    missingConsequence: 'clarify',
  }),
  req(12, 5, T, 'REQ-T-03', 'Emergency call-out response time (hours)', {
    responseType: 'number',
    treatment: 'information_only',
    envelope: 'technical',
    ownerUserId: USERS.thato,
  }),
  req(12, 6, T, 'REQ-T-04', 'Preferred emergency contact channel', {
    responseType: 'choice',
    choices: ['Phone'],
    treatment: 'information_only',
    envelope: 'technical',
    missingConsequence: 'warning',
  }),
  req(12, 7, C, 'REQ-C-01', 'Monthly maintenance fee and call-out rates', PRICING),
]);
