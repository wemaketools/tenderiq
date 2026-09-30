import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

function navIds(tenantKind: 'buyer' | 'supplier', permissions: string[]): string[] {
  return navGroupsFor(features, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

describe('qualification navigation', () => {
  it('hides every qualification item without a qualification permission', () => {
    expect(navIds('buyer', ['tender.view'])).toEqual([]);
  });

  it('shows the queue, decisions and programs to a qualification assessor', () => {
    expect(navIds('buyer', ['qualification.review'])).toEqual([
      'buyer.qualification.queue',
      'buyer.qualification.monitoring',
      'buyer.qualification.programs',
    ]);
  });

  it('shows only the program register to a program manager without review rights', () => {
    expect(navIds('buyer', ['qualification.program.manage'])).toEqual([
      'buyer.qualification.programs',
    ]);
  });

  it('shows applications and decisions to suppliers who apply or only follow outcomes', () => {
    const expected = ['supplier.qualification', 'supplier.qualification.decisions'];
    expect(navIds('supplier', ['supplier.qualification.apply'])).toEqual(expected);
    expect(navIds('supplier', ['supplier.outcomes.view'])).toEqual(expected);
  });

  it('never shows buyer qualification items in a supplier organization', () => {
    expect(navIds('supplier', ['qualification.review'])).toEqual([]);
  });

  it('guards the decision form with decide and program creation with manage', () => {
    const buyer = features.find((module) => module.area === 'buyer');
    const decide = buyer?.routes.find((route) => route.path.endsWith('/decision'));
    const create = buyer?.routes.find((route) => route.path === 'admin/qualification/new');
    expect(decide?.permission).toBe('qualification.decide');
    expect(create?.permission).toBe('qualification.program.manage');
  });
});
