/**
 * Operations fixtures: import batches and proposed records (ADM-16).
 *
 * Storyline anchor: contracts C-2025-0007 (legacy meter reading), C-2025-0003 and C-2025-0005 were imported from the
 * origin "Legacy spreadsheet 2025" with their original business dates (batch 1, derived from the contracts fixture). KWU is reviewing a supplier register export with duplicate
 * candidates for Tsodilo and Chobe Pipe and a row missing evidence (batch 2); a tender-history batch was partially
 * accepted (batch 3) and a duplicate upload rejected (batch 4). ODC has an uploaded batch not yet reviewed (batch 5) and imported C-2025-0004 (batch 6).
 */
import type { ImportBatchesRecordType, ImportBatchesStatus, ImportRecordsDecision } from '../../../contracts/enums.js';
import type { ImportCreatedEntityType } from '../../../contracts/operations.js';
import { CONTRACTS, CONTRACT_IDS } from '../contracts/index.js';
import { TENANTS, TENANT_IDS } from '../platform.js';
import { OPS_USERS } from './users.js';

export interface FixtureImportBatch {
  readonly id: number;
  readonly tenantId: number;
  readonly origin: string;
  readonly recordType: ImportBatchesRecordType;
  readonly status: ImportBatchesStatus;
  readonly sourceFileName: string;
  readonly documentId: number | null;
  readonly uploadedByUserId: number;
  readonly uploadedAt: string;
  readonly reviewedByUserId: number | null;
  readonly completedAt: string | null;
  readonly provenanceNote: string;
  readonly reviewNote: string | null;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

export const IMPORT_BATCHES: readonly FixtureImportBatch[] = Object.freeze([
  {
    id: 1,
    tenantId: KWU,
    origin: 'Legacy spreadsheet 2025',
    recordType: 'contract',
    status: 'accepted',
    sourceFileName: 'contracts-register-2025.xlsx',
    documentId: 16001,
    uploadedByUserId: OPS_USERS.masegoContracts,
    uploadedAt: '2026-02-18T08:30:00Z',
    reviewedByUserId: OPS_USERS.mphoManager,
    completedAt: '2026-02-20T11:00:00Z',
    provenanceNote: 'Contracts register maintained by the contracts office in 2025 (spreadsheet, last edited 31 Dec 2025).',
    reviewNote: 'Every row checked against the signed paper originals held by the contracts office.',
  },
  {
    id: 2,
    tenantId: KWU,
    origin: 'Supplier register export (Finance, Aug 2026)',
    recordType: 'supplier',
    status: 'reviewing',
    sourceFileName: 'vendor-export-2026-08.csv',
    documentId: 16002,
    uploadedByUserId: OPS_USERS.tebogoOfficer,
    uploadedAt: '2026-09-21T07:45:00Z',
    reviewedByUserId: null,
    completedAt: null,
    provenanceNote: 'Export of active vendors from the KWU finance vendor master on 31 Aug 2026.',
    reviewNote: null,
  },
  {
    id: 3,
    tenantId: KWU,
    origin: 'Procurement register 2024–2025',
    recordType: 'tender_history',
    status: 'partially_accepted',
    sourceFileName: 'procurement-register-2024-2025.xlsx',
    documentId: 16003,
    uploadedByUserId: OPS_USERS.tebogoOfficer,
    uploadedAt: '2026-03-10T09:00:00Z',
    reviewedByUserId: OPS_USERS.mphoManager,
    completedAt: '2026-03-12T15:40:00Z',
    provenanceNote: 'Manual procurement register of the procurement office for 2024 and 2025 events.',
    reviewNote: 'One row rejected: award value missing and no award report on file.',
  },
  {
    id: 4,
    tenantId: KWU,
    origin: 'Contracts register (second upload)',
    recordType: 'contract',
    status: 'rejected',
    sourceFileName: 'contracts-register-2025 (1).xlsx',
    documentId: 16004,
    uploadedByUserId: OPS_USERS.masegoContracts,
    uploadedAt: '2026-02-19T10:00:00Z',
    reviewedByUserId: OPS_USERS.mphoManager,
    completedAt: '2026-02-19T12:00:00Z',
    provenanceNote: 'Accidental second upload of the 2025 contracts register.',
    reviewNote: 'Duplicate of batch 1; every row rejected.',
  },
  {
    id: 5,
    tenantId: ODC,
    origin: 'ODC supplier list 2025',
    recordType: 'supplier',
    status: 'uploaded',
    sourceFileName: 'odc-suppliers-2025.csv',
    documentId: 16005,
    uploadedByUserId: OPS_USERS.officerOdc,
    uploadedAt: '2026-09-26T08:00:00Z',
    reviewedByUserId: null,
    completedAt: null,
    provenanceNote: 'Council supplier list maintained by the procurement unit in 2025.',
    reviewNote: null,
  },
  {
    id: 6,
    tenantId: ODC,
    origin: 'Council contract register 2025',
    recordType: 'contract',
    status: 'accepted',
    sourceFileName: 'odc-contract-register-2025.xlsx',
    documentId: 16006,
    uploadedByUserId: OPS_USERS.officerOdc,
    uploadedAt: '2026-03-04T08:00:00Z',
    reviewedByUserId: OPS_USERS.adminOdc,
    completedAt: '2026-03-05T09:00:00Z',
    provenanceNote: 'Contract register of the council procurement unit (2025).',
    reviewNote: 'Checked against the signed originals.',
  },
] satisfies FixtureImportBatch[]);

export interface FixtureImportRecord {
  readonly id: number;
  readonly batchId: number;
  readonly rowNo: number;
  readonly label: string;
  readonly raw: Readonly<Record<string, string | number | null>>;
  readonly originalBusinessDate: string | null;
  readonly qualityIssues: readonly string[];
  readonly duplicateCandidateTenantId: number | null;
  readonly duplicateReason: string | null;
  readonly decision: ImportRecordsDecision;
  readonly decidedByUserId: number | null;
  readonly decidedAt: string | null;
  readonly decisionReason: string | null;
  readonly createdEntityType: ImportCreatedEntityType | null;
  readonly createdEntityId: number | null;
  readonly createdEntityLabel: string | null;
  readonly provenanceNote: string | null;
}

/** The raw row and label of an imported legacy contract, from the contracts fixture (one world). */
function legacyRaw(contractId: number): Pick<FixtureImportRecord, 'label' | 'raw' | 'originalBusinessDate'> {
  const contract = CONTRACTS.find((row) => row.id === contractId);
  if (contract === undefined) {
    throw new Error(`Contract ${contractId} is missing from the contracts fixture.`);
  }
  const supplier = TENANTS.find((tenant) => tenant.id === contract.supplierTenantId);
  return {
    label: `${contract.title} (${supplier?.name ?? 'unknown supplier'})`,
    raw: {
      contract_no: contract.reference,
      title: contract.title,
      supplier: supplier?.legalName ?? null,
      value: contract.value.amount,
      currency: contract.value.currency,
      start: contract.termStart,
      end: contract.termEnd,
    },
    originalBusinessDate: contract.originalBusinessDate,
  };
}

/** Accepted rows of a contract import: every contract of the tenant imported from `origin` (contracts fixture). */
function legacyContractRows(batchId: number, tenantId: number, origin: string, decidedByUserId: number, decidedAt: string): FixtureImportRecord[] {
  return CONTRACTS.filter((contract) => contract.tenantId === tenantId && contract.origin === origin).map((contract, index) => ({
    ...legacyRaw(contract.id),
    id: batchId * 100 + index + 1,
    batchId,
    rowNo: index + 1,
    qualityIssues: [],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'accepted',
    decidedByUserId,
    decidedAt,
    decisionReason: 'Matches the signed original held by the contracts office.',
    createdEntityType: 'contract',
    createdEntityId: contract.id,
    createdEntityLabel: contract.reference,
    provenanceNote: `Imported from "${origin}", row ${index + 1}; original business date ${contract.originalBusinessDate ?? 'not recorded'}.`,
  }));
}

export const IMPORT_RECORDS: readonly FixtureImportRecord[] = Object.freeze([
  ...legacyContractRows(1, KWU, 'Legacy spreadsheet 2025', OPS_USERS.mphoManager, '2026-02-20T10:30:00Z'),
  {
    id: 201,
    batchId: 2,
    rowNo: 1,
    label: 'Tsodilo Engineering',
    raw: { vendor_no: 'V-10442', name: 'Tsodilo Engineering', reg_no: 'BW00001234567', email: 'accounts@tsodilo.example' },
    originalBusinessDate: '2019-05-02',
    qualityIssues: [],
    duplicateCandidateTenantId: TENANT_IDS.tsodilo,
    duplicateReason: 'Same registration number as the registered organization Tsodilo Engineering (Pty) Ltd.',
    decision: 'pending',
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    id: 202,
    batchId: 2,
    rowNo: 2,
    label: 'Chobe Pipe and Valve',
    raw: { vendor_no: 'V-10518', name: 'Chobe Pipe and Valve', reg_no: null, email: 'sales@chobepipe.example' },
    originalBusinessDate: '2021-02-11',
    qualityIssues: ['Registration number missing'],
    duplicateCandidateTenantId: TENANT_IDS['chobe-pipe'],
    duplicateReason: 'Similar name and the same e-mail domain as Chobe Pipe & Valve Supplies.',
    decision: 'pending',
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    id: 203,
    batchId: 2,
    rowNo: 3,
    label: 'Kgalagadi Borehole Drilling',
    raw: { vendor_no: 'V-10602', name: 'Kgalagadi Borehole Drilling', reg_no: 'BW00009876543', email: null },
    originalBusinessDate: '2022-08-19',
    qualityIssues: ['Contact e-mail missing', 'Missing evidence: tax clearance certificate'],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'pending',
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    id: 204,
    batchId: 2,
    rowNo: 4,
    label: 'Maun Electrical Contractors',
    raw: { vendor_no: 'V-10655', name: 'Maun Electrical Contractors', reg_no: 'BW00008765432', email: 'office@maunelectrical.example' },
    originalBusinessDate: '2023-04-03',
    qualityIssues: [],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'pending',
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    id: 205,
    batchId: 2,
    rowNo: 5,
    label: 'Tsodilo Engineering (Pty) Ltd',
    raw: { vendor_no: 'V-10442-B', name: 'Tsodilo Engineering (Pty) Ltd', reg_no: 'BW00001234567', email: 'accounts@tsodilo.example' },
    originalBusinessDate: '2019-05-02',
    qualityIssues: ['Duplicate of row 1 within the file'],
    duplicateCandidateTenantId: TENANT_IDS.tsodilo,
    duplicateReason: 'Same registration number as the registered organization Tsodilo Engineering (Pty) Ltd.',
    decision: 'rejected',
    decidedByUserId: OPS_USERS.tebogoOfficer,
    decidedAt: '2026-09-22T08:00:00Z',
    decisionReason: 'Duplicate row of the same vendor in the export.',
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    id: 301,
    batchId: 3,
    rowNo: 1,
    label: 'T-2025-0014 Water tanker hire (awarded)',
    raw: { ref: 'T-2025-0014', title: 'Water tanker hire', awarded_to: 'Makgadikgadi Civil Works', award_bwp: '215000.00', award_date: '2025-02-14' },
    originalBusinessDate: '2025-02-14',
    qualityIssues: [],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'accepted',
    decidedByUserId: OPS_USERS.mphoManager,
    decidedAt: '2026-03-12T15:00:00Z',
    decisionReason: 'Award report on file.',
    createdEntityType: 'historical_tender',
    createdEntityId: 7014,
    createdEntityLabel: 'T-2025-0014',
    provenanceNote: 'Imported from "Procurement register 2024–2025", row 1; awarded 14 Feb 2025.',
  },
  {
    id: 302,
    batchId: 3,
    rowNo: 2,
    label: 'T-2025-0021 Chemical storage tanks (cancelled)',
    raw: { ref: 'T-2025-0021', title: 'Chemical storage tanks', awarded_to: null, award_bwp: null, award_date: null },
    originalBusinessDate: '2025-05-30',
    qualityIssues: [],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'accepted',
    decidedByUserId: OPS_USERS.mphoManager,
    decidedAt: '2026-03-12T15:10:00Z',
    decisionReason: 'Cancellation memo on file.',
    createdEntityType: 'historical_tender',
    createdEntityId: 7021,
    createdEntityLabel: 'T-2025-0021',
    provenanceNote: 'Imported from "Procurement register 2024–2025", row 2; cancelled 30 May 2025.',
  },
  {
    id: 303,
    batchId: 3,
    rowNo: 3,
    label: 'T-2024-0033 Pump spares (awarded)',
    raw: { ref: 'T-2024-0033', title: 'Pump spares', awarded_to: 'Tsodilo Engineering', award_bwp: null, award_date: '2024-11-08' },
    originalBusinessDate: '2024-11-08',
    qualityIssues: ['Award value missing', 'Missing evidence: award report'],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'rejected',
    decidedByUserId: OPS_USERS.mphoManager,
    decidedAt: '2026-03-12T15:30:00Z',
    decisionReason: 'Award value missing and no award report on file; to be re-imported when found.',
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    ...legacyRaw(CONTRACT_IDS.legacyMeter),
    id: 401,
    batchId: 4,
    rowNo: 1,
    qualityIssues: ['Already imported in batch 1'],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'rejected',
    decidedByUserId: OPS_USERS.mphoManager,
    decidedAt: '2026-02-19T12:00:00Z',
    decisionReason: 'Duplicate upload.',
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    id: 501,
    batchId: 5,
    rowNo: 1,
    label: 'Limpopo Environmental Services',
    raw: { supplier_no: 'ODC-S-031', name: 'Limpopo Environmental Services', reg_no: 'BW00005678901' },
    originalBusinessDate: '2024-07-01',
    qualityIssues: [],
    duplicateCandidateTenantId: TENANT_IDS['limpopo-env'],
    duplicateReason: 'Same registration number as the registered organization Limpopo Environmental Services (Pty) Ltd.',
    decision: 'pending',
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  {
    id: 502,
    batchId: 5,
    rowNo: 2,
    label: 'Shakawe Hygiene Supplies',
    raw: { supplier_no: 'ODC-S-044', name: 'Shakawe Hygiene Supplies', reg_no: null },
    originalBusinessDate: '2025-03-14',
    qualityIssues: ['Registration number missing'],
    duplicateCandidateTenantId: null,
    duplicateReason: null,
    decision: 'pending',
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    createdEntityType: null,
    createdEntityId: null,
    createdEntityLabel: null,
    provenanceNote: null,
  },
  ...legacyContractRows(6, ODC, 'Council contract register 2025', OPS_USERS.adminOdc, '2026-03-05T09:00:00Z'),
] satisfies FixtureImportRecord[]);
