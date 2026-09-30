/**
 * Report definitions, runs and exports (REP-02, ADM-13, ADM-14 evidence packs; blueprint `report_definitions`,
 * `report_runs`, `exports`; DD-16, DD-19).
 *
 * - Definition 1 is the weekly ExCo pipeline: its latest run excluded the departed officer, whose membership was
 *   revoked (recipient authorization re-checked at issue time, DD-19).
 * - Definition 3 lists a recipient without the audience permission, so the preview flags them.
 * - Exports cover every status (ready, running, queued, failed), every format and both report exports and
 *   evidence packs, with manifests stating contents, versions, omissions and redactions.
 */
import type { ExportsExportType, ExportsFormat, ExportsStatus, ReportDefinitionsFamily } from '../../../contracts/enums.js';
import type { ExportManifest, ReportAudiencePermission, ReportFilters } from '../../../contracts/reporting.js';
import { KWU, LEGACY_TENDER_ID, ODC, USERS } from './storyline.js';

export const EMPTY_FILTERS: ReportFilters = {
  from: null,
  to: null,
  legalEntityIds: [],
  departmentIds: [],
  categoryIds: [],
  ownerUserIds: [],
  stages: [],
  eventTypes: [],
  level: 'both',
};

export interface FixtureReportDefinition {
  readonly id: number;
  readonly tenantId: number;
  readonly name: string;
  readonly family: ReportDefinitionsFamily;
  readonly fields: readonly string[];
  readonly filters: ReportFilters;
  readonly currencyBasis: string;
  readonly conversionDate: string | null;
  readonly audiencePermission: ReportAudiencePermission;
  readonly scheduleCron: string | null;
  readonly scheduleDescription: string | null;
  readonly nextRunAt: string | null;
  readonly ownerUserId: number;
  readonly active: boolean;
  readonly recipientUserIds: readonly number[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const REPORT_DEFINITIONS: readonly FixtureReportDefinition[] = [
  {
    id: 1,
    tenantId: KWU,
    name: 'Weekly pipeline for ExCo',
    family: 'pipeline',
    fields: ['reference', 'title', 'stage', 'department', 'owner', 'estimatedValue', 'nextMilestone'],
    filters: EMPTY_FILTERS,
    currencyBasis: 'BWP',
    conversionDate: null,
    audiencePermission: 'report.view',
    scheduleCron: '0 6 * * 1',
    scheduleDescription: 'Every Monday at 06:00 (Africa/Gaborone)',
    nextRunAt: '2026-10-12T04:00:00Z',
    ownerUserId: USERS.mpho,
    active: true,
    recipientUserIds: [USERS.mpho, USERS.keabetswe, USERS.onalenna, USERS.pule],
    createdAt: '2026-06-01T08:30:00Z',
    updatedAt: '2026-09-02T10:12:00Z',
  },
  {
    id: 2,
    tenantId: KWU,
    name: 'Participation by tender (unique organizations)',
    family: 'participation',
    fields: ['reference', 'scope', 'registeredInterest', 'uniqueBidders', 'submittedRevisions', 'compliantBids'],
    filters: { ...EMPTY_FILTERS, from: '2026-01-01', to: '2026-12-31' },
    currencyBasis: 'BWP',
    conversionDate: null,
    audiencePermission: 'report.view',
    scheduleCron: null,
    scheduleDescription: null,
    nextRunAt: null,
    ownerUserId: USERS.mpho,
    active: true,
    recipientUserIds: [],
    createdAt: '2026-09-15T13:00:00Z',
    updatedAt: '2026-10-04T14:15:00Z',
  },
  {
    id: 3,
    tenantId: KWU,
    name: 'Contract performance monthly',
    family: 'contract_performance',
    fields: ['reference', 'title', 'supplier', 'status', 'obligationsAccepted', 'obligationsOverdue', 'changeRequests', 'ceiling', 'nextRenewal'],
    filters: EMPTY_FILTERS,
    currencyBasis: 'BWP',
    conversionDate: null,
    audiencePermission: 'contract.view',
    scheduleCron: '0 7 1 * *',
    scheduleDescription: 'On the 1st of every month at 07:00 (Africa/Gaborone)',
    nextRunAt: '2026-11-01T05:00:00Z',
    ownerUserId: USERS.mpho,
    active: true,
    recipientUserIds: [USERS.masego, USERS.keabetswe, USERS.kagiso],
    createdAt: '2026-07-01T07:45:00Z',
    updatedAt: '2026-09-30T16:20:00Z',
  },
  {
    id: 4,
    tenantId: KWU,
    name: 'Audit and records quarterly',
    family: 'audit_records',
    fields: ['reference', 'title', 'decisionsRecorded', 'versionsRetained', 'retentionEnds', 'legalHold'],
    filters: EMPTY_FILTERS,
    currencyBasis: 'BWP',
    conversionDate: null,
    audiencePermission: 'audit.view',
    scheduleCron: '0 8 1 1,4,7,10 *',
    scheduleDescription: 'Quarterly on the 1st of Jan, Apr, Jul and Oct at 08:00 (Africa/Gaborone)',
    nextRunAt: '2027-01-01T06:00:00Z',
    ownerUserId: USERS.mpho,
    active: true,
    recipientUserIds: [USERS.pule, USERS.dineo],
    createdAt: '2026-04-02T09:00:00Z',
    updatedAt: '2026-07-01T08:05:00Z',
  },
  {
    id: 5,
    tenantId: KWU,
    name: 'Commercial outcomes FY2026',
    family: 'commercial_outcomes',
    fields: ['reference', 'scope', 'baselineDate', 'estimate', 'offer', 'award', 'priceReduction', 'realizedSavings'],
    filters: { ...EMPTY_FILTERS, from: '2026-04-01', to: '2027-03-31' },
    currencyBasis: 'BWP',
    conversionDate: '2026-04-01',
    audiencePermission: 'contract.financials.view',
    scheduleCron: null,
    scheduleDescription: null,
    nextRunAt: null,
    ownerUserId: USERS.mpho,
    active: false,
    recipientUserIds: [USERS.masego],
    createdAt: '2026-04-05T10:00:00Z',
    updatedAt: '2026-08-14T11:30:00Z',
  },
  {
    id: 6,
    tenantId: KWU,
    name: 'Evaluation integrity — SCADA telemetry upgrade',
    family: 'evaluation_integrity',
    fields: ['reference', 'scope', 'assignments', 'missingScores', 'maxVariance', 'moderatedChanges', 'conflictsDeclared'],
    filters: EMPTY_FILTERS,
    currencyBasis: 'BWP',
    conversionDate: null,
    audiencePermission: 'audit.view',
    scheduleCron: null,
    scheduleDescription: null,
    nextRunAt: null,
    ownerUserId: USERS.mpho,
    active: true,
    recipientUserIds: [USERS.pule],
    createdAt: '2026-10-02T08:50:00Z',
    updatedAt: '2026-10-02T08:50:00Z',
  },
  {
    id: 7,
    tenantId: ODC,
    name: 'ODC open events',
    family: 'pipeline',
    fields: ['reference', 'title', 'stage', 'owner', 'estimatedValue'],
    filters: EMPTY_FILTERS,
    currencyBasis: 'BWP',
    conversionDate: null,
    audiencePermission: 'report.view',
    scheduleCron: null,
    scheduleDescription: null,
    nextRunAt: null,
    ownerUserId: USERS.officerOdc,
    active: true,
    recipientUserIds: [],
    createdAt: '2026-09-20T09:00:00Z',
    updatedAt: '2026-09-20T09:00:00Z',
  },
];

export interface FixtureReportRun {
  readonly id: number;
  readonly tenantId: number;
  readonly definitionId: number;
  readonly runBy: number | null;
  readonly runAt: string;
  readonly rowCount: number;
  readonly exportId: number | null;
  readonly recipientUserIds: readonly number[];
  readonly excluded: ReadonlyArray<{ readonly userId: number; readonly reason: string }>;
}

export const REPORT_RUNS: readonly FixtureReportRun[] = [
  { id: 1, tenantId: KWU, definitionId: 1, runBy: null, runAt: '2026-09-21T04:00:00Z', rowCount: 11, exportId: 1, recipientUserIds: [USERS.mpho, USERS.keabetswe, USERS.onalenna, USERS.pule], excluded: [] },
  { id: 2, tenantId: KWU, definitionId: 1, runBy: null, runAt: '2026-09-28T04:00:00Z', rowCount: 11, exportId: 2, recipientUserIds: [USERS.mpho, USERS.keabetswe, USERS.onalenna, USERS.pule], excluded: [{ userId: USERS.formerOfficer, reason: 'Membership revoked on 18 Sep 2026: no longer authorized when the run was issued.' }] },
  { id: 3, tenantId: KWU, definitionId: 1, runBy: null, runAt: '2026-10-05T04:00:00Z', rowCount: 11, exportId: 3, recipientUserIds: [USERS.mpho, USERS.keabetswe, USERS.onalenna, USERS.pule], excluded: [] },
  { id: 4, tenantId: KWU, definitionId: 2, runBy: USERS.mpho, runAt: '2026-10-04T14:20:00Z', rowCount: 12, exportId: 4, recipientUserIds: [], excluded: [] },
  { id: 5, tenantId: KWU, definitionId: 3, runBy: null, runAt: '2026-10-01T05:00:00Z', rowCount: 3, exportId: 5, recipientUserIds: [USERS.masego, USERS.keabetswe], excluded: [{ userId: USERS.kagiso, reason: 'Does not hold contract.view (the audience permission) in Kalahari Water Utilities (Pilot).' }] },
  { id: 6, tenantId: KWU, definitionId: 4, runBy: null, runAt: '2026-07-01T06:00:00Z', rowCount: 4, exportId: null, recipientUserIds: [USERS.pule, USERS.dineo], excluded: [] },
];

export interface FixtureExport {
  readonly id: number;
  readonly tenantId: number;
  readonly exportType: ExportsExportType;
  readonly format: ExportsFormat;
  readonly status: ExportsStatus;
  readonly scopeDescription: string;
  readonly subjectType: string | null;
  readonly subjectId: number | null;
  readonly subjectLabel: string | null;
  readonly reportFamily: ReportDefinitionsFamily | null;
  readonly definitionId: number | null;
  readonly requestedBy: number;
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly error: string | null;
  readonly documentId: number | null;
  readonly fileName: string | null;
  readonly sizeBytes: number | null;
  readonly manifest: ExportManifest | null;
}

const PIPELINE_MANIFEST: ExportManifest = {
  contents: [{ label: 'Procurement pipeline', description: 'Event-level rows with stage, owner and estimated value (BWP).', recordCount: 11 }],
  versions: [{ label: 'Report definition', reference: 'Weekly pipeline for ExCo', version: 'v3 (2 Sep 2026)' }],
  omissions: [{ label: 'Archived legacy events', reason: 'Archived events are outside the pipeline family.' }],
  redactions: [],
};

export const EXPORTS: readonly FixtureExport[] = [
  { id: 1, tenantId: KWU, exportType: 'report', format: 'csv', status: 'ready', scopeDescription: 'Weekly pipeline for ExCo — run of 21 Sep 2026', subjectType: 'report_definition', subjectId: 1, subjectLabel: 'Weekly pipeline for ExCo', reportFamily: 'pipeline', definitionId: 1, requestedBy: USERS.mpho, requestedAt: '2026-09-21T04:00:00Z', completedAt: '2026-09-21T04:00:41Z', error: null, documentId: 7001, fileName: 'pipeline-2026-09-21.csv', sizeBytes: 2184, manifest: PIPELINE_MANIFEST },
  { id: 2, tenantId: KWU, exportType: 'report', format: 'csv', status: 'ready', scopeDescription: 'Weekly pipeline for ExCo — run of 28 Sep 2026', subjectType: 'report_definition', subjectId: 1, subjectLabel: 'Weekly pipeline for ExCo', reportFamily: 'pipeline', definitionId: 1, requestedBy: USERS.mpho, requestedAt: '2026-09-28T04:00:00Z', completedAt: '2026-09-28T04:00:39Z', error: null, documentId: 7002, fileName: 'pipeline-2026-09-28.csv', sizeBytes: 2201, manifest: PIPELINE_MANIFEST },
  { id: 3, tenantId: KWU, exportType: 'report', format: 'xlsx', status: 'running', scopeDescription: 'Weekly pipeline for ExCo — run of 5 Oct 2026', subjectType: 'report_definition', subjectId: 1, subjectLabel: 'Weekly pipeline for ExCo', reportFamily: 'pipeline', definitionId: 1, requestedBy: USERS.mpho, requestedAt: '2026-10-05T04:00:00Z', completedAt: null, error: null, documentId: null, fileName: null, sizeBytes: null, manifest: null },
  {
    id: 4,
    tenantId: KWU,
    exportType: 'report',
    format: 'csv',
    status: 'ready',
    scopeDescription: 'Participation by tender (unique organizations), 2026',
    subjectType: 'report_definition',
    subjectId: 2,
    subjectLabel: 'Participation by tender (unique organizations)',
    reportFamily: 'participation',
    definitionId: 2,
    requestedBy: USERS.mpho,
    requestedAt: '2026-10-04T14:20:00Z',
    completedAt: '2026-10-04T14:20:22Z',
    error: null,
    documentId: 7004,
    fileName: 'participation-2026-10-04.csv',
    sizeBytes: 1630,
    manifest: {
      contents: [{ label: 'Competition and participation', description: 'Event rows and lot rows, labelled; unique organizations per event and per lot.', recordCount: 12 }],
      versions: [{ label: 'Report definition', reference: 'Participation by tender (unique organizations)', version: 'v1 (15 Sep 2026)' }],
      omissions: [{ label: 'Compliance counts for unopened events', reason: 'Shown as missing until the opening gate (T-2026-0002, T-2026-0006, T-2026-0008).' }],
      redactions: [{ field: 'Bidder names for sealed events', reason: 'Only receipt metadata is available before opening.' }],
    },
  },
  {
    id: 5,
    tenantId: KWU,
    exportType: 'report',
    format: 'html',
    status: 'ready',
    scopeDescription: 'Contract performance monthly — run of 1 Oct 2026',
    subjectType: 'report_definition',
    subjectId: 3,
    subjectLabel: 'Contract performance monthly',
    reportFamily: 'contract_performance',
    definitionId: 3,
    requestedBy: USERS.masego,
    requestedAt: '2026-10-01T05:00:00Z',
    completedAt: '2026-10-01T05:01:02Z',
    error: null,
    documentId: 7005,
    fileName: 'contract-performance-2026-10.html',
    sizeBytes: 9412,
    manifest: {
      contents: [{ label: 'Contract performance', description: 'One row per contract: obligations, changes, ceiling and renewal dates.', recordCount: 3 }],
      versions: [{ label: 'Report definition', reference: 'Contract performance monthly', version: 'v2 (30 Sep 2026)' }],
      omissions: [{ label: 'Recipient Kagiso Phiri', reason: 'Not authorized for the audience permission at issue time.' }],
      redactions: [{ field: 'Invoiced and paid amounts', reason: 'Requires contract.financials.view.' }],
    },
  },
  { id: 6, tenantId: KWU, exportType: 'report', format: 'xlsx', status: 'failed', scopeDescription: 'Procurement pipeline, Q3 2026', subjectType: null, subjectId: null, subjectLabel: null, reportFamily: 'pipeline', definitionId: null, requestedBy: USERS.tebogo, requestedAt: '2026-09-30T12:10:00Z', completedAt: '2026-09-30T12:15:00Z', error: 'The export worker did not finish in time. Request the export again.', documentId: null, fileName: null, sizeBytes: null, manifest: null },
  {
    id: 7,
    tenantId: KWU,
    exportType: 'evidence_pack',
    format: 'html',
    status: 'ready',
    scopeDescription: 'Evidence pack — T-2025-0003 legacy pump supply (legal hold)',
    subjectType: 'tender',
    subjectId: LEGACY_TENDER_ID,
    subjectLabel: 'T-2025-0003 Maun wellfield pump supply (legacy import, 2018)',
    reportFamily: null,
    definitionId: null,
    requestedBy: USERS.pule,
    requestedAt: '2026-08-15T09:05:00Z',
    completedAt: '2026-08-15T09:07:31Z',
    error: null,
    documentId: 7007,
    fileName: 'evidence-pack-T-2025-0003.html',
    sizeBytes: 48211,
    manifest: {
      contents: [
        { label: 'Tender record and notice', description: 'Imported tender record with its original business dates and provenance.', recordCount: 1 },
        { label: 'Bids and receipts', description: 'Three imported bid files with their original submission dates.', recordCount: 3 },
        { label: 'Audit trail', description: 'Import, hold and access events.', recordCount: 6 },
      ],
      versions: [{ label: 'Tender snapshot', reference: 'T-2025-0003', version: 'v2 (imported 12 Mar 2025)' }],
      omissions: [{ label: 'Approvals before 2025', reason: 'Not captured in the legacy spreadsheet import (completeness gap).' }],
      redactions: [{ field: 'Bidder bank details', reason: 'Personal and banking information outside the pack purpose.' }],
    },
  },
  {
    id: 8,
    tenantId: KWU,
    exportType: 'evidence_pack',
    format: 'html',
    status: 'ready',
    scopeDescription: 'Evidence pack — T-2026-0008 closing and receipts',
    subjectType: 'tender',
    subjectId: 8,
    subjectLabel: 'T-2026-0008 Pipeline valves bulk supply',
    reportFamily: null,
    definitionId: null,
    requestedBy: USERS.pule,
    requestedAt: '2026-10-01T10:40:00Z',
    completedAt: '2026-10-01T10:41:12Z',
    error: null,
    documentId: 7008,
    fileName: 'evidence-pack-T-2026-0008.html',
    sizeBytes: 21877,
    manifest: {
      contents: [
        { label: 'Tender versions and addenda', description: 'Issued package and the one addendum.', recordCount: 2 },
        { label: 'Receipt metadata', description: 'Receipt numbers, times and the withdrawal record.', recordCount: 2 },
      ],
      versions: [{ label: 'Tender snapshot', reference: 'T-2026-0008', version: 'v2 (addendum 1)' }],
      omissions: [{ label: 'Bid contents', reason: 'Sealed until the opening session on 7 Oct 2026 (BR-17).' }],
      redactions: [],
    },
  },
  { id: 9, tenantId: KWU, exportType: 'evidence_pack', format: 'csv', status: 'queued', scopeDescription: 'Evidence pack — C-2026-0001 change requests', subjectType: 'contract', subjectId: 1, subjectLabel: 'C-2026-0001 Fleet vehicle maintenance', reportFamily: null, definitionId: null, requestedBy: USERS.masego, requestedAt: '2026-10-05T05:55:00Z', completedAt: null, error: null, documentId: null, fileName: null, sizeBytes: null, manifest: null },
  {
    id: 10,
    tenantId: ODC,
    exportType: 'report',
    format: 'csv',
    status: 'ready',
    scopeDescription: 'ODC open events',
    subjectType: 'report_definition',
    subjectId: 7,
    subjectLabel: 'ODC open events',
    reportFamily: 'pipeline',
    definitionId: 7,
    requestedBy: USERS.officerOdc,
    requestedAt: '2026-09-20T09:05:00Z',
    completedAt: '2026-09-20T09:05:18Z',
    error: null,
    documentId: 7010,
    fileName: 'odc-open-events-2026-09-20.csv',
    sizeBytes: 402,
    manifest: {
      contents: [{ label: 'Procurement pipeline', description: 'Open events of Okavango District Council.', recordCount: 1 }],
      versions: [{ label: 'Report definition', reference: 'ODC open events', version: 'v1 (20 Sep 2026)' }],
      omissions: [],
      redactions: [],
    },
  },
];
