/**
 * The compact working toolbar of a register (docs/plan/design1): the search box, a few always-visible controls
 * and, at the end, a "Filters" disclosure that opens the advanced filters below the toolbar. Advanced controls
 * move into the disclosure but stay available, and the toggle says how many of them are active.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { t } from '../../lib/i18n';
import { Button } from './Button';

export interface ToolbarProps {
  readonly children: ReactNode;
  /** Controls aligned to the end of the row (view switches, the filter toggle). */
  readonly end?: ReactNode;
  readonly label?: string;
}

export function Toolbar({ children, end, label }: ToolbarProps) {
  return (
    <div className="tiq-toolbar" role="group" aria-label={label ?? t('ui.filters.label')}>
      {children}
      {end !== undefined && <div className="tiq-toolbar-end">{end}</div>}
    </div>
  );
}

export interface FilterDisclosureProps {
  /** How many advanced filters are active (shown on the toggle; opens the panel on first render when > 0). */
  readonly activeCount: number;
  /** The panel content (usually a `FilterBar variant="panel"`). */
  readonly children: ReactNode;
  /** Renders the toggle; the panel renders where `panel` is placed. */
  readonly render: (toggle: ReactNode, panel: ReactNode) => ReactNode;
}

/**
 * An accessible disclosure for the advanced filters: the toggle button carries `aria-expanded` and
 * `aria-controls`; the panel is not rendered while closed, so its controls leave the tab order.
 */
export function FilterDisclosure({ activeCount, children, render }: FilterDisclosureProps) {
  const id = useId();
  const [open, setOpen] = useState(activeCount > 0);
  const label =
    activeCount > 0
      ? t('ui.filters.advancedActive', { count: activeCount })
      : t('ui.filters.advanced');
  const toggle = (
    <Button
      icon="sliders"
      className="tiq-toolbar-toggle"
      aria-expanded={open}
      aria-controls={id}
      onClick={() => setOpen((value) => !value)}
    >
      {open ? t('ui.filters.hideAdvanced') : label}
    </Button>
  );
  const panel = open ? <div id={id}>{children}</div> : null;
  return <>{render(toggle, panel)}</>;
}
