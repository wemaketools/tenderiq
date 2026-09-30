/** The failure of an operations command, explained with the business rule it hit (see `lib/errors.ts`). */
import { isApiError } from '../../../api/client';
import { Banner, FormErrorSummary, formErrors } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { errorExplanation } from '../lib/errors';

export interface ActionErrorProps {
  readonly error: unknown;
  /**
   * Field names bound to inputs of the form (their errors are not repeated here). Omit it inside a
   * ConfirmActionDialog, which lists the field errors itself.
   */
  readonly fields?: readonly string[];
}

/**
 * The failure of a command: a business rule (with the catalog explanation and the server detail) or the field errors
 * that match no input of the form. Renders nothing without an error.
 */
export function ActionError({ error, fields }: ActionErrorProps) {
  if (!isApiError(error)) {
    return null;
  }
  if (error.fieldErrors.length > 0) {
    if (fields === undefined) {
      return null;
    }
    const errors = formErrors(error, fields);
    return errors.other.length > 0 ? (
      <FormErrorSummary title={error.title} errors={errors.other} />
    ) : null;
  }
  const explanation = errorExplanation(error);
  const detail = error.detail !== null && error.detail !== explanation ? error.detail : null;
  return (
    <Banner tone="error" title={error.title}>
      <p>{explanation}</p>
      {detail !== null && <p>{detail}</p>}
      {error.correlationId !== null && (
        <p className="tiq-mono">{t('ui.error.correlation', { id: error.correlationId })}</p>
      )}
    </Banner>
  );
}
