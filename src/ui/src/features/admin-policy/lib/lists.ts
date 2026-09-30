/**
 * List helpers shared by the ADM-06/07/08 registers: the `YYYY-MM-DD` filter inputs map to instant bounds, empty
 * filters are left out of the request, and sort state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort } from '../../../components/ui';

/** The first instant of a calendar date (UTC), or undefined for an empty input. */
export function fromDate(date: string): string | undefined {
  return date === '' ? undefined : `${date}T00:00:00Z`;
}

/** The last instant of a calendar date (UTC), or undefined for an empty input. */
export function toDate(date: string): string | undefined {
  return date === '' ? undefined : `${date}T23:59:59Z`;
}

/** A one-value list filter, or undefined when "all" is selected. */
export function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] | undefined {
  if (value === null || value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
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
