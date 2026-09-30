/**
 * Form validation with the contract schemas (the same zod rules the API applies, so the user sees the server's
 * wording before sending) plus binding of the server's 422 field errors. The server stays authoritative: its field
 * errors win over the local ones for the same field.
 */
import { useState } from 'react';

import { splitIssueMessage } from '@contracts/common';

import { formErrors } from '../../../components/ui';

interface ParseIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

interface SafeParser<T> {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: readonly ParseIssue[] } };
}

/** Field → first message of a failed local parse. */
export function localErrors<T>(schema: SafeParser<T>, value: unknown): Record<string, string> {
  const result = schema.safeParse(value);
  if (result.success) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const item of result.error.issues) {
    const field = item.path.map(String).join('.');
    if (errors[field] === undefined) {
      errors[field] = splitIssueMessage(item.message).message;
    }
  }
  return errors;
}

export interface ValidatedForm<T> {
  /** The message for a field: the server's field error, else the local one after a submit attempt. */
  readonly errorFor: (field: string) => string | undefined;
  /** Marks the form as submitted and returns the parsed value, or `null` when a field is invalid. */
  readonly check: () => T | null;
  readonly tried: boolean;
  readonly reset: () => void;
}

/** Validates `value` with the contract `schema` and binds the server `error` of the last command. */
export function useValidatedForm<T>(
  schema: SafeParser<T>,
  value: unknown,
  serverError: unknown,
  fields: readonly string[],
): ValidatedForm<T> {
  const [tried, setTried] = useState(false);
  const local = tried ? localErrors(schema, value) : {};
  const server = formErrors(serverError, fields);
  return {
    errorFor: (field) =>
      server.forField(field) ??
      local[field] ??
      Object.entries(local).find(([key]) => key.startsWith(`${field}.`))?.[1],
    check: () => {
      setTried(true);
      const result = schema.safeParse(value);
      return result.success ? result.data : null;
    },
    tried,
    reset: () => setTried(false),
  };
}

/** Removes empty optional strings so optional contract fields are omitted rather than sent as ''. */
export function withoutEmpty<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, entry] of Object.entries(value) as [keyof T, T[keyof T]][]) {
    if (!(typeof entry === 'string' && entry.trim() === '')) {
      result[key] = entry;
    }
  }
  return result;
}
