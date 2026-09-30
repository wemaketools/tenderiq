/**
 * Inline value renderers (docs/technical/09-frontend.md §14): monospace accent references that link to their record,
 * money from decimal strings with its currency, and the em dash for empty values.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { EMPTY_VALUE, formatMoney } from '../../lib/format';
import type { MoneyValue } from '../../lib/format';

export interface ReferenceProps {
  /** For example `T-2026-0003`. */
  readonly value: string;
  /** In-app path of the record; omitted when the caller may not open it. */
  readonly to?: string | null;
}

/** A record reference in monospace accent text, linked when a path is given. */
export function Reference({ value, to }: ReferenceProps) {
  if (to === undefined || to === null) {
    return <span className="tiq-ref">{value}</span>;
  }
  return (
    <Link to={to} className="tiq-ref">
      {value}
    </Link>
  );
}

export interface MoneyTextProps {
  readonly value: MoneyValue | null | undefined;
  readonly compact?: boolean;
  readonly places?: number | 'auto';
}

/** Money with its currency code (`BWP 1,500,000`), tabular numerals. */
export function MoneyText({ value, compact, places }: MoneyTextProps) {
  return (
    <span className="tiq-num" data-empty={value === null || value === undefined || undefined}>
      {formatMoney(value, { compact, places })}
    </span>
  );
}

/** Renders the value, or the em dash when it is empty. */
export function OrDash({ children }: { readonly children: ReactNode }) {
  const empty = children === null || children === undefined || children === '';
  return <>{empty ? EMPTY_VALUE : children}</>;
}
