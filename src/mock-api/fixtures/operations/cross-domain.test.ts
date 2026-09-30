/**
 * Operations fixtures agree with the records other domains show for the same world: the customer identity and usage
 * on OPS-01, OPS-03, OPS-06 and ADM-17 match the organization's own records (ADM-01 settings and legal entities,
 * ADM-03 members, ADM-15 connections, CON-01 contract register), and the service incident linked to T-2026-0002 has
 * the same window on OPS-05 as on the buyer's BUY-19 incident panel.
 */
import { describe, expect, it } from 'vitest';

import type { EntitlementFeatureCode } from '../../../contracts/operations.js';
import { customerDetail, entitlementsOf } from '../../handlers/operations/views.js';
import { BID_TENDER_INCIDENTS } from '../bids/catalog.js';
import { BID_REVISIONS } from '../bids/responses.js';
import { CONTRACTS } from '../contracts/index.js';
import { LEGAL_ENTITIES, MEMBERS, ORGANIZATION_SETTINGS } from '../org-admin/index.js';
import { TENANTS, TENANT_IDS } from '../platform.js';
import {
  ENTITLEMENTS,
  INCIDENT_SLOW_UPLOADS_WINDOW,
  INTEGRATION_CONNECTIONS,
  SERVICE_INCIDENTS,
  SUBSCRIPTIONS,
  customerProfileOf,
} from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const BUYERS = [TENANT_IDS.kwu, TENANT_IDS.odc] as const;

function tenantOf(tenantId: number) {
  const tenant = TENANTS.find((row) => row.id === tenantId);
  if (tenant === undefined) throw new Error(`Unknown tenant ${String(tenantId)}`);
  return tenant;
}

function currentSubscriptionId(tenantId: number): number {
  const subscription = SUBSCRIPTIONS.find(
    (row) => row.customerTenantId === tenantId && row.status !== 'ended' && row.status !== 'cancelled',
  );
  if (subscription === undefined) throw new Error(`No current subscription for tenant ${String(tenantId)}`);
  return subscription.id;
}

function entitlement(tenantId: number, featureCode: EntitlementFeatureCode) {
  const subscriptionId = currentSubscriptionId(tenantId);
  return ENTITLEMENTS.find((row) => row.subscriptionId === subscriptionId && row.featureCode === featureCode);
}

const activeMembers = (tenantId: number) =>
  MEMBERS.filter((row) => row.tenantId === tenantId && row.membershipStatus === 'active' && row.userStatus === 'active')
    .length;
const activeEntities = (tenantId: number) => LEGAL_ENTITIES.filter((row) => row.tenantId === tenantId && row.active).length;
const activeConnections = (tenantId: number) =>
  INTEGRATION_CONNECTIONS.filter((row) => row.tenantId === tenantId && row.status === 'active').length;
const activeContracts = (tenantId: number) =>
  CONTRACTS.filter((row) => row.tenantId === tenantId && row.status === 'active').length;

describe('customer identity (OPS-01 against ADM-01)', () => {
  it.each(BUYERS)('shows the trading name and registration number buyer %i maintains in its settings', (tenantId) => {
    const settings = ORGANIZATION_SETTINGS.find((row) => row.tenantId === tenantId);
    const detail = customerDetail(tenantOf(tenantId), NOW);

    expect(detail.tradingName).toBe(settings?.tradingName);
    expect(detail.registrationNumber).toBe(settings?.registrationNumber);
  });

  it('names KWU with the storyline identity Kalahari Water, BW-PE-2004-0117', () => {
    const profile = customerProfileOf(TENANT_IDS.kwu);

    expect(profile).toMatchObject({ tradingName: 'Kalahari Water', registrationNumber: 'BW-PE-2004-0117' });
  });
});

describe('customer usage (OPS-01, OPS-06, ADM-17 against ADM-03, ADM-01, ADM-15, CON-01)', () => {
  it.each(BUYERS)('counts active users and active contracts of buyer %i as its own registers do', (tenantId) => {
    const detail = customerDetail(tenantOf(tenantId), NOW);

    expect(detail.usage.activeUsers).toBe(activeMembers(tenantId));
    expect(detail.usage.activeContracts).toBe(activeContracts(tenantId));
  });

  it.each(BUYERS)('reports entitlement usage of buyer %i from the members, entities, connections and contracts', (tenantId) => {
    expect(entitlement(tenantId, 'named_users')?.usageValue).toBe(activeMembers(tenantId));
    expect(entitlement(tenantId, 'legal_entities')?.usageValue).toBe(activeEntities(tenantId));
    expect(entitlement(tenantId, 'integrations')?.usageValue).toBe(activeConnections(tenantId));
    expect(entitlement(tenantId, 'active_contracts')?.usageValue).toBe(activeContracts(tenantId));
  });

  it('keeps the KWU storyline numbers: 21 users, 2 of 2 legal entities, 4 connections, 1 active contract', () => {
    const rows = entitlementsOf(currentSubscriptionId(TENANT_IDS.kwu));
    const row = (code: EntitlementFeatureCode) => rows.find((entry) => entry.featureCode === code);

    expect(row('named_users')?.usageValue).toBe(21);
    expect(row('legal_entities')).toMatchObject({ usageValue: 2, limitValue: 2 });
    expect(row('integrations')?.usageValue).toBe(4);
    expect(row('active_contracts')?.usageValue).toBe(1);
  });
});

describe('service incident INC-2026-007 (OPS-05 against BUY-19)', () => {
  const incident = SERVICE_INCIDENTS.find((row) => row.reference === 'INC-2026-007');

  it('has the window the buyer sees on the T-2026-0002 incident panel', () => {
    const buyerView = BID_TENDER_INCIDENTS.find((row) => row.incidentId === incident?.id);

    expect(incident).toMatchObject(INCIDENT_SLOW_UPLOADS_WINDOW);
    expect(buyerView).toMatchObject({ startedAt: incident?.startedAt, resolvedAt: incident?.resolvedAt });
  });

  it('contains the failed replacement upload of T-2026-0002 inside the incident window', () => {
    const failed = BID_REVISIONS.filter((row) => row.status === 'submission_failed' && row.updatedAt.startsWith('2026-09-24'));
    const start = Date.parse(INCIDENT_SLOW_UPLOADS_WINDOW.startedAt);
    const end = Date.parse(INCIDENT_SLOW_UPLOADS_WINDOW.resolvedAt);

    expect(failed.length).toBeGreaterThan(0);
    for (const revision of failed) {
      const at = Date.parse(revision.updatedAt);
      expect(at).toBeGreaterThanOrEqual(start);
      expect(at).toBeLessThanOrEqual(end);
    }
  });
});
