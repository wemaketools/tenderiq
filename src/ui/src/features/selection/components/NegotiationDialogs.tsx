/**
 * Negotiation commands (BUY-27): record a round (meeting, participants, topics within the mandate, minutes,
 * proposals, concessions, unresolved terms, whether the supplier sees it) and conclude the negotiation. A conclusion
 * that changes the basis of competition requires an approved process decision (BR-30).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { NegotiationDetail, NegotiationRound } from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  MultiSelect,
  TextArea,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { withSelectionMessage } from '../lib/errors';
import { bidLabel, tenderLabel } from '../lib/labels';
import { attempt } from '../lib/lists';

function negotiationScope(negotiation: NegotiationDetail): string {
  return `${bidLabel(negotiation.bid)} · ${tenderLabel(negotiation.tender, negotiation.lot)}`;
}

function optional(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

export interface RecordRoundDialogProps {
  readonly negotiation: NegotiationDetail;
  readonly onClose: () => void;
  readonly onRecorded: (round: NegotiationRound) => void;
}

export function RecordRoundDialog({ negotiation, onClose, onRecorded }: RecordRoundDialogProps) {
  const toast = useToast();
  const record = useApiMutation(selectionEndpoints.recordNegotiationRound);
  const [meetingAt, setMeetingAt] = useState<string | null>(null);
  const [participants, setParticipants] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [minutes, setMinutes] = useState('');
  const [buyerProposal, setBuyerProposal] = useState('');
  const [supplierProposal, setSupplierProposal] = useState('');
  const [concessions, setConcessions] = useState('');
  const [unresolved, setUnresolved] = useState('');
  const [visible, setVisible] = useState(true);
  const [touched, setTouched] = useState(false);
  const server = formErrors(record.error, [
    'meetingAt',
    'participants',
    'topics',
    'minutes',
    'buyerProposal',
    'supplierProposal',
    'concessions',
    'unresolvedIssues',
  ]);
  const required = t('selection.form.required');

  return (
    <ConfirmActionDialog
      open
      title={t('selection.round.title', { no: negotiation.roundCount + 1 })}
      scope={negotiationScope(negotiation)}
      consequence={
        visible ? t('selection.round.visibleConsequence') : t('selection.round.internalConsequence')
      }
      confirmLabel={t('selection.round.confirm')}
      pending={record.pending}
      error={withSelectionMessage(record.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTouched(true);
        if (
          meetingAt === null ||
          participants.trim() === '' ||
          topics.length === 0 ||
          minutes.trim() === ''
        ) {
          return;
        }
        const result = await attempt(
          record.mutate({
            params: { negotiationId: negotiation.negotiationId },
            body: {
              meetingAt,
              participants: participants.trim(),
              topics,
              minutes: minutes.trim(),
              buyerProposal: optional(buyerProposal),
              supplierProposal: optional(supplierProposal),
              concessions: optional(concessions),
              unresolvedIssues: optional(unresolved),
              supplierVisible: visible,
            },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.round.recorded'), 'success');
        onRecorded(result);
      }}
    >
      <DateTimeInput
        label={t('selection.round.meetingAt')}
        required
        timeZone={negotiation.tender.officialTimeZone}
        value={meetingAt}
        onChange={setMeetingAt}
        error={
          (touched && meetingAt === null ? required : undefined) ?? server.forField('meetingAt')
        }
      />
      <TextField
        label={t('selection.round.participants')}
        required
        value={participants}
        onChange={setParticipants}
        error={
          (touched && participants.trim() === '' ? required : undefined) ??
          server.forField('participants')
        }
      />
      <MultiSelect
        label={t('selection.round.topics')}
        hint={t('selection.round.topicsHint')}
        required
        value={topics}
        options={negotiation.allowedTopics.map((topic) => ({ value: topic, label: topic }))}
        onChange={setTopics}
        error={(touched && topics.length === 0 ? required : undefined) ?? server.forField('topics')}
      />
      <TextArea
        label={t('selection.round.minutes')}
        required
        rows={4}
        value={minutes}
        onChange={setMinutes}
        error={
          (touched && minutes.trim() === '' ? required : undefined) ?? server.forField('minutes')
        }
      />
      <TextArea
        label={t('selection.round.buyerProposal')}
        rows={2}
        value={buyerProposal}
        onChange={setBuyerProposal}
        error={server.forField('buyerProposal')}
      />
      <TextArea
        label={t('selection.round.supplierProposal')}
        rows={2}
        value={supplierProposal}
        onChange={setSupplierProposal}
        error={server.forField('supplierProposal')}
      />
      <TextArea
        label={t('selection.round.concessions')}
        rows={2}
        value={concessions}
        onChange={setConcessions}
        error={server.forField('concessions')}
      />
      <TextArea
        label={t('selection.round.unresolved')}
        rows={2}
        value={unresolved}
        onChange={setUnresolved}
        error={server.forField('unresolvedIssues')}
      />
      <Checkbox
        label={t('selection.round.supplierVisible')}
        hint={t('selection.round.supplierVisibleHint')}
        checked={visible}
        onChange={setVisible}
      />
    </ConfirmActionDialog>
  );
}

export interface ConcludeNegotiationDialogProps {
  readonly negotiation: NegotiationDetail;
  readonly onClose: () => void;
  readonly onConcluded: (negotiation: NegotiationDetail) => void;
}

export function ConcludeNegotiationDialog({
  negotiation,
  onClose,
  onConcluded,
}: ConcludeNegotiationDialogProps) {
  const toast = useToast();
  const conclude = useApiMutation(selectionEndpoints.concludeNegotiation);
  const [affects, setAffects] = useState(false);
  const decisionApproved = negotiation.processDecision?.status === 'approved';

  return (
    <ConfirmActionDialog
      open
      title={t('selection.conclude.title')}
      scope={negotiationScope(negotiation)}
      consequence={t('selection.conclude.consequence')}
      confirmLabel={t('selection.conclude.confirm')}
      reason={{ label: t('selection.conclude.outcome'), required: true }}
      pending={conclude.pending}
      error={withSelectionMessage(conclude.error)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        const result = await attempt(
          conclude.mutate({
            params: { negotiationId: negotiation.negotiationId },
            body: { outcomeSummary: reason, affectsCompetitionBasis: affects },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.conclude.concluded'), 'success');
        onConcluded(result);
      }}
    >
      <Checkbox
        label={t('selection.conclude.affectsBasis')}
        hint={t('selection.conclude.affectsBasisHint')}
        checked={affects}
        onChange={setAffects}
      />
      {affects && !decisionApproved && (
        <Banner tone="warning" title={t('selection.conclude.decisionNeeded')} />
      )}
    </ConfirmActionDialog>
  );
}
