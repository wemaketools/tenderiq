/**
 * The outcome of a registration or of claiming an invited organization (SUP-02, DD-27, AC-07): registration, contact
 * verification, membership, identity verification and qualification stay separate, the next steps are listed, and
 * the verification e-mail can be re-sent. Banking details are not collected.
 */
import { useState } from 'react';

import { BANKING_NOT_COLLECTED_NOTICE } from '@contracts/suppliers';
import type { RegistrationResult } from '@contracts/suppliers';

import { resendVerification } from '../../../api/suppliers';
import { Banner, Button, Card, StatusChip, TextField } from '../../../components/ui';
import { browserTimeZone, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { supplierErrorMessage } from '../lib/errors';
import { StatusSeparation } from './StatusSeparation';

export function RegistrationOutcome({
  result,
  email,
}: {
  readonly result: RegistrationResult;
  readonly email: string;
}) {
  const [resent, setResent] = useState<string | null>(null);
  const [resendError, setResendError] = useState<unknown>(null);
  const [resending, setResending] = useState(false);
  const zone = browserTimeZone();

  const resend = async (address: string): Promise<void> => {
    setResending(true);
    setResendError(null);
    try {
      const outcome = await resendVerification({ email: address });
      setResent(outcome.message);
    } catch (caught) {
      setResendError(caught);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="tiq-stack">
      <Banner
        tone={result.verificationEmailStatus === 'send_failed' ? 'warning' : 'success'}
        title={t('supplier-org.register.doneTitle', { name: result.legalName })}
      >
        <p>
          {result.verificationEmailStatus === 'send_failed'
            ? t('supplier-org.register.emailFailed')
            : t('supplier-org.register.emailSent')}
        </p>
        <p className="tiq-text-muted">
          {t('supplier-org.register.submittedAt', { at: formatDateTime(result.submittedAt, zone) })}
        </p>
      </Banner>
      {result.duplicateReviewRaised && (
        <Banner tone="info" title={t('supplier-org.register.duplicateRaisedTitle')}>
          <p>{t('supplier-org.register.duplicateRaised')}</p>
        </Banner>
      )}
      <StatusSeparation
        title={t('supplier-org.register.statusesTitle')}
        statuses={[
          {
            id: 'registration',
            label: t('supplier-org.statuses.registration'),
            value: <StatusChip enum="tenants.status" value={result.organizationStatus} />,
            explanation: t('supplier-org.statuses.registrationHint'),
          },
          {
            id: 'contact',
            label: t('supplier-org.statuses.contact'),
            value: (
              <span className="tiq-inline">
                <StatusChip enum="tenants.verification_status" value={result.verificationStatus} />
                <StatusChip
                  enum="invitations.status"
                  value={result.verificationEmailStatus}
                  size="sm"
                />
              </span>
            ),
            explanation: t('supplier-org.statuses.contactHint'),
          },
          {
            id: 'membership',
            label: t('supplier-org.statuses.membership'),
            value: (
              <span className="tiq-inline">
                <StatusChip enum="memberships.status" value={result.membershipStatus} />
                <StatusChip enum="users.status" value={result.userStatus} size="sm" />
              </span>
            ),
            explanation: t('supplier-org.statuses.membershipHint'),
          },
          {
            id: 'identity',
            label: t('supplier-org.statuses.identity'),
            value:
              result.verificationStatus === 'identity_verified'
                ? tEnum('tenants.verification_status', 'identity_verified')
                : t('supplier-org.statuses.identityPending'),
            explanation: t('supplier-org.statuses.identityHint'),
          },
          {
            id: 'qualification',
            label: t('supplier-org.statuses.qualification'),
            value: (
              <StatusChip
                enum="v_qualification_status.effective_status"
                value={result.qualificationStatus}
              />
            ),
            explanation: t('supplier-org.statuses.qualificationHint'),
          },
        ]}
      />
      <Card title={t('supplier-org.register.nextSteps')}>
        <ol className="tiq-stack">
          {result.nextSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Card>
      <Card
        title={t('supplier-org.register.resendTitle')}
        subtitle={t('supplier-org.register.resendIntro')}
      >
        <div className="tiq-stack">
          {resent !== null && (
            <Banner tone="success" title={t('supplier-org.register.resentTitle')}>
              <p>{resent}</p>
            </Banner>
          )}
          {resendError !== null && (
            <Banner tone="error" title={t('supplier-org.register.resendFailed')}>
              <p>{supplierErrorMessage(resendError)}</p>
            </Banner>
          )}
          <ResendForm
            defaultEmail={email}
            pending={resending}
            onResend={(value) => void resend(value)}
          />
        </div>
      </Card>
      {!result.bankingCollected && (
        <Banner tone="info" title={t('supplier-org.banking.title')}>
          <p>{BANKING_NOT_COLLECTED_NOTICE}</p>
        </Banner>
      )}
    </div>
  );
}

function ResendForm({
  defaultEmail,
  pending,
  onResend,
}: {
  readonly defaultEmail: string;
  readonly pending: boolean;
  readonly onResend: (email: string) => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <div className="tiq-inline">
      <TextField
        label={t('supplier-org.register.resendEmail')}
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={error}
      />
      <Button
        loading={pending}
        icon="mail"
        onClick={() => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError(t('supplier-org.register.resendEmailInvalid'));
            return;
          }
          setError(undefined);
          onResend(email.trim());
        }}
      >
        {t('supplier-org.register.resend')}
      </Button>
    </div>
  );
}
