/**
 * Org-admin contract, supplier users and authority (SUP-04; PRD §4.1; AC-03).
 *
 * Members, groups, roles and invitations use the shared member-administration endpoints under
 * `/api/v1/supplier/admin/*` (see `members.ts`). This part adds what only a supplier organization has:
 * - tender assignments (`pursuit_team_members`): who works on which pursuit, which sections, whether pricing is
 *   visible;
 * - submission authority: explicitly assigned (the `authorized_signatory` role, organization-wide or for one
 *   tender), never implied by bid management or contribution;
 * - signing limits (`authority_limits` with `decision_type = contract_signature` in the supplier tenant).
 * A contributor can complete assigned work but cannot submit or grant itself authority (AC-03): every command
 * requires `supplier.users.manage`, and an administrator can never raise their own authority
 * (`SELF_GRANT_FORBIDDEN`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  Id,
  IdParam,
  Instant,
  Money,
  NonNegativeMoney,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { MembershipsStatus, PursuitTeamMembersResponsibility } from '../enums.js';
import { AccessItemStatus, AccessScopeInput } from './shared.js';

export const AssignableTender = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  buyerName: z.string().min(1),
  submissionDeadline: OfficialDeadline.nullable(),
});
export type AssignableTender = z.infer<typeof AssignableTender>;

export const listAssignableTenders = defineEndpoint({
  id: 'supplier.admin.assignableTenders.list',
  method: 'GET',
  path: '/api/v1/supplier/admin/assignable-tenders',
  audience: 'supplier',
  permission: 'supplier.users.manage',
  response: z.object({ items: z.array(AssignableTender) }),
  errors: [],
  screens: ['SUP-04'],
  summary: 'Pursuits of this supplier that can receive team assignments.',
});

export const TenderAssignmentRow = z.object({
  assignmentId: Id,
  member: PersonRef,
  capacity: z.string().nullable(),
  tender: AssignableTender,
  responsibility: PursuitTeamMembersResponsibility,
  sectionScope: z.array(z.string().min(1)),
  lotLabels: z.array(z.string().min(1)),
  dueAt: Instant.nullable(),
  canViewPricing: z.boolean(),
  assignedAt: Instant,
  endedAt: Instant.nullable(),
  active: z.boolean(),
});
export type TenderAssignmentRow = z.infer<typeof TenderAssignmentRow>;

export const TENDER_ASSIGNMENT_SORTS = ['dueAt', 'member', 'tender', 'responsibility'] as const;

export const TenderAssignmentListQuery = listQueryWithSort(TENDER_ASSIGNMENT_SORTS).extend({
  userId: IdParam.optional(),
  tenderId: IdParam.optional(),
  responsibility: queryList(PursuitTeamMembersResponsibility).optional(),
  active: QueryBoolean.optional(),
});

export const listTenderAssignments = defineEndpoint({
  id: 'supplier.admin.assignments.list',
  method: 'GET',
  path: '/api/v1/supplier/admin/tender-assignments',
  audience: 'supplier',
  permission: 'supplier.users.manage',
  query: TenderAssignmentListQuery,
  response: pageOf(TenderAssignmentRow),
  errors: [],
  screens: ['SUP-04'],
});

export const CreateTenderAssignmentBody = z.object({
  userId: Id,
  tenderId: Id,
  responsibility: PursuitTeamMembersResponsibility,
  sectionScope: z.array(z.string().trim().min(1).max(200)).max(50),
  dueAt: Instant.nullable(),
  canViewPricing: z.boolean(),
});
export type CreateTenderAssignmentBody = z.infer<typeof CreateTenderAssignmentBody>;

export const createTenderAssignment = defineEndpoint({
  id: 'supplier.admin.assignments.create',
  method: 'POST',
  path: '/api/v1/supplier/admin/tender-assignments',
  audience: 'supplier',
  permission: 'supplier.users.manage',
  body: CreateTenderAssignmentBody,
  response: TenderAssignmentRow,
  idempotent: true,
  errors: [
    'RESPONSIBILITY_REQUIRES_AUTHORITY',
    'PRICING_REQUIRES_PERMISSION',
    'ALREADY_ASSIGNED',
    'USER_NOT_ACTIVE',
    'TENDER_NOT_AVAILABLE',
    'SELF_GRANT_FORBIDDEN',
  ],
  screens: ['SUP-04'],
  summary:
    'Assigns a member to a pursuit. Approver and signatory responsibilities need the matching authority (AC-03).',
});

export const AssignmentParams = z.object({ assignmentId: IdParam });

export const endTenderAssignment = defineEndpoint({
  id: 'supplier.admin.assignments.end',
  method: 'POST',
  path: '/api/v1/supplier/admin/tender-assignments/:assignmentId/end',
  audience: 'supplier',
  permission: 'supplier.users.manage',
  params: AssignmentParams,
  body: z.object({ reason: ReasonText }),
  response: TenderAssignmentRow,
  errors: ['ASSIGNMENT_ALREADY_ENDED'],
  screens: ['SUP-04'],
});

export const SUBMISSION_AUTHORITY_SOURCES = ['organization_role', 'tender_role', 'none'] as const;
export const SubmissionAuthoritySource = z.enum(SUBMISSION_AUTHORITY_SOURCES);
export type SubmissionAuthoritySource = z.infer<typeof SubmissionAuthoritySource>;

export const SigningLimit = z.object({
  limitId: Id,
  maxAmount: Money.nullable(),
  effectiveFrom: Instant,
  effectiveTo: Instant.nullable(),
  status: AccessItemStatus,
});
export type SigningLimit = z.infer<typeof SigningLimit>;

/** One member's supplier authority (SUP-04 "signing limits, delegated authority"). */
/** What the caller may change on an authority row (SUP-04). */
export const SupplierAuthorityAction = z.enum(['changeSubmission', 'setSigningLimit']);
export type SupplierAuthorityAction = z.infer<typeof SupplierAuthorityAction>;

/**
 * Why an action is not offered: `self` (nobody changes their own authority, AC-03), `inactive` (not an active
 * member) or `no_submission_authority` (only signatories carry a signing limit).
 */
export const SupplierAuthorityBlock = z.enum(['self', 'inactive', 'no_submission_authority']);
export type SupplierAuthorityBlock = z.infer<typeof SupplierAuthorityBlock>;

export const SupplierAuthorityRow = z.object({
  member: PersonRef,
  capacity: z.string().nullable(),
  membershipStatus: MembershipsStatus,
  canPrepare: z.boolean(),
  canPrice: z.boolean(),
  canApprove: z.boolean(),
  canSubmit: z.boolean(),
  submissionSource: SubmissionAuthoritySource,
  /** Tenders the submission authority is limited to (`tender_role`). */
  submissionTenders: z.array(z.object({ tenderId: Id, reference: Reference })),
  signingLimit: SigningLimit.nullable(),
  delegationsReceived: z.number().int().min(0),
  activeAssignments: z.number().int().min(0),
  availableActions: z.array(SupplierAuthorityAction),
  /** Set when an action is withheld; the first reason that applies. */
  blockedBy: SupplierAuthorityBlock.nullable(),
});
export type SupplierAuthorityRow = z.infer<typeof SupplierAuthorityRow>;

export const SUPPLIER_AUTHORITY_SORTS = ['member', 'capacity'] as const;

export const SupplierAuthorityListQuery = listQueryWithSort(SUPPLIER_AUTHORITY_SORTS).extend({
  canSubmit: QueryBoolean.optional(),
  canApprove: QueryBoolean.optional(),
});

export const listSupplierAuthority = defineEndpoint({
  id: 'supplier.admin.authority.list',
  method: 'GET',
  path: '/api/v1/supplier/admin/authority',
  audience: 'supplier',
  permission: 'supplier.users.manage',
  query: SupplierAuthorityListQuery,
  response: pageOf(SupplierAuthorityRow),
  errors: [],
  screens: ['SUP-04'],
});

export const MemberAuthorityParams = z.object({ userId: IdParam });

export const SetSigningLimitBody = z
  .object({
    maxAmount: NonNegativeMoney,
    effectiveFrom: Instant,
    effectiveTo: Instant.nullable(),
    reason: ReasonText,
  })
  .refine((value) => value.effectiveTo === null || Date.parse(value.effectiveTo) > Date.parse(value.effectiveFrom), {
    message: issue('LIMIT_DATES_INVALID', 'The end must be after the start.'),
    path: ['effectiveTo'],
  });
export type SetSigningLimitBody = z.infer<typeof SetSigningLimitBody>;

export const setSigningLimit = defineEndpoint({
  id: 'supplier.admin.authority.setSigningLimit',
  method: 'PUT',
  path: '/api/v1/supplier/admin/authority/:userId/signing-limit',
  audience: 'supplier',
  permission: 'supplier.users.manage',
  params: MemberAuthorityParams,
  body: SetSigningLimitBody,
  response: SupplierAuthorityRow,
  errors: ['SIGNING_LIMIT_REQUIRES_SIGNATORY', 'SELF_GRANT_FORBIDDEN', 'USER_NOT_ACTIVE', 'CURRENCY_NOT_ACCEPTED'],
  screens: ['SUP-04'],
});

export const SetSubmissionAuthorityBody = z
  .object({
    granted: z.boolean(),
    scope: AccessScopeInput,
    reason: ReasonText,
  })
  .refine((value) => value.scope.scopeType === 'organization' || value.scope.scopeType === 'tender', {
    message: issue('SCOPE_INVALID', 'Submission authority covers the whole organization or one tender.'),
    path: ['scope', 'scopeType'],
  });
export type SetSubmissionAuthorityBody = z.infer<typeof SetSubmissionAuthorityBody>;

export const setSubmissionAuthority = defineEndpoint({
  id: 'supplier.admin.authority.setSubmission',
  method: 'PUT',
  path: '/api/v1/supplier/admin/authority/:userId/submission',
  audience: 'supplier',
  permission: 'supplier.users.manage',
  params: MemberAuthorityParams,
  body: SetSubmissionAuthorityBody,
  response: SupplierAuthorityRow,
  errors: ['SELF_GRANT_FORBIDDEN', 'USER_NOT_ACTIVE', 'SUBMISSION_AUTHORITY_UNCHANGED', 'TENDER_NOT_AVAILABLE'],
  screens: ['SUP-04'],
  summary: 'Grants or withdraws explicit submission authority (the authorized signatory role, organization or tender).',
});
