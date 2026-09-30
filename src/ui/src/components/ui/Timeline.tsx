/**
 * Timeline (`.tiq-timeline`): a vertical sequence of events with a toned marker, title, meta line and detail. Used by
 * the audit history, approval routes and amendment histories.
 */
import type { ReactNode } from 'react';

import { Icon } from './Icon';
import type { IconName } from './Icon';

export type TimelineTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'accent';

export interface TimelineItem {
  readonly id: string | number;
  readonly title: ReactNode;
  readonly meta?: ReactNode;
  readonly detail?: ReactNode;
  readonly tone?: TimelineTone;
  readonly icon?: IconName;
}

export interface TimelineProps {
  readonly items: readonly TimelineItem[];
  readonly label: string;
}

export function Timeline({ items, label }: TimelineProps) {
  return (
    <ol className="tiq-timeline" aria-label={label}>
      {items.map((item) => {
        const tone = item.tone ?? 'neutral';
        return (
          <li key={item.id} className="tiq-timeline-item">
            <span
              className={
                tone === 'neutral'
                  ? 'tiq-timeline-dot'
                  : `tiq-timeline-dot tiq-timeline-dot--${tone}`
              }
              aria-hidden="true"
            >
              <Icon name={item.icon ?? 'clock'} />
            </span>
            <div className="tiq-timeline-body">
              <p className="tiq-timeline-title">{item.title}</p>
              {item.meta !== undefined && <p className="tiq-timeline-meta">{item.meta}</p>}
              {item.detail !== undefined && (
                <div className="tiq-timeline-detail">{item.detail}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
