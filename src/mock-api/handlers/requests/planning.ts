/**
 * Requests domain handlers (05): procurement plan, calendar, resource demand and advance notices (BUY-05), and the
 * public edition of advance notices (PUB-06). The public sees only published notices of buyers whose portal shows
 * advance notices. Nothing is persisted.
 */
import type { Money } from '../../../contracts/common.js';
import type { PlanItemsStatus } from '../../../contracts/enums.js';
import { monthsBetween, publicNoticePath, requestEndpoints } from '../../../contracts/requests.js';
import type {
  AdvanceNoticeDetail,
  AdvanceNoticeRow,
  PlanCalendarEntry,
  PlanItemDetail,
  PlanItemRow,
  PublicAdvanceNotice,
  ReadinessItem,
} from '../../../contracts/requests.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import { mockRoute } from '../../app.js';
import type { MockApp, MockHandlerContext } from '../../app.js';
import {
  ADVANCE_NOTICES,
  CATEGORIES,
  CONTRACTS,
  DEPARTMENTS,
  OWNER_CAPACITY_DAYS,
  PLAN_ITEMS,
  PORTAL_SHOWS_ADVANCE_NOTICES,
  PROJECTS,
  REQUESTS,
} from '../../fixtures/requests/index.js';
import type { FixtureAdvanceNotice, FixturePlanItem, FixtureRequest } from '../../fixtures/requests/index.js';
import { allTenants, findTenantById, findTenantBySlug, personRef } from '../../persona.js';
import {
  NEW_ID,
  categoryRef,
  dateInZone,
  departmentRef,
  hasPermission,
  matchesSearch,
  personOrNull,
  projectRef,
  requestRef,
  sortRows,
  tenantPeople,
  tenantTimeZone,
  tenderRef,
} from './lookup.js';
import type { SortValue } from './lookup.js';
import { canSeeRequest, viewerOf } from './requests.js';
import type { Viewer } from './requests.js';

const PRIORITY_ORDER = { low: 0, normal: 1, high: 2, critical: 3 } as const;
/** Plan statuses that consume procurement capacity. */
const ACTIVE_PLAN_STATUSES: readonly PlanItemsStatus[] = ['planned', 'scheduled', 'in_progress'];
const LOCKED_PLAN_STATUSES: readonly PlanItemsStatus[] = ['released', 'cancelled'];

function nowIso(now: Date): string {
  return `${now.toISOString().slice(0, 19)}Z`;
}

function monthOf(date: string | null): string | null {
  return date === null ? null : date.slice(0, 7);
}

/** Planned demand (days) per owner in a month: each item's effort counts in its planned release month. */
function ownerDemand(tenantId: number, ownerUserId: number, month: string, items: readonly FixturePlanItem[] = PLAN_ITEMS): number {
  return items
    .filter((item) => item.tenantId === tenantId && item.ownerUserId === ownerUserId && ACTIVE_PLAN_STATUSES.includes(item.status))
    .filter((item) => monthOf(item.plannedReleaseDate) === month)
    .reduce((total, item) => total + item.resourceDemandDays, 0);
}

function capacityOf(userId: number): number {
  return OWNER_CAPACITY_DAYS[userId] ?? 12;
}

function noticeOfItem(item: FixturePlanItem): FixtureAdvanceNotice | undefined {
  const notices = ADVANCE_NOTICES.filter((notice) => notice.planItemId === item.id && notice.tenantId === item.tenantId);
  return notices.find((notice) => notice.status !== 'withdrawn') ?? notices[0];
}

function planItemWarnings(item: FixturePlanItem): string[] {
  const warnings: string[] = [];
  const dependency = PLAN_ITEMS.find((candidate) => candidate.id === item.dependsOnId && candidate.tenantId === item.tenantId);
  if (
    dependency !== undefined &&
    dependency.plannedReleaseDate !== null &&
    item.plannedReleaseDate !== null &&
    dependency.plannedReleaseDate > item.plannedReleaseDate
  ) {
    warnings.push(`Depends on “${dependency.title}”, planned for release later (${dependency.plannedReleaseDate}).`);
  }
  if (dependency !== undefined && (dependency.status === 'deferred' || dependency.status === 'cancelled')) {
    warnings.push(`Depends on “${dependency.title}”, which is ${dependency.status}.`);
  }
  const month = monthOf(item.plannedReleaseDate);
  if (item.ownerUserId !== null && month !== null && ACTIVE_PLAN_STATUSES.includes(item.status)) {
    const demand = ownerDemand(item.tenantId, item.ownerUserId, month);
    const capacity = capacityOf(item.ownerUserId);
    if (demand > capacity) {
      warnings.push(`${personRef(item.ownerUserId).fullName} is over capacity in ${month} (${demand} of ${capacity} days).`);
    }
  }
  if (item.ownerUserId === null && ACTIVE_PLAN_STATUSES.includes(item.status)) {
    warnings.push('No owner is allocated.');
  }
  const contract = CONTRACTS.find((candidate) => candidate.id === item.expiringContractId && candidate.tenantId === item.tenantId);
  if (contract !== undefined && item.plannedAwardDate !== null && item.plannedAwardDate > contract.expiresOn) {
    warnings.push(`The planned award is after ${contract.reference} expires (${contract.expiresOn}).`);
  }
  return warnings;
}

/**
 * The linked request, only when the viewer may read it (PRD §4.3): a draft stays private to its parties and a
 * requester-only reader sees only their own requests.
 */
function visibleRequestRef(item: FixturePlanItem, viewer: Viewer): PlanItemRow['request'] {
  const row = REQUESTS.find((candidate) => candidate.id === item.requestId && candidate.tenantId === item.tenantId);
  return row === undefined || !canSeeRequest(row, viewer) ? null : requestRef(item.tenantId, item.requestId);
}

export function planItemRowOf(item: FixturePlanItem, viewer: Viewer): PlanItemRow {
  const dependency = PLAN_ITEMS.find((candidate) => candidate.id === item.dependsOnId && candidate.tenantId === item.tenantId);
  const notice = noticeOfItem(item);
  const contract = CONTRACTS.find((candidate) => candidate.id === item.expiringContractId && candidate.tenantId === item.tenantId);
  return {
    id: item.id,
    title: item.title,
    project: projectRef(item.tenantId, item.projectId),
    request: visibleRequestRef(item, viewer),
    category: categoryRef(item.tenantId, item.categoryId),
    department: departmentRef(item.tenantId, item.departmentId),
    owner: personOrNull(item.ownerUserId),
    budgetPeriod: item.budgetPeriod,
    expectedValue: item.expectedValue,
    plannedReleaseDate: item.plannedReleaseDate,
    plannedAwardDate: item.plannedAwardDate,
    resourceDemandDays: item.resourceDemandDays,
    priority: item.priority,
    dependsOn: dependency === undefined ? null : { id: dependency.id, title: dependency.title, status: dependency.status },
    status: item.status,
    tender: tenderRef(item.tenantId, item.tenderId),
    advanceNotice: notice === undefined ? null : { id: notice.id, title: notice.title, status: notice.status },
    expiringContract:
      contract === undefined ? null : { id: contract.id, reference: contract.reference, title: contract.title, expiresOn: contract.expiresOn },
    warnings: planItemWarnings(item),
  };
}

function planItemDetailOf(item: FixturePlanItem, viewer: Viewer): PlanItemDetail {
  const canManage = viewer.permissions.has('plan.manage');
  const locked = LOCKED_PLAN_STATUSES.includes(item.status);
  const notice = noticeOfItem(item);
  const actions: PlanItemDetail['allowedActions'] = [];
  if (canManage && !locked) {
    actions.push('edit');
    if (item.status === 'planned' && item.plannedReleaseDate !== null) {
      actions.push('schedule');
    }
    if (item.status !== 'deferred') {
      actions.push('defer');
    }
    actions.push('cancel');
    if ((item.status === 'planned' || item.status === 'scheduled' || item.status === 'in_progress') && (notice === undefined || notice.status === 'withdrawn')) {
      actions.push('create_notice');
    }
  }
  return {
    ...planItemRowOf(item, viewer),
    dependents: PLAN_ITEMS.filter((candidate) => candidate.dependsOnId === item.id && candidate.tenantId === item.tenantId).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      status: candidate.status,
    })),
    advanceNotices: ADVANCE_NOTICES.filter((candidate) => candidate.planItemId === item.id && candidate.tenantId === item.tenantId).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      status: candidate.status,
    })),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    allowedActions: actions,
  };
}

function noticeReadiness(notice: FixtureAdvanceNotice): ReadinessItem[] {
  const item = PLAN_ITEMS.find((candidate) => candidate.id === notice.planItemId);
  const scheduled = item !== undefined && (item.status === 'scheduled' || item.status === 'in_progress');
  const portal = PORTAL_SHOWS_ADVANCE_NOTICES[notice.tenantId] ?? false;
  return [
    { id: 'summary', label: 'Summary', status: notice.summary.length >= 10 ? 'passed' : 'blocking', detail: null },
    { id: 'indicativeTiming', label: 'Indicative timing', status: notice.indicativeTiming === '' ? 'blocking' : 'passed', detail: null },
    {
      id: 'eoiInstructions',
      label: 'Expression-of-interest instructions',
      status: notice.eoiInstructions === null ? 'blocking' : 'passed',
      detail: notice.eoiInstructions === null ? 'Tell suppliers how to express interest.' : null,
    },
    {
      id: 'estimatedValueBand',
      label: 'Estimated value band',
      status: notice.estimatedValueBand === null ? 'warning' : 'passed',
      detail: notice.estimatedValueBand === null ? 'Optional; helps suppliers plan capacity.' : null,
    },
    {
      id: 'planItem',
      label: 'Plan item scheduled',
      status: scheduled ? 'passed' : 'blocking',
      detail: scheduled ? null : 'Only scheduled or in-progress plan items can be announced.',
    },
    {
      id: 'portal',
      label: 'Public portal shows advance notices',
      status: portal ? 'passed' : 'blocking',
      detail: portal ? null : 'The organization’s portal settings do not show advance notices.',
    },
  ];
}

function noticeRowOf(notice: FixtureAdvanceNotice): AdvanceNoticeRow {
  const item = PLAN_ITEMS.find((candidate) => candidate.id === notice.planItemId);
  const tenant = findTenantById(notice.tenantId);
  return {
    id: notice.id,
    title: notice.title,
    summary: notice.summary,
    planItem: { id: notice.planItemId, title: item?.title ?? notice.title, status: item?.status ?? 'planned' },
    category: categoryRef(notice.tenantId, notice.categoryId),
    indicativeTiming: notice.indicativeTiming,
    estimatedValueBand: notice.estimatedValueBand,
    eoiInstructions: notice.eoiInstructions,
    status: notice.status,
    publishedAt: notice.publishedAt,
    publishedBy: personOrNull(notice.publishedByUserId),
    publicPath: notice.status === 'published' && tenant !== undefined ? publicNoticePath(tenant.slug, notice.id) : null,
    updatedAt: notice.updatedAt,
  };
}

function noticeDetailOf(notice: FixtureAdvanceNotice, canManage: boolean): AdvanceNoticeDetail {
  const actions: AdvanceNoticeDetail['allowedActions'] = [];
  if (canManage && notice.status === 'draft') {
    actions.push('edit');
    if (!noticeReadiness(notice).some((item) => item.status === 'blocking')) {
      actions.push('publish');
    }
  }
  if (canManage && notice.status === 'published') {
    actions.push('withdraw');
  }
  return {
    ...noticeRowOf(notice),
    withdrawnReason: notice.withdrawnReason,
    publishReadiness: noticeReadiness(notice),
    portalShowsAdvanceNotices: PORTAL_SHOWS_ADVANCE_NOTICES[notice.tenantId] ?? false,
    allowedActions: actions,
  };
}

function isPubliclyVisible(notice: FixtureAdvanceNotice): boolean {
  const tenant = findTenantById(notice.tenantId);
  return notice.status === 'published' && tenant !== undefined && tenant.kind === 'buyer' && tenant.status === 'active' && (PORTAL_SHOWS_ADVANCE_NOTICES[tenant.id] ?? false);
}

function publicNoticeOf(notice: FixtureAdvanceNotice): PublicAdvanceNotice | null {
  const tenant = findTenantById(notice.tenantId);
  const item = PLAN_ITEMS.find((candidate) => candidate.id === notice.planItemId);
  if (tenant === undefined || notice.publishedAt === null || !isPubliclyVisible(notice)) {
    return null;
  }
  const category = CATEGORIES.find((candidate) => candidate.id === notice.categoryId && candidate.tenantId === notice.tenantId);
  return {
    id: notice.id,
    buyer: { slug: tenant.slug, name: tenant.name },
    title: notice.title,
    summary: notice.summary,
    category: category === undefined ? null : { code: category.code, name: category.name },
    indicativeTiming: notice.indicativeTiming,
    estimatedValueBand: notice.estimatedValueBand,
    eoiInstructions: notice.eoiInstructions,
    planStatus: item?.status ?? 'planned',
    publishedAt: notice.publishedAt,
    path: publicNoticePath(tenant.slug, notice.id),
  };
}

function findItem<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, tenantId: number, planItemId: number): FixturePlanItem {
  const item = PLAN_ITEMS.find((candidate) => candidate.id === planItemId && candidate.tenantId === tenantId);
  return item ?? ctx.notFound('No such plan item.');
}

function findNotice<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, tenantId: number, noticeId: number): FixtureAdvanceNotice {
  const notice = ADVANCE_NOTICES.find((candidate) => candidate.id === noticeId && candidate.tenantId === tenantId);
  return notice ?? ctx.notFound('No such advance notice.');
}

interface PlanItemInput {
  readonly title: string;
  readonly projectId?: number | null | undefined;
  readonly requestId?: number | null | undefined;
  readonly categoryId?: number | null | undefined;
  readonly departmentId?: number | null | undefined;
  readonly ownerUserId?: number | null | undefined;
  readonly budgetPeriod: string;
  readonly expectedValue?: Money | null | undefined;
  readonly plannedReleaseDate?: string | null | undefined;
  readonly plannedAwardDate?: string | null | undefined;
  readonly resourceDemandDays: number;
  readonly priority: FixturePlanItem['priority'];
  readonly dependsOnId?: number | null | undefined;
}

/** Request states a plan item may reference: submitted and not closed out (a draft is still private). */
const PLANNABLE_REQUEST_STATUSES: readonly FixtureRequest['status'][] = ['submitted', 'under_review', 'information_requested', 'approved', 'deferred'];

function checkPlanReferences<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, viewer: Viewer, body: PlanItemInput, selfId: number | null): void {
  const tenantId = viewer.tenantId;
  const checks: [string, number | null | undefined, (id: number) => boolean][] = [
    ['projectId', body.projectId, (id) => PROJECTS.some((row) => row.id === id && row.tenantId === tenantId)],
    [
      'requestId',
      body.requestId,
      (id) => REQUESTS.some((row) => row.id === id && canSeeRequest(row, viewer) && PLANNABLE_REQUEST_STATUSES.includes(row.status)),
    ],
    ['categoryId', body.categoryId, (id) => CATEGORIES.some((row) => row.id === id && row.tenantId === tenantId)],
    ['departmentId', body.departmentId, (id) => DEPARTMENTS.some((row) => row.id === id && row.tenantId === tenantId)],
    ['dependsOnId', body.dependsOnId, (id) => id === selfId || PLAN_ITEMS.some((row) => row.id === id && row.tenantId === tenantId)],
  ];
  for (const [field, id, exists] of checks) {
    if (id !== null && id !== undefined && !exists(id)) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', `${field} does not name a record of this organization.`);
    }
  }
  const owner = body.ownerUserId;
  if (owner !== null && owner !== undefined) {
    const person = tenantPeople(tenantId).find((candidate) => candidate.userId === owner);
    if (person === undefined || !hasPermission(person, 'plan.manage')) {
      ctx.fail(422, 'OWNER_NOT_ELIGIBLE', 'The owner must be a member of this organization who can run procurements.');
    }
  }
  const dependsOnId = body.dependsOnId;
  if (dependsOnId !== null && dependsOnId !== undefined && selfId !== null) {
    let cursor: number | null = dependsOnId;
    const seen = new Set<number>();
    while (cursor !== null && !seen.has(cursor)) {
      if (cursor === selfId) {
        ctx.fail(409, 'DEPENDENCY_CYCLE', 'This dependency would make the plan items depend on each other in a loop.');
      }
      seen.add(cursor);
      const next: FixturePlanItem | undefined = PLAN_ITEMS.find((row) => row.id === cursor);
      cursor = next?.dependsOnId ?? null;
    }
  }
  const dependency = PLAN_ITEMS.find((row) => row.id === dependsOnId && row.tenantId === tenantId);
  const release = body.plannedReleaseDate ?? null;
  if (dependency !== undefined && dependency.plannedReleaseDate !== null && release !== null && release < dependency.plannedReleaseDate) {
    ctx.fail(409, 'DEPENDENCY_ORDER', `The release cannot precede “${dependency.title}” (${dependency.plannedReleaseDate}), which it depends on.`);
  }
}

function applyPlanInput(item: FixturePlanItem, body: PlanItemInput): FixturePlanItem {
  return {
    ...item,
    title: body.title,
    projectId: body.projectId ?? null,
    requestId: body.requestId ?? null,
    categoryId: body.categoryId ?? null,
    departmentId: body.departmentId ?? null,
    ownerUserId: body.ownerUserId ?? null,
    budgetPeriod: body.budgetPeriod,
    expectedValue: body.expectedValue ?? null,
    plannedReleaseDate: body.plannedReleaseDate ?? null,
    plannedAwardDate: body.plannedAwardDate ?? null,
    resourceDemandDays: body.resourceDemandDays,
    priority: body.priority,
    dependsOnId: body.dependsOnId ?? null,
  };
}

const PLAN_SORT_KEYS: Record<string, (row: PlanItemRow) => SortValue> = {
  title: (row) => row.title,
  plannedReleaseDate: (row) => row.plannedReleaseDate,
  plannedAwardDate: (row) => row.plannedAwardDate,
  expectedValue: (row) => row.expectedValue,
  priority: (row) => PRIORITY_ORDER[row.priority],
  status: (row) => row.status,
};

const NOTICE_SORT_KEYS: Record<string, (row: AdvanceNoticeRow) => SortValue> = {
  title: (row) => row.title,
  publishedAt: (row) => row.publishedAt,
  status: (row) => row.status,
  updatedAt: (row) => row.updatedAt,
};

function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  const [year = 0, month = 1] = from.split('-').map(Number);
  for (let index = 0; index < monthsBetween(from, to); index += 1) {
    const total = year * 12 + (month - 1) + index;
    months.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`);
  }
  return months;
}

export function registerPlanning(app: MockApp): void {
  const e = requestEndpoints;

  mockRoute(app, e.listPlanItems, (ctx) => {
    const viewer = viewerOf(ctx);
    const tenantId = viewer.tenantId;
    const { query } = ctx;
    const rows = PLAN_ITEMS.filter((item) => item.tenantId === tenantId)
      .filter((item) => query.status === undefined || query.status.includes(item.status))
      .filter((item) => query.priority === undefined || query.priority.includes(item.priority))
      .filter((item) => query.ownerUserId === undefined || item.ownerUserId === query.ownerUserId)
      .filter((item) => query.categoryId === undefined || item.categoryId === query.categoryId)
      .filter((item) => query.departmentId === undefined || item.departmentId === query.departmentId)
      .filter((item) => query.budgetPeriod === undefined || query.budgetPeriod === '' || item.budgetPeriod === query.budgetPeriod)
      .filter((item) => query.releaseFrom === undefined || (item.plannedReleaseDate !== null && item.plannedReleaseDate >= query.releaseFrom))
      .filter((item) => query.releaseTo === undefined || (item.plannedReleaseDate !== null && item.plannedReleaseDate <= query.releaseTo))
      .filter((item) => matchesSearch(query.q, [item.title]))
      .map((item) => planItemRowOf(item, viewer));
    const key = query.sort === undefined ? PLAN_SORT_KEYS.plannedReleaseDate : PLAN_SORT_KEYS[query.sort];
    return ctx.fixtures.page(sortRows(rows, key ?? null, query.sort === undefined ? 'asc' : query.dir));
  });

  mockRoute(app, e.getPlanItem, (ctx) => {
    const viewer = viewerOf(ctx);
    return planItemDetailOf(findItem(ctx, viewer.tenantId, ctx.params.planItemId), viewer);
  });

  mockRoute(app, e.createPlanItem, (ctx) => {
    const viewer = viewerOf(ctx);
    const tenantId = viewer.tenantId;
    checkPlanReferences(ctx, viewer, ctx.body, null);
    const now = nowIso(ctx.now);
    const base: FixturePlanItem = {
      id: NEW_ID,
      tenantId,
      title: ctx.body.title,
      projectId: null,
      requestId: null,
      categoryId: null,
      departmentId: null,
      ownerUserId: null,
      budgetPeriod: ctx.body.budgetPeriod,
      expectedValue: null,
      plannedReleaseDate: null,
      plannedAwardDate: null,
      resourceDemandDays: 0,
      priority: 'normal',
      dependsOnId: null,
      status: 'planned',
      tenderId: null,
      expiringContractId: null,
      createdAt: now,
      updatedAt: now,
    };
    return planItemDetailOf(applyPlanInput(base, ctx.body), viewer);
  });

  mockRoute(app, e.updatePlanItem, (ctx) => {
    const viewer = viewerOf(ctx);
    const tenantId = viewer.tenantId;
    const item = findItem(ctx, tenantId, ctx.params.planItemId);
    if (LOCKED_PLAN_STATUSES.includes(item.status)) {
      ctx.fail(409, 'PLAN_ITEM_LOCKED', `A ${item.status} plan item can no longer be changed.`);
    }
    if (ctx.body.dependsOnId === item.id) {
      ctx.fail(409, 'DEPENDENCY_CYCLE', 'A plan item cannot depend on itself.');
    }
    checkPlanReferences(ctx, viewer, ctx.body, item.id);
    const status = ctx.body.status ?? item.status;
    const release = ctx.body.plannedReleaseDate ?? null;
    if (status === 'scheduled' && release === null) {
      ctx.fail(422, 'SCHEDULE_DATE_REQUIRED', 'Set the planned release date before scheduling.');
    }
    return planItemDetailOf({ ...applyPlanInput(item, ctx.body), status, updatedAt: nowIso(ctx.now) }, viewer);
  });

  mockRoute(app, e.getPlanCalendar, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const { month, ownerUserId } = ctx.query;
    const timeZone = tenantTimeZone(tenantId);
    const items = PLAN_ITEMS.filter((item) => item.tenantId === tenantId && item.status !== 'cancelled').filter(
      (item) => ownerUserId === undefined || item.ownerUserId === ownerUserId,
    );
    const entries: PlanCalendarEntry[] = [];
    for (const item of items) {
      const link = `/buyer/planning/items/${item.id}`;
      if (monthOf(item.plannedReleaseDate) === month && item.plannedReleaseDate !== null) {
        entries.push({
          id: `release-${item.id}`,
          date: item.plannedReleaseDate,
          kind: 'planned_release',
          title: item.title,
          reference: tenderRef(tenantId, item.tenderId)?.reference ?? null,
          planItemId: item.id,
          owner: personOrNull(item.ownerUserId),
          link,
        });
      }
      if (monthOf(item.plannedAwardDate) === month && item.plannedAwardDate !== null) {
        entries.push({
          id: `award-${item.id}`,
          date: item.plannedAwardDate,
          kind: 'planned_award',
          title: item.title,
          reference: tenderRef(tenantId, item.tenderId)?.reference ?? null,
          planItemId: item.id,
          owner: personOrNull(item.ownerUserId),
          link,
        });
      }
    }
    if (ownerUserId === undefined) {
      for (const notice of ADVANCE_NOTICES.filter((candidate) => candidate.tenantId === tenantId && candidate.publishedAt !== null)) {
        const date = dateInZone(notice.publishedAt ?? '', timeZone);
        if (monthOf(date) === month) {
          entries.push({
            id: `notice-${notice.id}`,
            date,
            kind: 'advance_notice',
            title: notice.title,
            reference: null,
            planItemId: notice.planItemId,
            owner: personOrNull(notice.publishedByUserId),
            link: `/buyer/planning/notices/${notice.id}`,
          });
        }
      }
      for (const contract of CONTRACTS.filter((candidate) => candidate.tenantId === tenantId)) {
        if (monthOf(contract.expiresOn) === month) {
          entries.push({
            id: `expiry-${contract.id}`,
            date: contract.expiresOn,
            kind: 'contract_expiry',
            title: contract.title,
            reference: contract.reference,
            planItemId: null,
            owner: null,
            link: `/buyer/contracts/${contract.id}`,
          });
        }
        if (contract.renewalNoticeFrom !== null && monthOf(contract.renewalNoticeFrom) === month) {
          entries.push({
            id: `renewal-${contract.id}`,
            date: contract.renewalNoticeFrom,
            kind: 'renewal_notice',
            title: `${contract.title}: renewal notice window opens`,
            reference: contract.reference,
            planItemId: null,
            owner: null,
            link: `/buyer/contracts/${contract.id}`,
          });
        }
      }
    }
    entries.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
    const owners = [...new Set(items.map((item) => item.ownerUserId).filter((id): id is number => id !== null))];
    return {
      month,
      timeZone,
      entries,
      resourceDemand: owners
        .map((owner) => {
          const demandDays = ownerDemand(tenantId, owner, month, items);
          const capacityDays = capacityOf(owner);
          const itemCount = items.filter(
            (item) => item.ownerUserId === owner && monthOf(item.plannedReleaseDate) === month && ACTIVE_PLAN_STATUSES.includes(item.status),
          ).length;
          return { owner: personRef(owner), demandDays, capacityDays, overAllocated: demandDays > capacityDays, itemCount };
        })
        .filter((demand) => demand.itemCount > 0),
      unscheduledCount: items.filter((item) => item.plannedReleaseDate === null && ACTIVE_PLAN_STATUSES.includes(item.status)).length,
    };
  });

  mockRoute(app, e.getResourceDemand, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const months = monthRange(ctx.query.from, ctx.query.to);
    const items = PLAN_ITEMS.filter((item) => item.tenantId === tenantId && ACTIVE_PLAN_STATUSES.includes(item.status));
    const owners = [...new Set(items.map((item) => item.ownerUserId).filter((id): id is number => id !== null))].sort((a, b) => a - b);
    return {
      months,
      owners: owners.map((owner) => {
        const capacity = capacityOf(owner);
        return {
          owner: personRef(owner),
          capacityDaysPerMonth: capacity,
          months: months.map((month) => {
            const demandDays = ownerDemand(tenantId, owner, month, items);
            return { month, demandDays, overAllocated: demandDays > capacity };
          }),
        };
      }),
      unassigned: months.map((month) => ({
        month,
        demandDays: items
          .filter((item) => item.ownerUserId === null && monthOf(item.plannedReleaseDate) === month)
          .reduce((total, item) => total + item.resourceDemandDays, 0),
      })),
    };
  });

  mockRoute(app, e.listAdvanceNotices, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const { query } = ctx;
    const rows = ADVANCE_NOTICES.filter((notice) => notice.tenantId === tenantId)
      .filter((notice) => query.status === undefined || query.status.includes(notice.status))
      .filter((notice) => query.categoryId === undefined || notice.categoryId === query.categoryId)
      .filter((notice) => matchesSearch(query.q, [notice.title, notice.summary]))
      .map(noticeRowOf);
    const key = query.sort === undefined ? NOTICE_SORT_KEYS.updatedAt : NOTICE_SORT_KEYS[query.sort];
    return ctx.fixtures.page(sortRows(rows, key ?? null, query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, e.getAdvanceNotice, (ctx) => {
    const access = ctx.requireTenant();
    return noticeDetailOf(findNotice(ctx, access.tenant.id, ctx.params.noticeId), access.permissions.includes('plan.manage'));
  });

  mockRoute(app, e.createAdvanceNotice, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const item = PLAN_ITEMS.find((candidate) => candidate.id === ctx.body.planItemId && candidate.tenantId === tenantId);
    if (item === undefined) {
      return ctx.fail(422, 'REFERENCE_NOT_FOUND', 'planItemId does not name a plan item of this organization.');
    }
    if (!ACTIVE_PLAN_STATUSES.includes(item.status)) {
      ctx.fail(409, 'PLAN_ITEM_NOT_ACTIVE', `A ${item.status} plan item cannot be announced.`);
    }
    if (ADVANCE_NOTICES.some((notice) => notice.planItemId === item.id && notice.status !== 'withdrawn')) {
      ctx.fail(409, 'NOTICE_EXISTS', 'This plan item already has an advance notice.');
    }
    const categoryId = ctx.body.categoryId ?? item.categoryId;
    if (categoryId !== null && !CATEGORIES.some((category) => category.id === categoryId && category.tenantId === tenantId)) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', 'categoryId does not name a category of this organization.');
    }
    const notice: FixtureAdvanceNotice = {
      id: NEW_ID,
      tenantId,
      planItemId: item.id,
      title: ctx.body.title,
      summary: ctx.body.summary,
      categoryId,
      indicativeTiming: ctx.body.indicativeTiming,
      estimatedValueBand: ctx.body.estimatedValueBand ?? null,
      eoiInstructions: ctx.body.eoiInstructions ?? null,
      status: 'draft',
      publishedAt: null,
      publishedByUserId: null,
      withdrawnReason: null,
      updatedAt: nowIso(ctx.now),
    };
    return noticeDetailOf(notice, true);
  });

  mockRoute(app, e.updateAdvanceNotice, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const notice = findNotice(ctx, tenantId, ctx.params.noticeId);
    if (notice.status !== 'draft') {
      ctx.fail(409, 'NOTICE_NOT_EDITABLE', 'Only a draft notice can be edited; withdraw a published notice and publish a new one.');
    }
    const categoryId = ctx.body.categoryId ?? null;
    if (categoryId !== null && !CATEGORIES.some((category) => category.id === categoryId && category.tenantId === tenantId)) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', 'categoryId does not name a category of this organization.');
    }
    return noticeDetailOf(
      {
        ...notice,
        title: ctx.body.title,
        summary: ctx.body.summary,
        categoryId,
        indicativeTiming: ctx.body.indicativeTiming,
        estimatedValueBand: ctx.body.estimatedValueBand ?? null,
        eoiInstructions: ctx.body.eoiInstructions ?? null,
        updatedAt: nowIso(ctx.now),
      },
      true,
    );
  });

  mockRoute(app, e.publishAdvanceNotice, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const notice = findNotice(ctx, tenantId, ctx.params.noticeId);
    if (notice.status !== 'draft') {
      ctx.fail(409, 'INVALID_TRANSITION', `A ${notice.status} notice cannot be published.`);
    }
    const readiness = noticeReadiness(notice);
    const blocking = (id: string): boolean => readiness.some((item) => item.id === id && item.status === 'blocking');
    if (blocking('portal')) {
      ctx.fail(409, 'PORTAL_NOTICES_DISABLED', 'The organization’s public portal does not show advance notices (portal settings).');
    }
    if (blocking('summary') || blocking('indicativeTiming') || blocking('eoiInstructions')) {
      ctx.fail(
        422,
        'NOTICE_INCOMPLETE',
        `Complete before publishing: ${readiness
          .filter((item) => item.status === 'blocking' && item.id !== 'planItem')
          .map((item) => item.label)
          .join(', ')}.`,
      );
    }
    if (blocking('planItem')) {
      ctx.fail(409, 'PLAN_ITEM_NOT_SCHEDULED', 'Schedule the plan item before announcing it.');
    }
    const now = nowIso(ctx.now);
    return noticeDetailOf({ ...notice, status: 'published', publishedAt: now, publishedByUserId: ctx.requirePersona().userId, updatedAt: now }, true);
  });

  mockRoute(app, e.withdrawAdvanceNotice, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const notice = findNotice(ctx, tenantId, ctx.params.noticeId);
    if (notice.status !== 'published') {
      ctx.fail(409, 'INVALID_TRANSITION', `A ${notice.status} notice cannot be withdrawn.`);
    }
    return noticeDetailOf({ ...notice, status: 'withdrawn', withdrawnReason: ctx.body.reason, updatedAt: nowIso(ctx.now) }, true);
  });

  // ---------------------------------------------------------------------------------------------------------
  // Public (PUB-06)
  // ---------------------------------------------------------------------------------------------------------

  mockRoute(app, e.listPublicAdvanceNotices, (ctx) => {
    const { query } = ctx;
    const rows = ADVANCE_NOTICES.map(publicNoticeOf)
      .filter((notice): notice is PublicAdvanceNotice => notice !== null)
      .filter((notice) => query.buyerSlug === undefined || notice.buyer.slug === query.buyerSlug)
      .filter((notice) => query.categoryCode === undefined || query.categoryCode === '' || notice.category?.code === query.categoryCode)
      .filter((notice) => matchesSearch(query.q, [notice.title, notice.summary, notice.buyer.name]));
    const key = query.sort === 'title' ? (row: PublicAdvanceNotice) => row.title : (row: PublicAdvanceNotice) => row.publishedAt;
    return ctx.fixtures.page(sortRows(rows, key, query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, e.getPublicAdvanceNotice, (ctx) => {
    const tenant = findTenantBySlug(ctx.params.buyerSlug);
    const notice = ADVANCE_NOTICES.find((candidate) => candidate.id === ctx.params.noticeId && candidate.tenantId === tenant?.id);
    const view = notice === undefined ? null : publicNoticeOf(notice);
    return view ?? ctx.notFound('No such published advance notice.');
  });

  mockRoute(app, e.getPublicPlanSummary, (ctx) => {
    const visible = ADVANCE_NOTICES.map(publicNoticeOf).filter((notice): notice is PublicAdvanceNotice => notice !== null);
    const buyers = allTenants()
      .filter((tenant) => tenant.kind === 'buyer' && tenant.status === 'active' && (PORTAL_SHOWS_ADVANCE_NOTICES[tenant.id] ?? false))
      .filter((tenant) => ctx.query.buyerSlug === undefined || tenant.slug === ctx.query.buyerSlug);
    return {
      buyers: buyers.map((tenant) => {
        const notices = visible.filter((notice) => notice.buyer.slug === tenant.slug);
        const categories = new Map<string, { code: string; name: string; noticeCount: number; timings: string[] }>();
        for (const notice of notices) {
          if (notice.category === null) {
            continue;
          }
          const entry = categories.get(notice.category.code) ?? { code: notice.category.code, name: notice.category.name, noticeCount: 0, timings: [] };
          entry.noticeCount += 1;
          entry.timings.push(notice.indicativeTiming);
          categories.set(notice.category.code, entry);
        }
        const latest = notices.map((notice) => notice.publishedAt).sort().at(-1) ?? null;
        return {
          buyer: { slug: tenant.slug, name: tenant.name },
          noticeCount: notices.length,
          categories: [...categories.values()],
          lastPublishedAt: latest,
        };
      }),
    };
  });

  mockRoute(app, e.followPublicAdvanceNotice, (ctx) => {
    const tenant = findTenantBySlug(ctx.params.buyerSlug);
    const notice = ADVANCE_NOTICES.find((candidate) => candidate.id === ctx.params.noticeId && candidate.tenantId === tenant?.id);
    if (notice === undefined || tenant === undefined || !(PORTAL_SHOWS_ADVANCE_NOTICES[tenant.id] ?? false) || notice.publishedAt === null) {
      return ctx.notFound('No such published advance notice.');
    }
    if (notice.status !== 'published') {
      ctx.fail(409, 'NOTICE_NOT_AVAILABLE', 'This advance notice was withdrawn and can no longer be followed.');
    }
    return {
      noticeId: notice.id,
      status: 'confirmation_sent',
      message:
        'We sent a confirmation link to the email address. Following a forecast is not an expression of interest or a bid; the buyer will publish the conditions to respond.',
    };
  });
}
