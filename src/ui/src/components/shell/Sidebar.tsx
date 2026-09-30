/**
 * The sidebar (`overview.png`; docs/technical/09-frontend.md §5): the tenant label, the wordmark Tender + accent IQ
 * and "Tender Intelligence"; navigation built from the feature registry for the active organization's kind and
 * permissions, grouped by section with a separator before the admin group; the user card at the bottom.
 * Below 1280px it collapses to an icon rail, below 768px it is a drawer (DD-36).
 */
import { Fragment } from 'react';
import { NavLink } from 'react-router';

import type { ActiveTenantContext } from '@contracts/session';

import { features, navGroupsFor } from '../../app/featureRegistry';
import type { FeatureModule, NavBadgeSource, ResolvedNavItem } from '../../app/featureRegistry';
import { useAppSelector } from '../../app/hooks';
import type { RootState } from '../../app/store';
import { t } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
import { UserCard } from './UserCard';

export interface SidebarProps {
  readonly tenant: ActiveTenantContext;
  /** Called after a nav link is followed (closes the drawer). */
  readonly onNavigate?: () => void;
  readonly id?: string;
  /** The feature modules to build the navigation from (default: the registry). */
  readonly modules?: readonly FeatureModule[];
}

function badgeCount(source: NavBadgeSource | undefined, state: RootState): number | null {
  if (source === undefined) return null;
  if (source === 'notifications') return state.badges.me.notificationsUnread;
  if (source === 'tasks') return state.badges.me.tasksOpen;
  if (source === 'tasksOverdue') return state.badges.me.tasksOverdue;
  return state.badges.nav[source.navBadgeId] ?? null;
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
            {count > 99 ? '99+' : count}
          </span>
        )}
      </NavLink>
    </li>
  );
}

export function Sidebar({ tenant, onNavigate, id, modules = features }: SidebarProps) {
  const groups = navGroupsFor(modules, {
    tenantKind: tenant.kind,
    permissions: tenant.permissions,
  });
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
            <ul className="tiq-nav-section" aria-label={t(`shell.nav.section.${group.section}`)}>
              {group.items.map((item) => (
                <NavEntry key={item.id} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>
      <UserCard tenant={tenant} />
    </aside>
  );
}
