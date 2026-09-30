import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';
import { OPS_ALL, SUPPORT_AGENT } from './testData';

function navTargets(tenantKind: 'buyer' | 'supplier' | 'operator', permissions: readonly string[]) {
  return navGroupsFor(features, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.to),
  );
}

describe('operator area registration (OPS-01..07)', () => {
  it('shows every operator destination to a platform operator', () => {
    expect(navTargets('operator', OPS_ALL)).toEqual([
      '/ops/customers',
      '/ops/offboarding',
      '/ops/subscriptions',
      '/ops/support',
      '/ops/incidents',
      '/ops/oversight',
      '/ops/content',
    ]);
  });

  it('shows a support agent only the customer register, support, incidents and content', () => {
    expect(navTargets('operator', SUPPORT_AGENT)).toEqual([
      '/ops/customers',
      '/ops/offboarding',
      '/ops/support',
      '/ops/incidents',
      '/ops/content',
    ]);
  });

  it('never shows operator destinations to buyers or suppliers', () => {
    expect(navTargets('buyer', OPS_ALL)).toEqual([]);
    expect(navTargets('supplier', OPS_ALL)).toEqual([]);
  });

  it('guards every route with a permission', () => {
    const routes = features.flatMap((module) => module.routes);
    expect(routes.length).toBe(20);
    expect(routes.every((route) => route.permission !== undefined)).toBe(true);
  });
});
