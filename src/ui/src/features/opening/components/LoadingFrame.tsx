/**
 * The frame of a record page while its record loads or fails: the page title and back link stay visible, and the
 * QueryView renders loading, error or the restricted state (a 403 shows no content, AC-15).
 */
import type { ReactNode } from 'react';

import type { QueryResult } from '../../../api/hooks';
import { Card, PageHeader, QueryView } from '../../../components/ui';

export function LoadingFrame<T>({
  title,
  back,
  query,
  children,
}: {
  readonly title: string;
  readonly back: { readonly to: string; readonly label: string };
  readonly query: QueryResult<T>;
  readonly children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) {
    return <>{children(query.data)}</>;
  }
  return (
    <div className="tiq-page">
      <PageHeader title={title} back={back} />
      <Card>
        <QueryView query={query}>{() => null}</QueryView>
      </Card>
    </div>
  );
}
