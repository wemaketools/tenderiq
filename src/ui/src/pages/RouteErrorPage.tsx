/**
 * The route error element: what renders when a route fails to load or throws while rendering (instead of React
 * Router's unstyled default boundary). A page module that could not be fetched (a dropped connection, or a new
 * version deployed since the app was opened) asks for a reload, because a failed dynamic import is cached until the
 * document reloads. A 404 response renders Not found. Anything else renders a sanitized "something went wrong"
 * with the same reload and the way home; the raw error never reaches the screen.
 */
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { t } from '../lib/i18n';
import { NotFoundPage } from './NotFoundPage';
import { isChunkLoadError } from './chunkLoadError';

export interface RouteErrorPageProps {
  /** Rendered inside the app shell (true) or standalone (false). */
  readonly inShell?: boolean;
  /** Reloads the document (default `window.location.reload`; replaceable in tests). */
  readonly onReload?: () => void;
}

function reloadDocument() {
  window.location.reload();
}

export function RouteErrorPage({
  inShell = false,
  onReload = reloadDocument,
}: RouteErrorPageProps) {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage inShell={inShell} />;
  }
  const kind = isChunkLoadError(error) ? 'chunk' : 'unexpected';
  const title = t(`pages.routeError.${kind}.title`);
  const body = (
    <div className="tiq-card" data-state="error">
      <EmptyState
        icon="alertTriangle"
        title={title}
        description={t(`pages.routeError.${kind}.description`)}
        action={
          <div className="tiq-inline">
            <Button variant="primary" icon="refresh" onClick={onReload}>
              {t('pages.routeError.reload')}
            </Button>
            <ButtonLink to="/">{t('pages.notFound.home')}</ButtonLink>
          </div>
        }
      />
    </div>
  );
  if (inShell) {
    return (
      <div className="tiq-page">
        <PageHeader title={title} />
        {body}
      </div>
    );
  }
  return (
    <main className="tiq-auth-page">
      <PageHeader title={title} />
      <div className="tiq-auth-card tiq-auth-card--wide">{body}</div>
    </main>
  );
}
