/**
 * List helpers shared by the supplier screens (SUP-05, BUY-31, operator reviews): empty filters are left out of the
 * request so the query key stays stable, single-choice filters map to the contract's list filters, and the sort
 * state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort } from '../../../components/ui';

/** A one-value list filter, or undefined when "all" is selected. */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T[] | undefined {
  if (value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

/** A positive integer filter held as a string (`''` = all). */
export function idOf(value: string): number | undefined {
  return /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

/** A calendar-date filter (`YYYY-MM-DD`), or undefined when empty. */
export function dateOf(value: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** A yes/no filter held as `'' | 'yes' | 'no'`. */
export function booleanOf(value: string): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

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

/** Splits a comma or line separated text into trimmed, non-empty, unique values. */
export function splitList(text: string): string[] {
  const values = text
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter((value) => value !== '');
  return [...new Set(values)];
}

/** The inverse of `splitList` for editing. */
export function joinList(values: readonly string[]): string {
  return values.join(', ');
}

/** `''` → null, else the trimmed text. */
export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
