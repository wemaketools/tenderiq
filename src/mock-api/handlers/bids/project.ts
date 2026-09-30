/**
 * Projections of the bids fixtures onto the contract shapes (SUP-12..SUP-17). Internal columns (tenant ids,
 * hashes seeds) never leave these functions except where the contract names them.
 */
import type {
  AnswerAttachment,
  BidAddendum,
  BidAnswerDetail,
  BidAnswerRow,
  BidComment,
  BidDeclarations,
  BidDetail,
  BidEvidence,
  BidLotOption,
  BidRevision,
  BidSection,
  BidSummary,
  BidTenderRef,
  EffectiveOffer,
  ProgressCounts,
  Receipt,
  ReceiptSummary,
  SubmissionAttempt,
  Withdrawal,
} from '../../../contracts/bids.js';
import type { BidAnswersEnvelope } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import {
  BID_ACKNOWLEDGMENTS,
  BID_ADDENDA,
  BID_ANSWERS,
  BID_ANSWER_ATTACHMENTS,
  BID_COMMENTS,
  BID_CONSORTIUM_MEMBERS,
  BID_DECLARATIONS,
  BID_EVIDENCE,
  BID_EVIDENCE_ITEMS,
  BID_EXCEPTIONS,
  BID_KEY_PERSONNEL,
  BID_REVISIONS,
  BID_SUBCONTRACTORS,
  RECEIPT_INVENTORY,
  requirementsForLots,
} from '../../fixtures/bids/index.js';
import type {
  FixtureAnswer,
  FixtureAttempt,
  FixtureBid,
  FixtureBidTender,
  FixtureReceipt,
  FixtureRequirement,
  FixtureRevision,
  FixtureWithdrawal,
} from '../../fixtures/bids/index.js';
import { findPersonaById, personRef } from '../../persona.js';
import {
  EFFECTIVE_RECEIPT_STATUSES,
  attemptsOf,
  bidDeadline,
  effectiveReceipt,
  effectiveRevision,
  legalNameOf,
  receiptsOf,
  requireTender,
  revisionsOf,
  supplierTeam,
  tenderById,
  tenantNameOf,
  tenantSlugOf,
  viewerOf,
  windowOpen,
  withdrawalsOf,
  workingRevision,
} from './state.js';

// ---------------------------------------------------------------------------------------------------------
// Links (the responses feature's routes)
// ---------------------------------------------------------------------------------------------------------

export const responseLinks = {
  answers: (bidId: number) => `/supplier/responses/${bidId}/answers`,
  pricing: (bidId: number) => `/supplier/responses/${bidId}/pricing`,
  declarations: (bidId: number) => `/supplier/responses/${bidId}/declarations`,
  review: (bidId: number) => `/supplier/responses/${bidId}/review`,
  submit: (bidId: number) => `/supplier/responses/${bidId}/submit`,
  receipts: (bidId: number) => `/supplier/responses/${bidId}/receipts`,
  opportunity: (tenderId: number) => `/supplier/opportunities/${tenderId}`,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Small projections
// ---------------------------------------------------------------------------------------------------------

export function tenderRef(tender: FixtureBidTender): BidTenderRef {
  return {
    tenderId: tender.id,
    reference: tender.reference,
    title: tender.title,
    eventType: tender.eventType,
    status: tender.status,
    buyer: { tenantId: tender.buyerTenantId, name: tenantNameOf(tender.buyerTenantId), slug: tenantSlugOf(tender.buyerTenantId) },
  };
}

export function lotRefs(tender: FixtureBidTender, lotIds: readonly number[]) {
  return tender.lots.filter((lot) => lotIds.includes(lot.id)).map((lot) => ({ lotId: lot.id, lotNo: lot.lotNo, title: lot.title }));
}

export function deadlineOf(bid: FixtureBid, tender: FixtureBidTender) {
  return { at: bidDeadline(bid, tender), timeZone: tender.officialTimeZone };
}

export function toReceiptSummary(receipt: FixtureReceipt, effectiveId: number | null): ReceiptSummary {
  const revision = BID_REVISIONS.find((row) => row.id === receipt.revisionId);
  return {
    id: receipt.id,
    receiptNo: receipt.receiptNo,
    bidId: receipt.bidId,
    revisionId: receipt.revisionId,
    revisionNo: revision?.revisionNo ?? 1,
    receivedAt: receipt.receivedAt,
    status: receipt.status,
    statusChangedAt: receipt.statusChangedAt,
    documentCount: RECEIPT_INVENTORY.filter((row) => row.receiptId === receipt.id).length,
    isEffective: receipt.id === effectiveId,
  };
}

export function toReceipt(receipt: FixtureReceipt, bid: FixtureBid, tender: FixtureBidTender): Receipt {
  const effective = effectiveReceipt(bid);
  const submitter = findPersonaById(receipt.submittedBy);
  const capacity = submitter?.memberships.find((membership) => membership.tenantId === bid.supplierTenantId)?.capacity ?? null;
  const lots = lotRefs(tender, bid.lotIds);
  const lateAttempt =
    receipt.status === 'late_rejected'
      ? attemptsOf(bid.id).find((row) => row.receiptId === receipt.id && row.outcome === 'failed_late' && row.completedAt !== null)
      : undefined;
  const lateBySeconds =
    lateAttempt?.completedAt === undefined || lateAttempt.completedAt === null
      ? 0
      : Math.round((Date.parse(lateAttempt.completedAt) - Date.parse(lateAttempt.deadlineAtAttempt)) / 1000);
  return {
    ...toReceiptSummary(receipt, effective?.id ?? null),
    tender: tenderRef(tender),
    legalParty: { tenantId: bid.supplierTenantId, legalName: legalNameOf(bid.supplierTenantId) },
    submittedBy: { ...personRef(receipt.submittedBy), capacity },
    submitterAuthorityNote: receipt.submitterAuthorityNote,
    lotsSummary: lots.map((lot) => `Lot ${lot.lotNo}`).join(', ') || 'All lots',
    lots,
    tenderVersionNo: receipt.tenderVersionNo,
    deadline: deadlineOf(bid, tender),
    inventory: RECEIPT_INVENTORY.filter((row) => row.receiptId === receipt.id).map((row) => ({
      id: row.id,
      documentVersionId: row.documentVersionId,
      fileName: row.fileName,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      envelope: row.envelope,
    })),
    roundType: bid.roundType,
    lateRejection:
      lateAttempt === undefined || lateBySeconds < 1
        ? null
        : {
            attemptId: lateAttempt.id,
            deadlineAtAttempt: { at: lateAttempt.deadlineAtAttempt, timeZone: tender.officialTimeZone },
            lateBySeconds,
            reason: lateAttempt.failureReason,
          },
  };
}

export function toAttempt(attempt: FixtureAttempt, tender: FixtureBidTender): SubmissionAttempt {
  const revision = BID_REVISIONS.find((row) => row.id === attempt.revisionId);
  const receipt = attempt.receiptId === null ? undefined : receiptsOf(attempt.bidId).find((row) => row.id === attempt.receiptId);
  const late =
    attempt.completedAt !== null && Date.parse(attempt.completedAt) > Date.parse(attempt.deadlineAtAttempt)
      ? Math.round((Date.parse(attempt.completedAt) - Date.parse(attempt.deadlineAtAttempt)) / 1000)
      : null;
  return {
    id: attempt.id,
    bidId: attempt.bidId,
    revisionId: attempt.revisionId,
    revisionNo: revision?.revisionNo ?? 1,
    attemptedBy: personRef(attempt.attemptedBy),
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    outcome: attempt.outcome,
    failureReason: attempt.failureReason,
    deadlineAtAttempt: { at: attempt.deadlineAtAttempt, timeZone: tender.officialTimeZone },
    lateBySeconds: late !== null && late > 0 ? late : null,
    receiptId: receipt?.id ?? null,
    receiptNo: receipt?.receiptNo ?? null,
  };
}

export function toWithdrawal(withdrawal: FixtureWithdrawal, bid: FixtureBid): Withdrawal {
  const revision = BID_REVISIONS.find((row) => row.id === withdrawal.revisionId);
  const receipt = receiptsOf(bid.id).find((row) => row.id === withdrawal.receiptId);
  const person = findPersonaById(withdrawal.withdrawnBy);
  return {
    id: withdrawal.id,
    bidId: withdrawal.bidId,
    revisionId: withdrawal.revisionId,
    revisionNo: revision?.revisionNo ?? 1,
    receiptId: withdrawal.receiptId,
    receiptNo: receipt?.receiptNo ?? 'RCPT-2026-000000',
    confirmationNo: withdrawal.confirmationNo,
    withdrawnAt: withdrawal.withdrawnAt,
    withdrawnBy: {
      ...personRef(withdrawal.withdrawnBy),
      capacity: person?.memberships.find((membership) => membership.tenantId === bid.supplierTenantId)?.capacity ?? null,
    },
    reason: withdrawal.reason,
  };
}

export function toRevision(revision: FixtureRevision, bid: FixtureBid): BidRevision {
  const receipt = receiptsOf(bid.id).find((row) => row.revisionId === revision.id);
  const basedOn = revision.basedOnRevisionId === null ? undefined : BID_REVISIONS.find((row) => row.id === revision.basedOnRevisionId);
  return {
    id: revision.id,
    bidId: revision.bidId,
    revisionNo: revision.revisionNo,
    status: revision.status,
    basedOnRevisionId: revision.basedOnRevisionId,
    basedOnRevisionNo: basedOn?.revisionNo ?? null,
    contentHash: revision.contentHash,
    acknowledgedTenderVersion: revision.acknowledgedTenderVersion,
    internallyApprovedAt: revision.internallyApprovedAt,
    submittedAt: revision.submittedAt,
    receiptId: receipt?.id ?? null,
    receiptNo: receipt?.receiptNo ?? null,
    createdBy: personRef(revision.createdBy),
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
    isEffective: effectiveRevision(bid)?.id === revision.id,
    isWorking: workingRevision(bid)?.id === revision.id,
  };
}

/** Why the current effective offer is what it is (SUP-17). */
export function effectiveOfferOf(bid: FixtureBid, tender: FixtureBidTender): EffectiveOffer {
  const receipt = effectiveReceipt(bid);
  const attempts = attemptsOf(bid.id);
  const lastAttempt = attempts[attempts.length - 1];
  const lastFailed = lastAttempt !== undefined && lastAttempt.outcome !== 'succeeded' ? lastAttempt : undefined;
  const withdrawal = withdrawalsOf(bid.id)[0];
  if (bid.submissionState === 'withdrawn') {
    return {
      explanation: 'withdrawn',
      receipt: null,
      lastUnsuccessfulAttempt: null,
      withdrawal: withdrawal === undefined ? null : toWithdrawal(withdrawal, bid),
    };
  }
  const summary = receipt === null ? null : toReceiptSummary(receipt, receipt.id);
  const failed = lastFailed === undefined ? null : toAttempt(lastFailed, tender);
  let explanation: EffectiveOffer['explanation'];
  if (receipt !== null) {
    if (lastFailed !== undefined && lastFailed.startedAt > receipt.receivedAt) {
      explanation = lastFailed.outcome === 'failed_late' ? 'late_rejected_earlier_effective' : 'replacement_failed_earlier_effective';
    } else if (workingRevision(bid) !== null) {
      explanation = 'replacement_in_preparation';
    } else {
      explanation = 'effective_receipt';
    }
  } else {
    explanation = lastFailed?.outcome === 'failed_late' ? 'late_rejected_none_effective' : 'none_submitted';
  }
  return {
    explanation,
    receipt: summary,
    lastUnsuccessfulAttempt: explanation === 'effective_receipt' || explanation === 'replacement_in_preparation' ? null : failed,
    withdrawal: null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------------------------------------

export function answerOf(revisionId: number, requirementId: number): FixtureAnswer | undefined {
  return BID_ANSWERS.find((row) => row.revisionId === revisionId && row.requirementId === requirementId);
}

export function attachmentsOf(answerId: number | undefined) {
  return answerId === undefined ? [] : BID_ANSWER_ATTACHMENTS.filter((row) => row.answerId === answerId);
}

/** True when an answer carries content of its response type (a document answer needs an attachment). */
export function hasContent(requirement: FixtureRequirement, answer: FixtureAnswer | undefined, attachmentCount: number): boolean {
  if (answer === undefined) {
    return false;
  }
  switch (requirement.responseType) {
    case 'document':
      return attachmentCount > 0;
    case 'yes_no':
      return answer.answerBool !== null;
    case 'number':
    case 'quantity':
      return answer.answerNumber !== null;
    case 'choice':
      return answer.answerChoice !== null;
    default:
      return answer.answerText !== null && answer.answerText.trim() !== '';
  }
}

function reuseOf(answer: FixtureAnswer): BidAnswerRow['reuse'] {
  if (answer.reuse === null) {
    return null;
  }
  const source = BID_ANSWERS.find((row) => row.id === answer.reuse?.sourceAnswerId);
  const sourceRevision = source === undefined ? undefined : BID_REVISIONS.find((row) => row.id === source.revisionId);
  const sourceTender = source === undefined ? undefined : requirementTender(source.requirementId);
  return {
    sourceAnswerId: answer.reuse.sourceAnswerId,
    tenderReference: sourceTender?.reference ?? 'T-2026-0000',
    tenderTitle: sourceTender?.title ?? 'Earlier response',
    revisionNo: sourceRevision?.revisionNo ?? 1,
    submittedAt: sourceRevision?.submittedAt ?? null,
    reusedAt: answer.reuse.reusedAt,
    reusedBy: personRef(answer.reuse.reusedBy),
    reviewedAt: answer.reuse.reviewedAt,
    reviewedBy: answer.reuse.reviewedBy === null ? null : personRef(answer.reuse.reviewedBy),
  };
}

/** Requirement ids are tender id × 1000 + n (fixture convention). */
function requirementTender(requirementId: number): FixtureBidTender | undefined {
  return tenderById(Math.floor(requirementId / 1000));
}

export function toAnswerRow(tender: FixtureBidTender, requirement: FixtureRequirement, answer: FixtureAnswer | undefined, revisionId: number): BidAnswerRow {
  const lot = requirement.lotId === null ? undefined : tender.lots.find((row) => row.id === requirement.lotId);
  return {
    requirementId: requirement.id,
    refCode: requirement.refCode,
    section: requirement.section,
    lot: lot === undefined ? null : { lotId: lot.id, lotNo: lot.lotNo, title: lot.title },
    text: requirement.text,
    responseType: requirement.responseType,
    choices: [...requirement.choices],
    responseInstructions: requirement.responseInstructions,
    evidenceRequired: requirement.evidenceRequired,
    treatment: requirement.treatment,
    envelope: requirement.envelope,
    missingConsequence: requirement.missingConsequence,
    addendumNumber: requirement.addendumNumber,
    answerText: answer?.answerText ?? null,
    answerNumber: answer?.answerNumber ?? null,
    answerChoice: answer?.answerChoice ?? null,
    answerBool: answer?.answerBool ?? null,
    isDeviation: answer?.isDeviation ?? false,
    deviationNote: answer?.deviationNote ?? null,
    assignedUser: answer?.assignedUserId == null ? null : personRef(answer.assignedUserId),
    dueAt: answer?.dueAt ?? null,
    progress: answer?.progress ?? 'not_started',
    reuse: answer === undefined ? null : reuseOf(answer),
    documentCount: attachmentsOf(answer?.id).length,
    commentCount: BID_COMMENTS.filter((row) => row.revisionId === revisionId && row.requirementId === requirement.id).length,
    updatedBy: answer?.updatedBy == null ? null : personRef(answer.updatedBy),
    updatedAt: answer?.updatedAt ?? null,
  };
}

export function toAttachment(row: (typeof BID_ANSWER_ATTACHMENTS)[number]): AnswerAttachment {
  const evidence = row.evidenceItemId === null ? undefined : BID_EVIDENCE_ITEMS.find((item) => item.id === row.evidenceItemId);
  return {
    id: row.id,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    envelope: row.envelope,
    evidenceSubmissionId: row.evidenceSubmissionId,
    evidenceTitle: evidence?.title ?? null,
    attachedAt: row.attachedAt,
    attachedBy: personRef(row.attachedBy),
  };
}

export function commentsOf(revisionId: number, requirementId: number | null): BidComment[] {
  return BID_COMMENTS.filter((row) => row.revisionId === revisionId && row.requirementId === requirementId).map((row) => ({
    id: row.id,
    requirementId: row.requirementId,
    revisionId: row.revisionId,
    author: personRef(row.authorUserId),
    body: row.body,
    createdAt: row.createdAt,
  }));
}

export function toAnswerDetail(
  tender: FixtureBidTender,
  requirement: FixtureRequirement,
  revision: FixtureRevision,
  editable: boolean,
): BidAnswerDetail {
  const answer = answerOf(revision.id, requirement.id);
  return {
    ...toAnswerRow(tender, requirement, answer, revision.id),
    revisionId: revision.id,
    revisionNo: revision.revisionNo,
    editable,
    attachments: attachmentsOf(answer?.id).map(toAttachment),
    comments: commentsOf(revision.id, requirement.id),
  };
}

export function emptyProgress(): ProgressCounts {
  return { total: 0, notStarted: 0, inProgress: 0, readyForReview: 0, complete: 0 };
}

export function progressOf(rows: readonly Pick<BidAnswerRow, 'progress'>[]): ProgressCounts {
  const counts = emptyProgress();
  for (const row of rows) {
    counts.total += 1;
    if (row.progress === 'not_started') counts.notStarted += 1;
    if (row.progress === 'in_progress') counts.inProgress += 1;
    if (row.progress === 'ready_for_review') counts.readyForReview += 1;
    if (row.progress === 'complete') counts.complete += 1;
  }
  return counts;
}

export function answerRowsOf(bid: FixtureBid, tender: FixtureBidTender, revision: FixtureRevision | null): BidAnswerRow[] {
  if (revision === null) {
    return requirementsForLots(tender.id, bid.lotIds).map((requirement) => toAnswerRow(tender, requirement, undefined, 0));
  }
  return requirementsForLots(tender.id, bid.lotIds).map((requirement) =>
    toAnswerRow(tender, requirement, answerOf(revision.id, requirement.id), revision.id),
  );
}

export function sectionsOf(rows: readonly BidAnswerRow[]): BidSection[] {
  const order: string[] = [];
  for (const row of rows) {
    if (!order.includes(row.section)) {
      order.push(row.section);
    }
  }
  return order.map((section) => {
    const inSection = rows.filter((row) => row.section === section);
    const envelopes = inSection.map((row) => row.envelope);
    const envelope: BidAnswersEnvelope = envelopes.includes('commercial')
      ? 'commercial'
      : envelopes.includes('qualification')
        ? 'qualification'
        : 'technical';
    return {
      section,
      envelope,
      progress: progressOf(inSection),
      mandatoryOpen: inSection.filter((row) => row.treatment === 'mandatory_gate' && row.progress !== 'complete').length,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Declarations pack (SUP-14)
// ---------------------------------------------------------------------------------------------------------

export function addendaOf(bid: FixtureBid, tender: FixtureBidTender): BidAddendum[] {
  return BID_ADDENDA.filter((row) => row.tenderId === tender.id).map((addendum) => {
    const ack = BID_ACKNOWLEDGMENTS.find((row) => row.addendumId === addendum.id && row.supplierTenantId === bid.supplierTenantId);
    return {
      addendumId: addendum.id,
      number: addendum.number,
      title: addendum.title,
      issuedAt: addendum.issuedAt,
      material: addendum.material,
      existingSubmissionAction: addendum.existingSubmissionAction,
      resultingVersionNo: addendum.resultingVersionNo,
      acknowledged: ack !== undefined,
      acknowledgedAt: ack?.acknowledgedAt ?? null,
      acknowledgedBy: ack === undefined ? null : personRef(ack.userId),
      link: responseLinks.opportunity(tender.id),
    };
  });
}

export function evidenceOf(bid: FixtureBid, tender: FixtureBidTender, revisionId: number): BidEvidence[] {
  const validityEnd = Date.parse(bidDeadline(bid, tender)) + tender.bidValidityDays * 86_400_000;
  return BID_EVIDENCE.filter((row) => row.revisionId === revisionId).flatMap((row) => {
    const item = BID_EVIDENCE_ITEMS.find((evidence) => evidence.id === row.evidenceItemId);
    if (item === undefined) {
      return [];
    }
    return [
      {
        evidenceItemId: item.id,
        evidenceSubmissionId: row.evidenceSubmissionId,
        documentVersionId: item.documentVersionId,
        title: item.title,
        evidenceType: item.evidenceType,
        issuer: item.issuer,
        fileName: item.fileName,
        versionNo: item.versionNo,
        validFrom: item.validFrom,
        expiresAt: item.expiresAt,
        status: item.status,
        verificationStatus: item.verificationStatus,
        attachedAt: row.attachedAt,
        attachedBy: personRef(row.attachedBy),
        expiresDuringValidity: item.expiresAt !== null && Date.parse(item.expiresAt) < validityEnd,
      },
    ];
  });
}

export function declarationsPackOf(bid: FixtureBid, tender: FixtureBidTender, revision: FixtureRevision, editable: boolean): BidDeclarations {
  const attached = new Set(BID_EVIDENCE.filter((row) => row.revisionId === revision.id).map((row) => row.evidenceItemId));
  return {
    bidId: bid.id,
    revisionId: revision.id,
    revisionNo: revision.revisionNo,
    revisionStatus: revision.status,
    editable,
    legalParty: { tenantId: bid.supplierTenantId, legalName: legalNameOf(bid.supplierTenantId) },
    bidValidityDays: tender.bidValidityDays,
    declarations: BID_DECLARATIONS.filter((row) => row.revisionId === revision.id).map((row) => ({
      declarationType: row.declarationType,
      required: row.declarationType !== 'other',
      accepted: row.accepted,
      explanation: row.explanation,
      declaredBy: row.declaredBy === null ? null : personRef(row.declaredBy),
      declaredAt: row.declaredAt,
    })),
    subcontractors: BID_SUBCONTRACTORS.filter((row) => row.revisionId === revision.id).map(({ revisionId: _revisionId, ...row }) => row),
    keyPersonnel: BID_KEY_PERSONNEL.filter((row) => row.revisionId === revision.id).map(({ revisionId: _revisionId, ...row }) => row),
    isConsortium: bid.isConsortium,
    leadMemberName: bid.leadMemberName,
    consortiumMembers: BID_CONSORTIUM_MEMBERS.filter((row) => row.bidId === bid.id).map(({ bidId: _bidId, ...row }) => row),
    exceptions: BID_EXCEPTIONS.filter((row) => row.revisionId === revision.id).map(({ revisionId: _revisionId, ...row }) => row),
    evidence: evidenceOf(bid, tender, revision.id),
    evidenceOptions: BID_EVIDENCE_ITEMS.filter((item) => item.supplierTenantId === bid.supplierTenantId).map((item) => ({
      evidenceItemId: item.id,
      title: item.title,
      evidenceType: item.evidenceType,
      expiresAt: item.expiresAt,
      status: item.status,
      attached: attached.has(item.id),
    })),
    addenda: addendaOf(bid, tender),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Workspace summary and detail
// ---------------------------------------------------------------------------------------------------------

export function toBidSummary(bid: FixtureBid): BidSummary {
  const tender = requireTender(bid);
  const working = workingRevision(bid);
  const receipt = effectiveReceipt(bid);
  const all = revisionsOf(bid);
  const shown = working ?? effectiveRevision(bid) ?? all[all.length - 1] ?? null;
  return {
    id: bid.id,
    tender: tenderRef(tender),
    roundType: bid.roundType,
    isAlternative: bid.isAlternative,
    isConsortium: bid.isConsortium,
    submissionState: bid.submissionState,
    deadline: deadlineOf(bid, tender),
    lots: lotRefs(tender, bid.lotIds),
    workingRevision: working === null ? null : { id: working.id, revisionNo: working.revisionNo, status: working.status },
    effectiveReceipt: receipt === null ? null : toReceiptSummary(receipt, receipt.id),
    progress: progressOf(answerRowsOf(bid, tender, shown)),
    bidManager: bid.bidManagerUserId === null ? null : personRef(bid.bidManagerUserId),
    updatedAt: all.reduce((latest, row) => (row.updatedAt > latest ? row.updatedAt : latest), bid.createdAt),
  };
}

function lotOptionsOf(bid: FixtureBid, tender: FixtureBidTender): BidLotOption[] {
  return tender.lots.map((lot) => {
    const unavailable = lot.stage === 'cancelled' || lot.stage === 'no_award' || lot.stage === 'draft';
    return {
      lotId: lot.id,
      lotNo: lot.lotNo,
      title: lot.title,
      description: lot.description,
      stage: lot.stage,
      deadline: { at: lot.deadline ?? bidDeadline(bid, tender), timeZone: tender.officialTimeZone },
      selected: bid.lotIds.includes(lot.id),
      eligible: !unavailable,
      ineligibleReason: unavailable ? `The lot is ${lot.stage.replace('_', ' ')} and cannot be offered.` : null,
    };
  });
}

export function toBidDetail(bid: FixtureBid, permissions: readonly PermissionCode[], now: Date): BidDetail {
  const tender = requireTender(bid);
  const summary = toBidSummary(bid);
  const shown = workingRevision(bid) ?? effectiveRevision(bid) ?? revisionsOf(bid).at(-1) ?? null;
  const open = windowOpen(tender, bid.roundType, now);
  return {
    ...summary,
    legalParty: { tenantId: bid.supplierTenantId, legalName: legalNameOf(bid.supplierTenantId) },
    officialTimeZone: tender.officialTimeZone,
    currency: tender.currency,
    acceptedCurrencies: [...tender.acceptedCurrencies],
    participation: tender.participation,
    bidValidityDays: tender.bidValidityDays,
    partialBidsAllowed: tender.partialBidsAllowed,
    alternativesAllowed: tender.alternativesAllowed,
    maxLotsPerSupplier: tender.maxLotsPerSupplier,
    currentTenderVersionNo: tender.currentVersionNo,
    submissionWindowOpen: open,
    replacementPermitted: open && effectiveReceipt(bid) !== null && workingRevision(bid) === null,
    leadMemberName: bid.leadMemberName,
    lotOptions: lotOptionsOf(bid, tender),
    sections: sectionsOf(answerRowsOf(bid, tender, shown)),
    team: supplierTeam(bid.supplierTenantId).map((row) => row.member),
    addenda: addendaOf(bid, tender),
    effectiveOffer: effectiveOfferOf(bid, tender),
    viewer: viewerOf(permissions),
  };
}

export function isEffectiveReceiptStatus(status: string): boolean {
  return (EFFECTIVE_RECEIPT_STATUSES as readonly string[]).includes(status);
}

