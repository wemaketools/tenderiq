/**
 * Business error codes of the evaluation contract → clear, translated messages. The server detail (for example the
 * criteria still "Not scored" behind ASSESSMENT_INCOMPLETE, AC-18) is kept after the message. Unknown codes fall back
 * to the shared sanitized description, so no failure is ever silent.
 */
import { ApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

function messageKey(error: ApiError): string | null {
  if (error.code === null) return null;
  const key = `evaluation.errors.${error.code}`;
  return hasTranslation(key) ? key : null;
}

/** The message to show for a failed evaluation request. */
export function evaluationErrorMessage(error: ApiError): string {
  const key = messageKey(error);
  if (key === null) return describeError(error);
  const message = t(key);
  return error.detail !== null && error.detail !== '' && error.detail !== message
    ? `${message} ${error.detail}`
    : message;
}

/**
 * The same error with a translated business message and, optionally, contract field names renamed to the dialog's
 * inputs (for example `details` → `reason`, so ConfirmActionDialog binds the message to its reason field).
 */
export function withEvaluationMessage(
  error: ApiError | null,
  renames: Readonly<Record<string, string>> = {},
): ApiError | null {
  if (error === null) return null;
  const key = messageKey(error);
  return new ApiError({
    kind: error.kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: key === null ? error.detail : evaluationErrorMessage(error),
    fieldErrors: error.fieldErrors.map((item) => {
      const renamed = Object.entries(renames).find(
        ([from]) => item.field === from || item.field.startsWith(`${from}.`),
      );
      return renamed === undefined
        ? item
        : { ...item, field: renamed[1] + item.field.slice(renamed[0].length) };
    }),
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}
