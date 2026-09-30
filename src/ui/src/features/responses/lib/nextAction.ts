/**
 * The next required action of a response (PRD §19): derived from the official submission state, the working
 * revision and the submission window. Internal approval is never presented as submission (AC-11).
 */
import type { BidSummary } from '@contracts/bids';

import { responsePaths } from './paths';

export type NextActionKey =
  | 'withdrawn'
  | 'closedSubmitted'
  | 'closedNotSubmitted'
  | 'effectiveNoWork'
  | 'startWork'
  | 'completeAnswers'
  | 'requestApproval'
  | 'awaitApproval'
  | 'submit'
  | 'retrySubmit'
  | 'reviewHistory';

export interface NextAction {
  readonly key: NextActionKey;
  readonly to: string;
}

type NextActionInput = Pick<
  BidSummary,
  'id' | 'submissionState' | 'workingRevision' | 'effectiveReceipt' | 'progress'
> & { readonly submissionWindowOpen?: boolean };

export function nextActionOf(bid: NextActionInput): NextAction {
  const open = bid.submissionWindowOpen ?? true;
  if (bid.submissionState === 'withdrawn') {
    return { key: 'withdrawn', to: responsePaths.history(bid.id) };
  }
  if (!open) {
    return bid.effectiveReceipt === null
      ? { key: 'closedNotSubmitted', to: responsePaths.history(bid.id) }
      : { key: 'closedSubmitted', to: responsePaths.history(bid.id) };
  }
  const working = bid.workingRevision;
  if (working === null) {
    return bid.effectiveReceipt === null
      ? { key: 'startWork', to: responsePaths.answers(bid.id) }
      : { key: 'effectiveNoWork', to: responsePaths.history(bid.id) };
  }
  switch (working.status) {
    case 'draft':
      return bid.progress.complete < bid.progress.total
        ? { key: 'completeAnswers', to: responsePaths.answers(bid.id) }
        : { key: 'requestApproval', to: responsePaths.review(bid.id) };
    case 'internal_review':
      return { key: 'awaitApproval', to: responsePaths.review(bid.id) };
    case 'approved_internally':
      return { key: 'submit', to: responsePaths.submit(bid.id) };
    case 'submission_failed':
      return { key: 'retrySubmit', to: responsePaths.submit(bid.id) };
    default:
      return { key: 'reviewHistory', to: responsePaths.history(bid.id) };
  }
}
