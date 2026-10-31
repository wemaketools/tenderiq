/**
 * Work rows (docs/plan/design1): 64-80px rows with a leading tile or avatar, a title with a short secondary line,
 * right-aligned detail (money, a deadline, a status) and a circular arrow that opens the record. The arrow is the
 * real link (keyboard and screen readers get link semantics); with `stretch` the title link covers the whole row
 * for the mouse. Rows never rely on colour alone: every status comes with its text.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon } from './Icon';

export interface WorkListProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function WorkList({ label, children }: WorkListProps) {
  return (
    <ul className="tiq-rows" aria-label={label}>
      {children}
    </ul>
  );
}

export interface WorkRowProps {
  /** A tile, avatar or date badge at the start of the row. */
  readonly lead?: ReactNode;
  readonly title: ReactNode;
  /** The record the row opens; the title becomes a link and the arrow follows it. */
  readonly to?: string;
  /** Accessible name of the arrow link ("Open T-2026-0003 SCADA telemetry upgrade"). */
  readonly openLabel?: string;
  /** Short secondary items, separated by middle dots. */
  readonly meta?: readonly ReactNode[];
  /** A full line under the meta items (for example an official deadline that must not share a line). */
  readonly note?: ReactNode;
  /** A status column between the title and the aside (a StatusLabel with its sub-line). */
  readonly status?: ReactNode;
  /** Right-aligned detail (money, a date, a status). */
  readonly aside?: ReactNode;
  /** An extra control at the end (for example a disclosure toggle) instead of the arrow. */
  readonly trailing?: ReactNode;
  readonly selected?: boolean;
  readonly compact?: boolean;
  /** Makes the title link cover the whole row (mouse convenience; the arrow stays the accessible link). */
  readonly stretch?: boolean;
  readonly id?: string;
  /** Content rendered below the row inside the same list item (an expanded panel). */
  readonly children?: ReactNode;
}

export function WorkRow({
  lead,
  title,
  to,
  openLabel,
  meta,
  note,
  status,
  aside,
  trailing,
  selected = false,
  compact = false,
  stretch = false,
  id,
  children,
}: WorkRowProps) {
  const classes = ['tiq-row'];
  if (to !== undefined) classes.push('tiq-row--link');
  if (selected) classes.push('tiq-row--selected');
  if (compact) classes.push('tiq-row--compact');
  if (lead === undefined) classes.push('tiq-row--no-lead');
  if (status !== undefined) classes.push('tiq-row--status');
  const items = (meta ?? []).filter((item) => item !== null && item !== undefined && item !== '');
  return (
    <li id={id} className={classes.join(' ')} aria-current={selected ? 'true' : undefined}>
      {lead}
      <div className="tiq-row-main">
        <span className="tiq-row-title">
          {to !== undefined ? (
            <Link to={to} className={stretch ? 'tiq-row-stretch' : undefined} tabIndex={-1}>
              {title}
            </Link>
          ) : (
            title
          )}
        </span>
        {items.length > 0 && (
          <span className="tiq-row-meta tiq-dotsep">
            {items.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </span>
        )}
        {note !== undefined && <span className="tiq-row-meta tiq-row-note">{note}</span>}
      </div>
      {status !== undefined && <div className="tiq-row-status">{status}</div>}
      {aside !== undefined && <div className="tiq-row-aside">{aside}</div>}
      {trailing !== undefined ? (
        <div className="tiq-row-open">{trailing}</div>
      ) : (
        to !== undefined && (
          <div className="tiq-row-open">
            <Link to={to} className="tiq-row-arrow" aria-label={openLabel} title={openLabel}>
              <Icon name="arrowRight" />
            </Link>
          </div>
        )
      )}
      {children}
    </li>
  );
}
