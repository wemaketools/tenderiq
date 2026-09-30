/**
 * Qualification fixtures, part 1: the context the domain reads from other records of the demo world
 * (docs/plan/demo-storyline.md "Organizations", "Tenders", "Contracts", "Qualification").
 *
 * - Buyer categories (`categories`, per buyer tenant) with the catalog codes of the storyline (WTR-INFRA covers
 *   WTR-PUMP and WTR-PIPE, DD-26).
 * - Buyer ↔ supplier relationships (`buyer_supplier_relationships`): `v_qualification_status` lists active
 *   relationships × active programs (DD-13), and suppliers see programs of the buyers they work with.
 * - Supplier identity (registration and verification status): registration is never qualification (BR-03).
 * - Each supplier's active bids and contracts per buyer, by natural key (T-2026-000N, C-2026-000N), which
 *   reassessment triggers and decisions list as impacts (AC-09). Tender and contract ids follow the storyline
 *   numbering (T-2026-0003 → 3; C-2026-0001 → 1, C-2026-0002 → 2, C-2025-0007 → 4).
 * - The supplier evidence library entries cited by applications (`evidence_items`), with the storyline facts:
 *   Chobe's public liability insurance expires 2026-10-08 (AC-09), Makgadikgadi's financial statements are
 *   group-consolidated management accounts and it holds no ISO 9001 certificate (AC-08, AC-17), Limpopo's waste
 *   management licence lapsed on 2026-09-05.
 *
 * Static data: nothing here is mutated at runtime.
 */
import type { NonNegativeMoney } from '../../../contracts/common.js';
import type {
  BidsSubmissionState,
  BuyerSupplierRelationshipsStatus,
  ContractsStatus,
  EvidenceItemsEvidenceType,
  EvidenceItemsStatus,
  EvidenceItemsVerificationStatus,
  ParticipantsQualificationGate,
  TenantsVerificationStatus,
  TendersStatus,
} from '../../../contracts/enums.js';
import { BUYER_CATEGORIES } from '../categories.js';
import { TENANT_IDS } from '../platform.js';

export const KWU = TENANT_IDS.kwu;
export const ODC = TENANT_IDS.odc;
export const TSODILO = TENANT_IDS.tsodilo;
export const CHOBE = TENANT_IDS['chobe-pipe'];
export const MAKGADIKGADI = TENANT_IDS.makgadikgadi;
export const SEROWE = TENANT_IDS['serowe-ict'];
export const LIMPOPO = TENANT_IDS['limpopo-env'];
export const GABORONE_METER = TENANT_IDS['gaborone-meter'];

/** Persona user ids used by the qualification world (docs/plan/foundation-contract.md §5). */
export const USERS = {
  mpho: 4,
  tebogo: 5,
  neo: 8,
  lesego: 9,
  keabetswe: 18,
  adminOdc: 22,
  officerOdc: 23,
  tsodiloAdmin: 24,
  tsodiloBidManager: 25,
  chobeAdmin: 28,
  chobeBidManager: 29,
  seroweAdmin: 32,
  seroweBidManager: 33,
  gaboroneAdmin: 36,
  gaboroneBidManager: 37,
  makgadikgadiAdmin: 40,
  limpopoAdmin: 41,
} as const;

export const BWP = (amount: string): NonNegativeMoney => ({ amount, currency: 'BWP' });

// ---------------------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------------------

export interface FxCategory {
  readonly id: number;
  readonly tenantId: number;
  readonly code: string;
  readonly name: string;
  readonly parentId: number | null;
}

/** The buyer categories of the demo world (`../categories.ts`); a program or decision scope names one of them. */
export const QUALIFICATION_CATEGORIES: readonly FxCategory[] = Object.freeze(
  BUYER_CATEGORIES.filter((row) => row.active).map(({ id, tenantId, code, name, parentId }) => ({ id, tenantId, code, name, parentId })),
);

/** The category and every descendant (DD-26). */
export function categoryWithDescendants(categoryId: number): FxCategory[] {
  const result: FxCategory[] = [];
  const visit = (id: number): void => {
    const category = QUALIFICATION_CATEGORIES.find((candidate) => candidate.id === id);
    if (category === undefined) {
      return;
    }
    result.push(category);
    for (const child of QUALIFICATION_CATEGORIES.filter((candidate) => candidate.parentId === id)) {
      visit(child.id);
    }
  };
  visit(categoryId);
  return result;
}

export function findCategory(tenantId: number, categoryId: number): FxCategory | undefined {
  return QUALIFICATION_CATEGORIES.find((category) => category.id === categoryId && category.tenantId === tenantId);
}

// ---------------------------------------------------------------------------------------------------------
// Supplier identity and relationships
// ---------------------------------------------------------------------------------------------------------

export interface FxSupplierIdentity {
  readonly supplierTenantId: number;
  readonly verificationStatus: TenantsVerificationStatus;
}

export const SUPPLIER_IDENTITIES: readonly FxSupplierIdentity[] = Object.freeze([
  { supplierTenantId: TSODILO, verificationStatus: 'identity_verified' },
  { supplierTenantId: CHOBE, verificationStatus: 'identity_verified' },
  { supplierTenantId: MAKGADIKGADI, verificationStatus: 'contact_verified' },
  { supplierTenantId: SEROWE, verificationStatus: 'identity_verified' },
  { supplierTenantId: LIMPOPO, verificationStatus: 'identity_verified' },
  { supplierTenantId: GABORONE_METER, verificationStatus: 'identity_verified' },
]);

export interface FxRelationship {
  readonly buyerTenantId: number;
  readonly supplierTenantId: number;
  readonly status: BuyerSupplierRelationshipsStatus;
}

export const QUALIFICATION_RELATIONSHIPS: readonly FxRelationship[] = Object.freeze([
  { buyerTenantId: KWU, supplierTenantId: TSODILO, status: 'active' },
  { buyerTenantId: KWU, supplierTenantId: CHOBE, status: 'active' },
  { buyerTenantId: KWU, supplierTenantId: MAKGADIKGADI, status: 'active' },
  { buyerTenantId: KWU, supplierTenantId: SEROWE, status: 'active' },
  { buyerTenantId: KWU, supplierTenantId: LIMPOPO, status: 'active' },
  { buyerTenantId: KWU, supplierTenantId: GABORONE_METER, status: 'active' },
  { buyerTenantId: ODC, supplierTenantId: TSODILO, status: 'active' },
  { buyerTenantId: ODC, supplierTenantId: LIMPOPO, status: 'active' },
  { buyerTenantId: ODC, supplierTenantId: MAKGADIKGADI, status: 'prospective' },
]);

// ---------------------------------------------------------------------------------------------------------
// Active bids and contracts per buyer and supplier (impacts, AC-09)
// ---------------------------------------------------------------------------------------------------------

export interface FxBidActivity {
  readonly tenderId: number;
  readonly reference: string;
  readonly title: string;
  readonly tenderStatus: TendersStatus;
  readonly submissionState: BidsSubmissionState;
  readonly qualificationGate: ParticipantsQualificationGate;
  readonly nextGate: string | null;
}

export interface FxContractActivity {
  readonly contractId: number;
  readonly reference: string;
  readonly title: string;
  readonly status: ContractsStatus;
}

export interface FxSupplierActivity {
  readonly buyerTenantId: number;
  readonly supplierTenantId: number;
  readonly bids: readonly FxBidActivity[];
  readonly contracts: readonly FxContractActivity[];
}

const T0001: Omit<FxBidActivity, 'submissionState' | 'qualificationGate' | 'nextGate'> = {
  tenderId: 1,
  reference: 'T-2026-0001',
  title: 'Borehole pump replacement programme (3 lots)',
  tenderStatus: 'partially_awarded',
};
const T0002 = { tenderId: 2, reference: 'T-2026-0002', title: 'Smart water meter supply', tenderStatus: 'open' } as const;
const T0003 = {
  tenderId: 3,
  reference: 'T-2026-0003',
  title: 'SCADA telemetry upgrade',
  tenderStatus: 'under_assessment',
} as const;
const T0006 = { tenderId: 6, reference: 'T-2026-0006', title: 'Chlorine dosing equipment', tenderStatus: 'open' } as const;
const T0007 = {
  tenderId: 7,
  reference: 'T-2026-0007',
  title: 'Reservoir rehabilitation works',
  tenderStatus: 'award_pending',
} as const;
const T0008 = {
  tenderId: 8,
  reference: 'T-2026-0008',
  title: 'Pipeline valves bulk supply',
  tenderStatus: 'closed',
} as const;
const T0011 = {
  tenderId: 11,
  reference: 'T-2026-0011',
  title: 'Office cleaning services',
  tenderStatus: 'open',
} as const;

export const SUPPLIER_ACTIVITY: readonly FxSupplierActivity[] = Object.freeze([
  {
    buyerTenantId: KWU,
    supplierTenantId: TSODILO,
    bids: [
      { ...T0001, submissionState: 'submitted', qualificationGate: 'met', nextGate: 'Lot 3 evaluation' },
      { ...T0003, submissionState: 'submitted', qualificationGate: 'not_required', nextGate: 'Award recommendation' },
      { ...T0006, submissionState: 'not_submitted', qualificationGate: 'met', nextGate: 'Submission deadline' },
    ],
    contracts: [
      { contractId: 2, reference: 'C-2026-0002', title: 'Borehole pumps Lot 1', status: 'awaiting_signature' },
    ],
  },
  {
    buyerTenantId: KWU,
    supplierTenantId: CHOBE,
    bids: [
      { ...T0006, submissionState: 'not_submitted', qualificationGate: 'met', nextGate: 'Submission deadline' },
      { ...T0008, submissionState: 'submitted', qualificationGate: 'met', nextGate: 'Opening, evaluation and award' },
    ],
    contracts: [],
  },
  {
    buyerTenantId: KWU,
    supplierTenantId: MAKGADIKGADI,
    bids: [{ ...T0003, submissionState: 'submitted', qualificationGate: 'not_required', nextGate: 'Exclusion decision' }],
    contracts: [],
  },
  {
    buyerTenantId: KWU,
    supplierTenantId: SEROWE,
    bids: [
      { ...T0003, submissionState: 'submitted', qualificationGate: 'not_required', nextGate: 'Award recommendation' },
      { ...T0002, submissionState: 'not_submitted', qualificationGate: 'pending', nextGate: 'Submission deadline' },
    ],
    contracts: [],
  },
  {
    buyerTenantId: KWU,
    supplierTenantId: LIMPOPO,
    bids: [{ ...T0007, submissionState: 'submitted', qualificationGate: 'met', nextGate: 'Final award after standstill' }],
    contracts: [],
  },
  {
    buyerTenantId: KWU,
    supplierTenantId: GABORONE_METER,
    bids: [{ ...T0002, submissionState: 'submitted', qualificationGate: 'pending', nextGate: 'Submission deadline' }],
    contracts: [{ contractId: 4, reference: 'C-2025-0007', title: 'Legacy meter reading', status: 'expired' }],
  },
  {
    buyerTenantId: ODC,
    supplierTenantId: LIMPOPO,
    bids: [{ ...T0011, submissionState: 'not_submitted', qualificationGate: 'met', nextGate: 'Submission deadline' }],
    contracts: [],
  },
]);

export function activityOf(buyerTenantId: number, supplierTenantId: number): FxSupplierActivity {
  return (
    SUPPLIER_ACTIVITY.find(
      (activity) => activity.buyerTenantId === buyerTenantId && activity.supplierTenantId === supplierTenantId,
    ) ?? { buyerTenantId, supplierTenantId, bids: [], contracts: [] }
  );
}

// ---------------------------------------------------------------------------------------------------------
// Supplier evidence library (the items applications cite)
// ---------------------------------------------------------------------------------------------------------

/** The criterion families an evidence item answers (see `programs.ts`). */
export type CriterionKey =
  | 'REG'
  | 'OWN'
  | 'FIN_STMT'
  | 'FIN_RATIO'
  | 'REF_CONTRACTS'
  | 'CAPACITY'
  | 'ISO9001'
  | 'ISO45001'
  | 'PL_INS'
  | 'PI_INS'
  | 'LICENCE'
  | 'NO_EXCL'
  | 'ENV_POLICY'
  | 'CLIENT_REFS'
  | 'SEC_CERT'
  | 'SCADA_EXP'
  | 'METER_APPROVAL'
  | 'WASTE_LICENCE'
  | 'LAB_ACCRED'
  | 'CLEAN_STAFF'
  | 'CIV_GRADE'
  | 'PLANT';

export interface FxEvidenceItem {
  readonly id: number;
  readonly supplierTenantId: number;
  readonly evidenceType: EvidenceItemsEvidenceType;
  readonly title: string;
  readonly issuer: string | null;
  readonly referenceNumber: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly reportingCurrency: string | null;
  readonly isConsolidated: boolean | null;
  readonly coverageAmount: NonNegativeMoney | null;
  readonly validFrom: string | null;
  readonly expiresAt: string | null;
  readonly status: EvidenceItemsStatus;
  readonly verificationStatus: EvidenceItemsVerificationStatus;
  readonly fileName: string;
  readonly fits: readonly CriterionKey[];
}

type EvidenceSpec = Omit<
  FxEvidenceItem,
  'supplierTenantId' | 'periodStart' | 'periodEnd' | 'reportingCurrency' | 'isConsolidated' | 'coverageAmount'
> &
  Partial<Pick<FxEvidenceItem, 'periodStart' | 'periodEnd' | 'reportingCurrency' | 'isConsolidated' | 'coverageAmount'>>;

function library(supplierTenantId: number, specs: readonly EvidenceSpec[]): FxEvidenceItem[] {
  return specs.map((spec) => ({
    supplierTenantId,
    periodStart: null,
    periodEnd: null,
    reportingCurrency: null,
    isConsolidated: null,
    coverageAmount: null,
    ...spec,
  }));
}

const current = { status: 'current' } as const;

export const EVIDENCE_ITEMS: readonly FxEvidenceItem[] = Object.freeze([
  ...library(TSODILO, [
    { id: 401, ...current, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00000412345', validFrom: '2012-03-01', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'tsodilo-cipa-certificate.pdf', fits: ['REG'] },
    { id: 402, ...current, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'KPMG Botswana', referenceNumber: null, periodStart: '2024-07-01', periodEnd: '2025-06-30', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-09-30', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'tsodilo-afs-fy2025.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 403, ...current, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'Bureau Veritas Certification', referenceNumber: 'BV-QMS-88213', validFrom: '2024-05-15', expiresAt: '2027-05-14', verificationStatus: 'independently_verified', fileName: 'tsodilo-iso9001.pdf', fits: ['ISO9001'] },
    { id: 404, ...current, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2026-0457', coverageAmount: BWP('10000000.00'), validFrom: '2026-03-01', expiresAt: '2027-02-28', verificationStatus: 'supplier_provided', fileName: 'tsodilo-public-liability-2026.pdf', fits: ['PL_INS'] },
    { id: 405, ...current, evidenceType: 'license', title: 'PPADB contractor registration, Code 2.2 (mechanical works)', issuer: 'Public Procurement and Asset Disposal Board', referenceNumber: 'PPADB-2.2-04417', validFrom: '2025-07-01', expiresAt: '2027-06-30', verificationStatus: 'independently_verified', fileName: 'tsodilo-ppadb-registration.pdf', fits: ['LICENCE', 'CIV_GRADE'] },
    { id: 406, ...current, evidenceType: 'reference', title: 'Schedule of comparable contracts 2021–2025', issuer: null, referenceNumber: null, validFrom: '2026-01-10', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'tsodilo-comparable-contracts.pdf', fits: ['REF_CONTRACTS', 'PLANT'] },
    { id: 407, ...current, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', issuer: null, referenceNumber: null, validFrom: '2026-03-18', expiresAt: '2027-03-17', verificationStatus: 'supplier_provided', fileName: 'tsodilo-exclusion-declaration.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 408, ...current, evidenceType: 'policy', title: 'Environmental management policy', issuer: null, referenceNumber: 'TE-POL-ENV-03', validFrom: '2025-02-01', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'tsodilo-environmental-policy.pdf', fits: ['ENV_POLICY'] },
    { id: 409, ...current, evidenceType: 'reference', title: 'Client reference letters (Water Utilities Corporation, Debswana)', issuer: null, referenceNumber: null, validFrom: '2026-02-20', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'tsodilo-client-references.pdf', fits: ['CLIENT_REFS'] },
    { id: 410, status: 'replaced', evidenceType: 'financial_statement', title: 'Audited financial statements FY2024', issuer: 'KPMG Botswana', referenceNumber: null, periodStart: '2023-07-01', periodEnd: '2024-06-30', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2024-10-15', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'tsodilo-afs-fy2024.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 411, status: 'replaced', evidenceType: 'insurance', title: 'Public liability insurance certificate (2025 policy)', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2025-0391', coverageAmount: BWP('10000000.00'), validFrom: '2025-03-01', expiresAt: '2026-02-28', verificationStatus: 'supplier_provided', fileName: 'tsodilo-public-liability-2025.pdf', fits: ['PL_INS'] },
    { id: 412, status: 'replaced', evidenceType: 'reference', title: 'Schedule of comparable contracts 2020–2024', issuer: null, referenceNumber: null, validFrom: '2025-06-01', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'tsodilo-comparable-contracts-2024.pdf', fits: ['REF_CONTRACTS'] },
    { id: 413, status: 'replaced', evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment (2025)', issuer: null, referenceNumber: null, validFrom: '2025-09-20', expiresAt: '2026-09-19', verificationStatus: 'supplier_provided', fileName: 'tsodilo-exclusion-declaration-2025.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 414, status: 'replaced', evidenceType: 'reference', title: 'Client reference letter (Water Utilities Corporation, 2025)', issuer: null, referenceNumber: null, validFrom: '2025-08-10', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'tsodilo-client-reference-2025.pdf', fits: ['CLIENT_REFS'] },
    { id: 415, ...current, evidenceType: 'certificate', title: 'ISO/IEC 27001:2022 certificate (remote monitoring service)', issuer: 'BSI Group', referenceNumber: 'BSI-IS-802277', validFrom: '2025-11-03', expiresAt: '2028-11-02', verificationStatus: 'independently_verified', fileName: 'tsodilo-iso27001.pdf', fits: ['SEC_CERT'] },
    { id: 416, ...current, evidenceType: 'reference', title: 'Pump-station telemetry integration projects 2022–2026', issuer: null, referenceNumber: null, validFrom: '2026-09-01', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'tsodilo-telemetry-projects.pdf', fits: ['SCADA_EXP'] },
  ]),
  ...library(CHOBE, [
    { id: 501, ...current, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00000598812', validFrom: '2009-08-12', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'chobe-cipa-certificate.pdf', fits: ['REG'] },
    { id: 502, ...current, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'Grant Thornton Botswana', referenceNumber: null, periodStart: '2024-04-01', periodEnd: '2025-03-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-07-15', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'chobe-afs-fy2025.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 503, ...current, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'SGS South Africa', referenceNumber: 'SGS-ZA-QMS-40177', validFrom: '2023-12-02', expiresAt: '2026-12-01', verificationStatus: 'independently_verified', fileName: 'chobe-iso9001.pdf', fits: ['ISO9001'] },
    { id: 504, ...current, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Botswana Insurance Company', referenceNumber: 'BIC-PL-25-10931', coverageAmount: BWP('5000000.00'), validFrom: '2025-10-09', expiresAt: '2026-10-08', verificationStatus: 'independently_verified', fileName: 'chobe-public-liability-2025.pdf', fits: ['PL_INS'] },
    { id: 505, ...current, evidenceType: 'license', title: 'PPADB contractor registration, Code 2.4 (pipes and valves)', issuer: 'Public Procurement and Asset Disposal Board', referenceNumber: 'PPADB-2.4-01983', validFrom: '2025-04-01', expiresAt: '2027-03-31', verificationStatus: 'independently_verified', fileName: 'chobe-ppadb-registration.pdf', fits: ['LICENCE'] },
    { id: 506, ...current, evidenceType: 'reference', title: 'Schedule of pipeline and valve supply contracts 2020–2025', issuer: null, referenceNumber: null, validFrom: '2026-03-25', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'chobe-comparable-contracts.pdf', fits: ['REF_CONTRACTS'] },
    { id: 507, ...current, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', issuer: null, referenceNumber: null, validFrom: '2026-03-28', expiresAt: '2027-03-27', verificationStatus: 'supplier_provided', fileName: 'chobe-exclusion-declaration.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 508, ...current, evidenceType: 'reference', title: 'Client reference letters (Francistown City Council, Morupule Coal)', issuer: null, referenceNumber: null, validFrom: '2026-03-25', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'chobe-client-references.pdf', fits: ['CLIENT_REFS'] },
  ]),
  ...library(MAKGADIKGADI, [
    { id: 601, ...current, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00001177020', validFrom: '2018-01-22', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'makgadikgadi-cipa-certificate.pdf', fits: ['REG'] },
    { id: 602, ...current, evidenceType: 'financial_statement', title: 'Group consolidated management accounts FY2025 (Makgadikgadi Holdings)', issuer: 'Makgadikgadi Holdings finance office (unaudited)', referenceNumber: null, periodStart: '2025-01-01', periodEnd: '2025-12-31', reportingCurrency: 'BWP', isConsolidated: true, validFrom: '2026-03-10', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'makgadikgadi-holdings-management-accounts-2025.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 603, ...current, evidenceType: 'insurance', title: 'Public liability insurance certificate (Makgadikgadi Holdings group policy)', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2026-1120', coverageAmount: BWP('5000000.00'), validFrom: '2026-02-01', expiresAt: '2027-01-31', verificationStatus: 'supplier_provided', fileName: 'makgadikgadi-group-public-liability.pdf', fits: ['PL_INS'] },
    { id: 604, ...current, evidenceType: 'license', title: 'PPADB contractor registration, Grade OC (civil works)', issuer: 'Public Procurement and Asset Disposal Board', referenceNumber: 'PPADB-OC-11872', validFrom: '2025-10-01', expiresAt: '2027-09-30', verificationStatus: 'independently_verified', fileName: 'makgadikgadi-ppadb-registration.pdf', fits: ['LICENCE', 'CIV_GRADE'] },
    { id: 605, ...current, evidenceType: 'reference', title: 'Schedule of civil works contracts 2022–2026', issuer: null, referenceNumber: null, validFrom: '2026-08-28', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'makgadikgadi-comparable-contracts.pdf', fits: ['REF_CONTRACTS', 'PLANT'] },
    { id: 606, ...current, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', issuer: null, referenceNumber: null, validFrom: '2026-08-30', expiresAt: '2027-08-29', verificationStatus: 'supplier_provided', fileName: 'makgadikgadi-exclusion-declaration.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 607, ...current, evidenceType: 'reference', title: 'Client reference letter (Boteti Sub-District Council)', issuer: null, referenceNumber: null, validFrom: '2026-08-28', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'makgadikgadi-client-reference.pdf', fits: ['CLIENT_REFS'] },
    { id: 608, ...current, evidenceType: 'other', title: 'Insurer letter naming Makgadikgadi Civil Works as insured party', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-LTR-2026-0311', validFrom: '2026-09-25', expiresAt: '2027-01-31', verificationStatus: 'supplier_provided', fileName: 'makgadikgadi-insurer-letter.pdf', fits: ['PL_INS'] },
  ]),
  ...library(SEROWE, [
    { id: 701, ...current, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00000871455', validFrom: '2014-06-03', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'serowe-cipa-certificate.pdf', fits: ['REG'] },
    { id: 702, ...current, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'PwC Botswana', referenceNumber: null, periodStart: '2024-03-01', periodEnd: '2025-02-28', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-06-30', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'serowe-afs-fy2025.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 703, ...current, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'Bureau Veritas Certification', referenceNumber: 'BV-QMS-90544', validFrom: '2024-08-02', expiresAt: '2027-08-01', verificationStatus: 'independently_verified', fileName: 'serowe-iso9001.pdf', fits: ['ISO9001'] },
    { id: 704, ...current, evidenceType: 'certificate', title: 'ISO/IEC 27001:2022 certificate', issuer: 'BSI Group', referenceNumber: 'BSI-IS-771203', validFrom: '2025-01-15', expiresAt: '2028-01-14', verificationStatus: 'independently_verified', fileName: 'serowe-iso27001.pdf', fits: ['SEC_CERT'] },
    { id: 705, ...current, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PL-26-3380', coverageAmount: BWP('5000000.00'), validFrom: '2026-04-01', expiresAt: '2027-03-31', verificationStatus: 'supplier_provided', fileName: 'serowe-public-liability.pdf', fits: ['PL_INS'] },
    { id: 706, ...current, evidenceType: 'insurance', title: 'Professional indemnity insurance certificate', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PI-26-1191', coverageAmount: BWP('3000000.00'), validFrom: '2026-04-01', expiresAt: '2027-03-31', verificationStatus: 'supplier_provided', fileName: 'serowe-professional-indemnity.pdf', fits: ['PI_INS'] },
    { id: 707, ...current, evidenceType: 'reference', title: 'SCADA and telemetry project portfolio 2019–2025', issuer: null, referenceNumber: null, validFrom: '2025-12-15', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'serowe-scada-portfolio.pdf', fits: ['SCADA_EXP', 'REF_CONTRACTS'] },
    { id: 708, ...current, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', issuer: null, referenceNumber: null, validFrom: '2025-12-20', expiresAt: '2026-12-19', verificationStatus: 'supplier_provided', fileName: 'serowe-exclusion-declaration.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 709, ...current, evidenceType: 'reference', title: 'Client reference letters (BPC, Botswana Railways)', issuer: null, referenceNumber: null, validFrom: '2025-12-15', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'serowe-client-references.pdf', fits: ['CLIENT_REFS'] },
    { id: 710, ...current, evidenceType: 'financial_statement', title: 'Interim management accounts H1 2026', issuer: 'Serowe ICT Solutions finance office (unaudited)', referenceNumber: null, periodStart: '2026-03-01', periodEnd: '2026-08-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2026-09-12', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'serowe-interim-accounts-h1-2026.pdf', fits: ['FIN_STMT'] },
    { id: 711, status: 'replaced', evidenceType: 'insurance', title: 'Public liability insurance certificate (2025 policy)', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PL-25-2904', coverageAmount: BWP('5000000.00'), validFrom: '2025-04-01', expiresAt: '2026-03-31', verificationStatus: 'supplier_provided', fileName: 'serowe-public-liability-2025.pdf', fits: ['PL_INS'] },
    { id: 712, status: 'replaced', evidenceType: 'insurance', title: 'Professional indemnity insurance certificate (2025 policy)', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PI-25-0977', coverageAmount: BWP('3000000.00'), validFrom: '2025-04-01', expiresAt: '2026-03-31', verificationStatus: 'supplier_provided', fileName: 'serowe-professional-indemnity-2025.pdf', fits: ['PI_INS'] },
  ]),
  ...library(LIMPOPO, [
    { id: 801, ...current, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00000933104', validFrom: '2016-09-19', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'limpopo-cipa-certificate.pdf', fits: ['REG'] },
    { id: 802, ...current, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'Deloitte Botswana', referenceNumber: null, periodStart: '2024-10-01', periodEnd: '2025-09-30', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-11-20', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'limpopo-afs-fy2025.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 803, status: 'expired', evidenceType: 'license', title: 'Waste management licence', issuer: 'Department of Waste Management and Pollution Control', referenceNumber: 'DWMPC-WML-2023-0419', validFrom: '2023-09-06', expiresAt: '2026-09-05', verificationStatus: 'independently_verified', fileName: 'limpopo-waste-licence-2023.pdf', fits: ['WASTE_LICENCE'] },
    { id: 804, ...current, evidenceType: 'certificate', title: 'SADCAS laboratory accreditation (ISO/IEC 17025)', issuer: 'Southern African Development Community Accreditation Service', referenceNumber: 'SADCAS-TL-0112', validFrom: '2024-03-01', expiresAt: '2028-02-29', verificationStatus: 'independently_verified', fileName: 'limpopo-sadcas-accreditation.pdf', fits: ['LAB_ACCRED'] },
    { id: 805, ...current, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2026-0833', coverageAmount: BWP('5000000.00'), validFrom: '2026-01-01', expiresAt: '2026-12-31', verificationStatus: 'supplier_provided', fileName: 'limpopo-public-liability.pdf', fits: ['PL_INS'] },
    { id: 806, ...current, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', issuer: null, referenceNumber: null, validFrom: '2025-11-25', expiresAt: '2026-11-24', verificationStatus: 'supplier_provided', fileName: 'limpopo-exclusion-declaration.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 807, ...current, evidenceType: 'reference', title: 'Client reference letters (Department of Water and Sanitation, Orapa Mine)', issuer: null, referenceNumber: null, validFrom: '2025-11-20', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'limpopo-client-references.pdf', fits: ['CLIENT_REFS', 'REF_CONTRACTS'] },
    { id: 808, ...current, evidenceType: 'policy', title: 'Environmental, health and safety policy', issuer: null, referenceNumber: 'LES-EHS-01', validFrom: '2025-06-01', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'limpopo-ehs-policy.pdf', fits: ['ENV_POLICY'] },
    { id: 809, ...current, evidenceType: 'other', title: 'Licence renewal application acknowledgement', issuer: 'Department of Waste Management and Pollution Control', referenceNumber: 'DWMPC-REN-2026-0977', validFrom: '2026-09-18', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'limpopo-licence-renewal-acknowledgement.pdf', fits: ['WASTE_LICENCE'] },
    { id: 810, ...current, evidenceType: 'reference', title: 'Cleaning staff roster and supervision plan', issuer: null, referenceNumber: null, validFrom: '2026-04-10', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'limpopo-staffing-plan.pdf', fits: ['CLEAN_STAFF'] },
    { id: 811, status: 'replaced', evidenceType: 'insurance', title: 'Public liability insurance certificate (2025 policy)', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2025-0719', coverageAmount: BWP('5000000.00'), validFrom: '2025-01-01', expiresAt: '2025-12-31', verificationStatus: 'supplier_provided', fileName: 'limpopo-public-liability-2025.pdf', fits: ['PL_INS'] },
  ]),
  ...library(GABORONE_METER, [
    { id: 901, ...current, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00000650241', validFrom: '2011-05-17', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'gaborone-meter-cipa-certificate.pdf', fits: ['REG'] },
    { id: 902, ...current, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'Mazars Botswana', referenceNumber: null, periodStart: '2025-01-01', periodEnd: '2025-12-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2026-04-28', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'gaborone-meter-afs-fy2025.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 903, ...current, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'SGS South Africa', referenceNumber: 'SGS-ZA-QMS-38852', validFrom: '2025-02-10', expiresAt: '2028-02-09', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-iso9001.pdf', fits: ['ISO9001'] },
    { id: 904, ...current, evidenceType: 'certificate', title: 'BOBS type approval for smart water meters (DN15–DN50)', issuer: 'Botswana Bureau of Standards', referenceNumber: 'BOBS-TA-2025-044', validFrom: '2025-02-01', expiresAt: '2027-01-31', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-bobs-type-approval.pdf', fits: ['METER_APPROVAL'] },
    { id: 905, ...current, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Botswana Insurance Company', referenceNumber: 'BIC-PL-26-02210', coverageAmount: BWP('5000000.00'), validFrom: '2026-05-01', expiresAt: '2027-04-30', verificationStatus: 'supplier_provided', fileName: 'gaborone-meter-public-liability.pdf', fits: ['PL_INS'] },
    { id: 906, ...current, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', issuer: null, referenceNumber: null, validFrom: '2026-09-15', expiresAt: '2027-09-14', verificationStatus: 'supplier_provided', fileName: 'gaborone-meter-exclusion-declaration.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 907, ...current, evidenceType: 'reference', title: 'Schedule of meter supply and installation contracts 2020–2026', issuer: null, referenceNumber: null, validFrom: '2026-09-15', expiresAt: null, verificationStatus: 'supplier_provided', fileName: 'gaborone-meter-comparable-contracts.pdf', fits: ['REF_CONTRACTS'] },
    { id: 908, ...current, evidenceType: 'reference', title: 'Client reference letters (Gaborone City Council, Lobatse Town Council)', issuer: null, referenceNumber: null, validFrom: '2026-09-15', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'gaborone-meter-client-references.pdf', fits: ['CLIENT_REFS'] },
    { id: 909, status: 'replaced', evidenceType: 'financial_statement', title: 'Audited financial statements FY2023', issuer: 'Mazars Botswana', referenceNumber: null, periodStart: '2023-01-01', periodEnd: '2023-12-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2024-04-30', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'gaborone-meter-afs-fy2023.pdf', fits: ['FIN_STMT', 'FIN_RATIO'] },
    { id: 910, status: 'replaced', evidenceType: 'insurance', title: 'Public liability insurance certificate (2024 policy)', issuer: 'Botswana Insurance Company', referenceNumber: 'BIC-PL-24-01877', coverageAmount: BWP('3000000.00'), validFrom: '2024-05-01', expiresAt: '2025-04-30', verificationStatus: 'supplier_provided', fileName: 'gaborone-meter-public-liability-2024.pdf', fits: ['PL_INS'] },
    { id: 911, status: 'replaced', evidenceType: 'certificate', title: 'BOBS type approval for water meters (2022)', issuer: 'Botswana Bureau of Standards', referenceNumber: 'BOBS-TA-2022-017', validFrom: '2022-02-01', expiresAt: '2025-01-31', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-bobs-type-approval-2022.pdf', fits: ['METER_APPROVAL'] },
    { id: 912, status: 'replaced', evidenceType: 'certificate', title: 'ISO 9001:2015 certificate (2022 cycle)', issuer: 'SGS South Africa', referenceNumber: 'SGS-ZA-QMS-31170', validFrom: '2022-01-20', expiresAt: '2025-01-19', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-iso9001-2022.pdf', fits: ['ISO9001'] },
    { id: 913, status: 'replaced', evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment (2024)', issuer: null, referenceNumber: null, validFrom: '2024-07-01', expiresAt: '2025-06-30', verificationStatus: 'supplier_provided', fileName: 'gaborone-meter-exclusion-declaration-2024.pdf', fits: ['NO_EXCL', 'OWN'] },
    { id: 914, status: 'replaced', evidenceType: 'reference', title: 'Client reference letter (Gaborone City Council, 2024)', issuer: null, referenceNumber: null, validFrom: '2024-06-20', expiresAt: null, verificationStatus: 'independently_verified', fileName: 'gaborone-meter-client-reference-2024.pdf', fits: ['CLIENT_REFS', 'REF_CONTRACTS'] },
  ]),
]);

// ---------------------------------------------------------------------------------------------------------
// Declared conflicts of buyer personnel with suppliers (blueprint `conflict_declarations`, DD-25)
// ---------------------------------------------------------------------------------------------------------

export interface FxConflict {
  readonly tenantId: number;
  readonly userId: number;
  readonly supplierTenantId: number;
  readonly nature: string;
}

/** Lesego Seretse declared a personal relationship with Gaborone Metering: she cannot review its applications. */
export const QUALIFICATION_CONFLICTS: readonly FxConflict[] = Object.freeze([
  { tenantId: KWU, userId: USERS.lesego, supplierTenantId: GABORONE_METER, nature: 'personal_relationship' },
]);

/** Document ids of evidence files (the documents service owns them; stable derivation for the prototype). */
export function evidenceDocumentIds(evidenceItemId: number): { documentId: number; documentVersionId: number } {
  return { documentId: 40000 + evidenceItemId, documentVersionId: 50000 + evidenceItemId };
}

export function findEvidenceItem(evidenceItemId: number): FxEvidenceItem | undefined {
  return EVIDENCE_ITEMS.find((item) => item.id === evidenceItemId);
}
