/**
 * Tabs.
 * - `Tabs`: an ARIA tablist with keyboard navigation (arrow keys, Home, End) and one visible panel.
 * - `LinkTabs`: route tabs for record workspaces (each tab is a URL, `aria-current` on the active one).
 * - `VerticalTabs`: the settings sub-navigation of `settings.png` (`.tiq-vtabs`), beside the page content.
 */
import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { NavLink } from 'react-router';

export type TabsVariant = 'default' | 'segmented';

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  /** Optional count badge. */
  readonly count?: number;
  /** Shows the count as a solid accent badge (for example "To review 8"). */
  readonly countBadge?: boolean;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly tabs: readonly TabItem[];
  readonly selected: string;
  readonly onSelect: (id: string) => void;
  /** Accessible name of the tab list. */
  readonly label: string;
  /** Renders the selected panel. */
  readonly children: ReactNode;
  /** `segmented`: the silver segmented control of the buyer workspace (docs/plan/design1). */
  readonly variant?: TabsVariant;
}

function tabClass(variant: TabsVariant, active: boolean): string {
  if (variant === 'segmented') {
    return active ? 'tiq-segmented-item tiq-segmented-item--active' : 'tiq-segmented-item';
  }
  return active ? 'tiq-tab tiq-tab--active' : 'tiq-tab';
}

function TabCount({
  count,
  badge,
  variant,
}: {
  readonly count: number | undefined;
  readonly badge: boolean | undefined;
  readonly variant: TabsVariant;
}) {
  if (count === undefined) return null;
  if (variant === 'segmented') {
    return (
      <span
        className={
          badge === true ? 'tiq-segmented-count tiq-segmented-count--badge' : 'tiq-segmented-count'
        }
      >
        {count}
      </span>
    );
  }
  return <span className="tiq-tab-count">{count}</span>;
}

export function Tabs({
  tabs,
  selected,
  onSelect,
  label,
  children,
  variant = 'default',
}: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = tabs.filter((tab) => tab.disabled !== true);

  const focusTab = (id: string): void => {
    onSelect(id);
    const button = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-id="${CSS.escape(id)}"]`,
    );
    button?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = enabled.findIndex((tab) => tab.id === selected);
    let next: TabItem | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft')
      next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (next !== undefined) {
      event.preventDefault();
      focusTab(next.id);
    }
  };

  return (
    <div>
      <div
        className={variant === 'segmented' ? 'tiq-segmented' : 'tiq-tabs'}
        role="tablist"
        aria-label={label}
        ref={listRef}
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab) => {
          const active = tab.id === selected;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              data-tab-id={tab.id}
              aria-selected={active}
              aria-controls={`${baseId}-panel`}
              tabIndex={active ? 0 : -1}
              disabled={tab.disabled}
              className={tabClass(variant, active)}
              onClick={() => onSelect(tab.id)}
            >
              {tab.label}
              <TabCount count={tab.count} badge={tab.countBadge} variant={variant} />
            </button>
          );
        })}
      </div>
      <div
        className="tiq-tabpanel"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${selected}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}

export interface LinkTabItem {
  readonly to: string;
  readonly label: ReactNode;
  readonly count?: number;
  readonly countBadge?: boolean;
  /** Active only on an exact match. */
  readonly end?: boolean;
}

export interface LinkTabsProps {
  readonly tabs: readonly LinkTabItem[];
  readonly label: string;
  readonly variant?: TabsVariant;
}

export function LinkTabs({ tabs, label, variant = 'default' }: LinkTabsProps) {
  return (
    <nav className={variant === 'segmented' ? 'tiq-segmented' : 'tiq-tabs'} aria-label={label}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => tabClass(variant, isActive)}
        >
          {tab.label}
          <TabCount count={tab.count} badge={tab.countBadge} variant={variant} />
        </NavLink>
      ))}
    </nav>
  );
}

export interface VerticalTabsProps {
  readonly title?: ReactNode;
  readonly label: string;
  readonly tabs: readonly LinkTabItem[];
  /** The page content beside the tabs. */
  readonly children: ReactNode;
}

export function VerticalTabs({ title, label, tabs, children }: VerticalTabsProps) {
  return (
    <div className="tiq-vtabs-layout">
      <nav aria-label={label}>
        {title !== undefined && <h2 className="tiq-vtabs-title">{title}</h2>}
        <ul className="tiq-vtabs">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => (isActive ? 'tiq-vtab--active' : undefined)}
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
}
