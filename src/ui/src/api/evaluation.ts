/**
 * Evaluation client (the `evaluation` contract; FR-14, PRD §9): evaluator assignments (EVA-01), individual assessment
 * (EVA-02), commercial comparison and the price gate (EVA-04), moderation (EVA-05), and ranking with the evaluation
 * report (EVA-06). Pages use the hooks with the contract endpoints directly; these typed wrappers serve code outside
 * hooks.
 */
import { evaluationEndpoints } from '@contracts/evaluation';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof evaluationEndpoints;
/** The request (`params`, `query`, `body`) of an evaluation endpoint. */
export type EvaluationRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of an evaluation endpoint. */
export type EvaluationResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: EvaluationRequest<K>,
  options?: CallOptions,
): Promise<EvaluationResponse<K>> {
  return call(evaluationEndpoints[key], request, options);
}

/** GET /api/v1/buyer/evaluation/tenders (`buyer.evaluation.list`, EVA-01, EVA-05, EVA-06): Evaluations (tender or lot) with stage, assignment progress, price gate, moderation and report status. */
export function listEvaluations(
  request: EvaluationRequest<'listEvaluations'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'listEvaluations'>> {
  return send('listEvaluations', request, options);
}

/** GET /api/v1/buyer/evaluation/tenders/:tenderId (`buyer.evaluation.get`, EVA-01, EVA-05, EVA-06). */
export function getEvaluation(
  request: EvaluationRequest<'getEvaluation'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'getEvaluation'>> {
  return send('getEvaluation', request, options);
}

/** GET /api/v1/buyer/evaluation/assignments (`buyer.evaluation.assignments.list`, EVA-01). */
export function listAssignments(
  request: EvaluationRequest<'listAssignments'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'listAssignments'>> {
  return send('listAssignments', request, options);
}

/** GET /api/v1/buyer/evaluation/assignments/:assignmentId (`buyer.evaluation.assignments.get`, EVA-01). */
export function getAssignment(
  request: EvaluationRequest<'getAssignment'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'getAssignment'>> {
  return send('getAssignment', request, options);
}

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/accept (`buyer.evaluation.assignments.accept`, EVA-01). */
export function acceptAssignment(
  request: EvaluationRequest<'acceptAssignment'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'acceptAssignment'>> {
  return send('acceptAssignment', request, options);
}

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/conflict-declarations (`buyer.evaluation.assignments.declareConflict`, EVA-01). */
export function declareConflict(
  request: EvaluationRequest<'declareConflict'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'declareConflict'>> {
  return send('declareConflict', request, options);
}

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/reassignment-request (`buyer.evaluation.assignments.requestReassignment`, EVA-01). */
export function requestReassignment(
  request: EvaluationRequest<'requestReassignment'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'requestReassignment'>> {
  return send('requestReassignment', request, options);
}

/** GET /api/v1/buyer/evaluation/assignments/:assignmentId/reassignment-candidates (`buyer.evaluation.assignments.reassignmentCandidates`, EVA-01). */
export function getReassignmentCandidates(
  request: EvaluationRequest<'getReassignmentCandidates'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'getReassignmentCandidates'>> {
  return send('getReassignmentCandidates', request, options);
}

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/reassign (`buyer.evaluation.assignments.reassign`, EVA-01). */
export function reassignAssignment(
  request: EvaluationRequest<'reassignAssignment'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'reassignAssignment'>> {
  return send('reassignAssignment', request, options);
}

/** POST /api/v1/buyer/evaluation/conflict-declarations/:declarationId/review (`buyer.evaluation.conflicts.review`, EVA-01). */
export function reviewConflict(
  request: EvaluationRequest<'reviewConflict'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'reviewConflict'>> {
  return send('reviewConflict', request, options);
}

/** GET /api/v1/buyer/evaluation/assignments/:assignmentId/assessment (`buyer.evaluation.assessment.get`, EVA-02). */
export function getAssessment(
  request: EvaluationRequest<'getAssessment'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'getAssessment'>> {
  return send('getAssessment', request, options);
}

/** PUT /api/v1/buyer/evaluation/assignments/:assignmentId/scores (`buyer.evaluation.assessment.saveScores`, EVA-02). */
export function saveScores(
  request: EvaluationRequest<'saveScores'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'saveScores'>> {
  return send('saveScores', request, options);
}

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/submit (`buyer.evaluation.assessment.submit`, EVA-02). */
export function submitAssessment(
  request: EvaluationRequest<'submitAssessment'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'submitAssessment'>> {
  return send('submitAssessment', request, options);
}

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/scores/:scoreId/corrections (`buyer.evaluation.assessment.correctScore`, EVA-02). */
export function correctScore(
  request: EvaluationRequest<'correctScore'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'correctScore'>> {
  return send('correctScore', request, options);
}

/** GET /api/v1/buyer/evaluation/tenders/:tenderId/commercial (`buyer.evaluation.commercial.get`, EVA-04). */
export function getCommercialComparison(
  request: EvaluationRequest<'getCommercialComparison'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'getCommercialComparison'>> {
  return send('getCommercialComparison', request, options);
}

/** POST /api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/corrections (`buyer.evaluation.commercial.proposeCorrection`, EVA-04). */
export function proposeCorrection(
  request: EvaluationRequest<'proposeCorrection'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'proposeCorrection'>> {
  return send('proposeCorrection', request, options);
}

/** POST /api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/corrections/approve (`buyer.evaluation.commercial.approveCorrection`, EVA-04). */
export function approveCorrection(
  request: EvaluationRequest<'approveCorrection'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'approveCorrection'>> {
  return send('approveCorrection', request, options);
}

/** POST /api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/abnormally-low-review (`buyer.evaluation.commercial.reviewAbnormallyLow`, EVA-04). */
export function reviewAbnormallyLow(
  request: EvaluationRequest<'reviewAbnormallyLow'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'reviewAbnormallyLow'>> {
  return send('reviewAbnormallyLow', request, options);
}

/** POST /api/v1/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/reference-set (`buyer.evaluation.commercial.setReferenceSet`, EVA-04). */
export function setReferenceSet(
  request: EvaluationRequest<'setReferenceSet'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'setReferenceSet'>> {
  return send('setReferenceSet', request, options);
}

/** POST /api/v1/buyer/evaluation/tenders/:tenderId/commercial/approve (`buyer.evaluation.commercial.approve`, EVA-04). */
export function approveComparison(
  request: EvaluationRequest<'approveComparison'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'approveComparison'>> {
  return send('approveComparison', request, options);
}

/** POST /api/v1/buyer/evaluation/tenders/:tenderId/commercial/scenarios (`buyer.evaluation.commercial.scenario`, EVA-04). */
export function runScenario(
  request: EvaluationRequest<'runScenario'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'runScenario'>> {
  return send('runScenario', request, options);
}

/** POST /api/v1/buyer/evaluation/tenders/:tenderId/price-gate (`buyer.evaluation.priceGate.release`, EVA-04, EVA-05). */
export function releasePriceGate(
  request: EvaluationRequest<'releasePriceGate'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'releasePriceGate'>> {
  return send('releasePriceGate', request, options);
}

/** GET /api/v1/buyer/evaluation/tenders/:tenderId/moderation (`buyer.evaluation.moderation.get`, EVA-05). */
export function getModeration(
  request: EvaluationRequest<'getModeration'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'getModeration'>> {
  return send('getModeration', request, options);
}

/** POST /api/v1/buyer/evaluation/moderation-sessions/:sessionId/scores (`buyer.evaluation.moderation.recordScore`, EVA-05). */
export function recordModeratedScore(
  request: EvaluationRequest<'recordModeratedScore'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'recordModeratedScore'>> {
  return send('recordModeratedScore', request, options);
}

/** PUT /api/v1/buyer/evaluation/moderation-sessions/:sessionId/notes (`buyer.evaluation.moderation.updateNotes`, EVA-05). */
export function updateModerationNotes(
  request: EvaluationRequest<'updateModerationNotes'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'updateModerationNotes'>> {
  return send('updateModerationNotes', request, options);
}

/** POST /api/v1/buyer/evaluation/assignments/:assignmentId/return (`buyer.evaluation.moderation.returnAssessment`, EVA-05). */
export function returnAssessment(
  request: EvaluationRequest<'returnAssessment'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'returnAssessment'>> {
  return send('returnAssessment', request, options);
}

/** POST /api/v1/buyer/evaluation/moderation-sessions/:sessionId/finalize (`buyer.evaluation.moderation.finalize`, EVA-05). */
export function finalizeModeration(
  request: EvaluationRequest<'finalizeModeration'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'finalizeModeration'>> {
  return send('finalizeModeration', request, options);
}

/** GET /api/v1/buyer/evaluation/tenders/:tenderId/results (`buyer.evaluation.results.get`, EVA-06). */
export function getResults(
  request: EvaluationRequest<'getResults'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'getResults'>> {
  return send('getResults', request, options);
}

/** POST /api/v1/buyer/evaluation/tenders/:tenderId/results/validate (`buyer.evaluation.results.validate`, EVA-06). */
export function validateResults(
  request: EvaluationRequest<'validateResults'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'validateResults'>> {
  return send('validateResults', request, options);
}

/** POST /api/v1/buyer/evaluation/reports/:reportId/submit (`buyer.evaluation.reports.submit`, EVA-06). */
export function submitReport(
  request: EvaluationRequest<'submitReport'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'submitReport'>> {
  return send('submitReport', request, options);
}

/** POST /api/v1/buyer/evaluation/reports/:reportId/signoffs (`buyer.evaluation.reports.signoff`, EVA-06). */
export function signoffReport(
  request: EvaluationRequest<'signoffReport'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'signoffReport'>> {
  return send('signoffReport', request, options);
}

/** POST /api/v1/buyer/evaluation/reports/:reportId/exports (`buyer.evaluation.reports.export`, EVA-06). */
export function exportReport(
  request: EvaluationRequest<'exportReport'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'exportReport'>> {
  return send('exportReport', request, options);
}

/** POST /api/v1/buyer/evaluation/reports/:reportId/handoff (`buyer.evaluation.reports.handoff`, EVA-06). */
export function handoffReport(
  request: EvaluationRequest<'handoffReport'>,
  options?: CallOptions,
): Promise<EvaluationResponse<'handoffReport'>> {
  return send('handoffReport', request, options);
}
