import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { hasTranslation } from '../../lib/i18n';
import { features } from './routes';

function navIds(tenantKind: 'buyer' | 'supplier', permissions: string[]): string[] {
  return navGroupsFor(features, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

describe('contracts routes and navigation', () => {
  it('shows the buyer contract register to members with contract.view only', () => {
    expect(navIds('buyer', ['contract.view'])).toEqual(['buyer.contracts']);
    expect(navIds('buyer', ['tender.view'])).toEqual([]);
  });

  it('shows the supplier contracts to participants and outcome followers, never to buyers', () => {
    expect(navIds('supplier', ['supplier.contract.participate'])).toEqual(['supplier.contracts']);
    expect(navIds('supplier', ['supplier.outcomes.view'])).toEqual(['supplier.contracts']);
    expect(navIds('supplier', ['supplier.profile.view'])).toEqual([]);
    expect(navIds('buyer', ['supplier.contract.participate'])).toEqual([]);
  });

  it('guards the financial view and contract creation with their own permissions', () => {
    const buyer = features.find((feature) => feature.id === 'contracts');
    const byPath = new Map(buyer?.routes.map((route) => [route.path, route.permission]));
    expect(byPath.get('contracts/:contractId/financials')).toBe('contract.financials.view');
    expect(byPath.get('contracts/new')).toBe('contract.prepare');
    expect(byPath.get('contracts/:contractId/renewals')).toBe('contract.view');
  });

  it('declares every route title and nav label in the catalog', () => {
    for (const feature of features) {
      for (const route of feature.routes) {
        expect(route.title === undefined || hasTranslation(route.title)).toBe(true);
      }
      for (const item of feature.nav ?? []) {
        expect(hasTranslation(item.label)).toBe(true);
      }
    }
  });
});
