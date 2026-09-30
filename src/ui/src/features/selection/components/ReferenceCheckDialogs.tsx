/**
 * Reference-check commands (BUY-22): add a referee with the consent and confidentiality flags, and record the
 * referee's feedback. Feedback is refused without the referee's consent (`REFERENCE_CONSENT_REQUIRED`).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { ReferenceCheck, SelectionBidRef, SelectionTenderRef } from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  Select,
  TextArea,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { withSelectionMessage } from '../lib/errors';
import { bidLabel, tenderLabel } from '../lib/labels';
import { attempt, idOf } from '../lib/lists';

export interface CreateReferenceCheckDialogProps {
  readonly tender: SelectionTenderRef;
  readonly bids: readonly SelectionBidRef[];
  readonly onClose: () => void;
  readonly onCreated: (check: ReferenceCheck) => void;
}

export function CreateReferenceCheckDialog({
  tender,
  bids,
  onClose,
  onCreated,
}: CreateReferenceCheckDialogProps) {
  const toast = useToast();
  const create = useApiMutation(selectionEndpoints.createReferenceCheck);
  const [bid, setBid] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [consent, setConsent] = useState(false);
  const [confidential, setConfidential] = useState(false);
  const [touched, setTouched] = useState(false);
  const server = formErrors(create.error, ['bidId', 'refereeName', 'refereeOrganization']);
  const required = t('selection.form.required');

  return (
    <ConfirmActionDialog
      open
      title={t('selection.references.addTitle')}
      scope={tenderLabel(tender)}
      consequence={t('selection.references.addConsequence')}
      confirmLabel={t('selection.references.add')}
      pending={create.pending}
      error={withSelectionMessage(create.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTouched(true);
        const bidId = idOf(bid);
        if (bidId === undefined || name.trim() === '' || organization.trim() === '') return;
        const result = await attempt(
          create.mutate({
            body: {
              bidId,
              refereeName: name.trim(),
              refereeOrganization: organization.trim(),
              consentConfirmed: consent,
              confidential,
            },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.references.added'), 'success');
        onCreated(result);
      }}
    >
      <Select
        label={t('selection.references.candidate')}
        placeholder={t('selection.form.select')}
        required
        value={bid}
        options={bids.map((item) => ({ value: String(item.bidId), label: bidLabel(item) }))}
        onChange={setBid}
        error={(touched && bid === '' ? required : undefined) ?? server.forField('bidId')}
      />
      <TextField
        label={t('selection.references.refereeName')}
        required
        value={name}
        onChange={setName}
        error={
          (touched && name.trim() === '' ? required : undefined) ?? server.forField('refereeName')
        }
      />
      <TextField
        label={t('selection.references.refereeOrganization')}
        required
        value={organization}
        onChange={setOrganization}
        error={
          (touched && organization.trim() === '' ? required : undefined) ??
          server.forField('refereeOrganization')
        }
      />
      <Checkbox
        label={t('selection.references.consent')}
        hint={t('selection.references.consentHint')}
        checked={consent}
        onChange={setConsent}
      />
      <Checkbox
        label={t('selection.references.confidential')}
        hint={t('selection.references.confidentialHint')}
        checked={confidential}
        onChange={setConfidential}
      />
      {!consent && <Banner tone="warning" title={t('selection.references.noConsentWarning')} />}
    </ConfirmActionDialog>
  );
}

export interface RecordFeedbackDialogProps {
  readonly check: ReferenceCheck;
  readonly onClose: () => void;
  readonly onRecorded: (check: ReferenceCheck) => void;
}

export function RecordFeedbackDialog({ check, onClose, onRecorded }: RecordFeedbackDialogProps) {
  const toast = useToast();
  const record = useApiMutation(selectionEndpoints.recordReferenceFeedback);
  const [contactedAt, setContactedAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [outcome, setOutcome] = useState('');
  const [touched, setTouched] = useState(false);
  const server = formErrors(record.error, ['contactedAt', 'feedback', 'outcome']);
  const required = t('selection.form.required');

  return (
    <ConfirmActionDialog
      open
      title={t('selection.references.feedbackTitle')}
      scope={t('selection.references.feedbackScope', {
        referee: check.refereeName,
        organization: check.refereeOrganization,
        supplier: check.bid.supplierName,
      })}
      consequence={
        check.confidential
          ? t('selection.references.feedbackConfidential')
          : t('selection.references.feedbackConsequence')
      }
      confirmLabel={t('selection.references.recordFeedback')}
      pending={record.pending}
      error={withSelectionMessage(record.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTouched(true);
        if (contactedAt === null || feedback.trim() === '' || outcome.trim() === '') return;
        const result = await attempt(
          record.mutate({
            params: { referenceCheckId: check.referenceCheckId },
            body: { contactedAt, feedback: feedback.trim(), outcome: outcome.trim() },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.references.feedbackRecorded'), 'success');
        onRecorded(result);
      }}
    >
      <DateTimeInput
        label={t('selection.references.contactedAt')}
        required
        timeZone={check.tender.officialTimeZone}
        value={contactedAt}
        onChange={setContactedAt}
        error={
          (touched && contactedAt === null ? required : undefined) ?? server.forField('contactedAt')
        }
      />
      <TextArea
        label={t('selection.references.feedback')}
        required
        rows={4}
        value={feedback}
        onChange={setFeedback}
        error={
          (touched && feedback.trim() === '' ? required : undefined) ?? server.forField('feedback')
        }
      />
      <TextField
        label={t('selection.references.outcome')}
        required
        value={outcome}
        onChange={setOutcome}
        error={
          (touched && outcome.trim() === '' ? required : undefined) ?? server.forField('outcome')
        }
      />
    </ConfirmActionDialog>
  );
}
