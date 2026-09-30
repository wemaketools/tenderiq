import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function navIds(kind: 'buyer' | 'supplier' | 'operator', permissions: readonly string[]): string[] {
  return navGroupsFor(features, { tenantKind: kind, permissions }).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

describe('supplier-directory routes and navigation', () => {
  it('registers the buyer directory, the relationship record and the operator reviews', () => {
    const paths = features.flatMap((module) =>
      module.routes.map((route) => `${module.area}:${route.path}`),
    );
    expect(paths).toEqual([
      'buyer:suppliers',
      'buyer:suppliers/:supplierTenantId',
      'ops:supplier-registrations',
      'ops:supplier-duplicates',
      'ops:supplier-duplicates/:candidateId',
      'ops:supplier-identity-changes',
      'ops:supplier-identity-changes/:changeId',
    ]);
  });

  it('shows the directory to buyers who may view it, in the suppliers section', () => {
    const groups = navGroupsFor(features, {
      tenantKind: 'buyer',
      permissions: ['supplier.directory.view'],
    });
    expect(groups).toEqual([
      expect.objectContaining({
        section: 'suppliers',
        items: [expect.objectContaining({ id: 'buyer.suppliers', to: '/buyer/suppliers' })],
      }),
    ]);
  });

  it('hides the directory from buyers without the directory right and from suppliers', () => {
    expect(navIds('buyer', ['dashboard.view'])).toEqual([]);
    expect(navIds('supplier', ['supplier.directory.view'])).toEqual([]);
  });

  it('shows the three supplier reviews only to operators with the customer right', () => {
    expect(navIds('operator', ['ops.customers.manage'])).toEqual([
      'ops.supplierReviews',
      'ops.supplierDuplicates',
      'ops.supplierIdentityChanges',
    ]);
    expect(navIds('operator', ['ops.support.view'])).toEqual([]);
  });
});
