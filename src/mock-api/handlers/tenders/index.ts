/**
 * Mock handlers of the tenders contract (domain 06; FR-07; BUY-07..BUY-13; AC-06).
 *
 * - Tenant isolation: every handler reads only the active buyer's tenders; another organization's tender is 404.
 * - Visibility: `tender.create` or `audit.view` holders see every tender of the organization; other `tender.view`
 *   holders only tenders they are on the team of (see `model.ts`).
 * - Commands validate against the fixture state (editability, revision, references, policy, readiness) and answer
 *   with the declared business error or a static, contract-valid outcome. New ids start at 900. Nothing persists.
 */
import type { Money } from '../../../contracts/common.js';
import { compare } from '../../../contracts/decimal.js';
import { enumLabel } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import {
  DEFAULT_PRICE_ENTRIES,
  MATERIAL_TENDER_FIELDS,
  TEAM_ROLE_PERMISSIONS,
  TENDER_COPY_SECTIONS,
  TENDER_NEVER_COPIED,
  TENDER_PHASE_STATUSES,
  localDateOf,
  tenderEndpoints,
} from '../../../contracts/tenders.js';
import type { TenderCopySection, TenderRow, TenderSection } from '../../../contracts/tenders.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  CALENDARS,
  CATEGORIES,
  DEPARTMENTS,
  LEGAL_ENTITIES,
  PACKAGE_DOCUMENTS,
  POLICY_VERSIONS,
  QUALIFICATION_PROGRAMS,
  REQUESTS,
  STRATEGIES,
  TEMPLATES,
  TENDERS,
  TENDER_TERMS,
  revisionHash,
} from '../../fixtures/tenders/index.js';
import type {
  FxCondition,
  FxCriterion,
  FxEvaluationPlan,
  FxLot,
  FxMilestone,
  FxPricingItem,
  FxPricingSchedule,
  FxReleaseCheck,
  FxRequirement,
  FxTeamMember,
  FxTender,
} from '../../fixtures/tenders/index.js';
import { acceptCustomFields, customFieldIssues } from '../../custom-fields.js';
import { allPersonas, membershipPermissions, personRef } from '../../persona.js';
import type { Persona, TenantAccess } from '../../persona.js';
import {
  approvalState,
  bumped,
  categoryRef,
  changeImpactOf,
  correctionsOf,
  countsOf,
  gateOf,
  isActiveMember,
  isAuthoring,
  issuesOfPlan,
  latestApproval,
  lotOf,
  materialChangesOf,
  missingLanguageEditions,
  packageDocumentsOf,
  planOf,
  policyOf,
  pricingIssues,
  readinessItems,
  readinessOf,
  releaseChecksOf,
  requestRef,
  requirementOf,
  scheduleOf,
  affordabilityOf,
  stateOf,
  teamIssues,
  teamMemberOf,
  tenderCustomContext,
  tenderCustomValues,
  tenderDetail,
  tenderRow,
  termsOf,
  timetableOf,
  visibleTenders,
} from './model.js';
import type { TenderState } from './model.js';
import { previewOf } from './preview.js';

const NEW_ID = 900;

interface Ctx {
  requireTenant(): TenantAccess;
  requirePersona(): Persona;
  notFound(detail?: string): never;
  fail(status: number, code: string, detail?: string): never;
}

function iso(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** The visible tender of the active tenant, or 404 (another tenant's or a hidden tender is simply not found). */
function tenderState(ctx: Ctx, tenderId: number): TenderState {
  const { tenant, permissions } = ctx.requireTenant();
  const persona = ctx.requirePersona();
  const tender = visibleTenders(tenant.id, persona.userId, permissions).find((row) => row.id === tenderId);
  if (tender === undefined) {
    return ctx.notFound('No tender with this id is visible to you.');
  }
  return stateOf(tender);
}

/** 409 unless the package is still authored in place (BR-16: a released package changes by addendum). */
function requireEditable(ctx: Ctx, state: TenderState): void {
  if (!isAuthoring(state.tender.status)) {
    ctx.fail(
      409,
      'TENDER_NOT_EDITABLE',
      `${state.tender.reference} is ${enumLabel('tenders.status', state.tender.status).toLowerCase()}; published content changes only through an addendum.`,
    );
  }
}

function requireRevision(ctx: Ctx, state: TenderState, expected: number): void {
  if (expected !== state.tender.draftRevision) {
    ctx.fail(409, 'REVISION_CONFLICT', `The package is at revision ${state.tender.draftRevision}; reload and apply your change again.`);
  }
}

/** Active members of the tenant with their effective permissions. */
function tenantMembers(tenantId: number): { persona: Persona; capacity: string | null; permissions: PermissionCode[] }[] {
  return allPersonas().flatMap((persona) => {
    if (persona.status !== 'active') {
      return [];
    }
    const membership = persona.memberships.find((row) => row.tenantId === tenantId && row.status === 'active');
    return membership === undefined ? [] : [{ persona, capacity: membership.capacity, permissions: membershipPermissions(membership) }];
  });
}

function eligibleOwner(tenantId: number, userId: number, permission: PermissionCode): boolean {
  return tenantMembers(tenantId).some((member) => member.persona.userId === userId && member.permissions.includes(permission));
}

function amountOf(value: Money | null | undefined): string | null | undefined {
  return value === undefined ? undefined : value === null ? null : value.amount;
}

/** Applies the defined fields of a patch (money → amount) onto a row. */
function applyPatch<T extends object>(row: T, patch: Record<string, unknown>, moneyKeys: readonly string[] = []): T {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    changes[key] = moneyKeys.includes(key) ? amountOf(value as Money | null) : value;
  }
  return { ...row, ...changes };
}

/** The tenant's default currency first, then the currencies its tenders already use or accept. */
function currenciesOf(tenantId: number, defaultCurrency: string | null): string[] {
  const used = TENDERS.filter((row) => row.tenantId === tenantId).flatMap((row) => [row.currency, ...row.acceptedCurrencies]);
  return [...new Set([...(defaultCurrency === null ? [] : [defaultCurrency]), ...used])];
}

function nextReference(tenantId: number, now: Date, timeZone: string): string {
  const year = localDateOf(iso(now), timeZone).slice(0, 4);
  const numbers = TENDERS.filter((row) => row.tenantId === tenantId && !row.isTemplate).map((row) => Number(row.reference.split('-')[2] ?? '0'));
  return `T-${year}-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
}

function sortRows(rows: TenderRow[], sort: string | undefined, dir: 'asc' | 'desc'): TenderRow[] {
  const key = sort ?? 'updatedAt';
  const direction = sort === undefined ? -1 : dir === 'asc' ? 1 : -1;
  if (key === 'estimatedValue') {
    const amount = (row: TenderRow): string => row.estimatedValue?.amount ?? '-1';
    return [...rows].sort((a, b) => compare(amount(a), amount(b)) * direction || a.id - b.id);
  }
  const value = (row: TenderRow): string => {
    switch (key) {
      case 'reference':
        return row.reference;
      case 'title':
        return row.title.toLowerCase();
      case 'status':
        return row.status;
      case 'submissionDeadline':
        return row.submissionDeadline?.at ?? '';
      default:
        return row.updatedAt;
    }
  };
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    return (left < right ? -1 : left > right ? 1 : 0) * direction || a.id - b.id;
  });
}

export function register(app: MockApp): void {
  // -------------------------------------------------------------------------------------------------------
  // Register and creation (BUY-07)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, tenderEndpoints.list, ({ requireTenant, requirePersona, query, fixtures }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const q = query.q?.toLowerCase();
    const base = visibleTenders(tenant.id, persona.userId, permissions)
      .filter((row) => q === undefined || `${row.reference} ${row.title} ${row.summary ?? ''}`.toLowerCase().includes(q))
      .filter((row) => query.eventType === undefined || query.eventType.includes(row.eventType))
      .filter((row) => query.procedure === undefined || query.procedure.includes(row.procedure))
      .filter((row) => query.participation === undefined || query.participation.includes(row.participation))
      .filter((row) => query.ownerUserId === undefined || row.ownerUserId === query.ownerUserId)
      .filter((row) => query.categoryId === undefined || row.categoryId === query.categoryId)
      .filter((row) => query.departmentId === undefined || row.departmentId === query.departmentId)
      .filter((row) => query.sourceRequestId === undefined || row.sourceRequestId === query.sourceRequestId)
      .filter((row) => query.mine !== true || isActiveMember(row.id, persona.userId))
      .map((row) => tenderRow(stateOf(row)))
      .filter((row) => {
        if (query.deadlineFrom === undefined && query.deadlineTo === undefined) {
          return true;
        }
        if (row.submissionDeadline === null) {
          return false;
        }
        const date = localDateOf(row.submissionDeadline.at, row.submissionDeadline.timeZone);
        return (query.deadlineFrom === undefined || date >= query.deadlineFrom) && (query.deadlineTo === undefined || date <= query.deadlineTo);
      });
    const statusCounts = [...new Set(base.map((row) => row.status))].map((status) => ({
      status,
      count: base.filter((row) => row.status === status).length,
    }));
    const phaseStatuses: readonly string[] | undefined = query.phase === undefined ? undefined : TENDER_PHASE_STATUSES[query.phase];
    const rows = base
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => phaseStatuses === undefined || phaseStatuses.includes(row.status));
    return { ...fixtures.page(sortRows(rows, query.sort, query.dir)), statusCounts };
  });

  mockRoute(app, tenderEndpoints.creationSources, ({ requireTenant, requirePersona, query }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const q = query.q?.toLowerCase();
    const matches = (text: string): boolean => q === undefined || text.toLowerCase().includes(q);
    const wants = (kind: string): boolean => query.kind === undefined || query.kind === kind;
    const policy = POLICY_VERSIONS.find((row) => row.tenantId === tenant.id) ?? null;
    const currencies = currenciesOf(tenant.id, tenant.defaultCurrency);
    return {
      defaultCurrency: tenant.defaultCurrency,
      currencies,
      templates: wants('template')
        ? TEMPLATES.filter((row) => row.tenantId === tenant.id && matches(row.name)).map((row) => ({
            templateId: row.id,
            name: row.name,
            procedure: row.procedure,
            category: categoryRef(row.categoryId),
            versionNo: row.versionNo,
            status: row.status,
            effectiveFrom: row.effectiveFrom,
            reviewDate: row.reviewDate,
            sourceTenderId: row.sourceTenderId,
            sections: [...row.sections],
            usable: row.status === 'approved',
            unusableReason: row.status === 'approved' ? null : `This template is ${enumLabel('templates.status', row.status).toLowerCase()}; only approved templates can be used.`,
          }))
        : [],
      priorEvents: wants('prior_event')
        ? visibleTenders(tenant.id, persona.userId, permissions)
            .filter((row) => row.releasedAt !== null && matches(`${row.reference} ${row.title}`))
            .map((row) => ({
              tenderId: row.id,
              reference: row.reference,
              title: row.title,
              status: row.status,
              eventType: row.eventType,
              procedure: row.procedure,
              releasedAt: row.releasedAt,
              copyableSections: row.eventType === 'rfi' ? (['overview', 'requirements', 'timetable'] as const).slice() : [...TENDER_COPY_SECTIONS],
            }))
        : [],
      requests: wants('request')
        ? REQUESTS.filter((row) => row.tenantId === tenant.id && matches(`${row.reference} ${row.title}`)).map((row) => ({
            requestId: row.id,
            reference: row.reference,
            title: row.title,
            status: row.status,
            estimatedValue: row.estimatedValue === null || currencies[0] === undefined ? null : { amount: row.estimatedValue, currency: currencies[0] },
            category: categoryRef(row.categoryId),
            usable: row.status === 'approved' && row.convertedToTenderId === null,
            unusableReason:
              row.convertedToTenderId !== null
                ? `Already converted to ${TENDERS.find((tender) => tender.id === row.convertedToTenderId)?.reference ?? 'a tender'}.`
                : row.status === 'approved'
                  ? null
                  : 'Only approved requests can be converted.',
          }))
        : [],
      strategies: wants('strategy')
        ? STRATEGIES.filter((row) => row.tenantId === tenant.id && matches(row.title)).map((row) => ({
            strategyId: row.id,
            title: row.title,
            request: requestRef(row.requestId),
            eventType: row.eventType,
            procedure: row.procedure,
            status: row.status,
            usable: row.status === 'approved' && row.usedByTenderId === null,
            unusableReason:
              row.usedByTenderId !== null
                ? `Already used by ${TENDERS.find((tender) => tender.id === row.usedByTenderId)?.reference ?? 'a tender'}.`
                : row.status === 'approved'
                  ? null
                  : 'Only approved strategies can be used.',
          }))
        : [],
      permittedProcedures: (policy?.permittedProcedures ?? []).filter((procedure) => procedure !== 'framework_calloff'),
      neverCopied: [...TENDER_NEVER_COPIED],
    };
  });

  mockRoute(app, tenderEndpoints.create, (ctx) => {
    const { body, now } = ctx;
    const { tenant, permissions } = ctx.requireTenant();
    const persona = ctx.requirePersona();
    const policy = POLICY_VERSIONS.find((row) => row.tenantId === tenant.id) ?? null;
    const ownerUserId = body.ownerUserId ?? persona.userId;
    if (!eligibleOwner(tenant.id, ownerUserId, 'tender.edit')) {
      ctx.fail(422, 'OWNER_NOT_ELIGIBLE', 'The owner must be a member of the organization who may edit tenders.');
    }
    const blankBase = TENDERS.find((row) => row.tenantId === tenant.id && row.isTemplate) ?? TENDERS[0];
    if (blankBase === undefined) {
      return ctx.notFound();
    }
    let source: FxTender = { ...blankBase, provenance: { source: 'blank', sourceId: null, label: 'Blank form' } };
    let copied: TenderCopySection[] = [];
    let copyFrom: TenderState | null = null;
    switch (body.source) {
      case 'blank': {
        if (policy !== null && !policy.permittedProcedures.includes(body.procedure)) {
          ctx.fail(422, 'PROCEDURE_NOT_PERMITTED', `The ${policy.profileName} does not permit the ${body.procedure} procedure.`);
        }
        if ((body.eventType === 'rfi') !== (body.procedure === 'rfi')) {
          ctx.fail(422, 'EVENT_TYPE_PROCEDURE_MISMATCH', 'A request for information uses the RFI procedure, and only it does.');
        }
        source = {
          ...source,
          title: body.title,
          eventType: body.eventType,
          procedure: body.procedure,
          participation: body.participation,
          legalEntityId: body.legalEntityId ?? source.legalEntityId,
          estimatedValue: body.estimatedValue?.amount ?? null,
        };
        break;
      }
      case 'template': {
        const template = TEMPLATES.find((row) => row.id === body.templateId && row.tenantId === tenant.id);
        if (template === undefined) {
          return ctx.fail(422, 'SOURCE_NOT_FOUND', 'No such template in your organization.');
        }
        if (template.status !== 'approved') {
          ctx.fail(409, 'TEMPLATE_NOT_APPROVED', `“${template.name}” is not approved for use.`);
        }
        const templateTender = TENDERS.find((row) => row.id === template.sourceTenderId) ?? source;
        source = {
          ...templateTender,
          title: body.title,
          categoryId: template.categoryId,
          provenance: { source: 'template', sourceId: template.id, label: `${template.name}, version ${template.versionNo}` },
        };
        copied = [...template.sections];
        break;
      }
      case 'prior_event': {
        const prior = visibleTenders(tenant.id, persona.userId, permissions).find((row) => row.id === body.priorTenderId);
        if (prior === undefined) {
          return ctx.fail(422, 'SOURCE_NOT_FOUND', 'No such prior event visible to you.');
        }
        copyFrom = stateOf(prior);
        copied = [...new Set(body.sections)];
        source = {
          ...prior,
          title: body.title,
          estimatedValue: copied.includes('overview') ? prior.estimatedValue : null,
          budgetAmount: null,
          provenance: { source: 'prior_event', sourceId: prior.id, label: `${prior.reference} ${prior.title}` },
        };
        break;
      }
      case 'request': {
        const request = REQUESTS.find((row) => row.id === body.requestId && row.tenantId === tenant.id);
        if (request === undefined) {
          return ctx.fail(422, 'SOURCE_NOT_FOUND', 'No such procurement request in your organization.');
        }
        if (request.convertedToTenderId !== null) {
          ctx.fail(409, 'REQUEST_ALREADY_CONVERTED', `${request.reference} was already converted to a tender.`);
        }
        if (request.status !== 'approved') {
          ctx.fail(409, 'REQUEST_NOT_APPROVED', `${request.reference} is not approved.`);
        }
        source = {
          ...source,
          title: body.title ?? request.title,
          sourceRequestId: request.id,
          categoryId: request.categoryId,
          estimatedValue: request.estimatedValue,
          provenance: { source: 'request', sourceId: request.id, label: `${request.reference} ${request.title}` },
        };
        copied = ['overview'];
        break;
      }
      case 'strategy': {
        const strategy = STRATEGIES.find((row) => row.id === body.strategyId && row.tenantId === tenant.id);
        if (strategy === undefined) {
          return ctx.fail(422, 'SOURCE_NOT_FOUND', 'No such procurement strategy in your organization.');
        }
        if (strategy.status !== 'approved') {
          ctx.fail(409, 'STRATEGY_NOT_APPROVED', `“${strategy.title}” is not approved.`);
        }
        if (strategy.usedByTenderId !== null) {
          ctx.fail(409, 'STRATEGY_ALREADY_USED', `“${strategy.title}” already established a tender.`);
        }
        const request = REQUESTS.find((row) => row.id === strategy.requestId);
        source = {
          ...source,
          title: body.title ?? strategy.title,
          eventType: strategy.eventType,
          procedure: strategy.procedure,
          participation: strategy.procedure === 'invitation_only' ? 'invitation_only' : strategy.procedure === 'restricted' ? 'restricted' : 'open',
          strategyId: strategy.id,
          sourceRequestId: strategy.requestId,
          categoryId: request?.categoryId ?? null,
          estimatedValue: request?.estimatedValue ?? null,
          provenance: { source: 'strategy', sourceId: strategy.id, label: strategy.title },
        };
        copied = ['overview'];
        break;
      }
    }
    const at = iso(now);
    const tender: FxTender = {
      ...source,
      id: NEW_ID,
      tenantId: tenant.id,
      reference: nextReference(tenant.id, now, source.officialTimeZone),
      status: 'draft',
      ownerUserId,
      categoryId: body.categoryId ?? source.categoryId,
      departmentId: body.departmentId ?? source.departmentId,
      policyVersionId: policy?.id ?? null,
      policyFrozenAt: null,
      draftRevision: 1,
      currentVersionNo: 0,
      scheduledReleaseAt: null,
      releasedAt: null,
      closedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      isTemplate: false,
      linkedFromTenderId: null,
      linkType: null,
      stageNo: 1,
      createdBy: persona.userId,
      createdAt: at,
      updatedAt: at,
    };
    const owner: FxTeamMember = {
      id: NEW_ID,
      tenantId: tenant.id,
      tenderId: NEW_ID,
      lotId: null,
      userId: ownerUserId,
      teamRole: 'owner',
      assignedBy: persona.userId,
      assignedAt: at,
      removedAt: null,
      removalReason: null,
      conflictReviewPending: false,
    };
    const copy = <T extends { tenderId: number }>(rows: readonly T[] | undefined, section: TenderCopySection): T[] =>
      copyFrom !== null && copied.includes(section) ? (rows ?? []).map((row) => ({ ...row, tenderId: NEW_ID })) : [];
    const state: TenderState = {
      tender,
      lots: copy(copyFrom?.lots, 'lots').map((lot) => ({ ...lot, stage: 'draft' as const, outcomeReason: null })),
      team: [owner],
      requirements: copy(copyFrom?.requirements, 'requirements'),
      schedules: copy(copyFrom?.schedules, 'pricing'),
      plans: copy(copyFrom?.plans, 'evaluation_plan').map((plan) => ({
        ...plan,
        status: 'draft' as const,
        version: 1,
        approvedAt: null,
        approvedBy: null,
        approvalRequestId: null,
        amendments: [],
      })),
      milestones: [],
      envelopes: copyFrom === null ? [] : copyFrom.envelopes.map((row) => ({ ...row, tenderId: NEW_ID })),
      conditions: copy(copyFrom?.conditions, 'participation'),
      checks: [],
      approvals: [],
    };
    return {
      tender: tenderRow(state),
      provenance: { ...tender.provenance },
      copiedSections: copied,
      notCopied: [...TENDER_NEVER_COPIED],
      reviewRequired: copied as TenderSection[],
      link: `/buyer/tenders/${NEW_ID}`,
    };
  });

  mockRoute(app, tenderEndpoints.saveAsTemplate, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const { tenant } = ctx.requireTenant();
    if (TEMPLATES.some((row) => row.tenantId === tenant.id && row.name.toLowerCase() === ctx.body.name.toLowerCase())) {
      ctx.fail(409, 'TEMPLATE_NAME_TAKEN', `A template named “${ctx.body.name}” already exists.`);
    }
    return {
      templateId: NEW_ID,
      name: ctx.body.name,
      kind: 'tender_package',
      status: 'draft',
      versionNo: 1,
      audience: ctx.body.audience,
      sourceTenderId: NEW_ID + state.tender.id,
      sections: [...new Set(ctx.body.sections)],
      notCopied: [...TENDER_NEVER_COPIED],
      approvalRequired: true,
    };
  });

  mockRoute(app, tenderEndpoints.link, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    const { tenant, permissions } = ctx.requireTenant();
    const persona = ctx.requirePersona();
    const { linkedFromTenderId, linkType } = ctx.body;
    if (linkedFromTenderId === state.tender.id) {
      ctx.fail(422, 'LINK_TO_SELF', 'A tender cannot follow itself.');
    }
    const target = visibleTenders(tenant.id, persona.userId, permissions).find((row) => row.id === linkedFromTenderId);
    if (target === undefined || (linkType === 'from_rfi' && target.eventType !== 'rfi')) {
      return ctx.fail(422, 'LINK_TARGET_NOT_ELIGIBLE', linkType === 'from_rfi' ? 'Link “from RFI” to a request for information.' : 'No such tender visible to you.');
    }
    if (target.linkedFromTenderId === state.tender.id) {
      ctx.fail(409, 'LINK_CYCLE', `${target.reference} already follows this tender.`);
    }
    if (state.tender.linkedFromTenderId !== null) {
      ctx.fail(409, 'TENDER_ALREADY_LINKED', 'This tender is already linked to an earlier stage.');
    }
    return {
      tenderId: state.tender.id,
      linkedFrom: { id: target.id, reference: target.reference, title: target.title, status: target.status },
      linkType,
      stageNo: linkType === 'next_stage' || linkType === 'from_rfi' ? target.stageNo + 1 : 1,
    };
  });

  // -------------------------------------------------------------------------------------------------------
  // Overview, team and readiness (BUY-08)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, tenderEndpoints.get, (ctx) => tenderDetail(tenderState(ctx, ctx.params.tenderId)));

  mockRoute(app, tenderEndpoints.update, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    requireRevision(ctx, state, body.expectedDraftRevision);
    const { tender } = state;
    const policy = policyOf(tender);
    if (body.procedure !== undefined && policy !== null && !policy.permittedProcedures.includes(body.procedure)) {
      ctx.fail(422, 'PROCEDURE_NOT_PERMITTED', `The ${policy.profileName} does not permit the ${body.procedure} procedure.`);
    }
    if (body.negotiationPermitted === true && policy !== null && !policy.negotiationPermitted) {
      ctx.fail(422, 'NEGOTIATION_NOT_PERMITTED_BY_POLICY', `The ${policy.profileName} does not permit negotiation.`);
    }
    if (body.bafoPermitted === true && policy !== null && !policy.bafoPermitted) {
      ctx.fail(422, 'BAFO_NOT_PERMITTED_BY_POLICY', `The ${policy.profileName} does not permit final offers.`);
    }
    const refs: [number | null | undefined, readonly { id: number; tenantId: number }[]][] = [
      [body.categoryId, CATEGORIES],
      [body.departmentId, DEPARTMENTS],
      [body.legalEntityId, LEGAL_ENTITIES],
    ];
    for (const [id, rows] of refs) {
      if (id !== undefined && id !== null && !rows.some((row) => row.id === id && row.tenantId === tender.tenantId)) {
        ctx.fail(422, 'REFERENCE_NOT_FOUND', 'A category, department or legal entity is not part of your organization.');
      }
    }
    const { expectedDraftRevision: _revision, customFields: sentCustom, ...fields } = body;
    const patched = applyPatch(tender, fields, ['estimatedValue', 'budgetAmount']);
    const next: FxTender = {
      ...patched,
      customFields: acceptCustomFields(tender.tenantId, 'tender', sentCustom, tenderCustomValues(tender), tenderCustomContext(patched)),
    };
    const changed = MATERIAL_TENDER_FIELDS.filter(
      (key) => JSON.stringify(next[key]) !== JSON.stringify(tender[key]),
    );
    const material = changed.length > 0;
    const draft: TenderState = { ...state, tender: { ...next, updatedAt: iso(now) } };
    const change = changeImpactOf(draft, material, 'overview', `changed ${changed.join(', ')}.`, now);
    return { tender: tenderDetail(bumped(draft, material, now)), change };
  });

  mockRoute(app, tenderEndpoints.team, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const active = state.team.filter((row) => row.removedAt === null);
    const roles = new Set(active.map((row) => row.teamRole));
    return {
      tenderId: state.tender.id,
      members: active.map((row) => teamMemberOf(row, state)),
      removed: state.team.filter((row) => row.removedAt !== null).map((row) => teamMemberOf(row, state)),
      coverage: (['owner', 'officer', 'evaluation_chair', 'evaluator', 'commercial_reviewer', 'opening_officer', 'witness', 'legal_reviewer', 'finance_reviewer'] as const).map(
        (teamRole) => ({
          teamRole,
          satisfied: roles.has(teamRole),
          required: state.tender.eventType === 'rfi' ? teamRole === 'owner' : ['owner', 'evaluation_chair', 'evaluator', 'opening_officer'].includes(teamRole),
        }),
      ),
      issues: teamIssues(state),
    };
  });

  mockRoute(app, tenderEndpoints.teamCandidates, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const { teamRole } = ctx.query;
    const required = TEAM_ROLE_PERMISSIONS[teamRole];
    return {
      teamRole,
      requiredPermission: required,
      candidates: tenantMembers(state.tender.tenantId)
        .filter((member) => member.permissions.includes('tender.view') || member.permissions.includes(required))
        .map((member) => {
          const eligible = member.permissions.includes(required);
          return {
            user: personRef(member.persona.userId),
            capacity: member.capacity,
            eligible,
            ineligibleReason: eligible ? null : `Needs the ${required} permission.`,
            alreadyAssigned: state.team.some(
              (row) => row.userId === member.persona.userId && row.teamRole === teamRole && row.removedAt === null,
            ),
          };
        }),
    };
  });

  mockRoute(app, tenderEndpoints.assignTeamMember, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const persona = ctx.requirePersona();
    if (state.tender.status === 'cancelled' || state.tender.status === 'archived') {
      ctx.fail(409, 'TENDER_LOCKED', 'The team of a cancelled or archived tender cannot change.');
    }
    const member = tenantMembers(state.tender.tenantId).find((row) => row.persona.userId === body.userId);
    if (member === undefined) {
      return ctx.fail(422, 'USER_NOT_MEMBER', 'The person is not an active member of your organization.');
    }
    if (!member.permissions.includes(TEAM_ROLE_PERMISSIONS[body.teamRole])) {
      ctx.fail(422, 'TEAM_ROLE_NOT_PERMITTED', `${member.persona.fullName} lacks the ${TEAM_ROLE_PERMISSIONS[body.teamRole]} permission.`);
    }
    const lotId = body.lotId ?? null;
    if (lotId !== null && !state.lots.some((lot) => lot.id === lotId)) {
      ctx.fail(422, 'LOT_NOT_FOUND', 'No such lot on this tender.');
    }
    const active = state.team.filter((row) => row.userId === body.userId && row.removedAt === null);
    if (active.some((row) => row.teamRole === body.teamRole && row.lotId === lotId)) {
      ctx.fail(409, 'TEAM_MEMBER_ALREADY_ASSIGNED', `${member.persona.fullName} already holds this role.`);
    }
    const opening = ['opening_officer', 'witness'];
    const assessing = ['evaluator', 'evaluation_chair', 'commercial_reviewer', 'owner'];
    const clash = active.some(
      (row) =>
        (opening.includes(row.teamRole) && assessing.includes(body.teamRole)) || (assessing.includes(row.teamRole) && opening.includes(body.teamRole)),
    );
    if (clash || (body.teamRole === 'evaluator' && body.userId === state.tender.ownerUserId)) {
      ctx.fail(409, 'SEGREGATION_OF_DUTIES', 'Opening rights are kept separate from authoring and evaluation rights.');
    }
    const row: FxTeamMember = {
      id: NEW_ID,
      tenantId: state.tender.tenantId,
      tenderId: state.tender.id,
      lotId,
      userId: body.userId,
      teamRole: body.teamRole,
      assignedBy: persona.userId,
      assignedAt: iso(now),
      removedAt: null,
      removalReason: null,
      conflictReviewPending: false,
    };
    return { member: teamMemberOf(row, state), newOwner: body.teamRole === 'owner' ? personRef(body.userId) : null };
  });

  mockRoute(app, tenderEndpoints.removeTeamMember, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    if (state.tender.status === 'cancelled' || state.tender.status === 'archived') {
      ctx.fail(409, 'TENDER_LOCKED', 'The team of a cancelled or archived tender cannot change.');
    }
    const member = state.team.find((row) => row.id === ctx.params.memberId);
    if (member === undefined) {
      return ctx.notFound('No such team member on this tender.');
    }
    if (member.removedAt !== null) {
      ctx.fail(409, 'TEAM_MEMBER_ALREADY_REMOVED', 'This assignment was already ended.');
    }
    if (member.teamRole === 'owner') {
      ctx.fail(409, 'OWNER_REQUIRED', 'Assign a new owner instead; a tender always has an accountable owner (BR-01).');
    }
    return {
      member: teamMemberOf({ ...member, removedAt: iso(ctx.now), removalReason: ctx.body.reason }, state),
      newOwner: null,
    };
  });

  mockRoute(app, tenderEndpoints.readiness, (ctx) => readinessOf(tenderState(ctx, ctx.params.tenderId)));

  // -------------------------------------------------------------------------------------------------------
  // Lots and requirements (BUY-09)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, tenderEndpoints.lots, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const { tender } = state;
    return {
      tenderId: tender.id,
      awardModel: tender.awardModel,
      maxLotsPerSupplier: tender.maxLotsPerSupplier,
      partialBidsAllowed: tender.partialBidsAllowed,
      officialTimeZone: tender.officialTimeZone,
      currency: tender.currency,
      lots: [...state.lots].sort((a, b) => a.lotNo - b.lotNo).map((lot) => lotOf(state, lot)),
    };
  });

  function checkLotFields(ctx: Ctx, state: TenderState, fields: { ownerUserId?: number | null | undefined; submissionDeadline?: string | null | undefined }): void {
    if (fields.ownerUserId !== undefined && fields.ownerUserId !== null && !eligibleOwner(state.tender.tenantId, fields.ownerUserId, 'tender.view')) {
      ctx.fail(422, 'OWNER_NOT_ELIGIBLE', 'The lot owner must be a member of the organization who may view tenders.');
    }
    const release = state.tender.scheduledReleaseAt;
    if (fields.submissionDeadline !== undefined && fields.submissionDeadline !== null && release !== null && fields.submissionDeadline <= release) {
      ctx.fail(422, 'LOT_DEADLINE_BEFORE_RELEASE', 'A lot deadline must fall after the planned release.');
    }
  }

  mockRoute(app, tenderEndpoints.createLot, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    checkLotFields(ctx, state, body);
    const lot: FxLot = {
      id: NEW_ID,
      tenantId: state.tender.tenantId,
      tenderId: state.tender.id,
      lotNo: Math.max(0, ...state.lots.map((row) => row.lotNo)) + 1,
      title: body.title,
      description: body.description ?? null,
      quantityDescription: body.quantityDescription ?? null,
      estimatedValue: body.estimatedValue?.amount ?? null,
      deliveryLocation: body.deliveryLocation ?? null,
      deliveryDate: body.deliveryDate ?? null,
      submissionDeadline: body.submissionDeadline ?? null,
      ownerUserId: body.ownerUserId ?? null,
      stage: 'draft',
      outcomeReason: null,
    };
    const draft = { ...state, lots: [...state.lots, lot] };
    return {
      lot: lotOf(bumped(draft, true, now), lot),
      change: changeImpactOf(draft, true, 'lots', `Lot ${lot.lotNo} — ${lot.title} added.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.updateLot, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = state.lots.find((row) => row.id === ctx.params.lotId);
    if (existing === undefined) {
      return ctx.notFound('No such lot on this tender.');
    }
    requireEditable(ctx, state);
    checkLotFields(ctx, state, body);
    const lot = applyPatch(existing, body, ['estimatedValue']);
    const draft = { ...state, lots: state.lots.map((row) => (row.id === lot.id ? lot : row)) };
    return {
      lot: lotOf(bumped(draft, true, now), lot),
      change: changeImpactOf(draft, true, 'lots', `Lot ${lot.lotNo} changed.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.requirements, (ctx) => {
    const { query, fixtures } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const all = state.requirements.map((row) => requirementOf(state, row));
    const q = query.q?.toLowerCase();
    const contradiction = (codes: readonly string[]): boolean =>
      codes.some((code) =>
        ['MANDATORY_GATE_ONLY_WARNS', 'INFORMATION_ONLY_REJECTS', 'RATED_WITHOUT_CRITERION', 'GATE_LINKED_TO_RATED_CRITERION', 'CRITERION_ENVELOPE_MISMATCH', 'DUPLICATE_REFERENCE_CODE'].includes(code),
      );
    const rows = all
      .filter((row) => q === undefined || `${row.refCode} ${row.text} ${row.section}`.toLowerCase().includes(q))
      .filter((row) => query.lotId === undefined || row.lot?.id === query.lotId)
      .filter((row) => query.tenderLevel !== true || row.lot === null)
      .filter((row) => query.section === undefined || row.section === query.section)
      .filter((row) => query.treatment === undefined || query.treatment.includes(row.treatment))
      .filter((row) => query.envelope === undefined || query.envelope.includes(row.envelope))
      .filter((row) => query.ownerUserId === undefined || row.owner?.userId === query.ownerUserId)
      .filter((row) => {
        const codes = row.issues.map((issue) => issue.code);
        switch (query.issue) {
          case 'any':
            return codes.length > 0;
          case 'missing_owner':
            return codes.includes('REQUIREMENT_OWNER_MISSING');
          case 'contradiction':
            return contradiction(codes);
          default:
            return true;
        }
      });
    const key = query.sort ?? 'sortOrder';
    const direction = query.dir === 'desc' ? -1 : 1;
    const sorted = [...rows].sort((a, b) => {
      const left = key === 'sortOrder' ? a.sortOrder : a[key];
      const right = key === 'sortOrder' ? b.sortOrder : b[key];
      return (left < right ? -1 : left > right ? 1 : 0) * direction || a.sortOrder - b.sortOrder;
    });
    return {
      ...fixtures.page(sorted),
      summary: {
        total: all.length,
        mandatoryGates: all.filter((row) => row.treatment === 'mandatory_gate').length,
        rated: all.filter((row) => row.treatment === 'rated').length,
        informationOnly: all.filter((row) => row.treatment === 'information_only').length,
        missingOwner: all.filter((row) => row.owner === null).length,
        contradictions: all.filter((row) => contradiction(row.issues.map((issue) => issue.code))).length,
      },
      sections: [...new Set(all.map((row) => row.section))],
      envelopes: state.envelopes.map((row) => row.envelope),
    };
  });

  function checkRequirementRefs(
    ctx: Ctx,
    state: TenderState,
    fields: { lotId?: number | null | undefined; criterionId?: number | null | undefined; ownerUserId?: number | null | undefined; refCode?: string | undefined },
    selfId: number | null,
  ): void {
    if (fields.refCode !== undefined && state.requirements.some((row) => row.refCode === fields.refCode && row.id !== selfId)) {
      ctx.fail(409, 'REF_CODE_TAKEN', `${fields.refCode} is already used on this tender.`);
    }
    if (fields.lotId !== undefined && fields.lotId !== null && !state.lots.some((lot) => lot.id === fields.lotId)) {
      ctx.fail(422, 'LOT_NOT_FOUND', 'No such lot on this tender.');
    }
    if (
      fields.criterionId !== undefined &&
      fields.criterionId !== null &&
      !state.plans.some((plan) => plan.criteria.some((criterion) => criterion.id === fields.criterionId))
    ) {
      ctx.fail(422, 'CRITERION_NOT_FOUND', 'No such criterion in the evaluation plan.');
    }
    if (fields.ownerUserId !== undefined && fields.ownerUserId !== null && !eligibleOwner(state.tender.tenantId, fields.ownerUserId, 'tender.view')) {
      ctx.fail(422, 'OWNER_NOT_ELIGIBLE', 'The requirement owner must be a member who may view tenders.');
    }
  }

  mockRoute(app, tenderEndpoints.createRequirement, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    checkRequirementRefs(ctx, state, body, null);
    const requirement: FxRequirement = {
      id: NEW_ID,
      tenantId: state.tender.tenantId,
      tenderId: state.tender.id,
      lotId: body.lotId ?? null,
      section: body.section,
      refCode: body.refCode,
      text: body.text,
      ownerUserId: body.ownerUserId ?? null,
      applicability: body.applicability ?? null,
      responseType: body.responseType,
      choices: body.choices ?? [],
      responseInstructions: body.responseInstructions ?? null,
      evidenceRequired: body.evidenceRequired ?? null,
      treatment: body.treatment,
      envelope: body.envelope,
      missingConsequence: body.missingConsequence,
      criterionId: body.criterionId ?? null,
      sortOrder: body.sortOrder ?? Math.max(0, ...state.requirements.map((row) => row.sortOrder)) + 10,
    };
    const draft = { ...state, requirements: [...state.requirements, requirement] };
    return {
      requirement: requirementOf(bumped(draft, true, now), requirement),
      change: changeImpactOf(draft, true, 'requirements', `${requirement.refCode} added.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.updateRequirement, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = state.requirements.find((row) => row.id === ctx.params.requirementId);
    if (existing === undefined) {
      return ctx.notFound('No such requirement on this tender.');
    }
    requireEditable(ctx, state);
    checkRequirementRefs(ctx, state, body, existing.id);
    const requirement = applyPatch(existing, body);
    const draft = { ...state, requirements: state.requirements.map((row) => (row.id === requirement.id ? requirement : row)) };
    return {
      requirement: requirementOf(bumped(draft, true, now), requirement),
      change: changeImpactOf(draft, true, 'requirements', `${requirement.refCode} changed.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.removeRequirement, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = state.requirements.find((row) => row.id === ctx.params.requirementId);
    if (existing === undefined) {
      return ctx.notFound('No such requirement on this tender.');
    }
    requireEditable(ctx, state);
    return {
      removedId: existing.id,
      change: changeImpactOf(state, true, 'requirements', `${existing.refCode} removed.`, ctx.now),
    };
  });

  // -------------------------------------------------------------------------------------------------------
  // Pricing and commercial terms (BUY-10)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, tenderEndpoints.pricing, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const { tender } = state;
    return {
      tenderId: tender.id,
      currency: tender.currency,
      acceptedCurrencies: [...tender.acceptedCurrencies],
      bidValidityDays: tender.bidValidityDays,
      alternativesAllowed: tender.alternativesAllowed,
      schedules: state.schedules.map((schedule) => scheduleOf(state, schedule)),
      terms: termsOf(tender.id),
      affordability: affordabilityOf(state),
      issues: pricingIssues(state),
    };
  });

  function scheduleIn(ctx: Ctx, state: TenderState, scheduleId: number): FxPricingSchedule {
    const schedule = state.schedules.find((row) => row.id === scheduleId);
    return schedule ?? ctx.notFound('No such pricing schedule on this tender.');
  }

  mockRoute(app, tenderEndpoints.createPricingSchedule, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    if (body.lotId !== undefined && body.lotId !== null && !state.lots.some((lot) => lot.id === body.lotId)) {
      ctx.fail(422, 'LOT_NOT_FOUND', 'No such lot on this tender.');
    }
    const schedule: FxPricingSchedule = {
      id: NEW_ID,
      tenantId: state.tender.tenantId,
      tenderId: state.tender.id,
      lotId: body.lotId ?? null,
      name: body.name,
      instructions: body.instructions ?? null,
      taxTreatment: body.taxTreatment ?? null,
      evaluationPeriods: body.evaluationPeriods ?? null,
      discountsAccepted: body.discountsAccepted ?? [],
      discountEvaluationNote: body.discountEvaluationNote ?? null,
      priceEntries: body.priceEntries ?? DEFAULT_PRICE_ENTRIES,
      items: [],
    };
    const draft = { ...state, schedules: [...state.schedules, schedule] };
    return {
      schedule: scheduleOf(bumped(draft, true, now), schedule),
      change: changeImpactOf(draft, true, 'pricing', `Pricing schedule “${schedule.name}” added.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.updatePricingSchedule, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = scheduleIn(ctx, state, ctx.params.scheduleId);
    requireEditable(ctx, state);
    if (body.lotId !== undefined && body.lotId !== null && !state.lots.some((lot) => lot.id === body.lotId)) {
      ctx.fail(422, 'LOT_NOT_FOUND', 'No such lot on this tender.');
    }
    const schedule = applyPatch(existing, body);
    const draft = { ...state, schedules: state.schedules.map((row) => (row.id === schedule.id ? schedule : row)) };
    return {
      schedule: scheduleOf(bumped(draft, true, now), schedule),
      change: changeImpactOf(draft, true, 'pricing', `Pricing schedule “${schedule.name}” changed.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.createPricingItem, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const schedule = scheduleIn(ctx, state, ctx.params.scheduleId);
    requireEditable(ctx, state);
    if (schedule.items.some((item) => item.itemCode === body.itemCode)) {
      ctx.fail(409, 'ITEM_CODE_TAKEN', `${body.itemCode} is already used in this schedule.`);
    }
    const item: FxPricingItem = {
      id: NEW_ID,
      itemCode: body.itemCode,
      description: body.description,
      unit: body.unit,
      quantity: body.quantity,
      chargeType: body.chargeType,
      recurrence: body.recurrence ?? null,
      isOptional: body.isOptional,
      isProvisional: body.isProvisional,
      includeInEvaluation: body.includeInEvaluation,
      sortOrder: body.sortOrder ?? Math.max(0, ...schedule.items.map((row) => row.sortOrder)) + 10,
    };
    return {
      scheduleId: schedule.id,
      item,
      change: changeImpactOf(state, true, 'pricing', `Pricing item ${item.itemCode} added.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.updatePricingItem, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const schedule = scheduleIn(ctx, state, ctx.params.scheduleId);
    const existing = schedule.items.find((row) => row.id === ctx.params.itemId);
    if (existing === undefined) {
      return ctx.notFound('No such pricing item in this schedule.');
    }
    requireEditable(ctx, state);
    if (body.itemCode !== undefined && schedule.items.some((row) => row.itemCode === body.itemCode && row.id !== existing.id)) {
      ctx.fail(409, 'ITEM_CODE_TAKEN', `${body.itemCode} is already used in this schedule.`);
    }
    const merged = applyPatch(existing, body);
    const item: FxPricingItem = merged.chargeType === 'one_time' ? { ...merged, recurrence: null } : { ...merged, recurrence: merged.recurrence ?? 'monthly' };
    return {
      scheduleId: schedule.id,
      item,
      change: changeImpactOf(state, true, 'pricing', `Pricing item ${item.itemCode} changed.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.upsertTerm, (ctx) => {
    const { body, now, params } = ctx;
    const state = tenderState(ctx, params.tenderId);
    requireEditable(ctx, state);
    const documentId = body.documentId ?? null;
    const doc = documentId === null ? undefined : PACKAGE_DOCUMENTS.find((row) => row.documentId === documentId && row.tenderId === state.tender.id);
    if (documentId !== null && doc === undefined) {
      ctx.fail(422, 'DOCUMENT_NOT_FOUND', 'The document is not part of this tender package.');
    }
    const existing = TENDER_TERMS.find((row) => row.tenderId === state.tender.id && row.termType === params.termType);
    return {
      term: {
        id: existing?.id ?? NEW_ID,
        termType: params.termType,
        content: body.content,
        document: doc === undefined ? null : { documentId: doc.documentId, title: doc.title },
        updatedAt: iso(now),
      },
      change: changeImpactOf(state, true, 'terms', `${enumLabel('tender_terms.term_type', params.termType)} terms changed.`, now),
    };
  });

  // -------------------------------------------------------------------------------------------------------
  // Evaluation plan (BUY-11)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, tenderEndpoints.evaluationPlans, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    return {
      tenderId: state.tender.id,
      currency: state.tender.currency,
      plans: state.plans.map((plan) => planOf(state, plan)),
      ratedRequirementsWithoutCriterion: state.requirements.filter((row) => row.treatment === 'rated' && row.criterionId === null).length,
      mandatoryGateCount: state.requirements.filter((row) => row.treatment === 'mandatory_gate').length,
    };
  });

  function planIn(ctx: Ctx, state: TenderState, planId: number): FxEvaluationPlan {
    return state.plans.find((row) => row.id === planId) ?? ctx.notFound('No such evaluation plan on this tender.');
  }

  mockRoute(app, tenderEndpoints.updateEvaluationPlan, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = planIn(ctx, state, ctx.params.planId);
    requireEditable(ctx, state);
    if (body.expectedVersion !== existing.version) {
      ctx.fail(409, 'PLAN_VERSION_CONFLICT', `The plan is at version ${existing.version}; reload it.`);
    }
    const wasApproved = existing.status !== 'draft';
    const note = body.amendmentNote ?? null;
    if (wasApproved && (note === null || note.trim() === '')) {
      ctx.fail(422, 'AMENDMENT_NOTE_REQUIRED', 'The plan is approved: describe the amendment so it is shown explicitly.');
    }
    const persona = ctx.requirePersona();
    const idByCode = new Map<string, number>();
    body.criteria.forEach((criterion, index) => {
      idByCode.set(criterion.code, existing.criteria.find((row) => row.code === criterion.code)?.id ?? NEW_ID + index);
    });
    const criteria: FxCriterion[] = body.criteria.map((criterion, index) => ({
      id: idByCode.get(criterion.code) ?? NEW_ID + index,
      parentId: criterion.parentCode === undefined || criterion.parentCode === null ? null : (idByCode.get(criterion.parentCode) ?? null),
      code: criterion.code,
      name: criterion.name,
      description: criterion.description ?? null,
      maxPoints: criterion.maxPoints,
      isPrice: criterion.isPrice,
      minScore: criterion.minScore ?? null,
      scoringGuidance: criterion.scoringGuidance ?? null,
      envelope: criterion.envelope,
      naPermitted: criterion.naPermitted,
      sortOrder: (index + 1) * 10,
    }));
    const version = wasApproved ? existing.version + 1 : existing.version;
    const plan: FxEvaluationPlan = {
      ...existing,
      status: wasApproved ? 'amended' : 'draft',
      version,
      scaleMax: body.scaleMax,
      aggregationMethod: body.aggregationMethod,
      priceMethod: body.priceMethod,
      priceWeight: body.priceWeight ?? null,
      priceFormulaNote: body.priceFormulaNote ?? null,
      zeroPriceTreatment: body.zeroPriceTreatment ?? null,
      missingPriceTreatment: body.missingPriceTreatment ?? null,
      thresholdScope: body.thresholdScope,
      nonPriceThreshold: body.nonPriceThreshold ?? null,
      decimalPlacesCalc: body.decimalPlacesCalc,
      decimalPlacesDisplay: body.decimalPlacesDisplay,
      comparisonCurrency: body.comparisonCurrency ?? null,
      fxSource: body.fxSource ?? null,
      fxDate: body.fxDate ?? null,
      criteria,
      anchors: body.anchors.map((anchor) => ({ value: anchor.value, label: anchor.label, description: anchor.description ?? null })),
      tieBreakRules: body.tieBreakRules.map((rule) => ({
        sequence: rule.sequence,
        rule: rule.rule,
        criterionId: rule.criterionCode === undefined || rule.criterionCode === null ? null : (idByCode.get(rule.criterionCode) ?? null),
      })),
      amendments:
        wasApproved && note !== null ? [...existing.amendments, { version, amendedAt: iso(now), amendedBy: persona.userId, note }] : existing.amendments,
    };
    const draft = { ...state, plans: state.plans.map((row) => (row.id === plan.id ? plan : row)) };
    return {
      plan: planOf(bumped(draft, true, now), plan),
      change: changeImpactOf(draft, true, 'evaluation_plan', wasApproved ? `evaluation plan amended (version ${version}).` : 'evaluation plan changed.', now),
    };
  });

  mockRoute(app, tenderEndpoints.approveEvaluationPlan, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = planIn(ctx, state, ctx.params.planId);
    requireEditable(ctx, state);
    if (body.expectedVersion !== existing.version) {
      ctx.fail(409, 'PLAN_VERSION_CONFLICT', `The plan is at version ${existing.version}; reload it.`);
    }
    if (existing.status !== 'draft') {
      ctx.fail(409, 'PLAN_ALREADY_APPROVED', 'This version of the plan is already approved.');
    }
    const blocking = issuesOfPlan(existing).filter((issue) => issue.severity === 'blocking' && issue.code !== 'PLAN_NOT_APPROVED');
    if (blocking.length > 0) {
      ctx.fail(409, 'PLAN_HAS_BLOCKING_ISSUES', blocking.map((issue) => issue.message).join(' '));
    }
    const persona = ctx.requirePersona();
    if (persona.userId === state.tender.ownerUserId) {
      ctx.fail(409, 'SELF_APPROVAL_NOT_PERMITTED', 'The tender owner cannot approve its own evaluation plan.');
    }
    const plan: FxEvaluationPlan = { ...existing, status: 'approved', approvedAt: iso(now), approvedBy: persona.userId };
    const draft = { ...state, plans: state.plans.map((row) => (row.id === plan.id ? plan : row)) };
    return { plan: planOf(draft, plan), change: changeImpactOf(draft, false, 'evaluation_plan', 'evaluation plan approved.', now) };
  });

  // -------------------------------------------------------------------------------------------------------
  // Timetable and participation (BUY-12)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, tenderEndpoints.timetable, (ctx) => timetableOf(tenderState(ctx, ctx.params.tenderId)));

  mockRoute(app, tenderEndpoints.updateTimetable, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    requireRevision(ctx, state, body.expectedDraftRevision);
    const calendarId = body.calendarId === undefined ? state.tender.calendarId : body.calendarId;
    if (calendarId !== null && !CALENDARS.some((row) => row.id === calendarId && row.tenantId === state.tender.tenantId)) {
      ctx.fail(422, 'CALENDAR_NOT_FOUND', 'No such working-day calendar in your organization.');
    }
    const milestones: FxMilestone[] = body.milestones.map((row, index) => {
      const lotId = row.lotId ?? null;
      if (lotId !== null && !state.lots.some((lot) => lot.id === lotId)) {
        ctx.fail(422, 'LOT_NOT_FOUND', 'A milestone names a lot that is not on this tender.');
      }
      const existing = state.milestones.find((candidate) => candidate.milestone === row.milestone && candidate.lotId === lotId);
      return {
        id: existing?.id ?? NEW_ID + index,
        tenantId: state.tender.tenantId,
        tenderId: state.tender.id,
        lotId,
        milestone: row.milestone,
        at: row.at,
        isDisclosed: row.isDisclosed,
        note: row.note ?? null,
      };
    });
    const tender: FxTender = {
      ...state.tender,
      officialTimeZone: body.officialTimeZone ?? state.tender.officialTimeZone,
      calendarId,
      scheduledReleaseAt: body.scheduledReleaseAt === undefined ? state.tender.scheduledReleaseAt : body.scheduledReleaseAt,
    };
    const draft = { ...state, tender, milestones };
    return {
      timetable: timetableOf(bumped(draft, true, now)),
      change: changeImpactOf(draft, true, 'timetable', 'timetable changed.', now),
    };
  });

  mockRoute(app, tenderEndpoints.updateEnvelopes, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    requireRevision(ctx, state, body.expectedDraftRevision);
    const kept = new Set(body.envelopes.map((row) => row.envelope));
    const orphaned = state.requirements.filter((row) => !kept.has(row.envelope));
    if (orphaned.length > 0) {
      ctx.fail(409, 'ENVELOPE_IN_USE', `Requirements still use a removed envelope: ${orphaned.map((row) => row.refCode).join(', ')}.`);
    }
    const draft: TenderState = {
      ...state,
      tender: { ...state.tender, openingMode: body.openingMode },
      envelopes: body.envelopes.map((row) => ({ tenantId: state.tender.tenantId, tenderId: state.tender.id, envelope: row.envelope, openOrder: row.openOrder })),
    };
    return {
      timetable: timetableOf(bumped(draft, true, now)),
      change: changeImpactOf(draft, true, 'timetable', 'envelopes and opening mode changed.', now),
    };
  });

  function checkProgram(ctx: Ctx, state: TenderState, programId: number | null | undefined): void {
    if (programId !== undefined && programId !== null && !QUALIFICATION_PROGRAMS.some((row) => row.id === programId && row.tenantId === state.tender.tenantId)) {
      ctx.fail(422, 'QUALIFICATION_PROGRAM_NOT_FOUND', 'No such qualification program in your organization.');
    }
  }

  function conditionOut(row: FxCondition) {
    const program = QUALIFICATION_PROGRAMS.find((candidate) => candidate.id === row.qualificationProgramId);
    return {
      id: row.id,
      conditionType: row.conditionType,
      description: row.description,
      qualificationProgram: program === undefined ? null : { id: program.id, name: program.name },
      sessionId: row.sessionId,
      blocking: row.blocking,
    };
  }

  mockRoute(app, tenderEndpoints.createCondition, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    checkProgram(ctx, state, body.qualificationProgramId);
    const programId = body.qualificationProgramId ?? null;
    if (state.conditions.some((row) => row.conditionType === body.conditionType && row.qualificationProgramId === programId)) {
      ctx.fail(409, 'CONDITION_DUPLICATE', 'The tender already has this participation condition.');
    }
    const row: FxCondition = {
      id: NEW_ID,
      tenantId: state.tender.tenantId,
      tenderId: state.tender.id,
      conditionType: body.conditionType,
      description: body.description,
      qualificationProgramId: programId,
      sessionId: body.sessionId ?? null,
      blocking: body.blocking,
    };
    return {
      condition: conditionOut(row),
      change: changeImpactOf(state, true, 'participation', `${enumLabel('participation_conditions.condition_type', row.conditionType)} condition added.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.updateCondition, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = state.conditions.find((row) => row.id === ctx.params.conditionId);
    if (existing === undefined) {
      return ctx.notFound('No such participation condition on this tender.');
    }
    requireEditable(ctx, state);
    checkProgram(ctx, state, body.qualificationProgramId);
    const row = applyPatch(existing, body);
    return {
      condition: conditionOut(row),
      change: changeImpactOf(state, true, 'participation', `${enumLabel('participation_conditions.condition_type', row.conditionType)} condition changed.`, now),
    };
  });

  mockRoute(app, tenderEndpoints.removeCondition, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const existing = state.conditions.find((row) => row.id === ctx.params.conditionId);
    if (existing === undefined) {
      return ctx.notFound('No such participation condition on this tender.');
    }
    requireEditable(ctx, state);
    return {
      removedId: existing.id,
      change: changeImpactOf(state, true, 'participation', `${enumLabel('participation_conditions.condition_type', existing.conditionType)} condition removed.`, ctx.now),
    };
  });

  // -------------------------------------------------------------------------------------------------------
  // Release review (BUY-13)
  // -------------------------------------------------------------------------------------------------------

  mockRoute(app, tenderEndpoints.releaseReview, (ctx) => {
    const state = tenderState(ctx, ctx.params.tenderId);
    const { tender } = state;
    const items = readinessItems(state);
    const latest = latestApproval(state);
    return {
      tenderId: tender.id,
      reference: tender.reference,
      title: tender.title,
      status: tender.status,
      draftRevision: tender.draftRevision,
      contentHash: revisionHash(tender.id, tender.draftRevision),
      currentVersionNo: tender.currentVersionNo,
      scheduledReleaseAt: tender.scheduledReleaseAt,
      officialTimeZone: tender.officialTimeZone,
      acceptedLanguages: [...tender.acceptedLanguages],
      checks: releaseChecksOf(state),
      readiness: items,
      summary: countsOf(items),
      packageDocuments: packageDocumentsOf(tender.id),
      missingLanguageEditions: missingLanguageEditions(tender),
      releaseApproval: latest === null ? null : approvalState(latest, tender),
      approvalHistory: [...state.approvals].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map((row) => approvalState(row, tender)),
      materialChanges: materialChangesOf(tender.id),
      corrections: correctionsOf(state),
      gate: gateOf(state, items),
    };
  });

  mockRoute(app, tenderEndpoints.recordReleaseCheck, (ctx) => {
    const { body, params, now } = ctx;
    const state = tenderState(ctx, params.tenderId);
    requireEditable(ctx, state);
    if (body.draftRevision !== state.tender.draftRevision) {
      ctx.fail(409, 'CHECK_REVISION_STALE', `The package is now at revision ${state.tender.draftRevision}; review that revision.`);
    }
    const persona = ctx.requirePersona();
    const row: FxReleaseCheck = {
      id: NEW_ID,
      tenantId: state.tender.tenantId,
      tenderId: state.tender.id,
      checkArea: params.checkArea,
      status: body.status,
      reviewerUserId: persona.userId,
      note: body.note ?? null,
      draftRevision: state.tender.draftRevision,
      checkedAt: iso(now),
    };
    const draft = { ...state, checks: [...state.checks, row] };
    const items = readinessItems(draft);
    const check = releaseChecksOf(draft).find((candidate) => candidate.checkArea === params.checkArea);
    if (check === undefined) {
      return ctx.notFound();
    }
    return { check, summary: countsOf(items), gate: gateOf(draft, items) };
  });

  mockRoute(app, tenderEndpoints.preview, (ctx) => previewOf(tenderState(ctx, ctx.params.tenderId), ctx.query.audience));

  mockRoute(app, tenderEndpoints.requestCorrection, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    if (!state.team.some((row) => row.userId === body.assigneeUserId && row.removedAt === null)) {
      ctx.fail(422, 'ASSIGNEE_NOT_ON_TEAM', 'Assign the correction to a member of the tender team.');
    }
    const lotId = body.lotId ?? null;
    const lot = lotId === null ? undefined : state.lots.find((row) => row.id === lotId);
    if (lotId !== null && lot === undefined) {
      ctx.fail(422, 'LOT_NOT_FOUND', 'No such lot on this tender.');
    }
    const persona = ctx.requirePersona();
    return {
      id: NEW_ID,
      section: body.section,
      lot: lot === undefined ? null : { id: lot.id, lotNo: lot.lotNo, title: lot.title },
      note: body.note,
      assignee: personRef(body.assigneeUserId),
      requestedBy: personRef(persona.userId),
      requestedAt: iso(now),
      status: 'open',
      resolvedAt: null,
    };
  });

  mockRoute(app, tenderEndpoints.requestReleaseApproval, (ctx) => {
    const { body, now } = ctx;
    const state = tenderState(ctx, ctx.params.tenderId);
    requireEditable(ctx, state);
    const { tender } = state;
    if (body.draftRevision !== tender.draftRevision || body.contentHash !== revisionHash(tender.id, tender.draftRevision)) {
      ctx.fail(409, 'REVISION_CONFLICT', `The package changed: it is now revision ${tender.draftRevision}. Review it again before requesting approval.`);
    }
    const latest = latestApproval(state);
    if (latest !== null && latest.subjectVersion === tender.draftRevision && latest.status === 'pending') {
      ctx.fail(409, 'RELEASE_APPROVAL_PENDING', `Release approval #${latest.approvalId} for this revision is already pending.`);
    }
    if (latest !== null && latest.subjectVersion === tender.draftRevision && latest.status === 'approved') {
      ctx.fail(409, 'RELEASE_ALREADY_APPROVED', `Release approval #${latest.approvalId} already covers this revision.`);
    }
    const missingCustom = customFieldIssues(tender.tenantId, 'tender', tenderCustomValues(tender), tenderCustomContext(tender), true);
    if (missingCustom.length > 0) {
      ctx.fail(409, 'RELEASE_NOT_READY', `Complete the additional information: ${missingCustom.map((issue) => issue.message).join(' ')}`);
    }
    const blocking = readinessItems(state).filter((item) => item.status === 'blocking');
    if (blocking.length > 0) {
      ctx.fail(
        409,
        'RELEASE_NOT_READY',
        `${blocking.length} blocking readiness ${blocking.length === 1 ? 'item' : 'items'}: ${blocking.map((item) => item.title).join(' ')}`,
      );
    }
    const persona = ctx.requirePersona();
    const approval = {
      approvalId: NEW_ID,
      tenantId: tender.tenantId,
      tenderId: tender.id,
      status: 'pending' as const,
      subjectVersion: tender.draftRevision,
      contentHash: revisionHash(tender.id, tender.draftRevision),
      amount: tender.estimatedValue,
      requestedBy: persona.userId,
      requestedAt: iso(now),
      decidedBy: null,
      decidedAt: null,
      invalidatedAt: null,
      invalidationReason: null,
    };
    const requested: TenderState = {
      ...state,
      tender: { ...tender, status: 'awaiting_release_approval' },
      approvals: [...state.approvals, approval],
    };
    const items = readinessItems(requested);
    return {
      tenderId: tender.id,
      tenderStatus: 'awaiting_release_approval',
      draftRevision: tender.draftRevision,
      approval: approvalState(approval, tender),
      approvalLink: `/me/approvals/${NEW_ID}`,
      readiness: items,
      summary: countsOf(items),
      gate: gateOf(requested, items),
    };
  });
}
