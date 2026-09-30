/**
 * ReadinessChecklist: readiness checks before a consequential step (release, submission, opening, award). Blocking
 * failures, warnings and passed checks look distinct (colour, icon, text) and are ordered blocking → warning →
 * passed, with a summary of the counts (PRD §19).
 */
import type { ReactNode } from 'react';

import { t } from '../../lib/i18n';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { ReadinessStatus } from './readiness';
import { Chip } from './StatusChip';

export type { ReadinessStatus } from './readiness';

export interface ReadinessItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly detail?: ReactNode;
  readonly status: ReadinessStatus;
  /** A link or button that resolves the item. */
  readonly action?: ReactNode;
}

export interface ReadinessChecklistProps {
  readonly items: readonly ReadinessItem[];
  readonly label: string;
}

const ORDER: Readonly<Record<ReadinessStatus, number>> = { blocking: 0, warning: 1, passed: 2 };
const ICON: Readonly<Record<ReadinessStatus, IconName>> = {
  blocking: 'xCircle',
  warning: 'alertTriangle',
  passed: 'checkCircle',
};

export function ReadinessChecklist({ items, label }: ReadinessChecklistProps) {
  const sorted = [...items].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const count = (status: ReadinessStatus): number =>
    items.filter((item) => item.status === status).length;
  return (
    <div>
      <div className="tiq-readiness-summary" aria-live="polite">
        <Chip tone={count('blocking') > 0 ? 'danger' : 'neutral'}>
          {t('ui.readiness.blocking', { count: count('blocking') })}
        </Chip>
        <Chip tone={count('warning') > 0 ? 'warning' : 'neutral'}>
          {t('ui.readiness.warning', { count: count('warning') })}
        </Chip>
        <Chip tone="success">{t('ui.readiness.passed', { count: count('passed') })}</Chip>
      </div>
      <ul className="tiq-readiness" aria-label={label}>
        {sorted.map((item) => (
          <li
            key={item.id}
            className={`tiq-readiness-item tiq-readiness-item--${item.status}`}
            data-status={item.status}
          >
            <Icon name={ICON[item.status]} />
            <span className="tiq-readiness-text">
              <span>
                <span className="tiq-visually-hidden">
                  {t(`ui.readiness.status.${item.status}`)}:{' '}
                </span>
                {item.label}
              </span>
              {item.detail !== undefined && (
                <span className="tiq-readiness-detail">{item.detail}</span>
              )}
            </span>
            {item.action ?? <span />}
          </li>
        ))}
      </ul>
    </div>
  );
}
