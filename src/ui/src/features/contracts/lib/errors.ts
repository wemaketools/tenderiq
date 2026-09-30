/**
 * Business error codes of the contracts contract → clear, translated messages (`contracts.errors.<CODE>`). A code
 * without a catalog entry keeps the server's sanitized detail (`describeError`), so no failure is ever silent.
 */
import { ApiError } from '../../../api/client';
import { describeError, formErrors } from '../../../components/ui';
import type { FormErrors } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

function messageKey(error: ApiError): string | null {
  if (error.code === null) return null;
  const key = `contracts.errors.${error.code}`;
  return hasTranslation(key) ? key : null;
}

/** The message to show for a failed contracts request. */
export function contractErrorMessage(error: ApiError): string {
  const key = messageKey(error);
  return key === null ? describeError(error) : t(key);
}

/** The same error with its detail replaced by the translated business message (for shared dialogs). */
export function withContractMessage(error: ApiError | null): ApiError | null {
  if (error === null) return null;
  const key = messageKey(error);
  if (key === null) return error;
  // A refused business rule (for example a 403 on insufficient cumulative authority) keeps its specific
  // explanation instead of the generic "restricted" text the shared error description uses for 403s.
  return new ApiError({
    kind: error.kind === 'forbidden' ? 'conflict' : error.kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: t(key),
    fieldErrors: error.fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}

/**
 * Splits a failed command for a dialog that has its own fields: field errors bind to the inputs (`fields`), and the
 * dialog-level error is kept only for business failures (no field errors), so nothing is shown twice.
 */
export function splitCommandError(
  error: ApiError | null,
  fields: readonly string[],
): { readonly dialogError: ApiError | null; readonly fieldErrors: FormErrors } {
  const translated = withContractMessage(error);
  const hasFields = translated !== null && translated.fieldErrors.length > 0;
  return {
    dialogError: hasFields ? null : translated,
    fieldErrors: formErrors(translated, fields),
  };
}
