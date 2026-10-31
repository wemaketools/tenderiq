/**
 * AppShell (docs/technical/09-frontend.md §5; docs/plan/design1): sidebar + main column (top bar, prototype banner,
 * page content). Rendered for the signed-in areas (/buyer, /supplier, /ops, /me) once an organization is active
 * (RouteGuard).
 *
 * Presentation follows the ACTIVE TENANT, not the pathname (so the common `/me` pages take the look of the
 * organization the user acts for): a buyer organization gets the `buyer` presentation (labelled rail, organization
 * utility bar, content headings; `data-presentation="buyer"` on <html> so the buyer tokens reach dialogs and toasts
 * too); every other kind keeps the default shell, where pages portal their title into the top bar and the top bar
 * shows the section action of the active sidebar destination (DD-46) on every page of that destination except the
 * page it leads to. In the buyer presentation the utility bar shows no actions: the section action goes to the page
 * (PageHeader renders it in the page head), so no action appears twice.
 *
 * Below 768px the sidebar is a drawer in both presentations: closed, it is hidden from focus and assistive technology
 * (CSS visibility); opening it moves focus to the first nav link; Escape or the scrim closes it and returns focus to
 * the menu button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import { activeNavItem, features, navGroupsFor } from '../../app/featureRegistry';
import type { FeatureModule, ResolvedSectionAction } from '../../app/featureRegistry';
import { useActiveTenant } from '../../app/hooks';
import { t } from '../../lib/i18n';
import { DRAWER_QUERY, RAIL_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { MAIN_REGION_ID } from '../ui/focusReturn';
import { PageSlotsContext } from '../ui/pageSlots';
import type { PageSlots, Presentation } from '../ui/pageSlots';
import { PrototypeBanner } from './PrototypeBanner';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useMeBadges } from './useMeBadges';

const SIDEBAR_ID = 'tiq-sidebar';

/** True when the address already is the action's target (the create page, or the list with its dialog open). */
function isAt(action: ResolvedSectionAction, pathname: string, search: string): boolean {
  const target = new URL(action.to, 'http://tiq.local');
  if (target.pathname !== pathname) return false;
  const current = new URLSearchParams(search);
  return [...target.searchParams].every(([key, value]) => current.get(key) === value);
}

export function AppShell({ modules = features }: { readonly modules?: readonly FeatureModule[] }) {
  const tenant = useActiveTenant();
  const location = useLocation();
  const drawerMode = useMediaQuery(DRAWER_QUERY);
  const railMode = useMediaQuery(RAIL_QUERY) && !drawerMode;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useMeBadges();

  const presentation: Presentation = tenant?.kind === 'buyer' ? 'buyer' : 'default';
  const open = drawerMode && drawerOpen;

  useEffect(() => {
    if (presentation !== 'buyer') {
      return undefined;
    }
    document.documentElement.setAttribute('data-presentation', 'buyer');
    return () => document.documentElement.removeAttribute('data-presentation');
  }, [presentation]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    document.getElementById(SIDEBAR_ID)?.querySelector<HTMLElement>('a[href]')?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setDrawerOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const groups =
    tenant === null
      ? []
      : navGroupsFor(modules, { tenantKind: tenant.kind, permissions: tenant.permissions });
  const action = activeNavItem(groups, location.pathname)?.sectionAction ?? null;
  const sectionAction =
    action !== null && !isAt(action, location.pathname, location.search) ? action : null;

  const slots = useMemo<PageSlots>(
    () => ({
      presentation,
      title: presentation === 'buyer' ? null : titleSlot,
      sectionAction: presentation === 'buyer' ? sectionAction : null,
    }),
    [presentation, titleSlot, sectionAction],
  );

  if (tenant === null) {
    return null;
  }

  const classes = ['tiq-app'];
  if (drawerMode) classes.push('tiq-app--drawer');
  if (open) classes.push('tiq-app--drawer-open');
  if (presentation === 'buyer') classes.push('tiq-app--buyer');

  const closeToMenuButton = (): void => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  };
  const closeAfterNavigation = (): void => {
    setDrawerOpen(false);
    document.getElementById(MAIN_REGION_ID)?.focus();
  };

  return (
    <PageSlotsContext.Provider value={slots}>
      <div
        className={classes.join(' ')}
        data-tenant-kind={tenant.kind}
        data-presentation={presentation}
      >
        <a className="tiq-skip-link" href="#tiq-main">
          {t('shell.skipToContent')}
        </a>
        <Sidebar
          id={SIDEBAR_ID}
          tenant={tenant}
          modules={modules}
          rail={railMode}
          presentation={presentation}
          drawer={drawerMode}
          onNavigate={drawerMode ? closeAfterNavigation : undefined}
        />
        {open && (
          <div className="tiq-drawer-scrim" aria-hidden="true" onClick={closeToMenuButton} />
        )}
        <div className="tiq-main">
          <Topbar
            titleRef={setTitleSlot}
            sectionAction={presentation === 'buyer' ? null : sectionAction}
            presentation={presentation}
            onOpenMenu={() => setDrawerOpen((open) => !open)}
            menuOpen={open}
            menuButtonRef={menuButtonRef}
            compact={drawerMode}
            sidebarId={SIDEBAR_ID}
          />
          <PrototypeBanner />
          <main className="tiq-content" id={MAIN_REGION_ID} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </PageSlotsContext.Provider>
  );
}
