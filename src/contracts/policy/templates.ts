/**
 * Template and content library (ADM-08; PRD §17.3; blueprint Migration 03 `templates`, `template_versions`,
 * `template_checklist_items`).
 *
 * - Every template has a kind, an owner, intended procedure and category, an audience, a status, an effective date,
 *   a review date and a revision history (PRD §17.3).
 * - Template status: `draft` (never approved) → `in_review` → `approved` → `retired`. A revision of an approved
 *   template is a new version that goes through review while the approved version stays in use; each version has
 *   its own `versionStatus` (`retired` there means superseded).
 * - Approving needs `org.templates.approve`; whoever submitted a version cannot approve it (BR-07) unless nobody
 *   else holds the permission and the organization documented alternative oversight, which is then shown
 *   (`capabilities.alternativeOversightNote`) (`SOD_SELF_APPROVAL_BLOCKED`, 403).
 * - The template OWNER (`owner_user_id`, accountable for review dates) is separate from who authored, submitted
 *   and approved each version (holders of `org.templates.manage` / `org.templates.approve`).
 * - Retired templates cannot be selected for new work (`template-options` never lists them and resolving one
 *   answers `TEMPLATE_RETIRED`). Existing events keep the version they adopted.
 * - `approvalRequestId` links an `approval_requests` row with `subject_type = 'template'`; null until Stage B
 *   creates that row on submission.
 *
 * Stage B storage mapping (blueprint amendment, see the policy domain follow-ups): the contract fields beyond the
 * blueprint columns are `template_versions.version_status` (draft, in_review, approved, retired), `created_by`,
 * `created_at`, `submitted_by`, `submitted_at`, `returned_reason` and `approval_request_id`, plus
 * `templates.retirement_reason` and `retired_at`; template usage is read from the adopting tenders and contracts.
 */
import { z } from 'zod';

import {
  ActorRef,
  CalendarDate,
  Id,
  IdParam,
  Instant,
  PersonRef,
  QueryBoolean,
  Reference,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { TemplatesAudience, TemplatesKind, TemplatesStatus, TendersProcedureWrite } from '../enums.js';
import { ReasonBody } from './profiles.js';
import { TEMPLATE_ADMIN_READ, TEMPLATE_PICK } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Rows and details
// ---------------------------------------------------------------------------------------------------------

/** The intended category of a template (`templates.category_id`). */
export const TemplateCategory = z.object({
  categoryId: Id,
  code: z.string().min(1),
  name: z.string().min(1),
});
export type TemplateCategory = z.infer<typeof TemplateCategory>;

export const TemplateChecklistItem = z.object({
  id: Id,
  itemText: z.string().min(1),
  sortOrder: z.number().int().min(0),
  mandatory: z.boolean(),
});
export type TemplateChecklistItem = z.infer<typeof TemplateChecklistItem>;

/** A version in the revision history. */
export const TemplateVersionSummary = z.object({
  id: Id,
  templateId: Id,
  versionNo: z.number().int().min(1),
  /** `approved` = in use now; `retired` = superseded by a later approved version or retired with the template. */
  versionStatus: TemplatesStatus,
  isCurrent: z.boolean(),
  changeNote: z.string(),
  createdBy: PersonRef.nullable(),
  createdAt: Instant,
  submittedBy: PersonRef.nullable(),
  submittedAt: Instant.nullable(),
  approvedBy: PersonRef.nullable(),
  approvedAt: Instant.nullable(),
});
export type TemplateVersionSummary = z.infer<typeof TemplateVersionSummary>;

/** A library row on ADM-08. */
export const TemplateSummary = z.object({
  id: Id,
  kind: TemplatesKind,
  name: z.string().min(1),
  procedure: TendersProcedureWrite.nullable(),
  category: TemplateCategory.nullable(),
  audience: TemplatesAudience,
  owner: PersonRef,
  status: TemplatesStatus,
  effectiveFrom: Instant.nullable(),
  reviewDate: CalendarDate.nullable(),
  /** The review date has passed (the template stays usable, but its owner must review it). */
  reviewOverdue: z.boolean(),
  currentVersionNo: z.number().int().min(1).nullable(),
  /** A revision that is draft or in review, if any. */
  pendingVersionNo: z.number().int().min(1).nullable(),
  /** Events and contracts that adopted a version of the template. */
  usageCount: z.number().int().min(0),
  /** Whether new work may adopt it now (approved, with a current version, not retired). */
  selectable: z.boolean(),
  updatedAt: Instant,
});
export type TemplateSummary = z.infer<typeof TemplateSummary>;

/** A record that adopted a version: it keeps that version even after later revisions or retirement. */
export const TemplateUsage = z.object({
  recordType: z.enum(['tender', 'contract']),
  recordId: Id,
  reference: Reference,
  title: z.string().min(1),
  adoptedVersionNo: z.number().int().min(1),
  adoptedAt: Instant,
});
export type TemplateUsage = z.infer<typeof TemplateUsage>;

export const TemplateCapabilities = z.object({
  canEdit: z.boolean(),
  canDraftVersion: z.boolean(),
  canSubmit: z.boolean(),
  canApprove: z.boolean(),
  canReturn: z.boolean(),
  canRetire: z.boolean(),
  approvalBlockedReason: z.string().nullable(),
  /**
   * The documented alternative oversight (BR-07) the caller's approval relies on, when the caller submitted the
   * item and nobody else holds the approval permission; null otherwise.
   */
  alternativeOversightNote: z.string().nullable(),
});

/** One version with its content. */
export const TemplateVersionDetail = TemplateVersionSummary.extend({
  bodyMarkdown: z.string(),
  checklistItems: z.array(TemplateChecklistItem),
  returnedReason: z.string().nullable(),
  approvalRequestId: Id.nullable(),
});
export type TemplateVersionDetail = z.infer<typeof TemplateVersionDetail>;

export const TemplateDetail = TemplateSummary.extend({
  /** For `tender_package`: the template tender (`tenders.is_template = true`) the package is built from. */
  sourceTenderId: Id.nullable(),
  createdAt: Instant,
  retiredAt: Instant.nullable(),
  retirementReason: z.string().nullable(),
  versions: z.array(TemplateVersionSummary),
  /** The version shown by default: the pending revision when the caller can act on it, otherwise the current one. */
  focusVersion: TemplateVersionDetail,
  usage: z.array(TemplateUsage),
  capabilities: TemplateCapabilities,
});
export type TemplateDetail = z.infer<typeof TemplateDetail>;

/** An approved template new work may adopt, with the version it would adopt. */
export const TemplateOption = z.object({
  templateId: Id,
  kind: TemplatesKind,
  name: z.string().min(1),
  procedure: TendersProcedureWrite.nullable(),
  category: TemplateCategory.nullable(),
  audience: TemplatesAudience,
  versionId: Id,
  versionNo: z.number().int().min(1),
  reviewDate: CalendarDate.nullable(),
  reviewOverdue: z.boolean(),
});
export type TemplateOption = z.infer<typeof TemplateOption>;

/** What the authoring form offers: active members who may own a template, and the buyer's categories. */
export const TemplateAuthoringOptions = z.object({
  owners: z.array(ActorRef),
  categories: z.array(TemplateCategory),
});
export type TemplateAuthoringOptions = z.infer<typeof TemplateAuthoringOptions>;

// ---------------------------------------------------------------------------------------------------------
// Queries and bodies
// ---------------------------------------------------------------------------------------------------------

export const TEMPLATE_SORT_FIELDS = ['name', 'kind', 'status', 'reviewDate', 'effectiveFrom', 'updatedAt'] as const;

export const TemplateListQuery = listQueryWithSort(TEMPLATE_SORT_FIELDS).extend({
  kind: queryList(TemplatesKind).optional(),
  status: queryList(TemplatesStatus).optional(),
  audience: queryList(TemplatesAudience).optional(),
  procedure: queryList(TendersProcedureWrite).optional(),
  ownerUserId: IdParam.optional(),
  categoryId: IdParam.optional(),
  /** Only templates whose review date has passed. */
  reviewOverdue: QueryBoolean.optional(),
  reviewFrom: CalendarDate.optional(),
  reviewTo: CalendarDate.optional(),
});
export type TemplateListQuery = z.input<typeof TemplateListQuery>;

export const TemplatePage = pageOf(TemplateSummary);
export type TemplatePage = z.infer<typeof TemplatePage>;

export const TemplateParams = z.object({ templateId: IdParam });
export const TemplateVersionParams = z.object({ templateId: IdParam, versionId: IdParam });

export const ChecklistItemInput = z.object({
  itemText: z.string().trim().min(3, issue('CHECKLIST_ITEM_REQUIRED', 'Describe the item.')).max(500),
  mandatory: z.boolean(),
});
export type ChecklistItemInput = z.infer<typeof ChecklistItemInput>;

const TemplateContentShape = z.object({
  bodyMarkdown: z.string().max(100_000, issue('TEXT_TOO_LONG', 'At most 100 000 characters.')),
  checklistItems: z.array(ChecklistItemInput).max(100).default([]),
});

const TemplateMetaShape = z.object({
  name: z.string().trim().min(3, issue('NAME_TOO_SHORT', 'At least 3 characters.')).max(200),
  procedure: TendersProcedureWrite.nullable(),
  categoryId: Id.nullable(),
  audience: TemplatesAudience,
  ownerUserId: Id,
  reviewDate: CalendarDate,
});

function checkContent(
  kind: z.infer<typeof TemplatesKind> | null,
  content: { bodyMarkdown: string; checklistItems: readonly ChecklistItemInput[] },
  context: z.RefinementCtx,
): void {
  if (kind === 'checklist' && content.checklistItems.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['checklistItems'],
      message: issue('CHECKLIST_ITEMS_REQUIRED', 'A checklist needs at least one item.'),
    });
  }
  if (kind !== 'checklist' && content.bodyMarkdown.trim().length === 0) {
    context.addIssue({ code: 'custom', path: ['bodyMarkdown'], message: issue('BODY_REQUIRED', 'Write the template content.') });
  }
}

export const CreateTemplateBody = TemplateMetaShape.extend({
  kind: TemplatesKind,
  sourceTenderId: Id.nullable().default(null),
  bodyMarkdown: TemplateContentShape.shape.bodyMarkdown,
  checklistItems: TemplateContentShape.shape.checklistItems,
}).superRefine((value, context) => checkContent(value.kind, value, context));
export type CreateTemplateBody = z.input<typeof CreateTemplateBody>;

/** Metadata only; content changes go through a new version. */
export const UpdateTemplateBody = TemplateMetaShape;
export type UpdateTemplateBody = z.input<typeof UpdateTemplateBody>;

export const CreateTemplateVersionBody = TemplateContentShape.extend({
  changeNote: z.string().trim().min(3, issue('CHANGE_NOTE_REQUIRED', 'Explain what changes.')).max(2000),
});
export type CreateTemplateVersionBody = z.input<typeof CreateTemplateVersionBody>;

export const UpdateTemplateVersionBody = CreateTemplateVersionBody;
export type UpdateTemplateVersionBody = z.input<typeof UpdateTemplateVersionBody>;

export const SubmitTemplateVersionBody = z.object({ note: z.string().trim().max(2000).optional() });
export type SubmitTemplateVersionBody = z.input<typeof SubmitTemplateVersionBody>;

export const ApproveTemplateVersionBody = z.object({
  effectiveFrom: Instant.optional(),
  note: z.string().trim().max(2000).optional(),
});
export type ApproveTemplateVersionBody = z.input<typeof ApproveTemplateVersionBody>;

export const TemplateOptionsQuery = z.object({
  kind: queryList(TemplatesKind).optional(),
  procedure: TendersProcedureWrite.optional(),
  categoryId: IdParam.optional(),
  q: z.string().trim().max(200).optional(),
});
export type TemplateOptionsQuery = z.input<typeof TemplateOptionsQuery>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const TEMPLATE_VERSION_ERRORS = ['TEMPLATE_NOT_FOUND', 'TEMPLATE_VERSION_NOT_FOUND'] as const;

/** GET /api/v1/buyer/policy/templates (ADM-08). */
export const listTemplates = defineEndpoint({
  id: 'buyer.policy.listTemplates',
  method: 'GET',
  path: '/api/v1/buyer/policy/templates',
  audience: 'buyer',
  permission: TEMPLATE_ADMIN_READ,
  query: TemplateListQuery,
  response: TemplatePage,
  errors: [],
  screens: ['ADM-08'],
});

/** GET /api/v1/buyer/policy/templates/:templateId. */
export const getTemplate = defineEndpoint({
  id: 'buyer.policy.getTemplate',
  method: 'GET',
  path: '/api/v1/buyer/policy/templates/:templateId',
  audience: 'buyer',
  permission: TEMPLATE_ADMIN_READ,
  params: TemplateParams,
  response: TemplateDetail,
  errors: ['TEMPLATE_NOT_FOUND'],
  screens: ['ADM-08'],
});

/** GET …/templates/:templateId/versions/:versionId: one version's content (history view). */
export const getTemplateVersion = defineEndpoint({
  id: 'buyer.policy.getTemplateVersion',
  method: 'GET',
  path: '/api/v1/buyer/policy/templates/:templateId/versions/:versionId',
  audience: 'buyer',
  permission: TEMPLATE_ADMIN_READ,
  params: TemplateVersionParams,
  response: TemplateVersionDetail,
  errors: [...TEMPLATE_VERSION_ERRORS],
  screens: ['ADM-08'],
});

/** POST /api/v1/buyer/policy/templates: a new draft template with version 1. */
export const createTemplate = defineEndpoint({
  id: 'buyer.policy.createTemplate',
  method: 'POST',
  path: '/api/v1/buyer/policy/templates',
  audience: 'buyer',
  permission: 'org.templates.manage',
  body: CreateTemplateBody,
  response: TemplateDetail,
  idempotent: true,
  errors: ['TEMPLATE_NAME_TAKEN', 'OWNER_NOT_MEMBER', 'CATEGORY_NOT_FOUND', 'REVIEW_DATE_IN_PAST'],
  screens: ['ADM-08'],
});

/** PUT /api/v1/buyer/policy/templates/:templateId: owner, review date, audience, procedure, category, name. */
export const updateTemplate = defineEndpoint({
  id: 'buyer.policy.updateTemplate',
  method: 'PUT',
  path: '/api/v1/buyer/policy/templates/:templateId',
  audience: 'buyer',
  permission: 'org.templates.manage',
  params: TemplateParams,
  body: UpdateTemplateBody,
  response: TemplateDetail,
  errors: ['TEMPLATE_NOT_FOUND', 'TEMPLATE_RETIRED', 'TEMPLATE_NAME_TAKEN', 'OWNER_NOT_MEMBER', 'CATEGORY_NOT_FOUND', 'REVIEW_DATE_IN_PAST'],
  screens: ['ADM-08'],
});

/** POST …/templates/:templateId/versions: drafts a revision (the approved version stays in use meanwhile). */
export const createTemplateVersion = defineEndpoint({
  id: 'buyer.policy.createTemplateVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/templates/:templateId/versions',
  audience: 'buyer',
  permission: 'org.templates.manage',
  params: TemplateParams,
  body: CreateTemplateVersionBody,
  response: TemplateDetail,
  idempotent: true,
  errors: ['TEMPLATE_NOT_FOUND', 'TEMPLATE_RETIRED', 'TEMPLATE_REVISION_EXISTS'],
  screens: ['ADM-08'],
});

/** PUT …/templates/:templateId/versions/:versionId: edits a DRAFT version; approved versions are immutable. */
export const updateTemplateVersion = defineEndpoint({
  id: 'buyer.policy.updateTemplateVersion',
  method: 'PUT',
  path: '/api/v1/buyer/policy/templates/:templateId/versions/:versionId',
  audience: 'buyer',
  permission: 'org.templates.manage',
  params: TemplateVersionParams,
  body: UpdateTemplateVersionBody,
  response: TemplateDetail,
  errors: [...TEMPLATE_VERSION_ERRORS, 'TEMPLATE_VERSION_IMMUTABLE', 'TEMPLATE_VERSION_IN_REVIEW'],
  screens: ['ADM-08'],
});

/** POST …/versions/:versionId/submit: draft → in review. */
export const submitTemplateVersion = defineEndpoint({
  id: 'buyer.policy.submitTemplateVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/templates/:templateId/versions/:versionId/submit',
  audience: 'buyer',
  permission: 'org.templates.manage',
  params: TemplateVersionParams,
  body: SubmitTemplateVersionBody,
  response: TemplateDetail,
  errors: [...TEMPLATE_VERSION_ERRORS, 'TEMPLATE_VERSION_NOT_DRAFT', 'TEMPLATE_RETIRED', 'REVIEW_DATE_IN_PAST'],
  screens: ['ADM-08'],
});

/** POST …/versions/:versionId/approve: the version becomes current and the template selectable. */
export const approveTemplateVersion = defineEndpoint({
  id: 'buyer.policy.approveTemplateVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/templates/:templateId/versions/:versionId/approve',
  audience: 'buyer',
  permission: 'org.templates.approve',
  params: TemplateVersionParams,
  body: ApproveTemplateVersionBody,
  response: TemplateDetail,
  errors: [...TEMPLATE_VERSION_ERRORS, 'TEMPLATE_VERSION_NOT_IN_REVIEW', 'SOD_SELF_APPROVAL_BLOCKED', 'EFFECTIVE_DATE_IN_PAST'],
  screens: ['ADM-08'],
});

/** POST …/versions/:versionId/return: back to draft with the reviewer's reason. */
export const returnTemplateVersion = defineEndpoint({
  id: 'buyer.policy.returnTemplateVersion',
  method: 'POST',
  path: '/api/v1/buyer/policy/templates/:templateId/versions/:versionId/return',
  audience: 'buyer',
  permission: 'org.templates.approve',
  params: TemplateVersionParams,
  body: ReasonBody,
  response: TemplateDetail,
  errors: [...TEMPLATE_VERSION_ERRORS, 'TEMPLATE_VERSION_NOT_IN_REVIEW'],
  screens: ['ADM-08'],
});

/** POST …/templates/:templateId/retire: no new work may select it; adopted versions remain on their records. */
export const retireTemplate = defineEndpoint({
  id: 'buyer.policy.retireTemplate',
  method: 'POST',
  path: '/api/v1/buyer/policy/templates/:templateId/retire',
  audience: 'buyer',
  permission: 'org.templates.manage',
  params: TemplateParams,
  body: ReasonBody,
  response: TemplateDetail,
  errors: ['TEMPLATE_NOT_FOUND', 'TEMPLATE_RETIRED'],
  screens: ['ADM-08'],
});

/** GET /api/v1/buyer/policy/template-options: approved, non-retired templates new work may adopt. */
export const listTemplateOptions = defineEndpoint({
  id: 'buyer.policy.templateOptions',
  method: 'GET',
  path: '/api/v1/buyer/policy/template-options',
  audience: 'buyer',
  permission: TEMPLATE_PICK,
  query: TemplateOptionsQuery,
  response: z.array(TemplateOption),
  errors: [],
  screens: ['ADM-08', 'BUY-07', 'CON-02'],
});

/**
 * GET /api/v1/buyer/policy/template-options/:templateId: resolves the version a new record would adopt. A retired
 * or unapproved template is refused (Stage B's adopting commands honor the same codes).
 */
export const resolveTemplateOption = defineEndpoint({
  id: 'buyer.policy.resolveTemplate',
  method: 'GET',
  path: '/api/v1/buyer/policy/template-options/:templateId',
  audience: 'buyer',
  permission: TEMPLATE_PICK,
  params: TemplateParams,
  response: TemplateOption,
  errors: ['TEMPLATE_NOT_FOUND', 'TEMPLATE_RETIRED', 'TEMPLATE_NOT_APPROVED'],
  screens: ['BUY-07', 'CON-02'],
});

/** GET /api/v1/buyer/policy/template-authoring-options: owner candidates and categories for the ADM-08 forms. */
export const getTemplateAuthoringOptions = defineEndpoint({
  id: 'buyer.policy.templateAuthoringOptions',
  method: 'GET',
  path: '/api/v1/buyer/policy/template-authoring-options',
  audience: 'buyer',
  permission: TEMPLATE_ADMIN_READ,
  response: TemplateAuthoringOptions,
  errors: [],
  screens: ['ADM-08'],
});

export const templateRoutes = {
  listTemplates,
  getTemplateAuthoringOptions,
  getTemplate,
  getTemplateVersion,
  createTemplate,
  updateTemplate,
  createTemplateVersion,
  updateTemplateVersion,
  submitTemplateVersion,
  approveTemplateVersion,
  returnTemplateVersion,
  retireTemplate,
  listTemplateOptions,
  resolveTemplateOption,
} as const;
