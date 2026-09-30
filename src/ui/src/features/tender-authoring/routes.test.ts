import { describe, expect, it } from 'vitest';

import { hasPermission, navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function tenderNav(tenantKind: 'buyer' | 'supplier' | 'operator', permissions: string[]) {
  return navGroupsFor(features, { tenantKind, permissions })
    .flatMap((group) => group.items)
    .find((item) => item.id === 'buyer.tenders');
}

describe('tender-authoring routes and navigation', () => {
  it('shows the Tenders entry in the sourcing section when a buyer member holds tender.view', () => {
    const item = tenderNav('buyer', ['tender.view']);

    expect(item?.to).toBe('/buyer/tenders');
    expect(item?.section).toBe('sourcing');
  });

  it('hides the Tenders entry when the buyer member lacks tender.view', () => {
    expect(tenderNav('buyer', ['dashboard.view'])).toBeUndefined();
  });

  it('hides the Tenders entry for supplier and operator organizations', () => {
    expect(tenderNav('supplier', ['tender.view'])).toBeUndefined();
    expect(tenderNav('operator', ['tender.view'])).toBeUndefined();
  });

  it('declares one route per screen, with creation guarded by tender.create', () => {
    const routes = features[0]?.routes ?? [];
    const byPath = new Map(routes.map((route) => [route.path, route]));

    expect([...byPath.keys()]).toEqual([
      'tenders',
      'tenders/new',
      'tenders/:tenderId',
      'tenders/:tenderId/scope',
      'tenders/:tenderId/pricing',
      'tenders/:tenderId/evaluation',
      'tenders/:tenderId/timetable',
      'tenders/:tenderId/release',
    ]);
    expect(hasPermission(byPath.get('tenders/new')?.permission, ['tender.view'])).toBe(false);
    expect(hasPermission(byPath.get('tenders/new')?.permission, ['tender.create'])).toBe(true);
    expect(
      hasPermission(byPath.get('tenders/:tenderId/release')?.permission, ['tender.view']),
    ).toBe(true);
  });
});
