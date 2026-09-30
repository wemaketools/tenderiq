/**
 * View builders of the evaluation mock handlers: they assemble contract responses from the static fixtures. All
 * arithmetic uses the decimal helper (DD-32) at the plan's precision: weighted points = rating ÷ scaleMax × maxPoints,
 * price points by the plan's price method over the reference set, totals at `decimalPlacesCalc` and displayed at
 * `decimalPlacesDisplay` (PRD §9.2, §9.3). Missing work is never zero-filled (AC-18).
 */
import type { Money, PersonRef } from '../../../contracts/common.js';
import { add, compare, div, gte, lt, mul, round, sub, sum } from '../../../contracts/decimal.js';
import type {
  Assessment,
  AssignmentDetail,
  AssignmentRow,
  CommercialComparison,
  CommercialRow,
  CommitteeMemberRef,
  ConflictDeclaration,
  CriterionPoints,
  EvaluationBidRef,
  EvaluationNextAction,
  EvaluationOverview,
  EvaluationReport,
  EvaluationRole,
  EvaluationStage,
  EvaluationSummaryRow,
  ModeratedScore,
  ModerationCell,
  ModerationView,
  OverviewDetailLevel,
  PriceGate,
  RankingView,
  ReadinessItem,
  ResultDetailLevel,
  ResultRow,
  ScoreCell,
} from '../../../contracts/evaluation.js';
import { EVALUATION_SCORES, KWU_UNDERTAKING } from '../../fixtures/evaluation.js';
import type {
  FixtureAssignment,
  FixtureBid,
  FixtureCommercialRow,
  FixtureEvaluation,
  FixtureModeratedScore,
  FixtureModerationSession,
  FixtureReport,
  FixtureScore,
  FixtureTimelineEvent,
} from '../../fixtures/evaluation.js';
import { findPersonaById, personRef } from '../../persona.js';
import type { Caller } from './access.js';
import { assignmentsOf, evaluationOf, isActiveAssignment, isChair, isSignedOffReport, ownAssignments, roleIn } from './access.js';

// ---------------------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------------------

export function person(userId: number): PersonRef {
  return personRef(userId);
}

/** A person with the capacity of their membership in the tenant. */
export function member(userId: number, tenantId: number): CommitteeMemberRef {
  const persona = findPersonaById(userId);
  const membership = persona?.memberships.find((row) => row.tenantId === tenantId);
  return { ...personRef(userId), capacity: membership?.capacity ?? null };
}

// ---------------------------------------------------------------------------------------------------------
// Display text of readiness items (no raw codes, instants or unformatted amounts reach the screen)
// ---------------------------------------------------------------------------------------------------------

/** `BWP 120,000.00`: the amount grouped by thousands from its decimal string (never through a float, DD-32). */
export function moneyText(money: Money): string {
  const negative = money.amount.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? money.amount.slice(1) : money.amount).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${money.currency} ${negative ? '-' : ''}${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

/** `23 Sep 2026, 17:00 (UTC+02:00) Africa/Gaborone`: an instant in the official zone (DD-33). */
export function instantText(at: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((row) => row.type === type)?.value ?? '';
  const offset = part('timeZoneName').replace('GMT', 'UTC');
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} (${offset === 'UTC' ? 'UTC+00:00' : offset}) ${timeZone}`;
}

/** Plain-language reason of a gate failure code of `evaluation_results` (see GATE_FAILURE_CODES). */
export function gateFailureText(evaluation: FixtureEvaluation, code: string): string {
  const [base, detail] = code.split(':');
  switch (base) {
    case 'MANDATORY_REQUIREMENT_FAILED':
      return 'failed a mandatory requirement';
    case 'NON_PRICE_THRESHOLD':
      return 'below the non-price threshold';
    case 'DUE_DILIGENCE_FAILED':
      return 'failed due diligence';
    case 'CRITERION_MINIMUM': {
      const row = evaluation.plan.criteria.find((candidate) => candidate.code === detail);
      return `below the minimum rating on ${row?.name ?? 'a criterion'}`;
    }
    default:
      return 'did not pass an eligibility gate';
  }
}

// ---------------------------------------------------------------------------------------------------------
// Plan helpers
// ---------------------------------------------------------------------------------------------------------

export function nonPriceCriterionIds(evaluation: FixtureEvaluation): number[] {
  return evaluation.plan.criteria.filter((row) => !row.isPrice).map((row) => row.criterionId);
}

export function criterion(evaluation: FixtureEvaluation, criterionId: number) {
  return evaluation.plan.criteria.find((row) => row.criterionId === criterionId);
}

/** rating ÷ scaleMax × maxPoints at calculation precision. */
export function weightedPoints(evaluation: FixtureEvaluation, criterionId: number, rating: string): string {
  const row = criterion(evaluation, criterionId);
  if (row === undefined) {
    throw new Error(`Unknown criterion ${criterionId} in ${evaluation.key}.`);
  }
  return div(mul(rating, row.maxPoints), String(evaluation.plan.scaleMax), evaluation.plan.decimalPlacesCalc);
}

export function withinScale(evaluation: FixtureEvaluation, rating: string): boolean {
  return gte(rating, '0') && compare(rating, String(evaluation.plan.scaleMax)) <= 0;
}

export function bidRef(bid: FixtureBid): EvaluationBidRef {
  return {
    bidId: bid.bidId,
    supplierTenantId: bid.supplierTenantId,
    supplierName: bid.supplierName,
    label: bid.label,
    receiptNo: bid.receiptNo,
    receivedAt: bid.receivedAt,
    revisionId: bid.revisionId,
    complianceStatus: bid.complianceStatus,
    evaluationStatus: bid.evaluationStatus,
  };
}

export function bidById(evaluation: FixtureEvaluation, bidId: number): FixtureBid | undefined {
  return evaluation.bids.find((row) => row.bidId === bidId);
}

function bidLabel(evaluation: FixtureEvaluation, bidId: number): string {
  const bid = bidById(evaluation, bidId);
  return bid === undefined ? `Bid ${bidId}` : `${bid.label}${bid.supplierName === null ? '' : ` (${bid.supplierName})`}`;
}

function criterionName(evaluation: FixtureEvaluation, criterionId: number): string {
  return criterion(evaluation, criterionId)?.name ?? `Criterion ${criterionId}`;
}

// ---------------------------------------------------------------------------------------------------------
// Assignment scope, scores and completion
// ---------------------------------------------------------------------------------------------------------

/** Cells (bid × criterion) an assignment must score: eligible bids in scope × non-price criteria in scope. */
export function scopeCells(assignment: FixtureAssignment): { bidIds: number[]; criterionIds: number[] } {
  const evaluation = evaluationFor(assignment);
  const bidIds = evaluation.bids
    .filter((bid) => bid.eligible && (assignment.bidId === null || assignment.bidId === bid.bidId))
    .map((bid) => bid.bidId);
  const criterionIds = assignment.isCommercial
    ? evaluation.plan.criteria.filter((row) => row.isPrice).map((row) => row.criterionId)
    : assignment.criterionIds.length === 0
      ? nonPriceCriterionIds(evaluation)
      : [...assignment.criterionIds];
  return { bidIds, criterionIds };
}

function evaluationFor(assignment: FixtureAssignment): FixtureEvaluation {
  return evaluationOf(assignment);
}

export function scoresOf(assignmentId: number): FixtureScore[] {
  return EVALUATION_SCORES.filter((row) => row.assignmentId === assignmentId);
}

export function isScored(cell: { score: string | null; isNotApplicable: boolean }): boolean {
  return cell.score !== null || cell.isNotApplicable;
}

function completionOf(assignment: FixtureAssignment, evaluation: FixtureEvaluation) {
  const { bidIds, criterionIds } = scopeCells(assignment);
  const total = bidIds.length * criterionIds.length;
  if (assignment.isCommercial) {
    const approved = evaluation.commercial.rows.filter((row) => row.status === 'approved' && bidIds.includes(row.bidId)).length;
    return { scored: approved, total, notScored: total - approved, complete: total > 0 && approved === total };
  }
  const saved = scoresOf(assignment.assignmentId);
  let scored = 0;
  for (const bidId of bidIds) {
    for (const criterionId of criterionIds) {
      const cell = saved.find((row) => row.bidId === bidId && row.criterionId === criterionId);
      if (cell !== undefined && isScored(cell)) {
        scored += 1;
      }
    }
  }
  return { scored, total, notScored: total - scored, complete: total > 0 && scored === total };
}

const OPEN_STATUSES = new Set(['not_started', 'in_progress', 'returned']);

export function isOverdue(assignment: FixtureAssignment, now: Date): boolean {
  return OPEN_STATUSES.has(assignment.status) && Date.parse(assignment.dueAt) < now.getTime();
}

export function isSubmitted(assignment: FixtureAssignment): boolean {
  return assignment.status === 'submitted' || assignment.status === 'finalized';
}

function conflictBlocks(assignment: FixtureAssignment): boolean {
  const declaration = assignment.conflictDeclaration;
  return declaration !== null && declaration.hasConflict && declaration.disposition === 'pending_review';
}

/** Why restricted content is withheld, or `null` when access is allowed (BR-08, DD-25). */
export function contentBlock(assignment: FixtureAssignment): AssignmentDetail['contentAccess']['blockedReason'] {
  if (assignment.status === 'recused' || assignment.conflictDeclaration?.disposition === 'recused') {
    return 'recused';
  }
  if (assignment.status === 'reassigned' || assignment.conflictDeclaration?.disposition === 'reassigned') {
    return 'reassigned';
  }
  if (assignment.acceptedAt === null) {
    return 'not_accepted';
  }
  if (assignment.undertaking === null) {
    return 'undertaking_missing';
  }
  if (conflictBlocks(assignment)) {
    return 'conflict_pending_review';
  }
  return null;
}

function nextActionOf(assignment: FixtureAssignment, complete: boolean): AssignmentRow['nextAction'] {
  if (assignment.status === 'recused' || assignment.status === 'reassigned' || assignment.status === 'finalized') {
    return 'none';
  }
  if (assignment.acceptedAt === null) {
    return 'accept';
  }
  if (conflictBlocks(assignment)) {
    return 'await_conflict_review';
  }
  if (assignment.isCommercial) {
    return assignment.status === 'submitted' ? 'none' : 'commercial_comparison';
  }
  if (assignment.status === 'returned') {
    return 'correct';
  }
  if (assignment.status === 'submitted') {
    return 'none';
  }
  return complete ? 'submit' : 'score';
}

export function declarationView(
  declaration: NonNullable<FixtureAssignment['conflictDeclaration']>,
  evaluation: FixtureEvaluation,
): ConflictDeclaration {
  const supplier = declaration.supplierTenantId === null ? undefined : bidSupplierName(evaluation, declaration.supplierTenantId);
  return {
    declarationId: declaration.declarationId,
    subjectType: evaluation.lot === null ? 'tender' : 'lot',
    subjectId: evaluation.lot === null ? evaluation.tender.tenderId : evaluation.lot.lotId,
    hasConflict: declaration.hasConflict,
    nature: declaration.nature,
    supplierTenantId: declaration.supplierTenantId,
    supplierName: supplier ?? null,
    details: declaration.details,
    declaredAt: declaration.declaredAt,
    disposition: declaration.disposition,
    reviewedBy: declaration.reviewedByUserId === null ? null : person(declaration.reviewedByUserId),
    reviewedAt: declaration.reviewedAt,
    reviewNote: declaration.reviewNote,
  };
}

function bidSupplierName(evaluation: FixtureEvaluation, supplierTenantId: number): string | undefined {
  return evaluation.bids.find((bid) => bid.supplierTenantId === supplierTenantId)?.supplierName ?? undefined;
}

export function assignmentRow(assignment: FixtureAssignment, now: Date): AssignmentRow {
  const evaluation = evaluationFor(assignment);
  const completion = completionOf(assignment, evaluation);
  const { bidIds, criterionIds } = scopeCells(assignment);
  const declaration = assignment.conflictDeclaration;
  return {
    assignmentId: assignment.assignmentId,
    tender: evaluation.tender,
    lot: evaluation.lot,
    evaluator: member(assignment.evaluatorUserId, assignment.tenantId),
    bidId: assignment.bidId,
    bidCount: bidIds.length,
    criterionIds: [...assignment.criterionIds],
    criterionCount: criterionIds.length,
    isCommercial: assignment.isCommercial,
    dueAt: { at: assignment.dueAt, timeZone: evaluation.tender.officialTimeZone },
    isOverdue: isOverdue(assignment, now),
    status: assignment.status,
    acceptedAt: assignment.acceptedAt,
    submittedAt: assignment.submittedAt,
    declarations: {
      undertakingAccepted: assignment.undertaking !== null,
      conflictDeclared: declaration !== null,
      hasConflict: declaration?.hasConflict ?? null,
      conflictDisposition: declaration?.hasConflict === true ? declaration.disposition : null,
    },
    completion,
    nextAction: nextActionOf(assignment, completion.complete),
  };
}

export function assignmentDetail(assignment: FixtureAssignment, caller: Caller, now: Date): AssignmentDetail {
  const evaluation = evaluationFor(assignment);
  const row = assignmentRow(assignment, now);
  const blockedReason = contentBlock(assignment);
  const allowed = blockedReason === null;
  const { bidIds, criterionIds } = scopeCells(assignment);
  const replacement =
    assignment.reassignedToAssignmentId === null
      ? undefined
      : assignmentsOf(evaluation).find((other) => other.assignmentId === assignment.reassignedToAssignmentId);
  return {
    ...row,
    undertakingText: KWU_UNDERTAKING,
    confidentialityUndertaking: assignment.undertaking,
    conflictDeclaration: assignment.conflictDeclaration === null ? null : declarationView(assignment.conflictDeclaration, evaluation),
    contentAccess: { allowed, blockedReason },
    bids: allowed ? evaluation.bids.filter((bid) => bidIds.includes(bid.bidId)).map(bidRef) : [],
    criteria: evaluation.plan.criteria.filter((row2) => criterionIds.includes(row2.criterionId)),
    chair: person(evaluation.chairUserId),
    reassignedTo: replacement === undefined ? null : person(replacement.evaluatorUserId),
    reassignmentReason: assignment.reassignmentReason,
    returnReason: assignment.returnReason,
    reassignmentRequestedAt: assignment.reassignmentRequestedAt,
    history: assignment.history.map((entry) => ({
      at: entry.at,
      event: entry.event,
      actor: entry.actorUserId === null ? null : person(entry.actorUserId),
      note: entry.note,
    })),
    isOwn: assignment.evaluatorUserId === caller.userId,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Individual assessment (EVA-02)
// ---------------------------------------------------------------------------------------------------------

export interface CellOverride {
  readonly bidId: number;
  readonly criterionId: number;
  readonly score: string | null;
  readonly isNotApplicable: boolean;
  readonly rationale: string | null;
  readonly evidenceRefs: readonly string[];
  readonly clarificationNeeded: boolean;
  readonly clarificationQuestion: string | null;
}

export function scoreCell(evaluation: FixtureEvaluation, row: FixtureScore): ScoreCell {
  return {
    scoreId: row.scoreId,
    bidId: row.bidId,
    criterionId: row.criterionId,
    score: row.score,
    weightedPoints: row.score === null ? null : weightedPoints(evaluation, row.criterionId, row.score),
    isNotApplicable: row.isNotApplicable,
    rationale: row.rationale,
    evidenceRefs: [...row.evidenceRefs],
    clarificationNeeded: row.clarificationNeeded,
    clarificationQuestion: row.clarificationQuestion,
    status: row.status,
    submittedAt: row.submittedAt,
    version: row.version,
    corrections: row.corrections.map((correction) => ({
      correctionId: correction.correctionId,
      previousScore: correction.previousScore,
      newScore: correction.newScore,
      previousRationale: correction.previousRationale,
      reason: correction.reason,
      correctedBy: person(correction.correctedByUserId),
      correctedAt: correction.correctedAt,
      returnedByChair: correction.returnedByChair,
    })),
  };
}

/** The cells of an assignment: saved rows, then overrides (a save or submit request), then empty cells. */
export function assessmentCells(assignment: FixtureAssignment, overrides: readonly CellOverride[] = []): ScoreCell[] {
  const evaluation = evaluationFor(assignment);
  const { bidIds, criterionIds } = scopeCells(assignment);
  const saved = scoresOf(assignment.assignmentId);
  const cells: ScoreCell[] = [];
  for (const bidId of bidIds) {
    for (const criterionId of criterionIds) {
      const existing = saved.find((row) => row.bidId === bidId && row.criterionId === criterionId);
      const override = overrides.find((row) => row.bidId === bidId && row.criterionId === criterionId);
      const base: ScoreCell =
        existing === undefined
          ? {
              scoreId: null,
              bidId,
              criterionId,
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
            }
          : scoreCell(evaluation, existing);
      cells.push(
        override === undefined
          ? base
          : {
              ...base,
              score: override.score,
              weightedPoints: override.score === null ? null : weightedPoints(evaluation, criterionId, override.score),
              isNotApplicable: override.isNotApplicable,
              rationale: override.rationale,
              evidenceRefs: [...override.evidenceRefs],
              clarificationNeeded: override.clarificationNeeded,
              clarificationQuestion: override.clarificationQuestion,
              status: 'draft',
            },
      );
    }
  }
  return cells;
}

export function assessmentView(
  assignment: FixtureAssignment,
  caller: Caller,
  cells: ScoreCell[] = assessmentCells(assignment),
  statusOverride?: { status: AssignmentRow['status']; submittedAt: string | null },
): Assessment {
  const evaluation = evaluationFor(assignment);
  const { bidIds, criterionIds } = scopeCells(assignment);
  const readOnly = assignment.evaluatorUserId !== caller.userId;
  const status = statusOverride?.status ?? assignment.status;
  const submittedAt = statusOverride?.submittedAt ?? assignment.submittedAt;
  const submitted = status === 'submitted' || status === 'finalized' || status === 'returned';
  const missing = cells.filter((cell) => !isScored(cell)).map((cell) => ({ bidId: cell.bidId, criterionId: cell.criterionId }));
  const peers = readOnly
    ? { visibility: evaluation.tender.independentEvaluation ? ('oversight' as const) : ('not_applicable' as const), items: [] }
    : !evaluation.tender.independentEvaluation || submitted
      ? { visibility: 'visible' as const, items: peerScores(evaluation, assignment) }
      : { visibility: 'hidden_until_own_submission' as const, items: [] };
  return {
    assignmentId: assignment.assignmentId,
    tender: evaluation.tender,
    lot: evaluation.lot,
    evaluator: person(assignment.evaluatorUserId),
    status,
    dueAt: { at: assignment.dueAt, timeZone: evaluation.tender.officialTimeZone },
    submittedAt,
    returnReason: assignment.returnReason,
    readOnly,
    plan: evaluation.plan,
    criterionIds,
    bids: evaluation.bids
      .filter((bid) => bidIds.includes(bid.bidId))
      .map((bid) => ({
        ...bidRef(bid),
        responses: bid.responses.filter((response) => criterionIds.includes(response.criterionId)),
      })),
    scores: cells,
    completion: {
      scored: cells.length - missing.length,
      total: cells.length,
      complete: cells.length > 0 && missing.length === 0,
      missing,
    },
    priceGate: priceGateView(evaluation),
    correctionsOpen: correctionsOpen(evaluation),
    peerScores: peers,
  };
}

/** Submitted scores can be corrected with a reason until moderation is finalized (BR-27). */
export function correctionsOpen(evaluation: FixtureEvaluation): boolean {
  return evaluation.moderation?.status !== 'finalized';
}

function peerScores(evaluation: FixtureEvaluation, own: FixtureAssignment): Assessment['peerScores']['items'] {
  return assignmentsOf(evaluation)
    .filter((other) => other.assignmentId !== own.assignmentId && !other.isCommercial && isActiveAssignment(other) && isSubmitted(other))
    .flatMap((other) =>
      scoresOf(other.assignmentId).map((row) => ({
        evaluator: person(other.evaluatorUserId),
        bidId: row.bidId,
        criterionId: row.criterionId,
        score: row.score,
        isNotApplicable: row.isNotApplicable,
        status: row.status,
      })),
    );
}

// ---------------------------------------------------------------------------------------------------------
// Price gate and commercial comparison (EVA-04)
// ---------------------------------------------------------------------------------------------------------

export function priceGateView(evaluation: FixtureEvaluation): PriceGate {
  const gate = evaluation.priceGate;
  return {
    applies: gate.applies,
    released: gate.releasedAt !== null,
    releasedAt: gate.releasedAt,
    releasedBy: gate.releasedByUserId === null ? null : person(gate.releasedByUserId),
    nonPriceCompleteConfirmed: gate.nonPriceCompleteConfirmed,
    note: gate.note,
  };
}

export function pricesVisible(evaluation: FixtureEvaluation): boolean {
  return !evaluation.priceGate.applies || evaluation.priceGate.releasedAt !== null;
}

function correctedTotal(row: FixtureCommercialRow): Money {
  return row.arithmeticCorrection === null
    ? row.submittedTotal
    : { amount: add(row.submittedTotal.amount, row.arithmeticCorrection.amount), currency: row.submittedTotal.currency };
}

/** Lowest evaluated cost in the reference set (comparison currency). */
export function lowestEvaluatedCost(rows: readonly FixtureCommercialRow[]): Money | null {
  const inSet = rows.filter((row) => row.inReferenceSet);
  const first = inSet[0];
  if (first === undefined) {
    return null;
  }
  let lowest = first.evaluatedCost;
  for (const row of inSet) {
    if (lt(row.evaluatedCost.amount, lowest.amount)) {
      lowest = row.evaluatedCost;
    }
  }
  return lowest;
}

/** Price points by the plan's price method; `null` outside the reference set or for method `none`. */
export function priceScoreOf(evaluation: FixtureEvaluation, row: FixtureCommercialRow, lowest: Money | null): string | null {
  const { priceMethod, priceWeight, decimalPlacesCalc } = evaluation.plan;
  if (!row.inReferenceSet || lowest === null || priceMethod === 'none') {
    return null;
  }
  if (priceMethod === 'lowest_ratio') {
    return div(mul(lowest.amount, priceWeight), row.evaluatedCost.amount, decimalPlacesCalc);
  }
  // linear_deduction: weight × (1 − (cost − lowest) ÷ lowest), never below zero.
  const deduction = div(mul(sub(row.evaluatedCost.amount, lowest.amount), priceWeight), lowest.amount, decimalPlacesCalc);
  const points = sub(priceWeight, deduction);
  return lt(points, '0') ? round('0', decimalPlacesCalc) : round(points, decimalPlacesCalc);
}

export function commercialRowView(evaluation: FixtureEvaluation, row: FixtureCommercialRow, rows = evaluation.commercial.rows): CommercialRow {
  const bid = bidById(evaluation, row.bidId);
  if (bid === undefined) {
    throw new Error(`Commercial row ${row.commercialEvaluationId} references unknown bid ${row.bidId}.`);
  }
  const priceScore = priceScoreOf(evaluation, row, lowestEvaluatedCost(rows));
  return {
    commercialEvaluationId: row.commercialEvaluationId,
    bid: bidRef(bid),
    revisionId: row.revisionId,
    submittedTotal: row.submittedTotal,
    arithmeticCorrection: row.arithmeticCorrection,
    correctedTotal: correctedTotal(row),
    correctionRule: row.correctionRule,
    correctionStatus: row.correctionStatus,
    correctionProposedBy: row.correctionProposedByUserId === null ? null : person(row.correctionProposedByUserId),
    correctionProposedAt: row.correctionProposedAt,
    correctionApprovedBy: row.correctionApprovedByUserId === null ? null : person(row.correctionApprovedByUserId),
    supplierAckAt: row.supplierAckAt,
    fx: row.fx,
    evaluatedCost: row.evaluatedCost,
    costComponents: row.costComponents.map((component) => ({ ...component })),
    excludedItemsNote: row.excludedItemsNote,
    assumptions: row.assumptions,
    abnormallyLowFlag: row.abnormallyLowFlag,
    abnormallyLowOutcome: row.abnormallyLowOutcome,
    abnormallyLowReview: row.abnormallyLowReview,
    inReferenceSet: row.inReferenceSet,
    referenceExclusionReason: row.referenceExclusionReason,
    priceScore,
    priceScoreDisplay: priceScore === null ? null : round(priceScore, evaluation.plan.decimalPlacesDisplay),
    affordability: row.affordability,
    status: row.status,
  };
}

export function commercialReadiness(evaluation: FixtureEvaluation): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const rows = evaluation.commercial.rows;
  if (!pricesVisible(evaluation)) {
    items.push({ id: 'price-gate', status: 'blocking', label: 'Price gate not released', detail: 'Prices stay sealed until the chair confirms the non-price review is complete.' });
    return items;
  }
  items.push({ id: 'price-gate', status: 'passed', label: 'Price gate released', detail: evaluation.priceGate.note });
  const pendingCorrections = rows.filter((row) => row.correctionStatus === 'pending_approval');
  items.push(
    pendingCorrections.length > 0
      ? {
          id: 'corrections',
          status: 'blocking',
          label: 'Arithmetic corrections awaiting approval',
          detail: pendingCorrections.map((row) => bidLabel(evaluation, row.bidId)).join(', '),
        }
      : { id: 'corrections', status: 'passed', label: 'Arithmetic corrections approved or not needed', detail: null },
  );
  const pendingReviews = rows.filter((row) => row.abnormallyLowFlag && (row.abnormallyLowOutcome === null || row.abnormallyLowOutcome === 'pending'));
  items.push(
    pendingReviews.length > 0
      ? {
          id: 'abnormally-low',
          status: 'blocking',
          label: 'Abnormally-low offers awaiting documented review',
          detail: pendingReviews.map((row) => bidLabel(evaluation, row.bidId)).join(', '),
        }
      : { id: 'abnormally-low', status: 'passed', label: 'Abnormally-low flags reviewed or none raised', detail: null },
  );
  for (const row of rows.filter((candidate) => !candidate.inReferenceSet)) {
    items.push({
      id: `reference-${row.bidId}`,
      status: 'warning',
      label: `${bidLabel(evaluation, row.bidId)} is outside the reference set`,
      detail: row.referenceExclusionReason,
    });
  }
  for (const row of rows.filter((candidate) => candidate.affordability === 'exceeds_budget')) {
    items.push({
      id: `affordability-${row.bidId}`,
      status: 'warning',
      label: `${bidLabel(evaluation, row.bidId)} exceeds the budget`,
      detail:
        evaluation.budget === null
          ? null
          : `Evaluated cost ${moneyText(row.evaluatedCost)} against a budget of ${moneyText(evaluation.budget)}. Affordability is decided separately from rank.`,
    });
  }
  return items;
}

export function commercialView(evaluation: FixtureEvaluation, rows = evaluation.commercial.rows): CommercialComparison {
  const visible = pricesVisible(evaluation);
  const commercial = evaluation.commercial;
  return {
    tender: evaluation.tender,
    lot: evaluation.lot,
    plan: evaluation.plan,
    priceGate: priceGateView(evaluation),
    status: commercial.status,
    reviewer: commercial.reviewerUserId === null ? null : person(commercial.reviewerUserId),
    taxTreatment: commercial.taxTreatment,
    basisNote: commercial.basisNote,
    budget: evaluation.budget,
    lowestEvaluatedCost: visible ? lowestEvaluatedCost(rows) : null,
    rows: visible ? rows.map((row) => commercialRowView(evaluation, row, rows)) : [],
    sealedBids: evaluation.bids
      .filter((bid) => !visible || !bid.eligible)
      .map((bid) => ({
        bid: bidRef(bid),
        reason: bid.sealedReason ?? 'Commercial envelope sealed until the price gate is released (AC-16).',
      })),
    readiness: commercialReadiness(evaluation),
    approvedAt: commercial.approvedAt,
    approvedBy: commercial.approvedByUserId === null ? null : person(commercial.approvedByUserId),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Moderation (EVA-05)
// ---------------------------------------------------------------------------------------------------------

function moderatedView(evaluation: FixtureEvaluation, row: FixtureModeratedScore, individual: readonly (string | null)[]): ModeratedScore {
  return {
    moderatedScoreId: row.moderatedScoreId,
    finalScore: row.finalScore,
    weightedPoints: weightedPoints(evaluation, row.criterionId, row.finalScore),
    method: row.method,
    reasons: row.reasons,
    moderatedBy: person(row.moderatedByUserId),
    recordedAt: row.recordedAt,
    supersededById: row.supersededById,
    differsFromIndividual: individual.some((score) => score !== null && compare(score, row.finalScore) !== 0),
  };
}

/** Assessors counted in moderation: active, non-commercial, with content access. */
export function moderationAssessors(evaluation: FixtureEvaluation): FixtureAssignment[] {
  return assignmentsOf(evaluation).filter((row) => !row.isCommercial && isActiveAssignment(row) && contentBlock(row) === null);
}

export function moderationCells(evaluation: FixtureEvaluation): ModerationCell[] {
  const assessors = moderationAssessors(evaluation);
  const moderated = evaluation.moderation?.scores ?? [];
  const cells: ModerationCell[] = [];
  const eligible = evaluation.bids.filter((bid) => bid.eligible);
  for (const bid of eligible) {
    for (const criterionId of nonPriceCriterionIds(evaluation)) {
      const individual = assessors.map((assignment) => {
        const row = scoresOf(assignment.assignmentId).find((score) => score.bidId === bid.bidId && score.criterionId === criterionId);
        if (row === undefined || row.status !== 'submitted') {
          // Only submitted assessments reach moderation: a draft's content stays with its evaluator (PRD §4.3).
          return {
            assignmentId: assignment.assignmentId,
            evaluator: person(assignment.evaluatorUserId),
            submitted: false,
            score: null,
            isNotApplicable: false,
            notScored: false,
            status: 'draft' as const,
            rationale: null,
            evidenceRefs: [],
            clarificationNeeded: false,
            correctedAfterSubmission: false,
          };
        }
        return {
          assignmentId: assignment.assignmentId,
          evaluator: person(assignment.evaluatorUserId),
          submitted: true,
          score: row.score,
          isNotApplicable: row.isNotApplicable,
          notScored: row.score === null && !row.isNotApplicable,
          status: row.status,
          rationale: row.rationale,
          evidenceRefs: [...row.evidenceRefs],
          clarificationNeeded: row.clarificationNeeded,
          correctedAfterSubmission: row.corrections.length > 0,
        };
      });
      const submittedScores = individual.filter((entry) => entry.submitted && entry.score !== null).map((entry) => entry.score as string);
      const outstanding = individual.filter((entry) => !entry.submitted || entry.notScored).length;
      let spread: string | null = null;
      if (submittedScores.length >= 2) {
        const sorted = [...submittedScores].sort(compare);
        // One decimal place whatever scale the ratings were entered with, so spreads read consistently ("1.0", "0.0").
        spread = round(sub(sorted[sorted.length - 1] as string, sorted[0] as string), 1);
      }
      const cellModerated = moderated.filter((row) => row.bidId === bid.bidId && row.criterionId === criterionId);
      const current = cellModerated.find((row) => row.supersededById === null);
      cells.push({
        bidId: bid.bidId,
        criterionId,
        individual,
        spread,
        divergent: spread !== null && gte(spread, evaluation.divergenceThreshold),
        average:
          outstanding === 0 && submittedScores.length > 0
            ? div(sum(submittedScores), String(submittedScores.length), evaluation.plan.decimalPlacesCalc)
            : null,
        outstanding,
        current: current === undefined ? null : moderatedView(evaluation, current, submittedScores),
        history: cellModerated
          .filter((row) => row.supersededById !== null)
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
          .map((row) => moderatedView(evaluation, row, submittedScores)),
      });
    }
  }
  return cells;
}

const METHOD_TEXT: Record<FixtureModerationSession['method'], string> = {
  consensus: 'consensus',
  average: 'averaging the assessors',
  weighted_assessor: 'weighted assessors',
};

export function moderationReadiness(evaluation: FixtureEvaluation, cells: readonly ModerationCell[]): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const session = evaluation.moderation;
  if (session?.status === 'finalized' && session.finalizedAt !== null) {
    items.push({
      id: 'finalized',
      status: 'passed',
      label: 'Moderation finalized',
      detail: `Finalized on ${instantText(session.finalizedAt, evaluation.tender.officialTimeZone)} by ${METHOD_TEXT[session.method]}.`,
    });
  }
  const missingModerated = cells.filter((cell) => cell.current === null).length;
  items.push(
    missingModerated > 0
      ? { id: 'moderated', status: 'blocking', label: `${missingModerated} of ${cells.length} cells have no agreed score`, detail: 'Record the agreed score with reasons for every cell.' }
      : { id: 'moderated', status: 'passed', label: 'Every cell has an agreed score with reasons', detail: null },
  );
  const method = session?.method ?? evaluation.plan.aggregationMethod;
  for (const assignment of assignmentsOf(evaluation).filter((row) => !row.isCommercial)) {
    const name = person(assignment.evaluatorUserId).fullName;
    if (!isActiveAssignment(assignment)) {
      items.push({ id: `assessor-${assignment.assignmentId}`, status: 'passed', label: `Recusal recorded: ${name}`, detail: assignment.reassignmentReason });
      continue;
    }
    if (contentBlock(assignment) === 'conflict_pending_review') {
      items.push({
        id: `assessor-${assignment.assignmentId}`,
        status: 'warning',
        label: `${name}: conflict declaration pending review`,
        detail: 'No access to content; not counted in moderation until the chair records a disposition.',
      });
      continue;
    }
    const completion = completionOf(assignment, evaluation);
    if (!isSubmitted(assignment) || !completion.complete) {
      const notScored = completion.notScored;
      items.push({
        id: `assessor-${assignment.assignmentId}`,
        status: method === 'average' ? 'blocking' : 'warning',
        label:
          assignment.acceptedAt === null
            ? `${name} has not accepted the assignment`
            : `${name}: assessment ${isSubmitted(assignment) ? 'returned' : 'not submitted'}${notScored > 0 ? `, ${notScored} cell${notScored === 1 ? '' : 's'} not scored` : ''}`,
        detail:
          method === 'average'
            ? 'The declared method averages every assessor: moderation cannot be finalized until the assessment is complete.'
            : 'Shown as not scored and never counted as zero; the agreed result states it in its reasons.',
      });
    }
  }
  return items;
}

export function moderationView(evaluation: FixtureEvaluation): ModerationView | null {
  const session = evaluation.moderation;
  if (session === null) {
    return null;
  }
  const cells = moderationCells(evaluation);
  return {
    tender: evaluation.tender,
    lot: evaluation.lot,
    plan: evaluation.plan,
    session: {
      sessionId: session.sessionId,
      method: session.method,
      status: session.status,
      chair: person(evaluation.chairUserId),
      notes: session.notes,
      createdAt: session.createdAt,
      finalizedAt: session.finalizedAt,
    },
    divergenceThreshold: evaluation.divergenceThreshold,
    bids: evaluation.bids.filter((bid) => bid.eligible).map(bidRef),
    criterionIds: nonPriceCriterionIds(evaluation),
    assessors: assignmentsOf(evaluation)
      .filter((row) => !row.isCommercial)
      .map((row) => {
        const completion = completionOf(row, evaluation);
        return {
          assignmentId: row.assignmentId,
          evaluator: person(row.evaluatorUserId),
          status: row.status,
          submittedAt: row.submittedAt,
          scored: completion.scored,
          total: completion.total,
        };
      }),
    cells,
    priceGate: priceGateView(evaluation),
    readiness: moderationReadiness(evaluation, cells),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Results and report (EVA-06)
// ---------------------------------------------------------------------------------------------------------

function currentModerated(evaluation: FixtureEvaluation, bidId: number, criterionId: number): FixtureModeratedScore | undefined {
  return evaluation.moderation?.scores.find((row) => row.bidId === bidId && row.criterionId === criterionId && row.supersededById === null);
}

interface ComputedResult {
  readonly bid: FixtureBid;
  readonly criterionPoints: CriterionPoints[];
  readonly nonPrice: string | null;
  readonly price: string | null;
  readonly total: string | null;
  readonly gateFailures: string[];
  readonly commercial: FixtureCommercialRow | undefined;
}

export function computeResults(evaluation: FixtureEvaluation, rows = evaluation.commercial.rows): ComputedResult[] {
  const { plan } = evaluation;
  const lowest = lowestEvaluatedCost(rows);
  return evaluation.bids.map((bid) => {
    const facts = evaluation.results.facts.find((row) => row.bidId === bid.bidId);
    const gateFailures = [...(facts?.gateFailures ?? [])];
    const commercial = pricesVisible(evaluation) ? rows.find((row) => row.bidId === bid.bidId) : undefined;
    if (!bid.eligible) {
      return { bid, criterionPoints: [], nonPrice: null, price: null, total: null, gateFailures, commercial: undefined };
    }
    const criterionPoints: CriterionPoints[] = plan.criteria.map((row) => {
      if (row.isPrice) {
        const price = commercial === undefined ? null : priceScoreOf(evaluation, commercial, lowest);
        return {
          criterionId: row.criterionId,
          rating: null,
          points: price,
          pointsDisplay: price === null ? null : round(price, plan.decimalPlacesDisplay),
          source: price === null ? 'not_available' : 'price_formula',
        };
      }
      const moderated = currentModerated(evaluation, bid.bidId, row.criterionId);
      if (moderated === undefined) {
        return { criterionId: row.criterionId, rating: null, points: null, pointsDisplay: null, source: 'not_available' };
      }
      const points = weightedPoints(evaluation, row.criterionId, moderated.finalScore);
      if (row.minScore !== null && lt(moderated.finalScore, row.minScore)) {
        gateFailures.push(`CRITERION_MINIMUM:${row.code}`);
      }
      return {
        criterionId: row.criterionId,
        rating: moderated.finalScore,
        points,
        pointsDisplay: round(points, plan.decimalPlacesDisplay),
        source: 'moderated',
      };
    });
    const nonPriceParts = criterionPoints.filter((row) => !criterion(evaluation, row.criterionId)?.isPrice);
    const nonPrice = nonPriceParts.every((row) => row.points !== null)
      ? round(sum(nonPriceParts.map((row) => row.points as string)), plan.decimalPlacesCalc)
      : null;
    const priceRow = criterionPoints.find((row) => criterion(evaluation, row.criterionId)?.isPrice);
    const price = priceRow?.points ?? null;
    if (plan.thresholdScope === 'non_price_total' && plan.nonPriceThreshold !== null && nonPrice !== null && lt(nonPrice, plan.nonPriceThreshold)) {
      if (!gateFailures.includes('NON_PRICE_THRESHOLD')) {
        gateFailures.push('NON_PRICE_THRESHOLD');
      }
    }
    const total = nonPrice !== null && price !== null ? round(add(nonPrice, price), plan.decimalPlacesCalc) : nonPrice !== null && plan.priceMethod === 'none' ? nonPrice : null;
    return { bid, criterionPoints, nonPrice, price, total, gateFailures, commercial };
  });
}

/** Ranks results that pass every gate: total at calculation precision, then the published tie sequence. */
export function rankResults(evaluation: FixtureEvaluation, computed: readonly ComputedResult[]): Map<number, { rank: number; tieBreak: string | null }> {
  const rankable = computed.filter((row) => row.gateFailures.length === 0 && row.total !== null);
  const tieRules = [...evaluation.plan.tieBreakRules].sort((a, b) => a.sequence - b.sequence);
  const tieBreaks = new Map<number, string>();
  const sorted = [...rankable].sort((a, b) => {
    const byTotal = compare(b.total as string, a.total as string);
    if (byTotal !== 0) {
      return byTotal;
    }
    for (const rule of tieRules) {
      let order = 0;
      if (rule.rule === 'highest_non_price') {
        order = compare(b.nonPrice ?? '0', a.nonPrice ?? '0');
      } else if (rule.rule === 'lowest_evaluated_cost') {
        order = compare(a.commercial?.evaluatedCost.amount ?? '0', b.commercial?.evaluatedCost.amount ?? '0');
      } else if (rule.rule === 'earliest_receipt') {
        order = a.bid.receivedAt.localeCompare(b.bid.receivedAt);
      } else if (rule.rule === 'highest_criterion' && rule.criterionId !== null) {
        const pa = a.criterionPoints.find((row) => row.criterionId === rule.criterionId)?.points ?? '0';
        const pb = b.criterionPoints.find((row) => row.criterionId === rule.criterionId)?.points ?? '0';
        order = compare(pb, pa);
      }
      if (order !== 0) {
        tieBreaks.set(a.bid.bidId, rule.rule);
        tieBreaks.set(b.bid.bidId, rule.rule);
        return order;
      }
    }
    return 0;
  });
  const ranks = new Map<number, { rank: number; tieBreak: string | null }>();
  sorted.forEach((row, index) => ranks.set(row.bid.bidId, { rank: index + 1, tieBreak: tieBreaks.get(row.bid.bidId) ?? null }));
  return ranks;
}

export function resultRows(evaluation: FixtureEvaluation, status = evaluation.results.status): ResultRow[] {
  if (status === 'not_computed') {
    return [];
  }
  const computed = computeResults(evaluation);
  const ranks = rankResults(evaluation, computed);
  return computed.map((row) => {
    const facts = evaluation.results.facts.find((fact) => fact.bidId === row.bid.bidId);
    const rank = ranks.get(row.bid.bidId);
    return {
      resultId: facts?.resultId ?? row.bid.bidId * 100 + 7,
      bid: bidRef(row.bid),
      criterionPoints: row.criterionPoints,
      nonPriceScore: row.nonPrice,
      priceScore: row.price,
      totalScore: row.total,
      totalScoreDisplay: row.total === null ? null : round(row.total, evaluation.plan.decimalPlacesDisplay),
      passesGates: row.gateFailures.length === 0,
      gateFailures: row.gateFailures,
      rank: rank?.rank ?? null,
      tieBreakApplied: facts?.tieBreakApplied ?? rank?.tieBreak ?? null,
      evaluatedCost: row.commercial?.evaluatedCost ?? null,
      affordability: row.commercial?.affordability ?? 'not_assessed',
      explanation: facts?.explanation ?? 'Not yet computed under the approved method.',
      status: status === 'draft' || status === 'signed_off' || status === 'superseded' ? status : 'draft',
    };
  });
}

export function rankingReadiness(evaluation: FixtureEvaluation, results: readonly ResultRow[]): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  for (const assignment of assignmentsOf(evaluation).filter((row) => !row.isCommercial)) {
    const name = person(assignment.evaluatorUserId).fullName;
    if (!isActiveAssignment(assignment)) {
      items.push({ id: `assessment-${assignment.assignmentId}`, status: 'passed', label: `Recusal recorded: ${name}`, detail: assignment.reassignmentReason });
      continue;
    }
    if (contentBlock(assignment) === 'conflict_pending_review') {
      items.push({
        id: `conflict-${assignment.assignmentId}`,
        status: 'blocking',
        label: `Conflict declaration pending review: ${name}`,
        detail: 'The chair must clear, mitigate or recuse before the report can be signed off.',
      });
      continue;
    }
    const cells = assessmentCells(assignment);
    const missing = cells.filter((cell) => !isScored(cell));
    if (missing.length > 0 || !isSubmitted(assignment)) {
      items.push({
        id: `assessment-${assignment.assignmentId}`,
        status: 'blocking',
        label: `Individual assessment incomplete: ${name}`,
        detail:
          missing.length > 0
            ? `Not scored: ${missing.map((cell) => `${criterionName(evaluation, cell.criterionId)} for ${bidLabel(evaluation, cell.bidId)}`).join('; ')}. Missing work is never counted as zero.`
            : 'The assessment has not been submitted.',
      });
    }
  }
  const moderation = evaluation.moderation;
  items.push(
    moderation?.status === 'finalized'
      ? { id: 'moderation', status: 'passed', label: `Moderation finalized by ${METHOD_TEXT[moderation.method]}`, detail: null }
      : { id: 'moderation', status: 'blocking', label: 'Moderation not finalized', detail: null },
  );
  if (evaluation.priceGate.applies) {
    items.push(
      evaluation.priceGate.releasedAt === null
        ? { id: 'price-gate', status: 'blocking', label: 'Price gate not released', detail: null }
        : { id: 'price-gate', status: 'passed', label: 'Price gate released', detail: null },
    );
  }
  items.push(
    evaluation.commercial.status === 'approved'
      ? { id: 'commercial', status: 'passed', label: 'Commercial comparison approved', detail: null }
      : {
          id: 'commercial',
          status: 'blocking',
          label: evaluation.commercial.status === 'draft' ? 'Commercial comparison in draft' : 'Commercial comparison not started',
          detail: null,
        },
  );
  for (const row of results.filter((result) => !result.passesGates)) {
    items.push({
      id: `gates-${row.bid.bidId}`,
      status: 'warning',
      label: `${bidLabel(evaluation, row.bid.bidId)} not ranked: ${row.gateFailures.map((code) => gateFailureText(evaluation, code)).join('; ')}`,
      detail: row.explanation,
    });
  }
  const top = results.find((row) => row.rank === 1);
  if (top !== undefined && top.affordability === 'exceeds_budget') {
    items.push({
      id: 'affordability',
      status: 'warning',
      label: 'The top-ranked offer exceeds the budget',
      detail: 'Additional budget approval or a no-award decision may be needed. Affordability does not change the rank.',
    });
  }
  const ranked = results.filter((row) => row.rank !== null);
  if (ranked.length > 1) {
    const displays = new Set(ranked.map((row) => row.totalScoreDisplay));
    items.push(
      displays.size < ranked.length
        ? { id: 'ties', status: 'warning', label: 'Displayed totals tie; the order uses calculation precision and the tie sequence', detail: null }
        : { id: 'ties', status: 'passed', label: `No tie at ${evaluation.plan.decimalPlacesCalc} decimal places`, detail: null },
    );
  }
  return items;
}

export function reportView(evaluation: FixtureEvaluation, report: FixtureReport): EvaluationReport {
  return {
    reportId: report.reportId,
    version: report.version,
    status: report.status,
    summary: report.summary,
    documentId: report.documentId,
    createdAt: report.createdAt,
    createdBy: person(report.createdByUserId),
    submittedForSignoffAt: report.submittedForSignoffAt,
    signedOffAt: report.signedOffAt,
    handedOffAt: report.handedOffAt,
    signoffs: report.signoffs.map((line) => ({
      signoffId: line.signoffId,
      signer: member(line.userId, evaluation.tenantId),
      decision: line.decision,
      note: line.note,
      decidedAt: line.decidedAt,
    })),
  };
}

/**
 * The ranking and report. The committee sees `full` detail. Award-team observers (BR-26, PRD §4.3) see only the
 * signed-off report versions; per-criterion points and readiness only once the current report is signed off
 * (`totals_only` before that), and no results at all when they observe through a signed-off earlier version only
 * (`reports_only`: an award approver outside the tender team).
 */
export function rankingView(
  evaluation: FixtureEvaluation,
  computedAt = evaluation.results.computedAt,
  detail: ResultDetailLevel = 'full',
): RankingView {
  const allResults = resultRows(evaluation);
  const results =
    detail === 'full' ? allResults : detail === 'totals_only' ? allResults.map((row) => ({ ...row, criterionPoints: [] })) : [];
  const reports = detail === 'full' ? evaluation.reports : evaluation.reports.filter(isSignedOffReport);
  const currentVisible = reports[0] !== undefined && reports[0] === evaluation.reports[0];
  const current = currentVisible ? reports[0] : undefined;
  const history = currentVisible ? reports.slice(1) : reports;
  return {
    tender: evaluation.tender,
    lot: evaluation.lot,
    plan: evaluation.plan,
    status: evaluation.results.status,
    detail,
    computedAt: detail === 'reports_only' ? null : computedAt,
    results,
    lotConstraints: { note: evaluation.lotConstraintNote },
    budget: evaluation.budget,
    readiness: detail === 'full' ? rankingReadiness(evaluation, allResults) : [],
    report: current === undefined ? null : reportView(evaluation, current),
    reportHistory: history.map((report) => reportView(evaluation, report)),
  };
}

/** The detail level of the ranking for the caller (see `rankingView`). */
export function resultDetailFor(evaluation: FixtureEvaluation, role: EvaluationRole, onTeam: boolean): ResultDetailLevel {
  if (role !== 'observer') {
    return 'full';
  }
  if (evaluation.reports[0]?.status === 'signed_off') {
    return 'full';
  }
  return onTeam ? 'totals_only' : 'reports_only';
}

// ---------------------------------------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------------------------------------

export function stageOf(evaluation: FixtureEvaluation): EvaluationStage {
  const report = evaluation.reports[0];
  if (report?.status === 'signed_off') {
    return 'complete';
  }
  if (report?.status === 'in_signoff') {
    return 'signoff';
  }
  if (evaluation.results.status !== 'not_computed') {
    return 'ranking';
  }
  if (evaluation.moderation?.status === 'finalized') {
    // Next: release the price gate (staged opening), then prepare and approve the comparison.
    return 'commercial_comparison';
  }
  const technical = assignmentsOf(evaluation).filter((row) => !row.isCommercial && isActiveAssignment(row) && contentBlock(row) !== 'conflict_pending_review');
  if (technical.length > 0 && technical.every(isSubmitted)) {
    return 'moderation';
  }
  return 'individual_assessment';
}

function signoffPending(evaluation: FixtureEvaluation, caller: Caller): boolean {
  const report = evaluation.reports[0];
  return report?.status === 'in_signoff' && report.signoffs.some((line) => line.userId === caller.userId && line.decision === null);
}

/** The chair's committee step (assessments, moderation, price gate, ranking, sign-off, hand-off). */
function chairNextAction(evaluation: FixtureEvaluation, caller: Caller): EvaluationNextAction {
  const report = evaluation.reports[0];
  if (report?.status === 'signed_off') {
    return report.handedOffAt === null ? 'hand_off_report' : 'none';
  }
  if (report?.status === 'in_signoff') {
    return signoffPending(evaluation, caller) ? 'sign_report' : 'collect_signoffs';
  }
  if (evaluation.results.status !== 'not_computed') {
    // A computed ranking is validated only once nothing blocks the report (missing scores, conflict reviews…).
    const blocking = rankingReadiness(evaluation, resultRows(evaluation)).some((item) => item.status === 'blocking');
    return blocking ? 'resolve_blockers' : 'validate_ranking';
  }
  if (evaluation.moderation?.status !== 'finalized') {
    const technical = assignmentsOf(evaluation).filter((row) => !row.isCommercial && isActiveAssignment(row));
    return technical.length > 0 && technical.every(isSubmitted) ? 'moderate' : 'follow_up_assessments';
  }
  if (!pricesVisible(evaluation)) {
    return 'release_price_gate';
  }
  return evaluation.commercial.status === 'approved' ? 'validate_ranking' : 'await_comparison';
}

const OWN_NEXT: Partial<Record<AssignmentRow['nextAction'], EvaluationNextAction>> = {
  accept: 'accept_assignment',
  await_conflict_review: 'await_conflict_review',
  score: 'score_assessment',
  submit: 'submit_assessment',
  correct: 'correct_assessment',
};

/** The caller's own next step on the evaluation, by role (EVA-01..06 header); observers have none. */
export function myNextAction(evaluation: FixtureEvaluation, caller: Caller, now: Date): EvaluationNextAction {
  const role = roleIn(caller, evaluation);
  if (role === 'chair') {
    return chairNextAction(evaluation, caller);
  }
  if (role !== 'evaluator' && role !== 'commercial_reviewer') {
    return 'none';
  }
  for (const assignment of ownAssignments(caller, evaluation)) {
    const next = assignmentRow(assignment, now).nextAction;
    const mapped = OWN_NEXT[next];
    if (mapped !== undefined) {
      return mapped;
    }
    if (next === 'commercial_comparison') {
      return pricesVisible(evaluation) ? 'prepare_comparison' : 'await_price_gate';
    }
  }
  return signoffPending(evaluation, caller) ? 'sign_report' : 'none';
}

/**
 * How much committee detail the caller may see on the overview and the list (PRD §4.3): the same rule as
 * `OWN_ASSESSMENT_NOT_SUBMITTED` on the results, plus the suspended access of a conflict pending review (DD-25).
 */
export function detailLevelFor(evaluation: FixtureEvaluation, caller: Caller): OverviewDetailLevel {
  if (roleIn(caller, evaluation) !== 'evaluator') {
    return 'full';
  }
  const own = ownAssignments(caller, evaluation).filter((row) => !row.isCommercial);
  if (own.some((row) => contentBlock(row) === 'conflict_pending_review')) {
    return 'conflict_pending_review';
  }
  return own.some((row) => !isSubmitted(row)) ? 'own_assessment_pending' : 'full';
}

function timelineDetail(event: FixtureTimelineEvent, caller: Caller, level: OverviewDetailLevel): string | null {
  if (event.sensitivity === 'committee_results' && level !== 'full') {
    return null;
  }
  if (event.sensitivity === 'conflict_detail' && !isChair(caller) && event.subjectUserId !== caller.userId) {
    return null;
  }
  return event.detail;
}

export function summaryRow(evaluation: FixtureEvaluation, caller: Caller, now: Date): EvaluationSummaryRow {
  const level = detailLevelFor(evaluation, caller);
  const gate = priceGateView(evaluation);
  const assignments = assignmentsOf(evaluation).filter(isActiveAssignment);
  const open = assignments.filter((row) => !isSubmitted(row));
  const nextDue = open.map((row) => row.dueAt).sort()[0];
  return {
    tender: evaluation.tender,
    lot: evaluation.lot,
    stage: stageOf(evaluation),
    chair: person(evaluation.chairUserId),
    myRole: roleIn(caller, evaluation) ?? 'observer',
    myNextAction: myNextAction(evaluation, caller, now),
    bidCount: evaluation.bids.length,
    progress: {
      total: assignments.length,
      accepted: assignments.filter((row) => row.acceptedAt !== null).length,
      submitted: assignments.filter(isSubmitted).length,
      incomplete: open.length,
      overdue: assignments.filter((row) => isOverdue(row, now)).length,
      conflictsPendingReview: assignments.filter((row) => contentBlock(row) === 'conflict_pending_review').length,
    },
    nextDueAt: nextDue === undefined ? null : { at: nextDue, timeZone: evaluation.tender.officialTimeZone },
    // The gate note narrates moderation outcomes and outstanding scores: committee detail (PRD §4.3).
    priceGate: level === 'full' ? gate : { ...gate, note: null },
    moderationStatus: evaluation.moderation?.status ?? null,
    commercialStatus: evaluation.commercial.status === 'not_started' ? null : evaluation.commercial.status,
    reportStatus: evaluation.reports[0]?.status ?? null,
  };
}

export function overviewView(evaluation: FixtureEvaluation, caller: Caller, now: Date): EvaluationOverview {
  const level = detailLevelFor(evaluation, caller);
  return {
    ...summaryRow(evaluation, caller, now),
    plan: evaluation.plan,
    // Content access is suspended while a conflict awaits review: no supplier identities or compliance (DD-25).
    bids: level === 'conflict_pending_review' ? [] : evaluation.bids.map(bidRef),
    committee: assignmentsOf(evaluation)
      .filter((row) => isChair(caller) || row.evaluatorUserId === caller.userId || isActiveAssignment(row))
      .map((row) => {
        const completion = completionOf(row, evaluation);
        return {
          assignmentId: row.assignmentId,
          evaluator: member(row.evaluatorUserId, row.tenantId),
          isCommercial: row.isCommercial,
          status: row.status,
          dueAt: { at: row.dueAt, timeZone: evaluation.tender.officialTimeZone },
          scored: completion.scored,
          total: completion.total,
          conflictDisposition: row.conflictDeclaration?.hasConflict === true ? row.conflictDeclaration.disposition : null,
        };
      }),
    timeline: evaluation.timeline.map((event) => ({
      at: event.at,
      title: event.title,
      actor: event.actorUserId === null ? null : person(event.actorUserId),
      detail: timelineDetail(event, caller, level),
    })),
    detailLevel: level,
  };
}
