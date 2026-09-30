/**
 * Selection contract: endpoint definitions, permissions per audience, business-rule constants and the validation
 * codes of the request schemas (FR-15, FR-16, BR-30, BR-31, AC-21..AC-24).
 */
import { describe, expect, it } from 'vitest';

import { endpointPermissions } from '../endpoint.js';
import { ASSESSMENT_SESSIONS_ASSESSMENT_BASIS, ASSESSMENT_FINDINGS_EFFECT } from '../enums.js';
import { PERMISSION_CATALOG, permissionsForTemplates } from '../permissions.js';
import {
  ASSESSMENT_BASIS_EFFECTS,
  CreateAssessmentSessionBody,
  DueDiligenceFindingBody,
  RecommendPreferredBidderBody,
  RespondNegotiationRoundBody,
  SELECTION_VIEW_PERMISSIONS,
  UpdateShortlistBody,
  isEffectAllowed,
  selectionEndpoints,
} from '../selection.js';

const endpoints = Object.values(selectionEndpoints);

function issueCodes(result: { success: boolean; error?: { issues: ReadonlyArray<{ message: string; path: PropertyKey[] }> } }) {
  return (result.error?.issues ?? []).map((item) => ({ path: item.path.join('.'), code: item.message.split('|')[0] }));
}

describe('selectionEndpoints', () => {
  it('defines unique ids and method + path pairs under the buyer and supplier selection prefixes', () => {
    // Arrange
    const ids = endpoints.map((endpoint) => endpoint.id);
    const routes = endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);

    // Assert
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
    for (const endpoint of endpoints) {
      expect(endpoint.path.startsWith(`/api/v1/${endpoint.audience}/selection/`)).toBe(true);
      expect(['buyer', 'supplier']).toContain(endpoint.audience);
    }
  });

  it('requires a permission of the audience tenant kind on every endpoint', () => {
    for (const endpoint of endpoints) {
      const codes = endpointPermissions(endpoint);
      expect(codes.length).toBeGreaterThan(0);
      for (const code of codes) {
        expect(PERMISSION_CATALOG[code].tenantKind).toBe(endpoint.audience);
      }
    }
  });

  it('never offers support.view, so an operator under a support grant reads nothing of selection', () => {
    for (const endpoint of endpoints) {
      expect(endpointPermissions(endpoint)).not.toContain('support.view');
    }
  });

  it('keeps selection records away from the organization administrator and plain evaluators', () => {
    // Arrange
    const admin = new Set(permissionsForTemplates(['org_admin']));
    const evaluator = new Set(permissionsForTemplates(['evaluator']));

    // Assert
    expect(SELECTION_VIEW_PERMISSIONS.some((code) => admin.has(code))).toBe(false);
    expect(SELECTION_VIEW_PERMISSIONS.some((code) => evaluator.has(code))).toBe(false);
  });

  it('covers every screen of the domain', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));
    for (const screen of ['BUY-22', 'BUY-23', 'BUY-24', 'BUY-25', 'BUY-27', 'SUP-18', 'SUP-19']) {
      expect(screens.has(screen)).toBe(true);
    }
  });

  it('declares the blocking business errors of AC-23 and AC-24 on the commands that enforce them', () => {
    expect(selectionEndpoints.createFinalOfferRound.errors).toEqual(
      expect.arrayContaining(['BAFO_NOT_PERMITTED', 'PROCESS_DECISION_REQUIRED']),
    );
    expect(selectionEndpoints.openNegotiation.errors).toEqual(
      expect.arrayContaining(['NEGOTIATION_NOT_PERMITTED', 'PROCESS_DECISION_REQUIRED']),
    );
    expect(selectionEndpoints.recordFallback.errors).toContain('FALLBACK_ALREADY_RECORDED');
    expect(selectionEndpoints.decideDiligenceCase.errors).toEqual(
      expect.arrayContaining(['DILIGENCE_FINDINGS_UNRESOLVED', 'DILIGENCE_FAILED_FINDING']),
    );
    expect(selectionEndpoints.recordReferenceFeedback.errors).toContain('REFERENCE_CONSENT_REQUIRED');
    expect(selectionEndpoints.recordFinding.errors).toContain('FINDING_EFFECT_NOT_ALLOWED');
  });

  it('never names preferred-bidder endpoints as an award (BR-31)', () => {
    const preferred = endpoints.filter((endpoint) => endpoint.id.includes('preferredBidders'));
    expect(preferred.length).toBeGreaterThan(0);
    for (const endpoint of preferred) {
      expect(`${endpoint.id} ${endpoint.path}`.toLowerCase()).not.toContain('award');
    }
  });
});

describe('ASSESSMENT_BASIS_EFFECTS', () => {
  it('assigns every finding effect to exactly one declared basis', () => {
    const assigned = ASSESSMENT_SESSIONS_ASSESSMENT_BASIS.flatMap((basis) => [...ASSESSMENT_BASIS_EFFECTS[basis]]);
    expect([...assigned].sort()).toEqual([...ASSESSMENT_FINDINGS_EFFECT].sort());
  });

  it('refuses a score input on a claim-verification session and accepts a verified claim', () => {
    expect(isEffectAllowed('claim_verification', 'score_input')).toBe(false);
    expect(isEffectAllowed('claim_verification', 'claim_verified')).toBe(true);
    expect(isEffectAllowed('eligibility_gate', 'gate_failed')).toBe(true);
  });
});

describe('request schemas', () => {
  const session = {
    tenderId: 9,
    sessionType: 'demonstration',
    purpose: 'Field demonstration',
    agenda: 'Set-up, survey, report',
    instructions: 'Same test section for everyone',
    preparationDays: 7,
  } as const;

  it('requires the announced criterion on a scored session', () => {
    const result = CreateAssessmentSessionBody.safeParse({ ...session, assessmentBasis: 'scored_criterion' });
    expect(issueCodes(result)).toEqual([{ path: 'criterionId', code: 'CRITERION_REQUIRED' }]);
  });

  it('refuses a criterion on a claim-verification session', () => {
    const result = CreateAssessmentSessionBody.safeParse({ ...session, assessmentBasis: 'claim_verification', criterionId: 9505 });
    expect(issueCodes(result)).toEqual([{ path: 'criterionId', code: 'CRITERION_NOT_ALLOWED' }]);
  });

  it('requires an owner and a due date on an unresolved diligence finding', () => {
    const result = DueDiligenceFindingBody.safeParse({
      area: 'insurance',
      finding: 'Certificate not verified',
      disposition: 'unresolved',
      isAwardBlocking: true,
    });
    expect(issueCodes(result)).toEqual([
      { path: 'ownerUserId', code: 'FINDING_OWNER_REQUIRED' },
      { path: 'dueAt', code: 'FINDING_DUE_DATE_REQUIRED' },
    ]);
  });

  it('makes a failed diligence finding award-blocking', () => {
    const result = DueDiligenceFindingBody.safeParse({
      area: 'financial',
      finding: 'Negative working capital',
      disposition: 'failed',
      isAwardBlocking: false,
    });
    expect(issueCodes(result)).toEqual([{ path: 'isAwardBlocking', code: 'FAILED_FINDING_BLOCKS_AWARD' }]);
  });

  it('refuses a fallback equal to the preferred bid', () => {
    const result = RecommendPreferredBidderBody.safeParse({
      tenderId: 9,
      bidId: 908,
      scope: 'Surveys',
      proposedValue: { amount: '2940000.00', currency: 'BWP' },
      rationale: 'Second ranked',
      remainingChecks: 'Insurance',
      negotiationTopics: ['Service credits'],
      decisionOwnerUserId: 4,
      contingencyPlan: 'New competition',
      fallbackBidId: 908,
    });
    expect(issueCodes(result)).toEqual([{ path: 'fallbackBidId', code: 'FALLBACK_SAME_AS_PREFERRED' }]);
  });

  it('requires a reason for every shortlist decision and a rank for an included candidate', () => {
    const result = UpdateShortlistBody.safeParse({
      selectionRule: 'Top two',
      rationale: 'Scores signed off',
      entries: [{ bidId: 907, included: true, reason: ' ' }],
    });
    expect(issueCodes(result)).toEqual(
      expect.arrayContaining([
        { path: 'entries.0.reason', code: 'SHORTLIST_REASON_REQUIRED' },
        { path: 'entries.0.rank', code: 'RANK_REQUIRED' },
      ]),
    );
  });

  it('requires the explicit internal-approval confirmation on a supplier round response', () => {
    const result = RespondNegotiationRoundBody.safeParse({ supplierProposal: 'Cap at 6%', internalApprovalConfirmed: false });
    expect(issueCodes(result)).toEqual([{ path: 'internalApprovalConfirmed', code: 'INTERNAL_APPROVAL_REQUIRED' }]);
  });
});
