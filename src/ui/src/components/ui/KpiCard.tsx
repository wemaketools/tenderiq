/**
 * KPI cards (`overview.png`): icon halo, label, value, optional delta and hint. Restricted metrics show an
 * explanation instead of a number (BR-43: never a misleading zero). `KpiGrid` lays them out responsively.
 */
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { EMPTY_VALUE } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface KpiDelta {
  readonly direction: 'up' | 'down' | 'flat';
  /** Display text, for example `-6` or `+30.5pp`. */
  readonly text: string;
  /** Whether the change is good; defaults to "up is good". */
  readonly positive?: boolean;
}

export interface KpiCardProps {
  readonly label: string;
  /** Formatted value; `null` renders the em dash. */
  readonly value: ReactNode;
  readonly icon: IconName;
  readonly tone?: 'accent' | 'warning' | 'danger' | 'success' | 'info';
  readonly delta?: KpiDelta;
  readonly hint?: ReactNode;
  /** Makes the card a link to the underlying list. */
  readonly to?: string;
  /** The caller may not see this metric: explain instead of showing a number. */
  readonly restricted?: boolean;
}

export function KpiCard({
  label,
  value,
  icon,
  tone = 'accent',
  delta,
  hint,
  to,
  restricted = false,
}: KpiCardProps) {
  const deltaGood = delta === undefined ? true : (delta.positive ?? delta.direction !== 'down');
  const deltaClass =
    delta === undefined || delta.direction === 'flat'
      ? 'tiq-kpi-delta tiq-kpi-delta--flat'
      : deltaGood
        ? 'tiq-kpi-delta tiq-kpi-delta--up'
        : 'tiq-kpi-delta tiq-kpi-delta--down';
  const valueRef = useRef<HTMLSpanElement>(null);
  // Long values (for example "BWP 1,920,000" in a narrow card) shrink to fit instead of overflowing; short ones
  // keep the full size. The class is toggled on the element directly, so no re-render is needed.
  useLayoutEffect(() => {
    const element = valueRef.current;
    if (element === null) return undefined;
    const fit = (): void => {
      element.classList.remove('tiq-kpi-value--fit');
      if (element.scrollWidth > element.clientWidth) element.classList.add('tiq-kpi-value--fit');
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, restricted]);
  const body = (
    <div className="tiq-kpi">
      <div className="tiq-kpi-head">
        <span className={tone === 'accent' ? 'tiq-kpi-halo' : `tiq-kpi-halo tiq-kpi-halo--${tone}`}>
          <Icon name={restricted ? 'lock' : icon} />
        </span>
        <span className="tiq-kpi-label">{label}</span>
      </div>
      {restricted ? (
        <span className="tiq-kpi-hint">{t('ui.kpi.restricted')}</span>
      ) : (
        <span className="tiq-kpi-value" ref={valueRef}>
          {value === null || value === undefined ? EMPTY_VALUE : value}
        </span>
      )}
      {!restricted && delta !== undefined && (
        <span className={deltaClass}>
          <Icon
            name={
              delta.direction === 'up'
                ? 'arrowUp'
                : delta.direction === 'down'
                  ? 'arrowDown'
                  : 'minus'
            }
          />
          {delta.text}
        </span>
      )}
      {hint !== undefined && <span className="tiq-kpi-hint">{hint}</span>}
    </div>
  );
  return (
    <section className="tiq-card" aria-label={label}>
      {to !== undefined && !restricted ? (
        <Link to={to} className="tiq-kpi-link">
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}

export function KpiGrid({ children }: { readonly children: ReactNode }) {
  return <div className="tiq-kpi-grid">{children}</div>;
}
