/**
 * Upcoming deadlines: reference, record, milestone (and lot when lot-specific, DD-15) with the OFFICIAL deadline
 * (date, time, UTC offset and IANA zone, DD-33) and the local time when it differs.
 */
import type { OfficialDeadline as OfficialDeadlineValue } from '@contracts/common';

import { EmptyState, OfficialDeadline, Reference } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export interface DeadlineEntry {
  readonly id: string;
  readonly reference: string;
  readonly title: string;
  readonly milestone: string;
  readonly lotLabel: string | null;
  readonly deadline: OfficialDeadlineValue;
  readonly detail: string | null;
  readonly to: string;
}

export function DeadlineList({
  items,
  label,
  empty,
}: {
  readonly items: readonly DeadlineEntry[];
  readonly label: string;
  readonly empty?: string;
}) {
  if (items.length === 0) {
    return <EmptyState compact icon="calendar" title={empty ?? t('dashboard.deadlines.empty')} />;
  }
  return (
    <ul
      className="tiq-stack"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
      aria-label={label}
    >
      {items.map((item) => (
        <li key={item.id} className="tiq-stack" style={{ gap: 'var(--tiq-space-1)' }}>
          <span className="tiq-inline">
            <Reference value={item.reference} to={item.to} />
            <span>{item.title}</span>
          </span>
          <span className="tiq-cell-sub">
            {item.lotLabel === null
              ? item.milestone
              : t('dashboard.deadlines.milestoneLot', {
                  milestone: item.milestone,
                  lot: item.lotLabel,
                })}
            {item.detail !== null && ` · ${item.detail}`}
          </span>
          <OfficialDeadline deadline={item.deadline} showRemaining />
        </li>
      ))}
    </ul>
  );
}
