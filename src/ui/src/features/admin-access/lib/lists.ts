/**
 * List helpers shared by the org-admin registers (users, invitations, roles, groups, grants, restrictions,
 * findings, conflicts, structure values, authority, committees): empty filters are left out of the request so the
 * query key stays stable, list filters accept one value, and sort state maps to the DataTable.
 */
import type { SortDirection } from '@contracts/common';

import type { DataTableSort } from '../../../components/ui';

/** A one-value list filter, or undefined when "all" is selected. */
export function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): T[] | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return (allowed as readonly string[]).includes(value) ? [value as T] : undefined;
}

/** `'true'`/`'false'` select values → a boolean filter, or undefined for "all". */
export function booleanFilter(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** A positive id from a select value, or undefined. */
export function idFilter(value: string): number | undefined {
  return /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

export function directionOf(value: string): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

/** The sort field when it is one of `allowed`, otherwise `fallback`. */
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

/** True when any filter other than paging and sorting has a value. */
export function isFiltered(filters: Readonly<Record<string, unknown>>): boolean {
  return Object.entries(filters).some(
    ([key, value]) =>
      !['sort', 'dir', 'page', 'pageSize'].includes(key) && value !== '' && value !== null,
  );
}

/** The pagination props of a page response, or undefined while loading. */
export function pagingOf(
  data: { readonly page: number; readonly pageSize: number; readonly total: number } | undefined,
  set: (values: { page?: number; pageSize?: number }) => void,
) {
  if (data === undefined) return undefined;
  return {
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    onPageChange: (page: number) => set({ page }),
    onPageSizeChange: (pageSize: number) => set({ pageSize, page: 1 }),
  };
}
