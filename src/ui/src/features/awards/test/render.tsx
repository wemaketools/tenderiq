/** Render helpers of the award and outcome page tests: a signed-in session with chosen permissions. */
import type { ReactElement } from 'react';

import type { PermissionCode } from '@contracts/permissions';

import { initialSessionState } from '../../../app/slices/session';
import { makeTenant, signedInSession, stateWith } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';

export const BUYER_ALL: readonly PermissionCode[] = [
  'tender.view',
  'award.recommend',
  'award.approve',
  'notice.issue',
  'complaint.manage',
  'debrief.manage',
  'event.closeout',
  'export.create',
];

export const SUPPLIER_ALL: readonly PermissionCode[] = [
  'supplier.outcomes.view',
  'supplier.complaint.submit',
  'supplier.notices.acknowledge',
  'supplier.response.submit',
];

interface Options {
  readonly route: string;
  readonly path: string;
  readonly permissions?: readonly PermissionCode[];
}

export function renderBuyer(element: ReactElement, options: Options) {
  return renderWithProviders(element, {
    state: stateWith(
      signedInSession({ activeTenant: makeTenant({}, options.permissions ?? BUYER_ALL) }),
    ),
    route: options.route,
    path: options.path,
  });
}

export function renderSupplier(element: ReactElement, options: Options) {
  return renderWithProviders(element, {
    state: stateWith(
      signedInSession({
        activeTenant: makeTenant(
          {
            tenantId: 8,
            kind: 'supplier',
            name: 'Limpopo Environmental Services',
            slug: 'limpopo-env',
            capacity: 'Organization Administrator',
          },
          options.permissions ?? SUPPLIER_ALL,
        ),
      }),
    ),
    route: options.route,
    path: options.path,
  });
}

export function renderPublic(element: ReactElement, options: Options) {
  return renderWithProviders(element, {
    state: stateWith(initialSessionState),
    route: options.route,
    path: options.path,
  });
}
