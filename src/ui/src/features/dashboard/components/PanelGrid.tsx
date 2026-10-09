/**
 * A row of dashboard panels that adapts to the panels the caller may read (DD-49): a panel left out for the role
 * leaves no empty column. Three panels share a three-column grid, two share a two-column grid (or the main-plus-side
 * sidebar grid), and a single panel spans the page on its own.
 */
import { Children } from 'react';
import type { ReactNode } from 'react';

export interface PanelGridProps {
  /** `columns` spreads the panels evenly; `sidebar` gives the first panel two thirds when both are present. */
  readonly variant?: 'columns' | 'sidebar';
  /** The panels; `false`, `null` and `undefined` entries (panels left out for the role) are skipped. */
  readonly children: ReactNode;
}

export function PanelGrid({ variant = 'columns', children }: PanelGridProps) {
  const panels = Children.toArray(children);
  if (panels.length === 0) return null;
  if (panels.length === 1) return <>{panels}</>;
  const layout =
    variant === 'sidebar'
      ? 'tiq-grid--sidebar'
      : panels.length === 2
        ? 'tiq-grid--2'
        : 'tiq-grid--3';
  return <div className={`tiq-grid ${layout}`}>{panels}</div>;
}
