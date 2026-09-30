/**
 * DetailList (`.tiq-dl`): read-only label/value panels. Empty values render the em dash.
 */
import type { ReactNode } from 'react';

import { EMPTY_VALUE } from '../../lib/format';

export interface DetailItem {
  readonly label: ReactNode;
  readonly value: ReactNode;
  /** Stable key when labels are not strings. */
  readonly key?: string;
}

export interface DetailListProps {
  readonly items: readonly DetailItem[];
  /** One item per row instead of the responsive grid. */
  readonly stacked?: boolean;
}

export function DetailList({ items, stacked = false }: DetailListProps) {
  return (
    <dl className={stacked ? 'tiq-dl tiq-dl--stacked' : 'tiq-dl'}>
      {items.map((item, index) => {
        const empty = item.value === null || item.value === undefined || item.value === '';
        return (
          <div key={item.key ?? (typeof item.label === 'string' ? item.label : index)}>
            <dt>{item.label}</dt>
            <dd>{empty ? EMPTY_VALUE : item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
