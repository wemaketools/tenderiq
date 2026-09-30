/**
 * Publication contract: the endpoint map is complete and routable, audiences and permissions follow the rules
 * of the domain (public without permission; invitation answers and acknowledgments by an authorized
 * representative; pursuits by `supplier.pursuit.manage`), and the body refinements carry their stable codes.
 */
import { describe, expect, it } from 'vitest';

import { pathsCollide } from '../catalog.js';
import { splitIssueMessage } from '../common.js';
import { endpointPermissions } from '../endpoint.js';
import type { AnyEndpoint } from '../endpoint.js';
import {
  CreateSubscriptionBody,
  DeclineInvitationBody,
  NotifyBuyerBody,
  PublishBody,
  SavedSearchBody,
  publicationEndpoints,
} from '../publication.js';

const endpoints = Object.values(publicationEndpoints) as AnyEndpoint[];
const DOMAIN_SCREENS = new Set(['BUY-14', 'BUY-15', 'PUB-01', 'PUB-02', 'PUB-03', 'PUB-07', 'SUP-06', 'SUP-07', 'SUP-08', 'SUP-09']);

function codesOf(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return (result.error?.issues ?? []).map((issue) => splitIssueMessage(issue.message).code);
}

describe('publicationEndpoints', () => {
  it('defines 62 endpoints with unique ids and unique METHOD path pairs', () => {
    expect(endpoints).toHaveLength(62);
    expect(new Set(endpoints.map((endpoint) => endpoint.id)).size).toBe(endpoints.length);
    expect(new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(endpoints.length);
  });

  it('has no two routes of one method that match the same URL', () => {
    for (const left of endpoints) {
      for (const right of endpoints) {
        if (left !== right && left.method === right.method) {
          expect(pathsCollide(left.path, right.path), `${left.id} vs ${right.id}`).toBe(false);
        }
      }
    }
  });

  it('names only the screens of the domain', () => {
    for (const endpoint of endpoints) {
      expect(endpoint.screens.some((screen) => DOMAIN_SCREENS.has(screen)), endpoint.id).toBe(true);
    }
  });

  it('keeps public endpoints permission-free and every other endpoint permissioned', () => {
    for (const endpoint of endpoints) {
      if (endpoint.audience === 'public') {
        expect(endpoint.permission, endpoint.id).toBeUndefined();
      } else {
        expect(endpointPermissions(endpoint).length, endpoint.id).toBeGreaterThan(0);
      }
    }
    expect(endpoints.filter((endpoint) => endpoint.audience === 'public')).toHaveLength(9);
  });

  it('requires an authorized representative to answer invitations and acknowledge', () => {
    for (const endpoint of [
      publicationEndpoints.acceptInvitation,
      publicationEndpoints.declineInvitation,
      publicationEndpoints.acknowledge,
      publicationEndpoints.acceptConfidentiality,
      publicationEndpoints.requestAccess,
    ]) {
      expect(endpointPermissions(endpoint)).toEqual(['supplier.notices.acknowledge']);
    }
    expect(endpointPermissions(publicationEndpoints.notifyBuyer)).toEqual(['supplier.pursuit.manage']);
    expect(endpointPermissions(publicationEndpoints.publish)).toEqual(['tender.publish']);
    expect(endpointPermissions(publicationEndpoints.decideAccess)).toEqual(['tender.participants.manage']);
  });

  it('marks record-creating commands idempotent with status 201', () => {
    for (const endpoint of [publicationEndpoints.publish, publicationEndpoints.inviteSupplier, publicationEndpoints.createSavedSearch, publicationEndpoints.addNote]) {
      expect(endpoint.idempotent).toBe(true);
      expect(endpoint.status).toBe(201);
    }
  });
});

describe('publication body rules', () => {
  it('requires a time for a scheduled publication and always the portal channel', () => {
    expect(codesOf(PublishBody.safeParse({ mode: 'scheduled', channels: ['portal'], draftRevision: 1 }))).toEqual(['SCHEDULE_REQUIRED']);
    expect(codesOf(PublishBody.safeParse({ mode: 'now', channels: ['external_notice'], draftRevision: 1 }))).toContain('PORTAL_CHANNEL_REQUIRED');
    expect(PublishBody.safeParse({ mode: 'scheduled', scheduledAt: '2026-10-20T06:00:00Z', channels: ['portal', 'external_notice'], draftRevision: 2 }).success).toBe(true);
  });

  it('shares a reason only with a no-bid (DD-41)', () => {
    expect(codesOf(NotifyBuyerBody.safeParse({ bidIntent: 'intends_to_bid', sharedNoBidReason: 'x' }))).toEqual(['SHARED_REASON_ONLY_FOR_NO_BID']);
    expect(NotifyBuyerBody.safeParse({ bidIntent: 'no_bid', sharedNoBidReason: 'No capacity.' }).success).toBe(true);
  });

  it('requires the reason when a decline is shared with the buyer', () => {
    expect(codesOf(DeclineInvitationBody.safeParse({ shareReasonWithBuyer: true }))).toEqual(['SHARED_REASON_REQUIRED']);
    expect(DeclineInvitationBody.safeParse({ shareReasonWithBuyer: false }).success).toBe(true);
  });

  it('refuses an empty saved search and a deferred procedure (DD-40)', () => {
    const empty = { name: 'Empty', keywords: null, catalogCodes: [], buyerTenantIds: [], regions: [], procedures: [], notify: false };
    expect(codesOf(SavedSearchBody.safeParse(empty))).toEqual(['SAVED_SEARCH_EMPTY']);
    expect(SavedSearchBody.safeParse({ ...empty, procedures: ['framework_calloff'] }).success).toBe(false);
  });

  it('requires a buyer or a category for a subscription', () => {
    expect(codesOf(CreateSubscriptionBody.safeParse({ buyerTenantId: null, catalogCode: null }))).toEqual(['SUBSCRIPTION_SCOPE_REQUIRED']);
    expect(CreateSubscriptionBody.safeParse({ buyerTenantId: null, catalogCode: 'WTR-PUMP' }).success).toBe(true);
  });
});
