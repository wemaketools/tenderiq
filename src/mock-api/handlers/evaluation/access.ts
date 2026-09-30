/**
 * Caller access rules of the evaluation mock handlers (BR-26, PRD §4.3, DD-25).
 *
 * - The chair (`evaluation.chair`) sees every evaluation, assignment and moderation of the organization.
 * - An evaluator or commercial reviewer sees only the evaluations and assignments they are assigned to.
 * - The award team (`award.recommend`, `award.approve`) is an observer only by business assignment (PRD §4.3):
 *   a member of the tender team (owner or officer) sees progress and totals; an award approver outside the team
 *   sees an evaluation only once a report was signed off or handed off. Observers never see individual scores, and
 *   per-criterion points only after sign-off.
 * - Anyone else gets 404 for a record (never revealing it exists); the permission check already answered 403 for
 *   callers without any evaluation permission (org admin, auditor, support grant).
 */
import type { EvaluationRole } from '../../../contracts/evaluation.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { EVALUATION_ASSIGNMENTS, EVALUATIONS } from '../../fixtures/evaluation.js';
import { TEAM_MEMBERS } from '../../fixtures/tenders/index.js';
import type { FixtureAssignment, FixtureEvaluation } from '../../fixtures/evaluation.js';
import type { TenantAccess } from '../../persona.js';

export interface Caller {
  readonly userId: number;
  readonly tenantId: number;
  readonly permissions: readonly PermissionCode[];
}

export function callerOf(userId: number, access: TenantAccess): Caller {
  return { userId, tenantId: access.tenant.id, permissions: access.permissions };
}

export function has(caller: Caller, code: PermissionCode): boolean {
  return caller.permissions.includes(code);
}

export function isChair(caller: Caller): boolean {
  return has(caller, 'evaluation.chair');
}

export function isAwardTeam(caller: Caller): boolean {
  return has(caller, 'award.recommend') || has(caller, 'award.approve');
}

/** The assignments of one evaluation. */
export function assignmentsOf(evaluation: FixtureEvaluation): FixtureAssignment[] {
  return EVALUATION_ASSIGNMENTS.filter((row) => row.evaluationKey === evaluation.key && row.tenantId === evaluation.tenantId);
}

/** Assignments that still count (recused and reassigned ones are kept on record but no longer count). */
export function isActiveAssignment(assignment: FixtureAssignment): boolean {
  return assignment.status !== 'recused' && assignment.status !== 'reassigned';
}

/** The caller's own active assignments in an evaluation. */
export function ownAssignments(caller: Caller, evaluation: FixtureEvaluation): FixtureAssignment[] {
  return assignmentsOf(evaluation).filter((row) => row.evaluatorUserId === caller.userId && isActiveAssignment(row));
}

/** The caller's role in an evaluation, or `null` when the evaluation is not visible to them. */
export function roleIn(caller: Caller, evaluation: FixtureEvaluation): EvaluationRole | null {
  if (evaluation.tenantId !== caller.tenantId) {
    return null;
  }
  if (isChair(caller)) {
    return 'chair';
  }
  const own = ownAssignments(caller, evaluation);
  if (own.some((row) => row.isCommercial)) {
    return 'commercial_reviewer';
  }
  if (own.length > 0) {
    return 'evaluator';
  }
  if (isAwardTeam(caller) && (onTenderTeam(caller, evaluation) || (has(caller, 'award.approve') && hasSignedOffReport(evaluation)))) {
    return 'observer';
  }
  return null;
}

/** Tender-team roles that make an award-team member an observer of the evaluation. */
const OBSERVING_TEAM_ROLES = new Set(['owner', 'officer']);

/** Whether the caller owns or runs the tender (tender team `owner` or `officer`, for the tender or this lot). */
export function onTenderTeam(caller: Caller, evaluation: FixtureEvaluation): boolean {
  if (evaluation.tenderOwnerUserId === caller.userId) {
    return true;
  }
  return TEAM_MEMBERS.some(
    (member) =>
      member.tenantId === evaluation.tenantId &&
      member.tenderId === evaluation.tender.tenderId &&
      member.userId === caller.userId &&
      member.removedAt === null &&
      OBSERVING_TEAM_ROLES.has(member.teamRole) &&
      (member.lotId === null || member.lotId === evaluation.lot?.lotId),
  );
}

/** A report version the committee signed off (still current, or superseded after its hand-off). */
export function isSignedOffReport(report: FixtureEvaluation['reports'][number]): boolean {
  return report.status === 'signed_off' || report.handedOffAt !== null;
}

export function hasSignedOffReport(evaluation: FixtureEvaluation): boolean {
  return evaluation.reports.some(isSignedOffReport);
}

/** The evaluations of the caller's organization. */
export function tenantEvaluations(caller: Caller): FixtureEvaluation[] {
  return EVALUATIONS.filter((row) => row.tenantId === caller.tenantId);
}

/** Resolves the evaluation of a tender (and lot); `null` = not found, `'LOT_REQUIRED'` = several lots evaluated. */
export function resolveEvaluation(
  caller: Caller,
  tenderId: number,
  lotId: number | undefined,
): FixtureEvaluation | null | 'LOT_REQUIRED' {
  const candidates = tenantEvaluations(caller).filter((row) => row.tender.tenderId === tenderId);
  if (lotId !== undefined) {
    return candidates.find((row) => row.lot?.lotId === lotId) ?? null;
  }
  if (candidates.length > 1) {
    return 'LOT_REQUIRED';
  }
  return candidates[0] ?? null;
}

/** The evaluation an assignment belongs to. */
export function evaluationOf(assignment: FixtureAssignment): FixtureEvaluation {
  const evaluation = EVALUATIONS.find((row) => row.key === assignment.evaluationKey && row.tenantId === assignment.tenantId);
  if (evaluation === undefined) {
    throw new Error(`Assignment ${assignment.assignmentId} references unknown evaluation ${assignment.evaluationKey}.`);
  }
  return evaluation;
}

/** An assignment visible to the caller: their own, or any of the organization for the chair. */
export function visibleAssignment(caller: Caller, assignmentId: number): FixtureAssignment | null {
  const assignment = EVALUATION_ASSIGNMENTS.find((row) => row.assignmentId === assignmentId && row.tenantId === caller.tenantId);
  if (assignment === undefined) {
    return null;
  }
  if (assignment.evaluatorUserId === caller.userId || isChair(caller)) {
    return assignment;
  }
  return null;
}
