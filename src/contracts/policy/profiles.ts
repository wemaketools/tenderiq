/**
 * Procurement policy profiles and their versions (ADM-06; FR-22, PRD §17.1, BR-09; blueprint Migration 03
 * `policy_profiles`, `policy_profile_versions`, `policy_thresholds`).
 *
 * - A profile is versioned: `draft` → `in_review` → `approved` → `retired` (`in_review` can be returned to `draft`).
 *   An approved version is IMMUTABLE: changing the rules means drafting a new version.
 * - A tender freezes its version at release (`tenders.policy_profile_version_id`), so approving a new version never
 *   changes the rules of an already issued tender (FR-22, BR-09). Each version lists the events that use it.
 * - Approving needs `org.policy.approve`; the person who submitted a version cannot approve it (BR-07) unless
 *   nobody else holds the permission and the organization documented alternative oversight, which is then shown
 *   (`capabilities.alternativeOversightNote`) and recorded with the decision (`SOD_SELF_APPROVAL_BLOCKED`, 403).
 * - Retired versions and profiles stay readable on historic events but cannot be chosen for new work.
 * - `approvalRequestId` links an `approval_requests` row with `subject_type = 'policy_profile'`; it is null until
 *   Stage B creates that row on submission.
 *
 * Stage B storage mapping (blueprint amendment, see the policy domain follow-ups): the contract fields beyond the
 * blueprint columns are `policy_profile_versions.created_by`, `created_at`, `submitted_by`, `submitted_at` and
 * `returned_reason`, plus `policy_profiles.retirement_reason`; the configuration-approval oversight is a
 * `sod_policies` row with rule code `configuration_approval`.
 */
import { z } from 'zod';

import {
  Id,
  IdParam,
  Instant,
  NonNegativeDecimalString,
  CurrencyCode,
  PersonRef,
  ReasonText,
  Reference,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { compare } from '../decimal.js';
import { defineEndpoint } from '../endpoint.js';
import {
  PolicyProfileVersionsLateSubmissionPolicy,
  PolicyProfileVersionsPermittedProceduresWrite,
  PolicyProfileVersionsStandstillDayType,
  PolicyProfileVersionsStatus,
  PolicyProfilesStatus,
  ProcurementStrategiesStatus,
  TendersProcedureWrite,
  TendersStatus,
} from '../enums.js';
import { POLICY_PROFILE_PICK, POLICY_PROFILE_READ } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Rules of a version
// ---------------------------------------------------------------------------------------------------------

/** A value band per procedure within a version (`policy_thresholds`). `maxValue` null = no upper bound. */
export const PolicyThreshold = z.object({
  id: Id,
  procedure: TendersProcedureWrite,
  minValue: NonNegativeDecimalString,
  maxValue: NonNegativeDecimalString.nullable(),
  currency: CurrencyCode,
  requiredApprovalLevel: z.string().min(1),
  requiresPublicNotice: z.boolean(),
});
export type PolicyThreshold = z.infer<typeof PolicyThreshold>;

export const PolicyThresholdInput = PolicyThreshold.omit({ id: true }).extend({
  requiredApprovalLevel: z
    .string()
    .trim()
    .min(1, issue('APPROVAL_LEVEL_REQUIRED', 'Name the approval level for this band.'))
    .max(200),
});
export type PolicyThresholdInput = z.infer<typeof PolicyThresholdInput>;

/** The editable rules of a version (the `policy_profile_versions` rule columns). */
const PolicyRulesShape = z.object({
  permittedProcedures: z
    .array(PolicyProfileVersionsPermittedProceduresWrite)
    .min(1, issue('PERMITTED_PROCEDURES_REQUIRED', 'Permit at least one procedure.')),
  requiresReleaseApproval: z.boolean(),
  stagedOpeningDefault: z.boolean(),
  openingQuorum: z.number().int().min(1, issue('OPENING_QUORUM_INVALID', 'At least one person opens bids.')).max(20),
  openingRequiresSecondPerson: z.boolean(),
  independentEvaluation: z.boolean(),
  negotiationPermitted: z.boolean(),
  bafoPermitted: z.boolean(),
  lateSubmissionPolicy: PolicyProfileVersionsLateSubmissionPolicy,
  questionDeadlineDaysBeforeClose: z.number().int().min(0).max(90),
  minResponseDays: z.number().int().min(1, issue('MIN_RESPONSE_DAYS_INVALID', 'Allow at least one day.')).max(365),
  standstillRequired: z.boolean(),
  standstillLength: z.number().int().min(0).max(90).nullable(),
  standstillDayType: PolicyProfileVersionsStandstillDayType.nullable(),
  complaintWindowDays: z.number().int().min(0).max(90),
  complaintRequiresIndependentReview: z.boolean(),
  publicAwardNoticeRequired: z.boolean(),
  approvalRouteNote: z.string().trim().max(2000).nullable(),
});

type RulesLike = z.infer<typeof PolicyRulesShape> & { thresholds: readonly PolicyThresholdInput[] };

/** Cross-field rules every stored or submitted version satisfies (Stage B enforces the same). */
function checkRules(rules: RulesLike, context: z.RefinementCtx): void {
  if (rules.openingRequiresSecondPerson && rules.openingQuorum < 2) {
    context.addIssue({
      code: 'custom',
      path: ['openingQuorum'],
      message: issue('OPENING_QUORUM_TOO_LOW', 'A second-person opening needs a quorum of at least 2.'),
    });
  }
  if (rules.standstillRequired && (rules.standstillLength === null || rules.standstillLength < 1 || rules.standstillDayType === null)) {
    context.addIssue({
      code: 'custom',
      path: ['standstillLength'],
      message: issue('STANDSTILL_LENGTH_REQUIRED', 'Give the standstill length and day type.'),
    });
  }
  if (rules.bafoPermitted && !rules.negotiationPermitted) {
    context.addIssue({
      code: 'custom',
      path: ['bafoPermitted'],
      message: issue('BAFO_REQUIRES_NEGOTIATION', 'Best-and-final-offer rounds require negotiation to be permitted.'),
    });
  }
  if (new Set(rules.permittedProcedures).size !== rules.permittedProcedures.length) {
    context.addIssue({
      code: 'custom',
      path: ['permittedProcedures'],
      message: issue('DUPLICATE_PROCEDURE', 'Each procedure may appear once.'),
    });
  }
  rules.thresholds.forEach((threshold, index) => {
    if (!rules.permittedProcedures.includes(threshold.procedure)) {
      context.addIssue({
        code: 'custom',
        path: ['thresholds', index, 'procedure'],
        message: issue('THRESHOLD_PROCEDURE_NOT_PERMITTED', 'A threshold can only cover a permitted procedure.'),
      });
    }
    if (threshold.maxValue !== null && compare(threshold.maxValue, threshold.minValue) <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['thresholds', index, 'maxValue'],
        message: issue('THRESHOLD_RANGE_INVALID', 'The upper bound must exceed the lower bound.'),
      });
    }
    rules.thresholds.slice(0, index).forEach((other) => {
      if (other.procedure !== threshold.procedure || other.currency !== threshold.currency) return;
      const startsBeforeOtherEnds = other.maxValue === null || compare(threshold.minValue, other.maxValue) < 0;
      const endsAfterOtherStarts = threshold.maxValue === null || compare(threshold.maxValue, other.minValue) > 0;
      if (startsBeforeOtherEnds && endsAfterOtherStarts) {
        context.addIssue({
          code: 'custom',
          path: ['thresholds', index, 'minValue'],
          message: issue('THRESHOLD_OVERLAP', 'Value bands of the same procedure and currency must not overlap.'),
        });
      }
    });
  });
}

/** The rules as written by a client (draft create/update). */
export const PolicyRulesInput = PolicyRulesShape.extend({
  thresholds: z.array(PolicyThresholdInput).max(40),
}).superRefine(checkRules);
export type PolicyRulesInput = z.infer<typeof PolicyRulesInput>;

// ---------------------------------------------------------------------------------------------------------
// Rows and details
// ---------------------------------------------------------------------------------------------------------

/** A version row inside a profile. */
export const PolicyVersionSummary = z.object({
  id: Id,
  profileId: Id,
  versionNo: z.number().int().min(1),
  status: PolicyProfileVersionsStatus,
  isCurrent: z.boolean(),
  createdBy: PersonRef.nullable(),
  createdAt: Instant,
  submittedBy: PersonRef.nullable(),
  submittedAt: Instant.nullable(),
  approvedBy: PersonRef.nullable(),
  approvedAt: Instant.nullable(),
  effectiveFrom: Instant.nullable(),
  retiredAt: Instant.nullable(),
  /** Tenders that froze this version at release, plus strategies and drafts that propose it. */
  usageCount: z.number().int().min(0),
});
export type PolicyVersionSummary = z.infer<typeof PolicyVersionSummary>;

/** A profile row in the ADM-06 list. */
export const PolicyProfileSummary = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string(),
  status: PolicyProfilesStatus,
  currentVersion: PolicyVersionSummary.nullable(),
  /** The newest version that is still draft or in review, if any. */
  pendingVersion: PolicyVersionSummary.nullable(),
  versionCount: z.number().int().min(1),
  permittedProcedures: z.array(PolicyProfileVersionsPermittedProceduresWrite),
  /** Tenders using any version of the profile. */
  usageCount: z.number().int().min(0),
  createdAt: Instant,
  updatedAt: Instant,
});
export type PolicyProfileSummary = z.infer<typeof PolicyProfileSummary>;

/** What the caller may do with the profile now. */
export const PolicyProfileCapabilities = z.object({
  canDraftVersion: z.boolean(),
  canRetire: z.boolean(),
});

export const PolicyProfileDetail = PolicyProfileSummary.extend({
  versions: z.array(PolicyVersionSummary),
  retiredAt: Instant.nullable(),
  retirementReason: z.string().nullable(),
  capabilities: PolicyProfileCapabilities,
});
export type PolicyProfileDetail = z.infer<typeof PolicyProfileDetail>;

/** A tender that uses a version: frozen at release, or proposed by a tender still in preparation. */
export const PolicyTenderUsage = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
  /** True once the tender was released under this version (BR-09); false while it is only proposed. */
  frozen: z.boolean(),
  releasedAt: Instant.nullable(),
});
export type PolicyTenderUsage = z.infer<typeof PolicyTenderUsage>;

/** A procurement strategy prepared under the version (`procurement_strategies.policy_profile_version_id`). */
export const PolicyStrategyUsage = z.object({
  strategyId: Id,
  requestReference: Reference.nullable(),
  title: z.string().min(1),
  status: ProcurementStrategiesStatus,
});
export type PolicyStrategyUsage = z.infer<typeof PolicyStrategyUsage>;

/** What the caller may do with the version now. */
export const PolicyVersionCapabilities = z.object({
  canEdit: z.boolean(),
  canSubmit: z.boolean(),
  canApprove: z.boolean(),
  canReturn: z.boolean(),
  canRetire: z.boolean(),
  /** Why approval is blocked for this caller (e.g. they submitted it), or null. */
  approvalBlockedReason: z.string().nullable(),
  /**
   * The documented alternative oversight (BR-07) the caller's approval relies on, when the caller submitted the
   * item and nobody else holds the approval permission; null otherwise.
   */
  alternativeOversightNote: z.string().nullable(),
});

export const PolicyVersionDetail = PolicyVersionSummary.extend({
  profileName: z.string().min(1),
  profileStatus: PolicyProfilesStatus,
  rules: PolicyRulesShape.extend({ thresholds: z.array(PolicyThreshold) }),
  /** Link to the approval request of the version (`approval_requests.subject_type = 'policy_profile'`). */
  approvalRequestId: Id.nullable(),
  returnedReason: z.string().nullable(),
  tenders: z.array(PolicyTenderUsage),
  strategies: z.array(PolicyStrategyUsage),
  capabilities: PolicyVersionCapabilities,
});
export type PolicyVersionDetail = z.infer<typeof PolicyVersionDetail>;

/** One rule that differs between two versions. Values are rendered text so any rule type can be shown. */
export const PolicyRuleChange = z.object({
  rule: z.string().min(1),
  before: z.string(),
  after: z.string(),
});
export type PolicyRuleChange = z.infer<typeof PolicyRuleChange>;

export const PolicyVersionComparison = z.object({
  profileId: Id,
  base: PolicyVersionSummary,
  target: PolicyVersionSummary,
  changes: z.array(PolicyRuleChange),
});
export type PolicyVersionComparison = z.infer<typeof PolicyVersionComparison>;

/** An approved version that new work may adopt (tender and strategy forms). */
export const PolicyVersionOption = z.object({
  versionId: Id,
  profileId: Id,
  profileName: z.string().min(1),
  versionNo: z.number().int().min(1),
  effectiveFrom: Instant.nullable(),
  permittedProcedures: z.array(PolicyProfileVersionsPermittedProceduresWrite),
  requiresReleaseApproval: z.boolean(),
  stagedOpeningDefault: z.boolean(),
  minResponseDays: z.number().int(),
});
export type PolicyVersionOption = z.infer<typeof PolicyVersionOption>;

// ---------------------------------------------------------------------------------------------------------
// Queries and bodies
// ---------------------------------------------------------------------------------------------------------

export const POLICY_PROFILE_SORT_FIELDS = ['name', 'status', 'updatedAt', 'usageCount'] as const;

export const PolicyProfileListQuery = listQueryWithSort(POLICY_PROFILE_SORT_FIELDS).extend({
  status: queryList(PolicyProfilesStatus).optional(),
  /** Profiles with at least one version in one of these states. */
  versionStatus: queryList(PolicyProfileVersionsStatus).optional(),
  procedure: queryList(TendersProcedureWrite).optional(),
  /** Profiles changed on or after / before this instant. */
  updatedFrom: Instant.optional(),
  updatedTo: Instant.optional(),
});
export type PolicyProfileListQuery = z.input<typeof PolicyProfileListQuery>;

export const PolicyProfilePage = pageOf(PolicyProfileSummary);
export type PolicyProfilePage = z.infer<typeof PolicyProfilePage>;

export const ProfileParams = z.object({ profileId: IdParam });
export const ProfileVersionParams = z.object({ profileId: IdParam, versionId: IdParam });

export const CreatePolicyProfileBody = z.object({
  name: z.string().trim().min(3, issue('NAME_TOO_SHORT', 'At least 3 characters.')).max(200),
  description: z.string().trim().max(2000).default(''),
  rules: PolicyRulesInput,
});
export type CreatePolicyProfileBody = z.input<typeof CreatePolicyProfileBody>;

export const CreatePolicyVersionBody = z.object({
  /** The version whose rules the new draft starts from (default: the current version). */
  fromVersionId: Id.optional(),
});
export type CreatePolicyVersionBody = z.input<typeof CreatePolicyVersionBody>;

export const UpdatePolicyVersionBody = z.object({
  rules: PolicyRulesInput,
});
export type UpdatePolicyVersionBody = z.input<typeof UpdatePolicyVersionBody>;

export const SubmitPolicyVersionBody = z.object({
  note: z.string().trim().max(2000).optional(),
});
export type SubmitPolicyVersionBody = z.input<typeof SubmitPolicyVersionBody>;

export const ApprovePolicyVersionBody = z.object({
  /** When the version becomes current for new work (default: now). Never retroactive. */
  effectiveFrom: Instant.optional(),
  note: z.string().trim().max(2000).optional(),
});
export type ApprovePolicyVersionBody = z.input<typeof ApprovePolicyVersionBody>;

export const ReasonBody = z.object({ reason: ReasonText });
export type ReasonBody = z.input<typeof ReasonBody>;

export const PolicyVersionOptionsQuery = z.object({
  procedure: TendersProcedureWrite.optional(),
});
export type PolicyVersionOptionsQuery = z.input<typeof PolicyVersionOptionsQuery>;

export const PolicyCompareQuery = z.object({
  /** The version to compare against (default: the profile's current version). */
  against: IdParam.optional(),
});
export type PolicyCompareQuery = z.input<typeof PolicyCompareQuery>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const VERSION_ERRORS = ['POLICY_PROFILE_NOT_FOUND', 'POLICY_VERSION_NOT_FOUND'] as const;

/** GET /api/v1/buyer/policy/profiles (ADM-06). */
export const listPolicyProfiles = defineEndpoint({
  id: 'buyer.policy.listProfiles',
  method: 'GET',
  path: '/api/v1/buyer/policy/profiles',
  audience: 'buyer',
  permission: POLICY_PROFILE_READ,
  query: PolicyProfileListQuery,
  response: PolicyProfilePage,
  errors: [],
  screens: ['ADM-06'],
});

/** GET /api/v1/buyer/policy/profiles/:profileId: the profile and its version history. */
export const getPolicyProfile = defineEndpoint({
  id: 'buyer.policy.getProfile',
  method: 'GET',
  path: '/api/v1/buyer/policy/profiles/:profileId',
  audience: 'buyer',
  permission: POLICY_PROFILE_READ,
  params: ProfileParams,
  response: PolicyProfileDetail,
  errors: ['POLICY_PROFILE_NOT_FOUND'],
  screens: ['ADM-06'],
});

/** GET …/profiles/:profileId/versions/:versionId: the rules and the events that use the version. */
export const getPolicyVersion = defineEndpoint({
  id: 'buyer.policy.getVersion',
  method: 'GET',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions/:versionId',
  audience: 'buyer',
  permission: POLICY_PROFILE_READ,
  params: ProfileVersionParams,
  response: PolicyVersionDetail,
  errors: [...VERSION_ERRORS],
  screens: ['ADM-06'],
});

/** GET …/versions/:versionId/comparison?against=: what a version changes relative to another. */
export const comparePolicyVersions = defineEndpoint({
  id: 'buyer.policy.compareVersions',
  method: 'GET',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions/:versionId/comparison',
  audience: 'buyer',
  permission: POLICY_PROFILE_READ,
  params: ProfileVersionParams,
  query: PolicyCompareQuery,
  response: PolicyVersionComparison,
  errors: [...VERSION_ERRORS, 'NO_BASE_VERSION'],
  screens: ['ADM-06'],
});

/** POST /api/v1/buyer/policy/profiles: a new profile with draft version 1. */
export const createPolicyProfile = defineEndpoint({
  id: 'buyer.policy.createProfile',
  method: 'POST',
  path: '/api/v1/buyer/policy/profiles',
  audience: 'buyer',
  permission: 'org.policy.manage',
  body: CreatePolicyProfileBody,
  response: PolicyProfileDetail,
  idempotent: true,
  errors: ['POLICY_PROFILE_NAME_TAKEN'],
  screens: ['ADM-06'],
});

/** POST …/profiles/:profileId/versions: drafts the next version from an existing one. */
export const createPolicyVersion = defineEndpoint({
  id: 'buyer.policy.createVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions',
  audience: 'buyer',
  permission: 'org.policy.manage',
  params: ProfileParams,
  body: CreatePolicyVersionBody,
  response: PolicyVersionDetail,
  idempotent: true,
  errors: ['POLICY_PROFILE_NOT_FOUND', 'POLICY_VERSION_NOT_FOUND', 'POLICY_PROFILE_RETIRED', 'POLICY_DRAFT_EXISTS'],
  screens: ['ADM-06'],
});

/** PUT …/versions/:versionId: edits a DRAFT. Approved and retired versions are immutable. */
export const updatePolicyVersion = defineEndpoint({
  id: 'buyer.policy.updateVersion',
  method: 'PUT',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions/:versionId',
  audience: 'buyer',
  permission: 'org.policy.manage',
  params: ProfileVersionParams,
  body: UpdatePolicyVersionBody,
  response: PolicyVersionDetail,
  errors: [...VERSION_ERRORS, 'POLICY_VERSION_IMMUTABLE', 'POLICY_VERSION_IN_REVIEW'],
  screens: ['ADM-06'],
});

/** POST …/versions/:versionId/submit: draft → in_review. */
export const submitPolicyVersion = defineEndpoint({
  id: 'buyer.policy.submitVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions/:versionId/submit',
  audience: 'buyer',
  permission: 'org.policy.manage',
  params: ProfileVersionParams,
  body: SubmitPolicyVersionBody,
  response: PolicyVersionDetail,
  errors: [...VERSION_ERRORS, 'POLICY_VERSION_NOT_DRAFT', 'POLICY_PROFILE_RETIRED'],
  screens: ['ADM-06'],
});

/** POST …/versions/:versionId/approve: in_review → approved; the version becomes current from `effectiveFrom`. */
export const approvePolicyVersion = defineEndpoint({
  id: 'buyer.policy.approveVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions/:versionId/approve',
  audience: 'buyer',
  permission: 'org.policy.approve',
  params: ProfileVersionParams,
  body: ApprovePolicyVersionBody,
  response: PolicyVersionDetail,
  errors: [...VERSION_ERRORS, 'POLICY_VERSION_NOT_IN_REVIEW', 'SOD_SELF_APPROVAL_BLOCKED', 'EFFECTIVE_DATE_IN_PAST'],
  screens: ['ADM-06'],
});

/** POST …/versions/:versionId/return: in_review → draft with the reviewer's reason. */
export const returnPolicyVersion = defineEndpoint({
  id: 'buyer.policy.returnVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions/:versionId/return',
  audience: 'buyer',
  permission: 'org.policy.approve',
  params: ProfileVersionParams,
  body: ReasonBody,
  response: PolicyVersionDetail,
  errors: [...VERSION_ERRORS, 'POLICY_VERSION_NOT_IN_REVIEW'],
  screens: ['ADM-06'],
});

/** POST …/versions/:versionId/retire: no new work may adopt it; tenders that froze it keep it (BR-09). */
export const retirePolicyVersion = defineEndpoint({
  id: 'buyer.policy.retireVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/profiles/:profileId/versions/:versionId/retire',
  audience: 'buyer',
  permission: 'org.policy.manage',
  params: ProfileVersionParams,
  body: ReasonBody,
  response: PolicyVersionDetail,
  errors: [...VERSION_ERRORS, 'POLICY_VERSION_NOT_APPROVED', 'POLICY_VERSION_IS_CURRENT'],
  screens: ['ADM-06'],
});

/** POST …/profiles/:profileId/retire: the whole profile is withdrawn from new work. */
export const retirePolicyProfile = defineEndpoint({
  id: 'buyer.policy.retireProfile',
  method: 'POST',
  path: '/api/v1/buyer/policy/profiles/:profileId/retire',
  audience: 'buyer',
  permission: 'org.policy.manage',
  params: ProfileParams,
  body: ReasonBody,
  response: PolicyProfileDetail,
  errors: ['POLICY_PROFILE_NOT_FOUND', 'POLICY_PROFILE_RETIRED', 'POLICY_REVIEW_IN_PROGRESS'],
  screens: ['ADM-06'],
});

/** GET /api/v1/buyer/policy/version-options: the current approved versions new strategies and tenders may adopt. */
export const listPolicyVersionOptions = defineEndpoint({
  id: 'buyer.policy.versionOptions',
  method: 'GET',
  path: '/api/v1/buyer/policy/version-options',
  audience: 'buyer',
  permission: POLICY_PROFILE_PICK,
  query: PolicyVersionOptionsQuery,
  response: z.array(PolicyVersionOption),
  errors: [],
  screens: ['ADM-06', 'BUY-06', 'BUY-08'],
});

export const policyProfileRoutes = {
  listPolicyProfiles,
  getPolicyProfile,
  getPolicyVersion,
  comparePolicyVersions,
  createPolicyProfile,
  createPolicyVersion,
  updatePolicyVersion,
  submitPolicyVersion,
  approvePolicyVersion,
  returnPolicyVersion,
  retirePolicyVersion,
  retirePolicyProfile,
  listPolicyVersionOptions,
} as const;
