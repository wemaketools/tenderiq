/**
 * Records an assessment finding (`buyer.selection.sessions.recordFinding`). Only the effects the announced basis
 * allows are offered, so the effect always follows the announced assessment basis (AC-21); the supporting evidence
 * is picked from the session's documents.
 */
import { useState } from 'react';

import type { AssessmentFindingsEffect } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { AssessmentFinding, AssessmentSessionDetail } from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import {
  ConfirmActionDialog,
  Select,
  TextArea,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { withSelectionMessage } from '../lib/errors';
import { bidLabel, tenderLabel } from '../lib/labels';
import { attempt, idOf } from '../lib/lists';
import { EvidenceSelect } from './EvidenceSelect';

export interface RecordFindingDialogProps {
  readonly session: AssessmentSessionDetail;
  readonly onClose: () => void;
  readonly onRecorded: (finding: AssessmentFinding) => void;
}

export function RecordFindingDialog({ session, onClose, onRecorded }: RecordFindingDialogProps) {
  const toast = useToast();
  const record = useApiMutation(selectionEndpoints.recordFinding);
  const [bid, setBid] = useState('');
  const [effect, setEffect] = useState<string>(
    session.treatment.allowedEffects.length === 1
      ? (session.treatment.allowedEffects[0] ?? '')
      : '',
  );
  const [finding, setFinding] = useState('');
  const [evidence, setEvidence] = useState('');
  const [touched, setTouched] = useState(false);
  const server = formErrors(record.error, ['bidId', 'finding', 'effect', 'evidenceDocumentId']);
  const required = t('selection.form.required');
  const invited = session.invites.filter(
    (invite) => invite.status !== 'declined' && invite.status !== 'no_show',
  );

  return (
    <ConfirmActionDialog
      open
      title={t('selection.findings.recordTitle')}
      scope={`${tEnum('assessment_sessions.session_type', session.sessionType)} · ${tenderLabel(session.tender, session.lot)}`}
      consequence={t('selection.findings.consequence', {
        basis: tEnum('assessment_sessions.assessment_basis', session.assessmentBasis),
      })}
      confirmLabel={t('selection.findings.confirm')}
      pending={record.pending}
      error={withSelectionMessage(record.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTouched(true);
        const bidId = idOf(bid);
        if (bidId === undefined || effect === '' || finding.trim() === '') return;
        const result = await attempt(
          record.mutate({
            params: { sessionId: session.sessionId },
            body: {
              bidId,
              finding: finding.trim(),
              effect: effect as AssessmentFindingsEffect,
              evidenceDocumentId: idOf(evidence) ?? null,
            },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.findings.recorded'), 'success');
        onRecorded(result);
      }}
    >
      <p className="tiq-text-muted">{session.treatment.description}</p>
      <Select
        label={t('selection.findings.candidate')}
        placeholder={t('selection.form.select')}
        required
        value={bid}
        options={invited.map((invite) => ({
          value: String(invite.bid.bidId),
          label: bidLabel(invite.bid),
        }))}
        onChange={setBid}
        error={(touched && bid === '' ? required : undefined) ?? server.forField('bidId')}
      />
      <Select
        label={t('selection.findings.effect')}
        hint={t('selection.findings.effectHint')}
        placeholder={t('selection.form.select')}
        required
        value={effect}
        options={session.treatment.allowedEffects.map((value) => ({
          value,
          label: tEnum('assessment_findings.effect', value),
        }))}
        onChange={setEffect}
        error={(touched && effect === '' ? required : undefined) ?? server.forField('effect')}
      />
      <TextArea
        label={t('selection.findings.finding')}
        required
        rows={4}
        value={finding}
        onChange={setFinding}
        error={
          (touched && finding.trim() === '' ? required : undefined) ?? server.forField('finding')
        }
      />
      <EvidenceSelect
        relatedType="assessment_session"
        relatedId={session.sessionId}
        value={evidence}
        onChange={setEvidence}
        error={server.forField('evidenceDocumentId')}
      />
    </ConfirmActionDialog>
  );
}
