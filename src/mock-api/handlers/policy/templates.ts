/**
 * Mock handlers of the template library (ADM-08) and the template pickers of the tender and contract forms.
 * Retired templates are never offered and resolving one answers TEMPLATE_RETIRED (PRD §17.3).
 */
import {
  approveTemplateVersion,
  createTemplate,
  createTemplateVersion,
  getTemplate,
  getTemplateAuthoringOptions,
  getTemplateVersion,
  listTemplateOptions,
  listTemplates,
  resolveTemplateOption,
  retireTemplate,
  returnTemplateVersion,
  submitTemplateVersion,
  updateTemplate,
  updateTemplateVersion,
} from '../../../contracts/policy.js';
import type { TemplateDetail, TemplateOption, TemplateSummary, TemplateVersionDetail, TemplateVersionSummary } from '../../../contracts/policy.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { POLICY_CATEGORY_REFS, TEMPLATES, TEMPLATE_VERSIONS, categoryRef, contractRef, tenderRef } from '../../fixtures/policy.js';
import type { FixtureChecklistItem, FixtureTemplate, FixtureTemplateVersion } from '../../fixtures/policy.js';
import { allPersonas, personRef } from '../../persona.js';
import type { TenantAccess } from '../../persona.js';
import { calendarDateOf, holds, matchesText, selfApprovalFor, sortRows, withinRange } from './common.js';

type Fail = (status: number, code: string, detail?: string) => never;

const NEW_TEMPLATE_ID = 900;
const NEW_VERSION_ID = 900;

function templatesOf(tenantId: number): FixtureTemplate[] {
  return TEMPLATES.filter((template) => template.tenantId === tenantId);
}

function versionsOf(templateId: number): FixtureTemplateVersion[] {
  return TEMPLATE_VERSIONS.filter((version) => version.templateId === templateId).sort((a, b) => b.versionNo - a.versionNo);
}

function isPending(version: FixtureTemplateVersion): boolean {
  return version.versionStatus === 'draft' || version.versionStatus === 'in_review';
}

function personOrNull(userId: number | null): { userId: number; fullName: string } | null {
  return userId === null ? null : personRef(userId);
}

function isReviewOverdue(template: FixtureTemplate, today: string): boolean {
  return template.status !== 'retired' && template.reviewDate !== null && template.reviewDate < today;
}

function category(categoryId: number | null): TemplateSummary['category'] {
  if (categoryId === null) return null;
  const found = categoryRef(categoryId);
  return { categoryId: found.categoryId, code: found.code, name: found.name };
}

function summary(template: FixtureTemplate, versions: readonly FixtureTemplateVersion[], today: string): TemplateSummary {
  const current = versions.find((version) => version.id === template.currentVersionId);
  const pending = versions.find(isPending);
  return {
    id: template.id,
    kind: template.kind,
    name: template.name,
    procedure: template.procedure,
    category: category(template.categoryId),
    audience: template.audience,
    owner: personRef(template.ownerUserId),
    status: template.status,
    effectiveFrom: template.effectiveFrom,
    reviewDate: template.reviewDate,
    reviewOverdue: isReviewOverdue(template, today),
    currentVersionNo: current?.versionNo ?? null,
    pendingVersionNo: pending?.versionNo ?? null,
    usageCount: template.usage.length,
    selectable: template.status === 'approved' && current !== undefined,
    updatedAt: template.updatedAt,
  };
}

function versionSummary(version: FixtureTemplateVersion, template: FixtureTemplate): TemplateVersionSummary {
  return {
    id: version.id,
    templateId: version.templateId,
    versionNo: version.versionNo,
    versionStatus: version.versionStatus,
    isCurrent: template.currentVersionId === version.id,
    changeNote: version.changeNote,
    createdBy: personOrNull(version.createdBy),
    createdAt: version.createdAt,
    submittedBy: personOrNull(version.submittedBy),
    submittedAt: version.submittedAt,
    approvedBy: personOrNull(version.approvedBy),
    approvedAt: version.approvedAt,
  };
}

function versionDetail(version: FixtureTemplateVersion, template: FixtureTemplate): TemplateVersionDetail {
  return {
    ...versionSummary(version, template),
    bodyMarkdown: version.bodyMarkdown,
    checklistItems: [...version.checklistItems].sort((a, b) => a.sortOrder - b.sortOrder),
    returnedReason: version.returnedReason,
    approvalRequestId: version.approvalRequestId,
  };
}

function detail(
  template: FixtureTemplate,
  versions: readonly FixtureTemplateVersion[],
  access: TenantAccess,
  userId: number,
  today: string,
): TemplateDetail {
  const manage = holds(access, 'org.templates.manage');
  const approve = holds(access, 'org.templates.approve');
  const retired = template.status === 'retired';
  const pending = versions.find(isPending);
  const current = versions.find((version) => version.id === template.currentVersionId);
  const focus = (pending !== undefined && (manage || approve) ? pending : current) ?? versions[0];
  if (focus === undefined) throw new Error(`Template ${template.id} has no versions.`);
  const inReview = pending?.versionStatus === 'in_review';
  const decision =
    approve && !retired && inReview && pending !== undefined
      ? selfApprovalFor(access, userId, pending.submittedBy, 'org.templates.approve', 'version')
      : null;
  return {
    ...summary(template, versions, today),
    sourceTenderId: template.sourceTenderId,
    createdAt: template.createdAt,
    retiredAt: template.retiredAt,
    retirementReason: template.retirementReason,
    versions: versions.map((version) => versionSummary(version, template)),
    focusVersion: versionDetail(focus, template),
    usage: template.usage.map((usage) => {
      const record = usage.recordType === 'tender' ? tenderRef(usage.recordId) : contractRef(usage.recordId);
      return {
        recordType: usage.recordType,
        recordId: usage.recordId,
        reference: record.reference,
        title: record.title,
        adoptedVersionNo: usage.adoptedVersionNo,
        adoptedAt: usage.adoptedAt,
      };
    }),
    capabilities: {
      canEdit: manage && !retired,
      canDraftVersion: manage && !retired && pending === undefined,
      canSubmit: manage && !retired && pending?.versionStatus === 'draft',
      canApprove: approve && !retired && inReview && decision !== null && decision.allowed,
      canReturn: approve && !retired && inReview,
      canRetire: manage && !retired,
      approvalBlockedReason: decision?.blockedReason ?? null,
      alternativeOversightNote: decision?.oversightNote ?? null,
    },
  };
}

function checklist(items: ReadonlyArray<{ itemText: string; mandatory: boolean }>): FixtureChecklistItem[] {
  return items.map((entry, index) => ({ id: 900 + index, itemText: entry.itemText, sortOrder: (index + 1) * 10, mandatory: entry.mandatory }));
}

interface MetaInput {
  readonly name: string;
  readonly ownerUserId: number;
  readonly categoryId: number | null;
  readonly reviewDate: string;
}

function checkMeta(tenantId: number, input: MetaInput, excludeId: number | null, today: string, fail: Fail): void {
  const name = input.name.trim().toLowerCase();
  if (templatesOf(tenantId).some((template) => template.id !== excludeId && template.name.toLowerCase() === name)) {
    return fail(409, 'TEMPLATE_NAME_TAKEN', 'A template with this name already exists.');
  }
  const ownerIsMember = allPersonas().some(
    (persona) =>
      persona.userId === input.ownerUserId &&
      persona.status === 'active' &&
      persona.memberships.some((membership) => membership.tenantId === tenantId && membership.status === 'active'),
  );
  if (!ownerIsMember) return fail(422, 'OWNER_NOT_MEMBER', 'The owner must be an active member of this organization.');
  if (input.categoryId !== null && !POLICY_CATEGORY_REFS.some((row) => row.categoryId === input.categoryId && row.tenantId === tenantId)) {
    return fail(422, 'CATEGORY_NOT_FOUND', 'No category with this id.');
  }
  if (input.reviewDate < today) return fail(422, 'REVIEW_DATE_IN_PAST', 'The next review date must be today or later.');
}

function option(template: FixtureTemplate, version: FixtureTemplateVersion, today: string): TemplateOption {
  return {
    templateId: template.id,
    kind: template.kind,
    name: template.name,
    procedure: template.procedure,
    category: category(template.categoryId),
    audience: template.audience,
    versionId: version.id,
    versionNo: version.versionNo,
    reviewDate: template.reviewDate,
    reviewOverdue: isReviewOverdue(template, today),
  };
}

export function registerTemplates(app: MockApp): void {
  function find(access: TenantAccess, templateId: number, fail: Fail): FixtureTemplate {
    const template = templatesOf(access.tenant.id).find((row) => row.id === templateId);
    if (template === undefined) return fail(404, 'TEMPLATE_NOT_FOUND', 'No template with this id.');
    return template;
  }

  function findVersion(template: FixtureTemplate, versionId: number, fail: Fail): FixtureTemplateVersion {
    const version = versionsOf(template.id).find((row) => row.id === versionId);
    if (version === undefined) return fail(404, 'TEMPLATE_VERSION_NOT_FOUND', 'No version with this id in the template.');
    return version;
  }

  /** The template's versions with one version replaced (or added). */
  function withVersion(template: FixtureTemplate, replacement: FixtureTemplateVersion): FixtureTemplateVersion[] {
    return [replacement, ...versionsOf(template.id).filter((row) => row.id !== replacement.id)].sort((a, b) => b.versionNo - a.versionNo);
  }

  mockRoute(app, listTemplates, ({ requireTenant, query, now, fixtures }) => {
    const { tenant } = requireTenant();
    const today = calendarDateOf(now);
    const rows = templatesOf(tenant.id)
      .filter((template) => matchesText(query.q, template.name, personRef(template.ownerUserId).fullName))
      .filter((template) => query.kind === undefined || query.kind.includes(template.kind))
      .filter((template) => query.status === undefined || query.status.includes(template.status))
      .filter((template) => query.audience === undefined || query.audience.includes(template.audience))
      .filter((template) => query.procedure === undefined || (template.procedure !== null && query.procedure.includes(template.procedure)))
      .filter((template) => query.ownerUserId === undefined || template.ownerUserId === query.ownerUserId)
      .filter((template) => query.categoryId === undefined || template.categoryId === query.categoryId)
      .filter((template) => query.reviewOverdue === undefined || isReviewOverdue(template, today) === query.reviewOverdue)
      .filter((template) => withinRange(template.reviewDate, query.reviewFrom, query.reviewTo))
      .map((template) => summary(template, versionsOf(template.id), today));
    const sort = query.sort ?? 'name';
    return fixtures.page(sortRows(rows, (row) => row[sort], query.dir));
  });

  mockRoute(app, getTemplate, ({ requireTenant, requirePersona, params, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    return detail(template, versionsOf(template.id), access, requirePersona().userId, calendarDateOf(now));
  });

  mockRoute(app, getTemplateVersion, ({ requireTenant, params, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    return versionDetail(findVersion(template, params.versionId, fail), template);
  });

  mockRoute(app, createTemplate, ({ requireTenant, requirePersona, body, now, fail }) => {
    const access = requireTenant();
    const today = calendarDateOf(now);
    checkMeta(access.tenant.id, body, null, today, fail);
    const userId = requirePersona().userId;
    const at = now.toISOString();
    const template: FixtureTemplate = {
      id: NEW_TEMPLATE_ID, tenantId: access.tenant.id, kind: body.kind, name: body.name.trim(), procedure: body.procedure,
      categoryId: body.categoryId, audience: body.audience, ownerUserId: body.ownerUserId, status: 'draft', effectiveFrom: null,
      reviewDate: body.reviewDate, currentVersionId: null, sourceTenderId: body.sourceTenderId, createdAt: at, updatedAt: at,
      retiredAt: null, retirementReason: null, usage: [],
    };
    const version: FixtureTemplateVersion = {
      id: NEW_VERSION_ID, templateId: NEW_TEMPLATE_ID, versionNo: 1, versionStatus: 'draft', bodyMarkdown: body.bodyMarkdown,
      changeNote: 'First draft.', checklistItems: checklist(body.checklistItems), createdBy: userId, createdAt: at,
      submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null, returnedReason: null, approvalRequestId: null,
    };
    return detail(template, [version], access, userId, today);
  });

  mockRoute(app, updateTemplate, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    if (template.status === 'retired') return fail(409, 'TEMPLATE_RETIRED', 'A retired template cannot change.');
    const today = calendarDateOf(now);
    checkMeta(access.tenant.id, body, template.id, today, fail);
    const updated: FixtureTemplate = {
      ...template, name: body.name.trim(), procedure: body.procedure, categoryId: body.categoryId, audience: body.audience,
      ownerUserId: body.ownerUserId, reviewDate: body.reviewDate, updatedAt: now.toISOString(),
    };
    return detail(updated, versionsOf(template.id), access, requirePersona().userId, today);
  });

  mockRoute(app, createTemplateVersion, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    if (template.status === 'retired') return fail(409, 'TEMPLATE_RETIRED', 'A retired template cannot be revised.');
    const versions = versionsOf(template.id);
    if (versions.some(isPending)) return fail(409, 'TEMPLATE_REVISION_EXISTS', 'A revision is already in preparation.');
    const userId = requirePersona().userId;
    const draft: FixtureTemplateVersion = {
      id: NEW_VERSION_ID, templateId: template.id, versionNo: (versions[0]?.versionNo ?? 0) + 1, versionStatus: 'draft',
      bodyMarkdown: body.bodyMarkdown, changeNote: body.changeNote, checklistItems: checklist(body.checklistItems), createdBy: userId,
      createdAt: now.toISOString(), submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null, returnedReason: null,
      approvalRequestId: null,
    };
    return detail(template, [draft, ...versions], access, userId, calendarDateOf(now));
  });

  mockRoute(app, updateTemplateVersion, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    const version = findVersion(template, params.versionId, fail);
    if (version.versionStatus === 'approved' || version.versionStatus === 'retired') {
      return fail(409, 'TEMPLATE_VERSION_IMMUTABLE', 'An approved version cannot change; draft a revision instead.');
    }
    if (version.versionStatus === 'in_review') {
      return fail(409, 'TEMPLATE_VERSION_IN_REVIEW', 'The version is in review; ask the approver to return it first.');
    }
    const updated: FixtureTemplateVersion = {
      ...version, bodyMarkdown: body.bodyMarkdown, changeNote: body.changeNote, checklistItems: checklist(body.checklistItems),
    };
    return detail(template, withVersion(template, updated), access, requirePersona().userId, calendarDateOf(now));
  });

  mockRoute(app, submitTemplateVersion, ({ requireTenant, requirePersona, params, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    const version = findVersion(template, params.versionId, fail);
    if (template.status === 'retired') return fail(409, 'TEMPLATE_RETIRED', 'A retired template cannot be submitted.');
    if (version.versionStatus !== 'draft') return fail(409, 'TEMPLATE_VERSION_NOT_DRAFT', 'Only a draft version can be submitted.');
    const today = calendarDateOf(now);
    if (template.reviewDate !== null && template.reviewDate < today) {
      return fail(409, 'REVIEW_DATE_IN_PAST', 'Set a future review date before submitting.');
    }
    const userId = requirePersona().userId;
    const submitted: FixtureTemplateVersion = {
      ...version, versionStatus: 'in_review', submittedBy: userId, submittedAt: now.toISOString(), returnedReason: null, approvalRequestId: null,
    };
    const updatedTemplate: FixtureTemplate = template.status === 'draft' ? { ...template, status: 'in_review' } : template;
    return detail(updatedTemplate, withVersion(template, submitted), access, userId, today);
  });

  mockRoute(app, approveTemplateVersion, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    const version = findVersion(template, params.versionId, fail);
    const userId = requirePersona().userId;
    if (version.versionStatus !== 'in_review') {
      return fail(409, 'TEMPLATE_VERSION_NOT_IN_REVIEW', 'Only a version in review can be approved.');
    }
    const decision = selfApprovalFor(access, userId, version.submittedBy, 'org.templates.approve', 'version');
    if (!decision.allowed) return fail(403, 'SOD_SELF_APPROVAL_BLOCKED', decision.blockedReason ?? undefined);
    const effectiveFrom = body.effectiveFrom ?? now.toISOString();
    if (Date.parse(effectiveFrom) < now.getTime() - 60_000) {
      return fail(422, 'EFFECTIVE_DATE_IN_PAST', 'A template version cannot take effect retroactively.');
    }
    const at = now.toISOString();
    const versions = versionsOf(template.id).map((row): FixtureTemplateVersion => {
      if (row.id === version.id) return { ...row, versionStatus: 'approved', approvedBy: userId, approvedAt: at };
      if (row.versionStatus === 'approved') return { ...row, versionStatus: 'retired' };
      return row;
    });
    const approvedTemplate: FixtureTemplate = {
      ...template, status: 'approved', currentVersionId: version.id, effectiveFrom, updatedAt: at,
    };
    return detail(approvedTemplate, versions, access, userId, calendarDateOf(now));
  });

  mockRoute(app, returnTemplateVersion, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    const version = findVersion(template, params.versionId, fail);
    if (version.versionStatus !== 'in_review') {
      return fail(409, 'TEMPLATE_VERSION_NOT_IN_REVIEW', 'Only a version in review can be returned.');
    }
    const returned: FixtureTemplateVersion = { ...version, versionStatus: 'draft', returnedReason: body.reason };
    const updatedTemplate: FixtureTemplate = template.status === 'in_review' ? { ...template, status: 'draft' } : template;
    return detail(updatedTemplate, withVersion(template, returned), access, requirePersona().userId, calendarDateOf(now));
  });

  mockRoute(app, retireTemplate, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    if (template.status === 'retired') return fail(409, 'TEMPLATE_RETIRED', 'The template is already retired.');
    const at = now.toISOString();
    const retired: FixtureTemplate = { ...template, status: 'retired', retiredAt: at, retirementReason: body.reason, updatedAt: at };
    return detail(retired, versionsOf(template.id), access, requirePersona().userId, calendarDateOf(now));
  });

  mockRoute(app, getTemplateAuthoringOptions, ({ requireTenant }) => {
    const { tenant } = requireTenant();
    const owners = allPersonas()
      .filter((persona) => persona.status === 'active')
      .flatMap((persona) => {
        const membership = persona.memberships.find((row) => row.tenantId === tenant.id && row.status === 'active');
        return membership === undefined ? [] : [{ userId: persona.userId, fullName: persona.fullName, capacity: membership.capacity }];
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    const categories = POLICY_CATEGORY_REFS.filter((row) => row.tenantId === tenant.id)
      .map((row) => ({ categoryId: row.categoryId, code: row.code, name: row.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { owners, categories };
  });

  mockRoute(app, listTemplateOptions, ({ requireTenant, query, now }) => {
    const { tenant } = requireTenant();
    const today = calendarDateOf(now);
    return templatesOf(tenant.id)
      .filter((template) => template.status === 'approved')
      .filter((template) => query.kind === undefined || query.kind.includes(template.kind))
      .filter((template) => query.procedure === undefined || template.procedure === null || template.procedure === query.procedure)
      .filter((template) => query.categoryId === undefined || template.categoryId === null || template.categoryId === query.categoryId)
      .filter((template) => matchesText(query.q, template.name))
      .flatMap((template) => {
        const current = versionsOf(template.id).find((version) => version.id === template.currentVersionId);
        return current === undefined ? [] : [option(template, current, today)];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  mockRoute(app, resolveTemplateOption, ({ requireTenant, params, now, fail }) => {
    const access = requireTenant();
    const template = find(access, params.templateId, fail);
    if (template.status === 'retired') {
      return fail(409, 'TEMPLATE_RETIRED', 'This template is retired and cannot be selected for new work.');
    }
    const current = versionsOf(template.id).find((version) => version.id === template.currentVersionId);
    if (template.status !== 'approved' || current === undefined) {
      return fail(409, 'TEMPLATE_NOT_APPROVED', 'This template has no approved version yet.');
    }
    return option(template, current, calendarDateOf(now));
  });
}
