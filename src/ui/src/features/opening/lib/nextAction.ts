/**
 * The next required action of an opening record (PRD §19: navigation shows the stage, the deadline and the next
 * required action). Derived from the states the API returns; the API still enforces every rule.
 */
import type {
  ClarificationRow,
  ComplianceBidRow,
  OpeningSessionDetail,
  TenderOpeningOverview,
} from '@contracts/opening';

import { t, tEnum } from '../../../lib/i18n';

export function tenderNextAction(overview: TenderOpeningOverview): string {
  if (overview.tender.progress === 'not_closed') {
    return t('opening.next.notClosed');
  }
  const stages = [...overview.stages].sort((a, b) => a.openOrder - b.openOrder);
  const pending = stages.find((stage) => stage.state !== 'opened' && stage.state !== 'cancelled');
  if (pending === undefined) {
    return t('opening.next.complete');
  }
  const envelope = tEnum('opening_sessions.envelope', pending.envelope);
  switch (pending.state) {
    case 'blocked_by_price_gate':
      return t('opening.next.priceGate', { envelope });
    case 'awaiting_quorum': {
      // Follow the confirmed presence: once the quorum is met, the next step is the opening itself.
      const session = overview.sessions.find((row) => row.id === pending.sessionId);
      return session?.quorum.met === true
        ? t('opening.next.open', { envelope })
        : t('opening.next.quorum', { envelope });
    }
    case 'scheduled':
      return t('opening.next.open', { envelope });
    default:
      return t('opening.next.schedule', { envelope });
  }
}

export function sessionNextAction(session: OpeningSessionDetail): string {
  switch (session.status) {
    case 'aborted':
      return t('opening.next.sessionAborted');
    case 'completed':
      if (session.minutes === null) return t('opening.next.recordMinutes');
      return t('opening.next.sessionDone');
    default: {
      const blocking = session.readiness.find((item) => item.status === 'blocking');
      if (blocking === undefined) return t('opening.next.readyToOpen');
      return t(`opening.readiness.${blocking.code}.blocking`);
    }
  }
}

export function bidNextAction(bid: ComplianceBidRow, contentAvailable: boolean): string {
  if (!contentAvailable) return t('opening.next.bidSealed');
  if (bid.exclusion !== null && bid.exclusion.status === 'approved') {
    return t('opening.next.bidExcluded');
  }
  if (
    bid.exclusion !== null &&
    bid.exclusion.status !== 'withdrawn' &&
    bid.exclusion.status !== 'rejected'
  ) {
    return t('opening.next.exclusionPending');
  }
  if (bid.complianceStatus === 'compliant' || bid.complianceStatus === 'non_compliant') {
    return t('opening.next.bidDecided');
  }
  if (bid.checkSummary.pending > 0)
    return t('opening.next.checksPending', { count: bid.checkSummary.pending });
  if (bid.openClarifications > 0) return t('opening.next.clarificationOpen');
  return t('opening.next.conclude');
}

export function clarificationNextAction(row: ClarificationRow): string {
  if (row.consolidatedIntoId !== null) return t('opening.next.merged');
  return t(`opening.next.clarification.${row.status}`);
}
