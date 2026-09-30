/**
 * SUP-02 — request membership in the organization the duplicate check found. The form never names that organization
 * (it knows only the opaque match token). A signed-in person requests through `/me` (the request then appears under
 * "My membership requests"); anyone else through the public endpoint.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import type { FieldError } from '@contracts/common';
import { MeMembershipRequestBody, PublicMembershipRequestBody } from '@contracts/suppliers';

import { createMyMembershipRequest, requestMembershipPublic } from '../../../api/suppliers';
import { useAppSelector } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  FormErrorSummary,
  TextArea,
  TextField,
} from '../../../components/ui';
import { browserTimeZone, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { supplierErrorMessage } from '../lib/errors';
import { supplierOrgPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

const FIELDS = ['fullName', 'email', 'phone', 'message', 'matchToken'] as const;

export interface MembershipRequestFormProps {
  readonly matchToken: string;
  readonly defaultEmail: string;
  readonly defaultName: string;
  readonly onCancel: () => void;
}

interface Outcome {
  readonly message: string;
  readonly submittedAt: string;
  readonly viaAccount: boolean;
}

export function MembershipRequestForm({
  matchToken,
  defaultEmail,
  defaultName,
  onCancel,
}: MembershipRequestFormProps) {
  const signedIn = useAppSelector((state) => state.session.authStatus === 'signedIn');
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [serverError, setServerError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const errors = errorLookup(clientErrors, serverError, FIELDS);

  const submit = async (): Promise<void> => {
    setServerError(null);
    const body = signedIn
      ? { matchToken, message }
      : {
          matchToken,
          fullName,
          email,
          message,
          ...(phone.trim() === '' ? {} : { phone }),
        };
    const found = validateWith(
      signedIn ? MeMembershipRequestBody : PublicMembershipRequestBody,
      body,
    );
    setClientErrors(found);
    if (found.length > 0) return;
    setPending(true);
    try {
      if (signedIn) {
        const created = await createMyMembershipRequest({ matchToken, message: message.trim() });
        setOutcome({
          message: t('supplier-org.membership.sentAccount'),
          submittedAt: created.createdAt,
          viaAccount: true,
        });
      } else {
        const result = await requestMembershipPublic({
          matchToken,
          fullName: fullName.trim(),
          email: email.trim(),
          message: message.trim(),
          ...(phone.trim() === '' ? {} : { phone: phone.trim() }),
        });
        setOutcome({ message: result.message, submittedAt: result.submittedAt, viaAccount: false });
      }
    } catch (caught) {
      setServerError(caught);
    } finally {
      setPending(false);
    }
  };

  if (outcome !== null) {
    return (
      <Banner tone="success" title={t('supplier-org.membership.sentTitle')}>
        <p>{outcome.message}</p>
        <p className="tiq-text-muted">
          {t('supplier-org.membership.sentAt', {
            at: formatDateTime(outcome.submittedAt, browserTimeZone()),
          })}
        </p>
        <p>{t('supplier-org.membership.sentNext')}</p>
        {outcome.viaAccount && (
          <Link to={supplierOrgPaths.myMembershipRequests}>
            {t('supplier-org.membership.openMine')}
          </Link>
        )}
      </Banner>
    );
  }

  return (
    <Card
      title={t('supplier-org.membership.title')}
      subtitle={t('supplier-org.membership.subtitle')}
      footer={
        <div className="tiq-inline">
          <Button onClick={onCancel} disabled={pending}>
            {t('supplier-org.membership.back')}
          </Button>
          <Button variant="primary" loading={pending} onClick={() => void submit()}>
            {t('supplier-org.membership.submit')}
          </Button>
        </div>
      }
    >
      <div className="tiq-stack">
        {serverError !== null && (
          <FormErrorSummary title={supplierErrorMessage(serverError)} errors={errors.other} />
        )}
        {serverError === null && errors.other.length > 0 && (
          <FormErrorSummary errors={errors.other} />
        )}
        <div className="tiq-form-grid">
          {!signedIn && (
            <>
              <TextField
                label={t('supplier-org.membership.fullName')}
                required
                autoComplete="name"
                value={fullName}
                onChange={setFullName}
                error={errors.forField('fullName')}
              />
              <TextField
                label={t('supplier-org.membership.email')}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={setEmail}
                error={errors.forField('email')}
              />
              <TextField
                label={t('supplier-org.membership.phone')}
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={setPhone}
                error={errors.forField('phone')}
              />
            </>
          )}
          <TextArea
            label={t('supplier-org.membership.message')}
            hint={t('supplier-org.membership.messageHint')}
            required
            fieldClassName="tiq-form-full"
            rows={4}
            value={message}
            onChange={setMessage}
            error={errors.forField('message')}
          />
        </div>
      </div>
    </Card>
  );
}
