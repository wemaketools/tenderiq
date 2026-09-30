/**
 * Loads the top bar counts from the personal summaries (`me.notifications.summary`, `me.tasks.summary`; DD-21:
 * they cover every active membership) when the shell mounts and every minute. A summary endpoint that is not served
 * (404), forbidden or failing leaves its badge hidden (`null`), never a false zero.
 */
import { useEffect } from 'react';

import { getMyNotificationSummary } from '@contracts/notifications';
import { getMyTaskSummary } from '@contracts/tasks';

import { call } from '../../api/client';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { notificationCountsLoaded, taskCountsLoaded } from '../../app/slices/badges';

const REFRESH_MS = 60_000;

export function useMeBadges(): void {
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((state) => state.session.authStatus === 'signedIn');

  useEffect(() => {
    if (!signedIn) {
      return undefined;
    }
    let cancelled = false;
    const load = (): void => {
      call(getMyNotificationSummary, {}).then(
        (summary) => {
          if (!cancelled) {
            dispatch(
              notificationCountsLoaded({
                unread: summary.unread,
                requiresAcknowledgment: summary.requiresAcknowledgment,
              }),
            );
          }
        },
        () => {
          if (!cancelled) dispatch(notificationCountsLoaded(null));
        },
      );
      call(getMyTaskSummary, {}).then(
        (summary) => {
          if (!cancelled)
            dispatch(taskCountsLoaded({ open: summary.open, overdue: summary.overdue }));
        },
        () => {
          if (!cancelled) dispatch(taskCountsLoaded(null));
        },
      );
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [dispatch, signedIn]);
}
