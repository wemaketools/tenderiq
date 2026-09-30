/**
 * List helpers of the selection registers: empty filters are left out of the request, one-value selects map to
 * the contract's list filters, and the sort state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort } from '../../../components/ui';

/** A one-value list filter, or undefined when "all" is selected. */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T[] | undefined {
  if (value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

/** A positive id from a select or search parameter, or undefined. */
export function idOf(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || !/^[1-9]\d*$/.test(value)) return undefined;
  return Number(value);
}

/** A `true`/`false` select value, or undefined for "all". */
export function booleanOf(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

/** The sort field when it is one of the allowed ones, else the fallback. */
export function sortOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function tableSort(key: string, dir: string): DataTableSort {
  return { key, dir: directionOf(dir) };
}

/** Removes undefined and empty-string values so the request key stays stable. */
export function compact<T extends Record<string, unknown>>(query: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(query) as [keyof T, T[keyof T]][]) {
    if (value !== undefined && value !== '') result[key] = value;
  }
  return result;
}

/** Splits a multi-line text area into trimmed, non-empty lines (topics). */
export function linesOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Runs a command whose failure is already shown by its mutation state (`useApiMutation().error`): resolves the
 * response, or `undefined` when it failed, so dialogs never leave an unhandled rejection.
 */
export async function attempt<T>(command: Promise<T>): Promise<T | undefined> {
  try {
    return await command;
  } catch {
    return undefined;
  }
}
