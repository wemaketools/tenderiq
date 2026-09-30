import { describe, expect, it } from 'vitest';

import { endpointPermissions } from '../endpoint.js';
import {
  AcceptAssignmentBody,
  EVALUATION_OVERVIEW_PERMISSIONS,
  ReferenceSetBody,
  ScoreCell,
  ScoreInput,
  SignoffBody,
  SubmitAssessmentBody,
  evaluationEndpoints,
} from '../evaluation.js';
import { PERMISSION_CATALOG, templatePermissions } from '../permissions.js';

const endpoints = Object.values(evaluationEndpoints);

describe('evaluation contract: endpoint map', () => {
  it('defines one buyer endpoint per evaluation list, detail and action with EVA screen ids', () => {
    // Arrange + Act
    const screens = new Set(endpoints.flatMap((endpoint) => [...endpoint.screens]));

    // Assert
    expect(endpoints).toHaveLength(33);
    expect(endpoints.every((endpoint) => endpoint.audience === 'buyer')).toBe(true);
    expect([...screens].sort()).toEqual(['EVA-01', 'EVA-02', 'EVA-04', 'EVA-05', 'EVA-06']);
  });

  it('uses unique ids and unique method + path pairs under /api/v1/buyer/evaluation', () => {
    const ids = endpoints.map((endpoint) => endpoint.id);
    const routes = endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
    expect(endpoints.every((endpoint) => endpoint.path.startsWith('/api/v1/buyer/evaluation/'))).toBe(true);
  });

  it('only requires buyer evaluation or award permissions, never an organization-administration code', () => {
    const codes = new Set(endpoints.flatMap((endpoint) => endpointPermissions(endpoint)));

    for (const code of codes) {
      expect(PERMISSION_CATALOG[code].tenantKind).toBe('buyer');
      expect(code.startsWith('org.')).toBe(false);
    }
  });

  it('denies the org admin and the auditor every evaluation endpoint when mapped through their role templates', () => {
    const orgAdmin = templatePermissions('org_admin');
    const auditor = templatePermissions('auditor');

    for (const endpoint of endpoints) {
      const required = endpointPermissions(endpoint);
      expect(required.some((code) => orgAdmin.includes(code))).toBe(false);
      expect(required.some((code) => auditor.includes(code))).toBe(false);
    }
  });

  it('lets the procurement officer see the overview but not individual scoring or moderation', () => {
    const officer = templatePermissions('procurement_officer');

    expect(EVALUATION_OVERVIEW_PERMISSIONS.some((code) => officer.includes(code))).toBe(true);
    expect(endpointPermissions(evaluationEndpoints.getAssessment).some((code) => officer.includes(code))).toBe(false);
    expect(endpointPermissions(evaluationEndpoints.getModeration).some((code) => officer.includes(code))).toBe(false);
  });

  it('declares the business error codes the screens must show', () => {
    expect(evaluationEndpoints.submitAssessment.errors).toContain('ASSESSMENT_INCOMPLETE');
    expect(evaluationEndpoints.getAssessment.errors).toContain('ASSESSMENT_CONTENT_BLOCKED');
    expect(evaluationEndpoints.finalizeModeration.errors).toContain('ASSESSMENTS_INCOMPLETE');
    expect(evaluationEndpoints.releasePriceGate.errors).toContain('NON_PRICE_MODERATION_OPEN');
    expect(evaluationEndpoints.submitReport.errors).toContain('REPORT_NOT_READY');
    expect(evaluationEndpoints.getResults.errors).toContain('OWN_ASSESSMENT_NOT_SUBMITTED');
  });
});

describe('evaluation contract: schemas', () => {
  it('keeps a missing score as null and never coerces it to zero (AC-18)', () => {
    const cell = ScoreCell.parse({
      scoreId: null,
      bidId: 1,
      criterionId: 2,
      score: null,
      weightedPoints: null,
      isNotApplicable: false,
      rationale: null,
      evidenceRefs: [],
      clarificationNeeded: false,
      clarificationQuestion: null,
      status: 'draft',
      submittedAt: null,
      version: 1,
      corrections: [],
    });

    expect(cell.score).toBeNull();
    expect(ScoreCell.safeParse({ ...cell, score: 4 }).success).toBe(false);
  });

  it('rejects a score together with not applicable and a clarification flag without a question', () => {
    const result = ScoreInput.safeParse({
      bidId: 1,
      criterionId: 2,
      score: '3',
      isNotApplicable: true,
      rationale: null,
      clarificationNeeded: true,
      clarificationQuestion: null,
    });

    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issueRow) => issueRow.message);
    expect(messages.some((message) => message.startsWith('SCORE_WITH_NOT_APPLICABLE|'))).toBe(true);
    expect(messages.some((message) => message.startsWith('CLARIFICATION_QUESTION_REQUIRED|'))).toBe(true);
  });

  it('requires the undertaking and a conflict nature and details when a conflict is declared (BR-08)', () => {
    const missingUndertaking = AcceptAssignmentBody.safeParse({
      confidentialityAccepted: false,
      undertakingTextVersion: 'KWU-EVAL-CU-2026.1',
      conflictDeclaration: { hasConflict: false },
    });
    const conflictWithoutDetails = AcceptAssignmentBody.safeParse({
      confidentialityAccepted: true,
      undertakingTextVersion: 'KWU-EVAL-CU-2026.1',
      conflictDeclaration: { hasConflict: true },
    });

    expect(missingUndertaking.success).toBe(false);
    expect(conflictWithoutDetails.success).toBe(false);
    const codes = conflictWithoutDetails.success ? [] : conflictWithoutDetails.error.issues.map((row) => row.message.split('|')[0]);
    expect(codes).toEqual(expect.arrayContaining(['CONFLICT_NATURE_REQUIRED', 'CONFLICT_DETAILS_REQUIRED']));
  });

  it('requires a note to decline a sign-off and a reason to leave the reference set', () => {
    expect(SignoffBody.safeParse({ decision: 'declined' }).success).toBe(false);
    expect(SignoffBody.safeParse({ decision: 'signed' }).success).toBe(true);
    expect(ReferenceSetBody.safeParse({ inReferenceSet: false }).success).toBe(false);
    expect(ReferenceSetBody.safeParse({ inReferenceSet: false, reason: 'Below the threshold.' }).success).toBe(true);
  });

  it('accepts save-and-submit cells and requires the independence confirmation', () => {
    expect(SubmitAssessmentBody.safeParse({ confirmIndependent: false }).success).toBe(false);
    const parsed = SubmitAssessmentBody.parse({ confirmIndependent: true });
    expect(parsed.scores).toEqual([]);
  });
});
