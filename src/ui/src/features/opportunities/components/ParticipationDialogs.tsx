/**
 * Formal participation commands of a supplier organization (SUP-07, SUP-08), each confirmed with the acting
 * organization, capacity, scope and result (COM-02): accept or decline an invitation for the named legal supplier,
 * accept the confidentiality undertaking, request access to restricted documents and register interest. They are
 * answered by an authorized representative (`supplier.notices.acknowledge`); a decline reason reaches the buyer only
 * when the representative explicitly chooses to share it.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type { InvitationDetail, OwnParticipation, TenderLabel } from '@contracts/publication';

import { useApiMutation } from '../../../api/hooks';
import { useActiveTenant, useAppSelector } from '../../../app/hooks';
import { Banner, Checkbox, ConfirmActionDialog, TextArea, TextField } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { fieldMessage, withPublicationMessage } from '../../publication/lib/errors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TenderRef = Pick<TenderLabel, 'tenderId' | 'reference' | 'title'>;

function tenderScope(tender: TenderRef, organization: string): string {
  return t('opportunities.dialogs.scope', {
    reference: tender.reference,
    title: tender.title,
    organization,
  });
}

/** The signed-in person's name and e-mail, to prefill contact fields. */
function useSignedInContact(): { readonly name: string; readonly email: string } {
  const user = useAppSelector((state) => state.session.user);
  const email = useAppSelector((state) => state.session.authUserEmail);
  return { name: user?.fullName ?? '', email: email ?? '' };
}

// ---------------------------------------------------------------------------------------------------------
// Accept / decline an invitation
// ---------------------------------------------------------------------------------------------------------

export interface AcceptInvitationDialogProps {
  readonly open: boolean;
  readonly invitation: InvitationDetail;
  readonly onClose: () => void;
  readonly onDone: (detail: InvitationDetail) => void;
}

export function AcceptInvitationDialog({
  open,
  invitation,
  onClose,
  onDone,
}: AcceptInvitationDialogProps) {
  const accept = useApiMutation(publicationEndpoints.acceptInvitation);
  const tenant = useActiveTenant();
  const [confidentiality, setConfidentiality] = useState(false);
  const needsConfidentiality =
    invitation.confidentialityRequired && invitation.confidentialityAcceptedAt === null;
  const legal = invitation.intendedSupplier.legalName;

  return (
    <ConfirmActionDialog
      open={open}
      title={t('opportunities.invitation.acceptTitle')}
      scope={tenderScope(invitation.tender, legal)}
      consequence={t('opportunities.invitation.acceptConsequence', {
        buyer: invitation.buyer.name,
      })}
      confirmLabel={t('opportunities.invitation.accept')}
      acknowledgement={t('opportunities.invitation.confirmLegal', {
        legal,
        organization: tenant?.name ?? legal,
      })}
      onCancel={() => {
        accept.reset();
        setConfidentiality(false);
        onClose();
      }}
      onConfirm={async () => {
        try {
          const detail = await accept.mutate({
            params: { participantId: invitation.participantId },
            body: {
              confirmLegalSupplier: true,
              acceptConfidentiality: needsConfidentiality && confidentiality,
            },
          });
          accept.reset();
          onDone(detail);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={accept.pending}
      error={withPublicationMessage(accept.error)}
    >
      {needsConfidentiality && (
        <div className="tiq-stack">
          <Banner tone="warning" title={t('opportunities.invitation.confidentialityTitle')}>
            <p>
              {invitation.confidentialityText ??
                t('opportunities.invitation.confidentialityDefault')}
            </p>
          </Banner>
          <Checkbox
            label={t('opportunities.invitation.acceptConfidentiality', { legal })}
            hint={t('opportunities.invitation.acceptConfidentialityHint')}
            checked={confidentiality}
            onChange={setConfidentiality}
          />
        </div>
      )}
    </ConfirmActionDialog>
  );
}

export interface DeclineInvitationDialogProps {
  readonly open: boolean;
  readonly invitation: InvitationDetail;
  readonly onClose: () => void;
  readonly onDone: (detail: InvitationDetail) => void;
}

export function DeclineInvitationDialog({
  open,
  invitation,
  onClose,
  onDone,
}: DeclineInvitationDialogProps) {
  const decline = useApiMutation(publicationEndpoints.declineInvitation);
  const [share, setShare] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonMissing = share && reason.trim() === '';

  const close = (): void => {
    decline.reset();
    setShare(false);
    setReason('');
    setTouched(false);
    onClose();
  };

  return (
    <ConfirmActionDialog
      open={open}
      tone="danger"
      title={t('opportunities.invitation.declineTitle')}
      scope={tenderScope(invitation.tender, invitation.intendedSupplier.legalName)}
      consequence={
        share
          ? t('opportunities.invitation.declineConsequenceShared', { buyer: invitation.buyer.name })
          : t('opportunities.invitation.declineConsequencePrivate', {
              buyer: invitation.buyer.name,
            })
      }
      confirmLabel={t('opportunities.invitation.decline')}
      onCancel={close}
      onConfirm={async () => {
        setTouched(true);
        if (reasonMissing) return;
        try {
          const detail = await decline.mutate({
            params: { participantId: invitation.participantId },
            body: share
              ? { shareReasonWithBuyer: true, sharedReason: reason.trim() }
              : { shareReasonWithBuyer: false },
          });
          close();
          onDone(detail);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={decline.pending}
      error={withPublicationMessage(decline.error, ['sharedReason'])}
    >
      <Checkbox
        label={t('opportunities.invitation.shareReason')}
        hint={t('opportunities.invitation.shareReasonHint')}
        checked={share}
        onChange={setShare}
      />
      {share && (
        <TextArea
          label={t('opportunities.invitation.sharedReason')}
          required
          rows={3}
          value={reason}
          onChange={setReason}
          error={
            fieldMessage(decline.error, 'sharedReason') ??
            (touched && reasonMissing
              ? t('opportunities.invitation.sharedReasonRequired')
              : undefined)
          }
        />
      )}
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Confidentiality
// ---------------------------------------------------------------------------------------------------------

export interface ConfidentialityDialogProps {
  readonly open: boolean;
  readonly tender: TenderRef;
  readonly text: string | null;
  readonly onClose: () => void;
  readonly onDone: (participation: OwnParticipation) => void;
}

export function ConfidentialityDialog({
  open,
  tender,
  text,
  onClose,
  onDone,
}: ConfidentialityDialogProps) {
  const accept = useApiMutation(publicationEndpoints.acceptConfidentiality);
  const tenant = useActiveTenant();
  return (
    <ConfirmActionDialog
      open={open}
      title={t('opportunities.confidentiality.title')}
      scope={tenderScope(tender, tenant?.name ?? '')}
      consequence={t('opportunities.confidentiality.consequence')}
      confirmLabel={t('opportunities.confidentiality.accept')}
      acknowledgement={t('opportunities.confidentiality.acknowledgement', {
        organization: tenant?.name ?? '',
      })}
      onCancel={() => {
        accept.reset();
        onClose();
      }}
      onConfirm={async () => {
        try {
          const participation = await accept.mutate({
            params: { tenderId: tender.tenderId },
            body: { accept: true },
          });
          accept.reset();
          onDone(participation);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={accept.pending}
      error={withPublicationMessage(accept.error)}
    >
      <Banner tone="warning" title={t('opportunities.confidentiality.textTitle')}>
        <p>{text ?? t('opportunities.invitation.confidentialityDefault')}</p>
      </Banner>
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Request access / register interest
// ---------------------------------------------------------------------------------------------------------

export interface RequestAccessDialogProps {
  readonly tender: TenderRef | null;
  readonly onClose: () => void;
  readonly onDone: (participation: OwnParticipation, tender: TenderRef) => void;
}

export function RequestAccessDialog({ tender, onClose, onDone }: RequestAccessDialogProps) {
  const request = useApiMutation(publicationEndpoints.requestAccess);
  const tenant = useActiveTenant();
  const me = useSignedInContact();
  const [contactName, setContactName] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const name = contactName ?? me.name;
  const email = contactEmail ?? me.email;
  const nameMissing = name.trim().length < 2;
  const emailInvalid = !EMAIL.test(email.trim());

  const close = (): void => {
    request.reset();
    setContactName(null);
    setContactEmail(null);
    setTouched(false);
    onClose();
  };

  return (
    <ConfirmActionDialog
      open={tender !== null}
      title={t('opportunities.access.title')}
      scope={tender === null ? '' : tenderScope(tender, tenant?.name ?? '')}
      consequence={t('opportunities.access.consequence')}
      confirmLabel={t('opportunities.access.submit')}
      reason={{
        label: t('opportunities.access.reason'),
        required: true,
        hint: t('opportunities.access.reasonHint'),
      }}
      onCancel={close}
      onConfirm={async ({ reason }) => {
        setTouched(true);
        if (tender === null || nameMissing || emailInvalid) return;
        try {
          const participation = await request.mutate({
            params: { tenderId: tender.tenderId },
            body: { reason, contactName: name.trim(), contactEmail: email.trim() },
          });
          close();
          onDone(participation, tender);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={request.pending}
      error={withPublicationMessage(request.error, ['contactName', 'contactEmail'])}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('opportunities.common.contactName')}
          required
          value={name}
          onChange={setContactName}
          error={
            fieldMessage(request.error, 'contactName') ??
            (touched && nameMissing ? t('opportunities.common.contactNameRequired') : undefined)
          }
        />
        <TextField
          label={t('opportunities.common.contactEmail')}
          type="email"
          required
          value={email}
          onChange={setContactEmail}
          error={
            fieldMessage(request.error, 'contactEmail') ??
            (touched && emailInvalid ? t('opportunities.common.contactEmailInvalid') : undefined)
          }
        />
      </div>
    </ConfirmActionDialog>
  );
}

export interface RegisterInterestDialogProps {
  readonly tender: TenderRef | null;
  readonly onClose: () => void;
  readonly onDone: (participation: OwnParticipation) => void;
}

export function SupplierInterestDialog({ tender, onClose, onDone }: RegisterInterestDialogProps) {
  const register = useApiMutation(publicationEndpoints.registerInterest);
  const tenant = useActiveTenant();
  const me = useSignedInContact();
  const [contactName, setContactName] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const name = contactName ?? me.name;
  const email = contactEmail ?? me.email;
  const nameMissing = name.trim().length < 2;
  const emailInvalid = !EMAIL.test(email.trim());

  const close = (): void => {
    register.reset();
    setContactName(null);
    setContactEmail(null);
    setTouched(false);
    onClose();
  };

  return (
    <ConfirmActionDialog
      open={tender !== null}
      title={t('opportunities.interest.title')}
      scope={tender === null ? '' : tenderScope(tender, tenant?.name ?? '')}
      consequence={t('opportunities.interest.consequence')}
      confirmLabel={t('opportunities.interest.submit')}
      onCancel={close}
      onConfirm={async () => {
        setTouched(true);
        if (tender === null || nameMissing || emailInvalid) return;
        try {
          const participation = await register.mutate({
            params: { tenderId: tender.tenderId },
            body: { contactName: name.trim(), contactEmail: email.trim() },
          });
          close();
          onDone(participation);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={register.pending}
      error={withPublicationMessage(register.error, ['contactName', 'contactEmail'])}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('opportunities.common.contactName')}
          required
          value={name}
          onChange={setContactName}
          error={
            fieldMessage(register.error, 'contactName') ??
            (touched && nameMissing ? t('opportunities.common.contactNameRequired') : undefined)
          }
        />
        <TextField
          label={t('opportunities.common.contactEmail')}
          type="email"
          required
          value={email}
          onChange={setContactEmail}
          error={
            fieldMessage(register.error, 'contactEmail') ??
            (touched && emailInvalid ? t('opportunities.common.contactEmailInvalid') : undefined)
          }
        />
      </div>
    </ConfirmActionDialog>
  );
}
