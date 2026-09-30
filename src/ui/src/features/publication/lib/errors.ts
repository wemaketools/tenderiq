/**
 * Business error codes of the publication contract mapped to clear, translated messages
 * (`publication.errors.<CODE>`). Unknown codes fall back to the shared sanitized description, so no failure is
 * silent. Shared by the publication, public-portal and opportunities features.
 */
import { ApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

function messageKey(error: ApiError): string | null {
  if (error.code === null) return null;
  const key = `publication.errors.${error.code}`;
  return hasTranslation(key) ? key : null;
}

/** The message to show for a failed publication request. */
export function publicationErrorMessage(error: ApiError): string {
  const key = messageKey(error);
  if (key === null) return describeError(error);
  // READINESS_BLOCKED names the concrete blockers in its detail.
  if (error.code === 'READINESS_BLOCKED' && error.detail !== null) {
    return `${t(key)} ${error.detail}`;
  }
  return t(key);
}

/**
 * The same error with its detail replaced by the translated business message, and without the field errors the
 * form already shows next to its inputs (for ConfirmActionDialog and FormErrorSummary).
 */
export function withPublicationMessage(
  error: ApiError | null,
  boundFields: readonly string[] = [],
): ApiError | null {
  if (error === null) return null;
  const key = messageKey(error);
  const fieldErrors = error.fieldErrors.filter(
    (item) => !boundFields.some((name) => item.field === name || item.field.startsWith(`${name}.`)),
  );
  return new ApiError({
    // A known business code is shown with its own message (describeError shows the detail of a conflict).
    kind: key === null ? error.kind : 'conflict',
    status: error.status,
    title: error.title,
    code: error.code,
    detail: key === null ? error.detail : publicationErrorMessage(error),
    fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}

/** The inline message of a bound field, from a failed request. */
export function fieldMessage(error: ApiError | null, field: string): string | undefined {
  if (error === null) return undefined;
  return error.fieldErrors.find(
    (item) => item.field === field || item.field.startsWith(`${field}.`),
  )?.message;
}
