/**
 * The top bar (64px, sticky; `overview.png`): page title (from PageHeader), global search → /me/search?q= (COM-08),
 * tasks with the open count (COM-04), the notifications bell with the unread count (COM-06), help → /me/help
 * (COM-09), and the slot for the page's ONE primary action. Counts cover all the user's memberships (DD-21).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { useAppSelector } from '../../app/hooks';
import { t } from '../../lib/i18n';
import { IconButton, IconLink } from '../ui/Button';
import { Icon } from '../ui/Icon';

export interface TopbarProps {
  /** Receives the title slot element (PageHeader portals the page title into it). */
  readonly titleRef: (element: HTMLElement | null) => void;
  /** Receives the primary action slot element. */
  readonly actionRef: (element: HTMLElement | null) => void;
  /** Shown below 768px: opens the navigation drawer. */
  readonly onOpenMenu: () => void;
  readonly menuOpen: boolean;
  readonly sidebarId: string;
}

export function Topbar({ titleRef, actionRef, onOpenMenu, menuOpen, sidebarId }: TopbarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const unread = useAppSelector((state) => state.badges.me.notificationsUnread);
  const openTasks = useAppSelector((state) => state.badges.me.tasksOpen);

  const onSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const q = query.trim();
    void navigate(q === '' ? '/me/search' : `/me/search?q=${encodeURIComponent(q)}`);
  };

  const notificationsLabel =
    unread !== null && unread > 0
      ? t('shell.topbar.notificationsCount', { count: unread })
      : t('shell.topbar.notifications');
  const tasksLabel =
    openTasks !== null && openTasks > 0
      ? t('shell.topbar.tasksCount', { count: openTasks })
      : t('shell.topbar.tasks');

  return (
    <header className="tiq-topbar">
      <IconButton
        icon="menu"
        label={t('shell.topbar.openMenu')}
        className="tiq-topbar-menu-btn"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls={sidebarId}
      />
      <h1 className="tiq-topbar-title" ref={titleRef} />
      <div className="tiq-topbar-spacer" />
      <form role="search" className="tiq-searchbox" onSubmit={onSearch}>
        <Icon name="search" />
        <label htmlFor="tiq-global-search" className="tiq-visually-hidden">
          {t('shell.topbar.searchLabel')}
        </label>
        <input
          id="tiq-global-search"
          type="search"
          value={query}
          placeholder={t('shell.topbar.searchPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <div className="tiq-topbar-actions">
        <IconLink to="/me/tasks" icon="checkSquare" label={tasksLabel} count={openTasks} />
        <IconLink to="/me/notifications" icon="bell" label={notificationsLabel} count={unread} />
        <IconLink to="/me/help" icon="help" label={t('shell.topbar.help')} />
        <div className="tiq-topbar-actions" ref={actionRef} />
      </div>
    </header>
  );
}
