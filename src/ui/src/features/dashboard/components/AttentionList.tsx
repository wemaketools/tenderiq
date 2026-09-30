/**
 * "Requires attention" (`overview.png`): each exception with its tone, explanation and count, linking to the
 * records behind it. Counts only cover records the caller may read (BR-43).
 */
import { Link } from 'react-router';

import type { ChipTone } from '@contracts/enums';

import { Chip, EmptyState, Icon } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';

export interface AttentionEntry {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly count: number;
  readonly tone: ChipTone;
  readonly to: string;
}

export function AttentionList({
  items,
  label,
  empty,
}: {
  readonly items: readonly AttentionEntry[];
  readonly label: string;
  readonly empty: string;
}) {
  if (items.length === 0) {
    return <EmptyState compact icon="checkCircle" title={empty} />;
  }
  return (
    <ul
      className="tiq-stack"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
      aria-label={label}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={item.to}
            className="tiq-inline"
            aria-label={t('dashboard.attention.itemLabel', {
              label: item.label,
              count: item.count,
              detail: item.detail,
            })}
            style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}
          >
            <span className="tiq-inline" style={{ flexWrap: 'nowrap' }}>
              <Chip
                tone={item.tone}
                size="sm"
                icon={item.tone === 'danger' ? 'alertOctagon' : 'alertTriangle'}
              >
                {formatCount(item.count)}
              </Chip>
              <span>
                <span>{item.label}</span>
                <span className="tiq-cell-sub">{item.detail}</span>
              </span>
            </span>
            <Icon name="arrowRight" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
