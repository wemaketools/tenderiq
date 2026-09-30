/**
 * Records the fallback decision after the preferred bidder failed diligence or withdrew
 * (`buyer.selection.preferredBidders.recordFallback`, AC-24): the next candidate, the reason and the confirmation
 * that the declared contingency is being followed. The decision is recorded as a process decision for approval.
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { PreferredBidderDetail } from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import { ConfirmActionDialog, Select, useToast } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { withSelectionMessage } from '../lib/errors';
import { bidLabel, tenderLabel } from '../lib/labels';
import { attempt, idOf } from '../lib/lists';

export interface RecordFallbackDialogProps {
  readonly preferred: PreferredBidderDetail;
  readonly onClose: () => void;
  readonly onRecorded: (preferred: PreferredBidderDetail) => void;
}

export function RecordFallbackDialog({
  preferred,
  onClose,
  onRecorded,
}: RecordFallbackDialogProps) {
  const toast = useToast();
  const record = useApiMutation(selectionEndpoints.recordFallback);
  const [fallback, setFallback] = useState(
    preferred.fallbackBid === null ? '' : String(preferred.fallbackBid.bidId),
  );
  const [touched, setTouched] = useState(false);
  const options = preferred.comparison
    .filter((candidate) => candidate.bid.bidId !== preferred.bid.bidId && candidate.passesGates)
    .map((candidate) => ({ value: String(candidate.bid.bidId), label: bidLabel(candidate.bid) }));

  return (
    <ConfirmActionDialog
      open
      title={t('selection.fallback.title')}
      scope={`${bidLabel(preferred.bid)} · ${tenderLabel(preferred.tender, preferred.lot)}`}
      consequence={t('selection.fallback.consequence')}
      confirmLabel={t('selection.fallback.confirm')}
      reason={{ label: t('selection.fallback.reason'), required: true }}
      acknowledgement={t('selection.fallback.contingency', { plan: preferred.contingencyPlan })}
      pending={record.pending}
      error={withSelectionMessage(record.error)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setTouched(true);
        const fallbackBidId = idOf(fallback);
        if (fallbackBidId === undefined) return;
        const result = await attempt(
          record.mutate({
            params: { preferredBidderId: preferred.preferredBidderId },
            body: { reason, fallbackBidId, contingencyFollowed: true },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.fallback.recorded'), 'success');
        onRecorded(result.preferredBidder);
      }}
    >
      <Select
        label={t('selection.fallback.candidate')}
        placeholder={t('selection.form.select')}
        required
        value={fallback}
        options={options}
        onChange={setFallback}
        error={touched && fallback === '' ? t('selection.form.required') : undefined}
      />
    </ConfirmActionDialog>
  );
}
