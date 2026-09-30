/**
 * Test helpers of the requests feature: render a page for a KWU membership holding the given permissions, mounted
 * at its route pattern so `useParams` works.
 */
import type { ReactElement } from 'react';

import type { PermissionCode } from '@contracts/permissions';

import type { ScreenFilters } from '../../../app/slices/filters';

import { makeTenant, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';

export const OFFICER: readonly PermissionCode[] = [
  'request.create',
  'request.view_all',
  'request.review',
  'plan.manage',
  'strategy.manage',
  'tender.create',
];

export const MANAGER: readonly PermissionCode[] = [
  ...OFFICER,
  'request.approve',
  'strategy.approve',
  'audit.view',
];

export function renderPage(
  element: ReactElement,
  options: {
    readonly route: string;
    readonly path?: string;
    readonly permissions?: readonly PermissionCode[];
    /** Screen filters preloaded in the store (for example a calendar month). */
    readonly filters?: Record<string, ScreenFilters>;
  },
) {
  return renderWithProviders(element, {
    route: options.route,
    path: options.path ?? '*',
    state: {
      session: signedInSession({
        activeTenant: makeTenant(
          { capacity: 'Procurement Manager' },
          options.permissions ?? MANAGER,
        ),
      }),
      filters: { byScreen: options.filters ?? {} },
    },
  });
}

/** An empty document list (the shared DocumentList widget on request and strategy pages). */
export const EMPTY_DOCUMENTS = {
  'GET /api/v1/buyer/documents': () => ({ body: { items: [], total: 0, page: 1, pageSize: 25 } }),
};
