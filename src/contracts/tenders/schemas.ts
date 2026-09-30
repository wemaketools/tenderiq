/**
 * Tender authoring schemas (FR-07; BR-01, BR-09, BR-10, BR-11, BR-12, BR-16; screens BUY-07..BUY-13).
 *
 * Field names mirror the blueprint tables of Migration 07 (`tenders`, `lots`, `tender_team_members`, `requirements`,
 * `pricing_schedules`, `pricing_items`, `tender_terms`, `tender_envelopes`, `participation_conditions`,
 * `evaluation_plans`, `evaluation_criteria`, `scale_anchors`, `tie_break_rules`, `release_checks`, `tender_milestones`,
 * `tender_versions`) in camelCase. Foreign keys travel as small reference objects (`owner`, `category`, `lot`).
 *
 * Money is `{ amount, currency }` with decimal strings, weights and points are decimal strings (DD-32), instants
 * are ISO UTC strings, and every deadline carries the tender's IANA official time zone (BR-11, DD-33).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { CustomFieldValues } from '../policy/shared.js';

import {
  CalendarDate,
  CurrencyCode,
  Id,
  IdParam,
  Instant,
  LinkPath,
  Money,
  NonNegativeDecimalString,
  NonNegativeMoney,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  Score,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { eq, gt, isDecimal, sum } from '../decimal.js';
import {
  ApprovalRequestsStatus,
  DocumentsClassification,
  EvaluationCriteriaEnvelope,
  EvaluationPlansAggregationMethod,
  EvaluationPlansPriceMethod,
  EvaluationPlansStatus,
  EvaluationPlansThresholdScope,
  LotsStage,
  ParticipationConditionsConditionType,
  PricingItemsChargeType,
  PricingItemsRecurrence,
  ProcurementStrategiesStatus,
  ReleaseChecksCheckArea,
  ReleaseChecksStatus,
  RequirementsEnvelope,
  RequirementsMissingConsequence,
  RequirementsResponseType,
  RequirementsTreatment,
  TemplatesAudience,
  TemplatesStatus,
  TenderEnvelopesEnvelope,
  TenderMilestonesMilestone,
  TenderTeamMembersTeamRole,
  TenderTermsTermType,
  TendersAwardModel,
  TendersEventType,
  TendersLinkType,
  TendersOpeningMode,
  TendersParticipation,
  TendersProcedure,
  TendersProcedureWrite,
  TendersStatus,
  TieBreakRulesRule,
} from '../enums.js';
import type { PermissionCode } from '../permissions.js';

// ---------------------------------------------------------------------------------------------------------
// Domain enumerations defined by this contract (derived values with no blueprint CHECK list)
// ---------------------------------------------------------------------------------------------------------

/** How a tender is created (FR-07): an approved template, a prior event, a blank form, or an approved request/strategy. */
export const TENDER_CREATION_SOURCES = ['blank', 'template', 'prior_event', 'request', 'strategy'] as const;
export const TenderCreationSource = z.enum(TENDER_CREATION_SOURCES);
export type TenderCreationSource = z.infer<typeof TenderCreationSource>;

/** The authoring sections of a tender, used for copying, readiness, corrections and material-change tracking. */
export const TENDER_SECTIONS = [
  'overview',
  'team',
  'lots',
  'requirements',
  'pricing',
  'terms',
  'evaluation_plan',
  'timetable',
  'participation',
  'documents',
  'release_approval',
] as const;
export const TenderSection = z.enum(TENDER_SECTIONS);
export type TenderSection = z.infer<typeof TenderSection>;

/** Sections a new tender may copy from a template or a prior event (never bids, deliberations, approvals, outcomes). */
export const TENDER_COPY_SECTIONS = [
  'overview',
  'lots',
  'requirements',
  'pricing',
  'terms',
  'evaluation_plan',
  'timetable',
  'participation',
] as const;
export const TenderCopySection = z.enum(TENDER_COPY_SECTIONS);
export type TenderCopySection = z.infer<typeof TenderCopySection>;

/** The SPA page (under `/buyer/tenders/:tenderId/`) that edits each section; '' is the overview. */
export const TENDER_SECTION_PAGES = {
  overview: '',
  team: '',
  lots: 'scope',
  requirements: 'scope',
  pricing: 'pricing',
  terms: 'pricing',
  evaluation_plan: 'evaluation',
  timetable: 'timetable',
  participation: 'timetable',
  documents: 'release',
  release_approval: 'release',
} as const satisfies Record<TenderSection, string>;

/** The in-app path of a tender section, for example `/buyer/tenders/5/scope`. */
export function tenderSectionPath(tenderId: number, section: TenderSection): string {
  const page = TENDER_SECTION_PAGES[section];
  return page === '' ? `/buyer/tenders/${tenderId}` : `/buyer/tenders/${tenderId}/${page}`;
}

/** Content that reuse NEVER copies into a new competition (FR-07). */
export const TENDER_NEVER_COPIED = [
  'bids',
  'deliberations',
  'evaluation_scores',
  'approvals',
  'supplier_outcomes',
  'participants',
  'clarifications',
] as const;
export const TenderNeverCopied = z.enum(TENDER_NEVER_COPIED);
export type TenderNeverCopied = z.infer<typeof TenderNeverCopied>;

/** Register phases: coarse groups of `tenders.status` for the BUY-07 filter. */
export const TENDER_PHASES = ['preparation', 'in_market', 'assessment', 'award', 'closed'] as const;
export const TenderPhase = z.enum(TENDER_PHASES);
export type TenderPhase = z.infer<typeof TenderPhase>;

/** The statuses of each register phase. */
export const TENDER_PHASE_STATUSES = {
  preparation: ['draft', 'awaiting_release_approval', 'ready'],
  in_market: ['open', 'closed'],
  assessment: ['under_assessment'],
  award: ['award_pending', 'awarded', 'partially_awarded'],
  closed: ['completed_without_award', 'information_collected', 'cancelled', 'archived'],
} as const satisfies Record<TenderPhase, readonly TendersStatus[]>;

/** Statuses in which the package is still authored in place (before release). Later edits need an addendum (BR-16). */
export const TENDER_AUTHORING_STATUSES = ['draft', 'awaiting_release_approval', 'ready'] as const satisfies readonly TendersStatus[];

/** Why a tender's content cannot be edited in place. */
export const TENDER_LOCK_REASONS = ['released_use_addendum', 'cancelled', 'archived'] as const;
export const TenderLockReason = z.enum(TENDER_LOCK_REASONS);
export type TenderLockReason = z.infer<typeof TenderLockReason>;

/** Severity of an authoring issue. `blocking` stops the release approval request and publication. */
export const ISSUE_SEVERITIES = ['blocking', 'warning'] as const;
export const IssueSeverity = z.enum(ISSUE_SEVERITIES);
export type IssueSeverity = z.infer<typeof IssueSeverity>;

/** Readiness item status (maps onto the ReadinessChecklist component). */
export const READINESS_STATUSES = ['blocking', 'warning', 'passed'] as const;
export const ReadinessStatus = z.enum(READINESS_STATUSES);
export type ReadinessStatus = z.infer<typeof ReadinessStatus>;

/** Stable authoring issue codes (requirements, evaluation plan, pricing, timetable, team, lots). */
export const TENDER_ISSUE_CODES = [
  // requirements (BUY-09)
  'REQUIREMENT_OWNER_MISSING',
  'MANDATORY_GATE_ONLY_WARNS',
  'INFORMATION_ONLY_REJECTS',
  'RATED_WITHOUT_CRITERION',
  'GATE_LINKED_TO_RATED_CRITERION',
  'CRITERION_ENVELOPE_MISMATCH',
  'ENVELOPE_NOT_CONFIGURED',
  'DUPLICATE_REFERENCE_CODE',
  'CHOICES_MISSING',
  'MANDATORY_EVIDENCE_UNSPECIFIED',
  // overview, lots and team (BUY-08, BR-01)
  'SUMMARY_MISSING',
  'LOT_OWNER_MISSING',
  'TENDER_OWNER_MISSING',
  'EVALUATORS_NOT_ASSIGNED',
  'EVALUATION_CHAIR_NOT_ASSIGNED',
  'OPENING_OFFICER_NOT_ASSIGNED',
  'CONFLICT_REVIEW_PENDING',
  // pricing (BUY-10)
  'PRICING_SCHEDULE_MISSING',
  'PRICING_SCHEDULE_EMPTY',
  'RECURRING_WITHOUT_EVALUATION_PERIODS',
  'PROVISIONAL_ITEM_IN_EVALUATION',
  'DISCOUNT_BASIS_MISSING',
  'ESTIMATE_EXCEEDS_BUDGET',
  'DRAFT_CONTRACT_TERMS_MISSING',
  // evaluation plan (BUY-11, PRD §9)
  'WEIGHTS_NOT_100',
  'PRICE_WEIGHT_MISMATCH',
  'PRICE_CRITERION_MISSING',
  'PRICE_TREATMENT_UNDECLARED',
  'THRESHOLD_MISSING',
  'ANCHORS_INCOMPLETE',
  'TIE_RULES_MISSING',
  'DECIMALS_INCONSISTENT',
  'PLAN_NOT_APPROVED',
  // timetable (BUY-12, BR-11, BR-12)
  'SUBMISSION_DEADLINE_MISSING',
  'MILESTONE_ORDER',
  'QUESTION_WINDOW_TOO_SHORT',
  'BRIEFING_AFTER_QUESTIONS_DEADLINE',
  'RESPONSE_PERIOD_TOO_SHORT',
  'NON_WORKING_DAY',
  'CALENDAR_MISSING',
  'STAGED_OPENING_ENVELOPES',
  // participation and documents (BUY-12, BUY-13)
  'QUALIFICATION_PROGRAM_MISSING',
  'PACKAGE_DOCUMENT_MISSING',
  'LANGUAGE_EDITION_MISSING',
  'DOCUMENT_CLASSIFICATION_CONFLICT',
  // release (BUY-13, BR-10)
  'RELEASE_CHECK_PENDING',
  'RELEASE_CHECK_FAILED',
  'RELEASE_APPROVAL_MISSING',
  'RELEASE_APPROVAL_PENDING',
  'RELEASE_APPROVAL_INVALIDATED',
  'CORRECTION_OPEN',
] as const;
export const TenderIssueCode = z.enum(TENDER_ISSUE_CODES);
export type TenderIssueCode = z.infer<typeof TenderIssueCode>;

/** One authoring issue: a stable code, its severity, an English message and what it concerns. */
export const TenderIssue = z.object({
  code: TenderIssueCode,
  severity: IssueSeverity,
  message: z.string().min(1),
  /** The field or record the issue concerns (`requirements.REQ-T-04`, `milestones.opening`, `criteria`). */
  field: z.string().nullable(),
  /** The related record (requirement, lot, criterion, milestone), when there is one. */
  relatedId: Id.nullable(),
});
export type TenderIssue = z.infer<typeof TenderIssue>;

/** The audiences of the package preview (BUY-13). */
export const PREVIEW_AUDIENCES = ['supplier', 'public'] as const;
export const PreviewAudience = z.enum(PREVIEW_AUDIENCES);
export type PreviewAudience = z.infer<typeof PreviewAudience>;

/** Status of a correction requested during the release review. */
export const CORRECTION_STATUSES = ['open', 'resolved'] as const;
export const CorrectionStatus = z.enum(CORRECTION_STATUSES);
export type CorrectionStatus = z.infer<typeof CorrectionStatus>;

/** Why a working-day hint flags a date (BR-12). */
export const NON_WORKING_REASONS = ['weekend', 'holiday'] as const;
export const NonWorkingReason = z.enum(NON_WORKING_REASONS);
export type NonWorkingReason = z.infer<typeof NonWorkingReason>;

/** Which team role needs which permission of the member (tender_team_members.team_role). */
export const TEAM_ROLE_PERMISSIONS = {
  owner: 'tender.edit',
  officer: 'tender.edit',
  evaluator: 'evaluation.score',
  evaluation_chair: 'evaluation.chair',
  commercial_reviewer: 'evaluation.commercial',
  opening_officer: 'bid.open',
  witness: 'bid.witness',
  legal_reviewer: 'tender.view',
  finance_reviewer: 'tender.view',
  observer: 'tender.view',
  auditor: 'audit.view',
} as const satisfies Record<z.infer<typeof TenderTeamMembersTeamRole>, PermissionCode>;

/** Team roles a tender needs before release (readiness). */
export const REQUIRED_TEAM_ROLES = ['owner', 'evaluation_chair', 'evaluator', 'opening_officer'] as const;

/**
 * Tender fields whose change is MATERIAL: it changes what suppliers respond to or the approved commercial decision,
 * so it bumps `draft_revision` and invalidates the release approval (BR-10, AC-06). Every edit of lots,
 * requirements, pricing, terms, the evaluation plan, the timetable, envelopes and participation conditions is material.
 */
export const MATERIAL_TENDER_FIELDS = [
  'summary',
  'eventType',
  'procedure',
  'participation',
  'currency',
  'acceptedCurrencies',
  'bidValidityDays',
  'estimatedValue',
  'budgetAmount',
  'awardModel',
  'maxLotsPerSupplier',
  'eligibilitySummary',
  'deliveryRequirements',
  'partialBidsAllowed',
  'alternativesAllowed',
  'negotiationPermitted',
  'demonstrationsPermitted',
  'referencesPermitted',
  'bafoPermitted',
  'independentEvaluation',
  'anonymizedEvaluation',
  'submissionRules',
  'lateMaterialRule',
] as const;
export type MaterialTenderField = (typeof MATERIAL_TENDER_FIELDS)[number];

// ---------------------------------------------------------------------------------------------------------
// Reference objects
// ---------------------------------------------------------------------------------------------------------

export const NamedRef = z.object({ id: Id, name: z.string().min(1) });
export type NamedRef = z.infer<typeof NamedRef>;

export const CategoryRef = z.object({ id: Id, code: z.string().min(1), name: z.string().min(1) });
export type CategoryRef = z.infer<typeof CategoryRef>;

export const RequestRef = z.object({ id: Id, reference: Reference, title: z.string().min(1) });
export type RequestRef = z.infer<typeof RequestRef>;

export const ProjectRef = z.object({ id: Id, reference: Reference, title: z.string().min(1) });
export type ProjectRef = z.infer<typeof ProjectRef>;

export const StrategyRef = z.object({ id: Id, title: z.string().min(1), status: ProcurementStrategiesStatus });
export type StrategyRef = z.infer<typeof StrategyRef>;

export const TenderLinkRef = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
});
export type TenderLinkRef = z.infer<typeof TenderLinkRef>;

export const LotRef = z.object({ id: Id, lotNo: z.number().int().min(1), title: z.string().min(1) });
export type LotRef = z.infer<typeof LotRef>;

export const CriterionRef = z.object({ id: Id, code: z.string().min(1), name: z.string().min(1) });
export type CriterionRef = z.infer<typeof CriterionRef>;

/** The policy profile version applicable to the event (BR-09; frozen at release). */
export const PolicyVersionRef = z.object({
  id: Id,
  profileName: z.string().min(1),
  versionNo: z.number().int().min(1),
  minResponseDays: z.number().int().min(0).nullable(),
  questionDeadlineDaysBeforeClose: z.number().int().min(0).nullable(),
  requiresReleaseApproval: z.boolean(),
  frozenAt: Instant.nullable(),
});
export type PolicyVersionRef = z.infer<typeof PolicyVersionRef>;

/** Where the tender came from (creation provenance). */
export const TenderProvenance = z.object({
  source: TenderCreationSource,
  sourceId: Id.nullable(),
  label: z.string().min(1),
});
export type TenderProvenance = z.infer<typeof TenderProvenance>;

// ---------------------------------------------------------------------------------------------------------
// Register (BUY-07)
// ---------------------------------------------------------------------------------------------------------

export const ReadinessCounts = z.object({
  blocking: z.number().int().min(0),
  warnings: z.number().int().min(0),
  passed: z.number().int().min(0),
});
export type ReadinessCounts = z.infer<typeof ReadinessCounts>;

/** One register row. Pre-release rows carry their readiness counts. */
export const TenderRow = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  eventType: TendersEventType,
  procedure: TendersProcedure,
  participation: TendersParticipation,
  status: TendersStatus,
  owner: PersonRef,
  category: CategoryRef.nullable(),
  department: NamedRef.nullable(),
  estimatedValue: Money.nullable(),
  lotCount: z.number().int().min(0),
  submissionDeadline: OfficialDeadline.nullable(),
  scheduledReleaseAt: Instant.nullable(),
  releasedAt: Instant.nullable(),
  sourceRequest: RequestRef.nullable(),
  linkedFrom: TenderLinkRef.nullable(),
  linkType: TendersLinkType.nullable(),
  stageNo: z.number().int().min(1),
  releaseApprovalStatus: ApprovalRequestsStatus.nullable(),
  readiness: ReadinessCounts.nullable(),
  updatedAt: Instant,
});
export type TenderRow = z.infer<typeof TenderRow>;

export const TENDER_SORT_FIELDS = [
  'reference',
  'title',
  'status',
  'submissionDeadline',
  'estimatedValue',
  'updatedAt',
] as const;

export const TenderListQuery = listQueryWithSort(TENDER_SORT_FIELDS).extend({
  status: queryList(TendersStatus).optional(),
  phase: TenderPhase.optional(),
  eventType: queryList(TendersEventType).optional(),
  procedure: queryList(TendersProcedure).optional(),
  participation: queryList(TendersParticipation).optional(),
  ownerUserId: IdParam.optional(),
  categoryId: IdParam.optional(),
  departmentId: IdParam.optional(),
  sourceRequestId: IdParam.optional(),
  /** Submission deadline on or after this date (official time zone). */
  deadlineFrom: CalendarDate.optional(),
  /** Submission deadline on or before this date (official time zone). */
  deadlineTo: CalendarDate.optional(),
  /** Only tenders where the caller is on the team. */
  mine: QueryBoolean.optional(),
});
export type TenderListQuery = z.input<typeof TenderListQuery>;

export const StatusCount = z.object({ status: TendersStatus, count: z.number().int().min(0) });
export type StatusCount = z.infer<typeof StatusCount>;

export const TenderPage = pageOf(TenderRow).extend({
  /** Visible tenders per status, before the status/phase filter (KPI row). */
  statusCounts: z.array(StatusCount),
});
export type TenderPage = z.infer<typeof TenderPage>;

// ---------------------------------------------------------------------------------------------------------
// Creation sources and creation (BUY-07)
// ---------------------------------------------------------------------------------------------------------

export const TemplateSource = z.object({
  templateId: Id,
  name: z.string().min(1),
  procedure: TendersProcedure.nullable(),
  category: CategoryRef.nullable(),
  versionNo: z.number().int().min(1),
  status: TemplatesStatus,
  effectiveFrom: CalendarDate.nullable(),
  reviewDate: CalendarDate.nullable(),
  sourceTenderId: Id,
  sections: z.array(TenderCopySection),
  usable: z.boolean(),
  unusableReason: z.string().nullable(),
});
export type TemplateSource = z.infer<typeof TemplateSource>;

export const PriorEventSource = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
  eventType: TendersEventType,
  procedure: TendersProcedure,
  releasedAt: Instant.nullable(),
  copyableSections: z.array(TenderCopySection),
});
export type PriorEventSource = z.infer<typeof PriorEventSource>;

export const RequestSource = z.object({
  requestId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: z.string().min(1),
  estimatedValue: Money.nullable(),
  category: CategoryRef.nullable(),
  usable: z.boolean(),
  unusableReason: z.string().nullable(),
});
export type RequestSource = z.infer<typeof RequestSource>;

export const StrategySource = z.object({
  strategyId: Id,
  title: z.string().min(1),
  request: RequestRef.nullable(),
  eventType: TendersEventType,
  procedure: TendersProcedure,
  status: ProcurementStrategiesStatus,
  usable: z.boolean(),
  unusableReason: z.string().nullable(),
});
export type StrategySource = z.infer<typeof StrategySource>;

export const CreationSourcesQuery = z.object({
  q: z.string().trim().max(200, issue('QUERY_TOO_LONG', 'At most 200 characters.')).optional(),
  kind: TenderCreationSource.optional(),
});
export type CreationSourcesQuery = z.input<typeof CreationSourcesQuery>;

export const CreationSources = z.object({
  templates: z.array(TemplateSource),
  priorEvents: z.array(PriorEventSource),
  requests: z.array(RequestSource),
  strategies: z.array(StrategySource),
  /** Procedures the organization's policy permits for new events. */
  permittedProcedures: z.array(TendersProcedureWrite),
  neverCopied: z.array(TenderNeverCopied),
  /** The organization's default currency for new events; null when none is configured (the buyer then chooses). */
  defaultCurrency: CurrencyCode.nullable(),
  /** The currencies a new event's estimate may use (the default first). */
  currencies: z.array(CurrencyCode),
});
export type CreationSources = z.infer<typeof CreationSources>;

const Title = z
  .string({ error: issue('TITLE_REQUIRED', 'A title is required.') })
  .trim()
  .min(3, issue('TITLE_TOO_SHORT', 'At least 3 characters.'))
  .max(300, issue('TEXT_TOO_LONG', 'At most 300 characters.'));

const LongText = (max: number) => z.string().trim().max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));

const CreateCommon = z.object({
  ownerUserId: Id.optional(),
  departmentId: Id.optional(),
  categoryId: Id.optional(),
});

export const CreateTenderBody = z.discriminatedUnion(
  'source',
  [
    CreateCommon.extend({
      source: z.literal('blank'),
      title: Title,
      eventType: TendersEventType,
      procedure: TendersProcedureWrite,
      participation: TendersParticipation,
      legalEntityId: Id.optional(),
      estimatedValue: NonNegativeMoney.optional(),
    }),
    CreateCommon.extend({ source: z.literal('template'), templateId: Id, title: Title }),
    CreateCommon.extend({
      source: z.literal('prior_event'),
      priorTenderId: Id,
      title: Title,
      sections: z
        .array(TenderCopySection)
        .min(1, issue('SECTIONS_REQUIRED', 'Choose at least one section to copy.')),
    }),
    CreateCommon.extend({ source: z.literal('request'), requestId: Id, title: Title.optional() }),
    CreateCommon.extend({ source: z.literal('strategy'), strategyId: Id, title: Title.optional() }),
  ],
  { error: issue('SOURCE_REQUIRED', 'Choose how to create the tender.') },
);
export type CreateTenderBody = z.infer<typeof CreateTenderBody>;

export const CreatedTender = z.object({
  tender: TenderRow,
  provenance: TenderProvenance,
  copiedSections: z.array(TenderCopySection),
  /** Content deliberately not copied into the new competition (FR-07). */
  notCopied: z.array(TenderNeverCopied),
  /** Copied sections the owner must review before release. */
  reviewRequired: z.array(TenderSection),
  link: LinkPath,
});
export type CreatedTender = z.infer<typeof CreatedTender>;

export const SaveAsTemplateBody = z.object({
  name: Title,
  audience: TemplatesAudience.default('buyer_internal'),
  sections: z.array(TenderCopySection).min(1, issue('SECTIONS_REQUIRED', 'Choose at least one section.')),
  changeNote: ReasonText,
});
export type SaveAsTemplateBody = z.input<typeof SaveAsTemplateBody>;

export const SavedTemplate = z.object({
  templateId: Id,
  name: z.string().min(1),
  kind: z.literal('tender_package'),
  status: TemplatesStatus,
  versionNo: z.number().int().min(1),
  audience: TemplatesAudience,
  sourceTenderId: Id,
  sections: z.array(TenderCopySection),
  notCopied: z.array(TenderNeverCopied),
  /** A new template takes effect only after template approval (org.templates.approve). */
  approvalRequired: z.boolean(),
});
export type SavedTemplate = z.infer<typeof SavedTemplate>;

export const LinkTenderBody = z.object({
  linkedFromTenderId: Id,
  linkType: TendersLinkType,
});
export type LinkTenderBody = z.infer<typeof LinkTenderBody>;

export const TenderLinkState = z.object({
  tenderId: Id,
  linkedFrom: TenderLinkRef,
  linkType: TendersLinkType,
  stageNo: z.number().int().min(1),
});
export type TenderLinkState = z.infer<typeof TenderLinkState>;

// ---------------------------------------------------------------------------------------------------------
// Change impact (BR-10, AC-06)
// ---------------------------------------------------------------------------------------------------------

/** The release approval of the package (`approval_requests` with subject `tender_release`). */
export const ReleaseApprovalState = z.object({
  approvalId: Id,
  status: ApprovalRequestsStatus,
  /** The draft revision the approval covers. */
  subjectVersion: z.number().int().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  requestedBy: PersonRef,
  requestedAt: Instant,
  decidedBy: PersonRef.nullable(),
  decidedAt: Instant.nullable(),
  invalidatedAt: Instant.nullable(),
  invalidationReason: z.string().nullable(),
  /** Whether the approval covers the tender's current draft revision. */
  coversCurrentRevision: z.boolean(),
});
export type ReleaseApprovalState = z.infer<typeof ReleaseApprovalState>;

/** What a command did to the package's revision and approvals. */
export const ChangeImpact = z.object({
  material: z.boolean(),
  draftRevision: z.number().int().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  tenderStatus: TendersStatus,
  /** The release approval this change invalidated, if any (BR-10). */
  invalidatedApproval: ReleaseApprovalState.nullable(),
  /** Release checks that must be reviewed again for the new revision. */
  releaseChecksReset: z.array(ReleaseChecksCheckArea),
});
export type ChangeImpact = z.infer<typeof ChangeImpact>;

/** A recorded material change (BUY-13 change log, AC-06). */
export const MaterialChange = z.object({
  id: Id,
  changedAt: Instant,
  changedBy: PersonRef,
  section: TenderSection,
  summary: z.string().min(1),
  fromValue: z.string().nullable(),
  toValue: z.string().nullable(),
  /** The draft revision the change produced. */
  draftRevision: z.number().int().min(1),
  invalidatedApprovalId: Id.nullable(),
});
export type MaterialChange = z.infer<typeof MaterialChange>;

// ---------------------------------------------------------------------------------------------------------
// Overview and team (BUY-08)
// ---------------------------------------------------------------------------------------------------------

export const LotSummary = z.object({
  id: Id,
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
  stage: LotsStage,
  owner: PersonRef.nullable(),
  estimatedValue: Money.nullable(),
  submissionDeadline: OfficialDeadline.nullable(),
});
export type LotSummary = z.infer<typeof LotSummary>;

export const MilestoneSummary = z.object({
  milestone: TenderMilestonesMilestone,
  lot: LotRef.nullable(),
  deadline: OfficialDeadline,
  isDisclosed: z.boolean(),
});
export type MilestoneSummary = z.infer<typeof MilestoneSummary>;

export const TenderVersion = z.object({
  versionNo: z.number().int().min(1),
  issuedAt: Instant,
  issuedBy: PersonRef,
  changeSummary: z.string().min(1),
  addendumId: Id.nullable(),
});
export type TenderVersion = z.infer<typeof TenderVersion>;

export const TeamSummary = z.object({
  memberCount: z.number().int().min(0),
  evaluators: z.array(PersonRef),
  evaluationChair: PersonRef.nullable(),
  missingRoles: z.array(TenderTeamMembersTeamRole),
});
export type TeamSummary = z.infer<typeof TeamSummary>;

export const OutstandingDecision = z.object({
  id: z.string().min(1),
  section: TenderSection,
  severity: IssueSeverity,
  title: z.string().min(1),
  detail: z.string().nullable(),
  owner: PersonRef.nullable(),
  dueAt: Instant.nullable(),
  link: LinkPath.nullable(),
});
export type OutstandingDecision = z.infer<typeof OutstandingDecision>;

export const Editability = z.object({
  editable: z.boolean(),
  /** An edit now invalidates a pending or approved release approval. */
  editInvalidatesApproval: z.boolean(),
  lockedReason: TenderLockReason.nullable(),
});
export type Editability = z.infer<typeof Editability>;

export const PublicationGate = z.object({
  canRequestReleaseApproval: z.boolean(),
  /** Publication stays blocked while required approvals or material information are incomplete (FR-07). */
  publicationBlocked: z.boolean(),
  blockedReasons: z.array(z.string().min(1)),
});
export type PublicationGate = z.infer<typeof PublicationGate>;

export const TenderDetail = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  summary: z.string().nullable(),
  eventType: TendersEventType,
  procedure: TendersProcedure,
  participation: TendersParticipation,
  status: TendersStatus,
  owner: PersonRef,
  legalEntity: NamedRef.nullable(),
  category: CategoryRef.nullable(),
  department: NamedRef.nullable(),
  project: ProjectRef.nullable(),
  sourceRequest: RequestRef.nullable(),
  strategy: StrategyRef.nullable(),
  policyProfileVersion: PolicyVersionRef.nullable(),
  calendar: NamedRef.nullable(),
  officialTimeZone: TimeZone,
  currency: CurrencyCode,
  acceptedCurrencies: z.array(CurrencyCode),
  acceptedLanguages: z.array(z.string().min(2)),
  bidValidityDays: z.number().int().min(1).nullable(),
  estimatedValue: Money.nullable(),
  budgetAmount: Money.nullable(),
  awardModel: TendersAwardModel,
  maxLotsPerSupplier: z.number().int().min(1).nullable(),
  eligibilitySummary: z.string().nullable(),
  deliveryRequirements: z.string().nullable(),
  partialBidsAllowed: z.boolean(),
  alternativesAllowed: z.boolean(),
  negotiationPermitted: z.boolean(),
  demonstrationsPermitted: z.boolean(),
  referencesPermitted: z.boolean(),
  bafoPermitted: z.boolean(),
  openingMode: TendersOpeningMode,
  independentEvaluation: z.boolean(),
  anonymizedEvaluation: z.boolean(),
  anonymizationLimitations: z.string().nullable(),
  submissionRules: z.string().nullable(),
  lateMaterialRule: z.string().nullable(),
  communicationChannelNote: z.string().nullable(),
  draftRevision: z.number().int().min(1),
  currentVersionNo: z.number().int().min(0),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  scheduledReleaseAt: Instant.nullable(),
  releasedAt: Instant.nullable(),
  closedAt: Instant.nullable(),
  cancelledAt: Instant.nullable(),
  cancellationReason: z.string().nullable(),
  linkedFrom: TenderLinkRef.nullable(),
  linkType: TendersLinkType.nullable(),
  stageNo: z.number().int().min(1),
  linkedTo: z.array(TenderLinkRef.extend({ linkType: TendersLinkType })),
  provenance: TenderProvenance,
  lots: z.array(LotSummary),
  keyDates: z.array(MilestoneSummary),
  versions: z.array(TenderVersion),
  team: TeamSummary,
  releaseApproval: ReleaseApprovalState.nullable(),
  readiness: ReadinessCounts,
  gate: PublicationGate,
  outstandingDecisions: z.array(OutstandingDecision),
  editability: Editability,
  createdBy: PersonRef.nullable(),
  createdAt: Instant,
  updatedAt: Instant,
  /** The organization's additional business fields of the tender form (ADM-07); absent when none are recorded. */
  customFields: CustomFieldValues.optional(),
});
export type TenderDetail = z.infer<typeof TenderDetail>;

const OptionalText = (max: number) => LongText(max).nullable().optional();

export const UpdateTenderBody = z
  .object({
    /** Optimistic concurrency: the draft revision the edit was made against. */
    expectedDraftRevision: z.number().int().min(1),
    title: Title.optional(),
    summary: OptionalText(4000),
    eventType: TendersEventType.optional(),
    procedure: TendersProcedureWrite.optional(),
    participation: TendersParticipation.optional(),
    legalEntityId: Id.nullable().optional(),
    categoryId: Id.nullable().optional(),
    departmentId: Id.nullable().optional(),
    currency: CurrencyCode.optional(),
    acceptedCurrencies: z.array(CurrencyCode).min(1, issue('CURRENCY_REQUIRED', 'Accept at least one currency.')).optional(),
    acceptedLanguages: z
      .array(z.string().trim().min(2).max(10))
      .min(1, issue('LANGUAGE_REQUIRED', 'Accept at least one language.'))
      .optional(),
    bidValidityDays: z.number().int().min(1, issue('INVALID_VALIDITY', 'At least 1 day.')).max(730).nullable().optional(),
    estimatedValue: NonNegativeMoney.nullable().optional(),
    budgetAmount: NonNegativeMoney.nullable().optional(),
    awardModel: TendersAwardModel.optional(),
    maxLotsPerSupplier: z.number().int().min(1).nullable().optional(),
    eligibilitySummary: OptionalText(4000),
    deliveryRequirements: OptionalText(4000),
    partialBidsAllowed: z.boolean().optional(),
    alternativesAllowed: z.boolean().optional(),
    negotiationPermitted: z.boolean().optional(),
    demonstrationsPermitted: z.boolean().optional(),
    referencesPermitted: z.boolean().optional(),
    bafoPermitted: z.boolean().optional(),
    independentEvaluation: z.boolean().optional(),
    anonymizedEvaluation: z.boolean().optional(),
    anonymizationLimitations: OptionalText(2000),
    submissionRules: OptionalText(4000),
    lateMaterialRule: OptionalText(2000),
    communicationChannelNote: OptionalText(2000),
    /**
     * Values of the organization's additional business fields (ADM-07). A save rejects values of the wrong type
     * (`customFields.<key>`); required fields are checked when release approval is requested (`RELEASE_NOT_READY`).
     */
    customFields: CustomFieldValues.optional(),
  })
  .superRefine((body, ctx) => {
    const { expectedDraftRevision: _revision, ...fields } = body;
    if (Object.values(fields).every((value) => value === undefined)) {
      ctx.addIssue({ code: 'custom', path: [], message: issue('NO_CHANGES', 'Change at least one field.') });
    }
    if (body.currency !== undefined && body.acceptedCurrencies !== undefined && !body.acceptedCurrencies.includes(body.currency)) {
      ctx.addIssue({
        code: 'custom',
        path: ['acceptedCurrencies'],
        message: issue('CURRENCY_NOT_ACCEPTED', 'The tender currency must be one of the accepted currencies.'),
      });
    }
    for (const key of ['estimatedValue', 'budgetAmount'] as const) {
      const money = body[key];
      if (body.currency !== undefined && money !== undefined && money !== null && money.currency !== body.currency) {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'currency'],
          message: issue('CURRENCY_MISMATCH', 'Use the tender currency.'),
        });
      }
    }
    if (body.anonymizedEvaluation === true && (body.anonymizationLimitations ?? '').trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['anonymizationLimitations'],
        message: issue('LIMITATIONS_REQUIRED', 'Describe the limits of anonymized evaluation.'),
      });
    }
    if (body.eventType === 'rfi' && body.procedure !== undefined && body.procedure !== 'rfi') {
      ctx.addIssue({
        code: 'custom',
        path: ['procedure'],
        message: issue('EVENT_TYPE_PROCEDURE_MISMATCH', 'A request for information uses the RFI procedure.'),
      });
    }
  });
export type UpdateTenderBody = z.infer<typeof UpdateTenderBody>;

export const TenderUpdateResult = z.object({ tender: TenderDetail, change: ChangeImpact });
export type TenderUpdateResult = z.infer<typeof TenderUpdateResult>;

export const TeamMember = z.object({
  id: Id,
  user: PersonRef,
  capacity: z.string().nullable(),
  teamRole: TenderTeamMembersTeamRole,
  lot: LotRef.nullable(),
  assignedBy: PersonRef.nullable(),
  assignedAt: Instant,
  removedAt: Instant.nullable(),
  removalReason: z.string().nullable(),
  /** A declared conflict is awaiting review (DD-25): restricted access stays blocked. */
  conflictReviewPending: z.boolean(),
});
export type TeamMember = z.infer<typeof TeamMember>;

export const RoleCoverage = z.object({ teamRole: TenderTeamMembersTeamRole, satisfied: z.boolean(), required: z.boolean() });
export type RoleCoverage = z.infer<typeof RoleCoverage>;

export const TenderTeam = z.object({
  tenderId: Id,
  members: z.array(TeamMember),
  removed: z.array(TeamMember),
  coverage: z.array(RoleCoverage),
  issues: z.array(TenderIssue),
});
export type TenderTeam = z.infer<typeof TenderTeam>;

export const TeamCandidatesQuery = z.object({ teamRole: TenderTeamMembersTeamRole });
export type TeamCandidatesQuery = z.input<typeof TeamCandidatesQuery>;

export const TeamCandidate = z.object({
  user: PersonRef,
  capacity: z.string().nullable(),
  eligible: z.boolean(),
  ineligibleReason: z.string().nullable(),
  alreadyAssigned: z.boolean(),
});
export type TeamCandidate = z.infer<typeof TeamCandidate>;

export const TeamCandidates = z.object({
  teamRole: TenderTeamMembersTeamRole,
  requiredPermission: z.string().min(1),
  candidates: z.array(TeamCandidate),
});
export type TeamCandidates = z.infer<typeof TeamCandidates>;

export const AssignTeamMemberBody = z.object({
  userId: Id,
  teamRole: TenderTeamMembersTeamRole,
  lotId: Id.nullable().optional(),
});
export type AssignTeamMemberBody = z.infer<typeof AssignTeamMemberBody>;

export const RemoveTeamMemberBody = z.object({ reason: ReasonText });
export type RemoveTeamMemberBody = z.infer<typeof RemoveTeamMemberBody>;

export const TeamChangeResult = z.object({
  member: TeamMember,
  /** Set when the change replaced the accountable owner (BR-01). */
  newOwner: PersonRef.nullable(),
});
export type TeamChangeResult = z.infer<typeof TeamChangeResult>;

// ---------------------------------------------------------------------------------------------------------
// Readiness (BUY-08, BUY-13)
// ---------------------------------------------------------------------------------------------------------

export const ReadinessItem = z.object({
  id: z.string().min(1),
  section: TenderSection,
  code: TenderIssueCode.nullable(),
  status: ReadinessStatus,
  title: z.string().min(1),
  detail: z.string().nullable(),
  link: LinkPath.nullable(),
});
export type ReadinessItem = z.infer<typeof ReadinessItem>;

export const TenderReadiness = z.object({
  tenderId: Id,
  draftRevision: z.number().int().min(1),
  items: z.array(ReadinessItem),
  summary: ReadinessCounts,
  gate: PublicationGate,
});
export type TenderReadiness = z.infer<typeof TenderReadiness>;

// ---------------------------------------------------------------------------------------------------------
// Lots and requirements (BUY-09)
// ---------------------------------------------------------------------------------------------------------

export const Lot = z.object({
  id: Id,
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  quantityDescription: z.string().nullable(),
  estimatedValue: Money.nullable(),
  deliveryLocation: z.string().nullable(),
  deliveryDate: CalendarDate.nullable(),
  submissionDeadline: OfficialDeadline.nullable(),
  owner: PersonRef.nullable(),
  stage: LotsStage,
  outcomeReason: z.string().nullable(),
  requirementCount: z.number().int().min(0),
  pricingScheduleCount: z.number().int().min(0),
  issues: z.array(TenderIssue),
});
export type Lot = z.infer<typeof Lot>;

export const TenderLots = z.object({
  tenderId: Id,
  awardModel: TendersAwardModel,
  maxLotsPerSupplier: z.number().int().min(1).nullable(),
  partialBidsAllowed: z.boolean(),
  officialTimeZone: TimeZone,
  currency: CurrencyCode,
  lots: z.array(Lot),
});
export type TenderLots = z.infer<typeof TenderLots>;

const LotFields = {
  title: Title,
  description: OptionalText(4000),
  quantityDescription: OptionalText(1000),
  estimatedValue: NonNegativeMoney.nullable().optional(),
  deliveryLocation: OptionalText(500),
  deliveryDate: CalendarDate.nullable().optional(),
  submissionDeadline: Instant.nullable().optional(),
  ownerUserId: Id.nullable().optional(),
};

export const CreateLotBody = z.object(LotFields);
export type CreateLotBody = z.infer<typeof CreateLotBody>;

export const UpdateLotBody = z
  .object({ ...LotFields, title: Title.optional() })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: issue('NO_CHANGES', 'Change at least one field.'),
  });
export type UpdateLotBody = z.infer<typeof UpdateLotBody>;

export const LotMutationResult = z.object({ lot: Lot, change: ChangeImpact });
export type LotMutationResult = z.infer<typeof LotMutationResult>;

export const Requirement = z.object({
  id: Id,
  lot: LotRef.nullable(),
  section: z.string().min(1),
  refCode: z.string().min(1),
  text: z.string().min(1),
  owner: PersonRef.nullable(),
  applicability: z.string().nullable(),
  responseType: RequirementsResponseType,
  choices: z.array(z.string().min(1)),
  responseInstructions: z.string().nullable(),
  evidenceRequired: z.string().nullable(),
  treatment: RequirementsTreatment,
  envelope: RequirementsEnvelope,
  missingConsequence: RequirementsMissingConsequence,
  criterion: CriterionRef.nullable(),
  sortOrder: z.number().int().min(0),
  issues: z.array(TenderIssue),
});
export type Requirement = z.infer<typeof Requirement>;

export const REQUIREMENT_SORT_FIELDS = ['sortOrder', 'refCode', 'section', 'treatment'] as const;
export const REQUIREMENT_ISSUE_FILTERS = ['any', 'missing_owner', 'contradiction'] as const;

export const RequirementListQuery = listQueryWithSort(REQUIREMENT_SORT_FIELDS).extend({
  lotId: IdParam.optional(),
  /** Only requirements that apply to the whole tender (no lot). */
  tenderLevel: QueryBoolean.optional(),
  section: z.string().trim().max(200).optional(),
  treatment: queryList(RequirementsTreatment).optional(),
  envelope: queryList(RequirementsEnvelope).optional(),
  ownerUserId: IdParam.optional(),
  issue: z.enum(REQUIREMENT_ISSUE_FILTERS).optional(),
});
export type RequirementListQuery = z.input<typeof RequirementListQuery>;

export const RequirementSummary = z.object({
  total: z.number().int().min(0),
  mandatoryGates: z.number().int().min(0),
  rated: z.number().int().min(0),
  informationOnly: z.number().int().min(0),
  missingOwner: z.number().int().min(0),
  contradictions: z.number().int().min(0),
});
export type RequirementSummary = z.infer<typeof RequirementSummary>;

export const RequirementPage = pageOf(Requirement).extend({
  /** Counts over every requirement of the tender, before filters. */
  summary: RequirementSummary,
  sections: z.array(z.string().min(1)),
  envelopes: z.array(TenderEnvelopesEnvelope),
});
export type RequirementPage = z.infer<typeof RequirementPage>;

const RequirementFields = {
  lotId: Id.nullable().optional(),
  section: z.string().trim().min(1, issue('SECTION_REQUIRED', 'A section is required.')).max(200),
  refCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9-]{0,39}$/, issue('INVALID_REF_CODE', 'Use capitals, digits and hyphens, such as REQ-T-04.')),
  text: z.string().trim().min(3, issue('TEXT_REQUIRED', 'Describe the requirement.')).max(4000),
  ownerUserId: Id.nullable().optional(),
  applicability: OptionalText(1000),
  responseType: RequirementsResponseType,
  choices: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  responseInstructions: OptionalText(4000),
  evidenceRequired: OptionalText(2000),
  treatment: RequirementsTreatment,
  envelope: RequirementsEnvelope,
  missingConsequence: RequirementsMissingConsequence,
  criterionId: Id.nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
};

function checkChoices(body: { responseType?: string | undefined; choices?: string[] | undefined }, ctx: z.RefinementCtx): void {
  if (body.responseType === 'choice' && (body.choices === undefined || body.choices.length < 2)) {
    ctx.addIssue({ code: 'custom', path: ['choices'], message: issue('CHOICES_REQUIRED', 'List at least two choices.') });
  }
  if (body.responseType !== undefined && body.responseType !== 'choice' && body.choices !== undefined && body.choices.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['choices'],
      message: issue('CHOICES_NOT_ALLOWED', 'Only a choice response lists choices.'),
    });
  }
}

export const CreateRequirementBody = z.object(RequirementFields).superRefine(checkChoices);
export type CreateRequirementBody = z.infer<typeof CreateRequirementBody>;

export const UpdateRequirementBody = z
  .object({
    ...RequirementFields,
    section: RequirementFields.section.optional(),
    refCode: RequirementFields.refCode.optional(),
    text: RequirementFields.text.optional(),
    responseType: RequirementsResponseType.optional(),
    treatment: RequirementsTreatment.optional(),
    envelope: RequirementsEnvelope.optional(),
    missingConsequence: RequirementsMissingConsequence.optional(),
  })
  .superRefine((body, ctx) => {
    if (Object.values(body).every((value) => value === undefined)) {
      ctx.addIssue({ code: 'custom', path: [], message: issue('NO_CHANGES', 'Change at least one field.') });
    }
    checkChoices(body, ctx);
  });
export type UpdateRequirementBody = z.infer<typeof UpdateRequirementBody>;

export const RequirementMutationResult = z.object({ requirement: Requirement, change: ChangeImpact });
export type RequirementMutationResult = z.infer<typeof RequirementMutationResult>;

export const RemovalResult = z.object({ removedId: Id, change: ChangeImpact });
export type RemovalResult = z.infer<typeof RemovalResult>;

// ---------------------------------------------------------------------------------------------------------
// Pricing and commercial terms (BUY-10)
// ---------------------------------------------------------------------------------------------------------

/**
 * Discount types a buyer can accept on a pricing schedule (PRD §7.4, §9.3). An empty list means no discounts are
 * accepted. `conditional` and `package` discounts only enter comparison for award combinations that meet their
 * conditions (PRD §9.3); `discountEvaluationNote` states how accepted discounts enter comparison.
 */
export const DISCOUNT_TYPES = ['unconditional', 'conditional', 'package'] as const;
export const DiscountType = z.enum(DISCOUNT_TYPES);
export type DiscountType = z.infer<typeof DiscountType>;

/**
 * The answers a supplier may give per pricing line, each with its own meaning (PRD §7.4): `priced` (a positive
 * price), `zero` (a price of 0.00 that is offered and evaluated as zero), `included` (the cost is carried in another
 * line of the offer) and `not_offered` (the supplier does not offer the item). They map to
 * `bid_prices.price_status` (priced/included/not_offered; a zero price is `priced` with a unit price of 0).
 * `priced` is always accepted.
 */
export const PRICE_ENTRY_TYPES = ['priced', 'zero', 'included', 'not_offered'] as const;
export const PriceEntryType = z.enum(PRICE_ENTRY_TYPES);
export type PriceEntryType = z.infer<typeof PriceEntryType>;

/** The entry types a new schedule accepts unless the buyer says otherwise. */
export const DEFAULT_PRICE_ENTRIES = ['priced', 'included', 'not_offered'] as const satisfies readonly PriceEntryType[];

export const PricingItem = z.object({
  id: Id,
  itemCode: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1),
  quantity: NonNegativeDecimalString,
  chargeType: PricingItemsChargeType,
  recurrence: PricingItemsRecurrence.nullable(),
  isOptional: z.boolean(),
  isProvisional: z.boolean(),
  includeInEvaluation: z.boolean(),
  sortOrder: z.number().int().min(0),
});
export type PricingItem = z.infer<typeof PricingItem>;

export const PricingSchedule = z.object({
  id: Id,
  lot: LotRef.nullable(),
  name: z.string().min(1),
  instructions: z.string().nullable(),
  taxTreatment: z.string().nullable(),
  evaluationPeriods: z.number().int().min(1).nullable(),
  /** Discount types accepted on this schedule; empty when no discounts are accepted. */
  discountsAccepted: z.array(DiscountType),
  /** How accepted discounts enter comparison (null when none are accepted, or not yet stated). */
  discountEvaluationNote: z.string().nullable(),
  /** The price entries suppliers may use on this schedule; always contains `priced`. */
  priceEntries: z.array(PriceEntryType).min(1),
  items: z.array(PricingItem),
  issues: z.array(TenderIssue),
});
export type PricingSchedule = z.infer<typeof PricingSchedule>;

export const TenderTerm = z.object({
  id: Id,
  termType: TenderTermsTermType,
  content: z.string().min(1),
  document: z.object({ documentId: Id, title: z.string().min(1) }).nullable(),
  updatedAt: Instant,
});
export type TenderTerm = z.infer<typeof TenderTerm>;

export const AFFORDABILITY_STATUSES = ['within_budget', 'exceeds_budget', 'not_assessed'] as const;
export const AffordabilityStatus = z.enum(AFFORDABILITY_STATUSES);

export const Affordability = z.object({
  estimatedValue: Money.nullable(),
  budgetAmount: Money.nullable(),
  headroom: Money.nullable(),
  status: AffordabilityStatus,
  lots: z.array(z.object({ lot: LotRef, estimatedValue: Money.nullable() })),
  assumptions: z.string().nullable(),
});
export type Affordability = z.infer<typeof Affordability>;

export const TenderPricing = z.object({
  tenderId: Id,
  currency: CurrencyCode,
  acceptedCurrencies: z.array(CurrencyCode),
  bidValidityDays: z.number().int().min(1).nullable(),
  alternativesAllowed: z.boolean(),
  schedules: z.array(PricingSchedule),
  terms: z.array(TenderTerm),
  affordability: Affordability,
  issues: z.array(TenderIssue),
});
export type TenderPricing = z.infer<typeof TenderPricing>;

const ScheduleFields = {
  lotId: Id.nullable().optional(),
  name: z.string().trim().min(2, issue('NAME_REQUIRED', 'A schedule name is required.')).max(200),
  instructions: OptionalText(4000),
  taxTreatment: OptionalText(1000),
  evaluationPeriods: z.number().int().min(1, issue('INVALID_PERIODS', 'At least one period.')).max(120).nullable().optional(),
  discountsAccepted: z.array(DiscountType).optional(),
  discountEvaluationNote: OptionalText(2000),
  priceEntries: z.array(PriceEntryType).optional(),
};

function checkDiscountsAndEntries(
  body: {
    discountsAccepted?: readonly DiscountType[] | undefined;
    discountEvaluationNote?: string | null | undefined;
    priceEntries?: readonly PriceEntryType[] | undefined;
  },
  ctx: z.RefinementCtx,
  partial: boolean,
): void {
  const discounts = body.discountsAccepted;
  if (discounts !== undefined && new Set(discounts).size !== discounts.length) {
    ctx.addIssue({ code: 'custom', path: ['discountsAccepted'], message: issue('DUPLICATE_DISCOUNT_TYPE', 'List each discount type once.') });
  }
  if (discounts !== undefined && discounts.length > 0) {
    const note = body.discountEvaluationNote;
    // A partial update may keep the stored note; a create or an explicit blank note must state the basis.
    const missing = note === undefined ? !partial : note === null || note.trim() === '';
    if (missing) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountEvaluationNote'],
        message: issue('DISCOUNT_BASIS_REQUIRED', 'State how accepted discounts enter comparison.'),
      });
    }
  }
  const entries = body.priceEntries;
  if (entries !== undefined) {
    if (!entries.includes('priced')) {
      ctx.addIssue({ code: 'custom', path: ['priceEntries'], message: issue('PRICED_ENTRY_REQUIRED', 'Suppliers must always be able to enter a price.') });
    }
    if (new Set(entries).size !== entries.length) {
      ctx.addIssue({ code: 'custom', path: ['priceEntries'], message: issue('DUPLICATE_PRICE_ENTRY', 'List each price entry once.') });
    }
  }
}

export const CreatePricingScheduleBody = z.object(ScheduleFields).superRefine((body, ctx) => checkDiscountsAndEntries(body, ctx, false));
export type CreatePricingScheduleBody = z.infer<typeof CreatePricingScheduleBody>;

export const UpdatePricingScheduleBody = z
  .object({ ...ScheduleFields, name: ScheduleFields.name.optional() })
  .superRefine((body, ctx) => {
    if (Object.values(body).every((value) => value === undefined)) {
      ctx.addIssue({ code: 'custom', path: [], message: issue('NO_CHANGES', 'Change at least one field.') });
    }
    checkDiscountsAndEntries(body, ctx, true);
  });
export type UpdatePricingScheduleBody = z.infer<typeof UpdatePricingScheduleBody>;

export const PricingScheduleMutationResult = z.object({ schedule: PricingSchedule, change: ChangeImpact });
export type PricingScheduleMutationResult = z.infer<typeof PricingScheduleMutationResult>;

const ItemFields = {
  itemCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9.-]{0,19}$/, issue('INVALID_ITEM_CODE', 'Use capitals, digits, dots and hyphens.')),
  description: z.string().trim().min(2, issue('DESCRIPTION_REQUIRED', 'Describe the item.')).max(1000),
  unit: z.string().trim().min(1, issue('UNIT_REQUIRED', 'A unit is required.')).max(40),
  quantity: NonNegativeDecimalString,
  chargeType: PricingItemsChargeType,
  recurrence: PricingItemsRecurrence.nullable().optional(),
  isOptional: z.boolean().default(false),
  isProvisional: z.boolean().default(false),
  includeInEvaluation: z.boolean().default(true),
  sortOrder: z.number().int().min(0).optional(),
};

function checkRecurrence(
  body: { chargeType?: string | undefined; recurrence?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (body.chargeType === 'recurring' && (body.recurrence === undefined || body.recurrence === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['recurrence'],
      message: issue('RECURRENCE_REQUIRED', 'A recurring charge needs its recurrence.'),
    });
  }
  if (body.chargeType === 'one_time' && body.recurrence !== undefined && body.recurrence !== null) {
    ctx.addIssue({
      code: 'custom',
      path: ['recurrence'],
      message: issue('RECURRENCE_NOT_ALLOWED', 'A one-time charge has no recurrence.'),
    });
  }
}

export const CreatePricingItemBody = z.object(ItemFields).superRefine(checkRecurrence);
export type CreatePricingItemBody = z.input<typeof CreatePricingItemBody>;

export const UpdatePricingItemBody = z
  .object({
    itemCode: ItemFields.itemCode.optional(),
    description: ItemFields.description.optional(),
    unit: ItemFields.unit.optional(),
    quantity: NonNegativeDecimalString.optional(),
    chargeType: PricingItemsChargeType.optional(),
    recurrence: PricingItemsRecurrence.nullable().optional(),
    isOptional: z.boolean().optional(),
    isProvisional: z.boolean().optional(),
    includeInEvaluation: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .superRefine((body, ctx) => {
    if (Object.values(body).every((value) => value === undefined)) {
      ctx.addIssue({ code: 'custom', path: [], message: issue('NO_CHANGES', 'Change at least one field.') });
    }
    checkRecurrence(body, ctx);
  });
export type UpdatePricingItemBody = z.infer<typeof UpdatePricingItemBody>;

export const PricingItemMutationResult = z.object({ scheduleId: Id, item: PricingItem, change: ChangeImpact });
export type PricingItemMutationResult = z.infer<typeof PricingItemMutationResult>;

export const UpsertTermBody = z.object({
  content: z.string().trim().min(3, issue('CONTENT_REQUIRED', 'Write the term.')).max(20000),
  documentId: Id.nullable().optional(),
});
export type UpsertTermBody = z.infer<typeof UpsertTermBody>;

export const TermMutationResult = z.object({ term: TenderTerm, change: ChangeImpact });
export type TermMutationResult = z.infer<typeof TermMutationResult>;

// ---------------------------------------------------------------------------------------------------------
// Evaluation plan (BUY-11, PRD §9)
// ---------------------------------------------------------------------------------------------------------

export const EvaluationCriterion = z.object({
  id: Id,
  parentId: Id.nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  maxPoints: Score,
  isPrice: z.boolean(),
  minScore: Score.nullable(),
  scoringGuidance: z.string().nullable(),
  envelope: EvaluationCriteriaEnvelope,
  naPermitted: z.boolean(),
  sortOrder: z.number().int().min(0),
  linkedRequirementCount: z.number().int().min(0),
});
export type EvaluationCriterion = z.infer<typeof EvaluationCriterion>;

export const ScaleAnchor = z.object({
  value: z.number().int().min(0),
  label: z.string().min(1),
  description: z.string().nullable(),
});
export type ScaleAnchor = z.infer<typeof ScaleAnchor>;

export const TieBreakRule = z.object({
  sequence: z.number().int().min(1),
  rule: TieBreakRulesRule,
  criterion: CriterionRef.nullable(),
});
export type TieBreakRule = z.infer<typeof TieBreakRule>;

export const PlanAmendment = z.object({
  version: z.number().int().min(1),
  amendedAt: Instant,
  amendedBy: PersonRef,
  note: z.string().min(1),
});
export type PlanAmendment = z.infer<typeof PlanAmendment>;

export const EvaluationPlan = z.object({
  id: Id,
  lot: LotRef.nullable(),
  status: EvaluationPlansStatus,
  version: z.number().int().min(1),
  scaleMax: z.number().int().min(1),
  aggregationMethod: EvaluationPlansAggregationMethod,
  priceMethod: EvaluationPlansPriceMethod,
  priceWeight: Score.nullable(),
  priceFormulaNote: z.string().nullable(),
  zeroPriceTreatment: z.string().nullable(),
  missingPriceTreatment: z.string().nullable(),
  thresholdScope: EvaluationPlansThresholdScope,
  nonPriceThreshold: Score.nullable(),
  decimalPlacesCalc: z.number().int().min(0).max(10),
  decimalPlacesDisplay: z.number().int().min(0).max(10),
  comparisonCurrency: CurrencyCode.nullable(),
  fxSource: z.string().nullable(),
  fxDate: CalendarDate.nullable(),
  approvedAt: Instant.nullable(),
  approvedBy: PersonRef.nullable(),
  approvalRequestId: Id.nullable(),
  criteria: z.array(EvaluationCriterion),
  anchors: z.array(ScaleAnchor),
  tieBreakRules: z.array(TieBreakRule),
  /** Sum of top-level criteria points (must be 100, PRD §9.1). */
  weightsTotal: Score,
  amendments: z.array(PlanAmendment),
  issues: z.array(TenderIssue),
});
export type EvaluationPlan = z.infer<typeof EvaluationPlan>;

export const TenderEvaluationPlans = z.object({
  tenderId: Id,
  currency: CurrencyCode,
  plans: z.array(EvaluationPlan),
  /** Rated requirements that no criterion assesses. */
  ratedRequirementsWithoutCriterion: z.number().int().min(0),
  /** Mandatory gates are assessed separately from scored criteria (PRD §9.1). */
  mandatoryGateCount: z.number().int().min(0),
});
export type TenderEvaluationPlans = z.infer<typeof TenderEvaluationPlans>;

export const PlanParams = z.object({ tenderId: IdParam, planId: IdParam });

const CriterionInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9.-]{0,19}$/, issue('INVALID_CRITERION_CODE', 'Use capitals, digits, dots and hyphens.')),
  parentCode: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(2, issue('NAME_REQUIRED', 'Name the criterion.')).max(200),
  description: OptionalText(4000),
  maxPoints: NonNegativeDecimalString,
  isPrice: z.boolean().default(false),
  minScore: NonNegativeDecimalString.nullable().optional(),
  scoringGuidance: OptionalText(4000),
  envelope: EvaluationCriteriaEnvelope,
  naPermitted: z.boolean().default(false),
});
export type CriterionInput = z.input<typeof CriterionInput>;

const AnchorInput = z.object({
  value: z.number().int().min(0),
  label: z.string().trim().min(1, issue('LABEL_REQUIRED', 'Label the anchor.')).max(100),
  description: OptionalText(1000),
});

const TieRuleInput = z.object({
  sequence: z.number().int().min(1),
  rule: TieBreakRulesRule,
  criterionCode: z.string().trim().min(1).nullable().optional(),
});

export const UpdateEvaluationPlanBody = z
  .object({
    expectedVersion: z.number().int().min(1),
    scaleMax: z.number().int().min(1).max(100),
    aggregationMethod: EvaluationPlansAggregationMethod,
    priceMethod: EvaluationPlansPriceMethod,
    priceWeight: NonNegativeDecimalString.nullable().optional(),
    priceFormulaNote: OptionalText(2000),
    zeroPriceTreatment: OptionalText(1000),
    missingPriceTreatment: OptionalText(1000),
    thresholdScope: EvaluationPlansThresholdScope,
    nonPriceThreshold: NonNegativeDecimalString.nullable().optional(),
    decimalPlacesCalc: z.number().int().min(0).max(10),
    decimalPlacesDisplay: z.number().int().min(0).max(10),
    comparisonCurrency: CurrencyCode.nullable().optional(),
    fxSource: OptionalText(500),
    fxDate: CalendarDate.nullable().optional(),
    criteria: z.array(CriterionInput).min(1, issue('CRITERIA_REQUIRED', 'Add at least one criterion.')).max(60),
    anchors: z.array(AnchorInput).max(20),
    tieBreakRules: z.array(TieRuleInput).max(10),
    /** Required when the plan was already approved: the amendment is shown explicitly (BUY-11). */
    amendmentNote: OptionalText(2000),
  })
  .superRefine((plan, ctx) => {
    // Arithmetic needs valid decimals; malformed values already carry their own field issue.
    const decimalsValid =
      plan.criteria.every(
        (criterion) =>
          isDecimal(criterion.maxPoints) &&
          (criterion.minScore === undefined || criterion.minScore === null || isDecimal(criterion.minScore)),
      ) &&
      (plan.priceWeight === undefined || plan.priceWeight === null || isDecimal(plan.priceWeight));
    if (!decimalsValid) return;
    const codes = plan.criteria.map((criterion) => criterion.code);
    plan.criteria.forEach((criterion, index) => {
      if (codes.indexOf(criterion.code) !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['criteria', index, 'code'],
          message: issue('CRITERION_CODE_DUPLICATE', `Criterion code ${criterion.code} is used twice.`),
        });
      }
      if (criterion.parentCode !== undefined && criterion.parentCode !== null && !codes.includes(criterion.parentCode)) {
        ctx.addIssue({
          code: 'custom',
          path: ['criteria', index, 'parentCode'],
          message: issue('PARENT_NOT_FOUND', 'The parent criterion is not in the plan.'),
        });
      }
      if (criterion.minScore !== undefined && criterion.minScore !== null && gt(criterion.minScore, criterion.maxPoints)) {
        ctx.addIssue({
          code: 'custom',
          path: ['criteria', index, 'minScore'],
          message: issue('MIN_SCORE_ABOVE_MAX', 'The minimum score cannot exceed the maximum points.'),
        });
      }
    });
    const topLevel = plan.criteria.filter((criterion) => criterion.parentCode === undefined || criterion.parentCode === null);
    const total = sum(topLevel.map((criterion) => criterion.maxPoints));
    if (!eq(total, '100')) {
      ctx.addIssue({
        code: 'custom',
        path: ['criteria'],
        message: issue('WEIGHTS_TOTAL_NOT_100', `Weights total ${total}; the top-level criteria must total 100.`),
      });
    }
    const priceCriteria = plan.criteria.filter((criterion) => criterion.isPrice === true);
    if (plan.priceMethod === 'none') {
      if (priceCriteria.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['priceMethod'],
          message: issue('PRICE_METHOD_REQUIRED', 'A price criterion needs a price method.'),
        });
      }
    } else {
      const priceTotal = sum(priceCriteria.map((criterion) => criterion.maxPoints));
      if (plan.priceWeight === undefined || plan.priceWeight === null || !eq(plan.priceWeight, priceTotal) || priceCriteria.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['priceWeight'],
          message: issue('PRICE_WEIGHT_MISMATCH', 'The price weight must equal the points of the price criteria.'),
        });
      }
      for (const key of ['zeroPriceTreatment', 'missingPriceTreatment'] as const) {
        if ((plan[key] ?? '').trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: issue('PRICE_TREATMENT_REQUIRED', 'Declare this price treatment before release (PRD §9.3).'),
          });
        }
      }
    }
    if (plan.thresholdScope !== 'none' && (plan.nonPriceThreshold === undefined || plan.nonPriceThreshold === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nonPriceThreshold'],
        message: issue('THRESHOLD_REQUIRED', 'Set the threshold for the chosen scope.'),
      });
    }
    if (plan.decimalPlacesDisplay > plan.decimalPlacesCalc) {
      ctx.addIssue({
        code: 'custom',
        path: ['decimalPlacesDisplay'],
        message: issue('DECIMALS_DISPLAY_EXCEEDS_CALC', 'Display decimals cannot exceed calculation decimals.'),
      });
    }
    const anchorValues = plan.anchors.map((anchor) => anchor.value);
    plan.anchors.forEach((anchor, index) => {
      if (anchor.value > plan.scaleMax) {
        ctx.addIssue({
          code: 'custom',
          path: ['anchors', index, 'value'],
          message: issue('ANCHOR_OUT_OF_SCALE', `Anchors run from 0 to ${plan.scaleMax}.`),
        });
      }
      if (anchorValues.indexOf(anchor.value) !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['anchors', index, 'value'],
          message: issue('ANCHOR_DUPLICATE', 'Each scale value has one anchor.'),
        });
      }
    });
    const sequences = plan.tieBreakRules.map((rule) => rule.sequence);
    plan.tieBreakRules.forEach((rule, index) => {
      if (sequences.indexOf(rule.sequence) !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['tieBreakRules', index, 'sequence'],
          message: issue('TIE_RULE_SEQUENCE_DUPLICATE', 'Each tie rule has its own position.'),
        });
      }
      const needsCriterion = rule.rule === 'highest_criterion';
      const hasCriterion = rule.criterionCode !== undefined && rule.criterionCode !== null;
      if (needsCriterion && (!hasCriterion || !codes.includes(rule.criterionCode ?? ''))) {
        ctx.addIssue({
          code: 'custom',
          path: ['tieBreakRules', index, 'criterionCode'],
          message: issue('TIE_RULE_CRITERION_REQUIRED', 'Name the criterion this tie rule compares.'),
        });
      }
    });
  });
export type UpdateEvaluationPlanBody = z.input<typeof UpdateEvaluationPlanBody>;

export const EvaluationPlanMutationResult = z.object({ plan: EvaluationPlan, change: ChangeImpact });
export type EvaluationPlanMutationResult = z.infer<typeof EvaluationPlanMutationResult>;

export const ApproveEvaluationPlanBody = z.object({
  expectedVersion: z.number().int().min(1),
  note: OptionalText(2000),
});
export type ApproveEvaluationPlanBody = z.infer<typeof ApproveEvaluationPlanBody>;

// ---------------------------------------------------------------------------------------------------------
// Timetable, envelopes and participation conditions (BUY-12)
// ---------------------------------------------------------------------------------------------------------

export const WorkingDayHint = z.object({
  /** The date of the instant in the official time zone. */
  localDate: CalendarDate,
  isWorkingDay: z.boolean(),
  reason: NonWorkingReason.nullable(),
  holidayName: z.string().nullable(),
  /** The next working day in the tender's calendar, when this date is not one. */
  nextWorkingDate: CalendarDate.nullable(),
});
export type WorkingDayHint = z.infer<typeof WorkingDayHint>;

export const Milestone = z.object({
  id: Id,
  milestone: TenderMilestonesMilestone,
  lot: LotRef.nullable(),
  deadline: OfficialDeadline,
  isDisclosed: z.boolean(),
  note: z.string().nullable(),
  workingDay: WorkingDayHint,
});
export type Milestone = z.infer<typeof Milestone>;

export const Envelope = z.object({
  envelope: TenderEnvelopesEnvelope,
  openOrder: z.number().int().min(1),
  requirementCount: z.number().int().min(0),
});
export type Envelope = z.infer<typeof Envelope>;

export const ParticipationCondition = z.object({
  id: Id,
  conditionType: ParticipationConditionsConditionType,
  description: z.string().min(1),
  qualificationProgram: NamedRef.nullable(),
  sessionId: Id.nullable(),
  blocking: z.boolean(),
});
export type ParticipationCondition = z.infer<typeof ParticipationCondition>;

export const ResponsePeriod = z.object({
  releaseAt: Instant.nullable(),
  submissionDeadline: OfficialDeadline.nullable(),
  calendarDays: z.number().int().min(0).nullable(),
  workingDays: z.number().int().min(0).nullable(),
  policyMinimumDays: z.number().int().min(0).nullable(),
});
export type ResponsePeriod = z.infer<typeof ResponsePeriod>;

export const Holiday = z.object({ date: CalendarDate, name: z.string().min(1) });
export type Holiday = z.infer<typeof Holiday>;

export const TenderTimetable = z.object({
  tenderId: Id,
  officialTimeZone: TimeZone,
  calendar: NamedRef.nullable(),
  /** Holidays of the tender's calendar in the timetable window (working-day hints, BR-12). */
  holidays: z.array(Holiday),
  scheduledReleaseAt: Instant.nullable(),
  openingMode: TendersOpeningMode,
  milestones: z.array(Milestone),
  envelopes: z.array(Envelope),
  participationConditions: z.array(ParticipationCondition),
  /** Qualification programs of the organization a `qualification_required` condition may name. */
  qualificationPrograms: z.array(NamedRef),
  responsePeriod: ResponsePeriod,
  policy: PolicyVersionRef.nullable(),
  submissionRules: z.string().nullable(),
  lateMaterialRule: z.string().nullable(),
  issues: z.array(TenderIssue),
});
export type TenderTimetable = z.infer<typeof TenderTimetable>;

const MilestoneInput = z.object({
  milestone: TenderMilestonesMilestone,
  lotId: Id.nullable().optional(),
  at: Instant,
  isDisclosed: z.boolean().default(true),
  note: OptionalText(1000),
});
export type MilestoneInput = z.input<typeof MilestoneInput>;

/** The order in which milestones occur (BUY-12): the editor lists its options in this order. */
export const MILESTONE_SEQUENCE = [
  'briefing',
  'site_visit',
  'questions_deadline',
  'clarification_deadline',
  'submission_deadline',
  'opening',
  'expected_award',
  'standstill_end',
  'contract_start',
] as const satisfies readonly TenderMilestonesMilestone[];

/**
 * What each milestone must strictly follow when both exist in the same scope (BUY-12, "a coherent schedule"). The
 * questions deadline closes supplier questions; the clarification deadline is the last day the buyer issues answers
 * and addenda, so it falls between the questions deadline and the submission deadline. Briefings and site visits
 * precede the submission deadline; a briefing after the questions deadline is only a warning (`timetableIssues`).
 * After closing come the opening, the expected award, the end of the standstill period and the contract start.
 * Every milestone also follows the planned release of the package.
 */
export const MILESTONE_PREDECESSORS: Readonly<Record<TenderMilestonesMilestone, readonly TenderMilestonesMilestone[]>> = {
  briefing: [],
  site_visit: [],
  questions_deadline: [],
  clarification_deadline: ['questions_deadline'],
  submission_deadline: ['briefing', 'site_visit', 'questions_deadline', 'clarification_deadline'],
  opening: ['submission_deadline'],
  expected_award: ['submission_deadline', 'opening'],
  standstill_end: ['submission_deadline', 'opening', 'expected_award'],
  contract_start: ['submission_deadline', 'opening', 'expected_award', 'standstill_end'],
};

/** How contract messages name a milestone ("The opening must fall after the submission deadline."). */
export const MILESTONE_NAMES: Readonly<Record<TenderMilestonesMilestone | 'release', string>> = {
  release: 'planned release',
  briefing: 'briefing',
  site_visit: 'site visit',
  questions_deadline: 'questions deadline',
  clarification_deadline: 'clarification deadline',
  submission_deadline: 'submission deadline',
  opening: 'opening',
  expected_award: 'expected award',
  standstill_end: 'end of the standstill period',
  contract_start: 'contract start',
};

export interface OrderedMilestone {
  readonly milestone: TenderMilestonesMilestone;
  readonly lotId: number | null;
  readonly at: string;
}

export interface MilestoneOrderViolation {
  /** Index of the out-of-order row in the input. */
  readonly index: number;
  readonly milestone: TenderMilestonesMilestone;
  readonly predecessor: TenderMilestonesMilestone | 'release';
  readonly message: string;
}

/**
 * Rows that do not fall strictly after every milestone they must follow (`MILESTONE_PREDECESSORS`) or after the
 * release. A lot's timetable is the tender's dates with the lot's own dates in their place, so a lot date is checked
 * against the tender dates it does not override. One violation per row, naming its latest predecessor. `lotName`
 * names a lot in messages ("Lot 2"); without it a lot is "its lot".
 */
export function milestoneOrderViolations(
  rows: readonly OrderedMilestone[],
  releaseAt: string | null,
  lotName: (lotId: number) => string = () => 'its lot',
): MilestoneOrderViolation[] {
  const violations: MilestoneOrderViolation[] = [];
  const reported = new Set<number>();
  const scopes = [null, ...new Set(rows.flatMap((row) => (row.lotId === null ? [] : [row.lotId])))];
  for (const scope of scopes) {
    const effective = new Map<TenderMilestonesMilestone, { row: OrderedMilestone; index: number }>();
    rows.forEach((row, index) => {
      if (row.lotId === null && !effective.has(row.milestone)) effective.set(row.milestone, { row, index });
    });
    if (scope !== null) {
      rows.forEach((row, index) => {
        if (row.lotId === scope) effective.set(row.milestone, { row, index });
      });
    }
    for (const { row, index } of effective.values()) {
      if (reported.has(index)) continue;
      let latest: { name: TenderMilestonesMilestone | 'release'; at: string; lotId: number | null } | null =
        releaseAt === null ? null : { name: 'release', at: releaseAt, lotId: null };
      for (const name of MILESTONE_PREDECESSORS[row.milestone]) {
        const before = effective.get(name);
        if (before !== undefined && (latest === null || Date.parse(before.row.at) > Date.parse(latest.at))) {
          latest = { name, at: before.row.at, lotId: before.row.lotId };
        }
      }
      if (latest === null || Date.parse(row.at) > Date.parse(latest.at)) continue;
      // Two tender-level dates were already compared in the tender scope.
      if (scope !== null && row.lotId === null && latest.lotId === null) continue;
      reported.add(index);
      const own = row.lotId === null ? '' : ` for ${lotName(row.lotId)}`;
      const other = latest.lotId === null || latest.lotId === row.lotId ? '' : ` for ${lotName(latest.lotId)}`;
      violations.push({
        index,
        milestone: row.milestone,
        predecessor: latest.name,
        message: `The ${MILESTONE_NAMES[row.milestone]}${own} must fall after the ${MILESTONE_NAMES[latest.name]}${other}.`,
      });
    }
  }
  return violations;
}

export const UpdateTimetableBody = z
  .object({
    expectedDraftRevision: z.number().int().min(1),
    officialTimeZone: TimeZone.optional(),
    calendarId: Id.nullable().optional(),
    scheduledReleaseAt: Instant.nullable().optional(),
    milestones: z.array(MilestoneInput).max(60),
  })
  .superRefine((body, ctx) => {
    const keys = body.milestones.map((row) => `${row.milestone}:${row.lotId ?? 'tender'}`);
    body.milestones.forEach((row, index) => {
      if (keys.indexOf(`${row.milestone}:${row.lotId ?? 'tender'}`) !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['milestones', index, 'milestone'],
          message: issue('MILESTONE_DUPLICATE', 'Each milestone appears once per lot.'),
        });
      }
    });
    if (!body.milestones.some((row) => row.milestone === 'submission_deadline' && (row.lotId ?? null) === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['milestones'],
        message: issue('SUBMISSION_DEADLINE_REQUIRED', 'Set the tender submission deadline.'),
      });
    }
    const ordered = body.milestones.map((row) => ({ milestone: row.milestone, lotId: row.lotId ?? null, at: row.at }));
    for (const violation of milestoneOrderViolations(ordered, body.scheduledReleaseAt ?? null)) {
      ctx.addIssue({ code: 'custom', path: ['milestones', violation.index, 'at'], message: issue('MILESTONE_ORDER', violation.message) });
    }
  });
export type UpdateTimetableBody = z.input<typeof UpdateTimetableBody>;

export const TimetableMutationResult = z.object({ timetable: TenderTimetable, change: ChangeImpact });
export type TimetableMutationResult = z.infer<typeof TimetableMutationResult>;

export const UpdateEnvelopesBody = z
  .object({
    expectedDraftRevision: z.number().int().min(1),
    openingMode: TendersOpeningMode,
    envelopes: z
      .array(z.object({ envelope: TenderEnvelopesEnvelope, openOrder: z.number().int().min(1).max(3) }))
      .min(1, issue('ENVELOPE_REQUIRED', 'Configure at least one envelope.'))
      .max(3),
  })
  .superRefine((body, ctx) => {
    const names = body.envelopes.map((row) => row.envelope);
    body.envelopes.forEach((row, index) => {
      if (names.indexOf(row.envelope) !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['envelopes', index, 'envelope'],
          message: issue('ENVELOPE_DUPLICATE', 'Each envelope appears once.'),
        });
      }
    });
    if (body.openingMode === 'staged') {
      const orders = new Set(body.envelopes.map((row) => row.openOrder));
      if (body.envelopes.length < 2 || orders.size !== body.envelopes.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['envelopes'],
          message: issue('STAGED_OPENING_ORDER', 'Staged opening needs two or more envelopes, each with its own opening order.'),
        });
      }
    } else if (body.envelopes.some((row) => row.openOrder !== 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['envelopes'],
        message: issue('SINGLE_STAGE_ORDER', 'Single-stage opening opens every envelope together (order 1).'),
      });
    }
  });
export type UpdateEnvelopesBody = z.infer<typeof UpdateEnvelopesBody>;

const ConditionFields = {
  conditionType: ParticipationConditionsConditionType,
  description: z.string().trim().min(3, issue('DESCRIPTION_REQUIRED', 'Describe the condition.')).max(2000),
  qualificationProgramId: Id.nullable().optional(),
  sessionId: Id.nullable().optional(),
  blocking: z.boolean(),
};

function checkCondition(
  body: { conditionType?: string | undefined; qualificationProgramId?: number | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (body.conditionType === 'qualification_required' && (body.qualificationProgramId === undefined || body.qualificationProgramId === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['qualificationProgramId'],
      message: issue('QUALIFICATION_PROGRAM_REQUIRED', 'Name the qualification program suppliers must hold.'),
    });
  }
}

export const CreateConditionBody = z.object(ConditionFields).superRefine(checkCondition);
export type CreateConditionBody = z.infer<typeof CreateConditionBody>;

export const UpdateConditionBody = z
  .object({
    conditionType: ConditionFields.conditionType.optional(),
    description: ConditionFields.description.optional(),
    qualificationProgramId: ConditionFields.qualificationProgramId,
    sessionId: ConditionFields.sessionId,
    blocking: z.boolean().optional(),
  })
  .superRefine((body, ctx) => {
    if (Object.values(body).every((value) => value === undefined)) {
      ctx.addIssue({ code: 'custom', path: [], message: issue('NO_CHANGES', 'Change at least one field.') });
    }
    checkCondition(body, ctx);
  });
export type UpdateConditionBody = z.infer<typeof UpdateConditionBody>;

export const ConditionMutationResult = z.object({ condition: ParticipationCondition, change: ChangeImpact });
export type ConditionMutationResult = z.infer<typeof ConditionMutationResult>;

// ---------------------------------------------------------------------------------------------------------
// Release review (BUY-13)
// ---------------------------------------------------------------------------------------------------------

export const ReleaseCheck = z.object({
  id: Id.nullable(),
  checkArea: ReleaseChecksCheckArea,
  status: ReleaseChecksStatus,
  reviewer: PersonRef.nullable(),
  note: z.string().nullable(),
  /** The draft revision the check was recorded against. */
  draftRevision: z.number().int().min(1),
  checkedAt: Instant.nullable(),
  /** False when a material edit made the recorded check stale. */
  coversCurrentRevision: z.boolean(),
});
export type ReleaseCheck = z.infer<typeof ReleaseCheck>;

export const PackageDocument = z.object({
  documentId: Id,
  title: z.string().min(1),
  fileName: z.string().min(1),
  classification: DocumentsClassification,
  language: z.string().min(2),
  /** Document precedence in the package (1 = highest), `null` when not ranked. */
  precedence: z.number().int().min(1).nullable(),
  versionNo: z.number().int().min(1),
  relatedTo: z.enum(['tender', 'lot', 'tender_term']),
  lot: LotRef.nullable(),
  supplierVisible: z.boolean(),
  publicVisible: z.boolean(),
  updatedAt: Instant,
});
export type PackageDocument = z.infer<typeof PackageDocument>;

export const CorrectionRequest = z.object({
  id: Id,
  section: TenderSection,
  lot: LotRef.nullable(),
  note: z.string().min(1),
  assignee: PersonRef,
  requestedBy: PersonRef,
  requestedAt: Instant,
  status: CorrectionStatus,
  resolvedAt: Instant.nullable(),
});
export type CorrectionRequest = z.infer<typeof CorrectionRequest>;

export const ReleaseReview = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
  draftRevision: z.number().int().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  currentVersionNo: z.number().int().min(0),
  scheduledReleaseAt: Instant.nullable(),
  officialTimeZone: TimeZone,
  acceptedLanguages: z.array(z.string().min(2)),
  checks: z.array(ReleaseCheck),
  readiness: z.array(ReadinessItem),
  summary: ReadinessCounts,
  packageDocuments: z.array(PackageDocument),
  missingLanguageEditions: z.array(z.object({ documentId: Id, title: z.string().min(1), language: z.string().min(2) })),
  releaseApproval: ReleaseApprovalState.nullable(),
  approvalHistory: z.array(ReleaseApprovalState),
  materialChanges: z.array(MaterialChange),
  corrections: z.array(CorrectionRequest),
  gate: PublicationGate,
});
export type ReleaseReview = z.infer<typeof ReleaseReview>;

export const ReleaseCheckParams = z.object({ tenderId: IdParam, checkArea: ReleaseChecksCheckArea });

export const RecordReleaseCheckBody = z
  .object({
    draftRevision: z.number().int().min(1),
    status: ReleaseChecksStatus.exclude(['pending']),
    note: OptionalText(2000),
  })
  .superRefine((body, ctx) => {
    if (body.status !== 'passed' && (body.note ?? '').trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: issue('NOTE_REQUIRED', 'Explain a failed or not-applicable check.'),
      });
    }
  });
export type RecordReleaseCheckBody = z.infer<typeof RecordReleaseCheckBody>;

export const ReleaseCheckResult = z.object({ check: ReleaseCheck, summary: ReadinessCounts, gate: PublicationGate });
export type ReleaseCheckResult = z.infer<typeof ReleaseCheckResult>;

export const PreviewQuery = z.object({ audience: PreviewAudience });
export type PreviewQuery = z.input<typeof PreviewQuery>;

export const PreviewDocument = z.object({
  documentId: Id,
  title: z.string().min(1),
  fileName: z.string().min(1),
  classification: DocumentsClassification,
  language: z.string().min(2),
  precedence: z.number().int().min(1).nullable(),
});

export const PackagePreview = z.object({
  tenderId: Id,
  audience: PreviewAudience,
  draftRevision: z.number().int().min(1),
  /** Whether this audience would see the tender at all once released. */
  visible: z.boolean(),
  hiddenReason: z.enum(['invitation_only', 'restricted_access_required']).nullable(),
  notice: z
    .object({
      reference: Reference,
      title: z.string().min(1),
      summary: z.string().nullable(),
      buyerName: z.string().min(1),
      contractingEntity: z.string().nullable(),
      eventType: TendersEventType,
      procedure: TendersProcedure,
      participation: TendersParticipation,
      category: CategoryRef.nullable(),
      currency: CurrencyCode,
      acceptedCurrencies: z.array(CurrencyCode),
      acceptedLanguages: z.array(z.string().min(2)),
      bidValidityDays: z.number().int().min(1).nullable(),
      awardModel: TendersAwardModel,
      eligibilitySummary: z.string().nullable(),
      deliveryRequirements: z.string().nullable(),
      submissionRules: z.string().nullable(),
      lateMaterialRule: z.string().nullable(),
      communicationChannelNote: z.string().nullable(),
      permitted: z.object({
        partialBids: z.boolean(),
        alternatives: z.boolean(),
        negotiation: z.boolean(),
        demonstrations: z.boolean(),
        references: z.boolean(),
        finalOffers: z.boolean(),
      }),
    })
    .nullable(),
  lots: z.array(
    z.object({
      lotNo: z.number().int().min(1),
      title: z.string().min(1),
      description: z.string().nullable(),
      quantityDescription: z.string().nullable(),
      deliveryLocation: z.string().nullable(),
      deliveryDate: CalendarDate.nullable(),
    }),
  ),
  milestones: z.array(z.object({ milestone: TenderMilestonesMilestone, lotNo: z.number().int().nullable(), deadline: OfficialDeadline })),
  requirements: z.array(
    z.object({
      refCode: z.string().min(1),
      section: z.string().min(1),
      lotNo: z.number().int().nullable(),
      text: z.string().min(1),
      responseType: RequirementsResponseType,
      choices: z.array(z.string()),
      responseInstructions: z.string().nullable(),
      evidenceRequired: z.string().nullable(),
      treatment: RequirementsTreatment,
      envelope: RequirementsEnvelope,
      missingConsequence: RequirementsMissingConsequence,
    }),
  ),
  pricingSchedules: z.array(
    z.object({
      name: z.string().min(1),
      lotNo: z.number().int().nullable(),
      instructions: z.string().nullable(),
      taxTreatment: z.string().nullable(),
      evaluationPeriods: z.number().int().nullable(),
      discountsAccepted: z.array(DiscountType),
      discountEvaluationNote: z.string().nullable(),
      priceEntries: z.array(PriceEntryType),
      items: z.array(PricingItem.omit({ id: true, sortOrder: true })),
    }),
  ),
  evaluation: z
    .object({
      criteria: z.array(z.object({ code: z.string(), name: z.string(), maxPoints: Score, isPrice: z.boolean(), minScore: Score.nullable() })),
      priceMethod: EvaluationPlansPriceMethod,
      priceFormulaNote: z.string().nullable(),
      zeroPriceTreatment: z.string().nullable(),
      missingPriceTreatment: z.string().nullable(),
      thresholdScope: EvaluationPlansThresholdScope,
      nonPriceThreshold: Score.nullable(),
      tieBreakRules: z.array(z.object({ sequence: z.number().int(), rule: TieBreakRulesRule, criterionCode: z.string().nullable() })),
    })
    .nullable(),
  participationConditions: z.array(
    z.object({ conditionType: ParticipationConditionsConditionType, description: z.string(), blocking: z.boolean() }),
  ),
  terms: z.array(z.object({ termType: TenderTermsTermType, content: z.string() })),
  documents: z.array(PreviewDocument),
  /** Buyer-internal content left out of this view (estimates, budget, team, internal documents, undisclosed dates). */
  withheld: z.array(z.string().min(1)),
});
export type PackagePreview = z.infer<typeof PackagePreview>;

export const CreateCorrectionBody = z.object({
  section: TenderSection,
  lotId: Id.nullable().optional(),
  note: ReasonText,
  assigneeUserId: Id,
});
export type CreateCorrectionBody = z.infer<typeof CreateCorrectionBody>;

export const RequestReleaseApprovalBody = z.object({
  draftRevision: z.number().int().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/, issue('INVALID_HASH', 'Must be a SHA-256 hex digest.')),
  justification: ReasonText,
  scheduledReleaseAt: Instant.nullable().optional(),
});
export type RequestReleaseApprovalBody = z.infer<typeof RequestReleaseApprovalBody>;

export const ReleaseApprovalRequested = z.object({
  tenderId: Id,
  tenderStatus: TendersStatus,
  draftRevision: z.number().int().min(1),
  approval: ReleaseApprovalState,
  /** The approval request opens on COM-05 for the approvers. */
  approvalLink: LinkPath,
  /** Readiness, counts and publication gate once the request is recorded (the approval is now pending). */
  readiness: z.array(ReadinessItem),
  summary: ReadinessCounts,
  gate: PublicationGate,
});
export type ReleaseApprovalRequested = z.infer<typeof ReleaseApprovalRequested>;

// ---------------------------------------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------------------------------------

export const TenderParams = z.object({ tenderId: IdParam });
export const LotParams = z.object({ tenderId: IdParam, lotId: IdParam });
export const RequirementParams = z.object({ tenderId: IdParam, requirementId: IdParam });
export const ScheduleParams = z.object({ tenderId: IdParam, scheduleId: IdParam });
export const ItemParams = z.object({ tenderId: IdParam, scheduleId: IdParam, itemId: IdParam });
export const TermParams = z.object({ tenderId: IdParam, termType: TenderTermsTermType });
export const MemberParams = z.object({ tenderId: IdParam, memberId: IdParam });
export const ConditionParams = z.object({ tenderId: IdParam, conditionId: IdParam });
