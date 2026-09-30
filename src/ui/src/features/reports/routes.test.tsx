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

describe('reports feature registration', () => {
  it('shows reports and the definitions and exports admin to a report manager', () => {
    expect(destinations(['report.view', 'report.manage'])).toEqual([
      '/buyer/reports',
      '/buyer/admin/reports',
    ]);
  });

  it('shows only the reports to a report viewer without export rights', () => {
    expect(destinations(['report.view'])).toEqual(['/buyer/reports']);
  });

  it('shows the export history entry to an auditor without report permissions', () => {
    expect(destinations(['audit.view'])).toEqual(['/buyer/admin/reports']);
  });

  it('never shows reporting to a supplier', () => {
    expect(destinations(['report.view', 'report.manage'], 'supplier')).toEqual([]);
  });

  it('guards every route with a permission and loads each page lazily', () => {
    const routes = features.flatMap((module) => module.routes);
    expect(routes).toHaveLength(7);
    expect(
      routes.every((route) => route.permission !== undefined && route.load !== undefined),
    ).toBe(true);
  });
});
