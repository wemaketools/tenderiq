/**
 * Sign-in (COM-01): email and password through supabase-js (DD-43). Any failure shows ONE generic message, so the
 * form cannot reveal which accounts exist (brief §5.7). After sign-in the user lands on the page they asked for, or
 * the home of their organization, or the organization selection (COM-02).
 *
 * While a request runs the fields are read-only (not disabled), so keyboard focus stays in the form; after a failure
 * focus returns to the password field.
 *
 * In local development builds only, the demo-accounts quick-pick is loaded below the card (DD-43).
 */
import { Suspense, lazy, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { useAppSelector } from '../app/hooks';
import { landingPath, sessionPhase } from '../app/sessionSelectors';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/FormFields';
import { t } from '../lib/i18n';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './authContext';

// Local development builds only: Vite replaces import.meta.env.DEV with false in production builds, so this lazy
// import and its module are removed from the bundle (scan-bundle verifies the marker is absent).
const DemoAccounts = import.meta.env.DEV ? lazy(() => import('./DemoAccounts')) : null;

const PASSWORD_FIELD_ID = 'tiq-signin-password';

interface FromState {
  readonly from?: string;
}

export function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const session = useAppSelector((state) => state.session);
  const phase = sessionPhase(session);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const from = (location.state as FromState | null)?.from;

  if (phase === 'ready') {
    const target =
      from !== undefined && from !== '/signin' && session.activeTenant !== null
        ? from
        : landingPath(session);
    return <Navigate to={target} replace />;
  }

  const signIn = async (address: string, secret: string): Promise<void> => {
    setSubmitting(true);
    setFailed(false);
    const result = await auth.signIn(address.trim(), secret);
    setSubmitting(false);
    if (!result.ok) {
      setFailed(true);
      // Keyboard users continue where they were: back in the password field, next to the error message.
      document.getElementById(PASSWORD_FIELD_ID)?.focus();
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void signIn(email, password);
  };

  const busy = submitting || phase === 'loadingContext' || phase === 'switchingTenant';

  return (
    <AuthLayout
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      below={
        DemoAccounts !== null && phase === 'signedOut' ? (
          <Suspense fallback={null}>
            <DemoAccounts
              disabled={busy}
              onPick={(pickedEmail, pickedPassword) => {
                setEmail(pickedEmail);
                setPassword(pickedPassword);
                void signIn(pickedEmail, pickedPassword);
              }}
            />
          </Suspense>
        ) : undefined
      }
    >
      <form onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
        {session.signOutReason === 'expired' && !failed && (
          <Banner tone="info">{t('auth.signIn.expired')}</Banner>
        )}
        {(failed || session.signOutReason === 'rejected') && (
          <Banner tone="error">{t('auth.signIn.failed')}</Banner>
        )}
        {phase === 'contextError' && (
          <Banner
            tone="error"
            title={t('auth.signIn.contextFailed')}
            actions={
              <>
                <Button size="sm" onClick={() => auth.reloadContext()}>
                  {t('ui.action.retry')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void auth.signOut()}>
                  {t('shell.user.signOut')}
                </Button>
              </>
            }
          >
            {session.contextError?.correlationId != null && (
              <p className="tiq-mono">
                {t('ui.error.correlation', { id: session.contextError.correlationId })}
              </p>
            )}
          </Banner>
        )}
        <TextField
          label={t('auth.field.email')}
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          required
          readOnly={busy}
          aria-disabled={busy || undefined}
        />
        <TextField
          id={PASSWORD_FIELD_ID}
          label={t('auth.field.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
          readOnly={busy}
          aria-disabled={busy || undefined}
        />
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={email.trim() === '' || password === ''}
        >
          {busy ? t('auth.signIn.signingIn') : t('auth.signIn.submit')}
        </Button>
      </form>
      <div className="tiq-auth-links">
        <Link to="/forgot-password">{t('auth.signIn.forgot')}</Link>
        <Link to="/">{t('auth.signIn.publicPortal')}</Link>
      </div>
    </AuthLayout>
  );
}
