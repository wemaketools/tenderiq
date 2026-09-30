/**
 * Mock handlers of the evaluation contract (`src/contracts/evaluation.ts`; EVA-01, EVA-02, EVA-04, EVA-05, EVA-06;
 * FR-14, PRD §9, BR-26..BR-29, AC-16, AC-18, AC-19, AC-20).
 *
 * - Reads filter the static fixtures by the active buyer tenant and by assignment (BR-26): evaluators see their own
 *   assignments and evaluations, the chair sees the whole committee, the award team sees progress and results.
 *   Another tenant's or another evaluator's record is simply not found.
 * - Commands validate the request against the fixture state, answer the declared business error the state implies
 *   (for example ASSESSMENT_INCOMPLETE for a missing score), or return a contract-valid static outcome. Nothing is
 *   persisted: the next read returns the fixture again.
 */
import { add, compare, div, lt, mul, round, sub } from '../../../contracts/decimal.js';
import {
  acceptAssignment,
  approveComparison,
  approveCorrection,
  correctScore,
  declareConflict,
  exportReport,
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
  proposeCorrection,
  reassignAssignment,
  recordModeratedScore,
  releasePriceGate,
  requestReassignment,
  returnAssessment,
  reviewAbnormallyLow,
  reviewConflict,
  runScenario,
  saveScores,
  setReferenceSet,
  signoffReport,
  submitAssessment,
  submitReport,
  updateModerationNotes,
  validateResults,
} from '../../../contracts/evaluation.js';
import type { AssignmentRow, EvaluationStage, ScenarioRow } from '../../../contracts/evaluation.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { EVALUATION_ASSIGNMENTS, KWU_UNDERTAKING } from '../../fixtures/evaluation.js';
import type { FixtureAssignment, FixtureCommercialRow, FixtureEvaluation } from '../../fixtures/evaluation.js';
import { allPersonas, membershipPermissions } from '../../persona.js';
import type { Caller } from './access.js';
import {
  assignmentsOf,
  callerOf,
  evaluationOf,
  isActiveAssignment,
  isChair,
  onTenderTeam,
  ownAssignments,
  resolveEvaluation,
  roleIn,
  tenantEvaluations,
  visibleAssignment,
} from './access.js';
import type { CellOverride } from './views.js';
import {
  assessmentCells,
  assessmentView,
  assignmentDetail,
  assignmentRow,
  commercialRowView,
  commercialView,
  computeResults,
  contentBlock,
  criterion,
  declarationView,
  isScored,
  isSubmitted,
  member,
  moderationCells,
  moderationView,
  nonPriceCriterionIds,
  overviewView,
  person,
  priceGateView,
  pricesVisible,
  rankResults,
  rankingReadiness,
  rankingView,
  reportView,
  resultDetailFor,
  resultRows,
  scopeCells,
  scoresOf,
  summaryRow,
  weightedPoints,
  withinScale,
} from './views.js';

/** Ids of records a command would create (static prototype: ≥ 900, never persisted). */
const NEW_IDS = {
  assignment: 901,
  task: 902,
  moderatedScore: 903,
  export: 904,
  signoff: 905,
  correction: 906,
  undertaking: 907,
  declaration: 908,
} as const;

const STAGE_ORDER: readonly EvaluationStage[] = [
  'individual_assessment',
  'moderation',
  'commercial_comparison',
  'ranking',
  'signoff',
  'complete',
];

function direction(dir: 'asc' | 'desc'): number {
  return dir === 'desc' ? -1 : 1;
}

function matchesText(q: string | undefined, ...values: ReadonlyArray<string | null | undefined>): boolean {
  if (q === undefined || q.length === 0) {
    return true;
  }
  const needle = q.toLowerCase();
  return values.some((value) => value !== null && value !== undefined && value.toLowerCase().includes(needle));
}

/** The calendar date of an instant in an IANA zone (`YYYY-MM-DD`). */
function dateIn(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

function toOverrides(
  scores: ReadonlyArray<{
    bidId: number;
    criterionId: number;
    score: string | null;
    isNotApplicable: boolean;
    rationale: string | null;
    evidenceRefs: string[];
    clarificationNeeded: boolean;
    clarificationQuestion: string | null;
  }>,
): CellOverride[] {
  return scores.map((row) => ({
    bidId: row.bidId,
    criterionId: row.criterionId,
    score: row.score,
    isNotApplicable: row.isNotApplicable,
    rationale: row.rationale,
    evidenceRefs: row.evidenceRefs,
    clarificationNeeded: row.clarificationNeeded,
    clarificationQuestion: row.clarificationQuestion,
  }));
}

type Fail = (status: number, code: string, detail?: string) => never;

/** Checks every requested cell against the assignment scope and the plan (scale, N/A permission). */
function checkCells(assignment: FixtureAssignment, cells: readonly CellOverride[], fail: Fail): void {
  const evaluation = evaluationOf(assignment);
  const { bidIds, criterionIds } = scopeCells(assignment);
  for (const cell of cells) {
    if (!bidIds.includes(cell.bidId) || !criterionIds.includes(cell.criterionId)) {
      fail(422, 'CELL_NOT_IN_SCOPE', `Bid ${cell.bidId} × criterion ${cell.criterionId} is not in this assignment.`);
    }
    if (cell.score !== null && !withinScale(evaluation, cell.score)) {
      fail(422, 'SCORE_OUT_OF_SCALE', `Ratings run from 0 to ${evaluation.plan.scaleMax}.`);
    }
    if (cell.isNotApplicable && criterion(evaluation, cell.criterionId)?.naPermitted !== true) {
      fail(422, 'NOT_APPLICABLE_NOT_PERMITTED', `"${criterion(evaluation, cell.criterionId)?.name ?? ''}" cannot be marked not applicable.`);
    }
  }
}

/** The caller's own assignment for a command: 404 when invisible, 403 for the chair acting on someone else's. */
function ownAssignmentFor(caller: Caller, assignmentId: number, fail: Fail, notFound: (detail?: string) => never): FixtureAssignment {
  const assignment = visibleAssignment(caller, assignmentId);
  if (assignment === null) {
    return notFound('Assignment not found.');
  }
  if (assignment.evaluatorUserId !== caller.userId) {
    fail(403, 'NOT_ASSIGNED_EVALUATOR', 'Only the assigned evaluator can act on this assignment.');
  }
  return assignment;
}

function blockedDetail(reason: ReturnType<typeof contentBlock>): string {
  switch (reason) {
    case 'not_accepted':
      return 'Accept the assignment, the confidentiality undertaking and the conflict declaration first.';
    case 'undertaking_missing':
      return 'Sign the confidentiality undertaking first.';
    case 'conflict_pending_review':
      return 'Your conflict declaration awaits the chair’s review; access is suspended until then.';
    case 'recused':
      return 'You were recused from this evaluation.';
    case 'reassigned':
      return 'This assignment was reassigned.';
    default:
      return 'Content is not available.';
  }
}

function findCommercialRow(caller: Caller, commercialEvaluationId: number): { evaluation: FixtureEvaluation; row: FixtureCommercialRow } | null {
  for (const evaluation of tenantEvaluations(caller)) {
    const row = evaluation.commercial.rows.find((candidate) => candidate.commercialEvaluationId === commercialEvaluationId);
    if (row !== undefined && canSeeCommercial(caller, evaluation)) {
      return { evaluation, row };
    }
  }
  return null;
}

function canSeeCommercial(caller: Caller, evaluation: FixtureEvaluation): boolean {
  return isChair(caller) || ownAssignments(caller, evaluation).some((row) => row.isCommercial);
}

function evaluationBySession(caller: Caller, sessionId: number): FixtureEvaluation | null {
  return tenantEvaluations(caller).find((row) => row.moderation?.sessionId === sessionId) ?? null;
}

function evaluationByReport(caller: Caller, reportId: number) {
  for (const evaluation of tenantEvaluations(caller)) {
    const report = evaluation.reports.find((row) => row.reportId === reportId);
    if (report !== undefined && roleIn(caller, evaluation) !== null) {
      return { evaluation, report };
    }
  }
  return null;
}

/** People of the tenant who may evaluate (hold `evaluation.score` in an active membership). */
function evaluatorPool(tenantId: number): number[] {
  return allPersonas()
    .filter((persona) => persona.status === 'active')
    .filter((persona) =>
      persona.memberships.some(
        (membership) =>
          membership.tenantId === tenantId && membership.status === 'active' && membershipPermissions(membership).includes('evaluation.score'),
      ),
    )
    .map((persona) => persona.userId);
}

function candidateFor(evaluation: FixtureEvaluation, current: FixtureAssignment, userId: number) {
  const onCommittee = assignmentsOf(evaluation).some(
    (row) => row.evaluatorUserId === userId && isActiveAssignment(row) && row.assignmentId !== current.assignmentId,
  );
  const conflicted = assignmentsOf(evaluation).some((row) => row.evaluatorUserId === userId && row.conflictDeclaration?.hasConflict === true);
  const ineligibleReason = conflicted
    ? 'Declared a conflict on this evaluation.'
    : onCommittee
      ? 'Already assigned to this evaluation.'
      : userId === current.evaluatorUserId
        ? 'Current evaluator.'
        : null;
  return {
    ...member(userId, evaluation.tenantId),
    eligible: ineligibleReason === null,
    ineligibleReason,
    conflicted,
    openAssignments: EVALUATION_ASSIGNMENTS.filter(
      (row) => row.evaluatorUserId === userId && row.tenantId === evaluation.tenantId && !isSubmitted(row) && isActiveAssignment(row),
    ).length,
  };
}

export function register(app: MockApp): void {
  // ── Overview ──────────────────────────────────────────────────────────────────────────────────────────
  mockRoute(app, listEvaluations, ({ requirePersona, requireTenant, query, now, fixtures }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const rows = tenantEvaluations(caller)
      .filter((evaluation) => roleIn(caller, evaluation) !== null)
      .map((evaluation) => summaryRow(evaluation, caller, now))
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.lot?.title))
      .filter((row) => query.stage === undefined || query.stage.includes(row.stage))
      .filter((row) => query.myRole === undefined || query.myRole.includes(row.myRole))
      .filter((row) => query.overdue === undefined || (row.progress.overdue > 0) === query.overdue);
    const sortKey = query.sort ?? 'reference';
    const factor = direction(query.dir);
    rows.sort((a, b) => {
      if (sortKey === 'nextDueAt') {
        return factor * (a.nextDueAt?.at ?? '9999').localeCompare(b.nextDueAt?.at ?? '9999');
      }
      if (sortKey === 'stage') {
        return factor * (STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
      }
      return factor * `${a.tender.reference}/${a.lot?.lotNumber ?? 0}`.localeCompare(`${b.tender.reference}/${b.lot?.lotNumber ?? 0}`);
    });
    return fixtures.page(rows);
  });

  mockRoute(app, getEvaluation, ({ requirePersona, requireTenant, params, query, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, query.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    if (evaluation === null || roleIn(caller, evaluation) === null) {
      return notFound('Evaluation not found.');
    }
    return overviewView(evaluation, caller, now);
  });

  // ── Assignments (EVA-01) ─────────────────────────────────────────────────────────────────────────────
  mockRoute(app, listAssignments, ({ requirePersona, requireTenant, query, now, fixtures }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const scope = query.scope === 'all' && isChair(caller) ? 'all' : 'mine';
    const rows: AssignmentRow[] = EVALUATION_ASSIGNMENTS.filter((row) => row.tenantId === caller.tenantId)
      .filter((row) => scope === 'all' || row.evaluatorUserId === caller.userId)
      .map((row) => assignmentRow(row, now))
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.lot?.title, row.evaluator.fullName))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.tenderId === undefined || row.tender.tenderId === query.tenderId)
      .filter((row) => query.evaluatorUserId === undefined || row.evaluator.userId === query.evaluatorUserId)
      .filter((row) => query.isCommercial === undefined || row.isCommercial === query.isCommercial)
      .filter((row) => query.overdue === undefined || row.isOverdue === query.overdue)
      .filter((row) => query.dueFrom === undefined || dateIn(row.dueAt.at, row.dueAt.timeZone) >= query.dueFrom)
      .filter((row) => query.dueTo === undefined || dateIn(row.dueAt.at, row.dueAt.timeZone) <= query.dueTo);
    const sortKey = query.sort ?? 'dueAt';
    const factor = direction(query.dir);
    rows.sort((a, b) => {
      const key = (row: AssignmentRow): string =>
        sortKey === 'reference'
          ? `${row.tender.reference}/${row.lot?.lotNumber ?? 0}`
          : sortKey === 'status'
            ? row.status
            : sortKey === 'evaluator'
              ? row.evaluator.fullName
              : row.dueAt.at;
      return factor * key(a).localeCompare(key(b)) || a.assignmentId - b.assignmentId;
    });
    const summary = {
      total: rows.length,
      notStarted: rows.filter((row) => row.status === 'not_started').length,
      inProgress: rows.filter((row) => row.status === 'in_progress').length,
      submitted: rows.filter((row) => row.status === 'submitted' || row.status === 'finalized').length,
      returned: rows.filter((row) => row.status === 'returned').length,
      overdue: rows.filter((row) => row.isOverdue).length,
      declarationsPending: rows.filter((row) => row.nextAction === 'accept' || row.nextAction === 'await_conflict_review').length,
    };
    return { ...fixtures.page(rows), summary };
  });

  mockRoute(app, getAssignment, ({ requirePersona, requireTenant, params, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = visibleAssignment(caller, params.assignmentId);
    if (assignment === null) {
      return fail(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
    }
    return assignmentDetail(assignment, caller, now);
  });

  mockRoute(app, acceptAssignment, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = visibleAssignment(caller, params.assignmentId);
    if (assignment === null) {
      return fail(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
    }
    if (assignment.evaluatorUserId !== caller.userId) {
      return fail(403, 'NOT_ASSIGNED_EVALUATOR', 'Only the assigned evaluator can accept.');
    }
    if (assignment.status === 'recused' || assignment.status === 'reassigned' || assignment.status === 'finalized') {
      return fail(409, 'ASSIGNMENT_CLOSED', `The assignment is ${assignment.status}.`);
    }
    if (assignment.acceptedAt !== null) {
      return fail(409, 'ASSIGNMENT_ALREADY_ACCEPTED', 'You already accepted this assignment.');
    }
    if (body.undertakingTextVersion !== KWU_UNDERTAKING.textVersion) {
      return fail(409, 'UNDERTAKING_VERSION_OUTDATED', `Accept the current undertaking (${KWU_UNDERTAKING.textVersion}).`);
    }
    const at = now.toISOString();
    const declaration = body.conflictDeclaration;
    const accepted: FixtureAssignment = {
      ...assignment,
      acceptedAt: at,
      undertaking: { undertakingId: NEW_IDS.undertaking, textVersion: body.undertakingTextVersion, acceptedAt: at },
      conflictDeclaration: {
        declarationId: NEW_IDS.declaration,
        hasConflict: declaration.hasConflict,
        nature: declaration.hasConflict ? (declaration.nature ?? 'other') : null,
        supplierTenantId: declaration.supplierTenantId ?? null,
        details: declaration.hasConflict ? (declaration.details ?? null) : null,
        declaredAt: at,
        disposition: declaration.hasConflict ? 'pending_review' : 'cleared',
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
      history: [
        ...assignment.history,
        {
          at,
          event: declaration.hasConflict ? 'Accepted with undertaking; conflict declared' : 'Accepted with undertaking; no conflict declared',
          actorUserId: caller.userId,
          note: null,
        },
      ],
    };
    return assignmentDetail(accepted, caller, now);
  });

  mockRoute(app, declareConflict, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = ownAssignmentFor(caller, params.assignmentId, fail, notFound);
    if (assignment.status === 'recused' || assignment.status === 'reassigned' || assignment.status === 'finalized') {
      return fail(409, 'ASSIGNMENT_CLOSED', `The assignment is ${assignment.status}.`);
    }
    if (assignment.acceptedAt === null) {
      return fail(409, 'ASSIGNMENT_NOT_ACCEPTED', 'Declare conflicts when you accept the assignment.');
    }
    if (assignment.conflictDeclaration?.hasConflict === true) {
      return fail(409, 'CONFLICT_ALREADY_DECLARED', 'A conflict is already declared for this assignment.');
    }
    const at = now.toISOString();
    const updated: FixtureAssignment = {
      ...assignment,
      conflictDeclaration: {
        declarationId: NEW_IDS.declaration,
        hasConflict: true,
        nature: body.nature,
        supplierTenantId: body.supplierTenantId ?? null,
        details: body.details,
        declaredAt: at,
        disposition: 'pending_review',
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
      history: [...assignment.history, { at, event: 'Conflict declared; access suspended pending review', actorUserId: caller.userId, note: null }],
    };
    return assignmentDetail(updated, caller, now);
  });

  mockRoute(app, requestReassignment, ({ requirePersona, requireTenant, params, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = ownAssignmentFor(caller, params.assignmentId, fail, notFound);
    if (assignment.status === 'recused' || assignment.status === 'reassigned' || assignment.status === 'finalized') {
      return fail(409, 'ASSIGNMENT_CLOSED', `The assignment is ${assignment.status}.`);
    }
    if (assignment.reassignmentRequestedAt !== null) {
      return fail(409, 'REASSIGNMENT_ALREADY_REQUESTED', 'A reassignment request is already with the chair.');
    }
    return {
      assignmentId: assignment.assignmentId,
      status: assignment.status,
      requestedAt: now.toISOString(),
      routedTo: person(evaluationOf(assignment).chairUserId),
      taskId: NEW_IDS.task,
    };
  });

  mockRoute(app, getReassignmentCandidates, ({ requirePersona, requireTenant, params, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = visibleAssignment(caller, params.assignmentId);
    if (assignment === null) {
      return fail(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
    }
    const evaluation = evaluationOf(assignment);
    const items = evaluatorPool(caller.tenantId)
      .filter((userId) => userId !== assignment.evaluatorUserId)
      .map((userId) => {
        const { conflicted: _conflicted, ...candidate } = candidateFor(evaluation, assignment, userId);
        return candidate;
      })
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.fullName.localeCompare(b.fullName));
    return { assignmentId: assignment.assignmentId, items };
  });

  mockRoute(app, reassignAssignment, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = visibleAssignment(caller, params.assignmentId);
    if (assignment === null) {
      return fail(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
    }
    if (assignment.status === 'recused' || assignment.status === 'reassigned' || assignment.status === 'finalized') {
      return fail(409, 'ASSIGNMENT_CLOSED', `The assignment is ${assignment.status}.`);
    }
    const evaluation = evaluationOf(assignment);
    if (!evaluatorPool(caller.tenantId).includes(body.newEvaluatorUserId) || body.newEvaluatorUserId === assignment.evaluatorUserId) {
      return fail(409, 'EVALUATOR_NOT_ELIGIBLE', 'The person cannot evaluate in this organization.');
    }
    const candidate = candidateFor(evaluation, assignment, body.newEvaluatorUserId);
    if (candidate.conflicted) {
      return fail(409, 'EVALUATOR_CONFLICTED', 'The person declared a conflict on this evaluation.');
    }
    if (!candidate.eligible) {
      return fail(409, 'EVALUATOR_NOT_ELIGIBLE', candidate.ineligibleReason ?? 'Not eligible.');
    }
    const at = now.toISOString();
    const original: FixtureAssignment = {
      ...assignment,
      status: body.outcome,
      reassignedToAssignmentId: NEW_IDS.assignment,
      reassignmentReason: body.reason,
    };
    const replacement: FixtureAssignment = {
      ...assignment,
      assignmentId: NEW_IDS.assignment,
      evaluatorUserId: body.newEvaluatorUserId,
      status: 'not_started',
      createdAt: at,
      acceptedAt: null,
      submittedAt: null,
      undertaking: null,
      conflictDeclaration: null,
      reassignedToAssignmentId: null,
      reassignmentReason: null,
      reassignmentRequestedAt: null,
      returnReason: null,
      history: [{ at, event: 'Assigned (replacement)', actorUserId: caller.userId, note: body.reason }],
    };
    return { original: assignmentRow(original, now), replacement: assignmentRow(replacement, now) };
  });

  mockRoute(app, reviewConflict, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = EVALUATION_ASSIGNMENTS.find(
      (row) => row.tenantId === caller.tenantId && row.conflictDeclaration?.declarationId === params.declarationId,
    );
    const declaration = assignment?.conflictDeclaration ?? null;
    if (assignment === undefined || declaration === null) {
      return fail(404, 'DECLARATION_NOT_FOUND', 'Declaration not found.');
    }
    if (!declaration.hasConflict) {
      return fail(409, 'DECLARATION_HAS_NO_CONFLICT', 'The declaration states no conflict; there is nothing to review.');
    }
    if (declaration.disposition !== 'pending_review') {
      return fail(409, 'DECLARATION_ALREADY_REVIEWED', `Already reviewed: ${declaration.disposition}.`);
    }
    return declarationView(
      { ...declaration, disposition: body.disposition, reviewedByUserId: caller.userId, reviewedAt: now.toISOString(), reviewNote: body.reviewNote },
      evaluationOf(assignment),
    );
  });

  // ── Individual assessment (EVA-02) ───────────────────────────────────────────────────────────────────
  mockRoute(app, getAssessment, ({ requirePersona, requireTenant, params, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = visibleAssignment(caller, params.assignmentId);
    if (assignment === null) {
      return fail(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
    }
    if (assignment.isCommercial) {
      return fail(409, 'COMMERCIAL_ASSIGNMENT', 'Commercial assignments are worked in the commercial comparison.');
    }
    const blocked = contentBlock(assignment);
    if (blocked !== null && assignment.evaluatorUserId === caller.userId) {
      return fail(409, 'ASSESSMENT_CONTENT_BLOCKED', blockedDetail(blocked));
    }
    return assessmentView(assignment, caller);
  });

  mockRoute(app, saveScores, ({ requirePersona, requireTenant, params, body, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = ownAssignmentFor(caller, params.assignmentId, fail, notFound);
    const blocked = contentBlock(assignment);
    if (blocked !== null) {
      return fail(409, 'ASSESSMENT_CONTENT_BLOCKED', blockedDetail(blocked));
    }
    if (assignment.status !== 'not_started' && assignment.status !== 'in_progress') {
      return fail(409, 'ASSESSMENT_SUBMITTED', 'The assessment is a formal record: change a score through a correction with a reason.');
    }
    const overrides = toOverrides(body.scores);
    checkCells(assignment, overrides, fail);
    return assessmentView(assignment, caller, assessmentCells(assignment, overrides), { status: 'in_progress', submittedAt: null });
  });

  mockRoute(app, submitAssessment, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = ownAssignmentFor(caller, params.assignmentId, fail, notFound);
    const blocked = contentBlock(assignment);
    if (blocked !== null) {
      return fail(409, 'ASSESSMENT_CONTENT_BLOCKED', blockedDetail(blocked));
    }
    if (assignment.status !== 'not_started' && assignment.status !== 'in_progress') {
      return fail(409, 'ASSESSMENT_SUBMITTED', 'The assessment was already submitted.');
    }
    const overrides = toOverrides(body.scores);
    checkCells(assignment, overrides, fail);
    const cells = assessmentCells(assignment, overrides);
    const missing = cells.filter((cell) => !isScored(cell));
    if (missing.length > 0) {
      const evaluation = evaluationOf(assignment);
      const list = missing
        .map((cell) => `${criterion(evaluation, cell.criterionId)?.name ?? cell.criterionId} for ${evaluation.bids.find((bid) => bid.bidId === cell.bidId)?.label ?? cell.bidId}`)
        .join('; ');
      return fail(409, 'ASSESSMENT_INCOMPLETE', `${missing.length} cell(s) not scored: ${list}. A missing score is never counted as zero.`);
    }
    const withoutRationale = cells.filter((cell) => cell.score !== null && (cell.rationale === null || cell.rationale.length === 0));
    if (withoutRationale.length > 0) {
      return fail(409, 'RATIONALE_REQUIRED', `${withoutRationale.length} scored cell(s) have no rationale.`);
    }
    const at = now.toISOString();
    const submitted = cells.map((cell) => ({ ...cell, status: 'submitted' as const, submittedAt: at }));
    return assessmentView(assignment, caller, submitted, { status: 'submitted', submittedAt: at });
  });

  mockRoute(app, correctScore, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = ownAssignmentFor(caller, params.assignmentId, fail, notFound);
    const evaluation = evaluationOf(assignment);
    const score = scoresOf(assignment.assignmentId).find((row) => row.scoreId === params.scoreId);
    if (score === undefined) {
      return fail(404, 'SCORE_NOT_FOUND', 'Score not found.');
    }
    if (score.status !== 'submitted') {
      return fail(409, 'SCORE_NOT_SUBMITTED', 'A draft score is changed by saving the assessment, not by a correction.');
    }
    if (evaluation.moderation?.status === 'finalized') {
      return fail(
        409,
        'MODERATION_FINALIZED',
        'Moderation is finalized: the agreed scores are part of the evaluation record, so submitted scores can no longer be corrected.',
      );
    }
    if (body.newScore !== null && !withinScale(evaluation, body.newScore)) {
      return fail(422, 'SCORE_OUT_OF_SCALE', `Ratings run from 0 to ${evaluation.plan.scaleMax}.`);
    }
    const sameScore = body.newScore === null ? score.score === null : score.score !== null && compare(body.newScore, score.score) === 0;
    if (sameScore && body.newRationale === score.rationale) {
      return fail(409, 'SCORE_UNCHANGED', 'The correction does not change the score or the rationale.');
    }
    const cell = assessmentCells(assignment).find((row) => row.scoreId === score.scoreId);
    if (cell === undefined) {
      return fail(404, 'SCORE_NOT_FOUND', 'Score not found.');
    }
    return {
      ...cell,
      score: body.newScore,
      weightedPoints: body.newScore === null ? null : weightedPoints(evaluation, score.criterionId, body.newScore),
      rationale: body.newRationale,
      version: score.version + 1,
      corrections: [
        ...cell.corrections,
        {
          correctionId: NEW_IDS.correction,
          previousScore: score.score,
          newScore: body.newScore,
          previousRationale: score.rationale,
          reason: body.reason,
          correctedBy: person(caller.userId),
          correctedAt: now.toISOString(),
          returnedByChair: assignment.status === 'returned',
        },
      ],
    };
  });

  // ── Commercial comparison and price gate (EVA-04) ────────────────────────────────────────────────────
  mockRoute(app, getCommercialComparison, ({ requirePersona, requireTenant, params, query, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, query.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    if (evaluation === null || !canSeeCommercial(caller, evaluation)) {
      return notFound('Commercial comparison not found.');
    }
    return commercialView(evaluation);
  });

  mockRoute(app, proposeCorrection, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = findCommercialRow(caller, params.commercialEvaluationId);
    if (found === null) {
      return fail(404, 'COMMERCIAL_EVALUATION_NOT_FOUND', 'Commercial evaluation not found.');
    }
    const { evaluation, row } = found;
    if (!pricesVisible(evaluation)) {
      return fail(409, 'PRICE_GATE_NOT_RELEASED', 'Prices are sealed until the price gate is released.');
    }
    if (evaluation.commercial.status === 'approved') {
      return fail(409, 'COMMERCIAL_ALREADY_APPROVED', 'The comparison is approved.');
    }
    if (body.correctedTotal.currency !== row.submittedTotal.currency) {
      return fail(422, 'CURRENCY_MISMATCH', `Correct the total in the submitted currency (${row.submittedTotal.currency}).`);
    }
    if (row.correctionStatus === 'pending_approval') {
      return fail(409, 'CORRECTION_ALREADY_PENDING', 'A correction already awaits approval.');
    }
    const delta = sub(body.correctedTotal.amount, row.submittedTotal.amount);
    const converted = row.fx === null ? body.correctedTotal.amount : round(mul(body.correctedTotal.amount, row.fx.rate), 2);
    const updated: FixtureCommercialRow = {
      ...row,
      arithmeticCorrection: { amount: delta, currency: row.submittedTotal.currency },
      correctionRule: body.correctionRule,
      correctionStatus: 'pending_approval',
      correctionProposedByUserId: caller.userId,
      correctionProposedAt: now.toISOString(),
      correctionApprovedByUserId: null,
      supplierAckAt: null,
      evaluatedCost: { amount: converted, currency: evaluation.plan.comparisonCurrency },
      status: 'draft',
    };
    const rows = evaluation.commercial.rows.map((candidate) => (candidate.commercialEvaluationId === row.commercialEvaluationId ? updated : candidate));
    return commercialRowView(evaluation, updated, rows);
  });

  mockRoute(app, approveCorrection, ({ requirePersona, requireTenant, params, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = findCommercialRow(caller, params.commercialEvaluationId);
    if (found === null) {
      return fail(404, 'COMMERCIAL_EVALUATION_NOT_FOUND', 'Commercial evaluation not found.');
    }
    const { evaluation, row } = found;
    if (row.correctionStatus !== 'pending_approval') {
      return fail(409, 'NO_PENDING_CORRECTION', 'There is no correction awaiting approval for this offer.');
    }
    if (row.correctionProposedByUserId === caller.userId) {
      return fail(403, 'CORRECTION_SELF_APPROVAL', 'You proposed this correction: another commercial reviewer must approve it.');
    }
    return commercialRowView(evaluation, { ...row, correctionStatus: 'approved', correctionApprovedByUserId: caller.userId });
  });

  mockRoute(app, reviewAbnormallyLow, ({ requirePersona, requireTenant, params, body, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = findCommercialRow(caller, params.commercialEvaluationId);
    if (found === null) {
      return fail(404, 'COMMERCIAL_EVALUATION_NOT_FOUND', 'Commercial evaluation not found.');
    }
    const { evaluation, row } = found;
    if (!row.abnormallyLowFlag) {
      return fail(409, 'NOT_FLAGGED_ABNORMALLY_LOW', 'This offer is not flagged as abnormally low.');
    }
    if (evaluation.commercial.status === 'approved') {
      return fail(409, 'COMMERCIAL_ALREADY_APPROVED', 'The comparison is approved.');
    }
    return commercialRowView(evaluation, { ...row, abnormallyLowOutcome: body.outcome, abnormallyLowReview: body.review });
  });

  mockRoute(app, setReferenceSet, ({ requirePersona, requireTenant, params, body, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = findCommercialRow(caller, params.commercialEvaluationId);
    if (found === null) {
      return fail(404, 'COMMERCIAL_EVALUATION_NOT_FOUND', 'Commercial evaluation not found.');
    }
    const { evaluation, row } = found;
    if (evaluation.commercial.status === 'approved') {
      return fail(409, 'COMMERCIAL_ALREADY_APPROVED', 'The comparison is approved.');
    }
    const updated: FixtureCommercialRow = {
      ...row,
      inReferenceSet: body.inReferenceSet,
      referenceExclusionReason: body.inReferenceSet ? null : (body.reason ?? null),
    };
    const rows = evaluation.commercial.rows.map((candidate) => (candidate.commercialEvaluationId === row.commercialEvaluationId ? updated : candidate));
    return commercialRowView(evaluation, updated, rows);
  });

  mockRoute(app, approveComparison, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, body.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    if (evaluation === null || !canSeeCommercial(caller, evaluation)) {
      return notFound('Commercial comparison not found.');
    }
    if (!pricesVisible(evaluation)) {
      return fail(409, 'PRICE_GATE_NOT_RELEASED', 'Prices are sealed until the price gate is released.');
    }
    if (evaluation.commercial.status === 'approved') {
      return fail(409, 'COMMERCIAL_ALREADY_APPROVED', 'The comparison is already approved.');
    }
    if (evaluation.commercial.rows.some((row) => row.correctionStatus === 'pending_approval')) {
      return fail(409, 'CORRECTION_PENDING', 'Approve or withdraw every pending arithmetic correction first.');
    }
    if (evaluation.commercial.rows.some((row) => row.abnormallyLowFlag && (row.abnormallyLowOutcome === null || row.abnormallyLowOutcome === 'pending'))) {
      return fail(409, 'ABNORMALLY_LOW_REVIEW_PENDING', 'Record the documented review of every abnormally-low flag first.');
    }
    const view = commercialView(evaluation, evaluation.commercial.rows.map((row) => ({ ...row, status: 'approved' as const })));
    return { ...view, status: 'approved', approvedAt: now.toISOString(), approvedBy: person(caller.userId) };
  });

  mockRoute(app, runScenario, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, body.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    if (evaluation === null || !canSeeCommercial(caller, evaluation)) {
      return notFound('Commercial comparison not found.');
    }
    if (!pricesVisible(evaluation)) {
      return fail(409, 'PRICE_GATE_NOT_RELEASED', 'Prices are sealed until the price gate is released.');
    }
    const rows = evaluation.commercial.rows;
    for (const bidId of [...body.excludeBidIds, ...body.adjustments.map((row) => row.bidId)]) {
      if (!rows.some((row) => row.bidId === bidId)) {
        return fail(422, 'UNKNOWN_BID', `Bid ${bidId} is not in this comparison.`);
      }
    }
    for (const override of body.fxRateOverrides) {
      if (!rows.some((row) => row.fx?.fromCurrency === override.fromCurrency)) {
        return fail(422, 'UNKNOWN_CURRENCY', `No offer in this comparison is converted from ${override.fromCurrency}.`);
      }
    }
    const comparison = evaluation.plan.comparisonCurrency;
    const scenarioRows: FixtureCommercialRow[] = rows
      .filter((row) => !body.excludeBidIds.includes(row.bidId))
      .map((row) => {
        let cost = row.evaluatedCost.amount;
        const override = row.fx === null ? undefined : body.fxRateOverrides.find((candidate) => candidate.fromCurrency === row.fx?.fromCurrency);
        if (override !== undefined && row.fx !== null) {
          cost = round(mul(div(cost, row.fx.rate, 8), override.rate), 2);
        }
        for (const adjustment of body.adjustments.filter((candidate) => candidate.bidId === row.bidId)) {
          cost = round(add(cost, adjustment.amount.amount), 2);
        }
        return { ...row, evaluatedCost: { amount: lt(cost, '0') ? '0.00' : cost, currency: comparison } };
      });
    const official = rankResults(evaluation, computeResults(evaluation));
    const scenarioComputed = computeResults(evaluation, scenarioRows).filter((row) => !body.excludeBidIds.includes(row.bid.bidId));
    const scenarioRanks = rankResults(evaluation, scenarioComputed);
    const result: ScenarioRow[] = scenarioComputed
      .filter((row) => row.commercial !== undefined)
      .map((row) => ({
        bidId: row.bid.bidId,
        label: row.bid.label,
        evaluatedCost: row.commercial?.evaluatedCost ?? { amount: '0.00', currency: comparison },
        priceScore: row.price ?? '0',
        nonPriceScore: row.nonPrice,
        totalScore: row.total,
        rank: scenarioRanks.get(row.bid.bidId)?.rank ?? null,
        officialRank: official.get(row.bid.bidId)?.rank ?? null,
      }));
    return {
      label: body.label,
      official: false,
      generatedAt: now.toISOString(),
      basisNote: 'Private sensitivity scenario: computed on request and never stored; official scores and ranks are unchanged.',
      rows: result,
      excludedBidIds: body.excludeBidIds,
    };
  });

  mockRoute(app, releasePriceGate, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, body.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    if (evaluation === null) {
      return notFound('Evaluation not found.');
    }
    if (!evaluation.priceGate.applies) {
      return fail(409, 'PRICE_GATE_NOT_APPLICABLE', 'Single-stage opening: there is no price gate.');
    }
    if (evaluation.priceGate.releasedAt !== null) {
      return fail(409, 'PRICE_GATE_ALREADY_RELEASED', 'The price gate is already released.');
    }
    if (evaluation.moderation?.status !== 'finalized') {
      return fail(409, 'NON_PRICE_MODERATION_OPEN', 'Finalize the non-price moderation before releasing prices.');
    }
    return {
      ...priceGateView(evaluation),
      released: true,
      releasedAt: now.toISOString(),
      releasedBy: person(caller.userId),
      nonPriceCompleteConfirmed: true,
      note: body.note ?? null,
    };
  });

  // ── Moderation (EVA-05) ──────────────────────────────────────────────────────────────────────────────
  mockRoute(app, getModeration, ({ requirePersona, requireTenant, params, query, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, query.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    if (evaluation === null) {
      return notFound('Evaluation not found.');
    }
    const view = moderationView(evaluation);
    if (view === null) {
      return fail(404, 'MODERATION_NOT_FOUND', 'No moderation session has been opened for this evaluation.');
    }
    return view;
  });

  mockRoute(app, recordModeratedScore, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = evaluationBySession(caller, params.sessionId);
    const session = evaluation?.moderation ?? null;
    if (evaluation === null || session === null) {
      return fail(404, 'MODERATION_NOT_FOUND', 'Moderation session not found.');
    }
    if (session.status === 'finalized') {
      return fail(409, 'MODERATION_FINALIZED', 'The moderation is finalized; its history is preserved.');
    }
    if (body.method !== session.method) {
      return fail(409, 'METHOD_NOT_PERMITTED', `The approved method is ${session.method}.`);
    }
    const bid = evaluation.bids.find((row) => row.bidId === body.bidId && row.eligible);
    if (bid === undefined || !nonPriceCriterionIds(evaluation).includes(body.criterionId)) {
      return fail(422, 'CELL_NOT_IN_SCOPE', 'The bid or criterion is not moderated in this session.');
    }
    if (!withinScale(evaluation, body.finalScore)) {
      return fail(422, 'SCORE_OUT_OF_SCALE', `Ratings run from 0 to ${evaluation.plan.scaleMax}.`);
    }
    const cell = moderationCells(evaluation).find((row) => row.bidId === body.bidId && row.criterionId === body.criterionId);
    const submittedScores = (cell?.individual ?? []).filter((row) => row.status === 'submitted' && row.score !== null).map((row) => row.score as string);
    const recordedAt = now.toISOString();
    return {
      sessionId: session.sessionId,
      bidId: body.bidId,
      criterionId: body.criterionId,
      current: {
        moderatedScoreId: NEW_IDS.moderatedScore,
        finalScore: body.finalScore,
        weightedPoints: weightedPoints(evaluation, body.criterionId, body.finalScore),
        method: body.method,
        reasons: body.reasons,
        moderatedBy: person(caller.userId),
        recordedAt,
        supersededById: null,
        differsFromIndividual: submittedScores.some((score) => compare(score, body.finalScore) !== 0),
      },
      superseded: cell?.current === null || cell?.current === undefined ? null : { ...cell.current, supersededById: NEW_IDS.moderatedScore },
    };
  });

  mockRoute(app, updateModerationNotes, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = evaluationBySession(caller, params.sessionId);
    const session = evaluation?.moderation ?? null;
    if (evaluation === null || session === null) {
      return fail(404, 'MODERATION_NOT_FOUND', 'Moderation session not found.');
    }
    if (session.status === 'finalized') {
      return fail(409, 'MODERATION_FINALIZED', 'The moderation is finalized; its notes are part of the record.');
    }
    return { sessionId: session.sessionId, notes: body.notes, updatedAt: now.toISOString(), updatedBy: person(caller.userId) };
  });

  mockRoute(app, returnAssessment, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const assignment = visibleAssignment(caller, params.assignmentId);
    if (assignment === null || assignment.isCommercial) {
      return fail(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
    }
    if (assignment.status !== 'submitted') {
      return fail(409, 'ASSESSMENT_NOT_SUBMITTED', 'Only a submitted assessment can be returned for correction.');
    }
    if (evaluationOf(assignment).moderation?.status === 'finalized') {
      return fail(409, 'MODERATION_FINALIZED', 'The moderation is finalized.');
    }
    return { assignmentId: assignment.assignmentId, status: 'returned', returnedAt: now.toISOString(), returnedBy: person(caller.userId), reason: body.reason };
  });

  mockRoute(app, finalizeModeration, ({ requirePersona, requireTenant, params, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = evaluationBySession(caller, params.sessionId);
    const session = evaluation?.moderation ?? null;
    if (evaluation === null || session === null) {
      return fail(404, 'MODERATION_NOT_FOUND', 'Moderation session not found.');
    }
    if (session.status === 'finalized') {
      return fail(409, 'MODERATION_FINALIZED', 'The moderation is already finalized.');
    }
    const incomplete = assignmentsOf(evaluation).filter(
      (row) => !row.isCommercial && isActiveAssignment(row) && (!isSubmitted(row) || assessmentCells(row).some((cell) => !isScored(cell))),
    );
    if (session.method === 'average' && incomplete.length > 0) {
      return fail(
        409,
        'ASSESSMENTS_INCOMPLETE',
        `${incomplete.length} assessment(s) are not complete; the declared method averages every assessor and never counts a missing score as zero.`,
      );
    }
    const cells = moderationCells(evaluation);
    const missing = cells.filter((cell) => cell.current === null).length;
    if (missing > 0) {
      return fail(409, 'MODERATED_SCORE_MISSING', `${missing} cell(s) have no agreed score.`);
    }
    return { sessionId: session.sessionId, status: 'finalized', finalizedAt: now.toISOString(), finalizedBy: person(caller.userId), cellsModerated: cells.length };
  });

  // ── Ranking and report (EVA-06) ──────────────────────────────────────────────────────────────────────
  mockRoute(app, getResults, ({ requirePersona, requireTenant, params, query, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, query.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    const role = evaluation === null ? null : roleIn(caller, evaluation);
    if (evaluation === null || role === null) {
      return notFound('Evaluation not found.');
    }
    if (role === 'evaluator' && ownAssignments(caller, evaluation).some((row) => !row.isCommercial && !isSubmitted(row))) {
      return fail(409, 'OWN_ASSESSMENT_NOT_SUBMITTED', 'Committee results become visible once your own assessment is submitted.');
    }
    return rankingView(evaluation, evaluation.results.computedAt, resultDetailFor(evaluation, role, onTenderTeam(caller, evaluation)));
  });

  mockRoute(app, validateResults, ({ requirePersona, requireTenant, params, body, now, fail, notFound }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const evaluation = resolveEvaluation(caller, params.tenderId, body.lotId);
    if (evaluation === 'LOT_REQUIRED') {
      return fail(409, 'LOT_REQUIRED', 'This tender is evaluated per lot: choose a lot.');
    }
    if (evaluation === null) {
      return notFound('Evaluation not found.');
    }
    if (evaluation.results.status === 'signed_off') {
      return fail(409, 'RESULTS_SIGNED_OFF', 'Signed-off results are superseded by a new report version, not recomputed.');
    }
    const canCompute = evaluation.moderation?.status === 'finalized' && pricesVisible(evaluation);
    if (!canCompute) {
      return rankingView(evaluation, null);
    }
    const view = rankingView({ ...evaluation, results: { ...evaluation.results, status: 'draft' } }, now.toISOString());
    return view;
  });

  mockRoute(app, submitReport, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = evaluationByReport(caller, params.reportId);
    if (found === null) {
      return fail(404, 'REPORT_NOT_FOUND', 'Report not found.');
    }
    const { evaluation, report } = found;
    if (report.status !== 'draft') {
      return fail(409, 'REPORT_NOT_DRAFT', `The report is ${report.status}.`);
    }
    const blocking = rankingReadiness(evaluation, resultRows(evaluation)).filter((item) => item.status === 'blocking');
    if (blocking.length > 0) {
      return fail(409, 'REPORT_NOT_READY', blocking.map((item) => item.label).join('; '));
    }
    return reportView(evaluation, { ...report, status: 'in_signoff', summary: body.summary, submittedForSignoffAt: now.toISOString() });
  });

  mockRoute(app, signoffReport, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = evaluationByReport(caller, params.reportId);
    if (found === null) {
      return fail(404, 'REPORT_NOT_FOUND', 'Report not found.');
    }
    const { evaluation, report } = found;
    if (report.status !== 'in_signoff') {
      return fail(409, 'REPORT_NOT_IN_SIGNOFF', `The report is ${report.status}.`);
    }
    const line = report.signoffs.find((row) => row.userId === caller.userId);
    if (line === undefined) {
      return fail(403, 'NOT_COMMITTEE_MEMBER', 'Only listed committee members sign this report.');
    }
    if (line.decision !== null) {
      return fail(409, 'SIGNOFF_ALREADY_DECIDED', `You already ${line.decision} this report.`);
    }
    const at = now.toISOString();
    const signoffs = report.signoffs.map((row) =>
      row.userId === caller.userId ? { ...row, signoffId: NEW_IDS.signoff, decision: body.decision, note: body.note ?? null, decidedAt: at } : row,
    );
    const allSigned = signoffs.every((row) => row.decision === 'signed');
    return reportView(evaluation, { ...report, signoffs, status: allSigned ? 'signed_off' : report.status, signedOffAt: allSigned ? at : null });
  });

  mockRoute(app, exportReport, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = evaluationByReport(caller, params.reportId);
    if (found === null) {
      return fail(404, 'REPORT_NOT_FOUND', 'Report not found.');
    }
    const { evaluation, report } = found;
    return {
      exportId: NEW_IDS.export,
      reportId: report.reportId,
      exportType: 'evaluation_report',
      format: body.format,
      status: 'queued',
      requestedAt: now.toISOString(),
      requestedBy: person(caller.userId),
      scopeDescription: `Evaluation report v${report.version}, ${evaluation.tender.reference}${evaluation.lot === null ? '' : ` Lot ${evaluation.lot.lotNumber}`}`,
    };
  });

  mockRoute(app, handoffReport, ({ requirePersona, requireTenant, params, now, fail }) => {
    const caller = callerOf(requirePersona().userId, requireTenant());
    const found = evaluationByReport(caller, params.reportId);
    if (found === null) {
      return fail(404, 'REPORT_NOT_FOUND', 'Report not found.');
    }
    const { evaluation, report } = found;
    if (report.handedOffAt !== null) {
      return fail(409, 'REPORT_ALREADY_HANDED_OFF', 'The report was already passed to the award recommendation.');
    }
    if (report.status !== 'signed_off') {
      return fail(409, 'REPORT_NOT_SIGNED_OFF', 'Every committee member must sign the report first.');
    }
    return {
      reportId: report.reportId,
      tenderId: evaluation.tender.tenderId,
      lotId: evaluation.lot?.lotId ?? null,
      handedOffAt: now.toISOString(),
      handedOffBy: person(caller.userId),
      recommendedBidId: report.recommendedBidId,
      basis: `Signed-off evaluation report v${report.version}: rank is decision support; award requires its own approval.`,
    };
  });
}
