/**
 * The failure of an opening command inside a form or dialog: the business message of its error code, and the
 * correlation id to quote. Field errors are bound to inputs by the form instead.
 */
import type { ApiError } from '../../../api/client';
import { Banner } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { actionErrorMessage } from '../lib/errors';

export function ActionError({ error }: { readonly error: ApiError | null }) {
  if (error === null || error.fieldErrors.length > 0) {
    return null;
  }
  return (
    <Banner tone="error" title={error.title}>
      <p>{actionErrorMessage(error)}</p>
      {error.correlationId !== null && (
        <p className="tiq-mono">{t('ui.error.correlation', { id: error.correlationId })}</p>
      )}
    </Banner>
  );
}
