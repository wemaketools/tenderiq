/**
 * The official outcome of a successful submission or withdrawal, applied to the loaded response. The result the
 * server returns is authoritative for the view from that moment (FR-12, AC-11, AC-14): the page never keeps showing
 * the pre-action state beside a receipt or a withdrawal confirmation.
 */
import type {
  BidDetail,
  BidRevision,
  Receipt,
  ReceiptSummary,
  SubmissionResult,
  Withdrawal,
  WithdrawalResult,
} from '@contracts/bids';

export function receiptSummaryOf(receipt: Receipt): ReceiptSummary {
  return {
    id: receipt.id,
    receiptNo: receipt.receiptNo,
    bidId: receipt.bidId,
    revisionId: receipt.revisionId,
    revisionNo: receipt.revisionNo,
    receivedAt: receipt.receivedAt,
    status: receipt.status,
    statusChangedAt: receipt.statusChangedAt,
    documentCount: receipt.documentCount,
    isEffective: receipt.isEffective,
  };
}

/** The response after a successful submission: submitted, the new receipt effective, no working revision. */
export function bidAfterSubmission(bid: BidDetail, result: SubmissionResult): BidDetail {
  const receipt = { ...receiptSummaryOf(result.receipt), isEffective: true };
  return {
    ...bid,
    submissionState: 'submitted',
    workingRevision: null,
    effectiveReceipt: receipt,
    replacementPermitted: bid.submissionWindowOpen,
    effectiveOffer: {
      explanation: 'effective_receipt',
      receipt,
      lastUnsuccessfulAttempt: null,
      withdrawal: null,
    },
  };
}

/** The response after an explicit withdrawal: withdrawn, no effective receipt, nothing in preparation. */
export function bidAfterWithdrawal(bid: BidDetail, result: WithdrawalResult): BidDetail {
  return {
    ...bid,
    submissionState: result.submissionState,
    workingRevision: null,
    effectiveReceipt: null,
    replacementPermitted: false,
    effectiveOffer: {
      explanation: 'withdrawn',
      receipt: null,
      lastUnsuccessfulAttempt: null,
      withdrawal: result.withdrawal,
    },
  };
}

/** Receipts after a withdrawal: the withdrawn receipt carries its new status and is no longer effective. */
export function receiptsAfterWithdrawal(
  rows: readonly ReceiptSummary[],
  result: WithdrawalResult,
): ReceiptSummary[] {
  return rows.map((row) => (row.id === result.receipt.id ? result.receipt : row));
}

/** Withdrawals including the new confirmation (once, newest first). */
export function withdrawalsAfter(
  rows: readonly Withdrawal[],
  result: WithdrawalResult,
): Withdrawal[] {
  return [result.withdrawal, ...rows.filter((row) => row.id !== result.withdrawal.id)];
}

/** Revisions after a withdrawal: the withdrawn revision is marked withdrawn; nothing stays effective or working. */
export function revisionsAfterWithdrawal(
  rows: readonly BidRevision[],
  result: WithdrawalResult,
): BidRevision[] {
  return rows.map((row) =>
    row.id === result.withdrawal.revisionId
      ? { ...row, status: 'withdrawn', isEffective: false, isWorking: false }
      : { ...row, isEffective: false, isWorking: false },
  );
}
