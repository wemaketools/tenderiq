/**
 * Mock handlers of the approvals contract (`src/contracts/approvals.ts`; COM-04, COM-05, BR-06, BR-07, BR-10,
 * DD-21, DD-24, DD-25).
 *
 * - `/me/approvals` lists approvals the caller decides (directly or by delegation) or requested, across active
 *   memberships; the decision screen is computed for the caller (own step, blockers, authority, routing).
 * - `decide` re-checks everything in the service's order and returns the static outcome: the step decided, the next
 *   step current or the approval final. Nothing is stored; the next GET returns the fixture again.
 * - Buyer panels read the approvals of a subject in the active tenant; request and withdraw return static outcomes.
 */
import type { ApprovalDetail, AuthorityCheckHint, EligibleApprover, MyApprovalItem } from '../../../contracts/approvals.js';
import {
  APPROVAL_AUTHORITY_DECISION_TYPES,
  APPROVAL_DECISION_PERMISSIONS,
  APPROVAL_REQUEST_PERMISSIONS,
  canViewApprovalSubject,
  checkAuthority,
  decideApproval,
  getApproval,
  getMyApproval,
  getSubjectApprovals,
  listMyApprovals,
  requestApproval,
  withdrawApproval,
} from '../../../contracts/approvals.js';
import { compare as compareDecimal } from '../../../contracts/decimal.js';
import type { ApprovalRequestsStatus, ApprovalStepsStatus } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { storylineInstant } from '../../fixtures/approvals/world.js';
import { APPROVALS, findFixtureApproval } from '../../fixtures/approvals.js';
import type { FixtureApproval } from '../../fixtures/approvals.js';
import { activeMemberships, allPersonas, membershipPermissions, organizationLabel, personRef } from '../../persona.js';
import type { Persona } from '../../persona.js';
import { subjectLinkFor } from './links.js';
import {
  authorityCheck,
  currentStepOf,
  involvementOf,
  myStepOf,
  toApprovalDetail,
  toApprovalSummary,
  viewerStep,
} from './view.js';

/** Actions are stamped on the storyline clock: never before the fixtures' "as of" instant. */
function iso(date: Date): string {
  return storylineInstant(date);
}

/** The persona's permissions in a tenant through an active membership, or `null`. */
function permissionsIn(persona: Persona, tenantId: number): PermissionCode[] | null {
  const membership = activeMemberships(persona).find((candidate) => candidate.tenantId === tenantId);
  return membership === undefined ? null : membershipPermissions(membership);
}

function visibleToMe(approval: FixtureApproval, persona: Persona): boolean {
  return permissionsIn(persona, approval.tenantId) !== null && involvementOf(approval, persona.userId) !== null;
}

const STEP_STATUS_OF: Record<string, ApprovalStepsStatus> = {
  approve: 'approved',
  approve_with_conditions: 'approved_with_conditions',
  reject: 'rejected',
  return: 'returned',
};

/** Deciders in the tenant for a subject type, each with their authority check for the amount. */
function eligibleApprovers(
  tenantId: number,
  subjectType: FixtureApproval['subjectType'],
  amount: { amount: string; currency: string },
  requestedAt: string,
): EligibleApprover[] {
  const decisionPermission = APPROVAL_DECISION_PERMISSIONS[subjectType];
  const decisionType = APPROVAL_AUTHORITY_DECISION_TYPES[subjectType];
  const approvers: EligibleApprover[] = [];
  for (const persona of allPersonas()) {
    const permissions = permissionsIn(persona, tenantId);
    if (permissions === null || !permissions.includes('approval.decide') || !permissions.includes(decisionPermission)) {
      continue;
    }
    const check = authorityCheck(tenantId, persona.userId, decisionType, amount, requestedAt);
    if (check.basis === 'none') {
      continue;
    }
    const membership = activeMemberships(persona).find((candidate) => candidate.tenantId === tenantId);
    approvers.push({ ...personRef(persona.userId), capacity: membership?.capacity ?? null, check });
  }
  // Lowest limit first; unlimited last.
  return approvers.sort((a, b) => {
    if (a.check.limit === null || b.check.limit === null) {
      return a.check.limit === null ? (b.check.limit === null ? 0 : 1) : -1;
    }
    return compareDecimal(a.check.limit.amount, b.check.limit.amount);
  });
}

export function register(app: MockApp): void {
  mockRoute(app, listMyApprovals, ({ requirePersona, query, fixtures }) => {
    const persona = requirePersona();
    const rows: MyApprovalItem[] = [];
    for (const approval of APPROVALS) {
      const permissions = permissionsIn(persona, approval.tenantId);
      const involvement = involvementOf(approval, persona.userId);
      if (permissions === null || involvement === null) {
        continue;
      }
      rows.push({
        ...toApprovalSummary(approval),
        organization: organizationLabel(approval.tenantId),
        myStep: myStepOf(approval, persona.userId, permissions),
        involvement,
        subjectLinkPath: subjectLinkFor(approval.subjectLinkPath, permissions),
      });
    }
    const q = query.q?.toLowerCase();
    const filtered = rows.filter((row) => {
      if (q !== undefined && !row.title.toLowerCase().includes(q) && !(row.subjectReference ?? '').toLowerCase().includes(q)) {
        return false;
      }
      if (query.status !== undefined && !query.status.includes(row.status)) {
        return false;
      }
      if (query.subjectType !== undefined && !query.subjectType.includes(row.subjectType)) {
        return false;
      }
      if (query.tenantId !== undefined && row.organization.tenantId !== query.tenantId) {
        return false;
      }
      if (query.awaitingMyDecision !== undefined) {
        const awaiting =
          row.status === 'pending' && row.myStep !== null && row.currentStep !== null && row.myStep.stepId === row.currentStep.id;
        if (awaiting !== query.awaitingMyDecision) {
          return false;
        }
      }
      if (query.overdue !== undefined && row.isOverdue !== query.overdue) {
        return false;
      }
      if (query.involvement !== undefined && (row.involvement === undefined || !query.involvement.includes(row.involvement))) {
        return false;
      }
      const day = row.requestedAt.slice(0, 10);
      if (query.requestedFrom !== undefined && day < query.requestedFrom) {
        return false;
      }
      return !(query.requestedTo !== undefined && day > query.requestedTo);
    });
    const sortKey = query.sort ?? 'dueAt';
    const factor = query.dir === 'desc' ? -1 : 1;
    const value = (row: MyApprovalItem): string | number => {
      switch (sortKey) {
        case 'requestedAt':
          return Date.parse(row.requestedAt);
        case 'title':
          return row.title.toLowerCase();
        case 'status':
          return row.status;
        case 'amount':
          return row.amount === null ? -1 : Number(row.amount.amount);
        default:
          return row.dueAt === null ? Number.MAX_SAFE_INTEGER : Date.parse(row.dueAt);
      }
    };
    const ordered = [...filtered].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return factor * (left < right ? -1 : left > right ? 1 : 0) || a.id - b.id;
    });
    return fixtures.page(ordered);
  });

  mockRoute(app, getMyApproval, ({ requirePersona, params, fail }) => {
    const persona = requirePersona();
    const approval = findFixtureApproval(params.approvalId);
    if (approval === undefined || !visibleToMe(approval, persona)) {
      return fail(404, 'APPROVAL_NOT_FOUND');
    }
    return toApprovalDetail(approval, { userId: persona.userId, permissions: permissionsIn(persona, approval.tenantId) ?? [] });
  });

  mockRoute(app, decideApproval, ({ requirePersona, requireTenant, params, body, now, fail }) => {
    const persona = requirePersona();
    const { tenant, permissions } = requireTenant();
    const approval = findFixtureApproval(params.approvalId);
    if (approval === undefined || approval.tenantId !== tenant.id || !visibleToMe(approval, persona)) {
      return fail(404, 'APPROVAL_NOT_FOUND');
    }
    if (approval.status === 'invalidated') {
      return fail(409, 'APPROVAL_INVALIDATED', approval.invalidatedReason ?? 'A material change invalidated this approval.');
    }
    if (approval.status === 'expired') {
      return fail(409, 'APPROVAL_EXPIRED', 'This approval expired; the requester must request it again.');
    }
    if (approval.status !== 'pending') {
      return fail(409, 'APPROVAL_NOT_PENDING', 'This approval has already been decided or withdrawn.');
    }
    if (
      body.subjectVersion !== approval.subjectVersion ||
      body.contentHash !== approval.contentHash ||
      approval.currentSubjectVersion !== approval.subjectVersion
    ) {
      return fail(409, 'APPROVAL_VERSION_MISMATCH', 'The version you reviewed is not the version under approval.');
    }
    const mine = viewerStep(approval, persona.userId);
    if (mine === null) {
      return fail(403, 'NOT_ASSIGNED_APPROVER', 'You are not an approver on this route.');
    }
    const current = currentStepOf(approval);
    if (current === null || current.id !== mine.step.id) {
      return fail(409, 'NOT_CURRENT_STEP', 'Your step is not the one awaiting a decision.');
    }
    if (!permissions.includes(APPROVAL_DECISION_PERMISSIONS[approval.subjectType])) {
      return fail(403, 'DECISION_PERMISSION_MISSING', `This decision also needs ${APPROVAL_DECISION_PERMISSIONS[approval.subjectType]}.`);
    }
    const check = authorityCheck(approval.tenantId, persona.userId, mine.step.requiredDecisionType, approval.amount, approval.requestedAt, mine.actingFor);
    if (check.missingExchangeRate) {
      return fail(409, 'EXCHANGE_RATE_MISSING', 'No exchange rate exists for the request date; the step routes to the next level.');
    }
    if (!check.sufficient) {
      return fail(403, 'AUTHORITY_INSUFFICIENT', 'The amount exceeds your approval authority.');
    }
    if (approval.sod !== null && approval.sod.mode === 'enforced' && approval.sod.blockedUserIds.includes(persona.userId)) {
      return fail(403, 'SOD_SELF_APPROVAL_BLOCKED', 'Policy requires an independent approver for this decision.');
    }
    const conflict = approval.conflicts.find((candidate) => candidate.userId === persona.userId);
    if (conflict !== undefined && conflict.declarationRequired && !conflict.declared) {
      return fail(409, 'CONFLICT_DECLARATION_REQUIRED', 'Declare your conflicts of interest before deciding.');
    }
    if (conflict !== undefined && conflict.hasConflict === true && conflict.disposition !== 'cleared' && conflict.disposition !== 'mitigated') {
      return fail(409, 'CONFLICT_UNRESOLVED', 'Your declared conflict has not been cleared.');
    }
    if (body.decision === 'approve_with_conditions' && !approval.conditionsPermitted) {
      return fail(422, 'CONDITIONS_NOT_PERMITTED', 'This route does not allow a conditional approval.');
    }
    if (approval.holdActive) {
      return fail(409, 'HOLD_BLOCKS_ACTION', 'A hold on the subject blocks this decision.');
    }
    const gate = approval.subjectGates?.[0];
    if (gate !== undefined) {
      return fail(409, 'SUBJECT_NOT_READY_FOR_APPROVAL', gate.detail);
    }
    const decidedAt = iso(now);
    const stepStatus = STEP_STATUS_OF[body.decision] ?? 'approved';
    const positive = body.decision === 'approve' || body.decision === 'approve_with_conditions';
    const laterPending = approval.steps.some((step) => step.sequence > mine.step.sequence && step.status === 'pending');
    const status: ApprovalRequestsStatus = positive
      ? laterPending
        ? 'pending'
        : body.decision === 'approve'
          ? 'approved'
          : 'approved_with_conditions'
      : body.decision === 'reject'
        ? 'rejected'
        : 'returned';
    const outcome: FixtureApproval = {
      ...approval,
      status,
      decidedAt: status === 'pending' ? null : decidedAt,
      conditions: body.decision === 'approve_with_conditions' ? (body.conditions ?? null) : approval.conditions,
      steps: approval.steps.map((step) =>
        step.id === mine.step.id
          ? {
              ...step,
              status: stepStatus,
              decidedByUserId: persona.userId,
              actingForUserId: mine.actingFor,
              decisionReason: body.reason ?? null,
              conditions: body.conditions ?? null,
              decidedAt,
              authorityCheckedAmount: approval.amount,
            }
          : !positive && step.status === 'pending'
            ? { ...step, status: 'skipped' }
            : step,
      ),
    };
    const detail: ApprovalDetail = toApprovalDetail(outcome, { userId: persona.userId, permissions });
    return detail;
  });

  mockRoute(app, getSubjectApprovals, ({ requireTenant, params, fail }) => {
    const { tenant, permissions } = requireTenant();
    // Administration is not content access (BR-26): without a view permission of the subject type the subject is
    // simply not found, exactly as another tenant's.
    if (!canViewApprovalSubject(params.subjectType, permissions)) {
      return fail(404, 'SUBJECT_NOT_FOUND');
    }
    const approvals = APPROVALS.filter(
      (approval) => approval.tenantId === tenant.id && approval.subjectType === params.subjectType && approval.subjectId === params.subjectId,
    ).sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
    const pending = approvals.find((approval) => approval.status === 'pending');
    const latestVersion = approvals.reduce((max, approval) => Math.max(max, approval.currentSubjectVersion), 0);
    const current =
      pending ??
      approvals.find(
        (approval) => approval.subjectVersion === latestVersion && approval.status !== 'withdrawn' && approval.status !== 'invalidated',
      ) ??
      null;
    const approvedForCurrent = current !== null && (current.status === 'approved' || current.status === 'approved_with_conditions');
    return {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      current: current === null ? null : toApprovalSummary(current),
      history: approvals.map(toApprovalSummary),
      canRequest: permissions.includes(APPROVAL_REQUEST_PERMISSIONS[params.subjectType]) && pending === undefined && !approvedForCurrent,
    };
  });

  mockRoute(app, getApproval, ({ requireTenant, requirePersona, params, fail }) => {
    const { tenant, permissions } = requireTenant();
    const approval = findFixtureApproval(params.approvalId);
    if (approval === undefined || approval.tenantId !== tenant.id || !canViewApprovalSubject(approval.subjectType, permissions)) {
      return fail(404, 'APPROVAL_NOT_FOUND');
    }
    return toApprovalDetail(approval, { userId: requirePersona().userId, permissions });
  });

  mockRoute(app, requestApproval, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    if (!permissions.includes(APPROVAL_REQUEST_PERMISSIONS[body.subjectType])) {
      return fail(403, 'REQUEST_PERMISSION_MISSING', `Requesting this approval needs ${APPROVAL_REQUEST_PERMISSIONS[body.subjectType]}.`);
    }
    const existing = APPROVALS.filter(
      (approval) => approval.tenantId === tenant.id && approval.subjectType === body.subjectType && approval.subjectId === body.subjectId,
    );
    if (existing.some((approval) => approval.status === 'pending')) {
      return fail(409, 'APPROVAL_ALREADY_PENDING', 'An approval of this subject is already pending.');
    }
    const knownVersion = existing.reduce((max, approval) => Math.max(max, approval.currentSubjectVersion), 0);
    if (knownVersion > 0 && body.subjectVersion !== knownVersion) {
      return fail(409, 'SUBJECT_VERSION_MISMATCH', `The current version of the subject is ${knownVersion}.`);
    }
    const requestedAt = iso(now);
    const decisionType = APPROVAL_AUTHORITY_DECISION_TYPES[body.subjectType];
    const approvers =
      body.amount === undefined
        ? eligibleApprovers(tenant.id, body.subjectType, { amount: '0.00', currency: tenant.defaultCurrency ?? 'BWP' }, requestedAt)
        : eligibleApprovers(tenant.id, body.subjectType, body.amount, requestedAt);
    const sufficient = approvers.filter((approver) => approver.check.sufficient);
    const first = sufficient[0];
    if (first === undefined) {
      return fail(422, 'NO_ELIGIBLE_APPROVER', 'Nobody in the organization holds the authority for this decision.');
    }
    const lowest = approvers[0];
    const skipped = lowest !== undefined && !lowest.check.sufficient ? lowest : null;
    const fixture: FixtureApproval = {
      id: 900,
      tenantId: tenant.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      subjectReference: existing[0]?.subjectReference ?? null,
      // The subject's own page when an earlier approval names it; otherwise the approvals inbox (never a dead link).
      subjectLinkPath: existing[0]?.subjectLinkPath ?? '/me/approvals',
      subjectVersion: body.subjectVersion,
      currentSubjectVersion: body.subjectVersion,
      contentHash: body.contentHash,
      title: body.title,
      summary: body.summary ?? null,
      justification: body.justification,
      status: 'pending',
      amount: body.amount ?? null,
      legalEntity: body.legalEntityId === undefined ? null : { legalEntityId: body.legalEntityId, name: 'Contracting entity' },
      category: null,
      requestedByUserId: persona.userId,
      requestedAt,
      dueAt: body.dueAt ?? null,
      expiresAt: null,
      decidedAt: null,
      routeMode: 'sequential',
      committee: null,
      conditions: null,
      invalidatedReason: null,
      invalidatedAt: null,
      conditionsPermitted: true,
      steps: [
        ...(skipped !== null
          ? [
              {
                id: 9001,
                sequence: 1,
                approverUserId: skipped.userId,
                committee: null,
                requiredDecisionType: decisionType,
                status: 'skipped' as const,
                decidedByUserId: null,
                actingForUserId: null,
                delegationId: null,
                decisionReason: 'The amount exceeds this approver’s authority.',
                conditions: null,
                decidedAt: requestedAt,
                authorityCheckedAmount: body.amount ?? null,
              },
            ]
          : []),
        {
          id: 9002,
          sequence: skipped !== null ? 2 : 1,
          approverUserId: first.userId,
          committee: null,
          requiredDecisionType: decisionType,
          status: 'pending',
          decidedByUserId: null,
          actingForUserId: null,
          delegationId: null,
          decisionReason: null,
          conditions: null,
          decidedAt: null,
          authorityCheckedAmount: null,
        },
      ],
      evidence: [],
      snapshotCapturedAt: requestedAt,
      snapshotFacts: [
        { key: 'version', label: 'Version', value: String(body.subjectVersion), changedSince: false },
        ...(body.amount === undefined
          ? []
          : [{ key: 'amount', label: 'Amount', value: `${body.amount.currency} ${body.amount.amount}`, changedSince: false }]),
      ],
      routing:
        skipped !== null
          ? { reason: 'authority_exceeded', skippedUserId: skipped.userId, routedToUserId: first.userId, routedAt: requestedAt, note: null }
          : null,
      invalidation: null,
      conflicts: [],
      sod: null,
      holdActive: false,
    };
    return toApprovalDetail(fixture, { userId: persona.userId, permissions });
  });

  mockRoute(app, withdrawApproval, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const { tenant, permissions } = requireTenant();
    const persona = requirePersona();
    const approval = findFixtureApproval(params.approvalId);
    if (approval === undefined || approval.tenantId !== tenant.id) {
      return fail(404, 'APPROVAL_NOT_FOUND');
    }
    if (approval.status !== 'pending') {
      return fail(409, 'APPROVAL_NOT_PENDING', 'Only a pending approval can be withdrawn.');
    }
    if (approval.requestedByUserId !== persona.userId) {
      return fail(403, 'NOT_APPROVAL_REQUESTER', 'Only the requester can withdraw this approval.');
    }
    const withdrawnAt = iso(now);
    const outcome: FixtureApproval = {
      ...approval,
      status: 'withdrawn',
      decidedAt: withdrawnAt,
      invalidatedReason: null,
      conditions: null,
      justification: approval.justification,
      steps: approval.steps.map((step) =>
        step.status === 'pending' ? { ...step, status: 'skipped', decisionReason: `Withdrawn: ${body.reason}`, decidedAt: withdrawnAt } : step,
      ),
    };
    return toApprovalDetail(outcome, { userId: persona.userId, permissions });
  });

  mockRoute(app, checkAuthority, ({ requireTenant, query, now, fail }) => {
    const { tenant } = requireTenant();
    const amount = { amount: query.amount, currency: query.currency };
    const approvers = eligibleApprovers(tenant.id, query.subjectType, amount, iso(now));
    const sufficient = approvers.filter((approver) => approver.check.sufficient);
    if (sufficient.length === 0) {
      return fail(422, 'NO_ELIGIBLE_APPROVER', 'Nobody in the organization holds the authority for this amount.');
    }
    const firstLevel = approvers[0] ?? null;
    const skippedLevel = firstLevel !== null && !firstLevel.check.sufficient ? firstLevel : null;
    const hint: AuthorityCheckHint = {
      subjectType: query.subjectType,
      decisionType: APPROVAL_AUTHORITY_DECISION_TYPES[query.subjectType],
      amount,
      eligibleApprovers: sufficient,
      routedToNextLevel: skippedLevel !== null,
      skippedLevel,
    };
    return hint;
  });
}

