/**
 * The top bar (64px, sticky; `overview.png`): page title (from PageHeader), the section action of the active sidebar
 * destination (DD-46), global search → /me/search?q= (COM-08), tasks with the open count (COM-04), the notifications
 * bell with the unread count (COM-06) and help → /me/help (COM-09). Counts cover all the user's memberships (DD-21).
 *
 * Search and the three icons are always the last items, so they never move between pages: the section action sits
 * to the LEFT of the search box and, when a destination has none, the space stays empty. Pages never put actions
 * here; their primary action renders in the page head (PageHeader).
 *
 * Buyer presentation (docs/plan/design1): a utility bar. The organization switcher takes the title's place (titles
 * are content there), the search box sits in the middle and the personal icons stay last. It shows no actions at
 * all: the section action belongs to the page head.
 */
import { useState } from 'react';
import type { FormEvent, Ref } from 'react';
import { useNavigate } from 'react-router';

import type { ResolvedSectionAction } from '../../app/featureRegistry';
import { useActiveTenant, useAppSelector } from '../../app/hooks';
import { t } from '../../lib/i18n';
import { ButtonLink, IconButton, IconLink } from '../ui/Button';
import { Icon } from '../ui/Icon';
import type { Presentation } from '../ui/pageSlots';
import { OrgSwitcher } from './OrgSwitcher';

export interface TopbarProps {
  /** Receives the title slot element (PageHeader portals the page title into it). */
  readonly titleRef: (element: HTMLElement | null) => void;
  /** The action of the active sidebar destination (DD-46); `null` when it has none. */
  readonly sectionAction?: ResolvedSectionAction | null;
  /** Shown below 768px: opens the navigation drawer. */
  readonly onOpenMenu: () => void;
  readonly menuOpen: boolean;
  readonly sidebarId: string;
  /** Receives the menu button, so the drawer can return focus to it. */
  readonly menuButtonRef?: Ref<HTMLButtonElement>;
  /** True below 768px: the section action shows as an accent icon button so the top bar fits a phone. */
  readonly compact?: boolean;
  readonly presentation?: Presentation;
}

export function Topbar({
  titleRef,
  sectionAction = null,
  onOpenMenu,
  menuOpen,
  sidebarId,
  menuButtonRef,
  compact = false,
  presentation = 'default',
}: TopbarProps) {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
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
  const buyer = presentation === 'buyer';

  return (
    <header className={buyer ? 'tiq-topbar tiq-topbar--buyer' : 'tiq-topbar'}>
      <IconButton
        ref={menuButtonRef}
        icon="menu"
        label={t('shell.topbar.openMenu')}
        className="tiq-topbar-menu-btn"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls={sidebarId}
      />
      {buyer && tenant !== null ? (
        <OrgSwitcher tenant={tenant} />
      ) : (
        <>
          <h1 className="tiq-topbar-title" ref={titleRef} />
          <div className="tiq-topbar-spacer" />
        </>
      )}
      {!buyer &&
        sectionAction !== null &&
        (compact ? (
          <IconLink
            to={sectionAction.to}
            icon={sectionAction.icon}
            label={t(sectionAction.label)}
            className="tiq-topbar-section-action"
          />
        ) : (
          <ButtonLink
            to={sectionAction.to}
            variant="primary"
            icon={sectionAction.icon}
            className="tiq-topbar-section-action"
          >
            {t(sectionAction.label)}
          </ButtonLink>
        ))}
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
      </div>
    </header>
  );
}
