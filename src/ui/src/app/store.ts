/**
 * The Redux store (brief §10): session, filters and badges slices. `createAppStore` builds a fresh store (tests use
 * it with a preloaded state); `store` is the application's instance.
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { badgesReducer } from './slices/badges';
import { filtersReducer } from './slices/filters';
import { sessionReducer } from './slices/session';

export const rootReducer = combineReducers({
  session: sessionReducer,
  filters: filtersReducer,
  badges: badgesReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: rootReducer, preloadedState });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];

export const store = createAppStore();
