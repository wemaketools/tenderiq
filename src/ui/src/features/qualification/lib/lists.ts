/**
 * List helpers of the qualification registers: empty filters are left out of the request (stable query keys),
 * single-value selects map to the contract's list filters, and the sort state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort } from '../../../components/ui';

/** A one-value list filter, or undefined when "all" is selected or the value is unknown. */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T[] | undefined {
  if (value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

/** A positive id from a select value, or undefined. */
export function idOf(value: string): number | undefined {
  return /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

/** A calendar-date filter (`YYYY-MM-DD`), or undefined when empty. */
export function dateOf(value: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** `true` when the box is ticked, otherwise the filter is left out. */
export function flagOf(value: boolean): true | undefined {
  return value ? true : undefined;
}

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

/** The sort field when the contract allows it, else the fallback. */
export function sortOf<const F extends readonly string[]>(
  value: string,
  fields: F,
  fallback: F[number],
): F[number] {
  return (fields as readonly string[]).includes(value) ? (value as F[number]) : fallback;
}

export function tableSort(key: string, dir: string): DataTableSort {
  return { key, dir: directionOf(dir) };
}

/** Removes undefined values so the request key stays stable. */
export function compact<T extends Record<string, unknown>>(query: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(query) as [keyof T, T[keyof T]][]) {
    if (value !== undefined && value !== '') result[key] = value;
  }
  return result;
}
