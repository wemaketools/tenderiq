import { describe, expect, it } from 'vitest';

import { features as registered, navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function navIds(kind: 'buyer' | 'supplier' | 'operator', permissions: readonly string[]): string[] {
  return navGroupsFor(features, { tenantKind: kind, permissions }).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

describe('supplier-org routes and navigation', () => {
  it('registers the public registration page, the personal requests page and the supplier screens', () => {
    expect(registered.some((module) => module.id === 'supplier-org')).toBe(true);
    const paths = features.flatMap((module) =>
      module.routes.map((route) => `${module.area}:${route.path}`),
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        'public:register',
        'common:membership-requests',
        'supplier:organization',
        'supplier:organization/edit',
        'supplier:organization/identity-changes/new',
        'supplier:organization/identity-changes/:changeId',
        'supplier:evidence',
        'supplier:evidence/new',
        'supplier:evidence/:evidenceId',
      ]),
    );
  });

  it('shows the profile and evidence library to a supplier administrator', () => {
    expect(
      navIds('supplier', [
        'supplier.dashboard.view',
        'supplier.org.manage',
        'supplier.evidence.manage',
      ]),
    ).toEqual(
      expect.arrayContaining([
        'supplier.organization',
        'supplier.evidence',
        'me.supplierMembershipRequests',
      ]),
    );
  });

  it('hides the evidence library from members without an evidence right', () => {
    const ids = navIds('supplier', ['supplier.dashboard.view']);
    expect(ids).toContain('supplier.organization');
    expect(ids).not.toContain('supplier.evidence');
  });

  it('shows none of the supplier items to a buyer', () => {
    const ids = navIds('buyer', ['supplier.directory.view']);
    expect(ids).not.toContain('supplier.organization');
    expect(ids).not.toContain('me.supplierMembershipRequests');
  });

  it('guards editing and adding with the maintenance permissions', () => {
    const supplier = features.find((module) => module.id === 'supplier-org');
    const guard = (path: string) =>
      supplier?.routes.find((route) => route.path === path)?.permission;
    expect(guard('organization/edit')).toBe('supplier.org.manage');
    expect(guard('evidence/new')).toBe('supplier.evidence.manage');
  });
});
