import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features as opportunities } from '../opportunities/routes';
import { features as publicPortal } from '../public-portal/routes';
import { features as publication } from './routes';
import { BUYER_ALL, SUPPLIER_ALL } from './test/kit';

const all = [...publication, ...publicPortal, ...opportunities];

function navTargets(tenantKind: 'buyer' | 'supplier' | 'operator', permissions: readonly string[]) {
  return navGroupsFor(all, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('publication feature registration', () => {
  it('shows the publication register to a buyer who may view tenders', () => {
    expect(navTargets('buyer', ['tender.view'])).toEqual(['/buyer/publications']);
  });

  it('shows the publication register to a publisher without tender.view', () => {
    expect(navTargets('buyer', ['tender.publish'])).toEqual(['/buyer/publications']);
  });

  it('hides the register from a buyer without any tender permission', () => {
    expect(navTargets('buyer', ['dashboard.view'])).toEqual([]);
  });

  it('shows opportunities, invitations and pursuits to a supplier bid manager', () => {
    expect(navTargets('supplier', SUPPLIER_ALL)).toEqual([
      '/supplier/opportunities',
      '/supplier/invitations',
      '/supplier/pursuits',
    ]);
  });

  it('hides the supplier entries without the opportunities or pursuit permissions', () => {
    expect(navTargets('supplier', ['supplier.notices.acknowledge'])).toEqual([]);
  });

  it('never shows buyer entries to a supplier or supplier entries to a buyer', () => {
    expect(navTargets('supplier', BUYER_ALL)).toEqual([]);
    expect(navTargets('buyer', SUPPLIER_ALL)).toEqual([]);
  });

  it('registers the public portal without permissions, including the portal home', () => {
    const paths = publicPortal.flatMap((module) =>
      module.routes.map((route) => [route.path, route.permission]),
    );
    expect(paths).toEqual([
      ['', undefined],
      ['b/:buyerSlug', undefined],
      ['opportunities', undefined],
      ['opportunities/:buyerSlug/:ref', undefined],
      ['guidance', undefined],
      ['guidance/:articleSlug', undefined],
    ]);
  });

  it('guards every buyer and supplier route with a permission and loads pages lazily', () => {
    const guarded = [...publication, ...opportunities].flatMap((module) => module.routes);
    expect(guarded).toHaveLength(12);
    expect(
      guarded.every((route) => route.permission !== undefined && route.load !== undefined),
    ).toBe(true);
  });
});
