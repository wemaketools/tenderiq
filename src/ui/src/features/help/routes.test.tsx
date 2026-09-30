import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function navTargets(tenantKind: 'buyer' | 'supplier' | 'operator') {
  return navGroupsFor(features, { tenantKind, permissions: [] }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('help centre registration (COM-09)', () => {
  it('shows help and support to every organization kind without a permission', () => {
    expect(navTargets('buyer')).toEqual(['/me/help']);
    expect(navTargets('supplier')).toEqual(['/me/help']);
    expect(navTargets('operator')).toEqual(['/me/help']);
  });

  it('registers the personal help routes and the public service status page', () => {
    expect(
      features.map((module) => [module.area, module.routes.map((route) => route.path)]),
    ).toEqual([
      ['common', ['help', 'help/articles/:articleSlug', 'help/cases/:caseId']],
      ['public', ['service-status']],
    ]);
  });
});
