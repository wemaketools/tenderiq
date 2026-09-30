/**
 * Storyline facts shared by the reporting and records fixtures (docs/plan/demo-storyline.md): the buyer
 * dimensions (legal entities, departments, categories), the tenders, lots and contracts with their natural keys, and
 * the in-app link paths of the records they point to.
 *
 * Id conventions (shared with the owning domains' fixtures): tender `T-2026-00NN` has id NN (tenders domain);
 * `T-2025-0003`, the imported legacy tender under legal hold (AC-35), has id 2503; contract ids follow the contracts
 * domain (`C-2026-0001` = 1, `C-2026-0002` = 2, `C-2025-0007` = 4). Users and tenants come from `../platform.ts`.
 *
 * Static data: nothing here is mutated at runtime.
 */
import type { Money } from '../../../contracts/common.js';
import type {
  ContractsStatus,
  LotsStage,
  TendersEventType,
  TendersProcedure,
  TendersStatus,
} from '../../../contracts/enums.js';
import { BUYER_CATEGORIES } from '../categories.js';
import { DEMO_AS_OF, DEMO_AS_OF_DATE, DEMO_TIME_ZONE } from '../demo-clock.js';
import { TENANT_IDS } from '../platform.js';

/**
 * The instant every dashboard, report and records fixture is computed at ("data as of"): the single demo "now" of
 * the storyline (`../demo-clock.ts`), the same instant the organization, contract and access-review fixtures are
 * written around. Every activity timestamp of the reporting and records fixtures is on or before it; every deadline,
 * due date and notice window after it is still ahead.
 */
export const REPORTING_AS_OF: string = DEMO_AS_OF;
/** `REPORTING_AS_OF` as a calendar date in Africa/Gaborone (`../demo-clock.ts`). */
export const REPORTING_AS_OF_DATE: string = DEMO_AS_OF_DATE;
export const OFFICIAL_TIME_ZONE: string = DEMO_TIME_ZONE;

/** Persona user ids used by the reporting fixtures (see `../platform.ts`). */
export const USERS = {
  opsAdmin: 1,
  supportAgent: 2,
  adminKwu: 3,
  mpho: 4,
  tebogo: 5,
  kagiso: 6,
  onalenna: 7,
  neo: 8,
  lesego: 9,
  boitumelo: 10,
  thato: 11,
  kabo: 12,
  amantle: 13,
  refilwe: 14,
  oratile: 15,
  goitse: 16,
  dineo: 17,
  keabetswe: 18,
  masego: 19,
  pule: 20,
  formerOfficer: 21,
  adminOdc: 22,
  officerOdc: 23,
  tsodiloAdmin: 24,
  tsodiloBidManager: 25,
  tsodiloContributor: 26,
  tsodiloSignatory: 27,
  chobeBidManager: 29,
  seroweBidManager: 33,
  gaboroneBidManager: 37,
  makgadikgadiAdmin: 40,
  limpopoAdmin: 41,
  samDual: 42,
} as const;

export const KWU = TENANT_IDS.kwu;
/** Id of the imported legacy tender T-2025-0003 under legal hold (AC-35). */
export const LEGACY_TENDER_ID = 2503;
/** Id of the imported legacy contract C-2025-0007 (contracts domain). */
export const LEGACY_CONTRACT_ID = 4;
export const ODC = TENANT_IDS.odc;

export function bwp(amount: string): Money {
  return { amount, currency: 'BWP' };
}

// ---------------------------------------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------------------------------------

export interface FixtureDimension {
  readonly id: number;
  readonly tenantId: number;
  readonly label: string;
  readonly code: string | null;
}

export const LEGAL_ENTITIES: readonly FixtureDimension[] = [
  { id: 1, tenantId: KWU, label: 'Kalahari Water Utilities Corporation', code: 'KWUC' },
  { id: 2, tenantId: ODC, label: 'Okavango District Council', code: 'ODC' },
];

export const DEPARTMENTS: readonly FixtureDimension[] = [
  { id: 1, tenantId: KWU, label: 'Operations', code: null },
  { id: 2, tenantId: KWU, label: 'Technical Services', code: null },
  { id: 3, tenantId: KWU, label: 'Network Operations', code: null },
  { id: 4, tenantId: KWU, label: 'Water Quality', code: null },
  { id: 5, tenantId: KWU, label: 'Corporate Services', code: null },
  { id: 6, tenantId: ODC, label: 'Facilities Management', code: null },
];

/** The buyer categories of the demo world (`../categories.ts`), as report and dashboard dimensions. */
export const CATEGORIES: readonly FixtureDimension[] = BUYER_CATEGORIES.filter((row) => row.active).map(({ id, tenantId, name, code }) => ({
  id,
  tenantId,
  label: name,
  code,
}));

export function dimensionLabel(rows: readonly FixtureDimension[], id: number): string {
  return rows.find((row) => row.id === id)?.label ?? '';
}

// ---------------------------------------------------------------------------------------------------------
// Tenders and lots
// ---------------------------------------------------------------------------------------------------------

export interface FixtureLot {
  readonly id: number;
  readonly number: number;
  /** The lot title exactly as the tenders domain names it (`../tenders/structure.ts`). */
  readonly title: string;
  readonly stage: LotsStage;
  readonly estimatedValue: Money;
}

export interface FixtureTenderFact {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly eventType: TendersEventType;
  readonly procedure: TendersProcedure;
  readonly status: TendersStatus;
  readonly legalEntityId: number;
  readonly departmentId: number;
  readonly categoryId: number;
  readonly ownerUserId: number;
  /** `null` when no estimate exists (an RFI): shown as missing, never as zero. */
  readonly estimatedValue: Money | null;
  readonly lots: readonly FixtureLot[];
  /** First and last business activity dates (dashboard date filters overlap them). */
  readonly openedOn: string;
  readonly lastActivityOn: string;
  /** Days in the current stage at `REPORTING_AS_OF`. */
  readonly daysInStage: number;
  readonly nextMilestoneLabel: string | null;
  /** Visible to the public portal (invitation-only and draft events are not, AC-01). */
  readonly isPublic: boolean;
}

type TenderInput = Omit<FixtureTenderFact, 'tenantId' | 'legalEntityId' | 'ownerUserId' | 'lots' | 'isPublic'> &
  Partial<Pick<FixtureTenderFact, 'tenantId' | 'legalEntityId' | 'ownerUserId' | 'lots' | 'isPublic'>>;

function tender(input: TenderInput): FixtureTenderFact {
  return { tenantId: KWU, legalEntityId: 1, ownerUserId: USERS.tebogo, lots: [], isPublic: true, ...input };
}

/** Mirrors the tenders domain fixtures (`../tenders/tenders.ts`): ids, statuses, dimensions and estimates. */
export const TENDER_FACTS: readonly FixtureTenderFact[] = [
  tender({
    id: 1,
    reference: 'T-2026-0001',
    title: 'Borehole pump replacement programme',
    eventType: 'tender',
    procedure: 'open',
    status: 'partially_awarded',
    departmentId: 1,
    categoryId: 2,
    estimatedValue: bwp('4850000.00'),
    lots: [
      { id: 101, number: 1, title: 'Submersible borehole pumps — Central District', stage: 'awarded', estimatedValue: bwp('2150000.00') },
      { id: 102, number: 2, title: 'Solar pumping systems — Kgalagadi', stage: 'cancelled', estimatedValue: bwp('1600000.00') },
      { id: 103, number: 3, title: 'Pump controls and telemetry panels', stage: 'under_assessment', estimatedValue: bwp('1100000.00') },
    ],
    openedOn: '2026-05-18',
    lastActivityOn: '2026-09-22',
    daysInStage: 32,
    nextMilestoneLabel: 'Lot 3 evaluation in progress',
  }),
  tender({ id: 2, reference: 'T-2026-0002', title: 'Smart water meter supply', eventType: 'rfq', procedure: 'open', status: 'open', departmentId: 3, categoryId: 4, estimatedValue: bwp('1280000.00'), openedOn: '2026-08-24', lastActivityOn: '2026-10-02', daysInStage: 22, nextMilestoneLabel: 'Submission deadline, 21 Oct 2026 (moved from 14 Oct by Addendum 1)' }),
  tender({ id: 3, reference: 'T-2026-0003', title: 'SCADA telemetry upgrade', eventType: 'rfp', procedure: 'open', status: 'under_assessment', departmentId: 2, categoryId: 5, estimatedValue: bwp('125000.00'), openedOn: '2026-06-22', lastActivityOn: '2026-09-18', daysInStage: 39, nextMilestoneLabel: 'Expected award, 30 Oct 2026' }),
  tender({ id: 4, reference: 'T-2026-0004', title: 'Leak-detection market consultation', eventType: 'rfi', procedure: 'rfi', status: 'information_collected', departmentId: 3, categoryId: 7, estimatedValue: null, openedOn: '2026-04-20', lastActivityOn: '2026-06-30', daysInStage: 98, nextMilestoneLabel: null }),
  tender({ id: 5, reference: 'T-2026-0005', title: 'Water treatment chemicals framework', eventType: 'tender', procedure: 'open', status: 'awaiting_release_approval', departmentId: 4, categoryId: 6, estimatedValue: bwp('1920000.00'), openedOn: '2026-09-07', lastActivityOn: '2026-09-28', daysInStage: 8, nextMilestoneLabel: 'Release approval required again after a scope change', isPublic: false }),
  tender({ id: 6, reference: 'T-2026-0006', title: 'Chlorine dosing equipment', eventType: 'rfq', procedure: 'invitation_only', status: 'open', departmentId: 4, categoryId: 6, estimatedValue: bwp('640000.00'), openedOn: '2026-09-01', lastActivityOn: '2026-09-21', daysInStage: 15, nextMilestoneLabel: 'Submission deadline, 14 Oct 2026', isPublic: false }),
  tender({ id: 7, reference: 'T-2026-0007', title: 'Reservoir rehabilitation works', eventType: 'tender', procedure: 'open', status: 'award_pending', departmentId: 2, categoryId: 8, estimatedValue: bwp('7400000.00'), openedOn: '2026-04-06', lastActivityOn: '2026-09-25', daysInStage: 17, nextMilestoneLabel: 'Standstill ends 8 Oct 2026, 17:00 (complaint hold in force)' }),
  tender({ id: 8, reference: 'T-2026-0008', title: 'Pipeline valves bulk supply', eventType: 'tender', procedure: 'open', status: 'closed', departmentId: 3, categoryId: 3, estimatedValue: bwp('2350000.00'), openedOn: '2026-07-27', lastActivityOn: '2026-09-25', daysInStage: 11, nextMilestoneLabel: 'Opening of the qualification envelopes, 7 Oct 2026' }),
  tender({ id: 9, reference: 'T-2026-0009', title: 'Acoustic leak detection services', eventType: 'rfp', procedure: 'restricted', status: 'under_assessment', departmentId: 3, categoryId: 7, estimatedValue: bwp('3100000.00'), openedOn: '2026-06-15', lastActivityOn: '2026-09-24', daysInStage: 53, nextMilestoneLabel: 'Fallback bidder due diligence' }),
  tender({ id: 10, reference: 'T-2026-0010', title: 'Fleet vehicle maintenance', eventType: 'rfq', procedure: 'open', status: 'awarded', departmentId: 5, categoryId: 9, estimatedValue: bwp('1900000.00'), openedOn: '2025-12-01', lastActivityOn: '2026-08-01', daysInStage: 214, nextMilestoneLabel: null }),
  tender({ id: 11, tenantId: ODC, legalEntityId: 2, ownerUserId: USERS.officerOdc, reference: 'T-2026-0011', title: 'Office cleaning services', eventType: 'rfq', procedure: 'open', status: 'open', departmentId: 6, categoryId: 20, estimatedValue: bwp('420000.00'), openedOn: '2026-08-31', lastActivityOn: '2026-09-16', daysInStage: 20, nextMilestoneLabel: 'Submission deadline, 23 Oct 2026 (moved from 21 Oct by Addendum 1)' }),
  tender({ id: 12, reference: 'T-2026-0012', title: 'Treatment works electrical maintenance', eventType: 'rfq', procedure: 'open', status: 'draft', departmentId: 2, categoryId: 10, estimatedValue: bwp('780000.00'), openedOn: '2026-09-22', lastActivityOn: '2026-09-29', daysInStage: 14, nextMilestoneLabel: 'Draft: release planned for December 2026', isPublic: false }),
  tender({
    id: 13,
    tenantId: ODC,
    legalEntityId: 2,
    ownerUserId: USERS.officerOdc,
    reference: 'T-2026-0013',
    title: 'Community borehole drilling — Maun cluster',
    eventType: 'tender',
    procedure: 'open',
    status: 'ready',
    departmentId: 6,
    categoryId: 21,
    estimatedValue: bwp('1980000.00'),
    openedOn: '2026-09-08',
    lastActivityOn: '2026-09-29',
    daysInStage: 7,
    nextMilestoneLabel: 'Release scheduled for 20 Oct 2026; submission deadline 18 Nov 2026',
    isPublic: false,
  }),
  tender({
    id: 14,
    reference: 'T-2026-0014',
    title: 'Water treatment works instrumentation',
    eventType: 'tender',
    procedure: 'open',
    status: 'under_assessment',
    departmentId: 2,
    categoryId: 1,
    estimatedValue: bwp('3650000.00'),
    lots: [
      { id: 1401, number: 1, title: 'Flow meters', stage: 'under_assessment', estimatedValue: bwp('820000.00') },
      { id: 1402, number: 2, title: 'Online water-quality analysers', stage: 'under_assessment', estimatedValue: bwp('760000.00') },
      { id: 1403, number: 3, title: 'Level sensors', stage: 'under_assessment', estimatedValue: bwp('410000.00') },
      { id: 1404, number: 4, title: 'Pressure transmitters', stage: 'under_assessment', estimatedValue: bwp('380000.00') },
      { id: 1405, number: 5, title: 'Chlorine dosing controllers', stage: 'under_assessment', estimatedValue: bwp('1280000.00') },
    ],
    openedOn: '2026-06-22',
    lastActivityOn: '2026-09-28',
    daysInStage: 47,
    nextMilestoneLabel: 'Expected award, 13 Nov 2026',
  }),
  tender({ id: LEGACY_TENDER_ID, reference: 'T-2025-0003', title: 'Maun wellfield pump supply (legacy import, 2018)', eventType: 'tender', procedure: 'open', status: 'archived', ownerUserId: USERS.formerOfficer, departmentId: 1, categoryId: 2, estimatedValue: bwp('2250000.00'), openedOn: '2018-07-02', lastActivityOn: '2018-11-30', daysInStage: 2867, nextMilestoneLabel: null, isPublic: false }),
];

export function tenderFact(tenderId: number): FixtureTenderFact {
  const tender = TENDER_FACTS.find((row) => row.id === tenderId);
  if (tender === undefined) {
    throw new Error(`No tender fact ${tenderId}.`);
  }
  return tender;
}

/** The display label of a lot, built from the tenders-domain title: `Lot 1: Submersible borehole pumps — …`. */
export function lotLabel(tenderId: number, lotId: number): string {
  const lot = tenderFact(tenderId).lots.find((row) => row.id === lotId);
  if (lot === undefined) {
    throw new Error(`No lot ${lotId} on tender fact ${tenderId}.`);
  }
  return `Lot ${lot.number}: ${lot.title}`;
}

// ---------------------------------------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------------------------------------

export interface FixtureContractFact {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly tenderId: number | null;
  readonly supplierTenantId: number;
  readonly status: ContractsStatus;
  readonly value: Money;
  readonly ownerUserId: number;
  readonly imported: boolean;
}

/** Mirrors the contracts domain fixtures (`../contracts/core.ts`): ids, statuses, suppliers and values. */
export const CONTRACT_FACTS: readonly FixtureContractFact[] = [
  { id: 1, tenantId: KWU, reference: 'C-2026-0001', title: 'Fleet vehicle maintenance', tenderId: 10, supplierTenantId: TENANT_IDS.tsodilo, status: 'active', value: bwp('1850000.00'), ownerUserId: USERS.tebogo, imported: false },
  { id: 2, tenantId: KWU, reference: 'C-2026-0002', title: 'Borehole pumps Lot 1: supply and installation', tenderId: 1, supplierTenantId: TENANT_IDS.tsodilo, status: 'awaiting_signature', value: bwp('4668000.00'), ownerUserId: USERS.tebogo, imported: false },
  { id: 3, tenantId: KWU, reference: 'C-2026-0003', title: 'Borehole pumps Lot 1: preventive maintenance', tenderId: 1, supplierTenantId: TENANT_IDS.tsodilo, status: 'under_review', value: bwp('540000.00'), ownerUserId: USERS.tebogo, imported: false },
  { id: 4, tenantId: KWU, reference: 'C-2025-0007', title: 'Legacy meter reading services', tenderId: null, supplierTenantId: TENANT_IDS['gaborone-meter'], status: 'expired', value: bwp('640000.00'), ownerUserId: USERS.masego, imported: true },
  { id: 5, tenantId: KWU, reference: 'C-2025-0003', title: 'SCADA helpdesk and patching support', tenderId: null, supplierTenantId: TENANT_IDS['serowe-ict'], status: 'closed', value: bwp('310000.00'), ownerUserId: USERS.masego, imported: false },
  { id: 6, tenantId: KWU, reference: 'C-2025-0005', title: 'Network valve maintenance call-out services', tenderId: null, supplierTenantId: TENANT_IDS['chobe-pipe'], status: 'suspended', value: bwp('450000.00'), ownerUserId: USERS.tebogo, imported: false },
  { id: 7, tenantId: ODC, reference: 'C-2025-0004', title: 'Council office cleaning services', tenderId: null, supplierTenantId: TENANT_IDS['limpopo-env'], status: 'active', value: bwp('276000.00'), ownerUserId: USERS.officerOdc, imported: false },
  { id: 8, tenantId: KWU, reference: 'C-2026-0004', title: 'Borehole pumps Lot 1: spare parts and consumables', tenderId: 1, supplierTenantId: TENANT_IDS.tsodilo, status: 'draft', value: bwp('120000.00'), ownerUserId: USERS.tebogo, imported: false },
];

export function contractFact(contractId: number): FixtureContractFact {
  const contract = CONTRACT_FACTS.find((row) => row.id === contractId);
  if (contract === undefined) {
    throw new Error(`No contract fact ${contractId}.`);
  }
  return contract;
}

// ---------------------------------------------------------------------------------------------------------
// In-app links (one place, so the integration step can align them with the owning features)
// ---------------------------------------------------------------------------------------------------------

export const LINKS = {
  buyerTender: (tenderId: number): string => `/buyer/tenders/${tenderId}`,
  /** The publication record of a tender (channels, external notices and their exceptions). */
  buyerTenderPublication: (tenderId: number): string => `/buyer/tenders/${tenderId}/publication`,
  buyerTenders: (status?: string): string => (status === undefined ? '/buyer/tenders' : `/buyer/tenders?status=${status}`),
  buyerContract: (contractId: number): string => `/buyer/contracts/${contractId}`,
  buyerContracts: (): string => '/buyer/contracts',
  buyerRequest: (requestId: number): string => `/buyer/requests/${requestId}`,
  buyerSupplier: (supplierTenantId: number): string => `/buyer/suppliers/${supplierTenantId}`,
  /** A complaint case (awards domain ids: KWU 91, 92, 94; ODC 93). */
  buyerComplaint: (complaintId: number): string => `/buyer/award-cases/complaints/${complaintId}`,
  buyerComplaints: (): string => '/buyer/award-cases/complaints',
  buyerIntegrations: (): string => '/buyer/admin/service/integrations',
  buyerQualification: (applicationId: number): string => `/buyer/qualification/applications/${applicationId}`,
  approval: (approvalId: number): string => `/me/approvals/${approvalId}`,
  tasks: (taskId?: number): string => (taskId === undefined ? '/me/tasks' : `/me/tasks?task=${taskId}`),
  document: (documentId: number): string => `/me/documents/${documentId}`,
  holds: (holdId: number): string => `/buyer/admin/records/holds/${holdId}`,
  /** The audit viewer filtered to one entity (the drill-through for records without a feature page of their own). */
  auditTrail: (entityType: string, entityId: number): string =>
    `/buyer/admin/records/audit?entityType=${entityType}&entityId=${entityId}`,
  supplierOpportunities: (): string => '/supplier/opportunities',
  supplierOpportunity: (tenderId: number): string => `/supplier/opportunities/${tenderId}`,
  supplierInvitations: (): string => '/supplier/invitations',
  /** A supplier's own response: takes the BID id of the bids domain (`../bids/responses.ts`), never a tender id. */
  supplierResponse: (bidId: number): string => `/supplier/responses/${bidId}`,
  supplierOutcome: (tenderId: number): string => `/supplier/outcomes/${tenderId}`,
  supplierContract: (contractId: number): string => `/supplier/contracts/${contractId}`,
  supplierEvidence: (evidenceId: number): string => `/supplier/evidence/${evidenceId}`,
  supplierQualification: (): string => '/supplier/qualification',
  opsCustomer: (tenantId: number): string => `/ops/customers/${tenantId}`,
} as const;
