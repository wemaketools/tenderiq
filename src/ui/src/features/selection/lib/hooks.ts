/**
 * Hooks shared by the selection pages.
 *
 * Prototype commands are static (foundation-contract §2.3): the next GET returns the fixture again, so a detail page
 * shows the record its last command returned (`useCommandResult`). A page that navigates after a create passes the
 * new record in the router state (`{ record }`), and the destination shows it until a newer command result arrives.
 */
import { useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';

import { selectionEndpoints } from '@contracts/selection';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { idOf } from './lists';

/** A positive integer route parameter, or null when it is missing or malformed. */
export function useIdParam(name: string): number | null {
  const params = useParams();
  return idOf(params[name]) ?? null;
}

/** The `?tenderId=` search parameter (forms opened from a tender), or null. */
export function useTenderSearchParam(): number | null {
  const [search] = useSearchParams();
  return idOf(search.get('tenderId')) ?? null;
}

/** The official time zone of the active organization (dates on these screens render in it). */
export function useOfficialTimeZone(): string {
  return useActiveTenant()?.officialTimeZone ?? 'UTC';
}

/** The default currency of the active organization, or null when it has none (no literal fallback). */
export function useDefaultCurrency(): string | null {
  return useActiveTenant()?.defaultCurrency ?? null;
}

/**
 * The latest command result for the record with `id`, seeded from the router state after a create. Returns the
 * record (or null) and a setter for the next command result.
 */
export function useCommandResult<T>(
  id: number | null,
  idOfRecord: (record: T) => number,
): readonly [T | null, (record: T) => void] {
  const location = useLocation();
  const seeded = (location.state as { readonly record?: T } | null)?.record;
  const [latest, setLatest] = useState<T | null>(null);
  if (latest !== null && idOfRecord(latest) === id) return [latest, setLatest];
  if (seeded !== undefined && seeded !== null && idOfRecord(seeded) === id) {
    return [seeded, setLatest];
  }
  return [null, setLatest];
}

/** The tenders of the selection register, for tender filters and pickers. */
export function useSelectionTenders() {
  return useApiQuery(selectionEndpoints.listTenders, {
    query: { pageSize: 100, sort: 'reference', dir: 'asc' },
  });
}

/**
 * The tender filter of a register: a `?tenderId=` link (from the tender workspace) wins over the stored screen
 * filter until the user changes or clears it. Returns the value, its setter and a clear function for the URL.
 */
export function useTenderFilter(
  stored: string,
  store: (value: string) => void,
): readonly [string, (value: string) => void, () => void] {
  const [search, setSearch] = useSearchParams();
  const fromUrl = search.get('tenderId');
  const linked = idOf(fromUrl);
  const value = linked === undefined ? stored : String(linked);
  const clearUrl = (): void => {
    if (fromUrl === null) return;
    const params = new URLSearchParams(search);
    params.delete('tenderId');
    setSearch(params, { replace: true });
  };
  const set = (next: string): void => {
    store(next);
    clearUrl();
  };
  return [value, set, clearUrl];
}
