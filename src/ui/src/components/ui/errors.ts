/**
 * User-facing text of a failed request: sanitized, and a 5xx asks the user to quote the correlation id
 * (docs/technical/09-frontend.md §10).
 */
import type { ApiError } from '../../api/client';
import { t } from '../../lib/i18n';

export function describeError(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return t('ui.error.network');
    case 'server':
      return t('ui.error.server');
    case 'contract':
      return t('ui.error.contract');
    case 'not_found':
      return t('ui.error.notFound');
    case 'rate_limited':
      return t('ui.error.rateLimited');
    case 'tenant_required':
      return t('ui.error.tenantRequired');
    case 'forbidden':
      return t('ui.restricted.description');
    default:
      return error.detail ?? error.title;
  }
}
