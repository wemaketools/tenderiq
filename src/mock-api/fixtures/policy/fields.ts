/**
 * Custom business fields (ADM-07) for the demo buyers. KWU extends all four forms, with conditional rules on a core
 * value (category, value band, event type) and on another field; some fields already sit on issued records, so
 * their structure is locked. One field is inactive. ODC has a small set of its own (cross-buyer segregation).
 */
import type {
  CustomFieldsAudience,
  CustomFieldsEntityType,
  CustomFieldsFieldType,
  CustomFieldsRequiredMode,
} from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

export interface FixtureCustomFieldChange {
  readonly at: string;
  readonly by: number | null;
  readonly summary: string;
}

export interface FixtureCustomField {
  readonly id: number;
  readonly tenantId: number;
  readonly entityType: CustomFieldsEntityType;
  readonly key: string;
  readonly label: string;
  readonly purpose: string;
  readonly fieldType: CustomFieldsFieldType;
  readonly allowedValues: readonly string[];
  readonly requiredMode: CustomFieldsRequiredMode;
  readonly requiredConditionField: string | null;
  readonly requiredConditionValue: string | null;
  readonly audience: CustomFieldsAudience;
  readonly includeInReports: boolean;
  readonly active: boolean;
  readonly sortOrder: number;
  readonly valueCount: number;
  readonly issuedRecordCount: number;
  readonly createdAt: string;
  readonly createdBy: number | null;
  readonly updatedAt: string;
  readonly updatedBy: number | null;
  readonly history: readonly FixtureCustomFieldChange[];
}

const kwu = TENANT_IDS.kwu;
const odc = TENANT_IDS.odc;
const ADMIN_KWU = 3;
const ADMIN_ODC = 22;

type FieldSeed = Omit<FixtureCustomField, 'tenantId' | 'createdBy' | 'updatedBy' | 'history' | 'requiredConditionField' | 'requiredConditionValue' | 'allowedValues' | 'active'> &
  Partial<Pick<FixtureCustomField, 'requiredConditionField' | 'requiredConditionValue' | 'allowedValues' | 'active' | 'history'>>;

function kwuField(seed: FieldSeed): FixtureCustomField {
  return {
    tenantId: kwu,
    createdBy: ADMIN_KWU,
    updatedBy: ADMIN_KWU,
    requiredConditionField: null,
    requiredConditionValue: null,
    allowedValues: [],
    active: true,
    history: [{ at: seed.createdAt, by: ADMIN_KWU, summary: 'Field created.' }],
    ...seed,
  };
}

export const CUSTOM_FIELDS: readonly FixtureCustomField[] = Object.freeze([
  // Procurement requests
  kwuField({
    id: 1, entityType: 'procurement_request', key: 'funding_vote_code', label: 'Funding vote code',
    purpose: 'Links the request to the approved budget vote so the budget owner can confirm funding.',
    fieldType: 'text', requiredMode: 'required', audience: 'buyer_internal', includeInReports: true, sortOrder: 10,
    valueCount: 12, issuedRecordCount: 10, createdAt: '2025-11-05T08:00:00Z', updatedAt: '2025-11-05T08:00:00Z',
  }),
  kwuField({
    id: 2, entityType: 'procurement_request', key: 'is_emergency', label: 'Emergency procurement',
    purpose: 'Flags a request raised under an emergency so the exception route and its justification apply.',
    fieldType: 'boolean', requiredMode: 'optional', audience: 'buyer_internal', includeInReports: true, sortOrder: 20,
    valueCount: 12, issuedRecordCount: 10, createdAt: '2025-11-05T08:05:00Z', updatedAt: '2025-11-05T08:05:00Z',
  }),
  kwuField({
    id: 3, entityType: 'procurement_request', key: 'emergency_justification', label: 'Emergency justification',
    purpose: 'Records why the need cannot wait for the ordinary timetable; reviewed by the Procurement Manager.',
    fieldType: 'text', requiredMode: 'conditional', requiredConditionField: 'is_emergency', requiredConditionValue: 'true',
    audience: 'buyer_internal', includeInReports: false, sortOrder: 30,
    valueCount: 1, issuedRecordCount: 1, createdAt: '2025-11-05T08:10:00Z', updatedAt: '2026-02-11T09:00:00Z',
    history: [
      { at: '2025-11-05T08:10:00Z', by: ADMIN_KWU, summary: 'Field created.' },
      { at: '2026-02-11T09:00:00Z', by: ADMIN_KWU, summary: 'Purpose clarified; applies to new requests only.' },
    ],
  }),
  kwuField({
    id: 4, entityType: 'procurement_request', key: 'asset_register_number', label: 'Asset register number',
    purpose: 'Identifies the pump or mechanical asset being replaced, for maintenance history.',
    fieldType: 'text', requiredMode: 'conditional', requiredConditionField: 'category_code', requiredConditionValue: 'WTR-PUMP',
    audience: 'buyer_internal', includeInReports: true, sortOrder: 40,
    valueCount: 3, issuedRecordCount: 3, createdAt: '2026-01-20T10:00:00Z', updatedAt: '2026-01-20T10:00:00Z',
  }),
  kwuField({
    id: 5, entityType: 'procurement_request', key: 'business_priority', label: 'Business priority',
    purpose: 'Helps the procurement team sequence the pipeline; it is not an evaluation input.',
    fieldType: 'choice', allowedValues: ['Critical', 'High', 'Normal'], requiredMode: 'required', audience: 'buyer_internal',
    includeInReports: true, sortOrder: 50, valueCount: 12, issuedRecordCount: 10, createdAt: '2025-11-05T08:15:00Z', updatedAt: '2025-11-05T08:15:00Z',
  }),
  // Tenders
  kwuField({
    id: 6, entityType: 'tender', key: 'local_content_target_percent', label: 'Local content target (%)',
    purpose: 'States the local content the buyer targets, published to suppliers with the tender.',
    fieldType: 'number', requiredMode: 'optional', audience: 'supplier_visible', includeInReports: true, sortOrder: 10,
    valueCount: 6, issuedRecordCount: 5, createdAt: '2025-11-06T08:00:00Z', updatedAt: '2025-11-06T08:00:00Z',
  }),
  kwuField({
    id: 7, entityType: 'tender', key: 'service_region', label: 'Service region',
    purpose: 'The KWU operating region where works or deliveries take place.',
    fieldType: 'choice', allowedValues: ['Central', 'North-East', 'Kgalagadi', 'Ngamiland', 'South-East'],
    requiredMode: 'conditional', requiredConditionField: 'event_type', requiredConditionValue: 'tender',
    audience: 'public', includeInReports: true, sortOrder: 20,
    valueCount: 7, issuedRecordCount: 6, createdAt: '2025-11-06T08:10:00Z', updatedAt: '2026-04-02T07:30:00Z',
    history: [
      { at: '2025-11-06T08:10:00Z', by: ADMIN_KWU, summary: 'Field created.' },
      { at: '2026-04-02T07:30:00Z', by: ADMIN_KWU, summary: 'Choice "South-East" added for new tenders.' },
    ],
  }),
  kwuField({
    id: 8, entityType: 'tender', key: 'donor_programme_code', label: 'Donor programme code',
    purpose: 'Donor-funded high-value events carry the programme code the donor audits against.',
    fieldType: 'text', requiredMode: 'conditional', requiredConditionField: 'value_band', requiredConditionValue: 'high',
    audience: 'buyer_internal', includeInReports: true, sortOrder: 30,
    valueCount: 1, issuedRecordCount: 1, createdAt: '2026-03-10T09:00:00Z', updatedAt: '2026-03-10T09:00:00Z',
  }),
  kwuField({
    id: 9, entityType: 'tender', key: 'environmental_permit_ref', label: 'Environmental permit reference',
    purpose: 'Civil works need the Department of Environmental Affairs permit reference before release.',
    fieldType: 'text', requiredMode: 'conditional', requiredConditionField: 'category_code', requiredConditionValue: 'CIV-WORKS',
    audience: 'supplier_visible', includeInReports: false, sortOrder: 40,
    valueCount: 1, issuedRecordCount: 1, createdAt: '2026-03-10T09:10:00Z', updatedAt: '2026-03-10T09:10:00Z',
  }),
  kwuField({
    id: 10, entityType: 'tender', key: 'legacy_vote_code', label: 'Legacy vote code',
    purpose: 'Budget vote code of the former finance system, kept for tenders issued before 2026.',
    fieldType: 'text', requiredMode: 'optional', audience: 'buyer_internal', includeInReports: false, sortOrder: 90, active: false,
    valueCount: 4, issuedRecordCount: 4, createdAt: '2024-06-01T08:00:00Z', updatedAt: '2026-01-05T08:00:00Z',
    history: [
      { at: '2024-06-01T08:00:00Z', by: ADMIN_KWU, summary: 'Field created.' },
      { at: '2026-01-05T08:00:00Z', by: ADMIN_KWU, summary: 'Deactivated: replaced by the funding vote code on requests.' },
    ],
  }),
  // Qualification applications
  kwuField({
    id: 11, entityType: 'qualification_application', key: 'ppadb_registration_number', label: 'PPADB registration number',
    purpose: 'Confirms the supplier is registered with the Public Procurement and Asset Disposal Board.',
    fieldType: 'text', requiredMode: 'required', audience: 'supplier_visible', includeInReports: true, sortOrder: 10,
    valueCount: 3, issuedRecordCount: 3, createdAt: '2025-11-07T08:00:00Z', updatedAt: '2025-11-07T08:00:00Z',
  }),
  kwuField({
    id: 12, entityType: 'qualification_application', key: 'water_sector_experience_years', label: 'Years of water-sector experience',
    purpose: 'Evidence of relevant experience for the water infrastructure program (documented criterion).',
    fieldType: 'number', requiredMode: 'required', audience: 'supplier_visible', includeInReports: true, sortOrder: 20,
    valueCount: 3, issuedRecordCount: 3, createdAt: '2025-11-07T08:05:00Z', updatedAt: '2025-11-07T08:05:00Z',
  }),
  kwuField({
    id: 13, entityType: 'qualification_application', key: 'pump_service_centre', label: 'Pump service centre location',
    purpose: 'Pump suppliers must name the service centre that supports warranty call-outs.',
    fieldType: 'text', requiredMode: 'conditional', requiredConditionField: 'category_code', requiredConditionValue: 'WTR-PUMP',
    audience: 'supplier_visible', includeInReports: false, sortOrder: 30,
    valueCount: 1, issuedRecordCount: 1, createdAt: '2026-01-20T10:30:00Z', updatedAt: '2026-01-20T10:30:00Z',
  }),
  kwuField({
    id: 14, entityType: 'qualification_application', key: 'assessor_internal_note', label: 'Assessor internal note',
    purpose: 'Internal note for the qualification team; never shown to suppliers.',
    fieldType: 'text', requiredMode: 'optional', audience: 'buyer_internal', includeInReports: false, sortOrder: 40,
    valueCount: 2, issuedRecordCount: 0, createdAt: '2026-05-04T08:00:00Z', updatedAt: '2026-05-04T08:00:00Z',
  }),
  // Contracts
  kwuField({
    id: 15, entityType: 'contract', key: 'commitment_vote_code', label: 'Commitment vote code',
    purpose: 'The budget vote the contract commitment is recorded against.',
    fieldType: 'text', requiredMode: 'required', audience: 'buyer_internal', includeInReports: true, sortOrder: 10,
    valueCount: 3, issuedRecordCount: 2, createdAt: '2025-11-08T08:00:00Z', updatedAt: '2025-11-08T08:00:00Z',
  }),
  kwuField({
    id: 16, entityType: 'contract', key: 'warranty_months', label: 'Warranty period (months)',
    purpose: 'Pump and mechanical contracts state the warranty the supplier committed to.',
    fieldType: 'number', requiredMode: 'conditional', requiredConditionField: 'category_code', requiredConditionValue: 'WTR-PUMP',
    audience: 'supplier_visible', includeInReports: true, sortOrder: 20,
    valueCount: 1, issuedRecordCount: 0, createdAt: '2026-01-20T11:00:00Z', updatedAt: '2026-01-20T11:00:00Z',
  }),
  kwuField({
    id: 17, entityType: 'contract', key: 'public_extract_summary', label: 'Public extract summary',
    purpose: 'Plain-language summary released in the approved public contract extract.',
    fieldType: 'text', requiredMode: 'conditional', requiredConditionField: 'value_band', requiredConditionValue: 'high',
    audience: 'public', includeInReports: false, sortOrder: 30,
    valueCount: 0, issuedRecordCount: 0, createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-01T08:00:00Z',
  }),
  kwuField({
    id: 18, entityType: 'contract', key: 'site_handover_date', label: 'Site handover date',
    purpose: 'Works contracts record when the site is handed to the contractor.',
    fieldType: 'date', requiredMode: 'optional', audience: 'supplier_visible', includeInReports: true, sortOrder: 40,
    valueCount: 1, issuedRecordCount: 1, createdAt: '2026-06-01T08:10:00Z', updatedAt: '2026-06-01T08:10:00Z',
  }),
  // ODC
  {
    id: 40, tenantId: odc, entityType: 'tender', key: 'ward_number', label: 'Ward number',
    purpose: 'The council ward where the service is delivered.', fieldType: 'text', allowedValues: [],
    requiredMode: 'required', requiredConditionField: null, requiredConditionValue: null, audience: 'public',
    includeInReports: true, active: true, sortOrder: 10, valueCount: 1, issuedRecordCount: 1,
    createdAt: '2026-01-15T08:00:00Z', createdBy: ADMIN_ODC, updatedAt: '2026-01-15T08:00:00Z', updatedBy: ADMIN_ODC,
    history: [{ at: '2026-01-15T08:00:00Z', by: ADMIN_ODC, summary: 'Field created.' }],
  },
  {
    id: 41, tenantId: odc, entityType: 'procurement_request', key: 'council_resolution_ref', label: 'Council resolution reference',
    purpose: 'High-value requests cite the full council resolution that authorized them.', fieldType: 'text', allowedValues: [],
    requiredMode: 'conditional', requiredConditionField: 'value_band', requiredConditionValue: 'high', audience: 'buyer_internal',
    includeInReports: true, active: true, sortOrder: 10, valueCount: 0, issuedRecordCount: 0,
    createdAt: '2026-01-15T08:10:00Z', createdBy: ADMIN_ODC, updatedAt: '2026-01-15T08:10:00Z', updatedBy: ADMIN_ODC,
    history: [{ at: '2026-01-15T08:10:00Z', by: ADMIN_ODC, summary: 'Field created.' }],
  },
  {
    id: 42, tenantId: odc, entityType: 'qualification_application', key: 'council_vendor_number', label: 'Council vendor number',
    purpose: 'The vendor number of the council finance system, when the supplier already has one.', fieldType: 'text',
    allowedValues: [], requiredMode: 'optional', requiredConditionField: null, requiredConditionValue: null,
    audience: 'supplier_visible', includeInReports: false, active: true, sortOrder: 10, valueCount: 0, issuedRecordCount: 0,
    createdAt: '2026-01-15T08:20:00Z', createdBy: ADMIN_ODC, updatedAt: '2026-01-15T08:20:00Z', updatedBy: ADMIN_ODC,
    history: [{ at: '2026-01-15T08:20:00Z', by: ADMIN_ODC, summary: 'Field created.' }],
  },
]);

export interface FixtureCustomFieldValues {
  readonly tenantId: number;
  readonly entityType: CustomFieldsEntityType;
  /** The request, tender, qualification application or contract id. */
  readonly recordId: number;
  readonly values: Readonly<Record<string, string | boolean | null>>;
}

/** Custom field values already recorded on storyline records (the owning forms show and edit them). */
export const CUSTOM_FIELD_VALUES: readonly FixtureCustomFieldValues[] = Object.freeze<FixtureCustomFieldValues[]>([
  // PR-2026-0001 Borehole pump replacement programme (WTR-PUMP), PR-2026-0003, PR-2026-0005
  { tenantId: kwu, entityType: 'procurement_request', recordId: 1, values: { funding_vote_code: 'CAP-2026-0107', is_emergency: false, asset_register_number: 'AR-PMP-2291', business_priority: 'Critical' } },
  { tenantId: kwu, entityType: 'procurement_request', recordId: 3, values: { funding_vote_code: 'DEV-2026-0412', is_emergency: false, business_priority: 'High' } },
  { tenantId: kwu, entityType: 'procurement_request', recordId: 5, values: { funding_vote_code: 'OPS-2026-0318', business_priority: 'Normal' } },
  { tenantId: kwu, entityType: 'procurement_request', recordId: 14, values: { funding_vote_code: 'OPS-2026-0522', is_emergency: false, business_priority: 'Normal' } },
  // T-2026-0001, T-2026-0007 (civil works) and ODC T-2026-0011
  { tenantId: kwu, entityType: 'tender', recordId: 1, values: { local_content_target_percent: '30.00', service_region: 'Central', donor_programme_code: 'KWU-CAP-2026' } },
  { tenantId: kwu, entityType: 'tender', recordId: 7, values: { service_region: 'South-East', environmental_permit_ref: 'EIA/2026/117' } },
  { tenantId: kwu, entityType: 'tender', recordId: 2, values: { local_content_target_percent: '20.00' } },
  { tenantId: kwu, entityType: 'tender', recordId: 3, values: { service_region: 'Central' } },
  { tenantId: kwu, entityType: 'tender', recordId: 5, values: { local_content_target_percent: '40.00', service_region: 'Central', donor_programme_code: 'KWU-OPS-2027' } },
  { tenantId: kwu, entityType: 'tender', recordId: 8, values: { service_region: 'North-East' } },
  { tenantId: kwu, entityType: 'tender', recordId: 14, values: { service_region: 'Central', donor_programme_code: 'KWU-CAP-2026' } },
  { tenantId: odc, entityType: 'tender', recordId: 11, values: { ward_number: 'Maun West 4' } },
  // Qualification applications QA-2026-0002 (Tsodilo), QA-2026-0003 (Chobe), QA-2026-0006 (Makgadikgadi, incomplete)
  { tenantId: kwu, entityType: 'qualification_application', recordId: 501, values: { ppadb_registration_number: 'PPADB-2.2-04417', water_sector_experience_years: '14', pump_service_centre: 'Francistown' } },
  { tenantId: kwu, entityType: 'qualification_application', recordId: 502, values: { ppadb_registration_number: 'PPADB-2.4-01983', water_sector_experience_years: '9' } },
  { tenantId: kwu, entityType: 'qualification_application', recordId: 503, values: { ppadb_registration_number: 'PPADB-OC-11872' } },
  // C-2026-0001 Fleet maintenance, C-2026-0002 Borehole pumps Lot 1
  { tenantId: kwu, entityType: 'contract', recordId: 1, values: { commitment_vote_code: 'OPS-2026-0930', site_handover_date: '2026-04-01' } },
  { tenantId: kwu, entityType: 'contract', recordId: 2, values: { commitment_vote_code: 'CAP-2026-0107', warranty_months: '24' } },
  { tenantId: kwu, entityType: 'contract', recordId: 3, values: { commitment_vote_code: 'OPS-2026-0610', warranty_months: '12' } },
  { tenantId: kwu, entityType: 'contract', recordId: 8, values: { commitment_vote_code: 'CAP-2026-0107', warranty_months: '12' } },
] satisfies FixtureCustomFieldValues[]);
