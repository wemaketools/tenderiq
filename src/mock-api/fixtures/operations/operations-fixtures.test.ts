/**
 * Operations fixtures: every row projects onto its contract schema, references resolve to platform tenants and
 * personas, ids are unique, and the storyline anchors hold (AC-33 open publication exception, AC-36 ODC exit plan,
 * the platform support grant, the incident linked to T-2026-0002, help for every guidance topic).
 */
import { describe, expect, it } from 'vitest';

import { HELP_ARTICLES_TOPIC } from '../../../contracts/enums.js';
import {
  Announcement,
  CustomerDetail,
  EntitlementUsage,
  IncidentDetail,
  Invoice,
  OffboardingPlanDetail,
  OnboardingItem,
  ServiceAction,
  SubscriptionDetail,
  SupportCaseDetail,
  SupportGrant,
} from '../../../contracts/operations.js';
import { Instant } from '../../../contracts/common.js';
import {
  CUSTOMER_VIEWER,
  caseDetail,
  customerDetail,
  entitlementsOf,
  grantView,
  incidentDetail,
  invoicesOf,
  offboardingDetail,
  onboardingItemView,
  operatorViewer,
  serviceActionView,
  subscriptionDetail,
} from '../../handlers/operations/views.js';
import { MAX_SUPPORT_GRANT_DAYS } from '../../../contracts/operations/support.js';
import { PERSONAS, SUPPORT_GRANTS, TENANTS, TENANT_IDS } from '../platform.js';
import { TENDERS } from '../tenders/index.js';
import { INTEGRATION_EXCEPTIONS as PUBLICATION_EXCEPTIONS } from '../publication.js';
import {
  ACCESS_REVIEWS,
  ANNOUNCEMENTS,
  CONDUCT_CASES,
  CUSTOMER_TENANTS,
  ENTITLEMENTS,
  IMPORT_BATCHES,
  IMPORT_RECORDS,
  INTEGRATION_CONNECTIONS,
  LIVE_EVENTS,
  MANAGED_HELP_ARTICLES,
  OFFBOARDING_PLANS,
  ONBOARDING_ITEMS,
  OPERATIONS_INTEGRATION_EXCEPTIONS,
  SERVICE_ACTIONS,
  SERVICE_INCIDENTS,
  SERVICE_INCIDENT_IMPACTS,
  SUBSCRIPTIONS,
  SUPPORT_ACCESS_GRANTS,
  SUPPORT_ACTIVITY,
  SUPPORT_CASES,
  SUPPORT_CASE_MESSAGES,
  customerProfileOf,
} from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const personaIds = new Set(PERSONAS.map((persona) => persona.userId));
const tenantIds = new Set(TENANTS.map((tenant) => tenant.id));

function unique(ids: readonly number[]): boolean {
  return new Set(ids).size === ids.length;
}

describe('schema conformance', () => {
  it('projects every customer onto CustomerDetail', () => {
    for (const tenant of CUSTOMER_TENANTS) {
      expect(() => CustomerDetail.parse(customerDetail(tenant, NOW))).not.toThrow();
    }
  });

  it('projects every onboarding item, subscription, entitlement, service action and invoice', () => {
    for (const item of ONBOARDING_ITEMS) OnboardingItem.parse(onboardingItemView(item));
    for (const subscription of SUBSCRIPTIONS) {
      SubscriptionDetail.parse(subscriptionDetail(subscription));
      for (const row of entitlementsOf(subscription.id)) EntitlementUsage.parse(row);
      for (const row of invoicesOf(subscription.id)) Invoice.parse(row);
    }
    for (const action of SERVICE_ACTIONS) ServiceAction.parse(serviceActionView(action));
  });

  it('projects every offboarding plan, support case, grant and incident', () => {
    for (const plan of OFFBOARDING_PLANS) {
      OffboardingPlanDetail.parse(offboardingDetail(plan, operatorViewer(NOW)));
      OffboardingPlanDetail.parse(offboardingDetail(plan, CUSTOMER_VIEWER));
    }
    for (const row of SUPPORT_CASES) SupportCaseDetail.parse(caseDetail(row, NOW));
    for (const grant of SUPPORT_ACCESS_GRANTS) SupportGrant.parse(grantView(grant, NOW));
    for (const incident of SERVICE_INCIDENTS) IncidentDetail.parse(incidentDetail(incident));
  });

  it('stores every announcement and help article with valid instants', () => {
    for (const row of ANNOUNCEMENTS) {
      Announcement.shape.status.parse(row.status);
      Instant.parse(row.updatedAt);
    }
    for (const row of MANAGED_HELP_ARTICLES) Instant.parse(row.updatedAt);
  });
});

describe('references and ids', () => {
  it('keeps ids unique per fixture', () => {
    expect(unique(SUPPORT_CASES.map((row) => row.id))).toBe(true);
    expect(unique(SUPPORT_CASE_MESSAGES.map((row) => row.id))).toBe(true);
    expect(unique(SUPPORT_ACCESS_GRANTS.map((row) => row.id))).toBe(true);
    expect(unique(ONBOARDING_ITEMS.map((row) => row.id))).toBe(true);
    expect(unique(INTEGRATION_CONNECTIONS.map((row) => row.id))).toBe(true);
    expect(unique(OPERATIONS_INTEGRATION_EXCEPTIONS.map((row) => row.id))).toBe(true);
    expect(unique(IMPORT_BATCHES.map((row) => row.id))).toBe(true);
    expect(unique(IMPORT_RECORDS.map((row) => row.id))).toBe(true);
    expect(unique(MANAGED_HELP_ARTICLES.map((row) => row.id))).toBe(true);
    expect(new Set(MANAGED_HELP_ARTICLES.map((row) => row.slug)).size).toBe(MANAGED_HELP_ARTICLES.length);
  });

  it('references only existing tenants and personas', () => {
    const people = [
      ...SUPPORT_CASES.flatMap((row) => [row.openedByUserId, row.assignedOperatorUserId]),
      ...SUPPORT_CASE_MESSAGES.map((row) => row.authorUserId),
      ...SUPPORT_ACCESS_GRANTS.flatMap((row) => [row.operatorUserId, row.authorizedByUserId]),
      ...ACCESS_REVIEWS.flatMap((row) => [row.subjectUserId, row.reviewerUserId]),
      ...CONDUCT_CASES.map((row) => row.ownerUserId),
      ...INTEGRATION_CONNECTIONS.map((row) => row.businessOwnerUserId),
      ...IMPORT_BATCHES.flatMap((row) => [row.uploadedByUserId, row.reviewedByUserId]),
    ].filter((id): id is number => id !== null);
    expect(people.filter((id) => !personaIds.has(id))).toEqual([]);
    const tenants = [
      ...SUPPORT_CASES.flatMap((row) => [row.customerTenantId, row.routedToTenantId]),
      ...SUPPORT_ACCESS_GRANTS.map((row) => row.customerTenantId),
      ...SERVICE_INCIDENT_IMPACTS.map((row) => row.customerTenantId),
      ...INTEGRATION_CONNECTIONS.map((row) => row.tenantId),
      ...IMPORT_BATCHES.map((row) => row.tenantId),
      ...IMPORT_RECORDS.map((row) => row.duplicateCandidateTenantId),
    ].filter((id): id is number => id !== null);
    expect(tenants.filter((id) => !tenantIds.has(id))).toEqual([]);
  });

  it('opens support cases only for members of the customer organization', () => {
    for (const row of SUPPORT_CASES) {
      const opener = PERSONAS.find((persona) => persona.userId === row.openedByUserId);
      expect(opener?.memberships.some((membership) => membership.tenantId === row.customerTenantId)).toBe(true);
    }
  });

  it('keeps every integration exception inside the tenant of its connection', () => {
    for (const row of OPERATIONS_INTEGRATION_EXCEPTIONS) {
      expect(INTEGRATION_CONNECTIONS.find((connection) => connection.id === row.connectionId)?.tenantId).toBe(row.tenantId);
    }
  });
});

describe('storyline anchors', () => {
  it('repeats the platform support grant with its window capped at the requested days (OPS-04)', () => {
    const platform = SUPPORT_GRANTS[0];
    const grant = SUPPORT_ACCESS_GRANTS.find((row) => row.id === platform?.grantId);
    expect(grant).toMatchObject({
      caseId: platform?.caseId,
      operatorUserId: platform?.operatorUserId,
      customerTenantId: platform?.customerTenantId,
      scope: platform?.scope,
      authorizedByUserId: platform?.authorizedByUserId,
      startsAt: platform?.startsAt,
      status: 'active',
    });
    expect(grant?.expiresAt).toBe('2026-10-12T07:00:00Z');
    expect(Date.parse(grant?.expiresAt ?? '')).toBeLessThanOrEqual(Date.parse(platform?.expiresAt ?? ''));
  });

  it('keeps every authorized, active, expired or revoked grant within MAX_SUPPORT_GRANT_DAYS and its requested days', () => {
    const windowed = SUPPORT_ACCESS_GRANTS.filter((grant) => ['authorized', 'active', 'expired', 'revoked'].includes(grant.status));
    expect(windowed.length).toBeGreaterThan(0);
    for (const grant of windowed) {
      expect(grant.startsAt).not.toBeNull();
      expect(grant.expiresAt).not.toBeNull();
      const days = (Date.parse(grant.expiresAt ?? '') - Date.parse(grant.startsAt ?? '')) / 86_400_000;
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(MAX_SUPPORT_GRANT_DAYS);
      expect(days).toBeLessThanOrEqual(grant.requestedDays);
    }
  });

  it('states the capped grant window in the case message and the authorization activity', () => {
    expect(SUPPORT_CASE_MESSAGES.find((row) => row.id === 1003)?.body).toContain('until 12 Oct');
    expect(SUPPORT_ACTIVITY.find((row) => row.grantId === 1 && row.action === 'grant.authorized')?.description).toContain('until 12 Oct 2026');
  });

  it('derives published events and the published-events usage from the released tenders of the demo year', () => {
    const released = (tenantId: number) =>
      TENDERS.filter(
        (tender) =>
          tender.tenantId === tenantId &&
          tender.status !== 'draft' &&
          tender.status !== 'awaiting_release_approval' &&
          (tender.releasedAt ?? '').startsWith('2026-'),
      ).length;
    expect(released(TENANT_IDS.kwu)).toBe(10);
    expect(released(TENANT_IDS.odc)).toBe(1);
    for (const tenantId of [TENANT_IDS.kwu, TENANT_IDS.odc]) {
      expect(customerProfileOf(tenantId)?.publishedEventsYtd).toBe(released(tenantId));
      const subscription = SUBSCRIPTIONS.find((row) => row.customerTenantId === tenantId && row.status !== 'ended' && row.status !== 'cancelled');
      const usage = ENTITLEMENTS.find((row) => row.subscriptionId === subscription?.id && row.featureCode === 'published_events_per_year');
      expect(usage?.usageValue).toBe(released(tenantId));
    }
  });

  it('marks invitation-only, restricted and unreleased live events as not public', () => {
    const byReference = new Map(LIVE_EVENTS.map((event) => [event.reference, event]));
    expect(byReference.get('T-2026-0006')?.publiclyVisible).toBe(false);
    expect(byReference.get('T-2026-0009')?.publiclyVisible).toBe(false);
    expect(byReference.get('T-2026-0002')?.publiclyVisible).toBe(true);
    expect(byReference.get('T-2026-0011')?.publiclyVisible).toBe(true);
  });

  it('keeps the AC-33 publication exception open and identical to the publication fixture', () => {
    const publication = PUBLICATION_EXCEPTIONS.find((row) => row.id === 901);
    const operations = OPERATIONS_INTEGRATION_EXCEPTIONS.find((row) => row.id === 901);
    expect(operations?.status).toBe('open');
    expect(operations).toMatchObject({ status: publication?.status, ownerUserId: publication?.ownerUserId, recordId: publication?.recordId });
    expect(operations?.unconfirmedEffect).not.toBeNull();
  });

  it('gives ODC a draft exit plan with a live tender and a live contract (AC-36)', () => {
    const plan = OFFBOARDING_PLANS.find((row) => row.customerTenantId === TENANT_IDS.odc);
    expect(plan?.status).toBe('draft');
    const detail = plan === undefined ? null : offboardingDetail(plan, operatorViewer(NOW));
    expect(detail?.activeEventsCount).toBeGreaterThan(0);
    expect(detail?.activeContractsCount).toBeGreaterThan(0);
  });

  it('links one resolved incident to T-2026-0002', () => {
    const linked = SERVICE_INCIDENTS.filter(
      (incident) =>
        incident.status === 'resolved' &&
        SERVICE_INCIDENT_IMPACTS.some((impact) => impact.incidentId === incident.id && impact.tenderReference === 'T-2026-0002'),
    );
    expect(linked).toHaveLength(1);
  });

  it('publishes help for every guidance topic', () => {
    const topics = new Set(MANAGED_HELP_ARTICLES.filter((row) => row.status === 'published').map((row) => row.topic));
    expect(HELP_ARTICLES_TOPIC.filter((topic) => !topics.has(topic))).toEqual([]);
  });

  it('seeds at least two support cases and one authorized time-limited grant', () => {
    expect(SUPPORT_CASES.length).toBeGreaterThanOrEqual(2);
    expect(SUPPORT_ACCESS_GRANTS.filter((grant) => grant.status === 'active' && grant.expiresAt !== null)).toHaveLength(1);
  });
});
