/**
 * Business error codes of the suppliers contract → clear, translated messages (catalog `supplier-org.errors`).
 * Unknown codes fall back to the shared sanitized description (`describeError`), so no failure is ever silent.
 */
import { ApiError, isApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

function messageKey(error: ApiError): string | null {
  if (error.code === null) return null;
  const key = `supplier-org.errors.${error.code}`;
  return hasTranslation(key) ? key : null;
}

/** The message to show for a failed suppliers request. */
export function supplierErrorMessage(error: unknown): string {
  if (!isApiError(error)) return t('ui.error.server');
  const key = messageKey(error);
  return key === null ? describeError(error) : t(key);
}

/** The same error with its detail replaced by the translated business message (for shared dialogs). */
export function withSupplierMessage(error: ApiError | null): ApiError | null {
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

/** True for the 403 that withholds financial evidence from this caller (PRD §4.3). */
export function isFinancialRestriction(error: unknown): boolean {
  return isApiError(error) && error.code === 'FINANCIAL_EVIDENCE_RESTRICTED';
}
