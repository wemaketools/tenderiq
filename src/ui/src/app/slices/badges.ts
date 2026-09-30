/**
 * Badges slice (docs/technical/09-frontend.md §9): the notification bell and task counts, and feature-provided
 * nav badges.
 *
 * - `me` counts (notifications, tasks) cover every active membership (DD-21), so they survive a tenant switch and
 *   reset only on sign-out. `null` means "not loaded or not available" (for example while the /me summary
 *   endpoints are not served yet): the shell then shows no badge rather than a false zero.
 * - `nav` counts are tenant-scoped (a feature reports, say, open clarifications for the active buyer) and reset on
 *   every tenant change.
 */
import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import { activeTenantCleared, activeTenantSet, signedOut } from './session';

export interface MeCounts {
  readonly notificationsUnread: number | null;
  readonly notificationsRequiringAcknowledgment: number | null;
  readonly tasksOpen: number | null;
  readonly tasksOverdue: number | null;
}

export interface BadgesState {
  readonly me: MeCounts;
  /** Nav item id → count. */
  readonly nav: Readonly<Record<string, number>>;
}

const emptyMe: MeCounts = {
  notificationsUnread: null,
  notificationsRequiringAcknowledgment: null,
  tasksOpen: null,
  tasksOverdue: null,
};

const initialState: BadgesState = { me: emptyMe, nav: {} };

const badgesSlice = createSlice({
  name: 'badges',
  initialState,
  reducers: {
    notificationCountsLoaded(
      state,
      action: PayloadAction<{ unread: number; requiresAcknowledgment: number } | null>,
    ) {
      state.me.notificationsUnread = action.payload?.unread ?? null;
      state.me.notificationsRequiringAcknowledgment =
        action.payload?.requiresAcknowledgment ?? null;
    },
    taskCountsLoaded(state, action: PayloadAction<{ open: number; overdue: number } | null>) {
      state.me.tasksOpen = action.payload?.open ?? null;
      state.me.tasksOverdue = action.payload?.overdue ?? null;
    },
    navBadgeSet(state, action: PayloadAction<{ id: string; count: number | null }>) {
      if (action.payload.count === null || action.payload.count <= 0) {
        delete state.nav[action.payload.id];
      } else {
        state.nav[action.payload.id] = action.payload.count;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(signedOut, () => initialState);
    builder.addMatcher(isAnyOf(activeTenantSet, activeTenantCleared), (state) => {
      state.nav = {};
    });
  },
});

export const { notificationCountsLoaded, taskCountsLoaded, navBadgeSet } = badgesSlice.actions;
export const badgesReducer = badgesSlice.reducer;
