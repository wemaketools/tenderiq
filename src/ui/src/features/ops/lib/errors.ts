/**
 * Business errors of the operations contract, explained in plain language (problem+json `code`, brief §5.3). The
 * catalog `ops.errors.<CODE>` explains what the rule protects; the server's detail (which may name the blocking
 * records) is shown beneath it. Shared by the operator area, the buyer service screens and the help centre.
 */
import type { ApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

/** The explanation of a failed command: the catalog text for a known business code, else the generic text. */
export function errorExplanation(error: ApiError): string {
  if (error.code !== null && hasTranslation(`ops.errors.${error.code}`)) {
    return t(`ops.errors.${error.code}`);
  }
  return describeError(error);
}

/** Pass to `ConfirmActionDialog.error` only field errors (bound to its reason input); business errors show in `ActionError`. */
export function fieldErrorOnly(error: ApiError | null): ApiError | null {
  return error !== null && error.fieldErrors.length > 0 ? error : null;
}
