/**
 * Operations mock handlers with REAL authentication (local Supabase Auth, DD-43): operator-only access to the ops
 * area, buyer tenant isolation (KWU vs ODC), supplier and personal (`/me`) isolation, public projections without
 * customer detail, and the business errors every command declares (AC-33, AC-36, BR-46, BR-47, COM-09).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  Announcement,
  BuyerSubscriptionView,
  CustomerDetail,
  CustomerStatusResult,
  CustomerSupportGrant,
  ExitExport,
  HelpArticleDetail,
  ImportBatchDetail,
  ImportRecordRow,
  IncidentDetail,
  IntegrationDetail,
  IntegrationExceptionDetail,
  IntegrationExceptionRow,
  MAX_SUPPORT_GRANT_DAYS,
  MySupportCaseDetail,
  OffboardingPlanDetail,
  OnboardingView,
  OversightSummary,
  PlanCatalog,
  ServiceNoticeList,
  SubscriptionDetail,
  SupportCaseDetail,
  AccessReviewRow,
  CustomerRow,
  IntegrationRow,
  MyHelpArticle,
  MySupportCase,
  operationsEndpoints as ops,
} from '../../../contracts/operations.js';
import { pageOf } from '../../../contracts/common.js';
import { frozenStorylineNow } from '../../fixtures/demo-clock.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

const OPS_ADMIN = 'ops.admin@tenderiq.local';
const SUPPORT = 'support.agent@tenderiq.local';
const ADMIN_KWU = 'admin.kwu@tenderiq.local';
const ADMIN_ODC = 'admin.odc@tenderiq.local';
const OFFICER = 'tebogo.officer@tenderiq.local';
const AUDITOR = 'pule.auditor@tenderiq.local';
const TSODILO = 'tsodilo.bidmanager@tenderiq.local';
const CHOBE = 'chobe-pipe.bidmanager@tenderiq.local';
const SAM = 'sam.dual@tenderiq.local';

const pages = {
  customers: pageOf(CustomerRow),
  customerGrants: pageOf(CustomerSupportGrant),
  myCases: pageOf(MySupportCase),
  myHelp: pageOf(MyHelpArticle),
  integrations: pageOf(IntegrationRow),
  exceptions: pageOf(IntegrationExceptionRow),
  importRecords: pageOf(ImportRecordRow),
};

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

function codeOf(response: TestResponse): string {
  const body = response.body as { code?: string; errors?: Array<{ code: string }> };
  return body.errors?.[0]?.code ?? body.code ?? '';
}

describe('registration', () => {
  it('loads the operations module and serves every endpoint of the contract', () => {
    expect(api.failed.map((failure) => failure.module)).not.toContain('operations/index');
    expect(api.loaded).toContain('operations/index');
    expect(api.endpointIds).toEqual(expect.arrayContaining(Object.values(ops).map((endpoint) => endpoint.id)));
  });
});

describe('OPS-01 customer register', () => {
  it('lists every buyer and supplier customer for the platform operator and filters by kind', async () => {
    const all = pages.customers.parse((await api.callAs(OPS_ADMIN, ops.listCustomers, { tenant: 'tenderiq-ops' })).body);
    expect(all.total).toBe(8);
    const buyers = pages.customers.parse(
      (await api.callAs(OPS_ADMIN, ops.listCustomers, { tenant: 'tenderiq-ops', query: { kind: 'buyer', sort: 'name' } })).body,
    );
    expect(buyers.items.map((row) => row.slug)).toEqual(['kwu', 'odc']);
    expect(buyers.items[1]?.onboardingStage).toBe('offboarding');
  });

  it('shows the customer identity and live obligation references but never tender content', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.getCustomer, { tenant: 'tenderiq-ops', params: { customerTenantId: 3 } });
    expect(response.status).toBe(200);
    const detail = CustomerDetail.parse(response.body);
    expect(detail.liveEvents.map((event) => event.reference)).toEqual(['T-2026-0011', 'T-2026-0013']);
    expect(detail.liveContracts.map((contract) => contract.reference)).toEqual(['C-2025-0004']);
    expect(Object.keys(detail.liveEvents[0] ?? {}).sort()).toEqual(['reference', 'status', 'submissionDeadline', 'tenderId', 'title', 'withheld']);
    expect(detail.contentAccessNote).toMatch(/customer-authorized/);
  });

  it('answers 403 when a buyer administrator calls an operator endpoint', async () => {
    const response = await api.callAs(ADMIN_KWU, ops.listCustomers, { tenant: 'kwu' });
    expect(response.status).toBe(403);
  });

  it('refuses to suspend ODC while its live events have no agreed continuity plan (BR-47)', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.changeCustomerStatus, {
      tenant: 'tenderiq-ops',
      params: { customerTenantId: 3 },
      body: { status: 'suspended', reason: 'Commercial dispute' },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('CONTINUITY_PLAN_REQUIRED');
  });

  it('suspends a supplier without live obligations and states the consequence', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.changeCustomerStatus, {
      tenant: 'tenderiq-ops',
      params: { customerTenantId: 8 },
      body: { status: 'suspended', reason: 'Misuse investigation' },
    });
    expect(response.status).toBe(200);
    expect(CustomerStatusResult.parse(response.body).customer.status).toBe('suspended');
  });

  it('rejects a duplicate slug when establishing a customer', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.createCustomer, {
      tenant: 'tenderiq-ops',
      body: {
        legalName: 'Kweneng Land Board',
        slug: 'kwu',
        country: 'BW',
        officialTimeZone: 'Africa/Gaborone',
        defaultCurrency: 'BWP',
        planCode: 'buyer_standard',
        serviceOwnerUserId: 1,
        administratorName: 'Neo Kweneng',
        administratorEmail: 'admin@klb.example',
      },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('SLUG_TAKEN');
  });
});

describe('OPS-02 onboarding and offboarding (AC-36)', () => {
  it('blocks KWU from going live while blocking onboarding items are open', async () => {
    const view = OnboardingView.parse(
      (await api.callAs(OPS_ADMIN, ops.getOnboarding, { tenant: 'tenderiq-ops', params: { customerTenantId: 2 } })).body,
    );
    expect(view.nextStage).toBe('live');
    const response = await api.callAs(OPS_ADMIN, ops.advanceOnboarding, {
      tenant: 'tenderiq-ops',
      params: { customerTenantId: 2 },
      body: { toStage: 'live' },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('ONBOARDING_ITEMS_OPEN');
  });

  it('answers ONBOARDING_NOT_APPLICABLE for a supplier organization', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.getOnboarding, { tenant: 'tenderiq-ops', params: { customerTenantId: 4 } });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('ONBOARDING_NOT_APPLICABLE');
  });

  it('shows the ODC exit plan with its live tender, live contract and pending customer agreement', async () => {
    const plan = OffboardingPlanDetail.parse(
      (await api.callAs(OPS_ADMIN, ops.getOffboardingPlan, { tenant: 'tenderiq-ops', params: { planId: 1 } })).body,
    );
    expect(plan.status).toBe('draft');
    expect(plan.liveEvents.map((event) => event.reference)).toEqual(['T-2026-0011', 'T-2026-0013']);
    expect(plan.liveContracts.map((contract) => contract.reference)).toEqual(['C-2025-0004']);
    expect(plan.readiness.find((check) => check.id === 'customer-agreement')?.status).toBe('blocking');
    expect(plan.exportRequest?.status).toBe('ready');
  });

  it('refuses to mark the plan agreed before the customer agrees it', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.transitionOffboardingPlan, {
      tenant: 'tenderiq-ops',
      params: { planId: 1 },
      body: { toStatus: 'agreed' },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('CUSTOMER_AGREEMENT_REQUIRED');
  });
});

describe('operator views withhold customer content (PRD §4.3)', () => {
  it('returns the invitation-only T-2026-0006 to ops.admin without its title, keeping status and deadline', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.getCustomer, { tenant: 'tenderiq-ops', params: { customerTenantId: 2 } });
    const detail = CustomerDetail.parse(response.body);
    const invited = detail.liveEvents.find((event) => event.reference === 'T-2026-0006');
    expect(invited).toMatchObject({ title: null, withheld: true, status: 'open' });
    expect(invited?.submissionDeadline?.timeZone).toBe('Africa/Gaborone');
    expect(JSON.stringify(response.body)).not.toContain('Chlorine dosing equipment');
    const restricted = detail.liveEvents.find((event) => event.reference === 'T-2026-0009');
    expect(restricted).toMatchObject({ title: null, withheld: true });
    const open = detail.liveEvents.find((event) => event.reference === 'T-2026-0002');
    expect(open?.withheld).toBe(false);
    expect(open?.title).not.toBeNull();
  });

  it('shows operators live contracts as reference, status and term end only', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.getCustomer, { tenant: 'tenderiq-ops', params: { customerTenantId: 2 } });
    const detail = CustomerDetail.parse(response.body);
    expect(detail.liveContracts.length).toBeGreaterThan(0);
    for (const contract of detail.liveContracts) {
      expect(contract).toMatchObject({ title: null, supplierName: null, withheld: true });
    }
  });

  it('withholds contract detail in the operator offboarding plan while the customer sees it in full', async () => {
    const operator = OffboardingPlanDetail.parse(
      (await api.callAs(OPS_ADMIN, ops.getOffboardingPlan, { tenant: 'tenderiq-ops', params: { planId: 1 } })).body,
    );
    expect(operator.liveContracts[0]).toMatchObject({ reference: 'C-2025-0004', title: null, supplierName: null, withheld: true });
    expect(operator.liveEvents[0]).toMatchObject({ reference: 'T-2026-0011', withheld: false });
    const customer = BuyerSubscriptionView.parse((await api.callAs(ADMIN_ODC, ops.getBuyerSubscription, { tenant: 'odc' })).body);
    expect(customer.liveContracts[0]?.withheld).toBe(false);
    expect(customer.liveContracts[0]?.title).not.toBeNull();
    expect(customer.liveContracts[0]?.supplierName).not.toBeNull();
    expect(customer.offboardingPlan?.liveContracts[0]?.withheld).toBe(false);
  });

  it('counts published events from the released tenders of the year', async () => {
    const kwu = CustomerDetail.parse(
      (await api.callAs(OPS_ADMIN, ops.getCustomer, { tenant: 'tenderiq-ops', params: { customerTenantId: 2 } })).body,
    );
    const odc = CustomerDetail.parse(
      (await api.callAs(OPS_ADMIN, ops.getCustomer, { tenant: 'tenderiq-ops', params: { customerTenantId: 3 } })).body,
    );
    expect(kwu.usage.publishedEventsYtd).toBe(10);
    expect(odc.usage.publishedEventsYtd).toBe(1);
  });
});

describe('OPS-03 plans and subscriptions', () => {
  it('answers an unknown offboarding target status with a coded field error', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.transitionOffboardingPlan, {
      tenant: 'tenderiq-ops',
      params: { planId: 1 },
      body: { toStatus: 'finished' },
    });
    expect(response.status).toBe(422);
    const body = response.body as { errors?: Array<{ field: string; code: string; message: string }> };
    expect(body.errors?.[0]).toEqual({
      field: 'toStatus',
      code: 'INVALID_STATUS',
      message: 'Choose draft, agreed, in progress or completed.',
    });
  });

  it('shows KWU its published-events usage above the pilot limit, from the released tenders', async () => {
    const view = BuyerSubscriptionView.parse((await api.callAs(ADMIN_KWU, ops.getBuyerSubscription, { tenant: 'kwu' })).body);
    const usage = view.entitlements.find((row) => row.featureCode === 'published_events_per_year');
    expect(usage).toMatchObject({ usageValue: 10, limitValue: 8, limitReached: true });
  });

  it('gives every ADM-17 service contact an e-mail and splits the commercial contact name from its e-mail', async () => {
    const view = BuyerSubscriptionView.parse((await api.callAs(ADMIN_ODC, ops.getBuyerSubscription, { tenant: 'odc' })).body);
    expect(view.contacts.every((contact) => contact.email !== null)).toBe(true);
    const commercial = view.contacts.find((contact) => contact.role === 'Commercial contact');
    expect(commercial).toMatchObject({ name: 'Council Treasurer, Okavango District Council', email: 'treasury@odc.example' });
  });

  it('lists the plan catalog and states that supplier access never depends on a plan (BR-46)', async () => {
    const catalog = PlanCatalog.parse((await api.callAs(OPS_ADMIN, ops.getPlanCatalog, { tenant: 'tenderiq-ops' })).body);
    expect(catalog.plans.map((plan) => plan.code)).toEqual(['pilot', 'buyer_standard', 'buyer_enterprise']);
    expect(catalog.supplierAccessNote).toMatch(/free of charge/);
  });

  it('shows the KWU usage limit as a service action that never blocks submissions', async () => {
    const detail = SubscriptionDetail.parse(
      (await api.callAs(OPS_ADMIN, ops.getSubscription, { tenant: 'tenderiq-ops', params: { subscriptionId: 1 } })).body,
    );
    expect(detail.entitlements.find((row) => row.featureCode === 'published_events_per_year')?.limitReached).toBe(true);
    expect(detail.serviceActions.every((action) => action.blocksSubmissions === false)).toBe(true);
  });

  it('refuses to cancel the ODC subscription without an agreed continuity plan', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.updateSubscription, {
      tenant: 'tenderiq-ops',
      params: { subscriptionId: 3 },
      body: { status: 'cancelled', reason: 'Notice of non-renewal' },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('CONTINUITY_PLAN_REQUIRED');
  });

  it('answers 403 FORBIDDEN to a support agent without subscription permissions', async () => {
    const response = await api.callAs(SUPPORT, ops.listSubscriptions, { tenant: 'tenderiq-ops' });
    expect(response.status).toBe(403);
    expect(codeOf(response)).toBe('FORBIDDEN');
  });
});

describe('OPS-04 support cases and access grants', () => {
  it('shows internal notes and the support activity history to operators', async () => {
    const detail = SupportCaseDetail.parse(
      (await api.callAs(SUPPORT, ops.getSupportCase, { tenant: 'tenderiq-ops', params: { caseId: 1 } })).body,
    );
    expect(detail.messages.some((message) => message.internal)).toBe(true);
    expect(detail.grants.find((grant) => grant.id === 1)?.status).toBe('active');
    expect(detail.activity.some((entry) => entry.action === 'grant.authorized')).toBe(true);
    expect(detail.capabilities.canRequestAccess).toBe(false);
  });

  it('labels grants with the case reference and keeps the seeded grant within 14 days', async () => {
    const detail = SupportCaseDetail.parse(
      (await api.callAs(SUPPORT, ops.getSupportCase, { tenant: 'tenderiq-ops', params: { caseId: 1 } })).body,
    );
    const grant = detail.grants.find((row) => row.id === 1);
    expect(grant?.caseReference).toBe('SC-2026-0001');
    expect(grant?.expiresAt).toBe('2026-10-12T07:00:00Z');
    const days = (Date.parse(grant?.expiresAt ?? '') - Date.parse(grant?.startsAt ?? '')) / 86_400_000;
    expect(days).toBeLessThanOrEqual(MAX_SUPPORT_GRANT_DAYS);
  });

  it('never grants access to sealed or scored records', async () => {
    const response = await api.callAs(SUPPORT, ops.requestSupportGrant, {
      tenant: 'tenderiq-ops',
      params: { caseId: 8 },
      body: { businessNeed: 'Check the bid', scope: 'specific_records', recordRefs: ['bid:T-2026-0002'], requestedDays: 2 },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('SEALED_CONTENT_NOT_GRANTABLE');
  });

  it('refuses a second grant while the case has an active one', async () => {
    const response = await api.callAs(SUPPORT, ops.requestSupportGrant, {
      tenant: 'tenderiq-ops',
      params: { caseId: 1 },
      body: { businessNeed: 'More access', scope: 'metadata_only', requestedDays: 2 },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('GRANT_ALREADY_ACTIVE');
  });

  it('routes procurement-merits questions to the buyer instead of resolving them', async () => {
    const response = await api.callAs(SUPPORT, ops.transitionSupportCase, {
      tenant: 'tenderiq-ops',
      params: { caseId: 3 },
      body: { status: 'resolved', resolution: 'Extension granted' },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('BUSINESS_DISPUTE_MUST_ROUTE');
  });
});

describe('customer authorization of support access', () => {
  it('lists only the active buyer’s grants and hides another buyer’s grant as not found', async () => {
    const kwu = pages.customerGrants.parse((await api.callAs(ADMIN_KWU, ops.listCustomerSupportGrants, { tenant: 'kwu' })).body);
    expect(kwu.items.every((grant) => grant.customer.slug === 'kwu')).toBe(true);
    expect(kwu.items.map((grant) => grant.id)).not.toContain(2);
    const other = await api.callAs(ADMIN_KWU, ops.getCustomerSupportGrant, { tenant: 'kwu', params: { grantId: 2 } });
    expect(other.status).toBe(404);
  });

  it('lets the ODC administrator authorize the pending request for a limited window', async () => {
    const expiresAt = new Date(frozenStorylineNow().getTime() + 3 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const response = await api.callAs(ADMIN_ODC, ops.authorizeSupportGrant, {
      tenant: 'odc',
      params: { grantId: 2 },
      body: { expiresAt, acknowledgement: true },
    });
    expect(response.status).toBe(200);
    const grant = CustomerSupportGrant.parse(response.body);
    expect(grant.status).toBe('active');
    expect(grant.authorizedBy?.fullName).toBe('Wame Olebile');
  });

  it('refuses a window longer than the maximum', async () => {
    const expiresAt = new Date(frozenStorylineNow().getTime() + 30 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const response = await api.callAs(ADMIN_ODC, ops.authorizeSupportGrant, {
      tenant: 'odc',
      params: { grantId: 2 },
      body: { expiresAt, acknowledgement: true },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('GRANT_DURATION_TOO_LONG');
  });

  it('answers 403 to a procurement officer and to support acting under a grant', async () => {
    expect((await api.callAs(OFFICER, ops.listCustomerSupportGrants, { tenant: 'kwu' })).status).toBe(403);
    expect((await api.callAs(SUPPORT, ops.listCustomerSupportGrants, { tenant: 'kwu' })).status).toBe(403);
  });
});

describe('COM-09 personal service cases', () => {
  it('lists only the caller’s own cases, labelled with the organization, without internal notes', async () => {
    const page = pages.myCases.parse((await api.callAs(TSODILO, ops.listMySupportCases)).body);
    expect(page.items.map((row) => row.reference)).toEqual(['SC-2026-0002']);
    expect(page.items[0]?.organization.tenantName).toBe('Tsodilo Engineering');
    const chobeCase = MySupportCaseDetail.parse((await api.callAs(CHOBE, ops.getMySupportCase, { params: { caseId: 3 } })).body);
    expect(chobeCase.messages.some((message) => message.internal)).toBe(false);
    expect(chobeCase.routedTo?.slug).toBe('kwu');
    expect((await api.callAs(TSODILO, ops.getMySupportCase, { params: { caseId: 3 } })).status).toBe(404);
  });

  it('refuses to accept a bid through support', async () => {
    const response = await api.callAs(TSODILO, ops.openMySupportCase, {
      tenant: 'tsodilo',
      body: {
        category: 'submission_evidence',
        subject: 'Our response',
        description: 'Please submit our bid for T-2026-0002, the portal is slow.',
        acknowledgesNotSubmissionChannel: true,
      },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('SUPPORT_NOT_SUBMISSION_CHANNEL');
  });

  it('requires the acknowledgement that support is not a submission channel', async () => {
    const response = await api.callAs(TSODILO, ops.openMySupportCase, {
      tenant: 'tsodilo',
      body: { category: 'usage', subject: 'Question', description: 'How do I invite a colleague?', acknowledgesNotSubmissionChannel: false },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('NOT_SUBMISSION_CHANNEL_ACK_REQUIRED');
  });

  it('opens an accommodation request as an accessibility case of the row organization', async () => {
    const response = await api.callAs(SAM, ops.requestAccommodation, {
      tenant: 'chobe-pipe',
      body: { format: 'large_print', need: 'Large-print copy of the site visit pack.', contactPreference: 'email' },
    });
    expect(response.status).toBe(201);
    const detail = MySupportCaseDetail.parse(response.body);
    expect(detail.category).toBe('accessibility');
    expect(detail.organization.tenantName).toBe('Chobe Pipe & Valve Supplies');
  });

  it('refuses a case opened by support acting inside a customer under a grant', async () => {
    const response = await api.callAs(SUPPORT, ops.openMySupportCase, {
      tenant: 'kwu',
      body: { category: 'usage', subject: 'Test case', description: 'Opened by support', acknowledgesNotSubmissionChannel: true },
    });
    expect(response.status).toBe(403);
  });
});

describe('OPS-05 incidents and OPS-06 oversight', () => {
  it('shows the T-2026-0002 incident with the buyer’s own deadline decision', async () => {
    const incident = IncidentDetail.parse(
      (await api.callAs(SUPPORT, ops.getIncident, { tenant: 'tenderiq-ops', params: { incidentId: 1 } })).body,
    );
    expect(incident.impacts.find((impact) => impact.tenderReference === 'T-2026-0002')?.buyerDecisionNote).toMatch(/KWU decision/);
    expect(incident.decisionRule).toMatch(/responsible buyer decides/);
  });

  it('rejects a duplicate impact', async () => {
    const response = await api.callAs(SUPPORT, ops.addIncidentImpact, {
      tenant: 'tenderiq-ops',
      params: { incidentId: 1 },
      body: { customerTenantId: 2, tenderReference: 'T-2026-0002', impactNote: 'Again' },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response)).toBe('IMPACT_DUPLICATE');
  });

  it('shows aggregate usage only', async () => {
    const summary = OversightSummary.parse((await api.callAs(OPS_ADMIN, ops.getOversightSummary, { tenant: 'tenderiq-ops' })).body);
    expect(summary.customers).toEqual({ buyers: 2, suppliers: 6 });
    expect(summary.usage).toHaveLength(8);
  });

  it('blocks a self-review and lets another operator complete a review', async () => {
    const own = await api.callAs(OPS_ADMIN, ops.completeAccessReview, {
      tenant: 'tenderiq-ops',
      params: { reviewId: 1 },
      body: { outcome: 'retain', note: 'Fine' },
    });
    expect(own.status).toBe(409);
    expect(codeOf(own)).toBe('SELF_REVIEW_BLOCKED');
    const other = await api.callAs(OPS_ADMIN, ops.completeAccessReview, {
      tenant: 'tenderiq-ops',
      params: { reviewId: 2 },
      body: { outcome: 'retain', note: 'All five grants were customer-authorized.' },
    });
    expect(AccessReviewRow.parse(other.body).status).toBe('completed');
  });
});

describe('OPS-07 announcements and help content', () => {
  it('requires review by another operator before publishing', async () => {
    const own = await api.callAs(SUPPORT, ops.publishAnnouncement, { tenant: 'tenderiq-ops', params: { announcementId: 4 } });
    expect(own.status).toBe(409);
    expect(codeOf(own)).toBe('REVIEW_REQUIRED');
    const reviewed = await api.callAs(OPS_ADMIN, ops.publishAnnouncement, { tenant: 'tenderiq-ops', params: { announcementId: 4 } });
    expect(Announcement.parse(reviewed.body).status).toBe('published');
  });

  it('refuses an announcement that carries a formal tender notice', async () => {
    const response = await api.callAs(SUPPORT, ops.createAnnouncement, {
      tenant: 'tenderiq-ops',
      body: { audience: 'suppliers', title: 'Deadline moved', body: 'T-2026-0002 now closes on 23 October.' },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('FORMAL_NOTICE_NOT_ANNOUNCEMENT');
  });

  it('serves the managed help articles from the same rows as public guidance', async () => {
    const detail = HelpArticleDetail.parse(
      (await api.callAs(SUPPORT, ops.getHelpArticle, { tenant: 'tenderiq-ops', params: { articleId: 1 } })).body,
    );
    expect(detail.slug).toBe('registering-your-organization');
  });
});

describe('COM-09 help centre and service notices', () => {
  it('shows buyer-only help to buyers and hides it from suppliers', async () => {
    const buyer = pages.myHelp.parse((await api.callAs(OFFICER, ops.listMyHelpArticles, { query: { pageSize: 100 } })).body);
    const supplier = pages.myHelp.parse((await api.callAs(TSODILO, ops.listMyHelpArticles, { query: { pageSize: 100 } })).body);
    expect(buyer.items.map((row) => row.slug)).toContain('buyer-publication-checklist');
    expect(supplier.items.map((row) => row.slug)).not.toContain('buyer-publication-checklist');
    expect(supplier.items.map((row) => row.slug)).not.toContain('using-tenderiq-in-setswana');
    expect((await api.callAs(TSODILO, ops.getMyHelpArticle, { params: { articleSlug: 'buyer-publication-checklist' } })).status).toBe(404);
  });

  it('labels the incidents that affected the caller’s organizations', async () => {
    const notices = ServiceNoticeList.parse((await api.callAs(OFFICER, ops.listMyServiceNotices)).body);
    const upload = notices.items.find((notice) => notice.id === 'incident-1');
    expect(upload?.affectedOrganizations.map((org) => org.tenantName)).toEqual(['Kalahari Water Utilities (Pilot)']);
    const supplier = ServiceNoticeList.parse((await api.callAs(TSODILO, ops.listMyServiceNotices)).body);
    expect(supplier.items.find((notice) => notice.id === 'incident-1')?.affectedOrganizations).toEqual([]);
    expect(supplier.items.some((notice) => notice.id === 'announcement-3')).toBe(false);
  });

  it('serves public service notices without customer detail or sign-in', async () => {
    const response = await api.request('GET', '/api/v1/public/service-notices');
    expect(response.status).toBe(200);
    const notices = ServiceNoticeList.parse(response.body);
    expect(notices.items.every((notice) => notice.affectedOrganizations.length === 0)).toBe(true);
    expect(notices.items.some((notice) => notice.id === 'incident-3')).toBe(false);
  });
});

describe('ADM-15 integrations (AC-33)', () => {
  it('lists only the active buyer’s connections', async () => {
    const kwu = pages.integrations.parse((await api.callAs(ADMIN_KWU, ops.listIntegrations, { tenant: 'kwu' })).body);
    const odc = pages.integrations.parse((await api.callAs(ADMIN_ODC, ops.listIntegrations, { tenant: 'odc' })).body);
    expect(kwu.total).toBe(6);
    expect(odc.items.map((row) => row.id).sort()).toEqual([11, 12]);
    expect((await api.callAs(ADMIN_ODC, ops.getIntegration, { tenant: 'odc', params: { connectionId: 1 } })).status).toBe(404);
  });

  it('keeps the failed Gazette publication visibly unconfirmed until reconciled with a reference', async () => {
    const detail = IntegrationExceptionDetail.parse(
      (await api.callAs(OFFICER, ops.getIntegrationException, { tenant: 'kwu', params: { exceptionId: 901 } })).body,
    );
    expect(detail.status).toBe('open');
    expect(detail.unconfirmedEffect).toMatch(/not advertised externally/);
    expect(detail.capabilities).toEqual({ canAssign: false, canResolve: true });
    const missing = await api.callAs(OFFICER, ops.resolveIntegrationException, {
      tenant: 'kwu',
      params: { exceptionId: 901 },
      body: { outcome: 'reconciled', resolution: 'Republished' },
    });
    expect(missing.status).toBe(422);
    expect(codeOf(missing)).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
    const reconciled = IntegrationExceptionDetail.parse(
      (
        await api.callAs(OFFICER, ops.resolveIntegrationException, {
          tenant: 'kwu',
          params: { exceptionId: 901 },
          body: { outcome: 'reconciled', resolution: 'Republished with a compressed attachment', externalReference: 'BGG-2026-09-1210' },
        })
      ).body,
    );
    expect(reconciled.status).toBe('reconciled');
    expect(reconciled.unconfirmedEffect).toBeNull();
  });

  it('requires a manual fallback before enabling and blocks retiring with open exceptions', async () => {
    const enable = await api.callAs(ADMIN_KWU, ops.changeIntegrationStatus, {
      tenant: 'kwu',
      params: { connectionId: 5 },
      body: { status: 'active', reason: 'Go live' },
    });
    expect(codeOf(enable)).toBe('MANUAL_FALLBACK_REQUIRED');
    const retire = await api.callAs(ADMIN_KWU, ops.changeIntegrationStatus, {
      tenant: 'kwu',
      params: { connectionId: 1 },
      body: { status: 'retired', reason: 'Replace' },
    });
    expect(codeOf(retire)).toBe('OPEN_EXCEPTIONS_BLOCK_RETIRE');
    const confirmed = IntegrationDetail.parse(
      (await api.callAs(ADMIN_KWU, ops.confirmIntegration, { tenant: 'kwu', params: { connectionId: 4 }, body: {} })).body,
    );
    expect(confirmed.confirmations[0]?.confirmedBy.fullName).toBe('Lorato Kgosi');
  });

  it('answers 403 to the auditor', async () => {
    expect((await api.callAs(AUDITOR, ops.listIntegrationExceptions, { tenant: 'kwu' })).status).toBe(403);
  });

  it('shows tebogo.officer (tender.publish only) publication and notice exceptions only', async () => {
    const officer = pages.exceptions.parse(
      (await api.callAs(OFFICER, ops.listIntegrationExceptions, { tenant: 'kwu', query: { pageSize: 100 } })).body,
    );
    expect(officer.items.length).toBeGreaterThan(0);
    expect(officer.items.every((row) => row.recordType === 'publication' || row.recordType === 'notice')).toBe(true);
    const manager = pages.exceptions.parse(
      (await api.callAs(ADMIN_KWU, ops.listIntegrationExceptions, { tenant: 'kwu', query: { pageSize: 100 } })).body,
    );
    expect(manager.items.map((row) => row.recordType)).toEqual(expect.arrayContaining(['contract', 'membership', 'publication']));
  });

  it('answers 404 to tebogo.officer for the finance and HR exceptions, and lets the manager read them', async () => {
    for (const exceptionId of [903, 905]) {
      expect((await api.callAs(OFFICER, ops.getIntegrationException, { tenant: 'kwu', params: { exceptionId } })).status).toBe(404);
    }
    const investigate = await api.callAs(OFFICER, ops.investigateIntegrationException, {
      tenant: 'kwu',
      params: { exceptionId: 903 },
      body: {},
    });
    expect(investigate.status).toBe(404);
    const resolve = await api.callAs(OFFICER, ops.resolveIntegrationException, {
      tenant: 'kwu',
      params: { exceptionId: 903 },
      body: { outcome: 'closed', resolution: 'Not mine to close' },
    });
    expect(resolve.status).toBe(404);
    expect((await api.callAs(ADMIN_KWU, ops.getIntegrationException, { tenant: 'kwu', params: { exceptionId: 903 } })).status).toBe(200);
  });
});

describe('ADM-16 imports', () => {
  it('keeps the original business date and provenance of the imported legacy contract', async () => {
    const records = pages.importRecords.parse(
      (await api.callAs(ADMIN_KWU, ops.listImportRecords, { tenant: 'kwu', params: { batchId: 1 } })).body,
    );
    const legacy = records.items.find((row) => row.createdEntityLabel === 'C-2025-0007');
    expect(legacy?.originalBusinessDate).toBe('2025-06-20');
    expect(legacy?.provenanceNote).toMatch(/Legacy spreadsheet 2025/);
  });

  it('requires duplicate review and issue resolution before accepting a row', async () => {
    const duplicate = await api.callAs(ADMIN_KWU, ops.decideImportRecord, {
      tenant: 'kwu',
      params: { batchId: 2, recordId: 201 },
      body: { decision: 'accepted', reason: 'Looks right' },
    });
    expect(codeOf(duplicate)).toBe('DUPLICATE_REVIEW_REQUIRED');
    const issues = await api.callAs(ADMIN_KWU, ops.decideImportRecord, {
      tenant: 'kwu',
      params: { batchId: 2, recordId: 203 },
      body: { decision: 'accepted', reason: 'Known driller' },
    });
    expect(codeOf(issues)).toBe('QUALITY_ISSUES_UNRESOLVED');
    const linked = ImportRecordRow.parse(
      (
        await api.callAs(ADMIN_KWU, ops.decideImportRecord, {
          tenant: 'kwu',
          params: { batchId: 2, recordId: 201 },
          body: { decision: 'accepted', reason: 'Same organization', duplicateResolution: 'link_existing' },
        })
      ).body,
    );
    expect(linked.createdEntityId).toBe(4);
  });

  it('refuses to complete a batch with pending rows and isolates ODC batches', async () => {
    const response = await api.callAs(ADMIN_KWU, ops.completeImportBatch, { tenant: 'kwu', params: { batchId: 2 }, body: {} });
    expect(codeOf(response)).toBe('RECORDS_PENDING');
    expect((await api.callAs(ADMIN_KWU, ops.getImportBatch, { tenant: 'kwu', params: { batchId: 5 } })).status).toBe(404);
    const odc = ImportBatchDetail.parse((await api.callAs(ADMIN_ODC, ops.getImportBatch, { tenant: 'odc', params: { batchId: 6 } })).body);
    expect(odc.counts.accepted).toBe(1);
  });
});

describe('ADM-17 subscription and offboarding (AC-36)', () => {
  it('shows KWU its entitlements and lets it request offboarding', async () => {
    const view = BuyerSubscriptionView.parse((await api.callAs(ADMIN_KWU, ops.getBuyerSubscription, { tenant: 'kwu' })).body);
    expect(view.planCode).toBe('pilot');
    expect(view.offboardingPlan).toBeNull();
    expect(view.capabilities.canRequestOffboarding).toBe(true);
  });

  it('lets ODC agree its complete continuity plan with the live tender and contract preserved', async () => {
    const before = BuyerSubscriptionView.parse((await api.callAs(ADMIN_ODC, ops.getBuyerSubscription, { tenant: 'odc' })).body);
    expect(before.capabilities.canAgreePlan).toBe(true);
    const response = await api.callAs(ADMIN_ODC, ops.agreeOffboardingPlan, { tenant: 'odc', body: { acknowledgement: true } });
    expect(response.status).toBe(200);
    const after = BuyerSubscriptionView.parse(response.body);
    expect(after.offboardingPlan?.status).toBe('agreed');
    expect(after.offboardingPlan?.liveEvents.map((event) => event.reference)).toEqual(['T-2026-0011', 'T-2026-0013']);
    expect(after.liveContracts.map((contract) => contract.reference)).toEqual(['C-2025-0004']);
  });

  it('queues an exit export and refuses offboarding twice', async () => {
    const exportResponse = await api.callAs(ADMIN_ODC, ops.requestExitExport, { tenant: 'odc', body: { format: 'csv' } });
    expect(exportResponse.status).toBe(201);
    expect(ExitExport.parse(exportResponse.body).omissions.join(' ')).toMatch(/T-2026-0011/);
    const again = await api.callAs(ADMIN_ODC, ops.requestOffboarding, {
      tenant: 'odc',
      body: { reason: 'Again', requestedEndDate: '2026-12-31', contactName: 'Wame Olebile', contactEmail: 'admin.odc@tenderiq.local', acknowledgement: true },
    });
    expect(codeOf(again)).toBe('OFFBOARDING_ALREADY_REQUESTED');
  });

  it('answers 403 to suppliers and to the auditor', async () => {
    expect((await api.callAs(TSODILO, ops.getBuyerSubscription, { tenant: 'tsodilo' })).status).toBe(403);
    expect((await api.callAs(AUDITOR, ops.getBuyerSubscription, { tenant: 'kwu' })).status).toBe(403);
  });
});

describe('people pickers', () => {
  it('lists only active operator staff for the operator area', async () => {
    const response = await api.callAs(OPS_ADMIN, ops.listOperatorStaff, { tenant: 'tenderiq-ops' });
    expect(response.status).toBe(200);
    const staff = response.body as Array<{ userId: number; fullName: string }>;
    expect(staff.map((person) => person.fullName)).toEqual(['Kitso Ramotswa', 'Naledi Sebego']);
  });

  it('lists the active members of the calling buyer only, never a departed officer', async () => {
    const response = await api.callAs(ADMIN_KWU, ops.listOperationsPeople, { tenant: 'kwu' });
    expect(response.status).toBe(200);
    const people = response.body as Array<{ userId: number; fullName: string }>;
    expect(people.some((person) => person.fullName === 'Lorato Kgosi')).toBe(true);
    expect(people.some((person) => person.fullName === 'Wame Olebile')).toBe(false);
    expect(people.some((person) => person.fullName === 'Gaone Letsholo')).toBe(false);
  });
});

describe('contract conformance of every fixture row', () => {
  it('serves every list and detail of the operator area without drift', async () => {
    // Arrange
    const asOps = (endpoint: Parameters<TestMockApp['callAs']>[1], params?: Record<string, number>) =>
      api.callAs(OPS_ADMIN, endpoint, { tenant: 'tenderiq-ops', query: { pageSize: 100 }, ...(params === undefined ? {} : { params }) });

    // Act
    const responses = [
      ...(await Promise.all([2, 3, 4, 5, 6, 7, 8, 9].map((id) => asOps(ops.getCustomer, { customerTenantId: id })))),
      ...(await Promise.all([1, 2, 3].map((id) => asOps(ops.getSubscription, { subscriptionId: id })))),
      ...(await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((id) => asOps(ops.getSupportCase, { caseId: id })))),
      ...(await Promise.all([1, 2, 3].map((id) => asOps(ops.getIncident, { incidentId: id })))),
      ...(await Promise.all([1, 2, 3, 4, 5].map((id) => asOps(ops.getAnnouncement, { announcementId: id })))),
      ...(await Promise.all(Array.from({ length: 11 }, (_, index) => asOps(ops.getHelpArticle, { articleId: index + 1 })))),
      await asOps(ops.listOffboardingPlans),
      await asOps(ops.listSupportGrants),
      await asOps(ops.listAccessReviews),
      await asOps(ops.listConductCases),
      await asOps(ops.listIncidents),
      await asOps(ops.listHelpArticles),
      await asOps(ops.listAnnouncements),
      await asOps(ops.listSubscriptions),
      await asOps(ops.getOnboarding, { customerTenantId: 3 }),
    ];

    // Assert
    expect(responses.map((response) => response.status).filter((status) => status !== 200)).toEqual([]);
  });

  it('serves every buyer integration, exception and import batch without drift', async () => {
    const kwuConnections = [1, 2, 3, 4, 5, 6];
    const kwuExceptions = [901, 902, 903, 904, 905];
    const responses = [
      ...(await Promise.all(kwuConnections.map((id) => api.callAs(ADMIN_KWU, ops.getIntegration, { tenant: 'kwu', params: { connectionId: id } })))),
      ...(await Promise.all(kwuExceptions.map((id) => api.callAs(ADMIN_KWU, ops.getIntegrationException, { tenant: 'kwu', params: { exceptionId: id } })))),
      ...(await Promise.all([1, 2, 3, 4].map((id) => api.callAs(ADMIN_KWU, ops.getImportBatch, { tenant: 'kwu', params: { batchId: id } })))),
      await api.callAs(ADMIN_ODC, ops.getIntegrationException, { tenant: 'odc', params: { exceptionId: 906 } }),
      await api.callAs(ADMIN_ODC, ops.listImportRecords, { tenant: 'odc', params: { batchId: 5 } }),
      await api.callAs(ADMIN_ODC, ops.getCustomerSupportGrant, { tenant: 'odc', params: { grantId: 2 } }),
    ];
    expect(responses.map((response) => response.status).filter((status) => status !== 200)).toEqual([]);
  });

  it('never logged contract drift or an undeclared error code', () => {
    expect(api.logs.filter((line) => /fixture drift|undeclared error code/.test(line))).toEqual([]);
  });
});
