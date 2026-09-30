/**
 * Reset password (COM-01): the password-recovery link from the reset email lands here with a recovery session;
 * the user sets a new password through supabase-js.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { useAppSelector } from '../app/hooks';
import { Banner } from '../components/ui/Banner';
import { Button, ButtonLink } from '../components/ui/Button';
import { TextField } from '../components/ui/FormFields';
import { t } from '../lib/i18n';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './authContext';

const MIN_LENGTH = 8;

export function ResetPasswordPage() {
  const auth = useAuth();
  const signedIn = useAppSelector((state) => state.session.authStatus === 'signedIn');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<'idle' | 'saved' | 'failed'>('idle');

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canRecover = auth.recoverySession || signedIn;

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    const outcome = await auth.updatePassword(password);
    setSaving(false);
    setResult(outcome.ok ? 'saved' : 'failed');
  };

  if (!canRecover) {
    return (
      <AuthLayout title={t('auth.reset.title')}>
        <div className="tiq-stack">
          <Banner tone="warning" title={t('auth.reset.noSessionTitle')}>
            {t('auth.reset.noSession')}
          </Banner>
          <ButtonLink to="/forgot-password" variant="primary">
            {t('auth.reset.requestNew')}
          </ButtonLink>
        </div>
        <div className="tiq-auth-links">
          <Link to="/signin">{t('auth.backToSignIn')}</Link>
        </div>
      </AuthLayout>
    );
  }

  if (result === 'saved') {
    return (
      <AuthLayout title={t('auth.reset.title')}>
        <div className="tiq-stack">
          <Banner tone="success" title={t('auth.reset.savedTitle')}>
            {t('auth.reset.saved')}
          </Banner>
          <ButtonLink to="/signin" variant="primary">
            {t('auth.reset.continue')}
          </ButtonLink>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle', { min: MIN_LENGTH })}
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        {result === 'failed' && <Banner tone="error">{t('auth.reset.failed')}</Banner>}
        <TextField
          label={t('auth.reset.newPassword')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
          error={tooShort ? t('auth.reset.tooShort', { min: MIN_LENGTH }) : undefined}
        />
        <TextField
          label={t('auth.reset.confirmPassword')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          required
          error={mismatch ? t('auth.reset.mismatch') : undefined}
        />
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={password.length < MIN_LENGTH || confirm !== password}
        >
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
