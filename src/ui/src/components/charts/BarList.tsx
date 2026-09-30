/**
 * BarList (`overview.png` "Pipeline by Stage"): label, a proportional bar, the count and its share. Each row can
 * link to the filtered list behind it. Pure HTML/CSS on tokens.
 */
import { Link } from 'react-router';

import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { EmptyState } from '../ui/EmptyState';
import { chartColor } from './chartTheme';
import type { ChartTone } from './chartTheme';

export interface BarListItem {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  /** Display text of the value (defaults to the grouped count). */
  readonly display?: string;
  readonly to?: string;
  readonly tone?: ChartTone;
}

export interface BarListProps {
  readonly items: readonly BarListItem[];
  readonly label: string;
  /** Share denominator; defaults to the sum of the values. */
  readonly total?: number;
  readonly showShare?: boolean;
}

export function BarList({ items, label, total, showShare = true }: BarListProps) {
  if (items.length === 0) {
    return <EmptyState compact title={t('charts.empty')} />;
  }
  const sum = total ?? items.reduce((acc, item) => acc + item.value, 0);
  const max = Math.max(...items.map((item) => item.value), 0);
  return (
    <ul className="tiq-barlist" aria-label={label}>
      {items.map((item) => {
        const width = max === 0 ? 0 : (item.value / max) * 100;
        const share = sum === 0 ? 0 : Math.round((item.value / sum) * 100);
        const row = (
          <>
            <span className="tiq-barlist-label">{item.label}</span>
            <span className="tiq-barlist-track" aria-hidden="true">
              <span
                className="tiq-barlist-fill"
                style={{ width: `${width}%`, background: chartColor(item.tone ?? 'accent', 0) }}
              />
            </span>
            <span className="tiq-barlist-value">{item.display ?? formatCount(item.value)}</span>
            {showShare ? <span className="tiq-barlist-share">{`${share}%`}</span> : <span />}
          </>
        );
        return (
          <li key={item.id}>
            {item.to !== undefined ? (
              <Link to={item.to} className="tiq-barlist-row tiq-barlist-row--link">
                {row}
              </Link>
            ) : (
              <div className="tiq-barlist-row">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
