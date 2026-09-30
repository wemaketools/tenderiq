/**
 * Forgot password (COM-01 account recovery): sends the Supabase Auth reset email (visible in Mailpit locally,
 * DD-43). The confirmation is the same whether or not the account exists (no account enumeration).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/FormFields';
import { t } from '../lib/i18n';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './authContext';

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSending(true);
    await auth.requestPasswordReset(email.trim());
    setSending(false);
    setSent(true);
  };

  return (
    <AuthLayout title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      {sent ? (
        <div className="tiq-stack">
          <Banner tone="success" title={t('auth.forgot.sentTitle')}>
            {t('auth.forgot.sent')}
          </Banner>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          <TextField
            label={t('auth.field.email')}
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
            required
          />
          <Button type="submit" variant="primary" loading={sending} disabled={email.trim() === ''}>
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
      <div className="tiq-auth-links">
        <Link to="/signin">{t('auth.backToSignIn')}</Link>
      </div>
    </AuthLayout>
  );
}
