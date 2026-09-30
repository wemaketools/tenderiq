/**
 * Client-side validation with the contract schemas: the same zod rules (and `CODE|message` texts) the mock API
 * and Stage B apply, so a user sees the problem before sending. The server's 422 stays authoritative and is merged
 * in by field path.
 */
import type { z } from 'zod';

import { splitIssueMessage } from '@contracts/common';
import type { FieldError } from '@contracts/common';

import type { ApiError } from '../../../api/client';
import { formErrors } from '../../../components/ui';

/** zod issues → problem+json style field errors. */
export function issuesToFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => {
    const { code, message } = splitIssueMessage(issue.message);
    return { field: issue.path.map(String).join('.'), code, message };
  });
}

/** Validates `input` with `schema`; returns the field errors (empty when valid). */
export function validateWith(schema: z.ZodType, input: unknown): FieldError[] {
  const result = schema.safeParse(input);
  return result.success ? [] : issuesToFieldErrors(result.error);
}

function matches(field: string, name: string): boolean {
  return field === name || field.startsWith(`${name}.`) || field.startsWith(`${name}[`);
}

export interface ErrorLookup {
  readonly forField: (name: string) => string | undefined;
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
