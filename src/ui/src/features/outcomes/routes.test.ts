import { describe, expect, it } from 'vitest';

import { permissionsForTemplates } from '@contracts/permissions';

import { features as awardFeatures } from '../awards/routes';
import { features as outcomeFeatures } from './routes';

type Requirement = string | readonly string[] | undefined;

function allowed(requirement: Requirement, granted: readonly string[]): boolean {
  if (requirement === undefined) return true;
  const list = typeof requirement === 'string' ? [requirement] : requirement;
  return list.some((code) => granted.includes(code));
}

function visibleNav(templates: Parameters<typeof permissionsForTemplates>[0]): string[] {
  const granted = permissionsForTemplates(templates);
  return [...awardFeatures, ...outcomeFeatures]
    .flatMap((feature) => feature.nav ?? [])
    .filter((item) => allowed(item.permission, granted))
    .map((item) => item.id);
}

describe('award and outcome navigation', () => {
  it('shows awards, cases and closeout to a procurement manager', () => {
    expect(visibleNav(['procurement_manager'])).toEqual(
      expect.arrayContaining(['buyer.awards', 'buyer.award-cases', 'buyer.closeout']),
    );
  });

  it('shows the cases entry to a legal reviewer', () => {
    expect(visibleNav(['legal_reviewer'])).toContain('buyer.award-cases');
  });

  it('hides the award entries from a bid-opening officer', () => {
    expect(visibleNav(['opening_officer']).filter((id) => id.startsWith('buyer.'))).toEqual([]);
  });

  it('hides every award entry from a requester', () => {
    const nav = visibleNav(['requester']);
    expect(nav.filter((id) => id.startsWith('buyer.'))).toEqual([]);
  });

  it('shows outcomes and complaints to a supplier bid manager', () => {
    expect(visibleNav(['bid_manager'])).toEqual(
      expect.arrayContaining(['supplier.outcomes', 'supplier.complaints']),
    );
  });

  it('guards every buyer and supplier route with a permission and keeps public routes open', () => {
    for (const feature of [...awardFeatures, ...outcomeFeatures]) {
      for (const route of feature.routes) {
        if (feature.area === 'public') {
          expect(route.permission).toBeUndefined();
        } else {
          expect(route.permission).toBeDefined();
        }
      }
    }
  });
});
