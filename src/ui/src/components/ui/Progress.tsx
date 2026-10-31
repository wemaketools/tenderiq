/**
 * Progress figures (docs/plan/design1): dots with a fraction (a compact meter when there are many), a meter bar, the
 * big "18 of 24" count, a stat figure with its caption, and the stage glance (label, count and bar per stage). The
 * number is always printed: the dots and bars only illustrate it.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';

export type MeterTone = 'accent' | 'neutral' | 'warning' | 'info' | 'danger';

export interface MeterProps {
  readonly value: number;
  readonly max: number;
  readonly label: string;
  readonly tone?: MeterTone;
  readonly thin?: boolean;
}

export function Meter({ value, max, label, tone = 'accent', thin = false }: MeterProps) {
  const percent = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <span
      className={thin ? 'tiq-meter tiq-meter--thin' : 'tiq-meter'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.max(0, Math.min(max, value))}
    >
      <span
        className={tone === 'accent' ? 'tiq-meter-fill' : `tiq-meter-fill tiq-meter-fill--${tone}`}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}

/** Dots up to this many; a meter beyond (plan §5: a compact meter when assignment counts are large). */
export const DOTS_MAX = 10;

export interface ProgressDotsProps {
  readonly done: number;
  readonly total: number;
  readonly label: string;
}

/** `●●●●○○ 4/6`: one dot per unit with the fraction beside it, or a thin meter plus the fraction. */
export function ProgressDots({ done, total, label }: ProgressDotsProps) {
  const fraction = t('ui.progress.ofTotal', { done: formatCount(done), total: formatCount(total) });
  if (total > DOTS_MAX) {
    return (
      <span className="tiq-dots">
        <span className="tiq-meter tiq-meter--thin" aria-hidden="true">
          <span
            className="tiq-meter-fill"
            style={{ width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` }}
          />
        </span>
        <span className="tiq-dots-frac" aria-label={`${label}: ${fraction}`}>
          {fraction}
        </span>
      </span>
    );
  }
  return (
    <span className="tiq-dots">
      <span className="tiq-dots-track" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={index < done ? 'tiq-dot tiq-dot--done' : 'tiq-dot'} />
        ))}
      </span>
      <span className="tiq-dots-frac" aria-label={`${label}: ${fraction}`}>
        {fraction}
      </span>
    </span>
  );
}

export interface BigCountProps {
  readonly value: number;
  readonly total: number;
  readonly label: ReactNode;
  /** Something at the end of the line (an attention line such as "2 overdue"). */
  readonly aside?: ReactNode;
  readonly meterLabel: string;
}

/** "18 of 24 assessments submitted" with a meter below. */
export function BigCount({ value, total, label, aside, meterLabel }: BigCountProps) {
  return (
    <div className="tiq-stack">
      <div className="tiq-bigcount-row">
        <p className="tiq-bigcount">
          <span className="tiq-bigcount-value">{formatCount(value)}</span>
          <span className="tiq-bigcount-of">{t('ui.progress.of')}</span>
          <span className="tiq-bigcount-total">{formatCount(total)}</span>
          <span className="tiq-bigcount-label">{label}</span>
        </p>
        {aside}
      </div>
      <Meter value={value} max={total} label={meterLabel} />
    </div>
  );
}

export interface StatProps {
  readonly value: ReactNode;
  /** A smaller word after the value ("committed"). */
  readonly unit?: ReactNode;
  readonly caption: ReactNode;
}

export function Stat({ value, unit, caption }: StatProps) {
  return (
    <div className="tiq-stat">
      <p className="tiq-stat-value">
        {value}
        {unit !== undefined && <small>{unit}</small>}
      </p>
      <p className="tiq-stat-caption">{caption}</p>
    </div>
  );
}

export interface StageGlanceItem {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly to?: string;
}

export interface StageGlanceProps {
  readonly items: readonly StageGlanceItem[];
  readonly label: string;
}

/** A column per stage: label, count and a bar proportional to the largest stage. */
export function StageGlance({ items, label }: StageGlanceProps) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <ul className="tiq-stagebar" aria-label={label}>
      {items.map((item) => {
        const body = (
          <>
            <span className="tiq-stagebar-label">{item.label}</span>
            <span className="tiq-stagebar-count">{formatCount(item.count)}</span>
            <Meter
              value={item.count}
              max={max}
              label={`${item.label}: ${formatCount(item.count)}`}
              tone={item.count === 0 ? 'neutral' : 'accent'}
              thin
            />
          </>
        );
        return (
          <li key={item.id}>
            {item.to !== undefined ? (
              <Link to={item.to} className="tiq-stagebar-item">
                {body}
              </Link>
            ) : (
              <span className="tiq-stagebar-item">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
