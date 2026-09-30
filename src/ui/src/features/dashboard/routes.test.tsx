import { describe, expect, it } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function destinations(
  tenantKind: 'buyer' | 'supplier' | 'operator',
  permissions: readonly PermissionCode[],
) {
  return navGroupsFor(features, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('dashboard feature registration', () => {
  it('shows the procurement overview to a buyer with dashboard.view', () => {
    expect(destinations('buyer', ['dashboard.view'])).toEqual(['/buyer/dashboard']);
  });

  it('hides the buyer overview without dashboard.view', () => {
    expect(destinations('buyer', ['org.users.view'])).toEqual([]);
  });

  it('shows the supplier overview only to a supplier with supplier.dashboard.view', () => {
    expect(destinations('supplier', ['supplier.dashboard.view'])).toEqual(['/supplier/dashboard']);
    expect(destinations('supplier', ['dashboard.view'])).toEqual([]);
    expect(destinations('operator', ['dashboard.view', 'supplier.dashboard.view'])).toEqual([]);
  });

  it('guards every route with a permission and loads each page lazily', () => {
    const routes = features.flatMap((module) => module.routes);
    expect(
      routes.every((route) => route.permission !== undefined && route.load !== undefined),
    ).toBe(true);
  });
});
