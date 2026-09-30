/**
 * The evidence libraries of the supplier organizations (`evidence_items` [T], tenant = supplier; SUP-05, FR-02, BR-25):
 * the SINGLE source of evidence items for the demo world. Other domains (qualification applications, bid answers)
 * cite these ids; `cross-domain.test.ts` checks that they agree.
 *
 * - Ids follow `supplierTenantId * 100 + n` (Tsodilo 401…, Chobe 501…, Makgadikgadi 601…, Serowe 701…, Limpopo 801…,
 *   Gaborone Metering 901…), the numbering the qualification and bids fixtures already use.
 * - Editions: `replacedById` is `evidence_items.replaced_by_id`; `editionNo` and `replacesId` are DERIVED from that
 *   chain here, as Stage B derives them. Replacing or renewing never rewrites the older edition; formal submissions
 *   keep pointing at the edition that was used.
 * - Registration certificates carry the registration numbers and incorporation dates of the organization profiles.
 * - Storyline anchors: Chobe's public liability insurance expires 2026-10-08 (AC-09); Makgadikgadi's financial
 *   evidence is unaudited group-consolidated management accounts and it holds no ISO 9001 certificate (AC-08, AC-17);
 *   Limpopo's waste management licence lapsed on 2026-09-05 (its renewal acknowledgement is item 809).
 * - Financial statements have `financial` sensitivity: only `supplier.financial.view` (supplier side) and
 *   `qualification.financial_review` (buyer side) see them (PRD §4.3).
 * - Pure module (it imports only the platform fixture), so any fixture domain may import it without a cycle.
 */
import type { NonNegativeMoney } from '../../../contracts/common.js';
import type {
  EvidenceItemsEvidenceType,
  EvidenceItemsSensitivity,
  EvidenceItemsStatus,
  EvidenceItemsVerificationStatus,
} from '../../../contracts/enums.js';
import type { EvidenceDocumentRef } from '../../../contracts/suppliers.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureEvidenceItem {
  readonly id: number;
  /** Supplier tenant that owns the library. */
  readonly tenantId: number;
  readonly evidenceType: EvidenceItemsEvidenceType;
  readonly title: string;
  readonly issuer: string | null;
  readonly referenceNumber: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly reportingCurrency: string | null;
  readonly isConsolidated: boolean | null;
  readonly coverage: NonNegativeMoney | null;
  readonly validFrom: string | null;
  readonly expiresAt: string | null;
  readonly status: EvidenceItemsStatus;
  readonly verificationStatus: EvidenceItemsVerificationStatus;
  readonly sensitivity: EvidenceItemsSensitivity;
  /** Derived from the `replacedById` chain. */
  readonly editionNo: number;
  /** Derived from the `replacedById` chain. */
  readonly replacesId: number | null;
  readonly replacedById: number | null;
  readonly document: EvidenceDocumentRef | null;
  readonly createdByUserId: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const BWP = (amount: string): NonNegativeMoney => ({ amount, currency: 'BWP' });

type OptionalField =
  | 'issuer'
  | 'referenceNumber'
  | 'periodStart'
  | 'periodEnd'
  | 'reportingCurrency'
  | 'isConsolidated'
  | 'coverage'
  | 'validFrom'
  | 'expiresAt'
  | 'status'
  | 'verificationStatus'
  | 'sensitivity'
  | 'replacedById'
  | 'updatedAt';

type ItemSpec = Pick<FixtureEvidenceItem, 'id' | 'evidenceType' | 'title' | 'createdByUserId' | 'createdAt'> &
  Partial<Pick<FixtureEvidenceItem, OptionalField>> & { readonly fileName: string };

type BaseItem = Omit<FixtureEvidenceItem, 'editionNo' | 'replacesId'>;

function itemsOf(tenantId: number, specs: readonly ItemSpec[]): BaseItem[] {
  return specs.map(({ fileName, ...spec }) => ({
    tenantId,
    issuer: null,
    referenceNumber: null,
    periodStart: null,
    periodEnd: null,
    reportingCurrency: null,
    isConsolidated: null,
    coverage: null,
    validFrom: null,
    expiresAt: null,
    status: 'current',
    verificationStatus: 'supplier_provided',
    sensitivity: 'general',
    replacedById: null,
    updatedAt: spec.createdAt,
    ...spec,
    document: { documentId: 40000 + spec.id, fileName, versionNo: 1 },
  }));
}

const TSODILO = TENANT_IDS.tsodilo;
const CHOBE = TENANT_IDS['chobe-pipe'];
const MAKGADIKGADI = TENANT_IDS.makgadikgadi;
const SEROWE = TENANT_IDS['serowe-ict'];
const LIMPOPO = TENANT_IDS['limpopo-env'];
const GABORONE_METER = TENANT_IDS['gaborone-meter'];

const BASE_ITEMS: readonly BaseItem[] = [
  ...itemsOf(TSODILO, [
    { id: 401, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00001234567', validFrom: '2009-03-02', verificationStatus: 'independently_verified', fileName: 'tsodilo-cipa-certificate.pdf', createdByUserId: 24, createdAt: '2025-10-06T08:12:00Z' },
    { id: 402, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'KPMG Botswana', periodStart: '2024-07-01', periodEnd: '2025-06-30', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-09-30', verificationStatus: 'independently_verified', sensitivity: 'financial', fileName: 'tsodilo-afs-fy2025.pdf', createdByUserId: 27, createdAt: '2025-10-06T08:12:00Z' },
    { id: 403, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'Bureau Veritas Certification', referenceNumber: 'BV-QMS-88213', validFrom: '2024-05-15', expiresAt: '2027-05-14', verificationStatus: 'independently_verified', fileName: 'tsodilo-iso9001.pdf', createdByUserId: 24, createdAt: '2025-10-06T08:12:00Z' },
    { id: 404, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2026-0457', coverage: BWP('10000000.00'), validFrom: '2026-03-01', expiresAt: '2027-02-28', fileName: 'tsodilo-public-liability-2026.pdf', createdByUserId: 24, createdAt: '2026-03-01T08:00:00Z' },
    { id: 405, evidenceType: 'license', title: 'PPADB contractor registration, Code 2.2 (mechanical works)', issuer: 'Public Procurement and Asset Disposal Board', referenceNumber: 'PPADB-2.2-04417', validFrom: '2025-07-01', expiresAt: '2027-06-30', verificationStatus: 'independently_verified', fileName: 'tsodilo-ppadb-registration.pdf', createdByUserId: 24, createdAt: '2025-10-06T08:12:00Z' },
    { id: 406, evidenceType: 'reference', title: 'Schedule of comparable contracts 2021–2025', validFrom: '2026-01-10', fileName: 'tsodilo-comparable-contracts.pdf', createdByUserId: 24, createdAt: '2026-02-10T08:00:00Z' },
    { id: 407, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', validFrom: '2026-03-18', expiresAt: '2027-03-17', fileName: 'tsodilo-exclusion-declaration.pdf', createdByUserId: 24, createdAt: '2026-03-18T08:00:00Z' },
    { id: 408, evidenceType: 'policy', title: 'Environmental management policy', referenceNumber: 'TE-POL-ENV-03', validFrom: '2025-02-01', fileName: 'tsodilo-environmental-policy.pdf', createdByUserId: 24, createdAt: '2026-02-10T08:00:00Z' },
    { id: 409, evidenceType: 'reference', title: 'Client reference letters (Water Utilities Corporation, Debswana)', validFrom: '2026-02-20', verificationStatus: 'independently_verified', fileName: 'tsodilo-client-references.pdf', createdByUserId: 24, createdAt: '2026-02-20T08:00:00Z' },
    { id: 410, evidenceType: 'financial_statement', title: 'Audited financial statements FY2024', issuer: 'KPMG Botswana', periodStart: '2023-07-01', periodEnd: '2024-06-30', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2024-10-15', status: 'replaced', verificationStatus: 'independently_verified', sensitivity: 'financial', replacedById: 402, fileName: 'tsodilo-afs-fy2024.pdf', createdByUserId: 27, createdAt: '2025-10-05T08:12:00Z', updatedAt: '2025-10-06T08:12:00Z' },
    { id: 411, evidenceType: 'insurance', title: 'Public liability insurance certificate (2025 policy)', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2025-0391', coverage: BWP('10000000.00'), validFrom: '2025-03-01', expiresAt: '2026-02-28', status: 'replaced', replacedById: 404, fileName: 'tsodilo-public-liability-2025.pdf', createdByUserId: 24, createdAt: '2025-10-06T08:12:00Z', updatedAt: '2026-03-01T08:00:00Z' },
    { id: 412, evidenceType: 'reference', title: 'Schedule of comparable contracts 2020–2024', validFrom: '2025-06-01', status: 'replaced', replacedById: 406, fileName: 'tsodilo-comparable-contracts-2024.pdf', createdByUserId: 24, createdAt: '2025-10-06T08:12:00Z', updatedAt: '2026-02-10T08:00:00Z' },
    { id: 413, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment (2025)', validFrom: '2025-09-20', expiresAt: '2026-09-19', status: 'replaced', replacedById: 407, fileName: 'tsodilo-exclusion-declaration-2025.pdf', createdByUserId: 24, createdAt: '2025-10-06T08:12:00Z', updatedAt: '2026-03-18T08:00:00Z' },
    { id: 414, evidenceType: 'reference', title: 'Client reference letter (Water Utilities Corporation, 2025)', validFrom: '2025-08-10', status: 'replaced', replacedById: 409, fileName: 'tsodilo-client-reference-2025.pdf', createdByUserId: 24, createdAt: '2025-10-06T08:12:00Z', updatedAt: '2026-02-20T08:00:00Z' },
    { id: 415, evidenceType: 'certificate', title: 'ISO/IEC 27001:2022 certificate (remote monitoring service)', issuer: 'BSI Group', referenceNumber: 'BSI-IS-802277', validFrom: '2025-11-03', expiresAt: '2028-11-02', verificationStatus: 'independently_verified', fileName: 'tsodilo-iso27001.pdf', createdByUserId: 24, createdAt: '2026-02-10T08:00:00Z' },
    { id: 416, evidenceType: 'reference', title: 'Pump-station telemetry integration projects 2022–2026', validFrom: '2026-09-01', fileName: 'tsodilo-telemetry-projects.pdf', createdByUserId: 24, createdAt: '2026-09-01T08:00:00Z' },
    { id: 417, evidenceType: 'registration', title: 'Certificate of change of name', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00001234567/CN1', validFrom: '2026-03-30', verificationStatus: 'independently_verified', fileName: 'tsodilo-cipa-change-of-name.pdf', createdByUserId: 24, createdAt: '2026-03-30T09:00:00Z' },
    { id: 418, evidenceType: 'certificate', title: 'Tax clearance certificate', issuer: 'Botswana Unified Revenue Service', referenceNumber: 'TC-2026-118842', validFrom: '2026-01-15', expiresAt: '2026-12-31', fileName: 'tsodilo-burs-tax-clearance-2026.pdf', createdByUserId: 24, createdAt: '2026-02-11T09:20:00Z' },
    { id: 419, evidenceType: 'policy', title: 'Health, safety and environment policy (2023)', issuer: 'Tsodilo Engineering (Pty) Ltd', referenceNumber: 'TE-POL-HSE-01', validFrom: '2023-02-01', status: 'withdrawn', fileName: 'tsodilo-hse-policy-2023.pdf', createdByUserId: 24, createdAt: '2026-02-12T11:20:00Z', updatedAt: '2026-08-01T07:45:00Z' },
  ]),
  ...itemsOf(CHOBE, [
    { id: 501, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00002345678', validFrom: '2012-08-14', verificationStatus: 'independently_verified', fileName: 'chobe-cipa-certificate.pdf', createdByUserId: 28, createdAt: '2026-02-11T08:00:00Z' },
    { id: 502, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'Grant Thornton Botswana', periodStart: '2024-04-01', periodEnd: '2025-03-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-07-15', verificationStatus: 'independently_verified', sensitivity: 'financial', fileName: 'chobe-afs-fy2025.pdf', createdByUserId: 31, createdAt: '2026-02-11T08:00:00Z' },
    { id: 503, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'SGS South Africa', referenceNumber: 'SGS-ZA-QMS-40177', validFrom: '2023-12-02', expiresAt: '2026-12-01', verificationStatus: 'independently_verified', fileName: 'chobe-iso9001.pdf', createdByUserId: 28, createdAt: '2026-02-11T08:00:00Z' },
    { id: 504, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Botswana Insurance Company', referenceNumber: 'BIC-PL-25-10931', coverage: BWP('5000000.00'), validFrom: '2025-10-09', expiresAt: '2026-10-08', verificationStatus: 'independently_verified', fileName: 'chobe-public-liability-2025.pdf', createdByUserId: 28, createdAt: '2026-02-11T08:00:00Z' },
    { id: 505, evidenceType: 'license', title: 'PPADB contractor registration, Code 2.4 (pipes and valves)', issuer: 'Public Procurement and Asset Disposal Board', referenceNumber: 'PPADB-2.4-01983', validFrom: '2025-04-01', expiresAt: '2027-03-31', verificationStatus: 'independently_verified', fileName: 'chobe-ppadb-registration.pdf', createdByUserId: 28, createdAt: '2026-02-11T08:00:00Z' },
    { id: 506, evidenceType: 'reference', title: 'Schedule of pipeline and valve supply contracts 2020–2025', validFrom: '2026-03-25', fileName: 'chobe-comparable-contracts.pdf', createdByUserId: 28, createdAt: '2026-03-25T08:00:00Z' },
    { id: 507, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', validFrom: '2026-03-28', expiresAt: '2027-03-27', fileName: 'chobe-exclusion-declaration.pdf', createdByUserId: 28, createdAt: '2026-03-28T08:00:00Z' },
    { id: 508, evidenceType: 'reference', title: 'Client reference letters (Francistown City Council, Morupule Coal)', validFrom: '2026-03-25', verificationStatus: 'independently_verified', fileName: 'chobe-client-references.pdf', createdByUserId: 28, createdAt: '2026-03-25T08:00:00Z' },
  ]),
  ...itemsOf(MAKGADIKGADI, [
    { id: 601, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00003456789', validFrom: '2016-02-01', fileName: 'makgadikgadi-cipa-certificate.pdf', createdByUserId: 40, createdAt: '2026-03-03T08:00:00Z' },
    { id: 602, evidenceType: 'financial_statement', title: 'Group consolidated management accounts FY2025 (Makgadikgadi Holdings)', issuer: 'Makgadikgadi Holdings finance office (unaudited)', periodStart: '2025-01-01', periodEnd: '2025-12-31', reportingCurrency: 'BWP', isConsolidated: true, validFrom: '2026-03-10', sensitivity: 'financial', fileName: 'makgadikgadi-holdings-management-accounts-2025.pdf', createdByUserId: 40, createdAt: '2026-03-10T08:00:00Z' },
    { id: 603, evidenceType: 'insurance', title: 'Public liability insurance certificate (Makgadikgadi Holdings group policy)', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2026-1120', coverage: BWP('5000000.00'), validFrom: '2026-02-01', expiresAt: '2027-01-31', fileName: 'makgadikgadi-group-public-liability.pdf', createdByUserId: 40, createdAt: '2026-03-03T08:00:00Z' },
    { id: 604, evidenceType: 'license', title: 'PPADB contractor registration, Grade OC (civil works)', issuer: 'Public Procurement and Asset Disposal Board', referenceNumber: 'PPADB-OC-11872', validFrom: '2025-10-01', expiresAt: '2027-09-30', verificationStatus: 'independently_verified', fileName: 'makgadikgadi-ppadb-registration.pdf', createdByUserId: 40, createdAt: '2026-03-03T08:00:00Z' },
    { id: 605, evidenceType: 'reference', title: 'Schedule of civil works contracts 2022–2026', validFrom: '2026-08-28', fileName: 'makgadikgadi-comparable-contracts.pdf', createdByUserId: 40, createdAt: '2026-08-28T08:00:00Z' },
    { id: 606, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', validFrom: '2026-08-30', expiresAt: '2027-08-29', fileName: 'makgadikgadi-exclusion-declaration.pdf', createdByUserId: 40, createdAt: '2026-08-30T08:00:00Z' },
    { id: 607, evidenceType: 'reference', title: 'Client reference letter (Boteti Sub-District Council)', validFrom: '2026-08-28', fileName: 'makgadikgadi-client-reference.pdf', createdByUserId: 40, createdAt: '2026-08-28T08:00:00Z' },
    { id: 608, evidenceType: 'other', title: 'Insurer letter naming Makgadikgadi Civil Works as insured party', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-LTR-2026-0311', validFrom: '2026-09-25', expiresAt: '2027-01-31', fileName: 'makgadikgadi-insurer-letter.pdf', createdByUserId: 40, createdAt: '2026-09-25T08:00:00Z' },
  ]),
  ...itemsOf(SEROWE, [
    { id: 701, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00004567890', validFrom: '2018-05-21', verificationStatus: 'independently_verified', fileName: 'serowe-cipa-certificate.pdf', createdByUserId: 32, createdAt: '2026-01-08T06:55:00Z' },
    { id: 702, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'PwC Botswana', periodStart: '2024-03-01', periodEnd: '2025-02-28', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-06-30', verificationStatus: 'independently_verified', sensitivity: 'financial', fileName: 'serowe-afs-fy2025.pdf', createdByUserId: 35, createdAt: '2026-01-08T06:55:00Z' },
    { id: 703, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'Bureau Veritas Certification', referenceNumber: 'BV-QMS-90544', validFrom: '2024-08-02', expiresAt: '2027-08-01', verificationStatus: 'independently_verified', fileName: 'serowe-iso9001.pdf', createdByUserId: 32, createdAt: '2026-03-09T08:00:00Z' },
    { id: 704, evidenceType: 'certificate', title: 'ISO/IEC 27001:2022 certificate', issuer: 'BSI Group', referenceNumber: 'BSI-IS-771203', validFrom: '2025-01-15', expiresAt: '2028-01-14', verificationStatus: 'independently_verified', fileName: 'serowe-iso27001.pdf', createdByUserId: 32, createdAt: '2026-01-08T06:55:00Z' },
    { id: 705, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PL-26-3380', coverage: BWP('5000000.00'), validFrom: '2026-04-01', expiresAt: '2027-03-31', fileName: 'serowe-public-liability.pdf', createdByUserId: 32, createdAt: '2026-04-01T08:00:00Z' },
    { id: 706, evidenceType: 'insurance', title: 'Professional indemnity insurance certificate', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PI-26-1191', coverage: BWP('3000000.00'), validFrom: '2026-04-01', expiresAt: '2027-03-31', fileName: 'serowe-professional-indemnity.pdf', createdByUserId: 32, createdAt: '2026-04-01T08:00:00Z' },
    { id: 707, evidenceType: 'reference', title: 'SCADA and telemetry project portfolio 2019–2025', validFrom: '2025-12-15', fileName: 'serowe-scada-portfolio.pdf', createdByUserId: 32, createdAt: '2026-01-08T06:55:00Z' },
    { id: 708, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', validFrom: '2025-12-20', expiresAt: '2026-12-19', fileName: 'serowe-exclusion-declaration.pdf', createdByUserId: 32, createdAt: '2026-01-08T06:55:00Z' },
    { id: 709, evidenceType: 'reference', title: 'Client reference letters (BPC, Botswana Railways)', validFrom: '2025-12-15', verificationStatus: 'independently_verified', fileName: 'serowe-client-references.pdf', createdByUserId: 32, createdAt: '2026-01-08T06:55:00Z' },
    { id: 710, evidenceType: 'financial_statement', title: 'Interim management accounts H1 2026', issuer: 'Serowe ICT Solutions finance office (unaudited)', periodStart: '2026-03-01', periodEnd: '2026-08-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2026-09-12', sensitivity: 'financial', fileName: 'serowe-interim-accounts-h1-2026.pdf', createdByUserId: 35, createdAt: '2026-09-12T08:00:00Z' },
    { id: 711, evidenceType: 'insurance', title: 'Public liability insurance certificate (2025 policy)', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PL-25-2904', coverage: BWP('5000000.00'), validFrom: '2025-04-01', expiresAt: '2026-03-31', status: 'replaced', replacedById: 705, fileName: 'serowe-public-liability-2025.pdf', createdByUserId: 32, createdAt: '2026-01-08T06:55:00Z', updatedAt: '2026-04-01T08:00:00Z' },
    { id: 712, evidenceType: 'insurance', title: 'Professional indemnity insurance certificate (2025 policy)', issuer: 'Old Mutual Short-Term Insurance Botswana', referenceNumber: 'OM-PI-25-0977', coverage: BWP('3000000.00'), validFrom: '2025-04-01', expiresAt: '2026-03-31', status: 'replaced', replacedById: 706, fileName: 'serowe-professional-indemnity-2025.pdf', createdByUserId: 32, createdAt: '2026-01-08T06:55:00Z', updatedAt: '2026-04-01T08:00:00Z' },
  ]),
  ...itemsOf(LIMPOPO, [
    { id: 801, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00005678901', validFrom: '2014-09-09', verificationStatus: 'independently_verified', fileName: 'limpopo-cipa-certificate.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z' },
    { id: 802, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'Deloitte Botswana', periodStart: '2024-10-01', periodEnd: '2025-09-30', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2025-11-20', verificationStatus: 'independently_verified', sensitivity: 'financial', fileName: 'limpopo-afs-fy2025.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z' },
    { id: 803, evidenceType: 'license', title: 'Waste management licence', issuer: 'Department of Waste Management and Pollution Control', referenceNumber: 'DWMPC-WML-2023-0419', validFrom: '2023-09-06', expiresAt: '2026-09-05', status: 'expired', verificationStatus: 'independently_verified', fileName: 'limpopo-waste-licence-2023.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z' },
    { id: 804, evidenceType: 'certificate', title: 'SADCAS laboratory accreditation (ISO/IEC 17025)', issuer: 'Southern African Development Community Accreditation Service', referenceNumber: 'SADCAS-TL-0112', validFrom: '2024-03-01', expiresAt: '2028-02-29', verificationStatus: 'independently_verified', fileName: 'limpopo-sadcas-accreditation.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z' },
    { id: 805, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2026-0833', coverage: BWP('5000000.00'), validFrom: '2026-01-01', expiresAt: '2026-12-31', fileName: 'limpopo-public-liability.pdf', createdByUserId: 41, createdAt: '2026-03-16T08:00:00Z' },
    { id: 806, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', validFrom: '2025-11-25', expiresAt: '2026-11-24', fileName: 'limpopo-exclusion-declaration.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z' },
    { id: 807, evidenceType: 'reference', title: 'Client reference letters (Department of Water and Sanitation, Orapa Mine)', validFrom: '2025-11-20', verificationStatus: 'independently_verified', fileName: 'limpopo-client-references.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z' },
    { id: 808, evidenceType: 'policy', title: 'Environmental, health and safety policy', referenceNumber: 'LES-EHS-01', validFrom: '2025-06-01', fileName: 'limpopo-ehs-policy.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z' },
    { id: 809, evidenceType: 'other', title: 'Licence renewal application acknowledgement', issuer: 'Department of Waste Management and Pollution Control', referenceNumber: 'DWMPC-REN-2026-0977', validFrom: '2026-09-18', fileName: 'limpopo-licence-renewal-acknowledgement.pdf', createdByUserId: 41, createdAt: '2026-09-18T08:00:00Z' },
    { id: 810, evidenceType: 'reference', title: 'Cleaning staff roster and supervision plan', validFrom: '2026-04-10', fileName: 'limpopo-staffing-plan.pdf', createdByUserId: 41, createdAt: '2026-04-10T08:00:00Z' },
    { id: 811, evidenceType: 'insurance', title: 'Public liability insurance certificate (2025 policy)', issuer: 'Hollard Insurance Botswana', referenceNumber: 'HIB-PL-2025-0719', coverage: BWP('5000000.00'), validFrom: '2025-01-01', expiresAt: '2025-12-31', status: 'replaced', replacedById: 805, fileName: 'limpopo-public-liability-2025.pdf', createdByUserId: 41, createdAt: '2025-12-01T07:15:00Z', updatedAt: '2026-03-16T08:00:00Z' },
  ]),
  ...itemsOf(GABORONE_METER, [
    { id: 901, evidenceType: 'registration', title: 'Certificate of incorporation', issuer: 'Companies and Intellectual Property Authority (CIPA)', referenceNumber: 'BW00006789012', validFrom: '2011-01-17', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-cipa-certificate.pdf', createdByUserId: 36, createdAt: '2024-07-15T08:00:00Z' },
    { id: 902, evidenceType: 'financial_statement', title: 'Audited financial statements FY2025', issuer: 'Mazars Botswana', periodStart: '2025-01-01', periodEnd: '2025-12-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2026-04-28', verificationStatus: 'independently_verified', sensitivity: 'financial', fileName: 'gaborone-meter-afs-fy2025.pdf', createdByUserId: 39, createdAt: '2026-04-28T08:00:00Z' },
    { id: 903, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate', issuer: 'SGS South Africa', referenceNumber: 'SGS-ZA-QMS-38852', validFrom: '2025-02-10', expiresAt: '2028-02-09', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-iso9001.pdf', createdByUserId: 36, createdAt: '2026-03-23T08:00:00Z' },
    { id: 904, evidenceType: 'certificate', title: 'BOBS type approval for smart water meters (DN15–DN50)', issuer: 'Botswana Bureau of Standards', referenceNumber: 'BOBS-TA-2025-044', validFrom: '2025-02-01', expiresAt: '2027-01-31', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-bobs-type-approval.pdf', createdByUserId: 36, createdAt: '2026-03-23T08:00:00Z' },
    { id: 905, evidenceType: 'insurance', title: 'Public liability insurance certificate', issuer: 'Botswana Insurance Company', referenceNumber: 'BIC-PL-26-02210', coverage: BWP('5000000.00'), validFrom: '2026-05-01', expiresAt: '2027-04-30', fileName: 'gaborone-meter-public-liability.pdf', createdByUserId: 36, createdAt: '2026-05-01T08:00:00Z' },
    { id: 906, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment', validFrom: '2026-09-15', expiresAt: '2027-09-14', fileName: 'gaborone-meter-exclusion-declaration.pdf', createdByUserId: 36, createdAt: '2026-09-15T08:00:00Z' },
    { id: 907, evidenceType: 'reference', title: 'Schedule of meter supply and installation contracts 2020–2026', validFrom: '2026-09-15', fileName: 'gaborone-meter-comparable-contracts.pdf', createdByUserId: 36, createdAt: '2026-09-15T08:00:00Z' },
    { id: 908, evidenceType: 'reference', title: 'Client reference letters (Gaborone City Council, Lobatse Town Council)', validFrom: '2026-09-15', verificationStatus: 'independently_verified', fileName: 'gaborone-meter-client-references.pdf', createdByUserId: 36, createdAt: '2026-09-15T08:00:00Z' },
    { id: 909, evidenceType: 'financial_statement', title: 'Audited financial statements FY2023', issuer: 'Mazars Botswana', periodStart: '2023-01-01', periodEnd: '2023-12-31', reportingCurrency: 'BWP', isConsolidated: false, validFrom: '2024-04-30', status: 'replaced', verificationStatus: 'independently_verified', sensitivity: 'financial', replacedById: 902, fileName: 'gaborone-meter-afs-fy2023.pdf', createdByUserId: 39, createdAt: '2024-07-15T08:00:00Z', updatedAt: '2026-04-28T08:00:00Z' },
    { id: 910, evidenceType: 'insurance', title: 'Public liability insurance certificate (2024 policy)', issuer: 'Botswana Insurance Company', referenceNumber: 'BIC-PL-24-01877', coverage: BWP('3000000.00'), validFrom: '2024-05-01', expiresAt: '2025-04-30', status: 'replaced', replacedById: 905, fileName: 'gaborone-meter-public-liability-2024.pdf', createdByUserId: 36, createdAt: '2024-07-15T08:00:00Z', updatedAt: '2026-05-01T08:00:00Z' },
    { id: 911, evidenceType: 'certificate', title: 'BOBS type approval for water meters (2022)', issuer: 'Botswana Bureau of Standards', referenceNumber: 'BOBS-TA-2022-017', validFrom: '2022-02-01', expiresAt: '2025-01-31', status: 'replaced', verificationStatus: 'independently_verified', replacedById: 904, fileName: 'gaborone-meter-bobs-type-approval-2022.pdf', createdByUserId: 36, createdAt: '2024-07-15T08:00:00Z', updatedAt: '2026-03-23T08:00:00Z' },
    { id: 912, evidenceType: 'certificate', title: 'ISO 9001:2015 certificate (2022 cycle)', issuer: 'SGS South Africa', referenceNumber: 'SGS-ZA-QMS-31170', validFrom: '2022-01-20', expiresAt: '2025-01-19', status: 'replaced', verificationStatus: 'independently_verified', replacedById: 903, fileName: 'gaborone-meter-iso9001-2022.pdf', createdByUserId: 36, createdAt: '2024-07-15T08:00:00Z', updatedAt: '2026-03-23T08:00:00Z' },
    { id: 913, evidenceType: 'declaration', title: 'Declaration of no exclusion or debarment (2024)', validFrom: '2024-07-01', expiresAt: '2025-06-30', status: 'replaced', replacedById: 906, fileName: 'gaborone-meter-exclusion-declaration-2024.pdf', createdByUserId: 36, createdAt: '2024-07-15T08:00:00Z', updatedAt: '2026-09-15T08:00:00Z' },
    { id: 914, evidenceType: 'reference', title: 'Client reference letter (Gaborone City Council, 2024)', validFrom: '2024-06-20', status: 'replaced', verificationStatus: 'independently_verified', replacedById: 908, fileName: 'gaborone-meter-client-reference-2024.pdf', createdByUserId: 36, createdAt: '2024-07-15T08:00:00Z', updatedAt: '2026-09-15T08:00:00Z' },
    { id: 915, evidenceType: 'reference', title: 'Client reference — Lobatse meter replacement', issuer: 'Water Utilities Corporation', verificationStatus: 'verification_failed', fileName: 'gaborone-meter-reference-lobatse.pdf', createdByUserId: 37, createdAt: '2026-03-25T09:00:00Z', updatedAt: '2026-04-06T10:00:00Z' },
  ]),
];

/** New edition id → the edition it replaced (the inverse of `replacedById`). */
const replacesOf = new Map(BASE_ITEMS.flatMap((item) => (item.replacedById === null ? [] : [[item.replacedById, item.id] as const])));

function editionNoOf(id: number): number {
  let count = 1;
  let cursor = replacesOf.get(id);
  while (cursor !== undefined) {
    count += 1;
    cursor = replacesOf.get(cursor);
  }
  return count;
}

export const EVIDENCE_ITEMS: readonly FixtureEvidenceItem[] = Object.freeze(
  BASE_ITEMS.map((item) => ({ ...item, editionNo: editionNoOf(item.id), replacesId: replacesOf.get(item.id) ?? null })),
);

export function findEvidenceItem(id: number): FixtureEvidenceItem | undefined {
  return EVIDENCE_ITEMS.find((item) => item.id === id);
}
