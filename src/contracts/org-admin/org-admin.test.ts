/**
 * Org-admin contract tests: the endpoint map is well formed, the buyer and supplier member-administration sets
 * mirror each other, permissions match the audience, and the business refinements produce their error codes.
 */
import { describe, expect, it } from 'vitest';

import { validateEndpointDefinition } from '../endpoint.js';
import { permissionTenantKind } from '../permissions.js';
import {
  AccessScopeInput,
  CreateAccessGrantBody,
  CreateDelegationBody,
  DecideConflictBody,
  RequestContactChangeBody,
  SOD_RULE_PERMISSIONS,
  UpdateOrganizationBody,
  UpdateSodPolicyBody,
  accessItemStatus,
  buyerMemberAdmin,
  orgAdminEndpoints,
  sodRulesBreachedBy,
  supplierMemberAdmin,
} from '../org-admin.js';

function codesOf(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message.split('|')[0] ?? '');
}

describe('org-admin endpoint map', () => {
  const endpoints = Object.values(orgAdminEndpoints);

  it('defines valid endpoints with unique ids and routes', () => {
    expect(endpoints.flatMap((endpoint) => validateEndpointDefinition(endpoint))).toEqual([]);
    const ids = endpoints.map((endpoint) => endpoint.id);
    expect(new Set(ids).size).toBe(ids.length);
    const routes = endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('serves the same member-administration surface to buyers and suppliers', () => {
    expect(Object.keys(supplierMemberAdmin)).toEqual(Object.keys(buyerMemberAdmin));
    for (const key of Object.keys(buyerMemberAdmin) as Array<keyof typeof buyerMemberAdmin>) {
      expect(supplierMemberAdmin[key].path.replace('/supplier/', '/buyer/')).toBe(buyerMemberAdmin[key].path);
      expect(supplierMemberAdmin[key].body).toBe(buyerMemberAdmin[key].body);
      expect(supplierMemberAdmin[key].query).toBe(buyerMemberAdmin[key].query);
      expect(supplierMemberAdmin[key].errors).toEqual(buyerMemberAdmin[key].errors);
    }
  });

  it('requires only permissions of the audience’s tenant kind', () => {
    for (const endpoint of endpoints) {
      const permissions = endpoint.permission === undefined ? [] : Array.isArray(endpoint.permission) ? endpoint.permission : [endpoint.permission];
      for (const code of permissions as string[]) {
        if (endpoint.audience === 'supplier') {
          expect(code.startsWith('supplier.'), endpoint.id).toBe(true);
        }
        if (endpoint.audience === 'buyer') {
          expect(code.startsWith('supplier.'), endpoint.id).toBe(false);
        }
      }
    }
  });

  it('covers every screen of the domain', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => [...endpoint.screens]));
    for (const screen of ['COM-01', 'COM-02', 'COM-03', 'ADM-01', 'ADM-02', 'ADM-03', 'ADM-04', 'ADM-05', 'SUP-04']) {
      expect(screens.has(screen), screen).toBe(true);
    }
  });
});

describe('segregation of duties', () => {
  it('maps every rule to two buyer permissions', () => {
    for (const [rule, permissions] of Object.entries(SOD_RULE_PERMISSIONS)) {
      expect(permissions.map((code) => permissionTenantKind(code)), rule).toEqual(['buyer', 'buyer']);
    }
  });

  it('reports a rule only when both of its permissions are held', () => {
    expect(sodRulesBreachedBy(['evaluation.score'])).toEqual([]);
    expect(sodRulesBreachedBy(['evaluation.score', 'award.approve', 'tender.view'])).toEqual(['evaluation_vs_award_approval']);
  });

  it('requires a documented note for alternative oversight', () => {
    expect(codesOf(UpdateSodPolicyBody.safeParse({ mode: 'alternative_oversight', alternativeOversightNote: 'short', reason: 'x' }))).toEqual([
      'ALTERNATIVE_OVERSIGHT_NOTE_REQUIRED',
    ]);
    expect(UpdateSodPolicyBody.safeParse({ mode: 'enforced', alternativeOversightNote: null, reason: 'x' }).success).toBe(true);
  });
});

describe('validity windows (DD-18)', () => {
  const now = new Date('2026-09-30T08:00:00Z');

  it.each([
    [{ startsAt: '2026-10-01T00:00:00Z', endsAt: null, revokedAt: null }, 'scheduled'],
    [{ startsAt: '2026-09-01T00:00:00Z', endsAt: null, revokedAt: null }, 'active'],
    [{ startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-10-20T00:00:00Z', revokedAt: null }, 'expiring_soon'],
    [{ startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-29T00:00:00Z', revokedAt: null }, 'expired'],
    [{ startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', revokedAt: '2026-09-15T00:00:00Z' }, 'revoked'],
  ] as const)('derives the display status of %o as %s', (window, expected) => {
    expect(accessItemStatus(window, now)).toBe(expected);
  });
});

describe('request refinements', () => {
  it('requires a scope record exactly when the scope is not the organization', () => {
    expect(AccessScopeInput.safeParse({ scopeType: 'organization', scopeId: null }).success).toBe(true);
    expect(codesOf(AccessScopeInput.safeParse({ scopeType: 'tender', scopeId: null }))).toEqual(['SCOPE_INVALID']);
    expect(codesOf(AccessScopeInput.safeParse({ scopeType: 'organization', scopeId: 3 }))).toEqual(['SCOPE_INVALID']);
  });

  it('rejects a grant that expires before it starts', () => {
    const result = CreateAccessGrantBody.safeParse({
      userId: 6,
      permissionCode: 'org.fields.manage',
      scope: { scopeType: 'organization', scopeId: null },
      reason: 'x',
      ownerUserId: 4,
      startsAt: '2026-10-02T00:00:00Z',
      expiresAt: '2026-10-01T00:00:00Z',
    });
    expect(codesOf(result)).toEqual(['GRANT_DATES_INVALID']);
  });

  it('rejects a delegation to oneself', () => {
    const result = CreateDelegationBody.safeParse({
      delegatorUserId: 4,
      delegateUserId: 4,
      decisionTypes: ['request_approval'],
      maxAmount: { amount: '1.00', currency: 'BWP' },
      legalEntityId: null,
      categoryId: null,
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-10-02T00:00:00Z',
      reason: 'x',
    });
    expect(codesOf(result)).toEqual(['DELEGATE_SAME_AS_DELEGATOR']);
  });

  it('requires a reassignee for a reassigned disposition and never offers pending_review', () => {
    expect(codesOf(DecideConflictBody.safeParse({ disposition: 'reassigned', reviewNote: 'x', reassignToUserId: null }))).toEqual(['REASSIGNEE_REQUIRED']);
    expect(DecideConflictBody.safeParse({ disposition: 'pending_review', reviewNote: 'x', reassignToUserId: null }).success).toBe(false);
  });

  it('validates the new contact detail by field', () => {
    expect(codesOf(RequestContactChangeBody.safeParse({ field: 'email', newValue: 'not-mail' }))).toEqual(['INVALID_EMAIL']);
    expect(RequestContactChangeBody.safeParse({ field: 'phone', newValue: '+267 71 234 567' }).success).toBe(true);
  });

  it('requires the default currency to be accepted', () => {
    const body = {
      tradingName: null,
      brandingDisplayName: null,
      officialTimeZone: 'Africa/Gaborone',
      workingLanguages: ['en'],
      defaultCurrency: 'USD',
      acceptedCurrencies: ['BWP'],
      responsibilities: {
        procurementOwner: null,
        administrator: null,
        budgetApprovalOwner: null,
        publicationOwner: null,
        complaintsOwner: null,
        recordsOwner: null,
        contractOwner: null,
        supportContact: null,
      },
      publicPortalEnabled: false,
      portalIntro: null,
      acknowledgeImpact: false,
    };
    expect(codesOf(UpdateOrganizationBody.safeParse(body))).toEqual(['DEFAULT_CURRENCY_NOT_ACCEPTED']);
  });
});
