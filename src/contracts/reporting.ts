/**
 * Reporting contract (domain 15): the buyer and supplier dashboards, management reports, report definitions and
 * controlled exports, and global search with saved views (FR-21; PRD §11.1 COM-08, §11.3 SUP-01, §12.1 BUY-01,
 * §13.2 ADM-13, §13.4 REP-01/REP-02, §15; BR-43; AC-34; DD-16, DD-19, DD-21, DD-23).
 *
 * Rules every implementation (mock and Stage B) must honor:
 * - Every panel, count, total, search result and export respects the underlying record access (PRD §4.3 closing
 *   rule, BR-43). A panel the caller may not read is returned with `restricted: true` and NO items or counts; it
 *   never reveals how many records it hides.
 * - Report safeguards (PRD §15.2, AC-34): participation counts unique organizations, never revisions; each row
 *   states whether it is event-level or lot-level and whole-event values are never added to their lots; the
 *   currency basis and conversion date are stated; completeness is shown and missing data is never zero.
 * - Exports carry a manifest (contents, versions, omissions, redactions). Scheduled recipients are re-checked at
 *   issue time (DD-19); an unauthorized recipient is excluded and listed.
 * - `/api/v1/me/search` spans every active membership, labels each result with its organization and filters each
 *   result by the caller's authorization in the row's tenant (DD-21). Saved views are the caller's own.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  CurrencyCode,
  DecimalString,
  Id,
  IdParam,
  Instant,
  JsonObject,
  LinkPath,
  ListQuery,
  Money,
  NonNegativeDecimalString,
  OrganizationLabel,
  PersonRef,
  QueryBoolean,
  ReasonText,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { SCREEN_ID_PATTERN, defineEndpoint } from './endpoint.js';
import {
  APPROVAL_REQUESTS_SUBJECT_TYPE,
  BIDS_SUBMISSION_STATE,
  BID_REVISIONS_STATUS,
  CHIP_TONES,
  ENUMS,
  EVIDENCE_ITEMS_EVIDENCE_TYPE,
  EXPORTS_EXPORT_TYPE,
  EXPORTS_FORMAT,
  EXPORTS_STATUS,
  LOT_OUTCOMES_OUTCOME,
  LOT_OUTCOMES_STATUS,
  OBLIGATIONS_KIND,
  OBLIGATIONS_STATUS,
  PARTICIPANTS_INVITATION_STATUS,
  PURSUITS_DECISION,
  RENEWAL_OPTIONS_OPTION_TYPE,
  REPORT_DEFINITIONS_FAMILY,
  TENDERS_EVENT_TYPE,
  TENDERS_STATUS,
  TENDER_MILESTONES_MILESTONE,
  V_QUALIFICATION_STATUS_EFFECTIVE_STATUS,
  isEnumValue,
} from './enums.js';
import type { EnumName } from './enums.js';

// ---------------------------------------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------------------------------------

const ENUM_NAME_LIST = Object.keys(ENUMS) as [EnumName, ...EnumName[]];

/** A lifecycle value with the enumeration it belongs to, so the SPA renders it with StatusChip. */
export const EnumRef = z
  .object({
    enum: z.enum(ENUM_NAME_LIST),
    value: z.string().min(1),
  })
  .refine((ref) => isEnumValue(ref.enum, ref.value), issue('INVALID_ENUM_VALUE', 'Not a value of the enumeration.'));
export type EnumRef = z.infer<typeof EnumRef>;

/** A selectable filter option (entity, department, category) with its id. */
export const FilterOption = z.object({
  id: Id,
  label: z.string().min(1),
  code: z.string().nullable(),
});
export type FilterOption = z.infer<typeof FilterOption>;

/** A dashboard panel: either the visible items, or `restricted` with no items (BR-43). */
function panelOf<T extends z.ZodType>(item: T) {
  return z.object({
    restricted: z.boolean(),
    items: z.array(item),
  });
}

/** Where a number stands against the previous comparable period. */
export const KpiDelta = z.object({
  direction: z.enum(['up', 'down', 'flat']),
  value: z.number().int().min(0),
  /** True when the movement is good news (for example fewer overdue obligations). */
  positive: z.boolean(),
  comparedTo: z.string().min(1),
});
export type KpiDelta = z.infer<typeof KpiDelta>;

/** A count KPI. `value` is `null` exactly when `restricted` (no count leaks, BR-43). */
function kpiOf<K extends readonly [string, ...string[]]>(keys: K) {
  return z
    .object({
      key: z.enum(keys),
      value: z.number().int().min(0).nullable(),
      restricted: z.boolean(),
      delta: KpiDelta.nullable(),
      hint: z.string().nullable(),
      to: LinkPath.nullable(),
    })
    .refine((kpi) => (kpi.value === null) === kpi.restricted, issue('KPI_RESTRICTION', 'Restricted KPIs carry no value.'));
}

/** A tenant-level dimension filter used by dashboards, reports and report definitions. */
const DimensionFilters = z.object({
  from: CalendarDate.optional(),
  to: CalendarDate.optional(),
  legalEntityId: IdParam.optional(),
  departmentId: IdParam.optional(),
  categoryId: IdParam.optional(),
  ownerUserId: IdParam.optional(),
});

// ---------------------------------------------------------------------------------------------------------
// BUY-01 — buyer procurement dashboard
// ---------------------------------------------------------------------------------------------------------

/** The KPI cards of BUY-01, in display order. */
export const BUYER_DASHBOARD_KPIS = [
  'active_events',
  'pending_approvals',
  'closing_within_7_days',
  'open_complaints',
  'renewals_within_90_days',
  'overdue_obligations',
] as const;
export type BuyerDashboardKpiKey = (typeof BUYER_DASHBOARD_KPIS)[number];

export const BuyerDashboardQuery = DimensionFilters.extend({
  stage: queryList(z.enum(TENDERS_STATUS)).optional(),
  minValue: NonNegativeDecimalString.optional(),
  maxValue: NonNegativeDecimalString.optional(),
});
export type BuyerDashboardQuery = z.input<typeof BuyerDashboardQuery>;

export const PipelineStageItem = z.object({
  stage: z.enum(TENDERS_STATUS),
  count: z.number().int().min(0),
  estimatedValue: Money,
  to: LinkPath,
});
export type PipelineStageItem = z.infer<typeof PipelineStageItem>;

export const DashboardDeadline = z.object({
  tenderId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  milestone: z.enum(TENDER_MILESTONES_MILESTONE),
  /** Lot label when the deadline is lot-specific (DD-15), otherwise `null`. */
  lotLabel: z.string().nullable(),
  deadline: z.object({ at: Instant, timeZone: TimeZone }),
  owner: PersonRef,
  to: LinkPath,
});
export type DashboardDeadline = z.infer<typeof DashboardDeadline>;

export const WorkloadItem = z.object({
  owner: PersonRef,
  activeEvents: z.number().int().min(0),
  openTasks: z.number().int().min(0),
  overdueTasks: z.number().int().min(0),
  pendingApprovals: z.number().int().min(0),
  to: LinkPath,
});
export type WorkloadItem = z.infer<typeof WorkloadItem>;

export const DashboardApproval = z.object({
  approvalId: Id,
  title: z.string().min(1),
  subjectType: z.enum(APPROVAL_REQUESTS_SUBJECT_TYPE),
  amount: Money.nullable(),
  requestedBy: PersonRef,
  requestedAt: Instant,
  dueAt: Instant.nullable(),
  overdue: z.boolean(),
  to: LinkPath,
});
export type DashboardApproval = z.infer<typeof DashboardApproval>;

export const DashboardRenewal = z.object({
  contractId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  supplierName: z.string().min(1),
  optionType: z.enum(RENEWAL_OPTIONS_OPTION_TYPE),
  noticeWindowOpensOn: CalendarDate,
  decisionDueOn: CalendarDate,
  decided: z.boolean(),
  to: LinkPath,
});
export type DashboardRenewal = z.infer<typeof DashboardRenewal>;

export const ATTENTION_KEYS = [
  'approval_invalidated',
  'blocking_complaint',
  'failed_due_diligence',
  'evaluation_incomplete',
  'integration_exception',
  'evidence_expiring',
  'obligation_rejected',
  'renewal_window',
  'change_authority_exceeded',
  'sealed_awaiting_opening',
] as const;
export type AttentionKey = (typeof ATTENTION_KEYS)[number];

export const AttentionItem = z.object({
  key: z.enum(ATTENTION_KEYS),
  label: z.string().min(1),
  detail: z.string().min(1),
  count: z.number().int().min(1),
  tone: z.enum(CHIP_TONES),
  to: LinkPath,
});
export type AttentionItem = z.infer<typeof AttentionItem>;

export const BuyerDashboard = z.object({
  asOf: Instant,
  currency: CurrencyCode,
  timeZone: TimeZone,
  /** The filters applied (echo of the query after parsing). */
  appliedFilters: z.object({
    from: CalendarDate.nullable(),
    to: CalendarDate.nullable(),
    legalEntityId: Id.nullable(),
    departmentId: Id.nullable(),
    categoryId: Id.nullable(),
    ownerUserId: Id.nullable(),
    stages: z.array(z.enum(TENDERS_STATUS)),
    minValue: NonNegativeDecimalString.nullable(),
    maxValue: NonNegativeDecimalString.nullable(),
  }),
  /** The filter choices the caller may use (authorized entities, departments, owners, categories). */
  filterOptions: z.object({
    legalEntities: z.array(FilterOption),
    departments: z.array(FilterOption),
    categories: z.array(FilterOption),
    owners: z.array(PersonRef),
    stages: z.array(z.enum(TENDERS_STATUS)),
  }),
  kpis: z.array(kpiOf(BUYER_DASHBOARD_KPIS)),
  /** Estimated value of the open pipeline in the tenant currency; `null` when restricted. */
  pipelineValue: Money.nullable(),
  pipelineByStage: panelOf(PipelineStageItem),
  deadlines: panelOf(DashboardDeadline),
  workload: panelOf(WorkloadItem),
  approvals: panelOf(DashboardApproval),
  renewals: panelOf(DashboardRenewal),
  attention: z.array(AttentionItem),
  completeness: z.object({
    complete: z.boolean(),
    note: z.string().nullable(),
  }),
});
export type BuyerDashboard = z.infer<typeof BuyerDashboard>;

export const getBuyerDashboard = defineEndpoint({
  id: 'buyer.dashboard.get',
  method: 'GET',
  path: '/api/v1/buyer/dashboard',
  audience: 'buyer',
  permission: 'dashboard.view',
  query: BuyerDashboardQuery,
  response: BuyerDashboard,
  errors: ['INVALID_DATE_RANGE', 'INVALID_VALUE_RANGE'],
  screens: ['BUY-01'],
  summary:
    'Pipeline, active events, deadlines, workload, approvals, exceptions and renewals of the active buyer, filtered by entity, department, owner, category, value and stage. Panels the caller may not read are restricted (BR-43).',
});

// ---------------------------------------------------------------------------------------------------------
// SUP-01 — supplier dashboard
// ---------------------------------------------------------------------------------------------------------

export const SUPPLIER_DASHBOARD_KPIS = [
  'open_invitations',
  'active_pursuits',
  'submitted_responses',
  'deadlines_within_7_days',
  'expiring_evidence',
  'open_contract_tasks',
] as const;
export type SupplierDashboardKpiKey = (typeof SUPPLIER_DASHBOARD_KPIS)[number];

const BuyerLabel = z.object({ tenantId: Id, name: z.string().min(1), slug: z.string().min(1) });

export const SupplierInvitationItem = z.object({
  tenderId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  buyer: BuyerLabel,
  invitationStatus: z.enum(PARTICIPANTS_INVITATION_STATUS),
  closingAt: z.object({ at: Instant, timeZone: TimeZone }).nullable(),
  to: LinkPath,
});
export type SupplierInvitationItem = z.infer<typeof SupplierInvitationItem>;

export const SupplierPursuitItem = z.object({
  tenderId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  buyer: BuyerLabel,
  decision: z.enum(PURSUITS_DECISION),
  /** Official submission state: only a receipt establishes submission (BR-18, AC-11). */
  submissionState: z.enum(BIDS_SUBMISSION_STATE),
  latestRevisionStatus: z.enum(BID_REVISIONS_STATUS).nullable(),
  /** The supplier's own bid (latest round); `null` without a bid. `to` opens that bid, else the opportunity. */
  bidId: Id.nullable(),
  effectiveReceiptNo: z.string().nullable(),
  closingAt: z.object({ at: Instant, timeZone: TimeZone }).nullable(),
  to: LinkPath,
});
export type SupplierPursuitItem = z.infer<typeof SupplierPursuitItem>;

export const SupplierDeadlineItem = z.object({
  tenderId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  buyerName: z.string().min(1),
  milestone: z.enum(TENDER_MILESTONES_MILESTONE),
  deadline: z.object({ at: Instant, timeZone: TimeZone }),
  to: LinkPath,
});
export type SupplierDeadlineItem = z.infer<typeof SupplierDeadlineItem>;

export const SupplierQualificationItem = z.object({
  programName: z.string().min(1),
  buyerName: z.string().min(1),
  status: z.enum(V_QUALIFICATION_STATUS_EFFECTIVE_STATUS),
  scopeLabel: z.string().nullable(),
  effectiveTo: CalendarDate.nullable(),
  conditions: z.string().nullable(),
  to: LinkPath,
});
export type SupplierQualificationItem = z.infer<typeof SupplierQualificationItem>;

export const SupplierEvidenceItem = z.object({
  evidenceId: Id,
  title: z.string().min(1),
  evidenceType: z.enum(EVIDENCE_ITEMS_EVIDENCE_TYPE),
  expiresAt: CalendarDate,
  daysRemaining: z.number().int(),
  sharedWith: z.array(z.string().min(1)),
  to: LinkPath,
});
export type SupplierEvidenceItem = z.infer<typeof SupplierEvidenceItem>;

export const SupplierOutcomeItem = z.object({
  tenderId: Id,
  reference: z.string().min(1),
  title: z.string().min(1),
  buyerName: z.string().min(1),
  lotLabel: z.string().nullable(),
  /** `null` for an unsuccessful notice (the supplier learns only its own outcome). */
  outcome: z.enum(LOT_OUTCOMES_OUTCOME).nullable(),
  outcomeStatus: z.enum(LOT_OUTCOMES_STATUS).nullable(),
  successful: z.boolean(),
  noticeIssuedAt: Instant,
  standstillEndsAt: z.object({ at: Instant, timeZone: TimeZone }).nullable(),
  to: LinkPath,
});
export type SupplierOutcomeItem = z.infer<typeof SupplierOutcomeItem>;

export const SupplierContractTaskItem = z.object({
  contractId: Id,
  contractReference: z.string().min(1),
  contractTitle: z.string().min(1),
  buyerName: z.string().min(1),
  obligationTitle: z.string().min(1),
  kind: z.enum(OBLIGATIONS_KIND),
  status: z.enum(OBLIGATIONS_STATUS),
  dueOn: CalendarDate,
  to: LinkPath,
});
export type SupplierContractTaskItem = z.infer<typeof SupplierContractTaskItem>;

export const SupplierDashboard = z.object({
  asOf: Instant,
  timeZone: TimeZone,
  kpis: z.array(kpiOf(SUPPLIER_DASHBOARD_KPIS)),
  invitations: panelOf(SupplierInvitationItem),
  pursuits: panelOf(SupplierPursuitItem),
  deadlines: panelOf(SupplierDeadlineItem),
  qualifications: panelOf(SupplierQualificationItem),
  expiringEvidence: panelOf(SupplierEvidenceItem),
  outcomes: panelOf(SupplierOutcomeItem),
  contractTasks: panelOf(SupplierContractTaskItem),
});
export type SupplierDashboard = z.infer<typeof SupplierDashboard>;

export const getSupplierDashboard = defineEndpoint({
  id: 'supplier.dashboard.get',
  method: 'GET',
  path: '/api/v1/supplier/dashboard',
  audience: 'supplier',
  permission: 'supplier.dashboard.view',
  response: SupplierDashboard,
  errors: [],
  screens: ['SUP-01'],
  summary:
    'Invitations, pursuits, submission status, deadlines, qualifications, expiring evidence, outcomes and contract tasks of the active supplier only.',
});

// ---------------------------------------------------------------------------------------------------------
// REP-01 — management reports
// ---------------------------------------------------------------------------------------------------------

/** How a report cell is rendered. */
export const REPORT_CELL_KINDS = [
  'text',
  'count',
  'money',
  'decimal',
  'percent',
  'days',
  'date',
  'status',
  'reference',
  'missing',
  'restricted',
] as const;
export type ReportCellKind = (typeof REPORT_CELL_KINDS)[number];

/** One report cell. `missing` is never shown as zero (PRD §15.2); `restricted` hides a value (BR-43). */
export const ReportCell = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), value: z.string() }),
  z.object({ kind: z.literal('count'), value: z.number().int().min(0) }),
  z.object({ kind: z.literal('money'), value: Money }),
  z.object({ kind: z.literal('decimal'), value: DecimalString }),
  z.object({ kind: z.literal('percent'), value: DecimalString }),
  z.object({ kind: z.literal('days'), value: DecimalString }),
  z.object({ kind: z.literal('date'), value: CalendarDate }),
  z.object({ kind: z.literal('status'), value: EnumRef }),
  z.object({ kind: z.literal('reference'), value: z.string().min(1), to: LinkPath.nullable() }),
  z.object({ kind: z.literal('missing'), reason: z.string().min(1) }),
  z.object({ kind: z.literal('restricted'), reason: z.string().min(1) }),
]);
export type ReportCell = z.infer<typeof ReportCell>;

/** Whether a row counts the whole event, one lot, or one record (PRD §15.2 multi-lot rule). */
export const REPORT_ROW_LEVELS = ['event', 'lot', 'record'] as const;
export const ReportRowLevel = z.enum(REPORT_ROW_LEVELS);
export type ReportRowLevel = (typeof REPORT_ROW_LEVELS)[number];

/** A business field of a report family (REP-02 field picker). */
export const ReportField = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string().min(1),
  kind: z.enum(REPORT_CELL_KINDS),
  description: z.string().min(1),
  /** `restricted` fields are redacted for audiences without the stated permission. */
  sensitivity: z.enum(['normal', 'restricted']),
  redactionRule: z.string().nullable(),
});
export type ReportField = z.infer<typeof ReportField>;

export const ReportColumn = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(REPORT_CELL_KINDS),
  numeric: z.boolean(),
});
export type ReportColumn = z.infer<typeof ReportColumn>;

export const ReportRow = z.object({
  id: z.string().min(1),
  level: ReportRowLevel,
  /** For a lot row, the id of its event row (lot values are never added to the event total). */
  parentId: z.string().nullable(),
  cells: z.record(z.string(), ReportCell),
  /** Drill-through to the supporting record, only when the caller may open it. */
  drillThrough: LinkPath.nullable(),
});
export type ReportRow = z.infer<typeof ReportRow>;

export const ReportCurrencyBasis = z.object({
  currency: CurrencyCode,
  conversionDate: CalendarDate.nullable(),
  note: z.string().min(1),
});
export type ReportCurrencyBasis = z.infer<typeof ReportCurrencyBasis>;

export const ReportCompleteness = z.object({
  complete: z.boolean(),
  recordsIncluded: z.number().int().min(0),
  recordsWithMissingData: z.number().int().min(0),
  notes: z.array(z.string().min(1)),
});
export type ReportCompleteness = z.infer<typeof ReportCompleteness>;

export const ReportMetricDefinition = z.object({
  metric: z.string().min(1),
  definition: z.string().min(1),
});
export type ReportMetricDefinition = z.infer<typeof ReportMetricDefinition>;

export const ReportRedaction = z.object({
  field: z.string().min(1),
  reason: z.string().min(1),
});
export type ReportRedaction = z.infer<typeof ReportRedaction>;

export const ReportHighlight = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  cell: ReportCell,
});
export type ReportHighlight = z.infer<typeof ReportHighlight>;

export const ReportFamilySummary = z.object({
  family: z.enum(REPORT_DEFINITIONS_FAMILY),
  title: z.string().min(1),
  description: z.string().min(1),
  questions: z.string().min(1),
  dimensions: z.array(z.string().min(1)),
  fields: z.array(ReportField),
  /** The caller lacks the permission this family needs; running it returns REPORT_FAMILY_RESTRICTED. */
  restricted: z.boolean(),
  restrictionReason: z.string().nullable(),
  lastRunAt: Instant.nullable(),
  savedDefinitions: z.number().int().min(0),
});
export type ReportFamilySummary = z.infer<typeof ReportFamilySummary>;

export const ReportFamilyCatalog = z.object({
  asOf: Instant,
  currency: CurrencyCode,
  families: z.array(ReportFamilySummary),
});
export type ReportFamilyCatalog = z.infer<typeof ReportFamilyCatalog>;

export const listReportFamilies = defineEndpoint({
  id: 'buyer.reports.families',
  method: 'GET',
  path: '/api/v1/buyer/reports',
  audience: 'buyer',
  permission: ['report.view', 'report.manage'],
  response: ReportFamilyCatalog,
  errors: [],
  screens: ['REP-01', 'REP-02', 'ADM-13'],
  summary: 'The PRD §15.1 report families with their business fields and whether the caller may run each one.',
});

export const ReportFamilyParams = z.object({
  family: z.enum(REPORT_DEFINITIONS_FAMILY),
});

export const REPORT_LEVEL_FILTERS = ['both', 'event', 'lot'] as const;

export const RunReportQuery = DimensionFilters.extend({
  q: z.string().trim().max(200, issue('QUERY_TOO_LONG', 'At most 200 characters.')).optional(),
  level: z.enum(REPORT_LEVEL_FILTERS).default('both'),
  currency: CurrencyCode.optional(),
});
export type RunReportQuery = z.input<typeof RunReportQuery>;

export const ReportResult = z.object({
  family: z.enum(REPORT_DEFINITIONS_FAMILY),
  title: z.string().min(1),
  description: z.string().min(1),
  asOf: Instant,
  period: z.object({ from: CalendarDate.nullable(), to: CalendarDate.nullable() }),
  levelBasis: z.object({
    level: z.enum(REPORT_LEVEL_FILTERS),
    note: z.string().min(1),
  }),
  currencyBasis: ReportCurrencyBasis,
  countingBasis: z.array(ReportMetricDefinition),
  completeness: ReportCompleteness,
  highlights: z.array(ReportHighlight),
  columns: z.array(ReportColumn),
  rows: z.array(ReportRow),
  /** Totals over event-level rows only (whole-event values are never added to their lots). */
  totals: z.record(z.string(), ReportCell).nullable(),
  chart: z
    .object({
      title: z.string().min(1),
      items: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), value: z.number().min(0), display: z.string().min(1) })),
    })
    .nullable(),
  redactions: z.array(ReportRedaction),
});
export type ReportResult = z.infer<typeof ReportResult>;

export const runReport = defineEndpoint({
  id: 'buyer.reports.run',
  method: 'GET',
  path: '/api/v1/buyer/reports/:family',
  audience: 'buyer',
  permission: ['report.view', 'report.manage'],
  params: ReportFamilyParams,
  query: RunReportQuery,
  response: ReportResult,
  errors: ['REPORT_FAMILY_RESTRICTED', 'CURRENCY_BASIS_UNAVAILABLE', 'INVALID_DATE_RANGE'],
  screens: ['REP-01'],
  summary:
    'Runs one report family over the records the caller may read, with the §15.2 safeguards: unique organizations, event vs lot level, currency basis and completeness (AC-34).',
});

// ---------------------------------------------------------------------------------------------------------
// REP-02 / ADM-13 — report definitions, preview and scheduled delivery
// ---------------------------------------------------------------------------------------------------------

/** Permissions a report audience may be limited to (`report_definitions.audience_permission`). */
export const REPORT_AUDIENCE_PERMISSIONS = [
  'report.view',
  'report.manage',
  'audit.view',
  'contract.view',
  'contract.financials.view',
] as const;
export const ReportAudiencePermission = z.enum(REPORT_AUDIENCE_PERMISSIONS);
export type ReportAudiencePermission = (typeof REPORT_AUDIENCE_PERMISSIONS)[number];

/** `report_definitions.filters` (jsonb): the saved report filter configuration. */
export const ReportFilters = z.object({
  from: CalendarDate.nullable(),
  to: CalendarDate.nullable(),
  legalEntityIds: z.array(Id),
  departmentIds: z.array(Id),
  categoryIds: z.array(Id),
  ownerUserIds: z.array(Id),
  stages: z.array(z.enum(TENDERS_STATUS)),
  eventTypes: z.array(z.enum(TENDERS_EVENT_TYPE)),
  level: z.enum(REPORT_LEVEL_FILTERS),
});
export type ReportFilters = z.infer<typeof ReportFilters>;

/** A five-field cron expression in the tenant's official time zone. */
export const ScheduleCron = z
  .string()
  .trim()
  .regex(
    /^(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*A-Za-z]+)$/,
    issue('INVALID_SCHEDULE', 'Use a five-field schedule such as "0 6 * * 1".'),
  );

export const ReportRecipient = z.object({
  user: PersonRef,
  /** Holds the audience permission today; re-checked when each run is issued (DD-19). */
  authorized: z.boolean(),
  reason: z.string().nullable(),
});
export type ReportRecipient = z.infer<typeof ReportRecipient>;

export const ExportSummary = z.object({
  id: Id,
  format: z.enum(EXPORTS_FORMAT),
  status: z.enum(EXPORTS_STATUS),
  fileName: z.string().nullable(),
});
export type ExportSummary = z.infer<typeof ExportSummary>;

export const ReportRun = z.object({
  id: Id,
  definitionId: Id,
  /** `null` when the schedule ran it. */
  runBy: PersonRef.nullable(),
  runAt: Instant,
  rowCount: z.number().int().min(0),
  export: ExportSummary.nullable(),
  recipients: z.array(PersonRef),
  /** Recipients excluded at issue time because they were no longer authorized (DD-19). */
  excludedRecipients: z.array(z.object({ user: PersonRef, reason: z.string().min(1) })),
});
export type ReportRun = z.infer<typeof ReportRun>;

export const ReportSchedule = z.object({
  cron: z.string().min(1),
  description: z.string().min(1),
  timeZone: TimeZone,
  nextRunAt: Instant.nullable(),
});
export type ReportSchedule = z.infer<typeof ReportSchedule>;

export const ReportDefinitionRow = z.object({
  id: Id,
  name: z.string().min(1),
  family: z.enum(REPORT_DEFINITIONS_FAMILY),
  owner: PersonRef,
  audiencePermission: ReportAudiencePermission,
  currencyBasis: CurrencyCode,
  schedule: ReportSchedule.nullable(),
  active: z.boolean(),
  recipientCount: z.number().int().min(0),
  lastRunAt: Instant.nullable(),
  updatedAt: Instant,
});
export type ReportDefinitionRow = z.infer<typeof ReportDefinitionRow>;

export const ReportDefinition = ReportDefinitionRow.extend({
  fields: z.array(z.string().min(1)).min(1),
  filters: ReportFilters,
  conversionDate: CalendarDate.nullable(),
  recipients: z.array(ReportRecipient),
  runs: z.array(ReportRun),
  createdAt: Instant,
});
export type ReportDefinition = z.infer<typeof ReportDefinition>;

export const REPORT_DEFINITION_SORT_FIELDS = ['name', 'family', 'updatedAt', 'lastRunAt'] as const;

export const ReportDefinitionListQuery = listQueryWithSort(REPORT_DEFINITION_SORT_FIELDS).extend({
  family: queryList(z.enum(REPORT_DEFINITIONS_FAMILY)).optional(),
  active: QueryBoolean.optional(),
  scheduled: QueryBoolean.optional(),
  ownerUserId: IdParam.optional(),
  updatedFrom: CalendarDate.optional(),
  updatedTo: CalendarDate.optional(),
});
export type ReportDefinitionListQuery = z.input<typeof ReportDefinitionListQuery>;

export const listReportDefinitions = defineEndpoint({
  id: 'buyer.reportDefinitions.list',
  method: 'GET',
  path: '/api/v1/buyer/report-definitions',
  audience: 'buyer',
  permission: ['report.view', 'report.manage'],
  query: ReportDefinitionListQuery,
  response: pageOf(ReportDefinitionRow),
  errors: [],
  screens: ['ADM-13', 'REP-02', 'REP-01'],
  summary:
    'Saved report definitions. A report.view holder sees the definitions whose audience permission they hold; report.manage sees all.',
});

export const ReportDefinitionParams = z.object({ definitionId: IdParam });

export const getReportDefinition = defineEndpoint({
  id: 'buyer.reportDefinitions.get',
  method: 'GET',
  path: '/api/v1/buyer/report-definitions/:definitionId',
  audience: 'buyer',
  permission: ['report.view', 'report.manage'],
  params: ReportDefinitionParams,
  response: ReportDefinition,
  errors: [],
  screens: ['ADM-13', 'REP-02'],
});

export const ReportDefinitionBody = z.object({
  name: z
    .string()
    .trim()
    .min(3, issue('NAME_TOO_SHORT', 'At least 3 characters.'))
    .max(120, issue('NAME_TOO_LONG', 'At most 120 characters.')),
  family: z.enum(REPORT_DEFINITIONS_FAMILY),
  fields: z.array(z.string().min(1)).min(1, issue('FIELDS_REQUIRED', 'Select at least one field.')),
  filters: ReportFilters,
  currencyBasis: CurrencyCode,
  conversionDate: CalendarDate.nullable(),
  audiencePermission: ReportAudiencePermission,
  scheduleCron: ScheduleCron.nullable(),
  recipientUserIds: z.array(Id),
});
export type ReportDefinitionBody = z.infer<typeof ReportDefinitionBody>;

const REPORT_DEFINITION_ERRORS = [
  'DUPLICATE_REPORT_NAME',
  'FIELD_NOT_IN_FAMILY',
  'RECIPIENT_NOT_AUTHORIZED',
  'SCHEDULE_REQUIRES_RECIPIENTS',
  'CURRENCY_BASIS_UNAVAILABLE',
] as const;

export const createReportDefinition = defineEndpoint({
  id: 'buyer.reportDefinitions.create',
  method: 'POST',
  path: '/api/v1/buyer/report-definitions',
  audience: 'buyer',
  permission: 'report.manage',
  body: ReportDefinitionBody,
  response: ReportDefinition,
  status: 201,
  idempotent: true,
  errors: REPORT_DEFINITION_ERRORS,
  screens: ['REP-02', 'ADM-13'],
});

export const updateReportDefinition = defineEndpoint({
  id: 'buyer.reportDefinitions.update',
  method: 'PUT',
  path: '/api/v1/buyer/report-definitions/:definitionId',
  audience: 'buyer',
  permission: 'report.manage',
  params: ReportDefinitionParams,
  body: ReportDefinitionBody,
  response: ReportDefinition,
  errors: [...REPORT_DEFINITION_ERRORS, 'DEFINITION_INACTIVE'],
  screens: ['REP-02', 'ADM-13'],
});

export const ReportPreview = z.object({
  family: z.enum(REPORT_DEFINITIONS_FAMILY),
  scopeDescription: z.string().min(1),
  /** Rows the definition returns for the author today; each recipient only ever receives what they may read. */
  estimatedRowCount: z.number().int().min(0),
  fields: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      included: z.boolean(),
      redacted: z.boolean(),
      reason: z.string().nullable(),
    }),
  ),
  columns: z.array(ReportColumn),
  sampleRows: z.array(ReportRow),
  redactions: z.array(ReportRedaction),
  omissions: z.array(z.string().min(1)),
  recipients: z.array(ReportRecipient),
  currencyBasis: ReportCurrencyBasis,
  completeness: ReportCompleteness,
  schedule: ReportSchedule.nullable(),
});
export type ReportPreview = z.infer<typeof ReportPreview>;

export const previewReportDefinition = defineEndpoint({
  id: 'buyer.reportDefinitions.preview',
  method: 'POST',
  path: '/api/v1/buyer/report-definitions/preview',
  audience: 'buyer',
  permission: 'report.manage',
  body: ReportDefinitionBody,
  response: ReportPreview,
  errors: ['FIELD_NOT_IN_FAMILY', 'CURRENCY_BASIS_UNAVAILABLE', 'SCHEDULE_REQUIRES_RECIPIENTS'],
  screens: ['REP-02', 'ADM-13'],
  summary: 'Previews the scope, redactions, omissions and recipient authorization of a definition before it is shared.',
});

export const SetReportDefinitionActiveBody = z.object({
  active: z.boolean(),
  reason: ReasonText,
});

export const setReportDefinitionActive = defineEndpoint({
  id: 'buyer.reportDefinitions.setActive',
  method: 'POST',
  path: '/api/v1/buyer/report-definitions/:definitionId/activation',
  audience: 'buyer',
  permission: 'report.manage',
  params: ReportDefinitionParams,
  body: SetReportDefinitionActiveBody,
  response: ReportDefinition,
  errors: ['DEFINITION_ALREADY_IN_STATE'],
  screens: ['ADM-13'],
});

export const RunReportDefinitionBody = z.object({
  format: z.enum(EXPORTS_FORMAT),
  /** Deliver to the definition's recipients now (each re-checked for authorization). */
  deliverToRecipients: z.boolean(),
});

export const runReportDefinition = defineEndpoint({
  id: 'buyer.reportDefinitions.run',
  method: 'POST',
  path: '/api/v1/buyer/report-definitions/:definitionId/runs',
  audience: 'buyer',
  permission: 'report.manage',
  params: ReportDefinitionParams,
  body: RunReportDefinitionBody,
  response: ReportRun,
  status: 201,
  idempotent: true,
  errors: ['DEFINITION_INACTIVE', 'SCHEDULE_REQUIRES_RECIPIENTS'],
  screens: ['ADM-13', 'REP-02'],
  summary: 'Runs a definition now and produces a controlled export with a manifest.',
});

export const RecipientCandidateQuery = ListQuery.extend({
  audiencePermission: ReportAudiencePermission,
});

export const RecipientCandidate = z.object({
  user: PersonRef,
  capacity: z.string().nullable(),
  authorized: z.boolean(),
  reason: z.string().nullable(),
});
export type RecipientCandidate = z.infer<typeof RecipientCandidate>;

export const listRecipientCandidates = defineEndpoint({
  id: 'buyer.reportDefinitions.recipients',
  method: 'GET',
  path: '/api/v1/buyer/report-recipients',
  audience: 'buyer',
  permission: 'report.manage',
  query: RecipientCandidateQuery,
  response: pageOf(RecipientCandidate),
  errors: [],
  screens: ['REP-02', 'ADM-13'],
  summary: 'Members of the active buyer and whether each holds the chosen audience permission.',
});

// ---------------------------------------------------------------------------------------------------------
// ADM-13 / REP-01 — controlled exports with a manifest
// ---------------------------------------------------------------------------------------------------------

/** `exports.manifest` (jsonb): what an export contains, which versions, and what was left out or redacted. */
export const ExportManifest = z.object({
  contents: z.array(z.object({ label: z.string().min(1), description: z.string().min(1), recordCount: z.number().int().min(0).nullable() })),
  versions: z.array(z.object({ label: z.string().min(1), reference: z.string().nullable(), version: z.string().min(1) })),
  omissions: z.array(z.object({ label: z.string().min(1), reason: z.string().min(1) })),
  redactions: z.array(ReportRedaction),
});
export type ExportManifest = z.infer<typeof ExportManifest>;

export const ExportRecord = z.object({
  id: Id,
  exportType: z.enum(EXPORTS_EXPORT_TYPE),
  format: z.enum(EXPORTS_FORMAT),
  status: z.enum(EXPORTS_STATUS),
  scopeDescription: z.string().min(1),
  subjectType: z.string().nullable(),
  subjectId: Id.nullable(),
  subjectLabel: z.string().nullable(),
  reportFamily: z.enum(REPORT_DEFINITIONS_FAMILY).nullable(),
  definitionId: Id.nullable(),
  requestedBy: PersonRef,
  requestedAt: Instant,
  completedAt: Instant.nullable(),
  error: z.string().nullable(),
  documentId: Id.nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
  manifest: ExportManifest.nullable(),
});
export type ExportRecord = z.infer<typeof ExportRecord>;

export const EXPORT_SORT_FIELDS = ['requestedAt', 'status', 'exportType'] as const;

export const ExportListQuery = listQueryWithSort(EXPORT_SORT_FIELDS).extend({
  exportType: queryList(z.enum(EXPORTS_EXPORT_TYPE)).optional(),
  status: queryList(z.enum(EXPORTS_STATUS)).optional(),
  format: queryList(z.enum(EXPORTS_FORMAT)).optional(),
  requestedBy: IdParam.optional(),
  from: CalendarDate.optional(),
  to: CalendarDate.optional(),
});
export type ExportListQuery = z.input<typeof ExportListQuery>;

export const listExports = defineEndpoint({
  id: 'buyer.exports.list',
  method: 'GET',
  path: '/api/v1/buyer/exports',
  audience: 'buyer',
  permission: ['export.create', 'report.manage', 'audit.view'],
  query: ExportListQuery,
  response: pageOf(ExportRecord),
  errors: [],
  screens: ['ADM-13', 'REP-01', 'ADM-14'],
  summary: 'Export history. Callers without report.manage or audit.view see only their own exports.',
});

export const ExportParams = z.object({ exportId: IdParam });

export const getExport = defineEndpoint({
  id: 'buyer.exports.get',
  method: 'GET',
  path: '/api/v1/buyer/exports/:exportId',
  audience: 'buyer',
  permission: ['export.create', 'report.manage', 'audit.view'],
  params: ExportParams,
  response: ExportRecord,
  errors: [],
  screens: ['ADM-13', 'ADM-14'],
});

export const CreateReportExportBody = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('family'),
      family: z.enum(REPORT_DEFINITIONS_FAMILY),
      filters: ReportFilters,
      currency: CurrencyCode,
    }),
    z.object({ kind: z.literal('definition'), definitionId: Id }),
  ]),
  format: z.enum(EXPORTS_FORMAT),
  purpose: ReasonText,
});
export type CreateReportExportBody = z.infer<typeof CreateReportExportBody>;

export const createReportExport = defineEndpoint({
  id: 'buyer.exports.create',
  method: 'POST',
  path: '/api/v1/buyer/exports',
  audience: 'buyer',
  permission: 'export.create',
  body: CreateReportExportBody,
  response: ExportRecord,
  status: 201,
  idempotent: true,
  errors: ['REPORT_FAMILY_RESTRICTED', 'DEFINITION_INACTIVE', 'CURRENCY_BASIS_UNAVAILABLE'],
  screens: ['REP-01', 'ADM-13'],
  summary: 'Requests a controlled report export (xlsx, csv or print-styled html) with a manifest (DD-16).',
});

export const ExportDownload = z.object({
  exportId: Id,
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  delivery: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('signed_url'), url: z.string().min(1), expiresAt: Instant }),
    /** Text formats (csv, html) may be delivered inline. */
    z.object({ kind: z.literal('inline'), content: z.string() }),
  ]),
});
export type ExportDownload = z.infer<typeof ExportDownload>;

export const downloadExport = defineEndpoint({
  id: 'buyer.exports.download',
  method: 'GET',
  path: '/api/v1/buyer/exports/:exportId/download',
  audience: 'buyer',
  permission: ['export.create', 'report.manage', 'audit.view'],
  params: ExportParams,
  response: ExportDownload,
  errors: ['EXPORT_NOT_READY', 'EXPORT_FAILED'],
  screens: ['ADM-13', 'REP-01', 'ADM-14'],
  summary: 'Delivers a ready export; the download is audited.',
});

// ---------------------------------------------------------------------------------------------------------
// COM-08 — global search and saved views
// ---------------------------------------------------------------------------------------------------------

export const SEARCH_RESULT_TYPES = [
  'tender',
  'request',
  'supplier',
  'task',
  'contract',
  'document',
  'organization',
] as const;
export const SearchResultType = z.enum(SEARCH_RESULT_TYPES);
export type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number];

export const SearchQuery = listQueryWithSort(['relevance', 'updatedAt', 'title'] as const).extend({
  q: z
    .string()
    .trim()
    .min(2, issue('SEARCH_QUERY_TOO_SHORT', 'Type at least 2 characters.'))
    .max(200, issue('QUERY_TOO_LONG', 'At most 200 characters.')),
  type: queryList(SearchResultType).optional(),
  tenantId: IdParam.optional(),
  updatedFrom: CalendarDate.optional(),
  updatedTo: CalendarDate.optional(),
});
export type SearchQuery = z.input<typeof SearchQuery>;

export const SearchResult = z.object({
  /** `<type>:<tenantId>:<recordId>`, unique across organizations. */
  key: z.string().min(1),
  type: SearchResultType,
  recordId: Id,
  title: z.string().min(1),
  reference: z.string().nullable(),
  subtitle: z.string().nullable(),
  status: EnumRef.nullable(),
  organization: OrganizationLabel,
  /** Opening the result switches to its organization first when it is not the active one (DD-21). */
  to: LinkPath,
  updatedAt: Instant,
  matchedOn: z.string().min(1),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const SearchResponse = pageOf(SearchResult).extend({
  query: z.string(),
  /** Counts of AUTHORIZED results only, per type and per organization (BR-43). */
  counts: z.array(z.object({ type: SearchResultType, count: z.number().int().min(0) })),
  organizations: z.array(z.object({ organization: OrganizationLabel, count: z.number().int().min(0) })),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

export const search = defineEndpoint({
  id: 'me.search.query',
  method: 'GET',
  path: '/api/v1/me/search',
  audience: 'me',
  query: SearchQuery,
  response: SearchResponse,
  errors: [],
  screens: ['COM-08'],
  summary:
    'Searches authorized tenders, requests, suppliers, tasks, contracts and documents across every active membership; results and counts never reveal restricted records (BR-43, DD-21).',
});

/** A screen id such as `COM-08` or `BUY-07` (`saved_views.scope`). */
export const SavedViewScope = z
  .string()
  .regex(SCREEN_ID_PATTERN, issue('INVALID_SCOPE', 'Use a screen id such as COM-08.'));

export const SavedView = z.object({
  id: Id,
  scope: SavedViewScope,
  name: z.string().min(1),
  filters: JsonObject,
  isDefault: z.boolean(),
  organization: OrganizationLabel,
  createdAt: Instant,
  updatedAt: Instant,
});
export type SavedView = z.infer<typeof SavedView>;

export const SavedViewListQuery = ListQuery.extend({
  scope: SavedViewScope.optional(),
  tenantId: IdParam.optional(),
});
export type SavedViewListQuery = z.input<typeof SavedViewListQuery>;

export const listSavedViews = defineEndpoint({
  id: 'me.savedViews.list',
  method: 'GET',
  path: '/api/v1/me/saved-views',
  audience: 'me',
  query: SavedViewListQuery,
  response: pageOf(SavedView),
  errors: [],
  screens: ['COM-08'],
  summary: 'The caller’s own saved views across active memberships, each labelled with its organization.',
});

export const SavedViewBody = z.object({
  scope: SavedViewScope,
  name: z
    .string()
    .trim()
    .min(2, issue('NAME_TOO_SHORT', 'At least 2 characters.'))
    .max(80, issue('NAME_TOO_LONG', 'At most 80 characters.')),
  filters: JsonObject,
  isDefault: z.boolean(),
});
export type SavedViewBody = z.infer<typeof SavedViewBody>;

export const createSavedView = defineEndpoint({
  id: 'me.savedViews.create',
  method: 'POST',
  path: '/api/v1/me/saved-views',
  audience: 'me',
  rowTenant: true,
  body: SavedViewBody,
  response: SavedView,
  status: 201,
  idempotent: true,
  errors: ['DUPLICATE_VIEW_NAME', 'SAVED_VIEW_LIMIT_REACHED'],
  screens: ['COM-08'],
  summary: 'Saves a view in the organization named by X-Tenant-Id (the active organization).',
});

export const SavedViewParams = z.object({ viewId: IdParam });

export const updateSavedView = defineEndpoint({
  id: 'me.savedViews.update',
  method: 'PUT',
  path: '/api/v1/me/saved-views/:viewId',
  audience: 'me',
  rowTenant: true,
  params: SavedViewParams,
  body: SavedViewBody,
  response: SavedView,
  errors: ['DUPLICATE_VIEW_NAME'],
  screens: ['COM-08'],
});

export const deleteSavedView = defineEndpoint({
  id: 'me.savedViews.delete',
  method: 'DELETE',
  path: '/api/v1/me/saved-views/:viewId',
  audience: 'me',
  rowTenant: true,
  params: SavedViewParams,
  response: z.null(),
  status: 204,
  errors: [],
  screens: ['COM-08'],
});

// ---------------------------------------------------------------------------------------------------------
// Endpoint map
// ---------------------------------------------------------------------------------------------------------

/** The reporting endpoint map. */
export const reportingEndpoints = {
  getBuyerDashboard,
  getSupplierDashboard,
  listReportFamilies,
  runReport,
  listReportDefinitions,
  getReportDefinition,
  createReportDefinition,
  updateReportDefinition,
  previewReportDefinition,
  setReportDefinitionActive,
  runReportDefinition,
  listRecipientCandidates,
  listExports,
  getExport,
  createReportExport,
  downloadExport,
  search,
  listSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
} as const;
