import { describe, expect, it } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function destinations(
  permissions: readonly PermissionCode[],
  tenantKind: 'buyer' | 'supplier' = 'buyer',
) {
  return navGroupsFor(features, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('records feature registration', () => {
  it('shows audit and records to auditors, records managers and export holders', () => {
    for (const permission of [
      'audit.view',
      'records.hold.manage',
      'records.retention.manage',
      'records.disposal.approve',
      'export.create',
    ] as const) {
      expect(destinations([permission])).toEqual(['/buyer/admin/records']);
    }
  });

  it('hides audit and records from other buyer roles and from suppliers', () => {
    expect(destinations(['dashboard.view', 'tender.view'])).toEqual([]);
    expect(destinations(['audit.view'], 'supplier')).toEqual([]);
  });

  it('guards every route with a permission and loads each page lazily', () => {
    const routes = features.flatMap((module) => module.routes);
    expect(routes).toHaveLength(8);
    expect(
      routes.every((route) => route.permission !== undefined && route.load !== undefined),
    ).toBe(true);
  });
});
