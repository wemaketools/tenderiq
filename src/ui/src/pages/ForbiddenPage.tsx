/**
 * Forbidden: the active membership lacks the permission a page needs. It explains in business terms and never
 * reveals anything about the record or other organizations (identical-403 principle).
 */
import { useActiveTenant } from '../app/hooks';
import { ButtonLink } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { RestrictedState } from '../components/ui/EmptyState';
import { t } from '../lib/i18n';

export function ForbiddenPage() {
  const tenant = useActiveTenant();
  return (
    <div className="tiq-page">
      <PageHeader title={t('pages.forbidden.title')} />
      <div className="tiq-card">
        <RestrictedState
          title={t('pages.forbidden.title')}
          description={t('pages.forbidden.description', {
            organization: tenant?.name ?? '',
            capacity: tenant?.capacity ?? t('shell.user.member'),
          })}
          action={
            <ButtonLink to="/select-organization" icon="switchOrg">
              {t('shell.user.switch')}
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
