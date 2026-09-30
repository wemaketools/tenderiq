/**
 * The full-page loading state while the session is being established (supabase-js session, /me/context, entering
 * the organization).
 */
import { Wordmark } from '../auth/AuthLayout';
import { t } from '../lib/i18n';

export function LoadingScreen({ message }: { readonly message?: string }) {
  return (
    <div className="tiq-loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="tiq-loading-screen-inner">
        <Wordmark />
        <span className="tiq-btn-spinner" aria-hidden="true" />
        <span>{message ?? t('shell.loading.session')}</span>
      </div>
    </div>
  );
}
