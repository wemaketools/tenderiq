import { describe, expect, it } from 'vitest';

import { navGroupsFor } from '../../app/featureRegistry';
import { features } from './routes';

describe('search feature registration', () => {
  it('leaves search to the top bar search box: no sidebar entry for any organization kind (DD-48)', () => {
    for (const tenantKind of ['buyer', 'supplier', 'operator'] as const) {
      const destinations = navGroupsFor(features, { tenantKind, permissions: [] }).flatMap(
        (group) => group.items.map((item) => item.to),
      );
      expect(destinations).toEqual([]);
    }
  });

  it('opens search to every organization kind without a permission', () => {
    expect(features[0]?.routes.every((route) => route.permission === undefined)).toBe(true);
  });

  it('mounts the search page lazily in the personal area', () => {
    expect(features[0]?.area).toBe('common');
    expect(features[0]?.routes.map((route) => route.path)).toEqual(['search']);
  });
});
