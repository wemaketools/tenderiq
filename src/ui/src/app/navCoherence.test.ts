/**
 * Sidebar coherence across every feature (architecture-plan §4, docs/screenshots): for each organization kind the
 * sidebar has translated labels, one position per destination inside each section, one icon per destination and a
 * sensible landing page.
 */
import { describe, expect, it } from 'vitest';

import type { TenantKind } from '@contracts/common';
import { PERMISSION_CODES } from '@contracts/permissions';

import { hasTranslation } from '../lib/i18n';
import { areaPath, features, firstNavDestination, navGroupsFor } from './featureRegistry';

const KINDS: readonly TenantKind[] = ['buyer', 'supplier', 'operator'];
const AREA_OF: Readonly<Record<TenantKind, 'buyer' | 'supplier' | 'ops'>> = {
  buyer: 'buyer',
  supplier: 'supplier',
  operator: 'ops',
};

function sidebar(kind: TenantKind) {
  return navGroupsFor(features, { tenantKind: kind, permissions: [...PERMISSION_CODES] });
}

describe('sidebar coherence', () => {
  it.each(KINDS)('translates every %s sidebar label and every route title', (kind) => {
    // Arrange
    const items = sidebar(kind).flatMap((group) => group.items);

    // Act
    const untranslated = items
      .filter((item) => !hasTranslation(item.label))
      .map((item) => item.label);
    const titles = features.flatMap((feature) =>
      feature.routes.flatMap((route) => (route.title === undefined ? [] : [route.title])),
    );

    // Assert
    expect(untranslated).toEqual([]);
    expect(titles.filter((title) => !hasTranslation(title))).toEqual([]);
  });

  it.each(KINDS)(
    'gives every %s destination its own position inside its section and its own icon',
    (kind) => {
      // Arrange
      const groups = sidebar(kind);

      // Act
      const positions = groups.flatMap((group) =>
        group.items.map((item) => `${group.section}:${String(item.order)}`),
      );
      const icons = groups.flatMap((group) => group.items.map((item) => item.icon));
      const destinations = groups.flatMap((group) => group.items.map((item) => item.to));

      // Assert
      expect(positions.filter((position, index) => positions.indexOf(position) !== index)).toEqual(
        [],
      );
      expect(icons.filter((icon, index) => icons.indexOf(icon) !== index)).toEqual([]);
      expect(destinations.filter((to, index) => destinations.indexOf(to) !== index)).toEqual([]);
    },
  );

  it.each([
    ['buyer', '/buyer/dashboard'],
    ['supplier', '/supplier/dashboard'],
    ['operator', '/ops/customers'],
  ] as const)('lands a %s organization on %s', (kind, landing) => {
    expect(firstNavDestination(sidebar(kind), AREA_OF[kind])).toBe(landing);
  });

  it.each(KINDS)(
    'keeps the personal and help destinations of a %s sidebar at the end of the administration section',
    (kind) => {
      const admin = sidebar(kind).find((group) => group.section === 'admin');
      expect(admin?.items.at(-1)?.to).toBe('/me/help');
    },
  );

  it.each(KINDS)(
    'gives every %s section action a translated label and a target that is a registered page',
    (kind) => {
      // Arrange: every page of every feature, plus the shell's organization chooser (router.tsx).
      const patterns = [
        '/select-organization',
        ...features.flatMap((feature) =>
          feature.routes.map((route) => areaPath(feature.area, route.path)),
        ),
      ].map((path) => new RegExp(`^${path.replace(/:[A-Za-z]+/g, '[^/]+')}$`));
      const actions = sidebar(kind).flatMap((group) =>
        group.items.flatMap((item) =>
          item.sectionAction === undefined ? [] : [item.sectionAction],
        ),
      );

      // Act
      const untranslated = actions.filter((action) => !hasTranslation(action.label));
      const unrouted = actions.filter((action) => {
        const pathname = new URL(action.to, 'http://tiq.local').pathname;
        return !patterns.some((pattern) => pattern.test(pathname));
      });

      // Assert
      expect(actions.length).toBeGreaterThan(0);
      expect(untranslated.map((action) => action.label)).toEqual([]);
      expect(unrouted.map((action) => action.to)).toEqual([]);
    },
  );
});
