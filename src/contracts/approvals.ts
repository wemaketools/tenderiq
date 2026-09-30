/**
 * Approvals contract: approval status for a subject, requesting and withdrawing an approval, the decision screen
 * and the authority hint (COM-05, COM-04; BR-06, BR-07, BR-10; DD-14, DD-21, DD-24, DD-25).
 *
 * - An approval targets an exact version: `subjectVersion`, `contentHash`, `amount` and `currency`. A material edit
 *   invalidates it (AC-06); deciding an invalidated or outdated version is refused.
 * - Deciding a step requires `approval.decide` AND the decision-specific permission of the subject type
 *   (`APPROVAL_DECISION_PERMISSIONS`) AND sufficient authority (DD-24). Cross-currency authority uses the
 *   exchange rate at the request date; with no rate the step routes to the next level up, never an assumed pass.
 * - A declared conflict blocks the decision while its disposition is `pending_review`; `recused` and `reassigned`
 *   block permanently (DD-25). Segregation-of-duties rules block self-approval unless documented alternative
 *   oversight applies (BR-07).
 * - `/api/v1/me/approvals` lists the caller's own approval work across all memberships (DD-21); deciding sends
 *   `X-Tenant-Id` equal to the approval's tenant. Buyer screens read the approval panel of a subject under
 *   `/api/v1/buyer/approvals`.
 */
import { z } from 'zod';

import {
  CalendarDate,
  CurrencyCode,
  DecimalString,
  Id,
  IdParam,
  Instant,
  LinkPath,
  Money,
  NonNegativeDecimalString,
  NonNegativeMoney,
  OrganizationLabel,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import type { EndpointPermission } from './endpoint.js';
import {
  ApprovalRequestsRouteMode,
  ApprovalRequestsStatus,
  ApprovalRequestsSubjectType,
  ApprovalStepsStatus,
  AuthorityLimitsDecisionType,
  ConflictDeclarationsDisposition,
  DocumentsClassification,
  SodPoliciesMode,
  SodPoliciesRuleCode,
} from './enums.js';
import type { ApprovalRequestsSubjectType as SubjectType, AuthorityLimitsDecisionType as DecisionType } from './enums.js';
import { PermissionCodeSchema } from './permissions.js';
import type { PermissionCode } from './permissions.js';

// ---------------------------------------------------------------------------------------------------------
// Subject type rules
// ---------------------------------------------------------------------------------------------------------

/** The decision-specific permission a step decider needs besides `approval.decide` (DD-24). */
export const APPROVAL_DECISION_PERMISSIONS = {
  procurement_request: 'request.approve',
  funding: 'request.funding_confirm',
  strategy: 'strategy.approve',
  tender_release: 'tender.release_approve',
  addendum: 'tender.addenda.approve',
  exclusion: 'exclusion.approve',
  shortlist: 'shortlist.approve',
  preferred_bidder: 'shortlist.approve',
  negotiation_mandate: 'negotiation.approve',
  final_offer_round: 'negotiation.approve',
  award: 'award.approve',
  contract: 'contract.approve',
  contract_signature: 'contract.sign',
  contract_change: 'contract.change.approve',
  renewal: 'contract.renewal.decide',
  qualification_decision: 'qualification.decide',
  late_submission_exception: 'exclusion.approve',
  policy_profile: 'org.policy.approve',
  template: 'org.templates.approve',
  disposal: 'records.disposal.approve',
  process_decision: 'tender.cancel',
  hold_release: 'records.hold.manage',
  obligation_waiver: 'contract.change.approve',
  security_release: 'contract.change.approve',
  dispute_decision: 'contract.change.approve',
  contract_difference: 'contract.approve',
  final_award: 'award.approve',
} as const satisfies Record<SubjectType, PermissionCode>;

/** The permission needed to request (and withdraw) an approval of each subject type. */
export const APPROVAL_REQUEST_PERMISSIONS = {
  procurement_request: 'request.create',
  funding: 'request.review',
  strategy: 'strategy.manage',
  tender_release: 'tender.edit',
  addendum: 'tender.clarifications.manage',
  exclusion: 'compliance.assess',
  shortlist: 'selection.manage',
  preferred_bidder: 'selection.manage',
  negotiation_mandate: 'negotiation.conduct',
  final_offer_round: 'selection.manage',
  award: 'award.recommend',
  contract: 'contract.prepare',
  contract_signature: 'contract.prepare',
  contract_change: 'contract.manage',
  renewal: 'contract.manage',
  qualification_decision: 'qualification.review',
  late_submission_exception: 'tender.edit',
  policy_profile: 'org.policy.manage',
  template: 'org.templates.manage',
  disposal: 'records.retention.manage',
  process_decision: 'tender.edit',
  hold_release: 'records.hold.manage',
  obligation_waiver: 'contract.manage',
  security_release: 'contract.manage',
  dispute_decision: 'contract.manage',
  contract_difference: 'contract.prepare',
  final_award: 'award.recommend',
} as const satisfies Record<SubjectType, PermissionCode>;

/**
 * The authority decision type checked against `authority_limits` for each subject type (BR-06). `null`: no
 * value-based authority applies (governance approvals of configuration).
 */
export const APPROVAL_AUTHORITY_DECISION_TYPES = {
  procurement_request: 'request_approval',
  funding: 'funding_confirmation',
  strategy: 'strategy_approval',
  tender_release: 'release_approval',
  addendum: 'release_approval',
  exclusion: 'exclusion_approval',
  shortlist: 'shortlist_approval',
  preferred_bidder: 'preferred_bidder_approval',
  negotiation_mandate: 'negotiation_mandate',
  final_offer_round: 'negotiation_mandate',
  award: 'award_approval',
  contract: 'contract_approval',
  contract_signature: 'contract_signature',
  contract_change: 'change_approval',
  renewal: 'renewal_approval',
  qualification_decision: 'qualification_decision',
  late_submission_exception: 'late_submission_exception',
  policy_profile: null,
  template: null,
  disposal: 'disposal_approval',
  process_decision: null,
  hold_release: null,
  obligation_waiver: 'change_approval',
  security_release: 'change_approval',
  dispute_decision: 'change_approval',
  contract_difference: 'contract_approval',
  final_award: 'award_approval',
} as const satisfies Record<SubjectType, DecisionType | null>;

function uniquePermissions(codes: readonly PermissionCode[]): EndpointPermission {
  const [first, ...rest] = [...new Set(codes)];
  if (first === undefined) {
    throw new Error('An approval permission list cannot be empty.');
  }
  return [first, ...rest];
}

/**
 * Who may READ the approvals of each subject type on the buyer approval endpoints (`getApproval`,
 * `getSubjectApprovals`): the subject type's request permission, its decision permission, the subject's own read
 * permission(s) and `audit.view`. An approval packet carries the subject's content (a justification, the
 * requirement and finding of an exclusion, a contract value), so seeing it needs access to that content: an
 * organization administrator's `org.*` permissions open only the policy and template approvals, never bid,
 * evaluation, award or contract approvals (PRD §4.1 "administration is not content access"; BR-26).
 *
 * The service (and the mock) answers `APPROVAL_NOT_FOUND` (getApproval) or `SUBJECT_NOT_FOUND`
 * (getSubjectApprovals), status 404, when the caller holds none of the permissions listed for the approval's
 * subject type, exactly as for an approval of another tenant, so the response does not reveal that it exists.
 * Use `canViewApprovalSubject`. The approver assigned to a step always reads it on `/api/v1/me/approvals`.
 */
export const APPROVAL_VIEW_PERMISSIONS_BY_SUBJECT = {
  procurement_request: ['request.create', 'request.approve', 'request.view_all', 'request.review', 'audit.view'],
  funding: ['request.review', 'request.funding_confirm', 'request.view_all', 'audit.view'],
  strategy: ['strategy.manage', 'strategy.approve', 'audit.view'],
  tender_release: ['tender.edit', 'tender.release_approve', 'tender.view', 'audit.view'],
  addendum: ['tender.clarifications.manage', 'tender.addenda.approve', 'tender.view', 'audit.view'],
  exclusion: ['compliance.assess', 'exclusion.approve', 'evaluation.chair', 'bid.monitor', 'audit.view'],
  shortlist: ['selection.manage', 'shortlist.approve', 'evaluation.chair', 'audit.view'],
  preferred_bidder: ['selection.manage', 'shortlist.approve', 'evaluation.chair', 'audit.view'],
  negotiation_mandate: ['negotiation.conduct', 'negotiation.approve', 'selection.manage', 'audit.view'],
  final_offer_round: ['selection.manage', 'negotiation.approve', 'negotiation.conduct', 'audit.view'],
  award: ['award.recommend', 'award.approve', 'evaluation.chair', 'audit.view'],
  contract: ['contract.prepare', 'contract.approve', 'contract.view', 'audit.view'],
  contract_signature: ['contract.prepare', 'contract.sign', 'contract.view', 'audit.view'],
  contract_change: ['contract.manage', 'contract.change.approve', 'contract.view', 'audit.view'],
  renewal: ['contract.manage', 'contract.renewal.decide', 'contract.view', 'audit.view'],
  qualification_decision: ['qualification.review', 'qualification.decide', 'audit.view'],
  late_submission_exception: ['tender.edit', 'exclusion.approve', 'bid.monitor', 'audit.view'],
  policy_profile: ['org.policy.manage', 'org.policy.approve', 'audit.view'],
  template: ['org.templates.manage', 'org.templates.approve', 'audit.view'],
  disposal: ['records.retention.manage', 'records.disposal.approve', 'audit.view'],
  process_decision: ['tender.edit', 'tender.cancel', 'tender.view', 'audit.view'],
  hold_release: ['records.hold.manage', 'audit.view'],
  obligation_waiver: ['contract.manage', 'contract.change.approve', 'contract.view', 'audit.view'],
  security_release: ['contract.manage', 'contract.change.approve', 'contract.view', 'audit.view'],
  dispute_decision: ['contract.manage', 'contract.change.approve', 'contract.view', 'audit.view'],
  contract_difference: ['contract.prepare', 'contract.approve', 'contract.view', 'audit.view'],
  final_award: ['award.recommend', 'award.approve', 'evaluation.chair', 'audit.view'],
} as const satisfies Record<SubjectType, readonly [PermissionCode, ...PermissionCode[]]>;

/** True when a caller holding `granted` may read the approvals of a subject type (see the map above). */
export function canViewApprovalSubject(
  subjectType: SubjectType,
  granted: Iterable<string> | ReadonlySet<string>,
): boolean {
  const held = granted instanceof Set ? (granted as ReadonlySet<string>) : new Set(granted);
  const allowed: readonly PermissionCode[] = APPROVAL_VIEW_PERMISSIONS_BY_SUBJECT[subjectType];
  return allowed.some((code) => held.has(code));
}

/** The route-level any-of list of the buyer approval reads: every permission of the per-subject map. */
const APPROVAL_VIEW_PERMISSIONS = uniquePermissions(Object.values(APPROVAL_VIEW_PERMISSIONS_BY_SUBJECT).flat());

const APPROVAL_REQUEST_ANY = uniquePermissions(Object.values(APPROVAL_REQUEST_PERMISSIONS));

// ---------------------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------------------

/** The decisions an approver can record (step statuses `approved`, `approved_with_conditions`, `rejected`, `returned`). */
export const APPROVAL_DECISIONS = ['approve', 'approve_with_conditions', 'reject', 'return'] as const;
export const ApprovalDecision = z.enum(APPROVAL_DECISIONS);
export type ApprovalDecision = z.infer<typeof ApprovalDecision>;

/** Why the caller cannot decide right now (shown on COM-05 next to the disabled decision buttons). */
export const APPROVAL_BLOCKERS = [
  'approval_not_pending',
  'not_current_step',
  'not_assigned_approver',
  'decision_permission_missing',
  'authority_insufficient',
  'exchange_rate_missing',
  'sod_blocked',
  'conflict_declaration_required',
  'conflict_unresolved',
  'version_changed',
  'hold_active',
  /** A gate of the subject is not met yet (for example an open award-blocking due-diligence finding, AC-24). */
  'subject_gate_blocked',
] as const;
export const ApprovalBlocker = z.enum(APPROVAL_BLOCKERS);
export type ApprovalBlocker = z.infer<typeof ApprovalBlocker>;

/** A SHA-256 content hash (hex) of the exact version under approval. */
export const ContentHash = z.string().regex(/^[a-f0-9]{64}$/, issue('INVALID_HASH', 'Must be a SHA-256 hex digest.'));

/** A committee (`committees`). */
export const CommitteeRef = z.object({
  committeeId: Id,
  name: z.string().min(1),
  quorum: z.number().int().min(1).nullable(),
});
export type CommitteeRef = z.infer<typeof CommitteeRef>;

/** A currency conversion used for an authority check (DD-24, BR-29). */
export const AuthorityConversion = z.object({
  rate: DecimalString,
  rateDate: CalendarDate,
  source: z.string().min(1),
  convertedAmount: Money,
});
export type AuthorityConversion = z.infer<typeof AuthorityConversion>;

/** Where a decider's authority comes from. */
export const AUTHORITY_BASES = ['authority_limit', 'delegation', 'unlimited', 'none'] as const;
export const AuthorityBasis = z.enum(AUTHORITY_BASES);
export type AuthorityBasis = z.infer<typeof AuthorityBasis>;

/** The authority check of one decider against one approval (BR-06, DD-24). */
export const AuthorityCheck = z.object({
  decisionType: AuthorityLimitsDecisionType.nullable(),
  amount: Money.nullable(),
  sufficient: z.boolean(),
  basis: AuthorityBasis,
  /** The decider's limit; `null` with basis `unlimited` means unlimited within scope. */
  limit: NonNegativeMoney.nullable(),
  delegatedFrom: PersonRef.nullable(),
  conversion: AuthorityConversion.nullable(),
  /** No exchange rate at the request date: the step routes to the next level up (DD-24). */
  missingExchangeRate: z.boolean(),
  routedToNextLevel: z.boolean(),
});
export type AuthorityCheck = z.infer<typeof AuthorityCheck>;

/** One step of an approval route (`approval_steps`). */
export const ApprovalStep = z.object({
  id: Id,
  sequence: z.number().int().min(1),
  approver: PersonRef.nullable(),
  committee: CommitteeRef.nullable(),
  requiredDecisionType: AuthorityLimitsDecisionType.nullable(),
  status: ApprovalStepsStatus,
  decidedBy: PersonRef.nullable(),
  /** The person on whose behalf a delegate decided (PRD §5.3: both the acting person and the delegated capacity). */
  actingFor: PersonRef.nullable(),
  delegationId: Id.nullable(),
  decisionReason: z.string().nullable(),
  conditions: z.string().nullable(),
  decidedAt: Instant.nullable(),
  authorityCheckedAmount: Money.nullable(),
});
export type ApprovalStep = z.infer<typeof ApprovalStep>;

/** The approval panel row of a subject (`approval_requests`). */
export const ApprovalSummary = z.object({
  id: Id,
  subjectType: ApprovalRequestsSubjectType,
  subjectId: Id,
  subjectReference: z.string().nullable(),
  subjectVersion: z.number().int().min(1),
  contentHash: ContentHash,
  title: z.string().min(1),
  status: ApprovalRequestsStatus,
  amount: Money.nullable(),
  requestedBy: PersonRef,
  requestedAt: Instant,
  dueAt: Instant.nullable(),
  expiresAt: Instant.nullable(),
  decidedAt: Instant.nullable(),
  routeMode: ApprovalRequestsRouteMode,
  /** The step awaiting a decision, when pending. */
  currentStep: ApprovalStep.nullable(),
  isOverdue: z.boolean(),
});
export type ApprovalSummary = z.infer<typeof ApprovalSummary>;

/**
 * A document offered as evidence for the decision, pinned to the exact version captured with the approval snapshot
 * (BR-10; PRD §14.1 "evidence versions used at the time"). A later version of the document never replaces it.
 */
export const ApprovalEvidence = z.object({
  documentId: Id,
  /** The document version decided on (open it in COM-07 with `?version=<versionId>`). */
  versionId: Id,
  title: z.string().min(1),
  classification: DocumentsClassification,
  /** Number of the pinned version. */
  versionNo: z.number().int().min(1),
  /** Number of the document's latest confirmed version today; greater than `versionNo` when it changed since. */
  latestVersionNo: z.number().int().min(1),
  isRedactedCopy: z.boolean(),
});
export type ApprovalEvidence = z.infer<typeof ApprovalEvidence>;

/** The caller's conflict position on the subject (BR-08, DD-25). */
export const ApprovalConflictStatus = z.object({
  declarationRequired: z.boolean(),
  declared: z.boolean(),
  hasConflict: z.boolean().nullable(),
  disposition: ConflictDeclarationsDisposition.nullable(),
  blocksDecision: z.boolean(),
});
export type ApprovalConflictStatus = z.infer<typeof ApprovalConflictStatus>;

/** The segregation-of-duties position of the caller (BR-07). */
export const ApprovalSodStatus = z.object({
  rule: SodPoliciesRuleCode.nullable(),
  mode: SodPoliciesMode.nullable(),
  blocked: z.boolean(),
  alternativeOversightNote: z.string().nullable(),
});
export type ApprovalSodStatus = z.infer<typeof ApprovalSodStatus>;

/** The caller's own step and whether it can be decided now. */
export const MyApprovalStep = z.object({
  stepId: Id,
  sequence: z.number().int().min(1),
  status: ApprovalStepsStatus,
  requiredDecisionType: AuthorityLimitsDecisionType.nullable(),
  actingFor: PersonRef.nullable(),
  canDecide: z.boolean(),
  blockers: z.array(ApprovalBlocker),
});
export type MyApprovalStep = z.infer<typeof MyApprovalStep>;

/** One fact of the exact version under approval (the snapshot the approver decides on, BR-10). */
export const ApprovalSnapshotFact = z.object({
  /** Stable key of the fact, e.g. `estimatedValue`, `scope`. */
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
  /** True when the subject's current version differs from this value (shown on an invalidated approval, AC-06). */
  changedSince: z.boolean(),
});
export type ApprovalSnapshotFact = z.infer<typeof ApprovalSnapshotFact>;

/** The exact version snapshot of the subject captured when the approval was requested. */
export const ApprovalVersionSnapshot = z.object({
  subjectVersion: z.number().int().min(1),
  contentHash: ContentHash,
  capturedAt: Instant,
  facts: z.array(ApprovalSnapshotFact),
});
export type ApprovalVersionSnapshot = z.infer<typeof ApprovalVersionSnapshot>;

/** Why an approval does not start (or no longer sits) with the usual first level: the AC-05 routing hint. */
export const APPROVAL_ROUTING_REASONS = ['authority_exceeded', 'exchange_rate_missing', 'self_approval_blocked', 'conflict_recusal'] as const;
export const ApprovalRoutingReason = z.enum(APPROVAL_ROUTING_REASONS);
export type ApprovalRoutingReason = z.infer<typeof ApprovalRoutingReason>;

/** "Exceeds the authority of X — routed to Y" (AC-05, BR-06). */
export const ApprovalRouting = z.object({
  reason: ApprovalRoutingReason,
  /** The level that could not decide (the usual first approver). */
  skipped: PersonRef.nullable(),
  skippedCapacity: z.string().nullable(),
  skippedLimit: NonNegativeMoney.nullable(),
  /** The approver the step went to instead. */
  routedTo: PersonRef.nullable(),
  routedToCapacity: z.string().nullable(),
  routedToLimit: NonNegativeMoney.nullable(),
  routedAt: Instant,
  note: z.string().nullable(),
});
export type ApprovalRouting = z.infer<typeof ApprovalRouting>;

/** One material change that invalidated an approval (AC-06, BR-10). */
export const ApprovalChange = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  before: z.string().nullable(),
  after: z.string().nullable(),
});
export type ApprovalChange = z.infer<typeof ApprovalChange>;

/** What invalidated the approval and what happens next. */
export const ApprovalInvalidation = z.object({
  changedAt: Instant,
  changedBy: PersonRef.nullable(),
  fromVersion: z.number().int().min(1),
  toVersion: z.number().int().min(1),
  changes: z.array(ApprovalChange),
  /** The approval requested for the changed version, once there is one. */
  replacementApprovalId: Id.nullable(),
});
export type ApprovalInvalidation = z.infer<typeof ApprovalInvalidation>;

/** One unmet gate of the subject under approval; while any is open nobody can decide (BR-10, AC-24). */
export const ApprovalSubjectGate = z.object({
  /** Stable key of the gate, e.g. `diligence`, `negotiation`. */
  code: z.string().min(1),
  detail: z.string().min(1),
});
export type ApprovalSubjectGate = z.infer<typeof ApprovalSubjectGate>;

/** Everything COM-05 shows: exact version, amount, scope, justification, evidence, previous decisions, conflicts, authority. */
export const ApprovalDetail = ApprovalSummary.extend({
  organization: OrganizationLabel,
  summary: z.string().nullable(),
  justification: z.string().nullable(),
  legalEntity: z.object({ legalEntityId: Id, name: z.string().min(1) }).nullable(),
  category: z.object({ categoryId: Id, name: z.string().min(1) }).nullable(),
  subjectLinkPath: LinkPath.nullable(),
  /** The subject's current version; differs from `subjectVersion` after a material edit (AC-06). */
  currentSubjectVersion: z.number().int().min(1).nullable(),
  conditions: z.string().nullable(),
  invalidatedReason: z.string().nullable(),
  invalidatedAt: Instant.nullable(),
  committee: CommitteeRef.nullable(),
  steps: z.array(ApprovalStep),
  evidence: z.array(ApprovalEvidence),
  /** The permission the decider needs besides `approval.decide` (DD-24). */
  decisionPermission: PermissionCodeSchema,
  conflict: ApprovalConflictStatus,
  sod: ApprovalSodStatus,
  authority: AuthorityCheck.nullable(),
  myStep: MyApprovalStep.nullable(),
  allowedDecisions: z.array(ApprovalDecision),
  /** Whether this route allows an approval with conditions (COM-05 "conditionally approve if permitted"). */
  conditionsPermitted: z.boolean().optional(),
  /** The exact version snapshot under approval. */
  versionSnapshot: ApprovalVersionSnapshot.nullable().optional(),
  /** Set when the usual first level could not decide and the step was routed higher (AC-05). */
  routing: ApprovalRouting.nullable().optional(),
  /** Set when a material change invalidated the approval (AC-06). */
  invalidation: ApprovalInvalidation.nullable().optional(),
  /** Earlier approvals of the same subject (previous versions and decisions), newest first. */
  relatedApprovals: z.array(ApprovalSummary).optional(),
  /** Unmet gates of the subject (`subject_gate_blocked`); empty or absent when nothing blocks the decision. */
  subjectGates: z.array(ApprovalSubjectGate).optional(),
});
export type ApprovalDetail = z.infer<typeof ApprovalDetail>;

/** How the caller is involved in an approval listed in the inbox. */
export const APPROVAL_INVOLVEMENTS = ['approver', 'delegate', 'requester'] as const;
export const ApprovalInvolvement = z.enum(APPROVAL_INVOLVEMENTS);
export type ApprovalInvolvement = z.infer<typeof ApprovalInvolvement>;

/** One row of the caller's approval inbox. */
export const MyApprovalItem = ApprovalSummary.extend({
  organization: OrganizationLabel,
  myStep: MyApprovalStep.nullable(),
  involvement: ApprovalInvolvement.optional(),
  subjectLinkPath: LinkPath.nullable().optional(),
});
export type MyApprovalItem = z.infer<typeof MyApprovalItem>;

export const APPROVAL_SORT_FIELDS = ['dueAt', 'requestedAt', 'title', 'status', 'amount'] as const;

export const MyApprovalListQuery = listQueryWithSort(APPROVAL_SORT_FIELDS).extend({
  status: queryList(ApprovalRequestsStatus).optional(),
  subjectType: queryList(ApprovalRequestsSubjectType).optional(),
  tenantId: IdParam.optional(),
  /** Only approvals whose current step is the caller's (directly or by delegation). */
  awaitingMyDecision: QueryBoolean.optional(),
  overdue: QueryBoolean.optional(),
  involvement: queryList(ApprovalInvolvement).optional(),
  requestedFrom: CalendarDate.optional(),
  requestedTo: CalendarDate.optional(),
});
export type MyApprovalListQuery = z.input<typeof MyApprovalListQuery>;

export const MyApprovalPage = pageOf(MyApprovalItem);
export type MyApprovalPage = z.infer<typeof MyApprovalPage>;

export const ApprovalParams = z.object({ approvalId: IdParam });

/** GET /api/v1/me/approvals: approvals the caller decides or requested, across memberships (COM-04). */
export const listMyApprovals = defineEndpoint({
  id: 'me.approvals.list',
  method: 'GET',
  path: '/api/v1/me/approvals',
  audience: 'me',
  query: MyApprovalListQuery,
  response: MyApprovalPage,
  errors: [],
  screens: ['COM-04', 'COM-05'],
});

/** GET /api/v1/me/approvals/:approvalId: the decision screen (COM-05). */
export const getMyApproval = defineEndpoint({
  id: 'me.approvals.get',
  method: 'GET',
  path: '/api/v1/me/approvals/:approvalId',
  audience: 'me',
  params: ApprovalParams,
  response: ApprovalDetail,
  errors: ['APPROVAL_NOT_FOUND'],
  screens: ['COM-05'],
});

export const DecideApprovalBody = z
  .object({
    decision: ApprovalDecision,
    /** The version the approver saw. A mismatch returns APPROVAL_VERSION_MISMATCH (BR-10). */
    subjectVersion: z.number().int().min(1),
    contentHash: ContentHash,
    reason: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
    conditions: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.decision !== 'approve' && (body.reason === undefined || body.reason.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: issue('REASON_REQUIRED', 'Give the reason for this decision.'),
      });
    }
    if (body.decision === 'approve_with_conditions' && (body.conditions === undefined || body.conditions.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: issue('CONDITIONS_REQUIRED', 'State the conditions of the approval.'),
      });
    }
    if (body.decision !== 'approve_with_conditions' && body.conditions !== undefined && body.conditions.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: issue('CONDITIONS_NOT_EXPECTED', 'Conditions apply only to an approval with conditions.'),
      });
    }
  });
export type DecideApprovalBody = z.infer<typeof DecideApprovalBody>;

/** POST /api/v1/me/approvals/:approvalId/decide (X-Tenant-Id = the approval's tenant; DD-24 checks). */
export const decideApproval = defineEndpoint({
  id: 'me.approvals.decide',
  method: 'POST',
  path: '/api/v1/me/approvals/:approvalId/decide',
  audience: 'me',
  rowTenant: true,
  permission: 'approval.decide',
  params: ApprovalParams,
  body: DecideApprovalBody,
  response: ApprovalDetail,
  errors: [
    'APPROVAL_NOT_FOUND',
    'APPROVAL_NOT_PENDING',
    'APPROVAL_INVALIDATED',
    'APPROVAL_EXPIRED',
    'APPROVAL_VERSION_MISMATCH',
    'NOT_ASSIGNED_APPROVER',
    'NOT_CURRENT_STEP',
    'DECISION_PERMISSION_MISSING',
    'AUTHORITY_INSUFFICIENT',
    'EXCHANGE_RATE_MISSING',
    'SOD_SELF_APPROVAL_BLOCKED',
    'CONFLICT_DECLARATION_REQUIRED',
    'CONFLICT_UNRESOLVED',
    'CONDITIONS_NOT_PERMITTED',
    'HOLD_BLOCKS_ACTION',
    'SUBJECT_NOT_READY_FOR_APPROVAL',
  ],
  screens: ['COM-05'],
  summary:
    'Records the caller’s decision on their current step for the exact version shown. Requires approval.decide, the decision-specific permission of the subject type and sufficient authority (DD-24).',
});

export const SubjectApprovalsParams = z.object({
  subjectType: ApprovalRequestsSubjectType,
  subjectId: IdParam,
});

export const SubjectApprovals = z.object({
  subjectType: ApprovalRequestsSubjectType,
  subjectId: Id,
  /** The pending or latest approval of the subject's current version. */
  current: ApprovalSummary.nullable(),
  /** Every approval of the subject, newest first, including invalidated and superseded ones. */
  history: z.array(ApprovalSummary),
  /** Whether the caller may request an approval for the subject now. */
  canRequest: z.boolean(),
});
export type SubjectApprovals = z.infer<typeof SubjectApprovals>;

const SUBJECT_SCREENS = [
  'BUY-04',
  'BUY-06',
  'BUY-13',
  'BUY-17',
  'BUY-21',
  'BUY-23',
  'BUY-24',
  'BUY-25',
  'BUY-26',
  'BUY-29',
  'BUY-35',
  'CON-02',
  'CON-05',
  'CON-08',
  'CON-09',
  'ADM-06',
  'ADM-08',
  'ADM-14',
] as const;

/** GET /api/v1/buyer/approvals/subjects/:subjectType/:subjectId: the approval panel of a record. */
export const getSubjectApprovals = defineEndpoint({
  id: 'buyer.approvals.forSubject',
  method: 'GET',
  path: '/api/v1/buyer/approvals/subjects/:subjectType/:subjectId',
  audience: 'buyer',
  permission: APPROVAL_VIEW_PERMISSIONS,
  params: SubjectApprovalsParams,
  response: SubjectApprovals,
  errors: ['SUBJECT_NOT_FOUND'],
  screens: [...SUBJECT_SCREENS],
  summary:
    'The approval status and history of one subject. A caller holding none of APPROVAL_VIEW_PERMISSIONS_BY_SUBJECT[subjectType] gets 404 SUBJECT_NOT_FOUND; the service also applies the view rules of the subject’s domain.',
});

/** GET /api/v1/buyer/approvals/:approvalId: one approval of the active buyer tenant. */
export const getApproval = defineEndpoint({
  id: 'buyer.approvals.get',
  method: 'GET',
  path: '/api/v1/buyer/approvals/:approvalId',
  audience: 'buyer',
  permission: APPROVAL_VIEW_PERMISSIONS,
  params: ApprovalParams,
  response: ApprovalDetail,
  errors: ['APPROVAL_NOT_FOUND'],
  screens: ['COM-05', ...SUBJECT_SCREENS],
  summary:
    'One approval with its subject snapshot. A caller holding none of APPROVAL_VIEW_PERMISSIONS_BY_SUBJECT for the approval’s subject type gets 404 APPROVAL_NOT_FOUND, as for another tenant’s approval.',
});

export const RequestApprovalBody = z.object({
  subjectType: ApprovalRequestsSubjectType,
  subjectId: Id,
  subjectVersion: z.number().int().min(1),
  contentHash: ContentHash,
  title: z.string().trim().min(1, issue('TITLE_REQUIRED', 'A title is required.')).max(300),
  summary: z.string().trim().max(4000).optional(),
  amount: NonNegativeMoney.optional(),
  legalEntityId: Id.optional(),
  categoryId: Id.optional(),
  justification: ReasonText,
  dueAt: Instant.optional(),
});
export type RequestApprovalBody = z.infer<typeof RequestApprovalBody>;

/** POST /api/v1/buyer/approvals: routes an approval for the exact version (idempotent create). */
export const requestApproval = defineEndpoint({
  id: 'buyer.approvals.request',
  method: 'POST',
  path: '/api/v1/buyer/approvals',
  audience: 'buyer',
  permission: APPROVAL_REQUEST_ANY,
  body: RequestApprovalBody,
  response: ApprovalDetail,
  idempotent: true,
  errors: [
    'SUBJECT_NOT_FOUND',
    'SUBJECT_NOT_READY_FOR_APPROVAL',
    'SUBJECT_VERSION_MISMATCH',
    'APPROVAL_ALREADY_PENDING',
    'REQUEST_PERMISSION_MISSING',
    'NO_ELIGIBLE_APPROVER',
    'CURRENCY_REQUIRED_FOR_AMOUNT',
  ],
  screens: [...SUBJECT_SCREENS],
  summary:
    'Requests approval of one subject version. The caller needs the request permission of the subject type (APPROVAL_REQUEST_PERMISSIONS); the route is computed from authority limits and delegations.',
});

export const WithdrawApprovalBody = z.object({
  reason: ReasonText,
});
export type WithdrawApprovalBody = z.infer<typeof WithdrawApprovalBody>;

/** POST /api/v1/buyer/approvals/:approvalId/withdraw: the requester withdraws a pending approval. */
export const withdrawApproval = defineEndpoint({
  id: 'buyer.approvals.withdraw',
  method: 'POST',
  path: '/api/v1/buyer/approvals/:approvalId/withdraw',
  audience: 'buyer',
  permission: APPROVAL_REQUEST_ANY,
  params: ApprovalParams,
  body: WithdrawApprovalBody,
  response: ApprovalDetail,
  errors: ['APPROVAL_NOT_FOUND', 'APPROVAL_NOT_PENDING', 'NOT_APPROVAL_REQUESTER'],
  screens: [...SUBJECT_SCREENS],
});

export const AuthorityCheckQuery = z.object({
  subjectType: ApprovalRequestsSubjectType,
  amount: NonNegativeDecimalString,
  currency: CurrencyCode,
  legalEntityId: IdParam.optional(),
  categoryId: IdParam.optional(),
});
export type AuthorityCheckQuery = z.input<typeof AuthorityCheckQuery>;

/** A person who could decide the approval, with the authority that lets them. */
export const EligibleApprover = PersonRef.extend({
  capacity: z.string().nullable(),
  check: AuthorityCheck,
});
export type EligibleApprover = z.infer<typeof EligibleApprover>;

export const AuthorityCheckHint = z.object({
  subjectType: ApprovalRequestsSubjectType,
  decisionType: AuthorityLimitsDecisionType.nullable(),
  amount: NonNegativeMoney,
  /** Deciders whose authority covers the amount, lowest sufficient level first. */
  eligibleApprovers: z.array(EligibleApprover),
  /** True when the usual first level lacks the authority and the approval goes up (AC-05). */
  routedToNextLevel: z.boolean(),
  /** The first level that was skipped for lack of authority, if any. */
  skippedLevel: EligibleApprover.nullable(),
});
export type AuthorityCheckHint = z.infer<typeof AuthorityCheckHint>;

/** GET /api/v1/buyer/approval-authority-check: who can approve this amount (hint before requesting, AC-05). */
export const checkAuthority = defineEndpoint({
  id: 'buyer.approvals.authorityCheck',
  method: 'GET',
  path: '/api/v1/buyer/approval-authority-check',
  audience: 'buyer',
  permission: APPROVAL_REQUEST_ANY,
  query: AuthorityCheckQuery,
  response: AuthorityCheckHint,
  errors: ['NO_ELIGIBLE_APPROVER'],
  screens: [...SUBJECT_SCREENS],
  summary:
    'A hint only: the authority check is repeated when the approval is requested and when each step is decided.',
});

/** The approvals endpoint map. */
export const approvalEndpoints = {
  listMyApprovals,
  getMyApproval,
  decideApproval,
  getSubjectApprovals,
  getApproval,
  requestApproval,
  withdrawApproval,
  checkAuthority,
} as const;
