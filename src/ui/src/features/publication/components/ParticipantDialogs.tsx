/**
 * BUY-15 commands, each confirmed with the acting organization, capacity, scope and result (COM-02): invite an
 * approved legal supplier with an intended contact, decide an access request, replace the intended contact (the
 * invited legal supplier never changes, FR-08), resend an invitation and remind a participant.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type {
  InvitationCandidate,
  ParticipantRow,
  ReminderBody,
  TenderLabel,
} from '@contracts/publication';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  ConfirmActionDialog,
  DateTimeInput,
  EmptyState,
  RadioGroup,
  SearchField,
  Select,
  SkeletonBlock,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { fieldMessage, withPublicationMessage } from '../lib/errors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function participantScope(
  tender: Pick<TenderLabel, 'reference'>,
  participant: ParticipantRow,
): string {
  return t('publication.participantDialogs.scope', {
    reference: tender.reference,
    supplier: participant.supplier.legalName,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Invite
// ---------------------------------------------------------------------------------------------------------

export interface InviteDialogProps {
  readonly open: boolean;
  readonly tender: TenderLabel;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onDone: (row: ParticipantRow) => void;
}

function candidateLabel(candidate: InvitationCandidate): string {
  const status =
    candidate.qualificationStatus === null
      ? t('publication.participantDialogs.invite.noQualification')
      : tEnum('v_qualification_status.effective_status', candidate.qualificationStatus);
  const suffix = candidate.blockedByQualification
    ? ` — ${t('publication.participantDialogs.invite.blocked')}`
    : '';
  return `${candidate.supplier.legalName} (${status})${suffix}`;
}

export function InviteDialog({ open, tender, timeZone, onClose, onDone }: InviteDialogProps) {
  const [q, setQ] = useState('');
  const candidates = useApiQuery(
    publicationEndpoints.invitationCandidates,
    open
      ? { params: { tenderId: tender.tenderId }, query: q.trim() === '' ? {} : { q: q.trim() } }
      : null,
  );
  const invite = useApiMutation(publicationEndpoints.inviteSupplier);
  const [supplierId, setSupplierId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const items = candidates.data?.items ?? [];
  const selected = items.find((item) => String(item.supplier.supplierTenantId) === supplierId);
  const supplierMissing = selected === undefined;
  const nameMissing = contactName.trim().length < 2;
  const emailInvalid = !EMAIL.test(contactEmail.trim());

  const choose = (value: string): void => {
    setSupplierId(value);
    const candidate = items.find((item) => String(item.supplier.supplierTenantId) === value);
    if (candidate?.suggestedContact) {
      setContactName(candidate.suggestedContact.name);
      setContactEmail(candidate.suggestedContact.email);
    }
  };

  const close = (): void => {
    invite.reset();
    setSupplierId('');
    setContactName('');
    setContactEmail('');
    setExpiresAt(null);
    setMessage('');
    setTouched(false);
    onClose();
  };

  return (
    <ConfirmActionDialog
      open={open}
      title={t('publication.participantDialogs.invite.title')}
      scope={
        selected === undefined
          ? t('publication.participantDialogs.invite.scopeNone', { reference: tender.reference })
          : t('publication.participantDialogs.scope', {
              reference: tender.reference,
              supplier: selected.supplier.legalName,
            })
      }
      consequence={t('publication.participantDialogs.invite.consequence')}
      confirmLabel={t('publication.participantDialogs.invite.confirm')}
      onCancel={close}
      onConfirm={async () => {
        setTouched(true);
        if (selected === undefined || nameMissing || emailInvalid) return;
        try {
          const row = await invite.mutate({
            params: { tenderId: tender.tenderId },
            body: {
              supplierTenantId: selected.supplier.supplierTenantId,
              contactName: contactName.trim(),
              contactEmail: contactEmail.trim(),
              ...(expiresAt === null ? {} : { invitationExpiresAt: expiresAt }),
              ...(message.trim() === '' ? {} : { message: message.trim() }),
            },
          });
          close();
          onDone(row);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={invite.pending}
      error={withPublicationMessage(invite.error, [
        'supplierTenantId',
        'contactName',
        'contactEmail',
        'invitationExpiresAt',
        'message',
      ])}
    >
      <p className="tiq-text-muted">{t('publication.participantDialogs.invite.intro')}</p>
      <SearchField
        label={t('publication.participantDialogs.invite.search')}
        value={q}
        onChange={setQ}
      />
      {candidates.status === 'loading' && candidates.data === undefined ? (
        <SkeletonBlock lines={2} />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon="building"
          title={
            candidates.error === null
              ? t('publication.participantDialogs.invite.noCandidates')
              : t('publication.participantDialogs.invite.candidatesFailed')
          }
        />
      ) : (
        <Select
          label={t('publication.participantDialogs.invite.supplier')}
          required
          placeholder={t('publication.participantDialogs.invite.choose')}
          value={supplierId}
          onChange={choose}
          options={items.map((item) => ({
            value: String(item.supplier.supplierTenantId),
            label: candidateLabel(item),
            disabled: item.blockedByQualification || item.alreadyParticipant,
          }))}
          error={
            fieldMessage(invite.error, 'supplierTenantId') ??
            (touched && supplierMissing
              ? t('publication.participantDialogs.invite.supplierRequired')
              : undefined)
          }
          hint={
            selected === undefined
              ? t('publication.participantDialogs.invite.supplierHint')
              : selected.categories.map((category) => category.name).join(', ')
          }
        />
      )}
      <div className="tiq-form-grid">
        <TextField
          label={t('publication.participantDialogs.contactName')}
          required
          value={contactName}
          onChange={setContactName}
          error={
            fieldMessage(invite.error, 'contactName') ??
            (touched && nameMissing
              ? t('publication.participantDialogs.contactNameRequired')
              : undefined)
          }
        />
        <TextField
          label={t('publication.participantDialogs.contactEmail')}
          type="email"
          required
          value={contactEmail}
          onChange={setContactEmail}
          error={
            fieldMessage(invite.error, 'contactEmail') ??
            (touched && emailInvalid
              ? t('publication.participantDialogs.contactEmailInvalid')
              : undefined)
          }
        />
      </div>
      <DateTimeInput
        label={t('publication.participantDialogs.invite.expiresAt')}
        hint={t('publication.participantDialogs.invite.expiresAtHint')}
        value={expiresAt}
        onChange={setExpiresAt}
        timeZone={timeZone}
        error={fieldMessage(invite.error, 'invitationExpiresAt')}
      />
      <TextArea
        label={t('publication.participantDialogs.invite.message')}
        rows={3}
        value={message}
        onChange={setMessage}
        error={fieldMessage(invite.error, 'message')}
      />
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Access decision
// ---------------------------------------------------------------------------------------------------------

export interface AccessDecisionDialogProps {
  readonly tender: Pick<TenderLabel, 'tenderId' | 'reference'>;
  readonly participant: ParticipantRow | null;
  readonly requestReason?: string | null;
  readonly onClose: () => void;
  readonly onDone: (row: ParticipantRow) => void;
}

export function AccessDecisionDialog({
  tender,
  participant,
  requestReason,
  onClose,
  onDone,
}: AccessDecisionDialogProps) {
  const decide = useApiMutation(publicationEndpoints.decideAccess);
  const [decision, setDecision] = useState<'granted' | 'denied'>('granted');
  return (
    <ConfirmActionDialog
      open={participant !== null}
      tone={decision === 'denied' ? 'danger' : 'primary'}
      title={t('publication.participantDialogs.access.title')}
      scope={participant === null ? '' : participantScope(tender, participant)}
      consequence={
        decision === 'granted'
          ? t('publication.participantDialogs.access.consequenceGranted')
          : t('publication.participantDialogs.access.consequenceDenied')
      }
      confirmLabel={
        decision === 'granted'
          ? t('publication.participantDialogs.access.confirmGrant')
          : t('publication.participantDialogs.access.confirmDeny')
      }
      reason={{ label: t('publication.participantDialogs.access.reason'), required: true }}
      onCancel={() => {
        decide.reset();
        setDecision('granted');
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        if (participant === null) return;
        try {
          const row = await decide.mutate({
            params: { tenderId: tender.tenderId, participantId: participant.id },
            body: { decision, reason },
          });
          decide.reset();
          setDecision('granted');
          onDone(row);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={decide.pending}
      error={withPublicationMessage(decide.error)}
    >
      {requestReason !== undefined && requestReason !== null && (
        <p>
          <strong>{t('publication.participantDialogs.access.requestReason')}:</strong>{' '}
          {requestReason}
        </p>
      )}
      {participant !== null && (
        <p className="tiq-text-muted">
          {t('publication.participantDialogs.access.gate', {
            gate: tEnum('participants.qualification_gate', participant.qualificationGate),
          })}
        </p>
      )}
      <RadioGroup
        label={t('publication.participantDialogs.access.decision')}
        inline
        value={decision}
        onChange={(value) => setDecision(value === 'denied' ? 'denied' : 'granted')}
        options={[
          { value: 'granted', label: t('publication.participantDialogs.access.grant') },
          { value: 'denied', label: t('publication.participantDialogs.access.deny') },
        ]}
      />
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Replace the intended contact
// ---------------------------------------------------------------------------------------------------------

export interface ReplaceContactDialogProps {
  readonly tender: Pick<TenderLabel, 'tenderId' | 'reference'>;
  readonly participant: ParticipantRow | null;
  readonly onClose: () => void;
  readonly onDone: (row: ParticipantRow) => void;
}

export function ReplaceContactDialog({
  tender,
  participant,
  onClose,
  onDone,
}: ReplaceContactDialogProps) {
  const replace = useApiMutation(publicationEndpoints.replaceContact);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const nameMissing = contactName.trim().length < 2;
  const emailInvalid = !EMAIL.test(contactEmail.trim());

  const close = (): void => {
    replace.reset();
    setContactName('');
    setContactEmail('');
    setTouched(false);
    onClose();
  };

  return (
    <ConfirmActionDialog
      open={participant !== null}
      title={t('publication.participantDialogs.contact.title')}
      scope={participant === null ? '' : participantScope(tender, participant)}
      consequence={t('publication.participantDialogs.contact.consequence', {
        supplier: participant?.supplier.legalName ?? '',
      })}
      confirmLabel={t('publication.participantDialogs.contact.confirm')}
      reason={{ label: t('publication.participantDialogs.contact.reason'), required: true }}
      onCancel={close}
      onConfirm={async ({ reason }) => {
        setTouched(true);
        if (participant === null || nameMissing || emailInvalid) return;
        try {
          const row = await replace.mutate({
            params: { tenderId: tender.tenderId, participantId: participant.id },
            body: { contactName: contactName.trim(), contactEmail: contactEmail.trim(), reason },
          });
          close();
          onDone(row);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={replace.pending}
      error={withPublicationMessage(replace.error, ['contactName', 'contactEmail'])}
    >
      {participant !== null && (
        <p className="tiq-text-muted">
          {t('publication.participantDialogs.contact.current', {
            name: participant.invitedContactName ?? t('publication.common.none'),
            email: participant.invitedContactEmail ?? t('publication.common.none'),
          })}
        </p>
      )}
      <div className="tiq-form-grid">
        <TextField
          label={t('publication.participantDialogs.contactName')}
          required
          value={contactName}
          onChange={setContactName}
          error={
            fieldMessage(replace.error, 'contactName') ??
            (touched && nameMissing
              ? t('publication.participantDialogs.contactNameRequired')
              : undefined)
          }
        />
        <TextField
          label={t('publication.participantDialogs.contactEmail')}
          type="email"
          required
          value={contactEmail}
          onChange={setContactEmail}
          error={
            fieldMessage(replace.error, 'contactEmail') ??
            (touched && emailInvalid
              ? t('publication.participantDialogs.contactEmailInvalid')
              : undefined)
          }
        />
      </div>
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Resend and remind
// ---------------------------------------------------------------------------------------------------------

export interface ResendDialogProps {
  readonly tender: Pick<TenderLabel, 'tenderId' | 'reference'>;
  readonly participant: ParticipantRow | null;
  readonly onClose: () => void;
  readonly onDone: (row: ParticipantRow) => void;
}

export function ResendDialog({ tender, participant, onClose, onDone }: ResendDialogProps) {
  const resend = useApiMutation(publicationEndpoints.resendInvitation);
  return (
    <ConfirmActionDialog
      open={participant !== null}
      title={t('publication.participantDialogs.resend.title')}
      scope={participant === null ? '' : participantScope(tender, participant)}
      consequence={t('publication.participantDialogs.resend.consequence', {
        email: participant?.invitedContactEmail ?? t('publication.common.none'),
      })}
      confirmLabel={t('publication.participantDialogs.resend.confirm')}
      onCancel={() => {
        resend.reset();
        onClose();
      }}
      onConfirm={async () => {
        if (participant === null) return;
        try {
          const row = await resend.mutate({
            params: { tenderId: tender.tenderId, participantId: participant.id },
          });
          resend.reset();
          onDone(row);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={resend.pending}
      error={withPublicationMessage(resend.error)}
    />
  );
}

export interface ReminderDialogProps {
  readonly tender: Pick<TenderLabel, 'tenderId' | 'reference'>;
  readonly participant: ParticipantRow | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}

type ReminderTopic = ReminderBody['topic'];

function defaultTopic(participant: ParticipantRow | null): ReminderTopic {
  if (participant === null) return 'acknowledgments';
  if (participant.invitationStatus === 'invited') return 'invitation_response';
  if (
    participant.confidentialityAcceptedAt === null &&
    participant.invitationStatus === 'accepted'
  ) {
    return 'confidentiality';
  }
  return 'acknowledgments';
}

export function ReminderDialog({ tender, participant, onClose, onDone }: ReminderDialogProps) {
  const remind = useApiMutation(publicationEndpoints.remindParticipant);
  const [topic, setTopic] = useState<ReminderTopic | null>(null);
  const [message, setMessage] = useState('');
  const chosen = topic ?? defaultTopic(participant);

  const close = (): void => {
    remind.reset();
    setTopic(null);
    setMessage('');
    onClose();
  };

  return (
    <ConfirmActionDialog
      open={participant !== null}
      title={t('publication.participantDialogs.remind.title')}
      scope={participant === null ? '' : participantScope(tender, participant)}
      consequence={t('publication.participantDialogs.remind.consequence')}
      confirmLabel={t('publication.participantDialogs.remind.confirm')}
      onCancel={close}
      onConfirm={async () => {
        if (participant === null) return;
        try {
          const outcome = await remind.mutate({
            params: { tenderId: tender.tenderId, participantId: participant.id },
            body: { topic: chosen, ...(message.trim() === '' ? {} : { message: message.trim() }) },
          });
          close();
          onDone(outcome.message);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={remind.pending}
      error={withPublicationMessage(remind.error, ['message'])}
    >
      <RadioGroup
        label={t('publication.participantDialogs.remind.topic')}
        value={chosen}
        onChange={(value) =>
          setTopic(
            value === 'confidentiality' || value === 'invitation_response'
              ? value
              : 'acknowledgments',
          )
        }
        options={[
          {
            value: 'acknowledgments',
            label: t('publication.participantDialogs.remind.acknowledgments'),
          },
          {
            value: 'confidentiality',
            label: t('publication.participantDialogs.remind.confidentiality'),
          },
          {
            value: 'invitation_response',
            label: t('publication.participantDialogs.remind.invitation_response'),
          },
        ]}
      />
      <TextArea
        label={t('publication.participantDialogs.remind.message')}
        rows={3}
        value={message}
        onChange={setMessage}
        error={fieldMessage(remind.error, 'message')}
      />
    </ConfirmActionDialog>
  );
}
