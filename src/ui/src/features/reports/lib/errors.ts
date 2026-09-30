/**
 * Business error messages of the reporting and records contracts. A stable `code` from the API (for example
 * `DISPOSAL_BLOCKED_BY_HOLD`) maps to a clear sentence in the `reports.errors` catalog; anything else falls back to
 * the shared description (sanitized detail, or the correlation hint for server errors).
 */
import { isApiError } from '../../../api/client';
import type { ApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

/** The user-facing sentence of a failed reporting or records command. */
export function businessErrorMessage(error: ApiError): string {
  if (error.code !== null) {
    const key = `reports.errors.${error.code}`;
    if (hasTranslation(key)) return t(key);
  }
  return describeError(error);
}

/** The ApiError of a caught value, or `null`. */
export function asApiError(error: unknown): ApiError | null {
  return isApiError(error) ? error : null;
}
