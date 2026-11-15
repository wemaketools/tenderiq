/**
 * Requests domain handlers (05) — procurement plan, calendar, resource demand and advance notices (BUY-05) and
 * the public plans page (PUB-06): tenant isolation, permission 403s, scheduling rules and public visibility.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import {
  AdvanceNoticeDetail,
  AdvanceNoticePage,
  FollowNoticeResult,
  PlanCalendar,
  PlanItemDetail,
  PlanItemPage,
  PublicAdvanceNotice,
  PublicAdvanceNoticePage,
  PublicPlanSummary,
  ResourceDemand,
  requestEndpoints as e,
} from '../../../contracts/requests.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { PLAN_ITEMS } from '../../fixtures/requests/index.js';
import { TENANT_IDS } from '../../fixtures/platform.js';
import { register } from './index.js';
import { planItemRowOf } from './planning.js';

const TEBOGO = 'tebogo.officer@tenderiq.local';
const ODC_OFFICER = 'officer.odc@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ modules: [{ name: 'requests', register }], now: () => new Date('2026-09-30T08:00:00Z') });
});

type CallOptions = Parameters<TestMockApp['callAs']>[2];

function call(email: string, endpoint: AnyEndpoint, options: CallOptions = {}): Promise<TestResponse> {
  return api.callAs(email, endpoint, { tenant: email.endsWith('odc@tenderiq.local') ? 'odc' : 'kwu', ...options });
}

async function expectError(response: Promise<TestResponse>, status: number, code: string): Promise<void> {
  const result = await response;
  expect(result.status, result.text).toBe(status);
  expect(Problem.parse(result.body).code).toBe(code);
}

const PLAN_BODY = {
  title: 'Northern wellfield pipeline extension',
  projectId: 3,
  requestId: 3,
  categoryId: 3,
  departmentId: 3,
  ownerUserId: 5,
  budgetPeriod: 'FY2026/27',
  expectedValue: { amount: '4850000.00', currency: 'BWP' },
  plannedReleaseDate: '2027-01-18',
  plannedAwardDate: '2027-04-16',
  resourceDemandDays: 22,
  priority: 'critical',
  dependsOnId: 202,
} as const;

describe('buyer.planning.list and get (BUY-05)', () => {
  it('lists the KWU plan in release order with warnings, and only ODC’s own item for ODC', async () => {
    const kwu = PlanItemPage.parse((await call(TEBOGO, e.listPlanItems, { query: { pageSize: 100 } })).body);
    expect(kwu.total).toBe(10);
    expect(kwu.items[0]?.plannedReleaseDate).toBe('2026-07-06');
    const lot2 = kwu.items.find((item) => item.id === 201);
    expect(lot2?.warnings.some((warning) => warning.includes('over capacity'))).toBe(true);

    const odc = PlanItemPage.parse((await call(ODC_OFFICER, e.listPlanItems)).body);
    expect(odc.items.map((item) => item.id)).toEqual([301]);
    await expectError(call(ODC_OFFICER, e.getPlanItem, { params: { planItemId: 201 } }), 404, 'NOT_FOUND');
  });

  it('filters by status, owner and release window', async () => {
    const scheduled = PlanItemPage.parse((await call(TEBOGO, e.listPlanItems, { query: { status: 'scheduled', ownerUserId: 5, releaseFrom: '2026-11-01', releaseTo: '2026-11-30' } })).body);
    expect(scheduled.items.map((item) => item.id).sort()).toEqual([201, 202, 210]);
  });

  it('shows dependencies and dependents on the plan item detail', async () => {
    const valves = PlanItemDetail.parse((await call(TEBOGO, e.getPlanItem, { params: { planItemId: 202 } })).body);
    expect(valves.dependents.map((item) => item.id)).toEqual([203]);
    expect(valves.advanceNotice).toMatchObject({ id: 401, status: 'published' });
    const pipeline = PlanItemDetail.parse((await call(TEBOGO, e.getPlanItem, { params: { planItemId: 203 } })).body);
    expect(pipeline.dependsOn?.id).toBe(202);
  });

  it('answers 403 to a requester and to an evaluator (no plan access)', async () => {
    await expectError(call('kagiso.requester@tenderiq.local', e.listPlanItems), 403, 'FORBIDDEN');
    await expectError(call('thato.eval@tenderiq.local', e.getPlanCalendar, { query: { month: '2026-11' } }), 403, 'FORBIDDEN');
  });

  it('lets the budget owner read the plan but not change it', async () => {
    expect((await call('onalenna.budget@tenderiq.local', e.listPlanItems)).status).toBe(200);
    await expectError(call('onalenna.budget@tenderiq.local', e.updatePlanItem, { params: { planItemId: 203 }, body: PLAN_BODY }), 403, 'FORBIDDEN');
  });
});

describe('plan commands (BUY-05)', () => {
  it('creates a plan item (201) and schedules an item with its release date', async () => {
    const created = await call(TEBOGO, e.createPlanItem, { body: { ...PLAN_BODY, dependsOnId: null, title: 'Reservoir level sensors' } });
    expect(created.status).toBe(201);
    expect(PlanItemDetail.parse(created.body).status).toBe('planned');
    const updated = PlanItemDetail.parse((await call(TEBOGO, e.updatePlanItem, { params: { planItemId: 203 }, body: { ...PLAN_BODY, status: 'scheduled' } })).body);
    expect(updated.status).toBe('scheduled');
  });

  it('links only submitted requests the caller can read: a draft request is refused as not found', async () => {
    await expectError(call(TEBOGO, e.createPlanItem, { body: { ...PLAN_BODY, dependsOnId: null, requestId: 7 } }), 422, 'REFERENCE_NOT_FOUND');
    await expectError(call(TEBOGO, e.createPlanItem, { body: { ...PLAN_BODY, dependsOnId: null, requestId: 101 } }), 422, 'REFERENCE_NOT_FOUND');
    const linked = PlanItemDetail.parse((await call(TEBOGO, e.createPlanItem, { body: { ...PLAN_BODY, dependsOnId: null, requestId: 8 } })).body);
    expect(linked.request?.reference).toBe('PR-2026-0008');
  });

  it('redacts a linked request the viewer cannot read and never lists a draft request on the plan', async () => {
    const page = PlanItemPage.parse((await call(TEBOGO, e.listPlanItems, { query: { pageSize: 100 } })).body);
    expect(page.items.find((item) => item.id === 209)?.request).toBeNull();
    expect(page.items.some((item) => item.request?.reference === 'PR-2026-0007')).toBe(false);

    const item209 = PLAN_ITEMS.find((item) => item.id === 209);
    if (item209 === undefined) {
      throw new Error('Plan item 209 is missing');
    }
    const draftLinked = { ...item209, requestId: 7 };
    const base = { tenantId: TENANT_IDS.kwu, authorityLimit: null, now: new Date('2026-09-30T08:00:00Z') };
    const officer = { ...base, userId: 5, permissions: new Set<PermissionCode>(['plan.manage', 'request.view_all']) };
    const requester = { ...base, userId: 6, permissions: new Set<PermissionCode>(['request.create']) };
    expect(planItemRowOf(draftLinked, officer).request).toBeNull();
    expect(planItemRowOf(draftLinked, requester).request?.reference).toBe('PR-2026-0007');
  });

  it('refuses dependency loops, releases before the dependency and changes to released items', async () => {
    await expectError(call(TEBOGO, e.updatePlanItem, { params: { planItemId: 203 }, body: { ...PLAN_BODY, dependsOnId: 203 } }), 409, 'DEPENDENCY_CYCLE');
    await expectError(
      call(TEBOGO, e.updatePlanItem, { params: { planItemId: 202 }, body: { ...PLAN_BODY, title: 'Valves', dependsOnId: 203, plannedReleaseDate: '2027-02-01', plannedAwardDate: '2027-03-01' } }),
      409,
      'DEPENDENCY_CYCLE',
    );
    await expectError(
      call(TEBOGO, e.updatePlanItem, { params: { planItemId: 203 }, body: { ...PLAN_BODY, plannedReleaseDate: '2026-11-01' } }),
      409,
      'DEPENDENCY_ORDER',
    );
    await expectError(call(TEBOGO, e.updatePlanItem, { params: { planItemId: 206 }, body: PLAN_BODY }), 409, 'PLAN_ITEM_LOCKED');
  });

  it('checks the owner, the references and the schedule date', async () => {
    await expectError(call(TEBOGO, e.updatePlanItem, { params: { planItemId: 203 }, body: { ...PLAN_BODY, ownerUserId: 6 } }), 422, 'OWNER_NOT_ELIGIBLE');
    await expectError(call(TEBOGO, e.updatePlanItem, { params: { planItemId: 203 }, body: { ...PLAN_BODY, categoryId: 21 } }), 422, 'REFERENCE_NOT_FOUND');
    await expectError(
      call(TEBOGO, e.updatePlanItem, {
        params: { planItemId: 209 },
        body: { ...PLAN_BODY, dependsOnId: null, plannedReleaseDate: null, plannedAwardDate: null, status: 'scheduled' },
      }),
      422,
      'SCHEDULE_DATE_REQUIRED',
    );
    const invalid = await call(TEBOGO, e.updatePlanItem, { params: { planItemId: 203 }, body: { ...PLAN_BODY, plannedAwardDate: '2027-01-01' } });
    expect(invalid.status).toBe(422);
    expect(Problem.parse(invalid.body).errors?.[0]?.code).toBe('INVALID_DATE_ORDER');
  });
});

describe('calendar and resource demand (BUY-05)', () => {
  it('places releases, awards, notices, renewals and expiries in the month and flags over-allocation', async () => {
    const november = PlanCalendar.parse((await call(TEBOGO, e.getPlanCalendar, { query: { month: '2026-11' } })).body);
    expect(november.timeZone).toBe('Africa/Gaborone');
    expect(november.entries.filter((entry) => entry.kind === 'planned_release').map((entry) => entry.planItemId).sort()).toEqual([201, 202, 210]);
    expect(november.resourceDemand.find((demand) => demand.owner.userId === 5)).toMatchObject({ demandDays: 41, capacityDays: 18, overAllocated: true });

    const october = PlanCalendar.parse((await call(TEBOGO, e.getPlanCalendar, { query: { month: '2026-10' } })).body);
    expect(october.entries.map((entry) => entry.kind)).toEqual(expect.arrayContaining(['planned_release', 'renewal_notice']));
    const march = PlanCalendar.parse((await call(TEBOGO, e.getPlanCalendar, { query: { month: '2027-03' } })).body);
    expect(march.entries.some((entry) => entry.kind === 'contract_expiry' && entry.reference === 'C-2026-0001')).toBe(true);
    const september = PlanCalendar.parse((await call(TEBOGO, e.getPlanCalendar, { query: { month: '2026-09' } })).body);
    expect(september.entries.filter((entry) => entry.kind === 'advance_notice')).toHaveLength(2);
  });

  it('rejects a malformed month', async () => {
    const response = await call(TEBOGO, e.getPlanCalendar, { query: { month: '2026-13' } });
    expect(response.status).toBe(422);
  });

  it('returns demand per owner and month', async () => {
    const demand = ResourceDemand.parse((await call(TEBOGO, e.getResourceDemand, { query: { from: '2026-10', to: '2027-03' } })).body);
    expect(demand.months).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
    const tebogo = demand.owners.find((owner) => owner.owner.userId === 5);
    expect(tebogo?.months.find((month) => month.month === '2026-11')).toMatchObject({ demandDays: 41, overAllocated: true });
  });
});

describe('advance notices (BUY-05)', () => {
  it('lists KWU notices only, newest first', async () => {
    const page = AdvanceNoticePage.parse((await call(TEBOGO, e.listAdvanceNotices)).body);
    expect(page.items.map((notice) => notice.id).sort()).toEqual([401, 402, 403, 404, 405, 406]);
    expect(page.items.find((notice) => notice.id === 401)?.publicPath).toBe('/plans/kwu/401');
    const odc = AdvanceNoticePage.parse((await call(ODC_OFFICER, e.listAdvanceNotices)).body);
    expect(odc.items.map((notice) => notice.id)).toEqual([411]);
  });

  it('refuses to publish an incomplete draft, an unscheduled item, a disabled portal or a published notice', async () => {
    await expectError(call(TEBOGO, e.publishAdvanceNotice, { params: { noticeId: 403 } }), 422, 'NOTICE_INCOMPLETE');
    await expectError(call(TEBOGO, e.publishAdvanceNotice, { params: { noticeId: 405 } }), 409, 'PLAN_ITEM_NOT_SCHEDULED');
    await expectError(call(ODC_OFFICER, e.publishAdvanceNotice, { params: { noticeId: 411 } }), 409, 'PORTAL_NOTICES_DISABLED');
    await expectError(call(TEBOGO, e.publishAdvanceNotice, { params: { noticeId: 401 } }), 409, 'INVALID_TRANSITION');
    const ready = AdvanceNoticeDetail.parse((await call(TEBOGO, e.getAdvanceNotice, { params: { noticeId: 406 } })).body);
    expect(ready.publishReadiness.every((item) => item.status !== 'blocking')).toBe(true);
    expect(ready.allowedActions).toContain('publish');
  });

  it('publishes the complete draft notice on the scheduled plan item 201', async () => {
    const published = await call(TEBOGO, e.publishAdvanceNotice, { params: { noticeId: 406 } });
    expect(published.status, published.text).toBe(200);
    expect(AdvanceNoticeDetail.parse(published.body)).toMatchObject({ id: 406, status: 'published', publicPath: '/plans/kwu/406' });
    const detail = AdvanceNoticeDetail.parse((await call(TEBOGO, e.getAdvanceNotice, { params: { noticeId: 405 } })).body);
    expect(detail.publishReadiness.find((item) => item.id === 'planItem')?.status).toBe('blocking');
    expect(detail.allowedActions).toEqual(['edit']);
  });

  it('creates, edits and withdraws notices within the rules', async () => {
    const notice = { title: 'Borehole pumps Lot 2', summary: 'Re-procurement of the central wellfield pump sets.', indicativeTiming: 'November 2026' };
    const created = await call(TEBOGO, e.createAdvanceNotice, { body: { ...notice, planItemId: 210 } });
    expect(created.status).toBe(201);
    await expectError(call(TEBOGO, e.createAdvanceNotice, { body: { ...notice, planItemId: 201 } }), 409, 'NOTICE_EXISTS');
    await expectError(call(TEBOGO, e.createAdvanceNotice, { body: { ...notice, planItemId: 202 } }), 409, 'NOTICE_EXISTS');
    await expectError(call(TEBOGO, e.createAdvanceNotice, { body: { ...notice, planItemId: 208 } }), 409, 'PLAN_ITEM_NOT_ACTIVE');
    await expectError(call(TEBOGO, e.createAdvanceNotice, { body: { ...notice, planItemId: 301 } }), 422, 'REFERENCE_NOT_FOUND');
    expect(AdvanceNoticeDetail.parse((await call(TEBOGO, e.updateAdvanceNotice, { params: { noticeId: 403 }, body: notice })).body).title).toBe('Borehole pumps Lot 2');
    await expectError(call(TEBOGO, e.updateAdvanceNotice, { params: { noticeId: 401 }, body: notice }), 409, 'NOTICE_NOT_EDITABLE');
    const withdrawn = AdvanceNoticeDetail.parse((await call(TEBOGO, e.withdrawAdvanceNotice, { params: { noticeId: 401 }, body: { reason: 'Scope under review.' } })).body);
    expect(withdrawn).toMatchObject({ status: 'withdrawn', withdrawnReason: 'Scope under review.' });
    await expectError(call(TEBOGO, e.withdrawAdvanceNotice, { params: { noticeId: 404 }, body: { reason: 'x' } }), 409, 'INVALID_TRANSITION');
  });
});

describe('public plans and advance notices (PUB-06)', () => {
  it('shows anonymous visitors only published notices of buyers whose portal shows them', async () => {
    const response = await api.request('GET', '/api/v1/public/advance-notices');
    expect(response.status).toBe(200);
    const page = PublicAdvanceNoticePage.parse(response.body);
    expect(page.items.map((notice) => notice.id)).toEqual([402, 401]);
    expect(page.items.every((notice) => notice.buyer.slug === 'kwu')).toBe(true);
  });

  it('filters by buyer and category and returns nothing for ODC', async () => {
    const pipes = PublicAdvanceNoticePage.parse((await api.request('GET', '/api/v1/public/advance-notices', { query: { categoryCode: 'WTR-PIPE', sort: 'title', dir: 'asc' } })).body);
    expect(pipes.items.map((notice) => notice.id)).toEqual([402, 401]);
    const odc = PublicAdvanceNoticePage.parse((await api.request('GET', '/api/v1/public/advance-notices', { query: { buyerSlug: 'odc' } })).body);
    expect(odc.total).toBe(0);
  });

  it('opens a published notice and 404s drafts, withdrawn notices, ODC notices and a wrong buyer slug', async () => {
    const notice = PublicAdvanceNotice.parse((await api.request('GET', '/api/v1/public/advance-notices/kwu/401')).body);
    expect(notice).toMatchObject({ buyer: { slug: 'kwu' }, planStatus: 'scheduled', path: '/plans/kwu/401' });
    for (const path of ['kwu/403', 'kwu/404', 'odc/411', 'odc/401']) {
      expect((await api.request('GET', `/api/v1/public/advance-notices/${path}`)).status, path).toBe(404);
    }
  });

  it('summarizes planned categories per buyer from published notices only', async () => {
    const summary = PublicPlanSummary.parse((await api.request('GET', '/api/v1/public/procurement-plans')).body);
    expect(summary.buyers).toHaveLength(1);
    expect(summary.buyers[0]).toMatchObject({ buyer: { slug: 'kwu' }, noticeCount: 2, categories: [{ code: 'WTR-PIPE', noticeCount: 2 }] });
  });

  it('accepts a follower (202), refuses a withdrawn notice and validates the email', async () => {
    const followed = await api.request('POST', '/api/v1/public/advance-notices/kwu/401/follow', { body: { email: 'bids@example.org' } });
    expect(followed.status).toBe(202);
    expect(FollowNoticeResult.parse(followed.body).status).toBe('confirmation_sent');
    const withdrawn = await api.request('POST', '/api/v1/public/advance-notices/kwu/404/follow', { body: { email: 'bids@example.org' } });
    expect(Problem.parse(withdrawn.body).code).toBe('NOTICE_NOT_AVAILABLE');
    expect((await api.request('POST', '/api/v1/public/advance-notices/kwu/401/follow', { body: { email: 'nope' } })).status).toBe(422);
    expect((await api.request('POST', '/api/v1/public/advance-notices/kwu/403/follow', { body: { email: 'bids@example.org' } })).status).toBe(404);
  });
});
