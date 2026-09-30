/**
 * The feature module contract (architecture-plan §4 "Feature auto-registration", docs/technical/09-frontend.md §7).
 *
 * Each `src/features/<feature>/routes.tsx` exports `features: FeatureModule[]`. Feature agents never edit a shared
 * SPA file: the router mounts each module's routes under its area and the sidebar builds itself from `nav`.
 */
import type { ComponentType, ReactNode } from 'react';

import type { TenantKind } from '@contracts/common';
import type { PermissionCode } from '@contracts/permissions';

import type { IconName } from '../components/ui/Icon';

/** Where a module's routes are mounted. */
export type FeatureArea = 'buyer' | 'supplier' | 'ops' | 'public' | 'common';

export const FEATURE_AREAS: readonly FeatureArea[] = [
  'buyer',
  'supplier',
  'ops',
  'public',
  'common',
];

/** URL root of each area: `common` is the personal `/me` area; `public` is the site root. */
export const AREA_ROOTS: Readonly<Record<FeatureArea, string>> = {
  buyer: '/buyer',
  supplier: '/supplier',
  ops: '/ops',
  common: '/me',
  public: '',
};

/** The tenant kind an area requires (`null`: any signed-in context, or public). */
export const AREA_TENANT_KIND: Readonly<Record<FeatureArea, TenantKind | null>> = {
  buyer: 'buyer',
  supplier: 'supplier',
  ops: 'operator',
  common: null,
  public: null,
};

/** The area home of each tenant kind. */
export const TENANT_KIND_AREA: Readonly<Record<TenantKind, 'buyer' | 'supplier' | 'ops'>> = {
  buyer: 'buyer',
  supplier: 'supplier',
  operator: 'ops',
};

/** One permission, or a non-empty list meaning "any of these" (the same rule as the contracts). */
export type PermissionRequirement = PermissionCode | readonly [PermissionCode, ...PermissionCode[]];

/**
 * Sidebar sections, in display order (DD-48). Each section with more than one destination has a collapsible
 * heading (`shell.nav.section.<id>`); the section of the current page is always open. The shell draws a separator
 * before `admin`.
 */
export const NAV_SECTIONS = [
  'home',
  'work',
  'planning',
  'sourcing',
  'responding',
  'evaluation',
  'award',
  'contracts',
  'suppliers',
  'insights',
  'platform',
  'admin',
] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

/** The count shown on a nav item: a `me` count from the badges slice, or a feature-reported nav badge id. */
export type NavBadgeSource =
  'notifications' | 'tasks' | 'tasksOverdue' | { readonly navBadgeId: string };

/**
 * The action of a whole sidebar destination, for example "New request" for Requests (DD-46). The top bar shows it
 * to the left of the search box on every page of the destination, so it stays in place while the user drills in.
 * An action on one record, or on one part of a destination (a tab, a sub-list), is not a section action: it belongs
 * in that page's head (PageHeader `primaryAction`). A section action always navigates; a create dialog opens from a
 * search parameter of the destination's list page (`customers?new=1`, see `useCreateParam`).
 */
export interface SectionAction {
  /** i18n key of the label. */
  readonly label: string;
  /** Target relative to the area root like `NavItem.path` (a query is allowed), or absolute when it starts with `/`. */
  readonly path: string;
  readonly icon: IconName;
  /** Hidden unless the active membership holds the permission (any of a list). */
  readonly permission?: PermissionRequirement;
}

export interface NavItem {
  /** Unique across all modules, for example `buyer.tenders`. */
  readonly id: string;
  /** i18n key of the label, for example `tenders.nav.tenders`. */
  readonly label: string;
  /** Path relative to the area root (`tenders`, or `''` for the area home). */
  readonly path: string;
  readonly section: NavSection;
  /** Order inside the section (ascending). */
  readonly order: number;
  readonly icon: IconName;
  /** Hidden unless the active membership holds the permission (any of a list). */
  readonly permission?: PermissionRequirement;
  /** For `common` items: only for these tenant kinds. */
  readonly tenantKinds?: readonly TenantKind[];
  readonly badge?: NavBadgeSource;
  /** Active only on an exact path match (default: the path and everything below it). */
  readonly end?: boolean;
  /** Shown in the top bar on every page of this destination (DD-46). */
  readonly sectionAction?: SectionAction;
}

/** A page module loaded on demand: its default export is the page component. */
export type PageLoader = () => Promise<{ readonly default: ComponentType }>;

export interface FeatureRoute {
  /** Path relative to the area root (`tenders/:tenderId`); `''` for the area home. */
  readonly path: string;
  /** Code-split page (preferred). */
  readonly load?: PageLoader;
  /** Eager element (small pages). Exactly one of `load` and `element` is required. */
  readonly element?: ReactNode;
  /** RouteGuard shows the Forbidden page unless the membership holds it. */
  readonly permission?: PermissionRequirement;
  /** i18n key of the document/top bar title used until the page renders its PageHeader. */
  readonly title?: string;
}

export interface FeatureModule {
  /** Unique module id, usually the feature directory name. */
  readonly id: string;
  readonly area: FeatureArea;
  readonly routes: readonly FeatureRoute[];
  readonly nav?: readonly NavItem[];
}

/** The shape of a `routes.tsx` module. */
export interface FeatureRoutesModule {
  readonly features?: readonly FeatureModule[];
}
