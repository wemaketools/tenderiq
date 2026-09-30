import { beforeAll, describe, expect, it } from 'vitest';

import {
  acceptAssignment,
  approveComparison,
  approveCorrection,
  correctScore,
  declareConflict,
  evaluationEndpoints,
  finalizeModeration,
  getAssessment,
  getAssignment,
  getCommercialComparison,
  getEvaluation,
  getModeration,
  getReassignmentCandidates,
  getResults,
  handoffReport,
  listAssignments,
  listEvaluations,
  reassignAssignment,
  recordModeratedScore,
  releasePriceGate,
  returnAssessment,
  reviewAbnormallyLow,
  reviewConflict,
  runScenario,
  saveScores,
  signoffReport,
  submitAssessment,
  proposeCorrection,
  submitReport,
} from '../../../contracts/evaluation.js';
import { Problem } from '../../../contracts/common.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { register } from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const email = (login: string): string => `${login}@tenderiq.local`;

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', now: () => NOW, modules: [{ name: 'evaluation', register }] });
});

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

describe('evaluation module registration', () => {
  it('registers every contract endpoint without failures', () => {
    expect(api.failed).toEqual([]);
    for (const endpoint of Object.values(evaluationEndpoints)) {
      expect(api.endpointIds).toContain(endpoint.id);
    }
  });
});

describe('buyer.evaluation.list', () => {
  it('returns every KWU evaluation to the chair with the storyline stages', async () => {
    // Act
    const response = await api.callAs(email('boitumelo.chair'), listEvaluations, { tenant: 'kwu', query: { sort: 'reference' } });

    // Assert
    expect(response.status).toBe(200);
    const page = listEvaluations.response.parse(response.body);
    expect(page.items.map((row) => `${row.tender.reference}/${row.lot?.lotNumber ?? '-'}:${row.stage}`)).toEqual([
      'T-2026-0001/3:individual_assessment',
      'T-2026-0003/-:ranking',
      'T-2026-0009/-:signoff',
      'T-2026-0014/1:complete',
      'T-2026-0014/2:ranking',
      'T-2026-0014/3:commercial_comparison',
      'T-2026-0014/4:commercial_comparison',
      'T-2026-0014/5:moderation',
    ]);
    expect(page.items.every((row) => row.myRole === 'chair')).toBe(true);
  });

  it('gives the chair the committee step of each stage as the next action', async () => {
    const response = await api.callAs(email('boitumelo.chair'), listEvaluations, { tenant: 'kwu', query: { sort: 'reference' } });

    const page = listEvaluations.response.parse(response.body);
    expect(page.items.map((row) => row.myNextAction)).toEqual([
      'follow_up_assessments',
      // T-2026-0003: ranking computed, but a missing score, a conflict review and the comparison still block it.
      'resolve_blockers',
      'collect_signoffs',
      'hand_off_report',
      'validate_ranking',
      'await_comparison',
      'release_price_gate',
      'moderate',
    ]);
  });

  it('gives evaluators and the commercial reviewer their own step, and observers none', async () => {
    const amantle = await api.callAs(email('amantle.eval'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });
    const thato = await api.callAs(email('thato.eval'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });
    const refilwe = await api.callAs(email('refilwe.commercial'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });
    const kabo = await api.callAs(email('kabo.eval'), getEvaluation, { tenant: 'kwu', params: { tenderId: 9 } });
    const owner = await api.callAs(email('tebogo.officer'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });

    expect(getEvaluation.response.parse(amantle.body).myNextAction).toBe('score_assessment');
    expect(getEvaluation.response.parse(thato.body).myNextAction).toBe('none');
    expect(getEvaluation.response.parse(refilwe.body).myNextAction).toBe('prepare_comparison');
    expect(getEvaluation.response.parse(kabo.body).myNextAction).toBe('sign_report');
    expect(getEvaluation.response.parse(owner.body).myNextAction).toBe('none');
  });

  it('returns only the evaluations an evaluator is assigned to', async () => {
    const response = await api.callAs(email('amantle.eval'), listEvaluations, { tenant: 'kwu' });

    const page = listEvaluations.response.parse(response.body);
    expect(page.items.map((row) => row.tender.reference)).toEqual(['T-2026-0003']);
    expect(page.total).toBe(1);
  });

  it('withholds committee scores, moderation outcomes and the gate note from an evaluator who has not submitted (PRD §4.3)', async () => {
    // Act
    const response = await api.callAs(email('amantle.eval'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });

    // Assert
    expect(response.status).toBe(200);
    const view = getEvaluation.response.parse(response.body);
    expect(view.detailLevel).toBe('own_assessment_pending');
    const text = JSON.stringify(view);
    expect(text).not.toContain('88.00');
    expect(text).not.toContain('One score changed');
    expect(text).not.toContain('Bid preparation for Tsodilo Engineering');
    expect(view.priceGate.note).toBeNull();
    expect(view.timeline.find((event) => event.title === 'Results computed (draft)')?.detail).toBeNull();
    expect(view.bids.length).toBeGreaterThan(0);
  });

  it('withholds bids, scores and other declarations from an evaluator whose conflict awaits review (DD-25)', async () => {
    // Act
    const response = await api.callAs(email('sam.dual'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });

    // Assert
    expect(response.status).toBe(200);
    const view = getEvaluation.response.parse(response.body);
    expect(view.detailLevel).toBe('conflict_pending_review');
    expect(view.bids).toEqual([]);
    const text = JSON.stringify(view);
    expect(text).not.toContain('88.00');
    expect(text).not.toContain('Makgadikgadi');
    expect(text).not.toContain('non_compliant');
    expect(view.priceGate.note).toBeNull();
    // The declarant still sees their own declaration.
    expect(view.timeline.find((event) => event.title === 'Conflict declared')?.detail).toContain('Tsodilo');
  });

  it('keeps full committee detail for the chair and for an evaluator who has submitted', async () => {
    // Act
    const chair = await api.callAs(email('boitumelo.chair'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });
    const thato = await api.callAs(email('thato.eval'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });

    // Assert
    const chairView = getEvaluation.response.parse(chair.body);
    const thatoView = getEvaluation.response.parse(thato.body);
    expect(chairView.detailLevel).toBe('full');
    expect(chairView.myNextAction).toBe('resolve_blockers');
    // The gate note records the outstanding score rather than implying every assessment is complete (AC-16, AC-18).
    expect(chairView.priceGate.note).toContain('Confirmed complete except A. Segwai’s C3 Relevant experience score');
    expect(chairView.timeline.find((event) => event.title === 'Results computed (draft)')?.detail).toContain('88.00');
    expect(chairView.timeline.find((event) => event.title === 'Conflict declared')?.detail).toContain('Tsodilo');
    expect(thatoView.detailLevel).toBe('full');
    expect(thatoView.priceGate.note).not.toBeNull();
    // A conflict's nature is for the chair and the declarant only.
    expect(thatoView.timeline.find((event) => event.title === 'Conflict declared')?.detail).toBeNull();
  });

  it('withholds the gate note from the list row of an evaluator who has not submitted', async () => {
    const response = await api.callAs(email('amantle.eval'), listEvaluations, { tenant: 'kwu' });

    const page = listEvaluations.response.parse(response.body);
    expect(page.items.every((row) => row.priceGate.note === null)).toBe(true);
  });

  it('asks for a lot on T-2026-0014, which is evaluated per lot', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getEvaluation, { tenant: 'kwu', params: { tenderId: 14 } });

    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('LOT_REQUIRED');
  });

  it('filters by stage and by overdue assignments', async () => {
    const byStage = await api.callAs(email('boitumelo.chair'), listEvaluations, { tenant: 'kwu', query: { stage: ['signoff'] } });
    const overdue = await api.callAs(email('boitumelo.chair'), listEvaluations, { tenant: 'kwu', query: { overdue: 'true' } });

    expect(listEvaluations.response.parse(byStage.body).items.map((row) => row.tender.reference)).toEqual(['T-2026-0009']);
    expect(listEvaluations.response.parse(overdue.body).items.map((row) => row.tender.reference)).toEqual(['T-2026-0003']);
  });

  it('shows the tender owner the evaluations of the tenders they own, as an observer', async () => {
    const response = await api.callAs(email('tebogo.officer'), listEvaluations, { tenant: 'kwu' });

    const page = listEvaluations.response.parse(response.body);
    expect(page.total).toBe(8);
    expect(page.items.every((row) => row.myRole === 'observer' && row.myNextAction === 'none')).toBe(true);
  });

  it('shows the award approver outside the tender team only evaluations with a signed-off report (BR-26)', async () => {
    const response = await api.callAs(email('keabetswe.approver'), listEvaluations, { tenant: 'kwu', query: { sort: 'reference' } });

    const page = listEvaluations.response.parse(response.body);
    expect(page.items.map((row) => `${row.tender.reference}/${row.lot?.lotNumber ?? '-'}`)).toEqual(['T-2026-0009/-', 'T-2026-0014/1']);
    expect(page.items.every((row) => row.myRole === 'observer')).toBe(true);
  });

  it('denies organization administration, auditors and support grants with 403 (BR-26, AC-15)', async () => {
    for (const login of ['admin.kwu', 'pule.auditor', 'support.agent']) {
      const response = await api.callAs(email(login), listEvaluations, { tenant: 'kwu' });
      expect(response.status, login).toBe(403);
      expect(problemCode(response), login).toBe('FORBIDDEN');
    }
  });

  it('refuses a supplier tenant and another buyer with the uniform tenant 403', async () => {
    const supplier = await api.callAs(email('tsodilo.bidmanager'), listEvaluations, { tenant: 'tsodilo' });
    const otherBuyer = await api.callAs(email('boitumelo.chair'), listEvaluations, { tenant: 'odc' });

    expect(supplier.status).toBe(403);
    expect(otherBuyer.status).toBe(403);
    expect(problemCode(otherBuyer)).toBe('TENANT_ACCESS_DENIED');
  });

  it('shows an ODC officer no KWU evaluation (cross-buyer segregation)', async () => {
    const response = await api.callAs(email('officer.odc'), listEvaluations, { tenant: 'odc' });

    expect(response.status).toBe(200);
    expect(listEvaluations.response.parse(response.body).total).toBe(0);
  });
});

describe('buyer.evaluation.assignments', () => {
  it('lists only the evaluator’s own assignments even when scope=all is requested', async () => {
    const response = await api.callAs(email('thato.eval'), listAssignments, { tenant: 'kwu', query: { scope: 'all' } });

    const page = listAssignments.response.parse(response.body);
    expect(page.items.every((row) => row.evaluator.fullName === 'Thato Mokgosi')).toBe(true);
    expect(page.summary.total).toBe(8);
  });

  it('lists the whole committee for the chair with KPI counters', async () => {
    const response = await api.callAs(email('boitumelo.chair'), listAssignments, { tenant: 'kwu', query: { scope: 'all', pageSize: 100 } });

    const page = listAssignments.response.parse(response.body);
    expect(page.total).toBe(24);
    expect(page.summary.overdue).toBe(2);
    expect(page.summary.declarationsPending).toBe(2);
  });

  it('hides another evaluator’s assignment behind 404', async () => {
    const response = await api.callAs(email('kabo.eval'), getAssignment, { tenant: 'kwu', params: { assignmentId: 3003 } });

    expect(response.status).toBe(404);
    expect(problemCode(response)).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('withholds bids until the conflict declared by Sam Keitumetse is reviewed (DD-25)', async () => {
    const response = await api.callAs(email('sam.dual'), getAssignment, { tenant: 'kwu', params: { assignmentId: 3004 } });

    const detail = getAssignment.response.parse(response.body);
    expect(detail.contentAccess).toEqual({ allowed: false, blockedReason: 'conflict_pending_review' });
    expect(detail.bids).toEqual([]);
    expect(detail.nextAction).toBe('await_conflict_review');
  });

  it('accepts an assignment with the undertaking and a no-conflict declaration', async () => {
    const response = await api.callAs(email('kabo.eval'), acceptAssignment, {
      tenant: 'kwu',
      params: { assignmentId: 1002 },
      body: { confidentialityAccepted: true, undertakingTextVersion: 'KWU-EVAL-CU-2026.1', conflictDeclaration: { hasConflict: false } },
    });

    expect(response.status).toBe(200);
    const detail = acceptAssignment.response.parse(response.body);
    expect(detail.contentAccess.allowed).toBe(true);
    expect(detail.nextAction).toBe('score');
  });

  it('refuses a second acceptance and an outdated undertaking version', async () => {
    const again = await api.callAs(email('thato.eval'), acceptAssignment, {
      tenant: 'kwu',
      params: { assignmentId: 3001 },
      body: { confidentialityAccepted: true, undertakingTextVersion: 'KWU-EVAL-CU-2026.1', conflictDeclaration: { hasConflict: false } },
    });
    const outdated = await api.callAs(email('kabo.eval'), acceptAssignment, {
      tenant: 'kwu',
      params: { assignmentId: 1002 },
      body: { confidentialityAccepted: true, undertakingTextVersion: 'KWU-EVAL-CU-2025.3', conflictDeclaration: { hasConflict: false } },
    });

    expect(problemCode(again)).toBe('ASSIGNMENT_ALREADY_ACCEPTED');
    expect(problemCode(outdated)).toBe('UNDERTAKING_VERSION_OUTDATED');
  });

  it('answers 422 with field codes when a declared conflict has no details', async () => {
    const response = await api.callAs(email('kabo.eval'), acceptAssignment, {
      tenant: 'kwu',
      params: { assignmentId: 1002 },
      body: { confidentialityAccepted: true, undertakingTextVersion: 'KWU-EVAL-CU-2026.1', conflictDeclaration: { hasConflict: true } },
    });

    expect(response.status).toBe(422);
    const codes = (Problem.parse(response.body).errors ?? []).map((row) => row.code);
    expect(codes).toEqual(expect.arrayContaining(['CONFLICT_NATURE_REQUIRED', 'CONFLICT_DETAILS_REQUIRED']));
  });

  it('suspends access when a conflict is disclosed after acceptance', async () => {
    const response = await api.callAs(email('thato.eval'), declareConflict, {
      tenant: 'kwu',
      params: { assignmentId: 1001 },
      body: { nature: 'personal_relationship', details: 'My cousin joined Chobe Pipe & Valve Supplies this month.' },
    });

    expect(response.status).toBe(201);
    expect(declareConflict.response.parse(response.body).contentAccess.blockedReason).toBe('conflict_pending_review');
  });

  it('lets the chair review the pending declaration once', async () => {
    const reviewed = await api.callAs(email('boitumelo.chair'), reviewConflict, {
      tenant: 'kwu',
      params: { declarationId: 30042 },
      body: { disposition: 'recused', reviewNote: 'Contributed to a bid on this tender.' },
    });
    const noConflict = await api.callAs(email('boitumelo.chair'), reviewConflict, {
      tenant: 'kwu',
      params: { declarationId: 30012 },
      body: { disposition: 'cleared', reviewNote: 'Nothing to review.' },
    });

    expect(reviewConflict.response.parse(reviewed.body).disposition).toBe('recused');
    expect(problemCode(noConflict)).toBe('DECLARATION_HAS_NO_CONFLICT');
  });

  it('offers reassignment candidates and refuses a conflicted replacement', async () => {
    const candidates = await api.callAs(email('boitumelo.chair'), getReassignmentCandidates, { tenant: 'kwu', params: { assignmentId: 1002 } });
    const conflicted = await api.callAs(email('boitumelo.chair'), reassignAssignment, {
      tenant: 'kwu',
      params: { assignmentId: 3004 },
      body: { newEvaluatorUserId: 13, reason: 'Replace the conflicted evaluator.', outcome: 'recused' },
    });

    const items = getReassignmentCandidates.response.parse(candidates.body).items;
    expect(items.find((row) => row.fullName === 'Amantle Segwai')?.eligible).toBe(true);
    expect(items.find((row) => row.fullName === 'Thato Mokgosi')?.eligible).toBe(false);
    expect(problemCode(conflicted)).toBe('EVALUATOR_NOT_ELIGIBLE');
  });

  it('forbids an evaluator from reassigning (403 FORBIDDEN)', async () => {
    const response = await api.callAs(email('thato.eval'), reassignAssignment, {
      tenant: 'kwu',
      params: { assignmentId: 1001 },
      body: { newEvaluatorUserId: 13, reason: 'Busy.', outcome: 'reassigned' },
    });

    expect(response.status).toBe(403);
  });
});

describe('buyer.evaluation.assessment (EVA-02)', () => {
  it('hides peer scores until the caller submits (independent evaluation)', async () => {
    const pending = await api.callAs(email('amantle.eval'), getAssessment, { tenant: 'kwu', params: { assignmentId: 3003 } });
    const submitted = await api.callAs(email('thato.eval'), getAssessment, { tenant: 'kwu', params: { assignmentId: 3001 } });

    expect(getAssessment.response.parse(pending.body).peerScores).toEqual({ visibility: 'hidden_until_own_submission', items: [] });
    const visible = getAssessment.response.parse(submitted.body).peerScores;
    expect(visible.visibility).toBe('visible');
    expect(visible.items.every((row) => row.status === 'submitted')).toBe(true);
    expect(visible.items.some((row) => row.evaluator.fullName === 'Amantle Segwai')).toBe(false);
  });

  it('marks the chair’s read-only view as oversight, not as an event without independent evaluation', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getAssessment, { tenant: 'kwu', params: { assignmentId: 3003 } });

    const assessment = getAssessment.response.parse(response.body);
    expect(assessment.readOnly).toBe(true);
    expect(assessment.tender.independentEvaluation).toBe(true);
    expect(assessment.peerScores).toEqual({ visibility: 'oversight', items: [] });
  });

  it('closes corrections once moderation is finalized and keeps them open while it is open', async () => {
    const finalized = await api.callAs(email('thato.eval'), getAssessment, { tenant: 'kwu', params: { assignmentId: 3001 } });
    const open = await api.callAs(email('thato.eval'), getAssessment, { tenant: 'kwu', params: { assignmentId: 1001 } });

    expect(getAssessment.response.parse(finalized.body).correctionsOpen).toBe(false);
    expect(getAssessment.response.parse(open.body).correctionsOpen).toBe(true);
  });

  it('refuses content before acceptance and while a conflict awaits review', async () => {
    const notAccepted = await api.callAs(email('kabo.eval'), getAssessment, { tenant: 'kwu', params: { assignmentId: 1002 } });
    const conflicted = await api.callAs(email('sam.dual'), getAssessment, { tenant: 'kwu', params: { assignmentId: 3004 } });

    expect(problemCode(notAccepted)).toBe('ASSESSMENT_CONTENT_BLOCKED');
    expect(problemCode(conflicted)).toBe('ASSESSMENT_CONTENT_BLOCKED');
  });

  it('refuses to submit an assessment with a criterion not scored, naming it (AC-18)', async () => {
    const response = await api.callAs(email('amantle.eval'), submitAssessment, {
      tenant: 'kwu',
      params: { assignmentId: 3003 },
      body: { confirmIndependent: true },
    });

    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('ASSESSMENT_INCOMPLETE');
    expect(Problem.parse(response.body).detail).toContain('Relevant experience');
  });

  it('submits when the missing cell is scored in the same request', async () => {
    const response = await api.callAs(email('amantle.eval'), submitAssessment, {
      tenant: 'kwu',
      params: { assignmentId: 3003 },
      body: {
        confirmIndependent: true,
        scores: [
          { bidId: 3001, criterionId: 303, score: '4', rationale: 'Francistown included analyser integration (clarified).', clarificationQuestion: null },
        ],
      },
    });

    expect(response.status).toBe(200);
    const assessment = submitAssessment.response.parse(response.body);
    expect(assessment.status).toBe('submitted');
    expect(assessment.completion.complete).toBe(true);
    expect(assessment.peerScores.visibility).toBe('visible');
  });

  it('saves drafts and rejects a rating outside the plan scale', async () => {
    const saved = await api.callAs(email('amantle.eval'), saveScores, {
      tenant: 'kwu',
      params: { assignmentId: 3003 },
      body: { scores: [{ bidId: 3001, criterionId: 303, score: '3.5', rationale: 'Draft.', clarificationQuestion: null }] },
    });
    const outOfScale = await api.callAs(email('amantle.eval'), saveScores, {
      tenant: 'kwu',
      params: { assignmentId: 3003 },
      body: { scores: [{ bidId: 3001, criterionId: 303, score: '6', rationale: 'Too high.', clarificationQuestion: null }] },
    });

    const cell = saveScores.response.parse(saved.body).scores.find((row) => row.bidId === 3001 && row.criterionId === 303);
    expect(cell?.score).toBe('3.5');
    expect(cell?.weightedPoints).toBe('10.5000');
    expect(problemCode(outOfScale)).toBe('SCORE_OUT_OF_SCALE');
  });

  it('corrects a submitted score with a reason while moderation is open, and refuses after finalization', async () => {
    const open = await api.callAs(email('thato.eval'), correctScore, {
      tenant: 'kwu',
      params: { assignmentId: 1001, scoreId: 100105 },
      body: { newScore: '3', newRationale: 'Programme checked against L3-REQ-02.', reason: 'Rationale cited the Lot 1 programme.' },
    });
    const finalized = await api.callAs(email('thato.eval'), correctScore, {
      tenant: 'kwu',
      params: { assignmentId: 3001, scoreId: 300101 },
      body: { newScore: '4.5', newRationale: 'Changed.', reason: 'Late insight.' },
    });

    const cell = correctScore.response.parse(open.body);
    expect(cell.corrections.at(-1)?.reason).toBe('Rationale cited the Lot 1 programme.');
    expect(cell.version).toBe(2);
    expect(problemCode(finalized)).toBe('MODERATION_FINALIZED');
    expect(Problem.parse(finalized.body).detail).not.toContain('reopen');
  });
});

describe('buyer.evaluation.commercial (EVA-04)', () => {
  it('shows the original ZAR amount, the FX basis and affordability separately (BR-29)', async () => {
    const response = await api.callAs(email('refilwe.commercial'), getCommercialComparison, { tenant: 'kwu', params: { tenderId: 3 } });

    const view = getCommercialComparison.response.parse(response.body);
    const tsodilo = view.rows.find((row) => row.bid.supplierName?.startsWith('Tsodilo'));
    expect(tsodilo?.submittedTotal).toEqual({ amount: '160000.00', currency: 'ZAR' });
    expect(tsodilo?.fx?.rate).toBe('0.75');
    expect(tsodilo?.evaluatedCost).toEqual({ amount: '120000.00', currency: 'BWP' });
    expect(tsodilo?.priceScoreDisplay).toBe('25.00');
    expect(tsodilo?.affordability).toBe('exceeds_budget');
  });

  it('states the affordability warning with formatted amounts, never raw decimals', async () => {
    const response = await api.callAs(email('refilwe.commercial'), getCommercialComparison, { tenant: 'kwu', params: { tenderId: 3 } });

    const view = getCommercialComparison.response.parse(response.body);
    const warning = view.readiness.find((item) => item.id === 'affordability-3002');
    expect(warning?.detail).toContain('BWP 120,000.00 against a budget of BWP 115,000.00');
  });

  it('records who proposed a correction and when, and shows the approved T-2026-0003 correction with its proposer', async () => {
    const proposed = await api.callAs(email('refilwe.commercial'), proposeCorrection, {
      tenant: 'kwu',
      params: { commercialEvaluationId: 3602 },
      body: { correctedTotal: { amount: '161000.00', currency: 'ZAR' }, correctionRule: 'Unit rate prevails.', requiresSupplierAck: true },
    });
    const view = await api.callAs(email('refilwe.commercial'), getCommercialComparison, { tenant: 'kwu', params: { tenderId: 3 } });

    const row = proposeCorrection.response.parse(proposed.body);
    expect(row.correctionStatus).toBe('pending_approval');
    expect(row.correctionProposedBy?.fullName).toBe('Refilwe Motsumi');
    expect(row.correctionProposedAt).toBe(NOW.toISOString());
    const serowe = getCommercialComparison.response.parse(view.body).rows.find((candidate) => candidate.commercialEvaluationId === 3601);
    expect(serowe?.correctionProposedBy?.fullName).toBe('Lesego Seretse');
    expect(serowe?.correctionApprovedBy?.fullName).toBe('Refilwe Motsumi');
  });

  it('approves a correction proposed by another reviewer on T-2026-0014 Lot 3', async () => {
    const response = await api.callAs(email('refilwe.commercial'), approveCorrection, {
      tenant: 'kwu',
      params: { commercialEvaluationId: 14631 },
      body: { note: 'Checked against the unit rates.' },
    });

    expect(response.status).toBe(200);
    const row = approveCorrection.response.parse(response.body);
    expect(row.correctionStatus).toBe('approved');
    expect(row.correctionProposedBy?.fullName).toBe('Lesego Seretse');
    expect(row.correctionApprovedBy?.fullName).toBe('Refilwe Motsumi');
    expect(row.correctedTotal).toEqual({ amount: '412000.00', currency: 'BWP' });
  });

  it('records the documented review of the unreviewed abnormally-low flag on T-2026-0014 Lot 3', async () => {
    const response = await api.callAs(email('refilwe.commercial'), reviewAbnormallyLow, {
      tenant: 'kwu',
      params: { commercialEvaluationId: 14632 },
      body: { outcome: 'explanation_accepted', review: 'Written explanation received: stock sensors from a cancelled project.' },
    });

    expect(response.status).toBe(200);
    const row = reviewAbnormallyLow.response.parse(response.body);
    expect(row.abnormallyLowOutcome).toBe('explanation_accepted');
    expect(row.abnormallyLowFlag).toBe(true);
  });

  it('refuses to approve the Lot 3 comparison while a correction and an abnormally-low review are pending', async () => {
    const response = await api.callAs(email('refilwe.commercial'), approveComparison, {
      tenant: 'kwu',
      params: { tenderId: 14 },
      body: { lotId: 1403, assumptionsConfirmed: true },
    });

    expect(problemCode(response)).toBe('CORRECTION_PENDING');
  });

  it('releases the T-2026-0014 Lot 4 price gate once non-price moderation is finalized (AC-16)', async () => {
    const response = await api.callAs(email('boitumelo.chair'), releasePriceGate, {
      tenant: 'kwu',
      params: { tenderId: 14 },
      body: { lotId: 1404, nonPriceCompleteConfirmed: true, note: 'Lot 4 moderation finalized.' },
    });

    expect(response.status).toBe(200);
    const gate = releasePriceGate.response.parse(response.body);
    expect(gate.released).toBe(true);
    expect(gate.releasedBy?.fullName).toBe('Boitumelo Kgari');
  });

  it('hides a comparison from a reviewer without a commercial assignment on it', async () => {
    const response = await api.callAs(email('refilwe.commercial'), getCommercialComparison, {
      tenant: 'kwu',
      params: { tenderId: 1 },
      query: { lotId: 103 },
    });

    expect(response.status).toBe(404);
  });

  it('forbids a technical evaluator (no evaluation.commercial)', async () => {
    const response = await api.callAs(email('thato.eval'), getCommercialComparison, { tenant: 'kwu', params: { tenderId: 3 } });

    expect(response.status).toBe(403);
  });

  it('approves the T-2026-0003 comparison and refuses to approve T-2026-0009 twice', async () => {
    const approved = await api.callAs(email('refilwe.commercial'), approveComparison, {
      tenant: 'kwu',
      params: { tenderId: 3 },
      body: { assumptionsConfirmed: true },
    });
    const again = await api.callAs(email('refilwe.commercial'), approveComparison, {
      tenant: 'kwu',
      params: { tenderId: 9 },
      body: { assumptionsConfirmed: true },
    });

    expect(approveComparison.response.parse(approved.body).status).toBe('approved');
    expect(problemCode(again)).toBe('COMMERCIAL_ALREADY_APPROVED');
  });

  it('runs a private scenario without changing the official ranks', async () => {
    const response = await api.callAs(email('refilwe.commercial'), runScenario, {
      tenant: 'kwu',
      params: { tenderId: 3 },
      body: { label: 'ZAR at 0.70', fxRateOverrides: [{ fromCurrency: 'ZAR', rate: '0.70' }] },
    });

    const result = runScenario.response.parse(response.body);
    const tsodilo = result.rows.find((row) => row.bidId === 3002);
    expect(result.official).toBe(false);
    expect(tsodilo?.evaluatedCost.amount).toBe('112000.00');
    expect(tsodilo?.officialRank).toBe(1);
  });

  it('refuses to release a price gate while moderation is open, and when it is already released', async () => {
    const open = await api.callAs(email('boitumelo.chair'), releasePriceGate, {
      tenant: 'kwu',
      params: { tenderId: 1 },
      body: { lotId: 103, nonPriceCompleteConfirmed: true },
    });
    const released = await api.callAs(email('boitumelo.chair'), releasePriceGate, {
      tenant: 'kwu',
      params: { tenderId: 3 },
      body: { nonPriceCompleteConfirmed: true },
    });

    expect(problemCode(open)).toBe('NON_PRICE_MODERATION_OPEN');
    expect(problemCode(released)).toBe('PRICE_GATE_ALREADY_RELEASED');
  });
});

describe('buyer.evaluation.moderation (EVA-05)', () => {
  it('shows original scores next to the agreed result (AC-20)', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getModeration, { tenant: 'kwu', params: { tenderId: 3 } });

    const view = getModeration.response.parse(response.body);
    const divergent = view.cells.filter((cell) => cell.divergent);
    expect(divergent).toHaveLength(1);
    expect(divergent[0]?.individual.map((row) => row.score)).toContain('3');
    expect(divergent[0]?.current?.finalScore).toBe('4');
  });

  it('returns every score spread at one decimal place, whatever scale the ratings carry', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getModeration, { tenant: 'kwu', params: { tenderId: 3 } });

    const spreads = getModeration.response.parse(response.body).cells.flatMap((cell) => (cell.spread === null ? [] : [cell.spread]));
    expect(spreads.length).toBeGreaterThan(0);
    expect(spreads.every((spread) => /^\d+\.\d$/.test(spread))).toBe(true);
  });

  it('shows only submitted individual scores: a draft is marked not submitted and its content withheld', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getModeration, { tenant: 'kwu', params: { tenderId: 3 } });

    const view = getModeration.response.parse(response.body);
    const amantle = view.cells.flatMap((cell) => cell.individual.filter((row) => row.evaluator.fullName === 'Amantle Segwai'));
    expect(amantle.length).toBeGreaterThan(0);
    expect(amantle.every((row) => !row.submitted && row.score === null && row.rationale === null && row.evidenceRefs.length === 0)).toBe(true);
    const outstanding = view.cells.reduce((total, cell) => total + cell.outstanding, 0);
    const notSubmitted = view.cells.reduce((total, cell) => total + cell.individual.filter((row) => !row.submitted || row.notScored).length, 0);
    expect(outstanding).toBe(notSubmitted);
  });

  it('writes the finalization readiness with the official date, not a raw instant', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getModeration, { tenant: 'kwu', params: { tenderId: 3 } });

    const item = getModeration.response.parse(response.body).readiness.find((row) => row.id === 'finalized');
    expect(item?.detail).toBe('Finalized on 23 Sep 2026, 17:00 (UTC+02:00) Africa/Gaborone by consensus.');
  });

  it('finalizes the T-2026-0014 Lot 5 moderation once every assessment is complete and every cell agreed', async () => {
    const response = await api.callAs(email('boitumelo.chair'), finalizeModeration, {
      tenant: 'kwu',
      params: { sessionId: 14505 },
      body: { confirm: true },
    });

    expect(response.status).toBe(200);
    const result = finalizeModeration.response.parse(response.body);
    expect(result.status).toBe('finalized');
    expect(result.cellsModerated).toBe(6);
  });

  it('refuses to finalize an average-method moderation with incomplete assessments', async () => {
    const response = await api.callAs(email('boitumelo.chair'), finalizeModeration, {
      tenant: 'kwu',
      params: { sessionId: 1501 },
      body: { confirm: true },
    });

    expect(problemCode(response)).toBe('ASSESSMENTS_INCOMPLETE');
  });

  it('records an agreed score with the declared method and returns a submitted assessment', async () => {
    const recorded = await api.callAs(email('boitumelo.chair'), recordModeratedScore, {
      tenant: 'kwu',
      params: { sessionId: 1501 },
      body: { bidId: 1001, criterionId: 131, finalScore: '4', method: 'average', reasons: 'Single submitted score pending the second assessor.' },
    });
    const wrongMethod = await api.callAs(email('boitumelo.chair'), recordModeratedScore, {
      tenant: 'kwu',
      params: { sessionId: 1501 },
      body: { bidId: 1001, criterionId: 131, finalScore: '4', method: 'consensus', reasons: 'Wrong method.' },
    });
    const returned = await api.callAs(email('boitumelo.chair'), returnAssessment, {
      tenant: 'kwu',
      params: { assignmentId: 1001 },
      body: { reason: 'Re-check the Supplier B programme against L3-REQ-02.' },
    });

    expect(recorded.status).toBe(201);
    expect(problemCode(wrongMethod)).toBe('METHOD_NOT_PERMITTED');
    expect(returnAssessment.response.parse(returned.body).status).toBe('returned');
  });

  it('forbids evaluators from the moderation workspace', async () => {
    const response = await api.callAs(email('kabo.eval'), getModeration, { tenant: 'kwu', params: { tenderId: 3 } });

    expect(response.status).toBe(403);
  });
});

describe('buyer.evaluation.results (EVA-06)', () => {
  it('returns 86.00 and 88.00 with Tsodilo first and the PRD §9.2 criterion points to the chair (AC-19)', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getResults, { tenant: 'kwu', params: { tenderId: 3 } });

    const view = getResults.response.parse(response.body);
    expect(view.detail).toBe('full');
    const ranked = view.results.filter((row) => row.rank !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    expect(ranked.map((row) => [row.bid.label, row.totalScoreDisplay])).toEqual([
      ['Supplier B', '88.00'],
      ['Supplier A', '86.00'],
    ]);
    expect(ranked[1]?.criterionPoints.map((row) => row.pointsDisplay)).toEqual(['28.00', '16.00', '12.00', '30.00']);
    expect(ranked[0]?.criterionPoints.map((row) => row.pointsDisplay)).toEqual(['31.50', '18.00', '13.50', '25.00']);
  });

  it('shows the tender owner totals only on the draft ranking, without criterion points or readiness', async () => {
    const response = await api.callAs(email('tebogo.officer'), getResults, { tenant: 'kwu', params: { tenderId: 3 } });

    const view = getResults.response.parse(response.body);
    expect(view.detail).toBe('totals_only');
    expect(view.results.every((row) => row.criterionPoints.length === 0)).toBe(true);
    expect(view.results.find((row) => row.rank === 1)?.totalScoreDisplay).toBe('88.00');
    expect(view.readiness).toEqual([]);
    expect(view.report).toBeNull();
  });

  it('hides the draft T-2026-0003 evaluation from the award approver (not found)', async () => {
    const results = await api.callAs(email('keabetswe.approver'), getResults, { tenant: 'kwu', params: { tenderId: 3 } });
    const overview = await api.callAs(email('keabetswe.approver'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });

    expect(results.status).toBe(404);
    expect(overview.status).toBe(404);
  });

  it('shows the award approver only the handed-off T-2026-0009 report, not the re-validated draft results', async () => {
    const response = await api.callAs(email('keabetswe.approver'), getResults, { tenant: 'kwu', params: { tenderId: 9 } });

    const view = getResults.response.parse(response.body);
    expect(view.detail).toBe('reports_only');
    expect(view.results).toEqual([]);
    expect(view.readiness).toEqual([]);
    expect(view.report).toBeNull();
    expect(view.reportHistory.map((report) => [report.version, report.status])).toEqual([[1, 'superseded']]);
  });

  it('shows the award approver the full signed-off ranking of T-2026-0014 Lot 1', async () => {
    const response = await api.callAs(email('keabetswe.approver'), getResults, { tenant: 'kwu', params: { tenderId: 14 }, query: { lotId: 1401 } });

    const view = getResults.response.parse(response.body);
    expect(view.detail).toBe('full');
    expect(view.report?.status).toBe('signed_off');
    const first = view.results.find((row) => row.rank === 1);
    expect(first?.totalScoreDisplay).toBe('86.00');
    expect(first?.criterionPoints).toHaveLength(4);
  });

  it('names gate failures in plain language in the ranking readiness', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getResults, { tenant: 'kwu', params: { tenderId: 3 } });

    const item = getResults.response.parse(response.body).readiness.find((row) => row.id === 'gates-3003');
    expect(item?.label).toBe('Supplier C (Makgadikgadi Civil Works) not ranked: failed a mandatory requirement');
  });

  it('withholds committee results from an evaluator who has not submitted', async () => {
    const response = await api.callAs(email('amantle.eval'), getResults, { tenant: 'kwu', params: { tenderId: 3 } });

    expect(problemCode(response)).toBe('OWN_ASSESSMENT_NOT_SUBMITTED');
  });

  it('asks for a lot on a multi-lot tender only when several lots are evaluated', async () => {
    const response = await api.callAs(email('boitumelo.chair'), getResults, { tenant: 'kwu', params: { tenderId: 1 } });

    expect(response.status).toBe(200);
    expect(getResults.response.parse(response.body).status).toBe('not_computed');
  });

  it('refuses to submit the T-2026-0003 report while an assessment is incomplete (AC-18)', async () => {
    const response = await api.callAs(email('boitumelo.chair'), submitReport, {
      tenant: 'kwu',
      params: { reportId: 3801 },
      body: { summary: 'Tsodilo ranked first.' },
    });

    expect(problemCode(response)).toBe('REPORT_NOT_READY');
    expect(Problem.parse(response.body).detail).toContain('Amantle Segwai');
  });

  it('submits the ready T-2026-0014 Lot 2 report for sign-off, ordering the displayed tie by the tie sequence', async () => {
    const results = await api.callAs(email('boitumelo.chair'), getResults, { tenant: 'kwu', params: { tenderId: 14 }, query: { lotId: 1402 } });
    const response = await api.callAs(email('boitumelo.chair'), submitReport, {
      tenant: 'kwu',
      params: { reportId: 14802 },
      body: { summary: 'Both offers total 84.00; Gaborone Metering ranks first on higher non-price points.' },
    });

    const view = getResults.response.parse(results.body);
    expect(view.readiness.filter((item) => item.status === 'blocking')).toEqual([]);
    expect(view.results.find((row) => row.rank === 1)?.bid.label).toBe('Supplier B');
    expect(response.status).toBe(200);
    const report = submitReport.response.parse(response.body);
    expect(report.status).toBe('in_signoff');
    expect(report.submittedForSignoffAt).toBe(NOW.toISOString());
  });

  it('passes the signed-off T-2026-0014 Lot 1 report to the award recommendation, once', async () => {
    const handed = await api.callAs(email('boitumelo.chair'), handoffReport, { tenant: 'kwu', params: { reportId: 14801 }, body: {} });
    const again = await api.callAs(email('boitumelo.chair'), handoffReport, { tenant: 'kwu', params: { reportId: 9801 }, body: {} });

    expect(handed.status).toBe(200);
    const result = handoffReport.response.parse(handed.body);
    expect(result.recommendedBidId).toBe(14011);
    expect(result.lotId).toBe(1401);
    expect(problemCode(again)).toBe('REPORT_ALREADY_HANDED_OFF');
  });

  it('records a pending committee member’s sign-off and refuses a non-member', async () => {
    const signed = await api.callAs(email('kabo.eval'), signoffReport, {
      tenant: 'kwu',
      params: { reportId: 9802 },
      body: { decision: 'signed' },
    });
    const nonMember = await api.callAs(email('amantle.eval'), signoffReport, {
      tenant: 'kwu',
      params: { reportId: 9802 },
      body: { decision: 'signed' },
    });

    const report = signoffReport.response.parse(signed.body);
    expect(report.signoffs.find((row) => row.signer.fullName === 'Kabo Ntsima')?.decision).toBe('signed');
    expect(report.status).toBe('in_signoff');
    expect(nonMember.status).toBe(404);
  });
});

describe('real Supabase authentication', () => {
  it('serves the overview to the chair signed in through local Supabase Auth', async () => {
    const realApi = await createTestMockApp({ now: () => NOW, modules: [{ name: 'evaluation', register }] });

    const response = await realApi.callAs(email('boitumelo.chair'), getEvaluation, { tenant: 'kwu', params: { tenderId: 3 } });

    expect(response.status).toBe(200);
    expect(getEvaluation.response.parse(response.body).stage).toBe('ranking');
  });
});
