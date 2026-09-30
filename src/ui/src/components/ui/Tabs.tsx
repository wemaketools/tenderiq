/**
 * Tabs.
 * - `Tabs`: an ARIA tablist with keyboard navigation (arrow keys, Home, End) and one visible panel.
 * - `LinkTabs`: route tabs for record workspaces (each tab is a URL, `aria-current` on the active one).
 * - `VerticalTabs`: the settings sub-navigation of `settings.png` (`.tiq-vtabs`), beside the page content.
 */
import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { NavLink } from 'react-router';

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  /** Optional count badge. */
  readonly count?: number;
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
}

export function Tabs({ tabs, selected, onSelect, label, children }: TabsProps) {
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
        className="tiq-tabs"
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
              className={active ? 'tiq-tab tiq-tab--active' : 'tiq-tab'}
              onClick={() => onSelect(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined && <span className="tiq-tab-count">{tab.count}</span>}
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
  /** Active only on an exact match. */
  readonly end?: boolean;
}

export interface LinkTabsProps {
  readonly tabs: readonly LinkTabItem[];
  readonly label: string;
}

export function LinkTabs({ tabs, label }: LinkTabsProps) {
  return (
    <nav className="tiq-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => (isActive ? 'tiq-tab tiq-tab--active' : 'tiq-tab')}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tiq-tab-count">{tab.count}</span>}
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
