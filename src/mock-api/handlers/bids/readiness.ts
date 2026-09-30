/**
 * Completeness review of a revision (FR-11): blocking errors separated from warnings, plus the internal review
 * (SUP-15) and the final submission preview (SUP-16) built on it. Readiness is never a submission (AC-11).
 */
import type {
  BidReadiness,
  InternalApproval,
  InternalReview,
  ReadinessCategory,
  ReadinessCode,
  ReadinessItem,
  RequiredApproval,
  SubmissionPreview,
  SubmitBlockReason,
} from '../../../contracts/bids.js';
import { sum } from '../../../contracts/decimal.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import {
  BID_ADDENDA,
  BID_ACKNOWLEDGMENTS,
  BID_DECLARATIONS,
  BID_EXCEPTIONS,
  BID_INTERNAL_APPROVALS,
  BID_SUBCONTRACTORS,
  SUPPLIER_APPROVAL_POLICIES,
  requirementsForLots,
} from '../../fixtures/bids/index.js';
import type { FixtureBid, FixtureBidTender, FixtureInternalApproval, FixtureRevision } from '../../fixtures/bids/index.js';
import { findPersonaById, personRef } from '../../persona.js';
import { pricingOf } from './pricing.js';
import {
  answerOf,
  attachmentsOf,
  deadlineOf,
  effectiveOfferOf,
  evidenceOf,
  hasContent,
  lotRefs,
  responseLinks,
  tenderRef,
  toRevision,
} from './project.js';
import { effectiveReceipt, isoOf, legalNameOf, supplierTeam, viewerOf, windowOpen, workingRevision } from './state.js';

interface Finding {
  readonly category: ReadinessCategory;
  readonly severity: 'blocking' | 'warning';
  readonly code: ReadinessCode;
  readonly count?: number;
  readonly subject?: string;
  readonly requirementIds?: readonly number[];
  readonly link?: string;
}

/** The state of each approval type the supplier's policy requires, for the revision's current content. */
export function requiredApprovalsOf(bid: FixtureBid, revision: FixtureRevision, extra: readonly FixtureInternalApproval[] = []): RequiredApproval[] {
  const policy = SUPPLIER_APPROVAL_POLICIES[bid.supplierTenantId] ?? [];
  const rows = [...BID_INTERNAL_APPROVALS, ...extra].filter((row) => row.revisionId === revision.id);
  return policy.map((approvalType) => {
    const ofType = rows.filter((row) => row.approvalType === approvalType).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id - a.id);
    const latest = ofType[0];
    if (latest === undefined) {
      return { approvalType, state: 'missing', approvalId: null };
    }
    if (latest.status === 'approved') {
      return latest.contentHashAtDecision === revision.contentHash
        ? { approvalType, state: 'approved', approvalId: latest.id }
        : { approvalType, state: 'invalidated', approvalId: latest.id };
    }
    if (latest.status === 'pending') {
      return { approvalType, state: 'pending', approvalId: latest.id };
    }
    return { approvalType, state: latest.status, approvalId: latest.id };
  });
}

export function readinessOf(
  bid: FixtureBid,
  tender: FixtureBidTender,
  revision: FixtureRevision,
  permissions: readonly PermissionCode[],
  now: Date,
): BidReadiness {
  const findings: Finding[] = [];
  const passed = new Set<ReadinessCategory>();
  const flag = (category: ReadinessCategory, finding: Omit<Finding, 'category'> | null): void => {
    if (finding === null) {
      return;
    }
    findings.push({ category, ...finding });
  };

  // Deadline.
  if (!windowOpen(tender, bid.roundType, now)) {
    flag('deadline', { severity: 'blocking', code: 'SUBMISSION_WINDOW_CLOSED', subject: tender.reference });
  }

  // Lots and participation.
  if (bid.lotIds.length === 0) {
    flag('lots', { severity: 'blocking', code: 'NO_LOTS_SELECTED', link: responseLinks.answers(bid.id) });
  }
  const unavailableLots = tender.lots.filter((lot) => bid.lotIds.includes(lot.id) && (lot.stage === 'cancelled' || lot.stage === 'no_award'));
  const notInvited = tender.invitedSupplierTenantIds !== null && !tender.invitedSupplierTenantIds.includes(bid.supplierTenantId);
  if (notInvited || unavailableLots.length > 0) {
    flag('participation', {
      severity: 'blocking',
      code: 'PARTICIPATION_CONDITION_UNMET',
      subject: notInvited ? tender.reference : unavailableLots.map((lot) => `Lot ${lot.lotNo}`).join(', '),
      link: responseLinks.opportunity(tender.id),
    });
  }

  // Answers.
  const requirements = requirementsForLots(tender.id, bid.lotIds);
  const missing: number[] = [];
  const incomplete: number[] = [];
  const reuse: number[] = [];
  const deviations: number[] = [];
  for (const requirement of requirements) {
    const answer = answerOf(revision.id, requirement.id);
    const content = hasContent(requirement, answer, attachmentsOf(answer?.id).length);
    if (!content && requirement.missingConsequence === 'reject') {
      missing.push(requirement.id);
    } else if (!content || answer?.progress !== 'complete') {
      incomplete.push(requirement.id);
    }
    if (answer?.reuse !== null && answer?.reuse !== undefined && answer.reuse.reviewedAt === null) {
      reuse.push(requirement.id);
    }
    if (answer?.isDeviation === true) {
      deviations.push(requirement.id);
    }
  }
  const answersLink = responseLinks.answers(bid.id);
  if (missing.length > 0) {
    flag('answers', { severity: 'blocking', code: 'REQUIRED_ANSWER_MISSING', count: missing.length, requirementIds: missing, link: answersLink });
  }
  if (incomplete.length > 0) {
    flag('answers', { severity: 'warning', code: 'ANSWER_NOT_COMPLETE', count: incomplete.length, requirementIds: incomplete, link: answersLink });
  }
  if (reuse.length > 0) {
    flag('answers', { severity: 'warning', code: 'REUSED_CONTENT_NOT_REVIEWED', count: reuse.length, requirementIds: reuse, link: answersLink });
  }
  if (deviations.length > 0) {
    flag('answers', { severity: 'warning', code: 'DEVIATION_DECLARED', count: deviations.length, requirementIds: deviations, link: answersLink });
  }

  // Pricing: completeness is reported to every team member; amounts never are.
  const pricing = pricingOf(bid, tender, revision, false);
  const pricingLink = responseLinks.pricing(bid.id);
  if (pricing.totals.missingCount > 0 && pricing.issues.some((issue) => issue.code === 'PRICE_MISSING')) {
    flag('pricing', {
      severity: 'blocking',
      code: 'PRICING_INCOMPLETE',
      count: pricing.issues.filter((issue) => issue.code === 'PRICE_MISSING').length,
      link: pricingLink,
    });
  }
  const pricingBlocking = pricing.issues.filter((issue) => issue.severity === 'blocking' && issue.code !== 'PRICE_MISSING');
  const pricingWarnings = pricing.issues.filter((issue) => issue.severity === 'warning');
  if (pricingBlocking.length > 0) {
    flag('pricing', { severity: 'blocking', code: 'PRICING_INCONSISTENT', count: pricingBlocking.length, link: pricingLink });
  } else if (pricingWarnings.length > 0) {
    flag('pricing', { severity: 'warning', code: 'PRICING_INCONSISTENT', count: pricingWarnings.length, link: pricingLink });
  }

  // Declarations and exceptions.
  const declarationsLink = responseLinks.declarations(bid.id);
  const declarations = BID_DECLARATIONS.filter((row) => row.revisionId === revision.id);
  const unconfirmed = declarations.filter((row) => row.accepted === null);
  const explained = declarations.filter((row) => row.accepted === false);
  if (unconfirmed.length > 0) {
    flag('declarations', { severity: 'blocking', code: 'DECLARATION_NOT_CONFIRMED', count: unconfirmed.length, link: declarationsLink });
  }
  if (explained.length > 0) {
    flag('declarations', { severity: 'warning', code: 'DECLARATION_EXPLAINED', count: explained.length, link: declarationsLink });
  }
  const exceptionCount = BID_EXCEPTIONS.filter((row) => row.revisionId === revision.id).length;
  if (exceptionCount > 0) {
    flag('declarations', { severity: 'warning', code: 'CONTRACT_EXCEPTIONS_DECLARED', count: exceptionCount, link: declarationsLink });
  }

  // Evidence.
  for (const evidence of evidenceOf(bid, tender, revision.id)) {
    const expired = evidence.status === 'expired' || (evidence.expiresAt !== null && Date.parse(evidence.expiresAt) <= now.getTime());
    if (expired) {
      flag('evidence', { severity: 'blocking', code: 'EVIDENCE_EXPIRED', subject: evidence.title, link: declarationsLink });
    } else if (evidence.expiresDuringValidity) {
      flag('evidence', { severity: 'warning', code: 'EVIDENCE_EXPIRES_DURING_VALIDITY', subject: evidence.title, link: declarationsLink });
    }
  }

  // Addenda (DD-42: acknowledgments are authoritative).
  for (const addendum of BID_ADDENDA.filter((row) => row.tenderId === tender.id)) {
    const acknowledged = BID_ACKNOWLEDGMENTS.some((row) => row.addendumId === addendum.id && row.supplierTenantId === bid.supplierTenantId);
    if (addendum.acknowledgmentRequired && !acknowledged) {
      flag('addenda', { severity: 'blocking', code: 'ADDENDUM_NOT_ACKNOWLEDGED', subject: `Addendum ${addendum.number}: ${addendum.title}`, link: responseLinks.opportunity(tender.id) });
    }
    if (
      (addendum.existingSubmissionAction === 'supplement' || addendum.existingSubmissionAction === 'replace') &&
      revision.acknowledgedTenderVersion < addendum.resultingVersionNo
    ) {
      flag('addenda', { severity: 'blocking', code: 'ADDENDUM_SUPPLEMENT_REQUIRED', subject: `Addendum ${addendum.number}: ${addendum.title}`, link: answersLink });
    }
  }

  // Internal approval.
  const reviewLink = responseLinks.review(bid.id);
  for (const required of requiredApprovalsOf(bid, revision)) {
    if (required.state === 'approved') {
      continue;
    }
    const code: ReadinessCode =
      required.state === 'pending' ? 'INTERNAL_APPROVAL_PENDING' : required.state === 'invalidated' ? 'INTERNAL_APPROVAL_INVALIDATED' : 'INTERNAL_APPROVAL_MISSING';
    flag('approval', { severity: 'blocking', code, subject: required.approvalType, link: reviewLink });
  }

  // Authority to submit (AC-03).
  const submitters = supplierTeam(bid.supplierTenantId).filter((row) => row.member.canSubmit);
  if (!permissions.includes('supplier.response.submit')) {
    flag('authority', {
      severity: submitters.length === 0 ? 'blocking' : 'warning',
      code: 'SUBMIT_AUTHORITY_MISSING',
      subject: submitters.map((row) => row.member.fullName).join(', '),
      link: responseLinks.submit(bid.id),
    });
  }

  for (const category of ['lots', 'answers', 'pricing', 'declarations', 'evidence', 'addenda', 'participation', 'approval', 'authority', 'deadline'] as const) {
    if (!findings.some((finding) => finding.category === category)) {
      passed.add(category);
    }
  }

  const items: ReadinessItem[] = findings.map((finding, index) => ({
    id: `${finding.category}-${finding.code.toLowerCase()}-${index + 1}`,
    category: finding.category,
    severity: finding.severity,
    code: finding.code,
    count: finding.count ?? null,
    subject: finding.subject === undefined || finding.subject === '' ? null : finding.subject,
    requirementIds: [...(finding.requirementIds ?? [])],
    link: finding.link ?? null,
  }));
  for (const category of passed) {
    items.push({ id: `${category}-passed`, category, severity: 'passed', code: 'CHECK_PASSED', count: null, subject: null, requirementIds: [], link: null });
  }
  const blockingCount = items.filter((item) => item.severity === 'blocking').length;
  return {
    bidId: bid.id,
    revisionId: revision.id,
    revisionNo: revision.revisionNo,
    revisionStatus: revision.status,
    checkedAt: isoOf(now),
    ready: blockingCount === 0,
    blockingCount,
    warningCount: items.filter((item) => item.severity === 'warning').length,
    items,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Internal review (SUP-15)
// ---------------------------------------------------------------------------------------------------------

export function toInternalApproval(row: FixtureInternalApproval, revisionNo: number): InternalApproval {
  return {
    id: row.id,
    bidId: row.bidId,
    revisionId: row.revisionId,
    revisionNo,
    approvalType: row.approvalType,
    approver: personRef(row.approverUserId),
    status: row.status,
    requestedBy: personRef(row.requestedBy),
    requestedAt: row.requestedAt,
    contentHashAtDecision: row.contentHashAtDecision,
    decidedAt: row.decidedAt,
    note: row.note,
    invalidatedAt: row.invalidatedAt,
  };
}

export function internalReviewOf(
  bid: FixtureBid,
  tender: FixtureBidTender,
  revision: FixtureRevision,
  revisionsById: ReadonlyMap<number, FixtureRevision>,
  permissions: readonly PermissionCode[],
  now: Date,
  approvalsOverride?: readonly FixtureInternalApproval[],
): InternalReview {
  const approvalRows = approvalsOverride ?? BID_INTERNAL_APPROVALS.filter((row) => row.bidId === bid.id);
  const byNewest = [...approvalRows].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id - a.id);
  const revisionNo = (row: FixtureInternalApproval): number => revisionsById.get(row.revisionId)?.revisionNo ?? revision.revisionNo;
  const viewer = viewerOf(permissions);
  const pricing = pricingOf(bid, tender, revision, false);
  const ofRevision = byNewest.filter((row) => row.revisionId === revision.id);
  const requiredApprovals = approvalsOverride === undefined ? requiredApprovalsOf(bid, revision) : requiredFromRows(bid, revision, approvalsOverride);
  return {
    bidId: bid.id,
    revision: toRevision(revision, bid),
    readiness: readinessOf(bid, tender, revision, permissions, now),
    commercialExposure: {
      visible: viewer.canViewPricing,
      totalOneTime: viewer.canViewPricing ? pricing.totals.oneTime.gross : null,
      recurring: viewer.canViewPricing ? pricing.totals.recurring.map((row) => ({ recurrence: row.recurrence, gross: row.gross })) : [],
      validityDays: pricing.commercialTerms.validityDays,
      exceptionCount: BID_EXCEPTIONS.filter((row) => row.revisionId === revision.id).length,
      deviationCount: requirementsForLots(tender.id, bid.lotIds).filter((requirement) => answerOf(revision.id, requirement.id)?.isDeviation === true).length,
      subcontractedSharePercent: sum(BID_SUBCONTRACTORS.filter((row) => row.revisionId === revision.id).map((row) => row.sharePercent)),
    },
    requiredApprovals,
    approvals: ofRevision.map((row) => toInternalApproval(row, revisionNo(row))),
    history: byNewest.map((row) => toInternalApproval(row, revisionNo(row))),
    materialChangeSinceApproval: ofRevision.some(
      (row) => row.contentHashAtDecision !== null && row.contentHashAtDecision !== revision.contentHash,
    ),
    eligibleApprovers: supplierTeam(bid.supplierTenantId)
      .filter((row) => row.member.canApprove)
      .map((row) => ({ userId: row.member.userId, fullName: row.member.fullName })),
    viewer,
  };
}

function requiredFromRows(bid: FixtureBid, revision: FixtureRevision, rows: readonly FixtureInternalApproval[]): RequiredApproval[] {
  const policy = SUPPLIER_APPROVAL_POLICIES[bid.supplierTenantId] ?? [];
  return policy.map((approvalType) => {
    const latest = rows
      .filter((row) => row.revisionId === revision.id && row.approvalType === approvalType)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id - a.id)[0];
    if (latest === undefined) {
      return { approvalType, state: 'missing', approvalId: null };
    }
    if (latest.status === 'approved') {
      return { approvalType, state: latest.contentHashAtDecision === revision.contentHash ? 'approved' : 'invalidated', approvalId: latest.id };
    }
    return { approvalType, state: latest.status === 'pending' ? 'pending' : latest.status, approvalId: latest.id };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Submission preview (SUP-16)
// ---------------------------------------------------------------------------------------------------------

export function submissionPreviewOf(
  bid: FixtureBid,
  tender: FixtureBidTender,
  personaUserId: number,
  capacity: string | null,
  permissions: readonly PermissionCode[],
  now: Date,
): SubmissionPreview {
  const revision = workingRevision(bid);
  const readiness = revision === null ? null : readinessOf(bid, tender, revision, permissions, now);
  const open = windowOpen(tender, bid.roundType, now);
  const canSubmitPermission = permissions.includes('supplier.response.submit');
  const blockReasons: SubmitBlockReason[] = [];
  if (!canSubmitPermission) blockReasons.push('SUBMIT_PERMISSION_MISSING');
  if (!open) blockReasons.push('SUBMISSION_WINDOW_CLOSED');
  if (revision === null) blockReasons.push('NO_WORKING_REVISION');
  // The caller's own missing authority is reported above, not as a readiness block.
  const blockingOther = readiness?.items.some((item) => item.severity === 'blocking' && item.category !== 'authority' && item.category !== 'deadline') ?? false;
  if (blockingOther) blockReasons.push('READINESS_BLOCKING');
  const person = findPersonaById(personaUserId);
  const exceptionCount = revision === null ? 0 : BID_EXCEPTIONS.filter((row) => row.revisionId === revision.id).length;
  const deviationCount =
    revision === null
      ? 0
      : requirementsForLots(tender.id, bid.lotIds).filter((requirement) => answerOf(revision.id, requirement.id)?.isDeviation === true).length;
  const validity = revision === null ? tender.bidValidityDays : (pricingOf(bid, tender, revision, false).commercialTerms.validityDays ?? tender.bidValidityDays);
  return {
    bidId: bid.id,
    tender: tenderRef(tender),
    revision: revision === null ? null : toRevision(revision, bid),
    legalParty: { tenantId: bid.supplierTenantId, legalName: legalNameOf(bid.supplierTenantId) },
    // Only a holder of submit authority represents the legal party in the declaration (FR-11, AC-03).
    representative: canSubmitPermission ? { userId: personaUserId, fullName: person?.fullName ?? 'Unknown', capacity } : null,
    lots: lotRefs(tender, bid.lotIds),
    deadline: deadlineOf(bid, tender),
    submissionWindowOpen: open,
    isReplacement: effectiveReceipt(bid) !== null,
    effectiveOffer: effectiveOfferOf(bid, tender),
    readiness,
    finalDeclaration: {
      bidValidityDays: validity,
      tenderVersionNo: tender.currentVersionNo,
      termsReference: `${tender.reference}, version ${tender.currentVersionNo} (general conditions and addenda)`,
      outstandingExceptionCount: exceptionCount,
      deviationCount,
    },
    authority: {
      canSubmit: blockReasons.length === 0,
      blockReasons,
      authorizedSubmitters: supplierTeam(bid.supplierTenantId)
        .filter((row) => row.member.canSubmit)
        .map((row) => ({ userId: row.member.userId, fullName: row.member.fullName })),
    },
  };
}

