/**
 * Explains the current effective offer (SUP-17): which receipt establishes the submission, and why an unsuccessful
 * replacement or a late attempt did not change it (BR-19, BR-20, AC-12, AC-13). A withdrawal shows its confirmation.
 */
import type { EffectiveOffer } from '@contracts/bids';

import { Banner } from '../../../components/ui';
import type { BannerTone } from '../../../components/ui';
import { formatOfficialReceiptTime } from '../lib/time';
import { t } from '../../../lib/i18n';

const TONE: Readonly<Record<EffectiveOffer['explanation'], BannerTone>> = {
  none_submitted: 'info',
  effective_receipt: 'success',
  replacement_in_preparation: 'info',
  replacement_failed_earlier_effective: 'warning',
  late_rejected_earlier_effective: 'warning',
  late_rejected_none_effective: 'error',
  withdrawn: 'warning',
};

export interface EffectiveOfferBannerProps {
  readonly offer: EffectiveOffer;
  readonly timeZone: string;
}

export function EffectiveOfferBanner({ offer, timeZone }: EffectiveOfferBannerProps) {
  const attempt = offer.lastUnsuccessfulAttempt;
  const params = {
    receiptNo: offer.receipt?.receiptNo ?? '',
    revisionNo: offer.receipt?.revisionNo ?? 0,
    receivedAt:
      offer.receipt === null ? '' : formatOfficialReceiptTime(offer.receipt.receivedAt, timeZone),
    attemptAt:
      attempt === null
        ? ''
        : formatOfficialReceiptTime(attempt.completedAt ?? attempt.startedAt, timeZone),
    lateBy: attempt?.lateBySeconds ?? 0,
    confirmationNo: offer.withdrawal?.confirmationNo ?? '',
    withdrawnAt:
      offer.withdrawal === null
        ? ''
        : formatOfficialReceiptTime(offer.withdrawal.withdrawnAt, timeZone),
  };
  return (
    <Banner
      tone={TONE[offer.explanation]}
      title={t(`responses.effective.title.${offer.explanation}`, params)}
    >
      <p>{t(`responses.effective.detail.${offer.explanation}`, params)}</p>
      {attempt?.failureReason !== null && attempt?.failureReason !== undefined && (
        <p>{t('responses.effective.failureReason', { reason: attempt.failureReason })}</p>
      )}
    </Banner>
  );
}
