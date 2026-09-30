import { describe, expect, it } from 'vitest';

import { endpointPermissions } from '../endpoint.js';
import { permissionTenantKind } from '../permissions.js';
import {
  AnswerInput,
  BuyerApplicationListQuery,
  BuyerApplicationStatus,
  CriterionInput,
  DecideApplicationBody,
  RecommendBody,
  RecordFinancialReviewBody,
  SubmitApplicationBody,
  SupersedeDecisionBody,
  qualificationEndpoints,
} from '../qualification.js';

const endpoints = Object.values(qualificationEndpoints);

function codesOf(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.message.split('|')[0] ?? '');
}

const decisionBase = {
  scopeCategoryId: 202,
  scopeMaxValue: { amount: '3000000.00', currency: 'BWP' },
  scopeGeography: 'Botswana',
  effectiveFrom: '2026-10-01',
  effectiveTo: '2028-09-30',
  reassessmentDate: '2027-10-01',
  conditions: null,
  allowedActivities: null,
  blockedGate: 'none',
  reasons: 'All criteria met.',
  supplierExplanation: 'Qualified for WTR-PUMP up to BWP 3,000,000.',
  appealRoute: null,
  notifySupplier: true,
} as const;

describe('qualification endpoint map', () => {
  it('declares 47 endpoints covering every qualification screen', () => {
    // Arrange
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));

    // Assert
    expect(endpoints).toHaveLength(47);
    for (const screen of ['ADM-09', 'SUP-20', 'SUP-24', 'BUY-33', 'BUY-34', 'BUY-35']) {
      expect(screens.has(screen), screen).toBe(true);
    }
  });

  it('keeps buyer endpoints on buyer permissions and supplier endpoints on supplier permissions', () => {
    for (const endpoint of endpoints) {
      // Act
      const kinds = endpointPermissions(endpoint).map((code) => permissionTenantKind(code));

      // Assert
      const expected = endpoint.audience === 'buyer' ? 'buyer' : 'supplier';
      expect(kinds.every((kind) => kind === expected), endpoint.id).toBe(true);
      expect(endpoint.path.startsWith(`/api/v1/${endpoint.audience}/qualification`), endpoint.id).toBe(true);
    }
  });

  it('restricts the financial review panel to financial reviewers and deciders only (AC-08)', () => {
    // Act
    const permissions = endpointPermissions(qualificationEndpoints.getFinancialReview);

    // Assert
    expect([...permissions].sort()).toEqual(['qualification.decide', 'qualification.financial_review']);
    expect(permissions).not.toContain('qualification.review');
  });

  it('marks record-creating commands idempotent so they answer 201', () => {
    // Assert
    expect(qualificationEndpoints.decideApplication.idempotent).toBe(true);
    expect(qualificationEndpoints.createSupplierApplication.idempotent).toBe(true);
    expect(qualificationEndpoints.requestInformation.idempotent).toBe(true);
  });
});

describe('qualification schemas', () => {
  it('never offers draft as a buyer-visible application status', () => {
    // Assert
    expect(BuyerApplicationStatus.options).not.toContain('draft');
    expect(BuyerApplicationListQuery.safeParse({ status: 'draft' }).success).toBe(false);
  });

  it('requires a reason when a supplier marks a criterion not applicable', () => {
    // Arrange
    const answer = {
      criterionId: 11209,
      applicability: 'not_applicable',
      naReason: '  ',
      answerText: null,
      answerNumber: null,
      answerDate: null,
      answerBool: null,
      evidenceItemIds: [],
    };

    // Act
    const result = AnswerInput.safeParse(answer);

    // Assert
    expect(codesOf(result)).toContain('NA_REASON_REQUIRED');
    expect(AnswerInput.safeParse({ ...answer, naReason: 'No design services.' }).success).toBe(true);
  });

  it('rejects a conditional outcome without conditions, allowed activities and a blocked gate', () => {
    // Act
    const result = DecideApplicationBody.safeParse({ ...decisionBase, outcome: 'qualified_with_conditions' });

    // Assert
    expect(codesOf(result)).toEqual(
      expect.arrayContaining(['CONDITIONS_REQUIRED', 'ALLOWED_ACTIVITIES_REQUIRED', 'BLOCKED_GATE_REQUIRED']),
    );
  });

  it('accepts an unconditional qualified decision with ordered dates', () => {
    // Assert
    expect(DecideApplicationBody.safeParse({ ...decisionBase, outcome: 'qualified' }).success).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    // Act
    const result = DecideApplicationBody.safeParse({ ...decisionBase, outcome: 'qualified', effectiveTo: '2026-01-01' });

    // Assert
    expect(codesOf(result)).toContain('EFFECTIVE_DATES_INVALID');
  });

  it('never lets a superseding decision write the derived expired outcome', () => {
    // Act
    const result = SupersedeDecisionBody.safeParse({
      ...decisionBase,
      outcome: 'expired',
      supersedeReason: 'Expired.',
      triggerId: null,
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it('requires suspensions to state conditions and allowed activities', () => {
    // Act
    const result = SupersedeDecisionBody.safeParse({
      ...decisionBase,
      outcome: 'suspended',
      supersedeReason: 'Licence lapsed.',
      triggerId: 902,
    });

    // Assert
    expect(codesOf(result)).toContain('CONDITIONS_REQUIRED');
  });

  it('requires material qualifications for any financial conclusion other than adequate', () => {
    // Arrange
    const review = {
      financialPeriodEnd: '2025-12-31',
      reportingCurrency: 'BWP',
      isConsolidated: true,
      source: 'Group management accounts',
      turnover: '18750000.00',
      currentRatio: null,
      debtToEquity: null,
      parentSupportEvidence: null,
      materialQualifications: null,
      conclusion: 'unclear',
      rationale: 'Cannot conclude.',
    };

    // Act
    const result = RecordFinancialReviewBody.safeParse(review);

    // Assert
    expect(codesOf(result)).toContain('QUALIFICATIONS_REQUIRED');
  });

  it('rejects money written as a JS number in the financial review', () => {
    // Act
    const result = RecordFinancialReviewBody.safeParse({
      financialPeriodEnd: '2025-12-31',
      reportingCurrency: 'BWP',
      isConsolidated: false,
      source: 'Audited statements',
      turnover: 18750000,
      currentRatio: null,
      debtToEquity: null,
      parentSupportEvidence: null,
      materialQualifications: null,
      conclusion: 'adequate',
      rationale: 'Adequate.',
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it('requires document criteria to name the evidence types they accept', () => {
    // Act
    const result = CriterionInput.safeParse({
      area: 'insurance',
      question: 'Public liability insurance',
      guidance: null,
      responseType: 'document',
      mandatory: true,
      evidenceTypes: [],
      requiresNaReason: false,
      thresholdDescription: null,
      sortOrder: 10,
    });

    // Assert
    expect(codesOf(result)).toContain('EVIDENCE_TYPES_REQUIRED');
  });

  it('requires the recommendation of a conditional outcome to name the blocked gate', () => {
    // Act
    const result = RecommendBody.safeParse({
      proposedOutcome: 'qualified_with_conditions',
      scopeCategoryId: 202,
      scopeMaxValue: null,
      scopeGeography: null,
      conditions: 'Renew insurance.',
      allowedActivities: 'Bid only.',
      blockedGate: 'none',
      rationale: 'Insurance expires soon.',
    });

    // Assert
    expect(codesOf(result)).toEqual(['BLOCKED_GATE_REQUIRED']);
  });

  it('requires the explicit accuracy confirmation to submit an application', () => {
    // Assert
    expect(codesOf(SubmitApplicationBody.safeParse({ confirmAccuracy: false }))).toContain('CONFIRMATION_REQUIRED');
    expect(SubmitApplicationBody.safeParse({ confirmAccuracy: true }).success).toBe(true);
  });
});
