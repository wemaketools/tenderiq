/**
 * The labelled navigation rail of the buyer presentation (docs/plan/design1 §2): the six core destinations pinned
 * when the membership may open them (Overview, Tenders, Approvals, Evaluation, Awards, Contracts), each an icon above
 * a short label, and a "More" button that opens every other permitted destination grouped by section (tasks,
 * planning, documents, suppliers, reports, administration…). The registry still decides what exists and who sees it;
 * the rail only chooses what is pinned. A nested route of a destination inside "More" marks the "More" button as the
 * current one, and badges stay visible on both the pinned items and the menu entries.
 */
import { NavLink, useLocation } from 'react-router';

import { activeNavItem } from '../../app/featureRegistry';
import type { NavGroup, ResolvedNavItem } from '../../app/featureRegistry';
import { useAppSelector } from '../../app/hooks';
import { t } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import type { MenuEntry } from '../ui/Menu';
import { PINNED_NAV_IDS, badgeCount, countText } from './navBadges';

function RailEntry({
  item,
  onNavigate,
}: {
  readonly item: ResolvedNavItem;
  readonly onNavigate?: () => void;
}) {
  const count = useAppSelector((state) => badgeCount(item.badge, state));
  const label = t(item.label);
  const hasCount = count !== null && count > 0;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          isActive ? 'tiq-rail-item tiq-rail-item--active' : 'tiq-rail-item'
        }
        title={label}
        aria-label={hasCount ? t('shell.nav.labelWithBadge', { label, count }) : label}
        onClick={onNavigate}
      >
        <Icon name={item.icon} />
        <span className="tiq-rail-label">{label}</span>
        {hasCount && (
          <span className="tiq-nav-badge" aria-hidden="true">
            {countText(count)}
          </span>
        )}
      </NavLink>
    </li>
  );
}

function MoreEntryLabel({ item }: { readonly item: ResolvedNavItem }) {
  const count = useAppSelector((state) => badgeCount(item.badge, state));
  const label = t(item.label);
  return (
    <>
      <span>{label}</span>
      {count !== null && count > 0 && (
        <span
          className="tiq-nav-badge"
          aria-label={t('shell.nav.labelWithBadge', { label, count })}
        >
          {countText(count)}
        </span>
      )}
    </>
  );
}

export function BuyerRail({
  groups,
  onNavigate,
}: {
  readonly groups: readonly NavGroup[];
  readonly onNavigate?: () => void;
}) {
  const location = useLocation();
  const items = groups.flatMap((group) => group.items);
  const pinned = PINNED_NAV_IDS.map((id) => items.find((item) => item.id === id)).filter(
    (item): item is ResolvedNavItem => item !== undefined,
  );
  const rest = groups
    .map((group) => ({
      section: group.section,
      items: group.items.filter((item) => !PINNED_NAV_IDS.includes(item.id)),
    }))
    .filter((group) => group.items.length > 0);
  const active = activeNavItem(groups, location.pathname);
  const activeInMore = active !== null && !PINNED_NAV_IDS.includes(active.id);
  const moreTotal = useAppSelector((state) =>
    rest.reduce(
      (sum, group) =>
        sum + group.items.reduce((inner, item) => inner + (badgeCount(item.badge, state) ?? 0), 0),
      0,
    ),
  );

  const entries: MenuEntry[] = rest.flatMap((group) => [
    {
      kind: 'text' as const,
      id: `section-${group.section}`,
      label: t(`shell.nav.section.${group.section}`),
    },
    ...group.items.map((item): MenuEntry => ({
      kind: 'link',
      id: item.id,
      label: <MoreEntryLabel item={item} />,
      icon: item.icon,
      current: active?.id === item.id,
      to: item.to,
    })),
  ]);

  const moreLabel = t('shell.nav.more');
  const moreAria = activeInMore
    ? t('shell.nav.moreCurrent')
    : moreTotal > 0
      ? t('shell.nav.labelWithBadge', { label: t('shell.nav.moreLabel'), count: moreTotal })
      : t('shell.nav.moreLabel');

  return (
    <nav className="tiq-nav" aria-label={t('shell.nav.label')}>
      <ul className="tiq-rail">
        {pinned.map((item) => (
          <RailEntry key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </ul>
      {rest.length > 0 && (
        <div className="tiq-rail-more">
          <Menu
            label={t('shell.nav.moreLabel')}
            placement="none"
            entries={entries}
            onNavigate={onNavigate}
            trigger={(props) => (
              <button
                type="button"
                className={activeInMore ? 'tiq-rail-item tiq-rail-item--active' : 'tiq-rail-item'}
                aria-label={moreAria}
                aria-current={activeInMore ? 'page' : undefined}
                title={moreLabel}
                {...props}
              >
                <Icon name="grid" />
                <span className="tiq-rail-label">{moreLabel}</span>
                {!activeInMore && moreTotal > 0 && (
                  <span className="tiq-nav-badge" aria-hidden="true">
                    {countText(moreTotal)}
                  </span>
                )}
              </button>
            )}
          />
        </div>
      )}
    </nav>
  );
}
