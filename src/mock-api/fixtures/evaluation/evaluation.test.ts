import { describe, expect, it } from 'vitest';

import {
  AssignmentDetail,
  CommercialComparison,
  EvaluationOverview,
  EvaluationPlan,
  ModerationView,
  RankingView,
} from '../../../contracts/evaluation.js';
import { sum } from '../../../contracts/decimal.js';
import { findPersonaById, membershipPermissions } from '../../persona.js';
import { EVALUATION_ASSIGNMENTS, EVALUATION_SCORES, EVALUATIONS } from '../evaluation.js';
import { callerOf } from '../../handlers/evaluation/access.js';
import {
  assessmentView,
  assignmentDetail,
  commercialView,
  moderationView,
  overviewView,
  rankingView,
  scopeCells,
} from '../../handlers/evaluation/views.js';
import { resolveTenantAccess } from '../../persona.js';

const NOW = new Date('2026-09-30T08:00:00Z');

function evaluationByKey(key: string) {
  const evaluation = EVALUATIONS.find((row) => row.key === key);
  if (evaluation === undefined) {
    throw new Error(`No evaluation ${key}.`);
  }
  return evaluation;
}

function chairCaller() {
  const persona = findPersonaById(10);
  const access = persona === undefined ? null : resolveTenantAccess(persona, 2, NOW, 'buyer');
  if (persona === undefined || access === null) {
    throw new Error('Chair persona has no KWU access.');
  }
  return callerOf(persona.userId, access);
}

describe('evaluation fixtures: integrity', () => {
  it('uses unique ids for evaluations, assignments and scores', () => {
    const keys = EVALUATIONS.map((row) => row.key);
    const assignmentIds = EVALUATION_ASSIGNMENTS.map((row) => row.assignmentId);
    const scoreIds = EVALUATION_SCORES.map((row) => row.scoreId);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(assignmentIds).size).toBe(assignmentIds.length);
    expect(new Set(scoreIds).size).toBe(scoreIds.length);
  });

  it('keeps every plan valid with weights totalling 100 points', () => {
    for (const evaluation of EVALUATIONS) {
      EvaluationPlan.parse(evaluation.plan);
      expect(sum(evaluation.plan.criteria.filter((row) => row.parentId === null).map((row) => row.maxPoints))).toBe('100');
    }
  });

  it('assigns only KWU personas who hold the evaluation permission of their assignment', () => {
    for (const assignment of EVALUATION_ASSIGNMENTS) {
      const persona = findPersonaById(assignment.evaluatorUserId);
      const membership = persona?.memberships.find((row) => row.tenantId === assignment.tenantId);
      expect(membership, `assignment ${assignment.assignmentId}`).toBeDefined();
      const permissions = membership === undefined ? [] : membershipPermissions(membership);
      expect(permissions).toContain(assignment.isCommercial ? 'evaluation.commercial' : 'evaluation.score');
    }
  });

  it('scores only cells inside each assignment scope', () => {
    for (const score of EVALUATION_SCORES) {
      const assignment = EVALUATION_ASSIGNMENTS.find((row) => row.assignmentId === score.assignmentId);
      expect(assignment).toBeDefined();
      if (assignment === undefined) {
        continue;
      }
      const { bidIds, criterionIds } = scopeCells(assignment);
      expect(bidIds).toContain(score.bidId);
      expect(criterionIds).toContain(score.criterionId);
    }
  });

  it('assembles every view so that it parses against the contract', () => {
    const caller = chairCaller();
    for (const evaluation of EVALUATIONS) {
      EvaluationOverview.parse(overviewView(evaluation, caller, NOW));
      CommercialComparison.parse(commercialView(evaluation));
      RankingView.parse(rankingView(evaluation));
      const moderation = moderationView(evaluation);
      if (moderation !== null) {
        ModerationView.parse(moderation);
      }
    }
    for (const assignment of EVALUATION_ASSIGNMENTS) {
      AssignmentDetail.parse(assignmentDetail(assignment, caller, NOW));
      if (!assignment.isCommercial) {
        assessmentView(assignment, caller);
      }
    }
  });
});

describe('evaluation fixtures: storyline scenarios', () => {
  it('reproduces PRD §9.2 exactly on T-2026-0003: Serowe 86.00, Tsodilo 88.00, Tsodilo ranked first (AC-19)', () => {
    // Arrange
    const view = RankingView.parse(rankingView(evaluationByKey('T-2026-0003')));

    // Act
    const serowe = view.results.find((row) => row.bid.supplierName?.startsWith('Serowe'));
    const tsodilo = view.results.find((row) => row.bid.supplierName?.startsWith('Tsodilo'));

    // Assert
    expect(serowe?.criterionPoints.map((row) => row.pointsDisplay)).toEqual(['28.00', '16.00', '12.00', '30.00']);
    expect(tsodilo?.criterionPoints.map((row) => row.pointsDisplay)).toEqual(['31.50', '18.00', '13.50', '25.00']);
    expect(serowe?.totalScoreDisplay).toBe('86.00');
    expect(tsodilo?.totalScoreDisplay).toBe('88.00');
    expect(serowe?.evaluatedCost).toEqual({ amount: '100000.00', currency: 'BWP' });
    expect(tsodilo?.evaluatedCost).toEqual({ amount: '120000.00', currency: 'BWP' });
    expect(tsodilo?.rank).toBe(1);
    expect(serowe?.rank).toBe(2);
  });

  it('keeps the excluded Makgadikgadi bid unranked with its commercial envelope sealed (AC-17)', () => {
    const evaluation = evaluationByKey('T-2026-0003');
    const ranking = rankingView(evaluation);
    const commercial = commercialView(evaluation);

    const makgadikgadi = ranking.results.find((row) => row.bid.supplierName?.startsWith('Makgadikgadi'));
    expect(makgadikgadi?.rank).toBeNull();
    expect(makgadikgadi?.gateFailures).toContain('MANDATORY_REQUIREMENT_FAILED');
    expect(commercial.sealedBids.map((row) => row.bid.supplierName)).toEqual([makgadikgadi?.bid.supplierName]);
  });

  it('shows the missing criterion as not scored and blocks report sign-off (AC-18)', () => {
    const evaluation = evaluationByKey('T-2026-0003');
    const amantle = EVALUATION_ASSIGNMENTS.find((row) => row.evaluationKey === evaluation.key && row.evaluatorUserId === 13);
    expect(amantle).toBeDefined();
    if (amantle === undefined) {
      return;
    }

    const assessment = assessmentView(amantle, callerOf(13, { ...chairAccess(), permissions: ['evaluation.score'] }));
    const readiness = rankingView(evaluation).readiness;

    expect(assessment.completion.complete).toBe(false);
    expect(assessment.completion.missing).toHaveLength(1);
    const missing = assessment.scores.filter((cell) => cell.score === null);
    expect(missing).toHaveLength(1);
    expect(missing[0]?.weightedPoints).toBeNull();
    expect(readiness.some((item) => item.status === 'blocking' && item.label.includes('Amantle Segwai'))).toBe(true);
  });

  it('preserves the original individual score that moderation changed, with reasons and history (AC-20)', () => {
    const view = moderationView(evaluationByKey('T-2026-0003'));
    const changed = view?.cells.filter((cell) => cell.current?.differsFromIndividual === true) ?? [];

    expect(changed).toHaveLength(1);
    const cell = changed[0];
    expect(cell?.current?.finalScore).toBe('4');
    expect(cell?.individual.some((entry) => entry.score === '3' && entry.status === 'submitted')).toBe(true);
    expect(cell?.history.map((row) => row.finalScore)).toEqual(['3.5']);
    expect(cell?.current?.reasons.length).toBeGreaterThan(20);
  });

  it('keeps the T-2026-0001 Lot 3 prices sealed until its price gate is released (AC-16)', () => {
    const commercial = commercialView(evaluationByKey('T-2026-0001/3'));

    expect(commercial.priceGate.released).toBe(false);
    expect(commercial.rows).toEqual([]);
    expect(commercial.sealedBids).toHaveLength(2);
  });

  it('ranks the declared fallback on T-2026-0009 and keeps the below-threshold offer out of the reference set', () => {
    const evaluation = evaluationByKey('T-2026-0009');
    const ranking = rankingView(evaluation);
    const commercial = commercialView(evaluation);

    expect(ranking.results.filter((row) => row.rank !== null).map((row) => row.bid.supplierName)).toEqual([
      expect.stringMatching(/^Limpopo/),
    ]);
    const gaborone = commercial.rows.find((row) => row.bid.supplierName?.startsWith('Gaborone'));
    expect(gaborone?.inReferenceSet).toBe(false);
    expect(gaborone?.abnormallyLowFlag).toBe(true);
    expect(gaborone?.priceScore).toBeNull();
    expect(ranking.report?.status).toBe('in_signoff');
    expect(ranking.reportHistory.map((row) => row.status)).toEqual(['superseded']);
  });
});

describe('evaluation fixtures: T-2026-0014 lots at each committee step', () => {
  it('holds a signed-off report not yet handed off on Lot 1, with Gaborone Metering first at 86.00', () => {
    const view = RankingView.parse(rankingView(evaluationByKey('T-2026-0014/1')));

    expect(view.report?.status).toBe('signed_off');
    expect(view.report?.handedOffAt).toBeNull();
    expect(view.report?.signoffs.every((line) => line.decision === 'signed')).toBe(true);
    expect(view.results.map((row) => [row.bid.supplierName, row.totalScoreDisplay, row.rank])).toEqual([
      ['Gaborone Metering Co.', '86.00', 1],
      ['Tsodilo Engineering', '75.00', 2],
    ]);
  });

  it('holds a draft report on Lot 2 whose readiness has no blocking item, with a displayed tie ordered by the tie sequence', () => {
    const view = RankingView.parse(rankingView(evaluationByKey('T-2026-0014/2')));

    expect(view.report?.status).toBe('draft');
    expect(view.readiness.filter((item) => item.status === 'blocking')).toEqual([]);
    expect(view.results.map((row) => row.totalScoreDisplay)).toEqual(['84.00', '84.00']);
    expect(view.results.find((row) => row.rank === 1)?.tieBreakApplied).toBe('highest_non_price');
  });

  it('holds a draft comparison on Lot 3 with a correction proposed by the financial reviewer and an unreviewed abnormally-low flag', () => {
    const view = CommercialComparison.parse(commercialView(evaluationByKey('T-2026-0014/3')));

    expect(view.status).toBe('draft');
    const [first, second] = view.rows;
    expect(first?.correctionStatus).toBe('pending_approval');
    expect(first?.correctionProposedBy?.fullName).toBe('Lesego Seretse');
    expect(first?.correctedTotal).toEqual({ amount: '412000.00', currency: 'BWP' });
    expect(second?.abnormallyLowFlag).toBe(true);
    expect(second?.abnormallyLowOutcome).toBe('pending');
  });

  it('holds a finalized moderation with a closed price gate on Lot 4 and an open, fully agreed moderation on Lot 5', () => {
    const lot4 = evaluationByKey('T-2026-0014/4');
    const lot5 = moderationView(evaluationByKey('T-2026-0014/5'));

    expect(lot4.moderation?.status).toBe('finalized');
    expect(lot4.priceGate.releasedAt).toBeNull();
    expect(lot5?.session.status).toBe('open');
    expect(lot5?.cells.every((cell) => cell.current !== null && cell.outstanding === 0)).toBe(true);
    expect(lot5?.readiness.filter((item) => item.status === 'blocking')).toEqual([]);
  });
});

function chairAccess() {
  const persona = findPersonaById(10);
  const access = persona === undefined ? null : resolveTenantAccess(persona, 2, NOW, 'buyer');
  if (access === null) {
    throw new Error('No access.');
  }
  return access;
}
