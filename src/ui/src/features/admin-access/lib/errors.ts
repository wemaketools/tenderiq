/**
 * Business error codes of the org-admin contract → clear, translated messages (`admin-access.errors.<CODE>`, shared
 * by the account, admin-org and admin-access features). Unknown codes fall back to the shared sanitized description
 * (`describeError`), so no failure is ever silent.
 */
import { ApiError } from '../../../api/client';
import { describeError } from '../../../components/ui';
import { hasTranslation, t } from '../../../lib/i18n';

function messageKey(error: ApiError): string | null {
  if (error.code === null) return null;
  const key = `admin-access.errors.${error.code}`;
  return hasTranslation(key) ? key : null;
}

/** The message to show for a failed org-admin request. */
export function orgAdminErrorMessage(error: ApiError): string {
  const key = messageKey(error);
  return key === null ? describeError(error) : t(key);
}

/** The same error with its detail replaced by the translated business message (for shared dialogs). */
export function withOrgAdminMessage(error: ApiError | null): ApiError | null {
  if (error === null) return null;
  const key = messageKey(error);
  if (key === null) return error;
  return new ApiError({
    // A business refusal (for example 403 SELF_GRANT_FORBIDDEN) keeps its own message: the shared dialog shows
    // the generic restricted text for `forbidden`, so the translated refusal is presented as a conflict.
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

function matches(field: string, name: string): boolean {
  return field === name || field.startsWith(`${name}.`) || field.startsWith(`${name}[`);
}

/**
 * The error to pass to a ConfirmActionDialog whose form binds `fields` inline: field errors of those fields are
 * shown beside their inputs, so they are removed here; anything else (a business code, an unmatched field) stays.
 */
export function dialogError(error: ApiError | null, fields: readonly string[]): ApiError | null {
  const translated = withOrgAdminMessage(error);
  if (translated === null) return null;
  const rest = translated.fieldErrors.filter(
    (item) => !fields.some((name) => matches(item.field, name)),
  );
  if (rest.length === translated.fieldErrors.length) return translated;
  if (rest.length === 0 && translated.kind === 'validation') return null;
  return new ApiError({
    kind: translated.kind,
    status: translated.status,
    title: translated.title,
    code: translated.code,
    detail: translated.detail,
    fieldErrors: rest,
    correlationId: translated.correlationId,
    endpointId: translated.endpointId,
  });
}
