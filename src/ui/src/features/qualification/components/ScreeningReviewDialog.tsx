/**
 * BUY-34/BUY-35 "Verify": the human review of an integrity screening result. A possible match only prompts review;
 * it never restricts the supplier by itself (BR-48). A restriction is decided through a decision, optionally after
 * raising a reassessment trigger.
 */
import { useState } from 'react';

import { ReviewScreeningBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { Screening } from '@contracts/qualification';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Checkbox,
  DetailList,
  Dialog,
  FormErrorSummary,
  TextArea,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { summaryTitle } from '../lib/errors';
import { runCommand } from '../lib/hooks';
import { errorLookup, validateWith } from '../lib/validation';

export interface ScreeningReviewDialogProps {
  readonly screening: Screening;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onReviewed: (screening: Screening) => void;
}

const FIELDS = ['disposition', 'effect', 'raiseTrigger'];

export function ScreeningReviewDialog({
  screening,
  timeZone,
  onClose,
  onReviewed,
}: ScreeningReviewDialogProps) {
  const review = useApiMutation(api.reviewScreening);
  const [disposition, setDisposition] = useState('');
  const [effect, setEffect] = useState('');
  const [raiseTrigger, setRaiseTrigger] = useState(false);
  const [tried, setTried] = useState(false);
  const body = { disposition, effect, raiseTrigger };
  const errors = errorLookup(
    tried ? validateWith(ReviewScreeningBody, body) : [],
    review.error,
    FIELDS,
  );

  const submit = (): void => {
    setTried(true);
    const parsed = ReviewScreeningBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () => review.mutate({ params: { screeningId: screening.id }, body: parsed.data }),
      onReviewed,
    );
  };

  return (
    <Dialog
      open
      title={t('qualification.screening.reviewTitle', { supplier: screening.supplier.name })}
      onClose={onClose}
      dismissible={!review.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={review.pending}>
            {t('qualification.common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={review.pending}>
            {t('qualification.screening.reviewConfirm')}
          </Button>
        </>
      }
    >
      <Banner tone="warning" title={t('qualification.screening.flagOnlyTitle')}>
        {t('qualification.screening.flagOnly')}
      </Banner>
      <DetailList
        items={[
          {
            label: t('qualification.screening.check'),
            value: tEnum('integrity_screenings.check_type', screening.checkType),
          },
          { label: t('qualification.screening.source'), value: screening.source },
          {
            label: t('qualification.screening.result'),
            value: tEnum('integrity_screenings.result', screening.result),
          },
          {
            label: t('qualification.screening.checkedAt'),
            value: formatDateTime(screening.checkedAt, timeZone),
          },
          { label: t('qualification.screening.match'), value: screening.matchDetail },
        ]}
      />
      <FormErrorSummary title={summaryTitle(review.error)} errors={errors.other} />
      <div className="tiq-form-stack">
        <TextArea
          label={t('qualification.screening.disposition')}
          hint={t('qualification.screening.dispositionHint')}
          required
          rows={3}
          value={disposition}
          onChange={setDisposition}
          error={errors.forField('disposition')}
        />
        <TextArea
          label={t('qualification.screening.effect')}
          hint={t('qualification.screening.effectHint')}
          required
          rows={2}
          value={effect}
          onChange={setEffect}
          error={errors.forField('effect')}
        />
        <Checkbox
          label={t('qualification.screening.raiseTrigger')}
          hint={t('qualification.screening.raiseTriggerHint')}
          checked={raiseTrigger}
          onChange={setRaiseTrigger}
        />
      </div>
    </Dialog>
  );
}
