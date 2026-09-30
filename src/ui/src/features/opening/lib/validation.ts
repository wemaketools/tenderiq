/**
 * Client-side validation with the contract's own body schemas, so the form shows the same `CODE|message` errors
 * the API would return (the API's 422 stays authoritative). `FormFeedback` merges both sources per field.
 */
import { splitIssueMessage } from '@contracts/common';
import type { FieldError } from '@contracts/common';
import type { ZodType } from 'zod';

import { isApiError } from '../../../api/client';

export type Validated<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly errors: FieldError[] };

export function validateBody<T>(schema: ZodType<T>, input: unknown): Validated<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map((item) => {
      const { code, message } = splitIssueMessage(item.message);
      return { field: item.path.map(String).join('.'), code, message };
    }),
  };
}

function matches(field: string, name: string): boolean {
  return field === name || field.startsWith(`${name}.`) || field.startsWith(`${name}[`);
}

export interface FormFeedback {
  readonly forField: (name: string) => string | undefined;
  /** Errors bound to no known field (shown in a summary). */
  readonly other: readonly FieldError[];
  readonly any: boolean;
}

/** Client errors first, then the API's field errors, over the form's known field names. */
export function formFeedback(
  clientErrors: readonly FieldError[],
  apiError: unknown,
  knownFields: readonly string[],
): FormFeedback {
  const server: readonly FieldError[] = isApiError(apiError) ? apiError.fieldErrors : [];
  const all = [...clientErrors, ...server];
  return {
    forField: (name) => all.find((item) => matches(item.field, name))?.message,
    other: all.filter((item) => !knownFields.some((name) => matches(item.field, name))),
    any: all.length > 0,
  };
}
