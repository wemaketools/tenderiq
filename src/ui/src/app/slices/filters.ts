/**
 * Filters slice (docs/technical/09-frontend.md §9): the filter and sort state of each screen, keyed by a screen id
 * (the PRD screen id or a feature-chosen stable id, the same value used for `saved_views.scope`). Tenant-scoped:
 * it resets whenever the active tenant changes or the user signs out.
 */
import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import { tenantBoundaryActions } from './session';

/** A JSON-serializable filter value. `null` means "no filter". */
export type FilterValue = string | number | boolean | string[] | null;
export type ScreenFilters = Record<string, FilterValue>;

export interface FiltersState {
  readonly byScreen: Record<string, ScreenFilters>;
}

const initialState: FiltersState = { byScreen: {} };

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    /** Merges values into a screen's filters. */
    filtersChanged(state, action: PayloadAction<{ screen: string; values: ScreenFilters }>) {
      const { screen, values } = action.payload;
      state.byScreen[screen] = { ...state.byScreen[screen], ...values };
    },
    /** Replaces a screen's filters (for example when a saved view is applied). */
    filtersReplaced(state, action: PayloadAction<{ screen: string; values: ScreenFilters }>) {
      state.byScreen[action.payload.screen] = action.payload.values;
    },
    filtersCleared(state, action: PayloadAction<{ screen: string }>) {
      delete state.byScreen[action.payload.screen];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(isAnyOf(...tenantBoundaryActions), () => initialState);
  },
});

export const { filtersChanged, filtersReplaced, filtersCleared } = filtersSlice.actions;
export const filtersReducer = filtersSlice.reducer;
