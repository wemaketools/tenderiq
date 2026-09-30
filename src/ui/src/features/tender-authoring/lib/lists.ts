/**
 * List helpers of the tender register and the requirement list: empty filters are left out of the request, a
 * one-value select maps to a list filter, and the sort state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort } from '../../../components/ui';

/** A one-value list filter, or undefined when "all" is selected. */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T[] | undefined {
  if (value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

/** A single enum value, or undefined when "all" is selected or the value is unknown. */
export function single<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

export function tableSort(key: string, dir: string): DataTableSort {
  return { key, dir: directionOf(dir) };
}

/** A positive integer from a select value, or undefined. */
export function positiveId(value: string): number | undefined {
  return /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

/** Removes undefined and empty-string values so the request key stays stable. */
export function compact<T extends Record<string, unknown>>(query: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(query) as [keyof T, T[keyof T]][]) {
    if (value !== undefined && value !== '') result[key] = value;
  }
  return result;
}

/** Unique options (by value) sorted by label. */
export function uniqueOptions(
  entries: readonly { readonly value: string; readonly label: string }[],
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!seen.has(entry.value)) seen.set(entry.value, entry.label);
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
