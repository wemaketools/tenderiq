/**
 * Management report fixtures (REP-01, PRD §15): the ten report families with their business fields, the
 * permission each family needs, the §15.2 counting definitions, and the report rows per buyer.
 *
 * AC-34: the participation family counts UNIQUE organizations, derived from the bids and publication domains:
 * T-2026-0001 (three lots), T-2026-0002 (several revisions per supplier) and T-2026-0009 (restricted, two stages:
 * five receipts from three organizations). Event rows and lot rows are labelled; totals and highlights use event
 * rows only, so whole-event values are never added to their lots, and per-event unique counts are totalled as
 * DISTINCT organizations across events, never summed. Amounts are BWP (no conversion was needed); a missing value
 * is a `missing` cell with a reason, never zero.
 */
import type { CalendarDate, LinkPath, Money } from '../../../contracts/common.js';
import type { EnumName, ReportDefinitionsFamily } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { ReportCell, ReportCellKind, ReportRowLevel } from '../../../contracts/reporting.js';
import { BIDS, SUBMISSION_RECEIPTS } from '../bids/responses.js';
import { PERSONAS, TENANT_IDS } from '../platform.js';
import { PARTICIPANTS } from '../publication/participants.js';
import { CATEGORIES, DEPARTMENTS, KWU, LEGACY_TENDER_ID, LINKS, ODC, TENDER_FACTS, bwp, dimensionLabel, lotLabel } from './storyline.js';

// ---------------------------------------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------------------------------------

export const cell = {
  text: (value: string): ReportCell => ({ kind: 'text', value }),
  count: (value: number): ReportCell => ({ kind: 'count', value }),
  money: (amount: string): ReportCell => ({ kind: 'money', value: bwp(amount) }),
  moneyOf: (value: Money): ReportCell => ({ kind: 'money', value }),
  decimal: (value: string): ReportCell => ({ kind: 'decimal', value }),
  percent: (value: string): ReportCell => ({ kind: 'percent', value }),
  days: (value: string): ReportCell => ({ kind: 'days', value }),
  date: (value: CalendarDate): ReportCell => ({ kind: 'date', value }),
  status: (name: EnumName, value: string): ReportCell => ({ kind: 'status', value: { enum: name, value } }),
  ref: (value: string, to: LinkPath | null): ReportCell => ({ kind: 'reference', value, to }),
  missing: (reason: string): ReportCell => ({ kind: 'missing', reason }),
} as const;

// ---------------------------------------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------------------------------------

export interface FixtureReportField {
  readonly key: string;
  readonly label: string;
  readonly kind: ReportCellKind;
  readonly description: string;
  /** Viewers without any of these permissions get a `restricted` cell and a redaction entry (BR-43). */
  readonly restrictedTo: readonly PermissionCode[] | null;
  /**
   * How the totals row aggregates the field over event rows: `sum` (additive counts and amounts), `distinct`
   * (per-event unique organizations: the total is the number of DISTINCT organizations across the events, from
   * `FixtureReportRow.distinctOrgs`, AC-34) or `none` (not aggregated).
   */
  readonly total: 'sum' | 'distinct' | 'none';
}

export interface FixtureReportFamily {
  readonly family: ReportDefinitionsFamily;
  readonly title: string;
  readonly description: string;
  readonly questions: string;
  readonly dimensions: readonly string[];
  /** Running the family needs one of these (in addition to report.view or report.manage). */
  readonly runWith: readonly PermissionCode[];
  readonly restrictionReason: string;
  readonly fields: readonly FixtureReportField[];
  readonly countingBasis: ReadonlyArray<{ readonly metric: string; readonly definition: string }>;
  readonly levelNote: string;
  /** Field whose values feed the chart (event rows), with the label field. */
  readonly chart: { readonly title: string; readonly valueField: string; readonly labelField: string } | null;
  readonly lastRunAt: string | null;
}

function field(
  key: string,
  label: string,
  kind: ReportCellKind,
  description: string,
  restrictedTo: readonly PermissionCode[] | null = null,
): FixtureReportField {
  return { key, label, kind, description, restrictedTo, total: kind === 'count' || kind === 'money' ? 'sum' : 'none' };
}

/** A per-event count of unique organizations: not additive across events (AC-34, PRD §15.2). */
function distinctField(key: string, label: string, description: string): FixtureReportField {
  return {
    ...field(key, label, 'count', `${description} Not additive: the total counts distinct organizations across events.`),
    total: 'distinct',
  };
}

const REFERENCE = field('reference', 'Reference', 'reference', 'Event or contract reference.');
const TITLE = field('title', 'Title', 'text', 'Business title of the record.');
const SCOPE = field('scope', 'Level', 'text', 'Whole event or the named lot (PRD §15.2).');

export const REPORT_FAMILIES: readonly FixtureReportFamily[] = [
  {
    family: 'pipeline',
    title: 'Procurement pipeline',
    description: 'Planned, approved, active, delayed and awaiting-decision events with their estimated value.',
    questions: 'What is planned, approved, active, delayed, or awaiting a decision?',
    dimensions: ['Entity', 'Department', 'Category', 'Owner', 'Stage', 'Dates', 'Estimated value'],
    runWith: ['tender.view', 'request.view_all'],
    restrictionReason: 'Requires access to tenders or to all requests.',
    fields: [
      REFERENCE,
      TITLE,
      field('stage', 'Stage', 'status', 'Current lifecycle stage.'),
      field('department', 'Department', 'text', 'Owning department.'),
      field('category', 'Category', 'text', 'Procurement category.'),
      field('owner', 'Owner', 'text', 'Accountable tender owner (BR-01).'),
      field('estimatedValue', 'Estimated value', 'money', 'Approved estimate; internal budget detail stays buyer-internal.'),
      field('daysInStage', 'Days in stage', 'days', 'Calendar days in the current stage.'),
      field('nextMilestone', 'Next milestone', 'text', 'Next dated milestone or decision.'),
    ],
    countingBasis: [
      { metric: 'Events', definition: 'One row per procurement event; lots are not counted as separate events.' },
      { metric: 'Estimated value', definition: 'Event-level estimate in BWP. Events without an estimate (RFIs) are shown as missing, not zero.' },
    ],
    levelNote: 'Event-level rows only: lot values are part of their event and are not added again.',
    chart: { title: 'Events by stage', valueField: 'estimatedValue', labelField: 'reference' },
    lastRunAt: '2026-10-05T06:00:00Z',
  },
  {
    family: 'cycle_time',
    title: 'Cycle time and workload',
    description: 'Where work waits: request-to-release, release-to-close, evaluation, approval, award and handover.',
    questions: 'Where does work wait and who needs support?',
    dimensions: ['Request-to-release', 'Release-to-close', 'Evaluation', 'Approval', 'Award', 'Handover'],
    runWith: ['tender.view'],
    restrictionReason: 'Requires access to tenders.',
    fields: [
      REFERENCE,
      TITLE,
      field('requestToRelease', 'Request to release', 'days', 'Calendar days from request approval to release.'),
      field('releaseToClose', 'Release to close', 'days', 'Calendar days from release to the submission deadline.'),
      field('evaluationDays', 'Evaluation', 'days', 'Calendar days from opening to evaluation sign-off.'),
      field('approvalDays', 'Approval', 'days', 'Calendar days awaiting award approval.'),
      field('calendarElapsed', 'Calendar elapsed', 'days', 'Total calendar days so far.'),
      field('holdAdjusted', 'Hold-adjusted', 'days', 'Elapsed days minus approved holds; shown next to calendar time, never instead of it.'),
    ],
    countingBasis: [
      { metric: 'Calendar elapsed', definition: 'Every calendar day counts; delays never disappear because a clock was paused.' },
      { metric: 'Hold-adjusted', definition: 'Calendar elapsed minus days under an approved procurement or complaint hold.' },
    ],
    levelNote: 'Event-level durations. Lot-specific timelines appear as lot rows.',
    chart: { title: 'Calendar days elapsed', valueField: 'calendarElapsed', labelField: 'reference' },
    lastRunAt: '2026-10-01T06:00:00Z',
  },
  {
    family: 'participation',
    title: 'Competition and participation',
    description: 'Invited organizations, registered interest, unique bidders, submitted revisions and compliant bids.',
    questions: 'How many relevant suppliers were invited, participated, declined, or submitted compliant offers?',
    dimensions: ['Procedure', 'Category', 'Tender', 'Lot', 'No-bid reason'],
    runWith: ['tender.view'],
    restrictionReason: 'Requires access to tenders.',
    fields: [
      REFERENCE,
      SCOPE,
      distinctField('invited', 'Invited organizations', 'Organizations formally invited.'),
      distinctField('registeredInterest', 'Registered interest', 'Organizations that registered interest or requested access.'),
      distinctField('uniqueBidders', 'Unique bidding organizations', 'Distinct organizations with an effective submission; withdrawn and unsubmitted bids do not compete.'),
      field('submittedRevisions', 'Submitted revisions', 'count', 'Official receipts, including superseded revisions.'),
      field('compliantBids', 'Compliant bids', 'count', 'Bids passing the compliance review; missing before opening.'),
      distinctField('noBid', 'Shared no-bid', 'Organizations that shared a no-bid decision with the buyer.'),
    ],
    countingBasis: [
      { metric: 'Unique bidding organizations', definition: 'Each organization counts once per event or lot, however many revisions it submitted (AC-34).' },
      { metric: 'Submitted revisions', definition: 'Official receipts; multiple revisions do not count as additional competing suppliers.' },
      { metric: 'Event vs lot', definition: 'Event rows count organizations once across all lots; lot rows count them per lot and are never summed into the event.' },
      { metric: 'Totals', definition: 'Organization counts are not added across events: the totals row shows the number of distinct organizations. Submitted revisions and compliant bids are additive.' },
    ],
    levelNote: 'Event rows and lot rows are shown separately. Totals use event rows only.',
    chart: { title: 'Unique bidding organizations per event', valueField: 'uniqueBidders', labelField: 'reference' },
    lastRunAt: '2026-10-04T14:20:00Z',
  },
  {
    family: 'qualification_risk',
    title: 'Qualification and risk',
    description: 'Suppliers, documents and conditions needing review, with active-contract exposure.',
    questions: 'Which suppliers, documents, or conditions need review?',
    dimensions: ['Program', 'Scope', 'Risk', 'Validity', 'Assessor', 'Condition', 'Active-contract exposure'],
    runWith: ['supplier.directory.view'],
    restrictionReason: 'Requires access to the supplier directory.',
    fields: [
      field('supplier', 'Supplier', 'text', 'Supplier legal name.'),
      field('program', 'Program', 'text', 'Qualification program.'),
      field('status', 'Status', 'status', 'Effective qualification status (buyer-specific, BR-24).'),
      field('validTo', 'Valid to', 'date', 'End of the decision’s validity.'),
      field('condition', 'Condition or review reason', 'text', 'Conditions, expiring evidence or open information requests.'),
      field('activeExposure', 'Active-contract exposure', 'money', 'Value of live contracts with the supplier.', ['contract.view']),
    ],
    countingBasis: [{ metric: 'Status', definition: 'The latest non-superseded decision per supplier and program; expired when its validity has passed.' }],
    levelNote: 'One row per supplier and program.',
    chart: null,
    lastRunAt: '2026-09-30T06:00:00Z',
  },
  {
    family: 'evaluation_integrity',
    title: 'Evaluation integrity',
    description: 'Assignment completeness, missing scores, score variance, moderation, conflicts and overrides.',
    questions: 'Are assessments complete and do differences have explanations?',
    dimensions: ['Assignment', 'Missing evidence', 'Score variance', 'Moderation', 'Conflicts', 'Overrides'],
    runWith: ['evaluation.chair', 'audit.view'],
    restrictionReason: 'Requires the evaluation chair or audit access: individual assessments are restricted (PRD §4.3).',
    fields: [
      REFERENCE,
      SCOPE,
      field('assignments', 'Assignments', 'count', 'Evaluator assignments.'),
      field('missingScores', 'Criteria not scored', 'count', 'Criteria without a submitted score (never counted as zero, AC-18).'),
      field('maxVariance', 'Largest score spread', 'decimal', 'Largest difference between evaluators on one criterion.'),
      field('moderatedChanges', 'Moderated changes', 'count', 'Scores changed in moderation (originals preserved, AC-20).'),
      field('conflictsDeclared', 'Conflicts declared', 'count', 'Conflict declarations routed for review.'),
      field('overrides', 'Overrides', 'count', 'Recorded corrections after submission.'),
    ],
    countingBasis: [{ metric: 'Criteria not scored', definition: 'A missing score keeps the assessment incomplete and is never treated as zero.' }],
    levelNote: 'Event rows, and lot rows for multi-lot events.',
    chart: null,
    lastRunAt: '2026-10-02T09:00:00Z',
  },
  {
    family: 'awards',
    title: 'Awards and commitments',
    description: 'What was awarded, to whom, per lot, against which approved budget.',
    questions: 'What was awarded, to whom, and against which approved budget?',
    dimensions: ['Supplier', 'Legal entity', 'Category', 'Lot', 'Funding', 'Value', 'Currency', 'Date'],
    runWith: ['tender.view', 'contract.view'],
    restrictionReason: 'Requires access to tenders or contracts.',
    fields: [
      REFERENCE,
      SCOPE,
      field('supplier', 'Supplier', 'text', 'Awarded supplier legal party.'),
      field('outcome', 'Outcome', 'status', 'Lot outcome status.'),
      field('recommendedValue', 'Recommended or intended value', 'money', 'Value of the recommendation or intent notice. A recommendation or intent is not an award (BR-31).'),
      field('awardValue', 'Final award value', 'money', 'Value of the final award decision only; missing while only recommended or intended.'),
      field('approvedBudget', 'Approved budget', 'money', 'Approved funding for the event (buyer-internal).', ['request.view_all', 'report.manage', 'contract.financials.view']),
      field('awardDate', 'Final award date', 'date', 'Date of the final award decision; an intent notice date is never shown here.'),
    ],
    countingBasis: [
      { metric: 'Final award value', definition: 'Final award decisions only. Event totals equal the sum of their lot awards; event and lot values are never added together.' },
      { metric: 'Recommended or intended value', definition: 'Preferred-bidder recommendations and intent notices, reported separately: they are not awards and create no commitment.' },
    ],
    levelNote: 'Event rows with their lot rows beneath; totals use event rows only.',
    chart: { title: 'Final award value per event', valueField: 'awardValue', labelField: 'reference' },
    lastRunAt: '2026-09-28T06:00:00Z',
  },
  {
    family: 'commercial_outcomes',
    title: 'Commercial outcomes',
    description: 'Estimate, offer, award and delivery against an approved, dated baseline.',
    questions: 'What changed from estimate to offer, award, and actual delivery?',
    dimensions: ['Approved comparison basis', 'Quantities', 'Scope', 'Price effects', 'Realized results'],
    runWith: ['contract.financials.view', 'report.manage'],
    restrictionReason: 'Requires contract financial access or report management.',
    fields: [
      REFERENCE,
      SCOPE,
      field('baselineDate', 'Baseline date', 'date', 'Date of the approved comparison baseline.'),
      field('estimate', 'Approved estimate', 'money', 'Baseline estimate with equivalent quantities and scope.'),
      field('offer', 'Best compliant offer', 'money', 'Lowest evaluated compliant offer.'),
      field('award', 'Award', 'money', 'Awarded value.'),
      field('priceReduction', 'Price reduction', 'money', 'Estimate minus award for the same scope; not a realized saving.'),
      field('realizedSavings', 'Realized savings', 'money', 'Measured after delivery; missing while the contract runs.'),
    ],
    countingBasis: [
      { metric: 'Price reduction', definition: 'Separate from avoided future cost, budget variance and realized savings (PRD §15.2).' },
      { metric: 'Realized savings', definition: 'Only once delivery is accepted and invoices are paid; otherwise missing.' },
    ],
    levelNote: 'Event rows and lot rows; totals use event rows only.',
    chart: null,
    lastRunAt: null,
  },
  {
    family: 'contract_performance',
    title: 'Contract performance',
    description: 'Obligations, service measures, changes and renewals by supplier and contract owner.',
    questions: 'Are obligations, service measures, changes, and renewals under control?',
    dimensions: ['Supplier', 'Contract owner', 'Milestone', 'Period', 'Risk', 'Corrective action'],
    runWith: ['contract.view'],
    restrictionReason: 'Requires access to contracts.',
    fields: [
      REFERENCE,
      TITLE,
      field('supplier', 'Supplier', 'text', 'Supplier legal party.'),
      field('status', 'Status', 'status', 'Contract status.'),
      field('obligationsAccepted', 'Obligations accepted', 'count', 'Obligations and milestones accepted.'),
      field('obligationsOverdue', 'Overdue or rejected', 'count', 'Overdue obligations and rejected evidence.'),
      field('changeRequests', 'Change requests', 'count', 'Change requests raised.'),
      field('ceiling', 'Contract ceiling', 'money', 'Signed contract value.'),
      field('invoiced', 'Invoiced', 'money', 'Invoiced to date (finance source, freshness stated).', ['contract.financials.view']),
      field('paid', 'Paid', 'money', 'Paid to date.', ['contract.financials.view']),
      field('nextRenewal', 'Renewal decision due', 'date', 'Next renewal or extension decision date.'),
    ],
    countingBasis: [{ metric: 'Financials', definition: 'Ceiling, committed, invoiced and paid are separate; invoiced and paid come from local entry as of the report date.' }],
    levelNote: 'One row per contract.',
    chart: null,
    lastRunAt: '2026-10-01T07:00:00Z',
  },
  {
    family: 'complaints',
    title: 'Complaints and exceptions',
    description: 'Challenges and authorized departures with grounds, owner, stage, age, holds and resolution.',
    questions: 'What is challenged or proceeding through an exception?',
    dimensions: ['Grounds', 'Owner', 'Stage', 'Age', 'Resolution', 'Hold', 'Authorized departure'],
    runWith: ['complaint.manage', 'audit.view'],
    restrictionReason: 'Requires complaint management or audit access (complaint documents are restricted).',
    fields: [
      field('caseRef', 'Case', 'text', 'Complaint or exception reference.'),
      REFERENCE,
      field('grounds', 'Grounds', 'status', 'Subject of the complaint.'),
      field('stage', 'Stage', 'status', 'Current stage.'),
      field('owner', 'Owner', 'text', 'Case owner.'),
      field('ageDays', 'Age', 'days', 'Calendar days since receipt.'),
      field('hold', 'Hold', 'text', 'Hold in force and the actions it blocks.'),
    ],
    countingBasis: [{ metric: 'Age', definition: 'Calendar days since receipt, including days on hold.' }],
    levelNote: 'One row per case.',
    chart: null,
    lastRunAt: null,
  },
  {
    family: 'audit_records',
    title: 'Audit and records',
    description: 'Whether decisions can be reconstructed and retention duties are met, including legal holds.',
    questions: 'Can decisions be reconstructed and are retention duties being met?',
    dimensions: ['Event', 'Actor', 'Decision', 'Version', 'Disclosure', 'Retention classification', 'Legal hold'],
    runWith: ['audit.view'],
    restrictionReason: 'Requires audit access.',
    fields: [
      REFERENCE,
      TITLE,
      field('decisionsRecorded', 'Decisions recorded', 'count', 'Formal decisions in the audit trail.'),
      field('versionsRetained', 'Versions retained', 'count', 'Immutable snapshots retained (BR-09).'),
      field('disclosures', 'Disclosures', 'count', 'Public notices and approved disclosures.'),
      field('retentionEnds', 'Retention ends', 'date', 'End of the ordinary retention period.'),
      field('legalHold', 'Legal hold', 'text', 'Active legal or investigation hold.'),
    ],
    countingBasis: [{ metric: 'Retention ends', definition: 'From the retention class trigger and duration; a hold prevents disposal after this date (BR-40).' }],
    levelNote: 'One row per event.',
    chart: null,
    lastRunAt: '2026-07-01T08:00:00Z',
  },
];

export function reportFamily(family: ReportDefinitionsFamily): FixtureReportFamily {
  const found = REPORT_FAMILIES.find((row) => row.family === family);
  if (found === undefined) {
    throw new Error(`No report family ${family}.`);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------------------

export interface FixtureReportRow {
  readonly tenantId: number;
  readonly family: ReportDefinitionsFamily;
  readonly id: string;
  readonly level: ReportRowLevel;
  readonly parentId: string | null;
  /** Dimension anchor: the tender (or contract's tender) the row belongs to; `null` for supplier-level rows. */
  readonly tenderId: number | null;
  /** Date the row falls on for the report period filter. */
  readonly date: CalendarDate;
  readonly cells: Readonly<Record<string, ReportCell>>;
  readonly drillThrough: LinkPath | null;
  /** Drill-through is offered only with one of these permissions. */
  readonly drillWith: readonly PermissionCode[];
  /** Distinct bidding organizations (participation), for the unique-organization highlight. */
  readonly bidderTenantIds: readonly number[];
  /** Per `distinct` field: the organizations the row counts, so totals can count them once across events (AC-34). */
  readonly distinctOrgs: Readonly<Record<string, readonly number[]>>;
  /** The row has at least one missing value (completeness indicator). */
  readonly missingData: boolean;
}

type RowInput = Omit<FixtureReportRow, 'tenantId' | 'family' | 'parentId' | 'bidderTenantIds' | 'distinctOrgs' | 'missingData' | 'drillWith'> &
  Partial<Pick<FixtureReportRow, 'parentId' | 'bidderTenantIds' | 'distinctOrgs' | 'drillWith' | 'tenantId'>>;

function rows(family: ReportDefinitionsFamily, drillWith: readonly PermissionCode[], inputs: readonly RowInput[]): FixtureReportRow[] {
  return inputs.map((input) => ({
    tenantId: input.tenantId ?? KWU,
    family,
    parentId: input.parentId ?? null,
    bidderTenantIds: input.bidderTenantIds ?? [],
    distinctOrgs: input.distinctOrgs ?? {},
    drillWith: input.drillWith ?? drillWith,
    missingData: Object.values(input.cells).some((value) => value.kind === 'missing'),
    ...input,
  }));
}

const T = (n: number): string => `T-2026-${String(n).padStart(4, '0')}`;
const tref = (n: number): ReportCell => cell.ref(T(n), LINKS.buyerTender(n));
const S = TENANT_IDS;

function personName(userId: number): string {
  return PERSONAS.find((persona) => persona.userId === userId)?.fullName ?? `User ${userId}`;
}

/** Pipeline rows derived from the tender facts (every non-archived event of each buyer). */
const PIPELINE_ROWS = rows(
  'pipeline',
  ['tender.view'],
  TENDER_FACTS.filter((tender) => tender.status !== 'archived').map((tender) => ({
    tenantId: tender.tenantId,
    id: `pl-${tender.id}`,
    level: 'event' as const,
    tenderId: tender.id,
    date: tender.lastActivityOn,
    drillThrough: LINKS.buyerTender(tender.id),
    cells: {
      reference: tref(tender.id),
      title: cell.text(tender.lots.length > 0 ? `${tender.title} (${tender.lots.length} lots)` : tender.title),
      stage: cell.status('tenders.status', tender.status),
      department: cell.text(dimensionLabel(DEPARTMENTS, tender.departmentId)),
      category: cell.text(CATEGORIES.find((row) => row.id === tender.categoryId)?.code ?? ''),
      owner: cell.text(personName(tender.ownerUserId)),
      estimatedValue: tender.estimatedValue === null ? cell.missing('RFI: no estimate is set for an information request.') : cell.moneyOf(tender.estimatedValue),
      daysInStage: cell.days(String(tender.daysInStage)),
      nextMilestone: tender.nextMilestoneLabel === null ? cell.missing('No dated milestone ahead.') : cell.text(tender.nextMilestoneLabel),
    },
  })),
);

const CYCLE_ROWS = rows('cycle_time', ['tender.view'], [
  { id: 'ct-1', level: 'event', tenderId: 1, date: '2026-10-02', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), title: cell.text('Borehole pump replacement programme'), requestToRelease: cell.days('42'), releaseToClose: cell.days('46'), evaluationDays: cell.days('31'), approvalDays: cell.days('9'), calendarElapsed: cell.days('151'), holdAdjusted: cell.days('151') } },
  { id: 'ct-1-3', level: 'lot', parentId: 'ct-1', tenderId: 1, date: '2026-10-02', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), title: cell.text(lotLabel(1, 103)), requestToRelease: cell.days('42'), releaseToClose: cell.days('46'), evaluationDays: cell.missing('Evaluation still in progress.'), approvalDays: cell.missing('Not yet at approval.'), calendarElapsed: cell.days('151'), holdAdjusted: cell.days('151') } },
  { id: 'ct-3', level: 'event', tenderId: 3, date: '2026-10-01', drillThrough: LINKS.buyerTender(3), cells: { reference: tref(3), title: cell.text('SCADA telemetry upgrade'), requestToRelease: cell.days('28'), releaseToClose: cell.days('45'), evaluationDays: cell.missing('Evaluation still in progress.'), approvalDays: cell.missing('Not yet at approval.'), calendarElapsed: cell.days('126'), holdAdjusted: cell.days('126') } },
  { id: 'ct-7', level: 'event', tenderId: 7, date: '2026-10-03', drillThrough: LINKS.buyerTender(7), cells: { reference: tref(7), title: cell.text('Reservoir rehabilitation works'), requestToRelease: cell.days('35'), releaseToClose: cell.days('49'), evaluationDays: cell.days('38'), approvalDays: cell.days('12'), calendarElapsed: cell.days('175'), holdAdjusted: cell.days('166') } },
  { id: 'ct-9', level: 'event', tenderId: 9, date: '2026-10-02', drillThrough: LINKS.buyerTender(9), cells: { reference: tref(9), title: cell.text('Acoustic leak detection services'), requestToRelease: cell.days('21'), releaseToClose: cell.days('40'), evaluationDays: cell.days('44'), approvalDays: cell.missing('Preferred bidder failed due diligence; no award yet.'), calendarElapsed: cell.days('133'), holdAdjusted: cell.days('133') } },
  { id: 'ct-10', level: 'event', tenderId: 10, date: '2026-09-01', drillThrough: LINKS.buyerTender(10), cells: { reference: tref(10), title: cell.text('Fleet vehicle maintenance'), requestToRelease: cell.days('18'), releaseToClose: cell.days('30'), evaluationDays: cell.days('16'), approvalDays: cell.days('6'), calendarElapsed: cell.days('169'), holdAdjusted: cell.days('169') } },
]);

// Participation (AC-34): derived from the owning domains so the counts cannot drift from them.
// - Bids domain (`../bids/responses.ts`): a supplier competes when its bid is `submitted` (an effective receipt).
//   Withdrawn bids and bids never submitted do not compete; every official receipt counts as a submitted revision
//   (superseded and withdrawn ones included), a late-rejected attempt does not (BR-19).
// - Publication domain (`../publication/participants.ts`): invited organizations, registered interest (every
//   participant, including access requests) and shared no-bid decisions.
// Unique counts are per event (or per lot) and are never summed across events: the totals row counts distinct
// organizations instead (see `distinctOrgs` and the `total: 'distinct'` fields).

interface ParticipationFacts {
  /** Compliance review result in bids, or the reason it is missing. */
  readonly compliant: number | string;
  readonly lots?: Readonly<Record<number, number | string>>;
  readonly scope: string;
  readonly date: CalendarDate;
}

const NOT_OPENED = 'Not opened: the event is still open.';

/** The facts the reporting domain owns: compliance results (evaluation and opening domains) and the row dates. */
const PARTICIPATION_FACTS: Readonly<Record<number, ParticipationFacts>> = {
  1: { compliant: 2, lots: { 101: 2, 102: 0, 103: 2 }, scope: 'Whole event (3 lots)', date: '2026-07-31' },
  2: { compliant: NOT_OPENED, scope: 'Whole event', date: '2026-10-03' },
  3: { compliant: 2, scope: 'Whole event', date: '2026-08-28' },
  4: { compliant: 'RFI responses are not assessed for compliance.', scope: 'Whole event (RFI responses)', date: '2026-06-05' },
  6: { compliant: NOT_OPENED, scope: 'Whole event (invitation only)', date: '2026-10-01' },
  7: { compliant: 3, scope: 'Whole event', date: '2026-07-10' },
  8: { compliant: 'Sealed until the opening of 7 Oct 2026.', scope: 'Whole event (sealed until opening)', date: '2026-09-30' },
  9: { compliant: 3, scope: 'Whole event (restricted, two stages)', date: '2026-07-06' },
  10: { compliant: 2, scope: 'Whole event', date: '2026-06-30' },
  11: { compliant: NOT_OPENED, scope: 'Whole event', date: '2026-10-01' },
};

function distinct(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function countOrMissing(value: number | string): ReportCell {
  return typeof value === 'number' ? cell.count(value) : cell.missing(value);
}

/** Interest, invitations and no-bid decisions are recorded per event, never per lot. */
const LOT_LEVEL_ONLY = 'Event level only';

function participationRows(): RowInput[] {
  const result: RowInput[] = [];
  for (const [key, facts] of Object.entries(PARTICIPATION_FACTS)) {
    const tender = TENDER_FACTS.find((row) => row.id === Number(key));
    if (tender === undefined) {
      throw new Error(`No tender fact ${key}.`);
    }
    const bids = BIDS.filter((bid) => bid.tenderId === tender.id);
    const competing = bids.filter((bid) => bid.submissionState === 'submitted');
    const receiptsOf = (bidIds: readonly number[]): number =>
      SUBMISSION_RECEIPTS.filter((receipt) => bidIds.includes(receipt.bidId) && receipt.status !== 'late_rejected').length;
    const participants = PARTICIPANTS.filter((row) => row.tenderId === tender.id);
    const invited = distinct(participants.filter((row) => row.invitationStatus !== 'not_invited').map((row) => row.supplierTenantId));
    const interested = distinct(participants.map((row) => row.supplierTenantId));
    const noBid = distinct(participants.filter((row) => row.bidIntent === 'no_bid').map((row) => row.supplierTenantId));
    const bidders = distinct(competing.map((bid) => bid.supplierTenantId));
    const eventId = `pa-${tender.id}`;
    result.push({
      tenantId: tender.tenantId,
      id: eventId,
      level: 'event',
      tenderId: tender.id,
      date: facts.date,
      drillThrough: LINKS.buyerTender(tender.id),
      bidderTenantIds: bidders,
      distinctOrgs: { invited, registeredInterest: interested, uniqueBidders: bidders, noBid },
      cells: {
        reference: tref(tender.id),
        scope: cell.text(facts.scope),
        invited: cell.count(invited.length),
        registeredInterest: cell.count(interested.length),
        uniqueBidders: cell.count(bidders.length),
        submittedRevisions: cell.count(receiptsOf(bids.map((bid) => bid.id))),
        compliantBids: countOrMissing(facts.compliant),
        noBid: cell.count(noBid.length),
      },
    });
    for (const lot of tender.lots) {
      const lotBids = bids.filter((bid) => bid.lotIds.includes(lot.id));
      const lotBidders = distinct(competing.filter((bid) => bid.lotIds.includes(lot.id)).map((bid) => bid.supplierTenantId));
      result.push({
        tenantId: tender.tenantId,
        id: `${eventId}-${lot.number}`,
        level: 'lot',
        parentId: eventId,
        tenderId: tender.id,
        date: facts.date,
        drillThrough: LINKS.buyerTender(tender.id),
        bidderTenantIds: lotBidders,
        distinctOrgs: { uniqueBidders: lotBidders },
        cells: {
          reference: tref(tender.id),
          scope: cell.text(`${lotLabel(tender.id, lot.id)}${lot.stage === 'cancelled' ? ' (cancelled)' : ''}`),
          invited: cell.text(LOT_LEVEL_ONLY),
          registeredInterest: cell.text(LOT_LEVEL_ONLY),
          uniqueBidders: cell.count(lotBidders.length),
          submittedRevisions: cell.count(receiptsOf(lotBids.map((bid) => bid.id))),
          compliantBids: countOrMissing(facts.lots?.[lot.id] ?? 'No lot-level compliance result recorded.'),
          noBid: cell.text(LOT_LEVEL_ONLY),
        },
      });
    }
  }
  return result;
}

const PARTICIPATION_ROWS = rows('participation', ['tender.view'], participationRows());

const QUALIFICATION_ROWS = rows('qualification_risk', ['supplier.directory.view'], [
  { id: 'qr-4', level: 'record', tenderId: null, date: '2026-04-15', drillThrough: LINKS.buyerSupplier(S.tsodilo), cells: { supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), program: cell.text('Water Infrastructure Suppliers — Category A'), status: cell.status('v_qualification_status.effective_status', 'qualified'), validTo: cell.date('2028-04-14'), condition: cell.text('None'), activeExposure: cell.money('6535000.00') } },
  { id: 'qr-5', level: 'record', tenderId: null, date: '2026-05-04', drillThrough: LINKS.buyerSupplier(S['chobe-pipe']), cells: { supplier: cell.text('Chobe Pipe & Valve Supplies'), program: cell.text('Water Infrastructure Suppliers — Category A'), status: cell.status('v_qualification_status.effective_status', 'qualified_with_conditions'), validTo: cell.date('2028-05-03'), condition: cell.text('Public liability insurance expires 8 Oct 2026; reassessment due'), activeExposure: cell.money('450000.00') } },
  { id: 'qr-6', level: 'record', tenderId: null, date: '2026-09-18', drillThrough: LINKS.buyerQualification(503), cells: { supplier: cell.text('Makgadikgadi Civil Works'), program: cell.text('Water Infrastructure Suppliers — Category A'), status: cell.status('v_qualification_status.effective_status', 'not_assessed'), validTo: cell.missing('No decision yet: more information required.'), condition: cell.text('Financial statement unclear; information requested'), activeExposure: cell.money('0.00') } },
  { id: 'qr-7', level: 'record', tenderId: null, date: '2026-02-01', drillThrough: LINKS.buyerSupplier(S['serowe-ict']), cells: { supplier: cell.text('Serowe ICT Solutions (Pty) Ltd'), program: cell.text('ICT and Telemetry Service Providers'), status: cell.status('v_qualification_status.effective_status', 'qualified'), validTo: cell.date('2029-01-31'), condition: cell.text('None'), activeExposure: cell.money('0.00') } },
  { id: 'qr-8', level: 'record', tenderId: null, date: '2026-09-10', drillThrough: LINKS.buyerSupplier(S['limpopo-env']), cells: { supplier: cell.text('Limpopo Environmental Services (Pty) Ltd'), program: cell.text('Environmental and Laboratory Services'), status: cell.status('v_qualification_status.effective_status', 'suspended'), validTo: cell.date('2028-01-19'), condition: cell.text('Suspended: waste management licence expired 5 Sep 2026'), activeExposure: cell.money('0.00') } },
  { id: 'qr-9', level: 'record', tenderId: null, date: '2026-08-31', drillThrough: LINKS.buyerSupplier(S['gaborone-meter']), cells: { supplier: cell.text('Gaborone Metering Company (Pty) Ltd'), program: cell.text('Metering Equipment Suppliers'), status: cell.status('v_qualification_status.effective_status', 'expired'), validTo: cell.date('2026-08-31'), condition: cell.text('Renewal application QA-2026-0008 submitted'), activeExposure: cell.money('0.00') } },
]);

const EVALUATION_ROWS = rows('evaluation_integrity', ['evaluation.chair', 'audit.view'], [
  { id: 'ei-3', level: 'event', tenderId: 3, date: '2026-10-01', drillThrough: LINKS.buyerTender(3), cells: { reference: tref(3), scope: cell.text('Whole event'), assignments: cell.count(3), missingScores: cell.count(1), maxVariance: cell.decimal('3.50'), moderatedChanges: cell.count(1), conflictsDeclared: cell.count(1), overrides: cell.count(0) } },
  { id: 'ei-1', level: 'event', tenderId: 1, date: '2026-09-25', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), scope: cell.text('Whole event (3 lots)'), assignments: cell.count(6), missingScores: cell.count(0), maxVariance: cell.decimal('2.00'), moderatedChanges: cell.count(2), conflictsDeclared: cell.count(0), overrides: cell.count(1) } },
  { id: 'ei-1-3', level: 'lot', parentId: 'ei-1', tenderId: 1, date: '2026-09-25', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), scope: cell.text(lotLabel(1, 103)), assignments: cell.count(3), missingScores: cell.count(0), maxVariance: cell.decimal('2.00'), moderatedChanges: cell.count(1), conflictsDeclared: cell.count(0), overrides: cell.count(0) } },
  { id: 'ei-9', level: 'event', tenderId: 9, date: '2026-09-02', drillThrough: LINKS.buyerTender(9), cells: { reference: tref(9), scope: cell.text('Whole event'), assignments: cell.count(3), missingScores: cell.count(0), maxVariance: cell.decimal('1.50'), moderatedChanges: cell.count(0), conflictsDeclared: cell.count(0), overrides: cell.count(0) } },
]);

const RECOMMENDATION_ONLY = 'Recommendation only: a recommendation is not an award (BR-31).';

const AWARD_ROWS = rows('awards', ['tender.view', 'contract.view'], [
  { id: 'aw-1', level: 'event', tenderId: 1, date: '2026-09-04', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), scope: cell.text('Whole event (lots 1 and 2 decided)'), supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), outcome: cell.status('lot_outcomes.status', 'final_awarded'), recommendedValue: cell.money('5340000.00'), awardValue: cell.money('5340000.00'), approvedBudget: cell.money('4850000.00'), awardDate: cell.date('2026-09-04') } },
  { id: 'aw-1-1', level: 'lot', parentId: 'aw-1', tenderId: 1, date: '2026-09-04', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), scope: cell.text(lotLabel(1, 101)), supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), outcome: cell.status('lot_outcomes.status', 'final_awarded'), recommendedValue: cell.money('5340000.00'), awardValue: cell.money('5340000.00'), approvedBudget: cell.money('2150000.00'), awardDate: cell.date('2026-09-04') } },
  { id: 'aw-1-2', level: 'lot', parentId: 'aw-1', tenderId: 1, date: '2026-08-21', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), scope: cell.text(`${lotLabel(1, 102)} (cancelled)`), supplier: cell.text('No award (lot cancelled)'), outcome: cell.status('lot_outcomes.outcome', 'cancelled'), recommendedValue: cell.missing('Lot cancelled: no compliant offer (REQ-T-02).'), awardValue: cell.missing('Lot cancelled: no award.'), approvedBudget: cell.money('1600000.00'), awardDate: cell.missing('Lot cancelled on 21 Aug 2026: no award.') } },
  { id: 'aw-3', level: 'event', tenderId: 3, date: '2026-10-01', drillThrough: LINKS.buyerTender(3), cells: { reference: tref(3), scope: cell.text('Whole event (recommendation)'), supplier: cell.text('Tsodilo Engineering (Pty) Ltd (recommended)'), outcome: cell.status('lot_outcomes.status', 'recommended'), recommendedValue: cell.money('120000.00'), awardValue: cell.missing(RECOMMENDATION_ONLY), approvedBudget: cell.money('125000.00'), awardDate: cell.missing('No award decision yet.') } },
  { id: 'aw-7', level: 'event', tenderId: 7, date: '2026-09-22', drillThrough: LINKS.buyerTender(7), cells: { reference: tref(7), scope: cell.text('Whole event (intent only)'), supplier: cell.text('Makgadikgadi Civil Works (intent only)'), outcome: cell.status('lot_outcomes.status', 'intent_notified'), recommendedValue: cell.money('7850000.00'), awardValue: cell.missing('Intent notified 22 Sep 2026; final award held by a complaint.'), approvedBudget: cell.money('7400000.00'), awardDate: cell.missing('Intent notified 22 Sep 2026; final award held by a complaint.') } },
  { id: 'aw-9', level: 'event', tenderId: 9, date: '2026-09-24', drillThrough: LINKS.buyerTender(9), cells: { reference: tref(9), scope: cell.text('Whole event (conditional recommendation)'), supplier: cell.text('Limpopo Environmental Services (Pty) Ltd (recommended)'), outcome: cell.status('lot_outcomes.status', 'recommended'), recommendedValue: cell.money('2940000.00'), awardValue: cell.missing(RECOMMENDATION_ONLY), approvedBudget: cell.money('3100000.00'), awardDate: cell.missing('No award decision yet.') } },
  { id: 'aw-10', level: 'event', tenderId: 10, date: '2026-03-06', drillThrough: LINKS.buyerTender(10), cells: { reference: tref(10), scope: cell.text('Whole event'), supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), outcome: cell.status('lot_outcomes.status', 'final_awarded'), recommendedValue: cell.money('1850000.00'), awardValue: cell.money('1850000.00'), approvedBudget: cell.money('2850000.00'), awardDate: cell.date('2026-03-06') } },
]);

const COMMERCIAL_ROWS = rows('commercial_outcomes', ['contract.financials.view', 'report.manage'], [
  { id: 'co-1', level: 'event', tenderId: 1, date: '2026-09-04', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), scope: cell.text('Whole event (Lot 1 awarded)'), baselineDate: cell.date('2026-05-18'), estimate: cell.money('2150000.00'), offer: cell.money('5340000.00'), award: cell.money('5340000.00'), priceReduction: cell.money('-3190000.00'), realizedSavings: cell.missing('Contracts C-2026-0002 to C-2026-0004 are not yet active.') } },
  { id: 'co-1-1', level: 'lot', parentId: 'co-1', tenderId: 1, date: '2026-09-04', drillThrough: LINKS.buyerTender(1), cells: { reference: tref(1), scope: cell.text(lotLabel(1, 101)), baselineDate: cell.date('2026-05-18'), estimate: cell.money('2150000.00'), offer: cell.money('5340000.00'), award: cell.money('5340000.00'), priceReduction: cell.money('-3190000.00'), realizedSavings: cell.missing('Contracts C-2026-0002 to C-2026-0004 are not yet active.') } },
  { id: 'co-10', level: 'event', tenderId: 10, date: '2026-03-06', drillThrough: LINKS.buyerContract(1), cells: { reference: tref(10), scope: cell.text('Whole event'), baselineDate: cell.date('2026-02-09'), estimate: cell.money('2850000.00'), offer: cell.money('1850000.00'), award: cell.money('1850000.00'), priceReduction: cell.money('1000000.00'), realizedSavings: cell.missing('Contract running: realized results are known at closeout.') } },
  { id: 'co-7', level: 'event', tenderId: 7, date: '2026-09-22', drillThrough: LINKS.buyerTender(7), cells: { reference: tref(7), scope: cell.text('Whole event (intent only)'), baselineDate: cell.date('2026-04-06'), estimate: cell.money('7400000.00'), offer: cell.money('7850000.00'), award: cell.missing('Final award held by a complaint.'), priceReduction: cell.missing('Final award held by a complaint.'), realizedSavings: cell.missing('No contract yet.') } },
]);

const CONTRACT_ROWS = rows('contract_performance', ['contract.view'], [
  { id: 'cp-1', level: 'record', tenderId: 10, date: '2026-10-05', drillThrough: LINKS.buyerContract(1), cells: { reference: cell.ref('C-2026-0001', LINKS.buyerContract(1)), title: cell.text('Fleet vehicle maintenance'), supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), status: cell.status('contracts.status', 'active'), obligationsAccepted: cell.count(2), obligationsOverdue: cell.count(2), changeRequests: cell.count(3), ceiling: cell.money('2250000.00'), invoiced: cell.money('693750.00'), paid: cell.money('462500.00'), nextRenewal: cell.date('2026-12-31') } },
  { id: 'cp-2', level: 'record', tenderId: 1, date: '2026-10-01', drillThrough: LINKS.buyerContract(2), cells: { reference: cell.ref('C-2026-0002', LINKS.buyerContract(2)), title: cell.text('Borehole pumps Lot 1: supply and installation'), supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), status: cell.status('contracts.status', 'awaiting_signature'), obligationsAccepted: cell.count(0), obligationsOverdue: cell.count(0), changeRequests: cell.count(0), ceiling: cell.money('4900000.00'), invoiced: cell.money('0.00'), paid: cell.money('0.00'), nextRenewal: cell.missing('No renewal option.') } },
  { id: 'cp-3', level: 'record', tenderId: 1, date: '2026-10-01', drillThrough: LINKS.buyerContract(3), cells: { reference: cell.ref('C-2026-0003', LINKS.buyerContract(3)), title: cell.text('Borehole pumps Lot 1: preventive maintenance'), supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), status: cell.status('contracts.status', 'under_review'), obligationsAccepted: cell.count(0), obligationsOverdue: cell.count(0), changeRequests: cell.count(0), ceiling: cell.money('540000.00'), invoiced: cell.money('0.00'), paid: cell.money('0.00'), nextRenewal: cell.missing('No renewal option.') } },
  { id: 'cp-8', level: 'record', tenderId: 1, date: '2026-10-01', drillThrough: LINKS.buyerContract(8), cells: { reference: cell.ref('C-2026-0004', LINKS.buyerContract(8)), title: cell.text('Borehole pumps Lot 1: spare parts and consumables'), supplier: cell.text('Tsodilo Engineering (Pty) Ltd'), status: cell.status('contracts.status', 'draft'), obligationsAccepted: cell.count(0), obligationsOverdue: cell.count(0), changeRequests: cell.count(0), ceiling: cell.money('120000.00'), invoiced: cell.money('0.00'), paid: cell.money('0.00'), nextRenewal: cell.missing('No renewal option.') } },
  { id: 'cp-4', level: 'record', tenderId: null, date: '2026-07-31', drillThrough: LINKS.buyerContract(4), cells: { reference: cell.ref('C-2025-0007', LINKS.buyerContract(4)), title: cell.text('Legacy meter reading services (imported)'), supplier: cell.text('Gaborone Metering Company (Pty) Ltd'), status: cell.status('contracts.status', 'expired'), obligationsAccepted: cell.missing('Imported contract: obligation history before 2025 not recorded.'), obligationsOverdue: cell.count(1), changeRequests: cell.missing('Imported contract: change history not recorded.'), ceiling: cell.money('640000.00'), invoiced: cell.money('586000.00'), paid: cell.money('586000.00'), nextRenewal: cell.missing('Expired; the reader warranty survives until 30 Jun 2027.') } },
  { id: 'cp-5', level: 'record', tenderId: null, date: '2026-01-31', drillThrough: LINKS.buyerContract(5), cells: { reference: cell.ref('C-2025-0003', LINKS.buyerContract(5)), title: cell.text('SCADA helpdesk and patching support'), supplier: cell.text('Serowe ICT Solutions (Pty) Ltd'), status: cell.status('contracts.status', 'closed'), obligationsAccepted: cell.count(1), obligationsOverdue: cell.count(0), changeRequests: cell.count(0), ceiling: cell.money('310000.00'), invoiced: cell.money('310000.00'), paid: cell.money('310000.00'), nextRenewal: cell.missing('Closed: recompete decided.') } },
  { id: 'cp-6', level: 'record', tenderId: null, date: '2026-09-10', drillThrough: LINKS.buyerContract(6), cells: { reference: cell.ref('C-2025-0005', LINKS.buyerContract(6)), title: cell.text('Network valve maintenance call-out services'), supplier: cell.text('Chobe Pipe & Valve Supplies'), status: cell.status('contracts.status', 'suspended'), obligationsAccepted: cell.count(0), obligationsOverdue: cell.count(1), changeRequests: cell.count(1), ceiling: cell.money('520000.00'), invoiced: cell.money('187500.00'), paid: cell.money('150000.00'), nextRenewal: cell.date('2026-10-31') } },
  { id: 'cp-7', tenantId: ODC, level: 'record', tenderId: null, date: '2026-10-03', drillThrough: LINKS.buyerContract(7), cells: { reference: cell.ref('C-2025-0004', LINKS.buyerContract(7)), title: cell.text('Council office cleaning services'), supplier: cell.text('Limpopo Environmental Services (Pty) Ltd'), status: cell.status('contracts.status', 'active'), obligationsAccepted: cell.count(9), obligationsOverdue: cell.count(0), changeRequests: cell.count(0), ceiling: cell.money('276000.00'), invoiced: cell.money('207000.00'), paid: cell.money('184000.00'), nextRenewal: cell.date('2026-11-13') } },
]);

const COMPLAINT_ROWS = rows('complaints', ['complaint.manage'], [
  { id: 'cm-92', level: 'record', tenderId: 7, date: '2026-09-25', drillThrough: LINKS.buyerComplaint(92), cells: { caseRef: cell.text('CMP-2026-0002'), reference: tref(7), grounds: cell.status('complaints.subject', 'evaluation'), stage: cell.status('complaints.status', 'under_investigation'), owner: cell.text('Dineo Masire'), ageDays: cell.days('12'), hold: cell.text('Complaint hold: blocks the final award and contract signature') } },
  { id: 'cm-94', level: 'record', tenderId: 2, date: '2026-09-29', drillThrough: LINKS.buyerComplaint(94), cells: { caseRef: cell.text('CMP-2026-0003'), reference: tref(2), grounds: cell.status('complaints.subject', 'tender_terms'), stage: cell.status('complaints.status', 'received'), owner: cell.missing('No case owner assigned yet.'), ageDays: cell.days('8'), hold: cell.text('None') } },
  { id: 'cm-91', level: 'record', tenderId: 1, date: '2026-08-14', drillThrough: LINKS.buyerComplaint(91), cells: { caseRef: cell.text('CMP-2026-0001'), reference: tref(1), grounds: cell.status('complaints.subject', 'evaluation'), stage: cell.status('complaints.status', 'closed'), owner: cell.text('Dineo Masire'), ageDays: cell.days('14'), hold: cell.text('Released: complaint dismissed') } },
  { id: 'cm-93', tenantId: ODC, level: 'record', tenderId: 11, date: '2026-09-26', drillThrough: LINKS.buyerComplaint(93), cells: { caseRef: cell.text('CMP-2026-0001'), reference: tref(11), grounds: cell.status('complaints.subject', 'tender_terms'), stage: cell.status('complaints.status', 'received'), owner: cell.missing('No case owner assigned yet.'), ageDays: cell.days('11'), hold: cell.text('None') } },
]);

const AUDIT_ROWS = rows('audit_records', ['audit.view'], [
  { id: 'ar-legacy', level: 'event', tenderId: LEGACY_TENDER_ID, date: '2018-11-30', drillThrough: LINKS.auditTrail('tender', LEGACY_TENDER_ID), cells: { reference: cell.ref('T-2025-0003', LINKS.auditTrail('tender', LEGACY_TENDER_ID)), title: cell.text('Maun wellfield pump supply (legacy import, 2018)'), decisionsRecorded: cell.missing('Imported record: approvals before 2025 were not captured.'), versionsRetained: cell.count(2), disclosures: cell.count(1), retentionEnds: cell.date('2025-11-30'), legalHold: cell.text('Legal hold since 14 Aug 2026: disposal blocked') } },
  { id: 'ar-10', level: 'event', tenderId: 10, date: '2026-09-01', drillThrough: LINKS.buyerTender(10), cells: { reference: tref(10), title: cell.text('Fleet vehicle maintenance'), decisionsRecorded: cell.count(14), versionsRetained: cell.count(5), disclosures: cell.count(2), retentionEnds: cell.missing('Retention starts when the event is closed out.'), legalHold: cell.text('None') } },
  { id: 'ar-3', level: 'event', tenderId: 3, date: '2026-10-01', drillThrough: LINKS.buyerTender(3), cells: { reference: tref(3), title: cell.text('SCADA telemetry upgrade'), decisionsRecorded: cell.count(11), versionsRetained: cell.count(4), disclosures: cell.count(1), retentionEnds: cell.missing('Retention starts when the event is closed out.'), legalHold: cell.text('None') } },
  { id: 'ar-5', level: 'event', tenderId: 5, date: '2026-10-02', drillThrough: LINKS.buyerTender(5), cells: { reference: tref(5), title: cell.text('Water treatment chemicals framework'), decisionsRecorded: cell.count(3), versionsRetained: cell.count(3), disclosures: cell.count(0), retentionEnds: cell.missing('Retention starts when the event is closed out.'), legalHold: cell.text('None') } },
]);

export const REPORT_ROWS: readonly FixtureReportRow[] = [
  ...PIPELINE_ROWS,
  ...CYCLE_ROWS,
  ...PARTICIPATION_ROWS,
  ...QUALIFICATION_ROWS,
  ...EVALUATION_ROWS,
  ...AWARD_ROWS,
  ...COMMERCIAL_ROWS,
  ...CONTRACT_ROWS,
  ...COMPLAINT_ROWS,
  ...AUDIT_ROWS,
];
