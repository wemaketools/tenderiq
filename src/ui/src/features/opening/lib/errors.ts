/**
 * Business error codes of the opening contract → clear user messages (catalog `opening.errors.<CODE>`). Codes
 * without a catalog entry fall back to the shared description (the problem's detail, or the platform message).
 */
import { ApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

export function actionErrorMessage(error: ApiError): string {
  if (error.code !== null) {
    const key = `opening.errors.${error.code}`;
    if (hasTranslation(key)) {
      return t(key);
    }
  }
  return describeError(error);
}

/**
 * The same error with its detail replaced by the business message, for shared widgets (ConfirmActionDialog) that
 * show `detail`. `null` stays `null`.
 */
export function withBusinessMessage(error: ApiError | null): ApiError | null {
  if (error === null || error.code === null || error.fieldErrors.length > 0) {
    return error;
  }
  return new ApiError({
    kind: error.kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: actionErrorMessage(error),
    fieldErrors: error.fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}
