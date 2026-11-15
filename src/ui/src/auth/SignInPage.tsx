/**
 * Sign-in (COM-01) in the Stage A prototype (DD-50): the user picks a demo persona; there are no passwords. A persona
 * the API refuses (a deactivated account, AC-04) shows ONE generic message. After sign-in the user lands on the page
 * they asked for, or the home of their organization, or the organization selection (COM-02).
 */
import { Link, Navigate, useLocation } from 'react-router';

import { useAppSelector } from '../app/hooks';
import { landingPath, sessionPhase } from '../app/sessionSelectors';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { t } from '../lib/i18n';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './authContext';
import { PersonaPicker } from './PersonaPicker';

interface FromState {
  readonly from?: string;
}

export function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const session = useAppSelector((state) => state.session);
  const phase = sessionPhase(session);

  const from = (location.state as FromState | null)?.from;

  if (phase === 'ready') {
    const target =
      from !== undefined && from !== '/signin' && session.activeTenant !== null
        ? from
        : landingPath(session);
    return <Navigate to={target} replace />;
  }

  const busy = phase === 'loadingContext' || phase === 'switchingTenant';

  return (
    <AuthLayout title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')} wide>
      <div aria-busy={busy || undefined}>
        {session.signOutReason === 'expired' && (
          <Banner tone="info">{t('auth.signIn.expired')}</Banner>
        )}
        {session.signOutReason === 'rejected' && (
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
        {busy && (
          <p className="tiq-text-muted" role="status">
            {t('auth.signIn.signingIn')}
          </p>
        )}
        {phase !== 'contextError' && (
          <PersonaPicker disabled={busy} onPick={(email) => auth.signIn(email)} />
        )}
      </div>
      <div className="tiq-auth-links">
        <Link to="/">{t('auth.signIn.publicPortal')}</Link>
      </div>
    </AuthLayout>
  );
}
