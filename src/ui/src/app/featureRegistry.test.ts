import { describe, expect, it, vi } from 'vitest';

import {
  activeNavItem,
  areaPath,
  collectFeatures,
  features,
  firstNavDestination,
  hasPermission,
  navGroupsFor,
} from './featureRegistry';
import type { FeatureModule, FeatureRoutesModule } from './featureRegistry';

const page = () => Promise.resolve({ default: () => null });

const buyer: FeatureModule = {
  id: 'tenders',
  area: 'buyer',
  routes: [{ path: 'tenders', load: page, permission: 'tender.view' }],
  nav: [
    {
      id: 'buyer.tenders',
      label: 'x',
      path: 'tenders',
      section: 'sourcing',
      order: 1,
      icon: 'fileText',
      permission: 'tender.view',
    },
    {
      id: 'buyer.admin',
      label: 'x',
      path: 'settings',
      section: 'admin',
      order: 1,
      icon: 'settings',
      permission: 'org.users.manage',
    },
    { id: 'buyer.home', label: 'x', path: '', section: 'home', order: 1, icon: 'dashboard' },
  ],
};
const supplier: FeatureModule = {
  id: 'responses',
  area: 'supplier',
  routes: [{ path: 'responses', element: null }],
  nav: [
    {
      id: 'supplier.responses',
      label: 'x',
      path: 'responses',
      section: 'sourcing',
      order: 1,
      icon: 'send',
    },
  ],
};
const common: FeatureModule = {
  id: 'tasks',
  area: 'common',
  routes: [{ path: 'tasks', load: page }],
  nav: [
    {
      id: 'me.tasks',
      label: 'x',
      path: 'tasks',
      section: 'work',
      order: 1,
      icon: 'checkSquare',
      badge: 'tasks',
    },
    {
      id: 'me.buyerOnly',
      label: 'x',
      path: 'calendars',
      section: 'work',
      order: 2,
      icon: 'calendar',
      tenantKinds: ['buyer'],
    },
  ],
};

describe('collectFeatures', () => {
  it('collects valid modules from every routes file', () => {
    const modules: Record<string, FeatureRoutesModule> = {
      '../features/tenders/routes.tsx': { features: [buyer] },
      '../features/responses/routes.tsx': { features: [supplier, common] },
    };
    expect(collectFeatures(modules).map((module) => module.id)).toEqual([
      'responses',
      'tasks',
      'tenders',
    ]);
  });

  it('skips malformed modules, duplicate ids, duplicate routes and routes without exactly one element', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const collected = collectFeatures({
      '../features/a/routes.tsx': { features: [buyer] },
      '../features/b/routes.tsx': {},
      '../features/c/routes.tsx': { features: [{ ...buyer }] },
      '../features/d/routes.tsx': {
        features: [
          {
            id: 'd',
            area: 'buyer',
            routes: [
              { path: 'tenders', load: page },
              { path: 'both', load: page, element: null },
            ],
            nav: [{ ...buyer.nav![0]!, id: 'buyer.tenders' }],
          },
        ],
      },
    });
    expect(collected.map((module) => module.id)).toEqual(['tenders', 'd']);
    expect(collected[1]?.routes).toEqual([]);
    expect(collected[1]?.nav).toEqual([]);
    expect(error).toHaveBeenCalled();
  });

  it('starts empty or with valid modules for the running application', () => {
    expect(Array.isArray(features)).toBe(true);
  });
});

describe('navGroupsFor', () => {
  const modules = [buyer, supplier, common];

  it('shows the area matching the tenant kind plus common items, filtered by permission', () => {
    const groups = navGroupsFor(modules, { tenantKind: 'buyer', permissions: ['tender.view'] });
    const ids = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toEqual(['buyer.home', 'me.tasks', 'me.buyerOnly', 'buyer.tenders']);
    expect(groups.map((group) => group.section)).toEqual(['home', 'work', 'sourcing']);
  });

  it('includes the admin group only with its permission, last', () => {
    const groups = navGroupsFor(modules, {
      tenantKind: 'buyer',
      permissions: ['tender.view', 'org.users.manage'],
    });
    expect(groups.at(-1)?.section).toBe('admin');
  });

  it('never shows buyer items to a supplier, and honours tenantKinds on common items', () => {
    const groups = navGroupsFor(modules, { tenantKind: 'supplier', permissions: ['tender.view'] });
    const ids = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toEqual(['me.tasks', 'supplier.responses']);
  });

  it('resolves absolute paths and the first destination of an area', () => {
    const groups = navGroupsFor(modules, { tenantKind: 'buyer', permissions: ['tender.view'] });
    expect(groups[0]?.items[0]?.to).toBe('/buyer');
    expect(firstNavDestination(groups, 'buyer')).toBe('/buyer');
    expect(firstNavDestination(groups, 'ops')).toBeNull();
    expect(areaPath('common', 'tasks')).toBe('/me/tasks');
    expect(areaPath('public', '')).toBe('/');
  });
});

describe('section actions (DD-46)', () => {
  const withActions: FeatureModule = {
    id: 'requests',
    area: 'buyer',
    routes: [],
    nav: [
      {
        id: 'buyer.requests',
        label: 'x',
        path: 'requests',
        section: 'planning',
        order: 1,
        icon: 'clipboard',
        sectionAction: {
          label: 'requests.register.new',
          path: 'requests/new',
          icon: 'plus',
          permission: 'request.create',
        },
      },
      {
        id: 'buyer.admin',
        label: 'x',
        path: 'admin',
        section: 'admin',
        order: 1,
        icon: 'settings',
      },
      {
        id: 'buyer.admin.reports',
        label: 'x',
        path: 'admin/reports',
        section: 'admin',
        order: 2,
        icon: 'download',
        sectionAction: { label: 'x', path: '/select-organization', icon: 'switchOrg' },
      },
    ],
  };
  const groupsWith = (permissions: string[]) =>
    navGroupsFor([withActions], { tenantKind: 'buyer', permissions });

  it('resolves a section action to an absolute target when the membership holds its permission', () => {
    const [item] = groupsWith(['request.create'])[0]?.items ?? [];
    expect(item?.sectionAction).toEqual({
      label: 'requests.register.new',
      icon: 'plus',
      to: '/buyer/requests/new',
    });
  });

  it('drops a section action without its permission but keeps the destination', () => {
    const [item] = groupsWith([])[0]?.items ?? [];
    expect(item?.id).toBe('buyer.requests');
    expect(item?.sectionAction).toBeUndefined();
  });

  it('keeps an absolute section action target as written', () => {
    const reports = groupsWith([])
      .flatMap((group) => group.items)
      .find((item) => item.id === 'buyer.admin.reports');
    expect(reports?.sectionAction?.to).toBe('/select-organization');
  });

  it('finds the destination of a drilled-in page, preferring the most specific one', () => {
    const groups = groupsWith(['request.create']);
    expect(activeNavItem(groups, '/buyer/requests')?.id).toBe('buyer.requests');
    expect(activeNavItem(groups, '/buyer/requests/12/decision')?.id).toBe('buyer.requests');
    expect(activeNavItem(groups, '/buyer/admin/reports/exports')?.id).toBe('buyer.admin.reports');
    expect(activeNavItem(groups, '/buyer/admin/users')?.id).toBe('buyer.admin');
    expect(activeNavItem(groups, '/buyer/requests-archive')).toBeNull();
  });
});

describe('hasPermission', () => {
  it('treats a list as any-of and no requirement as allowed', () => {
    expect(hasPermission(undefined, [])).toBe(true);
    expect(hasPermission('tender.view', ['tender.view'])).toBe(true);
    expect(hasPermission(['tender.edit', 'tender.view'], new Set(['tender.view']))).toBe(true);
    expect(hasPermission('tender.edit', ['tender.view'])).toBe(false);
  });
});
