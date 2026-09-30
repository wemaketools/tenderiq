/**
 * Requests domain fixtures (05): the reference records that requests, plan items and strategies point at
 * (docs/plan/demo-storyline.md). Organization structure (legal entities, departments, categories, cost centres,
 * funding sources) mirrors blueprint Migration 02; tenders and contracts use the storyline references and are
 * read-only projections here (their owning domains hold the full records; Integration checks that the references
 * resolve).
 *
 * Static data: never mutated at runtime.
 */
import type { Money } from '../../../contracts/common.js';
import type {
  FundingSourcesSourceType,
  ProcurementProjectsStatus,
  ProcurementStrategiesEventType,
  ProcurementStrategiesProcedure,
  TendersStatus,
} from '../../../contracts/enums.js';
import { TENANT_IDS, TENANTS } from '../platform.js';

export const KWU = TENANT_IDS.kwu;
export const ODC = TENANT_IDS.odc;

/** Persona user ids used by this domain (platform fixtures, foundation-contract §5). */
export const USERS = {
  mpho: 4,
  tebogo: 5,
  kagiso: 6,
  onalenna: 7,
  lesego: 9,
  amantle: 13,
  dineo: 17,
  keabetswe: 18,
  masego: 19,
  pule: 20,
  adminOdc: 22,
  officerOdc: 23,
} as const;

export function bwp(amount: string): Money {
  return { amount, currency: 'BWP' };
}

export interface FixtureLegalEntity {
  readonly id: number;
  readonly tenantId: number;
  readonly name: string;
}

export interface FixtureDepartment {
  readonly id: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
  readonly legalEntityId: number;
}

export interface FixtureCategory {
  readonly id: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
  readonly parentId: number | null;
}

export interface FixtureCostCenter {
  readonly id: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
  readonly departmentId: number;
}

export interface FixtureFundingSource {
  readonly id: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
  readonly sourceType: FundingSourcesSourceType;
}

export interface FixtureProject {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly description: string;
  readonly ownerUserId: number;
  readonly categoryId: number;
  readonly departmentId: number;
  readonly estimatedValue: Money;
  readonly status: ProcurementProjectsStatus;
}

export interface FixtureContractRef {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly supplierTenantId: number;
  readonly categoryId: number;
  /** Display status of the contract (owned by the contracts domain). */
  readonly status: 'active' | 'awaiting_signature' | 'expired';
  readonly expiresOn: string;
  readonly ceiling: Money | null;
  readonly committed: Money;
  /** Renewal notice window start (C-2026-0001, AC-32), shown on the plan calendar. */
  readonly renewalNoticeFrom: string | null;
}

export interface FixtureTenderRef {
  readonly id: number;
  readonly tenantId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: TendersStatus;
}

export interface FixturePolicy {
  readonly tenantId: number;
  readonly profileVersionId: number;
  readonly name: string;
  readonly versionNo: number;
  readonly permittedProcedures: readonly ProcurementStrategiesProcedure[];
  /** Upper value per procedure (`policy_thresholds.max_value`); absent = no upper limit. */
  readonly maxValue: Partial<Record<ProcurementStrategiesProcedure, string>>;
  readonly publicNoticeProcedures: readonly ProcurementStrategiesProcedure[];
}

export interface FixtureProcedureGuidance {
  readonly procedure: ProcurementStrategiesProcedure;
  readonly eventTypes: readonly ProcurementStrategiesEventType[];
  readonly purpose: string;
  readonly requiredDistinctions: readonly { readonly id: string; readonly label: string }[];
  readonly requiresExceptionApproval: boolean;
  readonly typicalDurationDays: number;
}

export const LEGAL_ENTITIES: readonly FixtureLegalEntity[] = Object.freeze([
  { id: 1, tenantId: KWU, name: 'Kalahari Water Utilities Corporation' },
  { id: 2, tenantId: ODC, name: 'Okavango District Council' },
]);

export const DEPARTMENTS: readonly FixtureDepartment[] = Object.freeze([
  { id: 1, tenantId: KWU, code: 'OPS', name: 'Operations', legalEntityId: 1 },
  { id: 2, tenantId: KWU, code: 'TECH', name: 'Technical Services', legalEntityId: 1 },
  { id: 3, tenantId: KWU, code: 'NET', name: 'Network Operations', legalEntityId: 1 },
  { id: 4, tenantId: KWU, code: 'WQ', name: 'Water Quality', legalEntityId: 1 },
  { id: 5, tenantId: KWU, code: 'CORP', name: 'Corporate Services', legalEntityId: 1 },
  { id: 6, tenantId: KWU, code: 'FIN', name: 'Finance', legalEntityId: 1 },
  { id: 7, tenantId: KWU, code: 'FLEET', name: 'Fleet and Logistics', legalEntityId: 1 },
  { id: 11, tenantId: ODC, code: 'ADMIN', name: 'Council Administration', legalEntityId: 2 },
  { id: 12, tenantId: ODC, code: 'PW', name: 'Public Works', legalEntityId: 2 },
]);

export const CATEGORIES: readonly FixtureCategory[] = Object.freeze([
  { id: 1, tenantId: KWU, code: 'WTR-INFRA', name: 'Water infrastructure', parentId: null },
  { id: 2, tenantId: KWU, code: 'WTR-PUMP', name: 'Pumps and mechanical equipment', parentId: 1 },
  { id: 3, tenantId: KWU, code: 'WTR-PIPE', name: 'Pipes, valves and fittings', parentId: 1 },
  { id: 4, tenantId: KWU, code: 'ICT-SCADA', name: 'SCADA and telemetry', parentId: null },
  { id: 5, tenantId: KWU, code: 'WTR-CHEM', name: 'Water treatment chemicals', parentId: null },
  { id: 6, tenantId: KWU, code: 'FLEET-SVC', name: 'Fleet services', parentId: null },
  { id: 7, tenantId: KWU, code: 'FAC-SVC', name: 'Facilities and office', parentId: null },
  { id: 8, tenantId: KWU, code: 'LAB-EQP', name: 'Laboratory equipment', parentId: null },
  { id: 9, tenantId: KWU, code: 'PPE', name: 'Protective clothing and equipment', parentId: null },
  { id: 10, tenantId: KWU, code: 'ICT-COMMS', name: 'Communications ICT', parentId: null },
  { id: 11, tenantId: KWU, code: 'ENG-SVC', name: 'Engineering services', parentId: null },
  { id: 12, tenantId: KWU, code: 'ENERGY', name: 'Energy and power', parentId: null },
  { id: 21, tenantId: ODC, code: 'FAC-CLEAN', name: 'Cleaning services', parentId: null },
  { id: 22, tenantId: ODC, code: 'CIV-WORKS', name: 'Civil works', parentId: null },
  { id: 23, tenantId: ODC, code: 'FUEL', name: 'Fuel supply', parentId: null },
]);

export const COST_CENTERS: readonly FixtureCostCenter[] = Object.freeze([
  { id: 1, tenantId: KWU, code: 'CC-OPS-410', name: 'Borehole operations', departmentId: 1 },
  { id: 2, tenantId: KWU, code: 'CC-NET-520', name: 'Network maintenance', departmentId: 3 },
  { id: 3, tenantId: KWU, code: 'CC-WQ-610', name: 'Central laboratory', departmentId: 4 },
  { id: 4, tenantId: KWU, code: 'CC-CORP-110', name: 'Head office', departmentId: 5 },
  { id: 5, tenantId: KWU, code: 'CC-FLT-710', name: 'Fleet workshop', departmentId: 7 },
  { id: 6, tenantId: KWU, code: 'CC-TECH-310', name: 'Telemetry and control', departmentId: 2 },
  { id: 11, tenantId: ODC, code: 'CC-ODC-100', name: 'Council services', departmentId: 11 },
  { id: 12, tenantId: ODC, code: 'CC-ODC-200', name: 'Markets and public spaces', departmentId: 12 },
]);

export const FUNDING_SOURCES: readonly FixtureFundingSource[] = Object.freeze([
  { id: 1, tenantId: KWU, code: 'CAPEX-2026', name: 'Capital budget FY2026/27', sourceType: 'capital_budget' },
  { id: 2, tenantId: KWU, code: 'OPEX-2026', name: 'Operating budget FY2026/27', sourceType: 'operating_budget' },
  { id: 3, tenantId: KWU, code: 'WSRG', name: 'Water Sector Resilience Grant', sourceType: 'grant' },
  { id: 4, tenantId: KWU, code: 'CAPEX-2027', name: 'Capital budget FY2027/28', sourceType: 'capital_budget' },
  { id: 11, tenantId: ODC, code: 'ODC-OPEX', name: 'Council operating budget 2026/27', sourceType: 'operating_budget' },
  { id: 12, tenantId: ODC, code: 'ODC-DDF', name: 'District development fund', sourceType: 'grant' },
]);

export const PROJECTS: readonly FixtureProject[] = Object.freeze([
  {
    id: 1,
    tenantId: KWU,
    reference: 'PP-2026-0001',
    title: 'Borehole rehabilitation programme 2026–2028',
    description: 'Replacement of end-of-life borehole pumps and motors across the southern and central wellfields.',
    ownerUserId: USERS.tebogo,
    categoryId: 2,
    departmentId: 1,
    estimatedValue: bwp('7100000.00'),
    status: 'active',
  },
  {
    id: 2,
    tenantId: KWU,
    reference: 'PP-2026-0002',
    title: 'Telemetry and leak management programme',
    description: 'SCADA telemetry upgrade, market consultation on leak detection and the resulting leak detection services.',
    ownerUserId: USERS.tebogo,
    categoryId: 4,
    departmentId: 2,
    estimatedValue: bwp('9800000.00'),
    status: 'active',
  },
  {
    id: 3,
    tenantId: KWU,
    reference: 'PP-2026-0003',
    title: 'Network pressure management',
    description: 'Pressure-reducing valves, the northern wellfield pipeline extension and drought-relief water supply.',
    ownerUserId: USERS.mpho,
    categoryId: 3,
    departmentId: 3,
    estimatedValue: bwp('8270000.00'),
    status: 'planning',
  },
  {
    id: 11,
    tenantId: ODC,
    reference: 'PP-2026-0001',
    title: 'Council facilities services',
    description: 'Cleaning, security and fuel supply for council offices and markets.',
    ownerUserId: USERS.officerOdc,
    categoryId: 21,
    departmentId: 11,
    estimatedValue: bwp('2300000.00'),
    status: 'active',
  },
]);

export const CONTRACTS: readonly FixtureContractRef[] = Object.freeze([
  {
    id: 1,
    tenantId: KWU,
    reference: 'C-2026-0001',
    title: 'Fleet vehicle maintenance',
    supplierTenantId: TENANT_IDS.tsodilo,
    categoryId: 6,
    status: 'active',
    expiresOn: '2027-03-31',
    ceiling: bwp('2400000.00'),
    committed: bwp('1290000.00'),
    renewalNoticeFrom: '2026-10-05',
  },
  {
    id: 2,
    tenantId: KWU,
    reference: 'C-2026-0002',
    title: 'Borehole pumps — Lot 1',
    supplierTenantId: TENANT_IDS.tsodilo,
    categoryId: 2,
    status: 'awaiting_signature',
    expiresOn: '2028-10-31',
    ceiling: bwp('2980000.00'),
    committed: bwp('0.00'),
    renewalNoticeFrom: null,
  },
  {
    id: 4,
    tenantId: KWU,
    reference: 'C-2025-0007',
    title: 'Legacy meter reading',
    supplierTenantId: TENANT_IDS['gaborone-meter'],
    categoryId: 1,
    status: 'expired',
    expiresOn: '2026-06-30',
    ceiling: null,
    committed: bwp('612000.00'),
    renewalNoticeFrom: null,
  },
]);

export const TENDERS: readonly FixtureTenderRef[] = Object.freeze([
  { id: 1, tenantId: KWU, reference: 'T-2026-0001', title: 'Borehole pump replacement programme (3 lots)', status: 'partially_awarded' },
  { id: 2, tenantId: KWU, reference: 'T-2026-0002', title: 'Smart water meter supply', status: 'open' },
  { id: 3, tenantId: KWU, reference: 'T-2026-0003', title: 'SCADA telemetry upgrade', status: 'under_assessment' },
  { id: 4, tenantId: KWU, reference: 'T-2026-0004', title: 'Leak-detection market consultation', status: 'information_collected' },
  { id: 5, tenantId: KWU, reference: 'T-2026-0005', title: 'Water treatment chemicals framework', status: 'awaiting_release_approval' },
  { id: 6, tenantId: KWU, reference: 'T-2026-0006', title: 'Chlorine dosing equipment', status: 'open' },
  { id: 7, tenantId: KWU, reference: 'T-2026-0007', title: 'Reservoir rehabilitation works', status: 'award_pending' },
  { id: 8, tenantId: KWU, reference: 'T-2026-0008', title: 'Pipeline valves bulk supply', status: 'closed' },
  { id: 9, tenantId: KWU, reference: 'T-2026-0009', title: 'Acoustic leak detection services', status: 'under_assessment' },
  { id: 10, tenantId: KWU, reference: 'T-2026-0010', title: 'Fleet vehicle maintenance', status: 'awarded' },
  { id: 11, tenantId: ODC, reference: 'T-2026-0011', title: 'Office cleaning services', status: 'open' },
]);

export const POLICIES: readonly FixturePolicy[] = Object.freeze([
  {
    tenantId: KWU,
    profileVersionId: 3,
    name: 'KWU Procurement Policy 2026',
    versionNo: 3,
    permittedProcedures: ['rfi', 'open', 'restricted', 'invitation_only', 'multi_stage', 'direct'],
    maxValue: { invitation_only: '1000000.00', direct: '250000.00' },
    publicNoticeProcedures: ['rfi', 'open', 'restricted', 'multi_stage'],
  },
  {
    tenantId: ODC,
    profileVersionId: 21,
    name: 'Okavango District Council Procurement Rules',
    versionNo: 1,
    permittedProcedures: ['rfi', 'open', 'invitation_only', 'direct'],
    maxValue: { invitation_only: '500000.00', direct: '100000.00' },
    publicNoticeProcedures: ['rfi', 'open'],
  },
]);

/** PRD FR-05 procedure table (framework call-off is not offered, DD-40). */
export const PROCEDURE_GUIDANCE: readonly FixtureProcedureGuidance[] = Object.freeze([
  {
    procedure: 'rfi',
    eventTypes: ['rfi'],
    purpose: 'Understand suppliers, approaches and market conditions.',
    requiredDistinctions: [
      { id: 'no_award_entitlement', label: 'State that participation does not itself create an award entitlement' },
      { id: 'information_use', label: 'Control the future use of information suppliers share' },
    ],
    requiresExceptionApproval: false,
    typicalDurationDays: 30,
  },
  {
    procedure: 'open',
    eventTypes: ['rfq', 'rfp', 'tender'],
    purpose: 'Invite any supplier meeting the published conditions.',
    requiredDistinctions: [
      { id: 'public_discovery', label: 'Public discovery of the notice' },
      { id: 'consistent_access', label: 'Consistent access conditions for every supplier' },
      { id: 'objective_eligibility', label: 'Objective eligibility criteria' },
    ],
    requiresExceptionApproval: false,
    typicalDurationDays: 90,
  },
  {
    procedure: 'restricted',
    eventTypes: ['rfq', 'rfp', 'tender'],
    purpose: 'Invite suppliers selected through an approved eligibility process.',
    requiredDistinctions: [
      { id: 'linked_selection', label: 'Link the qualification or shortlist decision' },
      { id: 'selection_reasons', label: 'Preserve the reasons for selection' },
    ],
    requiresExceptionApproval: false,
    typicalDurationDays: 110,
  },
  {
    procedure: 'invitation_only',
    eventTypes: ['rfq', 'rfp'],
    purpose: 'Seek responses from named suppliers.',
    requiredDistinctions: [
      { id: 'approved_invite_list', label: 'Approved invite list, additions and refusals' },
      { id: 'sufficient_competition', label: 'Sufficient-competition review where policy requires it' },
    ],
    requiresExceptionApproval: false,
    typicalDurationDays: 45,
  },
  {
    procedure: 'multi_stage',
    eventTypes: ['rfp', 'tender'],
    purpose: 'Progress from an initial response to selected subsequent stages.',
    requiredDistinctions: [
      { id: 'stage_rules', label: 'Announced stage rules and promotion decisions' },
      { id: 'stage_deadlines', label: 'Distinct deadlines per stage' },
      { id: 'stage_submissions', label: 'Preserved submissions of every stage' },
    ],
    requiresExceptionApproval: false,
    typicalDurationDays: 150,
  },
  {
    procedure: 'direct',
    eventTypes: ['rfq', 'rfp'],
    purpose: 'Buy from a specified source under an approved exception.',
    requiredDistinctions: [
      { id: 'exception_grounds', label: 'Exception grounds and justification' },
      { id: 'exception_approver', label: 'Approver and approved value' },
      { id: 'disclosure', label: 'Any required disclosure; no fabricated competitive history' },
    ],
    requiresExceptionApproval: true,
    typicalDurationDays: 20,
  },
]);

/** Public portal switches (`portal_settings.show_advance_notices`). */
export const PORTAL_SHOWS_ADVANCE_NOTICES: Readonly<Record<number, boolean>> = Object.freeze({
  [KWU]: true,
  [ODC]: false,
});

/** Nominal procurement capacity in days per month for resource demand (BUY-05). */
export const OWNER_CAPACITY_DAYS: Readonly<Record<number, number>> = Object.freeze({
  [USERS.tebogo]: 18,
  [USERS.mpho]: 8,
  [USERS.officerOdc]: 16,
});

/** Budget periods of the buyers (financial years April–March). */
export const BUDGET_PERIODS: Readonly<Record<number, readonly string[]>> = Object.freeze({
  [KWU]: ['FY2026/27', 'FY2027/28'],
  [ODC]: ['FY2026/27', 'FY2027/28'],
});

/** Supplier organizations that market research may name. */
export const SUPPLIER_TENANTS = TENANTS.filter((tenant) => tenant.kind === 'supplier');
