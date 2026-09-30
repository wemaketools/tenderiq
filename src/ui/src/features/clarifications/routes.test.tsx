import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';
import { BUYER_ALL, SUPPLIER_ALL } from './testData';

function navIds(tenantKind: 'buyer' | 'supplier' | 'operator', permissions: readonly string[]) {
  return navGroupsFor(features, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('clarifications feature registration', () => {
  it('shows the buyer clarifications entry when the membership may manage clarifications', () => {
    expect(navIds('buyer', ['tender.clarifications.manage'])).toEqual(['/buyer/clarifications']);
  });

  it('shows the buyer entry to an approver who only approves addenda', () => {
    expect(navIds('buyer', ['tender.addenda.approve'])).toEqual(['/buyer/clarifications']);
  });

  it('hides the buyer entry from a buyer without any clarification permission', () => {
    expect(navIds('buyer', ['tender.view', 'dashboard.view'])).toEqual([]);
  });

  it('shows the supplier questions and briefings entries to a supplier who can view opportunities', () => {
    expect(navIds('supplier', SUPPLIER_ALL)).toEqual([
      '/supplier/clarifications',
      '/supplier/briefings',
    ]);
  });

  it('hides the supplier entries without the opportunities permission', () => {
    expect(navIds('supplier', ['supplier.notices.acknowledge'])).toEqual([]);
  });

  it('never shows buyer entries to a supplier or supplier entries to a buyer', () => {
    expect(navIds('supplier', BUYER_ALL)).toEqual([]);
    expect(navIds('buyer', SUPPLIER_ALL)).toEqual([]);
  });

  it('registers the public edition route without a permission', () => {
    const publicModule = features.find((module) => module.area === 'public');
    expect(publicModule?.routes.map((route) => [route.path, route.permission])).toEqual([
      ['clarifications/:buyerSlug/:ref', undefined],
    ]);
  });

  it('guards every buyer and supplier route with a permission and loads each page lazily', () => {
    const guarded = features
      .filter((module) => module.area !== 'public')
      .flatMap((module) => module.routes);
    expect(guarded.length).toBe(17);
    expect(
      guarded.every((route) => route.permission !== undefined && route.load !== undefined),
    ).toBe(true);
  });
});
