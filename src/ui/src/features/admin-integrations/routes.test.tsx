import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';
import { ADMIN } from './testData';

function navTargets(tenantKind: 'buyer' | 'supplier' | 'operator', permissions: readonly string[]) {
  return navGroupsFor(features, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('buyer service area registration (ADM-15..17)', () => {
  it('shows the service entry to an organization administrator', () => {
    expect(navTargets('buyer', ADMIN)).toEqual(['/buyer/admin/service']);
  });

  it('shows the entry to a tender owner, who resolves failed publications', () => {
    expect(navTargets('buyer', ['tender.publish'])).toEqual(['/buyer/admin/service']);
  });

  it('hides the entry from buyers without any service permission and from other organization kinds', () => {
    expect(navTargets('buyer', ['tender.view'])).toEqual([]);
    expect(navTargets('supplier', ADMIN)).toEqual([]);
    expect(navTargets('operator', ADMIN)).toEqual([]);
  });

  it('guards every route with a permission', () => {
    const routes = features.flatMap((module) => module.routes);
    expect(routes).toHaveLength(10);
    expect(routes.every((route) => route.permission !== undefined)).toBe(true);
  });
});
