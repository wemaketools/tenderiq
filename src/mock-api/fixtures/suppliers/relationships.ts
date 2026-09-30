/**
 * Buyer-side supplier records (BUY-31, BUY-32): relationships (`buyer_supplier_relationships` [R]), contacts
 * (`relationship_contacts` [R]), relationship history, the buyer's qualification standing per supplier (a projection
 * of `v_qualification_status`, DD-13) and the buyer's contracts with the supplier.
 *
 * Each row carries the buyer `tenantId`. KWU and ODC hold DIFFERENT assessments of the same suppliers (for example
 * Makgadikgadi is `prospective` at KWU and `suspended` at ODC), which proves the BR-45 segregation on screen.
 *
 * Qualification standing mirrors the qualification domain's decisions (`src/mock-api/fixtures/qualification/**`,
 * which owns them): KWU program 11 "Water Infrastructure Suppliers — Category A" (WTR-INFRA) has Tsodilo qualified
 * for WTR-PUMP and Chobe qualified with conditions for WTR-PIPE (insurance expiring 2026-10-08, AC-09); Makgadikgadi
 * is registered but not assessed, its application QA-2026-0006 awaiting more information (AC-07, AC-08). Serowe is
 * qualified under the ICT program 12, Gaborone Metering's metering decision expired on 2026-08-31, and Limpopo is
 * suspended under program 14. At ODC, Limpopo is qualified under program 21. Only decisions and applications in
 * progress appear (a draft application is never visible to a buyer).
 *
 * Contracts and performance are NOT kept here: `RELATIONSHIP_CONTRACTS` is derived from the contracts domain
 * (`src/mock-api/fixtures/contracts/**`, which owns `contracts` and `performance_reviews`), with the same ids,
 * references, titles and statuses, and the latest performance review with an outcome per contract.
 */
import type {
  BuyerSupplierRelationshipsRiskRating,
  BuyerSupplierRelationshipsStatus,
  ContractsStatus,
  PerformanceReviewsOverallRating,
  PerformanceReviewsStatus,
  VQualificationStatusEffectiveStatus,
} from '../../../contracts/enums.js';
import type { NonNegativeMoney } from '../../../contracts/common.js';
import type { RelationshipEvent } from '../../../contracts/suppliers.js';
import { CONTRACTS, CONTRACT_REVIEWS } from '../contracts/index.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureRelationship {
  readonly id: number;
  /** Buyer tenant. */
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly status: BuyerSupplierRelationshipsStatus;
  readonly riskRating: BuyerSupplierRelationshipsRiskRating;
  readonly ownerUserId: number | null;
  readonly restrictionNote: string | null;
  readonly internalNotes: string | null;
  readonly firstEngagedAt: string | null;
  readonly updatedAt: string;
}

export interface FixtureRelationshipContact {
  readonly id: number;
  readonly tenantId: number;
  readonly relationshipId: number;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly roleLabel: string | null;
  readonly isPrimary: boolean;
  readonly active: boolean;
}

export interface FixtureRelationshipEvent {
  readonly id: number;
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly at: string;
  readonly eventType: RelationshipEvent['eventType'];
  readonly summary: string;
  readonly actorUserId: number | null;
}

export interface FixtureQualificationProgram {
  readonly programId: number;
  readonly tenantId: number;
  readonly name: string;
  readonly categoryCode: string | null;
  readonly status: 'draft' | 'active' | 'retired';
}

export interface FixtureQualificationStanding {
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly programId: number;
  readonly effectiveStatus: VQualificationStatusEffectiveStatus;
  readonly scopeCategoryCode: string | null;
  readonly scopeMaxValue: NonNegativeMoney | null;
  readonly scopeGeography: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly conditions: string | null;
  /** An application in progress (submitted … decision_pending) for this program. */
  readonly applicationInProgress: string | null;
}

export interface FixtureContractPerformance {
  readonly reviewId: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: PerformanceReviewsStatus;
  readonly overallRating: PerformanceReviewsOverallRating;
  readonly supplierResponded: boolean;
  readonly supplierDisputes: boolean;
  readonly reviewCount: number;
}

export interface FixtureRelationshipContract {
  readonly tenantId: number;
  readonly supplierTenantId: number;
  readonly contractId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: ContractsStatus;
  readonly performance: FixtureContractPerformance | null;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;
const TSODILO = TENANT_IDS.tsodilo;
const CHOBE = TENANT_IDS['chobe-pipe'];
const MAKGADIKGADI = TENANT_IDS.makgadikgadi;
const SEROWE = TENANT_IDS['serowe-ict'];
const LIMPOPO = TENANT_IDS['limpopo-env'];
const GABORONE_METER = TENANT_IDS['gaborone-meter'];

/** Persona user ids used as relationship owners and actors. */
const MPHO = 4;
const TEBOGO = 5;
const NEO = 8;
const LESEGO = 9;
const KEFILWE = 23;

export const RELATIONSHIPS: readonly FixtureRelationship[] = Object.freeze([
  { id: 1, tenantId: KWU, supplierTenantId: TSODILO, status: 'active', riskRating: 'low', ownerUserId: TEBOGO, restrictionNote: null, internalNotes: 'Delivered Lot 1 of the borehole pump programme on schedule; keep on the watch list for the SCADA upgrade.', firstEngagedAt: '2025-09-15T08:00:00Z', updatedAt: '2026-08-28T10:00:00Z' },
  { id: 2, tenantId: KWU, supplierTenantId: CHOBE, status: 'active', riskRating: 'medium', ownerUserId: TEBOGO, restrictionNote: null, internalNotes: 'Qualified with conditions: public liability renewal due 8 Oct 2026. Chase the renewal before evaluating T-2026-0002.', firstEngagedAt: '2026-02-18T09:00:00Z', updatedAt: '2026-09-29T07:30:00Z' },
  { id: 3, tenantId: KWU, supplierTenantId: MAKGADIKGADI, status: 'prospective', riskRating: 'not_assessed', ownerUserId: NEO, restrictionNote: null, internalNotes: 'Registered on the platform; qualification application QA-2026-0006 awaits clarified financial evidence.', firstEngagedAt: '2026-04-03T08:00:00Z', updatedAt: '2026-09-02T11:00:00Z' },
  { id: 4, tenantId: KWU, supplierTenantId: SEROWE, status: 'active', riskRating: 'low', ownerUserId: MPHO, restrictionNote: null, internalNotes: 'Strong SCADA references. Representation transfer under platform review.', firstEngagedAt: '2025-12-15T08:00:00Z', updatedAt: '2026-09-12T09:00:00Z' },
  { id: 5, tenantId: KWU, supplierTenantId: LIMPOPO, status: 'active', riskRating: 'medium', ownerUserId: TEBOGO, restrictionNote: null, internalNotes: 'Qualification suspended after the waste management licence lapsed. The complaint on T-2026-0007 is handled by the complaint case owner.', firstEngagedAt: '2025-11-20T08:00:00Z', updatedAt: '2026-09-18T14:00:00Z' },
  { id: 6, tenantId: KWU, supplierTenantId: GABORONE_METER, status: 'restricted', riskRating: 'high', ownerUserId: MPHO, restrictionNote: 'Metering qualification expired on 31 Aug 2026. No new invitations above BWP 500,000 until requalified (renewal application QA-2026-0008 is with the assessor).', internalNotes: 'Legacy meter reading contract C-2025-0007 expired; warranty obligation still open.', firstEngagedAt: '2024-07-01T08:00:00Z', updatedAt: '2026-09-22T12:00:00Z' },
  { id: 7, tenantId: KWU, supplierTenantId: 50, status: 'prospective', riskRating: 'not_assessed', ownerUserId: TEBOGO, restrictionNote: null, internalNotes: 'Invited to register after the Kasane borehole market sounding.', firstEngagedAt: null, updatedAt: '2026-09-10T08:15:00Z' },
  { id: 8, tenantId: ODC, supplierTenantId: LIMPOPO, status: 'active', riskRating: 'low', ownerUserId: KEFILWE, restrictionNote: null, internalNotes: 'Environmental monitoring for the Maun landfill; good performance.', firstEngagedAt: '2026-04-20T08:00:00Z', updatedAt: '2026-07-12T08:10:00Z' },
  { id: 9, tenantId: ODC, supplierTenantId: MAKGADIKGADI, status: 'suspended', riskRating: 'high', ownerUserId: KEFILWE, restrictionNote: 'Site safety incident at the Maun depot on 12 Aug 2026; suspended from new council work pending the council investigation.', internalNotes: 'Investigation led by the council safety officer; review on 31 Oct 2026.', firstEngagedAt: '2026-04-01T09:00:00Z', updatedAt: '2026-08-14T09:00:00Z' },
  { id: 10, tenantId: ODC, supplierTenantId: 51, status: 'prospective', riskRating: 'not_assessed', ownerUserId: KEFILWE, restrictionNote: null, internalNotes: 'Local cleaning contractor invited for T-2026-0011.', firstEngagedAt: null, updatedAt: '2026-08-20T10:00:00Z' },
  { id: 11, tenantId: ODC, supplierTenantId: TSODILO, status: 'inactive', riskRating: 'low', ownerUserId: KEFILWE, restrictionNote: null, internalNotes: 'No council work since the 2025 borehole programme; applied to the roads and civil works program in Sep 2026 (QA-2026-0002).', firstEngagedAt: '2025-05-10T08:00:00Z', updatedAt: '2026-02-25T10:00:00Z' },
  { id: 12, tenantId: ODC, supplierTenantId: 53, status: 'prospective', riskRating: 'not_assessed', ownerUserId: KEFILWE, restrictionNote: null, internalNotes: 'Imported from the council vendor list; may be the same company as Chobe Pipe & Valve Supplies.', firstEngagedAt: null, updatedAt: '2026-07-14T09:00:00Z' },
  { id: 13, tenantId: ODC, supplierTenantId: CHOBE, status: 'active', riskRating: 'low', ownerUserId: KEFILWE, restrictionNote: null, internalNotes: null, firstEngagedAt: '2026-05-02T09:00:00Z', updatedAt: '2026-06-20T13:05:00Z' },
] satisfies FixtureRelationship[]);

export const RELATIONSHIP_CONTACTS: readonly FixtureRelationshipContact[] = Object.freeze([
  { id: 1, tenantId: KWU, relationshipId: 1, name: 'Tumelo Sekgoma', email: 'tumelo.sekgoma@tsodilo-engineering.example', phone: '+267 390 1101', roleLabel: 'Organization administrator', isPrimary: true, active: true },
  { id: 2, tenantId: KWU, relationshipId: 1, name: 'Boago Moremi', email: 'boago.moremi@tsodilo-engineering.example', phone: '+267 390 1102', roleLabel: 'Bid manager', isPrimary: false, active: true },
  { id: 3, tenantId: KWU, relationshipId: 2, name: 'Chedza Ramokate', email: 'chedza.ramokate@chobe-pipe.example', phone: '+267 625 0201', roleLabel: 'Organization administrator', isPrimary: true, active: true },
  { id: 4, tenantId: KWU, relationshipId: 2, name: 'Gorata Mphoeng', email: 'gorata.mphoeng@chobe-pipe.example', phone: '+267 625 0209', roleLabel: 'Managing director', isPrimary: false, active: true },
  { id: 5, tenantId: KWU, relationshipId: 3, name: 'Sethunya Makgadi', email: 'sethunya@botsmail.example', phone: '+267 297 0330', roleLabel: 'Owner', isPrimary: true, active: true },
  { id: 6, tenantId: KWU, relationshipId: 4, name: 'Otsile Serowe', email: 'otsile.serowe@serowe-ict.example', phone: '+267 463 0088', roleLabel: 'Bid manager', isPrimary: true, active: true },
  { id: 7, tenantId: KWU, relationshipId: 4, name: 'Tshepiso Khama', email: 'tshepiso.khama@serowe-ict.example', phone: '+267 463 0089', roleLabel: 'Managing director', isPrimary: false, active: true },
  { id: 8, tenantId: KWU, relationshipId: 5, name: 'Mothusi Limpopo', email: 'mothusi@botsmail.example', phone: '+267 261 5170', roleLabel: 'Principal consultant', isPrimary: true, active: true },
  { id: 9, tenantId: KWU, relationshipId: 6, name: 'Palesa Gabo', email: 'palesa.gabo@gaborone-meter.example', phone: '+267 391 2061', roleLabel: 'Organization administrator', isPrimary: true, active: true },
  { id: 10, tenantId: KWU, relationshipId: 6, name: 'Sipho Mothobi', email: 'sipho.mothobi@gaborone-meter.example', phone: null, roleLabel: 'Former administrator (left 30 Apr 2026)', isPrimary: false, active: false },
  { id: 11, tenantId: KWU, relationshipId: 7, name: 'Onkemetse Dube', email: 'onkemetse.dube@kasane-drilling.example', phone: '+267 625 1144', roleLabel: 'Director', isPrimary: true, active: true },
  { id: 12, tenantId: ODC, relationshipId: 8, name: 'Mothusi Limpopo', email: 'mothusi@botsmail.example', phone: '+267 686 0412', roleLabel: 'Council account lead', isPrimary: true, active: true },
  { id: 13, tenantId: ODC, relationshipId: 9, name: 'Sethunya Makgadi', email: 'sethunya@botsmail.example', phone: '+267 297 0330', roleLabel: 'Owner', isPrimary: true, active: true },
  { id: 14, tenantId: ODC, relationshipId: 10, name: 'Masego Tlhalefang', email: 'masego@maun-hygiene.example', phone: '+267 686 2201', roleLabel: 'Director', isPrimary: true, active: true },
  { id: 15, tenantId: ODC, relationshipId: 11, name: 'Tumelo Sekgoma', email: 'tumelo.sekgoma@tsodilo-engineering.example', phone: '+267 390 1101', roleLabel: 'Organization administrator', isPrimary: true, active: true },
  { id: 16, tenantId: ODC, relationshipId: 12, name: 'Kabelo Chobe', email: 'kabelo@chobe-valves-kasane.example', phone: '+267 625 3310', roleLabel: 'Sales', isPrimary: true, active: true },
  { id: 17, tenantId: ODC, relationshipId: 13, name: 'Bakang Chobe', email: 'bakang.chobe@chobe-pipe.example', phone: '+267 625 0203', roleLabel: 'Bid manager', isPrimary: true, active: true },
] satisfies FixtureRelationshipContact[]);

let nextEventId = 1;
function events(
  tenantId: number,
  supplierTenantId: number,
  entries: readonly (readonly [string, RelationshipEvent['eventType'], string, number | null])[],
): FixtureRelationshipEvent[] {
  return entries.map(([at, eventType, summary, actorUserId]) => ({ id: nextEventId++, tenantId, supplierTenantId, at, eventType, summary, actorUserId }));
}

export const RELATIONSHIP_EVENTS: readonly FixtureRelationshipEvent[] = Object.freeze([
  ...events(KWU, TSODILO, [
    ['2025-09-15T08:00:00Z', 'relationship_created', 'Relationship opened as prospective (imported with the 2025 qualification history).', TEBOGO],
    ['2026-03-20T10:00:00Z', 'status_changed', 'Status changed to active after qualification.', TEBOGO],
    ['2026-04-02T09:00:00Z', 'identity_change_reviewed', 'Legal name change to Tsodilo Engineering (Pty) Ltd reviewed; historic submissions keep the former name.', TEBOGO],
    ['2026-08-28T10:00:00Z', 'note', 'Lot 1 award accepted; contract C-2026-0002 in preparation.', TEBOGO],
  ]),
  ...events(KWU, CHOBE, [
    ['2026-02-18T09:00:00Z', 'relationship_created', 'Relationship opened as prospective.', TEBOGO],
    ['2026-04-02T12:00:00Z', 'status_changed', 'Status changed to active; qualified with conditions.', TEBOGO],
    ['2026-09-29T07:30:00Z', 'risk_changed', 'Risk raised to medium: public liability insurance expires on 8 Oct 2026.', TEBOGO],
  ]),
  ...events(KWU, MAKGADIKGADI, [
    ['2026-04-03T08:00:00Z', 'relationship_created', 'Relationship opened as prospective with the first tender response.', TEBOGO],
    ['2026-09-02T11:00:00Z', 'owner_changed', 'Owner set to Neo Mothibi (qualification assessor).', MPHO],
  ]),
  ...events(KWU, SEROWE, [
    ['2025-12-15T08:00:00Z', 'relationship_created', 'Relationship opened as prospective.', MPHO],
    ['2026-02-01T08:00:00Z', 'status_changed', 'Status changed to active after the ICT qualification decision.', MPHO],
    ['2026-08-05T10:20:00Z', 'duplicate_flagged', 'Possible duplicate flagged: a new registration uses the same registration number.', TEBOGO],
  ]),
  ...events(KWU, LIMPOPO, [
    ['2025-11-20T08:00:00Z', 'relationship_created', 'Relationship opened as active after the leak-detection consultation.', TEBOGO],
    ['2026-09-18T14:00:00Z', 'risk_changed', 'Risk set to medium: qualification suspended on 10 Sep 2026 after the waste management licence lapsed.', MPHO],
  ]),
  ...events(KWU, GABORONE_METER, [
    ['2024-07-01T08:00:00Z', 'relationship_created', 'Relationship opened as active (legacy supplier).', MPHO],
    ['2026-09-01T08:00:00Z', 'status_changed', 'Status changed to restricted: the metering qualification expired on 31 Aug 2026.', MPHO],
    ['2026-09-22T12:00:00Z', 'note', 'Renewal application QA-2026-0008 received; awaiting assessment.', LESEGO],
  ]),
  ...events(KWU, 50, [['2026-09-10T08:15:00Z', 'relationship_created', 'Provisional supplier record created and registration invitation sent.', TEBOGO]]),
  ...events(ODC, LIMPOPO, [['2026-04-20T08:00:00Z', 'relationship_created', 'Relationship opened as active.', KEFILWE]]),
  ...events(ODC, MAKGADIKGADI, [
    ['2026-04-01T09:00:00Z', 'relationship_created', 'Relationship opened as active.', KEFILWE],
    ['2026-08-14T09:00:00Z', 'status_changed', 'Suspended after the Maun depot safety incident.', KEFILWE],
  ]),
  ...events(ODC, 51, [['2026-08-20T10:00:00Z', 'relationship_created', 'Provisional supplier record created and registration invitation sent.', KEFILWE]]),
  ...events(ODC, TSODILO, [
    ['2025-05-10T08:00:00Z', 'relationship_created', 'Relationship recorded from the 2025 borehole programme.', KEFILWE],
    ['2026-02-25T10:00:00Z', 'status_changed', 'Status changed to inactive.', KEFILWE],
  ]),
  ...events(ODC, 53, [
    ['2026-07-14T09:00:00Z', 'relationship_created', 'Provisional record imported from the council vendor list.', KEFILWE],
    ['2026-07-14T09:05:00Z', 'duplicate_flagged', 'Possible duplicate of Chobe Pipe & Valve Supplies flagged for platform review.', KEFILWE],
  ]),
  ...events(ODC, CHOBE, [['2026-05-02T09:00:00Z', 'relationship_created', 'Relationship opened as active.', KEFILWE]]),
] satisfies FixtureRelationshipEvent[]);

export const QUALIFICATION_PROGRAMS: readonly FixtureQualificationProgram[] = Object.freeze([
  { programId: 11, tenantId: KWU, name: 'Water Infrastructure Suppliers — Category A', categoryCode: 'WTR-INFRA', status: 'active' },
  { programId: 12, tenantId: KWU, name: 'ICT and Telemetry Service Providers', categoryCode: 'ICT-SCADA', status: 'active' },
  { programId: 13, tenantId: KWU, name: 'Metering Equipment Suppliers', categoryCode: 'WTR-METER', status: 'active' },
  { programId: 14, tenantId: KWU, name: 'Environmental and Laboratory Services', categoryCode: 'ENV', status: 'active' },
  { programId: 15, tenantId: KWU, name: 'Civil Works Contractors (2024 panel)', categoryCode: 'CIV', status: 'retired' },
  { programId: 16, tenantId: KWU, name: 'Water Treatment Chemicals and Dosing', categoryCode: 'WTR-TREAT', status: 'draft' },
  { programId: 21, tenantId: ODC, name: 'Facilities and Cleaning Contractors', categoryCode: 'FAC-CLEAN', status: 'active' },
  { programId: 22, tenantId: ODC, name: 'Roads and Civil Works Contractors', categoryCode: 'CIV', status: 'active' },
] satisfies FixtureQualificationProgram[]);

const BWP = (amount: string): NonNegativeMoney => ({ amount, currency: 'BWP' });

const NOT_ASSESSED = {
  effectiveStatus: 'not_assessed',
  scopeCategoryCode: null,
  scopeMaxValue: null,
  scopeGeography: null,
  effectiveFrom: null,
  effectiveTo: null,
  conditions: null,
} as const;

export const QUALIFICATION_STANDINGS: readonly FixtureQualificationStanding[] = Object.freeze([
  { tenantId: KWU, supplierTenantId: TSODILO, programId: 11, effectiveStatus: 'qualified', scopeCategoryCode: 'WTR-PUMP', scopeMaxValue: BWP('8000000.00'), scopeGeography: 'Botswana', effectiveFrom: '2026-04-15', effectiveTo: '2028-04-14', conditions: null, applicationInProgress: null },
  { tenantId: KWU, supplierTenantId: TSODILO, programId: 12, ...NOT_ASSESSED, applicationInProgress: 'QA-2026-0009' },
  { tenantId: KWU, supplierTenantId: CHOBE, programId: 11, effectiveStatus: 'qualified_with_conditions', scopeCategoryCode: 'WTR-PIPE', scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana', effectiveFrom: '2026-05-04', effectiveTo: '2028-05-03', conditions: 'Public liability insurance of at least BWP 5,000,000 must stay in force; no award after 8 Oct 2026 until the renewed certificate is received.', applicationInProgress: 'QA-2026-0007' },
  { tenantId: KWU, supplierTenantId: MAKGADIKGADI, programId: 11, ...NOT_ASSESSED, applicationInProgress: 'QA-2026-0006' },
  { tenantId: KWU, supplierTenantId: SEROWE, programId: 12, effectiveStatus: 'qualified', scopeCategoryCode: 'ICT-SCADA', scopeMaxValue: BWP('5000000.00'), scopeGeography: 'Botswana', effectiveFrom: '2026-02-01', effectiveTo: '2029-01-31', conditions: null, applicationInProgress: null },
  { tenantId: KWU, supplierTenantId: SEROWE, programId: 13, ...NOT_ASSESSED, applicationInProgress: 'QA-2026-0005' },
  { tenantId: KWU, supplierTenantId: GABORONE_METER, programId: 13, effectiveStatus: 'expired', scopeCategoryCode: 'WTR-METER', scopeMaxValue: BWP('3000000.00'), scopeGeography: 'Botswana', effectiveFrom: '2024-09-01', effectiveTo: '2026-08-31', conditions: null, applicationInProgress: 'QA-2026-0008' },
  { tenantId: KWU, supplierTenantId: LIMPOPO, programId: 14, effectiveStatus: 'suspended', scopeCategoryCode: 'ENV', scopeMaxValue: BWP('2000000.00'), scopeGeography: 'Botswana', effectiveFrom: '2026-09-10', effectiveTo: '2028-01-19', conditions: 'Suspended after the waste management licence lapsed on 5 Sep 2026; reassessment due by 31 Oct 2026.', applicationInProgress: null },
  { tenantId: ODC, supplierTenantId: LIMPOPO, programId: 21, effectiveStatus: 'qualified', scopeCategoryCode: 'FAC-CLEAN', scopeMaxValue: BWP('1500000.00'), scopeGeography: 'Okavango District', effectiveFrom: '2026-05-15', effectiveTo: '2028-05-14', conditions: null, applicationInProgress: null },
  { tenantId: ODC, supplierTenantId: TSODILO, programId: 22, ...NOT_ASSESSED, applicationInProgress: 'QA-2026-0002' },
] satisfies FixtureQualificationStanding[]);

const REVIEW_OUTCOME_STATUSES: readonly PerformanceReviewsStatus[] = ['shared_with_supplier', 'supplier_responded', 'finalized'];

/** The latest performance review of a contract with an outcome (drafts are internal work in progress). */
function performanceOf(contractId: number): FixtureContractPerformance | null {
  const reviews = CONTRACT_REVIEWS.filter(
    (review) => review.contractId === contractId && REVIEW_OUTCOME_STATUSES.includes(review.status) && review.overallRating !== null,
  ).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const latest = reviews[0];
  if (latest === undefined || latest.overallRating === null) {
    return null;
  }
  return {
    reviewId: latest.id,
    periodStart: latest.periodStart,
    periodEnd: latest.periodEnd,
    status: latest.status,
    overallRating: latest.overallRating,
    supplierResponded: latest.respondedAt !== null,
    supplierDisputes: latest.supplierDisputes,
    reviewCount: reviews.length,
  };
}

/** Each buyer's contracts with each supplier, straight from the contracts domain (BUY-31 count, BUY-32 tab). */
export const RELATIONSHIP_CONTRACTS: readonly FixtureRelationshipContract[] = Object.freeze(
  CONTRACTS.map((contract) => ({
    tenantId: contract.tenantId,
    supplierTenantId: contract.supplierTenantId,
    contractId: contract.id,
    reference: contract.reference,
    title: contract.title,
    status: contract.status,
    performance: performanceOf(contract.id),
  })),
);
