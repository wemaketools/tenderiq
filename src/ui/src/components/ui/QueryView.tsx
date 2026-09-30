/**
 * QueryView: the loading / error / restricted / empty / data states of one `useApiQuery` result, so every page
 * handles all of them the same way (PRD §11).
 */
import type { ReactNode } from 'react';

import type { QueryResult } from '../../api/hooks';
import { t } from '../../lib/i18n';
import { EmptyState, ErrorState } from './EmptyState';
import { SkeletonBlock } from './Skeleton';

export interface QueryViewProps<T> {
  readonly query: QueryResult<T>;
  readonly children: (data: T) => ReactNode;
  /** Returns true when the data is empty (then `empty` renders). */
  readonly isEmpty?: (data: T) => boolean;
  readonly empty?: ReactNode;
  readonly loading?: ReactNode;
  readonly errorTitle?: ReactNode;
}

export function QueryView<T>({
  query,
  children,
  isEmpty,
  empty,
  loading,
  errorTitle,
}: QueryViewProps<T>) {
  if (query.status === 'error' && query.error !== null && query.data === undefined) {
    return <ErrorState error={query.error} onRetry={query.reload} title={errorTitle} />;
  }
  if (query.data === undefined) {
    return <>{loading ?? <SkeletonBlock lines={4} />}</>;
  }
  if (isEmpty?.(query.data) === true) {
    return <>{empty ?? <EmptyState title={t('ui.table.empty')} />}</>;
  }
  return (
    <>
      {query.status === 'error' && query.error !== null && (
        <ErrorState error={query.error} onRetry={query.reload} title={errorTitle} />
      )}
      {children(query.data)}
    </>
  );
}
