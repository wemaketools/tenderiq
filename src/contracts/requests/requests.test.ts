/**
 * Requests contract (05): endpoint map shape, audiences and permissions, request lifecycle rules and the
 * business-rule validations of the bodies (FR-04, FR-05, §8.1, BR-10, DD-40).
 */
import { describe, expect, it } from 'vitest';

import { splitIssueMessage } from '../common.js';
import type { AnyEndpoint } from '../endpoint.js';
import { endpointPermissions } from '../endpoint.js';
import { PROCUREMENT_REQUESTS_STATUS } from '../enums.js';
import {
  AddMarketResearchBody,
  BusinessCaseBody,
  CreatePlanItemBody,
  CreateStrategyBody,
  DecideRequestBody,
  FollowNoticeBody,
  REQUEST_ACTIONS,
  REQUEST_ACTION_STATUSES,
  REQUEST_TRANSITIONS,
  ResourceDemandQuery,
  SplitRequestBody,
  UpdateStrategyBody,
  canTransitionRequest,
  createTenderPath,
  monthsBetween,
  requestEndpoints,
} from '../requests.js';

const endpoints = Object.values(requestEndpoints) as AnyEndpoint[];

function codesOf(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return (result.error?.issues ?? []).map((issue) => splitIssueMessage(issue.message).code);
}

describe('requestEndpoints', () => {
  it('defines 49 endpoints with unique ids and METHOD path pairs', () => {
    // Arrange
    const ids = endpoints.map((endpoint) => endpoint.id);
    const routes = endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);

    // Assert
    expect(endpoints).toHaveLength(49);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('serves every buyer screen and PUB-06, and nothing else', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));
    expect([...screens].sort()).toEqual(['BUY-02', 'BUY-03', 'BUY-04', 'BUY-05', 'BUY-06', 'PUB-06']);
  });

  it('declares a request, plan or strategy permission on every buyer endpoint and none on public endpoints', () => {
    for (const endpoint of endpoints) {
      const permissions = endpoint.permission === undefined ? [] : endpointPermissions(endpoint);
      if (endpoint.audience === 'public') {
        expect(permissions, endpoint.id).toEqual([]);
      } else {
        expect(endpoint.audience, endpoint.id).toBe('buyer');
        expect(permissions.length, endpoint.id).toBeGreaterThan(0);
      }
    }
  });

  it('marks record-creating commands idempotent (201) and keeps reads free of bodies', () => {
    const idempotent = endpoints.filter((endpoint) => endpoint.idempotent === true).map((endpoint) => endpoint.id);
    expect(idempotent.sort()).toEqual(
      [
        'buyer.planning.create',
        'buyer.planning.createNotice',
        'buyer.requests.comment',
        'buyer.requests.create',
        'buyer.requests.requestInfo',
        'buyer.strategies.addResearch',
        'buyer.strategies.create',
      ].sort(),
    );
    for (const endpoint of endpoints.filter((candidate) => candidate.method === 'GET')) {
      expect(endpoint.body, endpoint.id).toBeUndefined();
    }
  });

  it('requires request.approve to decide and holds the AC-05 and BR-10 error codes', () => {
    expect(requestEndpoints.decideRequest.permission).toBe('request.approve');
    expect(requestEndpoints.decideRequest.errors).toEqual(
      expect.arrayContaining(['AUTHORITY_EXCEEDED', 'SELF_APPROVAL_BLOCKED', 'FUNDING_NOT_CONFIRMED', 'REVISION_CONFLICT']),
    );
    expect(requestEndpoints.submitStrategy.errors).toEqual(expect.arrayContaining(['FAIRNESS_REVIEW_PENDING', 'DIRECT_AWARD_GROUNDS_REQUIRED']));
  });
});

describe('request lifecycle (PRD §8.1)', () => {
  it('covers every request status and ends converted, routed, rescinded and closed requests', () => {
    expect(Object.keys(REQUEST_TRANSITIONS).sort()).toEqual([...PROCUREMENT_REQUESTS_STATUS].sort());
    for (const terminal of ['converted', 'routed_to_existing', 'rescinded', 'closed'] as const) {
      expect(REQUEST_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it('allows the §8.1 outcomes and refuses shortcuts', () => {
    expect(canTransitionRequest('draft', 'submitted')).toBe(true);
    expect(canTransitionRequest('information_requested', 'submitted')).toBe(true);
    expect(canTransitionRequest('approved', 'converted')).toBe(true);
    expect(canTransitionRequest('rejected', 'under_review')).toBe(true);
    expect(canTransitionRequest('draft', 'approved')).toBe(false);
    expect(canTransitionRequest('converted', 'approved')).toBe(false);
  });

  it('offers each action only in statuses the lifecycle allows', () => {
    for (const action of REQUEST_ACTIONS) {
      expect(REQUEST_ACTION_STATUSES[action].length, action).toBeGreaterThan(0);
    }
    expect(REQUEST_ACTION_STATUSES.create_tender).toEqual(['approved']);
  });

  it('links an approved request to the tender creation route', () => {
    expect(createTenderPath(5)).toBe('/buyer/tenders/new?fromRequest=5');
  });
});

describe('BusinessCaseBody', () => {
  it('accepts a minimal draft and defaults funding and priority', () => {
    const parsed = BusinessCaseBody.parse({ title: 'Borehole spares', needType: 'new_expenditure' });
    expect(parsed).toMatchObject({ fundingStatus: 'none', priority: 'normal' });
  });

  it('requires the replaced contract when the need replaces or extends one', () => {
    const result = BusinessCaseBody.safeParse({ title: 'Fleet servicing', needType: 'extension' });
    expect(result.success).toBe(false);
    expect(codesOf(result)).toContain('REPLACED_CONTRACT_REQUIRED');
  });

  it('rejects a total commitment in another currency than the estimate', () => {
    const result = BusinessCaseBody.safeParse({
      title: 'Pipeline',
      needType: 'new_expenditure',
      estimatedValue: { amount: '100.00', currency: 'BWP' },
      estimatedTotalCommitment: { amount: '120.00', currency: 'USD' },
    });
    expect(codesOf(result)).toContain('CURRENCY_MISMATCH');
  });

  it('rejects a money amount written as a number', () => {
    const result = BusinessCaseBody.safeParse({ title: 'Pipeline', needType: 'new_expenditure', estimatedValue: { amount: 100, currency: 'BWP' } });
    expect(result.success).toBe(false);
  });
});

describe('decision and split bodies', () => {
  it('requires conditions for an approval with conditions', () => {
    const result = DecideRequestBody.safeParse({ decision: 'approve_with_conditions', reason: 'Fine', subjectRevision: 1 });
    expect(codesOf(result)).toContain('CONDITIONS_REQUIRED');
  });

  it('requires at least two parts to split a request', () => {
    const result = SplitRequestBody.safeParse({
      parts: [{ title: 'Only part', scopeDescription: 'All', estimatedValue: { amount: '1.00', currency: 'BWP' } }],
      justification: 'Lots',
    });
    expect(codesOf(result)).toContain('SPLIT_TOO_FEW');
  });
});

describe('planning bodies and queries', () => {
  it('rejects a planned award before the planned release', () => {
    const result = CreatePlanItemBody.safeParse({
      title: 'Valves',
      budgetPeriod: 'FY2026/27',
      resourceDemandDays: 5,
      plannedReleaseDate: '2026-11-16',
      plannedAwardDate: '2026-11-01',
    });
    expect(codesOf(result)).toContain('INVALID_DATE_ORDER');
  });

  it('limits resource demand ranges to 12 ordered months', () => {
    expect(monthsBetween('2026-10', '2027-03')).toBe(6);
    expect(codesOf(ResourceDemandQuery.safeParse({ from: '2027-03', to: '2026-10' }))).toContain('INVALID_RANGE');
    expect(codesOf(ResourceDemandQuery.safeParse({ from: '2026-01', to: '2027-06' }))).toContain('RANGE_TOO_LONG');
  });

  it('validates the follower email of a public advance notice', () => {
    expect(codesOf(FollowNoticeBody.safeParse({ email: 'not-an-email' }))).toContain('INVALID_EMAIL');
  });
});

describe('strategy bodies (FR-05, DD-40)', () => {
  const base = { eventType: 'tender', procedure: 'open', awardModel: 'single', expectedRevision: 1 } as const;

  it('never offers framework call-off for writes', () => {
    const result = UpdateStrategyBody.safeParse({ ...base, procedure: 'framework_calloff' });
    expect(codesOf(result)).toContain('PROCEDURE_NOT_OFFERED');
  });

  it('requires exception grounds for a direct procurement', () => {
    const result = UpdateStrategyBody.safeParse({ ...base, eventType: 'rfq', procedure: 'direct' });
    expect(codesOf(result)).toContain('DIRECT_AWARD_GROUNDS_REQUIRED');
  });

  it('pairs the RFI event type with the RFI procedure only', () => {
    expect(codesOf(UpdateStrategyBody.safeParse({ ...base, eventType: 'rfi' }))).toContain('EVENT_TYPE_PROCEDURE_MISMATCH');
    expect(codesOf(UpdateStrategyBody.safeParse({ ...base, procedure: 'rfi' }))).toContain('EVENT_TYPE_PROCEDURE_MISMATCH');
  });

  it('requires a request or a project for a new strategy', () => {
    const result = CreateStrategyBody.safeParse({ eventType: 'tender', procedure: 'open', awardModel: 'single' });
    expect(codesOf(result)).toContain('STRATEGY_SUBJECT_REQUIRED');
  });

  it('requires the supplier behind a commitment or prior involvement', () => {
    const result = AddMarketResearchBody.safeParse({
      sourceType: 'supplier_consultation',
      source: 'Meeting',
      finding: 'Lead time of ten weeks',
      isSupplierCommitment: true,
    });
    expect(codesOf(result)).toContain('SUPPLIER_REQUIRED');
  });
});
