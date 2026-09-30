/**
 * Approval projections of the mock API: the authority check (BR-06, DD-24), the viewer's own step and its blockers
 * (BR-07, DD-25, BR-10), and the contract shapes of COM-04/COM-05 and the approval panels.
 */
import type {
  ApprovalBlocker,
  ApprovalDecision,
  ApprovalDetail,
  ApprovalEvidence,
  ApprovalInvolvement,
  ApprovalStep,
  ApprovalSummary,
  AuthorityCheck,
  MyApprovalStep,
} from '../../../contracts/approvals.js';
import { APPROVAL_AUTHORITY_DECISION_TYPES, APPROVAL_DECISION_PERMISSIONS } from '../../../contracts/approvals.js';
import type { Money } from '../../../contracts/common.js';
import { gt, mul, round } from '../../../contracts/decimal.js';
import type { AuthorityLimitsDecisionType } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import {
  APPROVALS,
  AUTHORITY_LIMITS,
  EXCHANGE_RATES,
  WORKSPACE_AS_OF,
  delegationFor,
  findFixtureApproval,
} from '../../fixtures/approvals.js';
import type { FixtureApproval, FixtureApprovalStep } from '../../fixtures/approvals.js';
import { findFixtureDocument } from '../../fixtures/documents.js';
import { findPersonaById, organizationLabel, personRef } from '../../persona.js';
import { latestConfirmed } from '../documents/access.js';
import type { AccessScope } from '../documents/access.js';
import { canRead } from '../documents/access.js';
import { subjectLinkFor } from './links.js';

export { findFixtureApproval };

/** True when the approval is pending and its due date lies before the storyline "now". */
export function isOverdue(approval: Pick<FixtureApproval, 'status' | 'dueAt'>): boolean {
  return approval.status === 'pending' && approval.dueAt !== null && Date.parse(approval.dueAt) < Date.parse(WORKSPACE_AS_OF);
}

// ---------------------------------------------------------------------------------------------------------
// Authority
// ---------------------------------------------------------------------------------------------------------

function convert(amount: Money, toCurrency: string, rateDate: string): { converted: Money; rate: string; rateDate: string; source: string } | null {
  const rate = EXCHANGE_RATES.find(
    (candidate) => candidate.fromCurrency === amount.currency && candidate.toCurrency === toCurrency && candidate.rateDate <= rateDate,
  );
  if (rate === undefined) {
    return null;
  }
  return {
    converted: { amount: round(mul(amount.amount, rate.rate), 2), currency: toCurrency },
    rate: rate.rate,
    rateDate: rate.rateDate,
    source: rate.source,
  };
}

/**
 * The authority check of `userId` for `decisionType` and `amount` in `tenantId` (BR-06, DD-24). `actingForUserId`
 * checks the delegation the user acts under instead of their own limit. Cross-currency amounts use the rate at the
 * request date; with no rate the check fails and the step routes to the next level (never an assumed pass).
 */
export function authorityCheck(
  tenantId: number,
  userId: number,
  decisionType: AuthorityLimitsDecisionType | null,
  amount: Money | null,
  requestedAt: string,
  actingForUserId: number | null = null,
): AuthorityCheck {
  const base = {
    decisionType,
    amount,
    delegatedFrom: null,
    conversion: null,
    missingExchangeRate: false,
    routedToNextLevel: false,
  };
  if (decisionType === null) {
    return { ...base, sufficient: true, basis: 'unlimited', limit: null };
  }
  let limit: Money | null;
  let basis: AuthorityCheck['basis'];
  let delegatedFrom: AuthorityCheck['delegatedFrom'] = null;
  if (actingForUserId !== null) {
    const delegation = delegationFor(tenantId, userId, actingForUserId, decisionType);
    if (delegation === undefined) {
      return { ...base, sufficient: false, basis: 'none', limit: null };
    }
    limit = delegation.maxAmount;
    basis = 'delegation';
    delegatedFrom = personRef(delegation.delegatorUserId);
  } else {
    const own = AUTHORITY_LIMITS.find(
      (candidate) => candidate.tenantId === tenantId && candidate.userId === userId && candidate.decisionTypes.includes(decisionType),
    );
    if (own === undefined) {
      return { ...base, sufficient: false, basis: 'none', limit: null };
    }
    limit = own.maxAmount;
    basis = own.maxAmount === null ? 'unlimited' : 'authority_limit';
  }
  if (amount === null || limit === null) {
    return { ...base, delegatedFrom, sufficient: true, basis, limit };
  }
  if (amount.currency === limit.currency) {
    const sufficient = !gt(amount.amount, limit.amount);
    return { ...base, delegatedFrom, sufficient, basis, limit, routedToNextLevel: !sufficient };
  }
  const conversion = convert(amount, limit.currency, requestedAt.slice(0, 10));
  if (conversion === null) {
    return { ...base, delegatedFrom, sufficient: false, basis, limit, missingExchangeRate: true, routedToNextLevel: true };
  }
  const sufficient = !gt(conversion.converted.amount, limit.amount);
  return {
    ...base,
    delegatedFrom,
    sufficient,
    basis,
    limit,
    conversion: {
      rate: conversion.rate,
      rateDate: conversion.rateDate,
      source: conversion.source,
      convertedAmount: conversion.converted,
    },
    routedToNextLevel: !sufficient,
  };
}

/** The limit of a user for a decision type (routing hints). */
export function limitOf(tenantId: number, userId: number, decisionType: AuthorityLimitsDecisionType | null): Money | null {
  if (decisionType === null) {
    return null;
  }
  return (
    AUTHORITY_LIMITS.find(
      (candidate) => candidate.tenantId === tenantId && candidate.userId === userId && candidate.decisionTypes.includes(decisionType),
    )?.maxAmount ?? null
  );
}

// ---------------------------------------------------------------------------------------------------------
// Viewer position
// ---------------------------------------------------------------------------------------------------------

/** The step awaiting a decision: the first pending step of a pending approval. */
export function currentStepOf(approval: FixtureApproval): FixtureApprovalStep | null {
  if (approval.status !== 'pending') {
    return null;
  }
  return approval.steps.find((step) => step.status === 'pending') ?? null;
}

/** The viewer's step (own, or through a delegation of the step's approver) and whom they act for. */
export function viewerStep(approval: FixtureApproval, userId: number): { step: FixtureApprovalStep; actingFor: number | null } | null {
  const own = approval.steps.find((step) => step.approverUserId === userId || step.decidedByUserId === userId);
  if (own !== undefined) {
    return { step: own, actingFor: own.actingForUserId };
  }
  for (const step of approval.steps) {
    if (step.approverUserId !== null && delegationFor(approval.tenantId, userId, step.approverUserId, step.requiredDecisionType) !== undefined) {
      return { step, actingFor: step.approverUserId };
    }
  }
  return null;
}

/** How the viewer is involved, or `null` when the approval is not theirs to see in the inbox. */
export function involvementOf(approval: FixtureApproval, userId: number): ApprovalInvolvement | null {
  const mine = viewerStep(approval, userId);
  if (mine !== null) {
    return mine.actingFor === null ? 'approver' : 'delegate';
  }
  return approval.requestedByUserId === userId ? 'requester' : null;
}

/** Why the viewer cannot decide right now, in the order the service checks them. */
export function blockersFor(approval: FixtureApproval, userId: number, permissions: readonly PermissionCode[]): ApprovalBlocker[] {
  const blockers: ApprovalBlocker[] = [];
  const mine = viewerStep(approval, userId);
  if (approval.status !== 'pending') {
    blockers.push('approval_not_pending');
  }
  if (mine === null) {
    blockers.push('not_assigned_approver');
    return blockers;
  }
  const current = currentStepOf(approval);
  if (approval.status === 'pending' && (current === null || current.id !== mine.step.id)) {
    blockers.push('not_current_step');
  }
  const decisionPermission = APPROVAL_DECISION_PERMISSIONS[approval.subjectType];
  if (!permissions.includes('approval.decide') || !permissions.includes(decisionPermission)) {
    blockers.push('decision_permission_missing');
  }
  const check = authorityCheck(
    approval.tenantId,
    userId,
    mine.step.requiredDecisionType,
    approval.amount,
    approval.requestedAt,
    mine.actingFor,
  );
  if (check.missingExchangeRate) {
    blockers.push('exchange_rate_missing');
  } else if (!check.sufficient) {
    blockers.push('authority_insufficient');
  }
  if (approval.sod !== null && approval.sod.mode === 'enforced' && approval.sod.blockedUserIds.includes(userId)) {
    blockers.push('sod_blocked');
  }
  const conflict = approval.conflicts.find((candidate) => candidate.userId === userId);
  if (conflict !== undefined) {
    if (conflict.declarationRequired && !conflict.declared) {
      blockers.push('conflict_declaration_required');
    } else if (
      conflict.hasConflict === true &&
      conflict.disposition !== 'cleared' &&
      conflict.disposition !== 'mitigated'
    ) {
      blockers.push('conflict_unresolved');
    }
  }
  if (approval.subjectVersion !== approval.currentSubjectVersion) {
    blockers.push('version_changed');
  }
  if (approval.holdActive) {
    blockers.push('hold_active');
  }
  if (approval.status === 'pending' && (approval.subjectGates ?? []).length > 0) {
    blockers.push('subject_gate_blocked');
  }
  return blockers;
}

export function myStepOf(approval: FixtureApproval, userId: number, permissions: readonly PermissionCode[]): MyApprovalStep | null {
  const mine = viewerStep(approval, userId);
  if (mine === null) {
    return null;
  }
  const blockers = blockersFor(approval, userId, permissions);
  return {
    stepId: mine.step.id,
    sequence: mine.step.sequence,
    status: mine.step.status,
    requiredDecisionType: mine.step.requiredDecisionType,
    actingFor: mine.actingFor === null ? null : personRef(mine.actingFor),
    canDecide: blockers.length === 0 && mine.step.status === 'pending',
    blockers,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------------------------------------

function capacityOf(tenantId: number, userId: number): string | null {
  return findPersonaById(userId)?.memberships.find((membership) => membership.tenantId === tenantId)?.capacity ?? null;
}

export function toStep(step: FixtureApprovalStep): ApprovalStep {
  return {
    id: step.id,
    sequence: step.sequence,
    approver: step.approverUserId === null ? null : personRef(step.approverUserId),
    committee: step.committee,
    requiredDecisionType: step.requiredDecisionType,
    status: step.status,
    decidedBy: step.decidedByUserId === null ? null : personRef(step.decidedByUserId),
    actingFor: step.actingForUserId === null ? null : personRef(step.actingForUserId),
    delegationId: step.delegationId,
    decisionReason: step.decisionReason,
    conditions: step.conditions,
    decidedAt: step.decidedAt,
    authorityCheckedAmount: step.authorityCheckedAmount,
  };
}

export function toApprovalSummary(approval: FixtureApproval): ApprovalSummary {
  const current = currentStepOf(approval);
  return {
    id: approval.id,
    subjectType: approval.subjectType,
    subjectId: approval.subjectId,
    subjectReference: approval.subjectReference,
    subjectVersion: approval.subjectVersion,
    contentHash: approval.contentHash,
    title: approval.title,
    status: approval.status,
    amount: approval.amount,
    requestedBy: personRef(approval.requestedByUserId),
    requestedAt: approval.requestedAt,
    dueAt: approval.dueAt,
    expiresAt: approval.expiresAt,
    decidedAt: approval.decidedAt,
    routeMode: approval.routeMode,
    currentStep: current === null ? null : toStep(current),
    isOverdue: isOverdue(approval),
  };
}

function evidenceFor(approval: FixtureApproval, scope: AccessScope | null): ApprovalEvidence[] {
  const items: ApprovalEvidence[] = [];
  for (const pinned of approval.evidence) {
    const document = findFixtureDocument(pinned.documentId);
    const version = document?.versions.find((candidate) => candidate.id === pinned.versionId);
    if (document === undefined || version === undefined || (scope !== null && !canRead(document, scope))) {
      continue;
    }
    // The version captured with the snapshot, never a later one (BR-10).
    items.push({
      documentId: document.id,
      versionId: version.id,
      title: document.title,
      classification: document.classification,
      versionNo: version.versionNo,
      latestVersionNo: latestConfirmed(document)?.versionNo ?? version.versionNo,
      isRedactedCopy: document.isRedactedCopy,
    });
  }
  return items;
}

function allowedDecisionsFor(approval: FixtureApproval, myStep: MyApprovalStep | null): ApprovalDecision[] {
  if (myStep === null || !myStep.canDecide) {
    return [];
  }
  return approval.conditionsPermitted
    ? ['approve', 'approve_with_conditions', 'reject', 'return']
    : ['approve', 'reject', 'return'];
}

/**
 * COM-05 for a viewer (`userId` with `permissions` in the approval's tenant). A `null` viewer (a buyer panel read
 * by someone who is not on the route) gets no own step and no decisions.
 */
export function toApprovalDetail(
  approval: FixtureApproval,
  viewer: { userId: number; permissions: readonly PermissionCode[] } | null,
): ApprovalDetail {
  const myStep = viewer === null ? null : myStepOf(approval, viewer.userId, viewer.permissions);
  const mine = viewer === null ? null : viewerStep(approval, viewer.userId);
  const current = currentStepOf(approval);
  const checkedStep = mine?.step ?? current ?? approval.steps[approval.steps.length - 1] ?? null;
  const checkedUser = mine !== null && viewer !== null ? viewer.userId : (checkedStep?.approverUserId ?? null);
  const authority =
    checkedStep === null || checkedUser === null
      ? null
      : authorityCheck(
          approval.tenantId,
          checkedUser,
          checkedStep.requiredDecisionType ?? APPROVAL_AUTHORITY_DECISION_TYPES[approval.subjectType],
          approval.amount,
          approval.requestedAt,
          mine?.actingFor ?? null,
        );
  const conflict = viewer === null ? undefined : approval.conflicts.find((candidate) => candidate.userId === viewer.userId);
  const blocksDecision = myStep?.blockers.some((blocker) => blocker === 'conflict_unresolved' || blocker === 'conflict_declaration_required') ?? false;
  const routing = approval.routing;
  const routedStep = routing === null ? null : approval.steps.find((step) => step.approverUserId === routing.routedToUserId) ?? null;
  const skippedStep = routing === null ? null : approval.steps.find((step) => step.approverUserId === routing.skippedUserId) ?? null;
  const scope = viewer === null ? null : { tenantId: approval.tenantId, permissions: viewer.permissions };
  const related = APPROVALS.filter(
    (candidate) =>
      candidate.id !== approval.id &&
      candidate.tenantId === approval.tenantId &&
      candidate.subjectType === approval.subjectType &&
      candidate.subjectId === approval.subjectId,
  ).sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  return {
    ...toApprovalSummary(approval),
    organization: organizationLabel(approval.tenantId),
    summary: approval.summary,
    justification: approval.justification,
    legalEntity: approval.legalEntity,
    category: approval.category,
    subjectLinkPath: viewer === null ? approval.subjectLinkPath : subjectLinkFor(approval.subjectLinkPath, viewer.permissions),
    currentSubjectVersion: approval.currentSubjectVersion,
    conditions: approval.conditions,
    invalidatedReason: approval.invalidatedReason,
    invalidatedAt: approval.invalidatedAt,
    committee: approval.committee,
    steps: approval.steps.map(toStep),
    evidence: evidenceFor(approval, scope),
    decisionPermission: APPROVAL_DECISION_PERMISSIONS[approval.subjectType],
    conflict: {
      declarationRequired: conflict?.declarationRequired ?? false,
      declared: conflict?.declared ?? false,
      hasConflict: conflict?.hasConflict ?? null,
      disposition: conflict?.disposition ?? null,
      blocksDecision,
    },
    sod: {
      rule: approval.sod?.rule ?? null,
      mode: approval.sod?.mode ?? null,
      blocked: viewer !== null && approval.sod !== null && approval.sod.mode === 'enforced' && approval.sod.blockedUserIds.includes(viewer.userId),
      alternativeOversightNote: approval.sod?.alternativeOversightNote ?? null,
    },
    authority,
    myStep,
    allowedDecisions: allowedDecisionsFor(approval, myStep),
    conditionsPermitted: approval.conditionsPermitted,
    versionSnapshot: {
      subjectVersion: approval.subjectVersion,
      contentHash: approval.contentHash,
      capturedAt: approval.snapshotCapturedAt,
      facts: approval.snapshotFacts.map((fact) => ({ ...fact })),
    },
    routing:
      routing === null
        ? null
        : {
            reason: routing.reason,
            skipped: routing.skippedUserId === null ? null : personRef(routing.skippedUserId),
            skippedCapacity: routing.skippedUserId === null ? null : capacityOf(approval.tenantId, routing.skippedUserId),
            skippedLimit:
              routing.skippedUserId === null
                ? null
                : limitOf(approval.tenantId, routing.skippedUserId, skippedStep?.requiredDecisionType ?? null),
            routedTo: routing.routedToUserId === null ? null : personRef(routing.routedToUserId),
            routedToCapacity: routing.routedToUserId === null ? null : capacityOf(approval.tenantId, routing.routedToUserId),
            routedToLimit:
              routing.routedToUserId === null
                ? null
                : limitOf(approval.tenantId, routing.routedToUserId, routedStep?.requiredDecisionType ?? null),
            routedAt: routing.routedAt,
            note: routing.note,
          },
    invalidation:
      approval.invalidation === null
        ? null
        : {
            changedAt: approval.invalidation.changedAt,
            changedBy: approval.invalidation.changedByUserId === null ? null : personRef(approval.invalidation.changedByUserId),
            fromVersion: approval.invalidation.fromVersion,
            toVersion: approval.invalidation.toVersion,
            changes: approval.invalidation.changes.map((change) => ({ ...change })),
            replacementApprovalId: approval.invalidation.replacementApprovalId,
          },
    subjectGates: approval.status === 'pending' ? (approval.subjectGates ?? []).map((gate) => ({ ...gate })) : [],
    relatedApprovals: related.map(toApprovalSummary),
  };
}
