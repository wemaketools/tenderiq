/**
 * User-facing text of a failed request: sanitized, and a 5xx asks the user to quote the correlation id
 * (docs/technical/09-frontend.md §10). A 403 that carries a business rule code (for example
 * `SELF_APPROVAL_BLOCKED` or `CUMULATIVE_AUTHORITY_EXCEEDED`) explains the rule with the problem's detail; the
 * platform's own permission and tenant refusals keep the generic restricted text (brief §5.7).
 */
import type { ApiError } from '../../api/client';
import { t } from '../../lib/i18n';

/** Platform 403 codes: a missing permission, or the uniform tenant refusal. They never explain a business rule. */
const PLATFORM_FORBIDDEN_CODES: readonly string[] = ['FORBIDDEN', 'TENANT_ACCESS_DENIED'];

/** True when a 403 carries a business rule code with an explanation the user can act on. */
export function isBusinessRefusal(error: ApiError): boolean {
  return (
    error.kind === 'forbidden' &&
    error.code !== null &&
    !PLATFORM_FORBIDDEN_CODES.includes(error.code) &&
    (error.detail ?? '').trim() !== ''
  );
}

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
      return isBusinessRefusal(error) ? (error.detail ?? '') : t('ui.restricted.description');
    default:
      return error.detail ?? error.title;
  }
}
