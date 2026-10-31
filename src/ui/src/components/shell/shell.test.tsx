import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeatureModule } from '../../app/featureRegistry';
import { notificationCountsLoaded, navBadgeSet, taskCountsLoaded } from '../../app/slices/badges';
import { initialSessionState } from '../../app/slices/session';
import { installFetch, problem } from '../../test/fetchMock';
import { makeContext, makeMembership, makeTenant, signedInSession } from '../../test/fixtures';
import { LocationProbe, renderWithProviders, stubAuth } from '../../test/render';
import { PageHeader } from '../ui/PageHeader';
import { AppShell } from './AppShell';
import { PrototypeBanner } from './PrototypeBanner';
import { PublicShell } from './PublicShell';
import { SelectOrganizationPage } from './SelectOrganizationPage';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const modules: FeatureModule[] = [
  {
    id: 'demo',
    area: 'buyer',
    routes: [],
    nav: [
      {
        id: 'buyer.overview',
        label: 'shell.brand.sub',
        path: 'overview',
        section: 'home',
        order: 1,
        icon: 'dashboard',
      },
      {
        id: 'buyer.clarifications',
        label: 'shell.topbar.help',
        path: 'clarifications',
        section: 'sourcing',
        order: 1,
        icon: 'messageQuestion',
        badge: { navBadgeId: 'clar' },
        sectionAction: { label: 'shell.user.switch', path: 'clarifications/new', icon: 'plus' },
      },
      {
        id: 'buyer.settings',
        label: 'shell.user.profile',
        path: 'settings',
        section: 'admin',
        order: 1,
        icon: 'settings',
        sectionAction: {
          label: 'shell.user.menu',
          path: 'settings/new',
          icon: 'plus',
          permission: 'evaluation.chair',
        },
      },
      {
        id: 'buyer.hidden',
        label: 'shell.user.menu',
        path: 'secret',
        section: 'sourcing',
        order: 2,
        icon: 'lock',
        permission: 'evaluation.chair',
      },
    ],
  },
  {
    id: 'supplier-only',
    area: 'supplier',
    routes: [],
    nav: [
      {
        id: 'supplier.x',
        label: 'shell.public.register',
        path: 'x',
        section: 'home',
        order: 1,
        icon: 'send',
      },
    ],
  },
];

/** The same destinations for a supplier organization, which keeps the default (top bar) presentation. */
const supplierModules: FeatureModule[] = modules.map((module) => ({
  ...module,
  id: `${module.id}-s`,
  area: module.area === 'buyer' ? 'supplier' : 'buyer',
  nav: (module.nav ?? []).map((item) => ({ ...item, id: `${item.id}.s` })),
}));

function supplierSession() {
  return signedInSession({
    activeTenant: makeTenant({ kind: 'supplier', name: 'Tsodilo Engineering', slug: 'tsodilo' }),
  });
}

describe('Sidebar', () => {
  it('shows the tenant label, wordmark and nav for the active kind and permissions, with the admin group last', async () => {
    const { store } = renderWithProviders(<Sidebar tenant={makeTenant()} modules={modules} />, {
      state: { session: signedInSession() },
      route: '/buyer/overview',
    });
    store.dispatch(navBadgeSet({ id: 'clar', count: 4 }));
    expect(
      screen.getByText('Kalahari Water Utilities (Pilot)', { selector: '.tiq-brand-tenant' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tender Intelligence', { selector: '.tiq-brand-sub' }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/buyer/overview',
      '/buyer/clarifications',
      '/buyer/settings',
    ]);
    expect(links[0]).toHaveClass('tiq-nav-item--active');
    expect(nav.querySelector('hr.tiq-sidebar-sep')?.nextElementSibling).toHaveAttribute(
      'aria-label',
      'Administration',
    );
    expect(
      await within(nav).findByRole('link', { name: 'Help and support, 4 waiting' }),
    ).toBeInTheDocument();
  });
});

describe('Sidebar sections (DD-48)', () => {
  const grouped: FeatureModule[] = [
    {
      id: 'grouped',
      area: 'buyer',
      routes: [],
      nav: [
        {
          id: 'b.home',
          label: 'shell.brand.sub',
          path: 'overview',
          section: 'home',
          order: 1,
          icon: 'dashboard',
        },
        {
          id: 'b.tasks',
          label: 'shell.topbar.tasks',
          path: 'tasks',
          section: 'work',
          order: 1,
          icon: 'checkSquare',
        },
        {
          id: 'b.docs',
          label: 'shell.user.profile',
          path: 'docs',
          section: 'work',
          order: 2,
          icon: 'folder',
        },
        {
          id: 'b.tenders',
          label: 'shell.user.switch',
          path: 'tenders',
          section: 'sourcing',
          order: 1,
          icon: 'fileText',
        },
        {
          id: 'b.clar',
          label: 'shell.topbar.help',
          path: 'clarifications',
          section: 'sourcing',
          order: 2,
          icon: 'messageQuestion',
          badge: { navBadgeId: 'clar' },
        },
        {
          id: 'b.users',
          label: 'shell.user.signOut',
          path: 'admin/users',
          section: 'admin',
          order: 1,
          icon: 'users',
          badge: { navBadgeId: 'users' },
        },
        {
          id: 'b.policy',
          label: 'shell.user.menu',
          path: 'admin/policy',
          section: 'admin',
          order: 2,
          icon: 'settings',
        },
      ],
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
  });

  function heading(name: string | RegExp) {
    return screen.getByRole('button', { name });
  }

  it('opens the current page section and My work, closes the others and totals their badges', async () => {
    const { store } = renderWithProviders(<Sidebar tenant={makeTenant()} modules={grouped} />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders/5',
    });
    store.dispatch(navBadgeSet({ id: 'users', count: 4 }));
    store.dispatch(navBadgeSet({ id: 'clar', count: 2 }));

    expect(heading('Sourcing')).toHaveAttribute('aria-expanded', 'true');
    expect(heading('My work')).toHaveAttribute('aria-expanded', 'true');
    expect(
      await screen.findByRole('button', { name: 'Administration, 4 waiting' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Switch organization' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Sign out, 4 waiting' })).not.toBeInTheDocument();
    // A single destination needs no heading.
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tender Intelligence' })).toBeVisible();
  });

  it('opens a closed section on its heading and remembers it', async () => {
    const first = renderWithProviders(<Sidebar tenant={makeTenant()} modules={grouped} />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders',
    });
    await userEvent.click(heading('Administration'));
    expect(heading('Administration')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Account menu' })).toBeVisible();
    await userEvent.click(heading('My work'));
    expect(heading('My work')).toHaveAttribute('aria-expanded', 'false');
    first.unmount();

    renderWithProviders(<Sidebar tenant={makeTenant()} modules={grouped} />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders',
    });
    expect(heading('Administration')).toHaveAttribute('aria-expanded', 'true');
    expect(heading('My work')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the current section only until the user moves to another page', async () => {
    const { router } = renderWithProviders(<Sidebar tenant={makeTenant()} modules={grouped} />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders',
    });
    await userEvent.click(heading('Sourcing'));
    expect(heading('Sourcing')).toHaveAttribute('aria-expanded', 'false');

    await act(() => router.navigate('/buyer/tenders/5'));
    expect(heading('Sourcing')).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows every destination without headings in the icon rail', () => {
    renderWithProviders(<Sidebar tenant={makeTenant()} modules={grouped} rail />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders',
    });
    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Account menu' })).toBeVisible();
  });
});

describe('Topbar', () => {
  it('searches across /me/search and shows the personal counts', async () => {
    const { store } = renderWithProviders(
      <Topbar
        titleRef={() => undefined}
        onOpenMenu={() => undefined}
        menuOpen={false}
        sidebarId="s"
      />,
      {
        state: { session: signedInSession() },
        routes: [{ path: '/me/search', element: <LocationProbe label="search page" /> }],
      },
    );
    store.dispatch(notificationCountsLoaded({ unread: 3, requiresAcknowledgment: 1 }));
    store.dispatch(taskCountsLoaded({ open: 7, overdue: 2 }));
    expect(await screen.findByRole('link', { name: 'Notifications, 3 unread' })).toHaveAttribute(
      'href',
      '/me/notifications',
    );
    expect(screen.getByRole('link', { name: 'My tasks, 7 open' })).toHaveAttribute(
      'href',
      '/me/tasks',
    );
    expect(screen.getByRole('link', { name: 'Help and support' })).toHaveAttribute(
      'href',
      '/me/help',
    );
    await userEvent.type(screen.getByRole('searchbox'), 'pump valves{Enter}');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('search page');
  });
});

describe('PrototypeBanner', () => {
  it('shows only when /me/context reports the prototype mode', () => {
    const { unmount } = renderWithProviders(<PrototypeBanner />, {
      state: { session: signedInSession() },
    });
    expect(screen.getByRole('note')).toHaveTextContent('Prototype — static demo data');
    unmount();
    renderWithProviders(<PrototypeBanner />, {
      state: { session: signedInSession({ environment: { mode: 'live', appEnv: 'production' } }) },
    });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('AppShell and user card', () => {
  it('renders the shell, loads badges tolerating missing summaries, and offers the account menu', async () => {
    installFetch({ 'GET /api/v1/me/notification-summary': () => problem(404, 'Not Found') });
    const auth = stubAuth();
    renderWithProviders(<AppShell modules={modules} />, {
      state: { session: signedInSession() },
      auth,
      route: '/buyer/overview',
      routes: [{ path: '/select-organization', element: <LocationProbe label="select" /> }],
    });
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications' })).not.toHaveTextContent(/\d/);
    await userEvent.click(screen.getByRole('button', { name: /Account menu for Tebogo Molefe/ }));
    const menu = screen.getByRole('menu', { name: 'Account menu' });
    expect(menu).toHaveTextContent(
      'Acting as Procurement Officer for Kalahari Water Utilities (Pilot)',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Profile and preferences' })).toHaveAttribute(
      'href',
      '/me/profile',
    );
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('switches the theme and stores it through the API', async () => {
    const { requests } = installFetch({
      'PUT /api/v1/me/theme': () => ({ body: { theme: 'dark' } }),
    });
    const { store } = renderWithProviders(<AppShell modules={modules} />, {
      state: { session: signedInSession() },
      route: '/buyer/overview',
    });
    await userEvent.click(screen.getByRole('button', { name: /Account menu for/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Use dark theme' }));
    expect(store.getState().session.user?.theme).toBe('dark');
    await waitFor(() =>
      expect(requests.some((request) => request.path === '/api/v1/me/theme')).toBe(true),
    );
  });
});

describe('AppShell top bar layout (DD-46, default presentation)', () => {
  function topbarItems(): string[] {
    const bar = document.querySelector('.tiq-topbar');
    return [
      ...(bar?.querySelectorAll(
        '.tiq-topbar-section-action, form[role="search"], .tiq-topbar-actions > a',
      ) ?? []),
    ].map((element) =>
      element.getAttribute('role') === 'search'
        ? 'search'
        : (element.getAttribute('aria-label') ?? element.textContent ?? ''),
    );
  }

  it('shows the section action of the active destination to the left of search, the icons last', () => {
    renderWithProviders(<AppShell modules={supplierModules} />, {
      state: { session: supplierSession() },
      route: '/supplier/clarifications',
    });
    expect(topbarItems()).toEqual([
      'Switch organization',
      'search',
      'My tasks',
      'Notifications',
      'Help and support',
    ]);
    const action = document.querySelector('.tiq-topbar-section-action');
    expect(action).toHaveClass('tiq-btn--primary');
    expect(action).toHaveAttribute('href', '/supplier/clarifications/new');
  });

  it('keeps the section action on every page below the destination, while the user drills in', () => {
    renderWithProviders(<AppShell modules={supplierModules} />, {
      state: { session: supplierSession() },
      route: '/supplier/clarifications/42/answers',
    });
    expect(document.querySelector('.tiq-topbar-section-action')).toHaveAttribute(
      'href',
      '/supplier/clarifications/new',
    );
  });

  it('hides the section action on the page it leads to', () => {
    renderWithProviders(<AppShell modules={supplierModules} />, {
      state: { session: supplierSession() },
      route: '/supplier/clarifications/new',
    });
    expect(document.querySelector('.tiq-topbar-section-action')).toBeNull();
  });

  it('leaves the search box and icons in place when the destination has no section action', () => {
    renderWithProviders(<AppShell modules={supplierModules} />, {
      state: { session: supplierSession() },
      route: '/supplier/overview',
    });
    expect(topbarItems()).toEqual(['search', 'My tasks', 'Notifications', 'Help and support']);
  });

  it('hides a section action the membership lacks the permission for', () => {
    renderWithProviders(<AppShell modules={supplierModules} />, {
      state: { session: supplierSession() },
      route: '/supplier/settings',
    });
    expect(document.querySelector('.tiq-topbar-section-action')).toBeNull();
  });
});

describe('AppShell navigation drawer (below 768px)', () => {
  function phoneWidth(): void {
    const original = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      ...original(query),
      matches: query === '(max-width: 767px)' || query === '(max-width: 1279px)',
    }));
  }

  it('moves focus into the opened drawer, closes it on Escape and returns focus to the menu button', async () => {
    phoneWidth();
    renderWithProviders(<AppShell modules={modules} />, {
      state: { session: signedInSession() },
      route: '/buyer/overview',
    });
    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.tiq-app')).not.toHaveClass('tiq-app--drawer-open');
    await userEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getAllByRole('link')[0]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
  });

  it('sends focus to the main region after a nav link is followed', async () => {
    phoneWidth();
    renderWithProviders(<AppShell modules={modules} />, {
      state: { session: signedInSession() },
      route: '/buyer/overview',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Help and support' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('shows the section action as an accent icon button at phone width, so the top bar fits', () => {
    phoneWidth();
    renderWithProviders(<AppShell modules={supplierModules} />, {
      state: { session: supplierSession() },
      route: '/supplier/clarifications',
    });
    const action = screen.getByRole('link', { name: 'Switch organization' });
    expect(action).toHaveClass('tiq-icon-btn', 'tiq-topbar-section-action');
    expect(action).toHaveAttribute('href', '/supplier/clarifications/new');
  });

  it('gives the buyer the full grouped list in the drawer, where there is room for every destination', async () => {
    phoneWidth();
    renderWithProviders(<AppShell modules={railModules} />, {
      state: { session: signedInSession() },
      route: '/buyer/dashboard',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).queryByRole('button', { name: /More/ })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Help and support' })).toHaveAttribute(
      'href',
      '/buyer/reports',
    );
  });
});

/** Buyer destinations: the six pinned ones plus two that go to "More". */
const railModules: FeatureModule[] = [
  {
    id: 'rail',
    area: 'buyer',
    routes: [],
    nav: [
      {
        id: 'buyer.dashboard',
        label: 'shell.brand.sub',
        path: 'dashboard',
        section: 'home',
        order: 1,
        icon: 'dashboard',
      },
      {
        id: 'buyer.tenders',
        label: 'shell.topbar.tasks',
        path: 'tenders',
        section: 'sourcing',
        order: 1,
        icon: 'fileText',
        sectionAction: { label: 'shell.user.switch', path: 'tenders/new', icon: 'plus' },
      },
      {
        id: 'buyer.awards',
        label: 'shell.public.awards',
        path: 'awards',
        section: 'award',
        order: 1,
        icon: 'award',
      },
      {
        id: 'buyer.reports',
        label: 'shell.topbar.help',
        path: 'reports',
        section: 'insights',
        order: 1,
        icon: 'barChart',
        badge: { navBadgeId: 'reports' },
      },
      {
        id: 'buyer.settings',
        label: 'shell.user.profile',
        path: 'settings',
        section: 'admin',
        order: 1,
        icon: 'settings',
      },
    ],
  },
  {
    id: 'rail-common',
    area: 'common',
    routes: [],
    nav: [
      {
        id: 'me.approvals',
        label: 'shell.public.plans',
        path: 'approvals',
        section: 'work',
        order: 1,
        icon: 'checkSquare',
        tenantKinds: ['buyer'],
      },
    ],
  },
];

describe('AppShell buyer presentation (design1)', () => {
  it('pins the core destinations on a labelled rail, puts the rest in More and marks the html element', async () => {
    const { store, unmount } = renderWithProviders(<AppShell modules={railModules} />, {
      state: { session: signedInSession() },
      route: '/buyer/dashboard',
    });
    store.dispatch(navBadgeSet({ id: 'reports', count: 2 }));
    expect(document.documentElement).toHaveAttribute('data-presentation', 'buyer');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const rail = within(nav).getAllByRole('link');
    expect(rail.map((link) => link.getAttribute('href'))).toEqual([
      '/buyer/dashboard',
      '/buyer/tenders',
      '/me/approvals',
      '/buyer/awards',
    ]);
    expect(rail[0]).toHaveClass('tiq-rail-item--active');
    const more = await within(nav).findByRole('button', { name: 'More destinations, 2 waiting' });
    await userEvent.click(more);
    const menu = screen.getByRole('menu', { name: 'More destinations' });
    expect(within(menu).getByText('Reports and records')).toBeInTheDocument();
    expect(within(menu).getByText('Administration')).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Help and support/ }));
    expect(within(nav).getByRole('button', { name: 'More, current page inside' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    unmount();
    expect(document.documentElement).not.toHaveAttribute('data-presentation');
  });

  it('shows the organization switcher instead of a title and no action in the utility bar', () => {
    renderWithProviders(<AppShell modules={railModules} />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders',
    });
    const bar = document.querySelector('.tiq-topbar');
    expect(bar?.querySelector('.tiq-topbar-title')).toBeNull();
    expect(bar?.querySelector('.tiq-topbar-section-action')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Organization: Kalahari Water Utilities (Pilot). Switch organization',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('enters another organization from the switcher and lands on its home', async () => {
    const memberships = [
      makeMembership(),
      makeMembership({
        membershipId: 12,
        tenantId: 5,
        tenantKind: 'supplier',
        tenantName: 'Tsodilo Engineering',
        tenantSlug: 'tsodilo',
        capacity: 'Technical Contributor',
      }),
    ];
    installFetch({
      'GET /api/v1/me/context': () => ({
        body: makeContext({
          memberships,
          activeTenant: makeTenant({
            tenantId: 5,
            kind: 'supplier',
            name: 'Tsodilo Engineering',
            slug: 'tsodilo',
          }),
        }),
      }),
    });
    const { store } = renderWithProviders(<AppShell modules={railModules} />, {
      state: { session: signedInSession({ memberships }) },
      route: '/buyer/tenders',
      routes: [{ path: '/supplier', element: <LocationProbe label="supplier home" /> }],
    });
    await userEvent.click(screen.getByRole('button', { name: /Switch organization/ }));
    const menu = screen.getByRole('menu', { name: 'Your organizations' });
    expect(within(menu).getByRole('menuitem', { name: /Kalahari Water/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(menu).getByRole('menuitem', { name: 'All organizations…' })).toHaveAttribute(
      'href',
      '/select-organization',
    );
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Tsodilo Engineering/ }));
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('supplier home');
    expect(store.getState().session.activeTenant?.name).toBe('Tsodilo Engineering');
  });

  it('renders the page heading in the content with the section action as its primary action', () => {
    renderWithProviders(<AppShell modules={railModules} />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders',
      path: '/',
      children: [
        {
          path: 'buyer/tenders',
          element: (
            <PageHeader title="Tenders" headline="Good work starts here." subtitle="A lede" />
          ),
        },
      ],
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Good work starts here.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tenders', { selector: '.tiq-hero-eyebrow' })).toBeInTheDocument();
    const action = screen.getByRole('link', { name: 'Switch organization' });
    expect(action).toHaveClass('tiq-btn--primary');
    expect(action.closest('.tiq-hero-actions')).not.toBeNull();
    expect(document.title).toBe('Tenders · TenderIQ');
  });

  it('demotes the section action to a secondary button when the page has its own primary action', () => {
    renderWithProviders(<AppShell modules={railModules} />, {
      state: { session: signedInSession() },
      route: '/buyer/tenders/42',
      path: '/',
      children: [
        {
          path: 'buyer/tenders/:id',
          element: (
            <PageHeader
              title="A tender"
              primaryAction={<button type="button">Edit details</button>}
            />
          ),
        },
      ],
    });
    const buttons = [
      ...(document.querySelector('.tiq-hero-actions')?.querySelectorAll('a, button') ?? []),
    ].map((element) => element.textContent);
    expect(buttons).toEqual(['Switch organization', 'Edit details']);
    expect(screen.getByRole('link', { name: 'Switch organization' })).not.toHaveClass(
      'tiq-btn--primary',
    );
  });
});

describe('SelectOrganizationPage (COM-02)', () => {
  const memberships = [
    makeMembership(),
    makeMembership({
      membershipId: 12,
      tenantId: 5,
      tenantKind: 'supplier',
      tenantName: 'Tsodilo Engineering',
      tenantSlug: 'tsodilo',
      capacity: 'Technical Contributor',
    }),
    makeMembership({
      membershipId: 13,
      tenantId: 7,
      tenantKind: 'supplier',
      tenantName: 'Serowe ICT Solutions',
      tenantSlug: 'serowe-ict',
      status: 'pending_approval',
    }),
  ];

  it('lists the organizations, explains the pending one and enters the chosen one', async () => {
    installFetch({
      'GET /api/v1/me/context': () => ({
        body: makeContext({
          memberships,
          activeTenant: makeTenant({
            tenantId: 5,
            kind: 'supplier',
            name: 'Tsodilo Engineering',
            slug: 'tsodilo',
          }),
        }),
      }),
    });
    const { store } = renderWithProviders(<SelectOrganizationPage />, {
      state: {
        session: signedInSession({ memberships, activeTenant: null, tenantStatus: 'none' }),
      },
      route: '/select-organization',
      path: '/select-organization',
      routes: [{ path: '/supplier', element: <LocationProbe label="supplier home" /> }],
    });
    const list = screen.getByRole('list', { name: 'Your organizations' });
    expect(
      within(list).getByText("Waiting for the organization administrator's approval."),
    ).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: /Serowe/ })).not.toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: /Tsodilo Engineering/ }));
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('supplier home');
    expect(store.getState().session.activeTenant?.name).toBe('Tsodilo Engineering');
  });

  it('shows the current context and a failure to enter', async () => {
    installFetch({ 'GET /api/v1/me/context': () => problem(403, 'Forbidden') });
    renderWithProviders(<SelectOrganizationPage />, {
      state: { session: signedInSession({ memberships }) },
    });
    expect(
      screen.getByText(
        'You are acting as Procurement Officer for Kalahari Water Utilities (Pilot)',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Tsodilo Engineering/ }));
    expect(await screen.findByText(/could not be entered/)).toBeInTheDocument();
  });

  it('explains when the account has no organization', () => {
    renderWithProviders(<SelectOrganizationPage />, {
      state: { session: signedInSession({ memberships: [], activeTenant: null }) },
    });
    expect(screen.getByText('No organizations yet')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Prototype — static demo data');
  });
});

describe('PublicShell', () => {
  it('offers the public destinations, sign in and registration', () => {
    renderWithProviders(<PublicShell />, {
      state: { session: { ...initialSessionState, authStatus: 'signedOut' } },
    });
    const nav = screen.getByRole('navigation', { name: 'Public portal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/opportunities', '/awards', '/plans', '/guidance']);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
    expect(screen.getByRole('link', { name: 'Register as a supplier' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('offers the workspace to a signed-in user', () => {
    renderWithProviders(<PublicShell />, { state: { session: signedInSession() } });
    expect(screen.getByRole('link', { name: 'Go to my workspace' })).toHaveAttribute(
      'href',
      '/buyer',
    );
  });
});
