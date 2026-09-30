/**
 * The tenders contract: endpoint catalog shape, request validation (weights total 100, timetable ordering,
 * envelopes, release checks, pricing items) and the pure authoring rules (contradictions, plan issues, working-day
 * hints in the official zone, BR-11/BR-12).
 */
import { describe, expect, it } from 'vitest';

import { splitIssueMessage } from '../common.js';
import {
  CreatePricingItemBody,
  CreatePricingScheduleBody,
  PRICE_ENTRY_TYPES,
  UpdatePricingScheduleBody,
  formatDateText,
  CreateRequirementBody,
  CreateTenderBody,
  RecordReleaseCheckBody,
  TENDER_ENDPOINT_COUNT,
  UpdateEnvelopesBody,
  UpdateEvaluationPlanBody,
  UpdateTenderBody,
  UpdateTimetableBody,
  planIssues,
  requirementIssues,
  tenderEndpoints,
  tenderSectionPath,
  timetableIssues,
  workingDayHint,
  workingDaysBetween,
} from '../tenders.js';
import type { PlanFacts, RequirementFacts, UpdateEvaluationPlanBody as PlanBody } from '../tenders.js';

function codesOf(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => splitIssueMessage(issue.message).code);
}

const PRD_PLAN: PlanBody = {
  expectedVersion: 1,
  scaleMax: 5,
  aggregationMethod: 'consensus',
  priceMethod: 'lowest_ratio',
  priceWeight: '30',
  priceFormulaNote: 'Lowest evaluated cost ÷ this offer × 30',
  zeroPriceTreatment: 'Evaluated as zero; confirmed by clarification.',
  missingPriceTreatment: 'Non-comparable.',
  thresholdScope: 'non_price_total',
  nonPriceThreshold: '45',
  decimalPlacesCalc: 4,
  decimalPlacesDisplay: 2,
  criteria: [
    { code: 'QUAL', name: 'Solution quality', maxPoints: '35', envelope: 'technical' },
    { code: 'DELIV', name: 'Delivery approach', maxPoints: '20', envelope: 'technical' },
    { code: 'EXP', name: 'Relevant experience', maxPoints: '15', envelope: 'technical' },
    { code: 'PRICE', name: 'Price', maxPoints: '30', isPrice: true, envelope: 'commercial' },
  ],
  anchors: [0, 1, 2, 3, 4, 5].map((value) => ({ value, label: `Anchor ${value}` })),
  tieBreakRules: [
    { sequence: 1, rule: 'highest_non_price' },
    { sequence: 2, rule: 'committee_decision' },
  ],
};

describe('tenderEndpoints catalog', () => {
  it('declares 39 buyer endpoints with unique ids and routes, all on BUY-07..BUY-13', () => {
    // Arrange
    const endpoints = Object.values(tenderEndpoints);

    // Act
    const ids = new Set(endpoints.map((endpoint) => endpoint.id));
    const routes = new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`));

    // Assert
    expect(TENDER_ENDPOINT_COUNT).toBe(39);
    expect(ids.size).toBe(endpoints.length);
    expect(routes.size).toBe(endpoints.length);
    for (const endpoint of endpoints) {
      expect(endpoint.audience).toBe('buyer');
      expect(endpoint.id.startsWith('buyer.tenders.')).toBe(true);
      expect(endpoint.screens.every((screen) => /^BUY-(0[7-9]|1[0-3])$/.test(screen))).toBe(true);
    }
  });

  it('requires tender.edit or stronger on every command and tender.view or tender.create on every read', () => {
    for (const endpoint of Object.values(tenderEndpoints)) {
      const permissions = Array.isArray(endpoint.permission) ? endpoint.permission : [endpoint.permission];
      if (endpoint.method === 'GET') {
        expect(permissions.every((code) => ['tender.view', 'tender.create', 'tender.edit'].includes(String(code)))).toBe(true);
      } else {
        expect(permissions.some((code) => ['tender.create', 'tender.edit', 'tender.release_approve'].includes(String(code)))).toBe(true);
      }
    }
  });

  it('builds section links under the tender route of the SPA', () => {
    expect(tenderSectionPath(5, 'overview')).toBe('/buyer/tenders/5');
    expect(tenderSectionPath(5, 'requirements')).toBe('/buyer/tenders/5/scope');
    expect(tenderSectionPath(5, 'release_approval')).toBe('/buyer/tenders/5/release');
  });
});

describe('request validation', () => {
  it('accepts the PRD §9.2 plan whose weights total 100', () => {
    expect(UpdateEvaluationPlanBody.safeParse(PRD_PLAN).success).toBe(true);
  });

  it('rejects a plan whose weights total 95 with WEIGHTS_TOTAL_NOT_100 naming the total', () => {
    // Arrange
    const body = { ...PRD_PLAN, criteria: PRD_PLAN.criteria.map((row) => (row.code === 'DELIV' ? { ...row, maxPoints: '15' } : row)) };

    // Act
    const result = UpdateEvaluationPlanBody.safeParse(body);

    // Assert
    expect(codesOf(result)).toContain('WEIGHTS_TOTAL_NOT_100');
    expect(result.success ? '' : result.error.issues.find((issue) => issue.message.startsWith('WEIGHTS'))?.message).toContain('95');
  });

  it('rejects a price method without declared zero and missing price treatments, and a tie rule without its criterion', () => {
    const result = UpdateEvaluationPlanBody.safeParse({
      ...PRD_PLAN,
      zeroPriceTreatment: '',
      missingPriceTreatment: null,
      tieBreakRules: [{ sequence: 1, rule: 'highest_criterion' }],
    });
    expect(codesOf(result)).toEqual(expect.arrayContaining(['PRICE_TREATMENT_REQUIRED', 'TIE_RULE_CRITERION_REQUIRED']));
  });

  it('reports a field issue instead of throwing when a criterion weight is not a decimal', () => {
    // Arrange
    const body = { ...PRD_PLAN, criteria: PRD_PLAN.criteria.map((row, index) => (index === 0 ? { ...row, maxPoints: '' } : row)) };

    // Act
    const result = UpdateEvaluationPlanBody.safeParse(body);

    // Assert
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))).toContain('criteria.0.maxPoints');
  });

  it('rejects a price weight that differs from the price criteria points', () => {
    expect(codesOf(UpdateEvaluationPlanBody.safeParse({ ...PRD_PLAN, priceWeight: '25' }))).toContain('PRICE_WEIGHT_MISMATCH');
  });

  it('rejects a timetable whose opening precedes the submission deadline and one without a submission deadline', () => {
    const incoherent = UpdateTimetableBody.safeParse({
      expectedDraftRevision: 1,
      milestones: [
        { milestone: 'submission_deadline', at: '2026-11-18T10:00:00Z' },
        { milestone: 'opening', at: '2026-11-18T09:00:00Z' },
      ],
    });
    const missing = UpdateTimetableBody.safeParse({ expectedDraftRevision: 1, milestones: [{ milestone: 'opening', at: '2026-11-18T09:00:00Z' }] });
    expect(codesOf(incoherent)).toContain('OPENING_BEFORE_SUBMISSION');
    expect(codesOf(missing)).toContain('SUBMISSION_DEADLINE_REQUIRED');
  });

  it('requires distinct opening orders for staged opening', () => {
    const result = UpdateEnvelopesBody.safeParse({
      expectedDraftRevision: 1,
      openingMode: 'staged',
      envelopes: [
        { envelope: 'technical', openOrder: 1 },
        { envelope: 'commercial', openOrder: 1 },
      ],
    });
    expect(codesOf(result)).toContain('STAGED_OPENING_ORDER');
  });

  it('requires a note on a failed release check and forbids recording a check as pending', () => {
    expect(codesOf(RecordReleaseCheckBody.safeParse({ draftRevision: 3, status: 'failed' }))).toContain('NOTE_REQUIRED');
    expect(RecordReleaseCheckBody.safeParse({ draftRevision: 3, status: 'pending' }).success).toBe(false);
    expect(RecordReleaseCheckBody.safeParse({ draftRevision: 3, status: 'passed' }).success).toBe(true);
  });

  it('requires a recurrence on recurring charges only', () => {
    const base = { itemCode: 'F-01', description: 'Monthly service', unit: 'month', quantity: '36' };
    expect(codesOf(CreatePricingItemBody.safeParse({ ...base, chargeType: 'recurring' }))).toContain('RECURRENCE_REQUIRED');
    expect(codesOf(CreatePricingItemBody.safeParse({ ...base, chargeType: 'one_time', recurrence: 'monthly' }))).toContain('RECURRENCE_NOT_ALLOWED');
    expect(CreatePricingItemBody.safeParse({ ...base, chargeType: 'recurring', recurrence: 'monthly' }).success).toBe(true);
  });

  it('requires at least two choices for a choice requirement', () => {
    const result = CreateRequirementBody.safeParse({
      section: 'Technical',
      refCode: 'REQ-T-09',
      text: 'Preferred channel',
      responseType: 'choice',
      choices: ['Phone'],
      treatment: 'information_only',
      envelope: 'technical',
      missingConsequence: 'warning',
    });
    expect(codesOf(result)).toContain('CHOICES_REQUIRED');
  });

  it('never offers the deferred framework call-off procedure when creating or editing (DD-40)', () => {
    const create = CreateTenderBody.safeParse({ source: 'blank', title: 'Framework call-off', eventType: 'rfq', procedure: 'framework_calloff', participation: 'open' });
    expect(create.success).toBe(false);
    expect(UpdateTenderBody.safeParse({ expectedDraftRevision: 1, procedure: 'framework_calloff' }).success).toBe(false);
  });

  it('rejects an update with no field besides the revision', () => {
    expect(codesOf(UpdateTenderBody.safeParse({ expectedDraftRevision: 2 }))).toContain('NO_CHANGES');
  });
});

describe('authoring rules', () => {
  const requirement: RequirementFacts = {
    id: 1,
    refCode: 'REQ-Q-02',
    ownerUserId: null,
    responseType: 'document',
    choices: [],
    evidenceRequired: null,
    treatment: 'mandatory_gate',
    envelope: 'qualification',
    missingConsequence: 'warning',
    criterion: null,
  };

  it('flags a mandatory gate that only warns, a missing owner and an unconfigured envelope as blocking', () => {
    const issues = requirementIssues(requirement, { envelopes: ['technical', 'commercial'], duplicateRefCodes: new Set() });
    expect(issues.filter((issue) => issue.severity === 'blocking').map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['REQUIREMENT_OWNER_MISSING', 'MANDATORY_GATE_ONLY_WARNS', 'ENVELOPE_NOT_CONFIGURED']),
    );
    expect(issues.map((issue) => issue.code)).toContain('MANDATORY_EVIDENCE_UNSPECIFIED');
  });

  it('reports no issue for an owned, consistent rated requirement', () => {
    const issues = requirementIssues(
      { ...requirement, ownerUserId: 5, treatment: 'rated', envelope: 'technical', missingConsequence: 'clarify', criterion: { envelope: 'technical', isPrice: false } },
      { envelopes: ['qualification', 'technical', 'commercial'], duplicateRefCodes: new Set() },
    );
    expect(issues).toEqual([]);
  });

  it('lists every evaluation plan gap of a draft plan whose weights total 95', () => {
    const plan: PlanFacts = {
      status: 'draft',
      scaleMax: 5,
      priceMethod: 'lowest_ratio',
      priceWeight: '30',
      zeroPriceTreatment: 'Included elsewhere',
      missingPriceTreatment: null,
      thresholdScope: 'non_price_total',
      nonPriceThreshold: null,
      decimalPlacesCalc: 4,
      decimalPlacesDisplay: 2,
      criteria: [
        { parentId: null, maxPoints: '40', isPrice: false },
        { parentId: null, maxPoints: '25', isPrice: false },
        { parentId: null, maxPoints: '30', isPrice: true },
      ],
      anchorValues: [0, 3, 4, 5],
      tieBreakRuleCount: 0,
    };
    const codes = planIssues(plan).map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining(['WEIGHTS_NOT_100', 'PRICE_TREATMENT_UNDECLARED', 'THRESHOLD_MISSING', 'ANCHORS_INCOMPLETE', 'TIE_RULES_MISSING', 'PLAN_NOT_APPROVED']),
    );
    expect(planIssues(plan).find((issue) => issue.code === 'WEIGHTS_NOT_100')?.message).toContain('95.00');
  });

  it('marks a deadline on 28 Dec 2026 (Boxing Day holiday) in Africa/Gaborone as non-working with the next working day', () => {
    const hint = workingDayHint('2026-12-28T10:00:00Z', 'Africa/Gaborone', [{ date: '2026-12-28', name: 'Boxing Day holiday' }]);
    expect(hint).toEqual({ localDate: '2026-12-28', isWorkingDay: false, reason: 'holiday', holidayName: 'Boxing Day holiday', nextWorkingDate: '2026-12-29' });
  });

  it('uses the official zone to find the local date of an instant near midnight', () => {
    expect(workingDayHint('2026-10-16T22:30:00Z', 'Africa/Gaborone', []).localDate).toBe('2026-10-17');
    expect(workingDayHint('2026-10-16T22:30:00Z', 'Africa/Gaborone', []).reason).toBe('weekend');
  });

  it('counts working days after the release up to the deadline, skipping weekends and holidays', () => {
    const holidays = [{ date: '2026-10-01', name: 'Botswana Day holiday' }];
    expect(workingDaysBetween('2026-09-28T07:00:00Z', '2026-10-05T10:00:00Z', 'Africa/Gaborone', holidays)).toBe(4);
  });

  it('reports a response period shorter than the policy minimum and a short questions window', () => {
    const issues = timetableIssues({
      timeZone: 'Africa/Gaborone',
      holidays: [],
      calendarId: 1,
      releaseAt: '2026-12-09T07:00:00Z',
      milestones: [
        { id: 1, milestone: 'questions_deadline', lotId: null, at: '2026-12-23T13:00:00Z' },
        { id: 2, milestone: 'submission_deadline', lotId: null, at: '2026-12-28T10:00:00Z' },
      ],
      policy: { minResponseDays: 21, questionDeadlineDaysBeforeClose: 7 },
      openingMode: 'single_stage',
      envelopeCount: 3,
    });
    expect(issues.find((issue) => issue.code === 'RESPONSE_PERIOD_TOO_SHORT')?.severity).toBe('blocking');
    expect(issues.find((issue) => issue.code === 'QUESTION_WINDOW_TOO_SHORT')?.severity).toBe('warning');
  });
});

describe('pricing schedule discount rules and price entries (PRD §7.4)', () => {
  it('declares priced, zero, included and not offered as four distinct price entries', () => {
    expect(PRICE_ENTRY_TYPES).toEqual(['priced', 'zero', 'included', 'not_offered']);
  });

  it('accepts a schedule that states accepted discounts and how they enter comparison', () => {
    // Arrange
    const body = {
      name: 'Chemicals',
      discountsAccepted: ['conditional', 'package'],
      discountEvaluationNote: 'Package discounts apply only to award combinations that meet them.',
      priceEntries: ['priced', 'zero', 'included'],
    };

    // Act
    const result = CreatePricingScheduleBody.safeParse(body);

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects accepted discounts without a comparison basis when a schedule is created', () => {
    const result = CreatePricingScheduleBody.safeParse({ name: 'Chemicals', discountsAccepted: ['unconditional'] });

    expect(codesOf(result)).toEqual(['DISCOUNT_BASIS_REQUIRED']);
  });

  it('lets a partial update keep the stored basis but rejects an explicit blank one', () => {
    expect(UpdatePricingScheduleBody.safeParse({ discountsAccepted: ['package'] }).success).toBe(true);
    expect(codesOf(UpdatePricingScheduleBody.safeParse({ discountsAccepted: ['package'], discountEvaluationNote: null }))).toEqual([
      'DISCOUNT_BASIS_REQUIRED',
    ]);
  });

  it('rejects price entries without priced, and duplicate entries or discount types', () => {
    expect(codesOf(CreatePricingScheduleBody.safeParse({ name: 'Works', priceEntries: ['included', 'zero'] }))).toEqual([
      'PRICED_ENTRY_REQUIRED',
    ]);
    expect(codesOf(CreatePricingScheduleBody.safeParse({ name: 'Works', priceEntries: ['priced', 'priced'] }))).toEqual([
      'DUPLICATE_PRICE_ENTRY',
    ]);
    expect(
      codesOf(
        CreatePricingScheduleBody.safeParse({
          name: 'Works',
          discountsAccepted: ['package', 'package'],
          discountEvaluationNote: 'Deducted.',
        }),
      ),
    ).toEqual(['DUPLICATE_DISCOUNT_TYPE']);
  });
});

describe('non-working day messages (BUY-12)', () => {
  const boxingDay = {
    timeZone: 'Africa/Gaborone',
    holidays: [{ date: '2026-12-28', name: 'Boxing Day holiday' }],
    calendarId: 1,
    releaseAt: null,
    policy: null,
    openingMode: 'single_stage',
    envelopeCount: 3,
  } as const;

  it('writes calendar dates as 29 Dec 2026, never as ISO dates', () => {
    expect(formatDateText('2026-12-29')).toBe('29 Dec 2026');
    expect(formatDateText('2026-01-05')).toBe('5 Jan 2026');
  });

  it('merges per-lot deadlines on the same holiday into one warning that names the lots', () => {
    // Arrange
    const milestones = [
      { id: 1, milestone: 'submission_deadline', lotId: 11, lotNo: 1, at: '2026-12-28T10:00:00Z' },
      { id: 2, milestone: 'submission_deadline', lotId: 12, lotNo: 2, at: '2026-12-28T10:00:00Z' },
    ] as const;

    // Act
    const issues = timetableIssues({ ...boxingDay, milestones }).filter((issue) => issue.code === 'NON_WORKING_DAY');

    // Assert
    expect(issues.map((issue) => issue.message)).toEqual([
      'The submission deadline for Lots 1 and 2 falls on a public holiday (Boxing Day holiday), 28 Dec 2026; the next working day is 29 Dec 2026.',
    ]);
  });

  it('names the whole tender and the lot when a tender deadline and a lot deadline share the holiday', () => {
    const milestones = [
      { id: 1, milestone: 'submission_deadline', lotId: null, at: '2026-12-28T10:00:00Z' },
      { id: 2, milestone: 'submission_deadline', lotId: 12, lotNo: 2, at: '2026-12-28T10:00:00Z' },
      { id: 3, milestone: 'opening', lotId: null, at: '2026-12-28T12:00:00Z' },
    ] as const;

    const messages = timetableIssues({ ...boxingDay, milestones })
      .filter((issue) => issue.code === 'NON_WORKING_DAY')
      .map((issue) => issue.message);

    expect(messages).toEqual([
      'The submission deadline for the whole tender and Lot 2 falls on a public holiday (Boxing Day holiday), 28 Dec 2026; the next working day is 29 Dec 2026.',
      'The opening falls on a public holiday (Boxing Day holiday), 28 Dec 2026; the next working day is 29 Dec 2026.',
    ]);
    expect(messages.join(' ')).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
