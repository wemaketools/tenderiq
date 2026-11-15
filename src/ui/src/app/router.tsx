/**
 * The route tree (architecture-plan §4 URL map, docs/technical/09-frontend.md §8), built from the feature registry:
 *
 * - `/` + public feature routes inside PublicShell (PUB-01…07, `/register`, `/invite/:token`…). Without a public
 *   home route, `/` goes to sign-in.
 * - `/signin`: the persona picker of the Stage A prototype, outside any shell (DD-50).
 * - `/select-organization`: signed in (COM-02).
 * - `/buyer/*`, `/supplier/*`, `/ops/*` and `/me/*`: signed in with an active organization, inside AppShell; the area
 *   must match the organization's kind (`/me` matches every kind). Each feature route can require a permission.
 * - Anything else: Not found.
 * - A route that fails to load or throws renders RouteErrorPage: inside the shell for area routes (the navigation
 *   stays usable), standalone otherwise.
 */
import { Suspense, lazy } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import type { RouteObject } from 'react-router';

import { SignInPage } from '../auth/SignInPage';
import { AppShell } from '../components/shell/AppShell';
import { PublicShell } from '../components/shell/PublicShell';
import { SelectOrganizationPage } from '../components/shell/SelectOrganizationPage';
import { SkeletonBlock } from '../components/ui/Skeleton';
import { AreaHomePage } from '../pages/AreaHomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';
import { RootLayout } from './RootLayout';
import { RouteGuard } from './RouteGuard';
import { features as registeredFeatures } from './featureRegistry';
import type { FeatureArea, FeatureModule, FeatureRoute } from './featureRegistry';

const lazyComponents = new WeakMap<FeatureRoute, ComponentType>();

function routeElement(route: FeatureRoute): ReactNode {
  if (route.element !== undefined) {
    return route.element;
  }
  let Component = lazyComponents.get(route);
  if (Component === undefined && route.load !== undefined) {
    Component = lazy(route.load);
    lazyComponents.set(route, Component);
  }
  if (Component === undefined) {
    return null;
  }
  return (
    <Suspense fallback={<SkeletonBlock lines={6} />}>
      <Component />
    </Suspense>
  );
}

function featureRoutes(modules: readonly FeatureModule[], area: FeatureArea): RouteObject[] {
  const routes: RouteObject[] = [];
  for (const module of modules) {
    if (module.area !== area) continue;
    for (const route of module.routes) {
      const element =
        route.permission === undefined ? (
          routeElement(route)
        ) : (
          <RouteGuard permission={route.permission}>{routeElement(route)}</RouteGuard>
        );
      routes.push(route.path === '' ? { index: true, element } : { path: route.path, element });
    }
  }
  return routes;
}

function areaRoute(
  modules: readonly FeatureModule[],
  area: FeatureArea,
  path: string,
): RouteObject {
  const children = featureRoutes(modules, area);
  if (!children.some((route) => route.index === true)) {
    children.unshift({ index: true, element: <AreaHomePage area={area} modules={modules} /> });
  }
  children.push({ path: '*', element: <NotFoundPage inShell /> });
  return {
    path,
    element: <RouteGuard area={area} />,
    errorElement: <RouteErrorPage inShell />,
    children,
  };
}

/** The route objects for a set of feature modules (exported for tests). */
export function buildRoutes(modules: readonly FeatureModule[]): RouteObject[] {
  const publicChildren = featureRoutes(modules, 'public');
  if (!publicChildren.some((route) => route.index === true)) {
    publicChildren.unshift({ index: true, element: <Navigate to="/signin" replace /> });
  }
  return [
    {
      element: <RootLayout />,
      errorElement: <RouteErrorPage />,
      children: [
        { path: '/', element: <PublicShell />, children: publicChildren },
        { path: '/signin', element: <SignInPage /> },
        {
          path: '/select-organization',
          element: (
            <RouteGuard>
              <SelectOrganizationPage />
            </RouteGuard>
          ),
        },
        {
          element: (
            <RouteGuard requireTenant>
              <AppShell modules={modules} />
            </RouteGuard>
          ),
          children: [
            areaRoute(modules, 'buyer', '/buyer'),
            areaRoute(modules, 'supplier', '/supplier'),
            areaRoute(modules, 'ops', '/ops'),
            areaRoute(modules, 'common', '/me'),
          ],
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}

export function createAppRouter(modules: readonly FeatureModule[] = registeredFeatures) {
  return createBrowserRouter(buildRoutes(modules));
}
