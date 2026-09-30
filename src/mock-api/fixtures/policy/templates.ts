/**
 * Template and content library (ADM-08). KWU has every kind: approved templates in use, a revision in review, a new
 * template in review, a draft, templates whose review date has passed, and a retired contract template that
 * C-2026-0001 still carries. ODC has its own small library.
 *
 * Template OWNERS (`ownerUserId`, accountable for content and review dates) are the subject-matter staff. Versions
 * are authored, submitted and approved by holders of `org.templates.manage` / `org.templates.approve`, which is
 * only the organization administrator in each buyer; each self-approval relies on the documented alternative
 * oversight in `./governance.ts` (BR-07). `approvalRequestId` stays null: the approvals fixtures hold no
 * `template` approval requests.
 */
import type { TemplatesAudience, TemplatesKind, TemplatesStatus, TendersProcedureWrite } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureChecklistItem {
  readonly id: number;
  readonly itemText: string;
  readonly sortOrder: number;
  readonly mandatory: boolean;
}

export interface FixtureTemplateVersion {
  readonly id: number;
  readonly templateId: number;
  readonly versionNo: number;
  readonly versionStatus: TemplatesStatus;
  readonly bodyMarkdown: string;
  readonly changeNote: string;
  readonly checklistItems: readonly FixtureChecklistItem[];
  readonly createdBy: number;
  readonly createdAt: string;
  readonly submittedBy: number | null;
  readonly submittedAt: string | null;
  readonly approvedBy: number | null;
  readonly approvedAt: string | null;
  readonly returnedReason: string | null;
  readonly approvalRequestId: number | null;
}

export interface FixtureTemplateUsage {
  readonly recordType: 'tender' | 'contract';
  readonly recordId: number;
  readonly adoptedVersionNo: number;
  readonly adoptedAt: string;
}

export interface FixtureTemplate {
  readonly id: number;
  readonly tenantId: number;
  readonly kind: TemplatesKind;
  readonly name: string;
  readonly procedure: TendersProcedureWrite | null;
  readonly categoryId: number | null;
  readonly audience: TemplatesAudience;
  readonly ownerUserId: number;
  readonly status: TemplatesStatus;
  readonly effectiveFrom: string | null;
  readonly reviewDate: string | null;
  readonly currentVersionId: number | null;
  readonly sourceTenderId: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
  readonly retirementReason: string | null;
  readonly usage: readonly FixtureTemplateUsage[];
}

const kwu = TENANT_IDS.kwu;
const odc = TENANT_IDS.odc;

const ADMIN_KWU = 3;
const MPHO = 4;
const TEBOGO = 5;
const NEO = 8;
const BOITUMELO = 10;
const ORATILE = 15;
const DINEO = 17;
const MASEGO = 19;
const ADMIN_ODC = 22;
const OFFICER_ODC = 23;

export const TEMPLATES: readonly FixtureTemplate[] = Object.freeze([
  {
    id: 1, tenantId: kwu, kind: 'tender_package', name: 'Open tender package: goods supply', procedure: 'open', categoryId: 1,
    audience: 'supplier_visible', ownerUserId: TEBOGO, status: 'approved', effectiveFrom: '2026-06-20T00:00:00Z', reviewDate: '2027-03-31',
    currentVersionId: 2, sourceTenderId: null, createdAt: '2025-11-12T08:00:00Z', updatedAt: '2026-06-20T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [
      { recordType: 'tender', recordId: 1, adoptedVersionNo: 1, adoptedAt: '2026-04-14T09:00:00Z' },
      { recordType: 'tender', recordId: 8, adoptedVersionNo: 2, adoptedAt: '2026-07-13T09:00:00Z' },
      { recordType: 'tender', recordId: 5, adoptedVersionNo: 2, adoptedAt: '2026-08-24T10:00:00Z' },
    ],
  },
  {
    id: 2, tenantId: kwu, kind: 'questionnaire', name: 'Supplier technical capability questionnaire', procedure: null, categoryId: 1,
    audience: 'supplier_visible', ownerUserId: NEO, status: 'approved', effectiveFrom: '2025-12-01T00:00:00Z', reviewDate: '2026-09-15',
    currentVersionId: 4, sourceTenderId: null, createdAt: '2025-11-14T08:00:00Z', updatedAt: '2025-12-01T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [{ recordType: 'tender', recordId: 3, adoptedVersionNo: 1, adoptedAt: '2026-05-20T09:00:00Z' }],
  },
  {
    id: 3, tenantId: kwu, kind: 'criteria_set', name: 'Weighted technical and price criteria (70/30)', procedure: 'open', categoryId: null,
    audience: 'supplier_visible', ownerUserId: BOITUMELO, status: 'approved', effectiveFrom: '2025-12-01T00:00:00Z', reviewDate: '2026-12-31',
    currentVersionId: 5, sourceTenderId: null, createdAt: '2025-11-15T08:00:00Z', updatedAt: '2026-09-21T10:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [
      { recordType: 'tender', recordId: 3, adoptedVersionNo: 1, adoptedAt: '2026-05-22T09:00:00Z' },
      { recordType: 'tender', recordId: 7, adoptedVersionNo: 1, adoptedAt: '2026-05-12T09:00:00Z' },
    ],
  },
  {
    id: 4, tenantId: kwu, kind: 'clause', name: 'Liquidated damages clause (supply contracts)', procedure: null, categoryId: null,
    audience: 'supplier_visible', ownerUserId: DINEO, status: 'approved', effectiveFrom: '2025-12-01T00:00:00Z', reviewDate: '2027-06-30',
    currentVersionId: 7, sourceTenderId: null, createdAt: '2025-11-18T08:00:00Z', updatedAt: '2025-12-01T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [{ recordType: 'contract', recordId: 2, adoptedVersionNo: 1, adoptedAt: '2026-09-02T09:00:00Z' }],
  },
  {
    id: 5, tenantId: kwu, kind: 'letter', name: 'Regret letter to unsuccessful bidders', procedure: null, categoryId: null,
    audience: 'supplier_visible', ownerUserId: TEBOGO, status: 'approved', effectiveFrom: '2025-12-01T00:00:00Z', reviewDate: '2026-08-31',
    currentVersionId: 8, sourceTenderId: null, createdAt: '2025-11-20T08:00:00Z', updatedAt: '2025-12-01T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [{ recordType: 'tender', recordId: 10, adoptedVersionNo: 1, adoptedAt: '2026-04-28T09:00:00Z' }],
  },
  {
    id: 6, tenantId: kwu, kind: 'letter', name: 'Notice of intent to award', procedure: null, categoryId: null,
    audience: 'supplier_visible', ownerUserId: TEBOGO, status: 'in_review', effectiveFrom: null, reviewDate: '2027-09-30',
    currentVersionId: null, sourceTenderId: null, createdAt: '2026-09-05T08:00:00Z', updatedAt: '2026-09-19T15:00:00Z',
    retiredAt: null, retirementReason: null, usage: [],
  },
  {
    id: 7, tenantId: kwu, kind: 'checklist', name: 'Staged bid opening checklist', procedure: null, categoryId: null,
    audience: 'buyer_internal', ownerUserId: ORATILE, status: 'approved', effectiveFrom: '2026-01-15T00:00:00Z', reviewDate: '2027-01-15',
    currentVersionId: 10, sourceTenderId: null, createdAt: '2026-01-06T08:00:00Z', updatedAt: '2026-01-15T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [
      { recordType: 'tender', recordId: 3, adoptedVersionNo: 1, adoptedAt: '2026-07-20T09:00:00Z' },
      { recordType: 'tender', recordId: 8, adoptedVersionNo: 1, adoptedAt: '2026-09-25T09:00:00Z' },
    ],
  },
  {
    id: 8, tenantId: kwu, kind: 'contract', name: 'Goods supply contract (KWU standard terms)', procedure: null, categoryId: 1,
    audience: 'supplier_visible', ownerUserId: MASEGO, status: 'approved', effectiveFrom: '2026-05-01T00:00:00Z', reviewDate: '2027-04-30',
    currentVersionId: 11, sourceTenderId: null, createdAt: '2026-04-10T08:00:00Z', updatedAt: '2026-05-01T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [{ recordType: 'contract', recordId: 2, adoptedVersionNo: 1, adoptedAt: '2026-09-02T09:00:00Z' }],
  },
  {
    id: 9, tenantId: kwu, kind: 'contract', name: 'Services contract (2024 edition)', procedure: null, categoryId: 9,
    audience: 'supplier_visible', ownerUserId: MASEGO, status: 'retired', effectiveFrom: '2024-03-01T00:00:00Z', reviewDate: '2026-03-01',
    currentVersionId: 12, sourceTenderId: null, createdAt: '2024-02-12T08:00:00Z', updatedAt: '2026-04-30T15:00:00Z',
    retiredAt: '2026-04-30T15:00:00Z', retirementReason: 'Replaced by the 2026 services terms under legal review; existing contracts keep this edition.',
    usage: [
      { recordType: 'contract', recordId: 1, adoptedVersionNo: 2, adoptedAt: '2026-04-20T09:00:00Z' },
      { recordType: 'contract', recordId: 4, adoptedVersionNo: 1, adoptedAt: '2025-01-10T09:00:00Z' },
    ],
  },
  {
    id: 10, tenantId: kwu, kind: 'questionnaire', name: 'SCADA cyber-security questionnaire', procedure: 'open', categoryId: 5,
    audience: 'supplier_visible', ownerUserId: TEBOGO, status: 'draft', effectiveFrom: null, reviewDate: '2027-10-31',
    currentVersionId: null, sourceTenderId: null, createdAt: '2026-09-24T08:00:00Z', updatedAt: '2026-09-24T08:00:00Z',
    retiredAt: null, retirementReason: null, usage: [],
  },
  {
    id: 11, tenantId: kwu, kind: 'checklist', name: 'Release readiness checklist', procedure: null, categoryId: null,
    audience: 'buyer_internal', ownerUserId: MPHO, status: 'approved', effectiveFrom: '2025-12-01T00:00:00Z', reviewDate: '2026-11-30',
    currentVersionId: 15, sourceTenderId: null, createdAt: '2025-11-25T08:00:00Z', updatedAt: '2025-12-01T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [
      { recordType: 'tender', recordId: 2, adoptedVersionNo: 1, adoptedAt: '2026-08-20T09:00:00Z' },
      { recordType: 'tender', recordId: 5, adoptedVersionNo: 1, adoptedAt: '2026-08-25T09:00:00Z' },
    ],
  },
  {
    id: 12, tenantId: kwu, kind: 'tender_package', name: 'Request for quotation package', procedure: 'open', categoryId: null,
    audience: 'supplier_visible', ownerUserId: TEBOGO, status: 'approved', effectiveFrom: '2026-03-01T00:00:00Z', reviewDate: '2027-02-28',
    currentVersionId: 16, sourceTenderId: null, createdAt: '2026-02-10T08:00:00Z', updatedAt: '2026-03-01T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [
      { recordType: 'tender', recordId: 2, adoptedVersionNo: 1, adoptedAt: '2026-08-18T09:00:00Z' },
      { recordType: 'tender', recordId: 6, adoptedVersionNo: 1, adoptedAt: '2026-08-28T09:00:00Z' },
      { recordType: 'tender', recordId: 10, adoptedVersionNo: 1, adoptedAt: '2026-02-20T09:00:00Z' },
    ],
  },
  // ODC
  {
    id: 30, tenantId: odc, kind: 'tender_package', name: 'Council services quotation package', procedure: 'open', categoryId: 20,
    audience: 'supplier_visible', ownerUserId: OFFICER_ODC, status: 'approved', effectiveFrom: '2026-02-02T00:00:00Z', reviewDate: '2027-02-01',
    currentVersionId: 30, sourceTenderId: null, createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-02-02T08:00:00Z',
    retiredAt: null, retirementReason: null,
    usage: [{ recordType: 'tender', recordId: 11, adoptedVersionNo: 1, adoptedAt: '2026-09-07T09:00:00Z' }],
  },
  {
    id: 31, tenantId: odc, kind: 'letter', name: 'Council award letter', procedure: null, categoryId: null,
    audience: 'supplier_visible', ownerUserId: OFFICER_ODC, status: 'draft', effectiveFrom: null, reviewDate: '2027-06-30',
    currentVersionId: null, sourceTenderId: null, createdAt: '2026-09-10T08:00:00Z', updatedAt: '2026-09-10T08:00:00Z',
    retiredAt: null, retirementReason: null, usage: [],
  },
]);

function approved(
  id: number, templateId: number, versionNo: number, versionStatus: TemplatesStatus, author: number, approver: number,
  createdAt: string, approvedAt: string, changeNote: string, bodyMarkdown: string, checklistItems: readonly FixtureChecklistItem[] = [],
): FixtureTemplateVersion {
  return {
    id, templateId, versionNo, versionStatus, bodyMarkdown, changeNote, checklistItems,
    createdBy: author, createdAt, submittedBy: author, submittedAt: createdAt,
    approvedBy: approver, approvedAt, returnedReason: null, approvalRequestId: null,
  };
}

function item(id: number, sortOrder: number, itemText: string, mandatory: boolean): FixtureChecklistItem {
  return { id, itemText, sortOrder, mandatory };
}

export const TEMPLATE_VERSIONS: readonly FixtureTemplateVersion[] = Object.freeze([
  approved(1, 1, 1, 'retired', ADMIN_KWU, ADMIN_KWU, '2025-11-12T08:00:00Z', '2025-12-01T08:00:00Z', 'First issue.',
    '# Invitation to tender\n\n1. Instructions to tenderers\n2. Conditions of tender\n3. Specifications and schedules of requirements\n4. Pricing schedule\n5. Returnable forms and declarations\n6. Draft contract'),
  approved(2, 1, 2, 'approved', ADMIN_KWU, ADMIN_KWU, '2026-06-05T08:00:00Z', '2026-06-20T08:00:00Z',
    'Adds the official time zone statement and the staged opening instructions of policy v2.',
    '# Invitation to tender\n\nAll deadlines are stated in the official time zone Africa/Gaborone (UTC+02:00).\n\n1. Instructions to tenderers (including staged opening of envelopes)\n2. Conditions of tender\n3. Specifications and schedules of requirements\n4. Pricing schedule\n5. Returnable forms and declarations\n6. Draft contract'),
  approved(4, 2, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2025-11-14T08:00:00Z', '2025-12-01T08:00:00Z', 'First issue.',
    '# Technical capability\n\n- Describe comparable contracts delivered in the last five years.\n- List key personnel and their qualifications.\n- Describe your quality management system (attach ISO 9001 certificate where held).\n- Describe after-sales service and spare-parts support in Botswana.'),
  approved(5, 3, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2025-11-15T08:00:00Z', '2025-12-01T08:00:00Z', 'First issue.',
    '# Evaluation criteria\n\n| Criterion | Weight |\n|---|---|\n| Technical approach | 40 |\n| Experience and personnel | 30 |\n| Price (lowest evaluated cost scores 30) | 30 |\n\nMinimum technical score to open the price envelope: 60 of 70.'),
  {
    id: 6, templateId: 3, versionNo: 2, versionStatus: 'in_review',
    bodyMarkdown:
      '# Evaluation criteria\n\n| Criterion | Weight |\n|---|---|\n| Technical approach | 35 |\n| Experience and personnel | 25 |\n| Local content and skills transfer | 10 |\n| Price (lowest evaluated cost scores 30) | 30 |\n\nMinimum technical score to open the price envelope: 55 of 70.',
    changeNote: 'Adds a local content criterion (10) and lowers the technical threshold to 55.',
    checklistItems: [], createdBy: ADMIN_KWU, createdAt: '2026-09-16T08:00:00Z', submittedBy: ADMIN_KWU, submittedAt: '2026-09-21T10:00:00Z',
    approvedBy: null, approvedAt: null, returnedReason: null, approvalRequestId: null,
  },
  approved(7, 4, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2025-11-18T08:00:00Z', '2025-12-01T08:00:00Z', 'First issue.',
    '# Liquidated damages\n\nIf the Supplier fails to deliver within the delivery period, the Purchaser shall deduct 0.5% of the price of the delayed goods for each week of delay, up to a maximum of 10% of the contract price.'),
  approved(8, 5, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2025-11-20T08:00:00Z', '2025-12-01T08:00:00Z', 'First issue.',
    '# Outcome of your tender\n\nThank you for your tender for {tender_reference} {tender_title}. We regret to inform you that your tender was not successful for {lot_name}. You may request a debriefing within {debrief_window_days} days of this notice.'),
  {
    id: 9, templateId: 6, versionNo: 1, versionStatus: 'in_review',
    bodyMarkdown:
      '# Notice of intent to award\n\nKalahari Water Utilities intends to award {tender_reference} {lot_name} to {supplier_name}. The standstill period ends on {standstill_end}. Complaints may be lodged until that date through the TenderIQ portal.',
    changeNote: 'First issue.', checklistItems: [], createdBy: ADMIN_KWU, createdAt: '2026-09-05T08:00:00Z', submittedBy: ADMIN_KWU,
    submittedAt: '2026-09-19T15:00:00Z', approvedBy: null, approvedAt: null, returnedReason: null, approvalRequestId: null,
  },
  approved(10, 7, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2026-01-06T08:00:00Z', '2026-01-15T08:00:00Z', 'First issue.',
    'Use at every opening session; the second person signs the minutes.',
    [
      item(1, 10, 'Confirm the closing time has passed in the official time zone.', true),
      item(2, 20, 'Confirm the opening officer and a second person are present.', true),
      item(3, 30, 'Open only the envelope authorized for this stage.', true),
      item(4, 40, 'Record every receipt number and its envelope inventory.', true),
      item(5, 50, 'Note any late or withdrawn submissions without opening them.', true),
      item(6, 60, 'Circulate the minutes to the evaluation chair.', false),
    ]),
  approved(11, 8, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2026-04-10T08:00:00Z', '2026-05-01T08:00:00Z', 'First issue.',
    '# Goods supply contract\n\n1. Definitions\n2. Scope of supply\n3. Delivery and acceptance\n4. Price and payment (BWP)\n5. Warranty\n6. Liquidated damages\n7. Termination\n8. Disputes'),
  approved(13, 9, 1, 'retired', ADMIN_KWU, ADMIN_KWU, '2024-02-12T08:00:00Z', '2024-03-01T08:00:00Z', 'First issue.',
    '# Services contract (2024)\n\n1. Services and service levels\n2. Price and payment\n3. Term and renewal options\n4. Termination'),
  approved(12, 9, 2, 'retired', ADMIN_KWU, ADMIN_KWU, '2025-06-02T08:00:00Z', '2025-06-20T08:00:00Z', 'Adds service credits and performance reviews.',
    '# Services contract (2024 edition, rev. 2)\n\n1. Services and service levels\n2. Service credits\n3. Performance reviews\n4. Price and payment\n5. Term and renewal options\n6. Termination'),
  {
    id: 14, templateId: 10, versionNo: 1, versionStatus: 'draft',
    bodyMarkdown: '# Cyber-security\n\n- Describe how remote access to telemetry outstations is secured.\n- Describe patching and vulnerability management for the SCADA servers.',
    changeNote: 'First draft.', checklistItems: [], createdBy: ADMIN_KWU, createdAt: '2026-09-24T08:00:00Z', submittedBy: null, submittedAt: null,
    approvedBy: null, approvedAt: null, returnedReason: null, approvalRequestId: null,
  },
  approved(15, 11, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2025-11-25T08:00:00Z', '2025-12-01T08:00:00Z', 'First issue.',
    'Complete before requesting release approval.',
    [
      item(7, 10, 'Evaluation plan approved and attached.', true),
      item(8, 20, 'Official time zone and calendar confirmed.', true),
      item(9, 30, 'Mandatory requirements marked and evidence named.', true),
      item(10, 40, 'Funding confirmation current.', true),
      item(11, 50, 'Supplier-facing documents proofread.', false),
    ]),
  approved(16, 12, 1, 'approved', ADMIN_KWU, ADMIN_KWU, '2026-02-10T08:00:00Z', '2026-03-01T08:00:00Z', 'First issue.',
    '# Request for quotation\n\n1. Instructions\n2. Specifications\n3. Price schedule\n4. Declarations'),
  approved(30, 30, 1, 'approved', ADMIN_ODC, ADMIN_ODC, '2026-01-20T08:00:00Z', '2026-02-02T08:00:00Z', 'First issue.',
    '# Council request for quotation\n\n1. Instructions\n2. Service specification\n3. Price schedule\n4. Declarations'),
  {
    id: 31, templateId: 31, versionNo: 1, versionStatus: 'draft',
    bodyMarkdown: '# Award letter\n\nThe Council is pleased to inform you that your quotation for {tender_reference} has been accepted.',
    changeNote: 'First draft.', checklistItems: [], createdBy: ADMIN_ODC, createdAt: '2026-09-10T08:00:00Z', submittedBy: null, submittedAt: null,
    approvedBy: null, approvedAt: null, returnedReason: null, approvalRequestId: null,
  },
]);
