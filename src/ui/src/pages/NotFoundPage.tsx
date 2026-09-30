/**
 * Not found: an unknown URL. Inside the app shell it keeps the navigation; outside it offers the way home.
 */
import { PageHeader } from '../components/ui/PageHeader';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { t } from '../lib/i18n';

export interface NotFoundPageProps {
  /** Rendered inside the app shell (true) or standalone (false). */
  readonly inShell?: boolean;
}

export function NotFoundPage({ inShell = false }: NotFoundPageProps) {
  const body = (
    <div className="tiq-card">
      <EmptyState
        icon="compass"
        title={t('pages.notFound.title')}
        description={t('pages.notFound.description')}
        action={
          <ButtonLink to="/" variant="primary">
            {t('pages.notFound.home')}
          </ButtonLink>
        }
      />
    </div>
  );
  if (inShell) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('pages.notFound.title')} />
        {body}
      </div>
    );
  }
  return (
    <main className="tiq-auth-page">
      <PageHeader title={t('pages.notFound.title')} />
      <div className="tiq-auth-card tiq-auth-card--wide">{body}</div>
    </main>
  );
}
