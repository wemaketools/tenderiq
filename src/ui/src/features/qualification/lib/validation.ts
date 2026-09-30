/**
 * Client-side validation with the qualification contract schemas: the same zod rules (and `CODE|message` texts)
 * the mock API and Stage B apply (N/A needs a reason, conditional outcomes state conditions and the blocked gate,
 * a non-adequate financial conclusion records its qualifications), so the user sees the problem before sending.
 * The server's 422 stays authoritative and is merged in by field path.
 */
import type { z } from 'zod';

import { splitIssueMessage } from '@contracts/common';
import type { FieldError } from '@contracts/common';

import type { ApiError } from '../../../api/client';
import { formErrors } from '../../../components/ui';
import { t } from '../../../lib/i18n';

/** Validates `input` with `schema`; returns problem+json style field errors (empty when valid). */
export function validateWith(schema: z.ZodType, input: unknown): FieldError[] {
  const result = schema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const field = issue.path.map(String).join('.');
    // A missing value arrives as the wrong type: say that it is required instead of zod's type message.
    if (issue.code === 'invalid_type') {
      return { field, code: 'REQUIRED', message: t('qualification.validation.required') };
    }
    const { code, message } = splitIssueMessage(issue.message);
    return { field, code, message };
  });
}

function matches(field: string, name: string): boolean {
  return field === name || field.startsWith(`${name}.`) || field.startsWith(`${name}[`);
}

export interface ErrorLookup {
  readonly forField: (name: string) => string | undefined;
  /** Errors that match no known field (shown by FormErrorSummary). */
  readonly other: readonly FieldError[];
  readonly count: number;
}

/** Client errors first, then the server's field errors, bound to the known field paths. */
export function errorLookup(
  client: readonly FieldError[],
  server: ApiError | null,
  known: readonly string[],
): ErrorLookup {
  const fromServer = formErrors(server, known);
  const clientOther = client.filter((item) => !known.some((name) => matches(item.field, name)));
  return {
    forField: (name) =>
      client.find((item) => matches(item.field, name))?.message ?? fromServer.forField(name),
    other: [...clientOther, ...fromServer.other],
    count: client.length + (server?.fieldErrors.length ?? 0),
  };
}

/** A trimmed text, or null when empty (optional text fields of the contract). */
export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** A money value, or null when no amount is entered. */
export function moneyOrNull(value: {
  readonly amount: string;
  readonly currency: string;
}): { amount: string; currency: string } | null {
  return value.amount.trim() === ''
    ? null
    : { amount: value.amount.trim(), currency: value.currency };
}
