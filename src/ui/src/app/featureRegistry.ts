/**
 * Feature auto-registration (architecture-plan §4): every `src/features/<feature>/routes.tsx` is collected with
 * `import.meta.glob(..., { eager: true })`. Nothing else in the shell names a feature.
 *
 * Validation is defensive: a malformed module is reported with `console.error` and skipped, and duplicate module
 * ids, nav ids or route paths are dropped (first one wins), so one broken feature cannot take down the shell.
 */
import type { TenantKind } from '@contracts/common';

import { AREA_ROOTS, AREA_TENANT_KIND, FEATURE_AREAS, NAV_SECTIONS } from './featureTypes';
import type {
  FeatureArea,
  FeatureModule,
  FeatureRoutesModule,
  NavItem,
  NavSection,
  PermissionRequirement,
} from './featureTypes';

export * from './featureTypes';

/** Validates and flattens the modules of the given `routes.tsx` files. */
export function collectFeatures(
  modules: Readonly<Record<string, FeatureRoutesModule>>,
): FeatureModule[] {
  const collected: FeatureModule[] = [];
  const moduleIds = new Set<string>();
  const navIds = new Set<string>();
  const routeKeys = new Set<string>();

  for (const [file, module] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
    const list = module.features;
    if (!Array.isArray(list)) {
      console.error(`featureRegistry: ${file} must export "features: FeatureModule[]".`);
      continue;
    }
    for (const feature of list as readonly FeatureModule[]) {
      if (!FEATURE_AREAS.includes(feature.area)) {
        console.error(`featureRegistry: ${file} module "${feature.id}" has an unknown area.`);
        continue;
      }
      if (moduleIds.has(feature.id)) {
        console.error(`featureRegistry: duplicate feature module id "${feature.id}" in ${file}.`);
        continue;
      }
      moduleIds.add(feature.id);
      const routes = feature.routes.filter((route) => {
        const key = `${feature.area}:${route.path}`;
        if ((route.load === undefined) === (route.element === undefined)) {
          console.error(
            `featureRegistry: route "${route.path}" of "${feature.id}" needs exactly one of load and element.`,
          );
          return false;
        }
        if (routeKeys.has(key)) {
          console.error(`featureRegistry: duplicate route "${key}" in "${feature.id}".`);
          return false;
        }
        routeKeys.add(key);
        return true;
      });
      const nav = (feature.nav ?? []).filter((item) => {
        if (navIds.has(item.id)) {
          console.error(`featureRegistry: duplicate nav item id "${item.id}" in "${feature.id}".`);
          return false;
        }
        if (!(NAV_SECTIONS as readonly string[]).includes(item.section)) {
          console.error(`featureRegistry: nav item "${item.id}" has an unknown section.`);
          return false;
        }
        navIds.add(item.id);
        return true;
      });
      collected.push({ ...feature, routes, nav });
    }
  }
  return collected;
}

const routeModules = import.meta.glob<FeatureRoutesModule>('../features/*/routes.tsx', {
  eager: true,
});

/** Every registered feature module. */
export const features: readonly FeatureModule[] = collectFeatures(routeModules);

/** True when `granted` satisfies the requirement (any of a list). No requirement = allowed. */
export function hasPermission(
  requirement: PermissionRequirement | undefined,
  granted: readonly string[] | ReadonlySet<string>,
): boolean {
  if (requirement === undefined) {
    return true;
  }
  const codes: readonly string[] = typeof requirement === 'string' ? [requirement] : requirement;
  const held: ReadonlySet<string> =
    granted instanceof Set ? granted : new Set(granted as readonly string[]);
  return codes.some((code) => held.has(code));
}

/** The absolute path of a nav item or route: `areaPath('buyer', 'tenders')` → `/buyer/tenders`. */
export function areaPath(area: FeatureArea, relative: string): string {
  const root = AREA_ROOTS[area];
  const trimmed = relative.replace(/^\/+/, '');
  if (trimmed === '') {
    return root === '' ? '/' : root;
  }
  return `${root}/${trimmed}`;
}

export interface ResolvedNavItem extends NavItem {
  readonly area: FeatureArea;
  readonly to: string;
}

export interface NavGroup {
  readonly section: NavSection;
  readonly items: readonly ResolvedNavItem[];
}

/**
 * The sidebar for a context: items of the area matching the tenant kind plus `common` items, filtered by permission
 * (hiding is a convenience; the API enforces every permission), grouped by section in `NAV_SECTIONS` order.
 */
export function navGroupsFor(
  modules: readonly FeatureModule[],
  context: { readonly tenantKind: TenantKind; readonly permissions: readonly string[] },
): NavGroup[] {
  const granted = new Set(context.permissions);
  const items: ResolvedNavItem[] = [];
  for (const module of modules) {
    if (module.area === 'public') {
      continue;
    }
    const kind = AREA_TENANT_KIND[module.area];
    if (kind !== null && kind !== context.tenantKind) {
      continue;
    }
    for (const item of module.nav ?? []) {
      if (item.tenantKinds !== undefined && !item.tenantKinds.includes(context.tenantKind)) {
        continue;
      }
      if (!hasPermission(item.permission, granted)) {
        continue;
      }
      items.push({ ...item, area: module.area, to: areaPath(module.area, item.path) });
    }
  }
  return NAV_SECTIONS.map((section) => ({
    section,
    items: items
      .filter((item) => item.section === section)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
  })).filter((group) => group.items.length > 0);
}

/** The first destination of the sidebar, used as the landing page of an area. */
export function firstNavDestination(groups: readonly NavGroup[], area: FeatureArea): string | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.area === area) {
        return item.to;
      }
    }
  }
  return null;
}
