/**
 * List helpers: empty filters are left out of the request (stable request keys), one-value selects become list
 * filters, and the sort state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort, PaginationProps } from '../../../components/ui';

/** A one-value list filter, or undefined when "all" is selected. */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T[] | undefined {
  if (value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

export function tableSort(key: string, dir: string): DataTableSort {
  return { key, dir: directionOf(dir) };
}

/** A sort field from the allowed list, or the fallback. */
export function sortOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Removes undefined, false and empty-string values so the request key stays stable. */
export function compact<T extends Record<string, unknown>>(query: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(query) as [keyof T, T[keyof T]][]) {
    if (value !== undefined && value !== '' && value !== false) result[key] = value;
  }
  return result;
}

/** A calendar date input value, or undefined when empty. */
export function dateOrUndefined(value: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** A positive integer from a select value, or undefined. */
export function idOrUndefined(value: string): number | undefined {
  return /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

/** The page meta of a list response as DataTable pagination props. */
export function paginationOf(
  data: { readonly page: number; readonly pageSize: number; readonly total: number } | undefined,
  set: (values: { page?: number; pageSize?: number }) => void,
): PaginationProps | undefined {
  if (data === undefined) return undefined;
  return {
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    onPageChange: (page) => set({ page }),
    onPageSizeChange: (pageSize) => set({ pageSize, page: 1 }),
  };
}
