/**
 * Typed Redux hooks and the session selectors every feature uses.
 */
import { useDispatch, useSelector } from 'react-redux';

import type { ActiveTenantContext, SessionMembership } from '@contracts/session';

import type { AppDispatch, RootState } from './store';
import { filtersChanged, filtersCleared } from './slices/filters';
import type { FilterValue, ScreenFilters } from './slices/filters';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** The active tenant (organization and capacity), or `null`. */
export function useActiveTenant(): ActiveTenantContext | null {
  return useAppSelector((state) => state.session.activeTenant);
}

/** The signed-in user's memberships (all statuses). */
export function useMemberships(): readonly SessionMembership[] {
  return useAppSelector((state) => state.session.memberships);
}

/** Increases on every tenant change: part of every tenant-scoped cache key. */
export function useTenantEpoch(): number {
  return useAppSelector((state) => state.session.tenantEpoch);
}

/** True when /me/context reported the prototype (mock API) environment (DD-43). */
export function useIsPrototype(): boolean {
  return useAppSelector((state) => state.session.environment?.mode === 'prototype');
}

const NO_FILTERS: ScreenFilters = {};

/**
 * Filters of one screen, kept in the tenant-scoped filters slice:
 * `const [filters, setFilters, clear] = useScreenFilters('BUY-07', { status: null })`.
 */
export function useScreenFilters<T extends Record<string, FilterValue>>(
  screen: string,
  defaults: T,
): [T, (values: Partial<T>) => void, () => void] {
  const dispatch = useAppDispatch();
  const stored = useAppSelector((state) => state.filters.byScreen[screen] ?? NO_FILTERS);
  const merged = { ...defaults, ...stored } as T;
  const set = (values: Partial<T>): void => {
    dispatch(filtersChanged({ screen, values: values as ScreenFilters }));
  };
  const clear = (): void => {
    dispatch(filtersCleared({ screen }));
  };
  return [merged, set, clear];
}
