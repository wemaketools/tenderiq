/**
 * AppShell (docs/technical/09-frontend.md §5): sidebar + main column (top bar, prototype banner, page content).
 * Rendered for the signed-in areas (/buyer, /supplier, /ops, /me) once an organization is active (RouteGuard).
 * Pages portal their title and primary action into the top bar through the page slots. Below 768px the primary
 * action renders in the page head instead (the top bar has no room for it) and the sidebar is a drawer: closed, it is
 * hidden from focus and assistive technology (CSS visibility); opening it moves focus to the first nav link; Escape
 * or the scrim closes it and returns focus to the menu button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router';

import type { FeatureModule } from '../../app/featureRegistry';
import { useActiveTenant } from '../../app/hooks';
import { t } from '../../lib/i18n';
import { DRAWER_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { MAIN_REGION_ID } from '../ui/focusReturn';
import { PageSlotsContext } from '../ui/pageSlots';
import type { PageSlots } from '../ui/pageSlots';
import { PrototypeBanner } from './PrototypeBanner';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useMeBadges } from './useMeBadges';

const SIDEBAR_ID = 'tiq-sidebar';

export function AppShell({ modules }: { readonly modules?: readonly FeatureModule[] }) {
  const tenant = useActiveTenant();
  const drawerMode = useMediaQuery(DRAWER_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useMeBadges();

  const open = drawerMode && drawerOpen;

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

  const slots = useMemo<PageSlots>(
    () => ({ title: titleSlot, primaryAction: actionSlot }),
    [titleSlot, actionSlot],
  );

  if (tenant === null) {
    return null;
  }

  const classes = ['tiq-app'];
  if (drawerMode) classes.push('tiq-app--drawer');
  if (open) classes.push('tiq-app--drawer-open');

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
      <div className={classes.join(' ')} data-tenant-kind={tenant.kind}>
        <a className="tiq-skip-link" href="#tiq-main">
          {t('shell.skipToContent')}
        </a>
        <Sidebar
          id={SIDEBAR_ID}
          tenant={tenant}
          modules={modules}
          onNavigate={drawerMode ? closeAfterNavigation : undefined}
        />
        {open && (
          <div className="tiq-drawer-scrim" aria-hidden="true" onClick={closeToMenuButton} />
        )}
        <div className="tiq-main">
          <Topbar
            titleRef={setTitleSlot}
            actionRef={setActionSlot}
            onOpenMenu={() => setDrawerOpen((open) => !open)}
            menuOpen={open}
            menuButtonRef={menuButtonRef}
            showPrimaryAction={!drawerMode}
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
