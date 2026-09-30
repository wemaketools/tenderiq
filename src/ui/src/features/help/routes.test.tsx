import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function navTargets(tenantKind: 'buyer' | 'supplier' | 'operator') {
  return navGroupsFor(features, { tenantKind, permissions: [] }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('help centre registration (COM-09)', () => {
  it('leaves help to the top bar help icon: no sidebar entry for any organization kind (DD-48)', () => {
    expect(navTargets('buyer')).toEqual([]);
    expect(navTargets('supplier')).toEqual([]);
    expect(navTargets('operator')).toEqual([]);
  });

  it('opens the help centre to every organization kind without a permission', () => {
    const personal = features.find((module) => module.area === 'common');
    expect(personal?.routes.every((route) => route.permission === undefined)).toBe(true);
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
