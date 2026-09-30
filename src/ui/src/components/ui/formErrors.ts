/**
 * problem+json field errors → form fields (docs/technical/09-frontend.md §12). The server's (or mock's) 422 is
 * authoritative. `errors[].field` is the zod issue path (`amount.currency`); each error binds to the input whose
 * name is that path or a prefix of it. No error is dropped: those that match no input are returned in `other` and
 * shown by `FormErrorSummary`.
 */
import type { FieldError } from '@contracts/common';

import { isApiError } from '../../api/client';

export interface FormErrors {
  /** The first message for a field, or `undefined`. */
  readonly forField: (name: string) => string | undefined;
  /** Errors that match none of the known fields (shown in the summary). */
  readonly other: readonly FieldError[];
  /** True when the error was a validation failure with field errors. */
  readonly hasFieldErrors: boolean;
}

function matches(field: string, name: string): boolean {
  return field === name || field.startsWith(`${name}.`) || field.startsWith(`${name}[`);
}

/** Splits the field errors of a failed call over the form's known field names. */
export function formErrors(error: unknown, knownFields: readonly string[]): FormErrors {
  const all: readonly FieldError[] = isApiError(error) ? error.fieldErrors : [];
  const other = all.filter((item) => !knownFields.some((name) => matches(item.field, name)));
  return {
    forField: (name) => all.find((item) => matches(item.field, name))?.message,
    other,
    hasFieldErrors: all.length > 0,
  };
}
