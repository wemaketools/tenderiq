/**
 * Org-admin contract, buyer access governance (ADM-04 roles, groups and access review; ADM-05 incompatibilities;
 * PRD §4.2, §5.4; BR-07; DD-18, DD-25).
 *
 * - Direct exceptional grants (`access_grants`) always carry an owner, a reason, a start and an expiry, and nobody
 *   can grant a permission they do not hold themselves (`GRANT_NOT_HELD`) or grant anything to themselves.
 * - Restrictions (`access_restrictions`) win over roles and grants. A conflict restriction created by a pending
 *   declaration is lifted only through the conflict review (DD-25).
 * - Effective access lists every permission of a member with its sources (roles via membership and groups, direct
 *   grants) and the restrictions that override it.
 * - Segregation of duties: the five `sod_policies` rules, each mapped to the two permissions it keeps apart
 *   (`SOD_RULE_PERMISSIONS`). Holding both is reported by the access review; the per-record check is enforced by
 *   the domain command (Stage B).
 * - The conflict-declaration review queue shows buyer/supplier dual memberships to the reviewer only (PRD §5.4,
 *   AC-02).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { ACCESS_FINDING_TYPES, FINDING_SEVERITIES } from '../enums.js';

export { ACCESS_FINDING_TYPES, FINDING_SEVERITIES };

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  AccessRestrictionsRestrictionType,
  ConflictDeclarationsDisposition,
  ConflictDeclarationsNature,
  ConflictDeclarationsSubjectType,
  MembershipsStatus,
  SodPoliciesMode,
  SodPoliciesRuleCode,
} from '../enums.js';
import type { SodPoliciesRuleCode as SodRuleCode } from '../enums.js';
import { PermissionCodeSchema } from '../permissions.js';
import type { PermissionCode } from '../permissions.js';
import { AccessItemStatus, AccessScope, AccessScopeInput, PermissionSourceKind } from './shared.js';

/** Longest validity of one direct grant (PRD §4.2: exceptional, time-limited access). */
export const MAX_GRANT_DAYS = 180;

/** The two permissions each segregation-of-duties rule keeps apart (PRD §5.4, BR-07). */
export const SOD_RULE_PERMISSIONS = {
  draft_vs_final_approval: ['tender.edit', 'tender.release_approve'],
  submission_custody_vs_opening: ['tender.close', 'bid.open'],
  evaluation_vs_award_approval: ['evaluation.score', 'award.approve'],
  supplier_assessment_vs_exception_approval: ['compliance.assess', 'exclusion.approve'],
  requester_vs_request_approval: ['request.create', 'request.approve'],
} as const satisfies Record<SodRuleCode, readonly [PermissionCode, PermissionCode]>;

/** The SoD rules violated by holding all of `permissions` together. */
export function sodRulesBreachedBy(permissions: readonly string[]): SodRuleCode[] {
  const held = new Set(permissions);
  return (Object.keys(SOD_RULE_PERMISSIONS) as SodRuleCode[]).filter((rule) =>
    SOD_RULE_PERMISSIONS[rule].every((code) => held.has(code)),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Direct grants
// ---------------------------------------------------------------------------------------------------------

export const AccessGrantRow = z.object({
  grantId: Id,
  user: PersonRef,
  capacity: z.string().nullable(),
  permissionCode: PermissionCodeSchema,
  permissionDescription: z.string().min(1),
  scope: AccessScope,
  reason: z.string().min(1),
  owner: PersonRef,
  grantedBy: PersonRef.nullable(),
  startsAt: Instant,
  expiresAt: Instant,
  revokedAt: Instant.nullable(),
  revokedBy: PersonRef.nullable(),
  status: AccessItemStatus,
});
export type AccessGrantRow = z.infer<typeof AccessGrantRow>;

export const GRANT_SORTS = ['expiresAt', 'startsAt', 'user', 'permissionCode'] as const;

export const AccessGrantListQuery = listQueryWithSort(GRANT_SORTS).extend({
  status: queryList(AccessItemStatus).optional(),
  userId: IdParam.optional(),
  ownerUserId: IdParam.optional(),
  permissionCode: PermissionCodeSchema.optional(),
  expiresFrom: CalendarDate.optional(),
  expiresTo: CalendarDate.optional(),
});

export const listAccessGrants = defineEndpoint({
  id: 'buyer.admin.grants.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/access-grants',
  audience: 'buyer',
  permission: ['org.access.review', 'org.roles.manage'],
  query: AccessGrantListQuery,
  response: pageOf(AccessGrantRow),
  errors: [],
  screens: ['ADM-04'],
});

export const CreateAccessGrantBody = z
  .object({
    userId: Id,
    permissionCode: PermissionCodeSchema,
    scope: AccessScopeInput,
    reason: ReasonText,
    ownerUserId: Id,
    startsAt: Instant,
    expiresAt: Instant,
  })
  .refine((value) => Date.parse(value.expiresAt) > Date.parse(value.startsAt), {
    message: issue('GRANT_DATES_INVALID', 'The expiry must be after the start.'),
    path: ['expiresAt'],
  });
export type CreateAccessGrantBody = z.infer<typeof CreateAccessGrantBody>;

export const createAccessGrant = defineEndpoint({
  id: 'buyer.admin.grants.create',
  method: 'POST',
  path: '/api/v1/buyer/admin/access-grants',
  audience: 'buyer',
  permission: 'org.roles.manage',
  body: CreateAccessGrantBody,
  response: AccessGrantRow,
  idempotent: true,
  errors: [
    'GRANT_NOT_HELD',
    'SELF_GRANT_FORBIDDEN',
    'GRANT_TOO_LONG',
    'PERMISSION_WRONG_TENANT_KIND',
    'PERMISSION_NOT_GRANTABLE',
    'USER_NOT_ACTIVE',
    'OWNER_NOT_ACTIVE',
    'SCOPE_NOT_FOUND',
    'RESTRICTION_APPLIES',
  ],
  screens: ['ADM-04', 'ADM-03'],
  summary: 'Grants one permission for a limited time with an owner and a reason. Only permissions the granter holds.',
});

export const GrantParams = z.object({ grantId: IdParam });

export const revokeAccessGrant = defineEndpoint({
  id: 'buyer.admin.grants.revoke',
  method: 'POST',
  path: '/api/v1/buyer/admin/access-grants/:grantId/revoke',
  audience: 'buyer',
  permission: 'org.roles.manage',
  params: GrantParams,
  body: z.object({ reason: ReasonText }),
  response: AccessGrantRow,
  errors: ['GRANT_ALREADY_ENDED'],
  screens: ['ADM-04'],
});

export const extendAccessGrant = defineEndpoint({
  id: 'buyer.admin.grants.extend',
  method: 'POST',
  path: '/api/v1/buyer/admin/access-grants/:grantId/extend',
  audience: 'buyer',
  permission: 'org.roles.manage',
  params: GrantParams,
  body: z.object({ expiresAt: Instant, reason: ReasonText }),
  response: AccessGrantRow,
  errors: ['GRANT_ALREADY_ENDED', 'GRANT_TOO_LONG', 'GRANT_DATES_INVALID', 'GRANT_NOT_HELD'],
  screens: ['ADM-04'],
  summary: 'Extends a grant after review. The total validity stays within MAX_GRANT_DAYS.',
});

// ---------------------------------------------------------------------------------------------------------
// Restrictions
// ---------------------------------------------------------------------------------------------------------

export const AccessRestrictionRow = z.object({
  restrictionId: Id,
  user: PersonRef,
  capacity: z.string().nullable(),
  /** `null`: every permission within the scope. */
  permissionCode: PermissionCodeSchema.nullable(),
  scope: AccessScope,
  restrictionType: AccessRestrictionsRestrictionType,
  reason: z.string().min(1),
  startsAt: Instant,
  endsAt: Instant.nullable(),
  imposedBy: PersonRef.nullable(),
  /** The conflict declaration that created it (DD-25), when there is one. */
  conflictDeclarationId: Id.nullable(),
  status: AccessItemStatus,
});
export type AccessRestrictionRow = z.infer<typeof AccessRestrictionRow>;

export const RESTRICTION_SORTS = ['startsAt', 'endsAt', 'user'] as const;

export const AccessRestrictionListQuery = listQueryWithSort(RESTRICTION_SORTS).extend({
  restrictionType: queryList(AccessRestrictionsRestrictionType).optional(),
  status: queryList(AccessItemStatus).optional(),
  userId: IdParam.optional(),
});

export const listAccessRestrictions = defineEndpoint({
  id: 'buyer.admin.restrictions.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/access-restrictions',
  audience: 'buyer',
  permission: ['org.access.review', 'org.roles.manage'],
  query: AccessRestrictionListQuery,
  response: pageOf(AccessRestrictionRow),
  errors: [],
  screens: ['ADM-04'],
});

export const CreateAccessRestrictionBody = z
  .object({
    userId: Id,
    permissionCode: PermissionCodeSchema.nullable(),
    scope: AccessScopeInput,
    restrictionType: AccessRestrictionsRestrictionType,
    reason: ReasonText,
    startsAt: Instant,
    endsAt: Instant.nullable(),
  })
  .refine((value) => value.endsAt === null || Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: issue('RESTRICTION_DATES_INVALID', 'The end must be after the start.'),
    path: ['endsAt'],
  });
export type CreateAccessRestrictionBody = z.infer<typeof CreateAccessRestrictionBody>;

export const createAccessRestriction = defineEndpoint({
  id: 'buyer.admin.restrictions.create',
  method: 'POST',
  path: '/api/v1/buyer/admin/access-restrictions',
  audience: 'buyer',
  permission: 'org.roles.manage',
  body: CreateAccessRestrictionBody,
  response: AccessRestrictionRow,
  idempotent: true,
  errors: ['CANNOT_RESTRICT_SELF', 'USER_NOT_MEMBER', 'SCOPE_NOT_FOUND'],
  screens: ['ADM-04'],
  summary: 'Imposes an explicit restriction that wins over roles and grants (PRD §4.2).',
});

export const RestrictionParams = z.object({ restrictionId: IdParam });

export const liftAccessRestriction = defineEndpoint({
  id: 'buyer.admin.restrictions.lift',
  method: 'POST',
  path: '/api/v1/buyer/admin/access-restrictions/:restrictionId/lift',
  audience: 'buyer',
  permission: 'org.roles.manage',
  params: RestrictionParams,
  body: z.object({ reason: ReasonText }),
  response: AccessRestrictionRow,
  errors: ['RESTRICTION_ALREADY_ENDED', 'RESTRICTION_CONFLICT_PENDING'],
  screens: ['ADM-04'],
  summary: 'Ends a restriction. A conflict restriction is lifted only by the conflict review disposition (DD-25).',
});

// ---------------------------------------------------------------------------------------------------------
// Effective access and access review
// ---------------------------------------------------------------------------------------------------------

export const PermissionSource = z.object({
  kind: PermissionSourceKind,
  /** Role name, "Role via group", or "Direct grant". */
  label: z.string().min(1),
  scope: AccessScope,
  expiresAt: Instant.nullable(),
});
export type PermissionSource = z.infer<typeof PermissionSource>;

export const EffectivePermission = z.object({
  code: PermissionCodeSchema,
  category: z.string().min(1),
  description: z.string().min(1),
  /** False when a restriction overrides every source in scope. */
  effective: z.boolean(),
  sources: z.array(PermissionSource).min(1),
  restrictedBy: z.array(
    z.object({
      restrictionId: Id,
      restrictionType: AccessRestrictionsRestrictionType,
      scopeLabel: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});
export type EffectivePermission = z.infer<typeof EffectivePermission>;

export const SodBreach = z.object({
  ruleCode: SodPoliciesRuleCode,
  mode: SodPoliciesMode,
  permissions: z.tuple([PermissionCodeSchema, PermissionCodeSchema]),
});
export type SodBreach = z.infer<typeof SodBreach>;

export const EffectiveAccess = z.object({
  user: PersonRef,
  capacity: z.string().nullable(),
  membershipStatus: MembershipsStatus,
  permissions: z.array(EffectivePermission),
  restrictions: z.array(AccessRestrictionRow),
  sodBreaches: z.array(SodBreach),
});
export type EffectiveAccess = z.infer<typeof EffectiveAccess>;

export const UserParams = z.object({ userId: IdParam });

export const getEffectiveAccess = defineEndpoint({
  id: 'buyer.admin.access.effective',
  method: 'GET',
  path: '/api/v1/buyer/admin/access/users/:userId',
  audience: 'buyer',
  permission: ['org.access.review', 'org.roles.manage'],
  params: UserParams,
  response: EffectiveAccess,
  errors: [],
  screens: ['ADM-04', 'ADM-03'],
  summary: 'Every permission of a member with its sources (roles, groups, grants) and the restrictions that win.',
});

export const AccessFindingType = z.enum(ACCESS_FINDING_TYPES);
export type AccessFindingType = z.infer<typeof AccessFindingType>;

export const FindingSeverity = z.enum(FINDING_SEVERITIES);
export type FindingSeverity = z.infer<typeof FindingSeverity>;

/** Days without sign-in after which an active member is reported as dormant. */
export const DORMANT_AFTER_DAYS = 90;

export const AccessFinding = z.object({
  findingId: Id,
  type: AccessFindingType,
  severity: FindingSeverity,
  user: PersonRef,
  capacity: z.string().nullable(),
  title: z.string().min(1),
  detail: z.string().min(1),
  ruleCode: SodPoliciesRuleCode.nullable(),
  /** The grant, restriction or declaration the finding is about. */
  relatedId: Id.nullable(),
  dueAt: Instant.nullable(),
});
export type AccessFinding = z.infer<typeof AccessFinding>;

export const AccessReviewSummary = z.object({
  sodConflicts: z.number().int().min(0),
  expiringGrants: z.number().int().min(0),
  dormantAccounts: z.number().int().min(0),
  activeRestrictions: z.number().int().min(0),
  pendingConflictReviews: z.number().int().min(0),
  generatedAt: Instant,
});
export type AccessReviewSummary = z.infer<typeof AccessReviewSummary>;

export const FINDING_SORTS = ['severity', 'dueAt', 'user', 'type'] as const;

export const AccessFindingListQuery = listQueryWithSort(FINDING_SORTS).extend({
  type: queryList(AccessFindingType).optional(),
  severity: queryList(FindingSeverity).optional(),
  userId: IdParam.optional(),
});

export const AccessFindingPage = pageOf(AccessFinding).extend({ summary: AccessReviewSummary });
export type AccessFindingPage = z.infer<typeof AccessFindingPage>;

export const listAccessFindings = defineEndpoint({
  id: 'buyer.admin.access.findings',
  method: 'GET',
  path: '/api/v1/buyer/admin/access/findings',
  audience: 'buyer',
  permission: 'org.access.review',
  query: AccessFindingListQuery,
  response: AccessFindingPage,
  errors: [],
  screens: ['ADM-04'],
  summary: 'Access review: incompatible authority per SoD policy, expiring grants, dormant accounts, restrictions.',
});

// ---------------------------------------------------------------------------------------------------------
// Segregation-of-duties policies (ADM-05 incompatibilities)
// ---------------------------------------------------------------------------------------------------------

export const SodPolicyRow = z.object({
  ruleCode: SodPoliciesRuleCode,
  permissions: z.tuple([PermissionCodeSchema, PermissionCodeSchema]),
  /** A rule the organization has not configured yet is reported as `enforced` with `configured = false`. */
  mode: SodPoliciesMode,
  configured: z.boolean(),
  alternativeOversightNote: z.string().nullable(),
  approvedBy: PersonRef.nullable(),
  effectiveFrom: Instant.nullable(),
  /** Active members holding both permissions (reported by the access review). */
  holdersOfBoth: z.number().int().min(0),
});
export type SodPolicyRow = z.infer<typeof SodPolicyRow>;

export const listSodPolicies = defineEndpoint({
  id: 'buyer.admin.sod.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/sod-policies',
  audience: 'buyer',
  permission: ['org.authority.manage', 'org.access.review'],
  response: z.object({ items: z.array(SodPolicyRow) }),
  errors: [],
  screens: ['ADM-05', 'ADM-04'],
});

export const SodRuleParams = z.object({ ruleCode: SodPoliciesRuleCode });

export const UpdateSodPolicyBody = z
  .object({
    mode: SodPoliciesMode,
    alternativeOversightNote: z.string().trim().max(4000).nullable(),
    reason: ReasonText,
  })
  .refine(
    (value) =>
      value.mode === 'enforced' || (value.alternativeOversightNote !== null && value.alternativeOversightNote.length >= 20),
    {
      message: issue(
        'ALTERNATIVE_OVERSIGHT_NOTE_REQUIRED',
        'Describe the documented alternative oversight (at least 20 characters).',
      ),
      path: ['alternativeOversightNote'],
    },
  );
export type UpdateSodPolicyBody = z.infer<typeof UpdateSodPolicyBody>;

export const updateSodPolicy = defineEndpoint({
  id: 'buyer.admin.sod.update',
  method: 'PUT',
  path: '/api/v1/buyer/admin/sod-policies/:ruleCode',
  audience: 'buyer',
  permission: 'org.authority.manage',
  params: SodRuleParams,
  body: UpdateSodPolicyBody,
  response: SodPolicyRow,
  errors: ['SOD_POLICY_UNCHANGED'],
  screens: ['ADM-05'],
  summary: 'Enforces a rule or adopts documented alternative oversight; a control is never silently disabled.',
});

// ---------------------------------------------------------------------------------------------------------
// Conflict-declaration review queue (PRD §5.4, AC-02, DD-25)
// ---------------------------------------------------------------------------------------------------------

export const ConflictSubject = z.object({
  subjectType: ConflictDeclarationsSubjectType,
  subjectId: Id,
  reference: z.string().nullable(),
  title: z.string().min(1),
});
export type ConflictSubject = z.infer<typeof ConflictSubject>;

export const ConflictDeclarationRow = z.object({
  declarationId: Id,
  declarant: PersonRef,
  capacity: z.string().nullable(),
  subject: ConflictSubject,
  /** The supplier organization the declaration is about, when named. */
  supplierName: z.string().nullable(),
  hasConflict: z.boolean(),
  nature: ConflictDeclarationsNature.nullable(),
  declaredAt: Instant,
  disposition: ConflictDeclarationsDisposition,
  reviewedBy: PersonRef.nullable(),
  reviewedAt: Instant.nullable(),
  /** The declarant also belongs to one or more supplier organizations (shown to the reviewer only). */
  holdsSupplierMemberships: z.boolean(),
  /** Restricted access is blocked while `pending_review`, and permanently after recused/reassigned (DD-25). */
  accessBlocked: z.boolean(),
});
export type ConflictDeclarationRow = z.infer<typeof ConflictDeclarationRow>;

export const CONFLICT_SORTS = ['declaredAt', 'disposition', 'declarant'] as const;

export const ConflictDeclarationListQuery = listQueryWithSort(CONFLICT_SORTS).extend({
  disposition: queryList(ConflictDeclarationsDisposition).optional(),
  subjectType: queryList(ConflictDeclarationsSubjectType).optional(),
  nature: queryList(ConflictDeclarationsNature).optional(),
  hasConflict: QueryBoolean.optional(),
  dualMembership: QueryBoolean.optional(),
  declaredFrom: CalendarDate.optional(),
  declaredTo: CalendarDate.optional(),
});

export const listConflictDeclarations = defineEndpoint({
  id: 'buyer.admin.conflicts.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/conflict-declarations',
  audience: 'buyer',
  permission: ['org.access.review', 'evaluation.chair'],
  query: ConflictDeclarationListQuery,
  response: pageOf(ConflictDeclarationRow),
  errors: [],
  screens: ['ADM-04'],
  summary: 'The conflict review queue, including declarants who also belong to supplier organizations (AC-02).',
});

/** A declarant's supplier membership, visible to the conflict reviewer only (PRD §5.4). */
export const DeclarantSupplierMembership = z.object({
  organizationName: z.string().min(1),
  capacity: z.string().nullable(),
  status: MembershipsStatus,
});

export const ConflictHistoryEntry = z.object({
  at: Instant,
  actor: PersonRef,
  action: z.string().min(1),
  note: z.string().nullable(),
});

export const DECISION_DISPOSITIONS = ConflictDeclarationsDisposition.exclude(['pending_review']);
export type DecisionDisposition = z.infer<typeof DECISION_DISPOSITIONS>;

export const ConflictDeclarationDetail = ConflictDeclarationRow.extend({
  details: z.string().nullable(),
  reviewNote: z.string().nullable(),
  supplierMemberships: z.array(DeclarantSupplierMembership),
  restriction: AccessRestrictionRow.nullable(),
  history: z.array(ConflictHistoryEntry),
  /** Dispositions the caller may record now (empty once decided or for the caller's own declaration). */
  allowedDispositions: z.array(DECISION_DISPOSITIONS),
});
export type ConflictDeclarationDetail = z.infer<typeof ConflictDeclarationDetail>;

export const DeclarationParams = z.object({ declarationId: IdParam });

export const getConflictDeclaration = defineEndpoint({
  id: 'buyer.admin.conflicts.get',
  method: 'GET',
  path: '/api/v1/buyer/admin/conflict-declarations/:declarationId',
  audience: 'buyer',
  permission: ['org.access.review', 'evaluation.chair'],
  params: DeclarationParams,
  response: ConflictDeclarationDetail,
  errors: [],
  screens: ['ADM-04'],
});

export const DecideConflictBody = z
  .object({
    disposition: DECISION_DISPOSITIONS,
    reviewNote: ReasonText,
    reassignToUserId: Id.nullable(),
  })
  .refine((value) => value.disposition !== 'reassigned' || value.reassignToUserId !== null, {
    message: issue('REASSIGNEE_REQUIRED', 'Choose who takes over the assignment.'),
    path: ['reassignToUserId'],
  });
export type DecideConflictBody = z.infer<typeof DecideConflictBody>;

export const decideConflictDeclaration = defineEndpoint({
  id: 'buyer.admin.conflicts.decide',
  method: 'POST',
  path: '/api/v1/buyer/admin/conflict-declarations/:declarationId/decide',
  audience: 'buyer',
  permission: ['org.access.review', 'evaluation.chair'],
  params: DeclarationParams,
  body: DecideConflictBody,
  response: ConflictDeclarationDetail,
  errors: ['DECLARATION_ALREADY_DECIDED', 'CANNOT_REVIEW_OWN_DECLARATION', 'REASSIGNEE_NOT_ELIGIBLE'],
  screens: ['ADM-04'],
  summary: 'Records the disposition: cleared or mitigated resume access; recused or reassigned block it (DD-25).',
});
