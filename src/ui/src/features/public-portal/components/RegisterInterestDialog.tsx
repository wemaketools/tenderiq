/**
 * Register interest in a public notice without an account (PUB-03, DD-28: rate limited per IP and e-mail). The
 * receipt names the next step: register an organization or sign in to an existing one.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type { PublicInterestReceipt, PublicNotice } from '@contracts/publication';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Checkbox,
  Dialog,
  FormErrorSummary,
  TextField,
} from '../../../components/ui';
import { formatOfficialTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { fieldMessage, publicationErrorMessage } from '../../publication/lib/errors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInterestDialogProps {
  readonly open: boolean;
  readonly notice: PublicNotice;
  readonly onClose: () => void;
}

export function RegisterInterestDialog({ open, notice, onClose }: RegisterInterestDialogProps) {
  const register = useApiMutation(publicationEndpoints.publicRegisterInterest);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [receipt, setReceipt] = useState<PublicInterestReceipt | null>(null);

  const nameMissing = contactName.trim().length < 2;
  const emailInvalid = !EMAIL.test(email.trim());
  const organizationMissing = organizationName.trim().length < 2;

  const close = (): void => {
    register.reset();
    setContactName('');
    setEmail('');
    setOrganizationName('');
    setConsent(false);
    setTouched(false);
    setReceipt(null);
    onClose();
  };

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (nameMissing || emailInvalid || organizationMissing || !consent) return;
    try {
      const result = await register.mutate({
        params: { buyerSlug: notice.buyer.slug, reference: notice.reference },
        body: {
          contactName: contactName.trim(),
          email: email.trim(),
          organizationName: organizationName.trim(),
          consentToContact: true,
        },
      });
      setReceipt(result);
    } catch {
      // Shown in the dialog.
    }
  };

  const error = register.error;
  const known = ['contactName', 'email', 'organizationName', 'consentToContact'];
  const other =
    error === null ? [] : error.fieldErrors.filter((item) => !known.includes(item.field));

  return (
    <Dialog
      open={open}
      title={t('public-portal.interest.title')}
      description={t('public-portal.interest.scope', {
        reference: notice.reference,
        title: notice.title,
        buyer: notice.buyer.name,
      })}
      onClose={close}
      dismissible={!register.pending}
      footer={
        receipt === null ? (
          <>
            <Button onClick={close} disabled={register.pending}>
              {t('public-portal.actions.cancel')}
            </Button>
            <Button variant="primary" loading={register.pending} onClick={() => void submit()}>
              {t('public-portal.interest.submit')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close}>{t('public-portal.actions.close')}</Button>
            <ButtonLink to={receipt.nextStepPath} variant="primary">
              {receipt.nextStep === 'register'
                ? t('public-portal.actions.register')
                : t('public-portal.actions.signIn')}
            </ButtonLink>
          </>
        )
      }
    >
      {receipt !== null ? (
        <Banner tone="success" title={t('public-portal.interest.receivedTitle')}>
          <p>
            {t('public-portal.interest.received', {
              reference: receipt.reference,
              buyer: receipt.buyer.name,
              at: formatOfficialTime(receipt.receivedAt, notice.officialTimeZone),
            })}
          </p>
          <p>
            {receipt.nextStep === 'register'
              ? t('public-portal.interest.nextRegister')
              : t('public-portal.interest.nextSignIn')}
          </p>
        </Banner>
      ) : (
        <div className="tiq-stack">
          <p className="tiq-text-muted">{t('public-portal.interest.intro')}</p>
          {error !== null && error.fieldErrors.length === 0 && (
            <Banner tone="error" title={t('public-portal.interest.failed')}>
              <p>{publicationErrorMessage(error)}</p>
            </Banner>
          )}
          {other.length > 0 && <FormErrorSummary errors={other} />}
          <TextField
            label={t('public-portal.interest.contactName')}
            required
            autoComplete="name"
            value={contactName}
            onChange={setContactName}
            error={
              fieldMessage(error, 'contactName') ??
              (touched && nameMissing ? t('public-portal.interest.contactNameRequired') : undefined)
            }
          />
          <TextField
            label={t('public-portal.interest.email')}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={setEmail}
            error={
              fieldMessage(error, 'email') ??
              (touched && emailInvalid ? t('public-portal.interest.emailInvalid') : undefined)
            }
          />
          <TextField
            label={t('public-portal.interest.organization')}
            required
            autoComplete="organization"
            value={organizationName}
            onChange={setOrganizationName}
            error={
              fieldMessage(error, 'organizationName') ??
              (touched && organizationMissing
                ? t('public-portal.interest.organizationRequired')
                : undefined)
            }
          />
          <Checkbox
            label={t('public-portal.interest.consent', { buyer: notice.buyer.name })}
            checked={consent}
            onChange={setConsent}
            error={
              fieldMessage(error, 'consentToContact') ??
              (touched && !consent ? t('public-portal.interest.consentRequired') : undefined)
            }
          />
        </div>
      )}
    </Dialog>
  );
}
