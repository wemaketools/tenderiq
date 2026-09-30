/**
 * The state of one list screen: tenant-scoped filters (kept per screen), the sort and the page. Changing a filter,
 * the sort or the page size returns to the first page.
 */
import { useState } from 'react';

import type { SortDirection } from '@contracts/common';

import { useScreenFilters } from '../../../app/hooks';
import type { FilterValue } from '../../../app/slices/filters';
import type { DataTableSort, PaginationProps } from '../../../components/ui';

export interface ListState<F, S extends string> {
  readonly filters: F;
  readonly update: (values: Partial<F>) => void;
  readonly clear: () => void;
  readonly canClear: boolean;
  readonly sort: { readonly key: S; readonly dir: SortDirection };
  readonly onSortChange: (sort: DataTableSort) => void;
  readonly paging: { page: number; pageSize: number; sort: S; dir: SortDirection };
  readonly pagination: (total: number) => PaginationProps;
}

export function useListState<F extends Record<string, FilterValue>, S extends string>(
  screen: string,
  defaults: F,
  defaultSort: { readonly key: S; readonly dir: SortDirection },
): ListState<F, S> {
  const [filters, setFilters, clearFilters] = useScreenFilters(screen, defaults);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState(defaultSort);
  const canClear = Object.keys(defaults).some(
    (key) => JSON.stringify(filters[key]) !== JSON.stringify(defaults[key]),
  );
  return {
    filters,
    update: (values) => {
      setFilters(values);
      setPage(1);
    },
    clear: () => {
      clearFilters();
      setPage(1);
    },
    canClear,
    sort,
    onSortChange: (next) => {
      setSort({ key: next.key as S, dir: next.dir });
      setPage(1);
    },
    paging: { page, pageSize, sort: sort.key, dir: sort.dir },
    pagination: (total) => ({
      page,
      pageSize,
      total,
      onPageChange: setPage,
      onPageSizeChange: (size) => {
        setPageSize(size);
        setPage(1);
      },
    }),
  };
}

/** `''` → `undefined`, anything else → a one-value list (list filters). */
export function oneOf<T extends string>(value: string): T[] | undefined {
  return value === '' ? undefined : [value as T];
}

/** `''` → `undefined` (text and date filters). */
export function textOrUndefined(value: string): string | undefined {
  return value.trim() === '' ? undefined : value.trim();
}
