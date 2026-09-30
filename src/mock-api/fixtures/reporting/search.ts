/**
 * Global search index and saved views (COM-08; DD-21; BR-43; blueprint `saved_views`).
 *
 * Every entry lives in the tenant where it is searched and names who may see it: any of `visibleWith` permissions in
 * that tenant, and, when `ownerUserIds` is set, only those people (own tasks, own requests). A supplier's entries
 * are its own opportunities, responses, contracts and evidence; it never gets another supplier's rows. The operator
 * tenant sees customer organizations as operational metadata only.
 */
import type { SearchResultType, SavedView } from '../../../contracts/reporting.js';
import type { EnumName } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { TENANT_IDS } from '../platform.js';
import { SUPPLIER_INVITATIONS, SUPPLIER_OUTCOMES, SUPPLIER_PURSUITS } from './dashboard.js';
import type { FixtureSupplierPursuit } from './dashboard.js';
import { KWU, LEGACY_TENDER_ID, LINKS, ODC, USERS, tenderFact } from './storyline.js';

export interface FixtureSearchEntry {
  readonly tenantId: number;
  readonly type: SearchResultType;
  readonly recordId: number;
  readonly title: string;
  readonly reference: string | null;
  readonly subtitle: string | null;
  readonly status: { readonly enum: EnumName; readonly value: string } | null;
  readonly to: string;
  readonly updatedAt: string;
  /** Extra words that match (category codes, supplier names), never shown. */
  readonly keywords: string;
  readonly visibleWith: readonly PermissionCode[];
  /** When set, only these people see the entry (own tasks, own requests). */
  readonly ownerUserIds: readonly number[] | null;
  /** People who see the entry whatever their permissions (the requester of a request). */
  readonly alsoVisibleTo: readonly number[];
}

type EntryInput = Omit<FixtureSearchEntry, 'ownerUserIds' | 'alsoVisibleTo' | 'keywords'> &
  Partial<Pick<FixtureSearchEntry, 'ownerUserIds' | 'alsoVisibleTo' | 'keywords'>>;

function entry(input: EntryInput): FixtureSearchEntry {
  return { ownerUserIds: null, alsoVisibleTo: [], keywords: '', ...input };
}

const tenderStatus = (value: string): FixtureSearchEntry['status'] => ({ enum: 'tenders.status', value });
const S = TENANT_IDS;

const STATIC_ENTRIES: readonly FixtureSearchEntry[] = [
  // --- KWU tenders (tender.view) ---
  entry({ tenantId: KWU, type: 'tender', recordId: 1, title: 'Borehole pump replacement programme', reference: 'T-2026-0001', subtitle: 'Tender · 3 lots · Technical Services', status: tenderStatus('partially_awarded'), to: LINKS.buyerTender(1), updatedAt: '2026-10-02T09:00:00Z', keywords: 'WTR-PUMP pumps wellfields', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 2, title: 'Smart water meter supply', reference: 'T-2026-0002', subtitle: 'RFQ · Network Operations', status: tenderStatus('open'), to: LINKS.buyerTender(2), updatedAt: '2026-10-03T11:30:00Z', keywords: 'WTR-METER meters water', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 3, title: 'SCADA telemetry upgrade', reference: 'T-2026-0003', subtitle: 'RFP · Technical Services', status: tenderStatus('under_assessment'), to: LINKS.buyerTender(3), updatedAt: '2026-10-01T15:10:00Z', keywords: 'ICT-SCADA telemetry', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 4, title: 'Leak-detection market consultation', reference: 'T-2026-0004', subtitle: 'RFI · Network Operations', status: tenderStatus('information_collected'), to: LINKS.buyerTender(4), updatedAt: '2026-05-20T10:00:00Z', keywords: 'SRV-LEAK leak water', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 5, title: 'Water treatment chemicals framework', reference: 'T-2026-0005', subtitle: 'Tender · Water Quality', status: tenderStatus('awaiting_release_approval'), to: LINKS.buyerTender(5), updatedAt: '2026-10-02T12:45:00Z', keywords: 'WTR-CHEM chemicals water', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 6, title: 'Chlorine dosing equipment', reference: 'T-2026-0006', subtitle: 'RFQ · invitation only · Water Quality', status: tenderStatus('open'), to: LINKS.buyerTender(6), updatedAt: '2026-10-01T08:20:00Z', keywords: 'WTR-CHEM chlorine water', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 7, title: 'Reservoir rehabilitation works', reference: 'T-2026-0007', subtitle: 'Tender · Operations', status: tenderStatus('award_pending'), to: LINKS.buyerTender(7), updatedAt: '2026-10-03T07:40:00Z', keywords: 'CIV-RES reservoir water', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 8, title: 'Pipeline valves bulk supply', reference: 'T-2026-0008', subtitle: 'Tender · Network Operations', status: tenderStatus('closed'), to: LINKS.buyerTender(8), updatedAt: '2026-09-30T08:00:00Z', keywords: 'WTR-PIPE valves pipeline', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 9, title: 'Acoustic leak detection services', reference: 'T-2026-0009', subtitle: 'RFP · restricted · Network Operations', status: tenderStatus('under_assessment'), to: LINKS.buyerTender(9), updatedAt: '2026-10-02T13:05:00Z', keywords: 'SRV-LEAK leak acoustic water', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 10, title: 'Fleet vehicle maintenance', reference: 'T-2026-0010', subtitle: 'RFQ · Fleet and Facilities', status: tenderStatus('awarded'), to: LINKS.buyerTender(10), updatedAt: '2026-09-01T09:00:00Z', keywords: 'SRV-FLEET fleet vehicles', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: 12, title: 'Treatment works electrical maintenance', reference: 'T-2026-0012', subtitle: 'RFQ · draft · Technical Services', status: tenderStatus('draft'), to: LINKS.buyerTender(12), updatedAt: '2026-09-29T14:20:00Z', keywords: 'ELEC-MAINT electrical treatment water', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'tender', recordId: LEGACY_TENDER_ID, title: 'Maun wellfield pump supply (legacy import, 2018)', reference: 'T-2025-0003', subtitle: 'Tender · archived · legal hold', status: tenderStatus('archived'), to: LINKS.auditTrail('tender', LEGACY_TENDER_ID), updatedAt: '2026-08-14T09:30:00Z', keywords: 'WTR-PUMP legacy pumps', visibleWith: ['tender.view'] }),
  // --- KWU requests (all requests with request.view_all; the requester always sees their own) ---
  entry({ tenantId: KWU, type: 'request', recordId: 1, title: 'Borehole pump replacement programme', reference: 'PR-2026-0001', subtitle: 'Converted to T-2026-0001', status: { enum: 'procurement_requests.status', value: 'converted' }, to: LINKS.buyerRequest(1), updatedAt: '2026-06-20T08:00:00Z', keywords: 'pumps water boreholes', visibleWith: ['request.view_all'], alsoVisibleTo: [USERS.kagiso] }),
  entry({ tenantId: KWU, type: 'request', recordId: 3, title: 'Northern wellfield pipeline extension', reference: 'PR-2026-0003', subtitle: 'Under review · routed above the manager’s limit', status: { enum: 'procurement_requests.status', value: 'under_review' }, to: LINKS.buyerRequest(3), updatedAt: '2026-09-23T08:15:00Z', keywords: 'pipeline water wellfield', visibleWith: ['request.view_all'], alsoVisibleTo: [USERS.kagiso] }),
  entry({ tenantId: KWU, type: 'request', recordId: 5, title: 'Pressure-reducing valve replacement — Gaborone West and Tlokweng', reference: 'PR-2026-0005', subtitle: 'Approved with conditions', status: { enum: 'procurement_requests.status', value: 'approved' }, to: LINKS.buyerRequest(5), updatedAt: '2026-09-18T14:20:00Z', keywords: 'valves water pressure', visibleWith: ['request.view_all'], alsoVisibleTo: [USERS.kagiso] }),
  entry({ tenantId: KWU, type: 'request', recordId: 7, title: 'Customer contact centre telephony refresh', reference: 'PR-2026-0007', subtitle: 'Draft · not yet submitted', status: { enum: 'procurement_requests.status', value: 'draft' }, to: LINKS.buyerRequest(7), updatedAt: '2026-09-29T07:50:00Z', keywords: 'telephony contact centre', visibleWith: [], ownerUserIds: [USERS.kagiso] }),
  // --- KWU suppliers (supplier.directory.view) ---
  entry({ tenantId: KWU, type: 'supplier', recordId: S.tsodilo, title: 'Tsodilo Engineering (Pty) Ltd', reference: null, subtitle: 'Qualified · pumps and mechanical', status: { enum: 'v_qualification_status.effective_status', value: 'qualified' }, to: LINKS.buyerSupplier(S.tsodilo), updatedAt: '2026-09-10T09:00:00Z', keywords: 'tsodilo pumps engineering', visibleWith: ['supplier.directory.view'] }),
  entry({ tenantId: KWU, type: 'supplier', recordId: S['chobe-pipe'], title: 'Chobe Pipe & Valve Supplies', reference: null, subtitle: 'Qualified with conditions · insurance expiring', status: { enum: 'v_qualification_status.effective_status', value: 'qualified_with_conditions' }, to: LINKS.buyerSupplier(S['chobe-pipe']), updatedAt: '2026-10-03T08:00:00Z', keywords: 'chobe pipe valves water', visibleWith: ['supplier.directory.view'] }),
  entry({ tenantId: KWU, type: 'supplier', recordId: S.makgadikgadi, title: 'Makgadikgadi Civil Works', reference: null, subtitle: 'Qualification: more information required', status: { enum: 'v_qualification_status.effective_status', value: 'not_assessed' }, to: LINKS.buyerSupplier(S.makgadikgadi), updatedAt: '2026-09-18T11:00:00Z', keywords: 'makgadikgadi civil works', visibleWith: ['supplier.directory.view'] }),
  entry({ tenantId: KWU, type: 'supplier', recordId: S['serowe-ict'], title: 'Serowe ICT Solutions (Pty) Ltd', reference: null, subtitle: 'SCADA and ICT', status: null, to: LINKS.buyerSupplier(S['serowe-ict']), updatedAt: '2026-08-28T10:00:00Z', keywords: 'serowe ict scada', visibleWith: ['supplier.directory.view'] }),
  entry({ tenantId: KWU, type: 'supplier', recordId: S['limpopo-env'], title: 'Limpopo Environmental Services (Pty) Ltd', reference: null, subtitle: 'Environmental and leak detection', status: null, to: LINKS.buyerSupplier(S['limpopo-env']), updatedAt: '2026-09-23T10:00:00Z', keywords: 'limpopo environmental leak water', visibleWith: ['supplier.directory.view'] }),
  entry({ tenantId: KWU, type: 'supplier', recordId: S['gaborone-meter'], title: 'Gaborone Metering Company (Pty) Ltd', reference: null, subtitle: 'Qualification expired', status: { enum: 'v_qualification_status.effective_status', value: 'expired' }, to: LINKS.buyerSupplier(S['gaborone-meter']), updatedAt: '2026-06-01T08:00:00Z', keywords: 'gaborone meters water', visibleWith: ['supplier.directory.view'] }),
  // --- KWU contracts (contract.view) ---
  entry({ tenantId: KWU, type: 'contract', recordId: 1, title: 'Fleet vehicle maintenance', reference: 'C-2026-0001', subtitle: 'Tsodilo Engineering · active', status: { enum: 'contracts.status', value: 'active' }, to: LINKS.buyerContract(1), updatedAt: '2026-10-05T10:00:00Z', keywords: 'fleet tsodilo vehicles', visibleWith: ['contract.view'] }),
  entry({ tenantId: KWU, type: 'contract', recordId: 2, title: 'Borehole pumps Lot 1: supply and installation', reference: 'C-2026-0002', subtitle: 'Tsodilo Engineering · awaiting signature', status: { enum: 'contracts.status', value: 'awaiting_signature' }, to: LINKS.buyerContract(2), updatedAt: '2026-10-01T08:10:00Z', keywords: 'pumps tsodilo water', visibleWith: ['contract.view'] }),
  entry({ tenantId: KWU, type: 'contract', recordId: 3, title: 'Borehole pumps Lot 1: preventive maintenance', reference: 'C-2026-0003', subtitle: 'Tsodilo Engineering · under review', status: { enum: 'contracts.status', value: 'under_review' }, to: LINKS.buyerContract(3), updatedAt: '2026-10-01T08:10:00Z', keywords: 'pumps maintenance water', visibleWith: ['contract.view'] }),
  entry({ tenantId: KWU, type: 'contract', recordId: 8, title: 'Borehole pumps Lot 1: spare parts and consumables', reference: 'C-2026-0004', subtitle: 'Tsodilo Engineering · draft', status: { enum: 'contracts.status', value: 'draft' }, to: LINKS.buyerContract(8), updatedAt: '2026-10-01T08:10:00Z', keywords: 'pumps spares water', visibleWith: ['contract.view'] }),
  entry({ tenantId: KWU, type: 'contract', recordId: 4, title: 'Legacy meter reading services', reference: 'C-2025-0007', subtitle: 'Gaborone Metering · expired · imported', status: { enum: 'contracts.status', value: 'expired' }, to: LINKS.buyerContract(4), updatedAt: '2026-09-02T11:00:00Z', keywords: 'meters water legacy', visibleWith: ['contract.view'] }),
  entry({ tenantId: KWU, type: 'contract', recordId: 5, title: 'SCADA helpdesk and patching support', reference: 'C-2025-0003', subtitle: 'Serowe ICT Solutions · closed', status: { enum: 'contracts.status', value: 'closed' }, to: LINKS.buyerContract(5), updatedAt: '2026-02-15T08:00:00Z', keywords: 'scada helpdesk', visibleWith: ['contract.view'] }),
  entry({ tenantId: KWU, type: 'contract', recordId: 6, title: 'Network valve maintenance call-out services', reference: 'C-2025-0005', subtitle: 'Chobe Pipe & Valve Supplies · suspended', status: { enum: 'contracts.status', value: 'suspended' }, to: LINKS.buyerContract(6), updatedAt: '2026-09-12T08:00:00Z', keywords: 'valves water maintenance', visibleWith: ['contract.view'] }),
  // --- KWU documents ---
  entry({ tenantId: KWU, type: 'document', recordId: 201, title: 'Tender package — Smart water meter supply', reference: 'T-2026-0002', subtitle: 'Public · tender package', status: { enum: 'documents.classification', value: 'public' }, to: LINKS.document(201), updatedAt: '2026-09-18T09:00:00Z', keywords: 'meters water package addendum', visibleWith: ['tender.view'] }),
  entry({ tenantId: KWU, type: 'document', recordId: 207, title: 'Evaluation report — Reservoir rehabilitation works', reference: 'T-2026-0007', subtitle: 'Restricted assessment', status: { enum: 'documents.classification', value: 'restricted_assessment' }, to: LINKS.document(207), updatedAt: '2026-09-10T14:00:00Z', keywords: 'reservoir evaluation report', visibleWith: ['evaluation.chair', 'evaluation.signoff'] }),
  entry({ tenantId: KWU, type: 'document', recordId: 224, title: 'Meter reading services agreement (legacy import)', reference: 'C-2025-0007', subtitle: 'Commercially confidential · records', status: { enum: 'documents.classification', value: 'commercially_confidential' }, to: LINKS.document(224), updatedAt: '2026-08-14T09:30:00Z', keywords: 'legal hold meter reading legacy', visibleWith: ['audit.view', 'records.hold.manage'] }),
  entry({ tenantId: KWU, type: 'document', recordId: 209, title: 'Signed contract — Fleet vehicle maintenance', reference: 'C-2026-0001', subtitle: 'Commercially confidential', status: { enum: 'documents.classification', value: 'commercially_confidential' }, to: LINKS.document(209), updatedAt: '2026-08-28T10:00:00Z', keywords: 'fleet contract signed', visibleWith: ['contract.view'] }),
  // --- KWU tasks (own tasks only) ---
  entry({ tenantId: KWU, type: 'task', recordId: 115, title: 'Triage question Q-206 on T-2026-0002 (delivery to the Maun depot)', reference: 'T-2026-0002', subtitle: 'Due 7 Oct 2026', status: { enum: 'tasks.status', value: 'open' }, to: LINKS.tasks(115), updatedAt: '2026-10-03T11:30:00Z', keywords: 'questions meters water', visibleWith: [], ownerUserIds: [USERS.tebogo] }),
  entry({ tenantId: KWU, type: 'task', recordId: 113, title: 'Request release approval again for T-2026-0005 (revision 3)', reference: 'T-2026-0005', subtitle: 'Overdue since 3 Oct 2026', status: { enum: 'tasks.status', value: 'open' }, to: LINKS.tasks(113), updatedAt: '2026-10-02T12:45:00Z', keywords: 'release approval water chemicals', visibleWith: [], ownerUserIds: [USERS.tebogo] }),
  entry({ tenantId: KWU, type: 'task', recordId: 103, title: 'Approve PR-2026-0003 Northern wellfield pipeline extension', reference: 'PR-2026-0003', subtitle: 'Due 8 Oct 2026', status: { enum: 'tasks.status', value: 'open' }, to: LINKS.tasks(103), updatedAt: '2026-09-28T09:15:00Z', keywords: 'funding pipeline wellfield approval', visibleWith: [], ownerUserIds: [USERS.keabetswe] }),
  entry({ tenantId: KWU, type: 'task', recordId: 139, title: 'Declare conflicts of interest for the T-2026-0003 evaluation', reference: 'T-2026-0003', subtitle: 'Conflict routed for review', status: { enum: 'tasks.status', value: 'in_progress' }, to: LINKS.tasks(139), updatedAt: '2026-09-30T16:00:00Z', keywords: 'scada evaluation conflict', visibleWith: [], ownerUserIds: [USERS.samDual, USERS.thato] }),
  entry({ tenantId: KWU, type: 'task', recordId: 134, title: 'Review the remediation of the rejected Q3 service report (C-2026-0001)', reference: 'C-2026-0001', subtitle: 'Due 20 Oct 2026', status: { enum: 'tasks.status', value: 'open' }, to: LINKS.tasks(134), updatedAt: '2026-10-01T10:00:00Z', keywords: 'fleet service report', visibleWith: [], ownerUserIds: [USERS.masego] }),
  // --- ODC ---
  entry({ tenantId: ODC, type: 'tender', recordId: 11, title: 'Office cleaning services', reference: 'T-2026-0011', subtitle: 'RFQ · Corporate Services', status: tenderStatus('open'), to: LINKS.buyerTender(11), updatedAt: '2026-10-01T09:00:00Z', keywords: 'SRV-CLEAN cleaning offices', visibleWith: ['tender.view'] }),
  entry({ tenantId: ODC, type: 'contract', recordId: 7, title: 'Council office cleaning services', reference: 'C-2025-0004', subtitle: 'Limpopo Environmental Services · active', status: { enum: 'contracts.status', value: 'active' }, to: LINKS.buyerContract(7), updatedAt: '2026-10-03T08:00:00Z', keywords: 'cleaning offices', visibleWith: ['contract.view'] }),
  entry({ tenantId: ODC, type: 'task', recordId: 141, title: 'Answer question Q-302 on T-2026-0011 (weekend cleaning during council sessions)', reference: 'T-2026-0011', subtitle: 'Due 5 Oct 2026', status: { enum: 'tasks.status', value: 'open' }, to: LINKS.tasks(141), updatedAt: '2026-10-01T09:00:00Z', keywords: 'cleaning questions', visibleWith: [], ownerUserIds: [USERS.officerOdc] }),
  // --- Tsodilo Engineering (own records only) ---
  entry({ tenantId: S.tsodilo, type: 'contract', recordId: 1, title: 'Fleet vehicle maintenance', reference: 'C-2026-0001', subtitle: 'Kalahari Water Utilities · active', status: { enum: 'contracts.status', value: 'active' }, to: LINKS.supplierContract(1), updatedAt: '2026-10-01T10:00:00Z', keywords: 'fleet', visibleWith: ['supplier.contract.participate', 'supplier.outcomes.view'] }),
  entry({ tenantId: S.tsodilo, type: 'contract', recordId: 2, title: 'Borehole pumps Lot 1: supply and installation', reference: 'C-2026-0002', subtitle: 'Kalahari Water Utilities · awaiting signature', status: { enum: 'contracts.status', value: 'awaiting_signature' }, to: LINKS.supplierContract(2), updatedAt: '2026-09-20T12:00:00Z', keywords: 'pumps water', visibleWith: ['supplier.contract.participate', 'supplier.outcomes.view'] }),
  entry({ tenantId: S.tsodilo, type: 'document', recordId: 105, title: 'Public liability insurance 2025/26 (cover increased)', reference: null, subtitle: 'Evidence library · expires 31 Oct 2026', status: { enum: 'documents.classification', value: 'supplier_private' }, to: LINKS.supplierEvidence(105), updatedAt: '2026-01-10T08:00:00Z', keywords: 'insurance evidence', visibleWith: ['supplier.evidence.manage'] }),
  // --- Chobe Pipe & Valve Supplies ---
  entry({ tenantId: S['chobe-pipe'], type: 'document', recordId: 202, title: 'Public liability insurance 2025/26', reference: null, subtitle: 'Evidence library · expires 8 Oct 2026', status: { enum: 'documents.classification', value: 'supplier_private' }, to: LINKS.supplierEvidence(202), updatedAt: '2025-10-14T08:00:00Z', keywords: 'insurance evidence', visibleWith: ['supplier.evidence.manage'] }),
  entry({ tenantId: S['chobe-pipe'], type: 'contract', recordId: 6, title: 'Network valve maintenance call-out services', reference: 'C-2025-0005', subtitle: 'Kalahari Water Utilities · suspended', status: { enum: 'contracts.status', value: 'suspended' }, to: LINKS.supplierContract(6), updatedAt: '2026-09-12T08:00:00Z', keywords: 'valves water maintenance', visibleWith: ['supplier.contract.participate', 'supplier.outcomes.view'] }),
  // --- Serowe ICT Solutions ---
  // --- Gaborone Metering Co. ---
  entry({ tenantId: S['gaborone-meter'], type: 'contract', recordId: 4, title: 'Legacy meter reading services', reference: 'C-2025-0007', subtitle: 'Kalahari Water Utilities · expired · warranty open', status: { enum: 'contracts.status', value: 'expired' }, to: LINKS.supplierContract(4), updatedAt: '2026-09-30T08:00:00Z', keywords: 'meters warranty water', visibleWith: ['supplier.contract.participate', 'supplier.outcomes.view'] }),
  // --- Makgadikgadi Civil Works ---
  // --- Limpopo Environmental Services ---
  entry({ tenantId: S['limpopo-env'], type: 'contract', recordId: 7, title: 'Council office cleaning services', reference: 'C-2025-0004', subtitle: 'Okavango District Council · active', status: { enum: 'contracts.status', value: 'active' }, to: LINKS.supplierContract(7), updatedAt: '2026-10-03T08:00:00Z', keywords: 'cleaning offices', visibleWith: ['supplier.contract.participate', 'supplier.outcomes.view'] }),
  // --- Operator: customer organizations, metadata only ---
  entry({ tenantId: S['tenderiq-ops'], type: 'organization', recordId: KWU, title: 'Kalahari Water Utilities (Pilot)', reference: null, subtitle: 'Buyer customer · pilot', status: { enum: 'tenants.status', value: 'active' }, to: LINKS.opsCustomer(KWU), updatedAt: '2026-09-29T08:00:00Z', keywords: 'kwu water buyer customer', visibleWith: ['ops.customers.manage', 'ops.oversight.view'] }),
  entry({ tenantId: S['tenderiq-ops'], type: 'organization', recordId: ODC, title: 'Okavango District Council', reference: null, subtitle: 'Buyer customer · offboarding plan in draft', status: { enum: 'tenants.status', value: 'active' }, to: LINKS.opsCustomer(ODC), updatedAt: '2026-09-25T08:00:00Z', keywords: 'odc council buyer customer', visibleWith: ['ops.customers.manage', 'ops.oversight.view'] }),
  entry({ tenantId: S['tenderiq-ops'], type: 'organization', recordId: S.tsodilo, title: 'Tsodilo Engineering', reference: null, subtitle: 'Supplier organization', status: { enum: 'tenants.status', value: 'active' }, to: LINKS.opsCustomer(S.tsodilo), updatedAt: '2026-02-10T08:00:00Z', keywords: 'supplier engineering', visibleWith: ['ops.customers.manage', 'ops.oversight.view'] }),
  entry({ tenantId: S['tenderiq-ops'], type: 'organization', recordId: S['gaborone-meter'], title: 'Gaborone Metering Co.', reference: null, subtitle: 'Supplier organization', status: { enum: 'tenants.status', value: 'active' }, to: LINKS.opsCustomer(S['gaborone-meter']), updatedAt: '2026-03-23T08:00:00Z', keywords: 'supplier meters water', visibleWith: ['ops.customers.manage', 'ops.oversight.view'] }),
];

// ---------------------------------------------------------------------------------------------------------
// Supplier tender entries: derived from the supplier's own pursuits, bids and outcomes (SUP-01 rows), so the
// subtitle states the official submission state of the bids domain and the link opens the caller's OWN record:
// its outcome notice when there is one, else its own bid (`/supplier/responses/<bidId>`), else the opportunity.
// ---------------------------------------------------------------------------------------------------------

const BUYER_NAMES: Readonly<Record<number, string>> = { [KWU]: 'Kalahari Water Utilities', [ODC]: 'Okavango District Council' };

/** The supplier-facing state of one pursuit, in plain words (BR-18: only a receipt means submitted). */
export function pursuitStateText(pursuit: FixtureSupplierPursuit, invited: boolean): string {
  if (pursuit.submissionState === 'submitted') {
    const receipt = pursuit.effectiveReceiptNo === null ? 'receipt' : `receipt ${pursuit.effectiveReceiptNo}`;
    if (pursuit.latestRevisionStatus === 'submission_failed') {
      return `earlier ${receipt} effective; replacement failed`;
    }
    if (pursuit.latestRevisionStatus === 'late_rejected') {
      return `earlier ${receipt} effective; late replacement rejected`;
    }
    if (pursuit.latestRevisionStatus === 'approved_internally') {
      return `submitted, ${receipt}; replacement approved internally`;
    }
    return `submitted, ${receipt}`;
  }
  if (pursuit.submissionState === 'withdrawn') {
    return 'withdrawn: no effective receipt';
  }
  if (pursuit.bidId !== null) {
    return pursuit.latestRevisionStatus === 'approved_internally' ? 'approved internally, not submitted' : 'draft response, not submitted';
  }
  if (pursuit.decision === 'no_bid') {
    return 'no-bid decision';
  }
  return invited ? 'invitation received' : 'interest registered';
}

function supplierTenderEntries(): FixtureSearchEntry[] {
  return SUPPLIER_PURSUITS.map((pursuit) => {
    const tender = tenderFact(pursuit.tenderId);
    const outcome = SUPPLIER_OUTCOMES.find((row) => row.supplierTenantId === pursuit.supplierTenantId && row.tenderId === pursuit.tenderId);
    const invitation = SUPPLIER_INVITATIONS.find((row) => row.supplierTenantId === pursuit.supplierTenantId && row.tenderId === pursuit.tenderId);
    const outcomeText =
      outcome === undefined
        ? null
        : outcome.successful
          ? outcome.outcomeStatus === 'final_awarded'
            ? 'awarded'
            : 'intent to award (not a final award)'
          : 'unsuccessful';
    const state = outcomeText ?? pursuitStateText(pursuit, invitation !== undefined && invitation.invitationStatus !== 'not_invited');
    const to =
      outcome !== undefined
        ? LINKS.supplierOutcome(tender.id)
        : pursuit.bidId === null
          ? LINKS.supplierOpportunity(tender.id)
          : LINKS.supplierResponse(pursuit.bidId);
    return entry({
      tenantId: pursuit.supplierTenantId,
      type: 'tender',
      recordId: tender.id,
      title: tender.title,
      reference: tender.reference,
      subtitle: `${BUYER_NAMES[tender.tenantId] ?? ''} · ${state}`,
      status: tenderStatus(tender.status),
      to,
      updatedAt: pursuit.updatedAt,
      keywords: `${tender.title.toLowerCase()} ${state}`,
      visibleWith: ['supplier.opportunities.view'],
    });
  });
}

export const SEARCH_INDEX: readonly FixtureSearchEntry[] = [...STATIC_ENTRIES, ...supplierTenderEntries()];

/** A saved view as stored (`saved_views`): owned by one user in one tenant. */
export interface FixtureSavedView extends Omit<SavedView, 'organization'> {
  readonly tenantId: number;
  readonly userId: number;
}

export const SAVED_VIEWS: readonly FixtureSavedView[] = [
  { id: 1, tenantId: KWU, userId: USERS.tebogo, scope: 'COM-08', name: 'Open water tenders', filters: { q: 'water', type: ['tender'] }, isDefault: false, createdAt: '2026-09-02T08:00:00Z', updatedAt: '2026-09-02T08:00:00Z' },
  { id: 2, tenantId: KWU, userId: USERS.tebogo, scope: 'BUY-01', name: 'My pipeline', filters: { ownerUserId: USERS.tebogo }, isDefault: true, createdAt: '2026-08-11T07:30:00Z', updatedAt: '2026-09-15T07:30:00Z' },
  { id: 3, tenantId: KWU, userId: USERS.tebogo, scope: 'COM-08', name: 'My open tasks', filters: { q: 'due', type: ['task'] }, isDefault: false, createdAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-20T12:00:00Z' },
  { id: 4, tenantId: KWU, userId: USERS.mpho, scope: 'REP-01', name: 'Network Operations only', filters: { departmentId: 3 }, isDefault: false, createdAt: '2026-09-01T09:00:00Z', updatedAt: '2026-09-01T09:00:00Z' },
  { id: 5, tenantId: KWU, userId: USERS.samDual, scope: 'COM-08', name: 'SCADA evaluation work', filters: { q: 'scada' }, isDefault: false, createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z' },
  { id: 6, tenantId: S.tsodilo, userId: USERS.samDual, scope: 'COM-08', name: 'Tsodilo water opportunities', filters: { q: 'water', type: ['tender'] }, isDefault: true, createdAt: '2026-09-12T08:00:00Z', updatedAt: '2026-09-12T08:00:00Z' },
  { id: 7, tenantId: S.tsodilo, userId: USERS.tsodiloBidManager, scope: 'COM-08', name: 'Submitted responses', filters: { q: 'submitted' }, isDefault: false, createdAt: '2026-08-30T08:00:00Z', updatedAt: '2026-08-30T08:00:00Z' },
  { id: 8, tenantId: ODC, userId: USERS.officerOdc, scope: 'COM-08', name: 'Cleaning', filters: { q: 'cleaning' }, isDefault: false, createdAt: '2026-09-15T08:00:00Z', updatedAt: '2026-09-15T08:00:00Z' },
];
