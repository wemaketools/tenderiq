/**
 * The bids contract: every endpoint is a valid, routable definition with the right audience and permission kind,
 * and the request schemas enforce the business rules the UI must show (FR-11, FR-12; DD-32).
 */
import { describe, expect, it } from 'vitest';

import {
  BidStartOptions,
  PRICING_VIEW_PERMISSIONS,
  RESPONSE_TEAM_PERMISSIONS,
  SaveAnswerBody,
  SaveConsortiumBody,
  SavePricingBody,
  SaveSubcontractorsBody,
  SubmitBody,
  WithdrawBody,
  bidEndpoints,
} from '../bids.js';
import { ERROR_CODE_PATTERN, splitIssueMessage } from '../common.js';
import { endpointPermissions, validateEndpointDefinition } from '../endpoint.js';
import { permissionTenantKind } from '../permissions.js';

const ENDPOINTS = Object.values(bidEndpoints);
const SCREENS = new Set(['SUP-12', 'SUP-13', 'SUP-14', 'SUP-15', 'SUP-16', 'SUP-17', 'BUY-19']);

function issueCodes(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => splitIssueMessage(issue.message).code);
}

describe('bid endpoints', () => {
  it('defines 43 valid endpoints with unique ids and routes', () => {
    expect(ENDPOINTS).toHaveLength(43);
    for (const endpoint of ENDPOINTS) {
      expect(validateEndpointDefinition(endpoint)).toEqual([]);
    }
    expect(new Set(ENDPOINTS.map((endpoint) => endpoint.id)).size).toBe(ENDPOINTS.length);
    expect(new Set(ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(ENDPOINTS.length);
  });

  it('serves suppliers and buyers only, each with permissions of their own tenant kind', () => {
    for (const endpoint of ENDPOINTS) {
      expect(['supplier', 'buyer']).toContain(endpoint.audience);
      for (const code of endpointPermissions(endpoint)) {
        expect(permissionTenantKind(code)).toBe(endpoint.audience);
      }
    }
  });

  it('names only this domain’s screens and declares UPPER_SNAKE errors', () => {
    for (const endpoint of ENDPOINTS) {
      for (const screen of endpoint.screens) {
        expect(SCREENS.has(screen)).toBe(true);
      }
      for (const code of endpoint.errors) {
        expect(code).toMatch(ERROR_CODE_PATTERN);
      }
    }
  });

  it('requires supplier.response.submit to submit and to withdraw (AC-03)', () => {
    expect(endpointPermissions(bidEndpoints.submitBid)).toEqual(['supplier.response.submit']);
    expect(endpointPermissions(bidEndpoints.withdrawBid)).toEqual(['supplier.response.submit']);
  });

  it('restricts pricing to pricing personas and approvers', () => {
    expect(endpointPermissions(bidEndpoints.getPricing)).toEqual([...PRICING_VIEW_PERMISSIONS]);
    expect(endpointPermissions(bidEndpoints.savePricing)).toEqual(['supplier.pricing.edit']);
    expect(PRICING_VIEW_PERMISSIONS).not.toContain('supplier.response.edit');
    expect(RESPONSE_TEAM_PERMISSIONS).toContain('supplier.response.edit');
  });

  it('exposes no buyer endpoint that reads response content (BR-17)', () => {
    const buyerPaths = ENDPOINTS.filter((endpoint) => endpoint.audience === 'buyer').map((endpoint) => endpoint.path);
    expect(buyerPaths.every((path) => path.startsWith('/api/v1/buyer/submission-monitoring'))).toBe(true);
    expect(buyerPaths.some((path) => /answers|pricing|declarations/.test(path))).toBe(false);
  });

  it('marks record-creating commands idempotent (DD-39)', () => {
    for (const endpoint of [bidEndpoints.startBid, bidEndpoints.submitBid, bidEndpoints.withdrawBid, bidEndpoints.createRevision]) {
      expect(endpoint.idempotent).toBe(true);
      expect(endpoint.status).toBe(201);
    }
  });
});

describe('request schemas', () => {
  it('requires at least one start option and a known block reason when a response cannot be started', () => {
    const base = {
      tender: {
        tenderId: 11,
        reference: 'T-2026-0011',
        title: 'Office cleaning services',
        eventType: 'rfq',
        status: 'open',
        buyer: { tenantId: 3, name: 'Okavango District Council', slug: 'odc' },
      },
      roundType: 'initial',
      deadline: { at: '2026-10-23T10:00:00Z', timeZone: 'Africa/Gaborone' },
      alternativesAllowed: false,
      lots: [],
    };
    expect(BidStartOptions.safeParse({ ...base, options: [] }).success).toBe(false);
    expect(
      BidStartOptions.safeParse({ ...base, options: [{ isAlternative: false, canStart: false, blockedBy: 'CLOSED', existingBidId: null }] }).success,
    ).toBe(false);
    expect(
      BidStartOptions.safeParse({ ...base, options: [{ isAlternative: false, canStart: false, blockedBy: 'BID_ALREADY_EXISTS', existingBidId: 14 }] }).success,
    ).toBe(true);
  });

  it('requires a deviation note when an answer declares a deviation', () => {
    const result = SaveAnswerBody.safeParse({ revisionId: 1, isDeviation: true, progress: 'complete' });
    expect(issueCodes(result)).toContain('DEVIATION_NOTE_REQUIRED');
  });

  it('keeps included and not-offered lines distinct from a zero price', () => {
    const included = SavePricingBody.safeParse({
      revisionId: 1,
      lines: [{ pricingItemId: 1, priceStatus: 'included', unitPrice: '0.00' }],
      commercialTerms: { validityDays: 90, paymentTerms: null, conditionalDiscounts: null, assumptions: null },
    });
    const priced = SavePricingBody.safeParse({
      revisionId: 1,
      lines: [{ pricingItemId: 1, priceStatus: 'priced' }],
      commercialTerms: { validityDays: 90, paymentTerms: null, conditionalDiscounts: null, assumptions: null },
    });
    expect(issueCodes(included)).toContain('PRICE_NOT_ALLOWED');
    expect(issueCodes(priced)).toEqual(expect.arrayContaining(['PRICE_REQUIRED', 'QUANTITY_REQUIRED', 'CURRENCY_REQUIRED']));
  });

  it('rejects a float price', () => {
    const result = SavePricingBody.safeParse({
      revisionId: 1,
      lines: [{ pricingItemId: 1, priceStatus: 'priced', unitPrice: 12.5, quantity: '1', currency: 'BWP' }],
      commercialTerms: { validityDays: 90, paymentTerms: null, conditionalDiscounts: null, assumptions: null },
    });
    expect(result.success).toBe(false);
  });

  it('caps subcontracted shares at 100 percent', () => {
    const result = SaveSubcontractorsBody.safeParse({
      revisionId: 1,
      subcontractors: [
        { name: 'A', scope: 'Civil', sharePercent: '60.00' },
        { name: 'B', scope: 'Electrical', sharePercent: '40.50' },
      ],
    });
    expect(issueCodes(result)).toContain('SHARE_EXCEEDS_100');
  });

  it('requires exactly one lead and two members for a consortium', () => {
    const result = SaveConsortiumBody.safeParse({ revisionId: 1, isConsortium: true, members: [{ memberName: 'A', isLead: false }] });
    expect(issueCodes(result)).toEqual(expect.arrayContaining(['CONSORTIUM_MEMBERS_REQUIRED', 'ONE_LEAD_REQUIRED']));
  });

  it('requires the final declaration and the context confirmation to submit', () => {
    const result = SubmitBody.safeParse({ revisionId: 1, contentHash: 'a'.repeat(64), confirmation: { tenantId: 4, capacity: '' }, finalDeclarationAccepted: false });
    expect(issueCodes(result)).toEqual(expect.arrayContaining(['FINAL_DECLARATION_REQUIRED', 'CAPACITY_REQUIRED']));
  });

  it('requires a reason and an understood effect to withdraw', () => {
    const result = WithdrawBody.safeParse({ receiptId: 1, reason: '', confirmation: { tenantId: 4, capacity: 'Director' }, effectUnderstood: false });
    expect(issueCodes(result)).toEqual(expect.arrayContaining(['REASON_REQUIRED', 'EFFECT_NOT_CONFIRMED']));
  });
});
