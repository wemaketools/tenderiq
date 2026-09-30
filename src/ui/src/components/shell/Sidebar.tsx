/**
 * The sidebar (`overview.png`; docs/technical/09-frontend.md §5): the tenant label, the wordmark Tender + accent IQ
 * and "Tender Intelligence"; navigation built from the feature registry for the active organization's kind and
 * permissions, grouped by section with a separator before the admin group; the user card at the bottom.
 * Below 1280px it collapses to an icon rail, below 768px it is a drawer (DD-36).
 *
 * Sections (DD-48): a section with more than one destination has a heading that opens and closes it. The section of
 * the current page is always open (closing it lasts until the user moves to another page); the others remember what
 * the user chose, and "My work" starts open. A closed section shows the total of its badges on its heading. The icon
 * rail has no room for headings, so it shows every destination.
 */
import { Fragment, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import type { ActiveTenantContext } from '@contracts/session';

import { activeNavItem, features, navGroupsFor } from '../../app/featureRegistry';
import type {
  FeatureModule,
  NavBadgeSource,
  NavGroup,
  ResolvedNavItem,
} from '../../app/featureRegistry';
import { useAppSelector } from '../../app/hooks';
import type { RootState } from '../../app/store';
import { t } from '../../lib/i18n';
import { readNavSections, storeNavSections } from '../../lib/storage';
import { Icon } from '../ui/Icon';
import { UserCard } from './UserCard';

export interface SidebarProps {
  readonly tenant: ActiveTenantContext;
  /** Called after a nav link is followed (closes the drawer). */
  readonly onNavigate?: () => void;
  readonly id?: string;
  /** The feature modules to build the navigation from (default: the registry). */
  readonly modules?: readonly FeatureModule[];
  /** True for the icon rail (1280px down to 768px): no section headings, every destination shown. */
  readonly rail?: boolean;
}

/** Sections open until the user closes them. */
const OPEN_BY_DEFAULT: ReadonlySet<string> = new Set(['work']);

function badgeCount(source: NavBadgeSource | undefined, state: RootState): number | null {
  if (source === undefined) return null;
  if (source === 'notifications') return state.badges.me.notificationsUnread;
  if (source === 'tasks') return state.badges.me.tasksOpen;
  if (source === 'tasksOverdue') return state.badges.me.tasksOverdue;
  return state.badges.nav[source.navBadgeId] ?? null;
}

function countText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

function NavEntry({
  item,
  onNavigate,
}: {
  readonly item: ResolvedNavItem;
  readonly onNavigate?: () => void;
}) {
  const count = useAppSelector((state) => badgeCount(item.badge, state));
  const label = t(item.label);
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          isActive ? 'tiq-nav-item tiq-nav-item--active' : 'tiq-nav-item'
        }
        title={label}
        aria-label={
          count !== null && count > 0 ? t('shell.nav.labelWithBadge', { label, count }) : label
        }
        onClick={onNavigate}
      >
        <Icon name={item.icon} />
        <span className="tiq-nav-label">{label}</span>
        {count !== null && count > 0 && (
          <span className="tiq-nav-badge" aria-hidden="true">
            {countText(count)}
          </span>
        )}
      </NavLink>
    </li>
  );
}

function NavSection({
  group,
  collapsible,
  open,
  onToggle,
  onNavigate,
}: {
  readonly group: NavGroup;
  readonly collapsible: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onNavigate?: () => void;
}) {
  const total = useAppSelector((state) =>
    group.items.reduce((sum, item) => sum + (badgeCount(item.badge, state) ?? 0), 0),
  );
  const label = t(`shell.nav.section.${group.section}`);
  const listId = `tiq-nav-section-${group.section}`;
  const list = (
    <ul id={listId} className="tiq-nav-section" aria-label={label} hidden={collapsible && !open}>
      {group.items.map((item) => (
        <NavEntry key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </ul>
  );
  if (!collapsible) {
    return list;
  }
  return (
    <div className="tiq-nav-group">
      <button
        type="button"
        className="tiq-nav-heading"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={
          !open && total > 0 ? t('shell.nav.labelWithBadge', { label, count: total }) : label
        }
        onClick={onToggle}
      >
        <span className="tiq-nav-heading-label">{label}</span>
        {!open && total > 0 && (
          <span className="tiq-nav-badge" aria-hidden="true">
            {countText(total)}
          </span>
        )}
        <Icon name={open ? 'chevronDown' : 'chevronRight'} />
      </button>
      {list}
    </div>
  );
}

export function Sidebar({
  tenant,
  onNavigate,
  id,
  modules = features,
  rail = false,
}: SidebarProps) {
  const location = useLocation();
  const [stored, setStored] = useState<Record<string, boolean>>(readNavSections);
  // Closing the current page's section lasts while the user stays on that page.
  const [closedHere, setClosedHere] = useState<string | null>(null);
  const groups = navGroupsFor(modules, {
    tenantKind: tenant.kind,
    permissions: tenant.permissions,
  });
  const activeSection = activeNavItem(groups, location.pathname)?.section ?? null;
  const hereKey = (section: string): string => `${section}|${location.pathname}`;

  const isOpen = (section: string): boolean =>
    section === activeSection
      ? closedHere !== hereKey(section)
      : (stored[section] ?? OPEN_BY_DEFAULT.has(section));
  const toggle = (section: string): void => {
    const open = isOpen(section);
    if (section === activeSection) {
      setClosedHere(open ? hereKey(section) : null);
      return;
    }
    const next = { ...stored, [section]: !open };
    setStored(next);
    storeNavSections(next);
  };

  return (
    <aside className="tiq-sidebar" id={id} aria-label={t('shell.sidebar.label')}>
      <div className="tiq-brand">
        <div className="tiq-brand-tenant" title={tenant.name}>
          {tenant.name}
        </div>
        <div className="tiq-brand-name">
          {t('shell.brand.tender')}
          <span className="tiq-brand-iq">{t('shell.brand.iq')}</span>
        </div>
        <div className="tiq-brand-sub">{t('shell.brand.sub')}</div>
        <div className="tiq-brand-mark" aria-hidden="true">
          T<span className="tiq-brand-iq">{t('shell.brand.iq')}</span>
        </div>
      </div>
      <nav className="tiq-nav" aria-label={t('shell.nav.label')}>
        {groups.map((group) => (
          <Fragment key={group.section}>
            {group.section === 'admin' && <hr className="tiq-sidebar-sep" />}
            <NavSection
              group={group}
              collapsible={!rail && group.items.length > 1}
              open={isOpen(group.section)}
              onToggle={() => toggle(group.section)}
              onNavigate={onNavigate}
            />
          </Fragment>
        ))}
      </nav>
      <UserCard tenant={tenant} />
    </aside>
  );
}
