/**
 * List helpers of the evaluation registers: empty filters are left out of the request so its key stays stable, and
 * sort state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort } from '../../../components/ui';

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

export function tableSort(key: string, dir: string): DataTableSort {
  return { key, dir: directionOf(dir) };
}

/** A one-value list filter, or undefined when "all" is selected. */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T[] | undefined {
  if (value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

/** A sort field from the allowed list, or the fallback. */
export function sortFieldOf<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Removes undefined and empty-string values so the request key stays stable. */
export function compact<T extends Record<string, unknown>>(query: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(query) as [keyof T, T[keyof T]][]) {
    if (value !== undefined && value !== '') result[key] = value;
  }
  return result;
}

/** A positive integer from a route or query parameter, or null. */
export function parseId(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || !/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}
