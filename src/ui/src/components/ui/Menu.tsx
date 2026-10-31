/**
 * Menu (`.tiq-menu`): a button that opens a list of actions or links. Keyboard: Enter/Space/ArrowDown open it and
 * focus the first item, arrows move, Escape closes and returns the focus, Tab closes. A click outside closes it.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon } from './Icon';
import type { IconName } from './Icon';

export type MenuEntry =
  | {
      readonly kind?: 'action';
      readonly id: string;
      readonly label: ReactNode;
      readonly icon?: IconName;
      readonly onSelect: () => void;
      readonly danger?: boolean;
      readonly disabled?: boolean;
      /** Marks the entry as the current one (`aria-current="true"`), for example the active organization. */
      readonly current?: boolean;
    }
  | {
      readonly kind: 'link';
      readonly id: string;
      readonly label: ReactNode;
      readonly icon?: IconName;
      readonly to: string;
      /** Marks the entry as the current page (`aria-current="page"`). */
      readonly current?: boolean;
    }
  | { readonly kind: 'separator'; readonly id: string }
  | { readonly kind: 'text'; readonly id: string; readonly label: ReactNode };

export interface MenuProps {
  readonly entries: readonly MenuEntry[];
  /** Renders the trigger; spread the props onto a button. */
  readonly trigger: (props: {
    readonly id: string;
    readonly 'aria-haspopup': 'menu';
    readonly 'aria-expanded': boolean;
    readonly 'aria-controls': string;
    readonly onClick: () => void;
    readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  }) => ReactNode;
  /** Accessible name of the menu. */
  readonly label: string;
  /** `floating` positions below the trigger (right aligned); `none` leaves positioning to the parent CSS. */
  readonly placement?: 'floating' | 'none';
  readonly className?: string;
  /** Called after a link entry is followed (for example to close a navigation drawer). */
  readonly onNavigate?: () => void;
}

export function Menu({
  entries,
  trigger,
  label,
  placement = 'floating',
  className,
  onNavigate,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items = (): HTMLElement[] =>
    Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointer = (event: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => {
    if (open) {
      listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    }
  }, [open]);

  const close = (returnFocus: boolean): void => {
    setOpen(false);
    if (returnFocus) {
      document.getElementById(triggerId)?.focus();
    }
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const list = items();
    const index = list.findIndex((element) => element === document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      list[list.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const menuClass = ['tiq-menu'];
  if (placement === 'floating') menuClass.push('tiq-menu--floating');

  return (
    <div
      ref={rootRef}
      className={className ?? (placement === 'floating' ? 'tiq-menu-anchor' : undefined)}
    >
      {trigger({
        id: triggerId,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
        onClick: () => setOpen((value) => !value),
        onKeyDown: onTriggerKeyDown,
      })}
      {open && (
        <ul
          ref={listRef}
          id={menuId}
          className={menuClass.join(' ')}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
        >
          {entries.map((entry) => {
            if (entry.kind === 'separator') {
              return <li key={entry.id} role="separator" className="tiq-menu-sep" />;
            }
            if (entry.kind === 'text') {
              return (
                <li key={entry.id} role="none" className="tiq-menu-context">
                  {entry.label}
                </li>
              );
            }
            if (entry.kind === 'link') {
              return (
                <li key={entry.id} role="none">
                  <Link
                    role="menuitem"
                    to={entry.to}
                    className="tiq-menu-item"
                    tabIndex={-1}
                    aria-current={entry.current === true ? 'page' : undefined}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                  >
                    {entry.icon !== undefined && <Icon name={entry.icon} />}
                    {entry.label}
                  </Link>
                </li>
              );
            }
            return (
              <li key={entry.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={entry.disabled}
                  aria-current={entry.current === true ? 'true' : undefined}
                  className={
                    entry.danger === true ? 'tiq-menu-item tiq-menu-item--danger' : 'tiq-menu-item'
                  }
                  onClick={() => {
                    close(true);
                    entry.onSelect();
                  }}
                >
                  {entry.icon !== undefined && <Icon name={entry.icon} />}
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
