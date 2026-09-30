/**
 * AppShell (docs/technical/09-frontend.md §5): sidebar + main column (top bar, prototype banner, page content).
 * Rendered for the signed-in areas (/buyer, /supplier, /ops, /me) once an organization is active (RouteGuard).
 * Pages portal their title and primary action into the top bar through the page slots.
 */
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';

import type { FeatureModule } from '../../app/featureRegistry';
import { useActiveTenant } from '../../app/hooks';
import { t } from '../../lib/i18n';
import { DRAWER_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
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
  useMeBadges();

  const slots = useMemo<PageSlots>(
    () => ({ title: titleSlot, primaryAction: actionSlot }),
    [titleSlot, actionSlot],
  );

  if (tenant === null) {
    return null;
  }

  const classes = ['tiq-app'];
  if (drawerMode) classes.push('tiq-app--drawer');
  if (drawerMode && drawerOpen) classes.push('tiq-app--drawer-open');

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
          onNavigate={drawerMode ? () => setDrawerOpen(false) : undefined}
        />
        {drawerMode && drawerOpen && (
          <div
            className="tiq-drawer-scrim"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <div className="tiq-main">
          <Topbar
            titleRef={setTitleSlot}
            actionRef={setActionSlot}
            onOpenMenu={() => setDrawerOpen((open) => !open)}
            menuOpen={drawerMode && drawerOpen}
            sidebarId={SIDEBAR_ID}
          />
          <PrototypeBanner />
          <main className="tiq-content" id="tiq-main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </PageSlotsContext.Provider>
  );
}
