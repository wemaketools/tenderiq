/**
 * Business error codes of the bids contract mapped to clear, translated messages. Unknown codes fall back to the
 * shared sanitized description, so no failure is silent.
 */
import { ApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

function messageKey(error: ApiError): string | null {
  if (error.code === null) return null;
  const key = `responses.errors.${error.code}`;
  return hasTranslation(key) ? key : null;
}

/** The message to show for a failed response request. */
export function responseErrorMessage(error: ApiError): string {
  const key = messageKey(error);
  return key === null ? describeError(error) : t(key);
}

/** The same error with its detail replaced by the translated business message (for shared dialogs). */
export function withResponseMessage(error: ApiError | null): ApiError | null {
  if (error === null) return null;
  const key = messageKey(error);
  if (key === null) return error;
  return new ApiError({
    kind: error.kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: t(key),
    fieldErrors: error.fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}
